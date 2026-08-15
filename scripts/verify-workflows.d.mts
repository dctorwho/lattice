export interface VerifyWorkflowsOptions {
  readonly rootDirectory: string
}

export interface WorkflowVerificationResult {
  readonly workflowCount: number
  readonly pinnedActionCount: number
  readonly dependabotConfigured: true
}

export function verifyWorkflows(
  options: VerifyWorkflowsOptions
): Promise<WorkflowVerificationResult>
