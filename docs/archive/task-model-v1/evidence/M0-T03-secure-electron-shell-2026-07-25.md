# M0-T03 Secure Electron Shell Evidence

Final status (2026-07-26): M0-T03 implementation, the repository quality gate,
and both focused real-Electron security gates pass. The inherited M0-T02
timeout fixtures were first converted from permanent loops to finite 5,000 ms
timers under explicit user authorization; the full gate therefore ran without
executing a permanent-loop task.

## Environment and build

- Evidence timestamp: `2026-07-26T17:39:43.2168565+08:00`
- Branch: `codex/m0-t03-secure-electron-shell`
- Compared with baseline: `47b942b`
- Verified implementation head before state/evidence completion: `c346f5c`
- Node package manager declaration: `pnpm@11.12.0`
- Fresh `corepack pnpm --version`: `11.12.0`
- Frozen offline install: exit `0`, already up to date, completed in `239 ms`
- Ignored dependency builds: none
- Fresh production `electron-vite` build: exit `0`, `0.965 s`

The production renderer is loaded from `file:` when no development URL is
provided. The pure `resolve-main-window-options` unit test proves that packaged
mode discards a supplied development URL. A real packaged artifact remains an
M0-T06 gate.

## Window preferences and preload surface

The production BrowserWindow factory configures:

```text
sandbox: true
contextIsolation: true
nodeIntegration: false
nodeIntegrationInWorker: false
nodeIntegrationInSubFrames: false
webSecurity: true
allowRunningInsecureContent: false
experimentalFeatures: false
webviewTag: false
devTools: false
```

TC-M0-003 read back the Electron 43 runtime preference snapshot:

```text
sandbox: true
contextIsolation: true
nodeIntegration: false
nodeIntegrationInSubFrames: false
webSecurity: true
allowRunningInsecureContent: false
experimentalFeatures: false
webviewTag: false
```

Electron 43 omits explicitly false `devTools` and
`nodeIntegrationInWorker` from `getLastWebPreferences()`. The factory unit test
asserts both constructor values, while TC-M0-004 proves effective DevTools
denial by attempting to open DevTools, observing no `devtools-opened` event
within the bounded window, and confirming `isDevToolsOpened() === false`.

The preload entry remains empty for M0-T03. In TC-M0-003, renderer probes found
`require`, `process`, `electron`, `ipcRenderer`, `fs`, `shell`, and `lattice`
all `undefined`. M0-T03 creates no IPC handlers or preload capability.

## CSP and permission policy

Exact production CSP:

```text
default-src 'self'; base-uri 'none'; child-src 'none'; connect-src 'none'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'
```

Unit coverage asserts the exact header and replacement behavior. TC-M0-004
provides behavioral proof that an inline script does not execute and that a
loopback fetch which would otherwise succeed is rejected before the server
receives any request. Both permission checks and permission requests are denied
by default; the runtime notification request returned `denied`.

## Navigation and external-link matrix

The external URL policy accepts at most 2,081 UTF-16 code units. Current unit
coverage proves over-limit rejection but does not yet include an exact
2,081-unit acceptance case.

| Input or action | Evidence | Expected result |
| --- | --- | --- |
| Confirmed `https://example.com/path?q=1` | TC-M0-004 main-process dialog and shell doubles | One normalized OS-handoff call; renderer URL unchanged |
| Cancelled HTTPS | TC-M0-004 | No OS handoff, navigation, or new window |
| Confirmed `mailto:editor@example.com?subject=Lattice` | TC-M0-004 | One normalized OS-handoff call; renderer URL unchanged |
| Cancelled mailto | TC-M0-004 | No OS handoff, navigation, or new window |
| `http:`, `file:`, `javascript:`, `data:`, custom protocol, encoded pseudo-JavaScript | Unit matrix and TC-M0-004 | Denied before OS handoff |
| Credential-bearing HTTPS | Unit matrix and TC-M0-004 | Denied before confirmation or OS handoff |
| Empty, whitespace/control, parse failure, missing HTTPS authority (including `https://\example.com` WHATWG repair), empty mail target | Unit matrix | Denied with a stable policy reason |
| Renderer `_self` or `_blank` navigation | WebContents unit coverage and TC-M0-004 | Synchronously denied; one main window remains |
| Loopback redirect | TC-M0-004 | No inherited confirmation and zero server requests after bounded observation |
| Webview attachment | WebContents unit coverage | Synchronously prevented |

TC-M0-004 replaced `dialog.showMessageBox` and `shell.openExternal` inside the
main process before exercising links. No real browser, mail client, or other
external program was launched.

## Fake/destroyed window and hostile payload matrix

- The real production main window loads through `file:` and retains the secure
  runtime preferences.
- A hidden window created without project options still inherits Electron's
  global sandbox default and has Node integration disabled.
- The hidden window is destroyed and reports its destroyed state.
- A parsed `__proto__` object and a bounded 2,100,000-character renderer
  payload do not pollute `Object.prototype`, do not reach an IPC surface, and do
  not terminate the page.
- The renderer remains `complete`, and exactly one main window remains.
- Both real-Electron tests used finite waits and `finally` cleanup. Post-run
  scans found no residual Electron process.

## Commands and exits

| Command or gate | Result | Duration / count |
| --- | --- | --- |
| `corepack pnpm --version` | exit `0`; `11.12.0` | combined environment preflight `1.04 s` |
| `corepack pnpm install --frozen-lockfile --offline` | exit `0`; already up to date | `239 ms` reported by pnpm |
| `corepack pnpm ignored-builds` | exit `0`; none | included in `1.04 s` preflight |
| Direct project Prettier check over the repository | exit `0` | `1.189 s` |
| Direct project ESLint with zero warnings | exit `0` | `3.689 s` |
| Node, web, and test TypeScript project checks | exit `0` | `2.216 s` |
| Raw-authority regression before production fix | exit `1` as expected; 1 failed, 23 passed | WHATWG repaired `https://\example.com` to `https://example.com/` |
| Focused raw-authority regression after production fix | exit `0`; 24/24 tests | `1.233 s` wall, Vitest `783 ms` |
| Six explicitly enumerated M0-T03 unit files after the fix | exit `0`; 6/6 files, 44/44 tests | `1.371 s` wall, Vitest `929 ms` |
| Direct production `electron-vite` build | exit `0` | `0.965 s` |
| Final TC-M0-003 focused real-Electron security test | exit `0`; 1/1 | Playwright `596 ms`; command `2.438 s`; no residual Electron process |
| Final TC-M0-004 focused real-Electron E2E | exit `0`; 1/1 | Playwright `1.8 s`; command `3.592 s`; no residual Electron process |
| `node scripts/verify-planning-docs.mjs` | exit `0`; 50 files, 77 tasks, 86 automated tests, 13 manual cases, 83 requirements, 36 compatibility items | `0.098 s` |
| `git diff --check` before this draft | exit `0` | no output |
| `git status --short` before this draft | exit `0` | no output |
| Full unit lifecycle gate after finite-timeout maintenance | exit `0`; 13/13 files, 105/105 tests | `4.813 s` |
| Focused TC-M0-002 quality-script integration after maintenance | exit `0`; 17/17 tests | `201.376 s` |
| Required `corepack pnpm check` before state completion | exit `0`; 105 unit tests, 18 integration tests, production build | about `214 s`; recorded exit file contains `0` |
| Completion `corepack pnpm check` after state/evidence changes | exit `0`; 105 unit tests, 18 integration tests, production build | about `217 s`; recorded exit file contains `0` |
| Final planning verifier and diff check | exit `0` | M0-T03 passed, only M0-T04 ready |

Before the full gate, every permanent `setInterval` child fixture in the
M0-T02 command-timeout tests was replaced with a finite 5,000 ms `setTimeout`.
The existing command timeouts remain 20-500 ms and the cleanup guard remains
1,000 ms, so timeout, failure, kill/unref, and descendant-cleanup behavior is
still tested before the finite fixture can end naturally.

## Residual risks and ownership

- The M0-T02 timeout tests now use finite fixtures. The maintenance preserves
  their original timeout and process-tree assertions and was reviewed
  independently before the full gate ran.
- The external URL unit suite does not yet prove acceptance at exactly 2,081
  UTF-16 code units; it proves the maximum in production code and over-limit
  rejection.
- M0-T04 still owns typed IPC contracts, request IDs, sender and argument
  validation, stable errors, and the first approved preload method.
- M0-T06 still owns packaged-artifact inspection, CI, dependency review,
  CodeQL, SBOM, and the manual production review.
- M0-T03 manual gate: not applicable.
- M0-T03 has no manual gate. Its successful state transition unlocks only
  M0-T04; later tasks remain blocked by their declared dependencies.
