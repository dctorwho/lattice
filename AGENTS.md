# Repository instructions for Codex

## Mission

Build the product specified in `docs/` one iteration at a time. The target is a
Typora 1.13.8 feature- and workflow-compatible Markdown desktop editor with
independent branding and assets. Do not narrow the product into a generic
rich-text editor or a preview-and-source split-pane editor.

## Required reading order

Before changing files, read:

1. `iterations/state.json`
2. The selected iteration's `01-requirements.md`, `02-detailed-design.md`, and
   `03-test-cases.md`
3. `docs/00-product-charter.md`
4. `docs/03-architecture.md`
5. `docs/05-data-safety-and-security.md`
6. `docs/09-test-strategy.md`

Read every document linked by the selected iteration. Repository documents
override assumptions from model memory.

## Iteration selection and stopping

- Implement only the iteration explicitly named by the user. If none is named,
  select the one `ready` iteration whose dependencies are `passed`.
- Mark the selected iteration `in_progress` before implementation. Never work
  on a later iteration, speculative abstraction, placeholder button, fake
  setting, or disabled mock feature.
- Iterations are the sole planning, ownership, dependency, and acceptance unit.
  Do not generate subtask plans, subtask state, or subtask reports.
- Run focused tests while developing. At iteration exit, run `pnpm check` and
  every applicable integration, end-to-end, performance, and security suite in
  `docs/09-test-strategy.md`.
- Write `04-test-report.md` with automated evidence before setting an iteration
  to `awaiting_manual`. Write `05-exit-report.md` and record required manual
  evidence before setting it to `passed`.
- Stop after reporting changed files, commands run, results, residual risks,
  and exact manual verification steps. Do not create commits, tags, releases,
  or push unless the user explicitly asks.

## Non-negotiable architecture rules

- The Markdown source string is the only document authority and persistence
  format.
- CodeMirror 6 is the editing surface. React must not mirror the full document
  in component state.
- Hybrid mode uses CodeMirror decorations, widgets, view plugins, and minimal
  source patches. Never save by serializing a rich-text AST.
- Source and hybrid mode share one document state, selection, history, and
  scroll model.
- Untouched bytes, BOM, encoding, line endings, whitespace, list markers,
  table layout, reference definitions, and HTML remain untouched.
- The renderer is sandboxed, has no Node integration, and accesses privileged
  operations only through narrow typed preload methods validated in main.
- HTML, SVG, Mermaid, math, themes, clipboard HTML, and exported custom content
  are untrusted inputs.
- Pandoc is optional. Core editing, HTML, PDF, image export, build, and tests
  work without it.

## Implementation conventions

- Use TypeScript strict mode. Do not use `any`, `@ts-ignore`, disabled lint
  rules, or unchecked type assertions to bypass design problems.
- Use `pnpm`; do not introduce npm or yarn lockfiles.
- Production dependencies require a documented reason in
  `docs/04-technology-stack.md` and license compatibility.
- Prefer pure domain modules and dependency injection for filesystem, clock,
  process, and dialog boundaries.
- IPC request and response schemas live in `src/shared/contracts/` and use Zod
  at runtime.
- User-facing strings go through the localization layer; do not scatter literal
  UI strings after localization is introduced.
- Preserve unrelated user changes. Never use destructive Git commands.

## Data-loss response and documentation

Any silent overwrite, encoding corruption, source normalization, broken
recovery, or undo inconsistency is a release blocker. Stop iteration progress,
add a regression fixture, fix the root cause, and rerun all data-integrity
suites before continuing.

Update documentation in the same iteration when changing a public interface,
architecture decision, command, setting, file format, security boundary, or
acceptance criterion. Keep `iterations/state.json` valid JSON.
