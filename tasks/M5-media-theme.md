# M5：图片、剪贴板、主题与写作模式

必读：[数据安全](../docs/05-data-safety-and-security.md)、[UI 交互](../docs/06-ui-interaction-spec.md)、[设置 schema](../docs/17-settings-and-storage-schema.md)、[用户旅程](../docs/19-user-journeys.md)、[M5 测试用例](../docs/test-cases/M5-media-theme.md)。

## M5-T01 剪贴板契约

- 依赖：M4-T10
- 需求：EDT-010；风险 R-008
- 交付：ClipboardPayload 领域类型、text/plain/text/html/text/markdown/image 优先级、净化边界、命令和测试适配器。
- 验证：CLIP-001..012，空/巨大/恶意 HTML、多个格式和取消。

## M5-T02 智能复制粘贴

- 依赖：M5-T01
- 需求：EDT-010
- 交付：选择复制为富文本/Markdown/HTML/纯文本；HTML 到 Markdown 的受控转换；粘贴为纯文本；单一撤销事务。
- 验证：CLIP-013..045，Word/浏览器/Google Docs 风格夹具、列表/表格/链接/代码、脚本清除和最小补丁。

## M5-T03 图片插入与路径策略

- 依赖：M5-T01
- 需求：IMG-001、IMG-002
- 交付：选择/拖放/剪贴板/URL 插入，相对/绝对/复制目录/`./`/`typora-root-url`，Windows/WSL/UNC 路径处理。
- 验证：IMG-001..030，空格/Unicode/#/@、工作区内外、未命名文档、重复文件名。

## M5-T04 资源事务

- 依赖：M5-T03
- 需求：IMG-003、IMG-005、IMG-006；风险 R-006
- 交付：ResourceTransaction、复制/移动/重命名/回收站删除/重新加载、Markdown patch 提交与文件回滚、冲突 UI。
- 验证：IMG-031..070，注入每个文件/patch 故障，undo 源码与磁盘状态说明，禁止永久误删。

## M5-T05 上传器适配

- 依赖：M5-T04
- 需求：IMG-004；风险 R-008
- 交付：UploadAdapter、PicList/自定义可执行路径能力、参数数组、超时/取消、输出 URL 校验和多文件事务。
- 验证：IMG-071..090、SEC shell 元字符/恶意 URL/挂起进程；默认无网络上传。

## M5-T06 主题系统

- 依赖：M5-T02
- 需求：UI-003、UI-004
- 交付：原创浅/深主题、CSS variables、跟随系统、用户主题目录、热重载、文档作用域、Typora 公开 CSS 约定适配层。
- 验证：THEME-001..040，坏 CSS、远程 URL、主题资源、系统切换、100%–250% 截图；安全对话框不受主题控制。

## M5-T07 写作辅助模式

- 依赖：M5-T02、M5-T06
- 需求：EDT-011、EDT-012
- 交付：焦点、打字机、只读查看、Electron 拼写、Emoji 补全、智能标点、行/段移动；设置可即时切换。
- 验证：EDIT-141..180，模式组合、undo、中文 IME、长文滚动、拼写菜单和只读权限。

## M5-T08 媒体与主题门禁

- 依赖：M5-T05、M5-T07
- 需求：COMP-021..024
- 交付：图片故障矩阵、剪贴板互操作、主题安全和写作模式性能报告。
- 自动验证：check、integration、E2E、security、theme screenshots。
- 人工门禁：Word/浏览器/微信编辑器复制粘贴、拖放/剪贴板图片、移动/删除回滚、自定义主题、焦点/打字机/拼写；通过后解锁 M6-T01。
