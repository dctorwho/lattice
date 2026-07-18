# M4 测试用例：高级 Markdown

目标：证明所有复杂 Markdown 块都遵循“解析范围→投影/widget→最小源码补丁→冲突拒绝→可撤销→失败回退源码”的统一契约，并隔离恶意内容。

## 自动化与半自动用例

| ID | 任务 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-M4-001 | M4-T01 | unit/P0 | ADAPTER-M4 | 对每个高级特性开/关，注入 parse/render/apply 超时、异常、无效 range 和过期 revision | parser/renderer 开关一致；关闭保留源码；失败回退源码；session/history 不损坏 | `pnpm test -- tests/unit/markdown/block-adapter-contract.spec.ts` |
| TC-M4-002 | M4-T02 | component/P1 | META-M4 | 编辑有效/损坏/多行/重复键 YAML，更新标题检查 TOC，编辑嵌套 Alerts，切换功能开关 | 无关编辑不重排 YAML；TOC 增量正确；Alerts 范围正确；坏输入可直接编辑源码 | `pnpm test -- tests/unit/component/yaml-toc-alerts.spec.ts` |
| TC-M4-003 | M4-T03 | component-performance/P1 | CODEADV-M4 | 切换语言/别名，自动缩进/Shift+Tab/复制；编辑末行、围栏碰撞、未知语言和超长代码 | grammar 按需加载；未知语言回退；复制精确；源码围栏保留；加载/滚动达预算 | `pnpm test -- tests/unit/component/advanced-code.spec.ts` |
| TC-M4-004 | M4-T04 | unit-component/P0 | TABLE-M4 | 解析并进入/离开合法、宽、缺列、转义管道、行内标记和不完整表格 | cell/range/delimiter 对应原文；非活动可投影；活动可源码编辑；显示不改源码 | `pnpm test -- tests/unit/component/table-projection.spec.ts` |
| TC-M4-005 | M4-T05 | property-e2e/P0 | TABLEOP-M4 | 随机增删/移动行列、对齐、Tab 导航、范围选择；插入过期 revision；逐步 undo | 只补丁目标表格；未触及列布局不变；冲突拒绝；全部操作可逆且 selection 合理 | `pnpm test -- tests/unit/property/table-operations.spec.ts` |
| TC-M4-006 | M4-T06 | component/P1 | ACADEMIC-M4 | 跳转/hover 脚注、引用定义、标题锚点和跨文件本地链接；编辑重复/缺失定义 | 缺失有诊断；重复规则稳定；中文/冲突锚点确定；定义不被自动搬移；路径正确解码 | `pnpm test -- tests/unit/component/academic-links.spec.ts` |
| TC-M4-007 | M4-T07 | component-security-performance/P0 | MATH-M4 | 渲染四种定界符、宏、编号和错误 TeX；复制 TeX/MathML；超大/恶意输入；滚动视口 | 本地离线渲染；错误显示源码诊断；超时/节点/输出预算生效；非视口延迟；无脚本执行 | `pnpm test:security -- tests/security/mathjax.spec.ts` |
| TC-M4-008 | M4-T08 | integration-security-performance/P0 | DIAGRAM-M4 | 渲染各 Mermaid 图类及旧 Sequence/Flowchart；错误/XSS/超大图；切主题、取消 | strict 隔离；错误保留源码；链接/HTML 不逃逸；取消终止；主题和导出模型一致 | `pnpm test:security -- tests/security/mermaid.spec.ts` |
| TC-M4-009 | M4-T09 | security-e2e/P0 | HTML-M4 | 预览 inline/block HTML、video、本地资源及 XSS/SVG/style/url/iframe/form/远程资源载荷 | 允许内容语义可见；危险内容净化/占位；无 Node/preload/网络/越权路径；原文不变 | `pnpm test:security -- tests/security/html-preview.spec.ts` |
| TC-M4-010 | M4-T10 | regression-performance/P0 | GATE-M4 | 运行高级黄金语料、安全载荷、10,000 随机表格 patch 和大型公式/图表基准 | COMP-014..020 有证据；全部复杂块可回退；无源码漂移、权限逃逸或资源失控 | `pnpm test:performance -- tests/performance/m4-gate.spec.ts` |

## 参数矩阵

- `ADAPTER-M4`：YAML/TOC/Alerts/code/table/footnote/math/diagram/HTML；feature on/off；throw/timeout/invalid patch/old revision。
- `META-M4`：空/合法/缺闭合 YAML，多行/注释/重复键/自定义顺序；TOC 标题增删改；NOTE/TIP/IMPORTANT/WARNING/CAUTION 和嵌套引用。
- `TABLE-M4`：转义 `\|`、代码内管道、行内强调、0/1/100 列、缺/多 cell、左中右对齐、中文宽度、无尾换行。
- `TABLEOP-M4`：首/中/尾行列，空/富文本 cell，增删移动对齐，Tab/Shift+Tab，100 种子和门禁 10,000 组。
- `ACADEMIC-M4`：重复/缺失/循环脚注引用，中文/Emoji 标题，同名锚点，路径含空格/`#`/`%`，工作区外目标。
- `MATH-M4`：`$`、`$$`、`\(...\)`、`\[...\]`，宏/编号/引用，语法错，HTML-like TeX，10/100/1000 公式和超大表达式。
- `DIAGRAM-M4`：flowchart/sequence/class/state/ER/gantt/pie/mindmap/timeline/gitGraph 等支持图类，旧入口，恶意链接/HTML、深图/超大节点。
- `HTML-M4`：安全文本/表格/video，本地资源；script/event/style/url/svg/iframe/form/object/meta/base；编码/大小写混淆。

## 人工门禁

| ID | 任务 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M4-001 | M4-T10 | Windows 11、离线 | 1. 大量增删移动表格行列并撤销；2. 编辑复杂公式和宏；3. 同页放置多个 Mermaid；4. 打开坏 YAML/HTML；5. 在源码/混合间反复切换 | 表格/公式/图表可编辑且失败可回源码；撤销无漂移；离线可用；坏输入不崩溃/执行；安全 UI 不被覆盖 | 源码 diff、操作录屏、离线证明、性能/安全报告和签署结果 |

## 证据与停止条件

每个 adapter 保存输入源码、range、revision、patch 和 undo 后源码；安全用例保存 CSP/网络/进程证据。复杂块重排无关源码、过期补丁覆盖输入、恶意内容执行/联网/越权或超时无法终止均阻断 M4。
