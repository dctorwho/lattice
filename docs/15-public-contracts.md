# 公共契约

本文件固定跨模块形状。实现可增加内部字段，但改变字段语义、权限或错误行为必须提交 ADR。

## 1. 通用结果

```ts
type ErrorCode =
  'IPC_INVALID_REQUEST' | 'IPC_UNAUTHORIZED_SENDER' | 'APP_VERSION_MISMATCH' | 'INTERNAL_UNEXPECTED'

interface SafeDetails {
  reason?: IpcSafeReason
  expectedVersion?: 1
  receivedVersion?: number // integer, 0..1000
}

interface AppError {
  code: ErrorCode
  messageKey:
    | 'errors.ipc.invalidRequest'
    | 'errors.ipc.unauthorizedSender'
    | 'errors.app.versionMismatch'
    | 'errors.internal.unexpected'
  retryable: boolean
  safeDetails?: SafeDetails
  requestId?: string
}

type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }
```

M0 的四个 active code 与 message key 一一对应，全部
`retryable:false`。main 产生的错误必须携带当前 UUID request ID；preload
拒绝缺失或错配 request ID 的失败 Result。本地 UUID 生成本身失败时尚无可信
request ID，因此该本地 `INTERNAL_UNEXPECTED` 可不带 ID。`safeDetails` 只接受
固定 reason 和受限版本字段，不能加入正文、路径或原始异常。

取消不是异常崩溃；对话框取消返回 `ok:true` 且 value 为 `null`，长任务取消使用稳定 `*_CANCELLED` code。

## 2. 文档变更

```ts
interface SourceRange {
  from: number
  to: number
}
interface SourceChange extends SourceRange {
  insert: string
}

interface SourcePatch {
  documentId: string
  expectedRevision: number
  expectedRangeHash: string
  changes: readonly SourceChange[]
  historyGroup: string
  origin: 'typing' | 'command' | 'block-widget' | 'paste' | 'external-reload'
}

interface ApplyPatchResult {
  revision: number
  changedRanges: readonly SourceRange[]
  selectionHint?: SourceRange
}
```

changes 按旧文档坐标、不重叠并从后向前应用。range/hash/revision 不匹配返回 `DOCUMENT_STALE_PATCH`，禁止自动重试覆盖。

## 3. 文件契约

```ts
interface DiskVersion {
  mtimeMs: number
  size: number
  contentHash?: string
}

interface OpenedFile {
  path: string
  bytesHash: string
  text: string
  encoding: 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be'
  eolByLine: readonly ('\n' | '\r\n')[]
  diskVersion: DiskVersion
  readOnlyReason?: 'unsupported-encoding' | 'permission' | 'policy'
}

interface SaveFileRequest {
  documentId: string
  path: string
  revision: number
  text: string
  encoding: OpenedFile['encoding']
  eolByLine: OpenedFile['eolByLine']
  expectedDiskVersion: DiskVersion | null
}

interface SavedFile {
  path: string
  revision: number
  diskVersion: DiskVersion
  bytesHash: string
}
```

renderer 不提供“忽略冲突”布尔值。覆盖冲突使用单独 `files.confirmedOverwrite()`，携带主进程生成的一次性 conflict token。

## 4. 当前 Preload API（M0 已实现）

```ts
interface AppInfo {
  readonly contractVersion: 1
  readonly name: string // 1..64，无控制字符
  readonly version: string // 1..64，无控制字符
  readonly platform: 'win32' | 'darwin' | 'linux'
}

interface LatticeDesktopApi {
  readonly app: {
    readonly getInfo: () => Promise<Result<AppInfo, AppError>>
  }
  readonly commands: {
    readonly onInvoke: (listener: (id: CommandId) => void) => () => void
    readonly updateStates: (
      states: readonly CommandState[]
    ) => Promise<Result<CommandStateSync, AppError>>
  }
}
```

当前 renderer 公共表面精确为冻结的 `{ app, commands }`。`getInfo()` 发送契约
版本 1、preload 生成的 UUID 和空 payload。`commands.onInvoke()` 只传批准 ID
并返回幂等 unsubscribe；`commands.updateStates()` 发送 preload UUID 和恰好
两个批准状态。频道仅是 main/preload 内部映射。root、`app` 和 `commands`
均不含通用 `invoke`、`send`、`on` 或其他能力。

### 后续迭代目标表面（当前不可调用）

下列接口继续约束未来设计，但不属于 M0 的运行时
`LatticeDesktopApi`。外链/对话框、文件、workspace、recovery、settings、
import 和 export 必须由对应后续迭代逐项授权、实现和测试后才能加入。

```ts
interface TargetLatticeDesktopApi {
  app: {
    getInfo(): Promise<Result<AppInfo, AppError>>
    openExternal(url: string): Promise<Result<void>>
  }
  dialogs: {
    chooseFile(options: ChooseFileOptions): Promise<Result<string | null>>
    chooseFolder(): Promise<Result<string | null>>
    chooseSavePath(options: SavePathOptions): Promise<Result<string | null>>
  }
  files: {
    openAuthorized(path: string): Promise<Result<OpenedFile>>
    save(request: SaveFileRequest): Promise<Result<SavedFile>>
    overwriteWithToken(request: ConfirmedSaveRequest): Promise<Result<SavedFile>>
    statAuthorized(path: string): Promise<Result<DiskVersion>>
    reveal(path: string): Promise<Result<void>>
    moveToTrash(path: string): Promise<Result<void>>
  }
  workspace: {
    open(root: string): Promise<Result<WorkspaceSnapshot>>
    mutate(request: WorkspaceMutation): Promise<Result<WorkspaceSnapshot>>
    search(request: SearchRequest): Promise<Result<SearchHandle>>
    cancelSearch(handle: string): Promise<Result<void>>
    onEvent(listener: (event: WorkspaceEvent) => void): () => void
  }
  recovery: {
    write(snapshot: RecoverySnapshot): Promise<Result<void>>
    list(): Promise<Result<readonly RecoveryRecord[]>>
    remove(documentId: string): Promise<Result<void>>
  }
  settings: {
    load(): Promise<Result<SettingsSnapshot>>
    update(request: SettingsUpdate): Promise<Result<SettingsSnapshot>>
    onChanged(listener: (snapshot: SettingsSnapshot) => void): () => void
  }
  exports: {
    start(request: ExportRequest): Promise<Result<ExportHandle>>
    cancel(handle: string): Promise<Result<void>>
    onProgress(listener: (event: ExportProgress) => void): () => void
  }
  imports: {
    start(request: ImportRequest): Promise<Result<ImportHandle>>
    cancel(handle: string): Promise<Result<void>>
    onProgress(listener: (event: ImportProgress) => void): () => void
    takeResult(handle: string): Promise<Result<ImportedDocument>>
  }
}
```

当前和未来都禁止添加 `invoke(channel,args)`、`send`、`execute`、`readAnyPath` 或 `spawn` 等通用方法。未来事件订阅必须返回 unsubscribe，窗口销毁时主进程释放监听。

## 5. 工作区和搜索

```ts
interface WorkspaceSnapshot {
  id: string
  rootName: string
  entries: readonly WorkspaceEntry[]
  revision: number
}

interface SearchRequest {
  workspaceId: string
  query: string
  mode: 'literal' | 'regex'
  caseSensitive: boolean
  wholeWord: boolean
  includeGlobs: readonly string[]
  excludeGlobs: readonly string[]
  maxResults: number
}
```

前端只持有 workspace ID 与相对 entry ID；绝对根路径仅在需要展示/设置时通过脱敏视图返回。搜索结果携带 workspace-relative path、line/column、match range 和有限 context。

## 6. Command ID

命名为 `<domain>.<verb>`，一旦发布保持稳定：

M0 当前已实现：

```ts
type CommandId = 'app.about' | 'view.toggleSidebar'

interface CommandState {
  readonly id: CommandId
  readonly isVisible: boolean
  readonly isEnabled: boolean
  readonly isChecked: boolean
}

interface CommandStateSync {
  readonly contractVersion: 1
  readonly applied: true
}
```

state-sync 数组必须恰好包含每个批准 ID 一次。`app.about` 使用 F1；
`view.toggleSidebar` 使用 `CommandOrControl+Shift+L`。未知、不可见或禁用命令
不调用 handler；命令 handler 未知异常只返回稳定安全失败。

命令 ID、label key、默认快捷键、原生菜单分组和菜单类型由
`src/shared/commands/` 的冻结元数据表唯一持有；基础命令/菜单文案由
`src/shared/i18n/` 提供中英文 catalog。domain、main 和 renderer 只做各层
适配，不得复制这些元数据。

以下是后续迭代目标 ID，当前不可执行：

- `file.new/open/openFolder/import/save/saveAs/close/export/print`
- `edit.undo/redo/cut/copy/paste/pastePlain/find/replace`
- `paragraph.heading1..6/paragraph/quote/orderedList/unorderedList/taskList/codeBlock/table`
- `format.strong/emphasis/strike/code/link/image/highlight/subscript/superscript`
- `view.files/outline/sourceMode/focusMode/typewriterMode/zoomIn/zoomOut/actualSize`
- `workspace.quickOpen/globalSearch/reveal/rename/move/trash`

Command handler 返回 `Promise<CommandResult>`，失败使用 AppError；菜单事件不能直接调用 service。

## 7. 导入与导出接口

```ts
type ImportFormat =
  'docx' | 'rtf' | 'epub' | 'latex' | 'rst' | 'org' | 'mediawiki' | 'dokuwiki' | 'textile' | 'opml'

interface ImportRequest {
  sourcePath: string
  format: ImportFormat
}

interface ImportedResource {
  relativePath: string
  contentHash: string
  size: number
}

interface ImportedDocument {
  sourceFormat: ImportFormat
  suggestedFileName: string
  markdown: string
  stagingId: string | null
  resources: readonly ImportedResource[]
  warnings: readonly string[]
}

interface ImportAdapter<TOptions> {
  format: ImportFormat
  validate(options: unknown): Result<TOptions>
  checkAvailability(): Promise<Result<Availability>>
  import(
    sourcePath: string,
    stagingDirectory: string,
    options: TOptions,
    signal: AbortSignal
  ): Promise<Result<ImportedDocument>>
}
```

`sourcePath` 必须来自当前窗口的选择器授权，主进程再次校验 sender、格式和路径。成功导入创建未命名会话，绝不覆盖源文件。提取资源使用受控 staging ID；首次保存通过 `ResourceTransaction` 提交到用户选择的目标旁，关闭/取消则清理，崩溃恢复期间保留。warning 只包含脱敏、限长的转换诊断。

```ts
type ExportFormat =
  'html' | 'html-plain' | 'pdf' | 'png' | 'jpeg' | 'docx' | 'odt' | 'rtf' | 'epub' | 'latex'

interface ExportAdapter<TOptions> {
  format: ExportFormat
  optionsSchemaVersion: number
  validate(options: unknown): Result<TOptions>
  checkAvailability(): Promise<Result<Availability>>
  export(
    snapshot: RenderSnapshot,
    target: string,
    options: TOptions,
    signal: AbortSignal
  ): Promise<Result<ExportArtifact>>
}
```

adapter 不接收可变 DocumentSession。所有导出从冻结的 RenderSnapshot 工作。

## 8. ResourceTransaction

```ts
interface ResourceTransaction {
  id: string
  documentId: string
  expectedRevision: number
  fileOperations: readonly FileOperation[]
  sourcePatch: SourcePatch
  rollbackPolicy: 'required' | 'best-effort-with-recovery'
}
```

提交顺序和回滚遵守数据安全文档。文件永久删除不能作为普通 FileOperation；必须走单独确认命令。

## 9. 版本管理

- IPC、settings、recovery、export options 都包含整数 schema version。
- main 与 preload 版本不匹配时拒绝启动产品窗口并显示安全错误页。
- 向后兼容字段只能新增为可选并有默认；删除/改义必须迁移和 ADR。
