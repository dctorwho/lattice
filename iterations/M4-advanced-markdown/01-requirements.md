# M4 requirements

## Iteration context

- Iteration: `M4`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md).

## Objectives

Add advanced Markdown capabilities through source-safe, cancellable, sandboxed
adapters: metadata/TOC/alerts, advanced code, tables, academic links, MathJax,
Mermaid, and safe HTML/media/embed presentation.

## User-observable outcomes

Complex blocks remain editable and return to source on error. Table operations
are minimal and undoable; math/diagrams work offline within budgets; unsafe
HTML, SVG, URLs, and embeds do not gain script, network, or host privilege.

## Scope

Feature registration; source fallback; YAML/TOC/alerts; code configuration;
table projection/operations; footnotes/references/anchors; MathJax 4; Mermaid;
sanitized HTML/video/embed; advanced corpus/security/performance gate.

## Non-goals

Saving a rich-text AST, automatic reformatting of unrelated source, allowing
untrusted script/network access, or making advanced extensions mandatory for
core Markdown editing.

## Requirement and compatibility coverage

| Global ID     | Iteration outcome                                                                    | Acceptance evidence      |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------ |
| MD-003..012   | Advanced inline/blocks, metadata, tables, academic links, code, math, diagrams, HTML | Advanced cases           |
| EDT-004       | Minimal source-range patches                                                         | Table/property cases     |
| COMP-014..020 | Advanced Markdown compatibility                                                      | Gate and manual evidence |

## Preconditions and external dependencies

Requires M3 shell, M2 patch/adaptor framework, locally packaged MathJax and
Mermaid assets, sanitized isolated rendering, and advanced/security fixtures.

## Risks and mitigations

Parser/render divergence, unrelated reformatting, stale patches, unbounded
math/diagram work, XSS, remote access, and adapter crashes are mitigated by
range/revision validation, source fallback, time/node/output budgets,
`securityLevel:'strict'`, sanitization, isolation, and cancellation.

## Iteration-level acceptance criteria

All advanced cases pass with source/range/revision/patch/undo and security
evidence. Every complex block has source fallback; no source drift, privilege
escape, resource exhaustion, P0/P1, or manual safety failure remains.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents. All three must be complete and predecessor iterations must be `passed` before `M4` may become `ready` or `in_progress`.
