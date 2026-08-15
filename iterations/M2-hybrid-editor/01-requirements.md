# M2 requirements

## Iteration context

- Iteration: `M2`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md).

## Objectives

Provide Typora-like single-column hybrid Markdown editing on the shared
CodeMirror document while preserving source, selection, history, and scroll.

## User-observable outcomes

Users edit basic blocks, inline syntax, lists, links, images, and code in one
surface; markers reveal around active input; source/hybrid switching is
continuous; IME, selection, undo, and source bytes remain reliable.

## Scope

Hybrid projection framework, basic block/inline/list/link/code adapters,
input rules and pairing, composition/selection handling, and source/hybrid
continuity with basic Markdown compatibility coverage.

## Non-goals

Rich-text document serialization, secondary preview pane, disk image actions,
advanced Markdown blocks, or independent source/hybrid histories.

## Requirement and compatibility coverage

| Global ID     | Iteration outcome                                                           | Acceptance evidence                        |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| EDT-001..008  | Hybrid editing, state continuity, undo/IME, input rules/pairing             | Projection, editing, IME, and switch cases |
| EDT-014       | Line-level clipboard behavior where provided by the editing core            | Input-rule and editing coverage            |
| MD-001..003   | Basic blocks and inline Markdown                                            | Basic-block and inline cases               |
| MD-008        | Editable code blocks                                                        | Code-block case                            |
| COMP-005..009 | Hybrid preview, selection/IME, basic Markdown, input rules, find continuity | Compatibility gate                         |

## Preconditions and external dependencies

Requires M1 SourceBuffer, DocumentSession, CodeMirror source mode, and
validated command/window boundaries. Parser/highlighter additions must remain
local, sandboxed where appropriate, and independently licensed.

## Risks and mitigations

Projection-induced source drift, stale patches, IME duplication, cursor jumps,
and non-reversible edits are prevented with revision/hash validation, minimal
source patches, composition freeze, selection mapping, property tests, and
manual IME use.

## Iteration-level acceptance criteria

All named automated cases pass; projection changes alone never enter history;
invalid or stale patches fall back to editable source; the manual IME and
two-week usage case is approved with no P0/P1 or source drift.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents. All three must be complete and predecessor iterations must be `passed` before `M2` may become `ready` or `in_progress`.
