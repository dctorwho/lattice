# 迭代测试用例总则

本目录把 `tasks/M0-*.md` 至 `tasks/M8-*.md` 中的验证范围展开为 Codex CLI 可直接实现的测试规格。任务文件里的 `DATA-001..025` 等编号是历史数据集范围；本目录的 `TC-Mx-nnn` 和 `MAN-Mx-nnn` 才是稳定、唯一的用例 ID。

## 1. 用例执行规则

每个表格行都是一个参数化用例。`数据/环境` 引用该迭代的参数矩阵；矩阵中的每一行必须成为独立测试实例，测试名称包含用例 ID 和参数 ID。不得只挑“正常”样本。

字段含义：

- **任务**：唯一负责实现该用例的任务；任务不得在用例未通过时标记 `passed`。
- **层级**：`unit`、`property`、`integration`、`component`、`e2e`、`golden`、`performance`、`security`。
- **P0/P1/P2**：失败严重度；P0 立即停止功能开发，P1 阻断任务或里程碑，P2 可在有明确任务时进入缺陷列表。
- **步骤**：按给定顺序执行，不得用快照替代有明确语义的断言。
- **预期**：全部断言必须同时成立；异常路径也必须验证状态和副作用。
- **自动化**：建议的测试目标和文件名；实现时可以拆文件，但不能改变用例 ID。

“自动化”列必须写成可直接执行的 `<pnpm 脚本> -- <tests/.../*.spec.ts>`，例如 `pnpm test:integration -- tests/integration/open-file.spec.ts`。冒号只属于 package script 名；文件路径必须从 `tests/` 开始，不得使用 `test:integration/foo.spec.ts` 这类把脚本与路径混在一起的简写。

## 2. 共同前置条件

1. 自动测试使用隔离临时目录、固定时钟和可注入文件系统/对话框/进程/watcher。
2. E2E 使用打包或接近生产的 Electron 配置；安全测试不得在开发服务器宽松 CSP 下取证。
3. 每个涉及文档的用例记录执行前后 `source`、`revision`、`savedRevision`、磁盘哈希和允许变化范围。
4. 每个涉及文件副作用的用例记录临时文件、备份、资源文件和恢复记录的最终状态。
5. 网络默认禁用；需要远程行为时只连接本地受控测试服务器。
6. 视觉快照只证明视觉回归，不证明数据、光标、命令或安全正确。

## 3. 证据格式

自动化证据写入 `artifacts/test-results/<milestone>/<case-id>/`，至少包含结构化结果、环境、参数 ID、版本和失败诊断。人工证据写入 `artifacts/manual/<milestone>/<case-id>.md`，包含操作者、日期、系统/输入法/显示环境、逐步结果、截图或哈希以及最终结论。

人工用例只能由用户或指定验收人批准。Codex 可以准备步骤、收集自动证据并将任务设为 `awaiting_manual`，不得自行填写通过结论。

## 4. 完成定义

- 任务完成：该任务关联的全部 `TC-*` 通过，无被跳过或无期限 quarantine。
- 人工门禁完成：关联 `MAN-*` 有真实证据且结论通过。
- 里程碑完成：全部任务用例、里程碑回归和人工门禁通过，P0/P1 为零。
- 参数、预期或产品契约改变时，先更新用例和追踪，再修改实现。

## 5. 迭代索引

| 迭代 | 测试规格 |
| --- | --- |
| M0 | [工程基础](M0-foundation.md) |
| M1 | [无损文件与源码编辑](M1-document-core.md) |
| M2 | [单栏混合编辑内核](M2-hybrid-editor.md) |
| M3 | [工作区与桌面壳](M3-workspace-shell.md) |
| M4 | [高级 Markdown](M4-advanced-markdown.md) |
| M5 | [图片、剪贴板、主题与写作模式](M5-media-theme.md) |
| M6 | [导入、导出与打印](M6-export.md) |
| M7 | [设置、兼容与质量收口](M7-parity-hardening.md) |
| M8 | [Windows 发布](M8-windows-release.md) |

夹具和环境命名见[夹具目录](fixture-catalog.md)。
