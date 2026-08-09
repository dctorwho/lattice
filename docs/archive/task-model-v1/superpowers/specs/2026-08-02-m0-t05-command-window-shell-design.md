# M0-T05 Command Registry 与窗口骨架设计

- 日期：2026-08-02
- 状态：已选定唯一实施方案
- 任务：M0-T05
- 依赖：M0-T04 `passed`

## 1. 目标与边界

M0-T05 建立可供后续文件、编辑、工作区和导出能力复用的统一命令系统，
并把当前启动卡片替换为真实的桌面窗口骨架。任务只交付当前可工作的
`view.toggleSidebar` 与 `app.about`；不得出现打开、保存、编辑、导出或工作区
假按钮，也不得用禁用控件预告未实现功能。

本任务不引入 CodeMirror、文件服务、设置、工作区、导入、导出或新生产
依赖。Markdown 编辑区仍由 M1 建立；M0-T05 只提供语义清晰、可聚焦、不可
误认为已经可编辑的主内容区域。

## 2. 唯一架构方案

renderer 中的纯 TypeScript `CommandRegistry` 是命令定义、状态派生和执行的
唯一权威。React、原生菜单、renderer 右键菜单和键盘快捷键均只持有稳定
command ID，不复制命令实现。

```text
Electron native menu click
  -> fixed main-to-preload command event
  -> strict command ID validation
  -> renderer command controller
  -> CommandRegistry.execute(id, context)

titlebar button / renderer context menu / keyboard shortcut
  -> renderer command controller
  -> same CommandRegistry.execute(id, context)

context change
  -> CommandRegistry derives visible/enabled/checked
  -> strict renderer-to-main state snapshot
  -> native menu projection only
```

main process 不执行 renderer 命令，不维护第二份命令业务逻辑。原生菜单只负责
投递 command ID 和显示 renderer 派生的状态。

## 3. 命令领域模型

命令接口放在 `src/domain/commands/`，不得依赖 React、DOM、Electron 或 Node：

```ts
type CommandId = 'view.toggleSidebar' | 'app.about'

interface CommandContext {
  readonly isSidebarVisible: boolean
  readonly isDialogOpen: boolean
  readonly isWindowFocused: boolean
  readonly hasSession: boolean
  readonly isSessionDirty: boolean
  readonly hasEditor: boolean
}

interface CommandState {
  readonly id: CommandId
  readonly isVisible: boolean
  readonly isEnabled: boolean
  readonly isChecked: boolean
}

interface AppCommand {
  readonly id: CommandId
  readonly labelKey: CommandLabelKey
  readonly defaultShortcut?: string
  getState(context: CommandContext): CommandState
  run(context: CommandExecutionContext): Promise<CommandResult>
}
```

Registry 在构造时拒绝重复 ID。未知、不可见或禁用命令不得调用 handler；结果
必须可区分 `executed`、`not-found`、`not-visible`、`disabled` 和安全失败。
Registry 输出只读、按稳定 ID 排序的状态快照。

`COMMAND-M0` 中尚未实现的会话和 editor 字段仍进入 context，但当前两个命令
不得因无会话、clean/dirty 或无 editor 产生虚假差异。对话框打开时背景命令
禁用；窗口失焦时 renderer 快捷键不会被接受。

## 4. 当前真实命令

### 4.1 `view.toggleSidebar`

- 可见：始终。
- 启用：窗口聚焦且没有模态对话框。
- 选中：等于 `isSidebarVisible`。
- 默认快捷键：`CommandOrControl+Shift+L`；renderer 归一化为平台无关组合。
- 执行：切换 shell 的侧栏可见状态；关闭侧栏后把焦点移到主内容区域。

### 4.2 `app.about`

- 可见：始终。
- 启用：没有已打开的 About 对话框。
- 选中：始终 false。
- 默认快捷键：`F1`。
- 执行：调用现有 `window.lattice.app.getInfo()`，显示名称、版本、平台和契约
  版本。失败时只显示稳定 message key 对应的本地化文案，不显示原始异常。

About 使用原生 HTML dialog 语义和焦点约束，不新增 main 对话框能力。关闭后
恢复触发元素焦点；原生菜单没有 DOM 触发元素时，回到主内容区域。

## 5. IPC 与 preload 扩展

`LatticeDesktopApi` 新增冻结的 `commands` 能力：

```ts
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

- main-to-renderer 只发送严格枚举的 command ID，不暴露 Electron event。
- preload 在调用 listener 前校验 command ID；无效消息被丢弃并安全记录。
- `onInvoke` 返回幂等 unsubscribe；窗口卸载时必须调用。
- 状态同步使用固定 channel、契约版本、preload request ID、现有 sender/window
  校验、预算、Zod response 和可序列化性边界。
- 状态数组只能包含批准 ID，每个 ID 恰好一次，最大 2 项；重复、缺失和未知 ID
  均拒绝。
- main 只把验证后的状态投影到当前授权窗口对应的原生菜单；renderer 不能提供
  window/WebContents ID。

不增加通用 `invoke`、`send`、任意 event name 或任意 menu template 能力。

## 6. 原生菜单与窗口生命周期

main 创建固定应用菜单：

- `View / Toggle Sidebar` -> `view.toggleSidebar`
- `Help / About Lattice` -> `app.about`

菜单项使用稳定 Electron `id`，accelerator 与命令定义一致。点击时读取当前
focused、已登记且未销毁的 Lattice 窗口；没有授权目标时不发送。窗口 focus
变化时应用最后一个验证通过的状态快照；无快照时采用 fail-closed 状态。

菜单投影只允许修改 `visible`、`enabled` 和 `checked`，不能由 renderer 改写
label、accelerator、role 或 click handler。

## 7. React 窗口骨架

renderer 目标结构：

```text
AppShell
├─ TitleBar
│  ├─ Lattice brand/title
│  ├─ Toggle Sidebar command button
│  └─ About command button
├─ body
│  ├─ Sidebar region (real show/hide state; no file controls)
│  └─ Main content region (focus target; explicitly non-editable in M0)
├─ StatusBar (application readiness and command feedback only)
├─ CommandContextMenu
└─ AboutDialog
```

保持系统窗口边框和系统最小化/最大化/关闭控件，避免在 M0 自制高风险窗口控制。
TitleBar 是应用内容标题区域，不伪装系统窗口按钮。CSS 使用语义 class、变量和
尺寸 token，支持 320px 最小宽度、100%–250% 缩放、浅色/深色和高对比。

侧栏显示“尚未打开工作区”的本地化空状态，但不提供打开按钮。主内容区明确
显示编辑器将在 M1 启用，且不使用 `contenteditable`、textarea 或假光标。

## 8. 本地化与依赖

M0-T05 不新增生产依赖。建立最小、类型化的 renderer message catalog 和 `t()`
接口，覆盖本任务全部可见文案、aria label、状态和错误映射。默认使用简体中文，
同时提供完整英文表；后续引入 i18next 时保留相同 message key。

不提前安装 Zustand、Radix 或 Lucide。当前状态规模可由 React reducer/context
和原生 HTML 控件可靠承载；未来任务出现实际消费者后再按依赖台账准入。

## 9. 错误与焦点

- 命令 handler 的未知异常转换为 `INTERNAL_UNEXPECTED` 安全结果。
- `getInfo()` 失败只进入 About 的可操作错误状态，不关闭窗口或泄漏 details。
- 状态同步失败保留 renderer 本地状态，并使 main 菜单保持上一验证快照或
  fail-closed；不得递归重试或弹窗风暴。
- 右键菜单 Escape/点击外部关闭并恢复触发点焦点。
- About 关闭恢复触发点；触发点失效时聚焦主内容区域。
- 侧栏被关闭且焦点位于其中时，先把焦点转移到主内容区域。

## 10. 测试与验收

TC-M0-006 覆盖：

1. 纯领域 Registry：重复/未知 ID、visible/enabled/checked、禁用保护、异步结果。
2. `COMMAND-M0`：无会话、clean/dirty、无 editor、dialog 打开、窗口失焦。
3. React 组件：按钮、右键、快捷键和模拟原生菜单事件调用同一 command ID。
4. preload/main：严格 event、unsubscribe、sender 校验、状态快照、原生菜单投影。
5. 焦点：菜单关闭、About 关闭、侧栏隐藏后的确定性恢复。
6. 真实 Electron E2E：原生菜单项、快捷键、窗口骨架、About 真实 AppInfo。
7. 安全回归：preload 表面精确为 `{ app, commands }`，裸 IPC/Node 仍不可得。

完成门禁：

```powershell
pnpm test -- tests/unit/domain/command-registry.spec.ts tests/unit/component/command-registry.spec.tsx tests/unit/main/application-menu.spec.ts tests/unit/preload/command-api.spec.ts
pnpm check
pnpm test:e2e
pnpm test:security
node scripts/verify-planning-docs.mjs
git diff --check
```

M0-T05 无人工门禁。自动门禁和独立审查通过后记录证据，状态设为 `passed`，
只解锁 M0-T06；随后本地 fast-forward 合入 main 并更新已存在的 GitHub 远端。
