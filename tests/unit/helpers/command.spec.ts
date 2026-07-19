import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pnpmCommand, runCommand } from '../../helpers/command'

describe('runCommand', () => {
  it('captures stdout and a zero exit', async () => {
    const result = await runCommand(process.execPath, ['-e', "process.stdout.write('ok')"], {
      cwd: process.cwd(),
      timeoutMs: 5_000
    })
    expect(result).toEqual({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false })
  })

  it('preserves a non-zero exit', async () => {
    const result = await runCommand(process.execPath, ['-e', 'process.exit(7)'], {
      cwd: process.cwd(),
      timeoutMs: 5_000
    })
    expect(result.exitCode).toBe(7)
    expect(result.timedOut).toBe(false)
  })

  it('terminates a timed-out command', async () => {
    const result = await runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], {
      cwd: process.cwd(),
      timeoutMs: 100
    })
    expect(result.timedOut).toBe(true)
  })

  it('kills and unreferences a hung timeout terminator before rejecting', async () => {
    const startedAt = Date.now()
    let terminatorKilled = false
    let terminatorUnreferenced = false

    await expect(
      runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], {
        cwd: process.cwd(),
        timeoutMs: 20,
        createTimeoutTerminationAttempt: () => ({
          completion: new Promise<void>(() => {}),
          kill: () => {
            terminatorKilled = true
          },
          unref: () => {
            terminatorUnreferenced = true
          }
        })
      })
    ).rejects.toThrow('Timed-out command cleanup did not finish')

    expect(Date.now() - startedAt).toBeLessThan(2_000)
    expect(terminatorKilled).toBe(true)
    expect(terminatorUnreferenced).toBe(true)
  })

  it('rejects when timeout cleanup reports a failure', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], {
        cwd: process.cwd(),
        timeoutMs: 20,
        createTimeoutTerminationAttempt: () => ({
          completion: Promise.reject(new Error('terminator exited with 7')),
          kill: () => {},
          unref: () => {}
        })
      })
    ).rejects.toThrow('Timed-out command cleanup failed: terminator exited with 7')
  })

  if (process.platform === 'win32') {
    it('terminates descendants of a timed-out command', async () => {
      const root = await mkdtemp(join(tmpdir(), 'lattice-command-'))
      const childPidPath = join(root, 'child.pid')
      const script = [
        "const { spawn } = require('node:child_process')",
        "const { writeFileSync } = require('node:fs')",
        "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { detached: true, stdio: 'ignore' })",
        'child.unref()',
        `writeFileSync(${JSON.stringify(childPidPath)}, String(child.pid))`,
        'setInterval(() => {}, 1_000)'
      ].join('; ')

      let childPid: number | undefined
      try {
        const result = await runCommand(process.execPath, ['-e', script], {
          cwd: process.cwd(),
          timeoutMs: 500
        })
        const spawnedChildPid = Number(await readFile(childPidPath, 'utf8'))
        childPid = spawnedChildPid

        expect(result.timedOut).toBe(true)
        expect(() => process.kill(spawnedChildPid, 0)).toThrow()
      } finally {
        if (childPid !== undefined) {
          try {
            process.kill(childPid)
          } catch {
            // The timeout already terminated the process.
          }
        }
        await rm(root, { recursive: true, force: true })
      }
    })
  }
})

describe('pnpmCommand', () => {
  it('runs the pnpm CLI through the current Node executable', () => {
    expect(pnpmCommand(['test'])).toEqual({
      command: process.execPath,
      args: [process.env.npm_execpath, 'test']
    })
  })

  it('rejects an unavailable pnpm CLI path', () => {
    const original = process.env.npm_execpath
    delete process.env.npm_execpath

    try {
      expect(() => pnpmCommand(['test'])).toThrow('npm_execpath')
    } finally {
      if (original === undefined) {
        delete process.env.npm_execpath
      } else {
        process.env.npm_execpath = original
      }
    }
  })
})
