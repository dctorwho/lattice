import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import playwrightConfig from '../../../playwright.config'

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
})
