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

    expect(contents).toMatch(/TEMP:\s*\$\{\{ runner\.temp \}\}/)
    expect(contents).toMatch(/TMP:\s*\$\{\{ runner\.temp \}\}/)
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
