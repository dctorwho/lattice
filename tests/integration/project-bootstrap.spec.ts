import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyBootstrap } from '../helpers/bootstrap-project'
import { pnpmCommand, runCommand } from '../helpers/command'

describe('TC-M0-001 offline bootstrap regression', () => {
  let tempParent: string
  let storeDirectory: string

  beforeAll(async () => {
    tempParent = await mkdtemp(join(tmpdir(), 'Lattice 离线门禁 '))
    const invocation = pnpmCommand(['store', 'path', '--silent'])
    const result = await runCommand(invocation.command, invocation.args, {
      cwd: process.cwd(),
      timeoutMs: 30_000
    })
    if (result.exitCode !== 0) {
      throw new Error(result.stderr)
    }
    storeDirectory = result.stdout.trim()
  })

  afterAll(async () => rm(tempParent, { recursive: true, force: true }))

  it('installs offline and builds identically twice in a Chinese-and-space path', async () => {
    const evidence = await verifyBootstrap({
      sourceRoot: process.cwd(),
      tempParent,
      mode: 'offline',
      storeDirectory
    })
    expect(evidence.firstBuildHashes).toEqual(evidence.secondBuildHashes)
    expect(evidence.pendingBuilds).toEqual([])
  })
})
