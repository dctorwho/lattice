# Lattice Markdown Editor

本仓库用于从零开发一个 Windows 优先、Markdown 文件无损、功能与工作流对齐 Typora 1.13.8 的桌面编辑器。产品使用独立名称、图标、主题和文案；不复制 Typora 的源码、默认主题或品牌素材。

当前仓库首先提供一套可供 Codex CLI 按任务实施的工程规格。实现代码必须以这些文档为约束，而不是临时生成一个 Markdown 原型。

## 文档入口

- [AGENTS.md](AGENTS.md)：Codex CLI 的强制工作规则。
- [文档索引](docs/README.md)：需求、架构、技术栈、界面、数据安全和测试规格。
- [任务索引](tasks/README.md)：M0–M8 的完整任务依赖图与执行顺序。
- [Codex CLI 执行手册](docs/11-codex-cli-runbook.md)：逐任务运行、验收和恢复方式。
- [任务状态](tasks/state.json)：唯一的任务状态来源。

## 固定目标

- 兼容基线：Typora 1.13.8 官方公开文档描述的功能。
- 首发系统：Windows 10/11 x64。
- 文件原则：Markdown 原文是唯一持久化真相；未编辑内容不得被重新序列化。
- 首发模式：本地、自用、离线优先；不包含账号、云同步、协作或付费系统。
- 技术路线：Electron + TypeScript + React + CodeMirror 6。

## Codex CLI 启动方式

首次执行前先初始化 Git。之后每次只执行一个任务：

```powershell
codex exec --sandbox workspace-write "读取 AGENTS.md、tasks/state.json 和 tasks/M0-foundation.md；执行第一个状态为 ready 的任务。只完成该任务，运行其全部验收并停止。"
```

不要使用单条提示词要求 Codex 完成全部 M0–M8。编辑器内核、中文输入法和文件无损性必须在阶段门禁通过后再扩展。
