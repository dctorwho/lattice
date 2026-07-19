import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { assertPackageManager, assertSingleLockfile, hashArtifacts } from './artifacts'
import { pnpmCommand, runCommand, type CommandResult } from './command'
import { copyProject, listProjectFiles, removeWithRetry } from './project-copy'

export type BootstrapMode = 'offline' | 'cold'

export interface BootstrapOptions {
  readonly sourceRoot: string
  readonly tempParent: string
  readonly mode: BootstrapMode
  readonly storeDirectory: string
  readonly relativePaths?: readonly string[]
  readonly run?: typeof runCommand
  readonly remove?: typeof removeWithRetry
}

export interface BootstrapEvidence {
  readonly mode: BootstrapMode
  readonly firstBuildHashes: Readonly<Record<string, string>>
  readonly secondBuildHashes: Readonly<Record<string, string>>
  readonly pendingBuilds: readonly string[]
}

const commandTimeoutMs = 90_000
const ignoredBuildsHeading = 'Automatically ignored builds during installation:'

function commandFailure(stage: string, result: CommandResult): Error {
  if (result.timedOut) {
    return new Error(`${stage} timed out.`)
  }

  const exitCode = result.exitCode ?? 'no exit code'
  const detail = result.stderr.trim() || result.stdout.trim()
  return new Error(
    `${stage} failed with exit code ${exitCode}${detail.length > 0 ? `: ${detail}` : ''}`
  )
}

function assertCommandSucceeded(stage: string, result: CommandResult): void {
  if (result.exitCode !== 0 || result.timedOut) {
    throw commandFailure(stage, result)
  }
}

function failureDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cleanupError(error: unknown): Error {
  return new Error(`Bootstrap cleanup failed: ${failureDetail(error)}`, { cause: error })
}

function failureError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(`Bootstrap failed: ${failureDetail(error)}`, { cause: error })
}

function parseIgnoredBuilds(output: string): readonly string[] {
  const lines = output
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines[0] !== ignoredBuildsHeading) {
    throw new Error('Unable to parse pnpm ignored-builds output.')
  }

  const packages = lines.slice(1)
  if (packages.length === 1 && packages[0] === 'None') {
    return []
  }
  if (packages.length === 0 || packages.some((packageName) => packageName === 'None')) {
    throw new Error('Unable to parse pnpm ignored-builds output.')
  }
  return packages
}

async function runPnpm(
  run: typeof runCommand,
  cwd: string,
  args: readonly string[],
  stage: string
): Promise<CommandResult> {
  const invocation = pnpmCommand(args)
  const result = await run(invocation.command, invocation.args, {
    cwd,
    timeoutMs: commandTimeoutMs
  })
  assertCommandSucceeded(stage, result)
  return result
}

export async function verifyBootstrap(options: BootstrapOptions): Promise<BootstrapEvidence> {
  const projectRoot = join(options.tempParent, `Lattice 质量门禁 ${randomUUID()}`)
  const run = options.run ?? runCommand
  const remove = options.remove ?? removeWithRetry
  let primaryFailure: unknown
  let cleanupFailure: unknown
  let evidence: BootstrapEvidence | undefined

  try {
    const relativePaths = options.relativePaths ?? (await listProjectFiles(options.sourceRoot))
    await copyProject(options.sourceRoot, projectRoot, relativePaths)
    await assertSingleLockfile(projectRoot, relativePaths)
    await assertPackageManager(projectRoot)

    const installArguments = [
      'install',
      '--frozen-lockfile',
      '--store-dir',
      options.storeDirectory,
      ...(options.mode === 'offline' ? ['--offline'] : [])
    ]
    await runPnpm(run, projectRoot, installArguments, 'pnpm install')

    const ignoredBuilds = await runPnpm(run, projectRoot, ['ignored-builds'], 'pnpm ignored-builds')
    const pendingBuilds = parseIgnoredBuilds(ignoredBuilds.stdout)
    if (pendingBuilds.length > 0) {
      throw new Error(`pnpm ignored builds are pending: ${pendingBuilds.join(', ')}`)
    }

    await runPnpm(run, projectRoot, ['build'], 'pnpm build')
    const firstBuildHashes = await hashArtifacts(projectRoot)

    await remove(join(projectRoot, 'out'))
    await runPnpm(run, projectRoot, ['build'], 'pnpm build')
    const secondBuildHashes = await hashArtifacts(projectRoot)

    if (!isDeepStrictEqual(firstBuildHashes, secondBuildHashes)) {
      throw new Error('Bootstrap builds produced different required artifact hashes.')
    }

    evidence = { mode: options.mode, firstBuildHashes, secondBuildHashes, pendingBuilds }
  } catch (error) {
    primaryFailure = error
  } finally {
    try {
      await remove(projectRoot)
    } catch (error) {
      cleanupFailure = error
    }
  }

  if (primaryFailure !== undefined && cleanupFailure !== undefined) {
    throw new AggregateError(
      [primaryFailure, cleanupFailure],
      `Bootstrap failed: ${failureDetail(primaryFailure)}; cleanup failed: ${failureDetail(cleanupFailure)}`,
      { cause: primaryFailure }
    )
  }
  if (primaryFailure !== undefined) {
    throw failureError(primaryFailure)
  }
  if (cleanupFailure !== undefined) {
    throw cleanupError(cleanupFailure)
  }
  if (evidence === undefined) {
    throw new Error('Bootstrap completed without evidence.')
  }
  return evidence
}
