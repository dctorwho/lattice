# M8 requirements

## Iteration context

- Iteration: `M8`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md)

## Objectives

Deliver reproducible, secure Windows release artifacts and prove installation, routing,
upgrade, uninstall, update readiness, supply-chain evidence, rollback, and Stable audit
without ever deleting user Markdown or workspace content.

## User-observable outcomes

- Users can install, launch, repair, upgrade, and uninstall the Windows application while
  settings, themes, recovery data, and user documents are handled exactly as disclosed.
- File associations, Explorer, command-line paths, and second launches route safely without
  shell interpretation or losing dirty work.
- Signed-release readiness, SBOM/license/hash evidence, and a user-approved Stable decision
  are available; update behavior remains disabled until configured safely.

## Scope

- OS-001..003 single-instance/window routing, file association, command line, and supported
  file/folder paths; OS-005 installer lifecycle; OS-006 disabled-by-default signed updater.
- COMP-033..035 Windows integration/release compatibility, release security, stable audit,
  installer artifacts, SBOM, license, signing preparation, and rollback evidence.

## Non-goals

- Enabling network updates without an approved signing key, removing user data without an
  explicit choice, or treating a developer build as a release artifact.
- Replacing source/document safety policies with installer behavior or asserting Stable
  approval on behalf of a user.

## Requirement and compatibility coverage

| Global ID                         | Iteration outcome                                                                               | Acceptance evidence                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| OS-001..003                       | Single instance, file association, command-line, location parameters, and routing are safe.     | Routing and VM evaluator evidence                     |
| OS-005                            | NSIS packaging, installation, repair, upgrade, rollback, and uninstall preserve declared data.  | Packaging, lifecycle, deletion-scope, and VM evidence |
| OS-006                            | Signed update adapter/channel/feed is disabled until configured and fails safely.               | Update-security evidence                              |
| COMP-033..035                     | Windows integration, installation, and update compatibility have VM/release evidence.           | VM, release-audit, and evaluator evidence             |
| Release security and stable audit | Artifacts, SBOM, licenses, signatures, hashes, rollback, gaps, and release gates are traceable. | Supply-chain, audit, and evaluator evidence           |

## Preconditions and external dependencies

- M7 is `passed` in `iterations/state.json`.
- Packaged build, secure Electron boundary, source/recovery behavior, localization, and all
  release-candidate evidence are available.
- Clean Windows 10/11 VMs, NSIS/electron-builder, certificate/signing custody, printer/IME,
  and signed evaluator evidence are available. No signing secret is stored in the repository.

## Risks and mitigations

- Install/upgrade/uninstall scope can delete user data: separate installation/userData,
  use explicit cleanup choice, and run canary/symlink VM tests.
- Quoted paths, elevation, and second-instance arguments can create shell/routing bugs: use
  parsed argv arrays, authorized paths, and dirty-session preservation.
- Update and supply-chain compromise: require signatures, SBOM/license/hash cross-checks,
  disabled default, clean builds, and rollback rehearsal.
- VM-only and manual flows can mask defects: retain snapshots, command logs, hashes, and
  evaluator approval for every manual release gate.

## Iteration-level acceptance criteria

1. Clean Win10/11 VM evidence covers install through uninstall at 100/150/250% scaling,
   including associations, IME, printing, recovery, upgrade, and data-scope checks.
2. Installer/updater failures preserve a runnable previous application and user documents;
   only declared application data is removed after an explicit choice.
3. Artifact contents, SBOM, licenses, hashes, signature status, and rollback results are
   mutually traceable and have no development secret/content leakage.
4. Required M8 manual VM and Stable audit cases are evaluator-approved before pass.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents. All
three must be complete and predecessor iterations must be `passed` before `M8` may become
`ready` or `in_progress`.

No subtask, task-level status, or task-level ownership belongs in this document.
