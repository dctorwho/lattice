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
  const m0: unknown = iterations.find(
    (iteration) =>
      iteration !== null && typeof iteration === 'object' && Reflect.get(iteration, 'id') === 'M0'
  )
  if (m0 === null || typeof m0 !== 'object') throw new Error('fixture state must contain M0')
  Reflect.set(m0, 'status', m0Status)
  writeFixture(root, 'iterations/state.json', `${JSON.stringify(state, null, 2)}\n`)
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
      const target = join(root, match[1])
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, 'export {}\n', 'utf8')
    }
  }

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
