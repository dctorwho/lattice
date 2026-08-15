# M0-T04 Shared Contracts and Errors Evidence

This report records the completed Task 8 controller gates. M0-T04 has no manual
gate.

## Environment and dependency admission

- The project pins `pnpm@11.12.0` and `zod` exactly at `4.4.3`.
- The dependency ledger records Zod 4.4.3 as MIT, with no package dependencies
  or install scripts. M0-T06 retains the complete transitive dependency,
  permission, license, and SBOM audit.
- Real Electron RED found `out/preload/index.cjs` contained
  `require("zod")`. A sandbox preload cannot resolve that externalized package,
  so the approved `lattice` surface was absent. `electron.vite.config.ts` now
  excludes only `zod` from preload externalization; the final Task 7 build had
  zero `require("zod")` matches and did not change BrowserWindow security
  preferences.
- The completion gate observed pnpm `11.12.0`; the frozen offline install exited
  0 and reported the workspace already up to date. `corepack pnpm ignored-builds`
  exited 0 but ambiguously reported `Cannot identify as no node_modules found`
  even though `node_modules` existed. The installed metadata independently
  recorded `pendingBuilds: []`; this report therefore preserves the exact pnpm
  output and does not reinterpret it as a definitive empty ignored-build list.

## Shared schema and stable error matrix

Contract version is the integer literal `1`. `AppInfo` is a strict object with
that version, 1–64-character control-free `name` and `version`, and platform
`win32 | darwin | linux`. Results are strict discriminated unions:
`{ ok:true, value } | { ok:false, error }`.

| Active code | Fixed message key | Current reason | Retryable |
| --- | --- | --- | --- |
| `IPC_INVALID_REQUEST` | `errors.ipc.invalidRequest` | unknown channel, request schema, budget, or serialization rejection | `false` |
| `IPC_UNAUTHORIZED_SENDER` | `errors.ipc.unauthorizedSender` | sender/window validation rejection | `false` |
| `APP_VERSION_MISMATCH` | `errors.app.versionMismatch` | bounded received contract version is not 1 | `false` |
| `INTERNAL_UNEXPECTED` | `errors.internal.unexpected` | handler, response, or local preload boundary failure | `false` |

Main errors use the active request UUID. Preload validates the response again
and accepts a failure only when `error.requestId` equals its local request ID;
missing or mismatched IDs become a local `response_schema_invalid` failure
using the local ID. Only failure before a valid local UUID exists omits the ID.

## Sender and window ownership matrix

The renderer supplies no trusted window or session fields. Main looks up the
sender in `AuthorizedWindowRegistry` and derives `windowId`, `webContentsId`,
and `sessionId:null`.

| Rejection | Proof target |
| --- | --- |
| `missing_sender_frame` | sender frame is absent |
| `sender_destroyed` | sender is destroyed, or its destroyed-state callback throws |
| `subframe_sender` | sender frame is not the sender main frame |
| `window_not_registered` | WebContents ID has no current registration |
| `sender_identity_mismatch` | registered sender object differs despite the same ID |
| `window_destroyed` | owner window is destroyed, or its destroyed-state callback throws |

Every created main window is registered synchronously by BrowserWindow and
WebContents identity. Window `closed` and WebContents `destroyed` events share
an idempotent unregister callback.

## Input budget and serializability matrix

Incoming requests and every handler Result, including handler error Results,
pass the same value walker. Router-generated stable failures are instead
constructed from the strict `AppError`/`Result` schemas. Limits are 65,536
UTF-16 characters, depth 8, and 256 entries; object key characters contribute
to the character limit.

Allowed values are `null`, booleans, strings, finite numbers, standard arrays,
and objects with `Object.prototype` or a null prototype. Rejections cover
unsupported primitive/function values, non-finite numbers, character/depth/
entry excess, symbol keys, accessor properties, non-plain or non-standard
array objects, cycles, and non-canonical array properties. The route order is
sender → input budget → approved channel → contract version → Zod request →
handler → Zod Result → output serializability.

## Preload surface snapshot

The only renderer-visible API is frozen
`window.lattice.app.getInfo(): Promise<Result<AppInfo, AppError>>`. Both root
and `app` objects contain exactly their approved keys. Preload creates a fresh
UUID, invokes only `lattice:app:get-info` with
`{ contractVersion:1, requestId, payload:{} }`, and validates both the Result
schema and failed-Result request correlation before returning.

The real Electron security proof confirms `require`, `process`, `ipcRenderer`,
`fs`, `shell`, generic `invoke`/`send`, external-open, file, and export methods
remain unavailable. M0-T03 owns the sandbox/Node denial baseline and its
historical empty-preload evidence; M0-T04 owns the current approved snapshot.

## Redacted logging proof

The IPC sink accepts only level, active code, request ID, approved channel or
`unknown`, safe reason, optional main-derived window/WebContents IDs, and an
optional safe stack. It receives neither payloads nor raw errors.

Stack parsing inspects at most 16,384 characters, 64 lines, and 1,024 input
characters per line. It emits at most 8 frames of 256 characters. Recognized
application frames retain only function, basename, line, and column; the sole
recognized Node internal form is a bounded task-queue frame. Directory paths,
unrecognized lines, oversized lines/frames, and raw messages are discarded.
Logger adapter exceptions are caught and cannot replace the stable Result.

## Commands, durations, exits, and test counts

| Command / gate | Observed result |
| --- | --- |
| Task 1–6 focused direct unit suite | exit 0 in 1.54 s; 6 files, 154 tests passed |
| Task 6 controller unit run | exit 0; 19 files, 259 tests passed; Vitest duration 3.86 s |
| `corepack pnpm lint` after Task 7 | exit 0 in 5.71 s |
| `corepack pnpm typecheck` after Task 7 | exit 0 in 3.00 s |
| `corepack pnpm build` after Task 7 correction | exit 0 in 1.49 s; preload contains zero external `require("zod")` matches |
| `corepack pnpm test:security -- tests/security/electron-boundary.spec.ts` | exit 0 in 4.3 s; 2/2 tests passed |
| `corepack pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts` | exit 0 in about 5 s; 2/2 tests passed |
| `corepack pnpm --version` | exit 0 in 0.7 s; `11.12.0` |
| `corepack pnpm install --frozen-lockfile --offline` | exit 0 in 0.7 s; already up to date; completed with pnpm 11.12.0 |
| `corepack pnpm ignored-builds` | exit 0; exact result: `Automatically ignored builds during installation: Cannot identify as no node_modules found`; installed `.modules.yaml` records `pendingBuilds: []` |
| fresh full `corepack pnpm check` and final unit/integration/build counts | exit 0 in about 241 s; format, lint, typecheck, and build passed; unit 19 files/259 tests in 4.48 s; integration 2 files/18 tests in 224.47 s |
| `node scripts/verify-planning-docs.mjs` after documentation draft | exit 0 in 0.5 s; 50 required files, 77 tasks, 86 automated cases, 13 manual cases, 83 requirements, 36 compatibility items |
| `git diff --check` after documentation draft | exit 0 in 0.4 s |

## Process cleanup

After the final Task 7 security/E2E runs and the bounded completion gate, the
controller found zero residual worktree Electron, Node worker, browser, or mail
processes.

## Review findings and dispositions

- Task 6 review found that a schema-valid main failure could omit or mismatch
  the preload request ID. Two RED regressions reproduced both cases; preload now
  converts either to its existing schema-valid `response_schema_invalid`
  failure with the local ID.
- Real Electron RED exposed the externalized-Zod preload failure; the build now
  inlines only Zod for preload. A second RED exposed Electron's lowercase
  default application name; production sets `Lattice` before the handler reads
  metadata.
- Initial whole-branch review found the implementation architecture and security
  boundaries ready, with only evidence completion, task-state transition, and
  an overbroad value-walker description requiring correction. The evidence and
  state were completed, and the description now distinguishes handler Results
  from strict-schema router-generated failures. A scoped independent re-review
  covers these dispositions before the final controller verification.

## Source and test ownership

- `src/shared/contracts/` owns version, request, AppInfo, Result schema, channel,
  and `LatticeDesktopApi` types; `src/shared/errors/` owns the active codes,
  stable errors, safe details, and Result type.
- `src/main/ipc/` owns registry, sender validation, budgets, fixed router,
  logging, AppInfo construction, and registration. `src/main/index.ts` owns
  Electron adapters and registered-window lifecycle.
- `src/preload/api/create-app-api.ts` and `src/preload/index.ts` own the single
  frozen bridge; `src/renderer/src/lattice-api.d.ts` owns its renderer type.
- The six focused unit files own pure boundary behavior;
  `tests/security/electron-boundary.spec.ts` owns the real preload/invoke proof.

## Residual risks and ownership

- M0-T05 owns Command Registry and window-skeleton consumption.
- M0-T06 owns CI, dependency/permission/license audit, SBOM, packaged-artifact
  checks, GitHub rules, and the M0 manual gate.
- Later capability tasks own file, workspace, settings, recovery, import, and
  export methods; their target contracts are not current callable APIs.
- M0-T04 has `manual_gate:false`; no manual verification is claimed or needed
  for this task.
- M0-T04 is complete after the scoped re-review and final controller gates;
  M0-T05 is the only direct successor unlocked to `ready`.
