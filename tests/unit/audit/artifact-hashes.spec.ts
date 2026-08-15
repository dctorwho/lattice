import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createArtifactManifest } from '../../../scripts/audit/hash-artifacts.mjs'

describe('M0 artifact hash manifest', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-artifacts-'))
    await mkdir(join(root, 'dist', 'win-unpacked', 'resources'), { recursive: true })
    await writeFile(join(root, 'dist', 'win-unpacked', 'Lattice.exe'), 'hello', 'utf8')
    await writeFile(join(root, 'dist', 'win-unpacked', 'resources', 'app.asar'), '', 'utf8')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('hashes required regular files using sorted repository-relative paths', async () => {
    const manifest = await createArtifactManifest({
      rootDirectory: root,
      relativePaths: ['dist/win-unpacked/resources/app.asar', 'dist/win-unpacked/Lattice.exe']
    })

    expect(manifest).toEqual({
      schemaVersion: 1,
      artifacts: [
        {
          path: 'dist/win-unpacked/Lattice.exe',
          size: 5,
          sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
        },
        {
          path: 'dist/win-unpacked/resources/app.asar',
          size: 0,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        }
      ]
    })
  })

  it('rejects absolute, traversal, duplicate, missing, directory, and symlink-like inputs', async () => {
    await expect(
      createArtifactManifest({ rootDirectory: root, relativePaths: ['D:/secret.txt'] })
    ).rejects.toThrow('M0_ARTIFACT_PATH_INVALID')
    await expect(
      createArtifactManifest({ rootDirectory: root, relativePaths: ['../secret.txt'] })
    ).rejects.toThrow('M0_ARTIFACT_PATH_INVALID')
    await expect(
      createArtifactManifest({
        rootDirectory: root,
        relativePaths: ['dist/win-unpacked/Lattice.exe', 'dist/win-unpacked/Lattice.exe']
      })
    ).rejects.toThrow('M0_ARTIFACT_PATH_DUPLICATE')
    await expect(
      createArtifactManifest({ rootDirectory: root, relativePaths: ['dist/missing.exe'] })
    ).rejects.toThrow('M0_ARTIFACT_FILE_INVALID')
    await expect(
      createArtifactManifest({ rootDirectory: root, relativePaths: ['dist/win-unpacked'] })
    ).rejects.toThrow('M0_ARTIFACT_FILE_INVALID')

    const inspectPath = () =>
      Promise.resolve({ isFile: () => true, isSymbolicLink: () => true, size: 5 })
    await expect(
      createArtifactManifest({
        rootDirectory: root,
        relativePaths: ['dist/win-unpacked/Lattice.exe'],
        inspectPath
      })
    ).rejects.toThrow('M0_ARTIFACT_FILE_INVALID')
  })
})
