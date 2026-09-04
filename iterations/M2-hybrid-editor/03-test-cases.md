# M2 测试用例

## 迭代上下文

- 迭代： `M2`
- 状态权威： `iterations/state.json`
- 测试策略依据： [test strategy](../../docs/09-test-strategy.md)
- 安全策略依据： [data-safety and security](../../docs/05-data-safety-and-security.md)

## 覆盖与归属

测试 ID 是稳定的验证标识符，不是规划单元。`覆盖能力` 列说明每个用例覆盖的能力。

## 自动化测试用例

| ID        | 覆盖能力                                 | 层级/级别                 | 数据/环境          | 步骤                                                                                             | 预期                                                                                                                           | 自动化                                                                                                                                    |
| --------- | ---------------------------------------- | ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| TC-M2-001 | Hybrid projection framework              | unit-property/P0          | PROJ-M2            | Build/rebuild decorations; submit current/stale revision/hash patches; inject parse exception    | Rebuild not in history; current minimal patch succeeds; stale patch rejects/reparses; exception shows source/session unchanged | `pnpm test -- tests/unit/editor/hybrid-projection.spec.ts`；证据：Seeds, source hashes；停止条件：Source/history mutation from projection |
| TC-M2-002 | Paragraph, heading, and quote projection | component/P1              | BLOCK-M2           | Navigate/drag selection into/out of paragraphs, ATX/Setext headings, nested quotes, empty blocks | Inactive markers hide by rule; active/cross-block ranges visible; source/selection stable                                      | `pnpm test -- tests/unit/component/basic-blocks.spec.ts`；证据：Component trace；停止条件：Selection/source drift                         |
| TC-M2-003 | Inline mark projection                   | component/P1              | INLINE-M2          | Character navigation/edit across overlap, nesting, escapes, unclosed and Unicode marks           | Priority correct; incomplete input editable; display never changes source/hash                                                 | `pnpm test -- tests/unit/component/inline-marks.spec.ts`；证据：Hashes and trace；停止条件：Display writes source                         |
| TC-M2-004 | Lists and tasks                          | e2e/P1                    | LIST-M2            | Enter, empty exit, Tab/Shift+Tab, checkbox, backspace, undo in ordered/unordered/tasks           | Preserve marker/number style; legal nesting; complete undo; target-list-only changes                                           | `pnpm test:e2e -- tests/e2e/list-editing.spec.ts`；证据：E2E trace；停止条件：Non-reversible or broad patch                               |
| TC-M2-005 | Links, images, and autolinks             | component-security/P0     | LINK-M2            | Display/edit inline/reference/autolink/image; click protocols; incomplete target                 | Text retained; only approved protocol after confirmation; incomplete link falls back source; no disk effect                    | `pnpm test -- tests/unit/component/link-projection.spec.ts`；证据：Security trace；停止条件：Unsafe activation or disk effect             |
| TC-M2-006 | Basic code blocks                        | component-performance/P1  | CODE-M2            | Edit fenced/indented code, unknown/unclosed/nested fences, long line, copy all                   | Body editable; on-demand language; exact copy; long line nonblocking; IME DOM stable                                           | `pnpm test -- tests/unit/component/code-block.spec.ts`；证据：Performance trace；停止条件：Blocked input or source change                 |
| TC-M2-007 | Input rules and pairing                  | unit-e2e/P1               | RULE-M2            | Trigger every rule/pair at line start/middle/selection/escape/composition; undo                  | Legal contexts only; composition conflicts disabled; each conversion minimal undoable set                                      | `pnpm test:e2e -- tests/e2e/input-rules.spec.ts`；证据：Transaction trace；停止条件：Illegal conversion                                   |
| TC-M2-008 | IME, selection, and undo                 | e2e/P0                    | IME-M2 × SELECT-M2 | Simulate composition and beforeinput; keyboard/mouse cross-widget selection, delete, undo        | One composition undo group; no duplicate/lost/jumped cursor; deterministic selection/focus                                     | `pnpm test:e2e -- tests/e2e/ime-selection.spec.ts`；证据：Event trace and hashes；停止条件：IME loss or unrecoverable selection           |
| TC-M2-009 | Source/hybrid mode continuity            | e2e-property/P0           | SWITCH-M2          | Edit then switch 100 times amid search, fold, scroll, undo/redo, save                            | Source hash, history, selection, scroll/fold continuous; switch creates no transaction                                         | `pnpm test:e2e -- tests/e2e/mode-switch.spec.ts`；证据：Hashes and E2E trace；停止条件：State discontinuity                               |
| TC-M2-010 | Hybrid-editor gate                       | regression-performance/P0 | GATE-M2            | Run golden corpus, 10,000 random edits, IME E2E, two-week daily regression                       | Basic semantics correct; no source drift/cursor jump/duplicate input/memory growth                                             | `pnpm test:performance -- tests/performance/m2-gate.spec.ts`；证据：Regression report；停止条件：Any P0/P1 or drift                       |

## 人工测试用例

| ID         | 覆盖能力                                     | 环境    | 步骤                                                                                                                                                                                                      | 通过条件                                                                                                        | 证据                                                                                                                          |
| ---------- | -------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| MAN-M2-001 | Real IME and daily hybrid editing acceptance | ENV-IME | Use Microsoft Pinyin and third-party Chinese IME on basic corpus; candidate paging, punctuation, backspace, cross-line selection, cross-block mouse selection, list backspace, 100 switches, two-week use | No duplicate/lost/jumped cursor; semantic undo; selection remains; source hash changes only for edits; no P0/P1 | IME/system versions, daily records, traces, hashes, signed conclusion；停止条件：Any IME, source, selection, or P0/P1 failure |

## 参数矩阵

| Parameter ID | Variables                                                                                                                                                                                                  | Fixture                                                  | Required cases | Expected result                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| PROJ-M2      | Current/old revision, current/old source hash, empty/partial/cross-block range, adapter throw/timeout/invalid patch                                                                                        | Projection snapshots with controlled revision/hash       | TC-M2-001      | Only a current valid minimal patch applies; all stale and invalid paths preserve source/history and fall back safely |
| BLOCK-M2     | ATX levels 1–6, Setext, empty heading, paragraph, quote depth 1–5, blank lines, CRLF source, and unclosed markers                                                                                          | Basic block corpus with exact source ranges              | TC-M2-002      | Reveal and block projection preserve source and selection for every form                                             |
| INLINE-M2    | Emphasis, bold, strike, code, highlight, subscript, superscript, underline; three-level nesting, adjacent/overlapping, escaped, Chinese, Emoji, and combining characters                                   | Inline corpus with source hashes and expected precedence | TC-M2-003      | Styling precedence and incomplete/escaped editing are stable without source mutation                                 |
| LIST-M2      | `-`, `*`, `+`, `1.`, `1)`, task items, nesting depth 1–6, loose/tight, empty item, list end, and mixed indentation                                                                                         | List transaction and undo corpus                         | TC-M2-004      | Marker/number style, nesting, minimal changes, and undo remain correct                                               |
| LINK-M2      | Inline/reference/autolink/image; spaces, parentheses, title, `#`, Unicode; https/mailto/http/file/javascript/data and relative paths                                                                       | Link projection and controlled protocol-handoff corpus   | TC-M2-005      | Text is preserved and only confirmed approved protocols can leave the application                                    |
| CODE-M2      | Backtick/tilde fences, length 3–8, unknown language, no final newline, 100k-character line, and a fence inside a fence                                                                                     | Code-block source and performance corpus                 | TC-M2-006      | Code remains editable/copy-exact, unknown forms fall back, and long input does not block                             |
| RULE-M2      | Heading, quote, list, task, code, horizontal rule, and auto-pair; line start/middle, selection, escape, read-only, and composition                                                                         | Input-rule transaction corpus                            | TC-M2-007      | Rules trigger only in legal contexts and every conversion is a minimal undoable change set                           |
| IME-M2       | Simulated Microsoft Pinyin trace, candidate paging, full-width punctuation, Chinese/English switching, long-press backspace, and cross-line word selection; third-party IME reserved for manual evaluation | Composition/beforeinput event traces                     | TC-M2-008      | One composition undo group with no duplicate/lost text or cursor jump                                                |
| SELECT-M2    | Left/right/up/down, Shift extension, forward/backward mouse drag, double click, across inline/widget/block, and document start/end                                                                         | Selection mapping corpus                                 | TC-M2-008      | Selection mapping, deletion, undo, and focus restoration remain deterministic                                        |

## 夹具

| Fixture                     | Source and integrity                                   | Covered behavior       | Required environment  |
| --------------------------- | ------------------------------------------------------ | ---------------------- | --------------------- |
| Markdown basic/interactions | Nested, incomplete, Unicode, selection and undo corpus | Projection and editing | CodeMirror/Electron   |
| Security protocol fixtures  | Approved/disallowed and malformed links                | Link activation        | Controlled OS handoff |
| IME/performance fixtures    | Composition traces and randomized edit seeds           | IME and scalability    | Windows IME and E2E   |

## 证据要求

报告必须把 `REF-006..010` 逐项关联到窗口条件、输入法版本、操作步骤、源码哈希、事件轨迹和人工签署。单张静态截图不能替代光标、选区、撤销、IME 和模式连续性的行为证据。

记录命令、环境、退出码、参数、源码哈希、选区与组合输入事件、随机种子和制品。人工证据包括操作人、IME 与系统版本、每日记录、录屏、哈希和评估人结论。

## 停止条件

一旦显示或切换引起源码变化、过期补丁覆盖、IME 输入重复或丢失、选区无法恢复、安全策略逃逸，或持续存在 P0/P1 问题，迭代必须停止推进。
