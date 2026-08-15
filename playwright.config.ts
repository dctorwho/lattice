import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: ['**/packaged-app.spec.ts'],
  workers: 1,
  forbidOnly: true,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']]
})
