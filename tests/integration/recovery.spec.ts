import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyDocumentChange,
  createDocumentSession,
  decodeSourceBuffer,
  restoreDocumentSession,
  type DocumentSession
} from '../../src/domain/documents'
import { createRecoveryCoordinator } from '../../src/main/documents/recovery-coordinator'
import { createNodeRecoveryStore } from '../../src/main/documents/node-recovery-store'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

function editableBuffer(text: string) {
  const bytes = new TextEncoder().encode(text)
  const decoded = decodeSourceBuffer(bytes, createHash('sha256').update(bytes).digest('hex'))
  if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
  return decoded.buffer
}

describe('崩溃恢复（TC-M1-005）', () => {
  it('最新快照损坏时仅回退对应会话，并且诊断不泄露正文或完整路径', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-recovery-'))
    temporaryDirectories.push(root)
    let currentTime = 1_000
    const diagnostics: unknown[] = []
    const store = createNodeRecoveryStore({
      rootDirectory: root,
      createTemporaryId: () => '00000000-0000-4000-8000-000000000301',
      now: () => currentTime,
      reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
    })
    const firstBase = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000302',
      path: 'D:\\秘密目录\\第一份.md',
      buffer: editableBuffer('第一份秘密正文'),
      diskVersion: null
    })
    const firstRevision = applyDocumentChange(firstBase, {
      from: firstBase.buffer.text.length,
      to: firstBase.buffer.text.length,
      insert: '：版本一'
    })
    await store.write(firstRevision)
    currentTime = 2_000
    const latestFirstRevision = applyDocumentChange(firstRevision, {
      from: firstRevision.buffer.text.length,
      to: firstRevision.buffer.text.length,
      insert: '：版本二'
    })
    await store.write(latestFirstRevision)

    currentTime = 3_000
    const secondBase = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000303',
      path: null,
      buffer: editableBuffer('第二份秘密正文'),
      diskVersion: null
    })
    const secondRevision = applyDocumentChange(secondBase, {
      from: secondBase.buffer.text.length,
      to: secondBase.buffer.text.length,
      insert: '：未命名修改'
    })
    await store.write(secondRevision)

    const firstDirectory = join(root, firstBase.id)
    const bodies = (await readdir(firstDirectory)).filter((name) => name.endsWith('.body'))
    expect(bodies).toHaveLength(2)
    const latestBody = bodies.sort().at(-1)
    if (latestBody === undefined) throw new Error('测试夹具缺少最新恢复正文')
    await writeFile(join(firstDirectory, latestBody), '损坏数据')

    const restartedStore = createNodeRecoveryStore({
      rootDirectory: root,
      createTemporaryId: () => '00000000-0000-4000-8000-000000000304',
      now: () => 4_000,
      reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
    })
    const records = await restartedStore.list()

    expect(records).toHaveLength(2)
    const recoveredFirst = records.find((record) => record.sessionId === firstBase.id)
    const recoveredSecond = records.find((record) => record.sessionId === secondBase.id)
    expect(recoveredFirst?.revision).toBe(firstRevision.revision)
    expect(recoveredFirst?.buffer.text).toBe('第一份秘密正文：版本一')
    expect(recoveredSecond?.revision).toBe(secondRevision.revision)
    expect(recoveredSecond?.buffer.text).toBe('第二份秘密正文：未命名修改')
    if (recoveredFirst === undefined) throw new Error('测试夹具缺少第一份恢复记录')
    const restoredSession = restoreDocumentSession({
      id: recoveredFirst.sessionId,
      path: recoveredFirst.path,
      buffer: recoveredFirst.buffer,
      revision: recoveredFirst.revision,
      currentContentRevision: recoveredFirst.currentContentRevision,
      savedRevision: recoveredFirst.savedRevision,
      diskVersion: recoveredFirst.diskVersion
    })
    expect(restoredSession.buffer.text).toBe('第一份秘密正文：版本一')
    expect(restoredSession.revision).toBe(firstRevision.revision)
    expect(restoredSession.currentContentRevision).toBe(firstRevision.currentContentRevision)
    expect(restoredSession.savedRevision).toBe(firstRevision.savedRevision)
    expect(diagnostics).toContainEqual({
      code: 'RECOVERY_CORRUPT',
      sessionId: firstBase.id,
      revision: latestFirstRevision.revision
    })
    const serializedDiagnostics = JSON.stringify(diagnostics)
    expect(serializedDiagnostics).not.toContain('秘密正文')
    expect(serializedDiagnostics).not.toContain('秘密目录')
    expect(serializedDiagnostics).not.toContain('第一份.md')
  })

  it('仅按合法会话 ID 显式丢弃恢复项，未确认项不会因时间超过三十天自动删除', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-recovery-discard-'))
    temporaryDirectories.push(root)
    const store = createNodeRecoveryStore({
      rootDirectory: root,
      createTemporaryId: () => '00000000-0000-4000-8000-000000000305',
      now: () => 1_000
    })
    const base = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000306',
      path: null,
      buffer: editableBuffer('超过保留期仍未确认'),
      diskVersion: null
    })
    const edited = applyDocumentChange(base, {
      from: base.buffer.text.length,
      to: base.buffer.text.length,
      insert: '：保留'
    })
    await store.write(edited)

    const afterThirtyOneDays = createNodeRecoveryStore({
      rootDirectory: root,
      createTemporaryId: () => '00000000-0000-4000-8000-000000000307',
      now: () => 1_000 + 31 * 24 * 60 * 60 * 1_000
    })
    expect(await afterThirtyOneDays.list()).toHaveLength(1)
    await expect(afterThirtyOneDays.discard('../越界')).rejects.toThrow()
    expect(await afterThirtyOneDays.list()).toHaveLength(1)

    await afterThirtyOneDays.discard(base.id)

    expect(await afterThirtyOneDays.list()).toEqual([])
    expect(await readdir(root)).toEqual([])
  })

  it('按会话独立合并一秒内的输入，并让结构操作立即写入最新修订', async () => {
    const scheduled = new Map<string, { callback: () => void; delayMs: number }>()
    const cancelled: string[] = []
    const written: DocumentSession[] = []
    let timerSequence = 0
    const coordinator = createRecoveryCoordinator({
      writeSnapshot: (session) => {
        written.push(session)
        return Promise.resolve()
      },
      schedule: (callback, delayMs) => {
        timerSequence += 1
        const token = `timer-${timerSequence}`
        scheduled.set(token, { callback, delayMs })
        return token
      },
      cancelScheduled: (token) => cancelled.push(token)
    })
    const firstBase = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000308',
      path: null,
      buffer: editableBuffer('甲'),
      diskVersion: null
    })
    const firstRevision = applyDocumentChange(firstBase, { from: 1, to: 1, insert: '一' })
    const latestFirstRevision = applyDocumentChange(firstRevision, {
      from: 2,
      to: 2,
      insert: '二'
    })
    const secondBase = createDocumentSession({
      id: '00000000-0000-4000-8000-000000000309',
      path: null,
      buffer: editableBuffer('乙'),
      diskVersion: null
    })
    const secondRevision = applyDocumentChange(secondBase, { from: 1, to: 1, insert: '一' })

    await coordinator.record(firstRevision, 'typing')
    await coordinator.record(latestFirstRevision, 'typing')
    await coordinator.record(secondRevision, 'typing')

    expect(cancelled).toEqual(['timer-1'])
    expect([...scheduled.values()].map(({ delayMs }) => delayMs)).toEqual([1_000, 1_000, 1_000])
    scheduled.get('timer-1')?.callback()
    scheduled.get('timer-2')?.callback()
    scheduled.get('timer-3')?.callback()
    await Promise.resolve()
    expect(written).toEqual([latestFirstRevision, secondRevision])

    const structuralRevision = applyDocumentChange(latestFirstRevision, {
      from: 0,
      to: 0,
      insert: '# '
    })
    await coordinator.record(latestFirstRevision, 'typing')
    await coordinator.record(structuralRevision, 'structural')

    expect(cancelled).toContain('timer-4')
    expect(written.at(-1)).toBe(structuralRevision)
  })

  it('恢复写入在创建目录前拒绝可造成路径越界的会话 ID', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-recovery-scope-'))
    temporaryDirectories.push(root)
    const escapeDirectory = `${root}-escape`
    temporaryDirectories.push(escapeDirectory)
    const store = createNodeRecoveryStore({
      rootDirectory: root,
      createTemporaryId: () => '00000000-0000-4000-8000-000000000310',
      now: () => 1_000
    })
    const unsafeSession = createDocumentSession({
      id: `../${basename(escapeDirectory)}`,
      path: null,
      buffer: editableBuffer('不得写出恢复根目录'),
      diskVersion: null
    })

    await expect(store.write(unsafeSession)).rejects.toThrow()

    expect(await readdir(root)).toEqual([])
  })

  it('仅把不存在的恢复根目录视为空，其他读取故障必须失败关闭', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-recovery-failure-'))
    temporaryDirectories.push(root)
    const fileInsteadOfDirectory = join(root, 'not-a-directory')
    await writeFile(fileInsteadOfDirectory, '不可静默忽略')
    const store = createNodeRecoveryStore({
      rootDirectory: fileInsteadOfDirectory,
      createTemporaryId: () => '00000000-0000-4000-8000-000000000311',
      now: () => 1_000
    })

    await expect(store.list()).rejects.toMatchObject({ code: 'ENOTDIR' })
  })
})
