import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('M0-T02 focused-test configuration', () => {
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
