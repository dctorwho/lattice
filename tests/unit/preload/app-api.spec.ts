import { describe, expect, it, vi } from 'vitest'

import { createAppApi } from '../../../src/preload/api/create-app-api'
import {
  APP_GET_INFO_CHANNEL,
  appGetInfoResultSchema,
  type AppGetInfoResult
} from '../../../src/shared/contracts'
import { appErrorSchema } from '../../../src/shared/errors'

const requestIdOne = '00000000-0000-4000-8000-000000000001'
const requestIdTwo = '00000000-0000-4000-8000-000000000002'
const validValue = {
  contractVersion: 1,
  name: 'Lattice',
  version: '0.0.0',
  platform: 'win32'
} as const

function expectSchemaValidFailure(result: AppGetInfoResult): void {
  expect(appGetInfoResultSchema.safeParse(result).success).toBe(true)
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('Expected a stable local failure')
  }
  expect(appErrorSchema.safeParse(result.error).success).toBe(true)
}

describe('TC-M0-005 preload app API', () => {
  it('uses a fresh UUID and the exact fixed request for every getInfo call', async () => {
    const requestIds = [requestIdOne, requestIdTwo]
    const calls: unknown[] = []
    const app = createAppApi({
      createRequestId: () => {
        const nextRequestId = requestIds.shift()
        if (nextRequestId === undefined) {
          throw new Error('Unexpected request ID read')
        }
        return nextRequestId
      },
      invoke: (channel, request) => {
        calls.push({ channel, request })
        return Promise.resolve({ ok: true, value: validValue })
      }
    })

    await expect(app.getInfo()).resolves.toEqual({ ok: true, value: validValue })
    await expect(app.getInfo()).resolves.toEqual({ ok: true, value: validValue })
    expect(calls).toEqual([
      {
        channel: APP_GET_INFO_CHANNEL,
        request: { contractVersion: 1, requestId: requestIdOne, payload: {} }
      },
      {
        channel: APP_GET_INFO_CHANNEL,
        request: { contractVersion: 1, requestId: requestIdTwo, payload: {} }
      }
    ])
  })

  it('schema-validates and returns a stable error Result from main unchanged', async () => {
    const mainFailure = {
      ok: false,
      error: {
        code: 'IPC_INVALID_REQUEST',
        messageKey: 'errors.ipc.invalidRequest',
        retryable: false,
        safeDetails: { reason: 'schema_invalid' },
        requestId: requestIdOne
      }
    } as const
    const app = createAppApi({
      createRequestId: () => requestIdOne,
      invoke: () => Promise.resolve(mainFailure)
    })

    await expect(app.getInfo()).resolves.toEqual(mainFailure)
  })

  it('rejects a main failure Result that is missing the local request ID', async () => {
    const app = createAppApi({
      createRequestId: () => requestIdOne,
      invoke: () =>
        Promise.resolve({
          ok: false,
          error: {
            code: 'IPC_INVALID_REQUEST',
            messageKey: 'errors.ipc.invalidRequest',
            retryable: false,
            safeDetails: { reason: 'schema_invalid' }
          }
        })
    })

    await expect(app.getInfo()).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        retryable: false,
        safeDetails: { reason: 'response_schema_invalid' },
        requestId: requestIdOne
      }
    })
  })

  it('rejects a main failure Result with a request ID from another request', async () => {
    const app = createAppApi({
      createRequestId: () => requestIdOne,
      invoke: () =>
        Promise.resolve({
          ok: false,
          error: {
            code: 'IPC_INVALID_REQUEST',
            messageKey: 'errors.ipc.invalidRequest',
            retryable: false,
            safeDetails: { reason: 'schema_invalid' },
            requestId: requestIdTwo
          }
        })
    })

    await expect(app.getInfo()).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        retryable: false,
        safeDetails: { reason: 'response_schema_invalid' },
        requestId: requestIdOne
      }
    })
  })

  it.each([
    {
      label: 'invalid UUID',
      createRequestId: () => 'not-a-uuid'
    },
    {
      label: 'throwing UUID source',
      createRequestId: () => {
        throw new Error('secret UUID provider failure')
      }
    }
  ])(
    'returns a schema-valid local failure for a $label without invoking main',
    async ({ createRequestId }) => {
      let invokeCalls = 0
      const app = createAppApi({
        createRequestId,
        invoke: () => {
          invokeCalls += 1
          return Promise.resolve({ ok: true, value: validValue })
        }
      })

      const result = await app.getInfo()

      expect(result).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_UNEXPECTED',
          messageKey: 'errors.internal.unexpected',
          retryable: false,
          safeDetails: { reason: 'schema_invalid' }
        }
      })
      expectSchemaValidFailure(result)
      expect(invokeCalls).toBe(0)
      expect(JSON.stringify(result)).not.toContain('secret')
    }
  )

  it('converts invoke rejection to a schema-valid local failure without raw leakage', async () => {
    const app = createAppApi({
      createRequestId: () => requestIdOne,
      invoke: () => Promise.reject(new Error('secret C:\\private\\draft.md'))
    })

    const result = await app.getInfo()

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        retryable: false,
        safeDetails: { reason: 'handler_threw' },
        requestId: requestIdOne
      }
    })
    expectSchemaValidFailure(result)
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('converts an invalid main response without exposing any raw value', async () => {
    const app = createAppApi({
      createRequestId: () => requestIdOne,
      invoke: () =>
        Promise.resolve({
          secretPath: 'D:\\private\\draft.md',
          document: 'secret body'
        })
    })

    const result = await app.getInfo()

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        retryable: false,
        safeDetails: { reason: 'response_schema_invalid' },
        requestId: requestIdOne
      }
    })
    expectSchemaValidFailure(result)
    expect(JSON.stringify(result)).not.toContain('secretPath')
    expect(JSON.stringify(result)).not.toContain('secret body')
  })

  it('仅包含固定的应用信息与窗口关闭能力，不暴露通用 IPC 逃逸口', () => {
    const app = createAppApi({
      createRequestId: () => requestIdOne,
      invoke: () => Promise.resolve({ ok: true, value: validValue })
    })

    expect(Object.keys(app)).toEqual(['onCloseRequested', 'confirmClose', 'getInfo'])
    expect(Reflect.has(app, 'invoke')).toBe(false)
    expect(Reflect.has(app, 'send')).toBe(false)
  })
})

const preloadMocks = vi.hoisted(() => {
  let exposed:
    | {
        readonly name: string
        readonly value: unknown
      }
    | undefined

  return {
    contextBridge: {
      exposeInMainWorld: (name: string, value: unknown): void => {
        exposed = { name, value }
      }
    },
    ipcRenderer: {
      invoke: (channel: string): Promise<unknown> =>
        Promise.resolve(
          channel === 'lattice:app:get-info'
            ? { ok: true, value: validValue }
            : { ok: true, value: { contractVersion: 1, applied: true } }
        ),
      on: (): void => {},
      removeListener: (): void => {}
    },
    readExposed: () => exposed
  }
})

vi.mock('electron', () => ({
  contextBridge: preloadMocks.contextBridge,
  ipcRenderer: preloadMocks.ipcRenderer
}))

describe('M1 production preload surface', () => {
  it('只通过 context bridge 暴露冻结的应用、命令、文件与恢复能力', async () => {
    await import('../../../src/preload/index')

    const exposed = preloadMocks.readExposed()
    expect(exposed?.name).toBe('lattice')
    expect(exposed?.value).toBeTypeOf('object')
    if (typeof exposed?.value !== 'object' || exposed.value === null) {
      throw new Error('Expected the lattice preload API to be exposed')
    }

    const rootApi = exposed.value
    expect(Object.keys(rootApi)).toEqual(['app', 'commands', 'files', 'recovery'])
    expect(Object.isFrozen(rootApi)).toBe(true)
    if (!('app' in rootApi)) {
      throw new Error('Expected the app preload API property')
    }
    const app = rootApi.app
    expect(app).toBeTypeOf('object')
    if (typeof app !== 'object' || app === null) {
      throw new Error('Expected the app preload API')
    }

    expect(Object.keys(app)).toEqual(['onCloseRequested', 'confirmClose', 'getInfo'])
    expect(Object.isFrozen(app)).toBe(true)
    if (!('commands' in rootApi)) {
      throw new Error('Expected the command preload API property')
    }
    const commands = rootApi.commands
    expect(commands).toBeTypeOf('object')
    if (typeof commands !== 'object' || commands === null) {
      throw new Error('Expected the command preload API')
    }
    expect(Object.keys(commands)).toEqual(['onInvoke', 'updateStates'])
    expect(Object.isFrozen(commands)).toBe(true)
    if (!('files' in rootApi)) {
      throw new Error('Expected the files preload API property')
    }
    const files = rootApi.files
    expect(files).toBeTypeOf('object')
    if (typeof files !== 'object' || files === null) {
      throw new Error('Expected the files preload API')
    }
    expect(Object.keys(files)).toEqual([
      'open',
      'save',
      'saveAs',
      'confirmedOverwrite',
      'reloadExternal',
      'onExternalChange'
    ])
    expect(Object.isFrozen(files)).toBe(true)
    if (!('recovery' in rootApi)) {
      throw new Error('Expected the recovery preload API property')
    }
    const recovery = rootApi.recovery
    expect(recovery).toBeTypeOf('object')
    if (typeof recovery !== 'object' || recovery === null) {
      throw new Error('Expected the recovery preload API')
    }
    expect(Object.keys(recovery)).toEqual(['write', 'list', 'discard'])
    expect(Object.isFrozen(recovery)).toBe(true)
    expect(Reflect.has(rootApi, 'invoke')).toBe(false)
    expect(Reflect.has(rootApi, 'send')).toBe(false)
    expect(Reflect.has(app, 'invoke')).toBe(false)
    expect(Reflect.has(app, 'send')).toBe(false)
    expect(Reflect.has(commands, 'invoke')).toBe(false)
    expect(Reflect.has(commands, 'send')).toBe(false)
    expect(Reflect.has(commands, 'on')).toBe(false)
    expect(Reflect.has(files, 'invoke')).toBe(false)
    expect(Reflect.has(files, 'readAnyPath')).toBe(false)
    expect(Reflect.has(recovery, 'invoke')).toBe(false)
    expect(Reflect.has(recovery, 'readAnyPath')).toBe(false)
  })
})
