# Iteration-Level Governance Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking. “Phase” is only a temporary execution checklist; it never becomes a repository task ID or status node.

**Goal:** Replace the 77-item `Mx-Tnn` planning system with one M0–M8 iteration state model, three entry documents and two exit documents per iteration, while preserving and integrating all existing M0 work.

**Architecture:** `iterations/state.json` becomes the sole planning state and points to iteration-owned entry/exit documents. A small pure validation module checks schema/state/case-table invariants, while `scripts/verify-planning-docs.mjs` performs repository file, coverage, link and active-language checks. Legacy task material is retained under a read-only archive and excluded from gates.

**Tech Stack:** Node.js 24, ECMAScript modules, JSON Schema 2020-12, Markdown, Vitest 4.1.10, pnpm 11.12.0, Git.

## Global Constraints

- Active planning IDs are exactly `M0` through `M8`; never create `Mx-Tnn` state or specifications.
- Each iteration has exactly three entry roles: requirements, detailed design and test cases.
- Each iteration has exactly two exit roles: test report and iteration exit report.
- M0 migrates to `in_progress`; M1 through M8 remain `blocked`.
- Preserve `codex/m0-t06-ci-audit-gate`, commit its two interrupted security-parser changes after verification, and integrate reviewed implementation commits without merging old task-state commits.
- Do not rewrite Git history, delete the legacy branch, discard uncommitted changes, or weaken any data-loss/security gate.
- Product architecture rules in `AGENTS.md` remain unchanged.
- Focused tests run with related changes; the full `pnpm check` and applicable integration/security suites run before the migration is declared complete.
- No unbounded watch, polling or retry command is allowed.

---

## File Map

### New active planning

| Path                                                                      | Responsibility                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `iterations/README.md`                                                    | Iteration workflow and document-role index              |
| `iterations/state.json`                                                   | Sole M0–M8 state authority                              |
| `iterations/state.schema.json`                                            | Schema v2 for iteration state                           |
| `iterations/templates/*.md`                                               | Five reusable document-role templates                   |
| `iterations/M0-foundation/*`                                              | M0 three entries, working test report, future exit path |
| `iterations/M1-document-core/*` through `iterations/M8-windows-release/*` | Three ready-input documents per future iteration        |

### Validation

| Path                                          | Responsibility                                                       |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `scripts/planning/iteration-model.mjs`        | Pure state/reference/test-table validation                           |
| `scripts/planning/iteration-model.d.mts`      | Strict declarations for TypeScript tests                             |
| `scripts/verify-planning-docs.mjs`            | Filesystem orchestration, links, coverage and active-language checks |
| `tests/unit/planning/iteration-model.spec.ts` | State, dependencies, case parsing and fail-closed regressions        |

### Governing documents

| Path                                         | Responsibility                                    |
| -------------------------------------------- | ------------------------------------------------- |
| `AGENTS.md`                                  | One-iteration execution rules                     |
| `docs/03-architecture.md`                    | Iteration ownership for architecture decisions    |
| `docs/04-technology-stack.md`                | Iteration ownership for dependency reviews        |
| `docs/05-data-safety-and-security.md`        | Iteration ownership for security controls         |
| `docs/06-ui-interaction-spec.md`             | Iteration ownership for UI capabilities           |
| `docs/07-iteration-roadmap.md`               | M0–M8 scope and dependency roadmap                |
| `docs/08-development-plan.md`                | Iteration entry/development/exit workflow         |
| `docs/09-test-strategy.md`                   | Iteration-level test allocation and report policy |
| `docs/11-codex-cli-runbook.md`               | Commands for selecting and finishing an iteration |
| `docs/14-planning-acceptance.md`             | New planning acceptance contract                  |
| `docs/15-public-contracts.md`                | Iteration ownership for public contracts          |
| `docs/README.md`                             | Active planning and archive links                 |
| `docs/16-project-structure-and-standards.md` | Ownership of `iterations/` and archive            |
| `docs/17-settings-and-storage-schema.md`     | Iteration ownership for schema migrations         |
| `docs/18-error-catalog.md`                   | Iteration ownership for error contracts           |

### Historical archive

| Source                                                                   | Destination                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `tasks/**`                                                               | `docs/archive/task-model-v1/tasks/**`                     |
| `docs/test-cases/M0-*.md` through `M8-*.md`                              | `docs/archive/task-model-v1/test-cases/**`                |
| `docs/evidence/M0-T*.md`                                                 | `docs/archive/task-model-v1/evidence/**`                  |
| T-level files in `docs/superpowers/specs/` and `docs/superpowers/plans/` | `docs/archive/task-model-v1/superpowers/{specs,plans}/**` |
| none                                                                     | `docs/archive/task-model-v1/README.md` provenance index   |

---

### Phase 1: Preserve and Finish the Interrupted M0 Safety Fix

**Files:**

- Existing worktree: `.worktrees/m0-t06-ci-audit-gate`
- Modify: `tests/helpers/bootstrap-project.ts`
- Modify: `tests/unit/helpers/bootstrap-project.spec.ts`

**Interfaces:**

- Consumes: branch `codex/m0-t06-ci-audit-gate` at `ea8aac1`
- Produces: one reviewed M0 commit that fails closed on malformed `pnpm ignored-builds` output

- [ ] **Step 1: Confirm the preserved work before mutation**

```powershell
git -C .worktrees/m0-t06-ci-audit-gate status --short --branch
git -C .worktrees/m0-t06-ci-audit-gate diff -- tests/helpers/bootstrap-project.ts tests/unit/helpers/bootstrap-project.spec.ts
```

Expected: exactly the two known files are modified and HEAD is `ea8aac1`; no file is discarded.

- [ ] **Step 2: Run the focused parser test**

```powershell
pnpm.cmd test -- tests/unit/helpers/bootstrap-project.spec.ts
```

Expected: legal automatic/explicit sections pass; unknown suffixes, naked lines, mixed `None`, missing headings and malformed sections fail closed.

- [ ] **Step 3: Run related integration and full regression**

```powershell
pnpm.cmd test:integration
pnpm.cmd check
git diff --check
```

Expected: all commands exit 0. Run under the normal Windows process environment when sandboxed process cleanup would create a false failure.

- [ ] **Step 4: Commit the preserved safety fix**

```powershell
git add tests/helpers/bootstrap-project.ts tests/unit/helpers/bootstrap-project.spec.ts
git diff --cached --check
git commit -m "fix(M0): reject malformed ignored-build output"
```

Record the resulting SHA; do not merge or delete the branch.

---

### Phase 2: Build the Iteration State Core With TDD

**Files:**

- Create: `scripts/planning/iteration-model.mjs`
- Create: `scripts/planning/iteration-model.d.mts`
- Create: `tests/unit/planning/iteration-model.spec.ts`
- Create: `iterations/state.schema.json`
- Create: `iterations/state.json`

**Interfaces:**

- Produces:

```ts
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
export function parseIterationTestCases(
  text: string,
  iterationId: string
): {
  readonly automated: readonly string[]
  readonly manual: readonly string[]
  readonly errors: readonly string[]
}
```

- [ ] **Step 1: Write failing state-model tests**

Add tests proving:

- valid M0–M8 linear state passes;
- missing/duplicate/out-of-range IDs fail;
- a `Mx-Tnn` ID fails;
- dependency cycles, self-dependency and unknown dependency fail;
- more than one `in_progress`/`awaiting_manual` iteration fails;
- M0 is `in_progress`, M1–M8 are `blocked`, and a blocked iteration whose dependency passed fails;
- `passed` manual gates require manual evidence and both exit paths;
- invalid RFC 3339 evidence time fails.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd test -- tests/unit/planning/iteration-model.spec.ts
```

Expected: FAIL because `scripts/planning/iteration-model.mjs` does not exist.

- [ ] **Step 3: Add schema v2 and the initial state**

`iterations/state.schema.json` must require exactly:

```json
{
  "schema_version": 2,
  "product_baseline": "non-empty string",
  "current_iteration": "M0 through M8",
  "allowed_statuses": "the six fixed statuses",
  "iterations": "nine unique iteration records"
}
```

Create `iterations/state.json` with M0 `in_progress`, no M0 dependency, and M1→M0 through M8→M7 linear dependencies. M0 is a manual gate; retain the existing manual-gate intent for later iterations in their iteration records. Do not copy old task evidence into state; reports own detailed history.

- [ ] **Step 4: Implement the pure validator**

The implementation must:

- return error strings rather than call `process.exit`;
- reject unknown object properties and malformed entry/exit paths;
- require paths to stay repository-relative and to match their owning iteration directory;
- enforce status/dependency/evidence rules from the design;
- parse `TC-Mx-*` and `MAN-Mx-*` tables without a task column;
- reject duplicate IDs and case/iteration mismatches;
- expand requirement ranges such as `DOC-001..008` deterministically.

- [ ] **Step 5: Run GREEN and strict checks**

```powershell
pnpm.cmd test -- tests/unit/planning/iteration-model.spec.ts
pnpm.cmd typecheck
git diff --check
```

Expected: new unit tests and strict type checks pass.

- [ ] **Step 6: Commit the state core**

```powershell
git add iterations/state.json iterations/state.schema.json scripts/planning tests/unit/planning
git diff --cached --check
git commit -m "chore: introduce iteration-level state model"
```

---

### Phase 3: Create M0–M8 Entry Documents and Templates

**Files:**

- Create: `iterations/README.md`
- Create: `iterations/templates/requirements.md`
- Create: `iterations/templates/detailed-design.md`
- Create: `iterations/templates/test-cases.md`
- Create: `iterations/templates/test-report.md`
- Create: `iterations/templates/exit-report.md`
- Create: three entry files under each `iterations/M0-foundation/` through `iterations/M8-windows-release/`
- Create: `iterations/M0-foundation/04-test-report.md`

**Interfaces:**

- Consumes: global requirement IDs from `docs/01-product-requirements.md`, compatibility IDs from `docs/02-compatibility-matrix.md`, old milestone specs and old test-case matrices
- Produces: complete entry documents with no subtask ownership

- [ ] **Step 1: Create the five templates**

Each template must contain the exact sections defined by the design. Templates use the documented literal marker `{{ITERATION_ID}}`, while instantiated documents must contain no unresolved marker, `TBD` or “待定”.

- [ ] **Step 2: Consolidate the nine requirement documents**

Use these exact scope mappings:

| Iteration | Required coverage                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| M0        | `NFR-007..009`, `UI-001..002`, engineering foundation, CI/audit/package gate                                      |
| M1        | `DOC-001..010`, `EDT-002..003`, `EDT-005`, `EDT-009`, `EDT-013`, `UI-001`, `COMP-001..004`, `COMP-036`, `NFR-001` |
| M2        | `EDT-001..008`, `EDT-014`, `MD-001..003`, `MD-008`, `COMP-005..009`                                               |
| M3        | `WS-001..008`, `UI-001..002`, `UI-006`, `OS-001`, `OS-004`, `COMP-010..013`, `NFR-005`                            |
| M4        | `MD-003..012`, `EDT-004`, `COMP-014..020`                                                                         |
| M5        | `EDT-010..012`, `IMG-001..006`, `UI-003..004`, `COMP-021..024`                                                    |
| M6        | `EXP-001..009`, `COMP-025..029`, `NFR-007`                                                                        |
| M7        | `UI-005..008`, `DOC-010`, `NFR-001..006`, `NFR-009..010`, `COMP-001..036`                                         |
| M8        | `OS-001..003`, `OS-005..006`, `COMP-033..035`, release security and stable audit                                  |

Every document includes objectives, non-goals, external dependencies, risks, iteration-level acceptance criteria and links to global architecture/security rules.

- [ ] **Step 3: Consolidate the nine detailed designs**

Convert old task headings into unnumbered capability sections and an implementation-order checklist. Preserve all architecture, dependency, data-safety, failure and manual-gate decisions, but remove task statuses, unlock claims and per-task report requirements.

- [ ] **Step 4: Consolidate the nine test-case documents**

Copy every existing `TC-Mx-*` and `MAN-Mx-*` case exactly once. Replace the old task-owner column with `覆盖能力`; use descriptive values such as `原子保存与冲突处理` rather than `M1-T03`. Preserve automation target, parameter matrix, fixtures, expected result, evidence and stop conditions.

- [ ] **Step 5: Create the working M0 test report**

Record:

- main baseline `6db91f13f88f5349f4afea24525fcf64b7d00d82`;
- archived evidence for the completed bootstrap, quality toolchain, secure Electron shell, shared contracts and command shell work;
- preserved branch/commit references for `ea8aac1` and the Phase 1 safety-fix SHA;
- status `in_progress`; CI/audit/package/ruleset/manual gate remain incomplete;
- no M0 exit conclusion.

- [ ] **Step 6: Run document formatting and coverage preparation checks**

```powershell
pnpm.cmd exec prettier --check iterations
rg -n "M[0-8]-T[0-9]{2}|TBD|待定" iterations -g "!M0-foundation/04-test-report.md"
git diff --check
```

Expected: Prettier passes; no instantiated entry document contains task IDs or unresolved content. Historical filenames may appear only in M0 test-report links.

- [ ] **Step 7: Commit iteration documents**

```powershell
git add iterations
git diff --cached --check
git commit -m "docs: consolidate planning by iteration"
```

---

### Phase 4: Rewrite the Planning Verifier and Active Runbooks

**Files:**

- Modify: `scripts/verify-planning-docs.mjs`
- Modify: `AGENTS.md`
- Modify: `docs/03-architecture.md`
- Modify: `docs/04-technology-stack.md`
- Modify: `docs/05-data-safety-and-security.md`
- Modify: `docs/06-ui-interaction-spec.md`
- Modify: `docs/07-iteration-roadmap.md`
- Modify: `docs/08-development-plan.md`
- Modify: `docs/09-test-strategy.md`
- Modify: `docs/11-codex-cli-runbook.md`
- Modify: `docs/14-planning-acceptance.md`
- Modify: `docs/15-public-contracts.md`
- Modify: `docs/16-project-structure-and-standards.md`
- Modify: `docs/17-settings-and-storage-schema.md`
- Modify: `docs/18-error-catalog.md`
- Modify: `docs/README.md`

**Interfaces:**

- Consumes: `iterations/state.json`, schema v2 and the iteration documents
- Produces: `node scripts/verify-planning-docs.mjs` with one deterministic pass/fail result

- [ ] **Step 1: Capture the old planning verifier behavior**

Run before replacing it:

```powershell
node scripts/verify-planning-docs.mjs
```

Expected: exit 0 with a summary containing `77 tasks`. Record this as characterization evidence that the old command still validates the obsolete model and does not prove the new iteration contract.

- [ ] **Step 2: Rewrite the verifier orchestration**

Import the pure functions from `scripts/planning/iteration-model.mjs` and validate:

- exact M0–M8 state and all entry paths;
- output files only when status requires them (`04-test-report.md` for active/awaiting/passed; `05-exit-report.md` for passed);
- requirement and `COMP-*` coverage across iteration requirements;
- unique iteration-matching `TC-*`/`MAN-*` cases and valid automation targets;
- required sections, balanced fences and local links;
- no active execution instruction matching `\bM[0-8]-T\d{2}\b`, `tasks/state.json`, `current_task` or task-unlock language in `AGENTS.md`, `iterations/`, and active runbooks;
- `AGENTS.md` stays below 32 KiB;
- archive files are excluded from active coverage and language scans.

Keep existing dependency-table and Pandoc contract checks, but point their planning ownership to M6 entry/test documents instead of old tasks.

- [ ] **Step 3: Rewrite `AGENTS.md` and runbooks**

Replace one-task selection with one-iteration execution. Update every listed active product document so ownership references point to `M0`–`M8`, never `Mx-Tnn`. Specify:

- read state plus the three current entry documents;
- no subtask plan/state/report generation;
- focused tests during development and full gates at iteration exit;
- test report before `awaiting_manual`, exit report plus manual evidence before `passed`;
- documentation and product architecture invariants remain mandatory.

- [ ] **Step 4: Run GREEN and targeted tests**

```powershell
pnpm.cmd test -- tests/unit/planning/iteration-model.spec.ts
node scripts/verify-planning-docs.mjs
pnpm.cmd exec prettier --check AGENTS.md iterations scripts/planning scripts/verify-planning-docs.mjs tests/unit/planning docs/03-architecture.md docs/04-technology-stack.md docs/05-data-safety-and-security.md docs/06-ui-interaction-spec.md docs/07-iteration-roadmap.md docs/08-development-plan.md docs/09-test-strategy.md docs/11-codex-cli-runbook.md docs/14-planning-acceptance.md docs/15-public-contracts.md docs/16-project-structure-and-standards.md docs/17-settings-and-storage-schema.md docs/18-error-catalog.md docs/README.md
git diff --check
```

Expected: all commands exit 0 and verifier summary reports 9 iterations rather than 77 tasks.

- [ ] **Step 5: Commit active governance**

```powershell
git add AGENTS.md iterations scripts/planning scripts/verify-planning-docs.mjs tests/unit/planning docs/03-architecture.md docs/04-technology-stack.md docs/05-data-safety-and-security.md docs/06-ui-interaction-spec.md docs/07-iteration-roadmap.md docs/08-development-plan.md docs/09-test-strategy.md docs/11-codex-cli-runbook.md docs/14-planning-acceptance.md docs/15-public-contracts.md docs/16-project-structure-and-standards.md docs/17-settings-and-storage-schema.md docs/18-error-catalog.md docs/README.md
git diff --cached --check
git commit -m "chore: activate iteration-level governance"
```

---

### Phase 5: Archive the Legacy Task Model Without Data Loss

**Files:**

- Create: `docs/archive/task-model-v1/README.md`
- Move: sources listed in the File Map into `docs/archive/task-model-v1/`
- Modify: `docs/test-cases/README.md`

**Interfaces:**

- Produces: immutable historical paths reachable from the archive index but ignored by active validation

- [ ] **Step 1: Record the exact archive manifest before moving**

The archive README records original path, destination, purpose and the main/feature commit holding the source. It explicitly states that T IDs are historical and never selectable.

- [ ] **Step 2: Move files with Git-aware renames**

Use `git mv` for each bounded source group. Keep `docs/test-cases/fixture-catalog.md` as a shared active fixture catalog; replace `docs/test-cases/README.md` with a short pointer to `iterations/*/03-test-cases.md` and the archive.

- [ ] **Step 3: Prove archive exclusion and link integrity**

```powershell
node scripts/verify-planning-docs.mjs
rg -n "tasks/state.json|current_task|M[0-8]-T[0-9]{2}" AGENTS.md iterations docs -g "!archive/**" -g "!superpowers/**" -g "!M0-foundation/04-test-report.md"
git diff --check
```

Expected: verifier passes; the active scan has no matches except explicitly allowed historical links in the M0 test report.

- [ ] **Step 4: Commit the archive migration**

```powershell
git add -A -- tasks docs/archive docs/test-cases docs/superpowers
git diff --cached --check
git commit -m "docs: archive legacy task planning"
```

---

### Phase 6: Integrate the Preserved M0 Implementation

**Files:**

- Cherry-pick: `ea8aac1` (`build(M0-T06): admit packager and brand assets`)
- Cherry-pick: Phase 1 safety-fix SHA
- Update: `iterations/M0-foundation/02-detailed-design.md`
- Update: `iterations/M0-foundation/04-test-report.md`

**Interfaces:**

- Consumes: only implementation commits from the preserved branch
- Excludes: `9a286ad` and `c50a8e0`, whose T-level state/document changes remain historical

- [ ] **Step 1: Cherry-pick the two reviewed implementation commits**

```powershell
git cherry-pick ea8aac1
$m0SafetySha = git -C .worktrees/m0-t06-ci-audit-gate rev-parse codex/m0-t06-ci-audit-gate
git cherry-pick $m0SafetySha
```

Resolve only real content conflicts. Do not reintroduce `tasks/state.json` or active T-level contracts.

- [ ] **Step 2: Install from the resulting frozen lockfile**

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd ignored-builds
```

Expected: `electron-builder@26.15.3` is exact; automatic pending builds are `None`; `electron-winstaller` remains explicitly denied because Squirrel is not used.

- [ ] **Step 3: Verify assets and M0 regressions**

```powershell
node scripts/assets/build-lattice-icon.mjs --check
pnpm.cmd test -- tests/unit/helpers/bootstrap-project.spec.ts tests/unit/planning/iteration-model.spec.ts
pnpm.cmd test:integration
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git diff --check
```

Expected: all commands exit 0; asset hashes match the reviewed README; malformed ignored-build output remains rejected.

- [ ] **Step 4: Update M0 entry/report facts**

Mark dependency admission, brand assets and parser hardening as implemented in the detailed design sequence. Add exact commands, exit codes, hashes and commit SHAs to the working test report. Keep CI/audit/package/ruleset/manual items incomplete and M0 `in_progress`.

- [ ] **Step 5: Commit the M0 integration record**

```powershell
git add iterations/M0-foundation/02-detailed-design.md iterations/M0-foundation/04-test-report.md
git diff --cached --check
git commit -m "docs(M0): record retained foundation work"
```

---

### Phase 7: Final Review, Verification and Integration

**Files:**

- Review: all changes from `c6f3fab` to final HEAD
- Update if necessary: only files with verified review findings

**Interfaces:**

- Produces: one clean iteration-governance branch ready for GitHub review and main integration

- [ ] **Step 1: Run final local gates once**

```powershell
node scripts/verify-planning-docs.mjs
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
git diff --check main...HEAD
git status --short --branch
```

All commands are bounded. If Electron process cleanup needs normal Windows privileges, rerun once in that environment and record the reason.

- [ ] **Step 2: Perform whole-branch review**

Review for:

- lost requirements, compatibility cases or historical evidence;
- active T-level state/instructions;
- state/schema/verifier disagreement;
- broken links or archive paths;
- premature M0 completion;
- lost or weakened M0 security/dependency behavior.

Fix only verified findings and rerun their covering checks.

- [ ] **Step 3: Push and merge through GitHub**

```powershell
git push -u origin codex/iteration-governance
gh pr create --repo dctorwho/lattice --base main --head codex/iteration-governance --title "Replace task tree with iteration-level governance" --body "Replaces active T-level planning with M0-M8 iteration governance, archives legacy artifacts, preserves existing M0 work, and keeps M0 in progress."
gh pr checks --repo dctorwho/lattice --watch --interval 10 --fail-fast
```

Wrap the check watch in the existing outer 30-minute timeout. Merge only when all checks are green, then update local main with fast-forward only. Do not delete `codex/m0-t06-ci-audit-gate` until the integrated SHAs and preserved history are verified reachable.

- [ ] **Step 4: Verify final state on main**

```powershell
git rev-parse main
git rev-parse origin/main
node scripts/verify-planning-docs.mjs
git status --short --branch
```

Expected: local and remote main match; state contains only M0–M8; M0 remains `in_progress`; the worktree is clean.
