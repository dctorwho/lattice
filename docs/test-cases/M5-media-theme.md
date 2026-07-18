# M5 测试用例：图片、剪贴板、主题与写作模式

目标：证明跨应用复制粘贴语义明确，图片文件副作用可解释可回滚，上传器不经 shell，主题隔离安全，写作辅助不破坏编辑事务。

## 自动化与半自动用例

| ID | 任务 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-M5-001 | M5-T01 | unit-security/P0 | PAYLOAD-M5 | 组合 plain/markdown/html/image MIME，含空/超大/恶意值，执行普通/纯文本粘贴和取消 | 优先级确定；先净化再转换；超限拒绝；取消不产生 transaction/文件 | `pnpm test -- tests/unit/domain/clipboard-payload.spec.ts` |
| TC-M5-002 | M5-T02 | integration-e2e/P1 | CLIP-M5 | 从外部风格 fixture 粘贴标题/列表/表格/链接/代码；复制为四种格式；撤销 | 语义符合模式；危险节点属性清除；只改 selection；整个操作单次撤销 | `pnpm test:e2e -- tests/e2e/smart-clipboard.spec.ts` |
| TC-M5-003 | M5-T03 | integration/P0 | IMAGEPATH-M5 | 通过选择/拖放/剪贴板/URL 插入图片，在每种路径策略和命名状态执行 | Markdown 路径按策略最小插入；Unicode/空格/# 正确编码；未命名文档需选择；重复名不覆盖 | `pnpm test:integration -- tests/integration/image-insert.spec.ts` |
| TC-M5-004 | M5-T04 | integration/P0 | FI-RESOURCE × IMGOP-M5 | 复制/移动/重命名/重新加载/删除，在文件操作、source patch、提交和 rollback 注入故障，再 undo | 成功时磁盘/源码一致；失败回滚；无法回滚给出路径；删除默认回收站且有确认 | `pnpm test:integration -- tests/integration/resource-transaction.spec.ts` |
| TC-M5-005 | M5-T05 | integration-security/P0 | UPLOAD-M5 | 用 fake/PicList adapter 上传单/多文件；元字符路径、恶意输出 URL、挂起/大 stderr、取消 | 参数数组和 `shell:false`；默认无网络；只接受批准 URL；超时/取消杀进程；失败不改源码 | `pnpm test:security -- tests/security/upload-adapter.spec.ts` |
| TC-M5-006 | M5-T06 | component-security-visual/P0 | THEME-M5 | 加载内置/用户/坏主题，热重载和跟随系统；尝试远程资源和覆盖对话框；各缩放截图 | 文档主题作用域正确；坏 CSS 可回退；远程策略生效；安全 UI 不受用户 CSS 控制 | `pnpm test:security -- tests/security/theme-isolation.spec.ts` |
| TC-M5-007 | M5-T07 | e2e-performance/P1 | MODE-M5 | 组合焦点/打字机/只读/缩放/拼写/Emoji/智能标点/行段移动，含中文 IME 和长文 | 设置即时切换；只读阻止修改；结构命令可撤销；输入和滚动达预算；拼写菜单可达 | `pnpm test:e2e -- tests/e2e/writing-modes.spec.ts` |
| TC-M5-008 | M5-T08 | regression/P0 | GATE-M5 | 运行剪贴板互操作、图片故障矩阵、主题安全/截图和写作模式性能回归 | COMP-021..024 有证据；无脚本/路径/进程逃逸；无永久误删、源码磁盘分裂或 IME 回归 | `pnpm test:integration -- tests/integration/m5-gate.spec.ts` |
| TC-M5-009 | M5-T02 | security/P0 | CLIP-XSS-M5 | 粘贴含 script/event/SVG/style/data URL/form 的 HTML，再复制到各格式并重开文档 | 不执行/联网；危险内容不进入富文本；纯 Markdown 源码可解释；保存重开无隐藏载荷激活 | `pnpm test:security -- tests/security/clipboard-html.spec.ts` |

## 参数矩阵

- `PAYLOAD-M5`：空、plain only、markdown+plain、html+plain、image+html+plain、未知 MIME、10MB 文本/超大图片、取消。
- `CLIP-M5`：自建浏览器/Word/Google Docs 风格；标题、嵌套列表、任务、表格、链接、代码、图片、换行；智能/纯文本模式。
- `IMAGEPATH-M5`：相对/绝对/复制目录/始终 `./`/`typora-root-url`；已保存/未命名；工作区内外、UNC/WSL、空格/中文/#/@、同名。
- `IMGOP-M5`：PNG/JPEG/GIF/WebP/SVG/损坏/超大；copy/move/rename/reload/trash；目标存在/占用/只读/跨卷/用户取消。
- `UPLOAD-M5`：正常/非零/挂起/超大 stderr fake；文件名含引号/分号/`&`；https/http/file/javascript/data 输出；单/多文件。
- `THEME-M5`：内置浅/深/跟随系统、有效用户 CSS、语法错、缺资源、远程 URL、fixed 高层覆盖、100/150/200/250% 和高对比。
- `MODE-M5`：焦点×打字机×只读×拼写；中文/英文；1/5/10MB；无选区/选区/文档首尾；缩放边界。

## 人工门禁

| ID | 任务 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M5-001 | M5-T08 | Word、浏览器、微信编辑器、ENV-IME | 1. 双向复制标题/列表/链接/表格；2. 普通和纯文本粘贴；3. 拖放/剪贴板插图；4. 移动/删除并故障回滚；5. 加载自定义主题；6. 开启焦点/打字机/拼写连续写作 | 外部语义可接受且无脚本；图片路径和回滚正确；主题不遮挡安全 UI；写作模式无 IME/滚动异常 | 外部应用版本、样本、磁盘清单、源码 diff、截图/录屏和签署结论 |

## 证据与停止条件

保存剪贴板 MIME 摘要（不含私人正文）、资源事务日志、进程参数数组、主题网络请求和截图基线。永久误删、源码/磁盘分裂、剪贴板脚本执行、上传 shell 注入或主题隐藏安全确认均为 P0。
