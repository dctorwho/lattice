import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import {
  collectActiveDocumentationFiles,
  findChineseDocumentationViolations
} from '../../../scripts/verify-document-language.mjs'

const temporaryRoots: string[] = []

const makeRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'lattice-document-language-'))
  temporaryRoots.push(root)
  return root
}

const write = (root: string, relativePath: string, content: string): void => {
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('活跃资料中文门禁', () => {
  test('拒绝没有中文的英文标题和叙述段落', () => {
    const violations = findChineseDocumentationViolations(
      'README.md',
      '# Project guide\n\nThis document explains how contributors verify the project.\n'
    )

    expect(violations.map(({ line }) => line)).toEqual([1, 3])
  })

  test('允许中文叙述中的稳定技术名词和命令', () => {
    expect(
      findChineseDocumentationViolations(
        'README.md',
        '# Lattice 项目\n\n运行 `pnpm check` 验证 Electron 和 CodeMirror 集成。\n'
      )
    ).toEqual([])
  })

  test('忽略围栏代码、链接目标和纯机器值', () => {
    const content = `# 命令说明

参考 [Electron documentation](https://www.electronjs.org/docs/latest)。

\`\`\`text
This output remains in its original language for evidence.
\`\`\`

\`Decision: passed\`
`

    expect(findChineseDocumentationViolations('docs/example.md', content)).toEqual([])
  })

  test('拒绝旧英文报告标题、表头和结论行', () => {
    const content = `# M0 测试报告

## Automated case results

| Case ID | Result | Evidence | Notes |
| --- | --- | --- | --- |

Decision: passed
`

    expect(findChineseDocumentationViolations('iterations/M0/04-test-report.md', content)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 3 }),
        expect.objectContaining({ line: 5 }),
        expect.objectContaining({ line: 8 })
      ])
    )
  })

  test('只收集活跃 Markdown 并排除历史归档', () => {
    const root = makeRoot()
    write(root, 'README.md', '# 项目\n')
    write(root, 'AGENTS.md', '# 代理说明\n')
    write(root, 'build/brand/README.md', '# 品牌资源\n')
    write(root, 'docs/live.md', '# 活跃资料\n')
    write(root, 'docs/archive/task-model-v1/README.md', '# Historical archive\n')
    write(root, 'iterations/M0/01-requirements.md', '# M0 需求\n')
    write(root, '.superpowers/review.md', '# Temporary review\n')

    expect(collectActiveDocumentationFiles(root)).toEqual([
      'AGENTS.md',
      'README.md',
      'build/brand/README.md',
      'docs/live.md',
      'iterations/M0/01-requirements.md'
    ])
  })
})
