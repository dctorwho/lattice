# M0 test report

## Iteration context

- Iteration: `M0`
- Current status: `in_progress`
- State authority: [`iterations/state.json`](../state.json)
- Test contract: [`03-test-cases.md`](03-test-cases.md)
- Manual gate: required

Historical `Mx-Tnn` names below are evidence labels only. They do not define
active work ownership or an active planning hierarchy.
The five linked legacy records are historical inputs in the read-only
task-model archive.

## Report status

This is the controlled working test report for M0. It consolidates evidence
that existed before the iteration-governance migration and will be extended as
the remaining M0 gates run. It is not an iteration-completion record.

## Scope

The report currently covers the reproducible project bootstrap, executable
quality toolchain, secure Electron shell, strict shared IPC contracts, command
registry and accessible window shell. It also records the integrated
dependency admission, deterministic branding assets and fail-closed
ignored-build parser work.

The remaining scope is the CI-equivalent gate, complete dependency and license
audit, SBOM generation, packaged-artifact inspection and launch, GitHub
ruleset verification, and the M0 manual review.

## Baseline and environment

- Main baseline: `6db91f13f88f5349f4afea24525fcf64b7d00d82`.
- Historical Windows evidence used Node.js `v24.18.0`, Corepack `0.35.0`,
  pnpm `11.12.0`, and Electron `v43.1.1`.
- PowerShell evidence used `pnpm.cmd` or `corepack pnpm` where the host
  execution policy blocked the generated `pnpm.ps1` shim.
- Preserved implementation branch: `codex/m0-t06-ci-audit-gate`.
- Integrated dependency and brand-asset commit:
  `3ae487861f0535f2d17e8558aebc5f15bb37cb78`, derived from preserved commit
  `ea8aac1a94d89d0ffdb61f91882b661c8f5eb856`.
- Integrated fail-closed ignored-build parser commit:
  `644ad699384cfe608a84132b44ebbb43af950817`, derived from preserved commit
  `a82f9369d958fbcd9c9c91a7dc410436f5205d35`.
- Legacy task-state and task-documentation commits `9a286ad` and `c50a8e0`
  were intentionally excluded from integration.

No fresh product, packaging or manual verification is claimed merely because
this report consolidates earlier records.

## Existing validation

| Capability                                    | Historical evidence                                                                                                                          | Recorded result                                                                                                                                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible bootstrap                        | [Legacy M0-T01 bootstrap evidence](../../docs/archive/task-model-v1/evidence/M0-T01-bootstrap-2026-07-18.md)                                 | Frozen installation, development-window smoke, two production builds, strict type checks and a Chinese-and-space-path repeatability run exited `0`; the required artifact hashes matched across the repeated builds.                                                    |
| Quality toolchain                             | [Legacy M0-T02 quality-toolchain evidence](../../docs/archive/task-model-v1/evidence/M0-T02-quality-toolchain-2026-07-18.md)                 | Two consecutive `pnpm check` runs and the closure run exited `0`; unit, integration, E2E, security, performance-harness, offline-bootstrap and cold-bootstrap gates were recorded.                                                                                      |
| Secure Electron shell                         | [Legacy M0-T03 secure-shell evidence](../../docs/archive/task-model-v1/evidence/M0-T03-secure-electron-shell-2026-07-25.md)                  | The full quality gate passed with 105 unit and 18 integration tests; focused real-Electron security and navigation gates passed, with sandboxing, privilege denial, CSP, permission and external-navigation policies verified.                                          |
| Shared contracts and errors                   | [Legacy M0-T04 shared-contract evidence](../../docs/archive/task-model-v1/evidence/M0-T04-shared-contracts-2026-07-26.md)                    | The full quality gate passed with 259 unit and 18 integration tests; focused Electron security and E2E gates passed 2/2 each, covering strict schemas, sender ownership, bounded values, stable errors, redacted logs and the frozen preload API.                       |
| Command registry and window shell             | [Legacy M0-T05 command-shell evidence](../../docs/archive/task-model-v1/evidence/M0-T05-command-window-shell-2026-08-02.md)                  | The full quality gate passed with 324 unit and 18 integration tests; real-Electron E2E passed 3/3 and security passed 2/2, covering one command authority, native-menu projection, shared entry paths, localization, focus and preload boundaries.                      |
| Dependency, brand assets and parser hardening | Integrated commits `3ae487861f0535f2d17e8558aebc5f15bb37cb78` and `644ad699384cfe608a84132b44ebbb43af950817`; retained-work execution record | `electron-builder@26.15.3`, reviewed Lattice assets and dependency metadata are integrated. Frozen installation, asset verification, focused unit, standalone integration and full quality verification exited `0`; malformed `pnpm ignored-builds` output is rejected. |

## Executed commands and results

This table reproduces commands and outcomes from the linked historical evidence
and the preserved-work execution record. It does not represent a new M0 exit
run.

| Date       | Environment                                                          | Command or procedure                                                                          | Exit code | Cases or coverage                                            | Result                                                                                          | Evidence                                                                                                    |
| ---------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-07-18 | Windows ordinary-user paths, including Chinese characters and spaces | Frozen install, development-window smoke, two builds and strict TypeScript checks             | `0`       | TC-M0-001 / ENV-M0-A                                         | Repeatable bootstrap and stable required-artifact hashes                                        | [Bootstrap record](../../docs/archive/task-model-v1/evidence/M0-T01-bootstrap-2026-07-18.md)                |
| 2026-07-19 | Windows `10.0.26200.0`; Node `v24.18.0`; pnpm `11.12.0`              | Two consecutive `pnpm check` runs plus the post-state closure run                             | `0`       | 61 unit and 18 integration tests per recorded full run       | Offline format, lint, typecheck, unit, integration and production-build chain passed            | [Quality record](../../docs/archive/task-model-v1/evidence/M0-T02-quality-toolchain-2026-07-18.md)          |
| 2026-07-19 | Same quality environment                                             | E2E, security, performance harness, cold bootstrap and focused offline bootstrap              | `0`       | TC-M0-001, TC-M0-002 and TC-M0-008 evidence                  | Explicit foundation gates passed and cleanup scans were clean                                   | [Quality record](../../docs/archive/task-model-v1/evidence/M0-T02-quality-toolchain-2026-07-18.md)          |
| 2026-07-26 | Windows; pnpm `11.12.0`; Electron `43.1.1`                           | Full `pnpm check` and focused real-Electron security/navigation commands                      | `0`       | 105 unit, 18 integration, security 1/1 and E2E 1/1           | Secure window, navigation, permission, CSP and privilege boundaries passed                      | [Secure-shell record](../../docs/archive/task-model-v1/evidence/M0-T03-secure-electron-shell-2026-07-25.md) |
| 2026-07-31 | Windows; pnpm `11.12.0`; Electron production build                   | Full `pnpm check`, focused security and E2E commands                                          | `0`       | 259 unit, 18 integration, security 2/2 and E2E 2/2           | Shared contract and preload boundaries passed                                                   | [Shared-contract record](../../docs/archive/task-model-v1/evidence/M0-T04-shared-contracts-2026-07-26.md)   |
| 2026-08-02 | Windows normal process environment                                   | Full `pnpm check`, real-Electron E2E and security commands                                    | `0`       | 324 unit, 18 integration, E2E 3/3 and security 2/2           | Command shell, lifecycle, accessibility and security regressions passed                         | [Command-shell record](../../docs/archive/task-model-v1/evidence/M0-T05-command-window-shell-2026-08-02.md) |
| 2026-08-04 | Preserved branch, normal Windows process environment                 | Focused bootstrap helper tests, `pnpm.cmd test:integration`, `pnpm.cmd check` and diff checks | `0`       | Focused parser matrix plus full unit/integration/build chain | Malformed ignored-build output is rejected; formatting, lint, typecheck, tests and build passed | Phase 1 execution record and commit `a82f936`                                                               |

### Retained-work integration verification

The following finite commands were executed after the two retained
implementation commits were integrated. They are integration evidence, not an
M0 exit run.

| Command                                                                                                     | Exit code | Recorded result                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd install --frozen-lockfile`                                                                        | `0`       | pnpm `11.12.0`; `251` packages reused, `0` downloaded; the frozen graph contains exact `electron-builder@26.15.3`.                                                                                |
| `pnpm.cmd ignored-builds`                                                                                   | `0`       | Historical result: automatically ignored builds were `None`; the then-current explicit denial of `electron-winstaller` has since been superseded by the dependency-edge removal recorded below.   |
| `node scripts/assets/build-lattice-icon.mjs --check`                                                        | `0`       | PNG SHA-256 `4317ae0aecca27dddd570e511b073bc8b6963e46a49fe025d2c4c98775036014`; ICO SHA-256 `06e6f68ec6f11a92e6df43e35c83f72abe1f6eeff6fa378328fc17a3ff36896c`, matching `build/brand/README.md`. |
| `pnpm.cmd test -- tests/unit/helpers/bootstrap-project.spec.ts tests/unit/planning/iteration-model.spec.ts` | `0`       | pnpm-managed unit run passed `26` files and `400` tests, including the strict ignored-build parser and iteration model.                                                                           |
| `pnpm.cmd test:integration`                                                                                 | `0`       | Standalone integration run passed `2` files and `18` tests.                                                                                                                                       |
| `node scripts/verify-planning-docs.mjs`                                                                     | `0`       | Verified `9` iterations, `86` automated cases, `13` manual cases, `83` requirements and `36` compatibility items.                                                                                 |
| `pnpm.cmd check`                                                                                            | `0`       | Format, lint, strict type checking, `400` unit tests, `18` integration tests and the production build passed.                                                                                     |

The asset hash values above were also checked against the committed files and
the exact values recorded in `build/brand/README.md`. Direct execution of a
pnpm-managed tool shim outside pnpm's supported invocation context was treated
only as an excluded diagnostic precondition and is not acceptance evidence.

### Governance-gate corrections during integration

Three follow-up commits were required to make the new iteration-governance
gate accurately evaluate the integrated repository. They change governance
formatting, verification or test-fixture behavior only and are not M0 product
implementation:

| Commit    | Correction                                                                         | Reason                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `5aead02` | Exclude `docs/archive/task-model-v1` from active Prettier checks.                  | The archive is immutable historical evidence and must not be rewritten by the active formatting gate.                         |
| `99b9e53` | Remove an unnecessary initial value in the planning verifier's regular-file probe. | The iteration verifier remained fail-closed while satisfying the active no-warning lint gate.                                 |
| `7798105` | Guard the optional regex capture before a planning-fixture target is joined.       | The fixture now fails explicitly on a missing capture and satisfies strict type checking without weakening target validation. |

## Failures, fixes, and regression evidence

| Finding                                                                                                                                           | Impact                                                                                         | Resolution                                                                                                                                                               | Regression evidence                                                                                         | Status                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Electron 43 runtime was not present immediately after package installation, and the initial development launch reached the runtime path too late. | A successful install did not by itself prove that the application window could start.          | The development script now resolves Electron before `electron-vite dev`; the runtime was downloaded with Electron checksums enabled.                                     | Two responding development-window smoke runs and two successful builds in the bootstrap record.             | Resolved in the main baseline.                       |
| Externalized Zod prevented the sandboxed preload from exposing the approved API.                                                                  | The shared IPC contract was unavailable at runtime.                                            | Preload bundling now inlines only Zod; real-Electron tests verify the exact frozen API and continued privilege denial.                                                   | Shared-contract security and E2E evidence.                                                                  | Resolved in the main baseline.                       |
| Some malformed `pnpm ignored-builds` output could be interpreted too permissively.                                                                | Dependency-build admission could fail open on an unknown or malformed output suffix.           | Integrated commit `644ad699384cfe608a84132b44ebbb43af950817` validates the complete automatic section and optional exact explicit section, with fail-closed regressions. | Focused parser tests, integration tests and the full quality gate passed in the normal Windows environment. | Resolved and integrated.                             |
| Sandboxed child-process cleanup reported `taskkill exited with 1` during the preserved-work check.                                                | The sandbox produced an environment-specific false failure in unrelated timeout cleanup tests. | The same finite checks were run once in the normal Windows process environment without weakening cleanup assertions.                                                     | Focused, integration and full quality gates exited `0`; `git diff --check` was clean.                       | Environment issue resolved for the preserved commit. |

## Unused Squirrel peer correction (2026-08-15)

GitHub quality run
[`31871899038`](https://github.com/dctorwho/lattice/actions/runs/31871899038)
showed that retrying the same pnpm import operation did not resolve the
Windows `EPERM` failure: the second bounded attempt failed on the same
`electron-winstaller` rename. That retry is excluded from acceptance evidence
and has been removed.

The replacement policy removes only the unused
`app-builder-lib@26.15.3 -> electron-builder-squirrel-windows` peer edge. A
fresh offline resolution installed `489` packages with pnpm `11.12.0`, did not
install either Squirrel package, and `pnpm peers check` reported no peer issues.
The focused configuration and bootstrap-helper regression run passed `25/25`
tests. The isolated offline bootstrap passed `1/1`, including a frozen install
in a Chinese-and-space path, no automatically ignored build, and two identical
production builds. A subsequent `pnpm.cmd check` passed formatting, lint,
strict type checking, `423/423` unit tests, `18/18` integration tests and the
production build. These are correction-development results, not M0 exit
evidence; the GitHub CI gate and remaining M0 exit work listed below still
govern acceptance.

## Blockers

- The CI, full audit, SBOM, packaged-artifact and GitHub ruleset gates do not
  yet have passing evidence.
- MAN-M0-001 has not been handed to a designated evaluator because its
  automated prerequisites are incomplete.

## Unexecuted verification

The following M0 gates are not complete and must not be inferred from earlier
foundation evidence:

- CI workflow execution from a clean checkout with the documented Windows
  command set.
- Complete direct and transitive dependency, permission and license audit.
- CycloneDX SBOM generation and validation against production dependencies.
- Final installer/package generation, packaged-artifact inspection, hash
  capture and ordinary-user launch verification.
- Verification that the packaged renderer has no development URL, Node access,
  raw IPC or unapproved preload capability.
- GitHub branch ruleset and required-check enforcement on the public
  repository.
- TC-M0-007 as the consolidated CI/audit/package gate.
- MAN-M0-001 by the user or another designated evaluator.
- Applicable Electron E2E/security suites and final exact-candidate
  verification after the remaining CI/audit/package work changes the branch.

## Coverage

| Test contract area                              | Current evidence state                 | Remaining work                                                                                                |
| ----------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| TC-M0-001 reproducible bootstrap                | Historical automated evidence recorded | Re-run only if the final dependency/packaging integration changes bootstrap inputs.                           |
| TC-M0-002 quality failure sensitivity           | Historical automated evidence recorded | Include in the final exact-candidate quality gate.                                                            |
| TC-M0-008 cold bootstrap                        | Historical automated evidence recorded | Re-run after dependency admission if required by the final test contract.                                     |
| TC-M0-003 secure renderer boundary              | Historical automated evidence recorded | Confirm again against the packaged candidate.                                                                 |
| TC-M0-004 navigation and external-link policy   | Historical automated evidence recorded | Confirm again against the exact candidate; the exact 2,081 UTF-16-code-unit acceptance edge remains unproved. |
| TC-M0-005 shared contracts and preload API      | Historical automated evidence recorded | Confirm the exact preload surface after packaging integration.                                                |
| TC-M0-006 command registry and window shell     | Historical automated evidence recorded | Include in the final Electron regression run.                                                                 |
| TC-M0-007 CI, audit, SBOM and packaged artifact | Not complete                           | Implement and execute the full consolidated gate.                                                             |
| MAN-M0-001 ordinary-user production review      | Not executed                           | Designated evaluator must record screenshots, hashes, audit artifacts and a signed conclusion.                |

## Residual risks

- The historical runs prove their recorded commits, not the future exact M0
  candidate after the remaining gate implementation is integrated.
- Earlier pnpm evidence included an ambiguous root `ignored-builds` rendering.
  The integrated fail-closed parser and successful frozen-install verification
  reduce that interpretation risk; later dependency changes still require the
  same exact-candidate check.
- Exact acceptance at the external-URL policy limit of 2,081 UTF-16 code units
  remains unproved even though over-limit rejection is covered.
- No SBOM, complete license decision, packaged installer proof, GitHub ruleset
  proof or human production sign-off exists yet.

## Manual results

No M0 manual procedure has been executed, and no manual pass/fail conclusion is
recorded. MAN-M0-001 remains blocked on the automated prerequisites listed
above.

## Manual-gate handoff

| Manual case | Required evaluator                                                     | Evidence location                                                                                                       | Current handoff status                                                                       |
| ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| MAN-M0-001  | User or designated release evaluator on Windows 11 as an ordinary user | This working report, final package hashes, screenshots, dependency/license audit, SBOM and GitHub check/ruleset records | Not ready: automated CI, audit, package and repository-rule prerequisites remain incomplete. |

The agent preparing this report does not supply the manual conclusion.

## Exit-readiness statement

M0 remains `in_progress`. This report records execution evidence only and does
not conclude that M0 has passed. No `05-exit-report.md` should be created from
this evidence set. The final completion decision, delivery summary and M1
inputs belong exclusively in `05-exit-report.md` after every automated gate and
MAN-M0-001 have passed.
