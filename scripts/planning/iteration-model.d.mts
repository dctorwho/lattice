export interface EvidenceRecord {
  readonly kind: 'command' | 'test' | 'report' | 'manual'
  readonly summary: string
  readonly path?: string
  readonly recorded_at: string
}

export interface IterationRecord {
  readonly id: `M${number}`
  readonly status: 'blocked' | 'ready' | 'in_progress' | 'awaiting_manual' | 'passed' | 'failed'
  readonly depends_on: readonly `M${number}`[]
  readonly manual_gate: boolean
  readonly entry: {
    readonly requirements: string
    readonly detailed_design: string
    readonly test_cases: string
  }
  readonly exit: {
    readonly test_report: string
    readonly iteration_report: string
  }
  readonly evidence: readonly EvidenceRecord[]
}

export function validateIterationState(state: unknown, schema: unknown): readonly string[]

export function collectReferenceIds(
  text: string,
  allowedPrefixes: ReadonlySet<string>
): ReadonlySet<string>

export interface ReplicaEvidenceRecord {
  readonly id: `REF-${string}`
  readonly source: string
  readonly collectedAt: string
  readonly sourceType:
    'official-release' | 'official-doc' | 'official-image' | 'public-video' | 'review'
  readonly versionBasis: string
  readonly windowsApplicability: string
  readonly observation: string
  readonly confidence: 'high' | 'medium' | 'low'
  readonly requirements: readonly string[]
  readonly compatibility: readonly `COMP-${string}`[]
  readonly iteration: `M${number}`
  readonly tests: readonly string[]
  readonly status: '未实现' | '已实现' | '存在差异' | '证据不足'
}

export interface ReplicaEvidenceParseResult {
  readonly records: readonly ReplicaEvidenceRecord[]
  readonly errors: readonly string[]
}

export function parseReplicaEvidenceBaseline(text: string): ReplicaEvidenceParseResult

export function parseIterationTestCases(
  text: string,
  iterationId: string
): {
  readonly automated: readonly string[]
  readonly manual: readonly string[]
  readonly errors: readonly string[]
}
