# Iteration governance

`iterations/state.json` is the sole authority for active planning state. The
only active planning IDs are `M0` through `M8`; an iteration owns its scope,
dependencies, status, evidence, and manual-gate decision.

This directory does not create a second product specification. Iteration
documents link to the global [product charter](../docs/00-product-charter.md),
[architecture](../docs/03-architecture.md), [data-safety and security
rules](../docs/05-data-safety-and-security.md), and [test
strategy](../docs/09-test-strategy.md). Those documents remain the authority
for cross-iteration product and engineering constraints.

## Document roles

Every iteration has three entry documents:

1. `01-requirements.md` defines objectives, observable outcomes, scope,
   non-goals, requirement coverage, dependencies, risks, and iteration-level
   acceptance criteria.
2. `02-detailed-design.md` defines architecture boundaries, responsibilities,
   interfaces, data flow, safety and compatibility constraints, dependency
   admission, and implementation order.
3. `03-test-cases.md` defines the automated and manual verification contract,
   including parameter matrices, fixtures, expected results, evidence, and
   stop conditions.

Every iteration has two exit documents:

1. `04-test-report.md` is the controlled working record of commands,
   environments, exit codes, results, failures, fixes, regression evidence,
   unexecuted work, and residual risks.
2. `05-exit-report.md` is the final exit decision: completed requirements,
   delivered artifacts, material changes, gate conclusions, limitations,
   rollback approach, and the explicit inputs that the next iteration may
   depend on.

The reusable role templates live in [`templates/`](templates/). An instantiated
document replaces `{{ITERATION_ID}}` and contains no unresolved marker.

## Lifecycle and state transitions

The entry sequence is:

```text
01-requirements.md -> 02-detailed-design.md -> 03-test-cases.md -> development and continuous verification
```

An iteration may enter `ready` or `in_progress` only after all three entry
documents are complete, contain no unresolved planning content, and every
predecessor in `iterations/state.json` is `passed`.

The exit sequence is:

```text
04-test-report.md -> 05-exit-report.md
```

The allowed M-level state flow is:

```text
blocked -> ready -> in_progress -> awaiting_manual -> passed
                         |                |
                         +---- failed <---+
```

At most one iteration may be `in_progress` or `awaiting_manual`. A failed
iteration preserves failure evidence and is repaired within that same
iteration; it does not create a bypass item. `awaiting_manual` requires a
complete test report. `passed` requires both an exit report and successful
completion of every manual gate required by that iteration. Only then may its
direct successor be unblocked.

## Evidence and manual gates

Evidence is owned by the iteration and recorded through its state entry and
exit documents. Automated evidence belongs in the test report with the actual
environment, command, exit code, result, and artifact or report reference.
Manual evidence belongs to the named manual case and is approved only by the
user or designated evaluator; an agent may prepare steps and collect automated
evidence but cannot self-approve a manual gate.

`manual_gate` in `iterations/state.json` determines whether the iteration must
pause at `awaiting_manual`. The test-case document defines the applicable
manual cases and the evidence required to close them.

## No subtask ownership

Implementation order and checklists may organize work inside a detailed design,
but they have no independent status, dependency, evidence record, report, or
unlock behavior. Git commits are change history, not planning units.

Stable `TC-Mx-*` and `MAN-Mx-*` values are test-case identifiers only. They
describe verification coverage and do not own implementation work, planning
state, dependencies, manual gates, or reports. Historical task-level material
is traceability-only and does not participate in active planning or gates.
