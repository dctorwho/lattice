# M2：单栏混合编辑内核

必读：[架构](../docs/03-architecture.md)、[UI 交互](../docs/06-ui-interaction-spec.md)、[Markdown 配置](../docs/20-markdown-compatibility-profile.md)、[测试](../docs/09-test-strategy.md)、[M2 测试用例](../docs/test-cases/M2-hybrid-editor.md)。

## M2-T01 混合投影框架

- 依赖：M1-T10
- 需求：EDT-001、EDT-003、EDT-004
- 交付：HybridProjection、RevealController、block adapter registry、source patch revision/hash 校验、源码回退和模式 compartment。
- 验证：EDIT-036..050；装饰重建不进入历史，过期补丁拒绝，解析失败显示源码。

## M2-T02 段落、标题与引用

- 依赖：M2-T01
- 需求：MD-001
- 交付：标题/段落/引用样式，光标附近标记显隐，空块和不完整标记处理。
- 验证：MD-001..012，selection 进入/离开、跨块选择、Setext、嵌套引用。

## M2-T03 行内标记

- 依赖：M2-T02
- 需求：MD-002、MD-003
- 交付：强调、粗体、删除、代码、高亮、上下标、下划线 decorations 与嵌套优先级。
- 验证：MD-013..032，重叠/不闭合/转义/Unicode；源码字节不因显示改变。

## M2-T04 列表和任务

- 依赖：M2-T02
- 需求：MD-001、EDT-007
- 交付：有序/无序/任务列表，缩进、回车续项、空项退出、Tab/Shift+Tab 和 checkbox 最小补丁。
- 验证：MD-033..055、EDIT-051..065，保留原 marker 和编号风格，嵌套 undo 正确。

## M2-T05 链接、图片与自动链接投影

- 依赖：M2-T03
- 需求：MD-002
- 交付：行内/引用/自动链接和图片的显示/源码切换，安全点击与 hover；本任务不做磁盘图片操作。
- 验证：MD-056..075、SEC 协议；括号、空格、标题、相对/绝对路径和不完整链接。

## M2-T06 代码块基础

- 依赖：M2-T02
- 需求：MD-001、MD-008
- 交付：围栏/缩进代码、语言标签、按需语言高亮、复制；代码正文始终可编辑，不用静态 widget。
- 验证：MD-076..095，围栏长度/字符、嵌套、未闭合、长行、IME。

## M2-T07 输入规则与自动配对

- 依赖：M2-T03、M2-T04、M2-T06
- 需求：EDT-007、EDT-008、EDT-014
- 交付：基础块输入规则、配对、格式命令和上下文判断；所有转换是可撤销最小 change set。
- 验证：EDIT-066..090，行首/行中、选择包裹、转义、连续 undo、composition 时禁用冲突规则。

## M2-T08 Selection、Undo 与 IME 强化

- 依赖：M2-T05、M2-T07
- 需求：EDT-003、EDT-005、EDT-006；风险 R-001、R-004
- 交付：composition freeze、selection mapping、鼠标拖选、跨 widget 导航、事务分组和焦点恢复；失败 case 夹具化。
- 验证：EDIT-091..125 E2E，模拟 composition 与人工微软拼音；无重复/丢字和光标跳跃。

## M2-T09 源码/混合模式连续切换

- 依赖：M2-T08
- 需求：EDT-002、EDT-003
- 交付：同一 EditorState compartment 切换，保存 selection/scroll/fold/history；模式偏好按窗口/文档规则持久化。
- 验证：EDIT-126..140，100 次切换源码哈希不变，undo 栈连续，搜索选区保持。

## M2-T10 混合编辑门禁

- 依赖：M2-T09
- 需求：COMP-005..009
- 交付：基础 Markdown 黄金语料、性能/内存报告、差异记录和两周日用清单。
- 自动验证：check、E2E、security、performance、随机编辑序列 10,000 组。
- 人工门禁：微软拼音/第三方中文 IME、鼠标跨块选择、列表退格、链接、代码块、连续源码切换；两周无 P0/P1 后只解锁直接后继 M3-T01。
- 后续边界：M4-T01、M5-T01 继续分别等待 M3-T08、M4-T10，不在本任务改变状态。
