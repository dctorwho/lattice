import { defineConfig } from 'vitest/config'

const isMetaChild = process.env.LATTICE_QUALITY_META_CHILD === '1'

export default defineConfig({
  test: {
    environment: 'node',
    allowOnly: false,
    include: ['tests/integration/**/*.spec.ts'],
    exclude: isMetaChild ? ['tests/integration/quality-scripts.spec.ts'] : [],
    testTimeout: 1_020_000,
    hookTimeout: 120_000,
    sequence: { concurrent: false }
  }
})
