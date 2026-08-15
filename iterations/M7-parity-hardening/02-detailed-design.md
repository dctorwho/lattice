# M7 detailed design

## Iteration context

- Iteration: `M7`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

Settings, commands, localization, diagnostics, and performance probes operate through typed
services, not renderer-held document copies or privileged shortcuts. Markdown stays the sole
authority; large-file degradation changes projections only. Observability stays local,
structured, bounded, and content/path redacted.

## Capability design

### Settings and keybindings

A versioned Zod settings model retains all categories and unknown future fields safely.
Migration makes a backup, validates in memory, atomically writes only validated results, and
falls back without replacing a bad file. Each setting has one consumer and immediate/restart
semantics. The shared command metadata produces Windows defaults, user overrides, visible
conflicts, reserved-key explanations, reset, reload, and multi-window consistency.

### Localization and accessibility

Shared catalogs provide complete zh-CN/en-US strings, plural/date/number behavior, localized
errors, and rebuilt native menus. Pseudo-localization exposes truncation. Semantic controls
have names, visible/stable focus, live status, keyboard paths, reduced-motion and high-contrast
behavior; visual checks complement axe and Narrator verification.

### Compatibility, scale, and privacy hardening

A traceability ledger binds every COMP item to requirements, fixture/environment, commands or
settings, test result, and difference record. Large files select source-priority behavior and
pause expensive projections; workers handle costly work. Packaged benchmarks record P50/P95
and peaks for startup, 1/5/10MB open, input, switching, 10k workspaces, charts, search,
exports, and soak cycles. Logs store only stable codes, bounded safe context, hashes or
relative paths, and user-previewed diagnostics.

## Module responsibilities

- Main process: settings atomic storage, log rotation/redaction, lifecycle performance probes.
- Renderer: settings UI, command display, localized accessible shell, large-file projection
  state, and user-visible diagnostics.
- Workers: bounded parsing/search/rendering performance work with cancellation.
- Shared modules: schemas, catalogs, command metadata, compatibility evidence contracts.

## Interfaces and data flow

`settings file -> backup/migrate/Zod -> typed snapshot -> single consumer`; `command metadata
-> keybinding resolver -> conflict result -> menu/renderer projection`; `measurement harness ->
bounded raw metrics -> P50/P95 report`; and `error -> redaction -> local log/previewed
diagnostic` are the allowed paths. Compatibility records link to evidence without importing
private documents into logs.

## Data safety, failure handling, migration, and compatibility constraints

Invalid or future settings never trigger an overwrite; the retained file/backup and recovery
action remain visible. Large-file fallback never normalizes source or changes undo/selection.
Performance regressions block release-candidate readiness. Compatibility gaps retain source,
reproduction, impact, and alternative path, and cannot be marked resolved by an unapproved
smoke test. Privacy failures are security failures and preserve only safe diagnostic context.

## Dependency admission

Accessibility, benchmark, and logging tools require license review and must run locally with
bounded output. No telemetry, network analytics, generic IPC, or document-content logger is
admitted.

## Manual-gate design

`M7` has no state-defined manual gate, but inherited manual cases are required evidence for
accessibility, four-week daily use, and release-candidate audit conclusions. Their approval
remains evaluator-owned and cannot be supplied by an agent.

## Implementation order

- [ ] Establish settings schema/migration/consumer evidence and keybinding resolution.
- [ ] Complete catalogs, localization checks, semantic accessibility, and keyboard paths.
- [ ] Build COMP-level traceability and reproduce every declared gap.
- [ ] Add large-file degradation, packaged benchmarks, leak soak, and privacy diagnostics.
- [ ] Collect four-week and RC audit materials after automated regression evidence is complete.

The checklist orders work only. Its items do not have individual status, dependencies,
evidence, reports, or independent gating behavior; `M7` is the sole execution and acceptance unit.
