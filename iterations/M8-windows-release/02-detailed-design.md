# M8 detailed design

## Iteration context

- Iteration: `M8`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

Packaging is a main-process/build concern; renderer code never gains installer, registry,
signing, update, or arbitrary-shell capability. User documents remain independent Markdown
files. Installation directory and Electron `userData` are distinct; source/recovery safeguards
remain active before, during, and after OS integration.

## Capability design

### Reproducible NSIS artifacts and lifecycle

Build clean x64 unpacked and NSIS artifacts from an identified source state with versioned
resources, no development files, and recorded hashes. Per-user installation, repair, upgrade,
failure rollback, and uninstall use a narrowly declared file scope. Uninstall offers explicit
userData retention/cleanup; it never enumerates or removes workspace, Documents, neighboring,
junction, or symlink paths as application data.

### Instance, association, and argv routing

The single-instance coordinator receives parsed second-launch argv, validates supported files,
folders, and line/column location values, and routes them to a current or new window according
to settings. Explorer/association and PowerShell inputs preserve Unicode/long/quoted paths
without shell concatenation. Unauthorized or malformed paths fail safely; a dirty active
session is protected before opening a replacement target.

### Update readiness and release evidence

The update adapter is hidden/disabled until a trusted public key and signed channel/feed are
configured. It validates downloaded artifact/hash/signature, preserves dirty sessions through
save/recovery, and keeps a runnable prior version on interruption or failure. Release tooling
generates an SBOM, third-party notices, hashes, signing verification steps, naming, release
notes, privacy/security entry points, VM evidence links, gap inventory, and rollback rehearsal.

## Module responsibilities

- Build/release tooling: clean artifact construction, metadata, SBOM/license/hash reports,
  signing input/output verification, and reproducibility comparison.
- Main process: single-instance lock, argv dispatch, association integration, updater state,
  recovery/save handoff, and localized error reporting.
- Installer: declared app/userData lifecycle only, rollback, and explicit userData choice.
- Shared contracts: bounded route/update requests, stable state/error schemas, and evidence
  manifest shape.

## Interfaces and data flow

`clean source -> packaged artifacts -> hashes/SBOM/licenses -> signing verification -> VM
evidence`; `Explorer/argv -> parsed route request -> authorization -> single-instance dispatch
-> protected session/window`; and `trusted signed feed -> verified download -> recovery/save
handoff -> installer rollback-safe apply` are the only flows. No renderer-supplied command
line, path, signature, or update package is trusted without main-process validation.

## Data safety, failure handling, migration, and compatibility constraints

Upgrade preserves settings, themes, and recovery under their versioned migration rules; failure
does not strand the user without a runnable prior version. Routing never drops unsaved work.
Uninstall has exact declared deletion boundaries and verifies canary hashes before/after.
Updates remain disabled in personal/unsigned builds. Release evidence contains hashes and
safe metadata, not private document/log/secret contents. Rollback proves settings/document
preservation and recovery compatibility.

## Dependency admission

Packaging, updater, SBOM, license, and signing tools require documented licenses, pinned
provenance, reproducible execution, and secret-free logs. Signing private keys stay in an
external controlled store; CI/repository artifacts may contain only public verification data.

## Manual-gate design

M8 has a state-defined manual gate. The evaluator performs the Win10/Win11 VM journey with
Explorer, PowerShell, IME, printing, scaling, multi-monitor, upgrade, and both uninstall
choices, then independently reviews the seven-day Stable audit, signing, rollback, and
artifact evidence. Agents may prepare evidence but never approve these observations.

## Implementation order

- [ ] Establish clean reproducible packaging and artifact inventory.
- [ ] Add bounded single-instance, association, and command-line routing.
- [ ] Prove upgrade/uninstall scope and rollback with VM canaries.
- [ ] Add disabled-by-default signed update adapter and failure handling.
- [ ] Produce supply-chain evidence, run VM matrix, rehearse rollback, and collect Stable audit approval.

The checklist orders work only. Its items do not have individual status, dependencies,
evidence, reports, or independent gating behavior; `M8` is the sole execution and acceptance unit.
