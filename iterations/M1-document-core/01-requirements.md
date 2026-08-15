# M1 requirements

## Iteration context

- Iteration: `M1`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md).

## Objectives

Deliver lossless Markdown document lifecycle and CodeMirror source editing:
safe opening, atomic saving, conflict handling, recovery, session history,
document commands, watcher/autosave behavior, find/replace, and status data.

## User-observable outcomes

- Supported encodings, BOMs, line endings, whitespace, and untouched bytes
  survive open/save; a save failure never corrupts the original file.
- Users can create, open, save, save as, close, recover, and resolve external
  changes without silent loss.
- Source editing, selection, history, search/replace, and status information
  remain session-scoped and work for Unicode and long documents.

## Scope

Lossless SourceBuffer and DocumentSession domain models; authorized native file
access; transactional persistence and recovery; CodeMirror 6 source mode;
unified document commands; watcher/autosave/conflict flows; find/replace and
localized status bar; full data-safety/performance gate.

## Non-goals

Hybrid projection, rich-text serialization, workspace management, image
operations, export, or an unbounded renderer filesystem API.

## Requirement and compatibility coverage

| Global ID     | Iteration outcome                                                  | Acceptance evidence                     |
| ------------- | ------------------------------------------------------------------ | --------------------------------------- |
| DOC-001..010  | Lossless lifecycle, recovery, encoding, and large-file degradation | Document, recovery, and gate cases      |
| EDT-002..003  | CodeMirror source mode and shared document state                   | Source editor and mode-continuity cases |
| EDT-005       | Session-consistent undo/redo                                       | Property tests                          |
| EDT-009       | Find and replace                                                   | Search/replace cases                    |
| EDT-013       | Stable document and selection statistics                           | Status-bar cases                        |
| UI-001        | Editor and status-area integration                                 | Command/status E2E evidence             |
| COMP-001..004 | Document lifecycle, lossless encoding, recovery, source mode       | Compatibility gate evidence             |
| COMP-036      | Word/selection statistics and status bar                           | Find/status evidence                    |
| NFR-001       | Silent corruption is release-blocking                              | Failure injection and manual review     |

## Preconditions and external dependencies

Requires the M0 secure IPC and command foundation, OS file dialogs, authorized
filesystem adapters, CodeMirror 6, and byte/encoding/recovery fixtures. The
manual gate requires a designated evaluator using real IME and Windows files.

## Risks and mitigations

Byte normalization, partial writes, conflict overwrite, unsafe path access,
bad recovery cleanup, and IME/history loss are mitigated by pure domain tests,
fault injection, authorized paths, atomic files, and real-Electron/manual
coverage.

## Iteration-level acceptance criteria

- Every M1 automated case passes with preserved fixture hashes and failure
  evidence.
- Untouched bytes remain identical; failed saves leave a complete old or new
  file; conflicts and recovery retain recoverable choices.
- The evaluator completes the IME, encoding, conflict, recovery, and close
  workflow manual case. No data-loss or P0/P1 blocker remains.

## Entry completeness

This document, the detailed design, and the test cases are the three entry
documents. All three must be complete and predecessor iterations must be
`passed` before `M1` may become `ready` or `in_progress`.
