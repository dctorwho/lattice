import { describe, expect, it } from 'vitest'
import { assertWithinThreshold, summarizeSamples } from '../../helpers/performance'

describe('performance statistics', () => {
  it('uses median and nearest-rank P95', () => {
    expect(summarizeSamples([1, 2, 3, 4, 100])).toEqual({
      median: 3,
      p95: 100,
      sampleCount: 5
    })
  })

  it.each([
    { samples: [] },
    { samples: [-1] },
    { samples: [Number.NaN] },
    { samples: [Number.POSITIVE_INFINITY] }
  ])('rejects invalid samples $samples', ({ samples }) =>
    expect(() => summarizeSamples(samples)).toThrow()
  )

  it('reports threshold violations', () => {
    const summary = summarizeSamples([1, 2, 3, 4, 100])
    expect(() => assertWithinThreshold('fixture', summary, { median: 3, p95: 99 })).toThrow(
      /fixture.*p95.*100.*99/
    )
  })

  it('reports median threshold violations', () => {
    const summary = summarizeSamples([1, 2, 3])
    expect(() => assertWithinThreshold('fixture', summary, { median: 1, p95: 3 })).toThrow(
      /fixture.*median.*2.*1/
    )
  })
})
