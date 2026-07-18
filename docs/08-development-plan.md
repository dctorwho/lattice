# 开发计划与工作方式

## 1. 环境基线

- Windows 10/11 x64。
- Node.js 24.x、pnpm 11.12.0、Git 2.50+；先执行 `corepack install --global pnpm@11.12.0`，再执行 `corepack enable pnpm` 创建命令代理。`pnpm --version` 必须为 11.12.0；若当前工具环境注入了其他 pnpm 路径，以 `corepack pnpm --version` 和 `corepack pnpm ...` 为权威回退入口。
- PowerShell 作为文档命令示例环境。
- Pandoc 为可选外部工具；M6 前无需安装。
- 首次依赖安装需要网络，之后核心构建和测试应可利用 pnpm store 离线完成。

## 2. 仓库初始化

M0 首任务执行 `git init`，建立 `main` 分支和 `.gitignore`。实现采用任务级变更：一个任务只解决一组高度内聚的验收标准。Codex 不自动提交；用户验收后再明确要求提交。

建议提交格式：

```text
M1-T03: implement atomic file save
M2-T05: reveal inline markers around selection
test(M4): add table patch regression corpus
```

## 3. 任务状态流

```text
blocked -> ready -> in_progress -> awaiting_manual -> passed
                         |                |
                         +---- failed <---+
```

- `blocked`：依赖未通过。
- `ready`：需求、设计、夹具和验收可执行。
- `in_progress`：唯一允许实现的当前任务。
- `awaiting_manual`：自动测试已通过，等待体验/视觉/系统验证。
- `passed`：证据完整，允许直接后继任务进入 ready。
- `failed`：保留失败证据并回到同一任务修复，不另开绕过任务。

`tasks/state.json` 是状态权威。任务描述和代码 TODO 不能替代它。

## 4. 单任务循环

1. 读取 `AGENTS.md`、状态、任务和相关规格。
2. 检查工作树，识别用户已有改动。
3. 将任务置为 `in_progress`，列出将证明完成的测试。
4. 先添加失败测试或夹具；纯工程脚手架任务可先建立检查。
5. 实现最小完整能力，不做后续任务和假 UI。
6. 运行定向测试，再运行 `pnpm check` 和任务要求的 E2E/性能/安全测试；M0-T01 按测试策略中的自举例外执行。
7. 更新接口、ADR、兼容矩阵和任务状态。
8. 输出证据和人工步骤并停止。

## 5. 代码组织目标

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
```

领域模块不能依赖 Electron 或 React。main 服务通过接口注入文件系统、时钟、随机数、对话框和进程，便于故障测试。

## 6. 接口和 ADR

以下变化需要 `docs/adr/NNNN-title.md`：

- 更换编辑器、解析器、桌面框架或持久化模型。
- 改变 SourceBuffer、DocumentSession、SourcePatch、IPC、Command 或 ExportAdapter 契约。
- 引入原生模块、数据库、远程服务、通用 shell 执行或 renderer 权限。
- 放宽数据安全不变量、CSP、sandbox 或路径授权。

ADR 包含背景、决策、备选、后果、迁移和验证。已接受 ADR 不原地改写；用新 ADR 替代。

## 7. 依赖管理

- 生产依赖先更新技术栈文档，再安装。
- 检查许可证、维护状态、安装脚本、传递依赖、包体和 renderer 权限。
- 不同时升级多个关键主版本。
- Electron/Chromium 安全更新单独任务，运行完整 E2E、导出和 IME 冒烟。
- ripgrep、Pandoc 等二进制记录来源、版本、哈希、许可证和更新方式。

## 8. 评审重点

按顺序评审：数据损坏风险 → 权限与输入验证 → 源码范围/事务正确性 → IME/selection/undo → 失败处理 → 性能 → UI。代码简洁或截图接近不能抵消前面的缺陷。

## 9. 两人团队分工

M0–M2 由一人主导文档核心，另一人可并行测试夹具、安全壳和 UI tokens，但不能独立建立另一套文档模型。M3 后可分为编辑器/Markdown 与桌面/导出两线，共享契约变更仍串行评审。

## 10. Definition of Ready

任务进入 `ready` 前必须具备：需求 ID、依赖、非目标、设计决策、预期文件、自动测试、人工验证、完成条件和失败回退。缺少任一项由 Codex 补规格，不直接实现。

## 11. Definition of Done

- 所有明确验收有直接证据且测试不是被弱化后通过。
- `pnpm check` 通过；适用的 E2E/性能/安全测试通过。
- 无新增未解释 warning、临时开关、假按钮或跳过测试。
- 文档、接口、兼容矩阵和 `tasks/state.json` 已同步。
- 用户要求的人工门禁完成后才可 `passed`。
