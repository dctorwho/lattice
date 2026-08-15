import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { pnpmCommand, runCommand, type CommandResult } from '../helpers/command'
import {
  copyProject,
  listOwnedTestSources,
  listProjectFiles,
  removeWithRetry
} from '../helpers/project-copy'

const commandTimeoutMs = 180_000
const contractTestTimeoutMs = 120_000
const positiveCommandTestTimeoutMs = 1_020_000
const faultCommandTestTimeoutMs = 300_000
const timeoutCleanupRegressionTimeoutMs = 5_000
const outputTailLength = 2_000

const childEnvironment = {
  ...process.env,
  LATTICE_QUALITY_META_CHILD: '1'
}

const executableScripts = [
  'format:check',
  'lint',
  'typecheck',
  'test',
  'test:integration',
  'test:e2e',
  'test:security',
  'test:performance',
  'build',
  'check'
] as const

const contractedScripts = ['format', ...executableScripts, 'test:bootstrap:cold'] as const

type ContractedScript = (typeof contractedScripts)[number]

const contractedScriptCommands: Readonly<Record<ContractedScript, string>> = {
  format: 'prettier --write .',
  'format:check': 'prettier --check .',
  lint: 'eslint . --max-warnings=0',
  typecheck:
    'tsc -p tsconfig.node.json --noEmit --composite false --incremental false && tsc -p tsconfig.web.json --noEmit --composite false --incremental false && tsc -p tsconfig.test.json --noEmit --incremental false',
  test: 'vitest run --config vitest.config.ts --coverage',
  'test:integration': 'vitest run --config vitest.integration.config.ts',
  'test:e2e': 'pnpm build && playwright test --config playwright.config.ts',
  'test:security': 'pnpm build && playwright test --config playwright.security.config.ts',
  'test:performance': 'vitest run --config vitest.performance.config.ts',
  build: 'electron-vite build',
  check:
    'pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build',
  'test:bootstrap:cold': 'vitest run --config vitest.bootstrap.config.ts'
}

const noOpScriptPatterns = [
  /\bexit\s+0\b/i,
  /process\.exit\(\s*0\s*\)/i,
  /\becho\s+success\b/i,
  /^\s*(?:true|:|echo|rem(?:\s+.*)?)\s*$/i
]

type PackageScripts = Readonly<Record<string, string>>

interface Fault {
  readonly name: string
  readonly directScript: (typeof executableScripts)[number]
  inject(root: string): Promise<void>
}

const faults: readonly Fault[] = [
  {
    name: 'format',
    directScript: 'format:check',
    inject: (root) => writeFile(join(root, 'injected-format.json'), '{"bad":true}')
  },
  {
    name: 'lint',
    directScript: 'lint',
    inject: (root) => writeFile(join(root, 'tests/injected-lint.ts'), 'debugger\n')
  },
  {
    name: 'type',
    directScript: 'typecheck',
    inject: (root) =>
      writeFile(join(root, 'tests/injected-type.ts'), 'export const value: string = 1\n')
  },
  {
    name: 'unit',
    directScript: 'test',
    inject: (root) =>
      writeFile(
        join(root, 'tests/unit/injected-failure.spec.ts'),
        "import { expect, it } from 'vitest'\nit('fails', () => expect(true).toBe(false))\n"
      )
  },
  {
    name: 'integration',
    directScript: 'test:integration',
    inject: (root) =>
      writeFile(
        join(root, 'tests/integration/injected-failure.spec.ts'),
        "import { expect, it } from 'vitest'\nit('fails', () => expect(true).toBe(false))\n"
      )
  },
  {
    name: 'build',
    directScript: 'build',
    inject: async (root) => {
      await removeWithRetry(join(root, 'src/main/index.ts'))
    }
  }
]

function outputTail(output: string): string {
  return output.slice(-outputTailLength).trim()
}

function commandDetail(script: string, result: CommandResult): string {
  const stdout = outputTail(result.stdout)
  const stderr = outputTail(result.stderr)
  return [
    `pnpm ${script}`,
    `exit code: ${result.exitCode ?? 'none'}`,
    `timed out: ${result.timedOut}`,
    ...(stdout.length > 0 ? [`stdout tail:\n${stdout}`] : []),
    ...(stderr.length > 0 ? [`stderr tail:\n${stderr}`] : [])
  ].join('\n')
}

function assertCommandSucceeded(script: string, result: CommandResult): void {
  const detail = commandDetail(script, result)
  expect(result.timedOut, detail).toBe(false)
  expect(result.exitCode, detail).toBe(0)
}

function assertCommandFailed(script: string, result: CommandResult): void {
  const detail = commandDetail(script, result)
  expect(result.timedOut, detail).toBe(false)
  expect(result.exitCode, detail).not.toBeNull()
  expect(result.exitCode, detail).not.toBe(0)
}

function childEnvironmentWithStore(storeDirectory: string): NodeJS.ProcessEnv {
  return {
    ...childEnvironment,
    pnpm_config_store_dir: storeDirectory
  }
}

function runPnpm(root: string, script: string, storeDirectory: string): Promise<CommandResult> {
  const invocation = pnpmCommand(['run', script])
  return runCommand(invocation.command, invocation.args, {
    cwd: root,
    env: childEnvironmentWithStore(storeDirectory),
    timeoutMs: commandTimeoutMs
  })
}

function isPackageScripts(value: unknown): value is PackageScripts {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

function asError(failure: unknown, message: string): Error {
  return failure instanceof Error ? failure : new Error(message, { cause: failure })
}

async function pnpmStorePath(root: string): Promise<string> {
  const invocation = pnpmCommand(['store', 'path', '--silent'])
  const result = await runCommand(invocation.command, invocation.args, {
    cwd: root,
    env: childEnvironment,
    timeoutMs: commandTimeoutMs
  })
  assertCommandSucceeded('store path --silent', result)
  const storeDirectory = result.stdout.trim()
  if (storeDirectory.length === 0) {
    throw new Error('pnpm store path returned an empty directory.')
  }
  return storeDirectory
}

async function installOffline(root: string, storeDirectory: string): Promise<void> {
  const invocation = pnpmCommand([
    'install',
    '--frozen-lockfile',
    '--offline',
    '--store-dir',
    storeDirectory
  ])
  const result = await runCommand(invocation.command, invocation.args, {
    cwd: root,
    env: childEnvironmentWithStore(storeDirectory),
    timeoutMs: commandTimeoutMs
  })
  assertCommandSucceeded('install --frozen-lockfile --offline', result)
}

async function initializeTemporaryGitRepository(root: string): Promise<void> {
  const initialization = await runCommand('git', ['init', '--quiet'], {
    cwd: root,
    env: childEnvironment,
    timeoutMs: commandTimeoutMs
  })
  assertCommandSucceeded('git init --quiet', initialization)
  const staging = await runCommand('git', ['add', '--all'], {
    cwd: root,
    env: childEnvironment,
    timeoutMs: commandTimeoutMs
  })
  assertCommandSucceeded('git add --all', staging)
}

function scriptsFromPackage(packageContents: string): PackageScripts {
  const parsed: unknown = JSON.parse(packageContents)
  if (typeof parsed !== 'object' || parsed === null || !('scripts' in parsed)) {
    throw new Error('package.json must contain a scripts object.')
  }
  const scripts = parsed.scripts
  if (!isPackageScripts(scripts)) {
    throw new Error('package.json scripts must be an object containing only string values.')
  }
  return scripts
}

function assertContractedScripts(scripts: PackageScripts): void {
  for (const scriptName of contractedScripts) {
    const command = scripts[scriptName]
    expect(command, `Missing package script: ${scriptName}`).toEqual(expect.any(String))
    expect(command?.trim(), `Empty package script: ${scriptName}`).not.toBe('')
    expect(command, `Unexpected package script: ${scriptName}`).toBe(
      contractedScriptCommands[scriptName]
    )
    for (const pattern of noOpScriptPatterns) {
      expect(command, `No-op package script: ${scriptName}`).not.toMatch(pattern)
    }
  }
}

async function assertQualityContracts(sourceRoot: string): Promise<void> {
  const packageContents = await readFile(join(sourceRoot, 'package.json'), 'utf8')
  const scripts = scriptsFromPackage(packageContents)
  assertContractedScripts(scripts)

  const testSources = await listOwnedTestSources(sourceRoot)
  for (const relativePath of testSources) {
    const contents = await readFile(join(sourceRoot, relativePath), 'utf8')
    expect(contents, `Focused or skipped test source: ${relativePath}`).not.toMatch(
      /\.\s*(?:skip|only)\b/
    )
  }
}

async function withOfflineProjectCopy(
  sourceRoot: string,
  relativePaths: readonly string[],
  storeDirectory: string,
  label: string,
  operation: (root: string) => Promise<void>
): Promise<void> {
  const temporaryParent = await mkdtemp(join(tmpdir(), `lattice-quality-${label}-`))
  const projectRoot = join(temporaryParent, 'project')
  let primaryFailure: unknown
  let cleanupFailure: unknown

  try {
    await copyProject(sourceRoot, projectRoot, relativePaths)
    await initializeTemporaryGitRepository(projectRoot)
    await installOffline(projectRoot, storeDirectory)
    await operation(projectRoot)
  } catch (error) {
    primaryFailure = error
  } finally {
    try {
      await removeWithRetry(temporaryParent)
    } catch (error) {
      cleanupFailure = error
    }
  }

  if (primaryFailure !== undefined && cleanupFailure !== undefined) {
    throw new AggregateError(
      [primaryFailure, cleanupFailure],
      `Quality script test failed and cleanup failed for ${temporaryParent}.`,
      { cause: primaryFailure }
    )
  }
  if (primaryFailure !== undefined) {
    throw asError(primaryFailure, `Quality script test failed for ${temporaryParent}.`)
  }
  if (cleanupFailure !== undefined) {
    throw new Error(`Quality script test cleanup failed for ${temporaryParent}.`, {
      cause: cleanupFailure
    })
  }
}

describe('TC-M0-002 quality script contracts', () => {
  const sourceRoot = process.cwd()
  let relativePaths: readonly string[]
  let storeDirectory: string

  beforeAll(async () => {
    relativePaths = await listProjectFiles(sourceRoot)
    storeDirectory = await pnpmStorePath(sourceRoot)
  })

  it(
    'rejects missing, no-op, focused, and skipped quality contracts',
    async () => {
      await assertQualityContracts(sourceRoot)
    },
    contractTestTimeoutMs
  )

  it.each([
    ['format', 'pnpm --version'],
    ['test:bootstrap:cold', 'node -e ""']
  ] as const)(
    'rejects a fixed-success replacement for %s',
    async (scriptName, replacement) => {
      const temporaryRoot = await mkdtemp(join(tmpdir(), 'lattice-quality-contract-'))
      try {
        const packageContents = await readFile(join(sourceRoot, 'package.json'), 'utf8')
        const scripts = { ...scriptsFromPackage(packageContents) }
        scripts[scriptName] = replacement
        await writeFile(join(temporaryRoot, 'package.json'), JSON.stringify({ scripts }))
        await mkdir(join(temporaryRoot, 'tests'))
        const gitInitialization = await runCommand('git', ['init', '--quiet'], {
          cwd: temporaryRoot,
          timeoutMs: commandTimeoutMs
        })
        assertCommandSucceeded('git init --quiet', gitInitialization)
        const gitAdd = await runCommand('git', ['add', 'package.json'], {
          cwd: temporaryRoot,
          timeoutMs: commandTimeoutMs
        })
        assertCommandSucceeded('git add package.json', gitAdd)

        await expect(assertQualityContracts(temporaryRoot)).rejects.toThrow(
          `Unexpected package script: ${scriptName}`
        )
      } finally {
        await removeWithRetry(temporaryRoot)
      }
    },
    contractTestTimeoutMs
  )

  it(
    'rejects an untracked formatted focused-each owned test source',
    async () => {
      const temporaryRoot = await mkdtemp(join(tmpdir(), 'lattice-quality-contract-'))
      try {
        await writeFile(
          join(temporaryRoot, 'package.json'),
          await readFile(join(sourceRoot, 'package.json'))
        )
        await mkdir(join(temporaryRoot, 'tests/unit'), { recursive: true })
        const focusedMember = ['only', 'each'].join('.')
        await writeFile(
          join(temporaryRoot, 'tests/unit/untracked-focused.spec.ts'),
          `import { it } from 'vitest'\n\nit.${focusedMember}([['example']])('%s', () => {})\n`
        )
        const gitInitialization = await runCommand('git', ['init', '--quiet'], {
          cwd: temporaryRoot,
          timeoutMs: commandTimeoutMs
        })
        assertCommandSucceeded('git init --quiet', gitInitialization)
        const gitAdd = await runCommand('git', ['add', 'package.json'], {
          cwd: temporaryRoot,
          timeoutMs: commandTimeoutMs
        })
        assertCommandSucceeded('git add package.json', gitAdd)

        await expect(assertQualityContracts(temporaryRoot)).rejects.toThrow(
          'untracked-focused.spec.ts'
        )
      } finally {
        await removeWithRetry(temporaryRoot)
      }
    },
    contractTestTimeoutMs
  )

  it.each([
    ['terminal only', ['only'], 'untracked-only.spec.ts'],
    ['terminal skip with whitespace', ['skip'], 'untracked-skip.spec.ts'],
    ['each chain', ['only', 'each'], 'untracked-each.spec.ts'],
    ['concurrent chain', ['skip', 'concurrent'], 'untracked-concurrent.spec.ts'],
    ['sequential chain', ['only', 'sequential'], 'untracked-sequential.spec.ts']
  ] as const)(
    'rejects an untracked %s member chain',
    async (_name, memberParts, testFile) => {
      const temporaryRoot = await mkdtemp(join(tmpdir(), 'lattice-quality-contract-'))
      try {
        await writeFile(
          join(temporaryRoot, 'package.json'),
          await readFile(join(sourceRoot, 'package.json'))
        )
        await mkdir(join(temporaryRoot, 'tests/unit'), { recursive: true })
        const member = memberParts.join(' . ')
        await writeFile(
          join(temporaryRoot, 'tests/unit', testFile),
          `import { it } from 'vitest'\n\nit . ${member}([['example']])('%s', () => {})\n`
        )
        const gitInitialization = await runCommand('git', ['init', '--quiet'], {
          cwd: temporaryRoot,
          timeoutMs: commandTimeoutMs
        })
        assertCommandSucceeded('git init --quiet', gitInitialization)
        const gitAdd = await runCommand('git', ['add', 'package.json'], {
          cwd: temporaryRoot,
          timeoutMs: commandTimeoutMs
        })
        assertCommandSucceeded('git add package.json', gitAdd)

        await expect(assertQualityContracts(temporaryRoot)).rejects.toThrow(testFile)
      } finally {
        await removeWithRetry(temporaryRoot)
      }
    },
    contractTestTimeoutMs
  )

  it(
    'runs every contracted quality command successfully in a clean offline copy',
    async () => {
      await withOfflineProjectCopy(
        sourceRoot,
        relativePaths,
        storeDirectory,
        'positive',
        async (root) => {
          for (const script of executableScripts) {
            assertCommandSucceeded(script, await runPnpm(root, script, storeDirectory))
          }
        }
      )
    },
    positiveCommandTestTimeoutMs
  )

  it.each(faults)(
    'detects the $name fault directly and through check',
    async (fault) => {
      await withOfflineProjectCopy(
        sourceRoot,
        relativePaths,
        storeDirectory,
        fault.name,
        async (root) => {
          await fault.inject(root)
          assertCommandFailed(
            fault.directScript,
            await runPnpm(root, fault.directScript, storeDirectory)
          )
          assertCommandFailed('check', await runPnpm(root, 'check', storeDirectory))
        }
      )
    },
    faultCommandTestTimeoutMs
  )

  it(
    'allows an inner command timeout and cleanup to finish before the meta-test timeout',
    async () => {
      const temporaryRoot = await mkdtemp(join(tmpdir(), 'lattice-quality-timeout-'))
      try {
        const result = await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 5_000)'], {
          cwd: temporaryRoot,
          timeoutMs: 100
        })
        expect(result.timedOut).toBe(true)
      } finally {
        await removeWithRetry(temporaryRoot)
      }
      await expect(access(temporaryRoot)).rejects.toThrow()
    },
    timeoutCleanupRegressionTimeoutMs
  )
})
