import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    allowOnly: false,
    include: ['tests/performance/**/*.spec.ts'],
    testTimeout: 60_000,
    maxWorkers: 1
  }
})
