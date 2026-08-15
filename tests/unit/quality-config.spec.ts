import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('M0-T02 focused-test configuration', () => {
  it('keeps text checkouts LF-stable across Windows and Linux runners', async () => {
    const contents = await readFile(join(process.cwd(), '.gitattributes'), 'utf8')

    expect(contents).toMatch(/^\* text=auto eol=lf$/m)
    expect(contents).toMatch(/^\*\.png -text$/m)
    expect(contents).toMatch(/^\*\.ico -text$/m)
  })

  it('uses the canonical runner temp path for nested Windows quality processes', async () => {
    const contents = await readFile(join(process.cwd(), '.github/workflows/quality.yml'), 'utf8')
    const qualityStep = contents.match(
      /- name: Run the project quality gate\n(?<body>(?: {8,}.+\n?)*)/
    )?.groups?.body

    expect(qualityStep).toMatch(/env:\s*\n\s*TEMP:\s*\$\{\{ runner\.temp \}\}/)
    expect(qualityStep).toMatch(/TMP:\s*\$\{\{ runner\.temp \}\}/)
  })

  it('serializes nested integration orchestrators and keeps their commands bounded', async () => {
    const integrationConfig = await readFile(
      join(process.cwd(), 'vitest.integration.config.ts'),
      'utf8'
    )
    const qualityContracts = await readFile(
      join(process.cwd(), 'tests/integration/quality-scripts.spec.ts'),
      'utf8'
    )

    expect(integrationConfig).toMatch(/fileParallelism:\s*false/)
    expect(qualityContracts).toMatch(/const commandTimeoutMs = 180_000/)
  })

  it('removes only the unused pinned Squirrel peer from the packaging graph', async () => {
    const [workspace, lockfile, manifestText] = await Promise.all([
      readFile(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8'),
      readFile(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8'),
      readFile(join(process.cwd(), 'package.json'), 'utf8')
    ])
    const manifest: unknown = JSON.parse(manifestText)

    expect(workspace).toMatch(
      /overrides:\s*\n\s*['"]app-builder-lib@26\.15\.3>electron-builder-squirrel-windows['"]:\s*['"]-['"]/
    )
    expect(workspace).not.toMatch(/^autoInstallPeers:/m)
    expect(workspace).toMatch(/allowBuilds:\s*\n\s*esbuild:\s*true/)
    expect(workspace).not.toContain('electron-winstaller')
    expect(lockfile).not.toMatch(/^\s{2}electron-winstaller@5\.4\.0:/m)
    expect(lockfile).not.toMatch(
      /^\s{2}electron-builder-squirrel-windows@26\.15\.3(?:\([^\n]+\))?:/m
    )
    expect(manifest).toMatchObject({ devDependencies: { 'electron-builder': '26.15.3' } })
  })

  it.each([
    'vitest.config.ts',
    'vitest.integration.config.ts',
    'vitest.bootstrap.config.ts',
    'vitest.performance.config.ts'
  ])('forbids focused tests in %s', async (configFile) => {
    const contents = await readFile(join(process.cwd(), configFile), 'utf8')
    expect(contents).toMatch(/allowOnly:\s*false/)
  })

  it.each(['playwright.config.ts', 'playwright.security.config.ts'])(
    'forbids focused tests in %s',
    async (configFile) => {
      const contents = await readFile(join(process.cwd(), configFile), 'utf8')
      expect(contents).toMatch(/forbidOnly:\s*true/)
    }
  )
})
