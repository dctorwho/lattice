# M0-T05 Command Registry and Window Shell Evidence

This report records the automated completion evidence for M0-T05. The task has
no manual gate. Its reviewed implementation spans base commit `8563afd` through
the final feature-branch commit recorded by Git after this report is committed.

## Scope and dependency admission

- M0-T05 adds no production or development dependency. The frozen
  `pnpm-lock.yaml` remains the only package-manager lockfile.
- The implemented command set is exactly `app.about` and
  `view.toggleSidebar`. File, editor, workspace, settings, import, and export
  commands remain out of scope.
- The shared contract layer owns the stable command IDs and strict Zod request,
  result, state, and event schemas. The pure domain layer owns command
  definitions, state derivation, guarded execution, and injected effects.
- Main owns the fixed native-menu projection and accepts state only from the
  sender-derived authorized window. Renderer code never supplies a trusted
  window identifier and main never executes renderer command handlers.
- The frozen preload surface is exactly
  `{ app: { getInfo }, commands: { onInvoke, updateStates } }`; no generic IPC,
  filesystem, export, process, Electron, or logging bridge is exposed.

## TDD and defect evidence

The implementation followed focused RED/GREEN checkpoints:

- The command-domain suite initially failed because the registry modules did
  not exist, then passed duplicate-ID, sorting, visibility, enabled-state,
  async execution, unknown-ID, and exception-isolation cases.
- Shared/preload suites initially failed on missing command schemas and bridge,
  then passed strict payload, fixed-channel, response-validation, malformed
  event, listener-isolation, and idempotent-unsubscribe cases.
- Main-menu tests initially failed on the missing controller; the compose test
  also failed until application-ready menu installation was wired.
- Renderer tests initially failed against the bootstrap card, then passed the
  semantic shell, shared command entry points, About result/error rendering,
  deterministic focus restoration, and absence of premature editor controls.
- Real-Electron tests were written before adapting the runtime assertions and
  now prove native-menu, shortcut, title-button, context-menu, About, and exact
  preload-surface behavior.
- Independent review regressions reproduced and fixed close-during-pending
  About reopening, sidebar context-menu focus loss, and stale native-menu state
  after blur/destruction. Additional tests cover outside-click focus and
  bottom-right viewport clamping.
- Scoped re-review found that a disabled repeated F1 attempt could replace the
  original About focus trigger before registry validation. Trigger capture now
  occurs only inside guarded command effects, and the exact sequence has a RED/
  GREEN regression.
- Command labels and shortcuts now have one frozen layer-neutral metadata and
  localization authority consumed by domain, main, and renderer; native menu
  labels no longer bypass localization.
- The first planning-document verification rejected a `.spec.tsx` test
  reference because the verifier accepted only `.spec.ts`. The verifier was
  corrected to recognize both TypeScript and TSX specs, after which the full
  planning corpus passed.
- Two pre-existing timeout-cleanup tests failed only inside the restricted
  execution sandbox because Windows `taskkill` was denied. The same focused
  suite passed 259/259 under normal user permissions. The complete gate was
  therefore run under normal user permissions; no product or test rule was
  weakened.
- The first post-review complete gate copied only Git-tracked project files;
  the newly added shared metadata/catalog files had not yet reached their
  checkpoint commit, so the isolated build correctly rejected unresolved
  imports. Commit `4723bdc` made the complete implementation tracked.
- The next isolated run exposed a teardown race: a later React effect reread a
  test-deleted global preload object. Commit `0986320` captures the frozen
  desktop API once per mounted controller and adds a deterministic regression.
  The subsequent complete gate passed.

## TC-M0-006 allocation

| Required behavior | Automated proof |
| --- | --- |
| One authoritative command registry | `tests/unit/domain/command-registry.spec.ts` |
| Shared command path for renderer entry points | `tests/unit/component/command-registry.spec.tsx` |
| Fixed, fail-closed native menu projection | `tests/unit/main/application-menu.spec.ts` |
| Strict fixed-channel preload bridge | `tests/unit/preload/command-api.spec.ts` and `tests/unit/shared/command-contracts.spec.ts` |
| Real Electron menu, shortcuts, shell, About, and focus behavior | `tests/e2e/command-window-shell.spec.ts` and `tests/e2e/app-launch.spec.ts` |
| Exact renderer privilege boundary | `tests/security/electron-boundary.spec.ts` |

## Completion commands and observed results

All commands were finite; no watch mode, polling loop, or persistent development
server was used.

| Command / gate | Observed result |
| --- | --- |
| `pnpm.cmd install --frozen-lockfile --offline` | exit 0; lockfile already up to date |
| `pnpm.cmd ignored-builds` | exit 0; no ignored dependency builds reported |
| Focused post-review gate | exit 0; 4 files / 56 tests passed; controller stability suite 15/15 passed |
| `pnpm.cmd check` | exit 0 in 230.2 s; 24 unit files / 324 tests, 2 integration files / 18 tests, format, lint, strict typecheck, and production build passed |
| `pnpm.cmd test:e2e` | exit 0; 3/3 real-Electron tests passed |
| `pnpm.cmd test:security` | exit 0; 2/2 real-Electron security tests passed |
| `node scripts/verify-planning-docs.mjs` | exit 0; 50 required files, 77 tasks, 86 automated cases, 13 manual cases, 83 requirements, and 36 compatibility items verified |
| `git diff --check` | exit 0 |

## Review and disposition

An independent read-only review compared the branch with `8563afd`, the M0-T05
design and plan, repository rules, implementation, tests, and documentation.
It found no Critical issue and identified four Important lifecycle/authority
findings plus two Minor context-menu proof gaps. Each finding received a focused
RED regression and implementation correction. Two scoped re-reviews accepted
commits `4723bdc` and `0986320`; no remaining blocker or regression was found.
The final complete, E2E, security, dependency, and planning gates all passed
before the task state transitioned to `passed`.

## Residual risks and ownership

- M1 owns the real CodeMirror editing surface and document behavior. The M0
  shell intentionally contains no editable field and makes no editing claim.
- M0-T06 owns `electron-builder@26.15.3`, CI, complete dependency/license/
  permission audit, CycloneDX SBOM, packaged-artifact verification, GitHub
  branch protection, and the M0 manual gate. Its exact-version dependency is
  designed and approved in the M0-T06 plan but is not installed early in
  M0-T05.
- M0-T05 has `manual_gate:false`; its Electron UI and security behavior are
  covered by the finite automated gates above.
