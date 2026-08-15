# M5 detailed design

## Iteration context

- Iteration: `M5`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules:
  [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

Markdown remains the sole persisted authority. CodeMirror receives minimal source patches;
clipboard projections, image previews, and theme styling are disposable. Renderer code has
no direct filesystem, shell, or clipboard privilege: typed preload methods route authorized
operations to main-process services. Untrusted HTML, CSS, image metadata, URLs, and upload
output cross validation and isolation boundaries before use.

## Capability design

### Clipboard payload and smart paste

`ClipboardPayload` ranks approved MIME representations, bounds data, sanitizes HTML before
conversion, and preserves a content summary rather than private bodies in diagnostics.
Copy produces rich text, Markdown, HTML, and plain text from a frozen source selection.
Smart and plain-text paste each create one editor transaction; conversion targets only the
selection and cannot activate scripts, event handlers, forms, unsafe URLs, or SVG payloads.

### Image insertion and resource transactions

The image service accepts picker, drop, clipboard, and validated remote-URL sources. A path
policy derives relative, absolute, copy-directory, `./`, and `typora-root-url` references
without overwriting same-name files. `ResourceTransaction` preflights authorized paths,
performs file operations, applies the expected-revision Markdown patch, records a commit
log, and rolls files back when the patch or commit fails. Delete requires confirmation and
uses the recycle bin by default; an incomplete rollback reports concrete retained paths.

### Upload adapters

An adapter validates configuration, executable provenance, argv arrays, timeout/cancellation,
bounded output, and resulting URLs. It invokes a selected executable with `shell:false`;
the default has no network upload path. Multi-file work succeeds atomically at the source
patch boundary or leaves Markdown unchanged.

### Themes and writing modes

Built-in Lattice light and dark themes expose CSS variables and system-color selection.
User themes are loaded from the approved theme directory, bound to the document scope, and
hot-reloaded after validation; remote imports, path escapes, and attempts to style protected
chrome are rejected. A compatibility layer supports public Typora CSS conventions without
shipping its assets. Focus, typewriter, and read-only behavior layer on the existing editor;
spelling, Emoji, punctuation, and movement commands use the shared command path and retain
undo, IME, selection, scroll, and accessibility semantics.

## Module responsibilities

- Renderer: CodeMirror transactions, theme/document projection, mode controls, and visible
  failure/recovery guidance.
- Main process: authorized file/recycle-bin operations, user theme directory watching, and
  controlled upload process lifetime.
- Shared contracts: bounded payloads, path policies, resource operation results, and stable
  error shapes validated with Zod.

## Interfaces and data flow

`clipboard input -> bounded payload -> sanitizer/converter -> source transaction`;
`image input -> authorized source/path policy -> ResourceTransaction -> expected-revision
patch -> commit or rollback`; `theme file -> validation -> document-scoped stylesheet`; and
`mode setting -> command registry -> CodeMirror extension` are the sole flows. Renderer
requests contain no arbitrary path, shell command, window identity, or privileged object.

## Data safety, failure handling, migration, and compatibility constraints

Resource and source changes obey the data-safety rollback protocol. A stale revision rejects
the patch and reparses instead of overwriting input. Cancellation produces no transaction or
partial source mutation. User theme files remain intact when invalid; the application falls
back to a built-in theme. Theme resources stay within the theme directory. Public CSS
compatibility is behavior-level only and preserves independent branding.

## Dependency admission

Admit clipboard, image, CSS, and process libraries only after license/security review and
only when they preserve offline operation and typed boundaries. Pandoc is not a dependency of
this iteration. External upload tools are user-selected capabilities, never a shell string.

## Manual-gate design

M5 has a state-defined manual gate. The evaluator verifies real Word/browser/WeChat-style
clipboard interchange, image drop and rollback, custom theme isolation, and continuous
writing with the specified modes and IME. Evidence includes environment versions, source and
disk diffs, screenshots or recordings, and an evaluator conclusion; automation cannot
approve the gate.

## Implementation order

- [ ] Establish bounded clipboard contracts and sanitizer/converter behavior with fixtures.
- [ ] Add image sources and path policies, then fault-injected resource transactions.
- [ ] Add constrained upload adapters and process-security coverage.
- [ ] Deliver built-in/user themes and protected-chrome isolation.
- [ ] Add writing modes and assists; run combined IME, undo, and performance regressions.
- [ ] Execute the full M5 evidence matrix and prepare manual-gate materials.

The checklist orders work only. Its items do not have individual status, dependencies,
evidence, reports, or independent gating behavior; `M5` is the sole execution and acceptance unit.
