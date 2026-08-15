# Windows pnpm EPERM recovery design

## Context

The required Windows quality workflow runs the M0 bootstrap verifier in clean
project copies. On GitHub-hosted Windows runners, pnpm 11.12.0 can fail while
importing a package from the offline store with `ERR_PNPM_EPERM`: Windows
temporarily denies pnpm's rename from its generated package temporary directory
to the final package directory. The failure remains after serializing the
integration suite and moving temporary copies to the runner's canonical short
temporary directory, so neither concurrent test execution nor path length is
the remaining cause.

The verifier must tolerate this one transient operating-system condition
without hiding dependency, lockfile, network, timeout, or persistent filesystem
failures.

## Scope

Change only the M0 bootstrap test helper and its focused tests. Keep the pnpm
version, frozen-lockfile policy, offline store, project-copy isolation, build
hash checks, ignored-build checks, workflow commands, and integration-suite
serialization unchanged.

## Recovery policy

The install boundary recognizes a retryable failure only when all of these
conditions hold:

- the command did not time out;
- pnpm output identifies `ERR_PNPM_EPERM` and `importPackage`;
- the operating-system diagnostic is `EPERM: operation not permitted, rename`;
- the rename source is pnpm's generated package temporary directory and the
  destination is its corresponding final package directory.

On the first matching failure, the verifier removes only the copied project's
`node_modules` tree with the existing bounded cleanup helper, waits for a short
fixed interval, and invokes the same pinned pnpm install command once more.
The retry uses the same project root, frozen lockfile, store directory, and
offline flag.

There are exactly two install attempts. A second matching failure is reported
through the existing install-stage error path. A timeout or any non-matching
failure is reported immediately without cleanup-and-retry. Failure to clean the
partial dependency tree also stops immediately.

## Interfaces and data flow

`verifyBootstrap` remains the public entry point. Its injected command runner
and removal function continue to provide deterministic test boundaries. A
small injected wait function is added so unit tests can prove the delay request
without sleeping.

The flow is:

1. Copy and validate the isolated project.
2. Run the pinned pnpm install command.
3. If and only if the first result matches the retryable signature, remove the
   copied `node_modules`, request the fixed delay, and rerun that same command.
4. Apply the existing success assertion to the terminal result.
5. Continue ignored-build and two-build hash verification unchanged.
6. Preserve the existing final cleanup and aggregate-error behavior.

## Verification design

Focused unit coverage proves:

- one exact transient import-package rename failure is cleaned up, delayed,
  retried once, and can complete successfully;
- an unrelated `EPERM` failure is not retried;
- a command timeout is not retried;
- two matching transient failures stop after the second attempt;
- retry cleanup failure prevents the second install;
- install arguments are identical across attempts and remain frozen/offline.

Existing bootstrap unit and integration cases must remain green. Final
acceptance requires formatting, lint, strict type checking, unit tests,
integration tests, build, the planning verifier, and the GitHub `quality` check.

## Non-goals

- Retrying arbitrary pnpm failures.
- Increasing command or workflow timeouts.
- Changing dependency versions, package import strategy, antivirus settings,
  or GitHub runner security configuration.
- Creating an unbounded loop or converting a persistent install failure into a
  passing result.
