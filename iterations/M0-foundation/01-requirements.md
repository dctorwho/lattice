# M0 requirements

## Iteration context

- Iteration: `M0`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md),
  [architecture](../../docs/03-architecture.md), [data-safety and
  security](../../docs/05-data-safety-and-security.md), and [test
  strategy](../../docs/09-test-strategy.md).

## Objectives

Establish a reproducible, offline-capable engineering foundation and a secure
Electron desktop shell. Provide the narrow shared contracts and command/window
shell needed by later iterations, plus the CI, dependency-audit, SBOM, and
packaging evidence needed to evaluate the foundation as one iteration.

## User-observable outcomes

- The application starts as an independently branded Windows desktop shell
  with an accessible title bar, sidebar toggle, editor area, status area, and
  an About command.
- The packaged renderer has no Node, raw Electron, or general IPC authority;
  navigation, permissions, webviews, and unsafe external URLs are denied.
- Native menus, renderer controls, shortcuts, and context menus dispatch the
  same command identity and preserve deterministic focus behavior.

## Scope

- Reproducible pnpm/Electron/TypeScript project bootstrap, strict quality
  commands, hermetic daily checks, and explicit cold-bootstrap coverage.
- Production Electron sandbox, CSP, permission, navigation, new-window,
  webview, and confirmed external-link policies.
- Zod-validated request/response contracts, bounded serialization, stable
  errors, redacted diagnostics, sender ownership, and the frozen preload API.
- A renderer-owned command registry, native-menu projection, localized shell,
  and the CI/license/SBOM/packaged-artifact gate.

## Non-goals

- File, workspace, settings, import, export, or general-purpose IPC APIs.
- A fake product surface, unimplemented command controls, or a rich-text
  document authority.
- Relaxing quality, security, licensing, or data-integrity checks to make a
  bootstrap or package result pass.

## Requirement and compatibility coverage

| Global ID              | Iteration outcome                                                                              | Acceptance evidence                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| NFR-007..009           | Offline core behavior, replaceable engineering boundaries, and redacted structured diagnostics | Offline/bootstrap, security, contract, and audit cases |
| UI-001..002            | Window structure and one command identity across interaction surfaces                          | Command/window shell cases and manual review           |
| Engineering foundation | Reproducible build, quality toolchain, and test harness                                        | Command exit codes, lockfile and artifact hashes       |
| CI/audit/package gate  | Windows CI, dependency and license audit, SBOM, and launchable packaged artifact               | Gate case, audit artifacts, and manual evaluation      |

## Preconditions and external dependencies

- A supported Windows build environment, pinned pnpm dependencies, Electron,
  and the project-local package store.
- Platform signing, CI, license-audit, and SBOM tooling are admitted only with
  documented versions, licenses, and reproducible command output.
- User or designated evaluator review is required for the iteration manual
  gate and cannot be concluded by the implementation agent.

## Risks and mitigations

- Renderer privilege leakage: fail closed at preload, IPC, BrowserWindow,
  session, and WebContents boundaries; exercise production Electron tests.
- Non-reproducible or falsely green quality results: use isolated copies,
  injected faults, frozen installs, and preserved exit-code evidence.
- Dependency or packaging risk: retain a parseable SBOM, license audit, and
  packaged-artifact evidence before the manual review.

## Iteration-level acceptance criteria

- All M0 automated cases in `03-test-cases.md` pass with retained commands,
  environments, exit codes, and artifacts in the controlled test report.
- The production shell is sandboxed and has only the approved frozen preload
  surface; unsafe navigation, permission, and external-link attempts fail.
- Quality checks, CI-equivalent commands, license audit, SBOM, and packaged
  launch evidence are reproducible and complete.
- The designated evaluator completes the named manual case using its required
  evidence; no data-loss, privilege-boundary, or audit blocker remains.

## Entry completeness

This document, the detailed design, and the test cases are the three entry
documents. All three must be complete and predecessor iterations must be
`passed` before `M0` may become `ready` or `in_progress`.

No subtask, task-level status, or task-level ownership belongs in this
document.
