import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/security',
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']]
})
