import { z } from 'zod'
import { describe, expect, it } from 'vitest'

import { AuthorizedWindowRegistry } from '../../../src/main/ipc/authorized-window-registry'
import { createAppInfo, type AppInfoProvider } from '../../../src/main/ipc/create-app-info'
import { createIpcRouter, defineIpcRoute } from '../../../src/main/ipc/create-ipc-router'
import {
  createConsoleIpcErrorLogSink,
  createSafeStack,
  type IpcErrorLogEvent
} from '../../../src/main/ipc/ipc-error-logger'
import { registerAppInfoIpc } from '../../../src/main/ipc/register-app-info-ipc'
import {
  type IpcSenderEvent,
  type ValidatedIpcContext
} from '../../../src/main/ipc/validate-ipc-sender'
import {
  APP_GET_INFO_CHANNEL,
  appGetInfoRequestSchema,
  appGetInfoResultSchema,
  type AppGetInfoRequest,
  type AppGetInfoResult,
  type AppInfo
} from '../../../src/shared/contracts'
import { type IpcSafeReason, type Result } from '../../../src/shared/errors'

type Sender = { readonly label: string }
type Frame = { readonly label: string }

const requestId = '00000000-0000-4000-8000-000000000001'
const diagnosticRequestId = '00000000-0000-4000-8000-000000000002'
const validRequest = {
  contractVersion: 1,
  requestId,
  payload: {}
} as const
const validAppInfo: AppInfo = {
  contractVersion: 1,
  name: 'Lattice',
  version: '0.0.0',
  platform: 'win32'
}

function createEvent(
  overrides: Partial<IpcSenderEvent<Sender, Frame>> = {}
): IpcSenderEvent<Sender, Frame> {
  const sender: Sender = { label: 'sender' }
  const mainFrame: Frame = { label: 'main' }

  return {
    sender,
    senderId: 11,
    senderFrame: mainFrame,
    mainFrame,
    isSenderDestroyed: () => false,
    ...overrides
  }
}

type AppInfoHandler = (
  request: AppGetInfoRequest,
  context: ValidatedIpcContext
) => Promise<AppGetInfoResult>

interface RouterHarnessOptions {
  readonly event?: IpcSenderEvent<Sender, Frame>
  readonly registration?: 'same' | 'other' | 'none'
  readonly isWindowDestroyed?: () => boolean
  readonly handle?: AppInfoHandler
  readonly responseSchema?: z.ZodType<AppGetInfoResult>
  readonly createRequestId?: () => string
  readonly log?: (event: IpcErrorLogEvent) => void
}

function createRouterHarness(options: RouterHarnessOptions = {}) {
  const event = options.event ?? createEvent()
  const registry = new AuthorizedWindowRegistry<Sender>()
  const registration = options.registration ?? 'same'
  if (registration !== 'none') {
    registry.register({
      windowId: 7,
      webContentsId: event.senderId,
      sender: registration === 'same' ? event.sender : { label: 'other sender' },
      isWindowDestroyed: options.isWindowDestroyed ?? (() => false)
    })
  }

  const logs: IpcErrorLogEvent[] = []
  let handlerCalls = 0
  const handle: AppInfoHandler =
    options.handle ?? (() => Promise.resolve({ ok: true, value: validAppInfo }))
  const route = defineIpcRoute({
    channel: APP_GET_INFO_CHANNEL,
    requestSchema: appGetInfoRequestSchema,
    responseSchema: options.responseSchema ?? appGetInfoResultSchema,
    handle: async (request, context) => {
      handlerCalls += 1
      return handle(request, context)
    }
  })
  const router = createIpcRouter<Sender, Frame>({
    registry,
    routes: [route],
    createRequestId: options.createRequestId ?? (() => diagnosticRequestId),
    log: options.log ?? ((logEvent) => logs.push(logEvent))
  })

  return {
    event,
    logs,
    router,
    getHandlerCalls: () => handlerCalls
  }
}

interface FailureExpectation {
  readonly code:
    | 'IPC_INVALID_REQUEST'
    | 'IPC_UNAUTHORIZED_SENDER'
    | 'APP_VERSION_MISMATCH'
    | 'INTERNAL_UNEXPECTED'
  readonly messageKey:
    | 'errors.ipc.invalidRequest'
    | 'errors.ipc.unauthorizedSender'
    | 'errors.app.versionMismatch'
    | 'errors.internal.unexpected'
  readonly reason: IpcSafeReason
  readonly effectiveRequestId?: string
  readonly channel?: typeof APP_GET_INFO_CHANNEL | 'unknown'
  readonly level?: 'warning' | 'error'
  readonly expectedVersion?: 1
  readonly receivedVersion?: number
}

function expectFailure(
  result: unknown,
  logs: readonly IpcErrorLogEvent[],
  expected: FailureExpectation
): void {
  const effectiveRequestId = expected.effectiveRequestId ?? requestId
  const safeDetails = {
    reason: expected.reason,
    ...(expected.expectedVersion === undefined
      ? {}
      : { expectedVersion: expected.expectedVersion }),
    ...(expected.receivedVersion === undefined ? {} : { receivedVersion: expected.receivedVersion })
  }

  expect(result).toEqual({
    ok: false,
    error: {
      code: expected.code,
      messageKey: expected.messageKey,
      retryable: false,
      requestId: effectiveRequestId,
      safeDetails
    }
  })
  const parsedResult = appGetInfoResultSchema.parse(result)
  expect(parsedResult.ok).toBe(false)
  if (parsedResult.ok) {
    throw new Error('Expected a stable AppError result')
  }

  expect(logs).toHaveLength(1)
  expect(logs[0]).toMatchObject({
    level: expected.level ?? 'warning',
    code: expected.code,
    requestId: effectiveRequestId,
    channel: expected.channel ?? APP_GET_INFO_CHANNEL,
    reason: expected.reason
  })
  expect(logs[0]?.requestId).toBe(parsedResult.error.requestId)
}

function createUnsafeResponseHarness(value: unknown) {
  const event = createEvent()
  const registry = new AuthorizedWindowRegistry<Sender>()
  registry.register({
    windowId: 7,
    webContentsId: event.senderId,
    sender: event.sender,
    isWindowDestroyed: () => false
  })
  const logs: IpcErrorLogEvent[] = []
  const permissiveResponseSchema = z.custom<Result<unknown>>(() => true)
  const route = defineIpcRoute<AppGetInfoRequest, unknown>({
    channel: APP_GET_INFO_CHANNEL,
    requestSchema: appGetInfoRequestSchema,
    responseSchema: permissiveResponseSchema,
    handle: () => Promise.resolve({ ok: true, value })
  })
  const router = createIpcRouter<Sender, Frame>({
    registry,
    routes: [route],
    createRequestId: () => diagnosticRequestId,
    log: (event) => logs.push(event)
  })

  return { event, logs, router }
}

function nestedValue(depth: number): unknown {
  let value: unknown = null
  for (let index = 0; index < depth; index += 1) {
    value = { value }
  }
  return value
}

function cyclicValue(): unknown {
  const value: { self?: unknown } = {}
  value.self = value
  return value
}

function accessorValue(): unknown {
  return Object.defineProperty({}, 'secret', {
    enumerable: true,
    get: () => 'raw document text'
  })
}

interface UnsafeResponseCase {
  readonly label: string
  readonly createValue: () => unknown
  readonly reason: IpcSafeReason
}

const unsafeResponseCases: readonly UnsafeResponseCase[] = [
  { label: 'undefined', createValue: () => undefined, reason: 'unsupported_type' },
  { label: 'bigint', createValue: () => 1n, reason: 'unsupported_type' },
  { label: 'symbol', createValue: () => Symbol('secret'), reason: 'unsupported_type' },
  { label: 'function', createValue: () => () => undefined, reason: 'unsupported_type' },
  { label: 'NaN', createValue: () => Number.NaN, reason: 'non_finite_number' },
  {
    label: 'Infinity',
    createValue: () => Number.POSITIVE_INFINITY,
    reason: 'non_finite_number'
  },
  { label: 'Date', createValue: () => new Date(0), reason: 'non_plain_object' },
  { label: 'Map', createValue: () => new Map(), reason: 'non_plain_object' },
  { label: 'Set', createValue: () => new Set(), reason: 'non_plain_object' },
  {
    label: 'Promise',
    createValue: () => Promise.resolve('secret'),
    reason: 'non_plain_object'
  },
  {
    label: 'class instance',
    createValue: () => new (class UnsafeValue {})(),
    reason: 'non_plain_object'
  },
  {
    label: 'typed array',
    createValue: () => new Uint8Array([1]),
    reason: 'non_plain_object'
  },
  { label: 'accessor', createValue: accessorValue, reason: 'accessor' },
  {
    label: 'symbol key',
    createValue: () => ({ [Symbol('secret')]: 'raw document text' }),
    reason: 'symbol_key'
  },
  { label: 'cycle', createValue: cyclicValue, reason: 'cycle' },
  {
    label: 'character budget',
    createValue: () => 'x'.repeat(65_536),
    reason: 'character_budget_exceeded'
  },
  { label: 'depth budget', createValue: () => nestedValue(8), reason: 'depth_exceeded' },
  {
    label: 'entry budget',
    createValue: () => new Array<unknown>(257),
    reason: 'entry_budget_exceeded'
  }
]

describe('TC-M0-005 fixed IPC router', () => {
  it('dispatches the valid AppInfo route exactly once without logging', async () => {
    const harness = createRouterHarness({
      handle: (request, context) => {
        expect(request).toEqual(validRequest)
        expect(context).toEqual({
          requestId,
          windowId: 7,
          webContentsId: 11,
          sessionId: null
        })
        return Promise.resolve({ ok: true, value: validAppInfo })
      }
    })

    await expect(
      harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, validRequest)
    ).resolves.toEqual({ ok: true, value: validAppInfo })
    expect(harness.getHandlerCalls()).toBe(1)
    expect(harness.logs).toEqual([])
  })

  it('rejects an unknown channel before request schema parsing', async () => {
    const harness = createRouterHarness()
    const result = await harness.router.dispatch('lattice:unknown', harness.event, {
      contractVersion: 1,
      requestId,
      payload: { raw: 'document text' }
    })

    expectFailure(result, harness.logs, {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      reason: 'unknown_channel',
      channel: 'unknown'
    })
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it('distinguishes a bounded numeric contract-version mismatch', async () => {
    const harness = createRouterHarness()
    const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, {
      contractVersion: 2,
      requestId,
      payload: {}
    })

    expectFailure(result, harness.logs, {
      code: 'APP_VERSION_MISMATCH',
      messageKey: 'errors.app.versionMismatch',
      reason: 'contract_version_mismatch',
      expectedVersion: 1,
      receivedVersion: 2
    })
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it('keeps non-version request schema failures distinct from version mismatch', async () => {
    const harness = createRouterHarness()
    const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, {
      contractVersion: 1,
      requestId,
      payload: { unexpected: 'raw document text' }
    })

    expectFailure(result, harness.logs, {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      reason: 'schema_invalid'
    })
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it('rejects an over-budget input before channel and schema inspection', async () => {
    const harness = createRouterHarness()
    const result = await harness.router.dispatch('lattice:unknown', harness.event, {
      contractVersion: 1,
      requestId,
      payload: { raw: 'x'.repeat(65_536) }
    })

    expectFailure(result, harness.logs, {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      reason: 'character_budget_exceeded',
      channel: 'unknown'
    })
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it.each([
    'missing_sender_frame',
    'sender_destroyed',
    'subframe_sender',
    'window_not_registered',
    'sender_identity_mismatch',
    'window_destroyed'
  ] as const)('rejects the sender as %s before inspecting hostile input', async (reason) => {
    let harness: ReturnType<typeof createRouterHarness>

    switch (reason) {
      case 'missing_sender_frame':
        harness = createRouterHarness({
          event: createEvent({ senderFrame: null }),
          registration: 'none'
        })
        break
      case 'sender_destroyed':
        harness = createRouterHarness({
          event: createEvent({ isSenderDestroyed: () => true }),
          registration: 'none'
        })
        break
      case 'subframe_sender':
        harness = createRouterHarness({
          event: createEvent({ senderFrame: { label: 'subframe' } }),
          registration: 'none'
        })
        break
      case 'window_not_registered':
        harness = createRouterHarness({ registration: 'none' })
        break
      case 'sender_identity_mismatch':
        harness = createRouterHarness({ registration: 'other' })
        break
      case 'window_destroyed':
        harness = createRouterHarness({ isWindowDestroyed: () => true })
        break
    }

    const result = await harness.router.dispatch('lattice:unknown', harness.event, {
      contractVersion: 2,
      requestId,
      payload: { raw: 'x'.repeat(65_536) }
    })

    expectFailure(result, harness.logs, {
      code: 'IPC_UNAUTHORIZED_SENDER',
      messageKey: 'errors.ipc.unauthorizedSender',
      reason,
      channel: 'unknown'
    })
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it.each([
    { label: 'missing', input: { contractVersion: 1, payload: {} }, reason: 'schema_invalid' },
    {
      label: 'invalid',
      input: { contractVersion: 1, requestId: 'not-a-uuid', payload: {} },
      reason: 'schema_invalid'
    }
  ] as const)(
    'uses the generated diagnostic UUID for a $label request ID',
    async ({ input, reason }) => {
      const harness = createRouterHarness()
      const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, input)

      expectFailure(result, harness.logs, {
        code: 'IPC_INVALID_REQUEST',
        messageKey: 'errors.ipc.invalidRequest',
        reason,
        effectiveRequestId: diagnosticRequestId
      })
      expect(harness.getHandlerCalls()).toBe(0)
    }
  )

  it('uses a diagnostic UUID for an accessor request ID without invoking it', async () => {
    let accessed = false
    const input = Object.defineProperty({ contractVersion: 1, payload: {} }, 'requestId', {
      enumerable: true,
      get: () => {
        accessed = true
        return requestId
      }
    })
    const harness = createRouterHarness()
    const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, input)

    expectFailure(result, harness.logs, {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      reason: 'accessor',
      effectiveRequestId: diagnosticRequestId,
      channel: 'unknown'
    })
    expect(accessed).toBe(false)
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it.each(['invalid output', 'throwing source'] as const)(
    'uses the stable diagnostic sentinel for a $label from the UUID source',
    async (failure) => {
      let sourceCalls = 0
      const harness = createRouterHarness({
        createRequestId: () => {
          sourceCalls += 1
          if (failure === 'throwing source') {
            throw new Error('UUID source unavailable')
          }
          return 'not-a-uuid'
        }
      })
      const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, {
        contractVersion: 1,
        payload: {}
      })

      expectFailure(result, harness.logs, {
        code: 'IPC_INVALID_REQUEST',
        messageKey: 'errors.ipc.invalidRequest',
        reason: 'schema_invalid',
        effectiveRequestId: '00000000-0000-4000-8000-000000000000'
      })
      expect(sourceCalls).toBe(1)
      expect(harness.getHandlerCalls()).toBe(0)
    }
  )

  it('rejects the sender before classifying an otherwise approved channel', async () => {
    const harness = createRouterHarness({ registration: 'none' })
    const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, validRequest)

    expectFailure(result, harness.logs, {
      code: 'IPC_UNAUTHORIZED_SENDER',
      messageKey: 'errors.ipc.unauthorizedSender',
      reason: 'window_not_registered',
      channel: 'unknown'
    })
    expect(harness.getHandlerCalls()).toBe(0)
  })

  it.each(['Error', 'string', 'polluted object'] as const)(
    'converts a thrown %s into a stable internal error without raw exception text',
    async (kind) => {
      let thrown: unknown
      let pollutedAccessorInvoked = false
      if (kind === 'Error') {
        const error = new Error('secret C:\\private\\draft.md')
        error.stack =
          'Error: secret C:\\private\\draft.md\n    at dispatch (C:\\private\\ipc-router.ts:42:7)'
        thrown = error
      } else if (kind === 'string') {
        thrown = 'secret C:\\private\\draft.md'
      } else {
        let accessed = false
        const polluted = Object.defineProperties(
          {},
          {
            message: {
              enumerable: true,
              get: () => {
                accessed = true
                pollutedAccessorInvoked = true
                return 'secret C:\\private\\draft.md'
              }
            },
            stack: {
              enumerable: true,
              get: () => {
                accessed = true
                pollutedAccessorInvoked = true
                return 'secret C:\\private\\draft.md'
              }
            }
          }
        )
        Object.setPrototypeOf(polluted, { polluted: true })
        thrown = polluted
        expect(accessed).toBe(false)
      }

      const harness = createRouterHarness({
        handle: () => {
          throw thrown
        }
      })
      const result = await harness.router.dispatch(
        APP_GET_INFO_CHANNEL,
        harness.event,
        validRequest
      )

      expectFailure(result, harness.logs, {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        reason: 'handler_threw',
        level: 'error'
      })
      expect(harness.getHandlerCalls()).toBe(1)
      expect(JSON.stringify(harness.logs)).not.toContain('secret')
      expect(JSON.stringify(harness.logs)).not.toContain('private')
      if (kind === 'Error') {
        expect(harness.logs[0]?.safeStack).toEqual(['dispatch (ipc-router.ts:42:7)'])
      } else {
        expect(harness.logs[0]?.safeStack).toBeUndefined()
      }
      expect(pollutedAccessorInvoked).toBe(false)
    }
  )

  it('rejects a handler result that fails the route response schema', async () => {
    const rejectingResponseSchema = z.custom<AppGetInfoResult>(() => false)
    const harness = createRouterHarness({
      responseSchema: rejectingResponseSchema
    })
    const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, validRequest)

    expectFailure(result, harness.logs, {
      code: 'INTERNAL_UNEXPECTED',
      messageKey: 'errors.internal.unexpected',
      reason: 'response_schema_invalid',
      level: 'error'
    })
    expect(harness.getHandlerCalls()).toBe(1)
  })

  it.each(unsafeResponseCases)(
    'rejects a non-serializable $label response as $reason',
    async ({ createValue, reason }) => {
      const harness = createUnsafeResponseHarness(createValue())
      const result = await harness.router.dispatch(
        APP_GET_INFO_CHANNEL,
        harness.event,
        validRequest
      )

      expectFailure(result, harness.logs, {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        reason,
        level: 'error'
      })
    }
  )

  it('returns a stable failure even when the injected log sink throws', async () => {
    const harness = createRouterHarness({
      log: () => {
        throw new Error('logging failed')
      }
    })

    await expect(
      harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, {
        contractVersion: 1,
        requestId,
        payload: { unexpected: true }
      })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'IPC_INVALID_REQUEST',
        messageKey: 'errors.ipc.invalidRequest',
        retryable: false,
        requestId,
        safeDetails: { reason: 'schema_invalid' }
      }
    })
  })

  it('logs only the fixed safe fields and the same effective request ID', async () => {
    const harness = createRouterHarness()
    const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.event, {
      contractVersion: 1,
      requestId,
      payload: { rawDocument: 'secret markdown' }
    })

    expectFailure(result, harness.logs, {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      reason: 'schema_invalid'
    })
    expect(Object.keys(harness.logs[0] ?? {}).sort()).toEqual([
      'channel',
      'code',
      'level',
      'reason',
      'requestId',
      'webContentsId',
      'windowId'
    ])
    expect(JSON.stringify(harness.logs)).not.toContain('rawDocument')
    expect(JSON.stringify(harness.logs)).not.toContain('secret markdown')
  })
})

describe('TC-M0-005 AppInfo provider', () => {
  it('reads each injected provider value exactly once and emits contract version 1', () => {
    let nameReads = 0
    let versionReads = 0
    let platformReads = 0
    const provider: AppInfoProvider = {
      getName: () => {
        nameReads += 1
        return 'Lattice'
      },
      getVersion: () => {
        versionReads += 1
        return '0.0.0'
      },
      get platform(): AppInfoProvider['platform'] {
        platformReads += 1
        return 'win32'
      }
    }

    expect(createAppInfo(provider)).toEqual(validAppInfo)
    expect({ nameReads, versionReads, platformReads }).toEqual({
      nameReads: 1,
      versionReads: 1,
      platformReads: 1
    })
  })

  it.each([
    {
      label: 'empty name',
      provider: { getName: () => '', getVersion: () => '0.0.0', platform: 'win32' }
    },
    {
      label: 'control character in version',
      provider: {
        getName: () => 'Lattice',
        getVersion: () => '0.0.0\nsecret',
        platform: 'win32'
      }
    }
  ] as const)('throws for a malformed provider value: $label', ({ provider }) => {
    expect(() => createAppInfo(provider)).toThrow()
  })

  it('throws when a runtime provider supplies an unsupported platform', () => {
    const provider: AppInfoProvider = {
      getName: () => 'Lattice',
      getVersion: () => '0.0.0',
      platform: 'win32'
    }
    Object.defineProperty(provider, 'platform', { value: 'android' })

    expect(() => createAppInfo(provider)).toThrow()
  })
})

describe('TC-M0-005 AppInfo IPC registration', () => {
  it('registers the fixed channel, forwards once, and cleans up exactly once', async () => {
    const registrations: string[] = []
    const removals: string[] = []
    const dispatches: Array<{
      readonly channel: string
      readonly event: object
      readonly input: unknown
    }> = []
    let listener: ((event: object, input: unknown) => Promise<unknown>) | undefined
    const event = { label: 'event' }
    const input = { label: 'input' }
    const cleanup = registerAppInfoIpc<object>(
      {
        handle: (channel, next) => {
          registrations.push(channel)
          listener = next
        },
        removeHandler: (channel) => removals.push(channel)
      },
      {
        dispatch: (channel, forwardedEvent, forwardedInput) => {
          dispatches.push({
            channel,
            event: forwardedEvent,
            input: forwardedInput
          })
          return Promise.resolve('forwarded')
        }
      }
    )

    const registeredListener = listener
    if (registeredListener === undefined) {
      throw new Error('Expected the fixed AppInfo listener to be registered')
    }
    await expect(registeredListener(event, input)).resolves.toBe('forwarded')
    expect(registrations).toEqual([APP_GET_INFO_CHANNEL])
    expect(dispatches).toEqual([{ channel: APP_GET_INFO_CHANNEL, event, input }])

    cleanup()
    cleanup()
    expect(removals).toEqual([APP_GET_INFO_CHANNEL])
  })
})

describe('TC-M0-005 safe IPC error logger', () => {
  it('normalizes the approved Windows stack sample exactly', () => {
    const error = new Error('secret C:\\private\\draft.md')
    error.stack =
      'Error: secret\n    at dispatch (C:\\app\\ipc-router.ts:42:7)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)'

    expect(createSafeStack(error)).toEqual([
      'dispatch (ipc-router.ts:42:7)',
      'processTicksAndRejections (task_queues:105:5)'
    ])
  })

  it('retains only approved basenames and discards unsafe or unparseable lines', () => {
    const error = new Error('raw message')
    error.stack = [
      'Error: raw message C:\\private\\draft.md',
      '    at one (C:\\private\\one.js:1:2)',
      '    at two (/private/two.cjs:2:3)',
      '    at three (/private/three.mjs:3:4)',
      '    at four (/private/four.ts:4:5)',
      '    at five (/private/five.tsx:5:6)',
      '    at rejectJsx (/private/reject.jsx:6:7)',
      '    at rejectText (/private/reject.txt:7:8)',
      '    at C:\\private\\anonymous.ts:8:9',
      'not a frame'
    ].join('\n')

    const stack = createSafeStack(error)
    expect(stack).toEqual([
      'one (one.js:1:2)',
      'two (two.cjs:2:3)',
      'three (three.mjs:3:4)',
      'four (four.ts:4:5)',
      'five (five.tsx:5:6)'
    ])
    expect(stack?.every((frame) => !/[\\/]/u.test(frame))).toBe(true)
    expect(stack?.every((frame) => !/^[A-Za-z]:/u.test(frame))).toBe(true)
  })

  it('emits at most eight frames and at most 256 UTF-16 characters per frame', () => {
    const error = new Error('raw message')
    const ordinaryFrames = Array.from(
      { length: 10 },
      (_, index) => `    at frame${index} (C:\\private\\file${index}.ts:${index + 1}:1)`
    )
    const oversizedFrame = `    at ${'x'.repeat(260)} (C:\\private\\oversized.ts:1:1)`
    error.stack = ['Error: raw message', oversizedFrame, ...ordinaryFrames].join('\n')

    const stack = createSafeStack(error)
    expect(stack).toHaveLength(8)
    expect(stack?.every((frame) => frame.length <= 256)).toBe(true)
    expect(stack?.[0]).toBe('frame0 (file0.ts:1:1)')
    expect(stack?.[7]).toBe('frame7 (file7.ts:8:1)')
  })

  it('does not inspect a valid frame beyond the bounded stack line window', () => {
    const error = new Error('raw message')
    error.stack = [
      'Error: raw message',
      ...Array.from({ length: 1_000 }, (_, index) => `invalid line ${index}`),
      '    at dispatch (C:\\private\\ipc-router.ts:42:7)'
    ].join('\n')

    expect(createSafeStack(error)).toBeUndefined()
  })

  it('discards a single overlong stack line instead of parsing its valid suffix', () => {
    const error = new Error('raw message')
    error.stack = `    at dispatch (C:\\${'private\\'.repeat(10_000)}ipc-router.ts:42:7)`

    expect(createSafeStack(error)).toBeUndefined()
  })

  it.each(['raw string', { stack: 'at fake (C:\\private\\fake.ts:1:1)' }, null, undefined])(
    'returns undefined for non-Error input: %o',
    (value) => {
      expect(createSafeStack(value)).toBeUndefined()
    }
  )

  it('sends warning and error events only to the matching console method', () => {
    const warnings: Array<{
      readonly label: string
      readonly event: IpcErrorLogEvent
    }> = []
    const errors: Array<{
      readonly label: string
      readonly event: IpcErrorLogEvent
    }> = []
    const sink = createConsoleIpcErrorLogSink({
      warn: (label, event) => warnings.push({ label, event }),
      error: (label, event) => errors.push({ label, event })
    })
    const warningEvent: IpcErrorLogEvent = {
      level: 'warning',
      code: 'IPC_INVALID_REQUEST',
      requestId,
      channel: 'unknown',
      reason: 'schema_invalid'
    }
    const errorEvent: IpcErrorLogEvent = {
      level: 'error',
      code: 'INTERNAL_UNEXPECTED',
      requestId,
      channel: APP_GET_INFO_CHANNEL,
      reason: 'handler_threw'
    }

    sink(warningEvent)
    expect(warnings).toEqual([{ label: 'lattice.ipc', event: warningEvent }])
    expect(warnings[0]?.event).toBe(warningEvent)
    expect(errors).toEqual([])

    sink(errorEvent)
    expect(errors).toEqual([{ label: 'lattice.ipc', event: errorEvent }])
    expect(errors[0]?.event).toBe(errorEvent)
    expect(warnings).toHaveLength(1)
  })
})
