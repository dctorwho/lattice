import { describe, expect, it } from 'vitest'

import { createFilesApi } from '../../../src/preload/api/create-files-api'
import {
  FILES_OPEN_CHANNEL,
  FILES_RELOAD_EXTERNAL_CHANNEL,
  filesOpenResultSchema,
  type FilesOpenResult
} from '../../../src/shared/contracts'

const requestId = '00000000-0000-4000-8000-000000000501'
const openedValue = {
  accessMode: 'editable',
  documentId: '00000000-0000-4000-8000-000000000502',
  path: 'D:\\文档\\示例.md',
  text: '标题\n正文',
  encoding: 'utf8',
  eolByLine: ['\n'],
  bytesHash: 'a'.repeat(64),
  diskVersion: { mtimeMs: 1, size: 13, contentHash: 'a'.repeat(64) }
} as const

function expectValid(result: FilesOpenResult): void {
  expect(filesOpenResultSchema.safeParse(result).success).toBe(true)
}

describe('M1 preload 文件 API', () => {
  it('open 不接收渲染器路径，并在固定频道发送严格空载荷', async () => {
    const calls: unknown[] = []
    const files = createFilesApi({
      createRequestId: () => requestId,
      invoke: (channel, request) => {
        calls.push({ channel, request })
        return Promise.resolve({ ok: true, value: openedValue })
      }
    })

    await expect(files.open()).resolves.toEqual({ ok: true, value: openedValue })
    expect(calls).toEqual([
      {
        channel: FILES_OPEN_CHANNEL,
        request: { contractVersion: 1, requestId, payload: {} }
      }
    ])
    expect(Object.keys(files)).toEqual([
      'open',
      'save',
      'saveAs',
      'confirmedOverwrite',
      'reloadExternal',
      'onExternalChange'
    ])
    expect(Reflect.has(files, 'invoke')).toBe(false)
  })

  it('取消返回成功的 null，畸形响应返回不泄露内容的稳定本地错误', async () => {
    const cancelled = createFilesApi({
      createRequestId: () => requestId,
      invoke: () => Promise.resolve({ ok: true, value: null })
    })
    const malformed = createFilesApi({
      createRequestId: () => requestId,
      invoke: () => Promise.resolve({ secretPath: 'D:\\秘密\\文档.md', text: '秘密正文' })
    })

    const cancelledResult = await cancelled.open()
    const malformedResult = await malformed.open()

    expect(cancelledResult).toEqual({ ok: true, value: null })
    expectValid(cancelledResult)
    expect(malformedResult).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        retryable: false,
        safeDetails: { reason: 'response_schema_invalid' },
        requestId
      }
    })
    expectValid(malformedResult)
    expect(JSON.stringify(malformedResult)).not.toContain('秘密')
  })

  it('保存、另存、确认覆盖和外部重载只发送窄会话快照，不暴露任意文件能力', async () => {
    const calls: unknown[] = []
    const files = createFilesApi({
      createRequestId: () => requestId,
      invoke: (channel, request) => {
        calls.push({ channel, request })
        if (channel === FILES_RELOAD_EXTERNAL_CHANNEL) {
          return Promise.resolve({
            ok: true,
            value: { ...openedValue, revision: 4 }
          })
        }
        return Promise.resolve({
          ok: true,
          value: {
            status: 'saved',
            file: {
              path: openedValue.path,
              revision: 3,
              diskVersion: openedValue.diskVersion,
              bytesHash: openedValue.bytesHash
            }
          }
        })
      }
    })
    const snapshot = {
      documentId: openedValue.documentId,
      revision: 3,
      text: '标题\n已修改',
      encoding: 'utf8',
      eolByLine: ['\n']
    }
    const save = Reflect.get(files, 'save')
    const saveAs = Reflect.get(files, 'saveAs')
    const confirmedOverwrite = Reflect.get(files, 'confirmedOverwrite')
    const reloadExternal = Reflect.get(files, 'reloadExternal')

    expect(typeof save).toBe('function')
    expect(typeof saveAs).toBe('function')
    expect(typeof confirmedOverwrite).toBe('function')
    expect(typeof reloadExternal).toBe('function')
    if (
      typeof save !== 'function' ||
      typeof saveAs !== 'function' ||
      typeof confirmedOverwrite !== 'function' ||
      typeof reloadExternal !== 'function'
    ) {
      return
    }

    await Reflect.apply(save, files, [
      {
        ...snapshot,
        path: openedValue.path,
        expectedDiskVersion: openedValue.diskVersion
      }
    ])
    await Reflect.apply(saveAs, files, [snapshot])
    await Reflect.apply(confirmedOverwrite, files, [
      { ...snapshot, conflictToken: '00000000-0000-4000-8000-000000000599' }
    ])
    await Reflect.apply(reloadExternal, files, [
      {
        documentId: openedValue.documentId,
        path: openedValue.path,
        expectedDiskVersion: openedValue.diskVersion
      }
    ])

    expect(calls).toEqual([
      {
        channel: 'lattice:files:save',
        request: {
          contractVersion: 1,
          requestId,
          payload: {
            ...snapshot,
            path: openedValue.path,
            expectedDiskVersion: openedValue.diskVersion
          }
        }
      },
      {
        channel: 'lattice:files:save-as',
        request: { contractVersion: 1, requestId, payload: snapshot }
      },
      {
        channel: 'lattice:files:confirmed-overwrite',
        request: {
          contractVersion: 1,
          requestId,
          payload: {
            ...snapshot,
            conflictToken: '00000000-0000-4000-8000-000000000599'
          }
        }
      },
      {
        channel: 'lattice:files:reload-external',
        request: {
          contractVersion: 1,
          requestId,
          payload: {
            documentId: openedValue.documentId,
            path: openedValue.path,
            expectedDiskVersion: openedValue.diskVersion
          }
        }
      }
    ])
    expect(Object.keys(files)).toEqual([
      'open',
      'save',
      'saveAs',
      'confirmedOverwrite',
      'reloadExternal',
      'onExternalChange'
    ])
    expect(Reflect.has(files, 'readAnyPath')).toBe(false)
    expect(Reflect.has(files, 'invoke')).toBe(false)
  })
})
