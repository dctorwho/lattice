# M6：导入、导出与打印

必读：[架构](../docs/03-architecture.md)、[公共契约](../docs/15-public-contracts.md)、[错误目录](../docs/18-error-catalog.md)、[用户旅程](../docs/19-user-journeys.md)、[安全](../docs/05-data-safety-and-security.md)、[M6 测试用例](../docs/test-cases/M6-export.md)。

## M6-T01 RenderDocument 管线

- 依赖：M5-T08
- 需求：EXP-001..008
- 交付：只读会话快照、统一 feature registry、资源解析、净化、主题、公式/图表稳定信号、隔离 export renderer 和取消。
- 验证：EXP-001..015，导出前后 session revision/source/hash 不变，离线资源完整，失败不影响编辑窗口。

## M6-T02 HTML 与纯 HTML

- 依赖：M6-T01
- 需求：EXP-001、EXP-002
- 交付：完整 HTML/无样式 HTML、主题、大纲、meta、可选资源内联、受控 append head/body 和语义锚点。
- 验证：EXP-016..045 DOM 断言、公式/图表/表格/脚注/本地图片、CSP/XSS、UTF-8 和独立打开。

## M6-T03 PDF 与打印

- 依赖：M6-T01、M6-T02
- 需求：EXP-003、EXP-008；风险 R-010
- 交付：`printToPDF`、A 系列/Letter/自定义纸张、方向、边距、缩放、背景、主题、页眉页脚、h1 分页、outline 和系统打印。
- 验证：EXP-046..085，页数/尺寸/文本/链接/关键截图、中文字体、暗色主题、取消和打印错误。
- 人工：至少一台真实打印机或系统 PDF 打印验证。

## M6-T04 图片导出

- 依赖：M6-T01
- 需求：EXP-004
- 交付：整文档/选区 PNG/JPEG、像素比例、质量、背景、主题、超高文档分片与拼接、尺寸上限诊断。
- 验证：EXP-086..105，尺寸/透明/缩放/长图/公式/图表、内存预算和取消。

## M6-T05 导出设置和上次导出

- 依赖：M6-T02、M6-T03、M6-T04
- 需求：EXP-006、EXP-007
- 交付：每格式版本化设置、目标记忆、再次导出、覆盖上次目标确认、经授权 YAML 覆盖和导出后动作。
- 验证：EXP-106..130，路径失效/格式变化/外部覆盖/YAML 恶意值；设置迁移。

## M6-T06 Pandoc 探测与进程适配

- 依赖：M6-T01
- 需求：EXP-005；风险 R-009
- 交付：用户路径选择、版本探测、受支持范围、`spawn shell:false`、参数 builder、临时目录、取消/超时、fake executable；缺失状态 UI。
- 验证：EXP-131..155、SEC 参数注入/恶意路径/挂起/大 stderr；无 Pandoc 时核心 check 全绿。

## M6-T07 Pandoc 格式

- 依赖：M6-T06
- 需求：EXP-005、EXP-007
- 交付：DOCX/ODT/RTF/EPUB/LaTeX 导出 adapters、reference doc、metadata、额外参数白名单和图表/公式资源桥接。
- 验证：EXP-156..205，fake 参数与真实 Pandoc 冒烟；用目标应用打开导出样例；未知版本清晰降级。

## M6-T08 Pandoc 导入

- 依赖：M6-T06
- 需求：EXP-009
- 交付：DOCX、RTF、EPUB、LaTeX/TeX、RST、Org、MediaWiki/DokuWiki、Textile、OPML 导入 adapters；输出经校验后创建未命名 Markdown 会话，提取资源使用 staging ID 并在首次保存时通过资源事务提交；加入 RecoveryMeta V2 与 V1→V2 迁移，源文件始终只读。
- 验证：IMP-001..030，fake 参数与真实 Pandoc 冒烟；源哈希不变，取消/失败不创建部分会话，资源路径不能逃逸，首次保存提交和崩溃恢复可用，V1 恢复记录迁移不丢正文。

## M6-T09 导入导出门禁

- 依赖：M6-T05、M6-T07、M6-T08
- 需求：COMP-025..029、NFR-007
- 交付：导入/导出黄金集、离线报告、打印/Pandoc 版本矩阵、安全报告和错误文案。
- 自动验证：check、E2E、security、import/export performance；无 Pandoc 与有 Pandoc 两环境。
- 人工门禁：HTML 浏览器、PDF 阅读器/打印、长图、Word/LibreOffice/EPUB 阅读器及 Pandoc 导入；通过后解锁 M7-T01。
