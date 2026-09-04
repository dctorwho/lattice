import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyDocumentChange,
  createUntitledDocumentSession,
  isDocumentSessionDirty
} from '../../src/domain/documents'
import { createAtomicDocumentSaveService } from '../../src/main/documents/atomic-document-save-service'
import { createDocumentOpenService } from '../../src/main/documents/document-open-service'
import { createNodeAtomicFileSaver } from '../../src/main/documents/node-atomic-file-saver'
import { createNodeDocumentSnapshotReader } from '../../src/main/documents/node-document-snapshot-reader'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('原子保存与外部冲突（TC-M1-003）', () => {
  it('另存为在目标不存在时原子创建文件并只切换当前会话路径', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-as-'))
    temporaryDirectories.push(root)
    const targetPath = join(root, '新文档.md')
    const untitled = createUntitledDocumentSession('00000000-0000-4000-8000-000000000200')
    const edited = applyDocumentChange(untitled, { from: 0, to: 0, insert: '另存正文\n第二行' })
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000215'
      })
    })
    const saveAs = Reflect.get(saveService, 'saveAs')

    expect(typeof saveAs).toBe('function')
    if (typeof saveAs !== 'function') return
    const result = await Reflect.apply(saveAs, saveService, [edited, targetPath, null])

    expect(result.status).toBe('saved')
    if (result.status !== 'saved') return
    expect(new TextDecoder().decode(await readFile(targetPath))).toBe('另存正文\n第二行')
    expect(result.session.path).toBe(targetPath)
    expect(result.session.diskVersion?.contentHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(isDocumentSessionDirty(result.session)).toBe(false)
    expect(untitled.path).toBeNull()
    expect(await readdir(root)).toEqual(['新文档.md'])
  })

  it('在同目录完成已验证的原子替换，并在成功后更新会话保存基线', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-'))
    temporaryDirectories.push(root)
    const path = join(root, '文档.md')
    await writeFile(path, '第一行\r\n第二行')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000201'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: '\n第三行'
    })
    const synchronizedDirectories: string[] = []
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000202',
        syncParentDirectory: (directory) => {
          synchronizedDirectories.push(directory)
          return Promise.resolve()
        }
      })
    })

    const result = await saveService.save(edited)

    expect(result.status).toBe('saved')
    if (result.status !== 'saved') return
    expect(new TextDecoder().decode(await readFile(path))).toBe('第一行\r\n第二行\r\n第三行')
    expect(isDocumentSessionDirty(result.session)).toBe(false)
    expect(result.session.savedRevision).toBe(edited.currentContentRevision)
    expect(result.session.diskVersion?.contentHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.session.buffer.originalBytesHash).toBe(result.session.diskVersion?.contentHash)
    expect(synchronizedDirectories).toEqual([root])
    expect(await readdir(root)).toEqual(['文档.md'])
  })

  it('磁盘哈希与预期版本不一致时保留外部内容并返回可恢复冲突', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-conflict-'))
    temporaryDirectories.push(root)
    const path = join(root, '冲突.md')
    await writeFile(path, '本地基线')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000203'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: ' + 本地修改'
    })
    await writeFile(path, '外部版本')
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000204'
      })
    })

    const result = await saveService.save(edited)

    expect(result.status).toBe('conflict')
    if (result.status !== 'conflict') return
    if (result.diskVersion === null) throw new Error('冲突文件应仍然存在')
    expect(result.session).toBe(edited)
    expect(isDocumentSessionDirty(result.session)).toBe(true)
    expect(new TextDecoder().decode(await readFile(path))).toBe('外部版本')
    expect(result.diskVersion.contentHash).not.toBe(edited.diskVersion?.contentHash)
    expect(await readdir(root)).toEqual(['冲突.md'])
  })

  it('临时文件写入后发生故障时保留完整旧文件、脏会话并清理临时文件', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-fault-'))
    temporaryDirectories.push(root)
    const path = join(root, '故障.md')
    await writeFile(path, '完整旧文件')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000205'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: ' + 本地修改'
    })
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000206',
        onStage: (stage) => {
          if (stage === 'after-write') throw new Error('注入写入后故障')
        }
      })
    })

    const result = await saveService.save(edited)

    expect(result).toEqual({
      status: 'failed',
      code: 'FILE_ATOMIC_SAVE_FAILED',
      session: edited
    })
    expect(isDocumentSessionDirty(edited)).toBe(true)
    expect(new TextDecoder().decode(await readFile(path))).toBe('完整旧文件')
    expect(await readdir(root)).toEqual(['故障.md'])
  })

  it.each([
    ['after-temp-create', '完整旧文件'],
    ['after-sync', '完整旧文件'],
    ['before-replace', '完整旧文件'],
    ['after-replace', '完整旧文件 + 本地修改'],
    ['after-verify', '完整旧文件 + 本地修改']
  ] as const)('在 %s 故障时仅留下完整旧文件或完整新文件', async (faultStage, expectedText) => {
    const root = await mkdtemp(join(tmpdir(), `lattice-save-${faultStage}-`))
    temporaryDirectories.push(root)
    const path = join(root, '阶段故障.md')
    await writeFile(path, '完整旧文件')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000207'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: ' + 本地修改'
    })
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000208',
        onStage: (stage) => {
          if (stage === faultStage) throw new Error(`注入 ${faultStage} 故障`)
        }
      })
    })

    const result = await saveService.save(edited)

    expect(result.status).toBe('failed')
    expect(isDocumentSessionDirty(result.session)).toBe(true)
    expect(new TextDecoder().decode(await readFile(path))).toBe(expectedText)
    expect(await readdir(root)).toEqual(['阶段故障.md'])
  })

  it('准备替换期间出现外部修改时拒绝覆盖并清理临时文件', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-race-'))
    temporaryDirectories.push(root)
    const path = join(root, '竞争.md')
    await writeFile(path, '初始版本')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000209'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: ' + 本地修改'
    })
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000210',
        onStage: async (stage) => {
          if (stage === 'before-replace') await writeFile(path, '竞争外部版本')
        }
      })
    })

    const result = await saveService.save(edited)

    expect(result.status).toBe('conflict')
    expect(isDocumentSessionDirty(result.session)).toBe(true)
    expect(new TextDecoder().decode(await readFile(path))).toBe('竞争外部版本')
    expect(await readdir(root)).toEqual(['竞争.md'])
  })

  it('Windows 文件短暂占用时只进行有限次数退避并可在解除占用后保存', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-retry-'))
    temporaryDirectories.push(root)
    const path = join(root, '占用.md')
    await writeFile(path, '初始版本')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000211'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: ' + 已保存'
    })
    const attempts: number[] = []
    const delays: number[] = []
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000212',
        replaceFile: async (temporaryPath, targetPath) => {
          attempts.push(attempts.length + 1)
          if (attempts.length < 3) {
            throw Object.assign(new Error('文件被占用'), { code: 'EBUSY' })
          }
          await rename(temporaryPath, targetPath)
        },
        wait: (milliseconds) => {
          delays.push(milliseconds)
          return Promise.resolve()
        }
      })
    })

    const result = await saveService.save(edited)

    expect(result.status).toBe('saved')
    expect(attempts).toEqual([1, 2, 3])
    expect(delays).toEqual([10, 30])
    expect(new TextDecoder().decode(await readFile(path))).toBe('初始版本 + 已保存')
    expect(await readdir(root)).toEqual(['占用.md'])
  })

  it('Windows 文件持续占用时在三次尝试后失败且不遗留临时文件', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-save-busy-'))
    temporaryDirectories.push(root)
    const path = join(root, '持续占用.md')
    await writeFile(path, '不可覆盖的旧版本')
    const openService = createDocumentOpenService({
      selectFile: () => Promise.resolve(path),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000213'
    })
    const opened = await openService.openFromPicker()
    if (opened.status !== 'opened' || opened.accessMode !== 'editable') {
      throw new Error('测试夹具必须打开为可编辑会话')
    }
    const edited = applyDocumentChange(opened.session, {
      from: opened.session.buffer.text.length,
      to: opened.session.buffer.text.length,
      insert: ' + 本地修改'
    })
    let attempts = 0
    const delays: number[] = []
    const saveService = createAtomicDocumentSaveService({
      saveFile: createNodeAtomicFileSaver({
        createTemporaryId: () => '00000000-0000-4000-8000-000000000214',
        replaceFile: () => {
          attempts += 1
          return Promise.reject(Object.assign(new Error('文件持续占用'), { code: 'EPERM' }))
        },
        wait: (milliseconds) => {
          delays.push(milliseconds)
          return Promise.resolve()
        }
      })
    })

    const result = await saveService.save(edited)

    expect(result.status).toBe('failed')
    expect(attempts).toBe(3)
    expect(delays).toEqual([10, 30])
    expect(isDocumentSessionDirty(result.session)).toBe(true)
    expect(new TextDecoder().decode(await readFile(path))).toBe('不可覆盖的旧版本')
    expect(await readdir(root)).toEqual(['持续占用.md'])
  })
})
