# M2 detailed design

## Iteration context

- Iteration: `M2`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

CodeMirror 6 remains the only editing surface and SourceBuffer text remains
authoritative. Hybrid mode uses decorations, widgets, view plugins, and
minimal source patches; no rich-text AST is saved or mirrored in React.

## Capability design

### Projection and source fallback

HybridProjection, RevealController, block-adapter registry, and mode
compartments rebuild disposable decorations without history. Widgets submit
range patches carrying snapshot revision/hash; stale, invalid, timeout, or
parser failures reject the patch and show editable source without changing the
session.

### Basic Markdown adapters

Paragraphs, ATX/Setext headings, quotes, inline marks, ordered/unordered/task
lists, links/images/autolinks, and fenced/indented code preserve original
markers, delimiters, and unknown/incomplete input. Code body is always
editable; link activation follows the M0 approved protocol policy.

### Editing transactions

Input rules and auto-pairs act only in legal contexts, produce minimal
undoable change sets, and are suppressed during composition. Selection mapping
spans inline marks/widgets/blocks. Composition events form one undo group;
focus restoration and drag selection remain deterministic.

### Mode continuity

Source and hybrid extensions switch within one EditorState and retain text,
selection, history, scroll, and folds. Mode change itself creates no document
transaction; window/document preference persistence follows the storage rules.

## Module responsibilities

Editor extensions own decorations, reveal state, adapters, patch validation,
input rules, selection mapping, and mode compartments. Domain sessions own
text/history authority; renderer supplies presentation only.

## Interfaces and data flow

`SourceBuffer -> DocumentSession -> CodeMirror state -> parser ranges ->
decorations/widgets`; `widget operation -> source patch + revision/hash ->
validation -> CodeMirror transaction -> session`; failures return to source.

## Data safety, failure handling, migration, and compatibility constraints

Display changes never modify source. Patches may change only target ranges.
Composition must not rebuild active DOM or duplicate text. A source/hash or
history change caused by a mode switch, stale patch overwrite, unrecoverable
cross-block selection, or IME loss is a release blocker.

## Dependency admission

Use parser and language assets only when on-demand loading, license, bundle
size, offline behavior, and sandbox requirements are documented.

## Manual-gate design

The evaluator tests Microsoft Pinyin and a third-party Chinese IME, candidate
navigation, full-width punctuation, cross-block selection, list backspace,
repeated switching, and sustained daily use with hashes and recordings.

## Implementation order

- [ ] Add projection lifecycle, reveal behavior, and revision/hash patch validation.
- [ ] Add block, inline, list, link/image, and code adapters with source fallback.
- [ ] Add rules, pairing, composition, selection, and transaction grouping.
- [ ] Add mode continuity and persistence.
- [ ] Execute property, E2E, security, performance, and manual regression gates.
