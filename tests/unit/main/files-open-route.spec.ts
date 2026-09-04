import { describe, expect, it } from 'vitest'

import { createDocumentSession, decodeSourceBuffer } from '../../../src/domain/documents'
import * as fileRoutes from '../../../src/main/documents/files-open-route'
import * as fileIpc from '../../../src/main/ipc/register-files-open-ipc'
import type {
  FilesConfirmedOverwriteRequest,
  FilesSaveAsRequest,
  FilesSaveRequest
} from '../../../src/shared/contracts'

const { createFilesOpenRoute, createFilesSaveAsRoute, createFilesConfirmedOverwriteRoute } =
  fileRoutes

const request = {
  contractVersion: 1 as const,
  requestId: '00000000-0000-4000-8000-000000000503',
  payload: {}
}
const context = {
  requestId: request.requestId,
  windowId: 7,
  webContentsId: 8,
  sessionId: null
}

describe('M1 文件打开路由', () => {
  it('把选择器授权的可编辑会话记入对应窗口并返回严格描述', async () => {
    const bytes = new TextEncoder().encode('标题\r\n正文')
    const hash = 'b'.repeat(64)
    const decoded = decodeSourceBuffer(bytes, hash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const session = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000504',
      path: 'D:\\文档\\示例.md',
      buffer: decoded.buffer,
      diskVersion: { mtimeMs: 1, size: bytes.length, contentHash: hash }
    })
    const remembered: unknown[] = []
    const route = createFilesOpenRoute({
      openFromPicker: () =>
        Promise.resolve({
          status: 'opened',
          accessMode: 'editable',
          displayPath: session.path ?? '',
          authorizedPath: session.path ?? '',
          session
        }),
      rememberSession: (windowId, rememberedSession) =>
        remembered.push({ windowId, session: rememberedSession })
    })

    const result = await route.handle(request, context)

    expect(result).toEqual({
      ok: true,
      value: {
        accessMode: 'editable',
        documentId: session.id,
        path: session.path,
        text: '标题\n正文',
        encoding: 'utf8',
        eolByLine: ['\r\n'],
        bytesHash: hash,
        diskVersion: session.diskVersion
      }
    })
    expect(remembered).toEqual([{ windowId: 7, session }])
  })

  it('选择器取消时返回成功 null 且不创建会话', async () => {
    let rememberCalls = 0
    const route = createFilesOpenRoute({
      openFromPicker: () => Promise.resolve({ status: 'cancelled' }),
      rememberSession: () => {
        rememberCalls += 1
      }
    })

    await expect(route.handle(request, context)).resolves.toEqual({ ok: true, value: null })
    expect(rememberCalls).toBe(0)
  })
})

describe('M1 文件保存路由', () => {
  it('只保存当前窗口已授权会话的严格快照，并回写成功磁盘版本', async () => {
    const bytes = new TextEncoder().encode('原文\r\n第二行')
    const hash = 'c'.repeat(64)
    const path = 'D:\\文档\\保存.md'
    const diskVersion = { mtimeMs: 1, size: bytes.length, contentHash: hash }
    const decoded = decodeSourceBuffer(bytes, hash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const session = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000505',
      path,
      buffer: decoded.buffer,
      diskVersion
    })
    const createFilesSaveRoute = Reflect.get(fileRoutes, 'createFilesSaveRoute')
    expect(typeof createFilesSaveRoute).toBe('function')
    if (typeof createFilesSaveRoute !== 'function') return

    const remembered: unknown[] = []
    const route = Reflect.apply(createFilesSaveRoute, undefined, [
      {
        findSession: (windowId: number, documentId: string) =>
          windowId === 7 && documentId === session.id ? session : undefined,
        saveSession: (candidate: typeof session) =>
          Promise.resolve({
            status: 'saved',
            session: {
              ...candidate,
              savedRevision: candidate.currentContentRevision,
              diskVersion: { mtimeMs: 2, size: 18, contentHash: 'd'.repeat(64) }
            }
          }),
        rememberSession: (windowId: number, candidate: typeof session) =>
          remembered.push({ windowId, session: candidate })
      }
    ])
    const saveRequest: FilesSaveRequest = {
      contractVersion: 1 as const,
      requestId: '00000000-0000-4000-8000-000000000506',
      payload: {
        documentId: session.id,
        path,
        revision: 1,
        text: '原文\n已修改',
        encoding: 'utf8' as const,
        eolByLine: ['\r\n'],
        expectedDiskVersion: diskVersion
      }
    }

    const result = await route.handle(saveRequest, {
      ...context,
      requestId: saveRequest.requestId
    })

    expect(result).toEqual({
      ok: true,
      value: {
        status: 'saved',
        file: {
          path: session.path,
          revision: 1,
          diskVersion: { mtimeMs: 2, size: 18, contentHash: 'd'.repeat(64) },
          bytesHash: 'd'.repeat(64)
        }
      }
    })
    expect(remembered).toHaveLength(1)
    expect(remembered[0]).toMatchObject({
      windowId: 7,
      session: {
        id: session.id,
        path: session.path,
        revision: 1,
        currentContentRevision: 1,
        savedRevision: 1,
        buffer: { text: '原文\n已修改', eolByLine: ['\r\n'] }
      }
    })
  })

  it('外部版本冲突时返回双方可恢复内容和一次性确认令牌，且不替换会话', async () => {
    const originalBytes = new TextEncoder().encode('磁盘旧版本')
    const originalHash = 'e'.repeat(64)
    const decoded = decodeSourceBuffer(originalBytes, originalHash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const path = 'D:\\文档\\冲突.md'
    const originalVersion = {
      mtimeMs: 1,
      size: originalBytes.length,
      contentHash: originalHash
    }
    const session = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000507',
      path,
      buffer: decoded.buffer,
      diskVersion: originalVersion
    })
    const externalBytes = new TextEncoder().encode('磁盘外部版本\r\n保留')
    const externalVersion = {
      mtimeMs: 2,
      size: externalBytes.length,
      contentHash: 'f'.repeat(64)
    }
    const createFilesSaveRoute = Reflect.get(fileRoutes, 'createFilesSaveRoute')
    expect(typeof createFilesSaveRoute).toBe('function')
    if (typeof createFilesSaveRoute !== 'function') return
    const rememberedSessions: unknown[] = []
    const rememberedConflicts: unknown[] = []
    const route = Reflect.apply(createFilesSaveRoute, undefined, [
      {
        findSession: () => session,
        saveSession: (candidate: typeof session) =>
          Promise.resolve({ status: 'conflict', session: candidate, diskVersion: externalVersion }),
        readSnapshot: () =>
          Promise.resolve({
            authorizedPath: path,
            bytes: externalBytes,
            diskVersion: externalVersion
          }),
        createConflictToken: () => '00000000-0000-4000-8000-000000000508',
        rememberConflict: (record: unknown) => rememberedConflicts.push(record),
        rememberSession: (_windowId: number, candidate: typeof session) =>
          rememberedSessions.push(candidate)
      }
    ])
    const saveRequest: FilesSaveRequest = {
      contractVersion: 1 as const,
      requestId: '00000000-0000-4000-8000-000000000509',
      payload: {
        documentId: session.id,
        path,
        revision: 1,
        text: '本地未保存版本',
        encoding: 'utf8',
        eolByLine: [],
        expectedDiskVersion: originalVersion
      }
    }

    await expect(
      route.handle(saveRequest, { ...context, requestId: saveRequest.requestId })
    ).resolves.toEqual({
      ok: true,
      value: {
        status: 'conflict',
        conflictToken: '00000000-0000-4000-8000-000000000508',
        external: {
          accessMode: 'editable',
          text: '磁盘外部版本\n保留',
          encoding: 'utf8',
          eolByLine: ['\r\n'],
          bytesHash: externalVersion.contentHash,
          diskVersion: externalVersion
        }
      }
    })
    expect(rememberedSessions).toEqual([])
    expect(rememberedConflicts).toEqual([
      {
        token: '00000000-0000-4000-8000-000000000508',
        windowId: 7,
        documentId: session.id,
        localSession: {
          ...session,
          buffer: { ...session.buffer, text: '本地未保存版本', eolByLine: [] },
          revision: 1,
          currentContentRevision: 1
        },
        external: { authorizedPath: path, bytes: externalBytes, diskVersion: externalVersion }
      }
    ])
  })

  it('原子写入失败返回可重试稳定错误，陈旧修订返回不可重试错误', async () => {
    const bytes = new TextEncoder().encode('正文')
    const hash = '1'.repeat(64)
    const decoded = decodeSourceBuffer(bytes, hash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const path = 'D:\\文档\\失败.md'
    const diskVersion = { mtimeMs: 1, size: bytes.length, contentHash: hash }
    const session = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000510',
      path,
      buffer: decoded.buffer,
      diskVersion
    })
    const createFilesSaveRoute = Reflect.get(fileRoutes, 'createFilesSaveRoute')
    expect(typeof createFilesSaveRoute).toBe('function')
    if (typeof createFilesSaveRoute !== 'function') return
    const route = Reflect.apply(createFilesSaveRoute, undefined, [
      {
        findSession: () => session,
        saveSession: (candidate: typeof session) =>
          Promise.resolve({
            status: 'failed',
            code: 'FILE_ATOMIC_SAVE_FAILED',
            session: candidate
          }),
        rememberSession: () => undefined
      }
    ])
    const baseRequest: FilesSaveRequest = {
      contractVersion: 1,
      requestId: '00000000-0000-4000-8000-000000000511',
      payload: {
        documentId: session.id,
        path,
        revision: 1,
        text: '已修改',
        encoding: 'utf8',
        eolByLine: [],
        expectedDiskVersion: diskVersion
      }
    }

    await expect(
      route.handle(baseRequest, { ...context, requestId: baseRequest.requestId })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'FILE_ATOMIC_SAVE_FAILED',
        messageKey: 'errors.file.atomicSaveFailed',
        retryable: true,
        requestId: baseRequest.requestId
      }
    })
    await expect(
      route.handle(
        { ...baseRequest, payload: { ...baseRequest.payload, revision: 0, text: '陈旧修改' } },
        { ...context, requestId: baseRequest.requestId }
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_STALE_PATCH',
        messageKey: 'errors.document.stalePatch',
        retryable: false,
        requestId: baseRequest.requestId
      }
    })
  })
})

describe('M1 外部版本重载路由', () => {
  it('重新读取并验证主进程已授权路径后同步单调会话修订', async () => {
    const originalBytes = new TextEncoder().encode('旧版本')
    const originalHash = '6'.repeat(64)
    const decoded = decodeSourceBuffer(originalBytes, originalHash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const path = 'D:\\文档\\外部更新.md'
    const session = {
      ...createDocumentSession({
        id: '00000000-0000-4000-8000-000000000520',
        path,
        buffer: decoded.buffer,
        diskVersion: { mtimeMs: 1, size: originalBytes.length, contentHash: originalHash }
      }),
      revision: 3,
      currentContentRevision: 3,
      savedRevision: 3
    }
    const externalBytes = new TextEncoder().encode('外部版本\r\n第二行')
    const externalVersion = {
      mtimeMs: 2,
      size: externalBytes.length,
      contentHash: '7'.repeat(64)
    }
    const createFilesReloadExternalRoute = Reflect.get(fileRoutes, 'createFilesReloadExternalRoute')
    expect(typeof createFilesReloadExternalRoute).toBe('function')
    if (typeof createFilesReloadExternalRoute !== 'function') return
    const remembered: unknown[] = []
    const route = Reflect.apply(createFilesReloadExternalRoute, undefined, [
      {
        findSession: () => session,
        readSnapshot: () =>
          Promise.resolve({
            authorizedPath: path,
            bytes: externalBytes,
            diskVersion: externalVersion
          }),
        rememberSession: (windowId: number, candidate: typeof session) =>
          remembered.push({ windowId, session: candidate })
      }
    ])
    const reloadRequest = {
      contractVersion: 1 as const,
      requestId: '00000000-0000-4000-8000-000000000521',
      payload: { documentId: session.id, path, expectedDiskVersion: externalVersion }
    }

    await expect(
      route.handle(reloadRequest, { ...context, requestId: reloadRequest.requestId })
    ).resolves.toEqual({
      ok: true,
      value: {
        accessMode: 'editable',
        documentId: session.id,
        path,
        revision: 4,
        text: '外部版本\n第二行',
        encoding: 'utf8',
        eolByLine: ['\r\n'],
        bytesHash: externalVersion.contentHash,
        diskVersion: externalVersion
      }
    })
    expect(remembered).toHaveLength(1)
    expect(remembered[0]).toMatchObject({
      windowId: 7,
      session: {
        revision: 4,
        currentContentRevision: 4,
        savedRevision: 4,
        diskVersion: externalVersion
      }
    })
  })
})

describe('M1 文件保存 IPC 注册', () => {
  it('只注册保存、另存为、确认覆盖与外部重载四个固定频道，并可幂等清理', async () => {
    const registerFilesSaveIpc = Reflect.get(fileIpc, 'registerFilesSaveIpc')
    expect(typeof registerFilesSaveIpc).toBe('function')
    if (typeof registerFilesSaveIpc !== 'function') return
    const listeners = new Map<string, (event: object, input: unknown) => Promise<unknown>>()
    const removals: string[] = []
    const dispatches: string[] = []
    const cleanup = Reflect.apply(registerFilesSaveIpc, undefined, [
      {
        handle: (channel: string, listener: (event: object, input: unknown) => Promise<unknown>) =>
          listeners.set(channel, listener),
        removeHandler: (channel: string) => removals.push(channel)
      },
      {
        dispatch: (channel: string) => {
          dispatches.push(channel)
          return Promise.resolve('ok')
        }
      }
    ])

    expect([...listeners.keys()]).toEqual([
      'lattice:files:save',
      'lattice:files:save-as',
      'lattice:files:confirmed-overwrite',
      'lattice:files:reload-external'
    ])
    for (const listener of listeners.values()) {
      await expect(listener({}, {})).resolves.toBe('ok')
    }
    expect(dispatches).toEqual([...listeners.keys()])
    cleanup()
    cleanup()
    expect(removals).toEqual([...listeners.keys()])
  })
})

describe('M1 文件另存为路由', () => {
  it('取消不改变会话，成功则使用主进程选择的路径并回写会话', async () => {
    const decoded = decodeSourceBuffer(new Uint8Array(), '0'.repeat(64))
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const session = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000512',
      path: null,
      buffer: decoded.buffer,
      diskVersion: null
    })
    const saveRequest: FilesSaveAsRequest = {
      contractVersion: 1,
      requestId: '00000000-0000-4000-8000-000000000513',
      payload: {
        documentId: session.id,
        revision: 1,
        text: '另存正文',
        encoding: 'utf8',
        eolByLine: []
      }
    }
    let chooseResult: string | null = null
    let saveCalls = 0
    const remembered: unknown[] = []
    const route = createFilesSaveAsRoute({
      findSession: () => session,
      chooseSavePath: () => Promise.resolve(chooseResult),
      inspectTarget: () => Promise.resolve(null),
      saveAsSession: (candidate: typeof session, path: string) => {
        saveCalls += 1
        return Promise.resolve({
          status: 'saved',
          session: {
            ...candidate,
            path,
            savedRevision: candidate.currentContentRevision,
            diskVersion: { mtimeMs: 4, size: 12, contentHash: '2'.repeat(64) }
          }
        })
      },
      rememberSession: (windowId: number, candidate: typeof session) =>
        remembered.push({ windowId, session: candidate }),
      readSnapshot: () => Promise.reject(new Error('not used')),
      createConflictToken: () => '00000000-0000-4000-8000-000000000599',
      rememberConflict: () => undefined
    })

    await expect(
      route.handle(saveRequest, { ...context, requestId: saveRequest.requestId })
    ).resolves.toEqual({ ok: true, value: null })
    expect(saveCalls).toBe(0)
    expect(remembered).toEqual([])

    chooseResult = 'D:\\文档\\新文档.md'
    await expect(
      route.handle(saveRequest, { ...context, requestId: saveRequest.requestId })
    ).resolves.toEqual({
      ok: true,
      value: {
        status: 'saved',
        file: {
          path: chooseResult,
          revision: 1,
          diskVersion: { mtimeMs: 4, size: 12, contentHash: '2'.repeat(64) },
          bytesHash: '2'.repeat(64)
        }
      }
    })
    expect(saveCalls).toBe(1)
    expect(remembered).toHaveLength(1)
  })

  it('允许尚未写恢复快照的新建空文档通过主进程选择器首次另存', async () => {
    const saveRequest: FilesSaveAsRequest = {
      contractVersion: 1,
      requestId: '00000000-0000-4000-8000-000000000517',
      payload: {
        documentId: '00000000-0000-4000-8000-000000000518',
        revision: 0,
        text: '',
        encoding: 'utf8',
        eolByLine: []
      }
    }
    const selectedPath = 'D:\\文档\\空白文档.md'
    const savedVersion = { mtimeMs: 2, size: 0, contentHash: '0'.repeat(64) }
    const route = createFilesSaveAsRoute({
      findSession: () => undefined,
      chooseSavePath: () => Promise.resolve(selectedPath),
      inspectTarget: () => Promise.resolve(null),
      saveAsSession: (candidate, path) =>
        Promise.resolve({
          status: 'saved',
          session: {
            ...candidate,
            path,
            diskVersion: savedVersion
          }
        }),
      rememberSession: () => undefined,
      readSnapshot: () => Promise.reject(new Error('not used')),
      createConflictToken: () => '00000000-0000-4000-8000-000000000519',
      rememberConflict: () => undefined
    })

    await expect(
      route.handle(saveRequest, { ...context, requestId: saveRequest.requestId })
    ).resolves.toEqual({
      ok: true,
      value: {
        status: 'saved',
        file: {
          path: selectedPath,
          revision: 0,
          diskVersion: savedVersion,
          bytesHash: savedVersion.contentHash
        }
      }
    })
  })
})

describe('M1 确认覆盖路由', () => {
  it('令牌只能使用一次且绑定窗口、文档和已观察的外部版本', async () => {
    const bytes = new TextEncoder().encode('原始版本')
    const hash = '3'.repeat(64)
    const decoded = decodeSourceBuffer(bytes, hash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const path = 'D:\\文档\\覆盖.md'
    const originalVersion = { mtimeMs: 1, size: bytes.length, contentHash: hash }
    const baseSession = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000514',
      path,
      buffer: decoded.buffer,
      diskVersion: originalVersion
    })
    const localSession = {
      ...baseSession,
      buffer: { ...baseSession.buffer, text: '本地确认版本' },
      revision: 1,
      currentContentRevision: 1
    }
    const externalBytes = new TextEncoder().encode('外部待覆盖版本')
    const externalVersion = {
      mtimeMs: 2,
      size: externalBytes.length,
      contentHash: '4'.repeat(64)
    }
    const token = '00000000-0000-4000-8000-000000000515'
    const record = {
      token,
      windowId: 7,
      documentId: baseSession.id,
      localSession,
      external: { authorizedPath: path, bytes: externalBytes, diskVersion: externalVersion }
    }
    let availableRecord: typeof record | undefined = record
    const saveCalls: unknown[] = []
    const remembered: unknown[] = []
    const route = createFilesConfirmedOverwriteRoute({
      takeConflict: (candidateToken: string) => {
        if (candidateToken !== token) return undefined
        const current = availableRecord
        availableRecord = undefined
        return current
      },
      saveAsSession: (
        candidate: typeof localSession,
        targetPath: string,
        expectedDiskVersion: typeof externalVersion
      ) => {
        saveCalls.push({ candidate, targetPath, expectedDiskVersion })
        return Promise.resolve({
          status: 'saved',
          session: {
            ...candidate,
            savedRevision: candidate.currentContentRevision,
            diskVersion: { mtimeMs: 3, size: 18, contentHash: '5'.repeat(64) }
          }
        })
      },
      rememberSession: (windowId: number, candidate: typeof localSession) =>
        remembered.push({ windowId, session: candidate }),
      readSnapshot: () => Promise.reject(new Error('not used')),
      createConflictToken: () => '00000000-0000-4000-8000-000000000598',
      rememberConflict: () => undefined
    })
    const overwriteRequest: FilesConfirmedOverwriteRequest = {
      contractVersion: 1,
      requestId: '00000000-0000-4000-8000-000000000516',
      payload: {
        documentId: baseSession.id,
        conflictToken: token,
        revision: 1,
        text: '本地确认版本',
        encoding: 'utf8',
        eolByLine: []
      }
    }

    await expect(
      route.handle(overwriteRequest, { ...context, requestId: overwriteRequest.requestId })
    ).resolves.toEqual({
      ok: true,
      value: {
        status: 'saved',
        file: {
          path,
          revision: 1,
          diskVersion: { mtimeMs: 3, size: 18, contentHash: '5'.repeat(64) },
          bytesHash: '5'.repeat(64)
        }
      }
    })
    expect(saveCalls).toEqual([
      { candidate: localSession, targetPath: path, expectedDiskVersion: externalVersion }
    ])
    expect(remembered).toHaveLength(1)

    await expect(
      route.handle(overwriteRequest, { ...context, requestId: overwriteRequest.requestId })
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'IPC_INVALID_REQUEST',
        messageKey: 'errors.ipc.invalidRequest',
        retryable: false,
        requestId: overwriteRequest.requestId
      }
    })
    expect(saveCalls).toHaveLength(1)
  })
})
