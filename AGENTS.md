# Repository instructions for Codex

## Mission

Build the product specified in `docs/` by executing exactly one task from `tasks/` at a time. The target is a Typora 1.13.8 feature- and workflow-compatible Markdown desktop editor with independent branding and assets. Do not narrow the product into a generic rich-text editor or a preview-and-source split-pane editor.

## Required reading order

Before changing files, read:

1. `tasks/state.json`
2. The milestone file containing the selected task
3. `docs/00-product-charter.md`
4. `docs/03-architecture.md`
5. `docs/05-data-safety-and-security.md`
6. `docs/09-test-strategy.md`

Read other documents linked by the selected task. Repository documents override assumptions from model memory.

## Task selection and stopping

- Implement only the task explicitly named by the user. If none is named, select the first task whose state is `ready` and whose dependencies are `passed`.
- Set that task to `in_progress` before implementation.
- Do not implement future tasks, speculative abstractions, placeholder buttons, fake settings, or disabled mock features.
- When automated checks pass, set the task to `awaiting_manual` if it has a manual gate; otherwise set it to `passed` and unlock only its direct successors.
- Stop after reporting changed files, commands run, results, residual risks, and exact manual verification steps.
- Do not create commits, tags, releases, or push unless the user explicitly asks.

## Non-negotiable architecture rules

- The Markdown source string is the only document authority and persistence format.
- CodeMirror 6 is the editing surface. React must not mirror the full document in component state.
- Hybrid mode is implemented with CodeMirror decorations, widgets, view plugins, and minimal source patches. Never save by serializing a rich-text AST.
- Source mode and hybrid mode share one document state, selection, history, and scroll model.
- Untouched bytes, BOM, encoding, line endings, whitespace, list markers, table layout, reference definitions, and HTML must remain untouched.
- The renderer is sandboxed, has no Node integration, and accesses privileged operations only through narrow typed preload methods validated in the main process.
- HTML, SVG, Mermaid, math, themes, clipboard HTML, and exported custom content are untrusted inputs.
- Pandoc is optional. Core editing, HTML, PDF, image export, build, and tests must work without it.

## Implementation conventions

- Use TypeScript strict mode. Do not use `any`, `@ts-ignore`, disabled lint rules, or unchecked type assertions to bypass design problems.
- Use `pnpm`; do not introduce npm or yarn lockfiles.
- Production dependencies require a documented reason in `docs/04-technology-stack.md` and license compatibility.
- Prefer pure domain modules and dependency injection for filesystem, clock, process, and dialog boundaries.
- IPC request and response schemas live in `src/shared/contracts/` and use Zod at runtime.
- User-facing strings go through the localization layer; do not scatter literal UI strings after localization is introduced.
- Preserve unrelated user changes. Never use destructive Git commands.

## Required verification

Run the task-specific checks plus:

```powershell
pnpm check
```

**M0-T01 自举例外**：M0-T01 发生在质量脚本建立之前，只运行该任务明确列出的 `pnpm install`、开发窗口 smoke、`pnpm build` 和 lockfile 检查，并以命令退出码作为 TC-M0-001 证据。M0-T02 必须建立并反向自动化 TC-M0-001；从 M0-T02 起每个任务都必须运行 `pnpm check`。不得在 M0-T01 创建永远成功的占位 `check` 脚本。

When the task affects Electron behavior, file I/O, editor input, menus, exports, packaging, or recovery, also run the applicable integration or end-to-end suite documented in `docs/09-test-strategy.md`.

Tests must prove the requirement being claimed. Snapshot-only evidence is insufficient for data integrity, cursor behavior, security boundaries, or export semantics.

## Data-loss response

Any observed silent overwrite, encoding corruption, source normalization, broken recovery, or undo inconsistency is a release blocker. Stop feature work, add a regression fixture, fix the root cause, and rerun all data-integrity suites before continuing.

## Documentation updates

Update documentation in the same task when changing a public interface, architecture decision, command, setting, file format, security boundary, or acceptance criterion. Keep `tasks/state.json` valid JSON.
