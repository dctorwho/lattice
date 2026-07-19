export interface SampleSummary {
  readonly median: number
  readonly p95: number
  readonly sampleCount: number
}

function requiredSample(sortedSamples: readonly number[], index: number): number {
  const sample = sortedSamples[index]
  if (sample === undefined) {
    throw new Error('Sample index is outside the summary range.')
  }
  return sample
}

export function summarizeSamples(samples: readonly number[]): SampleSummary {
  if (samples.length === 0) {
    throw new Error('Performance samples must not be empty.')
  }
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error('Performance samples must be finite, non-negative numbers.')
  }

  const sortedSamples = [...samples].sort((left, right) => left - right)
  const lowerMiddle = requiredSample(sortedSamples, Math.floor((sortedSamples.length - 1) / 2))
  const upperMiddle = requiredSample(sortedSamples, Math.floor(sortedSamples.length / 2))
  const p95Index = Math.ceil(0.95 * sortedSamples.length) - 1

  return {
    median: (lowerMiddle + upperMiddle) / 2,
    p95: requiredSample(sortedSamples, p95Index),
    sampleCount: sortedSamples.length
  }
}

export function assertWithinThreshold(
  label: string,
  summary: SampleSummary,
  limits: { readonly median: number; readonly p95: number }
): void {
  const violations: string[] = []
  if (summary.median > limits.median) {
    violations.push(`median ${summary.median} exceeds ${limits.median}`)
  }
  if (summary.p95 > limits.p95) {
    violations.push(`p95 ${summary.p95} exceeds ${limits.p95}`)
  }
  if (violations.length > 0) {
    throw new Error(`${label} exceeded performance threshold: ${violations.join(', ')}`)
  }
}
