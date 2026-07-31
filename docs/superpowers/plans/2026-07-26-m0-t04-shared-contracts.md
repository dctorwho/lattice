# M0-T04 Shared Contracts and Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first narrow, runtime-validated Electron IPC capability with stable errors, trusted sender context, redacted logs, and an exact preload surface.

**Architecture:** Shared Zod schemas define the wire contract and infer TypeScript types. A main-process fixed-channel router derives trusted window context from an application-owned registry, validates request and response values, and converts every boundary failure into a stable `Result`; preload exposes only `window.lattice.app.getInfo()` and validates the response again.

**Tech Stack:** Electron 43.1.1, electron-vite 5.0.0, TypeScript 5.9.3 strict mode, Zod 4.4.3, Vitest 4.1.10, Playwright Electron 1.61.1, pnpm 11.12.0, Node 24.

## Global Constraints

- Implement only M0-T04 until it is `passed`; M0-T05 and M0-T06 remain blocked.
- Keep Markdown source authority and all M0-T03 Electron security invariants unchanged.
- Expose only `window.lattice.app.getInfo()`; never expose `ipcRenderer`, `invoke`, `send`, `execute`, file APIs, export APIs, settings APIs, placeholders, or Electron objects.
- Use Zod 4.4.3 as the only new production dependency; pin the exact version and retain only `pnpm-lock.yaml`.
- Treat every Electron request, sender, argument, handler result, and unknown exception as untrusted at the process boundary.
- Derive window/WebContents/session context in main; renderer never self-asserts authorization.
- Keep request input within 65,536 UTF-16 code units, depth 8, and 256 total keys/elements.
- Permit only bounded JSON-like response values; reject non-finite numbers, functions, bigint, accessors, class instances, cycles, and other non-contract values.
- Never log payloads, Markdown, clipboard data, search text, full paths, sender URLs, exception messages, or raw stacks.
- Do not use `any`, `@ts-ignore`, disabled lint rules, non-null assertion shortcuts, unchecked double assertions, permanent timers, or unbounded background processes.
- Write a failing behavior test and observe the expected failure before every production behavior change.
- Run all task-specific checks plus `corepack pnpm check`; commands must be finite and leave no child process behind.
- Do not create commits, tags, pushes, PRs, releases, or remote changes unless the user explicitly authorizes that Git action. Commit commands below are prepared checkpoints, not authorization.

---

## File Map

| File                                                   | Responsibility                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `tasks/state.json`                                     | Select M0-T04, then record evidence and unlock only M0-T05           |
| `tasks/M0-foundation.md`                               | Fix exact M0-T04 delivery, validation, failure, and completion rules |
| `package.json`, `pnpm-lock.yaml`                       | Pin Zod 4.4.3 as the only new production dependency                  |
| `src/shared/errors/error-code.ts`                      | Stable active M0-T04 error codes and message keys                    |
| `src/shared/errors/app-error.ts`                       | `AppError`, safe details, schema, and factory                        |
| `src/shared/errors/result.ts`                          | `Result<T, E>` and Zod schema factory                                |
| `src/shared/errors/index.ts`                           | Stable error exports                                                 |
| `src/shared/contracts/contract-version.ts`             | Contract version constant/schema                                     |
| `src/shared/contracts/ipc-request.ts`                  | Request ID, strict envelope, and empty payload                       |
| `src/shared/contracts/channels.ts`                     | Internal approved channel constants/schema                           |
| `src/shared/contracts/app-info.ts`                     | AppInfo and `app.getInfo` schemas/types                              |
| `src/shared/contracts/lattice-desktop-api.ts`          | Exact renderer-visible API type                                      |
| `src/shared/contracts/index.ts`, `src/shared/index.ts` | Stable shared exports                                                |
| `src/main/ipc/ipc-value-budget.ts`                     | Input budget and JSON-like serialization validation                  |
| `src/main/ipc/authorized-window-registry.ts`           | Application-owned window/WebContents registry                        |
| `src/main/ipc/validate-ipc-sender.ts`                  | Sender/main-frame/window ownership validation                        |
| `src/main/ipc/ipc-error-logger.ts`                     | Fixed safe log event, stack redaction, and console sink              |
| `src/main/ipc/create-ipc-router.ts`                    | Fixed route dispatch and boundary error conversion                   |
| `src/main/ipc/create-app-info.ts`                      | Injected app information provider                                    |
| `src/main/ipc/register-app-info-ipc.ts`                | Register only the approved Electron invoke channel                   |
| `src/main/index.ts`                                    | Compose registry/router/window registration with Electron adapters   |
| `src/preload/api/create-app-api.ts`                    | Build the one-method preload app API                                 |
| `src/preload/index.ts`                                 | Expose the frozen `window.lattice` surface                           |
| `src/renderer/src/lattice-api.d.ts`                    | Readonly renderer global declaration                                 |
| `tests/unit/shared/contracts.spec.ts`                  | TC-M0-005 shared schema/result matrix                                |
| `tests/unit/main/ipc-value-budget.spec.ts`             | Input/output traversal and serialization matrix                      |
| `tests/unit/main/authorized-window-registry.spec.ts`   | Registration, replacement, and cleanup behavior                      |
| `tests/unit/main/validate-ipc-sender.spec.ts`          | Sender rejection matrix                                              |
| `tests/unit/main/ipc-router.spec.ts`                   | Routing, errors, request IDs, response validation, and logging       |
| `tests/unit/preload/app-api.spec.ts`                   | Fixed channel, generated ID, and response validation                 |
| `tests/security/electron-boundary.spec.ts`             | Real approved preload surface and getInfo call                       |
| `docs/03-architecture.md`                              | Actual trusted IPC context and ownership                             |
| `docs/04-technology-stack.md`                          | Exact Zod dependency admission                                       |
| `docs/05-data-safety-and-security.md`                  | Sender, budget, output, and log invariants                           |
| `docs/09-test-strategy.md`                             | TC-M0-005 evidence allocation                                        |
| `docs/15-public-contracts.md`                          | Executable AppInfo/Result/preload contract                           |
| `docs/16-project-structure-and-standards.md`           | Actual M0-T04 directory responsibilities                             |
| `docs/18-error-catalog.md`                             | Active error codes, keys, and conversion rules                       |
| `docs/test-cases/M0-foundation.md`                     | CONTRACT-M0 matrix and exact commands                                |
| `docs/evidence/M0-T04-shared-contracts-2026-07-26.md`  | Auditable completion evidence                                        |

---

### Task 1: Select M0-T04 and Admit Zod 4.4.3

**Files:**

- Modify: `tasks/state.json`
- Modify: `tasks/M0-foundation.md`
- Modify: `docs/04-technology-stack.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: M0-T03 `passed`, M0-T04 `ready`, approved design `docs/superpowers/specs/2026-07-26-m0-t04-shared-contracts-design.md`
- Produces: M0-T04 `in_progress`, exact Zod 4.4.3 dependency available to shared contracts

- [ ] **Step 1: Select only M0-T04**

Edit `tasks/state.json`:

```json
"current_task": "M0-T04"
```

Change only the M0-T04 entry:

```json
{
  "id": "M0-T04",
  "status": "in_progress",
  "depends_on": ["M0-T03"],
  "manual_gate": false,
  "evidence": []
}
```

Keep M0-T03 `passed`; keep M0-T05 and every later task `blocked`.

Run:

```powershell
node scripts/verify-planning-docs.mjs
```

Expected: exit 0; current task is M0-T04 and no successor is ready.

- [ ] **Step 2: Make the milestone contract executable**

Expand M0-T04 in `tasks/M0-foundation.md` with:

```markdown
- 设计决策：renderer 只获得固定 `app.getInfo()`；request ID 由 preload 生成，窗口/WebContents/会话上下文由 main 派生；固定频道路由依次执行 sender、预算、Zod、handler、response schema 和可序列化性校验；日志只接收固定脱敏字段。
- 预期文件：`src/shared/contracts/`、`src/shared/errors/`、`src/main/ipc/`、`src/preload/api/`、TC-M0-005、更新后的 Electron preload 安全断言、同步文档和 M0-T04 证据。
- 非目标：真实文件、对话框、工作区、设置、导入、导出、通用 IPC、命令注册表、窗口 UI、CI/SBOM。
- 自动验证：`pnpm test -- tests/unit/shared/contracts.spec.ts tests/unit/main/ipc-value-budget.spec.ts tests/unit/main/authorized-window-registry.spec.ts tests/unit/main/validate-ipc-sender.spec.ts tests/unit/main/ipc-router.spec.ts tests/unit/preload/app-api.spec.ts`、`pnpm test:security -- tests/security/electron-boundary.spec.ts`、`pnpm check`。
- 人工验证：不适用（`manual_gate:false`）；真实 preload 表面和 invoke 链路由 Electron 安全测试证明。
- 失败回退：保持任务 `in_progress`，增加回归测试并修复 sender/schema/序列化/日志根因；不得暴露通用 IPC、弱化 schema 或记录敏感输入。
- 完成：TC-M0-005 和质量/安全门禁通过，证据完整；状态设为 `passed` 并只解锁 M0-T05。
```

Run:

```powershell
node scripts/verify-planning-docs.mjs
```

Expected: exit 0.

- [ ] **Step 3: Update dependency admission before installation**

In `docs/04-technology-stack.md`, change the Zod entries to exact version
`4.4.3` and add/confirm:

```markdown
| Zod 4.4.3 | M0-T04 IPC、错误、设置、恢复和元数据运行时校验 | MIT | 否 | 否；0 个传递依赖 | 手写校验、Valibot；契约一致性和审计成本更高 | 低 |
```

Record that the npm package page and upstream release were checked on
2026-07-26, and that future upgrades require the same dependency review.

- [ ] **Step 4: Install the exact dependency**

Run:

```powershell
corepack pnpm add zod@4.4.3 --save-exact
```

Expected: exit 0; `package.json#dependencies.zod` is exactly `"4.4.3"` and
`pnpm-lock.yaml` changes without another lockfile.

- [ ] **Step 5: Verify dependency state**

Run:

```powershell
corepack pnpm install --frozen-lockfile --offline
corepack pnpm ignored-builds
Get-ChildItem -Recurse -File -Include package-lock.json,npm-shrinkwrap.json,yarn.lock
git diff --check
```

Expected: install exit 0; no new ignored build scripts; no npm/yarn lockfile;
diff check exit 0.

- [ ] **Step 6: Prepare the dependency checkpoint**

Do not commit without explicit user authorization. If authorized:

```powershell
git add tasks/state.json tasks/M0-foundation.md docs/04-technology-stack.md package.json pnpm-lock.yaml
git commit -m "build(M0-T04): admit shared contract dependency"
```

---

### Task 2: Define Stable Errors, Results, and Shared App Contract

**Files:**

- Create: `src/shared/errors/error-code.ts`
- Create: `src/shared/errors/app-error.ts`
- Create: `src/shared/errors/result.ts`
- Create: `src/shared/errors/index.ts`
- Create: `src/shared/contracts/contract-version.ts`
- Create: `src/shared/contracts/ipc-request.ts`
- Create: `src/shared/contracts/channels.ts`
- Create: `src/shared/contracts/app-info.ts`
- Create: `src/shared/contracts/lattice-desktop-api.ts`
- Create: `src/shared/contracts/index.ts`
- Modify: `src/shared/index.ts`
- Create: `tests/unit/shared/contracts.spec.ts`

**Interfaces:**

- Consumes: Zod 4.4.3
- Produces:
  - `Result<T, E extends AppError = AppError>`
  - `createAppError(code, requestId, safeDetails?)`
  - `createResultSchema(valueSchema)`
  - `appGetInfoRequestSchema`
  - `appGetInfoResultSchema`
  - `LatticeDesktopApi`

- [ ] **Step 1: Write the failing TC-M0-005 contract test**

Create `tests/unit/shared/contracts.spec.ts` with imports from the not-yet-created
shared modules and these concrete assertions:

```ts
import { describe, expect, it } from 'vitest'

import {
  APP_GET_INFO_CHANNEL,
  IPC_CONTRACT_VERSION,
  appGetInfoRequestSchema,
  appGetInfoResultSchema,
  appInfoSchema,
  approvedIpcChannelSchema
} from '../../../src/shared/contracts'
import { appErrorSchema, createAppError, errorCodeSchema } from '../../../src/shared/errors'

const requestId = '00000000-0000-4000-8000-000000000001'

describe('TC-M0-005 shared contracts', () => {
  it('accepts the exact getInfo request and response', () => {
    expect(
      appGetInfoRequestSchema.parse({
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload: {}
      })
    ).toEqual({ contractVersion: 1, requestId, payload: {} })

    expect(
      appGetInfoResultSchema.parse({
        ok: true,
        value: {
          contractVersion: 1,
          name: 'Lattice',
          version: '0.0.0',
          platform: 'win32'
        }
      })
    ).toEqual({
      ok: true,
      value: {
        contractVersion: 1,
        name: 'Lattice',
        version: '0.0.0',
        platform: 'win32'
      }
    })
  })

  it.each([
    {},
    { contractVersion: 1, requestId, payload: {}, extra: true },
    { contractVersion: 1, payload: {} },
    { contractVersion: 1, requestId: 'not-a-uuid', payload: {} },
    { contractVersion: 2, requestId, payload: {} },
    { contractVersion: 1, requestId, payload: { extra: true } }
  ])('rejects an invalid getInfo envelope: %o', (value) => {
    expect(appGetInfoRequestSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    { contractVersion: 1, name: '', version: '0.0.0', platform: 'win32' },
    { contractVersion: 1, name: 'A'.repeat(65), version: '0.0.0', platform: 'win32' },
    { contractVersion: 1, name: 'Lat\u0000tice', version: '0.0.0', platform: 'win32' },
    { contractVersion: 1, name: 'Lattice', version: '', platform: 'win32' },
    { contractVersion: 1, name: 'Lattice', version: '0.0.0', platform: 'android' }
  ])('rejects invalid AppInfo: %o', (value) => {
    expect(appInfoSchema.safeParse(value).success).toBe(false)
  })

  it('restricts channels and stable error codes', () => {
    expect(approvedIpcChannelSchema.parse(APP_GET_INFO_CHANNEL)).toBe('lattice:app:get-info')
    expect(approvedIpcChannelSchema.safeParse('lattice:invoke').success).toBe(false)
    expect(errorCodeSchema.safeParse('FILE_NOT_FOUND').success).toBe(false)
    expect(errorCodeSchema.safeParse('IPC_INVALID_REQUEST').success).toBe(true)
  })

  it('builds a bounded AppError with a stable message key and request ID', () => {
    expect(
      createAppError('IPC_INVALID_REQUEST', requestId, {
        reason: 'schema_invalid'
      })
    ).toEqual({
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      safeDetails: { reason: 'schema_invalid' },
      requestId
    })
  })

  it.each([
    { code: 'IPC_INVALID_REQUEST', messageKey: 'raw message', retryable: false },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      safeDetails: { path: { nested: true } }
    },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      safeDetails: { path: 'D:\\private\\draft.md' }
    },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.internal.unexpected',
      retryable: false
    },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      unexpected: true
    }
  ])('rejects unsafe AppError shapes: %o', (value) => {
    expect(appErrorSchema.safeParse(value).success).toBe(false)
  })
})
```

Add parameterized cases for all four active error codes and all three platforms.
Each case asserts the exact parsed value, not a snapshot.

- [ ] **Step 2: Run RED**

Run:

```powershell
corepack pnpm test -- tests/unit/shared/contracts.spec.ts
```

Expected: FAIL because `src/shared/contracts` and `src/shared/errors` do not
export the requested symbols.

- [ ] **Step 3: Implement the error primitives**

Create `src/shared/errors/error-code.ts`:

```ts
import { z } from 'zod'

export const errorCodes = [
  'IPC_INVALID_REQUEST',
  'IPC_UNAUTHORIZED_SENDER',
  'APP_VERSION_MISMATCH',
  'INTERNAL_UNEXPECTED'
] as const

export const errorCodeSchema = z.enum(errorCodes)
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const errorMessageKeys = {
  IPC_INVALID_REQUEST: 'errors.ipc.invalidRequest',
  IPC_UNAUTHORIZED_SENDER: 'errors.ipc.unauthorizedSender',
  APP_VERSION_MISMATCH: 'errors.app.versionMismatch',
  INTERNAL_UNEXPECTED: 'errors.internal.unexpected'
} as const satisfies Readonly<Record<ErrorCode, string>>
```

Create `src/shared/errors/app-error.ts`:

```ts
import { z } from 'zod'

import { errorCodeSchema, errorMessageKeys, type ErrorCode } from './error-code'

export const ipcSafeReasonSchema = z.enum([
  'unknown_channel',
  'contract_version_mismatch',
  'schema_invalid',
  'missing_sender_frame',
  'sender_destroyed',
  'subframe_sender',
  'window_not_registered',
  'sender_identity_mismatch',
  'window_destroyed',
  'unsupported_type',
  'non_finite_number',
  'character_budget_exceeded',
  'depth_exceeded',
  'entry_budget_exceeded',
  'symbol_key',
  'accessor',
  'non_plain_object',
  'cycle',
  'handler_threw',
  'response_schema_invalid'
])

export const safeDetailsSchema = z
  .object({
    reason: ipcSafeReasonSchema.optional(),
    expectedVersion: z.literal(1).optional(),
    receivedVersion: z.number().int().min(0).max(1_000).optional()
  })
  .strict()

export const appErrorSchema = z
  .object({
    code: errorCodeSchema,
    messageKey: z.enum([
      'errors.ipc.invalidRequest',
      'errors.ipc.unauthorizedSender',
      'errors.app.versionMismatch',
      'errors.internal.unexpected'
    ]),
    retryable: z.boolean(),
    safeDetails: safeDetailsSchema.optional(),
    requestId: z.string().uuid().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.messageKey !== errorMessageKeys[value.code]) {
      context.addIssue({
        code: 'custom',
        path: ['messageKey'],
        message: 'messageKey must match code'
      })
    }
  })

export type SafeDetails = z.infer<typeof safeDetailsSchema>
export type IpcSafeReason = z.infer<typeof ipcSafeReasonSchema>
export type AppError = z.infer<typeof appErrorSchema>

export function createAppError(
  code: ErrorCode,
  requestId: string,
  safeDetails?: SafeDetails
): AppError {
  const base = {
    code,
    messageKey: errorMessageKeys[code],
    retryable: false,
    requestId
  } as const
  return safeDetails === undefined ? base : { ...base, safeDetails }
}
```

Create `src/shared/errors/result.ts`:

```ts
import { z } from 'zod'

import { appErrorSchema, type AppError } from './app-error'

export type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export function createResultSchema<TValueSchema extends z.ZodType>(valueSchema: TValueSchema) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }).strict(),
    z.object({ ok: z.literal(false), error: appErrorSchema }).strict()
  ])
}
```

Export these symbols from `src/shared/errors/index.ts`.

- [ ] **Step 4: Implement the contract primitives**

Create `src/shared/contracts/contract-version.ts`:

```ts
import { z } from 'zod'

export const IPC_CONTRACT_VERSION = 1 as const
export const ipcContractVersionSchema = z.literal(IPC_CONTRACT_VERSION)
export type IpcContractVersion = z.infer<typeof ipcContractVersionSchema>
```

Create `src/shared/contracts/ipc-request.ts`:

```ts
import { z } from 'zod'

import { ipcContractVersionSchema } from './contract-version'

export const requestIdSchema = z.string().uuid()
export const emptyPayloadSchema = z.object({}).strict()

export function createIpcRequestEnvelopeSchema<TPayloadSchema extends z.ZodType>(
  payloadSchema: TPayloadSchema
) {
  return z
    .object({
      contractVersion: ipcContractVersionSchema,
      requestId: requestIdSchema,
      payload: payloadSchema
    })
    .strict()
}
```

Create `src/shared/contracts/channels.ts`:

```ts
import { z } from 'zod'

export const APP_GET_INFO_CHANNEL = 'lattice:app:get-info' as const
export const approvedIpcChannelSchema = z.enum([APP_GET_INFO_CHANNEL])
export type ApprovedIpcChannel = z.infer<typeof approvedIpcChannelSchema>
```

Create `src/shared/contracts/app-info.ts`:

```ts
import { z } from 'zod'

import { createResultSchema } from '../errors'
import { IPC_CONTRACT_VERSION } from './contract-version'
import { createIpcRequestEnvelopeSchema, emptyPayloadSchema } from './ipc-request'

const boundedPrintableTextSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value))

export const appInfoSchema = z
  .object({
    contractVersion: z.literal(IPC_CONTRACT_VERSION),
    name: boundedPrintableTextSchema,
    version: boundedPrintableTextSchema,
    platform: z.enum(['win32', 'darwin', 'linux'])
  })
  .strict()

export const appGetInfoRequestSchema = createIpcRequestEnvelopeSchema(emptyPayloadSchema)
export const appGetInfoResultSchema = createResultSchema(appInfoSchema)

export type AppInfo = z.infer<typeof appInfoSchema>
export type AppGetInfoRequest = z.infer<typeof appGetInfoRequestSchema>
export type AppGetInfoResult = z.infer<typeof appGetInfoResultSchema>
```

Create `src/shared/contracts/lattice-desktop-api.ts`:

```ts
import type { AppInfo } from './app-info'
import type { AppError, Result } from '../errors'

export interface LatticeDesktopApi {
  readonly app: {
    readonly getInfo: () => Promise<Result<AppInfo, AppError>>
  }
}
```

Export only the intended public symbols from `src/shared/contracts/index.ts`,
then export contracts and errors from `src/shared/index.ts`.

- [ ] **Step 5: Run GREEN and refactor**

Run:

```powershell
corepack pnpm test -- tests/unit/shared/contracts.spec.ts
corepack pnpm typecheck
```

Expected: contract test PASS; typecheck exit 0.

Refactor only duplicated test factories and export order. Re-run both commands.

- [ ] **Step 6: Prepare the shared-contract checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add src/shared tests/unit/shared/contracts.spec.ts
git commit -m "feat(M0-T04): define shared IPC contracts"
```

---

### Task 3: Enforce IPC Input Budgets and Serializable Results

**Files:**

- Create: `src/main/ipc/ipc-value-budget.ts`
- Create: `tests/unit/main/ipc-value-budget.spec.ts`

**Interfaces:**

- Consumes: untrusted `unknown` values
- Produces:

```ts
type IpcValueRejectionReason =
  | 'unsupported_type'
  | 'non_finite_number'
  | 'character_budget_exceeded'
  | 'depth_exceeded'
  | 'entry_budget_exceeded'
  | 'symbol_key'
  | 'accessor'
  | 'non_plain_object'
  | 'cycle'

type IpcValueValidation =
  { readonly ok: true } | { readonly ok: false; readonly reason: IpcValueRejectionReason }

function validateIpcValue(value: unknown, limits?: IpcValueLimits): IpcValueValidation
```

- [ ] **Step 1: Write the failing budget/serialization test**

Create `tests/unit/main/ipc-value-budget.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest'

import { DEFAULT_IPC_VALUE_LIMITS, validateIpcValue } from '../../../src/main/ipc/ipc-value-budget'

describe('TC-M0-005 IPC value budget', () => {
  it.each([
    null,
    true,
    false,
    0,
    1.25,
    '',
    'Lattice',
    [],
    [1, 'two', false, null],
    {},
    (() => {
      const value: Record<string, unknown> = { safe: true }
      Object.setPrototypeOf(value, null)
      return value
    })(),
    { nested: { value: ['ok'] } }
  ])('accepts a bounded JSON-like value: %o', (value) => {
    expect(validateIpcValue(value)).toEqual({ ok: true })
  })

  it.each([
    [undefined, 'unsupported_type'],
    [1n, 'unsupported_type'],
    [Symbol('x'), 'unsupported_type'],
    [() => undefined, 'unsupported_type'],
    [Number.NaN, 'non_finite_number'],
    [Number.POSITIVE_INFINITY, 'non_finite_number'],
    [new Date(), 'non_plain_object'],
    [new Map(), 'non_plain_object'],
    [new Set(), 'non_plain_object'],
    [Promise.resolve(), 'non_plain_object'],
    [new (class Unsafe {})(), 'non_plain_object']
  ] as const)('rejects %o as %s', (value, reason) => {
    expect(validateIpcValue(value)).toEqual({ ok: false, reason })
  })

  it('rejects exact budget overflows', () => {
    expect(validateIpcValue('x'.repeat(DEFAULT_IPC_VALUE_LIMITS.maxCharacters + 1))).toEqual({
      ok: false,
      reason: 'character_budget_exceeded'
    })

    expect(
      validateIpcValue(Array.from({ length: DEFAULT_IPC_VALUE_LIMITS.maxEntries + 1 }, () => null))
    ).toEqual({ ok: false, reason: 'entry_budget_exceeded' })
  })

  it('rejects cycles without hanging', () => {
    const value: { self?: unknown } = {}
    value.self = value
    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'cycle' })
  })

  it('rejects accessors without invoking them', () => {
    let accessed = false
    const value = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get: () => {
        accessed = true
        return 'document body'
      }
    })
    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'accessor' })
    expect(accessed).toBe(false)
  })
})
```

Add separate cases for depth 8 accepted/depth 9 rejected, a symbol key, an
oversized object key, sparse arrays, array custom properties, and shared but
non-cyclic object references.

- [ ] **Step 2: Run RED**

Run:

```powershell
corepack pnpm test -- tests/unit/main/ipc-value-budget.spec.ts
```

Expected: FAIL because `ipc-value-budget.ts` does not exist.

- [ ] **Step 3: Implement bounded, accessor-safe traversal**

Create `src/main/ipc/ipc-value-budget.ts` with:

```ts
export interface IpcValueLimits {
  readonly maxCharacters: number
  readonly maxDepth: number
  readonly maxEntries: number
}

export const DEFAULT_IPC_VALUE_LIMITS: IpcValueLimits = {
  maxCharacters: 65_536,
  maxDepth: 8,
  maxEntries: 256
}

export type IpcValueRejectionReason =
  | 'unsupported_type'
  | 'non_finite_number'
  | 'character_budget_exceeded'
  | 'depth_exceeded'
  | 'entry_budget_exceeded'
  | 'symbol_key'
  | 'accessor'
  | 'non_plain_object'
  | 'cycle'

export type IpcValueValidation =
  { readonly ok: true } | { readonly ok: false; readonly reason: IpcValueRejectionReason }
```

Implement `validateIpcValue()` as a depth-bounded recursive walk:

- maintain `characterCount` and `entryCount`;
- maintain a `WeakSet<object>` containing only the current ancestor chain, so
  repeated non-cyclic references remain valid;
- read object members with `Object.getOwnPropertyDescriptors()`;
- reject any getter/setter before reading `descriptor.value`;
- reject symbol keys and non-index custom array properties;
- accept only arrays and objects whose prototype is `Object.prototype` or
  `null`;
- remove each object from the ancestor set in `finally`;
- return a rejection immediately when any exact budget is exceeded.

Do not stringify the input and do not invoke user accessors.

- [ ] **Step 4: Run GREEN and focused quality**

Run:

```powershell
corepack pnpm test -- tests/unit/main/ipc-value-budget.spec.ts
corepack pnpm lint
corepack pnpm typecheck
```

Expected: all exit 0.

- [ ] **Step 5: Prepare the budget checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add src/main/ipc/ipc-value-budget.ts tests/unit/main/ipc-value-budget.spec.ts
git commit -m "feat(M0-T04): bound IPC values"
```

---

### Task 4: Register Application Windows and Validate IPC Senders

**Files:**

- Create: `src/main/ipc/authorized-window-registry.ts`
- Create: `src/main/ipc/validate-ipc-sender.ts`
- Create: `tests/unit/main/authorized-window-registry.spec.ts`
- Create: `tests/unit/main/validate-ipc-sender.spec.ts`

**Interfaces:**

- Consumes: application-created window descriptors and invoke sender descriptors
- Produces:

```ts
interface RegisteredWindow<TSender extends object> {
  readonly windowId: number
  readonly webContentsId: number
  readonly sender: TSender
  readonly isWindowDestroyed: () => boolean
}

interface ValidatedIpcContext {
  readonly requestId: string
  readonly windowId: number
  readonly webContentsId: number
  readonly sessionId: null
}
```

- [ ] **Step 1: Write the failing registry test**

Create `tests/unit/main/authorized-window-registry.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { AuthorizedWindowRegistry } from '../../../src/main/ipc/authorized-window-registry'

describe('authorized window registry', () => {
  it('registers, resolves, and removes the exact sender identity', () => {
    const registry = new AuthorizedWindowRegistry<object>()
    const sender = {}
    const remove = registry.register({
      windowId: 7,
      webContentsId: 11,
      sender,
      isWindowDestroyed: () => false
    })

    expect(registry.find(11)).toEqual({
      windowId: 7,
      webContentsId: 11,
      sender,
      isWindowDestroyed: expect.any(Function)
    })

    remove()
    expect(registry.find(11)).toBeUndefined()
  })

  it('rejects duplicate WebContents registration instead of replacing ownership', () => {
    const registry = new AuthorizedWindowRegistry<object>()
    registry.register({
      windowId: 7,
      webContentsId: 11,
      sender: {},
      isWindowDestroyed: () => false
    })

    expect(() =>
      registry.register({
        windowId: 8,
        webContentsId: 11,
        sender: {},
        isWindowDestroyed: () => false
      })
    ).toThrow('WebContents 11 is already registered')
  })
})
```

Add tests proving an old cleanup function cannot delete a later registration
and invalid negative/non-integer IDs are rejected.

- [ ] **Step 2: Write the failing sender matrix**

Create `tests/unit/main/validate-ipc-sender.spec.ts` with a typed harness and
one valid case plus these exact rejection reasons:

```ts
;[
  'missing_sender_frame',
  'sender_destroyed',
  'subframe_sender',
  'window_not_registered',
  'sender_identity_mismatch',
  'window_destroyed'
]
```

For every row, assert:

```ts
expect(result).toEqual({
  ok: false,
  reason,
  error: {
    code: 'IPC_UNAUTHORIZED_SENDER',
    messageKey: 'errors.ipc.unauthorizedSender',
    retryable: false,
    safeDetails: { reason },
    requestId
  }
})
```

The valid case must return `{ requestId, windowId, webContentsId, sessionId:
null }` and no renderer-provided window ID exists in the input.

- [ ] **Step 3: Run RED**

Run:

```powershell
corepack pnpm test -- tests/unit/main/authorized-window-registry.spec.ts tests/unit/main/validate-ipc-sender.spec.ts
```

Expected: FAIL because both main IPC modules are missing.

- [ ] **Step 4: Implement the registry**

Create a generic `AuthorizedWindowRegistry<TSender extends object>` backed by
`Map<number, RegisteredWindow<TSender>>`.

`register()` must:

- require positive integer window/WebContents IDs;
- reject a duplicate WebContents ID;
- return an idempotent cleanup closure;
- delete only if the map still contains the same descriptor object.

`find()` returns the readonly descriptor or `undefined`.

- [ ] **Step 5: Implement sender validation**

Create `src/main/ipc/validate-ipc-sender.ts` with:

```ts
export interface IpcSenderEvent<TSender extends object, TFrame extends object> {
  readonly sender: TSender
  readonly senderId: number
  readonly senderFrame: TFrame | null
  readonly mainFrame: TFrame
  readonly isSenderDestroyed: () => boolean
}

export interface ValidatedIpcContext {
  readonly requestId: string
  readonly windowId: number
  readonly webContentsId: number
  readonly sessionId: null
}
```

Return a discriminated `SenderValidation` containing either `context` or both
the centralized AppError and one of the fixed reasons. Validate in the order
listed in the test matrix so the same malformed sender always has one stable
reason.

- [ ] **Step 6: Run GREEN**

Run:

```powershell
corepack pnpm test -- tests/unit/main/authorized-window-registry.spec.ts tests/unit/main/validate-ipc-sender.spec.ts
corepack pnpm typecheck
```

Expected: all exit 0.

- [ ] **Step 7: Prepare the sender checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add src/main/ipc/authorized-window-registry.ts src/main/ipc/validate-ipc-sender.ts tests/unit/main/authorized-window-registry.spec.ts tests/unit/main/validate-ipc-sender.spec.ts
git commit -m "feat(M0-T04): validate IPC window ownership"
```

---

### Task 5: Build the Fixed Router, Safe Logger, and AppInfo Handler

**Files:**

- Create: `src/main/ipc/ipc-error-logger.ts`
- Create: `src/main/ipc/create-ipc-router.ts`
- Create: `src/main/ipc/create-app-info.ts`
- Create: `src/main/ipc/register-app-info-ipc.ts`
- Create: `tests/unit/main/ipc-router.spec.ts`

**Interfaces:**

- Consumes: approved shared route schemas, authorized sender registry, UUID source, app info provider, and log sink
- Produces:

```ts
interface IpcRouter<TSender extends object, TFrame extends object> {
  dispatch(
    channel: string,
    event: IpcSenderEvent<TSender, TFrame>,
    input: unknown
  ): Promise<unknown>
}

interface AppInfoProvider {
  readonly getName: () => string
  readonly getVersion: () => string
  readonly platform: 'win32' | 'darwin' | 'linux'
}
```

- [ ] **Step 1: Write the failing router success and rejection tests**

Create a typed harness in `tests/unit/main/ipc-router.spec.ts` with:

- fixed generated request IDs;
- one registered sender/main frame;
- a memory `IpcErrorLogSink`;
- a route whose request/response schemas are the real `app.getInfo` schemas.

First test:

```ts
const result = await harness.router.dispatch(APP_GET_INFO_CHANNEL, harness.validEvent, {
  contractVersion: 1,
  requestId,
  payload: {}
})

expect(result).toEqual({
  ok: true,
  value: {
    contractVersion: 1,
    name: 'Lattice',
    version: '0.0.0',
    platform: 'win32'
  }
})
expect(harness.calls).toEqual(['handler:7:11:null'])
expect(harness.logs).toEqual([])
```

Add exact error-result tests for:

- unknown channel → `IPC_INVALID_REQUEST`, reason `unknown_channel`;
- wrong contract version → `APP_VERSION_MISMATCH`, reason
  `contract_version_mismatch`;
- invalid schema → `IPC_INVALID_REQUEST`, reason `schema_invalid`;
- input budget rejection → `IPC_INVALID_REQUEST` with the budget reason;
- each sender rejection → `IPC_UNAUTHORIZED_SENDER`;
- missing/invalid request ID → generated diagnostic UUID;
- handler throws Error/string/polluted object → `INTERNAL_UNEXPECTED`;
- handler returns response-schema mismatch → `INTERNAL_UNEXPECTED`, reason
  `response_schema_invalid`;
- handler returns every non-serializable case from Task 3 →
  `INTERNAL_UNEXPECTED`, reason equal to the value rejection;
- logger receives one fixed safe event and no raw input/exception text.

In the same file, add focused tests that:

- `createAppInfo()` reads the injected name/version/platform exactly once and
  returns the validated version 1 value;
- invalid provider output throws before a malformed AppInfo can become a route
  success;
- `registerAppInfoIpc()` registers exactly `APP_GET_INFO_CHANNEL`, forwards the
  event/input to the router once, and its idempotent cleanup removes exactly
  that handler;
- `createConsoleIpcErrorLogSink()` sends warning events only to the injected
  `warn` function and error events only to the injected `error` function,
  always with label `lattice.ipc` and the same already-safe event object.

- [ ] **Step 2: Write the failing stack-redaction test**

Test `createSafeStack()` with:

```ts
const error = new Error('document body must never be logged')
error.stack = [
  'Error: document body must never be logged',
  '    at dispatch (D:\\private\\客户\\ipc-router.ts:42:7)',
  '    at saveDocument (D:\\private\\客户\\draft.md:9:3)',
  '    at node:internal/process/task_queues:105:5',
  'unparseable document body'
].join('\n')

expect(createSafeStack(error)).toEqual([
  'dispatch (ipc-router.ts:42:7)',
  'processTicksAndRejections (task_queues:105:5)'
])
```

Also prove a maximum of 8 frames, 256 characters per frame, no drive prefix,
no directory separator, no error message, and `undefined` for non-Error values.

- [ ] **Step 3: Run RED**

Run:

```powershell
corepack pnpm test -- tests/unit/main/ipc-router.spec.ts
```

Expected: FAIL because the router/logger/handler modules do not exist.

- [ ] **Step 4: Implement the fixed safe log surface**

Create `src/main/ipc/ipc-error-logger.ts` with:

```ts
import type { ApprovedIpcChannel } from '../../shared/contracts'
import type { ErrorCode, IpcSafeReason } from '../../shared/errors'

export interface IpcErrorLogEvent {
  readonly level: 'warning' | 'error'
  readonly code: ErrorCode
  readonly requestId: string
  readonly channel: ApprovedIpcChannel | 'unknown'
  readonly reason: IpcSafeReason
  readonly windowId?: number
  readonly webContentsId?: number
  readonly safeStack?: readonly string[]
}

export interface IpcErrorLogSink {
  readonly write: (event: IpcErrorLogEvent) => void
}
```

`createSafeStack()` discards the first line and unparseable lines, parses only
stack frames, retains basenames only for `.js/.cjs/.mjs/.ts/.tsx` application
code, discards frames with all other extensions, uses the stable name
`processTicksAndRejections` for `node:internal/process/task_queues`, and applies
the exact frame/count limits.

`createConsoleIpcErrorLogSink()` accepts a narrow injected adapter:

```ts
interface IpcConsoleAdapter {
  readonly warn: (label: 'lattice.ipc', event: IpcErrorLogEvent) => void
  readonly error: (label: 'lattice.ipc', event: IpcErrorLogEvent) => void
}
```

It calls only the matching injected method with label `'lattice.ipc'` and the
already-safe event object. Production passes bound wrappers around
`console.warn`/`console.error`; tests use memory functions without replacing a
global.

- [ ] **Step 5: Implement typed route erasure**

In `create-ipc-router.ts`, define:

```ts
export interface IpcRoute<TRequest, TValue> {
  readonly channel: ApprovedIpcChannel
  readonly requestSchema: z.ZodType<TRequest>
  readonly responseSchema: z.ZodType<Result<TValue>>
  readonly handle: (request: TRequest, context: ValidatedIpcContext) => Promise<Result<TValue>>
}
```

Provide `defineIpcRoute()` that closes over the generic schema and handler,
exposing a non-generic internal `execute(input, context)` method. It must use
`safeParse()` and never assert `unknown` into a request type.

- [ ] **Step 6: Implement router dispatch in the required order**

`createIpcRouter()` must:

1. extract a UUID only from an own data property without invoking accessors;
2. generate a diagnostic UUID when extraction fails;
3. validate sender/window ownership;
4. validate the raw input budget;
5. find the fixed route, rejecting unknown channel;
6. distinguish contract version mismatch from other schema failure;
7. execute the route inside one `try/catch`;
8. validate the route response schema;
9. validate response serializability/budget;
10. log and return a stable error for every failure.

Every error returned from dispatch must pass `appErrorSchema` and carry the
same effective request ID used in its log event.

- [ ] **Step 7: Implement AppInfo and Electron registration adapters**

Create `create-app-info.ts`:

```ts
export interface AppInfoProvider {
  readonly getName: () => string
  readonly getVersion: () => string
  readonly platform: 'win32' | 'darwin' | 'linux'
}

export function createAppInfo(provider: AppInfoProvider): AppInfo {
  return appInfoSchema.parse({
    contractVersion: IPC_CONTRACT_VERSION,
    name: provider.getName(),
    version: provider.getVersion(),
    platform: provider.platform
  })
}
```

Create `register-app-info-ipc.ts` with an adapter interface:

```ts
export interface IpcMainHandleAdapter<TEvent> {
  readonly handle: (
    channel: ApprovedIpcChannel,
    listener: (event: TEvent, input: unknown) => Promise<unknown>
  ) => void
  readonly removeHandler: (channel: ApprovedIpcChannel) => void
}
```

Register only `APP_GET_INFO_CHANNEL`; return a cleanup function that removes
only that handler.

- [ ] **Step 8: Run GREEN and regression**

Run:

```powershell
corepack pnpm test -- tests/unit/main/ipc-router.spec.ts
corepack pnpm test -- tests/unit/shared/contracts.spec.ts tests/unit/main/ipc-value-budget.spec.ts tests/unit/main/authorized-window-registry.spec.ts tests/unit/main/validate-ipc-sender.spec.ts tests/unit/main/ipc-router.spec.ts
corepack pnpm lint
corepack pnpm typecheck
```

Expected: all exit 0.

- [ ] **Step 9: Prepare the router checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add src/main/ipc tests/unit/main
git commit -m "feat(M0-T04): validate fixed IPC routes"
```

---

### Task 6: Expose Only the Typed Preload App API

**Files:**

- Create: `src/preload/api/create-app-api.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/lattice-api.d.ts`
- Create: `tests/unit/preload/app-api.spec.ts`

**Interfaces:**

- Consumes: fixed approved channel, request/response schemas, UUID source, and a narrow invoke adapter
- Produces: frozen `window.lattice.app.getInfo()`

- [ ] **Step 1: Write the failing preload API test**

Create `tests/unit/preload/app-api.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { createAppApi } from '../../../src/preload/api/create-app-api'
import { APP_GET_INFO_CHANNEL } from '../../../src/shared/contracts'

const requestId = '00000000-0000-4000-8000-000000000001'

describe('TC-M0-005 preload app API', () => {
  it('generates an ID and invokes only the fixed getInfo channel', async () => {
    const calls: unknown[] = []
    const app = createAppApi({
      createRequestId: () => requestId,
      invoke: async (channel, request) => {
        calls.push({ channel, request })
        return {
          ok: true,
          value: {
            contractVersion: 1,
            name: 'Lattice',
            version: '0.0.0',
            platform: 'win32'
          }
        }
      }
    })

    await expect(app.getInfo()).resolves.toEqual({
      ok: true,
      value: {
        contractVersion: 1,
        name: 'Lattice',
        version: '0.0.0',
        platform: 'win32'
      }
    })
    expect(calls).toEqual([
      {
        channel: APP_GET_INFO_CHANNEL,
        request: { contractVersion: 1, requestId, payload: {} }
      }
    ])
    expect(Object.keys(app)).toEqual(['getInfo'])
  })

  it('converts an invalid main response without exposing it', async () => {
    const app = createAppApi({
      createRequestId: () => requestId,
      invoke: async () => ({
        secretPath: 'D:\\private\\draft.md',
        document: 'body'
      })
    })

    await expect(app.getInfo()).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_UNEXPECTED',
        messageKey: 'errors.internal.unexpected',
        retryable: false,
        safeDetails: { reason: 'response_schema_invalid' },
        requestId
      }
    })
  })
})
```

Add tests proving each call gets a fresh ID, an invalid local ID returns a
stable local failure without invoking main, invoke rejection becomes
`INTERNAL_UNEXPECTED`, and the API contains no `invoke`/`send` property.

- [ ] **Step 2: Run RED**

Run:

```powershell
corepack pnpm test -- tests/unit/preload/app-api.spec.ts
```

Expected: FAIL because `create-app-api.ts` does not exist.

- [ ] **Step 3: Implement the testable preload app factory**

Create:

```ts
export interface AppApiDependencies {
  readonly createRequestId: () => string
  readonly invoke: (channel: ApprovedIpcChannel, request: unknown) => Promise<unknown>
}

export function createAppApi(dependencies: AppApiDependencies): LatticeDesktopApi['app']
```

`getInfo()` must:

- generate and validate request ID locally;
- construct the exact version 1 empty request;
- invoke only `APP_GET_INFO_CHANNEL`;
- catch invoke rejection;
- validate the response with `appGetInfoResultSchema`;
- return a local `INTERNAL_UNEXPECTED` with safe reason on any local boundary
  failure.

- [ ] **Step 4: Expose the frozen production surface**

Replace `src/preload/index.ts` with:

```ts
import { contextBridge, ipcRenderer } from 'electron'

import { createAppApi } from './api/create-app-api'
import type { ApprovedIpcChannel, LatticeDesktopApi } from '../shared/contracts'

const app = Object.freeze(
  createAppApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (channel: ApprovedIpcChannel, request: unknown): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    }
  })
)

const api: LatticeDesktopApi = Object.freeze({ app })
contextBridge.exposeInMainWorld('lattice', api)
```

Create `src/renderer/src/lattice-api.d.ts`:

```ts
import type { LatticeDesktopApi } from '../../shared/contracts'

declare global {
  interface Window {
    readonly lattice: LatticeDesktopApi
  }
}

export {}
```

Do not call the API from React in M0-T04.

- [ ] **Step 5: Run GREEN and build**

Run:

```powershell
corepack pnpm test -- tests/unit/preload/app-api.spec.ts
corepack pnpm typecheck
corepack pnpm build
```

Expected: all exit 0; preload output is non-empty and contains only the intended
bridge construction.

- [ ] **Step 6: Prepare the preload checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add src/preload src/renderer/src/lattice-api.d.ts tests/unit/preload/app-api.spec.ts
git commit -m "feat(M0-T04): expose typed app info preload"
```

---

### Task 7: Compose the Main Router and Prove the Real Electron Boundary

**Files:**

- Modify: `src/main/index.ts`
- Modify: `tests/security/electron-boundary.spec.ts`

**Interfaces:**

- Consumes: real Electron `ipcMain`, app metadata, BrowserWindow/WebContents identity, router, and registry
- Produces: one real approved invoke path with unchanged sandbox/Node isolation

- [ ] **Step 1: Update the real Electron test first**

In `tests/security/electron-boundary.spec.ts`, retain all existing M0-T03
preferences and hostile payload assertions. Replace only the old
`lattice: 'undefined'` expectation with reflective checks:

```ts
const preloadSurface = await page.evaluate(async () => {
  const lattice: unknown = Reflect.get(globalThis, 'lattice')
  if (typeof lattice !== 'object' || lattice === null) {
    throw new Error('Expected the approved lattice preload surface')
  }
  const app: unknown = Reflect.get(lattice, 'app')
  if (typeof app !== 'object' || app === null) {
    throw new Error('Expected the approved app preload surface')
  }
  const getInfo: unknown = Reflect.get(app, 'getInfo')
  if (typeof getInfo !== 'function') {
    throw new Error('Expected app.getInfo')
  }
  const result: unknown = await Reflect.apply(getInfo, app, [])
  return {
    latticeKeys: Object.keys(lattice),
    appKeys: Object.keys(app),
    result
  }
})

expect(preloadSurface).toEqual({
  latticeKeys: ['app'],
  appKeys: ['getInfo'],
  result: {
    ok: true,
    value: {
      contractVersion: 1,
      name: 'Lattice',
      version: '0.0.0',
      platform: 'win32'
    }
  }
})
```

Keep `ipcRenderer`, `electron`, `require`, `process`, `fs`, and `shell`
`undefined`. Add exact absence checks for `lattice.invoke`, `lattice.send`,
`lattice.files`, `lattice.exports`, and `lattice.app.openExternal`.

- [ ] **Step 2: Run RED against the current empty preload**

Run:

```powershell
corepack pnpm test:security -- tests/security/electron-boundary.spec.ts
```

Expected: FAIL because the real main process has not registered
`APP_GET_INFO_CHANNEL` and the old main composition does not authorize its
window.

- [ ] **Step 3: Compose the production router before creating a window**

In `src/main/index.ts`:

1. create `AuthorizedWindowRegistry<WebContents>`;
2. create the app-info route with `app.getName()`, `app.getVersion()`, and an
   explicit narrowing of `process.platform` to `win32 | darwin | linux`;
3. create the router with `randomUUID`, the registry, and the console safe-log
   sink;
4. register only `APP_GET_INFO_CHANNEL` on `ipcMain` before
   `composeApplication()`;
5. adapt each Electron invoke event into the pure sender event shape;
6. wrap `createMainWindow()` so its returned BrowserWindow is synchronously
   registered;
7. attach idempotent cleanup to both `window.closed` and
   `window.webContents.destroyed`.

If `process.platform` is outside the declared AppInfo platform set, the app
info provider must throw and the router must return `INTERNAL_UNEXPECTED`;
never assert the platform type.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
corepack pnpm test:security -- tests/security/electron-boundary.spec.ts
```

Expected: 1/1 PASS; no browser/mail client is launched; Electron exits cleanly.

- [ ] **Step 5: Run focused unit and production regression**

Run:

```powershell
corepack pnpm test -- tests/unit/shared/contracts.spec.ts tests/unit/main/ipc-value-budget.spec.ts tests/unit/main/authorized-window-registry.spec.ts tests/unit/main/validate-ipc-sender.spec.ts tests/unit/main/ipc-router.spec.ts tests/unit/preload/app-api.spec.ts
corepack pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts
corepack pnpm test:security -- tests/security/electron-boundary.spec.ts
corepack pnpm build
```

Expected: all exit 0; M0-T03 navigation/security invariants remain green; no
residual Electron, Node test worker, browser, or mail process.

- [ ] **Step 6: Prepare the real-boundary checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add src/main/index.ts tests/security/electron-boundary.spec.ts
git commit -m "feat(M0-T04): compose validated Electron IPC"
```

---

### Task 8: Synchronize Contracts, Evidence, Review, and Task State

**Files:**

- Modify: `docs/03-architecture.md`
- Modify: `docs/05-data-safety-and-security.md`
- Modify: `docs/09-test-strategy.md`
- Modify: `docs/15-public-contracts.md`
- Modify: `docs/16-project-structure-and-standards.md`
- Modify: `docs/18-error-catalog.md`
- Modify: `docs/test-cases/M0-foundation.md`
- Create: `docs/evidence/M0-T04-shared-contracts-2026-07-26.md`
- Modify: `tasks/state.json`

**Interfaces:**

- Consumes: completed M0-T04 implementation and fresh command output
- Produces: auditable M0-T04 `passed`, only M0-T05 `ready`, and no overclaim for M0-T06

- [ ] **Step 1: Update architecture and public contracts**

In `docs/03-architecture.md`, add M0-T04 ownership:

```markdown
renderer `window.lattice.app.getInfo`
→ frozen preload method
→ fixed internal channel
→ request ID + sender/window registry
→ input budget + Zod request
→ injected AppInfo handler
→ Zod Result + serializability
→ validated preload response
```

State that window/session context is main-derived and M0-T04 session ID is
`null`.

In `docs/15-public-contracts.md`, make the implemented types exactly match
`Result<T, E>`, `AppError`, AppInfo, contract version 1, and the one-method
current preload surface. Keep future API sections clearly marked as target
contracts owned by later tasks, not current callable methods.

- [ ] **Step 2: Update security, testing, structure, and errors**

Record exact:

- sender rejection conditions;
- 65,536/8/256 budgets;
- JSON-like output allowlist;
- safe log fields and redacted stack rule;
- TC-M0-005 unit versus real-Electron evidence;
- current executable directory/file ownership;
- four active error codes, message keys, request ID behavior, and
  non-retryability.

Update TC-M0-003 wording so M0-T03 owns Node/sandbox denial while M0-T04 owns
the approved preload snapshot. Do not erase historical M0-T03 evidence that
the surface was empty at that task's completion.

- [ ] **Step 3: Run the full completion gate with bounded process handling**

Run and record timestamp, duration, exit code, and test counts:

```powershell
corepack pnpm --version
corepack pnpm install --frozen-lockfile --offline
corepack pnpm ignored-builds
corepack pnpm check
corepack pnpm test:security -- tests/security/electron-boundary.spec.ts
corepack pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts
node scripts/verify-planning-docs.mjs
git diff --check
git status --short
```

`pnpm check` may legitimately exceed a 60-second tool window because the
quality meta-tests create isolated project copies. If needed, launch it once
with a hidden finite process, log/exit files, poll at bounded intervals, and
kill its entire process tree at the agreed maximum. Never launch a duplicate
while the first run is active.

Expected: pnpm 11.12.0; install/check/security/E2E/planning/diff all exit 0;
unit count is at least the 105-test M0-T03 baseline plus all M0-T04 cases;
integration remains 18/18; build succeeds; only M0-T04 files are changed.

- [ ] **Step 4: Record evidence**

Create `docs/evidence/M0-T04-shared-contracts-2026-07-26.md` with actual values:

```markdown
# M0-T04 Shared Contracts and Errors Evidence

## Environment and dependency admission

## Shared schema and stable error matrix

## Sender and window ownership matrix

## Input budget and serializability matrix

## Preload surface snapshot

## Redacted logging proof

## Commands, durations, exits, and test counts

## Process cleanup

## Review findings and dispositions

## Residual risks and ownership
```

Residual ownership must state:

- M0-T05 owns Command Registry and window skeleton consumption.
- M0-T06 owns CI, dependency/permission audit, SBOM, packaged artifact checks,
  GitHub rules, and the M0 manual gate.
- Future capability tasks own file/workspace/settings/import/export methods.
- M0-T04 manual gate is not applicable.

- [ ] **Step 5: Request and process code review**

Use `superpowers:requesting-code-review` on:

- approved design;
- this implementation plan;
- all changed source/tests/docs;
- fresh completion output.

For every actionable finding, use `superpowers:receiving-code-review`: reproduce
it, add or strengthen a failing test, fix the root cause, and rerun the focused
and full gates. Reject speculative M0-T05/M0-T06 implementation.

- [ ] **Step 6: Mark M0-T04 passed and unlock only M0-T05**

After review and all gates are green, set:

```json
"current_task": null
```

For M0-T04, retain its ID, dependency, and `manual_gate:false`; set status to
`passed` and add exactly three evidence records:

1. `kind:"command"` summarizes the observed pnpm version plus the fresh
   install/check/security/E2E exit codes and test counts.
2. `kind:"test"` summarizes the observed TC-M0-005 schema, sender,
   serialization, logging, and preload proof.
3. `kind:"report"` summarizes the completed review and names M0-T05/M0-T06
   residual ownership.

All three records use path
`docs/evidence/M0-T04-shared-contracts-2026-07-26.md` and the same real UTC ISO
timestamp captured immediately before the state edit:

```powershell
Get-Date -AsUTC -Format o
```

Copy only values present in the fresh logs; if a command, count, review result,
or timestamp is unavailable, do not mark the task passed.

Set only M0-T05 to `ready`; keep M0-T06 and later tasks blocked.

- [ ] **Step 7: Re-run completion verification after state/evidence changes**

Run:

```powershell
node scripts/verify-planning-docs.mjs
corepack pnpm check
corepack pnpm test:security -- tests/security/electron-boundary.spec.ts
git diff --check
git status --short
```

Expected: all exit 0; M0-T04 is passed; only M0-T05 is ready; no residual
processes.

- [ ] **Step 8: Prepare the completion checkpoint**

Do not commit without explicit authorization. If authorized:

```powershell
git add docs tasks src tests package.json pnpm-lock.yaml
git commit -m "feat(M0-T04): complete shared IPC contracts"
```

Before any integration, push, or PR, use
`superpowers:finishing-a-development-branch` and follow the user's selected Git
workflow. Report changed files, every command and result, residual ownership,
the absence of a manual M0-T04 gate, and exact next task M0-T05.
