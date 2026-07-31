# M0-T04 Shared Contracts and Errors Design

日期：2026-07-26

状态：用户已于 2026-07-26 批准

范围：只实现 M0-T04。M0-T05 的 Command Registry/窗口骨架与 M0-T06 的
CI、依赖审计、SBOM、GitHub 门禁仍按任务图顺序在后续独立任务完成。

## 1. 背景

M0-T03 已建立全局 Electron sandbox、主窗口安全偏好、CSP、权限拒绝、
导航/新窗口/webview 拒绝和受控外链策略。renderer 当前没有 Node、Electron、
裸 `ipcRenderer` 或任何 preload API。

M0-T04 创建第一条受控的跨进程能力，并建立后续 IPC 能力必须复用的契约、
错误、sender 校验、结果校验、序列化和日志边界。该任务不得借机实现文件、
导出、设置、工作区或通用命令执行。

关联需求：

- NFR-008：边界依赖可替换测试实现。
- NFR-009：结构化日志不记录文档内容、完整路径或剪贴板正文。
- TC-M0-005：有效值、缺字段、未知字段、超限、错误 sender、未知 channel
  和不可序列化结果必须得到稳定、可审计的拒绝结果。

## 2. 目标与完成定义

### 2.1 目标

1. 在 `src/shared/contracts/` 建立由 Zod schema 推导 TypeScript 类型的契约。
2. 建立 `Result<T, AppError>`、稳定错误码、message key、retry 语义和 request ID。
3. 建立应用自有窗口登记和 sender/主 frame/窗口归属校验。
4. 建立固定频道路由、输入预算、输出 schema 和 IPC 可序列化性检查。
5. 建立只接收固定安全字段的脱敏日志接口。
6. 通过 `window.lattice.app.getInfo()` 证明真实 main/preload/renderer 链路。

### 2.2 完成定义

- renderer 只能看到 `window.lattice.app.getInfo`，没有通用 `invoke`、`send`、
  Electron 对象或未来能力占位。
- 每次调用都有 UUID request ID；非法或缺失 ID 使用 main 生成的诊断 ID。
- 未登记窗口、错误 WebContents、子 frame、已销毁 sender 和空 sender frame
  均在执行 handler 前拒绝。
- 请求和响应都经严格 Zod schema；未知字段、版本不匹配和超限输入被拒绝。
- handler 抛错、schema 不符和不可序列化输出均转换为带 request ID 的
  `INTERNAL_UNEXPECTED`，不会把未知异常跨进程传递。
- TC-M0-005、适用 Electron 安全测试、`pnpm check` 和规划文档验证全部通过。
- 证据完整后 M0-T04 设为 `passed`，只解锁 M0-T05。

## 3. 方案选择

### 3.1 采用：固定频道的类型化路由

每项能力具有：

- 一个内部频道常量；
- 一个严格请求 schema；
- 一个严格响应 schema；
- 一个独立 handler；
- 一个 preload 的命名方法。

main 路由共享 sender 校验、request ID、预算、错误转换、日志和序列化机制，
但不暴露通用 dispatcher 给 renderer。

该方案的安全表面最小，未知频道没有 renderer 调用入口，也能让后续任务按能力
逐项增加契约。

### 3.2 不采用：单一通用 dispatcher

`invoke(channel, payload)` 即使有 allowlist，也会形成公共通用调用入口，违反
`docs/15-public-contracts.md` 对 preload API 的禁止规则，并扩大审计范围。

### 3.3 不采用：一次性 `getInfo` handler

一次性 handler 初期文件较少，但会让 sender 校验、错误转换、预算和结果校验
在后续能力中重复，不能交付 M0-T04 要求的框架。

## 4. 公共 API 与契约

### 4.1 Preload 表面

首个且唯一的方法为：

```ts
interface LatticeDesktopApi {
  readonly app: {
    readonly getInfo: () => Promise<Result<AppInfo, AppError>>
  }
}
```

preload 使用 `contextBridge.exposeInMainWorld('lattice', api)` 暴露冻结对象。
renderer 不传频道、request ID、窗口 ID 或 Electron 对象。

### 4.2 AppInfo

```ts
interface AppInfo {
  readonly contractVersion: 1
  readonly name: string
  readonly version: string
  readonly platform: 'win32' | 'darwin' | 'linux'
}
```

- `contractVersion` 固定为整数 `1`。
- `name` 和 `version` 是 1–64 个可打印字符，不允许控制字符。
- `platform` 来自主进程受信任运行环境。
- 不返回安装路径、用户目录、命令行、设备信息或调试状态。

### 4.3 请求信封

preload 内部发送：

```ts
interface IpcRequestEnvelope<TPayload> {
  readonly contractVersion: 1
  readonly requestId: string
  readonly payload: TPayload
}
```

`getInfo` 的 payload 是严格空对象。信封和 payload 都使用 `.strict()`，未知字段
直接拒绝。request ID 必须是标准 UUID 字符串。

窗口身份不由 renderer 声明。主进程从 Electron invoke event 和应用自有窗口
登记表生成：

```ts
interface ValidatedIpcContext {
  readonly requestId: string
  readonly windowId: number
  readonly webContentsId: number
  readonly sessionId: null
}
```

M0-T04 尚无文档会话，因此 `sessionId` 明确为 `null`。后续会话能力只能在对应
任务中把已授权会话加入主进程派生上下文，不能接受 renderer 自报授权。

### 4.4 内部频道

只注册：

```ts
const APP_GET_INFO_CHANNEL = 'lattice:app:get-info'
```

频道是 main/preload 内部映射，不属于 renderer 公共 API。固定路由表对未知频道
返回 `IPC_INVALID_REQUEST`；生产 preload 没有调用未知频道的入口。

## 5. 数据流

一次调用按以下固定顺序执行：

1. preload 使用 Web Crypto `crypto.randomUUID()` 生成 request ID。
2. preload 构造版本 1 信封并调用固定 `APP_GET_INFO_CHANNEL`。
3. main 从输入中安全提取合法 request ID；缺失或非法时用注入的 UUID 生成器
   创建诊断 ID。
4. main 在解析业务 payload 前校验 sender：
   - `senderFrame` 存在；
   - sender 未销毁；
   - sender frame 是该 WebContents 的主 frame；
   - WebContents 已由应用自有窗口登记表登记；
   - 登记窗口未销毁且仍拥有同一 WebContents。
5. main 检查输入大小、深度、节点数、键类型和循环引用预算。
6. Zod 严格解析版本、request ID 和空 payload。
7. handler 从注入的应用信息 provider 读取名称、版本和平台。
8. Zod 校验 `Result<AppInfo, AppError>`。
9. 可序列化性检查器验证响应是受限的 JSON-like 数据。
10. main 返回响应；preload 再用同一响应 schema 校验一次后交给 renderer。

preload 发现来自 main 的响应不符合契约时，返回本地构造的
`INTERNAL_UNEXPECTED`，沿用该次 request ID，不把原始响应暴露给 renderer。

## 6. 组件与文件职责

### 6.1 Shared

| 文件                                          | 职责                                        |
| --------------------------------------------- | ------------------------------------------- |
| `src/shared/contracts/contract-version.ts`    | 唯一契约版本常量与 schema                   |
| `src/shared/contracts/ipc-request.ts`         | request ID、信封和空 payload schema         |
| `src/shared/contracts/app-info.ts`            | `AppInfo` 与 `app.getInfo` 请求/响应 schema |
| `src/shared/contracts/channels.ts`            | 内部频道常量与批准频道 schema               |
| `src/shared/contracts/lattice-desktop-api.ts` | renderer 可见 preload API 类型              |
| `src/shared/contracts/index.ts`               | 明确导出公共契约                            |
| `src/shared/errors/error-code.ts`             | 当前可执行稳定错误码与 schema               |
| `src/shared/errors/app-error.ts`              | `AppError` schema/type 和安全 details       |
| `src/shared/errors/result.ts`                 | `Result<T, E>` 类型与 schema 工厂           |
| `src/shared/errors/index.ts`                  | 明确导出错误契约                            |

`src/shared/index.ts` 只重新导出上述稳定入口，不导出内部 Electron 适配器。

### 6.2 Main

| 文件                                         | 职责                                       |
| -------------------------------------------- | ------------------------------------------ |
| `src/main/ipc/authorized-window-registry.ts` | 登记应用创建的窗口/WebContents，销毁时清理 |
| `src/main/ipc/validate-ipc-sender.ts`        | 将 Electron sender 转换为可信请求上下文    |
| `src/main/ipc/ipc-value-budget.ts`           | 在 Zod 前检查输入预算，并验证输出可序列化  |
| `src/main/ipc/ipc-error-logger.ts`           | 固定安全字段日志接口和 console 初始适配器  |
| `src/main/ipc/create-ipc-router.ts`          | 固定频道分发、错误转换、response 校验      |
| `src/main/ipc/register-app-info-ipc.ts`      | 注册唯一 `app.getInfo` handler             |
| `src/main/ipc/create-app-info.ts`            | 从注入 provider 生成受控 AppInfo           |

`src/main/index.ts` 在创建产品窗口前注册 IPC handler，并在每次
`createMainWindow()` 返回后把窗口加入登记表。登记动作发生在 `loadFile/loadURL`
开始后也不会产生竞态，因为 handler 已预先注册，且窗口在 renderer 可执行前
同步加入登记表。

### 6.3 Preload 与 renderer 类型

| 文件                                | 职责                           |
| ----------------------------------- | ------------------------------ |
| `src/preload/api/create-app-api.ts` | 构造固定 `app.getInfo()` 方法  |
| `src/preload/index.ts`              | 暴露冻结的 `window.lattice`    |
| `src/renderer/src/lattice-api.d.ts` | 声明只读 `Window.lattice` 类型 |

renderer UI 在 M0-T04 不调用或展示该信息；真实链路由测试直接调用。M0-T05
决定是否在“关于”命令中消费它。

## 7. 错误模型

```ts
interface AppError {
  readonly code: ErrorCode
  readonly messageKey: string
  readonly retryable: boolean
  readonly safeDetails?: {
    readonly reason?: IpcSafeReason
    readonly expectedVersion?: 1
    readonly receivedVersion?: number
  }
  readonly requestId?: string
}

type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }
```

M0-T04 的 `safeDetails` 使用严格对象，只接受上列三个键；`reason` 是集中枚举，
版本号是有限整数。绝对路径、正文、异常 message 和任意字符串键不能通过
AppError schema。未来错误若需要新的安全字段，必须由对应任务扩展 schema、
文档和脱敏测试。

M0-T04 当前启用：

| Code                      | 用途                                   | retryable |
| ------------------------- | -------------------------------------- | --------- |
| `IPC_INVALID_REQUEST`     | schema、request ID、未知频道、预算错误 | `false`   |
| `IPC_UNAUTHORIZED_SENDER` | sender、frame 或窗口归属错误           | `false`   |
| `APP_VERSION_MISMATCH`    | contract version 不匹配                | `false`   |
| `INTERNAL_UNEXPECTED`     | handler 抛错、响应 schema 或序列化失败 | `false`   |

message key 固定为：

- `errors.ipc.invalidRequest`
- `errors.ipc.unauthorizedSender`
- `errors.app.versionMismatch`
- `errors.internal.unexpected`

未来任务在实现对应行为时扩展 `ErrorCode`；M0-T04 不创建尚无 handler 的文件、
工作区、导出或恢复错误路径。

### 7.1 转换规则

- sender 错误优先于业务参数解析，避免未授权调用触发 handler。
- 可安全识别的错误 contract version 返回 `APP_VERSION_MISMATCH`。
- 其他输入错误与未知频道返回 `IPC_INVALID_REQUEST`。
- AppError schema 拒绝 code 与 message key 不匹配的组合。
- 未知异常不把 `Error.message`、stack、对象属性或输入值放进 `AppError`。
- 错误结果始终携带有效 request ID。
- 对话框取消规则不适用于 `getInfo`；该方法没有取消分支。

## 8. 输入预算与序列化

M0-T04 采用保守、确定的跨进程预算：

- 最大 UTF-16 字符预算：65,536；
- 最大对象/数组深度：8；
- 最大对象键与数组元素总数：256；
- 只接受字符串键；
- 拒绝 accessor、symbol key、循环引用和非普通对象。

响应只允许：

- `null`；
- string；
- boolean；
- finite number；
- 上述值组成的 array；
- prototype 为 `Object.prototype` 或 `null` 的普通 record。

明确拒绝 `undefined`、`bigint`、symbol、function、NaN、Infinity、Date、Map、
Set、Error、Promise、typed array、循环引用、accessor 和 class instance。

预算遍历使用显式待处理队列和节点计数，不创建计时循环，不使用永久
`setInterval`，不会引入无限循环测试。

## 9. Sender 与窗口归属

登记表只接受由产品 `createMainWindow()` 返回的 BrowserWindow。保存最小身份：

- window ID；
- WebContents ID；
- 对窗口/WebContents 的对象引用；
- 销毁清理函数。

校验器不接受 renderer 提供的 window ID。下列情况全部拒绝：

- `senderFrame === null`；
- sender 已销毁；
- sender frame 不是主 frame；
- WebContents ID 未登记；
- 登记对象与事件 sender 不是同一对象；
- 窗口已销毁；
- 窗口当前 WebContents 与登记不一致。

M0-T03 已阻止主窗口导航、新窗口和 webview；M0-T04 的 sender 校验仍独立执行，
形成纵深防御。

## 10. 脱敏日志接口

路由只向 `IpcErrorLogSink` 发送：

```ts
interface IpcErrorLogEvent {
  readonly level: 'warning' | 'error'
  readonly code: ErrorCode
  readonly requestId: string
  readonly channel: ApprovedIpcChannel | 'unknown'
  readonly reason: IpcSafeReason
  readonly windowId?: number
  readonly webContentsId?: number
  readonly safeStack?: readonly string[]
}
```

`reason` 是集中枚举，不接受任意字符串。日志事件不能携带 payload、文档、
Markdown、剪贴板、搜索词、完整路径、sender URL、异常 message 或原始 stack。
未知异常可产生最多 8 条 `safeStack` frame；每条最多 256 个字符，只保留函数名、
允许的应用代码 basename（`.js/.cjs/.mjs/.ts/.tsx`）、行号和列号，或固定名称的
Node internal frame；丢弃异常首行、盘符、目录、其他扩展名与不能可靠解析的 frame。
初始 console 适配器输出一条结构化对象；未来 `electron-log` 持久化适配器只能
消费同一安全接口。

时间来源、UUID 来源、应用信息 provider、日志 sink 和 sender/窗口解析都通过
参数注入，单元测试不依赖真实时钟、随机数或 Electron 全局状态。

## 11. 依赖

新增唯一生产依赖：

| 依赖  | 固定版本 | 用途                                     | 许可证 | 原生二进制 | 安装脚本 | 传递依赖 | 包体影响 |
| ----- | -------- | ---------------------------------------- | ------ | ---------- | -------- | -------- | -------- |
| `zod` | `4.4.3`  | IPC 请求、响应和错误运行时校验及类型推导 | MIT    | 否         | 否       | 0        | 低       |

版本和元数据于 2026-07-26 从 npm 官方包页面与上游 release 核实。安装前先更新
`docs/04-technology-stack.md` 的精确版本台账，然后执行：

```powershell
corepack pnpm add zod@4.4.3 --save-exact
```

只保留 `pnpm-lock.yaml`；不得生成 npm/yarn lockfile，不批准新的安装脚本。

不在 M0-T04 安装 `electron-log`。本任务交付安全日志接口和初始 console
适配器；持久滚动日志适配器在实际日志服务任务中接入，仍必须服从同一脱敏类型。

## 12. 测试设计

所有生产行为按 TDD 的 RED → GREEN → REFACTOR 顺序实现。

### 12.1 TC-M0-005 单元安全契约

`tests/unit/shared/contracts.spec.ts` 参数化覆盖：

- 有效 `getInfo` request/response；
- 缺少 contract version、request ID、payload；
- 错误 contract version；
- 非 UUID、空、超长 request ID；
- payload 未知字段；
- envelope 未知字段；
- 过深、过多节点、超字符预算；
- `__proto__`/`constructor`/prototype pollution 形状；
- success 和四种稳定 error Result；
- AppError 中未知字段、非法 safeDetails 和不安全 message key。

### 12.2 Main IPC 单元测试

`tests/unit/main/ipc-router.spec.ts` 覆盖：

- 有效登记 sender 调用 handler；
- 空 sender frame、子 frame、错误 WebContents、未登记窗口、已销毁 sender/
  窗口；
- 未知频道；
- 缺失或错误 request ID 时生成新的诊断 ID；
- contract version mismatch；
- handler 抛出 string、Error 和污染对象；
- handler 返回 schema 不符值；
- function、bigint、NaN、Infinity、Date、Map、Set、Promise、class instance、
  accessor 和循环引用结果；
- 日志只包含固定字段，敏感 payload/路径/异常文本均不出现；
- 清理登记后旧 sender 不能再次调用。

`tests/unit/preload/app-api.spec.ts` 使用最小 `invoke` adapter 证明：

- 只调用固定频道；
- 每次生成新的 request ID；
- 不接受 renderer 提供 request ID；
- main 响应不合法时返回稳定本地错误；
- 暴露对象没有通用 IPC 方法。

### 12.3 真实 Electron 安全验证

更新 `tests/security/electron-boundary.spec.ts`：

- 保留 `require/process/electron/ipcRenderer/fs/shell` 不可得断言；
- 把 M0-T03 的空 preload 断言更新为 M0-T04 的批准表面快照；
- 精确断言 `window.lattice` 只含 `app`，`app` 只含 `getInfo`；
- 调用真实 `getInfo` 并验证 contract version、应用名、版本、平台和 Result；
- 污染对象/超大 `postMessage` 用例继续证明窗口存活；
- 不增加 test-only IPC、开发 URL或真实系统外部调用。

### 12.4 命令门禁

至少运行：

```powershell
corepack pnpm test -- tests/unit/shared/contracts.spec.ts
corepack pnpm test -- tests/unit/main/ipc-router.spec.ts
corepack pnpm test -- tests/unit/preload/app-api.spec.ts
corepack pnpm test:security -- tests/security/electron-boundary.spec.ts
corepack pnpm check
node scripts/verify-planning-docs.mjs
git diff --check
```

所有命令为有限执行。若命令超出工具调用时限，使用独立日志、退出码文件和明确
进程树清理，不把超时误报为测试失败，也不遗留孤儿进程。

## 13. 文档同步

M0-T04 同步更新：

- `docs/03-architecture.md`：实际 IPC 组件、可信上下文和调用顺序；
- `docs/04-technology-stack.md`：Zod 4.4.3 精确准入；
- `docs/05-data-safety-and-security.md`：sender、预算、结果和日志边界；
- `docs/09-test-strategy.md`：TC-M0-005 分层证据与更新后的 preload 断言；
- `docs/15-public-contracts.md`：可执行 AppInfo、Result 和 preload 表面；
- `docs/16-project-structure-and-standards.md`：实际新增目录职责；
- `docs/18-error-catalog.md`：当前启用错误码、message key 和转换规则；
- `docs/test-cases/M0-foundation.md`：CONTRACT-M0 参数矩阵和实际命令；
- `tasks/M0-foundation.md`：M0-T04 预期文件、非目标、失败回退和完成条件；
- `docs/evidence/M0-T04-shared-contracts-2026-07-26.md`：最终命令与测试证据。

## 14. 失败回退与任务状态

开始实现前把 `tasks/state.json` 中 M0-T04 设为 `in_progress`，保持 M0-T05 及
之后任务 `blocked`。

任何 sender 绕过、裸 IPC 暴露、敏感日志、非 Result 跨进程异常、不可序列化
响应或 renderer 获得 Node/Electron 权限均为阻断问题。任务保持
`in_progress`，增加回归测试并修复根因；不得弱化 schema、删除矩阵行或添加
通用 IPC 逃生口。

全部自动门禁和独立审查通过后：

- M0-T04 设为 `passed`；
- `current_task` 设为 `null`；
- 只把 M0-T05 从 `blocked` 改为 `ready`；
- M0-T06 和所有后续任务保持 `blocked`。

M0-T04 `manual_gate:false`，不需要人工验收。分支集成、提交、推送和 PR 仍遵守
用户明确授权和仓库 Git 规则。
