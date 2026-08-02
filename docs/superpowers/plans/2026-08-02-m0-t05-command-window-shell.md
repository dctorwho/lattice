# M0-T05 Command Registry and Window Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one typed command authority and a real, accessible Electron window shell whose native menu, buttons, context menu, and shortcuts execute the same two working commands.

**Architecture:** A framework-free `CommandRegistry` in `src/domain/commands/` owns command definitions, state derivation, and execution. React owns shell state and projects registry state to UI; a strict preload bridge synchronizes the same state to a fixed Electron native menu and relays only approved command IDs back to the renderer.

**Tech Stack:** Electron 43.1.1, React 19.2.7, TypeScript 5.9.3 strict mode, Zod 4.4.3, Vitest 4.1.10, Testing Library 16.3.2, Playwright Electron 1.61.1, pnpm 11.12.0, Node 24.

## Global Constraints

- Implement only M0-T05 until it is `passed`; M0-T06 remains blocked.
- Add no production or development dependency in this task.
- The only active command IDs are `view.toggleSidebar` and `app.about`.
- Do not add file, edit, workspace, export, settings, or other speculative controls.
- Keep the system window frame and M0-T03 sandbox, navigation, CSP, permission, and DevTools restrictions unchanged.
- Expose only frozen `{ app, commands }` through preload; never expose Electron objects, raw IPC, arbitrary channel names, file APIs, or generic execution.
- The renderer may submit command state only for its own sender-derived authorized window; it never supplies a window or WebContents ID.
- Keep user-visible text in the typed `zh-CN` and `en` renderer catalogs.
- Do not use `any`, `@ts-ignore`, disabled lint rules, unchecked double assertions, non-null assertions, permanent timers, polling, or unbounded processes.
- Write and observe a focused failing test before each production behavior change.
- Every checkpoint runs its focused tests and `git diff --check`; the final gate runs `pnpm check`, Electron E2E, security, planning verification, and independent review.
- Commit each independently reviewable deliverable, then fast-forward merge the completed branch to `main` and push `main` to the configured GitHub remote.

---

## File Map

| File                                                      | Responsibility                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `tasks/state.json`                                        | Select M0-T05, record evidence, pass it, and unlock only M0-T06      |
| `tasks/M0-foundation.md`                                  | Make M0-T05 scope, checks, failure behavior, and completion explicit |
| `src/domain/commands/command-types.ts`                    | Stable IDs, context, state, result, and command interfaces           |
| `src/domain/commands/command-registry.ts`                 | Duplicate protection, sorted snapshots, guarded execution            |
| `src/domain/commands/create-foundation-commands.ts`       | Define the two real M0 commands                                      |
| `src/domain/commands/index.ts`                            | Public domain command exports                                        |
| `src/shared/contracts/command.ts`                         | Strict event and state-sync Zod contracts                            |
| `src/shared/contracts/channels.ts`                        | Fixed invoke-event and state-sync channels                           |
| `src/shared/contracts/lattice-desktop-api.ts`             | Exact frozen renderer-visible command API                            |
| `src/shared/contracts/index.ts`                           | Shared command contract exports                                      |
| `src/preload/api/create-command-api.ts`                   | Validate events, unsubscribe safely, and invoke state sync           |
| `src/preload/index.ts`                                    | Expose frozen `{ app, commands }` only                               |
| `src/main/commands/application-menu.ts`                   | Build and project the fixed native menu                              |
| `src/main/ipc/register-command-state-ipc.ts`              | Register strict state-sync route                                     |
| `src/main/index.ts`                                       | Compose menu, sender-derived state ownership, and command relay      |
| `src/renderer/src/i18n/messages.ts`                       | Complete typed Simplified Chinese and English catalogs               |
| `src/renderer/src/i18n/translate.ts`                      | Typed lookup with deterministic default locale                       |
| `src/renderer/src/commands/use-command-controller.ts`     | Bind registry execution to shell state and preload events            |
| `src/renderer/src/components/app-shell.tsx`               | Accessible title area, sidebar, main region, status bar              |
| `src/renderer/src/components/command-context-menu.tsx`    | Renderer context menu with focus restoration                         |
| `src/renderer/src/components/about-dialog.tsx`            | Real AppInfo dialog and safe error state                             |
| `src/renderer/src/app.tsx`                                | Compose the M0 window shell                                          |
| `src/renderer/src/styles.css`                             | Responsive, dark-mode, high-contrast shell styling                   |
| `tests/unit/domain/command-registry.spec.ts`              | Registry and COMMAND-M0 state matrix                                 |
| `tests/unit/shared/command-contracts.spec.ts`             | Strict command state/event schemas                                   |
| `tests/unit/preload/command-api.spec.ts`                  | Event validation, unsubscribe, fixed channel, result validation      |
| `tests/unit/main/application-menu.spec.ts`                | Fail-closed native menu and state projection                         |
| `tests/unit/component/command-registry.spec.tsx`          | Four entry points, About, focus, and localization                    |
| `tests/e2e/command-window-shell.spec.ts`                  | Real Electron menu, shortcut, shell, and About behavior              |
| `tests/security/electron-boundary.spec.ts`                | Exact frozen `{ app, commands }` surface and privilege denial        |
| `docs/03-architecture.md`                                 | Command authority and menu projection boundary                       |
| `docs/05-data-safety-and-security.md`                     | Strict command IPC and sender ownership rules                        |
| `docs/06-ui-interaction-spec.md`                          | Actual M0 shell behavior and future-editor boundary                  |
| `docs/09-test-strategy.md`                                | TC-M0-006 allocation and commands                                    |
| `docs/15-public-contracts.md`                             | Exact command/preload contracts                                      |
| `docs/16-project-structure-and-standards.md`              | New command and renderer responsibilities                            |
| `docs/test-cases/M0-foundation.md`                        | Executable COMMAND-M0 matrix                                         |
| `docs/evidence/M0-T05-command-window-shell-2026-08-02.md` | Completion evidence and residual risks                               |

---

### Task 1: Select M0-T05 and Lock Its Executable Contract

**Files:**

- Modify: `tasks/state.json`
- Modify: `tasks/M0-foundation.md`

**Interfaces:**

- Consumes: M0-T04 `passed`, M0-T05 `ready`, approved M0-T05 design
- Produces: M0-T05 `in_progress`; M0-T06 remains `blocked`

- [ ] **Step 1: Mark only M0-T05 in progress**

Set `current_task` to `M0-T05`, change only M0-T05 to `in_progress`, and keep its evidence empty:

```json
{
  "id": "M0-T05",
  "status": "in_progress",
  "depends_on": ["M0-T04"],
  "manual_gate": false,
  "evidence": []
}
```

- [ ] **Step 2: Expand the milestone task contract**

Add the design decision, exact files, focused checks, failure response, and completion transition from the approved design to M0-T05 in `tasks/M0-foundation.md`. State explicitly that no dependency is added and M0-T06 stays blocked until all M0-T05 gates pass.

- [ ] **Step 3: Verify planning state**

Run:

```powershell
node scripts/verify-planning-docs.mjs
git diff --check
```

Expected: both exit 0; M0-T05 is the sole `in_progress` task.

- [ ] **Step 4: Commit the task-selection checkpoint**

```powershell
git add tasks/state.json tasks/M0-foundation.md
git diff --cached --check
git commit -m "chore(M0-T05): select command shell task"
```

---

### Task 2: Build the Pure Command Domain

**Files:**

- Create: `src/domain/commands/command-types.ts`
- Create: `src/domain/commands/command-registry.ts`
- Create: `src/domain/commands/create-foundation-commands.ts`
- Create: `src/domain/commands/index.ts`
- Modify: `src/domain/index.ts`
- Create: `tests/unit/domain/command-registry.spec.ts`

**Interfaces:**

- Consumes: no renderer, DOM, Electron, or Node API
- Produces: `CommandId`, `CommandContext`, `CommandState`, `CommandResult`, `AppCommand`, `CommandRegistry`, `createFoundationCommands`

- [ ] **Step 1: Write the failing registry matrix**

Cover duplicate IDs, stable ID sorting, unknown IDs, invisible/disabled guarding, handler exceptions, async success, and every COMMAND-M0 context dimension. Use factories typed as:

```ts
function createContext(overrides: Partial<CommandContext> = {}): CommandContext
function createCommand(id: CommandId, state: CommandState, run: AppCommand['run']): AppCommand
```

Assert these current policies exactly:

```ts
expect(toggle.getState(focusedContext)).toEqual({
  id: 'view.toggleSidebar',
  isVisible: true,
  isEnabled: true,
  isChecked: true
})
expect(about.getState(dialogContext).isEnabled).toBe(false)
```

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd test -- tests/unit/domain/command-registry.spec.ts
```

Expected: fail because command modules do not exist.

- [ ] **Step 3: Define exact domain types**

Implement:

```ts
export const commandIds = ['app.about', 'view.toggleSidebar'] as const
export type CommandId = (typeof commandIds)[number]

export interface CommandContext {
  readonly isSidebarVisible: boolean
  readonly isDialogOpen: boolean
  readonly isWindowFocused: boolean
  readonly hasSession: boolean
  readonly isSessionDirty: boolean
  readonly hasEditor: boolean
}

export type CommandResult =
  | { readonly status: 'executed' }
  | { readonly status: 'not-found'; readonly id: string }
  | { readonly status: 'not-visible'; readonly id: CommandId }
  | { readonly status: 'disabled'; readonly id: CommandId }
  | {
      readonly status: 'failed'
      readonly id: CommandId
      readonly messageKey: 'errors.internal.unexpected'
    }
```

`CommandExecutionContext` extends the state context with injected `toggleSidebar()` and `openAbout()` effects. `AppCommand.run()` returns `Promise<CommandResult>`.

- [ ] **Step 4: Implement guarded registry behavior**

`CommandRegistry` copies definitions on construction, rejects duplicates, never calls a handler for unknown/invisible/disabled IDs, catches unknown exceptions, and returns a newly allocated read-only snapshot sorted by ID.

- [ ] **Step 5: Define the two foundation commands**

`view.toggleSidebar` uses `CommandOrControl+Shift+L`; `app.about` uses `F1`. Both ignore session/editor flags; toggle requires focused/no dialog, and About requires no dialog.

- [ ] **Step 6: Run GREEN and quality checks**

```powershell
pnpm.cmd test -- tests/unit/domain/command-registry.spec.ts
pnpm.cmd typecheck
pnpm.cmd lint
git diff --check
```

Expected: all exit 0.

- [ ] **Step 7: Commit the domain checkpoint**

```powershell
git add src/domain tests/unit/domain/command-registry.spec.ts
git diff --cached --check
git commit -m "feat(M0-T05): add typed command registry"
```

---

### Task 3: Define Strict Command Contracts and Preload API

**Files:**

- Create: `src/shared/contracts/command.ts`
- Modify: `src/shared/contracts/channels.ts`
- Modify: `src/shared/contracts/lattice-desktop-api.ts`
- Modify: `src/shared/contracts/index.ts`
- Create: `src/preload/api/create-command-api.ts`
- Modify: `src/preload/index.ts`
- Create: `tests/unit/shared/command-contracts.spec.ts`
- Create: `tests/unit/preload/command-api.spec.ts`

**Interfaces:**

- Consumes: domain `CommandId`/`CommandState`, existing request envelope and `Result<AppError>` conventions
- Produces: `COMMAND_INVOKED_CHANNEL`, `COMMAND_UPDATE_STATES_CHANNEL`, `commandStateSyncRequestSchema`, `commandStateSyncResultSchema`, `CommandApi`

- [ ] **Step 1: Write failing strict-schema tests**

Assert the state-sync request accepts exactly two unique approved IDs and rejects missing, duplicate, unknown, extra-property, oversized, and wrong-version inputs. Assert the main event schema accepts only:

```ts
{ contractVersion: 1, id: 'view.toggleSidebar' }
{ contractVersion: 1, id: 'app.about' }
```

- [ ] **Step 2: Write failing preload behavior tests**

Use injected `invoke`, `on`, and `removeListener` adapters. Prove fixed channels, request-ID generation, response validation, invalid event dropping, listener exception isolation, and idempotent unsubscribe. Assert no caller-controlled channel parameter exists.

- [ ] **Step 3: Run RED**

```powershell
pnpm.cmd test -- tests/unit/shared/command-contracts.spec.ts tests/unit/preload/command-api.spec.ts
```

Expected: fail on missing command contracts and API.

- [ ] **Step 4: Implement strict Zod contracts**

Define `commandIdSchema`, a strict `commandStateSchema`, and a `superRefine` state-array schema that requires length 2 and exactly one of each approved ID. Define success value:

```ts
export interface CommandStateSync {
  readonly contractVersion: 1
  readonly applied: true
}
```

Reuse the existing UUID request envelope and stable errors rather than creating a generic event bus.

- [ ] **Step 5: Implement and freeze `CommandApi`**

Expose exactly:

```ts
export interface CommandApi {
  readonly onInvoke: (listener: (id: CommandId) => void) => () => void
  readonly updateStates: (
    states: readonly CommandState[]
  ) => Promise<Result<CommandStateSync, AppError>>
}
```

Parse each main event before calling listeners. Return an idempotent closure that removes only its wrapped listener. Parse the invoke result with `commandStateSyncResultSchema` before returning it.

- [ ] **Step 6: Extend the exact preload surface**

Construct `commands` with the injected Electron adapters, freeze nested objects, and expose `Object.freeze({ app, commands })`. Do not export a logger or Electron event.

- [ ] **Step 7: Run GREEN and regress AppInfo**

```powershell
pnpm.cmd test -- tests/unit/shared/contracts.spec.ts tests/unit/shared/command-contracts.spec.ts tests/unit/preload/app-api.spec.ts tests/unit/preload/command-api.spec.ts
pnpm.cmd typecheck
pnpm.cmd lint
git diff --check
```

- [ ] **Step 8: Commit the contract/preload checkpoint**

```powershell
git add src/shared/contracts src/preload tests/unit/shared tests/unit/preload
git diff --cached --check
git commit -m "feat(M0-T05): expose strict command bridge"
```

---

### Task 4: Project Command State into the Native Electron Menu

**Files:**

- Create: `src/main/commands/application-menu.ts`
- Create: `src/main/ipc/register-command-state-ipc.ts`
- Modify: `src/main/index.ts`
- Create: `tests/unit/main/application-menu.spec.ts`
- Modify: `tests/unit/main/compose-application.spec.ts`

**Interfaces:**

- Consumes: authorized window registry, fixed command channels/schemas, Electron Menu adapters
- Produces: `ApplicationMenuController`, `createApplicationMenu`, sender-owned validated state projection

- [ ] **Step 1: Write failing menu projection tests**

Inject a minimal menu adapter and window resolver. Prove the fixed template contains only View/Toggle Sidebar and Help/About Lattice, exact IDs/accelerators, fail-closed startup, focused authorized-window routing, ignored unauthorized/destroyed targets, and updates limited to `visible`, `enabled`, `checked`.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd test -- tests/unit/main/application-menu.spec.ts
```

Expected: fail because the controller does not exist.

- [ ] **Step 3: Implement the menu controller**

Define:

```ts
export interface ApplicationMenuController {
  readonly install: () => void
  readonly updateStates: (windowId: number, states: readonly CommandState[]) => void
  readonly applyForFocusedWindow: () => void
  readonly removeWindow: (windowId: number) => void
}
```

Store one last validated snapshot per authorized window. A missing snapshot sets both items `enabled:false`; only the sidebar item can be checked.

- [ ] **Step 4: Register state sync through the existing router**

Add a fixed route whose handler receives sender-derived window context and applies only schema-valid state. Return `{ ok:true, value:{ contractVersion:1, applied:true } }`. Do not accept an ID from the renderer.

- [ ] **Step 5: Compose lifecycle and relay**

Install the menu after `app.whenReady()`. On click, resolve the focused registered window and call `webContents.send(COMMAND_INVOKED_CHANNEL, validatedEvent)`. On focus, reapply that window's snapshot; on close/destroy remove it.

- [ ] **Step 6: Run GREEN and main regressions**

```powershell
pnpm.cmd test -- tests/unit/main/application-menu.spec.ts tests/unit/main/compose-application.spec.ts tests/unit/main/ipc-router.spec.ts tests/unit/main/authorized-window-registry.spec.ts
pnpm.cmd typecheck
pnpm.cmd lint
git diff --check
```

- [ ] **Step 7: Commit the native-menu checkpoint**

```powershell
git add src/main tests/unit/main
git diff --cached --check
git commit -m "feat(M0-T05): project commands to native menu"
```

---

### Task 5: Build the Localized Accessible React Shell

**Files:**

- Create: `src/renderer/src/i18n/messages.ts`
- Create: `src/renderer/src/i18n/translate.ts`
- Create: `src/renderer/src/commands/use-command-controller.ts`
- Create: `src/renderer/src/components/app-shell.tsx`
- Create: `src/renderer/src/components/command-context-menu.tsx`
- Create: `src/renderer/src/components/about-dialog.tsx`
- Modify: `src/renderer/src/app.tsx`
- Modify: `src/renderer/src/styles.css`
- Modify: `tests/unit/app.smoke.spec.tsx`
- Create: `tests/unit/component/command-registry.spec.tsx`

**Interfaces:**

- Consumes: `CommandRegistry`, `createFoundationCommands`, `window.lattice.app`, `window.lattice.commands`
- Produces: real shell UI and one controller used by button, context-menu, shortcut, and native-menu event entry points

- [ ] **Step 1: Write failing shell and four-entry tests**

Mock the exact preload API. Assert semantic regions, no editable input, no future-feature controls, sidebar toggle state, About real data/error display, and this shared spy condition for every entry:

```ts
expect(execute).toHaveBeenCalledWith('view.toggleSidebar')
expect(execute).toHaveBeenCalledWith('app.about')
```

Prove Escape/outside-click context-menu close, About close, and sidebar-hide restore focus to the deterministic trigger/main target.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd test -- tests/unit/app.smoke.spec.tsx tests/unit/component/command-registry.spec.tsx
```

Expected: fail because the bootstrap card is still rendered.

- [ ] **Step 3: Add complete typed catalogs**

Define the exact key union from the `zh-CN` catalog and require the English catalog to `satisfies Record<MessageKey, string>`. Include brand, sidebar, editor-not-ready, status-ready, both commands, About fields/actions, and all active AppError message keys.

- [ ] **Step 4: Implement the command controller**

Use React state/reducer for `isSidebarVisible`, `isDialogOpen`, `isWindowFocused`, context-menu coordinates, status message, and focus restoration. Register one `window.lattice.commands.onInvoke` subscription, one bounded keyboard handler, window focus/blur handlers, and cleanup all listeners on unmount. Send state snapshots when derived state changes; do not retry failures.

- [ ] **Step 5: Implement accessible components**

Use `header`, `aside`, `main tabIndex={-1}`, `footer`, native `button`, and native `dialog`. The main region states that editing starts in M1 and is not `contenteditable`. Keep OS window controls; do not imitate minimize/maximize/close.

- [ ] **Step 6: Implement responsive styling**

Use CSS variables and grid. At 320px, collapse layout without horizontal overflow; at 100%-250% zoom, preserve access to buttons and main content. Add `prefers-color-scheme`, `prefers-contrast`, and `prefers-reduced-motion` rules without animation-dependent behavior.

- [ ] **Step 7: Run GREEN and accessibility-focused assertions**

```powershell
pnpm.cmd test -- tests/unit/app.smoke.spec.tsx tests/unit/component/command-registry.spec.tsx
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd exec prettier --check src/renderer tests/unit/component tests/unit/app.smoke.spec.tsx
git diff --check
```

If `pnpm.cmd exec` cannot resolve a local binary in the current PowerShell host, run `node_modules\.bin\prettier.cmd` with the same arguments; this is an environment workaround, not a project change.

- [ ] **Step 8: Commit the renderer checkpoint**

```powershell
git add src/renderer tests/unit/app.smoke.spec.tsx tests/unit/component
git diff --cached --check
git commit -m "feat(M0-T05): build accessible window shell"
```

---

### Task 6: Prove the Real Electron Command Paths and Security Surface

**Files:**

- Create: `tests/e2e/command-window-shell.spec.ts`
- Modify: `tests/e2e/app-launch.spec.ts`
- Modify: `tests/security/electron-boundary.spec.ts`

**Interfaces:**

- Consumes: built production Electron app, native menu, exact preload API
- Produces: runtime evidence for TC-M0-006 and security regression proof

- [ ] **Step 1: Write the real-Electron tests before adapting assertions**

Launch with `ELECTRON_RENDERER_URL` removed. Through Electron main evaluation, locate menu items by stable ID and invoke their click callbacks against the real window. Through the page, exercise the title button, renderer context menu, and `Control+Shift+L`; exercise F1 and assert About shows the real name/version/platform/contract version.

- [ ] **Step 2: Update exact security assertions**

Assert:

```ts
expect(preloadSurface.latticeKeys).toEqual(['app', 'commands'])
expect(preloadSurface.appKeys).toEqual(['getInfo'])
expect(preloadSurface.commandKeys).toEqual(['onInvoke', 'updateStates'])
```

Also assert every exposed object/function boundary is frozen where applicable, invalid command events never reach the renderer listener, and raw `invoke`, `send`, `ipcRenderer`, file/export APIs remain absent.

- [ ] **Step 3: Run focused real-Electron gates**

```powershell
pnpm.cmd build
pnpm.cmd exec playwright test tests/e2e/command-window-shell.spec.ts tests/e2e/app-launch.spec.ts --config playwright.config.ts
pnpm.cmd exec playwright test tests/security/electron-boundary.spec.ts --config playwright.security.config.ts
```

Expected: all pass; each Electron application closes in `finally`; no residual Electron process owned by the test remains.

- [ ] **Step 4: Commit runtime tests**

```powershell
git add tests/e2e tests/security/electron-boundary.spec.ts
git diff --cached --check
git commit -m "test(M0-T05): prove command shell end to end"
```

---

### Task 7: Synchronize Contracts, Tests, and Evidence

**Files:**

- Modify: `docs/03-architecture.md`
- Modify: `docs/05-data-safety-and-security.md`
- Modify: `docs/06-ui-interaction-spec.md`
- Modify: `docs/09-test-strategy.md`
- Modify: `docs/15-public-contracts.md`
- Modify: `docs/16-project-structure-and-standards.md`
- Modify: `docs/test-cases/M0-foundation.md`
- Create: `docs/evidence/M0-T05-command-window-shell-2026-08-02.md`
- Modify: `tasks/state.json`

**Interfaces:**

- Consumes: fresh final command outputs and reviewed implementation
- Produces: auditable M0-T05 completion and only M0-T06 unlocked

- [ ] **Step 1: Update public documentation to actual behavior**

Document renderer command authority, sender-derived menu projection, exact `{ app, commands }` preload surface, current shell boundary, localization keys, focus rules, and precise test allocation. Do not claim editing, files, custom frame controls, or future commands exist.

- [ ] **Step 2: Run the complete finite gate from a clean process state**

Run each command separately and record command, timestamp, exit code, and test count/hash where emitted:

```powershell
pnpm.cmd install --frozen-lockfile --offline
pnpm.cmd ignored-builds
pnpm.cmd test -- tests/unit/domain/command-registry.spec.ts tests/unit/component/command-registry.spec.tsx tests/unit/main/application-menu.spec.ts tests/unit/preload/command-api.spec.ts
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
node scripts/verify-planning-docs.mjs
git diff --check
```

Expected: every command exits 0. No command watches, polls, or leaves a server running.

- [ ] **Step 3: Request independent code review**

Use `superpowers:requesting-code-review`. Resolve every actionable correctness, security, test-validity, or documentation finding and rerun the affected focused gate plus the complete gate.

- [ ] **Step 4: Write evidence and transition state**

Create the evidence report with commit range, changed boundaries, commands/results, TC-M0-006 mapping, preload surface, review resolution, and residual risks. Then set M0-T05 `passed`, M0-T06 `ready`, `current_task:null`, and attach command/test/report evidence objects with the current UTC timestamp.

- [ ] **Step 5: Reverify the recorded state**

```powershell
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git diff --check
```

Expected: all exit 0 with the evidence and final state included.

- [ ] **Step 6: Commit completion**

```powershell
git add docs tasks/state.json
git diff --cached --check
git commit -m "docs(M0-T05): record command shell evidence"
```

---

### Task 8: Integrate M0-T05 and Update GitHub

**Files:**

- No source changes; Git branch, commit, remote, and PR/merge state only

**Interfaces:**

- Consumes: clean reviewed M0-T05 branch with every gate passing
- Produces: local and remote `main` containing the exact reviewed branch tip; feature branch removed after verification

- [ ] **Step 1: Verify branch readiness**

```powershell
git status --short
git log --oneline --decorate main..codex/m0-t05-command-window-shell
git merge-base --is-ancestor main codex/m0-t05-command-window-shell
```

Expected: clean status, intentional commits only, and exit 0 for ancestry.

- [ ] **Step 2: Fast-forward local main**

Switch the main checkout to `main` and run:

```powershell
git merge --ff-only codex/m0-t05-command-window-shell
```

Expected: fast-forward only; no merge commit or conflict.

- [ ] **Step 3: Verify the merged result**

```powershell
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
node scripts/verify-planning-docs.mjs
git status --short --branch
```

Expected: all pass and local `main` is clean.

- [ ] **Step 4: Push and verify GitHub main**

```powershell
git push origin main
gh repo view dctorwho/lattice --json nameWithOwner,visibility,defaultBranchRef,url
git ls-remote origin refs/heads/main
```

Expected: public `dctorwho/lattice`, default branch `main`, and remote hash equals local `git rev-parse main`.

- [ ] **Step 5: Remove the integrated worktree/branch**

Use `superpowers:finishing-a-development-branch`; remove only the clean M0-T05 worktree and delete only the fully merged local feature branch. Do not delete unrelated branches or user work.
