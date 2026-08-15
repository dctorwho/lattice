import type { CycloneDxBom } from './audit-core.mjs'

export interface GenerateSbomOptions {
  readonly inputDirectory: string
  readonly generatedAt?: string
}

export function generateSbom(options: GenerateSbomOptions): Promise<CycloneDxBom>
