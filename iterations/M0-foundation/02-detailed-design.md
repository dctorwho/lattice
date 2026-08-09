# M0 detailed design

## Iteration context

- Iteration: `M0`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules:
  [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

The main process owns lifecycle, BrowserWindow creation, session and
WebContents policy, native menus, OS handoff, and diagnostics. Preload exposes
only narrowly typed frozen capabilities. The renderer owns React shell state
and the pure TypeScript command registry; it never receives raw Node,
Electron, filesystem, shell, window identity, or arbitrary IPC access.

## Capability design

### Reproducible engineering foundation

Pin the package manager and runtime versions, keep a single lockfile, and
provide format, lint, strict type, unit, integration, E2E, security,
performance, cold-bootstrap, build, and aggregate commands. Fault injection
runs in isolated copies and the nested aggregate check has a bounded recursion
guard. The early bootstrap exception records concrete command exit codes;
subsequent regression coverage automates the same bootstrap invariant.

### Secure Electron shell

Enable sandboxing before readiness. BrowserWindow options disable Node,
DevTools, webviews, and insecure content. Session policy supplies CSP and
denies permission checks and requests. WebContents policy synchronously blocks
navigation, redirects, new windows, and webview attachment. The external URL
policy bounds and parses input, allows only credential-free approved targets
after confirmation, and hands only the normalized URL to the OS.

### Shared contracts and diagnostics

Contracts in `src/shared/contracts/` derive strict TypeScript types from Zod.
Fixed routes validate sender ownership, budgets, request schema, handler
result, response schema, and JSON-like serializability in order. Main derives
window/WebContents/session context; renderer input cannot supply it. Stable
`Result` errors use localization keys and diagnostics retain only bounded,
approved redacted fields.

### Command and window shell

The pure renderer `CommandRegistry` is the single command authority. Shared
metadata supplies stable IDs, labels, shortcuts, grouping, and localization.
Buttons, renderer context menus, and shortcuts invoke the registry directly;
the native menu is a validated, per-focused-window projection and returns only
approved command events. Invalid, stale, missing, destroyed, or unfocused
targets fail closed. Sidebar and About flows restore focus deterministically.

### CI, dependency audit, and packaged artifact gate

Run Windows CI-equivalent commands from clean checkouts. Audit production
dependency versions and licenses, generate a parseable SBOM, verify command
documentation matches executable scripts, and prove the packaged artifact
launches without development URLs or privilege regressions.

## Module responsibilities

- `src/main/bootstrap` composes sandbox setup and the immutable main-window
  configuration.
- `src/main/security` owns CSP, permissions, WebContents, and external URLs.
- `src/shared/contracts` and `src/shared/errors` own Zod schemas and stable
  error vocabulary.
- `src/main/ipc` owns route validation and application-derived sender context.
- `src/preload/api` exposes frozen validated methods only.
- `src/domain/commands`, `src/shared/commands`, and `src/shared/i18n` own
  command behavior, metadata, and localized labels.

## Interfaces and data flow

`renderer command state -> frozen preload schema validation -> fixed IPC route
-> sender/window validation -> bounded Zod payload -> native-menu snapshot`.

`native menu click -> authorized focused window -> fixed validated event ->
preload validation -> CommandRegistry.execute`.

`renderer app request -> frozen preload request ID -> fixed route ->
main-derived identity -> budgets and Zod validation -> Result response ->
preload response validation -> renderer`.

## Data safety, failure handling, migration, and compatibility constraints

No product document or rich-text model is introduced here. Security policy
failure, invalid sender, invalid schema, serialization budget breach, or
diagnostic-sink failure returns a stable fail-closed result without raw payload
logging. No arbitrary channel, event registration, file method, or permission
fallback is permitted. Packaging and dependency failures retain evidence and
block the iteration rather than weakening checks.

## Dependency admission

Production dependencies require a recorded purpose in the technology-stack
document, compatible license, pinned version, audit visibility, and inclusion
in the SBOM. Optional tools may not become a prerequisite for core editing or
native export behavior.

## Manual-gate design

The evaluator inspects a packaged Windows build, process parameters, DevTools
and navigation behavior, frozen preload surface, CI evidence, licenses, and
SBOM. The resulting screenshots, hashes, audit reports, and signed conclusion
belong to the M0 evidence record; an agent may prepare them but may not approve
the gate.

## Implementation order

- [ ] Establish reproducible bootstrap, lockfile, strict checks, and fault-injection coverage.
- [ ] Apply production sandbox, window, session, WebContents, and URL policies.
- [ ] Add strict shared contracts, sender ownership, bounded values, and redacted errors.
- [ ] Deliver the shared command metadata, registry, menu projection, and accessible shell.
- [ ] Run CI/audit/SBOM/packaging checks and hand the manual evaluation to its evaluator.
