# M0-T02 Quality Toolchain Evidence

Execution date: 2026-07-19. This filename is retained from the approved plan; no result below is backdated.

## Environment

- Windows: `Microsoft Windows NT 10.0.26200.0`
- Node: `v24.18.0`
- Corepack: `0.35.0`
- pnpm: `11.12.0`
- Electron: `v43.1.1`
- The host PowerShell execution policy blocks `pnpm.ps1`; logical `pnpm` commands below therefore used `pnpm.cmd`, which resolved to the same pinned pnpm 11.12.0 executable.

## Install and ignored-build evidence

| Command | Start (UTC) | End (UTC) | Exit | Result |
| --- | --- | --- | ---: | --- |
| `corepack pnpm --version` | 2026-07-19T09:23:00.7607741Z | 2026-07-19T09:23:01.1062972Z | 0 | `11.12.0` |
| `pnpm install --frozen-lockfile --offline` | 2026-07-19T09:23:16.1323313Z | 2026-07-19T09:23:16.4510569Z | 0 | `Already up to date` |
| `pnpm ignored-builds` | 2026-07-19T09:23:34.0050936Z | 2026-07-19T09:23:34.3240061Z | 0 | raw output recorded below |

Pinned pnpm 11.12.0 rendered `Automatically ignored builds during installation:` followed by `Cannot identify as no node_modules found`, despite a populated root layout. This is an upstream rendering limitation, not a claim that it printed `None`. The root `node_modules/.modules.yaml` independently recorded `pendingBuilds: []`, exact `allowBuilds.esbuild: true`, and no `ignoredBuilds` key; `node_modules/.pnpm/lock.yaml` existed. The official pnpm test documents removal of `ignoredBuilds` after approval: [approve_builds.rs](https://github.com/pnpm/pnpm/blob/0dbf7e6aa6139b070cb954a03fa0d7cb49749a68/pnpm/crates/cli/tests/approve_builds.rs).

The fresh copied bootstrap projects remain stricter than this root rendering: TC-M0-001 and TC-M0-008 require the pnpm 11.12.0 `None` sentinel, an empty parsed pending-build list, unique lockfile and package-manager invariants, two equal artifact maps, and cleanup. No pnpm metadata was changed and no parser was weakened.

## Daily gate

| Command | Start (UTC) | End (UTC) | Exit | Unit / integration tests | Coverage |
| --- | --- | --- | ---: | --- | --- |
| `pnpm check` | 2026-07-19T09:23:50.0319172Z | 2026-07-19T09:27:42.0295845Z | 0 | 61 / 18 | statements 86.95%, branches 75.82%, functions 86.76%, lines 86.73% |
| `pnpm check` | 2026-07-19T09:27:54.5251560Z | 2026-07-19T09:31:48.1662545Z | 0 | 61 / 18 | statements 86.95%, branches 75.82%, functions 86.76%, lines 86.73% |

Both runs completed the offline contract: `format:check`, `lint`, strict `typecheck`, unit tests, integration tests, and production build.

## Explicit gates

| Command | Start (UTC) | End (UTC) | Exit | Result |
| --- | --- | --- | ---: | --- |
| `pnpm test:e2e` | 2026-07-19T09:31:59.5324090Z | 2026-07-19T09:32:02.4631333Z | 0 | 1 Electron production-window launch/close test; renderer URL is `file:` |
| `pnpm test:security` | 2026-07-19T09:32:14.3346134Z | 2026-07-19T09:32:17.2084105Z | 0 | 1 scoped renderer-boundary test; renderer URL is `file:` |
| `pnpm test:performance` | 2026-07-19T09:32:29.2927534Z | 2026-07-19T09:32:30.2974630Z | 0 | 2 performance-harness tests |
| `pnpm test:bootstrap:cold` | 2026-07-19T09:32:53.1312871Z | 2026-07-19T09:33:07.4002305Z | 0 | TC-M0-008; 1 cold empty-store bootstrap test |
| `pnpm run test:integration tests/integration/project-bootstrap.spec.ts` | 2026-07-19T09:33:31.7327678Z | 2026-07-19T09:33:42.5678742Z | 0 | focused TC-M0-001; 1 fresh offline bootstrap test |

The security smoke proves only the current `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, unavailable Node/Electron globals, and production `file:` renderer URL. The performance smoke proves only the measurement and threshold harness, not product performance.

## Failure sensitivity and corrected safeguards

TC-M0-002 ran as part of both 18-test integration suites. Its tracked-only temporary copies require the positive command contract and all six fault cases to complete; each direct command and guarded nested `check` must be non-zero for injected format, lint, type, unit, integration, and build failures. The test also rejects fixed-success/empty scripts and inclusive cached-plus-untracked nonignored owned-test `.skip`/`.only` member tokens, including terminal, whitespace, `each`, `concurrent`, and `sequential` forms. Every owned Vitest config has `allowOnly: false`, and both Playwright configs have `forbidOnly: true`.

The current safeguards additionally prove:

- Copy-target creation is side-effect-free before validation: every existing lexical ancestor is checked for junction/symlink/reparse escape before creating the target, then realpath containment is rechecked after creation.
- Bootstrap input must have exactly the root `pnpm-lock.yaml`, no nested or alternate lockfile, and an exact `packageManager: "pnpm@11.12.0"` declaration.
- Nested quality-child commands use bounded 90-second timeouts; explicit outer timeouts own the positive loop and each fault's install/direct/check sequence with cleanup headroom, including the inner-timeout/hang cleanup regression.
- The planning verifier now compares the technology-table header semantically as pipe-delimited trimmed cells with exact count and order. Its self-check accepts padding and rejects missing or reordered columns; it does not normalize unrelated document text.

## Bootstrap artifacts and cleanup

Two production builds ran from 2026-07-19T09:34:09.7555020Z to 2026-07-19T09:34:12.4330903Z. Both exits were 0 and their required SHA-256 maps were equal:

| Artifact | First SHA-256 | Second SHA-256 |
| --- | --- | --- |
| `out/main/index.js` | `06D980FA3E2B7115CA49DE68E7F799300A05F9D34894D5D6DF8D2DCDE7BB1ADA` | `06D980FA3E2B7115CA49DE68E7F799300A05F9D34894D5D6DF8D2DCDE7BB1ADA` |
| `out/preload/index.cjs` | `77F5EEC38C5EF075E11892244CCF9E249D82937E07401398DF98319568775A17` | `77F5EEC38C5EF075E11892244CCF9E249D82937E07401398DF98319568775A17` |
| `out/renderer/index.html` | `5031873A32AAFE56D50668BDF92F71C73E58CF11C70C20DB9C8707E53B24DF4E` | `5031873A32AAFE56D50668BDF92F71C73E58CF11C70C20DB9C8707E53B24DF4E` |

At 2026-07-19T09:34:43.1802978Z, the Electron process scan found zero processes. A final Unicode-safe rescan at 2026-07-19T09:43:29.6960999Z found zero directories for `lattice-command-*`, `lattice-copy-*`, `lattice-bootstrap-unit-*`, `lattice-artifacts-*`, `lattice-quality-*`, `Lattice 冷自举 *`, `Lattice 离线门禁 *`, and `Lattice 质量门禁 *`.

## Planning and scope

`node scripts/verify-planning-docs.mjs` passed from 2026-07-19T09:33:51.5881458Z to 2026-07-19T09:33:51.7007399Z, exit 0: 50 required files, 77 tasks, 86 automated test cases, 13 manual cases, 83 requirements, and 36 compatibility items.

M0-T03 still owns CSP, navigation, new-window, permission, and external-link policies. M0-T06 still owns CI, SBOM, complete license/transitive-dependency audit, and packaged-performance gates. M0-T02 has no manual gate; it does not claim product-level performance or the future replaceability of all filesystem, clock, process, or dialog boundaries.

## Intended completion change set

The completion candidate consists of the reviewed M0-T02 implementation, test, configuration, plan, verifier, evidence, and state files currently reported by Git:

- `docs/superpowers/plans/2026-07-18-m0-t02-quality-toolchain.md`
- `playwright.config.ts`, `playwright.security.config.ts`
- `scripts/verify-planning-docs.mjs`
- `tests/e2e/app-launch.spec.ts`, `tests/security/electron-boundary.smoke.spec.ts`
- `tests/helpers/artifacts.ts`, `tests/helpers/bootstrap-project.ts`, `tests/helpers/project-copy.ts`
- `tests/integration/quality-scripts.spec.ts`
- `tests/unit/helpers/artifacts.spec.ts`, `tests/unit/helpers/bootstrap-project.spec.ts`, `tests/unit/helpers/project-copy.spec.ts`, `tests/unit/quality-config.spec.ts`
- `vitest.config.ts`, `vitest.integration.config.ts`, `vitest.bootstrap.config.ts`, `vitest.performance.config.ts`
- `docs/evidence/M0-T02-quality-toolchain-2026-07-18.md`
- `tasks/state.json`

No commit, review, push, or pull request is created by this evidence record.

## Closure validation

- `node scripts/verify-planning-docs.mjs`: 2026-07-19T09:36:42.6671836Z to 2026-07-19T09:36:42.7797458Z, exit 0, after `current_task` was set to `null`, M0-T02 was set to `passed`, and only M0-T03 was set to `ready`.
- Additional post-state `pnpm check`: 2026-07-19T09:36:57.6418616Z to 2026-07-19T09:40:45.3099988Z, exit 0; 61 unit and 18 integration tests passed with the coverage reported above, then production build passed.
- Final planning verifier, state assertion, and `git diff --check`: 2026-07-19T09:41:29.9986871Z to 2026-07-19T09:41:30.3285858Z, all exit 0. The assertion confirmed `current_task: null`, M0-T02 `passed`, M0-T03 `ready`, and M0-T04 `blocked`.
- Final Electron scan found zero processes. The same final scan found zero directories for all eight temporary prefixes listed above.
