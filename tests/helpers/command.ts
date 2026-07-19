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
}

function terminateTimedOutProcess(child: ChildProcess): Promise<void> {
  if (process.platform !== 'win32' || child.pid === undefined) {
    child.kill()
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const terminator = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      shell: false,
      windowsHide: true
    })
    const finish = (): void => {
      resolve()
    }
    terminator.once('error', () => {
      child.kill()
      finish()
    })
    terminator.once('close', (exitCode) => {
      if (exitCode !== 0) {
        child.kill()
      }
      finish()
    })
  })
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
      timeoutCleanup = terminateTimedOutProcess(child)
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
