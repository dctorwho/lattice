import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const requiredArtifacts = [
  'out/main/index.js',
  'out/preload/index.cjs',
  'out/renderer/index.html'
] as const

const unsupportedLockfiles = ['npm-shrinkwrap.json', 'package-lock.json', 'yarn.lock'] as const
const requiredPackageManager = 'pnpm@11.12.0'
const lockfileNames = new Set(['pnpm-lock.yaml', ...unsupportedLockfiles])

function lockfilesInManifest(relativePaths: readonly string[]): readonly string[] {
  return relativePaths.filter((relativePath) => {
    const normalized = relativePath.replaceAll('\\', '/')
    const name = normalized.slice(normalized.lastIndexOf('/') + 1)
    return lockfileNames.has(name)
  })
}

export async function assertSingleLockfile(
  root: string,
  manifest?: readonly string[]
): Promise<void> {
  if (manifest !== undefined) {
    const lockfiles = lockfilesInManifest(manifest)
    if (lockfiles.length !== 1 || lockfiles[0] !== 'pnpm-lock.yaml') {
      const detail = lockfiles.length === 0 ? 'none' : lockfiles.join(', ')
      throw new Error(
        `Expected exactly one root lockfile pnpm-lock.yaml in manifest; found: ${detail}`
      )
    }
  }
  try {
    await access(join(root, 'pnpm-lock.yaml'))
  } catch {
    throw new Error('Missing required lockfile: pnpm-lock.yaml')
  }

  for (const relativePath of unsupportedLockfiles) {
    try {
      await access(join(root, relativePath))
    } catch {
      continue
    }
    throw new Error(`Unexpected lockfile: ${relativePath}`)
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export async function assertPackageManager(root: string): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read package.json packageManager: ${detail}`, { cause: error })
  }
  const packageManager =
    isObject(parsed) && 'packageManager' in parsed ? parsed.packageManager : undefined
  if (packageManager !== requiredPackageManager) {
    throw new Error(`package.json packageManager must be exactly ${requiredPackageManager}.`)
  }
}

export async function hashArtifacts(root: string): Promise<Readonly<Record<string, string>>> {
  const hashes: Record<string, string> = {}
  for (const relativePath of requiredArtifacts) {
    let artifact: Buffer
    try {
      artifact = await readFile(join(root, relativePath))
    } catch {
      throw new Error(`Missing required artifact: ${relativePath}`)
    }
    hashes[relativePath] = createHash('sha256').update(artifact).digest('hex')
  }
  return Object.freeze(hashes)
}
