# M4：高级 Markdown

必读：[Markdown 配置](../docs/20-markdown-compatibility-profile.md)、[UI 交互](../docs/06-ui-interaction-spec.md)、[安全](../docs/05-data-safety-and-security.md)、[测试](../docs/09-test-strategy.md)、[M4 测试用例](../docs/test-cases/M4-advanced-markdown.md)。

## M4-T01 高级特性注册与源码回退

- 依赖：M3-T08
- 需求：MD-003..012
- 交付：功能开关注册表、parser/renderer 配置一致性、BlockAdapter 生命周期、超时/错误 UI 和源码回退；建立高级语料框架。
- 验证：MD-096..110；关闭功能时保持源码，错误 adapter 不能破坏 session。

## M4-T02 YAML、TOC 与 Alerts

- 依赖：M4-T01
- 需求：MD-006、MD-007
- 交付：首部 YAML 容错源码块、动态 TOC、GitHub Alerts；无关编辑不重排 YAML。
- 验证：MD-111..140，坏 YAML、多行值、重复键、标题更新、嵌套引用和 feature flags。

## M4-T03 高级代码块

- 依赖：M4-T01
- 需求：MD-008
- 交付：语言选择/记忆、按需 grammar、复制全部、自动缩进、Shift+Tab 策略、未知语言回退和超长代码性能。
- 验证：MD-141..165，语言别名、IME、末行、围栏碰撞、200 种语言元数据加载预算。

## M4-T04 表格解析与投影

- 依赖：M4-T01
- 需求：MD-004；风险 R-001
- 交付：保留原始 cell/range/delimiter 的表格模型、非活动表格 widget、进入单元格编辑、源码回退。
- 验证：MD-166..190，转义管道、行内标记、缺列、对齐、宽表、不完整输入；显示不改源码。

## M4-T05 表格操作

- 依赖：M4-T04
- 需求：MD-004、EDT-004
- 交付：增删/移动行列、对齐、Tab 导航、范围选择和最小源码 patch；保留未触及列布局。
- 验证：MD-191..225，随机操作/undo、过期 revision 冲突、第一/最后行列、中文宽度。

## M4-T06 脚注、引用链接与内部锚点

- 依赖：M4-T01
- 需求：MD-005
- 交付：脚注 hover/跳转、引用定义、标题锚点和跨文件本地链接；编辑不自动搬移定义。
- 验证：MD-226..250，重复/缺失定义、中文标题、锚点冲突、路径含 `#`/空格。

## M4-T07 MathJax 4

- 依赖：M4-T01
- 需求：MD-009；风险 R-005
- 交付：本地 `mathjax@4`、四类定界符、块/行内编辑、宏、编号、错误和按需渲染；超时/输出预算。
- 验证：MD-251..290、SEC 恶意/超大 TeX、离线字体、复制 TeX/MathML、viewport lazy render。

## M4-T08 Mermaid 与兼容图表

- 依赖：M4-T01
- 需求：MD-010；风险 R-005、R-008
- 交付：Mermaid 11.13.x 隔离渲染、strict 安全、超时/取消、源码错误；Sequence/Flowchart 旧入口通过 adapter 兼容。
- 验证：MD-291..335、SEC 链接/XSS/超大图、所有官方 diagram smoke、主题切换和导出快照准备。

## M4-T09 HTML、视频与嵌入

- 依赖：M4-T01
- 需求：MD-011；风险 R-008
- 交付：HTML block/inline 范围、净化预览、视频 controls、本地资源授权、无脚本隔离 renderer；危险内容显示源码/占位。
- 验证：SEC-021..060，XSS/SVG/style/url/iframe/form、远程资源、路径；Markdown 原文保留。

## M4-T10 高级 Markdown 门禁

- 依赖：M4-T02、M4-T03、M4-T05、M4-T06、M4-T07、M4-T08、M4-T09
- 需求：COMP-014..020
- 交付：高级语料、parser 差异、性能与安全报告；所有复杂块可回退源码。
- 自动验证：check、E2E、security、performance、随机表格 patch。
- 人工门禁：表格大量操作、复杂公式、多个 Mermaid、坏 YAML/HTML、源码/混合切换；通过后解锁 M5-T01。
