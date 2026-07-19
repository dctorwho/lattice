import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const requiredArtifacts = [
  'out/main/index.js',
  'out/preload/index.cjs',
  'out/renderer/index.html'
] as const

const unsupportedLockfiles = ['npm-shrinkwrap.json', 'package-lock.json', 'yarn.lock'] as const

export async function assertSingleLockfile(root: string): Promise<void> {
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
