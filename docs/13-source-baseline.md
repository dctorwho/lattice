# 官方资料基线

本文件记录规划依据。实现任务应优先引用官方文档，避免依赖二手文章或模型记忆。

## Typora

- 稳定版本 1.13.8：https://typora.io/releases/stable
- Quick Start：https://support.typora.io/Quick-Start/
- Markdown Reference：https://support.typora.io/Markdown-Reference/
- Export：https://support.typora.io/Export/
- Pandoc 导入导出：https://support.typora.io/Install-and-Use-Pandoc/
- Outline：https://support.typora.io/Outline/
- YAML Front Matter：https://support.typora.io/YAML/
- Themes：https://support.typora.io/About-Themes/
- Math：https://support.typora.io/Math/
- Diagrams：https://support.typora.io/Draw-Diagrams-With-Markdown/
- Tables：https://support.typora.io/Table-Editing/
- Copy and Paste：https://support.typora.io/Copy-and-Paste/
- Electron 公开线索：https://support.typora.io/What%27s-New-0.9.66/

## 技术组件

- Electron 文档：https://www.electronjs.org/docs/latest/
- Electron 安全：https://www.electronjs.org/docs/latest/tutorial/security
- Electron `printToPDF`：https://www.electronjs.org/docs/latest/api/web-contents/#contentsprinttopdfoptions
- electron-vite：https://electron-vite.org/guide/
- CodeMirror 6：https://codemirror.net/docs/guide/
- ProseMirror（被评估但不作为持久化模型）：https://prosemirror.net/docs/guide/
- MathJax 4：https://docs.mathjax.org/en/latest/web/hosting.html
- Mermaid：https://mermaid.js.org/
- Pandoc：https://pandoc.org/MANUAL.html

## Codex CLI

- `AGENTS.md`：https://developers.openai.com/codex/guides/agents-md
- 非交互模式：https://developers.openai.com/codex/noninteractive
- CLI 命令参考：https://developers.openai.com/codex/cli/reference

## 基线维护规则

- 本文件的功能基线只在用户明确批准时升级。
- 安全修复依赖可在不改变公共行为的前提下升级；升级必须通过完整测试。
- 每次基线升级要在兼容矩阵增加差异记录，不能覆盖历史结论。
