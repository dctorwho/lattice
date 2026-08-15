import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stableJson } from './audit-core.mjs'

function fail(code) {
  throw new Error(code)
}

function normalizeRelativePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    value.includes('\u0000') ||
    isAbsolute(value) ||
    /^[a-z]:\//i.test(value) ||
    value.startsWith('//')
  ) {
    fail('M0_ARTIFACT_PATH_INVALID')
  }
  const segments = value.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    fail('M0_ARTIFACT_PATH_INVALID')
  }
  return segments.join('/')
}

function resolveContained(rootDirectory, relativePath) {
  const root = resolve(rootDirectory)
  const target = resolve(root, ...relativePath.split('/'))
  const fromRoot = relative(root, target)
  if (
    fromRoot.length === 0 ||
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    fail('M0_ARTIFACT_PATH_INVALID')
  }
  return { root, target }
}

export async function createArtifactManifest(options) {
  if (!Array.isArray(options.relativePaths) || options.relativePaths.length === 0) {
    fail('M0_ARTIFACT_PATH_INVALID')
  }
  const inspectPath = options.inspectPath ?? lstat
  const normalizedPaths = options.relativePaths.map(normalizeRelativePath)
  if (new Set(normalizedPaths).size !== normalizedPaths.length) {
    fail('M0_ARTIFACT_PATH_DUPLICATE')
  }

  const artifacts = []
  for (const path of normalizedPaths.sort()) {
    const { root, target } = resolveContained(options.rootDirectory, path)
    let metadata
    try {
      metadata = await inspectPath(target)
    } catch {
      fail('M0_ARTIFACT_FILE_INVALID')
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      fail('M0_ARTIFACT_FILE_INVALID')
    }
    if (options.inspectPath === undefined) {
      let resolvedRoot
      let resolvedTarget
      try {
        ;[resolvedRoot, resolvedTarget] = await Promise.all([realpath(root), realpath(target)])
      } catch {
        fail('M0_ARTIFACT_FILE_INVALID')
      }
      const canonicalRelative = relative(resolvedRoot, resolvedTarget)
      if (
        canonicalRelative === '..' ||
        canonicalRelative.startsWith(`..${sep}`) ||
        isAbsolute(canonicalRelative) ||
        resolve(resolvedTarget) !== target
      ) {
        fail('M0_ARTIFACT_FILE_INVALID')
      }
    }
    let bytes
    try {
      bytes = await readFile(target)
    } catch {
      fail('M0_ARTIFACT_FILE_INVALID')
    }
    if (bytes.byteLength !== metadata.size) {
      fail('M0_ARTIFACT_FILE_CHANGED')
    }
    artifacts.push({
      path,
      size: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex')
    })
  }
  return { schemaVersion: 1, artifacts }
}

export async function writeArtifactManifest(options) {
  const manifest = await createArtifactManifest(options)
  const outputPath = resolve(options.outputPath)
  const temporary = `${outputPath}.tmp-${randomUUID()}`
  await mkdir(dirname(outputPath), { recursive: true })
  try {
    await writeFile(temporary, stableJson(manifest), { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, outputPath)
  } catch {
    fail('M0_ARTIFACT_MANIFEST_WRITE_FAILED')
  } finally {
    await rm(temporary, { force: true })
  }
  return manifest
}

async function main() {
  await writeArtifactManifest({
    rootDirectory: process.cwd(),
    relativePaths: [
      'build/brand/lattice-icon-256.png',
      'build/brand/lattice.ico',
      'dist/Lattice-0.0.0-windows-x64.exe',
      'dist/win-unpacked/Lattice.exe',
      'dist/win-unpacked/resources/app.asar'
    ],
    outputPath: join('artifacts', 'm0', 'artifact-hashes.json')
  })
  process.stdout.write('M0 package artifact hashes generated and validated.\n')
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'M0_ARTIFACT_UNKNOWN_FAILURE'}\n`
    )
    process.exitCode = 1
  })
}
