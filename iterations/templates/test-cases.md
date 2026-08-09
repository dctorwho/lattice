# {{ITERATION_ID}} test cases

## Iteration context

- Iteration: `{{ITERATION_ID}}`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy:
  [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers. They are not subtask IDs and do
not own planning state, dependencies, implementation work, manual gates, or
reports. The `覆盖能力` column names the capability covered by the case.

## Automated test cases

| ID  | 覆盖能力 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | -------- | --------- | --------- | ---- | ---- | ------ |

`数据/环境` records the parameter or fixture selection. `自动化` records the
automation target together with the required evidence and case-specific stop
condition.

## Manual test cases

| ID  | 覆盖能力 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | -------- | ---- | ---- | -------- | ---- |

The manual `证据` cell records both the evidence artifact and the case-specific
stop condition.

Manual cases require approval by the user or designated evaluator. An agent
must not record a manual pass conclusion on their behalf.

## Parameter matrix

| Parameter ID | Variables | Fixture | Required cases | Expected result |
| ------------ | --------- | ------- | -------------- | --------------- |

## Fixtures

| Fixture | Source and integrity | Covered behavior | Required environment |
| ------- | -------------------- | ---------------- | -------------------- |

## Evidence requirements

Record command, environment, exit code, parameter selection, result, and
artifact or report reference for each executed automated case. Record operator,
date, environment, step results, and conclusion evidence for each manual case.

## Stop conditions

Data corruption, security-boundary failure, broken recovery, or any other
release-blocking condition in the governing policies stops iteration progress
until it is fixed and regression evidence is recorded.
