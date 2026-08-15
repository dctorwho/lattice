# 数据安全与安全边界

## 1. 数据不变量

以下任一违反均为 P0，必须停止功能开发：

1. 未编辑文件保存后字节发生变化。
2. 用户未确认时覆盖外部修改。
3. 保存失败导致原文件丢失或截断。
4. 未触及范围被重新排版、转义或改换行。
5. 崩溃恢复展示成功但正文不完整。
6. 撤销操作造成源码与可见内容不一致。

## 2. 打开与编码

1. 读取完整字节和 stat 信息，记录 size、mtime、可选快速哈希。
2. 按 BOM 检测 UTF-8/UTF-16LE/UTF-16BE；无 BOM 时严格验证 UTF-8。
3. 未识别编码只读打开原始字节诊断视图，不允许保存覆盖；用户可显式“用编码重新打开”。
4. 解码后建立每行 EOL 索引和原始字节哈希。
5. 任何解析或渲染失败不影响源码会话建立。

## 3. 原子保存协议

保存请求包含目标路径、预期磁盘版本、编码、文本、EOL 索引和 session revision。

1. 再次 stat 目标；与预期不符时进入冲突流程。
2. 在同目录创建不可预测名称的临时文件，避免跨卷 rename。
3. 按原编码和 EOL 索引生成字节，写入并 `fsync` 文件。
4. 如启用安全备份，将旧文件原子移动到受控备份名。
5. 使用平台安全替换；Windows 被占用时有限次数退避重试。
6. 尽可能刷新父目录；记录新 stat 和哈希。
7. 验证写入长度和可选回读哈希后才标记 `savedRevision`。
8. 清理临时/备份失败只记录警告，不虚报保存失败或成功。

不得先截断目标再写，不得用 `writeFile(target)` 作为最终协议。

## 4. 外部变更状态机

- `clean + changed`：可按设置自动重载，并保留选择锚点。
- `dirty + changed`：停止自动保存，提供比较、保留本地、重新加载、另存为；覆盖必须二次确认。
- `clean + deleted`：保留内存内容，标记路径丢失，可重新创建或另存。
- `dirty + deleted`：保留恢复记录，禁止关闭时静默丢弃。
- watcher 事件与自身保存通过 request ID、stat 和哈希去重，不能仅依赖时间窗口。

## 5. 恢复协议

- 每个会话独立恢复目录，元数据和正文分离并带 schema version、revision、校验值。
- 输入停止后 1 秒写入；结构操作和关闭前立即写入。
- 使用临时文件原子替换恢复快照，保留至少一个上一版本。
- 正常保存后仅删除不再需要的对应 revision；正常关闭未保存文件必须根据用户选择处理。
- 启动时扫描恢复目录，坏快照隔离，不因单个损坏文件阻止其他恢复。
- 恢复记录默认 30 天清理，但未确认恢复项不自动删除。

## 6. 图片与磁盘副作用

图片复制、移动、重命名和删除使用 `ResourceTransaction`：预检 → 文件操作 → Markdown 补丁 → 提交日志。源码补丁失败时回滚文件操作；无法回滚时显示具体路径和修复步骤。删除进入系统回收站优先于永久删除。

## 7. 威胁模型

不可信输入包括 Markdown、HTML/SVG、Mermaid、TeX、YAML、主题 CSS、图片、剪贴板、远程 URL、导出模板、Pandoc 参数、工作区文件名和符号链接。

主要威胁：

- HTML/链接触发脚本并跨越到 preload/IPC。
- 路径遍历、符号链接逃逸或工作区越权访问。
- Mermaid/Math/正则造成 CPU 或内存拒绝服务。
- 图片解码、SVG、字体和 Pandoc 处理恶意文件。
- 自定义上传命令或导出参数导致 shell 注入。
- 主题 CSS 读取远程资源、覆盖安全 UI 或诱导点击。

## 8. Electron 控制

- `app.enableSandbox()` 在 ready 前调用；renderer `sandbox:true`、`contextIsolation:true`、`nodeIntegration:false`。
- preload 一项能力一个方法，禁止暴露通用 send/invoke。
- 验证 IPC sender、窗口归属、参数 schema、授权路径和资源上限。
- 禁止任意导航、新窗口、权限请求和未授权协议。
- 外链只允许解析后的 `https:`/`mailto:` 白名单协议，确认后由系统打开。
- CSP 默认 `default-src 'self'`，按功能最小开放；生产环境不使用 `unsafe-eval`。
- 不使用 `<webview>` 承载用户 HTML。

### M0 enforced Electron invariants

- External-link input is limited to 2,081 UTF-16 code units. Leading or trailing
  whitespace, control characters, parse failures, credentials, empty targets,
  and protocols other than `https:` and `mailto:` are denied.
- Renderer navigation, new-window requests, and webview attachment are
  synchronously denied. Only a normalized URL that the main process has
  confirmed may reach `shell.openExternal`.
- Redirects are denied and do not inherit a confirmation made for the original
  URL.
- Production CSP uses `connect-src 'none'`; scripts and styles allow only
  `'self'`; object, frame, form, and base-URI capabilities are denied.
- Permission checks and permission requests deny by default.
- A packaged application ignores a development renderer URL, and production
  uses `devTools: false`.

### M0 enforced IPC invariants

- The M0 renderer receives only frozen `window.lattice.app.getInfo()` and
  `window.lattice.commands.{onInvoke,updateStates}`; neither the root nor its
  nested objects exposes generic `invoke`/`send`/`on`, Electron objects, file,
  external-open, settings, workspace, import, or export methods.
- Preload generates each request UUID. Main derives `windowId` and
  `webContentsId` from its authorized-window registry and sets `sessionId` to
  `null`; renderer input cannot provide trusted context.
- Sender validation rejects exactly: missing sender frame, destroyed sender,
  subframe sender, unregistered window, mismatched sender identity, and
  destroyed window. Exceptions from sender/window destroyed-state callbacks
  fail closed as the corresponding destroyed condition.
- Input and handler-output validation allows only JSON-like `null`, booleans, strings,
  finite numbers, standard arrays, and plain or null-prototype objects. It
  rejects unsupported values, non-finite numbers, non-standard prototypes,
  symbol keys, accessors, cycles, non-canonical array properties, and values
  over 65,536 UTF-16 characters, depth 8, or 256 entries. Object-key characters
  count toward the character budget.
- The fixed route validates sender, input value budget, approved channel,
  contract version, Zod request, handler Result, Zod response, and handler-result
  serializability in that order. Router-generated stable failures are constructed
  from the strict `AppError`/`Result` schemas rather than passed through the value
  walker. Preload validates every Result again and requires every failure
  `error.requestId` to equal its local request ID.
- `zod` is bundled into `out/preload/index.cjs`. Leaving it external produced a
  sandbox preload `require("zod")` that Electron could not load; the build
  excludes only `zod` from preload dependency externalization and does not
  weaken sandbox or BrowserWindow preferences.

### M0 enforced command invariants

- `CommandId` is a strict two-value enum: `app.about` and
  `view.toggleSidebar`. State synchronization requires exactly one strict state
  object for each ID; missing, duplicate, unknown, extra-property, malformed,
  or oversized sets fail before the menu changes.
- The renderer supplies no window/WebContents ID. The existing router derives
  the authorized window, validates value budgets and Zod schemas, and applies
  state only to that window's native-menu snapshot.
- Native clicks resolve the current focused registered window at click time.
  Missing, destroyed, mismatched, or throwing targets receive no event; menu
  state without a validated snapshot is disabled and unchecked.
- Preload discards malformed command events before calling renderer listeners,
  contains listener exceptions, and returns an idempotent unsubscribe. It never
  exposes the Electron event or an arbitrary event/channel registration method.
- State-sync errors keep renderer-local state and the last validated main
  snapshot; there is no retry loop, modal storm, raw payload log, or privilege
  fallback.

## 9. 内容与进程隔离

- DOMPurify 不是唯一边界；HTML 在无 Node、无 preload 的隔离 renderer 中预览。
- 用户脚本默认不执行。导出自定义 head/body 仅作用于隔离导出文档。
- Mermaid 使用 `securityLevel:'strict'` 等价安全配置、超时和大小限制。
- MathJax 宏和表达式设置超时、节点数和输出大小预算。
- 子进程统一使用 `spawn(executable, args, {shell:false})`；可执行路径必须来自用户选择或可信资源。
- Pandoc 导入只读源文件并写入主进程创建的 staging；校验输出 Markdown、资源相对路径、符号链接、文件数和总大小后才创建未命名会话，失败或取消不得留下可见的部分文档。
- 临时目录权限最小化，导出后清理；失败时不在日志记录正文。

## 10. 隐私和日志

- 默认无遥测、无账号、无网络请求。
- 日志使用路径哈希或根目录相对路径；不记录文档、剪贴板、搜索词、YAML 值和导出自定义内容。
- 用户可从设置打开日志目录并一键清理。
- 错误报告在未来加入时必须预览待发送内容并显式同意。
- M0 IPC logs contain only level, stable code, request ID, approved channel
  or `unknown`, safe reason, optional main-derived window/WebContents IDs, and
  an optional sanitized stack. Raw payloads, errors, document text, and full
  paths are excluded. Stack processing inspects at most 16,384 characters, 64
  lines, and 1,024 input characters per line, emits at most 8 frames of 256
  characters, and keeps only recognized application basenames or the bounded
  Node task-queue frame. Diagnostic sink failures cannot replace the stable IPC
  response.

## 11. 安全测试门禁

- IPC fuzz、路径遍历、符号链接、协议绕过、恶意 HTML/SVG/Mermaid/TeX、压缩炸弹图片和 shell 元字符参数。
- 打包后验证 sandbox、CSP、fuses、asar 完整性和没有开发服务器/DevTools 后门。
- 生产依赖漏洞和许可证检查；高危问题未评估前不能发布。

## 12. M0 供应链与 CI 边界

- `audit:deps` 只审计 lockfile 解析出的生产图，要求每个直接和传递包都有精确版本与 MIT 许可证；未知许可证、结构异常、high/critical 漏洞或报告中的绝对路径都会使门禁失败。
- `audit:sbom` 从受控依赖、许可证和漏洞报告生成 CycloneDX 1.6 JSON。组件、许可证和依赖边必须精确覆盖且无重复/悬空引用；报告写入使用同目录临时文件和原子替换。
- `hash-artifacts.mjs` 只接受仓库内的显式相对路径，拒绝绝对路径、遍历、重复、目录、符号链接和真实路径逃逸；清单包含路径、字节数和 SHA-256，不包含主机绝对路径。
- `run-m0-audit.mjs` 只启动六个固定 Node 脚本；每步有限时、有限输出，子进程失败或超时立即阻断，不执行任意 shell 字符串或重试循环。
- `.github/workflows/` 只允许 `quality.yml`、`codeql.yml` 和 `dependency-review.yml`。`verify-workflows.mjs` 要求所有 Action 使用审阅过的 40 位 SHA，拒绝 `pull_request_target`、过宽权限、无界循环、命令漂移和越界 artifact 路径。
- `quality` 默认只有 `contents: read`；CodeQL 额外只有 `packages: read` 与 `security-events: write`；Dependency Review 额外只有 `pull-requests: read`。证据上传仅允许忽略目录 `artifacts/m0/`，保留 14 天。
- M0 的 NSIS 和 unpacked 制品未签名、无发布和自动更新权限。自动化验证真实 packaged renderer 的 file URL、关闭 DevTools、冻结 preload 表面与 Node/Electron 不可得；普通用户安装和未签名提示必须由 MAN-M0-001 人工确认。
