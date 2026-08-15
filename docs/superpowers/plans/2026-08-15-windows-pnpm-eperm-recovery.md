# Remove the Unused Squirrel Peer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep electron-builder's pinned NSIS/dir capability while removing its unused Squirrel peer and electron-winstaller dependency from every frozen install.

**Architecture:** Express the capability decision as one version-scoped pnpm root override, regenerate the lockfile, and restore bootstrap failure handling to one strict install attempt. Lock the dependency policy with focused text-contract tests and verify it through a real offline clean copy and GitHub's Windows quality gate.

**Tech Stack:** pnpm 11.12.0 workspace settings and lockfile, TypeScript 5.9, Vitest 4.1, Electron Builder 26.15.3, Windows GitHub Actions.

## Global Constraints

- Keep `electron-builder@26.15.3`, Windows x64 `dir`, and NSIS capability.
- Remove only `app-builder-lib@26.15.3>electron-builder-squirrel-windows`.
- Do not set `autoInstallPeers: false` globally.
- Keep only the reviewed `allowBuilds.esbuild: true` install script.
- Do not add install retries, timeout increases, Squirrel support, or new dependencies.
- Any frozen install error remains terminal.

---

### Task 1: Lock the dependency-graph policy with RED tests

**Files:**

- Modify: `tests/unit/quality-config.spec.ts`

**Interfaces:**

- Consumes: committed `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and `package.json` text.
- Produces: a focused regression contract for the exact override and forbidden package entries.

- [ ] **Step 1: Add the failing policy test**

Read all three files and add this case:

```ts
it('removes only the unused pinned Squirrel peer from the packaging graph', async () => {
  const [workspace, lockfile, manifestText] = await Promise.all([
    readFile(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8'),
    readFile(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8'),
    readFile(join(process.cwd(), 'package.json'), 'utf8')
  ])
  const manifest: unknown = JSON.parse(manifestText)

  expect(workspace).toMatch(
    /overrides:\s*\n\s*['"]app-builder-lib@26\.15\.3>electron-builder-squirrel-windows['"]:\s*['"]-['"]/
  )
  expect(workspace).not.toMatch(/^autoInstallPeers:/m)
  expect(workspace).toMatch(/allowBuilds:\s*\n\s*esbuild:\s*true/)
  expect(workspace).not.toContain('electron-winstaller')
  expect(lockfile).not.toMatch(/^\s{2}electron-winstaller@5\.4\.0:/m)
  expect(lockfile).not.toMatch(/^\s{2}electron-builder-squirrel-windows@26\.15\.3(?:\([^\n]+\))?:/m)
  expect(manifest).toMatchObject({ devDependencies: { 'electron-builder': '26.15.3' } })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm.cmd test tests/unit/quality-config.spec.ts
```

Expected: the new case fails because the override is absent and the forbidden
package entries still exist. Existing quality-configuration cases remain green.

### Task 2: Remove the unused peer and symptom-level retry

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify: `tests/helpers/bootstrap-project.ts`
- Modify: `tests/unit/helpers/bootstrap-project.spec.ts`

**Interfaces:**

- Consumes: pnpm's root `overrides` edge-removal syntax.
- Produces: a 489-package frozen graph with the current `verifyBootstrap(options): Promise<BootstrapEvidence>` API and one install attempt.

- [ ] **Step 1: Apply the narrow workspace policy**

Make `pnpm-workspace.yaml` exactly preserve the workspace and esbuild approval
while adding the scoped override:

```yaml
packages:
  - '.'

allowBuilds:
  esbuild: true

overrides:
  'app-builder-lib@26.15.3>electron-builder-squirrel-windows': '-'
```

- [ ] **Step 2: Regenerate the lockfile offline**

Run:

```powershell
pnpm.cmd install --offline --lockfile-only
pnpm.cmd install --offline --frozen-lockfile
```

Expected: both commands exit `0`; pnpm reports 489 installed packages; no
Squirrel or electron-winstaller package directory is present.

- [ ] **Step 3: Restore strict one-attempt bootstrap behavior**

In `tests/helpers/bootstrap-project.ts`, remove `BootstrapOptions.wait`, the
retry delay and classifier helpers, `runPnpmOnce`, and the retry branch. Restore
the install call to:

```ts
await runPnpm(run, projectRoot, installArguments, 'pnpm install')
```

In `tests/unit/helpers/bootstrap-project.spec.ts`, remove the transient failure
fixture, ordered install-result support, common retry options helper, and the
five retry-specific cases. Retain the existing `reports an install-stage exit
code` case as the fail-closed contract.

- [ ] **Step 4: Run focused GREEN**

Run:

```powershell
pnpm.cmd test tests/unit/quality-config.spec.ts tests/unit/helpers/bootstrap-project.spec.ts
pnpm.cmd peers check
pnpm.cmd ignored-builds
```

Expected: focused tests pass; peer check reports no issues; ignored builds
reports automatic `None` and no explicit denial section.

### Task 3: Align the admitted-dependency record

**Files:**

- Modify: `docs/04-technology-stack.md`
- Modify: `iterations/M0-foundation/02-detailed-design.md`
- Modify after verification: `iterations/M0-foundation/04-test-report.md`

**Interfaces:**

- Consumes: Task 2's exact graph and observed command output.
- Produces: an accurate M0 dependency decision and test evidence.

- [ ] **Step 1: Replace the obsolete explicit-denial decision**

Record that the version-scoped override removes the unused Squirrel peer,
electron-winstaller no longer installs or exposes its script, all other peer
resolution remains enabled, and electron-builder upgrades require reassessing
or removing the override.

- [ ] **Step 2: Record only fresh verification evidence**

After Task 4, update the M0 test report with exact package count, peer-check,
ignored-build, local full-gate, and GitHub required-check results. Do not mark
M0 passed or create an exit report.

### Task 4: Verify, commit, publish, and observe the required gate

**Files:**

- No additional source files.

**Interfaces:**

- Consumes: Tasks 1-3 final tree.
- Produces: local and GitHub Windows acceptance evidence.

- [ ] **Step 1: Run local gates**

```powershell
pnpm.cmd test:integration tests/integration/project-bootstrap.spec.ts
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git diff --check
```

Expected: every command exits `0`, including the Chinese-and-space clean-copy
bootstrap, full unit/integration matrix, and production build.

- [ ] **Step 2: Commit the correction**

Stage only the workspace policy, lockfile, strict bootstrap helper/tests,
quality-config test, and M0 documentation. Commit with:

```powershell
git commit -m "fix: remove unused Squirrel packaging peer"
```

- [ ] **Step 3: Push and wait for GitHub**

Fast-forward `codex/iteration-governance`, verify the remote tree matches the
locally tested tree, and wait for PR #1's required `quality` job to reach a
terminal conclusion. Do not merge on pending or failure.
