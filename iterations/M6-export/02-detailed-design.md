# M6 detailed design

## Iteration context

- Iteration: `M6`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

`RenderDocument` is a read-only semantic projection of a frozen `DocumentSession` snapshot;
it never writes Markdown. Main-process controllers own authorized targets, temporary files,
processes, and printing. Export renderers load only local templates and sanitized content with
no Node/preload privilege. All renderer requests use narrow typed contracts.

## Capability design

### Snapshot, native render, and print

Freeze source, revision, resources, options, and feature state before parse, resource
resolution, sanitization, theme application, and formula/diagram stabilization. HTML and
plain HTML preserve semantic anchors and UTF-8. PDF uses `printToPDF`; print shares the same
render contract. Image export supports full document/selection, bounded tiling, and explicit
pixel/memory diagnostics. Cancellation terminates work and cleans temporary output.

### Settings and target safety

Per-format versioned options retain their own last target. Repeat export validates that target
and requests overwrite confirmation. YAML settings are ignored unless explicitly authorized;
they remain untrusted data and cannot add executable behavior. Failed migrations retain the
previous settings/backup rather than silently resetting user intent.

### Pandoc export and import

The adapter checks a user-authorized executable and version, builds `spawn(executable,args,
{shell:false})`, bounds output, and cancels/cleans the child process. Missing Pandoc disables
only Pandoc formats. Import treats its source as read-only, validates UTF-8 Markdown, warnings,
hashes, resource count/size, relative paths, and symlinks in a main-generated staging directory
before creating an unnamed session. First save commits resources through the resource
transaction; recovery migration adds only a validated staging identifier.

## Module responsibilities

- Renderer: option controls, immutable request initiation, progress/cancellation display, and
  non-privileged previews.
- Main/export controller: snapshot admission, target writes, temporary-directory cleanup,
  isolated rendering, print, and adapter lifetime.
- Import controller: source authorization, staging validation, unnamed-session result, and
  recovery/staging cleanup.
- Shared contracts: Zod schemas for formats/options/progress/results and stable errors.

## Interfaces and data flow

`DocumentSession -> frozen RenderSnapshot -> RenderDocument -> sanitized isolated renderer ->
artifact`; `authorized import source -> bounded Pandoc argv -> validated staging -> unnamed
DocumentSession`; and `format options -> validation -> confirmed target -> artifact` are the
only data paths. The export adapter never receives a mutable session; no raw process or path
capability reaches the renderer.

## Data safety, failure handling, migration, and compatibility constraints

Compare snapshot revision/source/hash before and after every operation. Atomic target writes
and cleanup prevent half-written output; visible, retained diagnostics identify any artifact
that cannot be cleaned. Import never moves, edits, or deletes its source. Recovery V1-to-V2
migration preserves body and rejects arbitrary staging paths. Custom HTML/head/body, image,
font, formula, chart, and Pandoc diagnostics are bounded and sanitized. Core native formats
are independent from network and Pandoc availability.

## Dependency admission

Electron print/render APIs, parser/renderer packages, and Pandoc integration must satisfy
license review, offline operation, sandboxing, and bounded-process rules. No dependency may
weaken the existing Electron, source-authority, or typed IPC constraints.

## Manual-gate design

M6 has a state-defined manual gate. The evaluator checks system/real printing, offline HTML,
PDF and long image results, target-application opening, Pandoc import/first-save behavior, and
no-Pandoc core behavior. Evidence includes software versions, hashes, staging manifests,
screenshots or scans, and signed conclusions.

## Implementation order

- [ ] Build frozen snapshot and isolated native render pipeline with cancellation.
- [ ] Add HTML/plain HTML, then PDF/print and image exporters with golden validation.
- [ ] Add per-format settings, target confirmation, and YAML authorization.
- [ ] Add bounded Pandoc detection/export, followed by validated import and recovery migration.
- [ ] Execute offline/with-Pandoc security and performance matrices; prepare manual evidence.

The checklist orders work only. Its items do not have individual status, dependencies,
evidence, reports, or independent gating behavior; `M6` is the sole execution and acceptance unit.
