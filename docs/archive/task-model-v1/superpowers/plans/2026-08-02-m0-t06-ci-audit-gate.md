# M0-T06 CI, Dependency Audit, and Milestone Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a reproducible Windows package, auditable production dependency/license/vulnerability/SBOM evidence, and enforced GitHub quality gates, then place M0 at its explicit Windows 11 manual approval gate.

**Architecture:** Deterministic project-owned Node modules normalize pnpm JSON into reports and a CycloneDX 1.6 SBOM; electron-builder creates Windows x64 unpacked and NSIS artifacts from an allowlisted package surface. SHA-pinned GitHub workflows run the same finite local gates, and a main-branch ruleset is activated only after the bootstrap PR proves the real check names.

**Tech Stack:** Node 24, pnpm 11.12.0, Electron 43.1.1, electron-builder 26.15.3, CycloneDX JSON 1.6, Vitest 4.1.10, Playwright Electron 1.61.1, GitHub Actions, CodeQL, Dependency Review, Dependabot, GitHub CLI.

## Global Constraints

- Begin M0-T06 only after M0-T05 is `passed`; implement no M1 feature.
- Add only `electron-builder@26.15.3` and add it as an exact development dependency.
- Keep core editing/build/test behavior independent of Pandoc, signing, publishing, update services, and admin rights.
- Package only approved application output/resources; exclude tests, docs, `.git`, reports, source maps unless explicitly required, and local paths.
- Use an original Lattice icon; do not use Electron defaults, Typora assets, generated-AI copies, or third-party branded material.
- The production SBOM is CycloneDX JSON 1.6 and covers every production dependency exactly once.
- Production license policy fails closed on missing, unknown, or non-allowlisted expressions; the initial allowlist is exactly `MIT` because that is the current production graph.
- `pnpm audit --prod --json` fails closed on command/network/schema errors and on any high or critical advisory; moderate and low are recorded.
- Pin every GitHub Action to the exact full commit SHA listed in the approved design; floating tags are forbidden.
- GitHub workflows use minimum permissions and never use `pull_request_target`.
- Do not activate a required check until an actual successful check with its exact context name exists.
- Do not weaken a ruleset to make a failing PR merge; fix the root cause and rerun.
- All waits use GitHub CLI's bounded `--watch --interval 10 --fail-fast` under an outer 30-minute process timeout, or one-time status reads; no infinite polling.
- Do not mark M0-T06 `passed` or unlock M1-T01 until the user explicitly signs off MAN-M0-001.
- Commit each independently reviewable deliverable; infrastructure enters `main` through GitHub PRs once the bootstrap workflows exist.

---

## File Map

| File                                          | Responsibility                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `tasks/state.json`                            | Select M0-T06, hold at `awaiting_manual`, then pass only after sign-off |
| `tasks/M0-foundation.md`                      | Exact audit, CI, packaging, GitHub, and manual-gate contract            |
| `package.json`, `pnpm-lock.yaml`              | Pin electron-builder and expose finite audit/package commands           |
| `build/brand/lattice-icon.svg`                | Reviewable original vector source                                       |
| `build/brand/lattice-icon-256.png`            | Deterministic raster source for Windows packaging                       |
| `build/brand/lattice.ico`                     | Windows icon containing the approved 256px PNG image                    |
| `build/brand/README.md`                       | Design ownership, generation command, hashes, and review record         |
| `scripts/assets/build-lattice-icon.mjs`       | Deterministically generate PNG/ICO from project-owned geometry          |
| `scripts/audit/audit-core.mjs`                | Pure normalization, policy, SBOM, and redaction functions               |
| `scripts/audit/audit-core.d.mts`              | Strict TypeScript declarations for audit-core imports                   |
| `scripts/audit/run-dependency-audit.mjs`      | Bounded pnpm command orchestration and JSON reports                     |
| `scripts/audit/generate-sbom.mjs`             | CycloneDX 1.6 output from normalized production graph                   |
| `scripts/audit/hash-artifacts.mjs`            | Relative-path SHA-256 artifact manifest                                 |
| `scripts/audit/run-m0-audit.mjs`              | Compose planning, dependency, SBOM, and artifact checks                 |
| `scripts/verify-workflows.mjs`                | Static workflow SHA, permissions, trigger, and command checks           |
| `tests/unit/audit/audit-core.spec.ts`         | License, vulnerability, graph, SBOM, redaction, determinism matrix      |
| `tests/integration/m0-gate.spec.ts`           | TC-M0-007 clean-copy audit/package command parity                       |
| `tests/e2e/packaged-app.spec.ts`              | Launch unpacked production executable and recheck security surface      |
| `.github/workflows/ci.yml`                    | Windows quality, Electron, audit, and package checks                    |
| `.github/workflows/codeql.yml`                | SHA-pinned JS/TS CodeQL workflow                                        |
| `.github/workflows/dependency-review.yml`     | SHA-pinned incremental dependency/license gate                          |
| `.github/dependabot.yml`                      | Weekly pnpm and Actions updates without auto-merge                      |
| `docs/04-technology-stack.md`                 | electron-builder admission and audited action ledger                    |
| `docs/05-data-safety-and-security.md`         | CI token/artifact/report and package trust boundaries                   |
| `docs/09-test-strategy.md`                    | TC-M0-007 and MAN-M0-001 allocation                                     |
| `docs/12-build-release-operations.md`         | Exact package/audit commands and unsigned-build risk                    |
| `docs/14-dependency-license-sbom.md`          | Policy, normalized report schemas, and exception rules                  |
| `docs/16-project-structure-and-standards.md`  | Build, audit, workflow, resource, and artifact ownership                |
| `docs/test-cases/M0-foundation.md`            | Executable CI/package/manual acceptance steps                           |
| `docs/evidence/M0-T06-ci-audit-2026-08-02.md` | Local/CI/GitHub/manual evidence ledger                                  |
| `artifacts/m0/*`                              | Ignored generated reports and hashes, uploaded by CI only               |

---

### Task 1: Validate the Existing Public Repository and Select M0-T06

**Files:**

- Modify: `tasks/state.json`
- Modify: `tasks/M0-foundation.md`

**Interfaces:**

- Consumes: M0-T05 `passed`, M0-T06 `ready`, authenticated GitHub CLI, configured `origin`
- Produces: verified public `dctorwho/lattice` baseline and M0-T06 `in_progress`

- [ ] **Step 1: Read and compare local/remote identity without mutation**

```powershell
gh auth status
gh repo view dctorwho/lattice --json nameWithOwner,visibility,defaultBranchRef,url
git remote get-url origin
git rev-parse main
git ls-remote origin refs/heads/main
```

Expected: authenticated owner can access `dctorwho/lattice`; visibility is `PUBLIC`; default branch and remote ref are `main`; origin URL names the same repository; local main and remote main match before the feature branch starts. Any mismatch stops the task without rewriting history.

- [ ] **Step 2: Select only M0-T06**

Set `current_task` to `M0-T06` and M0-T06 to:

```json
{
  "id": "M0-T06",
  "status": "in_progress",
  "depends_on": ["M0-T05"],
  "manual_gate": true,
  "evidence": []
}
```

Keep M1-T01 blocked.

- [ ] **Step 3: Expand the milestone contract and verify it**

Document exact dependency, package targets, report names, workflow gates, bootstrap ruleset order, failure response, and manual transition in `tasks/M0-foundation.md`.

```powershell
node scripts/verify-planning-docs.mjs
git diff --check
```

- [ ] **Step 4: Commit task selection**

```powershell
git add tasks/state.json tasks/M0-foundation.md
git diff --cached --check
git commit -m "chore(M0-T06): select milestone audit task"
```

---

### Task 2: Admit electron-builder and Create Original Brand Assets

**Files:**

- Modify: `docs/04-technology-stack.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `scripts/assets/build-lattice-icon.mjs`
- Create: `build/brand/lattice-icon.svg`
- Create: `build/brand/lattice-icon-256.png`
- Create: `build/brand/lattice.ico`
- Create: `build/brand/README.md`

**Interfaces:**

- Consumes: reviewed electron-builder 26.15.3 metadata; Node built-ins `node:zlib`, `node:crypto`, `node:fs`
- Produces: exact packaging dependency and reproducible project-owned icon assets

- [ ] **Step 1: Record dependency admission before installation**

Add exact version, MIT license, build-only purpose, platform-helper download behavior, alternative analysis, package impact, and 2026-08-02 review sources. Do not state that transitive install/download behavior is absent.

- [ ] **Step 2: Install only the exact development dependency**

```powershell
pnpm.cmd add --save-dev --save-exact electron-builder@26.15.3
pnpm.cmd install --frozen-lockfile
pnpm.cmd ignored-builds
```

Expected: `devDependencies.electron-builder` is exactly `26.15.3`, only `pnpm-lock.yaml` changes, and ignored/pending build output is recorded for review.

- [ ] **Step 3: Define the original icon geometry**

Create an SVG with a square `#161A2B` background, four separate rounded lattice tiles using `#8B5CF6`, `#A78BFA`, `#C4B5FD`, and a white diagonal source-line cut. Use only project-authored geometric paths; include no fonts, embedded bitmap, remote reference, or metadata copied from another product.

- [ ] **Step 4: Implement deterministic PNG and ICO generation**

The script rasterizes the same rectangles/diagonal line into a 256×256 RGBA buffer, encodes PNG chunks with deterministic CRC32 and zlib settings, and embeds that PNG as one ICO image. It accepts only repository-relative output paths and writes no timestamps.

Run twice and require stable hashes:

```powershell
node scripts/assets/build-lattice-icon.mjs
Get-FileHash build/brand/lattice-icon-256.png -Algorithm SHA256
Get-FileHash build/brand/lattice.ico -Algorithm SHA256
node scripts/assets/build-lattice-icon.mjs
Get-FileHash build/brand/lattice-icon-256.png -Algorithm SHA256
Get-FileHash build/brand/lattice.ico -Algorithm SHA256
```

- [ ] **Step 5: Document asset provenance**

Record geometry, palette, generation command, exact SHA-256 values, authoring date, and statement that the assets are original Lattice project assets. State that CI verifies hashes and does not regenerate packaging assets.

- [ ] **Step 6: Run dependency and asset checks**

```powershell
pnpm.cmd list electron-builder --depth 0
pnpm.cmd licenses list --dev --json
node scripts/assets/build-lattice-icon.mjs --check
pnpm.cmd check
git diff --check
```

- [ ] **Step 7: Commit dependency/assets**

```powershell
git add docs/04-technology-stack.md package.json pnpm-lock.yaml scripts/assets build/brand
git diff --cached --check
git commit -m "build(M0-T06): admit packager and brand assets"
```

---

### Task 3: Implement Deterministic Dependency, License, Vulnerability, and SBOM Audits

**Files:**

- Create: `scripts/audit/audit-core.mjs`
- Create: `scripts/audit/audit-core.d.mts`
- Create: `scripts/audit/run-dependency-audit.mjs`
- Create: `scripts/audit/generate-sbom.mjs`
- Create: `tests/unit/audit/audit-core.spec.ts`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: JSON from `pnpm list --prod --json --depth Infinity`, `pnpm licenses list --prod --json`, `pnpm audit --prod --json`
- Produces: normalized dependency inventory, license report, vulnerability report, and CycloneDX 1.6 SBOM under `artifacts/m0/`

- [ ] **Step 1: Write failing pure audit tests**

Use small inline fixtures that prove normal MIT graph output, stable lexical sorting, duplicate package versions, missing license, unknown expression, high/critical blocking, moderate/low recording, command/schema failure, absolute Windows/POSIX path rejection, unique bom-ref, every production component covered exactly once, dependency edges, and deterministic JSON bytes.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd test -- tests/unit/audit/audit-core.spec.ts
```

Expected: fail because audit-core is absent.

- [ ] **Step 3: Implement pure normalization and policy**

Export these exact functions from `audit-core.mjs` and mirror them in `audit-core.d.mts`:

```ts
export function normalizeDependencyGraph(input: unknown): DependencyInventory
export function normalizeLicenseReport(input: unknown, allowlist: readonly string[]): LicenseReport
export function normalizeAuditReport(input: unknown): VulnerabilityReport
export function createCycloneDxBom(input: AuditBundle, generatedAt: string): CycloneDxBom
export function assertNoAbsolutePaths(input: unknown): void
export function stableJson(input: unknown): string
```

Use package URL form `pkg:npm/<encoded-name>@<encoded-version>`, bom-ref equal to purl, sorted components/edges/licenses, and a caller-injected ISO time. Never include pnpm store paths, cwd, command lines containing tokens, or raw environment values.

- [ ] **Step 4: Implement bounded command orchestration**

Use `spawn` with `shell:false`, an explicit 5-minute timeout per pnpm command, bounded stdout/stderr buffers, and dependency injection for process runner/filesystem/clock. A timeout, nonzero exit, malformed JSON, or unknown schema returns a failing process exit code after writing a redacted diagnostic summary.

- [ ] **Step 5: Generate and validate local reports**

```powershell
pnpm.cmd audit:deps
pnpm.cmd audit:sbom
```

Expected files: `dependency-inventory.json`, `licenses.json`, `audit.json`, `sbom.cdx.json`; high/critical count is zero; production licenses equal the actual allowlisted MIT set; no absolute path occurs.

- [ ] **Step 6: Run GREEN and full quality**

```powershell
pnpm.cmd test -- tests/unit/audit/audit-core.spec.ts
pnpm.cmd check
git diff --check
```

- [ ] **Step 7: Commit audit core**

```powershell
git add scripts/audit tests/unit/audit package.json .gitignore
git diff --cached --check
git commit -m "feat(M0-T06): add deterministic dependency audits"
```

---

### Task 4: Configure and Verify Windows Packaging

**Files:**

- Modify: `package.json`
- Create: `scripts/audit/hash-artifacts.mjs`
- Create: `tests/e2e/packaged-app.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**

- Consumes: production `out/`, package metadata, reviewed icon assets
- Produces: `dist/win-unpacked/`, deterministic metadata/hash report, NSIS installer, packaged-app security proof

- [ ] **Step 1: Write package configuration assertions**

Add integration assertions for exact appId/productName, `asar:true`, `npmRebuild:false`, x64-only Windows targets, per-user non-web NSIS, no publish/update/signing configuration, fixed icon path, and allowlisted files.

- [ ] **Step 2: Add exact package commands**

```json
{
  "package:dir": "pnpm build && electron-builder --win dir --x64",
  "package:win": "pnpm build && electron-builder --win nsis --x64",
  "test:packaged": "playwright test tests/e2e/packaged-app.spec.ts --config playwright.config.ts"
}
```

- [ ] **Step 3: Configure electron-builder**

Add a top-level `package.json#build` object with `appId: io.github.dctorwho.lattice`, `productName: Lattice`, `artifactName: Lattice-${version}-windows-${arch}.${ext}`, `directories.output: dist`, `win.icon: build/brand/lattice.ico`, `target: [dir, nsis]`, and NSIS `oneClick:false`, `perMachine:false`, `allowElevation:false`. Include only `out/**/*`, `package.json`, and production dependency content resolved by electron-builder; exclude source maps and development content.

- [ ] **Step 4: Write the packaged-app test before packaging**

Resolve `dist/win-unpacked/Lattice.exe`, launch it through Playwright Electron, assert file URL, shell heading, exact frozen preload keys, sandbox/Node denial, DevTools denial, no development URL, icon/resource presence, and clean process close.

- [ ] **Step 5: Run RED then package unpacked**

```powershell
pnpm.cmd test:packaged
pnpm.cmd package:dir
pnpm.cmd test:packaged
```

Expected: first run fails because package is absent; after packaging, test passes.

- [ ] **Step 6: Build NSIS and hash approved artifacts**

```powershell
pnpm.cmd package:win
node scripts/audit/hash-artifacts.mjs dist artifacts/m0/artifact-hashes.json
```

The hash manifest contains only repository-relative paths, byte sizes, and SHA-256. It must cover `Lattice.exe`, `resources/app.asar`, the NSIS installer, and reviewed icons, and reject symlinks/path escape.

- [ ] **Step 7: Verify package contents and quality**

```powershell
pnpm.cmd test:packaged
pnpm.cmd check
git diff --check
```

Expected: all pass; package contains no `.git`, docs, tests, source TypeScript, environment file, token, or absolute development path.

- [ ] **Step 8: Commit packaging**

```powershell
git add package.json scripts/audit/hash-artifacts.mjs tests/e2e/packaged-app.spec.ts playwright.config.ts
git diff --cached --check
git commit -m "build(M0-T06): package Windows application"
```

---

### Task 5: Add the Complete Local M0 Audit Gate

**Files:**

- Create: `scripts/audit/run-m0-audit.mjs`
- Create: `scripts/verify-workflows.mjs`
- Create: `tests/integration/m0-gate.spec.ts`
- Modify: `package.json`
- Modify: `vitest.integration.config.ts`

**Interfaces:**

- Consumes: planning verification, audit modules, package hashes, workflow files
- Produces: `pnpm audit:m0` and TC-M0-007 command-parity proof

- [ ] **Step 1: Write failing TC-M0-007 integration tests**

Create an isolated project copy with a validated store. Test success plus injected failures for unknown license, missing SBOM component, high vulnerability, absolute-path leak, action floating tag, excessive workflow permission, missing package artifact, and child-command failure. Each test asserts a nonzero exit and the stable failure identifier.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd test:integration -- tests/integration/m0-gate.spec.ts
```

- [ ] **Step 3: Compose the finite audit command**

`run-m0-audit.mjs` sequentially runs planning verification, dependency/license/vulnerability normalization, SBOM generation/validation, workflow static verification, icon hash verification, and package artifact hashing. Every child has an explicit timeout and is killed on timeout; reports are written atomically.

- [ ] **Step 4: Verify exact workflow policy statically**

`verify-workflows.mjs` rejects any `uses:` not pinned to 40 hex characters, `pull_request_target`, permissions broader than the allowlist, unbounded shell loops, unapproved artifact paths, omitted frozen install, and commands diverging from documented scripts.

- [ ] **Step 5: Add package scripts**

```json
{
  "audit:deps": "node scripts/audit/run-dependency-audit.mjs",
  "audit:sbom": "node scripts/audit/generate-sbom.mjs",
  "audit:m0": "node scripts/audit/run-m0-audit.mjs",
  "verify:workflows": "node scripts/verify-workflows.mjs"
}
```

- [ ] **Step 6: Run GREEN and complete local gate**

```powershell
pnpm.cmd test:integration -- tests/integration/m0-gate.spec.ts
pnpm.cmd audit:m0
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
pnpm.cmd test:packaged
git diff --check
```

- [ ] **Step 7: Commit the local M0 gate**

```powershell
git add scripts package.json tests/integration/m0-gate.spec.ts vitest.integration.config.ts
git diff --cached --check
git commit -m "test(M0-T06): enforce milestone audit gate"
```

---

### Task 6: Add SHA-Pinned GitHub Automation

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/codeql.yml`
- Create: `.github/workflows/dependency-review.yml`
- Create: `.github/dependabot.yml`

**Interfaces:**

- Consumes: exact package scripts and approved action SHAs
- Produces: real Windows CI, CodeQL, Dependency Review, and dependency update PRs

- [ ] **Step 1: Write workflow verification fixtures/assertions first**

Extend the local verifier tests to require these exact pins:

```text
actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271
actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
github/codeql-action/*@f205ea1c3313d32999d8d6a48b4f6530d4437b38
actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294
```

- [ ] **Step 2: Create `ci.yml`**

Trigger pull requests to main, main pushes, and manual dispatch. On `windows-2025`, use Node 24.18.0 and pnpm 11.12.0 with pnpm cache, frozen install, planning verification, `pnpm check`, E2E, security, `audit:m0`, `package:dir`, and packaged smoke. Give default `contents:read`; upload only `artifacts/m0`, permitted test reports, and approved unpacked metadata on `if: always()` with a fixed retention period.

- [ ] **Step 3: Create `codeql.yml`**

Trigger PR/main push, the exact weekly schedule `17 3 * * 1`, and manual dispatch. Use `contents:read`, `security-events:write`, `packages:read`; initialize JavaScript/TypeScript, autobuild, and analyze with the exact CodeQL SHA.

- [ ] **Step 4: Create dependency review and Dependabot**

Dependency Review runs only on PR with `contents:read` and `pull-requests:read`, fails at moderate severity, and applies the reviewed license allow/deny policy. Dependabot runs every Monday at `04:17` Asia/Shanghai for pnpm and GitHub Actions, targets main, caps each ecosystem at five open PRs, performs no auto-merge, and keeps Electron/build/security/test major updates separate.

- [ ] **Step 5: Run workflow and local regression gates**

```powershell
pnpm.cmd verify:workflows
pnpm.cmd test:integration -- tests/integration/m0-gate.spec.ts
pnpm.cmd check
git diff --check
```

- [ ] **Step 6: Commit GitHub automation**

```powershell
git add .github scripts/verify-workflows.mjs tests/integration/m0-gate.spec.ts
git diff --cached --check
git commit -m "ci(M0-T06): add pinned GitHub quality gates"
```

---

### Task 7: Synchronize Documentation and Prepare Auditable Evidence

**Files:**

- Modify: `docs/04-technology-stack.md`
- Modify: `docs/05-data-safety-and-security.md`
- Modify: `docs/09-test-strategy.md`
- Modify: `docs/12-build-release-operations.md`
- Modify: `docs/14-dependency-license-sbom.md`
- Modify: `docs/16-project-structure-and-standards.md`
- Modify: `docs/test-cases/M0-foundation.md`
- Create: `docs/evidence/M0-T06-ci-audit-2026-08-02.md`

**Interfaces:**

- Consumes: actual local report schemas, commands, dependency metadata, package outputs, and workflow names
- Produces: documentation that matches executable behavior and an evidence ledger ready for remote results

- [ ] **Step 1: Document actual public interfaces and operations**

Record exact command names, offline/online boundaries, package outputs, unsigned-install warning, report schemas, license/vulnerability policies, action release/SHA/license ledger, artifact allowlist, CI permissions, ruleset bootstrap order, and MAN-M0-001 steps.

- [ ] **Step 2: Record local evidence from fresh commands**

Run separately and record exit codes/hashes without secrets or absolute paths:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd ignored-builds
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
pnpm.cmd audit:m0
pnpm.cmd package:dir
pnpm.cmd test:packaged
pnpm.cmd package:win
node scripts/verify-planning-docs.mjs
git diff --check
```

- [ ] **Step 3: Request independent review before remote mutation**

Use `superpowers:requesting-code-review`. Resolve every actionable correctness, supply-chain, workflow, package-surface, security, and test-validity finding. Rerun the affected focused commands and then the complete local gate.

- [ ] **Step 4: Commit documentation/evidence checkpoint**

```powershell
git add docs
git diff --cached --check
git commit -m "docs(M0-T06): document audit and release gates"
```

---

### Task 8: Bootstrap GitHub Checks Through a Pull Request

**Files:**

- No new source files; remote branch, PR, check runs, and merge state

**Interfaces:**

- Consumes: clean reviewed M0-T06 branch; existing public origin
- Produces: bootstrap PR merged only after all real checks pass

- [ ] **Step 1: Push the feature branch and create a ready PR**

First create ignored `artifacts/m0/m0-t06-pr-body.md` with the implemented scope, exact commands/results, security and dependency changes, MAN-M0-001 status, and rollback notes. Then run:

```powershell
git push --set-upstream origin codex/m0-t06-ci-audit-gate
gh pr create --repo dctorwho/lattice --base main --head codex/m0-t06-ci-audit-gate --title "M0-T06: establish CI and audit gates" --body-file artifacts/m0/m0-t06-pr-body.md
```

- [ ] **Step 2: Read actual checks with a bounded wait**

```powershell
gh pr checks --repo dctorwho/lattice --watch --interval 10 --fail-fast
```

Run with a 30-minute outer timeout. If still running at timeout, report current checks once and stop this execution turn without looping; resume with another bounded read later.

- [ ] **Step 3: Diagnose any failure before changing code**

Use `superpowers:systematic-debugging` and, for GitHub Actions failures, `github:gh-fix-ci`. Read failed job logs, reproduce locally where possible, add a regression assertion, fix the root cause, rerun local gates, commit, push, and repeat one bounded check read.

- [ ] **Step 4: Merge only the green bootstrap PR**

```powershell
gh pr merge --repo dctorwho/lattice --squash --delete-branch
git switch main
git pull --ff-only origin main
```

Expected: all required-to-be rules are green even though the ruleset is not yet activated; local main matches remote.

- [ ] **Step 5: Verify main-push check names**

Read the latest workflow runs once with `gh run list`, inspect successful run jobs with `gh run view --json jobs,url,conclusion,headSha`, and record each exact check context in the evidence report. Do not infer names from YAML alone.

---

### Task 9: Activate and Prove the Main Ruleset

**Files:**

- Update: `docs/evidence/M0-T06-ci-audit-2026-08-02.md`
- Remote: GitHub repository ruleset and one disposable verification PR

**Interfaces:**

- Consumes: successful real checks on main and their exact context names
- Produces: active main ruleset plus evidence that failing changes block and repaired changes pass

- [ ] **Step 1: Create the active ruleset from exact contexts**

Use `gh api` to create one active branch ruleset targeting `refs/heads/main` with pull request required, zero mandatory approving reviews, conversation resolution required, linear history required, force-push/deletion blocked, and the successful exact contexts for CI quality, Electron E2E, security, M0 audit/package, CodeQL, and Dependency Review. Do not require an unavailable or guessed context and do not configure daily bypass actors.

- [ ] **Step 2: Read back and validate the ruleset**

```powershell
gh api repos/dctorwho/lattice/rulesets
gh api repos/dctorwho/lattice/rules/branches/main
```

Assert active enforcement, exact main include pattern, required pull request, every expected status context, linear history, and deletion/force-push restrictions.

- [ ] **Step 3: Create a disposable verification branch and PR**

Create `codex/m0-t06-ruleset-proof` from current main. Add a reversible test-only fixture that makes `scripts/verify-workflows.mjs` fail with a stable identifier, commit/push it, and open a PR clearly titled as a gate proof.

- [ ] **Step 4: Prove failure blocks merge**

Use one bounded `gh pr checks --watch --fail-fast` call and `gh pr view --json mergeStateStatus,statusCheckRollup`. Record the expected failed check and `BLOCKED`/non-mergeable state. Do not attempt a bypass merge.

- [ ] **Step 5: Repair the fixture and prove success**

Revert only the intentional fixture, commit/push, then use one bounded check wait. Require every check green and conversation resolution satisfied before merging the proof PR normally without deleting its branch yet.

- [ ] **Step 6: Prove direct push rejection safely**

Create a local no-content commit on the disposable proof branch and attempt to push its ref directly to `refs/heads/main` without force. Expect rejection by the ruleset. Keep the commit on the disposable branch and delete it only after confirming it is not part of main; never rewrite main.

- [ ] **Step 7: Record remote evidence and clean disposable state**

Record ruleset ID/URL, PR URLs, check URLs/conclusions, failed and repaired SHAs, direct-push rejection summary, and final main SHA. Delete only the fully merged disposable branch.

---

### Task 10: Enter MAN-M0-001 Without Prematurely Unlocking M1

**Files:**

- Modify: `docs/evidence/M0-T06-ci-audit-2026-08-02.md`
- Modify: `tasks/state.json`

**Interfaces:**

- Consumes: all local/remote automatic gates and ruleset proof passing
- Produces: M0-T06 `awaiting_manual`; M1-T01 remains `blocked`

- [ ] **Step 1: Re-run final local and remote reads**

```powershell
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
pnpm.cmd audit:m0
pnpm.cmd test:packaged
node scripts/verify-planning-docs.mjs
gh run list --repo dctorwho/lattice --branch main --limit 10
gh api repos/dctorwho/lattice/rulesets
git diff --check
```

- [ ] **Step 2: Mark only the manual transition**

Set M0-T06 to `awaiting_manual`, keep `current_task:"M0-T06"`, keep M1-T01 blocked, and attach command/test/report evidence pointing to the evidence document and GitHub check/ruleset URLs.

- [ ] **Step 3: Commit and merge the evidence transition through the ruleset**

Create `codex/m0-t06-awaiting-manual`, commit the evidence/state change, push, open a PR, wait once with the bounded check command, and merge only when green. Update local main with `git pull --ff-only` and verify state.

- [ ] **Step 4: Present exact manual steps**

Ask the user to run on Windows 11 as a normal user:

1. Open the unpacked `Lattice.exe` and the NSIS installer; confirm Lattice branding, ordinary per-user install flow, application start, and clean close.
2. Attempt DevTools and disallowed navigation; confirm they remain blocked.
3. Inspect the renderer preload surface in supplied evidence; confirm only frozen `{ app, commands }` appears and Node/raw IPC remain absent.
4. Review CI, CodeQL, Dependency Review, licenses, vulnerability summary, CycloneDX SBOM, artifact hashes, ruleset, and proof PR evidence.
5. Reply with an explicit MAN-M0-001 pass or the observed failure details.

Stop here until the user signs off. This is the intended task boundary, not an implementation failure.

---

### Task 11: After Explicit MAN-M0-001 Approval, Close M0 Through a Protected PR

**Files:**

- Modify: `docs/evidence/M0-T06-ci-audit-2026-08-02.md`
- Modify: `tasks/state.json`

**Interfaces:**

- Consumes: explicit user MAN-M0-001 pass and unchanged green automated evidence
- Produces: M0-T06 `passed`, M1-T01 `ready`, `current_task:null`, protected main updated

- [ ] **Step 1: Record the signed manual result**

Add signer, UTC timestamp, environment, checklist outcomes, observed artifact hashes, and explicit conclusion to the evidence report. Do not invent screenshots or a pass statement.

- [ ] **Step 2: Transition only direct successor state**

Set M0-T06 `passed`, M1-T01 `ready`, and `current_task:null`. Add the manual evidence object; change no other task.

- [ ] **Step 3: Verify and commit on a protected branch**

```powershell
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git diff --check
git add tasks/state.json docs/evidence/M0-T06-ci-audit-2026-08-02.md
git diff --cached --check
git commit -m "docs(M0-T06): close foundation milestone"
```

- [ ] **Step 4: Push, open, check, and merge the final small PR**

Push the branch, create a PR, use one bounded check wait, merge without bypass only when every required check passes, and fast-forward local main from origin.

- [ ] **Step 5: Final verification and cleanup**

```powershell
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git status --short --branch
git rev-parse main
git ls-remote origin refs/heads/main
```

Expected: M0-T06 passed, only M1-T01 ready, local/remote main hashes equal, worktree clean, and only fully merged task branches removed via `superpowers:finishing-a-development-branch`.
