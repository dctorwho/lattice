# 测试策略

## 1. 质量模型

测试按风险而非文件数量设计。最高优先级依次为：数据完整性、安全边界、编辑事务/IME、导出正确性、性能、视觉一致性。测试通过只能证明其明确覆盖的行为。

## 2. 测试层级

- **单元**：SourceBuffer、EOL、编码、补丁、命令、设置迁移、路径授权、解析适配器。
- **性质测试**：随机文本和编辑序列验证 round-trip、最小修改、undo/redo 和补丁冲突。
- **集成**：真实临时目录中的打开/保存/watcher/恢复/图片事务/Pandoc 进程。
- **组件**：React、菜单状态、设置、块 widget 与可访问性。
- **Electron E2E**：真实 main/preload/renderer、对话框适配、窗口、快捷键、崩溃与导出。
- **黄金输出**：HTML、PDF 文本/结构、图片和 Markdown 字节；可解释地更新基线。
- **人工**：IME、光标手感、显示缩放、打印、主题、外部应用复制粘贴。

## 3. 测试 ID 与套件

实现和证据使用 `docs/test-cases/` 中唯一的 `TC-Mx-nnn`（自动/半自动）与 `MAN-Mx-nnn`（人工）作为稳定用例 ID。下表中的 `DATA-*` 等编号是数据集与兼容追踪编号，可被一个参数化 `TC-*` 展开覆盖，不能单独当作已经设计完成的测试用例。

| 前缀 | 范围 |
| --- | --- |
| DATA | 编码、EOL、原子保存、冲突、恢复和资源事务 |
| EDIT | transaction、selection、IME、undo、输入规则和模式切换 |
| MD | Markdown 解析、投影、块组件和源码补丁 |
| WS | 文件树、大纲、快速打开、全局搜索和 watcher |
| CLIP | 剪贴板格式和智能粘贴 |
| IMG | 图片路径、文件副作用和上传适配 |
| THEME | 主题加载、CSS 隔离和系统模式 |
| EXP | HTML、PDF、图片、打印和 Pandoc |
| IMP | Pandoc 文件导入、资源提取、警告和失败原子性 |
| PREF | 设置、迁移和快捷键 |
| SEC | IPC、CSP、HTML、路径、协议和进程安全 |
| A11Y | 键盘、焦点、名称、对比和缩放 |
| OS | 窗口、单实例、文件关联和命令行 |
| REL | 安装、卸载、签名和更新 |

## 4. 夹具设计

`tests/fixtures/` 必须包含：

- `bytes/`：空文件、UTF-8、BOM、UTF-16、LF、CRLF、混合 EOL、无尾换行、NUL、非法 UTF-8。
- `markdown/basic/`：每种基础语法、嵌套与不完整输入。
- `markdown/advanced/`：表格、脚注、YAML、TOC、Alerts、数学、Mermaid、HTML。
- `markdown/interactions/`：同一区域连续编辑、跨块选择、粘贴、undo/redo 轨迹。
- `security/`：XSS、SVG、协议、路径遍历、符号链接、命令元字符、超大输入。
- `workspace/`：大小写、Unicode、长路径、10,000 文件生成器、忽略和符号链接。
- `export/`：主题、字体、本地/远程资源、分页、页眉页脚和 Pandoc 样例。
- `import/`：自建 DOCX、RTF、EPUB、LaTeX/TeX、RST、Org、Wiki、Textile、OPML，含资源提取、警告、非法路径和超限输出。

每个 fixture 附元数据：编码、预期可见语义、允许修改范围、预期错误和关联需求。

## 5. 数据完整性性质

至少验证：

1. `decode(encode(buffer))` 在受支持编码/EOL 下保持文本与元数据。
2. 未编辑 `open → save` 的字节哈希相同。
3. 编辑区间外的原始字节片段保持相同。
4. `apply(change); undo()` 返回相同 SourceBuffer。
5. 任意过期 revision 的 block patch 被拒绝。
6. 任意保存故障点都保留原文件或已验证的新文件，不能留下截断目标。
7. 恢复最新有效 revision；损坏的最后快照回退上一份。

## 6. 编辑与 IME

自动测试 compositionstart/update/end、beforeinput、selection 和 transaction 分组。人工门禁覆盖微软拼音、至少一种第三方中文输入法、全角标点、候选翻页、长按退格、跨行选词和撤销。组合期间不得重建活动 DOM 或显示重复文字。

## 7. 导出验证

- HTML 使用 DOM 语义、链接、资源和净化断言，不只比较字符串。
- PDF 检查页数、文本、链接、outline、页面尺寸、边距和关键区域截图。
- 图片检查尺寸、透明/背景、缩放和分片拼接。
- Pandoc 通过受控 fake executable 测参数数组，再在可用环境跑真实冒烟。
- 任何导出测试验证源会话 revision 和源码不变。

## 8. 安全测试

- preload 表面快照：只存在批准方法，不能获得原始 Electron 对象。
- IPC schema fuzz、错误 sender、越权窗口、路径逃逸、符号链接和 TOCTOU。
- CSP、导航、新窗口、权限请求、外链协议和自定义 URL。
- HTML/SVG/Math/Mermaid 载荷、超时、内存预算和远程资源阻断。
- Pandoc/上传器使用参数数组并验证 `shell:false`。

## 9. 性能测试

参考机：6 核桌面 CPU、16GB RAM、SSD、Windows 11，关闭调试工具，运行打包构建。记录中位数和 P95：冷启动、1/5/10MB 打开、输入到绘制、模式切换、10,000 文件树、搜索首结果、公式/图表批量渲染、HTML/PDF 导出和峰值内存。

基线回退超过 20% 或违反 NFR 指标时阻断；更新基线必须解释硬件、依赖或功能变化。

## 10. 视觉和无障碍

截图只用于自身 UI 回归，不作为数据或交互正确性证据。覆盖 100/150/200/250% 缩放、浅/深/高对比、窄窗口、长中文文案和焦点状态。axe 自动检查后仍需键盘与屏幕阅读器人工冒烟。

## 11. 命令契约

M0 建立以下脚本，之后任务不得改名而不更新全部文档：

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm test:performance
pnpm build
pnpm check
```

`pnpm check` 至少包含 lint、typecheck、unit、integration 和 build。E2E、安全、性能按任务和里程碑显式运行。

**M0-T01 自举例外**：M0-T01 尚无上述质量脚本，只执行 `pnpm install`、开发窗口 smoke、`pnpm build`、lockfile/产物检查，并保存命令退出码作为 TC-M0-001 证据。M0-T02 建立完整脚本后必须把 TC-M0-001 纳入 `test:integration`；从 M0-T02 起恢复“每任务运行 `pnpm check`”规则。禁止用空脚本或固定成功脚本伪造自举通过。

## 12. 覆盖与反作弊

- 领域与安全模块分支覆盖目标 90%，其他核心模块 80%；覆盖率不是完成条件的替代。
- 禁止 `.skip`、`.only`、宽泛 snapshot、吞异常、无断言测试和为了通过而删除 fixture。
- flaky 测试先隔离根因；不可长期重试掩盖。任何 quarantine 必须有任务 ID、负责人和期限。

## 13. CI 和人工门禁

- 每任务：除上述 M0-T01 自举例外外，在 Windows 当前主环境运行 `pnpm check`。
- 每里程碑：Windows 10/11、100%/150% 缩放的 E2E、安全和性能；依赖/许可证审计。
- M1、M2、M5、M6、M8 有强制人工门禁。结果记录在任务状态 evidence 中，不能由 Codex 自评代替。

## 14. 可执行用例规格

- 每个实现任务必须至少关联一个 [`TC-*`](test-cases/README.md)，每个 `manual_gate:true` 任务必须关联至少一个 `MAN-*`。
- 实现测试前读取对应迭代文件的参数矩阵；矩阵每一行都要成为独立实例，不允许只实现表格中的正常路径。
- 用例的步骤、预期、严重度和证据是验收契约。实现拆分可以调整，但用例 ID 不得复用或静默删除。
- 夹具和环境按[夹具目录](test-cases/fixture-catalog.md)创建；实际 SHA-256 和来源在 M0/M1 实现时补入 manifest。
