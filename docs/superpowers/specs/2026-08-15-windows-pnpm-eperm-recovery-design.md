# Remove the unused Squirrel peer design

## Context

M0 requires a frozen, offline-capable Windows bootstrap in a path containing
Chinese characters and spaces. GitHub-hosted Windows runners consistently fail
while pnpm imports `electron-winstaller@5.4.0`: Windows denies pnpm's temporary
directory rename with `ERR_PNPM_EPERM`.

A bounded cleanup and one-retry implementation was tested locally and in the
required GitHub `quality` job. The second install hit the same package lock, so
the failure is not safely addressed as a single transient event. Path analysis
also excludes the classic 260-character limit: the failing package directory is
158 characters and its deepest projected child is 207 characters.

The dependency exists because pnpm automatically satisfies
`app-builder-lib@26.15.3`'s `electron-builder-squirrel-windows` peer. Lattice M0
uses only Windows x64 `dir` and NSIS packaging. It does not use Squirrel, so the
peer and its `electron-winstaller` dependency provide no accepted capability.

## Goal

Preserve the pinned `electron-builder@26.15.3` NSIS/dir capability while
removing the unused Squirrel dependency edge from the resolved and installed
graph. The bootstrap must then remain strict: any install failure is terminal,
with no retry or timeout expansion.

## Dependency policy

Add one version-scoped root override to `pnpm-workspace.yaml`:

```yaml
overrides:
  'app-builder-lib@26.15.3>electron-builder-squirrel-windows': '-'
```

pnpm 11 applies root overrides to peer dependencies and supports `-` as an
explicit dependency-edge removal. The parent and version are fixed so an
electron-builder upgrade cannot silently inherit the exception.

Remove `allowBuilds.electron-winstaller: false` because the package no longer
belongs in the dependency graph. Keep `allowBuilds.esbuild: true` unchanged.
Do not disable `autoInstallPeers` globally; unrelated peer resolution must keep
its current behavior.

Regenerate `pnpm-lock.yaml` with pinned pnpm 11.12.0. The resulting graph must
not contain package or snapshot entries for `electron-winstaller@5.4.0` or
`electron-builder-squirrel-windows@26.15.3`. The version-scoped override remains
recorded as lockfile policy metadata.

## Bootstrap behavior

Restore `verifyBootstrap` to a single pnpm install attempt. Remove the injected
wait boundary, EPERM classifier, partial `node_modules` cleanup, and retry tests.
The existing install-stage error test continues to prove that every install
failure stops the bootstrap and retains its exit code.

The ignored-build parser remains fail-closed and keeps support for pnpm's
explicit-denial section, but the live project output must be:

```text
Automatically ignored builds during installation:
  None
```

## Verification

Add focused configuration tests which prove:

- the exact version-scoped override exists;
- global `autoInstallPeers: false` is absent;
- only `esbuild: true` remains under `allowBuilds`;
- the lockfile has no Squirrel or electron-winstaller package/snapshot entry;
- the pinned electron-builder version remains declared.

Then regenerate dependencies and require:

- frozen offline install succeeds;
- `pnpm peers check` reports no issues;
- `pnpm ignored-builds` reports automatic `None` with no explicit denial;
- focused unit coverage passes;
- the isolated Chinese-and-space bootstrap passes;
- `node scripts/verify-planning-docs.mjs` and `pnpm check` pass;
- the GitHub required `quality` job succeeds.

## Documentation

Update the technology ledger and M0 detailed design to record the exact removed
peer edge, its version scope, the retained NSIS/dir capability, the removal of
the unused install-script exposure, and the required upgrade review. Update the
M0 test report only with commands and results that were actually observed.

## Non-goals

- Retrying or ignoring arbitrary pnpm failures.
- Disabling peer auto-installation across the project.
- Adding Squirrel packaging support.
- Changing pnpm, Electron, electron-builder, runner security, antivirus, or
  workflow timeout settings.
- Replacing electron-builder or weakening the Chinese-and-space path contract.
