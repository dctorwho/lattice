import type { AuditBundle } from './audit-core.mjs'

export interface AuditCommandResult {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
  readonly outputExceeded?: boolean
}

export interface DependencyAuditOptions {
  readonly outputDirectory: string
  readonly execute?: (args: readonly string[]) => Promise<AuditCommandResult>
}

export function runDependencyAudit(options: DependencyAuditOptions): Promise<AuditBundle>
