import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { afterEach, describe, expect, test } from 'vitest'

const repositoryRoot = process.cwd()
const verifierPath = join(repositoryRoot, 'scripts', 'verify-planning-docs.mjs')
const temporaryRoots: string[] = []

const activeRunbooks = [
  'AGENTS.md',
  'docs/README.md',
  'docs/03-architecture.md',
  'docs/04-technology-stack.md',
  'docs/05-data-safety-and-security.md',
  'docs/06-ui-interaction-spec.md',
  'docs/07-iteration-roadmap.md',
  'docs/08-development-plan.md',
  'docs/09-test-strategy.md',
  'docs/11-codex-cli-runbook.md',
  'docs/14-planning-acceptance.md',
  'docs/15-public-contracts.md',
  'docs/16-project-structure-and-standards.md',
  'docs/17-settings-and-storage-schema.md',
  'docs/18-error-catalog.md'
]

const readFixture = (root: string, relativePath: string): string =>
  readFileSync(join(root, relativePath), 'utf8')

const writeFixture = (root: string, relativePath: string, content: string): void => {
  writeFileSync(join(root, relativePath), content, 'utf8')
}

type FixtureIteration = {
  id: string
  status: string
  manual_gate: boolean
  entry: { requirements: string; test_cases: string }
  exit: { test_report: string; iteration_report: string }
  evidence: Array<{ kind: string; summary: string; recorded_at: string }>
}

const isFixtureIteration = (value: unknown): value is FixtureIteration => {
  if (value === null || typeof value !== 'object') return false
  const entry: unknown = Reflect.get(value, 'entry')
  const exit: unknown = Reflect.get(value, 'exit')
  return (
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'status') === 'string' &&
    typeof Reflect.get(value, 'manual_gate') === 'boolean' &&
    entry !== null &&
    typeof entry === 'object' &&
    typeof Reflect.get(entry, 'requirements') === 'string' &&
    typeof Reflect.get(entry, 'test_cases') === 'string' &&
    exit !== null &&
    typeof exit === 'object' &&
    typeof Reflect.get(exit, 'test_report') === 'string' &&
    typeof Reflect.get(exit, 'iteration_report') === 'string' &&
    Array.isArray(Reflect.get(value, 'evidence'))
  )
}

const fixtureIterations = (root: string): FixtureIteration[] => {
  const state: unknown = JSON.parse(readFixture(root, 'iterations/state.json'))
  if (state === null || typeof state !== 'object')
    throw new Error('fixture state must be an object')
  const iterations: unknown = Reflect.get(state, 'iterations')
  if (!Array.isArray(iterations)) throw new Error('fixture state must contain iterations')
  if (!iterations.every(isFixtureIteration)) {
    throw new Error('fixture state must contain well-formed iterations')
  }
  return iterations
}

const fixtureCaseIds = (root: string, iteration: FixtureIteration, prefix: 'TC' | 'MAN') =>
  [
    ...readFixture(root, iteration.entry.test_cases).matchAll(
      new RegExp(`^\\|\\s*(${prefix}-${iteration.id}-\\d{3})\\s*\\|`, 'gm')
    )
  ].map((match) => match[1]!)

const fixtureGlobalIds = (root: string, iteration: FixtureIteration): string[] => {
  const content = readFixture(root, iteration.entry.requirements)
  const ids: string[] = []
  const globalPrefixes = new Set([
    'DOC-',
    'EDT-',
    'MD-',
    'WS-',
    'IMG-',
    'EXP-',
    'UI-',
    'OS-',
    'NFR-',
    'COMP-'
  ])
  for (const match of content.matchAll(
    /\b([A-Z][A-Z0-9]*-)(\d{3})(?:\.\.(?:[A-Z][A-Z0-9]*-)?(\d{3}))?/g
  )) {
    const prefix = match[1]!
    if (!globalPrefixes.has(prefix)) continue
    const start = Number(match[2])
    const end = Number(match[3] ?? match[2])
    for (let value = start; value <= end; value += 1) {
      ids.push(`${prefix}${String(value).padStart(3, '0')}`)
    }
  }
  return [...new Set(ids)]
}

const completeLegacyTestReport = (
  root: string,
  iteration: FixtureIteration,
  includeManualResults = false
): string => {
  const automatedRows = fixtureCaseIds(root, iteration, 'TC')
    .map((caseId) => `| ${caseId} | passed | evidence/${caseId}.json | completed |`)
    .join('\n')
  const manualRows = includeManualResults
    ? fixtureCaseIds(root, iteration, 'MAN')
        .map((caseId) => `| ${caseId} | passed | designated evaluator | evidence/${caseId}.md |`)
        .join('\n')
    : ''
  return `# ${iteration.id} test report

## Iteration context

## Report status

## Baseline and environment

## Existing validation

## Executed commands and results

## Automated case results

| Case ID | Result | Evidence | Notes |
| --- | --- | --- | --- |
${automatedRows}

## Manual case results

| Case ID | Result | Evaluator | Evidence |
| --- | --- | --- | --- |
${manualRows}

## Failures, fixes, and regression evidence

## Unexecuted verification

## Residual risks

## Manual-gate handoff

## Exit-readiness statement
`
}

const completeLegacyExitReport = (root: string, iteration: FixtureIteration): string => {
  const requirementRows = fixtureGlobalIds(root, iteration)
    .map((id) => `| ${id} | completed outcome | evidence/${id}.md | passed |`)
    .join('\n')
  return `# ${iteration.id} exit report

## Iteration context

## Requirement completion matrix

| Global ID | Required outcome | Completion evidence | Result |
| --- | --- | --- | --- |
${requirementRows}

## Final deliverables

## Material implementation and documentation changes

## Automated-gate conclusion

## Manual-gate conclusion

## Known limitations and residual risks

## Rollback approach

## Inputs released to the next iteration

## Final iteration decision

Decision: passed
`
}

const completeTestReport = (
  root: string,
  iteration: FixtureIteration,
  includeManualResults = false
): string =>
  completeLegacyTestReport(root, iteration, includeManualResults)
    .replace('test report', '测试报告')
    .replace('## Iteration context', '## 迭代上下文')
    .replace('## Report status', '## 报告状态')
    .replace('## Baseline and environment', '## 基线与环境')
    .replace('## Existing validation', '## 已有验证')
    .replace('## Executed commands and results', '## 已执行命令与结果')
    .replace('## Automated case results', '## 自动化用例结果')
    .replace('| Case ID | Result | Evidence | Notes |', '| 用例 ID | 结果 | 证据 | 备注 |')
    .replace('## Manual case results', '## 人工用例结果')
    .replace('| Case ID | Result | Evaluator | Evidence |', '| 用例 ID | 结果 | 评估人 | 证据 |')
    .replace('## Failures, fixes, and regression evidence', '## 失败、修复与回归证据')
    .replace('## Unexecuted verification', '## 未执行验证')
    .replace('## Residual risks', '## 剩余风险')
    .replace('## Manual-gate handoff', '## 人工门禁交接')
    .replace('## Exit-readiness statement', '## 退出就绪声明')

const completeExitReport = (root: string, iteration: FixtureIteration): string =>
  completeLegacyExitReport(root, iteration)
    .replace('exit report', '出口报告')
    .replace('## Iteration context', '## 迭代上下文')
    .replace('## Requirement completion matrix', '## 需求完成矩阵')
    .replace(
      '| Global ID | Required outcome | Completion evidence | Result |',
      '| 全局 ID | 要求结果 | 完成证据 | 结果 |'
    )
    .replace('## Final deliverables', '## 最终交付物')
    .replace('## Material implementation and documentation changes', '## 重要实现与文档变更')
    .replace('## Automated-gate conclusion', '## 自动化门禁结论')
    .replace('## Manual-gate conclusion', '## 人工门禁结论')
    .replace('## Known limitations and residual risks', '## 已知限制与剩余风险')
    .replace('## Rollback approach', '## 回滚方法')
    .replace('## Inputs released to the next iteration', '## 向下一迭代释放的输入')
    .replace('## Final iteration decision', '## 最终迭代结论')
    .replace('Decision: passed', '结论：passed')

const writeCompleteExitEvidence = (root: string, iteration: FixtureIteration): void => {
  writeFixture(root, iteration.exit.test_report, completeTestReport(root, iteration, true))
  writeFixture(root, iteration.exit.iteration_report, completeExitReport(root, iteration))
}

const writeCompleteChineseExitEvidence = (root: string, iteration: FixtureIteration): void => {
  writeFixture(root, iteration.exit.test_report, completeTestReport(root, iteration, true))
  writeFixture(root, iteration.exit.iteration_report, completeExitReport(root, iteration))
}

const writeState = (
  root: string,
  iterations: FixtureIteration[],
  currentIteration: string
): void => {
  const state: unknown = JSON.parse(readFixture(root, 'iterations/state.json'))
  if (state === null || typeof state !== 'object')
    throw new Error('fixture state must be an object')
  Reflect.set(state, 'iterations', iterations)
  Reflect.set(state, 'current_iteration', currentIteration)
  writeFixture(root, 'iterations/state.json', `${JSON.stringify(state, null, 2)}\n`)
}

const materializeAutomationTargets = (root: string, iteration: FixtureIteration): void => {
  const content = readFixture(root, iteration.entry.test_cases)
  for (const match of content.matchAll(
    /`pnpm test(?::(?:integration|e2e|security|performance))? -- (tests\/[a-z0-9./-]+\.spec\.tsx?)`/g
  )) {
    const relativeTarget = match[1]!
    const target = join(root, relativeTarget)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, 'export {}\n', 'utf8')
  }
}

const makePassedThroughM6Fixture = (): { root: string; m6: FixtureIteration } => {
  const root = makeIterationOnlyFixture()
  const iterations = fixtureIterations(root)
  iterations[6]!.manual_gate = true
  for (let index = 0; index <= 6; index += 1) {
    const iteration = iterations[index]!
    iteration.status = 'passed'
    if (iteration.manual_gate) {
      iteration.evidence.push({
        kind: 'manual',
        summary: `${iteration.id} manual cases passed`,
        recorded_at: '2026-08-04T01:02:03Z'
      })
    }
    materializeAutomationTargets(root, iteration)
    writeCompleteExitEvidence(root, iteration)
  }
  iterations[7]!.status = 'ready'
  writeState(root, iterations, 'M7')
  return { root, m6: iterations[6]! }
}

const makePassedThroughM8Fixture = (): string => {
  const root = makeIterationOnlyFixture()
  const iterations = fixtureIterations(root)
  for (const iteration of iterations) {
    iteration.status = 'passed'
    if (iteration.manual_gate) {
      iteration.evidence.push({
        kind: 'manual',
        summary: `${iteration.id} manual cases passed`,
        recorded_at: '2026-08-04T01:02:03Z'
      })
    }
    materializeAutomationTargets(root, iteration)
    writeCompleteExitEvidence(root, iteration)
  }
  writeState(root, iterations, 'M8')
  return root
}

const makeIterationOnlyFixture = (
  m0Status: 'in_progress' | 'awaiting_manual' = 'in_progress'
): string => {
  const root = mkdtempSync(join(tmpdir(), 'lattice-planning-verifier-'))
  temporaryRoots.push(root)

  for (const directory of ['docs', 'iterations']) {
    cpSync(join(repositoryRoot, directory), join(root, directory), { recursive: true })
  }
  for (const file of ['.gitignore', 'README.md', 'AGENTS.md']) {
    cpSync(join(repositoryRoot, file), join(root, file))
  }

  for (const relativePath of activeRunbooks) {
    const sanitized = readFixture(root, relativePath)
      .replace(/\bM([0-8])-T\d{2}\b/g, 'M$1')
      .replaceAll('tasks/state.json', 'iterations/state.json')
      .replace(/\bcurrent_task\b/g, 'current_iteration')
      .replace(/解锁[^。\r\n]{0,24}(?:任务|子任务)/g, '允许后续迭代')
      .replace(
        /\bunlock(?:s|ed|ing)?\b[^.\r\n]{0,48}\b(?:sub)?tasks?\b/gi,
        'releases the next iteration'
      )
    writeFixture(root, relativePath, sanitized)
  }

  const state: unknown = JSON.parse(readFixture(root, 'iterations/state.json'))
  if (state === null || typeof state !== 'object')
    throw new Error('fixture state must be an object')
  const iterations: unknown = Reflect.get(state, 'iterations')
  if (!Array.isArray(iterations)) throw new Error('fixture state must contain iterations')
  Reflect.set(state, 'current_iteration', 'M0')
  for (const iteration of iterations) {
    if (iteration === null || typeof iteration !== 'object') {
      throw new Error('fixture iteration must be an object')
    }
    const iterationId: unknown = Reflect.get(iteration, 'id')
    Reflect.set(iteration, 'status', iterationId === 'M0' ? m0Status : 'blocked')
    Reflect.set(iteration, 'evidence', [])
  }
  const m0: unknown = iterations.find(
    (iteration) =>
      iteration !== null && typeof iteration === 'object' && Reflect.get(iteration, 'id') === 'M0'
  )
  if (m0 === null || typeof m0 !== 'object') throw new Error('fixture state must contain M0')
  writeFixture(root, 'iterations/state.json', `${JSON.stringify(state, null, 2)}\n`)
  rmSync(join(root, 'iterations', 'M0-foundation', '05-exit-report.md'), { force: true })
  for (const iteration of iterations) {
    if (!isFixtureIteration(iteration) || iteration.id === 'M0') continue
    rmSync(join(root, iteration.exit.test_report), { force: true })
    rmSync(join(root, iteration.exit.iteration_report), { force: true })
  }
  const executableIterations = new Set(
    iterations
      .filter(
        (iteration): iteration is { id: string; status: string } =>
          iteration !== null &&
          typeof iteration === 'object' &&
          typeof Reflect.get(iteration, 'id') === 'string' &&
          ['awaiting_manual', 'passed'].includes(String(Reflect.get(iteration, 'status')))
      )
      .map((iteration) => iteration.id)
  )

  for (const entry of readdirSync(join(root, 'iterations'), { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^M[0-8]-/.test(entry.name)) continue
    if (!executableIterations.has(entry.name.slice(0, 2))) continue
    const testCases = readFixture(root, `iterations/${entry.name}/03-test-cases.md`)
    for (const match of testCases.matchAll(
      /`pnpm test(?::(?:integration|e2e|security|performance))? -- (tests\/[a-z0-9./-]+\.spec\.tsx?)`/g
    )) {
      const relativeTarget = match[1]
      if (relativeTarget === undefined) {
        throw new Error('Expected an automation target capture in the planning test fixture.')
      }
      const target = join(root, relativeTarget)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, 'export {}\n', 'utf8')
    }
  }

  const firstIteration = fixtureIterations(root)[0]!
  writeFixture(root, firstIteration.exit.test_report, completeTestReport(root, firstIteration))

  return root
}

const runVerifier = (root: string) =>
  spawnSync(process.execPath, [verifierPath], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000
  })

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('iteration planning verifier', () => {
  test('accepts the iteration-only planning contract and reports nine iterations', () => {
    const result = runVerifier(makeIterationOnlyFixture())

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(result.stdout).toContain('9 iterations')
    expect(result.stdout).not.toContain('tasks')
  })

  test('requires the Typora 1.13.8 Windows replica evidence baseline', () => {
    const root = makeIterationOnlyFixture()
    rmSync(join(root, 'docs', '22-typora-1.13.8-windows-evidence-baseline.md'), { force: true })

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'missing required file: docs/22-typora-1.13.8-windows-evidence-baseline.md'
    )
  })

  test('requires replica evidence for every COMP item', () => {
    const root = makeIterationOnlyFixture()
    const evidencePath = 'docs/22-typora-1.13.8-windows-evidence-baseline.md'
    writeFixture(
      root,
      evidencePath,
      readFixture(root, evidencePath).replace(/^\| REF-001 .*\r?\n/m, '')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('compatibility item COMP-001 has no replica evidence')
  })

  test('rejects evidence that references an undefined COMP item', () => {
    const root = makeIterationOnlyFixture()
    const evidencePath = 'docs/22-typora-1.13.8-windows-evidence-baseline.md'
    writeFixture(
      root,
      evidencePath,
      readFixture(root, evidencePath).replace('| COMP-001 ', '| COMP-999 ')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('REF-001 references undefined compatibility item COMP-999')
  })

  test('rejects evidence assigned to the wrong iteration', () => {
    const root = makeIterationOnlyFixture()
    const evidencePath = 'docs/22-typora-1.13.8-windows-evidence-baseline.md'
    writeFixture(
      root,
      evidencePath,
      readFixture(root, evidencePath)
        .replace(/^(\| REF-001 .*\| COMP-001\s*\|)\s*M1\s*\|/m, '$1 M2 |')
        .replace('TC-M1-007, TC-M1-012, TC-M1-013', 'TC-M2-001, MAN-M2-001')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('REF-001 iteration M2 does not match COMP-001 owner M1')
  })

  test('rejects evidence that references an undefined test case', () => {
    const root = makeIterationOnlyFixture()
    const evidencePath = 'docs/22-typora-1.13.8-windows-evidence-baseline.md'
    writeFixture(
      root,
      evidencePath,
      readFixture(root, evidencePath).replace('TC-M1-007', 'TC-M1-999')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('REF-001 references undefined test case TC-M1-999')
  })

  test('rejects an M8 passed state while replica evidence gaps remain', () => {
    const result = runVerifier(makePassedThroughM8Fixture())

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('M8 cannot pass while REF-021 remains 证据不足')
  })

  test('requires the active iteration test report', () => {
    const root = makeIterationOnlyFixture()
    rmSync(join(root, 'iterations', 'M0-foundation', '04-test-report.md'))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('M0 status in_progress requires exit.test_report')
  })

  test('rejects a task-level execution instruction in an iteration entry document', () => {
    const root = makeIterationOnlyFixture()
    const designPath = 'iterations/M1-document-core/02-detailed-design.md'
    writeFixture(
      root,
      designPath,
      `${readFixture(root, designPath)}\nRun M1-T01 before continuing this iteration.\n`
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'iterations/M1-document-core/02-detailed-design.md contains task-level execution instruction'
    )
  })

  test('rejects an automation command whose suite does not own its target path', () => {
    const root = makeIterationOnlyFixture()
    const testCasesPath = 'iterations/M6-export/03-test-cases.md'
    writeFixture(
      root,
      testCasesPath,
      readFixture(root, testCasesPath).replace(
        '`pnpm test:integration -- tests/integration/pandoc-import.spec.ts`',
        '`pnpm test -- tests/integration/pandoc-import.spec.ts`'
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('TC-M6-010 automation script/path mismatch')
  })

  test('requires an awaiting-manual suite-matching target to be a regular file', () => {
    const root = makeIterationOnlyFixture('awaiting_manual')
    const testCasesPath = 'iterations/M0-foundation/03-test-cases.md'
    writeFixture(
      root,
      testCasesPath,
      readFixture(root, testCasesPath).replace(
        'tests/integration/project-bootstrap.spec.ts',
        'tests/integration/definitely-missing.spec.ts'
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'TC-M0-001 automation target is not a regular file: tests/integration/definitely-missing.spec.ts'
    )
  })

  test('rejects an awaiting-manual iteration with a skeletal test report', () => {
    const root = makeIterationOnlyFixture('awaiting_manual')
    const reportPath = 'iterations/M0-foundation/04-test-report.md'
    const headingsOnly = readFixture(root, 'iterations/templates/test-report.md').replaceAll(
      '{{ITERATION_ID}}',
      'M0'
    )
    writeFixture(root, reportPath, headingsOnly)

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      `${reportPath} 自动化用例结果 must cover every declared TC case exactly once`
    )
  })

  test.each([
    [
      'missing',
      (report: string) => report.replace(/^\| TC-M0-001 .*\r?\n/m, ''),
      'missing TC-M0-001'
    ],
    [
      'duplicate',
      (report: string) => report.replace(/^(\| TC-M0-001 .*\r?\n)/m, '$1$1'),
      'duplicate automated result id: TC-M0-001'
    ],
    [
      'wrong-owner',
      (report: string) => report.replace('| TC-M0-001 |', '| TC-M1-001 |'),
      'automated result TC-M1-001 belongs to M1, not M0'
    ],
    [
      'non-passing',
      (report: string) => report.replace('| TC-M0-001 | passed |', '| TC-M0-001 | failed |'),
      'TC-M0-001 Result must be passed'
    ],
    [
      'empty evidence',
      (report: string) =>
        report.replace(
          '| TC-M0-001 | passed | evidence/TC-M0-001.json | completed |',
          '| TC-M0-001 | passed | | completed |'
        ),
      'TC-M0-001 Evidence must be non-empty'
    ]
  ])('rejects %s automated completion evidence', (_name, mutate, errorFragment) => {
    const root = makeIterationOnlyFixture('awaiting_manual')
    const m0 = fixtureIterations(root)[0]!
    writeFixture(root, m0.exit.test_report, mutate(completeTestReport(root, m0)))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(errorFragment)
  })

  test('accepts complete automated results while awaiting manual evaluation', () => {
    const root = makeIterationOnlyFixture('awaiting_manual')
    const m0 = fixtureIterations(root)[0]!
    writeFixture(root, m0.exit.test_report, completeTestReport(root, m0))

    const result = runVerifier(root)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  test('accepts a passed automatic-only iteration without manual results or evidence', () => {
    const { root } = makePassedThroughM6Fixture()
    const iterations = fixtureIterations(root)
    const m6 = iterations[6]!
    m6.manual_gate = false
    m6.evidence = m6.evidence.filter((record) => record.kind !== 'manual')
    writeFixture(root, m6.exit.test_report, completeTestReport(root, m6, false))
    writeState(root, iterations, 'M7')

    const result = runVerifier(root)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  test('rejects a passed iteration with a skeletal exit report', () => {
    const { root, m6 } = makePassedThroughM6Fixture()
    writeFixture(
      root,
      m6.exit.iteration_report,
      readFixture(root, 'iterations/templates/exit-report.md').replaceAll('{{ITERATION_ID}}', 'M6')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      `${m6.exit.iteration_report} requirement completion matrix must cover every declared global ID exactly once`
    )
    expect(result.stderr).toContain(`${m6.exit.iteration_report} 最终迭代结论必须是“结论：passed”`)
  })

  test('rejects M6 passed evidence when one of its two manual cases is missing', () => {
    const { root, m6 } = makePassedThroughM6Fixture()
    writeFixture(
      root,
      m6.exit.test_report,
      completeTestReport(root, m6, true).replace(/^\| MAN-M6-002 .*\r?\n/m, '')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('人工用例结果 must cover every declared MAN case exactly once')
    expect(result.stderr).toContain('missing MAN-M6-002')
  })

  test.each([
    [
      'duplicate ID',
      (report: string) => report.replace(/^(\| MAN-M6-001 .*\r?\n)/m, '$1$1'),
      'duplicate manual result id: MAN-M6-001'
    ],
    [
      'wrong owner',
      (report: string) => report.replace('| MAN-M6-001 |', '| MAN-M5-001 |'),
      'manual result MAN-M5-001 belongs to M5, not M6'
    ],
    [
      'non-passing result',
      (report: string) => report.replace('| MAN-M6-001 | passed |', '| MAN-M6-001 | failed |'),
      'MAN-M6-001 Result must be passed'
    ],
    [
      'empty evaluator',
      (report: string) =>
        report.replace(
          '| MAN-M6-001 | passed | designated evaluator | evidence/MAN-M6-001.md |',
          '| MAN-M6-001 | passed | | evidence/MAN-M6-001.md |'
        ),
      'MAN-M6-001 Evaluator must be non-empty'
    ],
    [
      'empty evidence',
      (report: string) =>
        report.replace(
          '| MAN-M6-001 | passed | designated evaluator | evidence/MAN-M6-001.md |',
          '| MAN-M6-001 | passed | designated evaluator | |'
        ),
      'MAN-M6-001 Evidence must be non-empty'
    ]
  ])('rejects passed manual evidence with %s', (_name, mutate, errorFragment) => {
    const { root, m6 } = makePassedThroughM6Fixture()
    writeFixture(root, m6.exit.test_report, mutate(completeTestReport(root, m6, true)))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(errorFragment)
  })

  test.each([
    ['missing decision', (report: string) => report.replace('结论：passed', '')],
    ['non-passing decision', (report: string) => report.replace('结论：passed', '结论：failed')],
    [
      'Markdown-bulleted decision',
      (report: string) => report.replace('结论：passed', '- 结论：passed')
    ]
  ])('rejects a passed exit report with %s', (_name, mutate) => {
    const { root, m6 } = makePassedThroughM6Fixture()
    writeFixture(root, m6.exit.iteration_report, mutate(completeExitReport(root, m6)))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('最终迭代结论必须是“结论：passed”')
  })

  test('rejects an incomplete requirement completion matrix', () => {
    const { root, m6 } = makePassedThroughM6Fixture()
    const firstId = fixtureGlobalIds(root, m6)[0]!
    writeFixture(
      root,
      m6.exit.iteration_report,
      completeExitReport(root, m6).replace(
        new RegExp(`^\\| ${firstId.replace('-', '\\-')} .*\\r?\\n`, 'm'),
        ''
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`missing ${firstId}`)
  })

  test('accepts complete distinct automated, manual and exit evidence for passed iterations', () => {
    const { root } = makePassedThroughM6Fixture()

    const result = runVerifier(root)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  test('接受完整的中文测试报告与出口报告契约', () => {
    const { root } = makePassedThroughM6Fixture()
    for (const iteration of fixtureIterations(root).filter(({ status }) => status === 'passed')) {
      writeCompleteChineseExitEvidence(root, iteration)
    }

    const result = runVerifier(root)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  })

  test('拒绝已废弃的英文测试报告结构', () => {
    const root = makeIterationOnlyFixture('awaiting_manual')
    const m0 = fixtureIterations(root)[0]!
    writeFixture(root, m0.exit.test_report, completeLegacyTestReport(root, m0))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('缺少必需章节：自动化用例结果')
  })

  test('rejects an automation target that normalizes outside its suite root', () => {
    const root = makeIterationOnlyFixture()
    const testCasesPath = 'iterations/M6-export/03-test-cases.md'
    writeFixture(
      root,
      testCasesPath,
      readFixture(root, testCasesPath).replace(
        'tests/integration/pandoc-import.spec.ts',
        'tests/integration/../security/pandoc-process.spec.ts'
      )
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'TC-M6-010 automation target escapes suite root tests/integration/'
    )
  })

  test('requires exact coverage of every globally defined requirement', () => {
    const root = makeIterationOnlyFixture()
    const requirementsPath = 'iterations/M7-parity-hardening/01-requirements.md'
    writeFixture(
      root,
      requirementsPath,
      readFixture(root, requirementsPath).replaceAll('NFR-009..010', 'NFR-009')
    )

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requirement NFR-010 is not covered by an iteration')
  })

  test('rejects AGENTS.md at exactly the 32 KiB boundary', () => {
    const root = makeIterationOnlyFixture()
    writeFixture(root, 'AGENTS.md', 'a'.repeat(32_768))

    const result = runVerifier(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'AGENTS.md must stay below the Codex 32 KiB instruction limit: 32768'
    )
  })
})
