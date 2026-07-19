import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { assertWithinThreshold, summarizeSamples } from '../helpers/performance'

describe('M0-T02 performance harness smoke', () => {
  it('summarizes deterministic in-memory work', () => {
    const samples = Array.from({ length: 25 }, () => {
      const startedAt = performance.now()
      Array.from({ length: 2_000 }, (_, index) => 2_000 - index).sort((left, right) => left - right)
      return performance.now() - startedAt
    })
    const summary = summarizeSamples(samples)

    expect(summary.sampleCount).toBe(25)
    expect(Number.isFinite(summary.median)).toBe(true)
    expect(Number.isFinite(summary.p95)).toBe(true)
    expect(summary.median).toBeGreaterThanOrEqual(0)
    expect(summary.p95).toBeGreaterThanOrEqual(0)
    assertWithinThreshold('harness-only-sort', summary, { median: 5_000, p95: 5_000 })
  })

  it('rejects a synthetic threshold violation', () => {
    expect(() =>
      assertWithinThreshold(
        'synthetic',
        { median: 10, p95: 30, sampleCount: 3 },
        { median: 9, p95: 29 }
      )
    ).toThrow(/synthetic/)
  })
})
