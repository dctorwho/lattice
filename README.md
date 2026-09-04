# Lattice Markdown 编辑器

本仓库从零独立实现一个面向 Windows 10/11、Markdown 文件无损的桌面编辑器，完整复刻 Typora 1.13.8 的简洁设计风格、单栏混合编辑、界面布局、六套内置主题效果、功能和可观察工作流。产品使用独立名称、图标、代码、CSS、资源和文案；不复制 Typora 的私有实现、主题源文件或品牌素材。

工程规格以 M0–M8 迭代执行。代码实现必须遵守这些文档，而不是临时生成一个 Markdown 原型。

## 文档入口

- [AGENTS.md](AGENTS.md)：Codex 的强制工作规则。
- [文档索引](docs/README.md)：需求、架构、技术栈、界面、数据安全和测试规格。
- [迭代索引](iterations/README.md)：M0–M8 的入口/退出文档和执行方式。
- [迭代状态](iterations/state.json)：唯一的迭代状态来源。
- [Codex CLI 执行手册](docs/11-codex-cli-runbook.md)：迭代运行、验收和恢复方式。

## 固定目标

- 复刻基线：以[版本化公开证据台账](docs/22-typora-1.13.8-windows-evidence-baseline.md)确认的 Typora 1.13.8 Windows 可观察界面和行为。
- 首发系统：Windows 10/11 x64。
- 文件原则：Markdown 原文是唯一持久化真相；未编辑内容不得被重新序列化。
- 首发模式：本地、自用、离线优先；不包含账号、云同步、协作或付费系统。
- 技术路线：Electron + TypeScript + React + CodeMirror 6。

## Codex CLI 启动方式

首次执行前先初始化 Git。之后每次只执行一个迭代：

```powershell
codex exec --sandbox workspace-write "读取 AGENTS.md、iterations/state.json 和 iterations/README.md；选择一个 ready 且依赖 passed 的迭代，读取其三份入口文档。只完成该迭代，开发中运行聚焦测试，退出时运行全部门禁并按状态写报告后停止。"
```

不要使用单条提示词要求 Codex 完成全部 M0–M8。编辑器内核、中文输入法和文件无损性必须在迭代门禁通过后再扩展。
