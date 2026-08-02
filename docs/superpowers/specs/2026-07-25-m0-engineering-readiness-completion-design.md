# M0 工程基础补齐设计

日期：2026-07-25

状态：已由用户分段确认，等待书面规格复核

范围：按依赖顺序完成 M0-T03、M0-T04、M0-T05 和 M0-T06，使项目具备进入 M1 产品开发的工程、安全、契约、命令和 GitHub 门禁基础。

## 1. 背景

M0-T01 已建立可构建 Electron/React/TypeScript 骨架，M0-T02 已建立严格类型、格式、lint、单元、集成、Electron E2E、安全 smoke、性能测量和冷自举工具链。当前任务状态为：

- M0-T01：`passed`
- M0-T02：`passed`
- M0-T03：`ready`
- M0-T04：`blocked`
- M0-T05：`blocked`
- M0-T06：`blocked`

当前本地 `main` 尚未配置 Git remote，GitHub 账号 `dctorwho` 下也没有本项目仓库。用户选择在 M0-T06 创建公开仓库 `dctorwho/lattice`，采用个人开发严格模式和 GitHub 原生自动审查。

本设计不改变任务依赖图，不把 M0-T06 的 CI、SBOM 或完整依赖审计提前混入 M0-T03，也不提前实现 M1 及后续产品功能。

## 2. 目标与完成定义

### 2.1 目标

1. 建立不可信 renderer 与系统权限之间的完整 Electron 安全边界。
2. 建立可运行时校验的共享契约、稳定错误模型和最小 preload 表面。
3. 建立统一命令注册表与无假功能的窗口骨架。
4. 建立 Windows GitHub CI、原生安全/依赖审查、许可证审计、SBOM 和构建证据。
5. 保护远端 `main`，使代码只能通过满足门禁的 PR 合并。

### 2.2 完成定义

只有同时满足以下条件，才允许宣称“M0 工程基础补齐，可以开始 M1 产品开发”：

- M0-T03 至 M0-T06 均为 `passed`。
- M0-T06 的 `MAN-M0-001` 已由用户人工审阅并签署通过。
- 本地和 GitHub required checks 均为绿色。
- GitHub `main` ruleset 已激活并验证无法直接推送。
- 依赖、许可证、SBOM、构建哈希、测试和安全证据已归档。
- M1-T01 是唯一按任务图解锁的后继任务。

## 3. 执行架构与任务边界

任务严格按 M0-T03 → M0-T04 → M0-T05 → M0-T06 串行执行。每项任务使用独立工作树和 `codex/` 分支，并完成独立的设计、计划、TDD、验证、证据、审查和合并闭环。

### 3.1 每任务闭环

1. 从干净 `main` 建立专属工作树和分支。
2. 读取任务要求及其链接的架构、安全、契约和测试文档。
3. 写入并确认任务专属设计与实施计划。
4. 将且仅将当前任务设置为 `in_progress`。
5. 先写失败测试，再实现最小生产代码。
6. 运行 `pnpm check` 和任务专项门禁。
7. 记录命令、退出码、测试数量、构建哈希、人工步骤和残余风险。
8. 请求代码审查并处理可执行意见。
9. 将已验证分支本地合并回 `main`。
10. 将当前任务设置为 `passed`，只解锁直接后继任务。

任何任务失败都不得跳过、合并到后继任务或通过修改任务图绕开。

### 3.2 M0-T03：安全 Electron 壳

交付边界：

- 在 `ready` 前调用 `app.enableSandbox()`。
- 主 renderer 保持 `sandbox:true`、`contextIsolation:true`、`nodeIntegration:false`。
- 建立 CSP、导航、新窗口、权限请求和外链策略。
- 主窗口不得导航到开发 URL、任意远程 URL或本地任意路径。
- 外链只允许解析后、明确批准的 `https:` 和 `mailto:`，并通过受控系统打开路径处理。
- 生产构建禁用 DevTools 后门和开发服务器入口。
- preload 仍保持最小表面；共享 Zod 契约留给 M0-T04。

验收：

- `TC-M0-003` 覆盖 `SEC-M0-A` 全矩阵。
- `TC-M0-004` 覆盖 `SEC-M0-B` 全矩阵。
- `pnpm check`、`pnpm test:e2e`、`pnpm test:security` 全部通过。

### 3.3 M0-T04：共享契约与错误

交付边界：

- 在 `src/shared/contracts/` 建立 Zod 请求、响应和事件 schema。
- 建立 `Result<T>`、稳定 `ErrorCode`、request ID 和安全错误序列化。
- 建立 sender、窗口归属、未知 channel、参数上限和不可序列化结果的拒绝框架。
- 建立一个最小、可审计的 preload 方法示例，不实现真实文件或导出能力。
- 日志接口只允许脱敏、安全、限长字段。

新增依赖必须先更新 `docs/04-technology-stack.md`，固定精确版本并通过许可证与安装脚本审查。

验收：

- `TC-M0-005` 覆盖 `CONTRACT-M0` 全矩阵。
- 有效值、缺字段、未知字段、超限、错误 sender、未知 channel 和不可序列化结果均有行为断言。
- `pnpm check` 及适用的 Electron 安全/E2E 门禁通过。

### 3.4 M0-T05：命令注册表与窗口骨架

交付边界：

- 建立稳定的 `AppCommand`、command ID、registry 和命令状态派生。
- 菜单、按钮、右键和快捷键只调用统一 command ID。
- 建立标题栏、侧栏占位区域、编辑区域和状态栏的窗口骨架。
- 只暴露当前真实可工作的开发/关于命令。
- 不放置文件、编辑、导出或工作区假按钮，不用 disabled mock 伪装未来功能。

验收：

- `TC-M0-006` 覆盖 `COMMAND-M0` 全矩阵。
- 四类入口共享命令 ID、可见/启用/选中状态和焦点恢复行为。
- `pnpm check`、适用 E2E 和键盘焦点 smoke 通过。

### 3.5 M0-T06：CI、依赖与里程碑审计

交付边界：

- Windows GitHub Actions CI。
- 冻结 lockfile 安装、pnpm store 缓存、测试和构建制品。
- GitHub CodeQL、Dependency Review、Dependabot 和 GitHub Checks。
- 许可证与传递依赖审计、初始 SBOM、构建哈希和文档命令一致性检查。
- GitHub 公开仓库、远端 `main` 和个人开发严格 ruleset。
- `MAN-M0-001` 人工审阅。

验收：

- `TC-M0-007` 在干净 checkout 中证明 CI 等价命令、审计、SBOM 和制品完整。
- 完整 `pnpm check`、E2E、安全、性能、冷自举、规划校验和供应链门禁通过。
- Windows CI 生成可下载、可追踪的报告和构建制品。
- 人工门禁明确批准 renderer 权限、许可证、CI 报告、SBOM 和打包窗口。

## 4. GitHub 仓库与上传流程

### 4.1 仓库

- 所有者：`dctorwho`
- 仓库名：`lattice`
- 可见性：公开
- 默认分支：`main`
- Git 协议：沿用当前 GitHub CLI 的 HTTPS 配置

原计划由 M0-T06 创建仓库并首次上传。用户在 M0-T04 完成本地合并后明确授权
提前创建公开 `dctorwho/lattice`，当前 `origin/main` 已存在。M0-T05 完成后
保持远端 main 与本地已验证 main 同步；M0-T06 不重建仓库，而是先验证 owner、
可见性、默认分支、remote URL 和提交一致性，再部署工作流与 ruleset。

### 4.2 首次引导顺序

1. 核对现有公开 `dctorwho/lattice`、唯一 `origin`、默认 `main` 和提交一致性。
2. 完成并本地验证 M0-T06 工作流与审计脚本。
3. 通过现有远端引导首次工作流运行，不重建或覆盖仓库。
4. 用 M0-T06 bootstrap PR 产生首次 GitHub Actions、CodeQL 和 Dependency
   Review 检查，成功后合入 main 并等待 main push 检查。
5. 核对每个检查的稳定名称、来源和结论。
6. 仅在真实成功检查存在后启用 required checks 和 `main` ruleset。
7. 创建测试 PR，验证直接推送被拒绝、检查失败无法合并、检查成功可合并。

如果首次工作流失败，ruleset 保持未激活；先在功能分支修复根因并重新运行，不能把不存在或失败的检查设为 required。

## 5. GitHub Actions 与原生自动审查

### 5.1 Windows CI

`ci.yml` 在 PR、`main` 推送和显式手工触发时运行，至少包含：

- 固定 Node 24 和 pnpm 11.12.0。
- `pnpm install --frozen-lockfile`。
- `node scripts/verify-planning-docs.mjs`。
- `pnpm check`。
- `pnpm test:e2e`。
- `pnpm test:security`。
- M0-T06 规定的依赖、许可证、SBOM 和制品检查。
- 测试报告、审计报告、SBOM、构建哈希和允许的构建制品上传。

冷自举和完整性能门禁使用独立、显式、可审计的 job；不得让网络型冷自举混入声明离线的 `pnpm check`。

### 5.2 CodeQL

`codeql.yml` 对 JavaScript/TypeScript 执行 GitHub CodeQL：

- PR 到 `main`。
- `main` 推送。
- 定时扫描。

CodeQL 结果以 GitHub code scanning alert 和 PR 行级注释展示。M0-T06 实施时从 GitHub 官方 release 解析并记录 action 的不可变 commit SHA；本规格不硬编码可能在实施前变化的 SHA。

### 5.3 Dependency Review

`dependency-review.yml` 只在 PR 上检查依赖变化：

- 阻断达到项目门槛的已知漏洞。
- 阻断不允许或未评审许可证。
- 将依赖差异和阻断原因显示在 GitHub Checks/PR 中。

项目自己的传递依赖和许可证审计脚本仍是权威门禁；Dependency Review 是新增依赖的 PR 前置防线，不能替代 M0-T06 审计。

### 5.4 Dependabot

`dependabot.yml` 每周生成依赖升级 PR：

- 不直接写 `main`。
- 相关升级可按兼容范围分组，但 Electron、构建、安全和测试工具的主版本不得自动合并。
- 所有升级必须经过同一 required checks。
- 不启用无人监督的自动合并。

### 5.5 原生 review 机器人定义

原生 review 机器人由以下 GitHub 能力共同组成：

- CodeQL 安全行级注释。
- Dependency Review 漏洞与许可证结论。
- GitHub Checks 中的 format、lint、类型、测试、构建和审计结果。
- PR conversation resolution 门禁。

不部署 Reviewdog 或第三方 AI review App。自动检查不冒充人工批准，不产生虚假的 approving review。

### 5.6 Actions 安全

- workflow 默认 `contents: read`。
- 只给特定 job 最小的 `security-events: write`、`pull-requests: read` 或 `actions: read`。
- 来自 fork 的 PR 不获得写 token 或仓库 secrets。
- 第三方 action 使用完整 commit SHA；M0-T06 记录上游仓库、release、SHA 和许可证。
- 不使用 `pull_request_target` 执行不可信 PR 代码。
- 日志和制品不包含 token、本机绝对路径、用户文档正文或未脱敏诊断。

## 6. `main` Ruleset

首次成功检查产生稳定名称后，对 `main` 激活 ruleset：

- 必须通过 PR，禁止直接更新 `main`。
- 不要求其他人批准，以支持个人开发。
- 必须解决全部 review conversation。
- 必须通过 CI、Electron E2E、安全、CodeQL、Dependency Review 和 M0-T06 审计检查。
- 要求线性历史。
- 禁止 force push。
- 禁止删除 `main`。
- 不设置日常 bypass。
- 合并后自动删除功能分支。

仓库所有者只有在 GitHub 故障或错误 ruleset 造成完全锁死时，才可临时调整规则。调整前记录原因，恢复后验证规则并将变更记入 M0-T06 证据。

## 7. 失败处理

### 7.1 任务失败

- 任一自动门禁失败时，任务保持 `in_progress`。
- 不合并、不解锁后继任务、不降低门槛。
- 使用系统化调试定位根因；安全和数据不变量失败优先于功能进度。
- 修复必须增加或完善能复现问题的测试。

### 7.2 GitHub 和网络失败

- `gh` 认证失败时停止远端写入，保留本地提交和完整命令结果。
- 仓库已存在但所有者、可见性或默认分支不符时停止，不覆盖或重建。
- remote URL 不符时停止，不强推。
- GitHub API 限流或 Actions 故障时等待恢复，不通过禁用 required check 绕过。
- 部分设置成功时逐项读取远端状态，记录已生效项，再从幂等步骤继续。

### 7.3 供应链失败

- 新依赖未进入准入台账时阻断。
- lockfile 漂移、未批准安装脚本、不可接受许可证、未评估高危漏洞或 SBOM 缺项时阻断。
- 不因“仅开发依赖”自动豁免许可证、安装脚本或来源审查。

## 8. 证据与审计

每项任务的 evidence 至少包含：

- 所有要求命令及退出码。
- 测试文件和用例数量。
- 覆盖的稳定测试 ID 与参数矩阵。
- 生产构建哈希和适用制品哈希。
- Electron 进程和临时目录清理结果。
- 依赖、许可证、SBOM 和 GitHub 检查链接（M0-T06）。
- 已知残余风险及其所有者任务。

M0-T06 额外保存：

- GitHub 仓库 URL、可见性和默认分支。
- workflow 文件哈希、运行 ID、job/check 名称和结论。
- CodeQL、Dependency Review、Dependabot 和 ruleset 实际配置。
- 直接推送失败与 PR 门禁成功的验证证据。
- `MAN-M0-001` 人工审阅结论。

## 9. 非目标

- 不在本轮实现 M1 及后续产品功能。
- 不部署第三方 AI review 服务。
- 不要求单人开发者提供无法完成的第二人批准。
- 不启用自动合并、自动发布、签名或自动更新。
- 不将 GitHub 绿色检查解释为 Alpha、Beta、RC 或 Stable 发布资格。
- 不提前添加未来任务的按钮、IPC、文件能力或占位实现。

## 10. 后续设计与计划

本总体规格只固定 M0-T03 至 M0-T06 的顺序、边界和最终 GitHub 门禁。下一步只为当前唯一 `ready` 的 M0-T03 编写任务专属实施计划。M0-T04、M0-T05 和 M0-T06 在直接依赖通过后，分别执行设计确认、实施计划和任务闭环。

任何后续任务设计若需改变本规格中的公共安全边界、GitHub策略或完成定义，必须先更新本规格并获得用户确认。
