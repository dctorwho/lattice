# M6 requirements

## Iteration context

- Iteration: `M6`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md)

## Objectives

Provide secure offline HTML, PDF, image, print, Pandoc export, and Pandoc import workflows
that operate from immutable document snapshots and never modify a source document or import
source unexpectedly.

## User-observable outcomes

- Users can export semantic HTML, PDF, and images and print with themes and documented options.
- Users can remember per-format export choices, safely re-export, and explicitly authorize
  YAML overrides.
- When Pandoc is available, users can exchange supported formats; when it is unavailable,
  core Markdown work and native exports remain usable.

## Scope

- Read-only `RenderDocument` pipeline, HTML/plain HTML, PDF/printing, full/selection image
  export, export preferences, and optional Pandoc adapters.
- Pandoc import into a new unnamed Markdown session with validated staging resources and
  recovery metadata migration.

## Non-goals

- Making Pandoc mandatory, allowing arbitrary export scripts/arguments, or serializing an
  editable rich-text AST.
- Network-dependent native export, source-session mutation during rendering, or overwriting
  imported source files.

## Requirement and compatibility coverage

| Global ID                 | Iteration outcome                                                                   | Acceptance evidence                     |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| EXP-001..004, EXP-008     | Secure HTML, PDF/print, and image exports come from an unchanged snapshot.          | Native export and evaluator evidence    |
| EXP-005, EXP-007, EXP-009 | Optional Pandoc export/import use bounded argv, validated output, and safe staging. | Process, import, and evaluator evidence |
| EXP-006                   | Per-format settings and repeat export validate targets before overwriting.          | Export preference evidence              |
| COMP-025..029             | Export/import compatibility categories have explicit evidence.                      | Consolidated M6 evidence set            |
| NFR-007                   | Native core exports remain offline and work without Pandoc.                         | Offline and no-Pandoc evidence          |

## Preconditions and external dependencies

- M5 is `passed` in `iterations/state.json`.
- The sanitized Markdown/feature registry, source session snapshot, secure IPC, and controlled
  filesystem/process adapters are available.
- Electron printing APIs and an optional user-selected Pandoc executable are admitted only via
  the documented contracts; fixtures provide fake executables and offline resources.

## Risks and mitigations

- Rendering may mutate or race an editor session: freeze revision/source/hash and test them
  before/after every outcome.
- Export HTML, templates, resources, and Pandoc input are untrusted: isolate renderers,
  sanitize, bound resources, and use `shell:false` argv.
- Import cancellation, invalid output, or staging escape can create partial documents: validate
  before session creation and clean staging deterministically.
- Print/PDF variation and long-image memory pressure require golden, E2E, and performance
  coverage on the stated environments.

## Iteration-level acceptance criteria

1. Native HTML/PDF/image export and Markdown opening remain usable offline without Pandoc.
2. All export/import paths prove source revision, source hash, and import source hashes are
   unchanged; failures and cancellation leave no unreported partial artifact or session.
3. Pandoc processes use approved executables and argument arrays; staged resources cannot
   escape their controlled directory.
4. The M6 manual print and target-application observations are evaluator-approved before pass.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents. All
three must be complete and predecessor iterations must be `passed` before `M6` may become
`ready` or `in_progress`.

No subtask, task-level status, or task-level ownership belongs in this document.
