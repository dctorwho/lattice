import { readFile, rm } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import {
  createM1AcceptanceRecorder,
  loadM1ByteFixtures,
  m1AcceptanceScenarioIds,
  sha256
} from '../../helpers/m1-acceptance'

const repositoryRoot = process.cwd()
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

describe('M1 自动验收帮助模块', () => {
  it('加载九个冻结字节夹具并验证 Base64 与 SHA-256', async () => {
    const fixtures = await loadM1ByteFixtures(repositoryRoot)

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'empty',
      'utf8-lf',
      'utf8-crlf',
      'utf8-no-final-eol',
      'utf8-bom-crlf',
      'utf16le-bom-lf',
      'utf16be-bom-crlf',
      'utf8-mixed-eol',
      'invalid-utf8-readonly'
    ])
    for (const fixture of fixtures) {
      expect(sha256(Buffer.from(fixture.baselineBase64, 'base64'))).toBe(fixture.baselineSha256)
      expect(sha256(Buffer.from(fixture.expectedBase64, 'base64'))).toBe(fixture.expectedSha256)
    }
  })

  it('拒绝哈希与 Base64 内容不一致的清单', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lattice-m1-fixtures-'))
    temporaryRoots.push(root)
    const manifest = JSON.parse(
      await readFile(join(repositoryRoot, 'tests/fixtures/bytes/m1-byte-fixtures.json'), 'utf8')
    ) as { fixtures: Array<{ baselineSha256: string }> }
    manifest.fixtures[0]!.baselineSha256 = '0'.repeat(64)
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(join(root, 'tests/fixtures/bytes'), { recursive: true })
    await writeFile(
      join(root, 'tests/fixtures/bytes/m1-byte-fixtures.json'),
      `${JSON.stringify(manifest)}\n`
    )

    await expect(loadM1ByteFixtures(root)).rejects.toThrow('baselineSha256')
  })

  it('只在全部固定场景通过后原子写入脱敏证据', async () => {
    const root = mkdtempSync(join(tmpdir(), 'lattice-m1-evidence-'))
    temporaryRoots.push(root)
    const recorder = createM1AcceptanceRecorder({
      rootDirectory: root,
      environment: {
        platform: 'win32',
        release: '10.0.test',
        arch: 'x64',
        node: 'v24.0.0',
        pnpm: '11.12.0',
        electron: '43.0.0',
        appVersion: '0.0.0',
        commit: '0123456789abcdef'
      }
    })

    await expect(recorder.write()).rejects.toThrow('missing scenarios')
    for (const id of m1AcceptanceScenarioIds) {
      recorder.recordPassed(id, {
        references: ['REF-001'],
        components: ['COMP-001'],
        hashes: [{ label: 'result', sha256: 'a'.repeat(64) }]
      })
    }
    expect(() => recorder.recordPassed('ime-composition')).toThrow('duplicate scenario')

    const outputPath = await recorder.write()
    expect(isAbsolute(outputPath)).toBe(true)
    const output = await readFile(outputPath, 'utf8')
    expect(output).not.toContain(root)
    expect(output).not.toContain('M1_EDIT_OLD')
    const parsed = JSON.parse(output) as {
      scenarios: Array<{ id: string; result: string }>
      referenceCoverage: Array<{ reference: string; component: string }>
    }
    expect(parsed.scenarios).toHaveLength(m1AcceptanceScenarioIds.length)
    expect(parsed.scenarios.every((scenario) => scenario.result === 'passed')).toBe(true)
    expect(parsed.referenceCoverage).toEqual([
      { reference: 'REF-001', component: 'COMP-001' },
      { reference: 'REF-002', component: 'COMP-002' },
      { reference: 'REF-003', component: 'COMP-003' },
      { reference: 'REF-004', component: 'COMP-004' },
      { reference: 'REF-005', component: 'COMP-036' }
    ])
  })

  it('拒绝未知场景和非法哈希，避免伪造验收记录', () => {
    const root = mkdtempSync(join(tmpdir(), 'lattice-m1-evidence-'))
    temporaryRoots.push(root)
    const recorder = createM1AcceptanceRecorder({ rootDirectory: root, environment: {} })

    expect(() => recorder.recordPassed('unknown' as 'ime-composition')).toThrow('unknown scenario')
    expect(() =>
      recorder.recordPassed('ime-composition', {
        hashes: [{ label: 'result', sha256: 'not-a-hash' }]
      })
    ).toThrow('invalid SHA-256')
  })
})
