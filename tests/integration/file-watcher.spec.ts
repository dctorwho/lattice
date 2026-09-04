import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { applyDocumentChange, isDocumentSessionDirty } from '../../src/domain/documents'
import { createDocumentOpenService } from '../../src/main/documents/document-open-service'
import { createFileWatcherCoordinator } from '../../src/main/documents/file-watcher-coordinator'
import { createNodeDocumentSnapshotReader } from '../../src/main/documents/node-document-snapshot-reader'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('文件监视与自动保存冲突策略（TC-M1-008）', () => {
  it('按哈希去重自身事件，干净会话重载，脏会话保留双方内容并暂停自动保存', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-watch-'))
    temporaryDirectories.push(root)
    const path = join(root, '监视.md')
    await writeFile(path, '初始内容')
    const readSnapshot = createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 })
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot,
      createSessionId: () => '00000000-0000-4000-8000-000000000401'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const coordinator = createFileWatcherCoordinator({ readSnapshot })

    const selfEvent = await coordinator.handle(opened.session, { kind: 'change', sequence: 1 })

    expect(selfEvent.status).toBe('ignored')
    expect(selfEvent.session).toBe(opened.session)

    await writeFile(path, '外部干净版本')
    const reloaded = await coordinator.handle(opened.session, { kind: 'change', sequence: 2 })

    expect(reloaded.status).toBe('reloaded')
    expect(reloaded.session.buffer.text).toBe('外部干净版本')
    expect(isDocumentSessionDirty(reloaded.session)).toBe(false)
    const local = applyDocumentChange(reloaded.session, {
      from: reloaded.session.buffer.text.length,
      to: reloaded.session.buffer.text.length,
      insert: ' + 本地修改'
    })
    await writeFile(path, '外部竞争版本')

    const conflict = await coordinator.handle(local, { kind: 'change', sequence: 3 })

    expect(conflict.status).toBe('conflict')
    if (conflict.status !== 'conflict') return
    expect(conflict.session.buffer.text).toBe('外部干净版本 + 本地修改')
    expect(conflict.session.externalState).toBe('changed')
    expect(conflict.autosavePaused).toBe(true)
    expect(new TextDecoder().decode(conflict.external.bytes)).toBe('外部竞争版本')
    expect(conflict.external.diskVersion.contentHash).not.toBe(
      conflict.session.diskVersion?.contentHash
    )

    const stale = await coordinator.handle(conflict.session, { kind: 'change', sequence: 2 })
    expect(stale.status).toBe('ignored')
    expect(stale.session).toBe(conflict.session)
  })

  it('删除事件保留内存内容，并仅在脏会话中暂停自动保存', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-watch-delete-'))
    temporaryDirectories.push(root)
    const path = join(root, '删除.md')
    await writeFile(path, '保留在内存')
    const readSnapshot = createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 })
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot,
      createSessionId: () => '00000000-0000-4000-8000-000000000402'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const coordinator = createFileWatcherCoordinator({ readSnapshot })

    const cleanDeleted = await coordinator.handle(opened.session, { kind: 'delete', sequence: 1 })
    const dirty = applyDocumentChange(opened.session, { from: 0, to: 0, insert: '本地：' })
    const dirtyDeleted = await coordinator.handle(dirty, { kind: 'delete', sequence: 2 })

    expect(cleanDeleted.status).toBe('deleted')
    expect(cleanDeleted.session.buffer.text).toBe('保留在内存')
    expect(cleanDeleted.session.externalState).toBe('deleted')
    expect(cleanDeleted.autosavePaused).toBe(false)
    expect(dirtyDeleted.status).toBe('deleted')
    expect(dirtyDeleted.session.buffer.text).toBe('本地：保留在内存')
    expect(dirtyDeleted.autosavePaused).toBe(true)
  })
})
