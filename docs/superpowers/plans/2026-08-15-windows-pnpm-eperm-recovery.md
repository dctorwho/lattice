# Windows pnpm EPERM Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the isolated M0 bootstrap verifier recover once from pnpm's exact transient Windows `importPackage` rename lock while every other install failure remains fail-closed.

**Architecture:** Keep recovery inside the bootstrap helper's install boundary. Classify the complete command result with a narrow path-correlating predicate, then perform one bounded cleanup-delay-retry cycle before reusing the existing terminal success assertion and cleanup behavior.

**Tech Stack:** TypeScript 5.9 strict mode, Node.js 24 filesystem/path APIs, Vitest 4.1, pnpm 11.12.0, Windows GitHub Actions.

## Global Constraints

- There are exactly two possible install attempts; no loop or recursive retry is allowed.
- Retry only a non-timeout result containing `ERR_PNPM_EPERM`, `importPackage`, `EPERM: operation not permitted, rename`, and matching pnpm temporary/final/import paths.
- Keep `pnpm install --frozen-lockfile`, the selected store directory, and `--offline` unchanged between attempts.
- Remove only the isolated copied project's `node_modules` tree before retrying.
- Timeouts, non-matching failures, cleanup failures, and the second install failure stop immediately.
- Do not change dependencies, workflow timeouts, pnpm import strategy, or security configuration.

---

### Task 1: Add bounded install recovery with regression coverage

**Files:**

- Modify: `tests/helpers/bootstrap-project.ts`
- Test: `tests/unit/helpers/bootstrap-project.spec.ts`

**Interfaces:**

- Consumes: existing `CommandResult`, `runCommand`, `removeWithRetry`, and `pnpmCommand` boundaries.
- Produces: optional `BootstrapOptions.wait?: (milliseconds: number) => Promise<void>` test boundary; `verifyBootstrap(options): Promise<BootstrapEvidence>` remains the public operation.

- [ ] **Step 1: Add the successful transient-recovery test**

Add a deterministic pnpm diagnostic fixture and let `fakeRunner` return injected install results in order:

```ts
const packagePath = String.raw`D:\a\_temp\copy\node_modules\.pnpm\electron-winstaller@5.4.0\node_modules\electron-winstaller`

function transientInstallFailure(): CommandResult {
  return {
    exitCode: 1,
    stdout: '',
    stderr:
      `[ERR_PNPM_EPERM] [importPackage ${packagePath}] ` +
      `EPERM: operation not permitted, rename '${packagePath}_tmp_123_1' -> '${packagePath}'`,
    timedOut: false
  }
}
```

Extend the fake runner options with
`installResults?: readonly CommandResult[]`, consume one result per install
call, and add a test which supplies `[transientInstallFailure()]`. Inject a
recording `remove` and `wait`, then assert two identical install argument lists,
one `node_modules` removal, and one fixed wait request.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm.cmd exec vitest run --config vitest.config.ts tests/unit/helpers/bootstrap-project.spec.ts
```

Expected: the new recovery case fails because `verifyBootstrap` currently
throws after the first install result; all pre-existing cases stay green.

- [ ] **Step 3: Add fail-closed classifier tests**

Add separate cases proving the failure boundaries. Each case obtains install
calls with `fake.calls.filter((call) => call.args.includes('install'))`:

```ts
it('does not retry an unrelated EPERM failure', async () => {
  const fake = fakeRunner({
    installResults: [
      {
        exitCode: 1,
        stdout: '',
        stderr: 'EPERM: operation not permitted, rename unrelated paths',
        timedOut: false
      }
    ]
  })
  await expect(verifyBootstrap(bootstrapOptions(fake.run))).rejects.toThrow(/install.*1/)
  expect(fake.calls.filter((call) => call.args.includes('install'))).toHaveLength(1)
})

it('does not retry a timed-out install', async () => {
  const failure = transientInstallFailure()
  const fake = fakeRunner({ installResults: [{ ...failure, timedOut: true }] })
  await expect(verifyBootstrap(bootstrapOptions(fake.run))).rejects.toThrow('timed out')
  expect(fake.calls.filter((call) => call.args.includes('install'))).toHaveLength(1)
})

it('stops after a second matching transient failure', async () => {
  const fake = fakeRunner({
    installResults: [transientInstallFailure(), transientInstallFailure()]
  })
  await expect(
    verifyBootstrap({ ...bootstrapOptions(fake.run), wait: () => Promise.resolve() })
  ).rejects.toThrow(/install.*1/)
  expect(fake.calls.filter((call) => call.args.includes('install'))).toHaveLength(2)
})

it('stops when partial dependency cleanup fails', async () => {
  const fake = fakeRunner({ installResults: [transientInstallFailure()] })
  const remove: typeof removeWithRetry = async (target) => {
    if (basename(target) === 'node_modules') {
      throw new Error('injected retry cleanup failure')
    }
    await rm(target, { recursive: true, force: true })
  }
  await expect(
    verifyBootstrap({ ...bootstrapOptions(fake.run), remove, wait: () => Promise.resolve() })
  ).rejects.toThrow('injected retry cleanup failure')
  expect(fake.calls.filter((call) => call.args.includes('install'))).toHaveLength(1)
})
```

Add a local `bootstrapOptions(run)` helper returning the existing common
`sourceRoot`, `tempParent`, `mode`, `storeDirectory`, `relativePaths`, and
injected runner values so the cases above contain no hidden setup. The
unrelated fixture omits the correlated `ERR_PNPM_EPERM`/`importPackage` rename
signature. The timeout fixture sets `timedOut: true`. The persistent fixture
supplies the transient result twice. The cleanup fixture rejects only when
`basename(target) === 'node_modules'` and allows final project cleanup.

- [ ] **Step 4: Implement the narrow classifier and one retry**

Add these private constants and boundary:

```ts
const installRetryDelayMs = 500

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

function isRetryableImportRenameFailure(result: CommandResult): boolean {
  if (result.timedOut) return false
  const detail = `${result.stderr}\n${result.stdout}`
  const imported = detail.match(/\[ERR_PNPM_EPERM\]\s+\[importPackage ([^\]\r\n]+)\]/)
  const renamed = detail.match(
    /EPERM: operation not permitted, rename '([^'\r\n]+)_tmp_\d+(?:_\d+)?' -> '([^'\r\n]+)'/
  )
  if (imported?.[1] === undefined || renamed?.[1] === undefined || renamed[2] === undefined) {
    return false
  }
  const normalizeWindowsPath = (value: string): string => win32.normalize(value).toLowerCase()
  const importedPath = normalizeWindowsPath(imported[1])
  return (
    importedPath === normalizeWindowsPath(renamed[1]) &&
    importedPath === normalizeWindowsPath(renamed[2])
  )
}
```

Add `wait` to `BootstrapOptions`, default it to `delay`, and replace the single
install call with explicit first/terminal results:

```ts
let installResult = await runPnpmOnce(run, projectRoot, installArguments)
if (isRetryableImportRenameFailure(installResult)) {
  await remove(join(projectRoot, 'node_modules'))
  await wait(installRetryDelayMs)
  installResult = await runPnpmOnce(run, projectRoot, installArguments)
}
assertCommandSucceeded('pnpm install', installResult)
```

Split the current `runPnpm` only enough to expose a private `runPnpmOnce` which
returns the raw result. Keep all non-install callers on the existing
asserting `runPnpm` path.

- [ ] **Step 5: Run focused GREEN and static checks**

Run:

```powershell
pnpm.cmd exec vitest run --config vitest.config.ts tests/unit/helpers/bootstrap-project.spec.ts
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd format:check
git diff --check
```

Expected: all commands exit `0`; every bootstrap helper case passes.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- tests/helpers/bootstrap-project.ts tests/unit/helpers/bootstrap-project.spec.ts
git diff --cached --check
git commit -m "fix: retry transient pnpm import locks"
```

Expected: exactly the helper and its focused unit test are committed.

### Task 2: Prove repository and GitHub gate behavior

**Files:**

- No source files are added or modified.
- Evidence target: GitHub pull request `#1`, required check `quality`.

**Interfaces:**

- Consumes: Task 1's committed `verifyBootstrap` behavior.
- Produces: local full-gate evidence and a GitHub Actions required-check result.

- [ ] **Step 1: Run the live isolated bootstrap integration case**

Run:

```powershell
pnpm.cmd exec vitest run --config vitest.integration.config.ts tests/integration/project-bootstrap.spec.ts
```

Expected: the Chinese-and-space clean-copy offline install and both builds pass.

- [ ] **Step 2: Run the complete local gate**

Run:

```powershell
node scripts/verify-planning-docs.mjs
pnpm.cmd check
```

Expected: planning verification, formatting, lint, strict type checking, unit
coverage, all integration cases, and production build exit `0`.

- [ ] **Step 3: Push the branch and wait for the required check**

Push `codex/iteration-governance`, confirm pull request `#1` points at the new
commit, and inspect the finite GitHub Actions run until `quality` completes.
Do not merge while the required check is pending or failing.

- [ ] **Step 4: Report exact evidence**

Report the commit SHA, local command results, GitHub run URL and conclusion,
changed files, and any residual risk. If GitHub fails with a different defect,
retain its logs and stop for root-cause analysis rather than broadening the
retry classifier.
