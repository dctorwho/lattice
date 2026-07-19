import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    allowOnly: false,
    include: ['tests/bootstrap/**/*.spec.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    maxWorkers: 1
  }
})
