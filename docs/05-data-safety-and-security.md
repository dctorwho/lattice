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
3. 未识别编码只读打开原始字节诊断视图，不允许编辑或保存覆盖；M1 不提供猜测编码或强制解码入口，用户只能保留原文件并用支持该编码的外部工具转换副本。
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

### M0 已执行的 Electron 不变量

- 外链输入最多 2,081 个 UTF-16 代码单元；拒绝首尾空白、控制字符、解析失败、凭据、空目标以及 `https:` 和 `mailto:` 之外的协议。
- 同步拒绝渲染器导航、新窗口请求和 webview 附加。只有经主进程确认的规范化 URL 才能到达 `shell.openExternal`。
- 拒绝重定向，且重定向不继承原始 URL 的确认结果。
- 生产 CSP 使用 `connect-src 'none'`；脚本严格限制为 `'self'`，不得使用 `unsafe-inline` 或 `unsafe-eval`；拒绝 object、frame、form 和 base-URI 能力。CodeMirror 6 需要运行时生成样式表和元素定位样式，因此样式策略限定为 `style-src 'self' 'unsafe-inline'`。这一例外只作用于 CSS；Markdown、HTML、主题和其他不可信内容不得作为 HTML 或任意样式注入 DOM。
- 权限检查和权限请求默认拒绝。
- 打包应用忽略开发渲染器 URL，生产环境使用 `devTools: false`。

### M0 已执行的 IPC 不变量

- M0 渲染器只获得冻结的 `window.lattice.app.getInfo()` 和 `window.lattice.commands.{onInvoke,updateStates}`；根对象及其嵌套对象均不暴露通用 `invoke`/`send`/`on`、Electron 对象、文件、外链打开、设置、工作区、导入或导出方法。
- Preload 为每个请求生成 UUID。主进程从授权窗口注册表派生 `windowId` 和 `webContentsId`，并把 `sessionId` 设为 `null`；渲染器输入不能提供可信上下文。
- sender 校验准确拒绝六种情况：缺少 sender frame、sender 已销毁、子 frame sender、窗口未登记、sender 身份不匹配和窗口已销毁。sender/窗口销毁状态回调抛出异常时，按相应已销毁条件失败关闭。
- 输入和处理器输出校验只允许类似 JSON 的 `null`、布尔值、字符串、有限数值、标准数组，以及普通对象或 null 原型对象。拒绝不支持的值、非有限数值、非标准原型、symbol 键、访问器、循环、非规范数组属性，以及超过 65,536 个 UTF-16 字符、深度 8 或 256 个条目的值；对象键字符计入字符预算。
- 固定路由依次校验 sender、输入值预算、批准通道、契约版本、Zod 请求、处理器 Result、Zod 响应和处理器结果可序列化性。路由器产生的稳定失败由严格 `AppError`/`Result` schema 构造，不经过值遍历器。Preload 再次校验每个 Result，并要求每个失败的 `error.requestId` 等于本地请求 ID。
- `zod` 被打包进 `out/preload/index.cjs`。把它保留为外部依赖会产生 Electron 沙箱 preload 无法加载的 `require("zod")`；构建只从 preload 依赖外置中排除 `zod`，不会削弱沙箱或 BrowserWindow 偏好。

### M1 已执行的文档 IPC 不变量

- `files.open()` 不接受路径或选项 payload；选择器取消返回成功 `null`，不读取磁盘且不创建会话。
- 主进程对选择结果执行 `realpath`、常规文件检查、10 MB 上限、读取前后 stat 一致性和 SHA-256；非法 UTF-8 与未知编码只能建立只读描述。
- 完整可编辑 `DocumentSession` 按已验证窗口保存在主进程，窗口销毁时删除授权记录并停止监视器。renderer 只获得严格、冻结的打开、保存、另存、单次 token 确认覆盖和外部变化订阅，不获得任意读取能力。
- 恢复接口只接受严格快照、列出经过校验的记录并按 UUID 显式放弃；带磁盘路径的写入必须匹配当前窗口由主进程打开或从受控恢复存储重建的授权会话，renderer 不能借恢复接口自报路径；窗口关闭必须由 renderer 完成未保存门禁后回应主进程。
- 打开响应、保存请求、恢复写入和恢复列表使用各自路由专属的 12 MiB 字符和约 10 Mi 条目预算；其他方向和通道继续使用 M0 默认预算。

### M1 已执行的命令不变量

- `CommandId` 是严格 11 值枚举。状态同步要求每个 ID 恰好对应一个严格状态对象；缺失、重复、未知、多余属性、畸形或超限集合均在菜单变化前失败。
- 渲染器不提供窗口/WebContents ID。现有路由器派生授权窗口、校验值预算和 Zod schema，并只把状态应用于该窗口的原生菜单快照。
- 原生点击在点击时解析当前聚焦且已登记的窗口。缺失、已销毁、不匹配或抛异常的目标不接收事件；没有已验证快照的菜单状态保持禁用且不勾选。
- Preload 在调用渲染器监听器前丢弃畸形命令事件、隔离监听器异常并返回幂等取消订阅函数。它绝不暴露 Electron 事件或任意事件/通道注册方法。
- 状态同步错误保留渲染器本地状态和主进程最后一次有效快照；不存在重试循环、模态窗口风暴、原始载荷日志或权限降级。

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
- M0 IPC 日志只包含级别、稳定代码、请求 ID、批准通道或 `unknown`、安全原因、可选的主进程派生窗口/WebContents ID 和可选的脱敏堆栈。排除原始载荷、原始错误、文档正文和完整路径。堆栈处理最多检查 16,384 个字符、64 行及每输入行 1,024 个字符，最多输出 8 帧且每帧 256 字符，只保留已识别的应用 basename 或受限 Node 任务队列帧。诊断接收器失败不能替换稳定 IPC 响应。

## 11. 安全测试门禁

- IPC fuzz、路径遍历、符号链接、协议绕过、恶意 HTML/SVG/Mermaid/TeX、压缩炸弹图片和 shell 元字符参数。
- 打包后验证 sandbox、CSP、fuses、asar 完整性和没有开发服务器/DevTools 后门。
- 生产依赖漏洞和许可证检查；高危问题未评估前不能发布。

## 12. M0 供应链与 CI 边界

- `audit:deps` 对 lockfile 解析出的生产图要求每个直接和传递包都有精确版本与 MIT 许可证，并阻断 high/critical 漏洞；同一命令还审计完整开发/构建工具链并阻断 moderate 及以上漏洞。未知许可证、结构异常、命令失败、报告绝对路径或任一阈值违规都会使门禁失败，生产与工具链报告分别写入 `audit.json` 和 `toolchain-audit.json`。
- `audit:sbom` 从受控依赖、许可证和漏洞报告生成 CycloneDX 1.6 JSON。组件、许可证和依赖边必须精确覆盖且无重复/悬空引用；报告写入使用同目录临时文件和原子替换。
- `hash-artifacts.mjs` 只接受仓库内的显式相对路径，拒绝绝对路径、遍历、重复、目录、符号链接和真实路径逃逸；清单包含路径、字节数和 SHA-256，不包含主机绝对路径。
- `run-m0-audit.mjs` 只启动六个固定 Node 脚本；每步有限时、有限输出，子进程失败或超时立即阻断，不执行任意 shell 字符串或重试循环。
- Windows 打包只从 `node_modules/electron/dist` 读取冻结依赖安装后已校验、版本一致的 Electron 运行时。打包配置测试验证目录、可执行文件、资源目录和版本文件；electron-builder 不为同一 Electron 版本建立第二条网络下载链，也不允许通过关闭校验来规避网络故障。
- `.github/workflows/` 只允许 `quality.yml`、`codeql.yml` 和 `dependency-review.yml`。`verify-workflows.mjs` 要求所有 Action 使用审阅过的 40 位 SHA，拒绝 `pull_request_target`、过宽权限、无界循环、命令漂移和越界 artifact 路径。
- Dependency Review 的许可证策略不是“全部依赖必须为 MIT”：生产运行图由本地审计维持 MIT-only；PR 的完整开发/构建工具链只允许已审阅的 MIT、Apache-2.0、BSD-2-Clause、BSD-3-Clause、ISC、0BSD、BlueOak-1.0.0、Python-2.0 与 WTFPL 精确集合。缺少集合成员、加入未审阅许可证、启用按依赖绕过或降低 moderate 漏洞阈值都必须失败。
- `quality` 默认只有 `contents: read`；CodeQL 额外只有 `packages: read` 与 `security-events: write`；Dependency Review 额外只有 `pull-requests: read`。证据上传仅允许忽略目录 `artifacts/m0/`，保留 14 天。
- M0 的 NSIS 和 unpacked 制品未签名、无发布和自动更新权限。自动化验证真实 packaged renderer 的 file URL、关闭 DevTools、冻结 preload 表面与 Node/Electron 不可得；普通用户安装和未签名提示必须由 MAN-M0-001 人工确认。
