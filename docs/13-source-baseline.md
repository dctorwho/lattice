# 官方资料基线

本文件记录资料入口和维护原则。具体可执行观察、适用版本、可信度及 `REF-*` 映射以 [`22-typora-1.13.8-windows-evidence-baseline.md`](22-typora-1.13.8-windows-evidence-baseline.md) 为唯一活跃证据台账。实现迭代必须引用台账，不能只依赖本页链接、二手文章或模型记忆。

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
- Windows：https://support.typora.io/Typora-on-Windows/
- File Management：https://support.typora.io/File-Management/
- Shortcut Keys：https://support.typora.io/Shortcut-Keys/
- Word Count：https://support.typora.io/Word-Count/
- Focus and Typewriter Mode：https://support.typora.io/Focus-and-Typewriter-Mode/
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

## Codex 命令行工具

- `AGENTS.md`：https://developers.openai.com/codex/guides/agents-md
- 非交互模式：https://developers.openai.com/codex/noninteractive
- CLI 命令参考：https://developers.openai.com/codex/cli/reference

## 基线维护规则

- 产品基线固定为 Typora 1.13.8 在 Windows 10/11 上公开可确认的可观察产品表现，只有用户明确批准才能升级。
- 官方支持页面是活文档。每条观察必须记录采集日期、版本适用依据、Windows 适用性和可信度，不能把当前页面全部视为 1.13.8 事实。
- 第三方截图、视频或评测只用于补足官方资料缺口；版本不明确时必须降低可信度并交叉验证。
- 安全修复依赖可在不改变公共行为的前提下升级；升级必须通过完整测试。
- 每次证据修订要在台账增加或更新记录，并同步复刻验收矩阵和测试；不能覆盖历史结论。
