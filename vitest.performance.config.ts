import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/performance/**/*.spec.ts'],
    testTimeout: 60_000,
    maxWorkers: 1
  }
})
