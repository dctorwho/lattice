# M1 detailed design

## Iteration context

- Iteration: `M1`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

Markdown source bytes and their SourceBuffer metadata are the sole document
authority. `DocumentSession` is a pure domain object outside React; React
observes only derived UI state. Filesystem/dialog/watcher/clock boundaries are
injected and accessed through narrow validated preload contracts.

## Capability design

### Lossless bytes and session state

Decode supported UTF-8, BOM, and UTF-16 input into LF editing text while
retaining encoding, per-line EOL index, and original-byte hash. A clean
session writes its original bytes. Revision, savedRevision, disk version,
selection, history, and external state are session-owned; undo to saved
revision clears dirty without a React document mirror.

### Authorized opening and atomic saving

Only user-selected, authorized workspace, or existing-session paths enter the
main-process file boundary. Save writes a same-directory temporary file,
flushes, validates expected disk version, replaces/backs up atomically, and
cleans failure points. Results distinguish cancellation, authorization,
conflict, and recoverable I/O errors; no conflict silently overwrites.

### Recovery, watchers, and conflict resolution

Versioned, throttled atomic snapshots recover the latest valid revision and
fall back when the last snapshot is corrupt. Watcher events are deduplicated;
clean content follows configured reload behavior while dirty content pauses
autosave and exposes compare, reload, local save-as, confirm-overwrite, and
cancel paths with both versions preserved.

### Source editor and document commands

CodeMirror 6 owns text transactions, selection, and history. Session changes
bind/unbind views without copying full text into React. Menu, toolbar, context,
and shortcut paths call one command registry for New, Open, Save, Save As,
Close, and recovery. Closing a dirty session presents save/discard/cancel.

### Search, replace, and status

Search supports case, whole word, regular expression, Unicode, cross-line, and
zero-width handling. Replace-all is one undo group and invalid expressions do
not modify source. Status calculation derives line/column, document and
selection statistics, encoding, EOL, dirty state, and zoom using stable
Chinese/English rules.

## Module responsibilities

Domain modules own SourceBuffer, sessions, persistence decisions, recovery,
and search semantics. Main adapters own dialogs, filesystem, hashing, watcher,
and bounded logging. Preload exposes typed requests only. Renderer owns the
CodeMirror view and derived command/status presentation.

## Interfaces and data flow

`authorized open -> bytes/stat/hash -> SourceBuffer -> DocumentSession ->
CodeMirror transaction -> session revision`; `save command -> expected
DiskVersion -> atomic write -> savedRevision or conflict Result`; `watch event
-> dedupe/stat/hash -> clean reload or dirty conflict state`.

## Data safety, failure handling, migration, and compatibility constraints

Preserve BOM, encoding, line endings, list/layout bytes outside edits, and
original bytes for clean sessions. Unknown encodings are read-only and never
guessed for overwrite. Failure leaves complete old/new data only; recovery
logs contain no document text. Any observed silent overwrite, source
normalization, broken recovery, or undo inconsistency halts work.

## Dependency admission

Use CodeMirror 6 and existing validated Electron contracts. Any new parser,
filesystem, or watcher dependency must have a documented purpose, compatible
license, and testable injected boundary.

## Manual-gate design

An evaluator performs sustained Microsoft Pinyin input, LF/CRLF/BOM hash
checks, all dirty-conflict choices, forced-kill recovery, and each dirty-close
choice; evidence records versions, hashes, screenshots, and conclusion.

## Implementation order

- [ ] Implement SourceBuffer codecs, EOL indexing, hashes, and property fixtures.
- [ ] Add authorized open, session revisions, and atomic save/conflict handling.
- [ ] Add recovery snapshots, watchers, autosave pause, and conflict UI.
- [ ] Bind CodeMirror source mode and unified document commands.
- [ ] Add search/replace/status and run data, security, E2E, performance, and manual gates.
