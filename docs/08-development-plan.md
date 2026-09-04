# 开发计划与工作方式

## 1. 环境基线

- Windows 10/11 x64。
- Node.js 24.x、pnpm 11.12.0、Git 2.50+；先执行
  `corepack install --global pnpm@11.12.0`，再执行 `corepack enable pnpm`
  创建命令代理。`pnpm --version` 必须为 11.12.0；若当前工具环境注入了其他
  pnpm 路径，以 `corepack pnpm --version` 和 `corepack pnpm ...` 为权威回退入口。
- PowerShell 作为文档命令示例环境。
- Pandoc 为可选外部工具；M6 前无需安装。
- 首次依赖安装需要网络，之后核心构建和测试应可利用 pnpm store 离线完成。

## 2. 迭代状态流

```text
blocked -> ready -> in_progress -> awaiting_manual -> passed
                         |                |
                         +---- failed <---+
```

- `blocked`：依赖迭代尚未通过。
- `ready`：三份入口文档完整，依赖已通过，可以实施。
- `in_progress`：唯一允许实施的当前迭代。
- `awaiting_manual`：仅用于 `manual_gate:true`；自动化全门禁已通过，`04-test-report.md` 完整，等待获批的人工验证。
- `passed`：`04-test-report.md`、`05-exit-report.md` 和适用的人工证据完整，依赖迭代可进入 `ready`。
- `failed`：保留失败证据并在同一迭代修复，不绕过或提前实施后续迭代。

`iterations/state.json` 是唯一状态权威；入口和退出文档保存范围、设计和证据，代码 TODO 不能替代它。

## 3. 单迭代循环

1. 阅读 `AGENTS.md`、状态、三份入口文档、对应 `REF-*` 证据和引用的产品规格。
2. 检查工作树，识别用户已有改动。
3. 将迭代置为 `in_progress`，按公开证据和测试用例矩阵准备能证明复刻结果的聚焦测试、夹具与对照条件。
4. 以最小完整能力实施范围内工作；不做后续迭代和假 UI。
5. 开发期间运行聚焦测试；在迭代退出前运行 `pnpm check` 以及适用的 E2E、性能和安全套件。
6. 同步接口、ADR、复刻验收矩阵、证据状态和迭代文档；自动化证据写入 `04-test-report.md`。
7. 自动化门禁通过、已知差异关闭后写入 `05-exit-report.md` 并设置 `passed`；只有 `manual_gate:true` 的迭代才先进入 `awaiting_manual`，待获批人工证据完成后再设置 `passed`。

## 4. 代码组织目标

```text
src/
  main/          Electron 生命周期、窗口、IPC、文件、导出、系统服务
  preload/       最小类型化桥接
  renderer/      React 壳与 CodeMirror 视图
  shared/        契约、错误、跨进程只读类型
  domain/        文档、源码补丁、命令、设置等纯领域逻辑
tests/
  fixtures/      字节、Markdown、安全、导出夹具
  unit/
  integration/
  e2e/
  performance/
iterations/      状态权威、入口文档、退出报告和用例矩阵
```

领域模块不能依赖 Electron 或 React。main 服务通过接口注入文件系统、时钟、随机数、对话框和进程，便于故障测试。

## 5. 接口和 ADR

以下变化需要 `docs/adr/NNNN-title.md`：

- 更换编辑器、解析器、桌面框架或持久化模型。
- 改变 SourceBuffer、DocumentSession、SourcePatch、IPC、Command 或 ExportAdapter 契约。
- 引入原生模块、数据库、远程服务、通用 shell 执行或 renderer 权限。
- 放宽数据安全不变量、CSP、sandbox 或路径授权。

ADR 包含背景、决策、备选、后果、迁移和验证。已接受 ADR 不原地改写；用新 ADR 替代。

## 6. 依赖管理

- 生产依赖先更新技术栈文档，再安装。
- 检查许可证、维护状态、安装脚本、传递依赖、包体和 renderer 权限。
- 不同时升级多个关键主版本。
- Electron/Chromium 安全更新属于 M0 的安全边界维护，并运行完整 E2E、导出和 IME 冒烟。
- ripgrep、Pandoc 等二进制记录来源、版本、哈希、许可证和更新方式。

## 7. 评审重点

按顺序评审：数据损坏风险 → 权限与输入验证 → 源码范围/事务正确性 → IME/selection/undo → 失败处理 → 性能 → 公开证据对应的功能、交互和视觉。代码简洁或单张截图接近不能抵消前面的缺陷。

## 8. 两人团队分工

M0–M2 由一人主导文档核心，另一人可并行测试夹具、安全壳和 UI tokens，但不能独立建立另一套文档模型。M3 后可分为编辑器/Markdown 与桌面/导出两线，共享契约变更仍串行评审。

## 9. 就绪和完成定义

迭代进入 `ready` 前，三份入口文档必须具备 `REF-*`、`COMP-*`、需求 ID、依赖、非目标、设计决策、预期文件、自动测试、对照条件、完成条件和失败回退；若启用人工门禁，还必须定义人工验证。缺少适用项时先补全迭代文档，不直接实现。

完成条件：所有明确验收有直接证据且测试未被弱化；本迭代已知复刻差异为零；`pnpm check` 和适用的 E2E、视觉、性能、安全套件通过；无新增未解释 warning、临时开关、假按钮或跳过测试；文档、接口、证据台账和复刻验收矩阵已同步；仅当 `manual_gate:true` 时还要求人工门禁完成并记录。
