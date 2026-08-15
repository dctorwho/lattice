export interface DependencyComponent {
  readonly name: string
  readonly version: string
  readonly purl: string
  readonly bomRef: string
}

export interface DependencyEdge {
  readonly ref: string
  readonly dependsOn: readonly string[]
}

export interface DependencyInventory {
  readonly schemaVersion: 1
  readonly root: DependencyComponent
  readonly components: readonly DependencyComponent[]
  readonly dependencies: readonly DependencyEdge[]
}

export interface PackageLicense {
  readonly name: string
  readonly version: string
  readonly license: string
}

export interface LicenseReport {
  readonly schemaVersion: 1
  readonly allowedExpressions: readonly string[]
  readonly packages: readonly PackageLicense[]
}

export interface VulnerabilityCounts {
  readonly info: number
  readonly low: number
  readonly moderate: number
  readonly high: number
  readonly critical: number
}

export interface VulnerabilityAdvisory {
  readonly id: string
  readonly moduleName: string
  readonly severity: string
  readonly title: string
  readonly url?: string
  readonly vulnerableVersions: string
  readonly patchedVersions: string
}

export interface VulnerabilityReport {
  readonly schemaVersion: 1
  readonly counts: VulnerabilityCounts
  readonly advisories: readonly VulnerabilityAdvisory[]
}

export interface AuditBundle {
  readonly inventory: DependencyInventory
  readonly licenses: LicenseReport
  readonly audit: VulnerabilityReport
}

export interface DependencyAuditBundle extends AuditBundle {
  readonly toolchainAudit: VulnerabilityReport
}

export interface CycloneDxComponent {
  readonly type: 'library'
  readonly name: string
  readonly version: string
  readonly 'bom-ref': string
  readonly purl: string
  readonly licenses: readonly [{ readonly expression: string }]
}

export interface CycloneDxBom {
  readonly bomFormat: 'CycloneDX'
  readonly specVersion: '1.6'
  readonly version: 1
  readonly metadata: {
    readonly timestamp: string
    readonly tools: {
      readonly components: readonly [
        {
          readonly type: 'application'
          readonly name: 'lattice-m0-audit'
          readonly version: '1'
        }
      ]
    }
    readonly component: {
      readonly type: 'application'
      readonly name: string
      readonly version: string
      readonly 'bom-ref': string
      readonly purl: string
    }
  }
  readonly components: readonly CycloneDxComponent[]
  readonly dependencies: readonly DependencyEdge[]
}

export function normalizeDependencyGraph(input: unknown): DependencyInventory
export function normalizeLicenseReport(input: unknown, allowlist: readonly string[]): LicenseReport
export function normalizeAuditReport(
  input: unknown,
  minimumSeverity?: 'moderate' | 'high'
): VulnerabilityReport
export function createCycloneDxBom(input: AuditBundle, generatedAt: string): CycloneDxBom
export function assertNoAbsolutePaths(input: unknown): void
export function stableJson(input: unknown): string
