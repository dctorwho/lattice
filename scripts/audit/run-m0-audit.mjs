import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stableJson } from './audit-core.mjs'

const defaultTimeoutMs = 300_000
const outputLimitBytes = 4 * 1024 * 1024
const stableFailurePattern = /\bM0_[A-Z0-9_]+\b/

const auditSteps = [
  { name: 'planning', path: 'scripts/verify-planning-docs.mjs', args: [] },
  { name: 'dependency-audit', path: 'scripts/audit/run-dependency-audit.mjs', args: [] },
  { name: 'sbom', path: 'scripts/audit/generate-sbom.mjs', args: [] },
  { name: 'workflows', path: 'scripts/verify-workflows.mjs', args: [] },
  { name: 'brand-assets', path: 'scripts/assets/build-lattice-icon.mjs', args: ['--check'] },
  { name: 'artifact-hashes', path: 'scripts/audit/hash-artifacts.mjs', args: [] }
]

function fail(code) {
  throw new Error(code)
}

function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate)
  return (
    pathFromParent.length === 0 ||
    (!pathFromParent.startsWith(`..${sep}`) &&
      pathFromParent !== '..' &&
      !isAbsolute(pathFromParent))
  )
}

async function validatedStepPath(rootDirectory, relativePath) {
  const root = await realpath(rootDirectory)
  const candidate = resolve(root, relativePath)
  if (!isInside(root, candidate) || candidate === root) {
    fail('M0_GATE_STEP_PATH_INVALID')
  }
  const status = await lstat(candidate).catch(() => undefined)
  if (status === undefined || !status.isFile() || status.isSymbolicLink()) {
    fail('M0_GATE_STEP_MISSING')
  }
  const resolvedCandidate = await realpath(candidate)
  if (!isInside(root, resolvedCandidate) || resolvedCandidate !== candidate) {
    fail('M0_GATE_STEP_PATH_INVALID')
  }
  return candidate
}

function terminateChild(child) {
  if (process.platform === 'win32' && child.pid !== undefined) {
    const terminator = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore'
    })
    terminator.unref()
  }
  try {
    child.kill('SIGKILL')
  } catch {
    // The child may already have exited between the timeout and termination attempt.
  }
}

function runStep(options) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [options.path, ...options.args], {
      cwd: options.rootDirectory,
      env: { ...options.environment, M0_GATE_STEP: options.name },
      shell: false,
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    let startError
    let timedOut = false
    let outputExceeded = false

    const capture = (current, chunk) => {
      const next = current + chunk
      if (Buffer.byteLength(next, 'utf8') > outputLimitBytes) {
        outputExceeded = true
        terminateChild(child)
      }
      return next
    }

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => {
      stdout = capture(stdout, chunk)
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk) => {
      stderr = capture(stderr, chunk)
    })
    child.once('error', (error) => {
      startError = error
    })

    const timeout = setTimeout(() => {
      timedOut = true
      terminateChild(child)
    }, options.timeoutMs)

    child.once('close', (exitCode) => {
      clearTimeout(timeout)
      if (startError !== undefined) {
        reject(new Error(`M0_GATE_STEP_START_FAILED:${options.name}`, { cause: startError }))
        return
      }
      resolveResult({ exitCode, stdout, stderr, timedOut, outputExceeded })
    })
  })
}

function childFailureCode(stderr) {
  return stderr.match(stableFailurePattern)?.[0] ?? 'M0_GATE_CHILD_FAILED'
}

async function writeGateReport(rootDirectory, report) {
  const outputDirectory = join(rootDirectory, 'artifacts', 'm0')
  const outputPath = join(outputDirectory, 'm0-gate.json')
  const temporaryPath = `${outputPath}.tmp-${randomUUID()}`
  await mkdir(outputDirectory, { recursive: true })
  try {
    await writeFile(temporaryPath, stableJson(report), { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, outputPath)
  } catch (error) {
    throw new Error('M0_GATE_REPORT_WRITE_FAILED', { cause: error })
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

export async function runM0Audit(options) {
  const rootDirectory = await realpath(resolve(options.rootDirectory))
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > defaultTimeoutMs) {
    fail('M0_GATE_TIMEOUT_INVALID')
  }
  const environment = options.environment ?? process.env
  const passedSteps = []

  for (const step of auditSteps) {
    const path = await validatedStepPath(rootDirectory, step.path)
    const result = await runStep({
      ...step,
      path,
      rootDirectory,
      environment,
      timeoutMs
    })
    if (result.timedOut) {
      fail(`M0_GATE_STEP_TIMEOUT:${step.name}`)
    }
    if (result.outputExceeded) {
      fail(`M0_GATE_STEP_OUTPUT_LIMIT:${step.name}`)
    }
    if (result.exitCode !== 0) {
      fail(`${childFailureCode(result.stderr)}:${step.name}`)
    }
    passedSteps.push({ name: step.name, status: 'passed' })
  }

  const report = { schemaVersion: 1, steps: passedSteps }
  await writeGateReport(rootDirectory, report)
  return report
}

async function main() {
  const report = await runM0Audit({ rootDirectory: process.cwd() })
  process.stdout.write(`M0 audit gate passed ${report.steps.length} finite steps.\n`)
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'M0_GATE_UNKNOWN_FAILURE'}\n`)
    process.exitCode = 1
  })
}
