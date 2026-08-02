import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { runCommand } from '../../helpers/command'
import { requiredArtifacts } from '../../helpers/artifacts'
import { verifyBootstrap } from '../../helpers/bootstrap-project'
import type { removeWithRetry } from '../../helpers/project-copy'

describe('verifyBootstrap', () => {
  let root: string
  let sourceRoot: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-bootstrap-unit-'))
    sourceRoot = join(root, 'source')
    await mkdir(sourceRoot)
    await writeFile(join(sourceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    await writeFile(join(sourceRoot, 'package.json'), '{"packageManager":"pnpm@11.12.0"}\n')
  })

  afterEach(async () => rm(root, { recursive: true, force: true }))

  function fakeRunner(options?: {
    failBuildNumber?: number
    failInstall?: boolean
    changeSecondBuildArtifact?: boolean
    ignoredBuildPackage?: string
    explicitIgnoredBuildPackage?: string
  }) {
    const calls: Array<{ readonly args: readonly string[]; readonly cwd: string }> = []
    let buildNumber = 0
    const run: typeof runCommand = async (_command, args, commandOptions) => {
      calls.push({ args, cwd: commandOptions.cwd })
      if (args.includes('install') && options?.failInstall) {
        return { exitCode: 8, stdout: '', stderr: 'injected install failure', timedOut: false }
      }
      if (args.includes('ignored-builds')) {
        const explicitIgnoredBuilds =
          options?.explicitIgnoredBuildPackage === undefined
            ? ''
            : `\nExplicitly ignored package builds (via allowBuilds):\n  ${options.explicitIgnoredBuildPackage}\n`
        return {
          exitCode: 0,
          stdout: `Automatically ignored builds during installation:\n  ${options?.ignoredBuildPackage ?? 'None'}\n${explicitIgnoredBuilds}`,
          stderr: '',
          timedOut: false
        }
      }
      if (args.includes('build')) {
        buildNumber += 1
        if (buildNumber === options?.failBuildNumber) {
          return { exitCode: 9, stdout: '', stderr: 'injected build failure', timedOut: false }
        }
        for (const relativePath of requiredArtifacts) {
          const target = join(commandOptions.cwd, relativePath)
          await mkdir(dirname(target), { recursive: true })
          const contents =
            buildNumber === 2 &&
            options?.changeSecondBuildArtifact === true &&
            relativePath === 'out/main/index.js'
              ? 'changed during second build'
              : relativePath
          await writeFile(target, contents)
        }
      }
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false }
    }
    return { calls, run }
  }

  it('adds offline install flags and builds twice', async () => {
    const fake = fakeRunner()
    await verifyBootstrap({
      sourceRoot,
      tempParent: root,
      mode: 'offline',
      storeDirectory: join(root, 'store'),
      relativePaths: ['package.json', 'pnpm-lock.yaml'],
      run: fake.run
    })
    const install = fake.calls.find((call) => call.args.includes('install'))
    expect(install?.args).toEqual(expect.arrayContaining(['--offline', '--frozen-lockfile']))
    expect(fake.calls.filter((call) => call.args.includes('build'))).toHaveLength(2)
  })

  it('cleans the project copy after an injected second-build failure', async () => {
    const fake = fakeRunner({ failBuildNumber: 2 })
    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'cold',
        storeDirectory: join(root, 'empty-store'),
        relativePaths: ['package.json', 'pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow(/build.*9/)
    const copiedRoot = fake.calls[0]?.cwd
    expect(copiedRoot).toBeDefined()
    await expect(access(copiedRoot as string)).rejects.toThrow()
  })

  it('omits offline mode for a cold install', async () => {
    const fake = fakeRunner()
    await verifyBootstrap({
      sourceRoot,
      tempParent: root,
      mode: 'cold',
      storeDirectory: join(root, 'empty-store'),
      relativePaths: ['package.json', 'pnpm-lock.yaml'],
      run: fake.run
    })
    const install = fake.calls.find((call) => call.args.includes('install'))
    expect(install?.args).not.toContain('--offline')
  })

  it('reports an install-stage exit code', async () => {
    const fake = fakeRunner({ failInstall: true })
    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'offline',
        storeDirectory: join(root, 'store'),
        relativePaths: ['package.json', 'pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow(/install.*8/)
  })

  it('rejects a package with an ignored install build', async () => {
    const fake = fakeRunner({ ignoredBuildPackage: 'esbuild' })
    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'offline',
        storeDirectory: join(root, 'store'),
        relativePaths: ['package.json', 'pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow(/ignored builds.*esbuild/i)
  })

  it('allows explicit package-build denial when no automatic builds are pending', async () => {
    const fake = fakeRunner({ explicitIgnoredBuildPackage: 'electron-winstaller' })
    const evidence = await verifyBootstrap({
      sourceRoot,
      tempParent: root,
      mode: 'offline',
      storeDirectory: join(root, 'store'),
      relativePaths: ['package.json', 'pnpm-lock.yaml'],
      run: fake.run
    })

    expect(evidence.pendingBuilds).toEqual([])
  })

  it('rejects mismatched required artifact hashes from the second build', async () => {
    const fake = fakeRunner({ changeSecondBuildArtifact: true })
    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'offline',
        storeDirectory: join(root, 'store'),
        relativePaths: ['package.json', 'pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow('different required artifact hashes')
  })

  it('retains the stage failure when project cleanup also fails', async () => {
    const fake = fakeRunner({ failBuildNumber: 2 })
    const remove: typeof removeWithRetry = (target) => {
      if (basename(target) === 'out') {
        return Promise.resolve()
      }
      return Promise.reject(new Error('injected project cleanup failure'))
    }

    const failure = await verifyBootstrap({
      sourceRoot,
      tempParent: root,
      mode: 'offline',
      storeDirectory: join(root, 'store'),
      relativePaths: ['package.json', 'pnpm-lock.yaml'],
      run: fake.run,
      remove
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    if (!(failure instanceof AggregateError)) {
      throw new Error('Expected an AggregateError.')
    }
    expect(failure.message).toMatch(/build.*9/i)
    expect(failure.message).toMatch(/cleanup/i)
    expect(failure.errors).toHaveLength(2)
    expect(failure.errors[0]).toBeInstanceOf(Error)
    expect(failure.errors[1]).toBeInstanceOf(Error)
  })

  it('surfaces a project cleanup failure after a successful bootstrap', async () => {
    const fake = fakeRunner()
    const remove: typeof removeWithRetry = (target) => {
      if (basename(target) === 'out') {
        return Promise.resolve()
      }
      return Promise.reject(new Error('injected project cleanup failure'))
    }

    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'offline',
        storeDirectory: join(root, 'store'),
        relativePaths: ['package.json', 'pnpm-lock.yaml'],
        run: fake.run,
        remove
      })
    ).rejects.toThrow('injected project cleanup failure')
  })

  it('rejects a copied package manager declaration that is not pnpm 11.12.0', async () => {
    await writeFile(join(sourceRoot, 'package.json'), '{"packageManager":"pnpm@10.0.0"}\n')
    const fake = fakeRunner()

    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'offline',
        storeDirectory: join(root, 'store'),
        relativePaths: ['package.json', 'pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow('pnpm@11.12.0')
  })
})
