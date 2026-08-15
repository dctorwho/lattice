import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import playwrightConfig from '../../../playwright.config'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

describe('M0 Windows package configuration', () => {
  it('builds only the approved x64 dir and per-user NSIS package surface', async () => {
    const manifestText = await readFile(join(process.cwd(), 'package.json'), 'utf8')
    const manifest: unknown = JSON.parse(manifestText)

    expect(manifest).toMatchObject({
      description: 'A local-first Markdown desktop editor.',
      author: { name: 'Lattice contributors' },
      scripts: {
        'package:dir': 'pnpm build && electron-builder --win dir --x64 --publish never',
        'package:win': 'pnpm build && electron-builder --win nsis --x64 --publish never',
        'test:packaged': 'playwright test --config playwright.packaged.config.ts'
      },
      build: {
        appId: 'io.github.dctorwho.lattice',
        productName: 'Lattice',
        artifactName: 'Lattice-${version}-windows-${arch}.${ext}',
        asar: true,
        npmRebuild: false,
        directories: { output: 'dist' },
        files: ['out/**/*', 'package.json', '!out/**/*.map'],
        win: {
          icon: 'build/brand/lattice.ico',
          target: [
            { target: 'dir', arch: ['x64'] },
            { target: 'nsis', arch: ['x64'] }
          ]
        },
        nsis: {
          oneClick: false,
          perMachine: false,
          allowElevation: false,
          allowToChangeInstallationDirectory: true
        }
      }
    })
    expect(manifest).not.toHaveProperty('build.publish')
    expect(manifest).not.toHaveProperty('build.afterSign')
  })

  it('keeps packaged-artifact tests out of the pre-package E2E suite', () => {
    expect(playwrightConfig.testIgnore).toEqual(['**/packaged-app.spec.ts'])
  })

  it('packages from the installed checksum-verified Electron runtime without a second download', async () => {
    const manifestText = await readFile(join(process.cwd(), 'package.json'), 'utf8')
    const manifest: unknown = JSON.parse(manifestText)

    expect(isRecord(manifest)).toBe(true)
    if (!isRecord(manifest)) return

    expect(isRecord(manifest.build)).toBe(true)
    if (!isRecord(manifest.build)) return

    expect(typeof manifest.build.electronDist).toBe('string')
    if (typeof manifest.build.electronDist !== 'string') return

    expect(isRecord(manifest.devDependencies)).toBe(true)
    if (!isRecord(manifest.devDependencies)) return

    expect(typeof manifest.devDependencies.electron).toBe('string')
    if (typeof manifest.devDependencies.electron !== 'string') return

    const runtimeDirectory = join(process.cwd(), manifest.build.electronDist)
    const [runtimeDirectoryStat, executableStat, resourcesStat, installedVersion] =
      await Promise.all([
        stat(runtimeDirectory),
        stat(join(runtimeDirectory, 'electron.exe')),
        stat(join(runtimeDirectory, 'resources')),
        readFile(join(runtimeDirectory, 'version'), 'utf8')
      ])

    expect(runtimeDirectoryStat.isDirectory()).toBe(true)
    expect(executableStat.isFile()).toBe(true)
    expect(resourcesStat.isDirectory()).toBe(true)
    expect(installedVersion.trim()).toBe(manifest.devDependencies.electron)
  })
})
