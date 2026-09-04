# M0 出口报告

## 迭代上下文

- 迭代： `M0`
- 状态权威： [`iterations/state.json`](../state.json)
- 证据来源： [`04-test-report.md`](04-test-report.md)
- 最终自动产品候选：
  `3c4ae5d7f268165409570da5dc5d603e4149fda0`
- 自动证据交接候选：
  `ca29d806cbfda6cc6a961f7461d3b2ce7a9654ca`

## 需求完成矩阵

| 全局 ID | 要求结果                                                                      | 完成证据                                                                                     | 结果   |
| ------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| NFR-007 | M0 核心外壳、构建、打包和原生输出不需要运行时 CDN 或网络依赖。                | `04-test-report.md` 中重复离线自举、冻结安装、本地打包运行和 GitHub Quality 打包门禁证据。   | passed |
| NFR-008 | M0 建立严格、可替换的工程边界和依赖注入测试接缝，不声称后续功能专用适配器。   | `04-test-report.md` 中故障注入质量矩阵、严格 IPC 契约、命令注册表测试和隔离自举/审计辅助器。 | passed |
| NFR-009 | M0 结构化诊断和 IPC 失败保持受限，并脱敏文档内容、完整路径和剪贴板正文。      | `04-test-report.md` 中共享契约、值预算、脱敏日志、安全和打包应用证据。                       | passed |
| UI-001  | 独立品牌 Electron 外壳提供 M0 标题栏、侧栏控件、编辑区、状态区和 About 表面。 | `04-test-report.md` 中命令/窗口单元与 Electron E2E 证据及 MAN-M0-001。                       | passed |
| UI-002  | 原生菜单、渲染器按钮、右键菜单和快捷键共享一个命令标识及确定的状态/焦点行为。 | `04-test-report.md` 中命令注册表组件测试、原生菜单投影测试和 Electron E2E 证据。             | passed |

## 最终交付物

- 可复现 pnpm、TypeScript、Electron 和 Vite 自举，具有冻结和离线验证路径。
- 沙箱化生产 Electron 外壳、严格 CSP/导航/权限策略、经确认外链处理，且渲染器没有原始 Node/Electron 权限。
- 经 Zod 校验的类型化 IPC 契约、受限序列化、稳定/脱敏失败和冻结 preload API。
- 投影到原生菜单、渲染器控件、右键菜单和快捷键的统一命令注册表，以及本地化可访问外壳界面。
- Windows x64 NSIS 和 unpacked 包、打包应用测试、确定性品牌资源、依赖/许可证/漏洞证据和 CycloneDX SBOM。
- 固定 SHA 的 Quality、CodeQL 和 Dependency Review 工作流，以及要求三项检查且没有绕过参与者的活跃 main ruleset。

## 重要实现与文档变更

- 建立应用自举、严格 build/test/lint/typecheck 命令和隔离的故障敏感测试工具。
- 增加 Electron main/preload/renderer 安全边界、类型化共享契约和后续迭代使用的命令/窗口外壳基础。
- 增加确定性打包配置并复用本地 Electron 分发，使打包不重复下载已固定运行时。
- 增加生产与工具链依赖审计、许可证审阅、SBOM、产物哈希、工作流策略验证和打包应用执行。
- 用 M0–M8 迭代生命周期、受控入口/出口报告和失败关闭规划验证替换过时任务级治理。

## 自动化门禁结论

八个 M0 自动用例全部通过。最终本地 `pnpm.cmd check` 通过格式、lint、严格类型检查、`445/445` 单元测试、`38/38` 集成测试和生产构建。Electron E2E 通过 `3/3`，安全通过 `2/2`，打包应用通过 `1/1`，六步 M0 审计通过。

对于自动产品候选，GitHub Quality 运行
[`31888333255`](https://github.com/dctorwho/lattice/actions/runs/31888333255),
CodeQL run
[`31888333231`](https://github.com/dctorwho/lattice/actions/runs/31888333231)
和 Dependency Review 运行
[`31888333221`](https://github.com/dctorwho/lattice/actions/runs/31888333221)
均通过。后续自动证据交接候选也通过 Quality 运行
[`31889656495`](https://github.com/dctorwho/lattice/actions/runs/31889656495),
CodeQL run
[`31889657754`](https://github.com/dctorwho/lattice/actions/runs/31889657754)
和 Dependency Review 运行
[`31889658419`](https://github.com/dctorwho/lattice/actions/runs/31889658419).
在活跃 ruleset
[`20752831`](https://github.com/dctorwho/lattice/rules/20752831) 下，PR #1 为 `MERGEABLE / CLEAN`。

## 人工门禁结论

MAN-M0-001 已通过。2026-08-15，用户报告未观察到问题，并以所有已设计迭代测试用例通过为条件接受候选。受控自动结果表和两次 GitHub 候选运行证明该条件。评估人结论、包哈希、审计报告、SBOM 和必需检查证明保留在 `04-test-report.md`。

## 已知限制与剩余风险

- 当前 Windows 包是工程/M0 候选，不是公开代码签名的 M8 发布；Windows 发布信任和签名仍分配给 M8。
- M0 不实现文档生命周期、CodeMirror 文档权威、混合编辑、工作区、高级 Markdown、媒体/主题、导出或最终复刻加固；这些仍明确分配给 M1–M8。
- 审计、SBOM 和产物哈希只适用于该候选；依赖、打包或工作流变更后必须重新生成。

## 回滚方法

如果 M0 合并造成回归，把 PR 合并作为一次可审计 main 分支变更回退，不重写历史。保留失败候选的日志、哈希和审计产物，通过回退恢复上一锁文件和打包配置，为观察到的失败增加回归测试，并在尝试修复候选前重新打开 M0。M0 没有引入需要数据回滚的用户文档 schema 或迁移。

## 向下一迭代释放的输入

- M1 可以在沙箱 Electron 窗口、冻结类型化 preload 表面、严格共享契约模式和统一命令注册表上构建。
- M1 继承可复现 pnpm/build/test 工具、Windows Electron 集成夹具、质量工作流和必需 main 分支门禁。
- M1 必须把 Markdown 源字符串和字节保留为文档权威，只引入窄授权文件 IPC，并保持 M0 渲染器权限边界。
- M1 必须独立证明无损文件生命周期、恢复、编码、CodeMirror、IME 和性能需求；M0 证据不能预先替其通过。

## 最终迭代结论

结论：passed
