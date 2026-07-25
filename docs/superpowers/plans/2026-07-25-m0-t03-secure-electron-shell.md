# M0-T03 Secure Electron Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete M0-T03 with a production-safe Electron shell that denies renderer privileges, in-window navigation, unapproved windows, permissions, unsafe protocols, and development backdoors while allowing only user-confirmed `https:` and `mailto:` links to reach the operating system.

**Architecture:** Keep decisions testable in pure TypeScript modules, then install them once at the Electron application, session, and `WebContents` boundaries. The main-window factory owns immutable `webPreferences`; the session owns CSP and permission denial; every created `WebContents` receives navigation, redirect, new-window, and webview denial. External links always stay out of the renderer and pass through a main-process parse -> allowlist -> confirmation -> `shell.openExternal` coordinator.

**Tech Stack:** Electron 43.1.1, electron-vite 5.0.0, TypeScript 5.9.3 strict mode, Vitest 4.1.10, Playwright Electron 1.61.1, pnpm 11.12.0, Node 24.

## Global Constraints

- Implement only M0-T03. Do not add IPC contracts, file APIs, user HTML preview, command registry, window chrome, CI, SBOM, GitHub workflows, or repository rules.
- Preserve the Markdown source-authority and renderer sandbox rules from `AGENTS.md`; this task must not introduce a document model or any persistence path.
- Call `app.enableSandbox()` synchronously before `app.whenReady()`.
- Keep the renderer without Node, Electron, `ipcRenderer`, `shell`, filesystem, or any preload API. M0-T04 owns the first typed preload method and sender/argument validation.
- Treat every renderer-originated URL as untrusted. Never pass a raw renderer string directly to `shell.openExternal`.
- An external request is eligible only when it is a syntactically valid, bounded, credential-free `https:` URL or a non-empty `mailto:` URL, and it still requires an explicit main-process confirmation.
- Always return `{ action: 'deny' }` from `setWindowOpenHandler`; a confirmed URL opens through the operating system, never in another Electron window.
- Deny all permission checks and requests. Do not add one-off permission exceptions in M0-T03.
- A packaged application must ignore `ELECTRON_RENDERER_URL`; production windows have `devTools: false`.
- CSP must be delivered by the Electron session response-header boundary. Development may allow its local HMR connection, but production must use `connect-src 'none'`.
- Event callbacks must prevent navigation synchronously. Any asynchronous confirmation happens only after the Electron navigation/window request has already been denied.
- Async external-open failures must be converted to a typed outcome; no floating rejected promise or renderer-visible error detail.
- Tests must not launch the real default browser or mail client. Stub `dialog.showMessageBox` and `shell.openExternal` in the Electron main process.
- Do not weaken existing tests, use `any`, use `@ts-ignore`, disable lint rules, or add test-only production backdoors.
- M0-T03 has no manual gate. If Electron automation cannot run, keep the task `in_progress` and record the environment blocker.
- Use non-destructive patches and preserve unrelated changes. Commit only when explicitly authorized.

## File Map

| File                                                       | Responsibility                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `tasks/state.json`                                         | Select M0-T03, then record evidence and unlock only M0-T04                         |
| `tasks/M0-foundation.md`                                   | Complete the M0-T03 delivery, failure, and completion contract                     |
| `docs/03-architecture.md`                                  | Record application/session/WebContents security ownership                          |
| `docs/05-data-safety-and-security.md`                      | Record exact URL, CSP, navigation, permission, and DevTools policy                 |
| `docs/09-test-strategy.md`                                 | Define TC-M0-003/004 execution and real external-open stubbing                     |
| `docs/test-cases/M0-foundation.md`                         | Clarify the M0-T03 versus M0-T04 security boundary                                 |
| `src/main/index.ts`                                        | Enable the global sandbox and compose the secure application                       |
| `src/main/bootstrap/create-main-window.ts`                 | Create the only production main window with explicit preferences                   |
| `src/main/security/external-url-policy.ts`                 | Parse, classify, confirm, and safely hand off external URLs                        |
| `src/main/security/content-security-policy.ts`             | Build and attach development/production CSP headers                                |
| `src/main/security/session-security-policy.ts`             | Deny permissions and install CSP on the default session                            |
| `src/main/security/web-contents-security-policy.ts`        | Deny navigation, redirects, new windows, and webviews                              |
| `tests/unit/main/external-url-policy.spec.ts`              | Unit matrix for URL classification and external-open outcomes                      |
| `tests/unit/main/content-security-policy.spec.ts`          | Unit assertions for exact CSP and header preservation                              |
| `tests/security/electron-boundary.spec.ts`                 | TC-M0-003 renderer, preload, sandbox, fake-window, and payload proof               |
| `tests/e2e/navigation-policy.spec.ts`                      | TC-M0-004 external-link, protocol, navigation, CSP, permission, and DevTools proof |
| `docs/evidence/M0-T03-secure-electron-shell-2026-07-25.md` | Auditable command, test, policy, and residual-risk evidence                        |

---

### Task 1: Select M0-T03 and Complete Its Readiness Contract

**Files:**

- Modify: `tasks/state.json`
- Modify: `tasks/M0-foundation.md`
- Modify: `docs/test-cases/M0-foundation.md`
- Modify: `docs/09-test-strategy.md`

**Interfaces:**

- Consumes: approved design `docs/superpowers/specs/2026-07-25-m0-engineering-readiness-completion-design.md`
- Produces: one selected `in_progress` task and an unambiguous M0-T03/M0-T04 test boundary

- [ ] **Step 1: Mark M0-T03 in progress before implementation**

Change only the selector and M0-T03 entry:

```json
"current_task": "M0-T03"
```

```json
{
  "id": "M0-T03",
  "status": "in_progress",
  "depends_on": ["M0-T02"],
  "manual_gate": false,
  "evidence": []
}
```

Keep M0-T04 and every later task `blocked`.

Run: `node scripts/verify-planning-docs.mjs`

Expected: exit 0; M0-T01 and M0-T02 remain `passed`; only M0-T03 is `in_progress`.

- [ ] **Step 2: Replace the abbreviated M0-T03 task contract**

Expand `tasks/M0-foundation.md#M0-T03` with these decisions:

```markdown
## M0-T03 安全 Electron 壳

- 依赖：M0-T02
- 需求：UI-001、NFR-007；风险 R-008
- 设计决策：同步调用 `app.enableSandbox()`；主窗口显式关闭 Node、开发工具、webview 和不安全内容；应用级策略覆盖每个 `WebContents`；默认 session 统一下发 CSP 并拒绝权限；renderer 外链先同步拒绝窗口内打开，再由 main 校验、确认并交给系统。
- 交付：安全主窗口工厂、CSP/权限/session 策略、导航/重定向/新窗口/webview 策略，以及只允许经确认的无凭据 `https:` 和非空 `mailto:` 外链策略。
- 预期文件：`src/main/bootstrap/`、`src/main/security/`、TC-M0-003、TC-M0-004、同步架构/安全/测试文档和 M0-T03 证据。
- 非目标：IPC 契约、sender/参数 schema、文件 API、用户 HTML 预览、命令注册表、CI/SBOM。
- 自动验证：SEC-001..008；`pnpm check`、`pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts`、`pnpm test:security -- tests/security/electron-boundary.spec.ts`。
- 人工验证：不适用（`manual_gate:false`）；外部程序调用通过 main-process stub 自动证明，不真的启动默认浏览器或邮件客户端。
- 失败回退：保持任务 `in_progress`；修复策略或测试根因并重新运行完整安全门禁；不得删除恶意协议、CSP、权限、生产 DevTools 或 renderer 权限用例。
- 完成：SEC-001..008 和质量门禁通过，策略与文档一致，证据完整；状态设为 `passed` 并只解锁 M0-T04。
```

- [ ] **Step 3: Clarify TC-M0-003 ownership**

Change TC-M0-003 so M0-T03 proves that no callable IPC/preload surface exists, while M0-T04 remains responsible for real request IDs, sender checks, and Zod argument rejection:

```markdown
| TC-M0-003 | M0-T03 | security/P0 | SEC-M0-A | 启动生产配置，探测主窗口/伪造窗口/已销毁窗口、Node/Electron/裸 IPC/preload 表面，并投递污染对象和超大 renderer 消息 | `require/process/ipcRenderer/fs/shell` 不可得；preload 表面为空；无消息进入 main；窗口保持存活 | `pnpm test:security -- tests/security/electron-boundary.spec.ts` |
```

Retain TC-M0-005 for valid/missing/wrong request ID, schema parameters, sender validation, unknown channels, and serialization behavior after M0-T04 creates an actual IPC surface.

- [ ] **Step 4: Add the security-test isolation rule**

In `docs/09-test-strategy.md`, state:

```markdown
- M0-T03 的外链 E2E 必须在 Electron main process 替换 `dialog.showMessageBox` 与 `shell.openExternal`，记录调用后随应用进程销毁；不得唤起真实浏览器或邮件客户端。
- `test:e2e` 验证导航、窗口、权限、CSP 与生产 DevTools；`test:security` 验证 renderer/preload/沙箱边界和恶意 payload。两者均从无 `ELECTRON_RENDERER_URL` 的生产构建启动。
- M0-T03 不伪造 IPC handler；无 IPC 表面是本任务的通过条件。M0-T04 创建首个契约后再验证 request ID、sender 和参数拒绝。
```

- [ ] **Step 5: Validate the readiness patch**

Run: `node scripts/verify-planning-docs.mjs`

Expected: exit 0 with M0-T03 selected and TC-M0-003/004 still unique.

Run: `git diff --check`

Expected: no output.

---

### Task 2: Build the Pure External-URL Decision and Confirmation Boundary

**Files:**

- Create: `src/main/security/external-url-policy.ts`
- Create: `tests/unit/main/external-url-policy.spec.ts`

**Interfaces:**

```ts
export type ExternalUrlDecision =
  | { readonly kind: 'deny'; readonly reason: ExternalUrlDenialReason }
  | {
      readonly kind: 'confirm'
      readonly protocol: 'https:' | 'mailto:'
      readonly normalizedUrl: string
    }

export interface ExternalOpenPort {
  readonly confirm: (parent: BrowserWindow | null, normalizedUrl: string) => Promise<boolean>
  readonly open: (normalizedUrl: string) => Promise<void>
}

export type ExternalOpenOutcome = 'denied' | 'cancelled' | 'opened' | 'failed'

export function decideExternalUrl(rawUrl: string): ExternalUrlDecision
export function requestExternalOpen(
  parent: BrowserWindow | null,
  rawUrl: string,
  port: ExternalOpenPort
): Promise<ExternalOpenOutcome>
```

- [ ] **Step 1: Write the failing URL decision matrix**

Create `tests/unit/main/external-url-policy.spec.ts` with table cases for:

```ts
const allowed = [
  ['https://example.com/path?q=1#fragment', 'https:', 'https://example.com/path?q=1#fragment'],
  ['HTTPS://EXAMPLE.COM/Path', 'https:', 'https://example.com/Path'],
  ['mailto:editor@example.com', 'mailto:', 'mailto:editor@example.com'],
  ['MAILTO:editor@example.com?subject=Hello', 'mailto:', 'mailto:editor@example.com?subject=Hello']
] as const

const denied = [
  '',
  ' https://example.com',
  'https://example.com\n',
  'https://user:secret@example.com',
  'https:///missing-host',
  'mailto:',
  'mailto:?subject=missing-recipient',
  'http://example.com',
  'file:///C:/Windows/System32/calc.exe',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'custom://example',
  '%6a%61vascript:alert(1)'
] as const
```

Also generate one URL longer than 2,081 UTF-16 code units.

Run: `pnpm test -- tests/unit/main/external-url-policy.spec.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement bounded, normalized classification**

Create `src/main/security/external-url-policy.ts` with:

```ts
import { dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'

export const maximumExternalUrlLength = 2_081

export type ExternalUrlDenialReason =
  'empty' | 'too-long' | 'control-character' | 'invalid' | 'protocol' | 'credentials' | 'target'

export type ExternalUrlDecision =
  | { readonly kind: 'deny'; readonly reason: ExternalUrlDenialReason }
  | {
      readonly kind: 'confirm'
      readonly protocol: 'https:' | 'mailto:'
      readonly normalizedUrl: string
    }

export interface ExternalOpenPort {
  readonly confirm: (parent: BrowserWindow | null, normalizedUrl: string) => Promise<boolean>
  readonly open: (normalizedUrl: string) => Promise<void>
}

export type ExternalOpenOutcome = 'denied' | 'cancelled' | 'opened' | 'failed'

const controlCharacterPattern = /[\u0000-\u001f\u007f]/

export function decideExternalUrl(rawUrl: string): ExternalUrlDecision {
  if (rawUrl.length === 0) return { kind: 'deny', reason: 'empty' }
  if (rawUrl.length > maximumExternalUrlLength) return { kind: 'deny', reason: 'too-long' }
  if (rawUrl.trim() !== rawUrl || controlCharacterPattern.test(rawUrl)) {
    return { kind: 'deny', reason: 'control-character' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { kind: 'deny', reason: 'invalid' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    return { kind: 'deny', reason: 'protocol' }
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return { kind: 'deny', reason: 'credentials' }
  }
  if (parsed.protocol === 'https:' && parsed.hostname.length === 0) {
    return { kind: 'deny', reason: 'target' }
  }
  if (parsed.protocol === 'mailto:' && parsed.pathname.length === 0) {
    return { kind: 'deny', reason: 'target' }
  }

  return {
    kind: 'confirm',
    protocol: parsed.protocol,
    normalizedUrl: parsed.href
  }
}

export async function requestExternalOpen(
  parent: BrowserWindow | null,
  rawUrl: string,
  port: ExternalOpenPort
): Promise<ExternalOpenOutcome> {
  const decision = decideExternalUrl(rawUrl)
  if (decision.kind === 'deny') return 'denied'

  try {
    const confirmed = await port.confirm(parent, decision.normalizedUrl)
    if (!confirmed) return 'cancelled'
    await port.open(decision.normalizedUrl)
    return 'opened'
  } catch {
    return 'failed'
  }
}

export const electronExternalOpenPort: ExternalOpenPort = {
  confirm: async (parent, normalizedUrl) => {
    const options = {
      type: 'question' as const,
      buttons: ['Open', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: 'Open external link?',
      message: 'Open this link in your default application?',
      detail: normalizedUrl
    }
    const result =
      parent === null
        ? await dialog.showMessageBox(options)
        : await dialog.showMessageBox(parent, options)
    return result.response === 0
  },
  open: async (normalizedUrl) => {
    await shell.openExternal(normalizedUrl)
  }
}
```

The strings are temporary shell-level strings; localization is introduced later and must replace them in the localization task.

- [ ] **Step 3: Test the confirmation state machine**

Add unit cases proving:

```ts
expect(await requestExternalOpen(null, 'http://example.com', port)).toBe('denied')
expect(confirm).not.toHaveBeenCalled()
expect(open).not.toHaveBeenCalled()

expect(await requestExternalOpen(null, 'https://example.com', cancelledPort)).toBe('cancelled')
expect(cancelledOpen).not.toHaveBeenCalled()

expect(await requestExternalOpen(null, 'https://example.com', confirmedPort)).toBe('opened')
expect(confirmedOpen).toHaveBeenCalledWith('https://example.com/')

expect(await requestExternalOpen(null, 'mailto:a@example.com', failingPort)).toBe('failed')
```

Run: `pnpm test -- tests/unit/main/external-url-policy.spec.ts`

Expected: PASS with allow, deny, cancel, success, and rejection coverage.

---

### Task 3: Install Exact CSP and Permission Denial at the Session Boundary

**Files:**

- Create: `src/main/security/content-security-policy.ts`
- Create: `src/main/security/session-security-policy.ts`
- Create: `tests/unit/main/content-security-policy.spec.ts`

**Interfaces:**

```ts
export function buildContentSecurityPolicy(development: boolean): string
export function appendContentSecurityPolicy(
  responseHeaders: Readonly<Record<string, readonly string[]>> | undefined,
  policy: string
): Record<string, string[]>
export function installSessionSecurityPolicy(targetSession: Session, development: boolean): void
```

- [ ] **Step 1: Write failing CSP tests**

Test exact production directives:

```ts
expect(buildContentSecurityPolicy(false)).toBe(
  [
    "default-src 'self'",
    "base-uri 'none'",
    "child-src 'none'",
    "connect-src 'none'",
    "font-src 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'"
  ].join('; ')
)
```

Test that development changes only `connect-src` to:

```text
connect-src 'self' ws://localhost:* ws://127.0.0.1:*
```

Test that `appendContentSecurityPolicy` preserves existing headers, removes any case-insensitive stale CSP key, and writes exactly one `Content-Security-Policy` value.

Run: `pnpm test -- tests/unit/main/content-security-policy.spec.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 2: Implement deterministic CSP construction**

Create `src/main/security/content-security-policy.ts`:

```ts
const staticDirectives = [
  "default-src 'self'",
  "base-uri 'none'",
  "child-src 'none'",
  "font-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'"
] as const

export function buildContentSecurityPolicy(development: boolean): string {
  const connectSource = development
    ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
    : "connect-src 'none'"
  return [
    staticDirectives[0],
    staticDirectives[1],
    staticDirectives[2],
    connectSource,
    ...staticDirectives.slice(3)
  ].join('; ')
}

export function appendContentSecurityPolicy(
  responseHeaders: Readonly<Record<string, readonly string[]>> | undefined,
  policy: string
): Record<string, string[]> {
  const nextHeaders: Record<string, string[]> = {}
  for (const [name, values] of Object.entries(responseHeaders ?? {})) {
    if (name.toLowerCase() !== 'content-security-policy') {
      nextHeaders[name] = [...values]
    }
  }
  nextHeaders['Content-Security-Policy'] = [policy]
  return nextHeaders
}
```

- [ ] **Step 3: Install CSP and both permission handlers**

Create `src/main/security/session-security-policy.ts`:

```ts
import type { Session } from 'electron'
import { appendContentSecurityPolicy, buildContentSecurityPolicy } from './content-security-policy'

export function installSessionSecurityPolicy(targetSession: Session, development: boolean): void {
  targetSession.setPermissionCheckHandler(() => false)
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  const policy = buildContentSecurityPolicy(development)
  targetSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: appendContentSecurityPolicy(details.responseHeaders, policy)
    })
  })
}
```

Run: `pnpm test -- tests/unit/main/content-security-policy.spec.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: exit 0. If Electron's current header type is narrower, adjust the pure function's input to the exact Electron `ResponseHeaders` type; do not assert or cast around the mismatch.

---

### Task 4: Apply the Policy to Every WebContents and Create the Secure Main Window

**Files:**

- Create: `src/main/security/web-contents-security-policy.ts`
- Create: `src/main/bootstrap/create-main-window.ts`
- Modify: `src/main/index.ts`

**Interfaces:**

```ts
export function installWebContentsSecurityPolicy(
  contents: WebContents,
  externalOpenPort: ExternalOpenPort
): void

export interface CreateMainWindowOptions {
  readonly currentDirectory: string
  readonly developmentRendererUrl?: string
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow
```

- [ ] **Step 1: Install synchronous deny handlers**

Create `src/main/security/web-contents-security-policy.ts`:

```ts
import { BrowserWindow } from 'electron'
import type { WebContents } from 'electron'
import { electronExternalOpenPort, requestExternalOpen } from './external-url-policy'
import type { ExternalOpenPort } from './external-url-policy'

export function installWebContentsSecurityPolicy(
  contents: WebContents,
  externalOpenPort: ExternalOpenPort = electronExternalOpenPort
): void {
  const parentWindow = (): BrowserWindow | null => {
    const candidate = BrowserWindow.fromWebContents(contents)
    return candidate === null || candidate.isDestroyed() ? null : candidate
  }

  contents.on('will-frame-navigate', (event, details) => {
    event.preventDefault()
    if (details.isMainFrame) {
      void requestExternalOpen(parentWindow(), details.url, externalOpenPort)
    }
  })

  contents.on('will-redirect', (event) => {
    event.preventDefault()
  })

  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  contents.setWindowOpenHandler(({ url }) => {
    void requestExternalOpen(parentWindow(), url, externalOpenPort)
    return { action: 'deny' }
  })
}
```

Redirects are denied without a second confirmation because the confirmed URL and the redirect target are not the same user decision.

- [ ] **Step 2: Create the explicit BrowserWindow factory**

Create `src/main/bootstrap/create-main-window.ts`:

```ts
import { BrowserWindow } from 'electron'
import { join } from 'node:path'

export interface CreateMainWindowOptions {
  readonly currentDirectory: string
  readonly developmentRendererUrl?: string
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const development = options.developmentRendererUrl !== undefined
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: true,
    webPreferences: {
      preload: join(options.currentDirectory, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      devTools: development
    }
  })

  if (options.developmentRendererUrl === undefined) {
    void window.loadFile(join(options.currentDirectory, '../renderer/index.html'))
  } else {
    void window.loadURL(options.developmentRendererUrl)
  }
  return window
}
```

- [ ] **Step 3: Compose the application in the required order**

Replace `src/main/index.ts` with:

```ts
import { app, BrowserWindow, session } from 'electron'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMainWindow } from './bootstrap/create-main-window'
import { installSessionSecurityPolicy } from './security/session-security-policy'
import { installWebContentsSecurityPolicy } from './security/web-contents-security-policy'

app.enableSandbox()

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const developmentRendererUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL

app.on('web-contents-created', (_event, contents) => {
  installWebContentsSecurityPolicy(contents)
})

void app.whenReady().then(() => {
  installSessionSecurityPolicy(session.defaultSession, developmentRendererUrl !== undefined)
  createMainWindow({ currentDirectory, developmentRendererUrl })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({ currentDirectory, developmentRendererUrl })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

Because `exactOptionalPropertyTypes` is enabled, build the call object without the optional key when `developmentRendererUrl` is `undefined` if TypeScript rejects the shown shorthand:

```ts
const windowOptions =
  developmentRendererUrl === undefined
    ? { currentDirectory }
    : { currentDirectory, developmentRendererUrl }
```

- [ ] **Step 4: Run static and focused gates**

Run: `pnpm format`

Run: `pnpm lint`

Run: `pnpm typecheck`

Run: `pnpm test -- tests/unit/main`

Run: `pnpm build`

Expected: all exit 0; `out/main/index.js`, `out/preload/index.cjs`, and renderer artifacts exist.

---

### Task 5: Automate TC-M0-003 Renderer and Sandbox Boundary Proof

**Files:**

- Create: `tests/security/electron-boundary.spec.ts`
- Retain: `tests/security/electron-boundary.smoke.spec.ts`

**Interfaces:**

- Consumes: production build with `ELECTRON_RENDERER_URL` removed
- Produces: SEC-M0-A evidence without adding an IPC test surface

- [ ] **Step 1: Launch only the production path**

Use the existing environment-copy pattern and delete `ELECTRON_RENDERER_URL`. Add a test that reads `getLastWebPreferences()` from the real main window and requires:

```ts
expect(preferences).toEqual({
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  webviewTag: false,
  devTools: false
})
```

Also require the page URL to use `file:`.

- [ ] **Step 2: Prove the renderer and preload surface is empty**

Evaluate only reflective probes in the renderer:

```ts
const globals = await page.evaluate(() => {
  const names = ['require', 'process', 'electron', 'ipcRenderer', 'fs', 'shell', 'lattice'] as const
  return Object.fromEntries(names.map((name) => [name, typeof Reflect.get(globalThis, name)]))
})

expect(globals).toEqual({
  require: 'undefined',
  process: 'undefined',
  electron: 'undefined',
  ipcRenderer: 'undefined',
  fs: 'undefined',
  shell: 'undefined',
  lattice: 'undefined'
})
```

- [ ] **Step 3: Cover fake and destroyed windows**

From `application.evaluate`, create a hidden `BrowserWindow` with default preferences, read its final preferences, destroy it, wait one main-process turn, and assert:

```ts
expect(result.beforeDestroy.sandbox).toBe(true)
expect(result.beforeDestroy.nodeIntegration).toBe(false)
expect(result.destroyed).toBe(true)
```

The global `app.enableSandbox()` is what this fake-window assertion protects. Do not load a remote/data URL into the fake window.

- [ ] **Step 4: Cover pollution and oversized renderer messages**

In the renderer:

```ts
const result = await page.evaluate(() => {
  const polluted = JSON.parse('{"__proto__":{"latticePolluted":true}}')
  globalThis.postMessage(polluted, '*')
  globalThis.postMessage({ payload: 'x'.repeat(2_100_000) }, '*')
  return {
    prototypeValue: Reflect.get(Object.prototype, 'latticePolluted'),
    documentState: document.readyState
  }
})
```

Require `prototypeValue` to be `undefined`, the page to remain responsive, and the main window count to remain one. This proves there is no M0-T03 IPC receiver; M0-T04 will test invalid request IDs and typed handler arguments.

- [ ] **Step 5: Run the focused security gate**

Run: `pnpm test:security -- tests/security/electron-boundary.spec.ts`

Expected: PASS for main, fake, destroyed, empty preload, unavailable privilege globals, pollution, and oversized renderer message cases.

---

### Task 6: Automate TC-M0-004 Navigation, External Link, CSP, Permission, and DevTools Proof

**Files:**

- Create: `tests/e2e/navigation-policy.spec.ts`

**Interfaces:**

- Consumes: application/session/WebContents policy
- Produces: SEC-M0-B proof with main-process `dialog` and `shell` stubs

- [ ] **Step 1: Add main-process external-open instrumentation**

After launching Electron and before clicking a link, replace `dialog.showMessageBox` and `shell.openExternal` with `Reflect.set`. Store only normalized URLs in a private main-process array and control confirmation with a private boolean. The replacement must return:

```ts
;async () => ({
  response: confirmed ? 0 : 1,
  checkboxChecked: false
})
```

and:

```ts
;async (url: string) => {
  openedUrls.push(url)
}
```

The application process is closed in `finally`, so the replacement cannot escape the test.

- [ ] **Step 2: Prove confirmed and cancelled allowed links**

Click target-blank anchors for:

```ts
const eligibleUrls = [
  'https://example.com/path?q=1',
  'mailto:editor@example.com?subject=Lattice'
] as const
```

For confirmation `true`, poll until the main-process opened list contains each normalized URL. For confirmation `false`, require no new open call. In every case require:

```ts
expect(page.url()).toBe(originalUrl)
expect(await application.windows()).toHaveLength(1)
```

- [ ] **Step 3: Prove unsafe and confused protocols never reach the OS**

Exercise both target-blank and same-frame anchors with:

```ts
const deniedUrls = [
  'http://example.com',
  'file:///C:/Windows/System32/calc.exe',
  'javascript:globalThis.__latticeExecuted=true',
  'data:text/html,<script>globalThis.__latticeExecuted=true</script>',
  'custom://example',
  '%6a%61vascript:alert(1)',
  'https://user:secret@example.com'
] as const
```

Require no shell calls, no new window, unchanged main URL, and `__latticeExecuted` to remain absent.

- [ ] **Step 4: Prove redirect chains cannot start in the renderer**

Start a loopback HTTP server that increments a request counter and responds with `302 Location: https://example.com/final`. Click the server URL from the renderer. Require:

```ts
expect(requestCount).toBe(0)
expect(openedUrls).toEqual([])
expect(page.url()).toBe(originalUrl)
```

The initial `http:` URL is denied before a network request, so an unreviewed redirect target never enters the application.

- [ ] **Step 5: Prove CSP and permission denial**

Append an inline `<script>` element whose text would set `globalThis.__latticeInlineScript`. Require the marker to remain absent.

Then request notifications and require denial:

```ts
const permission = await page.evaluate(async () => Notification.requestPermission())
expect(permission).toBe('denied')
```

Also require `fetch('https://example.com')` to reject under production `connect-src 'none'` without relying on external network availability.

- [ ] **Step 6: Prove there is no production DevTools backdoor**

From the main process, call `webContents.openDevTools()` on the main window, wait for the call to settle, and require:

```ts
expect(webContents.isDevToolsOpened()).toBe(false)
expect(webContents.getLastWebPreferences().devTools).toBe(false)
```

Launch once more with a forged `ELECTRON_RENDERER_URL` while using the built application entry. If `app.isPackaged` is false in the Playwright directory launch, keep this assertion at the factory unit boundary and record that packaged-path rejection is rechecked by M0-T06's packaged artifact gate; do not create a fake production environment variable.

- [ ] **Step 7: Run the focused E2E gate**

Run: `pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts`

Expected: PASS with real Electron event routing and no real OS external program.

---

### Task 7: Synchronize Architecture and Security Documentation

**Files:**

- Modify: `docs/03-architecture.md`
- Modify: `docs/05-data-safety-and-security.md`
- Modify: `docs/09-test-strategy.md`
- Modify: `docs/test-cases/M0-foundation.md`

**Interfaces:**

- Consumes: implemented module paths and verified behavior
- Produces: current, auditable public architecture and security boundary documentation

- [ ] **Step 1: Record security ownership in the architecture**

Document this mapping:

```text
app bootstrap:
  app.enableSandbox + packaged/development path choice
session policy:
  CSP headers + permission check/request denial
WebContents policy:
  navigation + redirect + new-window + webview denial
external URL policy:
  parse + bound + protocol/credential/target allowlist + confirm + OS handoff
BrowserWindow factory:
  immutable production webPreferences
preload:
  empty until M0-T04
```

State that `web-contents-created` covers future windows, but privileged capabilities still require a narrow typed preload contract in M0-T04.

- [ ] **Step 2: Record exact security invariants**

In `docs/05-data-safety-and-security.md`, record:

```markdown
- 外链输入最大 2,081 UTF-16 code units；拒绝首尾空白、控制字符、解析失败、凭据、空目标和非 `https:`/`mailto:` 协议。
- renderer 导航、新窗口和 webview 先同步拒绝；只有 main-process 确认后的规范化 URL 可交给 `shell.openExternal`。
- 重定向不继承原 URL 的用户确认。
- production CSP 使用 `connect-src 'none'`，脚本和样式只允许 `'self'`，对象/框架/表单/base URI 全部禁止。
- permission check 与 permission request 均默认拒绝。
- packaged 应用忽略开发 URL；production `devTools:false`。
```

- [ ] **Step 3: Validate docs and implementation together**

Run: `node scripts/verify-planning-docs.mjs`

Run: `pnpm format:check`

Run: `git diff --check`

Expected: all exit 0.

---

### Task 8: Run Full Verification, Review, Record Evidence, and Close M0-T03

**Files:**

- Create: `docs/evidence/M0-T03-secure-electron-shell-2026-07-25.md`
- Modify: `tasks/state.json`

**Interfaces:**

- Consumes: all M0-T03 source, documentation, and fresh command output
- Produces: M0-T03 `passed`, M0-T04 `ready`, and an auditable evidence record

- [ ] **Step 1: Run fresh verification in order**

Run and record timestamp, duration, exit code, and test count:

```powershell
corepack pnpm --version
pnpm install --frozen-lockfile --offline
pnpm ignored-builds
pnpm check
pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts
pnpm test:security -- tests/security/electron-boundary.spec.ts
node scripts/verify-planning-docs.mjs
git diff --check
git status --short
```

Expected: pnpm `11.12.0`; no ignored builds; every quality/security command exits 0; only intended M0-T03 files are modified.

- [ ] **Step 2: Record evidence without overstating M0-T04/M0-T06**

Create `docs/evidence/M0-T03-secure-electron-shell-2026-07-25.md` with actual values under:

```markdown
# M0-T03 Secure Electron Shell Evidence

## Environment and build

## Window preferences and preload surface

## CSP and permission policy

## Navigation and external-link matrix

## Fake/destroyed window and hostile payload matrix

## Commands and exits

## Residual risks and ownership

- M0-T04 still owns typed IPC contracts, request IDs, sender/argument validation, stable errors, and the first approved preload method.
- M0-T06 still owns packaged-artifact inspection, CI, dependency review, CodeQL, SBOM, and the manual production review.
- M0-T03 manual gate: not applicable.
```

Include the exact CSP string, `webPreferences` snapshot, eligible/denied URL table, stubbed external-open calls, and confirmation that no real external program was launched.

- [ ] **Step 3: Request a dedicated code review**

Use `superpowers:requesting-code-review`. Review against `AGENTS.md`, the approved design, this plan, M0-T03 task contract, SEC-001..008, TC-M0-003, and TC-M0-004.

Treat any renderer Node/Electron exposure, direct `shell.openExternal(rawUrl)`, allowed in-window navigation, redirect inheritance, permission grant, missing production CSP, dev URL/DevTools path, floating rejection, or test-only production backdoor as blocking.

- [ ] **Step 4: Apply review findings with verification**

For each actionable finding, use `superpowers:receiving-code-review`; reproduce it, add or strengthen the failing test, fix the root cause, and rerun the focused gate. Do not accept speculative changes outside M0-T03.

- [ ] **Step 5: Mark M0-T03 passed and unlock only M0-T04**

In `tasks/state.json`:

```json
"current_task": null
```

Set M0-T03 to `passed` with command, test, and report evidence entries pointing to `docs/evidence/M0-T03-secure-electron-shell-2026-07-25.md`. Set only M0-T04 from `blocked` to `ready`; leave M0-T05 and all later tasks unchanged.

- [ ] **Step 6: Re-run the completion gate after state/evidence changes**

Run: `node scripts/verify-planning-docs.mjs`

Run: `pnpm check`

Run: `pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts`

Run: `pnpm test:security -- tests/security/electron-boundary.spec.ts`

Run: `git diff --check`

Expected: all exit 0 with M0-T03 passed and only M0-T04 ready.

- [ ] **Step 7: Commit only with explicit authorization**

When the user explicitly authorizes implementation commits:

```powershell
git add tasks/state.json tasks/M0-foundation.md docs/03-architecture.md docs/05-data-safety-and-security.md docs/09-test-strategy.md docs/test-cases/M0-foundation.md src/main/index.ts src/main/bootstrap/create-main-window.ts src/main/security tests/unit/main tests/security/electron-boundary.spec.ts tests/e2e/navigation-policy.spec.ts docs/evidence/M0-T03-secure-electron-shell-2026-07-25.md
git commit -m "feat(M0-T03): secure the Electron shell"
```

Run: `git status --short`

Expected: no output.

Report changed files, every command and result, the absence of a manual M0-T03 gate, residual M0-T04/M0-T06 ownership, and the exact next ready task. Do not push or open a PR; remote creation remains M0-T06.
