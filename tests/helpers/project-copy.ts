import { copyFile, lstat, mkdir, realpath, rm } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path'
import { runCommand } from './command'

export const excludedTopLevelNames = new Set([
  '.git',
  '.superpowers',
  'node_modules',
  'out',
  'coverage',
  'playwright-report',
  'test-results',
  '.pnpm-store'
])

function assertSafeRelativePath(relativePath: string): void {
  const segments = relativePath.split(/[\\/]/)
  if (
    relativePath.length === 0 ||
    isAbsolute(relativePath) ||
    win32.parse(relativePath).root.length > 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe relative path: ${relativePath}`)
  }
}

function isPathInside(parent: string, candidate: string): boolean {
  const targetRelativeToSource = relative(parent, candidate)
  return (
    targetRelativeToSource.length === 0 ||
    (!targetRelativeToSource.startsWith(`..${sep}`) &&
      targetRelativeToSource !== '..' &&
      !isAbsolute(targetRelativeToSource))
  )
}

function assertIncludedProjectPath(relativePath: string): void {
  assertSafeRelativePath(relativePath)
  const topLevelName = relativePath.split(/[\\/]/)[0]
  if (topLevelName !== undefined && excludedTopLevelNames.has(topLevelName)) {
    throw new Error(`Excluded project path: ${relativePath}`)
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  )
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds)
  })
}

export async function listProjectFiles(source: string): Promise<readonly string[]> {
  const result = await runCommand('git', ['ls-files', '--cached', '-z'], {
    cwd: source,
    timeoutMs: 5_000
  })
  if (result.exitCode !== 0) {
    throw new Error(
      `Unable to list project files: git exited with ${result.exitCode ?? 'no exit code'}.`
    )
  }

  return result.stdout
    .split('\0')
    .filter((relativePath) => relativePath.length > 0)
    .filter((relativePath) => {
      try {
        assertIncludedProjectPath(relativePath)
        return true
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Excluded project path:')) {
          return false
        }
        throw error
      }
    })
}

export async function copyProject(
  source: string,
  target: string,
  relativePaths: readonly string[]
): Promise<void> {
  const resolvedSource = resolve(source)
  const resolvedTarget = resolve(target)
  if (isPathInside(resolvedSource, resolvedTarget)) {
    throw new Error(`Copy target is inside the source tree: ${target}`)
  }
  const realSource = await realpath(resolvedSource)
  await mkdir(resolvedTarget, { recursive: true })
  const realTarget = await realpath(resolvedTarget)

  for (const relativePath of relativePaths) {
    assertIncludedProjectPath(relativePath)
    const sourcePath = resolve(resolvedSource, relativePath)
    const realSourcePath = await realpath(sourcePath)
    if (!isPathInside(realSource, realSourcePath) || realSourcePath === realSource) {
      throw new Error(`Copy source path is outside the source tree: ${relativePath}`)
    }
    const targetPath = resolve(resolvedTarget, relativePath)
    const targetDirectory = dirname(targetPath)
    await mkdir(targetDirectory, { recursive: true })
    const realTargetDirectory = await realpath(targetDirectory)
    if (!isPathInside(realTarget, realTargetDirectory)) {
      throw new Error(`Copy target path is outside the target tree: ${relativePath}`)
    }
    try {
      const targetStatus = await lstat(targetPath)
      if (targetStatus.isSymbolicLink()) {
        throw new Error(`Copy target path is a symbolic link: ${relativePath}`)
      }
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error
      }
    }
    await copyFile(realSourcePath, targetPath)
  }
}

export async function removeWithRetry(target: string, attempts = 3): Promise<void> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('Removal attempts must be a positive integer.')
  }

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) {
        await delay(attempt === 0 ? 100 : 250)
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Unable to remove ${target}: ${detail}`, { cause: lastError })
}
