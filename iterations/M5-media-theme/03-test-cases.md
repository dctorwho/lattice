# M5 test cases

## Iteration context

- Iteration: `M5`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy:
  [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers. They are not subtask IDs and do not own
planning state, dependencies, implementation work, manual gates, or reports. The `覆盖能力`
column names the capability covered by the case.

## Automated test cases

| ID        | 覆盖能力           | 层级/级别                    | 数据/环境              | 步骤                                                                                                                                           | 预期                                                                                                                                            | 自动化                                                                                                                                                                                                        |
| --------- | ------------------ | ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-M5-001 | 剪贴板载荷契约     | unit-security/P0             | PAYLOAD-M5             | Combine plain/markdown/html/image MIME including empty, oversized, malicious values; perform normal/plain paste and cancellation.              | Priority is deterministic; sanitize before conversion; reject over-limit values; cancellation creates no transaction or file.                   | `pnpm test -- tests/unit/domain/clipboard-payload.spec.ts`；证据：Command result and bounded MIME summary.；停止条件：Script execution, unsafe payload admission, or unexpected transaction stops M5.         |
| TC-M5-002 | 智能复制粘贴       | integration-e2e/P1           | CLIP-M5                | Paste external-style heading/list/table/link/code fixtures; copy four formats; undo.                                                           | Semantics match mode; dangerous nodes/attributes are removed; only selection changes; operation is one undo unit.                               | `pnpm test:e2e -- tests/e2e/smart-clipboard.spec.ts`；证据：E2E report, source diff, and copy-format assertions.；停止条件：Source changes outside selection or broken undo stops M5.                         |
| TC-M5-003 | 图片插入与路径策略 | integration/P0               | IMAGEPATH-M5           | Insert through picker, drop, clipboard, and URL for every policy and document state.                                                           | Minimal policy-correct Markdown path; Unicode/space/# encoding is correct; unnamed documents prompt; same names never overwrite.                | `pnpm test:integration -- tests/integration/image-insert.spec.ts`；证据：Integration report and fixture disk manifest.；停止条件：Unauthorized path, overwrite, or source corruption stops M5.                |
| TC-M5-004 | 资源事务           | integration/P0               | FI-RESOURCE × IMGOP-M5 | Copy/move/rename/reload/delete, inject failure at file, patch, commit, rollback points, then undo.                                             | Success keeps disk/source aligned; failure rolls back; unrecoverable paths are shown; delete confirms and defaults to recycle bin.              | `pnpm test:integration -- tests/integration/resource-transaction.spec.ts`；证据：Transaction log, hashes, rollback trace.；停止条件：Permanent deletion or disk/source split stops M5.                        |
| TC-M5-005 | 上传器适配         | integration-security/P0      | UPLOAD-M5              | Use fake/PicList adapters for single/multi-file upload with metacharacter paths, malicious URLs, hanging/large stderr, and cancellation.       | argv with `shell:false`; default is offline; only approved URLs accepted; timeout/cancel kills process; failure leaves source unchanged.        | `pnpm test:security -- tests/security/upload-adapter.spec.ts`；证据：Process argv summary, exit record, and source hash.；停止条件：Shell injection, unsafe URL, leaked process, or source mutation stops M5. |
| TC-M5-006 | 主题系统           | component-security-visual/P0 | THEME-M5               | Load built-in/user/broken themes; hot reload and system follow; attempt remote resources/protected-dialog coverage; capture scale screenshots. | Document scope is correct; broken CSS falls back; remote policy holds; user CSS cannot control security UI.                                     | `pnpm test:security -- tests/security/theme-isolation.spec.ts`；证据：Security report and screenshot baseline.；停止条件：Theme bypass or protected UI obstruction stops M5.                                  |
| TC-M5-007 | 写作辅助模式       | e2e-performance/P1           | MODE-M5                | Combine focus/typewriter/read-only/zoom/spelling/Emoji/smart punctuation/movement with Chinese IME and long text.                              | Settings switch immediately; read-only blocks mutation; structure commands undo; input/scroll meet budget; spelling menu is reachable.          | `pnpm test:e2e -- tests/e2e/writing-modes.spec.ts`；证据：E2E timings and IME/mode trace.；停止条件：IME regression, unauthorized edit, or budget breach stops M5.                                            |
| TC-M5-008 | 媒体与主题回归门禁 | regression/P0                | GATE-M5                | Run clipboard interoperability, image fault matrix, theme security/screenshots, and writing-mode performance regressions.                      | COMP-021..024 have evidence; no script/path/process escape, permanent deletion, source/disk split, or IME regression.                           | `pnpm test:integration -- tests/integration/m5-gate.spec.ts`；证据：Consolidated automated reports.；停止条件：Any compatibility, data, or security failure stops M5.                                         |
| TC-M5-009 | 剪贴板 HTML 安全   | security/P0                  | CLIP-XSS-M5            | Paste HTML with script/event/SVG/style/data URL/form, copy each format, and reopen.                                                            | No execution/networking; dangerous content never enters rich projection; Markdown remains explainable; reopen does not activate hidden payload. | `pnpm test:security -- tests/security/clipboard-html.spec.ts`；证据：Security report and reopened-source assertion.；停止条件：Payload activation or hidden unsafe content stops M5.                          |

## Manual test cases

| ID         | 覆盖能力                               | 环境                              | 步骤                                                                                                                                                  | 通过条件                                                                                 | 证据                                                                                                                                  |
| ---------- | -------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| MAN-M5-001 | 剪贴板、图片、主题与写作模式实机互操作 | Word、浏览器、微信编辑器、ENV-IME | 1. 双向复制标题/列表/链接/表格；2. 普通和纯文本粘贴；3. 拖放/剪贴板插图；4. 移动/删除并故障回滚；5. 加载自定义主题；6. 开启焦点/打字机/拼写连续写作。 | 外部语义可接受且无脚本；图片路径和回滚正确；主题不遮挡安全 UI；写作模式无 IME/滚动异常。 | 外部应用版本、样本、磁盘清单、源码 diff、截图/录屏和签署结论。；停止条件：脚本执行、数据丢失、主题遮挡安全 UI、IME 或滚动异常停止 M5. |

## Parameter matrix

| Parameter ID | Variables                                                                                           | Fixture                           | Required cases     | Expected result                    |
| ------------ | --------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------ | ---------------------------------- |
| PAYLOAD-M5   | 空、plain only、markdown+plain、html+plain、image+html+plain、未知 MIME、10MB 文本/超大图片、取消   | Clipboard payload fixtures        | 剪贴板载荷契约     | 优先级、净化、上限和取消语义确定。 |
| CLIP-M5      | 浏览器/Word/Google Docs 风格；标题、嵌套列表、任务、表格、链接、代码、图片、换行；智能/纯文本       | External-style clipboard fixtures | 智能复制粘贴       | 语义转换且仅改选区。               |
| IMAGEPATH-M5 | 相对/绝对/复制目录/`./`/`typora-root-url`；已保存/未命名；工作区内外、UNC/WSL、空格/中文/#/@、同名  | Image path fixtures               | 图片插入与路径策略 | 最小且无覆盖的链接更新。           |
| IMGOP-M5     | PNG/JPEG/GIF/WebP/SVG/损坏/超大；copy/move/rename/reload/trash；目标存在/占用/只读/跨卷/用户取消    | Resource operation fixtures       | 资源事务           | 事务提交或可解释回滚。             |
| UPLOAD-M5    | 正常/非零/挂起/超大 stderr；含引号/分号/`&` 文件名；https/http/file/javascript/data 输出；单/多文件 | Fake and PicList adapters         | 上传器适配         | 安全 argv、URL、超时和取消。       |
| THEME-M5     | 内置浅/深/系统、有效 CSS、语法错、缺资源、远程 URL、高层覆盖、100/150/200/250% 和高对比             | Theme fixtures                    | 主题系统           | 安全隔离且可读。                   |
| MODE-M5      | 焦点×打字机×只读×拼写；中英文；1/5/10MB；无选区/选区/文档首尾；缩放边界                             | Writing-mode fixtures             | 写作辅助模式       | 即时模式和稳定编辑性能。           |

## Fixtures

| Fixture                       | Source and integrity                                                                          | Covered behavior                              | Required environment                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Clipboard payload and CLIP-M5 | Curated MIME and external-editor-style payloads; private bodies are not retained in evidence. | Copy/paste conversion and sanitization.       | Windows clipboard test adapter.                       |
| Image/resource fixtures       | Checksummed images, invalid/large samples, controlled workspace and failure injector.         | Path policies and reversible file operations. | Writable temporary workspace and recycle-bin adapter. |
| Upload fixtures               | Controlled fake executables and bounded adapter output.                                       | argv, URL validation, cancellation, cleanup.  | No-network process harness.                           |
| Theme and mode fixtures       | Valid/invalid CSS, protected-chrome probe, long Chinese/English documents.                    | CSS isolation, scale, IME, and modes.         | Windows scales and IME environment.                   |

## Evidence requirements

Record command, environment, exit code, parameter selection, result, and artifact or report
reference for each executed automated case. Record operator, date, environment, step results,
and conclusion evidence for each manual case.

## Stop conditions

Data corruption, security-boundary failure, broken recovery, permanent resource loss,
clipboard-script execution, upload shell injection, or theme control of safety UI stops
iteration progress until it is fixed and regression evidence is recorded.
