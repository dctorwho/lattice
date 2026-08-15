import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateSbom } from '../../../scripts/audit/generate-sbom.mjs'
import { runDependencyAudit } from '../../../scripts/audit/run-dependency-audit.mjs'

const dependencyInput = [
  {
    name: 'lattice',
    version: '0.0.0',
    path: String.raw`D:\private\checkout`,
    dependencies: {
      react: { from: 'react', version: '19.2.7', path: '/private/store/react' }
    }
  }
]

const licenseInput = {
  MIT: [{ name: 'react', versions: ['19.2.7'], license: 'MIT', paths: ['/private/store/react'] }]
}

const auditInput = {
  advisories: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
    dependencies: 1,
    devDependencies: 0,
    optionalDependencies: 0,
    totalDependencies: 1
  }
}

describe('M0 dependency audit orchestration', () => {
  let root: string
  let outputDirectory: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-audit-'))
    outputDirectory = join(root, 'artifacts', 'm0')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  function successfulExecutor() {
    const calls: string[][] = []
    const execute = (args: readonly string[]) => {
      calls.push([...args])
      const key = args.join(' ')
      if (key === 'list --prod --json --depth Infinity') {
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify(dependencyInput),
          stderr: '',
          timedOut: false
        })
      }
      if (key === 'licenses list --prod --json') {
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify(licenseInput),
          stderr: '',
          timedOut: false
        })
      }
      if (key === 'audit --prod --json --audit-level high') {
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify(auditInput),
          stderr: '',
          timedOut: false
        })
      }
      if (key === 'audit --json --audit-level moderate') {
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify(auditInput),
          stderr: '',
          timedOut: false
        })
      }
      throw new Error(`Unexpected pnpm arguments: ${key}`)
    }
    return { calls, execute }
  }

  it('runs the exact production commands and atomically writes redacted normalized reports', async () => {
    const executor = successfulExecutor()

    const bundle = await runDependencyAudit({
      outputDirectory,
      execute: executor.execute
    })

    expect(executor.calls).toEqual([
      ['list', '--prod', '--json', '--depth', 'Infinity'],
      ['licenses', 'list', '--prod', '--json'],
      ['audit', '--prod', '--json', '--audit-level', 'high'],
      ['audit', '--json', '--audit-level', 'moderate']
    ])
    expect(bundle.inventory.components).toHaveLength(1)
    expect(await readdir(outputDirectory)).toEqual([
      'audit.json',
      'dependency-inventory.json',
      'licenses.json',
      'toolchain-audit.json'
    ])
    for (const fileName of await readdir(outputDirectory)) {
      const contents = await readFile(join(outputDirectory, fileName), 'utf8')
      expect(contents).not.toContain('D:\\private')
      expect(contents).not.toContain('/private/store')
      expect(contents.endsWith('\n')).toBe(true)
    }
  })

  it('fails closed when the complete toolchain has a moderate vulnerability', async () => {
    const toolchainAudit = structuredClone(auditInput)
    toolchainAudit.metadata.vulnerabilities.moderate = 1
    toolchainAudit.advisories = {
      23: {
        module_name: 'tooling-package',
        severity: 'moderate',
        title: 'controlled toolchain fixture',
        vulnerable_versions: '<2.0.0',
        patched_versions: '>=2.0.0'
      }
    }
    const execute = (args: readonly string[]) => {
      const key = args.join(' ')
      if (key === 'list --prod --json --depth Infinity') {
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify(dependencyInput),
          stderr: '',
          timedOut: false
        })
      }
      if (key === 'licenses list --prod --json') {
        return Promise.resolve({
          exitCode: 0,
          stdout: JSON.stringify(licenseInput),
          stderr: '',
          timedOut: false
        })
      }
      const isToolchainAudit = key === 'audit --json --audit-level moderate'
      const input = isToolchainAudit ? toolchainAudit : auditInput
      return Promise.resolve({
        exitCode: isToolchainAudit ? 1 : 0,
        stdout: JSON.stringify(input),
        stderr: '',
        timedOut: false
      })
    }

    await expect(runDependencyAudit({ outputDirectory, execute })).rejects.toThrow(
      'M0_AUDIT_VULNERABILITY_THRESHOLD'
    )
    await expect(readdir(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails closed on a command failure without writing partial reports or raw stderr', async () => {
    const execute = () =>
      Promise.resolve({
        exitCode: 1,
        stdout: '',
        stderr: String.raw`failed in C:\Users\person\secret with token=abc`,
        timedOut: false
      })

    await expect(runDependencyAudit({ outputDirectory, execute })).rejects.toThrow(
      'M0_AUDIT_COMMAND_FAILED'
    )
    await expect(readdir(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails closed on timeout, malformed JSON, and an unknown pnpm schema', async () => {
    const timeout = () =>
      Promise.resolve({ exitCode: null, stdout: '', stderr: '', timedOut: true })
    await expect(runDependencyAudit({ outputDirectory, execute: timeout })).rejects.toThrow(
      'M0_AUDIT_COMMAND_TIMEOUT'
    )

    const malformed = () =>
      Promise.resolve({ exitCode: 0, stdout: '{', stderr: '', timedOut: false })
    await expect(runDependencyAudit({ outputDirectory, execute: malformed })).rejects.toThrow(
      'M0_AUDIT_JSON_PARSE_FAILED'
    )

    const unknown = () =>
      Promise.resolve({ exitCode: 0, stdout: '{}', stderr: '', timedOut: false })
    await expect(runDependencyAudit({ outputDirectory, execute: unknown })).rejects.toThrow(
      'M0_AUDIT_DEPENDENCY_SCHEMA_INVALID'
    )
  })

  it('generates a CycloneDX report from the normalized files and rejects incomplete inputs', async () => {
    const executor = successfulExecutor()
    await runDependencyAudit({ outputDirectory, execute: executor.execute })

    const bom = await generateSbom({
      inputDirectory: outputDirectory,
      generatedAt: '2026-08-15T08:00:00.000Z'
    })

    expect(bom.specVersion).toBe('1.6')
    expect(bom.components.map(({ name }) => name)).toEqual(['react'])
    expect(JSON.parse(await readFile(join(outputDirectory, 'sbom.cdx.json'), 'utf8'))).toEqual(bom)

    await writeFile(
      join(outputDirectory, 'licenses.json'),
      '{"schemaVersion":1,"allowedExpressions":["MIT"],"packages":[]}\n',
      'utf8'
    )
    await expect(
      generateSbom({
        inputDirectory: outputDirectory,
        generatedAt: '2026-08-15T08:00:00.000Z'
      })
    ).rejects.toThrow('M0_SBOM_LICENSE_COVERAGE')
  })
})
