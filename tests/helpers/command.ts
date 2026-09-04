import { spawn, type ChildProcess } from 'node:child_process'

export interface CommandResult {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}

export interface RunCommandOptions {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
  readonly timeoutMs: number
  readonly createTimeoutTerminationAttempt?: TimeoutTerminationAttemptFactory
}

export interface TimeoutTerminationAttempt {
  readonly completion: Promise<void>
  kill(): void
  unref(): void
}

export type TimeoutTerminationAttemptFactory = (child: ChildProcess) => TimeoutTerminationAttempt

const timeoutCleanupMs = 1_000

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function killDirectChild(child: ChildProcess): void {
  try {
    child.kill()
  } catch {
    // Cleanup is best effort after the terminator has already failed.
  }
}

function createTimeoutTerminationAttempt(child: ChildProcess): TimeoutTerminationAttempt {
  if (process.platform !== 'win32' || child.pid === undefined) {
    killDirectChild(child)
    return {
      completion: Promise.resolve(),
      kill: () => {},
      unref: () => {}
    }
  }

  const terminator = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
    shell: false,
    windowsHide: true
  })
  return {
    completion: new Promise((resolve, reject) => {
      terminator.once('error', (error: Error) => {
        reject(new Error(`taskkill could not start: ${error.message}`))
      })
      terminator.once('close', (exitCode) => {
        if (exitCode !== 0) {
          if (child.exitCode !== null || child.pid === undefined) {
            resolve()
            return
          }
          try {
            process.kill(child.pid, 0)
          } catch (error) {
            if (
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              error.code === 'ESRCH'
            ) {
              resolve()
              return
            }
          }
          reject(new Error(`taskkill exited with ${exitCode ?? 'no exit code'}.`))
          return
        }
        resolve()
      })
    }),
    kill: () => {
      terminator.kill()
    },
    unref: () => {
      terminator.unref()
    }
  }
}

function stopTerminationAttempt(attempt: TimeoutTerminationAttempt): void {
  try {
    attempt.kill()
  } catch {
    // The attempt has already stopped or cannot be signaled.
  }
  attempt.unref()
}

function boundTimeoutCleanup(
  attempt: TimeoutTerminationAttempt,
  child: ChildProcess
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      stopTerminationAttempt(attempt)
      killDirectChild(child)
      reject(new Error(`Timed-out command cleanup did not finish within ${timeoutCleanupMs}ms.`))
    }, timeoutCleanupMs)

    void attempt.completion.then(
      () => {
        clearTimeout(timeout)
        resolve()
      },
      (error: unknown) => {
        clearTimeout(timeout)
        stopTerminationAttempt(attempt)
        killDirectChild(child)
        reject(new Error(`Timed-out command cleanup failed: ${errorDetail(error)}`))
      }
    )
  })
}

function startTimeoutCleanup(
  createAttempt: TimeoutTerminationAttemptFactory,
  child: ChildProcess
): Promise<void> {
  try {
    return boundTimeoutCleanup(createAttempt(child), child)
  } catch (error) {
    killDirectChild(child)
    return Promise.reject(new Error(`Timed-out command cleanup failed: ${errorDetail(error)}`))
  }
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    let spawnError: Error | undefined
    let timedOut = false
    let timeoutCleanup: Promise<void> | undefined

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error: Error) => {
      spawnError = error
    })

    const timeout = setTimeout(() => {
      timedOut = true
      const createAttempt =
        options.createTimeoutTerminationAttempt ?? createTimeoutTerminationAttempt
      timeoutCleanup = startTimeoutCleanup(createAttempt, child)
      void timeoutCleanup.catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error(errorDetail(error)))
      })
    }, options.timeoutMs)

    const finishCommand = (exitCode: number | null): void => {
      if (spawnError !== undefined) {
        reject(new Error(`Unable to run command ${command}: ${spawnError.message}`))
        return
      }

      resolve({ exitCode, stdout, stderr, timedOut })
    }

    child.on('close', (exitCode) => {
      clearTimeout(timeout)
      if (timeoutCleanup === undefined) {
        finishCommand(exitCode)
        return
      }

      void timeoutCleanup.then(
        () => {
          finishCommand(exitCode)
        },
        (error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      )
    })
  })
}

export function pnpmCommand(args: readonly string[]): {
  readonly command: string
  readonly args: readonly string[]
} {
  const pnpmExecPath = process.env.npm_execpath
  if (pnpmExecPath === undefined || pnpmExecPath.length === 0) {
    throw new Error('Cannot run pnpm because npm_execpath is not set.')
  }

  return { command: process.execPath, args: [pnpmExecPath, ...args] }
}
