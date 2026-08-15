# M4 detailed design

## Iteration context

- Iteration: `M4`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

Advanced features use the M2 adapter contract: parse source ranges, render a
disposable projection, apply minimal revision/hash-bound patches, validate, and
fall back to source. Markdown text remains authoritative; renderers are
untrusted and isolated from Node/preload/host access.

## Capability design

### Registration and resilient adapters

One feature registry controls parser/renderer configuration and flags. Adapter
parse/render/apply timeout, exception, invalid range, or stale revision
preserves session/history and exposes source plus diagnostics.

### Structured Markdown

YAML retains key order and unrelated formatting; TOC updates incrementally;
alerts preserve nested ranges. Tables retain original cell/range/delimiter
layout; operations patch only the target table, are selection-aware and fully
undoable. Footnotes, references, anchors, and local links diagnose missing or
duplicate definitions without relocating source.

### Code, math, and diagrams

Code uses on-demand language assets, aliases, safe unknown-language fallback,
indent/copy behavior, and long-line limits. MathJax 4 is local/offline with
four delimiters, macro/numbering support, and timeout/node/output budgets.
Mermaid is strictly isolated, cancellable, source-fallback capable, and keeps
legacy sequence/flowchart adapters.

### HTML, video, and embeds

Sanitize permitted inline/block HTML and media semantics in an isolated
no-Node/no-preload renderer. Disallow executable content, dangerous URLs,
remote escape, unauthorized local paths, and active forms/frames; unsafe input
becomes a source-preserving placeholder.

## Module responsibilities

Feature registry owns flags; adapters own ranges/models/patches; worker or
isolated renderer owns costly/hostile rendering; source-patch service owns
revision/hash checks; security policy owns resource/network restrictions.

## Interfaces and data flow

`source range -> adapter parse -> isolated/widget render -> operation ->
minimal SourcePatch(snapshot revision/hash) -> validate -> transaction`; any
failure returns source and bounded diagnostics.

## Data safety, failure handling, migration, and compatibility constraints

No adapter reformats unrelated source or accepts stale patches. Untrusted
content never executes scripts or reaches host APIs. Cancellation terminates
work; timing/node/output limits fail safely. Advanced feature failure never
blocks normal source editing.

## Dependency admission

MathJax, Mermaid, grammars, and sanitization dependencies require local assets,
compatible licenses, documented budgets, offline tests, and security review.

## Manual-gate design

Evaluator exercises bulk table undo, complex formulas/macros, multiple
diagrams, invalid YAML/HTML, and repeated source/hybrid transitions offline;
the case is manual acceptance evidence, not agent approval.

## Implementation order

- [ ] Implement registry, adapter lifecycle, revision validation, and source fallback.
- [ ] Add metadata, TOC, alerts, code, tables, and academic links.
- [ ] Add bounded offline math and strictly isolated diagrams.
- [ ] Add sanitized HTML/media/embed presentation.
- [ ] Run advanced golden, property, security, performance, and manual checks.
