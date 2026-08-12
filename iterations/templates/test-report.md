# {{ITERATION_ID}} test report

## Iteration context

- Iteration: `{{ITERATION_ID}}`
- State authority: `iterations/state.json`
- Test contract: `03-test-cases.md`

## Report status

This controlled working report may be updated throughout `{{ITERATION_ID}}`.
It is complete before the iteration enters `awaiting_manual`.

## Baseline and environment

## Existing validation

## Executed commands and results

| Date | Environment | Command or procedure | Exit code | Cases or coverage | Result | Evidence |
| ---- | ----------- | -------------------- | --------- | ----------------- | ------ | -------- |

## Automated case results

Before `awaiting_manual`, list every `TC-{{ITERATION_ID}}-*` declared in
`03-test-cases.md` exactly once. `Result` must be `passed`, and `Evidence` must
identify the command output or artifact that proves the result.

| Case ID | Result | Evidence | Notes |
| ------- | ------ | -------- | ----- |

## Manual case results

Before `passed`, list every `MAN-{{ITERATION_ID}}-*` declared in
`03-test-cases.md` exactly once. `Result` must be `passed`; `Evaluator` and
`Evidence` must both be non-empty. Leave the table empty while manual
evaluation is pending. Iterations with no declared manual cases keep the empty
table.

| Case ID | Result | Evaluator | Evidence |
| ------- | ------ | --------- | -------- |

## Failures, fixes, and regression evidence

| Finding | Impact | Resolution | Regression evidence | Status |
| ------- | ------ | ---------- | ------------------- | ------ |

## Unexecuted verification

## Residual risks

## Manual-gate handoff

List the manual cases, required evaluator, evidence location, and current
handoff status. A manual conclusion is recorded by the user or designated
evaluator, not by the agent preparing this report.

## Exit-readiness statement

This report records execution evidence only. The final completion decision,
delivery summary, and next-iteration inputs belong exclusively in
`05-exit-report.md`.
