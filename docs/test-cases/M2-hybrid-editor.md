# M2 测试用例：单栏混合编辑内核

目标：证明源码与混合模式共享同一文档/选择/历史，基础 Markdown 投影、输入规则、Selection 和中文 IME 在连续编辑中稳定。

## 自动化与半自动用例

| ID | 任务 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-M2-001 | M2-T01 | unit-property/P0 | PROJ-M2 | 构建投影，重建 decoration；提交当前/过期 revision/hash 补丁；注入解析异常 | 重建不进历史；当前最小补丁成功；过期补丁拒绝并重解析；异常显示源码且 session 不变 | `pnpm test -- tests/unit/editor/hybrid-projection.spec.ts` |
| TC-M2-002 | M2-T02 | component/P1 | BLOCK-M2 | 移动/拖动选择进入离开段落、ATX/Setext 标题、嵌套引用和空块 | 非活动标记按规则隐藏；活动/跨块范围可见；源码和 selection 不漂移 | `pnpm test -- tests/unit/component/basic-blocks.spec.ts` |
| TC-M2-003 | M2-T03 | component/P1 | INLINE-M2 | 对重叠、嵌套、转义、未闭合和 Unicode 行内标记逐字符导航/编辑 | 样式优先级正确；不完整输入可编辑；任何显示变化不改 source/hash | `pnpm test -- tests/unit/component/inline-marks.spec.ts` |
| TC-M2-004 | M2-T04 | e2e/P1 | LIST-M2 | 在有序/无序/任务列表执行 Enter、空项退出、Tab、Shift+Tab、checkbox、退格和 undo | 保留 marker/编号风格；嵌套合法；每个命令可完整撤销；只改目标列表范围 | `pnpm test:e2e -- tests/e2e/list-editing.spec.ts` |
| TC-M2-005 | M2-T05 | component-security/P0 | LINK-M2 | 显示/编辑行内、引用、自动链接和图片；点击各协议；测试不完整目标 | 相对/绝对文本保留；仅批准协议经确认打开；不完整链接回退源码；无磁盘副作用 | `pnpm test -- tests/unit/component/link-projection.spec.ts` |
| TC-M2-006 | M2-T06 | component-performance/P1 | CODE-M2 | 编辑围栏/缩进代码、未知语言、未闭合/嵌套围栏和超长行；复制全部 | 正文始终可编辑；语言按需加载；复制精确；长行不阻塞；IME 不重建活动 DOM | `pnpm test -- tests/unit/component/code-block.spec.ts` |
| TC-M2-007 | M2-T07 | unit-e2e/P1 | RULE-M2 | 在行首/行中/选择/转义/composition 上下文触发全部输入规则和自动配对并连续 undo | 只在合法上下文转换；composition 时冲突规则禁用；每次转换为可撤销最小 change set | `pnpm test:e2e -- tests/e2e/input-rules.spec.ts` |
| TC-M2-008 | M2-T08 | e2e/P0 | IME-M2 × SELECT-M2 | 模拟 compositionstart/update/end、beforeinput；鼠标/键盘跨 widget 选择、删除、撤销 | composition 为单一撤销组；无重复/丢字/跳光标；选择映射确定；焦点恢复 | `pnpm test:e2e -- tests/e2e/ime-selection.spec.ts` |
| TC-M2-009 | M2-T09 | e2e-property/P0 | SWITCH-M2 | 编辑后源码/混合切换 100 次，中途搜索、折叠、滚动、undo/redo 和保存 | source hash、history、selection、scroll/fold 连续；切换自身不产生 transaction | `pnpm test:e2e -- tests/e2e/mode-switch.spec.ts` |
| TC-M2-010 | M2-T10 | regression-performance/P0 | GATE-M2 | 运行基础黄金语料、10,000 随机编辑序列、IME E2E 和两周日用回归 | 所有基础 Markdown 语义正确；无源码漂移、光标跳跃、重复输入或持续内存增长 | `pnpm test:performance -- tests/performance/m2-gate.spec.ts` |

## 参数矩阵

- `PROJ-M2`：当前/旧 revision，当前/旧 source hash，空/部分/跨块 range，adapter throw/timeout/invalid patch。
- `BLOCK-M2`：ATX 1–6、Setext、空标题、段落、1–5 层引用、空行、CRLF 源文件、未闭合标记。
- `INLINE-M2`：强调/粗体/删除/代码/高亮/上下标/下划线、三层嵌套、相邻/重叠、转义、中文/Emoji/组合字符。
- `LIST-M2`：`-/*/+`、`1./1)`、任务项、1–6 层嵌套、松散/紧凑、空项、列表末尾和混合缩进。
- `LINK-M2`：inline/reference/autolink/image；空格、括号、标题、`#`、Unicode；https/mailto/http/file/javascript/data/相对路径。
- `CODE-M2`：反引号/波浪线、3–8 长度、未知语言、无末尾换行、超长 100k 行、围栏内围栏。
- `RULE-M2`：标题、引用、列表、任务、代码、分隔线、自动配对；行首/行中/选择/转义/只读/composition。
- `IME-M2`：微软拼音模拟轨迹、候选翻页、全角标点、中英切换、长按退格、跨行选词；第三方 IME 留给人工。
- `SELECT-M2`：左右/上下、Shift 扩选、鼠标前后拖、双击、跨 inline/widget/block、文档首尾。

## 人工门禁

| ID | 任务 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M2-001 | M2-T10 | ENV-IME | 1. 用微软拼音和第三方中文 IME 编辑基础语料；2. 候选翻页、全角标点、退格和跨行选词；3. 鼠标跨标题/列表/链接/代码块选择；4. 连续列表退格；5. 切换模式 100 次；6. 日用两周 | 无重复/丢字/跳光标；撤销按语义分组；选择不塌缩；源码哈希只因真实编辑变化；两周无 P0/P1 | 输入法/系统版本、每日记录、复现轨迹、前后哈希和签署结论 |

## 证据与停止条件

每次失败必须保存 source、transaction 序列、selection/composition 事件和随机种子。源码/混合切换改变文本或历史、IME 重复/丢字、跨块选择不可恢复、过期补丁覆盖输入均为 P0，禁止进入 M3。
