import { describe, expect, it, vi } from 'vitest'

import {
  createDocumentSession,
  decodeSourceBuffer,
  type DocumentSession
} from '../../../src/domain/documents'
import type {
  NodeRecoveryStore,
  RecoveryRecord as StoredRecoveryRecord
} from '../../../src/main/documents/node-recovery-store'
import { createRecoveryRoutes } from '../../../src/main/documents/recovery-routes'
import { createAppError } from '../../../src/shared/errors'

const requestId = '00000000-0000-4000-8000-000000000601'
const documentId = '00000000-0000-4000-8000-000000000602'
const context = { requestId, windowId: 7, webContentsId: 8, sessionId: null }
const diskVersion = { mtimeMs: 1, size: 4, contentHash: 'a'.repeat(64) }
const path = 'D:\\文档\\恢复.md'

function createStore() {
  const write = vi.fn<(session: DocumentSession) => Promise<void>>(() => Promise.resolve())
  const list = vi.fn<() => Promise<readonly StoredRecoveryRecord[]>>(() => Promise.resolve([]))
  const discard = vi.fn<(sessionId: string) => Promise<void>>(() => Promise.resolve())
  const store: NodeRecoveryStore = { write, list, discard }
  return { store, write, list, discard }
}

function recoveryRequest(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1 as const,
    requestId,
    payload: {
      documentId,
      path,
      revision: 1,
      currentContentRevision: 1,
      savedRevision: 0,
      text: '恢复正文',
      encoding: 'utf8' as const,
      eolByLine: [],
      originalBytesHash: diskVersion.contentHash,
      diskVersion,
      trigger: 'typing' as const,
      ...overrides
    }
  }
}

describe('M1 恢复 IPC 授权', () => {
  it('拒绝把 renderer 自报的任意磁盘路径登记为授权会话', async () => {
    const store = createStore()
    const routes = createRecoveryRoutes({
      store: store.store,
      findSession: () => undefined,
      rememberSession: vi.fn()
    })
    const writeRoute = routes.find((route) => route.channel === 'lattice:recovery:write')
    if (writeRoute === undefined) throw new Error('恢复写路由缺失')

    await expect(writeRoute.handle(recoveryRequest(), context)).resolves.toEqual({
      ok: false,
      error: createAppError('IPC_INVALID_REQUEST', requestId)
    })
    expect(store.write).not.toHaveBeenCalled()
  })

  it('仅用已授权主进程会话接收恢复正文并保留原始字节基线', async () => {
    const bytes = new TextEncoder().encode('原文')
    const decoded = decodeSourceBuffer(bytes, diskVersion.contentHash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const authorized = createDocumentSession({
      id: documentId,
      path,
      buffer: decoded.buffer,
      diskVersion
    })
    const store = createStore()
    const remembered: unknown[] = []
    const routes = createRecoveryRoutes({
      store: store.store,
      findSession: () => authorized,
      rememberSession: (windowId, session) => remembered.push({ windowId, session })
    })
    const writeRoute = routes.find((route) => route.channel === 'lattice:recovery:write')
    if (writeRoute === undefined) throw new Error('恢复写路由缺失')

    await expect(writeRoute.handle(recoveryRequest(), context)).resolves.toEqual({
      ok: true,
      value: { applied: true }
    })
    expect(store.write).toHaveBeenCalledTimes(1)
    const written = store.write.mock.calls[0]?.[0]
    expect(written).toMatchObject({
      id: documentId,
      path,
      revision: 1,
      currentContentRevision: 1,
      savedRevision: 0,
      buffer: { text: '恢复正文', originalBytes: bytes }
    })
    expect(remembered).toEqual([{ windowId: 7, session: written }])
  })

  it('列出受控恢复记录时在当前窗口重建主进程授权', async () => {
    const bytes = new TextEncoder().encode('受控恢复')
    const decoded = decodeSourceBuffer(bytes, diskVersion.contentHash)
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const recovered = {
      sessionId: documentId,
      revision: 2,
      currentContentRevision: 2,
      savedRevision: 0,
      createdAtMs: 3,
      path,
      diskVersion,
      buffer: decoded.buffer
    }
    const store = createStore()
    store.list.mockResolvedValue([recovered])
    const remembered: unknown[] = []
    const routes = createRecoveryRoutes({
      store: store.store,
      findSession: () => undefined,
      rememberSession: (windowId, session) => remembered.push({ windowId, session })
    })
    const listRoute = routes.find((route) => route.channel === 'lattice:recovery:list')
    if (listRoute === undefined) throw new Error('恢复列表路由缺失')

    const result = await listRoute.handle({ contractVersion: 1, requestId, payload: {} }, context)

    expect(result).toMatchObject({ ok: true, value: [{ documentId, path, revision: 2 }] })
    expect(remembered).toHaveLength(1)
    expect(remembered[0]).toMatchObject({
      windowId: 7,
      session: { id: documentId, path, revision: 2, buffer: { text: '受控恢复' } }
    })
  })
})
