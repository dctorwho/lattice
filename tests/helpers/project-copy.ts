import { copyFile, mkdir, realpath, rm } from 'node:fs/promises'
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
    segments.some((segment) => segment === '..')
  ) {
    throw new Error(`Unsafe relative path: ${relativePath}`)
  }
}

function isTargetInsideSource(source: string, target: string): boolean {
  const targetRelativeToSource = relative(source, target)
  return (
    targetRelativeToSource.length === 0 ||
    (!targetRelativeToSource.startsWith(`..${sep}`) &&
      targetRelativeToSource !== '..' &&
      !isAbsolute(targetRelativeToSource))
  )
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds)
  })
}

export async function listProjectFiles(source: string): Promise<readonly string[]> {
  const result = await runCommand(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: source,
      timeoutMs: 5_000
    }
  )
  if (result.exitCode !== 0) {
    throw new Error(
      `Unable to list project files: git exited with ${result.exitCode ?? 'no exit code'}.`
    )
  }

  return result.stdout
    .split('\0')
    .filter((relativePath) => relativePath.length > 0)
    .filter((relativePath) => {
      assertSafeRelativePath(relativePath)
      const topLevelName = relativePath.split(/[\\/]/)[0]
      return topLevelName === undefined || !excludedTopLevelNames.has(topLevelName)
    })
}

export async function copyProject(
  source: string,
  target: string,
  relativePaths: readonly string[]
): Promise<void> {
  const resolvedSource = resolve(source)
  const resolvedTarget = resolve(target)
  if (isTargetInsideSource(resolvedSource, resolvedTarget)) {
    throw new Error(`Copy target is inside the source tree: ${target}`)
  }
  const realSource = await realpath(resolvedSource)

  for (const relativePath of relativePaths) {
    assertSafeRelativePath(relativePath)
    const sourcePath = resolve(resolvedSource, relativePath)
    const realSourcePath = await realpath(sourcePath)
    if (!isTargetInsideSource(realSource, realSourcePath) || realSourcePath === realSource) {
      throw new Error(`Copy source path is outside the source tree: ${relativePath}`)
    }
    const targetPath = resolve(resolvedTarget, relativePath)
    await mkdir(dirname(targetPath), { recursive: true })
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
