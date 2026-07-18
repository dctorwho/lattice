# M6 测试用例：导入、导出与打印

目标：证明所有导出基于只读会话快照，HTML/PDF/图片可离线正确生成，打印与 PDF 契约一致，Pandoc 可选且进程安全，失败/取消不影响源文档。

## 自动化与半自动用例

| ID | 任务 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-M6-001 | M6-T01 | integration-security/P0 | PIPE-M6 × FI-EXPORT | 快照 session，解析/资源/主题/公式/图表/稳定信号/写入各阶段注入失败或取消 | 全程只读；导出前后 source/revision/hash/history 相同；取消终止；错误不影响编辑窗口 | `pnpm test:integration -- tests/integration/render-document.spec.ts` |
| TC-M6-002 | M6-T02 | golden-security/P0 | HTML-M6 | 导出带主题/纯 HTML、大纲、内联/外链资源、受控 head/body，离线独立打开并解析 DOM | 语义节点/锚点/UTF-8 正确；资源策略符合设置；危险内容净化；无网络依赖 | `pnpm test:integration -- tests/integration/golden/html-export.spec.ts` |
| TC-M6-003 | M6-T03 | golden-e2e/P1 | PDF-M6 | 对纸张/方向/边距/缩放/背景/主题/页眉脚/h1 分页/outline 导出；抽取文本/链接并测页面 | 页数、尺寸、文本、链接、outline 和关键区域符合预期；中文字体可用；失败无半成品 | `pnpm test:integration -- tests/integration/golden/pdf-export.spec.ts` |
| TC-M6-004 | M6-T03 | e2e/P1 | PRINT-M6 | 从同一 RenderDocument 预览并调用系统打印；分别取消、打印机错误和成功 | 预览与 PDF 样式契约一致；取消无错误/半成品；错误可操作；源会话不变 | `pnpm test:e2e -- tests/e2e/print.spec.ts` |
| TC-M6-005 | M6-T04 | golden-performance/P1 | IMAGE-M6 | 导出整文档/选区 PNG/JPEG，改变比例/质量/背景/主题；超长文档分片并取消 | 像素尺寸和背景正确；分片无缝；公式/图表完整；超过上限诊断；内存达预算 | `pnpm test:integration -- tests/integration/golden/image-export.spec.ts` |
| TC-M6-006 | M6-T05 | unit-e2e/P1 | EXPPREF-M6 | 保存/迁移每格式设置，重复上次导出；目标失效/外部覆盖；授权/拒绝 YAML 设置 | 格式设置隔离；覆盖前校验确认；恶意 YAML 不执行；迁移确定；取消不改记忆 | `pnpm test:e2e -- tests/e2e/export-settings.spec.ts` |
| TC-M6-007 | M6-T06 | integration-security/P0 | PROCESS-M6 × FI-PROCESS | 探测 fake/缺失/支持/未知 Pandoc；含元字符路径；超时/取消/大 stderr | `spawn(exe,args,{shell:false})`；缺失只禁用 Pandoc；未知版清晰降级；进程和临时目录清理 | `pnpm test:security -- tests/security/pandoc-process.spec.ts` |
| TC-M6-008 | M6-T07 | integration-golden/P1 | PANDOC-M6 | 用 fake 断言 DOCX/ODT/RTF/EPUB/LaTeX 参数，再用真实版本生成并由目标应用打开 | 参数/metadata/reference doc/白名单正确；资源可用；输出可打开；失败不影响核心导出 | `pnpm test:integration -- tests/integration/pandoc-formats.spec.ts` |
| TC-M6-009 | M6-T09 | regression-performance/P0 | GATE-M6 | 在有/无 Pandoc、离线和只读目标环境运行全量导入导出、安全、性能和黄金回归 | COMP-025..029 有证据；核心格式无 Pandoc 可用；无源码变化、源文件改写、注入或未说明半成品 | `pnpm test:performance -- tests/performance/m6-gate.spec.ts` |
| TC-M6-010 | M6-T08 | integration-security/P0 | PANDOCIMPORT-M6 | 通过选择器导入每种支持格式；测试图片提取、警告、首次另存、取消、缺失 Pandoc、非法资源路径、超限和非零退出 | 源文件哈希不变；成功仅创建未命名 Markdown 会话；staging 资源受限且首次保存原子提交；失败/取消不创建部分会话或残留进程 | `pnpm test:integration -- tests/integration/pandoc-import.spec.ts` |

## 参数矩阵

- `PIPE-M6`：基础/高级/坏 Markdown，缺失/本地/远程资源，公式/图表成功/超时；clean/dirty session；每个 FI-EXPORT 点。
- `HTML-M6`：带主题/纯 HTML，大纲开关，CSS/图片内联或相对，公式/表格/脚注/Mermaid/HTML，自定义 head/body 安全/恶意，ENV-OFFLINE。
- `PDF-M6`：A4/A5/Letter/自定义，纵/横，0/常用/边界边距，50/100/200% 缩放，浅/深，背景，中文/Emoji，页眉脚和 h1 分页。
- `PRINT-M6`：系统 PDF 打印机、真实打印机人工；取消、无打印机、离线打印机、驱动错误。
- `IMAGE-M6`：PNG/JPEG，整文档/选区，1x/2x/3x，透明/白/主题背景，质量边界，1/10/100 页等长内容，取消。
- `EXPPREF-M6`：首次/已有/损坏/旧 schema；不同格式；目标不存在/只读/被外部修改；YAML 未授权/授权/恶意参数。
- `PROCESS-M6`：无 executable、最低/当前/未知版 fake，路径含空格/中文/引号/元字符；挂起、非零、大 stdout/stderr、取消。
- `PANDOC-M6`：DOCX/ODT/RTF/EPUB/LaTeX；metadata/reference doc/允许参数；公式/图表/本地图片；最低和当前支持版本。
- `PANDOCIMPORT-M6`：使用 FX-IMP 的 DOCX/RTF/EPUB/LaTeX/TeX/RST/Org/MediaWiki/DokuWiki/Textile/OPML；无资源/多图片/同名图片/转换警告；路径遍历/symlink/超限文件数与总大小；取消、非零退出、坏 UTF-8 输出；无/最低/当前/未知 Pandoc。

## 人工门禁

| ID | 任务 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M6-001 | M6-T03 | ENV-PRINT | 1. 打印综合文档到系统 PDF；2. 在真实打印机打印含中文、表格和分页的页；3. 取消一次；4. 模拟打印错误 | 纸张/边距/分页/中文与预览一致；取消无副作用；错误可恢复；源文档不变 | 打印机/驱动、设置、扫描/照片、PDF 哈希和源哈希 |
| MAN-M6-002 | M6-T09 | 浏览器、PDF 阅读器、Word/LibreOffice、EPUB 阅读器 | 1. 离线打开 HTML；2. 查看/打印 PDF；3. 检查长图；4. 打开 DOCX/ODT/RTF/EPUB；5. 导入 DOCX/RTF/EPUB/RST 并首次另存；6. 移除 Pandoc 重跑核心导出和 Markdown 打开 | 所有目标可打开且语义完整；导入源哈希不变、结果可编辑、资源随首次保存提交；离线资源可用；无 Pandoc 不影响 HTML/PDF/图片和 Markdown 打开；源 revision/hash 不变 | 环境版本、产物/导入源哈希、staging 清单、截图和签署结论 |

## 证据与停止条件

保存源会话前后快照、导入源/导出产物 SHA-256、DOM/PDF/图片语义报告、staging 清单、渲染环境和 Pandoc 参数数组。导出改变源会话、导入改写源文件或创建部分会话、资源路径逃逸、执行不可信内容、无 Pandoc 导致核心失败、取消不终止或产生未说明半成品均阻断 M6。
