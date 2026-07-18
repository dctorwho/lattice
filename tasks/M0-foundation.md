# M0：工程基础

必读：[架构](../docs/03-architecture.md)、[技术栈](../docs/04-technology-stack.md)、[公共契约](../docs/15-public-contracts.md)、[项目结构](../docs/16-project-structure-and-standards.md)、[测试](../docs/09-test-strategy.md)、[M0 测试用例](../docs/test-cases/M0-foundation.md)。

## M0-T01 初始化项目

- 依赖：无
- 需求：NFR-008
- 交付：初始化 Git/main；基于 electron-vite React TypeScript 建立 `src/main`、`src/preload`、`src/renderer`、`src/domain`、`src/shared` 和测试目录；在 `package.json#packageManager` 固定 `pnpm@11.12.0`，固定 Electron 43.1.1、electron-vite 5.x、React 19，生成唯一 `pnpm-lock.yaml` 和 `.gitignore`。
- 非目标：业务 UI、编辑器、文件服务。
- 验证：按 M0-T01 自举例外执行 `pnpm install`、开发窗口启动、`pnpm build`；确认 package manager 版本、唯一 `pnpm-lock.yaml`、无 npm/yarn lockfile，并保存 TC-M0-001 命令退出码。
- 完成：打包前构建可启动，state 只解锁 M0-T02。

## M0-T02 质量工具链

- 依赖：M0-T01
- 需求：NFR-008
- 交付：strict TypeScript、ESLint、Prettier、Vitest、Testing Library、Playwright Electron；建立 `lint/typecheck/test/test:integration/test:e2e/test:security/test:performance/build/check` 脚本和最小 smoke tests；将 M0-T01 的 TC-M0-001 命令验收反向自动化到 `test:integration`。
- 非目标：产品功能测试。
- 验证：`pnpm check`、`pnpm test:e2e`；故意类型错误和失败测试能让命令非零退出。
- 完成：命令与 `docs/09-test-strategy.md` 一致。

## M0-T03 安全 Electron 壳

- 依赖：M0-T02
- 需求：UI-001、NFR-007；风险 R-008
- 交付：`app.enableSandbox()`、sandbox/context isolation/nodeIntegration 设置、CSP、导航/新窗口/权限处理、HTTPS/mailto 外链校验；生产禁用 DevTools 和开发 URL。
- 非目标：文件 API、用户 HTML 预览。
- 验证：SEC-001..008 E2E，证明 renderer 无 `require`/Node/裸 IPC，恶意协议与导航被拒绝；`pnpm check`、`pnpm test:e2e`、`pnpm test:security`。

## M0-T04 共享契约与错误

- 依赖：M0-T03
- 需求：NFR-008、NFR-009
- 交付：Zod 契约目录、`Result<T,AppError>`、稳定错误 code、request ID、sender 校验框架、最小 preload 方法示例；错误日志脱敏接口。
- 非目标：真实文件或导出方法。
- 验证：非法参数、未知 channel、错误 sender 和不可序列化结果测试；preload 表面快照仅含批准方法。

## M0-T05 Command Registry 与窗口骨架

- 依赖：M0-T04
- 需求：UI-001、UI-002
- 交付：Command 接口、registry、React 窗口骨架、标题栏/侧栏占位/编辑区/状态栏布局；只有可工作的开发/关于命令，不放产品假按钮。
- 非目标：文件、编辑和工作区命令。
- 验证：可见/启用/选中派生测试；菜单和按钮调用同一 command ID；键盘焦点 smoke。

## M0-T06 CI、依赖与里程碑审计

- 依赖：M0-T05
- 需求：NFR-008
- 交付：Windows CI、lockfile 缓存、测试/构建制品、许可证与依赖审计脚本、初始 SBOM；检查文档命令和实际脚本一致。
- 人工门禁：审阅 renderer 权限、依赖许可证、CI 报告和打包窗口。
- 验证：全量 `pnpm check`、E2E、安全、依赖审计；人工通过后状态 `passed`，解锁 M1-T01。
