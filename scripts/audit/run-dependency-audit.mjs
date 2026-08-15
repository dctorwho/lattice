import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  assertNoAbsolutePaths,
  normalizeAuditReport,
  normalizeDependencyGraph,
  normalizeLicenseReport,
  stableJson
} from './audit-core.mjs'

const commandTimeoutMs = 300_000
const outputLimitBytes = 8 * 1024 * 1024
const productionLicenseAllowlist = ['MIT']

function fail(code) {
  throw new Error(code)
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout)
  } catch {
    fail('M0_AUDIT_JSON_PARSE_FAILED')
  }
}

async function runPnpm(args) {
  const pnpmExecPath = process.env.npm_execpath
  if (pnpmExecPath === undefined || pnpmExecPath.length === 0) {
    fail('M0_AUDIT_PNPM_UNAVAILABLE')
  }

  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [pnpmExecPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    let outputExceeded = false
    let spawnFailure = false
    let timedOut = false

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => {
      stdout += chunk
      if (Buffer.byteLength(stdout, 'utf8') > outputLimitBytes) {
        outputExceeded = true
        child.kill('SIGKILL')
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
      if (Buffer.byteLength(stderr, 'utf8') > outputLimitBytes) {
        outputExceeded = true
        child.kill('SIGKILL')
      }
    })
    child.once('error', () => {
      spawnFailure = true
    })

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, commandTimeoutMs)

    child.once('close', (exitCode) => {
      clearTimeout(timeout)
      if (spawnFailure) {
        reject(new Error('M0_AUDIT_COMMAND_START_FAILED'))
        return
      }
      resolveResult({ exitCode, stdout, stderr, timedOut, outputExceeded })
    })
  })
}

async function executeJson(execute, args) {
  const result = await execute(args)
  if (result.timedOut) {
    fail('M0_AUDIT_COMMAND_TIMEOUT')
  }
  if (result.outputExceeded === true) {
    fail('M0_AUDIT_COMMAND_OUTPUT_LIMIT')
  }
  if (result.exitCode !== 0) {
    fail('M0_AUDIT_COMMAND_FAILED')
  }
  return parseJson(result.stdout)
}

async function executeAuditJson(execute, args) {
  const result = await execute(args)
  if (result.timedOut) {
    fail('M0_AUDIT_COMMAND_TIMEOUT')
  }
  if (result.outputExceeded === true) {
    fail('M0_AUDIT_COMMAND_OUTPUT_LIMIT')
  }
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    fail('M0_AUDIT_COMMAND_FAILED')
  }
  return parseJson(result.stdout)
}

async function replaceReportDirectory(outputDirectory, reports) {
  const parent = dirname(outputDirectory)
  const name = basename(outputDirectory)
  const staging = join(parent, `.${name}-staging-${randomUUID()}`)
  const backup = join(parent, `.${name}-backup-${randomUUID()}`)
  let movedExisting = false
  let published = false
  await mkdir(staging, { recursive: true })
  try {
    for (const [fileName, report] of reports) {
      await writeFile(join(staging, fileName), stableJson(report), {
        encoding: 'utf8',
        flag: 'wx'
      })
    }
    try {
      await rename(outputDirectory, backup)
      movedExisting = true
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
    await rename(staging, outputDirectory)
    published = true
    if (movedExisting) {
      await rm(backup, { recursive: true, force: true })
    }
  } catch {
    if (movedExisting && !published) {
      try {
        await rename(backup, outputDirectory)
      } catch {
        fail('M0_AUDIT_REPORT_WRITE_FAILED')
      }
    }
    fail('M0_AUDIT_REPORT_WRITE_FAILED')
  } finally {
    await rm(staging, { recursive: true, force: true })
    if (published) {
      await rm(backup, { recursive: true, force: true })
    }
  }
}

export async function runDependencyAudit(options) {
  const execute = options.execute ?? runPnpm
  const dependencyInput = await executeJson(execute, [
    'list',
    '--prod',
    '--json',
    '--depth',
    'Infinity'
  ])
  const licenseInput = await executeJson(execute, ['licenses', 'list', '--prod', '--json'])
  const auditInput = await executeAuditJson(execute, [
    'audit',
    '--prod',
    '--json',
    '--audit-level',
    'high'
  ])
  const toolchainAuditInput = await executeAuditJson(execute, [
    'audit',
    '--json',
    '--audit-level',
    'moderate'
  ])
  const bundle = {
    inventory: normalizeDependencyGraph(dependencyInput),
    licenses: normalizeLicenseReport(licenseInput, productionLicenseAllowlist),
    audit: normalizeAuditReport(auditInput),
    toolchainAudit: normalizeAuditReport(toolchainAuditInput, 'moderate')
  }
  assertNoAbsolutePaths(bundle)
  await replaceReportDirectory(options.outputDirectory, [
    ['dependency-inventory.json', bundle.inventory],
    ['licenses.json', bundle.licenses],
    ['audit.json', bundle.audit],
    ['toolchain-audit.json', bundle.toolchainAudit]
  ])
  return bundle
}

async function main() {
  await runDependencyAudit({ outputDirectory: resolve('artifacts', 'm0') })
  process.stdout.write('M0 production and toolchain dependency audits passed.\n')
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'M0_AUDIT_UNKNOWN_FAILURE'}\n`)
    process.exitCode = 1
  })
}
