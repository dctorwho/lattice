import { defineConfig } from 'vitest/config'

const isMetaChild = process.env.LATTICE_QUALITY_META_CHILD === '1'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.spec.ts'],
    exclude: isMetaChild ? ['tests/integration/quality-scripts.spec.ts'] : [],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    sequence: { concurrent: false }
  }
})
