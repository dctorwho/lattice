import { describe, expect, it, vi } from 'vitest'

import { createCommandApi } from '../../../src/preload/api/create-command-api'
import {
  COMMAND_INVOKED_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL,
  commandStateSyncResultSchema,
  commandIds,
  type CommandStateSyncResult
} from '../../../src/shared/contracts'

const requestId = '00000000-0000-4000-8000-000000000001'
const otherRequestId = '00000000-0000-4000-8000-000000000002'
const validStates = commandIds.map((id) => ({
  id,
  isVisible: true,
  isEnabled: true,
  isChecked: id === 'view.toggleSidebar'
}))

type EventListener = (event: unknown, payload: unknown) => void

function expectSchemaValidFailure(result: CommandStateSyncResult): void {
  expect(commandStateSyncResultSchema.safeParse(result).success).toBe(true)
  expect(result.ok).toBe(false)
}

describe('M1 command preload API', () => {
  it('sends the exact state envelope on the fixed channel', async () => {
    const calls: unknown[] = []
    const commands = createCommandApi({
      createRequestId: () => requestId,
      invoke: (channel, request) => {
        calls.push({ channel, request })
        return Promise.resolve({
          ok: true,
          value: { contractVersion: 1, applied: true }
        })
      },
      on: () => {},
      removeListener: () => {},
      reportEventFailure: () => {}
    })

    await expect(commands.updateStates(validStates)).resolves.toEqual({
      ok: true,
      value: { contractVersion: 1, applied: true }
    })
    expect(calls).toEqual([
      {
        channel: COMMAND_UPDATE_STATES_CHANNEL,
        request: {
          contractVersion: 1,
          requestId,
          payload: { states: validStates }
        }
      }
    ])
  })

  it('drops invalid main events before invoking the renderer listener', () => {
    let registered: EventListener | undefined
    const received: string[] = []
    const reportEventFailure = vi.fn()
    const commands = createCommandApi({
      createRequestId: () => requestId,
      invoke: () => Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } }),
      on: (channel, listener) => {
        expect(channel).toBe(COMMAND_INVOKED_CHANNEL)
        registered = listener
      },
      removeListener: () => {},
      reportEventFailure
    })

    commands.onInvoke((id) => received.push(id))
    if (registered === undefined) throw new Error('Expected command listener registration')
    registered({ sender: 'must-not-cross' }, { contractVersion: 1, id: 'files.open' })
    registered({ sender: 'must-not-cross' }, { contractVersion: 1, id: 'app.about' })

    expect(received).toEqual(['app.about'])
    expect(reportEventFailure).toHaveBeenCalledExactlyOnceWith('invalid_payload')
  })

  it('isolates renderer listener exceptions without exposing the payload', () => {
    let registered: EventListener | undefined
    const reportEventFailure = vi.fn()
    const commands = createCommandApi({
      createRequestId: () => requestId,
      invoke: () => Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } }),
      on: (_channel, listener) => {
        registered = listener
      },
      removeListener: () => {},
      reportEventFailure
    })

    commands.onInvoke(() => {
      throw new Error('D:\\private\\draft.md')
    })
    if (registered === undefined) throw new Error('Expected command listener registration')
    const registeredListener = registered

    expect(() => registeredListener({}, { contractVersion: 1, id: 'app.about' })).not.toThrow()
    expect(reportEventFailure).toHaveBeenCalledExactlyOnceWith('listener_threw')
  })

  it('returns an idempotent unsubscribe for only its wrapped listener', () => {
    let registered: EventListener | undefined
    const removed: EventListener[] = []
    const commands = createCommandApi({
      createRequestId: () => requestId,
      invoke: () => Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } }),
      on: (_channel, listener) => {
        registered = listener
      },
      removeListener: (channel, listener) => {
        expect(channel).toBe(COMMAND_INVOKED_CHANNEL)
        removed.push(listener)
      },
      reportEventFailure: () => {}
    })

    const unsubscribe = commands.onInvoke(() => {})
    unsubscribe()
    unsubscribe()

    expect(registered).toBeDefined()
    expect(removed).toEqual([registered])
  })

  it.each([
    {
      label: 'invalid local request ID',
      createRequestId: () => 'not-a-uuid',
      response: { ok: true, value: { contractVersion: 1, applied: true } },
      expectedReason: 'schema_invalid',
      expectedRequestId: undefined
    },
    {
      label: 'malformed response',
      createRequestId: () => requestId,
      response: { ok: true, value: { contractVersion: 1, applied: false } },
      expectedReason: 'response_schema_invalid',
      expectedRequestId: requestId
    },
    {
      label: 'mismatched failure request ID',
      createRequestId: () => requestId,
      response: {
        ok: false,
        error: {
          code: 'IPC_INVALID_REQUEST',
          messageKey: 'errors.ipc.invalidRequest',
          retryable: false,
          safeDetails: { reason: 'schema_invalid' },
          requestId: otherRequestId
        }
      },
      expectedReason: 'response_schema_invalid',
      expectedRequestId: requestId
    }
  ])(
    'returns a safe local failure for a $label',
    async ({ createRequestId, response, expectedReason, expectedRequestId }) => {
      const commands = createCommandApi({
        createRequestId,
        invoke: () => Promise.resolve(response),
        on: () => {},
        removeListener: () => {},
        reportEventFailure: () => {}
      })

      const result = await commands.updateStates(validStates)

      expectSchemaValidFailure(result)
      expect(result).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_UNEXPECTED',
          messageKey: 'errors.internal.unexpected',
          retryable: false,
          safeDetails: { reason: expectedReason },
          ...(expectedRequestId === undefined ? {} : { requestId: expectedRequestId })
        }
      })
    }
  )

  it('contains only the two approved command methods', () => {
    const commands = createCommandApi({
      createRequestId: () => requestId,
      invoke: () => Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } }),
      on: () => {},
      removeListener: () => {},
      reportEventFailure: () => {}
    })

    expect(Object.keys(commands)).toEqual(['onInvoke', 'updateStates'])
    expect(Reflect.has(commands, 'invoke')).toBe(false)
    expect(Reflect.has(commands, 'send')).toBe(false)
    expect(Reflect.has(commands, 'on')).toBe(false)
  })
})
