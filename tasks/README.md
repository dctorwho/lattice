# Codex 实施任务索引

## 1. 执行规则

- `state.json` 是唯一状态来源；一次只允许一个 `in_progress`。
- `state.schema.json` 固定状态文件结构；状态更新必须同时满足 schema 与依赖规则。
- 用户明确指定任务时只能执行该任务；未指定时选择第一个 `ready` 且依赖全部 `passed` 的任务。
- 任务文件的“交付”和“验证”都是完成条件，不能只完成代码部分。
- 有人工门禁的任务自动测试通过后进入 `awaiting_manual`，Codex 不能自行标记 `passed`。
- 只有直接后继任务可在依赖全部通过后变为 `ready`。

## 2. 任务文件

| 文件 | 内容 |
| --- | --- |
| [M0-foundation.md](M0-foundation.md) | 工程、质量、安全壳与基础契约 |
| [M1-document-core.md](M1-document-core.md) | 无损文件、恢复与源码编辑器 |
| [M2-hybrid-editor.md](M2-hybrid-editor.md) | 单栏混合编辑内核 |
| [M3-workspace-shell.md](M3-workspace-shell.md) | 工作区、侧栏、菜单和搜索 |
| [M4-advanced-markdown.md](M4-advanced-markdown.md) | 表格、公式、图表、YAML、HTML |
| [M5-media-theme.md](M5-media-theme.md) | 图片、剪贴板、主题与写作模式 |
| [M6-export.md](M6-export.md) | HTML、PDF、图片、打印和 Pandoc 导入导出 |
| [M7-parity-hardening.md](M7-parity-hardening.md) | 设置、快捷键、i18n、a11y、性能与兼容收口 |
| [M8-windows-release.md](M8-windows-release.md) | Windows 安装、关联、更新和发布 |
| [TASK_TEMPLATE.md](TASK_TEMPLATE.md) | 新任务模板 |

## 3. 任务提示词

```text
执行 <TASK-ID>。先读取 AGENTS.md、tasks/state.json、任务所在文件及其引用文档。
只完成该任务，不实现后继功能。先确认依赖 passed，将状态改为 in_progress；
完成交付和全部自动验证。若有人工门禁，设为 awaiting_manual，否则设为 passed。
仅解锁直接后继并停止，报告证据和剩余风险。
```

## 4. 状态证据

每个任务的 `evidence` 至少记录：运行命令、退出码、关键测试/报告路径、人工验收日期与结果。不要粘贴冗长日志或文档正文。
