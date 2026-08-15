import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runM0Audit } from '../../scripts/audit/run-m0-audit.mjs'
import { verifyWorkflows } from '../../scripts/verify-workflows.mjs'

const checkoutSha = '3d3c42e5aac5ba805825da76410c181273ba90b1'
const setupNodeSha = '820762786026740c76f36085b0efc47a31fe5020'
const uploadArtifactSha = '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'
const codeqlSha = 'f205ea1c3313d32999d8d6a48b4f6530d4437b38'
const dependencyReviewSha = 'a1d282b36b6f3519aa1f3fc636f609c47dddb294'
const dependencyReviewLicenses =
  'MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, BlueOak-1.0.0, Python-2.0, WTFPL'

const temporaryRoots: string[] = []

async function temporaryRoot(label: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `lattice-m0-${label}-`))
  temporaryRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

function workflowFixtures(): Readonly<Record<string, string>> {
  return {
    'quality.yml': `name: Quality Gate
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  quality:
    name: quality
    runs-on: windows-2025
    timeout-minutes: 45
    steps:
      - name: Check out repository
        uses: actions/checkout@${checkoutSha}
      - uses: actions/setup-node@${setupNodeSha}
      - name: Activate pinned pnpm
        run: corepack install --global pnpm@11.12.0
      - run: pnpm install --frozen-lockfile
      - run: node scripts/verify-planning-docs.mjs
      - run: pnpm check
      - run: pnpm test:e2e
      - run: pnpm test:security
      - run: pnpm package:win
      - run: pnpm test:packaged
      - run: pnpm audit:m0
      - uses: actions/upload-artifact@${uploadArtifactSha}
        if: always()
        with:
          name: m0-evidence
          path: artifacts/m0
          retention-days: 14
`,
    'codeql.yml': `name: CodeQL
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:
permissions:
  contents: read
  packages: read
  security-events: write
jobs:
  analyze:
    runs-on: windows-2025
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@${checkoutSha}
      - uses: github/codeql-action/init@${codeqlSha}
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/autobuild@${codeqlSha}
      - uses: github/codeql-action/analyze@${codeqlSha}
`,
    'dependency-review.yml': `name: Dependency Review
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
  pull-requests: read
jobs:
  dependency-review:
    runs-on: windows-2025
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@${checkoutSha}
      - uses: actions/dependency-review-action@${dependencyReviewSha}
        with:
          fail-on-severity: moderate
          allow-licenses: ${dependencyReviewLicenses}
`
  }
}

const dependabotFixture = `version: 2
updates:
  - package-ecosystem: pnpm
    directory: /
    target-branch: main
    schedule:
      interval: weekly
      day: monday
      time: '04:17'
      timezone: Asia/Shanghai
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    target-branch: main
    schedule:
      interval: weekly
      day: monday
      time: '04:17'
      timezone: Asia/Shanghai
    open-pull-requests-limit: 5
`

async function createWorkflowFixture(
  mutate?: (files: Record<string, string>) => void
): Promise<string> {
  const root = await temporaryRoot('workflows')
  const workflowDirectory = join(root, '.github', 'workflows')
  await mkdir(workflowDirectory, { recursive: true })
  const files = { ...workflowFixtures() }
  mutate?.(files)
  await Promise.all(
    Object.entries(files).map(([name, contents]) =>
      writeFile(join(workflowDirectory, name), contents, 'utf8')
    )
  )
  await writeFile(join(root, '.github', 'dependabot.yml'), dependabotFixture, 'utf8')
  return root
}

describe('TC-M0-007 workflow policy', () => {
  it('accepts only the complete SHA-pinned least-privilege automation set', async () => {
    const root = await createWorkflowFixture()

    await expect(verifyWorkflows({ rootDirectory: root })).resolves.toEqual({
      workflowCount: 3,
      pinnedActionCount: 9,
      dependabotConfigured: true
    })
  })

  it.each([
    {
      name: 'floating action',
      code: 'M0_WORKFLOW_ACTION_NOT_PINNED',
      mutate(files: Record<string, string>) {
        files['quality.yml'] = files['quality.yml']?.replace(checkoutSha, 'v7') ?? ''
      }
    },
    {
      name: 'excessive permission',
      code: 'M0_WORKFLOW_PERMISSION_NOT_ALLOWED',
      mutate(files: Record<string, string>) {
        files['quality.yml'] =
          files['quality.yml']?.replace('contents: read', 'contents: write') ?? ''
      }
    },
    {
      name: 'pull request target trigger',
      code: 'M0_WORKFLOW_TRIGGER_NOT_ALLOWED',
      mutate(files: Record<string, string>) {
        files['quality.yml'] =
          files['quality.yml']?.replace('pull_request:', 'pull_request_target:') ?? ''
      }
    },
    {
      name: 'missing frozen install',
      code: 'M0_WORKFLOW_FROZEN_INSTALL_REQUIRED',
      mutate(files: Record<string, string>) {
        files['quality.yml'] =
          files['quality.yml']?.replace('pnpm install --frozen-lockfile', 'pnpm install') ?? ''
      }
    },
    {
      name: 'quality command drift',
      code: 'M0_WORKFLOW_COMMAND_PARITY',
      mutate(files: Record<string, string>) {
        files['quality.yml'] = files['quality.yml']?.replace('pnpm check', 'pnpm --version') ?? ''
      }
    },
    {
      name: 'artifact path escape',
      code: 'M0_WORKFLOW_ARTIFACT_PATH_NOT_ALLOWED',
      mutate(files: Record<string, string>) {
        files['quality.yml'] =
          files['quality.yml']?.replace('path: artifacts/m0', 'path: dist') ?? ''
      }
    },
    {
      name: 'unbounded shell loop',
      code: 'M0_WORKFLOW_UNBOUNDED_LOOP',
      mutate(files: Record<string, string>) {
        files['quality.yml'] =
          files['quality.yml']?.replace('pnpm check', 'while ($true) { pnpm check }') ?? ''
      }
    },
    {
      name: 'missing reviewed permissive license',
      code: 'M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID',
      mutate(files: Record<string, string>) {
        files['dependency-review.yml'] =
          files['dependency-review.yml']?.replace(', WTFPL', '') ?? ''
      }
    },
    {
      name: 'unreviewed dependency license',
      code: 'M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID',
      mutate(files: Record<string, string>) {
        files['dependency-review.yml'] =
          files['dependency-review.yml']?.replace(
            dependencyReviewLicenses,
            `${dependencyReviewLicenses}, GPL-3.0-only`
          ) ?? ''
      }
    },
    {
      name: 'dependency-level license bypass',
      code: 'M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID',
      mutate(files: Record<string, string>) {
        files['dependency-review.yml'] =
          files['dependency-review.yml']?.replace(
            `          allow-licenses: ${dependencyReviewLicenses}`,
            `          allow-licenses: ${dependencyReviewLicenses}\n          allow-dependencies-licenses: pkg:npm/truncate-utf8-bytes@1.0.2`
          ) ?? ''
      }
    },
    {
      name: 'warn-only dependency review',
      code: 'M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID',
      mutate(files: Record<string, string>) {
        files['dependency-review.yml'] =
          files['dependency-review.yml']?.replace(
            '          fail-on-severity: moderate',
            '          fail-on-severity: moderate\n          warn-only: true'
          ) ?? ''
      }
    }
  ])('rejects $name', async (fixture) => {
    const root = await createWorkflowFixture((files) => fixture.mutate(files))
    await expect(verifyWorkflows({ rootDirectory: root })).rejects.toThrow(fixture.code)
  })
})

const auditStepFiles = [
  ['planning', 'scripts/verify-planning-docs.mjs'],
  ['dependency-audit', 'scripts/audit/run-dependency-audit.mjs'],
  ['sbom', 'scripts/audit/generate-sbom.mjs'],
  ['workflows', 'scripts/verify-workflows.mjs'],
  ['brand-assets', 'scripts/assets/build-lattice-icon.mjs'],
  ['artifact-hashes', 'scripts/audit/hash-artifacts.mjs']
] as const

async function createAuditFixture(): Promise<{ readonly root: string; readonly logPath: string }> {
  const root = await temporaryRoot('audit')
  const logPath = join(root, 'gate.log')
  await mkdir(join(root, 'artifacts', 'm0'), { recursive: true })
  const script = `import { appendFile } from 'node:fs/promises'
const step = process.env.M0_GATE_STEP
await appendFile(process.env.M0_GATE_LOG, step + '\\n')
if (process.env.M0_GATE_HANG === step) {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 60_000))
}
if (process.env.M0_GATE_FAIL === step) {
  process.stderr.write(process.env.M0_GATE_ERROR + '\\n')
  process.exitCode = 1
}
`
  await Promise.all(
    auditStepFiles.map(async ([, relativePath]) => {
      const path = join(root, relativePath)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, script, 'utf8')
    })
  )
  return { root, logPath }
}

describe('TC-M0-007 finite local audit composition', () => {
  it('runs every real child boundary in order and writes a deterministic gate report', async () => {
    const fixture = await createAuditFixture()

    const result = await runM0Audit({
      rootDirectory: fixture.root,
      environment: { ...process.env, M0_GATE_LOG: fixture.logPath },
      timeoutMs: 5_000
    })

    expect((await readFile(fixture.logPath, 'utf8')).trim().split('\n')).toEqual(
      auditStepFiles.map(([step]) => step)
    )
    expect(result).toEqual({
      schemaVersion: 1,
      steps: auditStepFiles.map(([name]) => ({ name, status: 'passed' }))
    })
    expect(
      JSON.parse(await readFile(join(fixture.root, 'artifacts/m0/m0-gate.json'), 'utf8'))
    ).toEqual(result)
  })

  it.each([
    ['dependency-audit', 'M0_AUDIT_LICENSE_NOT_ALLOWED'],
    ['sbom', 'M0_SBOM_LICENSE_COVERAGE'],
    ['dependency-audit', 'M0_AUDIT_VULNERABILITY_THRESHOLD'],
    ['sbom', 'M0_AUDIT_ABSOLUTE_PATH'],
    ['artifact-hashes', 'M0_ARTIFACT_MISSING'],
    ['planning', 'M0_GATE_CHILD_FAILED']
  ] as const)('fails closed when %s reports %s', async (step, code) => {
    const fixture = await createAuditFixture()

    await expect(
      runM0Audit({
        rootDirectory: fixture.root,
        environment: {
          ...process.env,
          M0_GATE_LOG: fixture.logPath,
          M0_GATE_FAIL: step,
          M0_GATE_ERROR: code
        },
        timeoutMs: 5_000
      })
    ).rejects.toThrow(code)
  })

  it('terminates and identifies a timed-out child step', async () => {
    const fixture = await createAuditFixture()

    await expect(
      runM0Audit({
        rootDirectory: fixture.root,
        environment: {
          ...process.env,
          M0_GATE_LOG: fixture.logPath,
          M0_GATE_HANG: 'planning'
        },
        timeoutMs: 100
      })
    ).rejects.toThrow('M0_GATE_STEP_TIMEOUT:planning')
  })
})
