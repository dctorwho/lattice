# 测试夹具与环境目录

本文件定义测试数据，不创建产品代码。M0 建立 `tests/fixtures/manifest.json` 时必须按此目录生成，且每个实体文件记录 SHA-256、编码、EOL、预期语义、允许变化范围、关联需求和许可证/来源。

## 1. 固定夹具族

| ID | 目标路径 | 内容与变体 | 核心断言 |
| --- | --- | --- | --- |
| FX-BYTE | `tests/fixtures/bytes/` | empty、UTF-8、UTF-8 BOM、UTF-16LE/BE BOM；LF、CRLF、混合 EOL；有/无尾换行；NUL、非法 UTF-8 | 未编辑哈希不变；未知编码只读；逐行 EOL 保留 |
| FX-MD-BASIC | `tests/fixtures/markdown/basic/` | 段落、ATX/Setext、引用、列表、任务、分隔线、围栏/缩进代码、全部行内语法；嵌套和未闭合 | 可见语义正确；进入源码可编辑；显示不改源码 |
| FX-MD-ADV | `tests/fixtures/markdown/advanced/` | YAML、TOC、Alerts、表格、脚注、引用、公式、Mermaid、HTML/视频 | adapter 失败回退；最小补丁；恶意内容隔离 |
| FX-EDIT | `tests/fixtures/markdown/interactions/` | composition、跨块选择、连续 undo、粘贴、模式切换、随机操作种子 | 选择映射、事务分组和源码哈希符合轨迹 |
| FX-SEC | `tests/fixtures/security/` | XSS/SVG、危险协议、路径遍历、symlink、shell 元字符、超大 Math/Mermaid/正则/图片 | 无权限逃逸、执行、越界读写或无限资源占用 |
| FX-WS | `tests/fixtures/workspace/` | Unicode、空格、`#`、大小写碰撞、长路径、隐藏/忽略、symlink、二进制、10,000 文件生成器 | 只在授权根内；可取消；不阻塞输入 |
| FX-CLIP | `tests/fixtures/clipboard/` | plain/markdown/html/image，多 MIME；浏览器、Word、Google Docs 风格和恶意 HTML | 格式优先级、净化、单次撤销 |
| FX-IMG | `tests/fixtures/images/` | PNG/JPEG/GIF/WebP/SVG、透明、EXIF 旋转、超大/损坏、Unicode 文件名 | 路径正确；资源事务可回滚；不执行 SVG |
| FX-THEME | `tests/fixtures/themes/` | 有效浅/深、自定义资源、坏 CSS、远程 URL、覆盖安全 UI 尝试 | 作用域隔离；安全 UI 不受控；网络策略生效 |
| FX-EXP | `tests/fixtures/export/` | 综合文档、字体、分页、页眉脚、缺失资源、主题、Pandoc 导出样例 | HTML/PDF/图片语义和尺寸；源会话不变 |
| FX-IMP | `tests/fixtures/import/` | 自建 DOCX、RTF、EPUB、LaTeX/TeX、RST、Org、MediaWiki/DokuWiki、Textile、OPML；含图片、警告、非法资源路径和超限输出 | 源哈希不变；成功创建未命名 Markdown；资源受 staging 约束；失败无部分会话 |
| FX-PREF | `tests/fixtures/settings/` | 所有 schema 版本、缺字段、未知字段、损坏 JSON、快捷键冲突 | 可迁移、可恢复、无假设置 |
| FX-REL | `tests/fixtures/release/` | 旧版 userData、更新 feed、签名错误、安装升级卸载脚本数据 | 不删用户文档；失败回滚；签名和哈希可核验 |

## 2. 受控环境

| ID | 环境 |
| --- | --- |
| ENV-WIN10 | 干净 Windows 10 x64 VM，100%/150% 缩放，普通用户 |
| ENV-WIN11 | Windows 11 x64 参考机，6 核 CPU、16GB RAM、SSD，100%/150%/200%/250% |
| ENV-OFFLINE | 网络接口禁用，DNS/HTTP 不可达 |
| ENV-SYNC | OneDrive 风格 watcher 事件风暴模拟器和真实同步目录人工环境 |
| ENV-PANDOC | 无 Pandoc、最低支持版、当前支持版、未知新版、fake executable |
| ENV-PRINT | 系统 PDF 打印机和至少一台真实打印机 |
| ENV-IME | 微软拼音及至少一种第三方中文 IME；英文键盘作为对照 |

## 3. 故障注入点

| ID | 注入位置 | 必须保持的不变量 |
| --- | --- | --- |
| FI-SAVE | create temp、write、fsync、backup、replace、verify、cleanup | 目标始终是完整旧文件或完整且已验证的新文件 |
| FI-RECOVERY | temp write、rotate、replace、checksum、scan | 最新有效 revision 可恢复；坏快照不阻断其他会话 |
| FI-RESOURCE | preflight、copy/move、source patch、commit log、rollback | 源码与磁盘不分裂；无法回滚时给出具体修复路径 |
| FI-EXPORT | parse、resource、render-ready、write、rename、cancel | 源会话不变；无未说明的半成品 |
| FI-PROCESS | spawn、stdout/stderr、timeout、cancel、exit | `shell:false`；子进程终止；正文不进入日志 |

## 4. 生成规则

- 随机测试固定种子并在失败时输出最小反例；CI 至少运行 100 个种子，M2/M4 门禁运行 10,000 组编辑序列。
- 10,000 文件工作区由生成器创建，不把生成结果提交仓库；生成器清单固定目录深度、扩展比例、Unicode 和忽略规则。
- PDF/图片黄金文件按渲染引擎、字体包和缩放分组；基线更新必须附语义差异说明。
- 外部格式样本只使用可再分发的自建样本，不提交第三方私有文档。
