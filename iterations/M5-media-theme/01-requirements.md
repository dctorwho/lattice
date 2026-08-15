# M5 requirements

## Iteration context

- Iteration: `M5`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md),
  [architecture](../../docs/03-architecture.md), [data-safety and
  security](../../docs/05-data-safety-and-security.md), and [test
  strategy](../../docs/09-test-strategy.md)

## Objectives

Deliver safe, reversible media workflows and writing presentation tools: interoperable
clipboard behavior, image lifecycle management, constrained uploading, independent
themes, and writing-assistance modes that retain the editor's transaction guarantees.

## User-observable outcomes

- Users can paste and copy plain text, Markdown, sanitized HTML, and images with
  predictable semantics and one undo operation.
- Users can insert, move, rename, reload, and delete images while Markdown links and
  disk operations remain explainable and recoverable.
- Users can choose original light/dark/system themes or a safe custom CSS theme, and
  can use focus, typewriter, read-only, spelling, Emoji, smart punctuation, and
  line/paragraph movement controls.

## Scope

- Clipboard conversion and sanitization; image insertion sources, path policies,
  resource transactions, and upload adapters.
- Theme loading, CSS scoping, system-mode changes, hot reload, and public Typora CSS
  convention adaptation without bundling Typora assets.
- Focus/typewriter/read-only modes and the specified writing assists.

## Non-goals

- Cloud clipboard synchronization, an unrestricted command executor, a theme
  marketplace, or copying Typora branding/default themes.
- Changing the Markdown source authority, serializing a rich-text model, or making
  image file operations silently irreversible.

## Requirement and compatibility coverage

| Global ID     | Iteration outcome                                                                                                  | Acceptance evidence                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| EDT-010       | Sanitized multi-format copy/paste and plain-text mode retain minimal source changes and one undo unit.             | Clipboard automated and evaluator evidence    |
| EDT-011..012  | Writing modes and assists are immediately configurable, accessible, and safe during IME and long-document editing. | Writing-mode automated and evaluator evidence |
| IMG-001..006  | Insert, path strategy, management, viewing, uploading, and source/file transaction consistency are implemented.    | Image transaction and upload evidence         |
| UI-003..004   | Original themes, system following, safe user CSS, and compatible public CSS conventions are available.             | Theme isolation and evaluator evidence        |
| COMP-021..024 | Clipboard, image, writing-mode, and theme compatibility coverage is complete.                                      | Consolidated M5 evidence set                  |

## Preconditions and external dependencies

- M4 is `passed` in `iterations/state.json` before this iteration may begin.
- The existing CodeMirror source transaction, typed IPC, authorized dialogs, and
  sandboxed renderer boundaries are available.
- Windows clipboard APIs, a controlled recycle-bin integration, and test fixtures for
  external-editor clipboard payloads are available; upload adapters use fake
  executables in automated verification.

## Risks and mitigations

- Clipboard HTML, themes, images, and uploader output are untrusted: sanitize and
  validate before rendering or source patching; deny remote/script escapes.
- Resource failures can split source and disk state: use `ResourceTransaction`,
  rollback, and explicit repair guidance.
- CSS can obscure safety UI: scope themes to the document surface and keep system
  dialogs outside that scope.
- IME and large-document regressions: retain transaction grouping and enforce the
  documented E2E/performance cases.

## Iteration-level acceptance criteria

1. Every mapped requirement and COMP item has the listed automated evidence; clipboard,
   source, and resource tests prove no unauthorized execution or permanent loss.
2. Resource operations either commit matching Markdown and disk state or report a
   recoverable failure with retained originals.
3. Custom CSS cannot execute scripts, load prohibited resources, or hide security UI.
4. All required M5 manual observations are recorded and approved by the designated
   evaluator before the iteration can pass.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents.
All three must be complete and predecessor iterations must be `passed` before `M5`
may become `ready` or `in_progress`.

No subtask, task-level status, or task-level ownership belongs in this document.
