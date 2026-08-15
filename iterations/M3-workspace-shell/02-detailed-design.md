# M3 detailed design

## Iteration context

- Iteration: `M3`
- State authority: `iterations/state.json`
- Governing architecture: [architecture](../../docs/03-architecture.md)
- Governing data-safety and security rules: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Architecture boundaries

Main owns authorized roots, filesystem mutation, windows, sidecar lifecycle,
and persistence. Renderer owns virtualized presentation and command state.
All paths are main-validated; ripgrep uses `spawn(executable, args,
{ shell: false })` and cancellable streams.

## Capability design

### Command shell and workspace authorization

Project commands share command metadata/registry across menu, toolbar, context,
and shortcuts. Folder selection grants a root capability; enumeration applies
extension, hidden, ignore, case, and symlink policy and can cancel without
blocking the editor.

### File views and operations

Tree/list views share sorted snapshots and selection/expansion state. Create,
rename, move, recycle-bin delete, and reveal perform preflight, confirmation
where dangerous, filesystem action, watcher reconciliation, and UI commit;
failure never reports success or loses active source.

### Navigation and search

Outline derives from the current incremental syntax tree. Quick open searches
authorized relative paths. Global search streams sidecar results with limits,
dedupes dirty-session results, and terminates process/work on cancellation.

### Recent projects and sessions

Persist window geometry, monitor-safe bounds, sidebar state, active file,
scroll anchor, and recent roots without document text. Invalid/corrupt records
fall back safely and missing paths remain removable.

## Module responsibilities

Workspace service owns root/snapshots; file-operation service owns reversible
mutations; outline/quick-open are renderer projections; search adapter owns
sidecar cancellation; session storage owns sanitized per-window records.

## Interfaces and data flow

`authorized root -> enumeration snapshot -> tree/list/quick-open`; `file
command -> preflight -> filesystem -> watcher reconcile -> UI result`; `query
-> spawned sidecar args -> streamed capped results -> cancel terminates child`.

## Data safety, failure handling, migration, and compatibility constraints

Never trust renderer paths; prevent symlink/root escape. No shell command
composition. Recycle-bin deletion and overwrite-risk actions require clear
confirmation. Session records never contain source text; geometry restores only
inside a visible display area.

## Dependency admission

The ripgrep binary is packaged, versioned, integrity-checked, and invoked only
from trusted resources. New filesystem dependencies require license and
failure/cancellation tests.

## Manual-gate design

The documented manual scenario exercises a 10,000+ file repository, sync
events, file operations, cancelled search, and a disconnected display; it is
evidence preparation rather than a state-required approval.

## Implementation order

- [ ] Project command shell and authorized root enumeration.
- [ ] Shared tree/list snapshots and recoverable file operations.
- [ ] Incremental outline, quick open, and cancellable sidecar search.
- [ ] Sanitized recent-project and visible-window restoration.
- [ ] Large-workspace security, performance, and practical manual verification.
