# 测试策略

## 1. 质量模型

测试按风险而非文件数量设计。最高优先级依次为：数据完整性、安全边界、编辑事务/IME、导出正确性、性能、视觉与交互复刻一致性。测试通过只能证明其明确覆盖的行为；完整产品结论必须同时闭合“公开证据 `REF-*` → 复刻项 `COMP-*` → 迭代需求 → `TC-*`/`MAN-*` → 测试与出口报告”。

## 2. 测试层级

- **单元**：SourceBuffer、EOL、编码、补丁、命令、设置迁移、路径授权、解析适配器。
- **性质测试**：随机文本和编辑序列验证 round-trip、最小修改、undo/redo 和补丁冲突。
- **集成**：真实临时目录中的打开/保存/watcher/恢复/图片事务/Pandoc 进程。
- **组件**：React、菜单状态、设置、块 widget 与可访问性。
- **Electron E2E**：真实 main/preload/renderer、对话框适配、窗口、快捷键、崩溃与导出。
- **黄金输出**：HTML、PDF 文本/结构、图片和 Markdown 字节；可解释地更新基线。
- **人工**：IME、光标手感、显示缩放、打印、主题、外部应用复制粘贴。

## 3. 测试 ID 与套件

实现和证据使用各迭代 `03-test-cases.md` 中唯一的 `TC-Mx-nnn`（自动/半自动）与 `MAN-Mx-nnn`（人工）作为稳定用例 ID。下表中的 `DATA-*` 等编号是数据集与兼容追踪编号，可被一个参数化 `TC-*` 展开覆盖，不能单独当作已经设计完成的测试用例。

| 前缀  | 范围                                                  |
| ----- | ----------------------------------------------------- |
| DATA  | 编码、EOL、原子保存、冲突、恢复和资源事务             |
| EDIT  | transaction、selection、IME、undo、输入规则和模式切换 |
| MD    | Markdown 解析、投影、块组件和源码补丁                 |
| WS    | 文件树、大纲、快速打开、全局搜索和 watcher            |
| CLIP  | 剪贴板格式和智能粘贴                                  |
| IMG   | 图片路径、文件副作用和上传适配                        |
| THEME | 主题加载、CSS 隔离和系统模式                          |
| EXP   | HTML、PDF、图片、打印和 Pandoc                        |
| IMP   | Pandoc 文件导入、资源提取、警告和失败原子性           |
| PREF  | 设置、迁移和快捷键                                    |
| SEC   | IPC、CSP、HTML、路径、协议和进程安全                  |
| A11Y  | 键盘、焦点、名称、对比和缩放                          |
| OS    | 窗口、单实例、文件关联和命令行                        |
| REL   | 安装、卸载、签名和更新                                |

## 4. 夹具设计

`tests/fixtures/` 必须包含：

- `bytes/`：空文件、UTF-8、BOM、UTF-16、LF、CRLF、混合 EOL、无尾换行、NUL、非法 UTF-8。
- `markdown/basic/`：每种基础语法、嵌套与不完整输入。
- `markdown/advanced/`：表格、脚注、YAML、TOC、Alerts、数学、Mermaid、HTML。
- `markdown/interactions/`：同一区域连续编辑、跨块选择、粘贴、undo/redo 轨迹。
- `security/`：XSS、SVG、协议、路径遍历、符号链接、命令元字符、超大输入。
- `workspace/`：大小写、Unicode、长路径、10,000 文件生成器、忽略和符号链接。
- `export/`：主题、字体、本地/远程资源、分页、页眉页脚和 Pandoc 样例。
- `import/`：自建 DOCX、RTF、EPUB、LaTeX/TeX、RST、Org、Wiki、Textile、OPML，含资源提取、警告、非法路径和超限输出。

每个 fixture 附元数据：编码、预期可见语义、允许修改范围、预期错误和关联需求。

## 5. 数据完整性性质

至少验证：

1. `decode(encode(buffer))` 在受支持编码/EOL 下保持文本与元数据。
2. 未编辑 `open → save` 的字节哈希相同。
3. 编辑区间外的原始字节片段保持相同。
4. `apply(change); undo()` 返回相同 SourceBuffer。
5. 任意过期 revision 的 block patch 被拒绝。
6. 任意保存故障点都保留原文件或已验证的新文件，不能留下截断目标。
7. 恢复最新有效 revision；损坏的最后快照回退上一份。

## 6. 编辑与 IME

自动测试通过真实 Electron 与 CDP 覆盖 compositionstart/update/end、beforeinput、selection 和 transaction 分组，并覆盖多阶段候选、全角标点、长退格等价输入、跨行选词和撤销重做。输入法厂商候选窗口属于 Chromium 和操作系统上游，不作为应用验收代理指标。组合期间不得重建活动 DOM 或显示重复文字。

## 7. 导出验证

- HTML 使用 DOM 语义、链接、资源和净化断言，不只比较字符串。
- PDF 检查页数、文本、链接、outline、页面尺寸、边距和关键区域截图。
- 图片检查尺寸、透明/背景、缩放和分片拼接。
- Pandoc 通过受控 fake executable 测参数数组，再在可用环境跑真实冒烟。
- 任何导出测试验证源会话 revision 和源码不变。

## 8. 安全测试

- preload 表面快照：只存在批准方法，不能获得原始 Electron 对象。
- IPC schema fuzz、错误 sender、越权窗口、路径逃逸、符号链接和 TOCTOU。
- CSP、导航、新窗口、权限请求、外链协议和自定义 URL。
- HTML/SVG/Math/Mermaid 载荷、超时、内存预算和远程资源阻断。
- Pandoc/上传器使用参数数组并验证 `shell:false`。
- M0 的外链 E2E 必须在 Electron main process 替换 `dialog.showMessageBox` 和 `shell.openExternal`，记录调用后随应用进程销毁；不得唤起真实浏览器或邮件客户端。
- `test:e2e` 使用 `playwright.config.ts` 验证导航、窗口、权限、CSP 与生产 DevTools，并明确排除需要现成 `dist/` 的 packaged 用例；`test:security` 验证 renderer/preload/沙箱边界和恶意 payload。两者均从无 `ELECTRON_RENDERER_URL` 的生产构建启动。
- `test:packaged` 使用独立的 `playwright.packaged.config.ts`，只从 `dist/win-unpacked/Lattice.exe` 启动 `packaged-app.spec.ts`。它要求真实 `app.asar`、`app.isPackaged`、file URL、关闭 DevTools、无开发 URL、冻结 `{ app, commands, files, recovery }` 表面和 renderer 中 Node/Electron 全局不可得。Playwright 为控制通道注入的两个零值调试参数必须是进程唯一附加参数，不能被误记为产品参数。
- M0 不伪造 IPC handler；其历史证据继续拥有 Node/Electron/裸 IPC 不可得、sandbox、真实 `app.getInfo()` invoke、request ID、sender 拒绝和四入口统一命令证明。M1 在相同边界上把当前 preload 精确扩展为 `{ app, commands, files, recovery }`，并由严格 schema 与真实 Electron 安全套件验证。

M0 安全证据把纯策略断言与运行时行为分开：

- `external-url-policy` 单元覆盖拒绝超过 2,081 个 UTF-16 代码单元的输入，以及首尾空白、控制字符、解析失败、凭据、空目标和非 `https:`/`mailto:` 协议。不变量上限仍是 2,081 个代码单元；目前尚无恰好接受边界值的单元测试。
- `web-contents-security-policy` 单元覆盖证明同步拒绝导航、重定向、新窗口和 webview 附加。
- `content-security-policy` 单元覆盖断言精确 CSP 指令字符串。`resolve-main-window-options` 工厂/单元测试证明打包应用忽略开发 URL；M0 提供最终打包产物覆盖。
- M0 E2E 覆盖确认和取消 `https:`/`mailto:` 移交、运行时拒绝非允许协议与凭据、无导航/新窗口/重定向请求、内联脚本和 `connect-src` 行为阻断、权限拒绝，以及从无开发 URL 启动时有效禁用 DevTools。

M0 证据按层分离：

- M0 单元测试覆盖严格契约版本 1 schema、四个稳定错误代码/消息键、请求 ID 关联、六种 sender 拒绝原因、销毁状态回调失败关闭、65,536 字符/深度 8/256 条目值预算、类似 JSON 的序列化、固定路由、受限安全堆栈脱敏和本地 preload 响应校验。
- `tests/unit/preload/app-api.spec.ts` 证明可测试 preload 工厂只使用批准通道且只暴露 `getInfo`；它不能替代 Electron 边界测试。
- `tests/security/electron-boundary.spec.ts` 启动真实生产 Electron，证明当前冻结的 `{ app, commands, files, recovery }` 精确表面、不存在原始 Electron/Node、通用 IPC、对话框或导出方法，并返回真实且 schema 有效的 `AppInfo` Result。为完成此证明，`zod` 必须内联到沙箱 preload bundle；外部 `require("zod")` 表示 preload 边界失败。
- `tests/e2e/navigation-policy.spec.ts` 继续由 M0 拥有导航/外链验证，并与 M0 其余安全组合一起重跑。

M0 命令证据按行为边界分离：

- `tests/unit/domain/command-registry.spec.ts` 证明重复/未知 ID 处理、稳定快照、受保护执行、安全的处理器失败，以及完整 COMMAND-M0 会话/编辑器/对话框/焦点状态矩阵。
- `command-contracts.spec.ts`、`command-api.spec.ts` 和 `application-menu.spec.ts` 证明精确状态/事件 schema、请求 ID 关联、无效事件丢弃、幂等取消订阅、sender 派生的逐窗口快照、失败关闭投影和固定菜单转发。
- `tests/unit/component/command-registry.spec.tsx` 证明按钮、已校验原生事件、渲染器右键菜单和快捷键调用真实注册表；同时覆盖 About 数据/错误行为、待处理请求取消、禁用尝试的焦点来源、Escape/外部点击后的焦点恢复、侧栏来源焦点转移和受 viewport 限制的右键菜单位置。
- `tests/unit/shared/command-contracts.spec.ts` 额外冻结 domain、main 和 renderer 共用的唯一层无关命令元数据/本地化表。`application-menu.spec.ts` 覆盖 blur/无目标以及已销毁窗口无法再解析后的移除。
- `tests/e2e/command-window-shell.spec.ts` 启动生产 Electron，执行四个入口路径并读取真实 AppInfo。安全套件校验精确冻结键，并证明畸形 `files.open` 事件不会到达新增的渲染器监听器。

## 9. 性能测试

参考机：6 核桌面 CPU、16GB RAM、SSD、Windows 11，关闭调试工具，运行打包构建。记录中位数和 P95：冷启动、1/5/10MB 打开、输入到绘制、模式切换、10,000 文件树、搜索首结果、公式/图表批量渲染、HTML/PDF 导出和峰值内存。

基线回退超过 20% 或违反 NFR 指标时阻断；更新基线必须解释硬件、依赖或功能变化。

## 10. 视觉、交互与无障碍复刻

- 截图既用于自身 UI 回归，也用于与公开证据进行视觉复刻对照，但不能替代数据、交互步骤或人工观察证据。
- 每份对照证据必须记录 `REF-*`、`COMP-*`、应用构建标识、Windows 版本、显示分辨率、缩放比例、窗口尺寸、主题、语言、文档夹具和交互状态；缺少任一关键条件时不得签署视觉通过。
- 覆盖 100/150/200/250% 缩放、六套内置主题、系统浅/深/高对比、窄窗口、长中文文案、菜单/侧栏/设置/弹层、编辑器空闲/选区/光标/悬停/错误等关键状态。
- 视觉对照同时检查布局、间距、字体层级、颜色、边框、阴影、控件密度、可见内容和状态反馈。容差必须由当前迭代测试用例预先定义，不能在看到结果后放宽。
- 交互对照按照公开证据复现入口、步骤、焦点、键盘、鼠标、状态变化和退出行为；结果相同但路径或反馈不同仍记为差异。
- axe、键盘导航自动化、语义树与受控截图共同形成默认无障碍和界面证据。只有独立设计确认存在不可自动观察的物理边界并启用 `manual_gate:true` 时，才增加人工评估；人工观察不得替代可自动化的断言。
- 资料不足时把项目标为 `evidence_gap` 并继续补证；已知差异、替代流程和证据缺口都不能记为 `passed`。

## 11. 命令契约

M0 建立以下脚本，之后迭代不得改名而不更新全部文档：

```powershell
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm test:performance
pnpm test:bootstrap:cold
pnpm test:acceptance:m1
pnpm audit:deps
pnpm audit:sbom
pnpm verify:workflows
pnpm audit:m0
pnpm package:dir
pnpm package:win
pnpm test:packaged
pnpm build
pnpm check
```

`pnpm check` 至少包含 format:check、lint、typecheck、unit、integration 和 build，并且不得访问网络。E2E、安全、性能按迭代入口和退出门禁显式运行。`pnpm test:bootstrap:cold` 是使用空项目级 store 的显式、允许联网冷自举门禁，不进入 `check`。

M1 使用有限时、可重放的 Windows Electron 自动验收套件，不进入 `pnpm check`，由 `TC-M1-013` 覆盖 CDP 组合输入、冻结字节夹具、冲突各分支、强制终止恢复和关闭决策，并生成不含正文或绝对路径的 JSON 证据。所有等待和子进程均有明确超时，禁止无限循环与重试掩盖。

`pnpm audit:deps` 是显式联网门禁：生产图保留 high/critical 阈值并生成许可证/SBOM 输入，完整开发与构建工具链使用与 Dependency Review 一致的 moderate 阈值并生成 `toolchain-audit.json`。pnpm 结构化 audit 因发现阈值内公告而返回 `1` 时仍必须解析并验证报告；超时、输出超限、其他退出码、无效 JSON 或未知 schema 一律失败。

TC-M0-007 的本地顺序是：冻结安装/基础质量与 Electron 套件 → 验证 `node_modules/electron/dist` 的目录、可执行文件、资源目录和精确版本 → `package:win` → `test:packaged` → `audit:m0`。`package:win` 通过 `build.electronDist` 复用已校验的安装运行时，不再次下载同版本 Electron；运行时缺失或版本漂移必须在打包前失败。综合审计要求安装包、unpacked executable、`app.asar` 和品牌图标已存在；它随后重建生产依赖/许可证/漏洞报告、全工具链漏洞报告、CycloneDX SBOM、工作流证明、品牌校验、artifact 哈希和六步门禁报告。`tests/integration/m0-gate.spec.ts` 使用真实临时目录和真实子进程覆盖成功顺序、浮动 Action、越权权限、危险触发器、缺失 frozen install、命令漂移、越界上传、无界循环、各审计错误和超时。

TC-M0-002 在临时项目副本中启动嵌套 `pnpm check` 时必须设置 `LATTICE_QUALITY_META_CHILD=1`。集成测试配置仅在该变量存在时排除 `quality-scripts.spec.ts` 自身，仍运行其余集成测试；顶层 `test:integration` 不设置该变量，因此持续覆盖 TC-M0-002，避免递归而不跳过真实集成验证。

M0 建立质量脚本；在它退出前，`pnpm check`、构建和与范围相关的集成、安全与 E2E 证据必须全部通过。禁止用空脚本或固定成功脚本伪造通过。

## 12. 覆盖与反作弊

- 领域与安全模块分支覆盖目标 90%，其他核心模块 80%；覆盖率不是完成条件的替代。
- 禁止 `.skip`、`.only`、宽泛 snapshot、吞异常、无断言测试和为了通过而删除 fixture。
- flaky 测试先隔离根因；不可长期重试掩盖。任何 quarantine 必须有迭代 ID、负责人和期限。

## 13. CI 和验收门禁

- 开发中：运行当前能力的聚焦测试，失败时留在当前迭代并修复根因。
- 迭代退出：在 Windows 当前主环境运行 `pnpm check`，并运行当前 `03-test-cases.md` 要求的 E2E、安全、性能和集成套件。
- 自动化是默认且阻断性的迭代出口证据。M0 保留既有历史人工结论；M1–M8 当前 `manual_gate:false`，在 `04-test-report.md` 和 `05-exit-report.md` 形成逐项自动证据。只有独立设计证明存在不可自动观察的物理边界时才能启用人工门禁，且不得用人工自评替代缺失的自动覆盖。
- 任一已到达范围的 `COMP-*` 存在已知差异、未实现项或关键证据缺口时，当前迭代不得进入 `passed`，后续迭代也不得以汇总名义接收该缺口。

## 14. 可执行用例规格

- 每个迭代必须至少关联一个 [`TC-*`](../iterations/README.md)，每个 `manual_gate:true` 迭代必须关联至少一个 `MAN-*`。
- 实现测试前读取当前迭代的参数矩阵；矩阵每一行都要成为独立实例，不允许只实现表格中的正常路径。
- 用例的步骤、预期、严重度和证据是迭代验收契约。能力拆分可以调整，但用例 ID 不得复用或静默删除。
- 夹具和环境按当前迭代的 `03-test-cases.md` 创建；实际 SHA-256 和来源在 M0/M1 实现时补入 manifest。
