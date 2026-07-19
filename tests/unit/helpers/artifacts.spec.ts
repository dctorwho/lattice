import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertPackageManager,
  assertSingleLockfile,
  hashArtifacts,
  requiredArtifacts
} from '../../helpers/artifacts'

describe('bootstrap artifacts', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-artifacts-'))
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    await writeFile(join(root, 'package.json'), '{"packageManager":"pnpm@11.12.0"}\n')
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it.each(['npm-shrinkwrap.json', 'package-lock.json', 'yarn.lock'])(
    'rejects %s beside pnpm-lock.yaml',
    async (name) => {
      await writeFile(join(root, name), '')
      await expect(assertSingleLockfile(root)).rejects.toThrow(name)
    }
  )

  it.each([
    ['pnpm-lock.yaml', 'packages/example/pnpm-lock.yaml'],
    ['pnpm-lock.yaml', 'packages/example/package-lock.json'],
    ['pnpm-lock.yaml', 'packages/example/yarn.lock'],
    ['pnpm-lock.yaml', 'packages/example/npm-shrinkwrap.json']
  ])(
    'rejects a tracked nested or alternate lockfile: %s and %s',
    async (_rootLockfile, nestedLockfile) => {
      await expect(
        assertSingleLockfile(root, ['package.json', 'pnpm-lock.yaml', nestedLockfile])
      ).rejects.toThrow(nestedLockfile)
    }
  )

  it('rejects a manifest without the root pnpm lockfile', async () => {
    await expect(assertSingleLockfile(root, ['package.json'])).rejects.toThrow('root lockfile')
  })

  it.each([
    ['missing', '{}\n'],
    ['wrong', '{"packageManager":"pnpm@10.0.0"}\n']
  ])('rejects a %s package manager declaration', async (_name, contents) => {
    await writeFile(join(root, 'package.json'), contents)
    await expect(assertPackageManager(root)).rejects.toThrow('pnpm@11.12.0')
  })

  it('hashes every required artifact deterministically', async () => {
    for (const relativePath of requiredArtifacts) {
      const target = join(root, relativePath)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, relativePath)
    }
    const first = await hashArtifacts(root)
    const second = await hashArtifacts(root)
    expect(first).toEqual(second)
    expect(Object.keys(first)).toEqual([...requiredArtifacts])
  })

  it('changes only the rewritten artifact hash', async () => {
    for (const relativePath of requiredArtifacts) {
      const target = join(root, relativePath)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, relativePath)
    }
    const before = await hashArtifacts(root)
    await writeFile(join(root, 'out/main/index.js'), 'changed')
    const after = await hashArtifacts(root)

    expect(after['out/main/index.js']).not.toBe(before['out/main/index.js'])
    expect(after['out/preload/index.cjs']).toBe(before['out/preload/index.cjs'])
    expect(after['out/renderer/index.html']).toBe(before['out/renderer/index.html'])
  })

  it('names a missing artifact without exposing the temporary root', async () => {
    await expect(hashArtifacts(root)).rejects.toThrow('out/main/index.js')
  })
})
