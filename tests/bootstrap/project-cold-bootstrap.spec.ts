import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyBootstrap } from '../helpers/bootstrap-project'

describe('TC-M0-008 cold bootstrap', () => {
  let tempParent: string
  let storeDirectory: string

  beforeAll(async () => {
    tempParent = await mkdtemp(join(tmpdir(), 'Lattice 冷自举 '))
    storeDirectory = join(tempParent, '.pnpm-store')
  })

  afterAll(async () => rm(tempParent, { recursive: true, force: true }))

  it('uses an initially empty project store and builds identically twice', async () => {
    await expect(access(storeDirectory)).rejects.toThrow()
    const evidence = await verifyBootstrap({
      sourceRoot: process.cwd(),
      tempParent,
      mode: 'cold',
      storeDirectory
    })

    await expect(access(storeDirectory)).resolves.toBeUndefined()
    expect(evidence.firstBuildHashes).toEqual(evidence.secondBuildHashes)
    expect(evidence.pendingBuilds).toEqual([])
  })
})
