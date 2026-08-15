export interface M0AuditOptions {
  readonly rootDirectory: string
  readonly environment?: NodeJS.ProcessEnv
  readonly timeoutMs?: number
}

export interface M0AuditReport {
  readonly schemaVersion: 1
  readonly steps: readonly {
    readonly name: string
    readonly status: 'passed'
  }[]
}

export function runM0Audit(options: M0AuditOptions): Promise<M0AuditReport>
