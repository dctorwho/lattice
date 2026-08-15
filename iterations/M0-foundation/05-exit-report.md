# M0 exit report

## Iteration context

- Iteration: `M0`
- State authority: [`iterations/state.json`](../state.json)
- Evidence source: [`04-test-report.md`](04-test-report.md)
- Final automated product candidate:
  `3c4ae5d7f268165409570da5dc5d603e4149fda0`
- Automated-evidence handoff candidate:
  `ca29d806cbfda6cc6a961f7461d3b2ce7a9654ca`

## Requirement completion matrix

| Global ID | Required outcome                                                                                                                               | Completion evidence                                                                                                                       | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| NFR-007   | M0 core shell, build, package and native outputs do not require a runtime CDN or network dependency.                                           | Repeated offline bootstrap evidence, frozen installs, local package run and GitHub Quality package gate in `04-test-report.md`.           | passed |
| NFR-008   | M0 establishes strict, replaceable engineering boundaries and dependency-injected test seams without claiming later feature-specific adapters. | Fault-injection quality matrix, strict IPC contracts, command-registry tests and isolated bootstrap/audit helpers in `04-test-report.md`. | passed |
| NFR-009   | M0 structured diagnostics and IPC failures remain bounded and redact document content, complete paths and clipboard bodies.                    | Shared-contract, value-budget, redacted-log, security and packaged-app evidence in `04-test-report.md`.                                   | passed |
| UI-001    | The independently branded Electron shell provides the M0 title bar, sidebar control, editor area, status area and About surface.               | Command/window unit and Electron E2E evidence plus MAN-M0-001 in `04-test-report.md`.                                                     | passed |
| UI-002    | Native menu, renderer button, context menu and shortcut share one command identity and deterministic state/focus behavior.                     | Command-registry component tests, native-menu projection tests and Electron E2E evidence in `04-test-report.md`.                          | passed |

## Final deliverables

- Reproducible pnpm, TypeScript, Electron and Vite bootstrap with frozen and
  offline verification paths.
- Sandboxed production Electron shell, strict CSP/navigation/permission policy,
  confirmed external-link handling and no raw renderer Node/Electron authority.
- Zod-validated typed IPC contracts, bounded serialization, stable/redacted
  failures and the frozen preload API.
- Unified command registry projected into native menu, renderer controls,
  context menu and shortcuts, with localized accessible shell UI.
- Windows x64 NSIS and unpacked packages, packaged-application test, deterministic
  branding assets, dependency/license/vulnerability evidence and CycloneDX SBOM.
- SHA-pinned Quality, CodeQL and Dependency Review workflows plus an active main
  ruleset requiring all three checks without bypass actors.

## Material implementation and documentation changes

- Established the application bootstrap, strict build/test/lint/typecheck
  commands and isolated fault-sensitive test harnesses.
- Added Electron main/preload/renderer security boundaries, typed shared
  contracts and the command/window shell foundation used by later iterations.
- Added deterministic package configuration and local Electron-distribution
  reuse so packaging does not redownload the already pinned runtime.
- Added production and toolchain dependency audits, license review, SBOM,
  artifact hashes, workflow-policy verification and packaged-app execution.
- Replaced obsolete task-level governance with the M0-M8 iteration lifecycle,
  controlled entry/exit reports and fail-closed planning verification.

## Automated-gate conclusion

All eight M0 automated cases passed. The final local `pnpm.cmd check` passed
formatting, lint, strict type checking, `445/445` unit tests, `38/38`
integration tests and production build. Electron E2E passed `3/3`, security
passed `2/2`, packaged-app passed `1/1`, and the six-step M0 audit passed.

For the automated product candidate, GitHub Quality run
[`31888333255`](https://github.com/dctorwho/lattice/actions/runs/31888333255),
CodeQL run
[`31888333231`](https://github.com/dctorwho/lattice/actions/runs/31888333231)
and Dependency Review run
[`31888333221`](https://github.com/dctorwho/lattice/actions/runs/31888333221)
all passed. The subsequent automated-evidence handoff candidate also passed
Quality run
[`31889656495`](https://github.com/dctorwho/lattice/actions/runs/31889656495),
CodeQL run
[`31889657754`](https://github.com/dctorwho/lattice/actions/runs/31889657754)
and Dependency Review run
[`31889658419`](https://github.com/dctorwho/lattice/actions/runs/31889658419).
PR #1 was `MERGEABLE / CLEAN` under active ruleset
[`20752831`](https://github.com/dctorwho/lattice/rules/20752831).

## Manual-gate conclusion

MAN-M0-001 passed. On 2026-08-15 the user reported no observed issue and
accepted the candidate on the condition that all designed iteration test cases
passed. The controlled automated result table and both GitHub candidate runs
prove that condition. The evaluator conclusion, package hashes, audit reports,
SBOM and required-check proof are retained in `04-test-report.md`.

## Known limitations and residual risks

- The current Windows package is an engineering/M0 candidate, not a publicly
  code-signed M8 release; Windows release trust and signing remain assigned to
  M8.
- M0 does not implement document lifecycle, CodeMirror document authority,
  hybrid editing, workspaces, advanced Markdown, media/themes, export or final
  compatibility hardening; those remain explicitly assigned to M1-M8.
- Audit, SBOM and artifact hashes are candidate-specific and must be regenerated
  after dependency, package or workflow changes.

## Rollback approach

If the M0 merge causes a regression, revert the PR merge as one auditable main
branch change rather than rewriting history. Preserve the failed candidate's
logs, hashes and audit artifacts, restore the previous lockfile and package
configuration through the revert, add a regression test for the observed
failure, and reopen M0 before attempting a repaired candidate. M0 introduces no
user-document schema or migration requiring data rollback.

## Inputs released to the next iteration

- M1 may build on the sandboxed Electron window, frozen typed preload surface,
  strict shared-contract pattern and unified command registry.
- M1 inherits the reproducible pnpm/build/test harness, Windows Electron
  integration fixtures, quality workflows and required main-branch gates.
- M1 must keep the Markdown source string and bytes as document authority,
  introduce only narrow authorized file IPC, and preserve the M0 renderer
  privilege boundary.
- M1 must independently prove its lossless file lifecycle, recovery, encoding,
  CodeMirror, IME and performance requirements; M0 evidence does not pre-pass
  them.

## Final iteration decision

Decision: passed
