import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createDocumentOpenService } from '../../src/main/documents/document-open-service'
import { createNodeDocumentSnapshotReader } from '../../src/main/documents/node-document-snapshot-reader'
import {
  FILES_OPEN_CHANNEL,
  IPC_CONTRACT_VERSION,
  filesOpenRequestSchema
} from '../../src/shared/contracts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('授权文件打开（TC-M1-002）', () => {
  it('文件打开 IPC 只接受空载荷，拒绝渲染器伪造任何路径', () => {
    const requestId = '00000000-0000-4000-8000-000000000105'
    expect(
      filesOpenRequestSchema.parse({
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload: {}
      })
    ).toEqual({ contractVersion: 1, requestId, payload: {} })

    for (const path of [
      'D:\\private\\draft.md',
      '..\\..\\private\\draft.md',
      '\\\\server\\share\\draft.md',
      'D:\\authorized\\link-to-private.md'
    ]) {
      expect(
        filesOpenRequestSchema.safeParse({
          contractVersion: IPC_CONTRACT_VERSION,
          requestId,
          payload: { path }
        }).success
      ).toBe(false)
    }
    expect(FILES_OPEN_CHANNEL).toBe('lattice:files:open')
  })

  it('只打开系统选择器返回的 Unicode 路径，并建立带强哈希的可编辑会话', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-open-'))
    temporaryDirectories.push(root)
    const folder = join(root, '含 空格#的目录')
    await mkdir(folder)
    const selectedPath = join(folder, '笔记 #1.md')
    await writeFile(
      selectedPath,
      Buffer.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('标题\r\n正文')])
    )

    const service = createDocumentOpenService({
      selectFile: () => Promise.resolve(selectedPath),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000101'
    })

    const result = await service.openFromPicker()

    expect(result.status).toBe('opened')
    if (result.status !== 'opened') return
    expect(result.accessMode).toBe('editable')
    if (result.accessMode !== 'editable') return
    expect(result.displayPath).toBe(selectedPath)
    expect(result.authorizedPath).toBe(await realpath(selectedPath))
    expect(result.session.id).toBe('00000000-0000-4000-8000-000000000101')
    expect(result.session.path).toBe(result.authorizedPath)
    expect(result.session.buffer.text).toBe('标题\n正文')
    expect(result.session.buffer.encoding).toBe('utf8-bom')
    expect(result.session.buffer.eolByLine).toEqual(['\r\n'])
    expect(result.session.diskVersion?.contentHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.session.diskVersion?.size).toBe((await stat(selectedPath)).size)
  })

  it('取消系统选择器时不读取磁盘也不创建会话', async () => {
    let readCalls = 0
    let sessionIdCalls = 0
    const service = createDocumentOpenService({
      selectFile: () => Promise.resolve(null),
      readSnapshot: () => {
        readCalls += 1
        return Promise.reject(new Error('取消后不得读取'))
      },
      createSessionId: () => {
        sessionIdCalls += 1
        return '00000000-0000-4000-8000-000000000102'
      }
    })

    await expect(service.openFromPicker()).resolves.toEqual({ status: 'cancelled' })
    expect(readCalls).toBe(0)
    expect(sessionIdCalls).toBe(0)
  })

  it('未知编码只建立不可覆盖的只读诊断会话', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lattice-open-invalid-'))
    temporaryDirectories.push(root)
    const selectedPath = join(root, '非法编码.md')
    const bytes = Uint8Array.from([0x66, 0x6f, 0x80, 0x6f])
    await writeFile(selectedPath, bytes)
    const service = createDocumentOpenService({
      selectFile: () => Promise.resolve(selectedPath),
      readSnapshot: createNodeDocumentSnapshotReader({ maxBytes: 16 * 1024 * 1024 }),
      createSessionId: () => '00000000-0000-4000-8000-000000000103'
    })

    const result = await service.openFromPicker()

    expect(result.status).toBe('opened')
    if (result.status !== 'opened') return
    expect(result.accessMode).toBe('read-only')
    if (result.accessMode !== 'read-only') return
    expect(result.reason).toBe('unsupported-encoding')
    expect(result.sessionId).toBe('00000000-0000-4000-8000-000000000103')
    expect(result.originalBytes).toEqual(bytes)
    expect(result.diskVersion.contentHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(Reflect.has(result, 'session')).toBe(false)
  })

  it('读取失败返回稳定错误且不泄漏路径、正文或创建会话', async () => {
    let sessionIdCalls = 0
    const service = createDocumentOpenService({
      selectFile: () => Promise.resolve('D:\\private\\secret.md'),
      readSnapshot: () => Promise.reject(new Error('secret document body')),
      createSessionId: () => {
        sessionIdCalls += 1
        return '00000000-0000-4000-8000-000000000104'
      }
    })

    const result = await service.openFromPicker()

    expect(result).toEqual({ status: 'failed', code: 'file-open-failed' })
    expect(JSON.stringify(result)).not.toContain('private')
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(sessionIdCalls).toBe(0)
  })
})
