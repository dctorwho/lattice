# M3 requirements

## Iteration context

- Iteration: `M3`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md).

## Objectives

Deliver the full workspace desktop shell: command menu, authorized folder
enumeration, file tree/list operations, outline, quick open, global search,
recent projects, and resilient window sessions.

## User-observable outcomes

Users can safely browse and manage an authorized folder, navigate large
projects, cancel long work, use unified commands, and reopen windows in visible
positions without exposing document text or unauthorized paths.

## Scope

Full menu/toolbar/context/shortcut shell; workspace authorization/enumeration;
tree/list and file operations; outline; quick open; ripgrep search; recent
projects and per-window state; large-workspace/performance verification.

## Non-goals

Unrestricted filesystem access, shell-string subprocesses, permanent deletion
without confirmation, cloud sync implementation, or rich-text document state.

## Requirement and compatibility coverage

| Global ID     | Iteration outcome                                               | Acceptance evidence |
| ------------- | --------------------------------------------------------------- | ------------------- |
| WS-001..008   | Workspace, files, outline, quick open, search, sorting, recents | Workspace cases     |
| UI-001..002   | Full shell and unified commands                                 | Command E2E         |
| UI-006        | Shortcut behavior and conflict diagnostics                      | Command case        |
| OS-001        | File routing/window behavior                                    | Session cases       |
| OS-004        | Window/session restoration                                      | Session cases       |
| COMP-010..013 | Shell, workspace, outline, open/search compatibility            | Gate case           |
| NFR-005       | Cancelable large directory work without blocked editing         | Performance gate    |

## Preconditions and external dependencies

Requires M2 editor continuity, M0 command/IPC boundaries, authorized filesystem
adapters, a packaged ripgrep sidecar, and real large-workspace fixtures.

## Risks and mitigations

Path/symlink escape, destructive file operations, subprocess injection,
uncancelled processes, blocked input, and off-screen restoration are mitigated
by root authorization, preflight/rollback, argument-array spawning,
termination tests, background work, and display-bound clamping.

## Iteration-level acceptance criteria

All workspace cases pass with snapshots, seeds, process exit records, and
P50/P95 data. Dangerous operations are confirmed/recoverable; no root escape,
process leak, data loss, P0/P1, or editor blocking remains. The M3 manual gate
is not required by state but its practical real-workspace scenario remains
recorded for release confidence.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents. All three must be complete and predecessor iterations must be `passed` before `M3` may become `ready` or `in_progress`.
