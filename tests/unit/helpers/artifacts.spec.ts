import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertSingleLockfile, hashArtifacts, requiredArtifacts } from '../../helpers/artifacts'

describe('bootstrap artifacts', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-artifacts-'))
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  it.each(['npm-shrinkwrap.json', 'package-lock.json', 'yarn.lock'])(
    'rejects %s beside pnpm-lock.yaml',
    async (name) => {
      await writeFile(join(root, name), '')
      await expect(assertSingleLockfile(root)).rejects.toThrow(name)
    }
  )

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
