# M0 详细设计

## 迭代上下文

- 迭代： `M0`
- 状态权威： `iterations/state.json`
- 架构依据：[架构](../../docs/03-architecture.md)
- 数据安全与安全规则：[数据安全与安全边界](../../docs/05-data-safety-and-security.md)

## 架构边界

主进程负责生命周期、BrowserWindow 创建、session 与 WebContents 策略、原生菜单、操作系统移交和诊断。Preload 只暴露窄类型冻结能力。渲染器负责 React 外壳状态和纯 TypeScript 命令注册表；它绝不获得原始 Node、Electron、文件系统、shell、窗口身份或任意 IPC 访问。

## 能力设计

### 可复现工程基础

固定包管理器和运行时版本，保留单一锁文件，并提供格式化、lint、严格类型、单元、集成、E2E、安全、性能、冷自举、构建和聚合命令。故障注入在隔离副本中运行，嵌套聚合检查具有受限递归防护。早期自举例外记录具体命令退出码；后续回归覆盖自动验证同一自举不变量。

### 安全 Electron 外壳

在 ready 前启用沙箱。BrowserWindow 选项禁用 Node、DevTools、webview 和不安全内容。Session 策略提供 CSP 并拒绝权限检查与请求。WebContents 策略同步阻断导航、重定向、新窗口和 webview 附加。外部 URL 策略限制并解析输入，只在确认后允许无凭据的批准目标，并仅把规范化 URL 交给操作系统。

### 共享契约和诊断

`src/shared/contracts/` 中的契约从 Zod 派生严格 TypeScript 类型。固定路由依次校验 sender 所有权、预算、请求 schema、处理器结果、响应 schema 和类似 JSON 的可序列化性。主进程派生窗口/WebContents/session 上下文；渲染器输入不能提供。稳定 `Result` 错误使用本地化键，诊断只保留受限且获批准的脱敏字段。

### 命令和窗口外壳

纯渲染器 `CommandRegistry` 是唯一命令权威。共享元数据提供稳定 ID、标签、快捷键、分组和本地化。按钮、渲染器右键菜单和快捷键直接调用注册表；原生菜单是经校验的逐聚焦窗口投影，只返回批准命令事件。无效、过期、缺失、已销毁或未聚焦目标失败关闭。侧栏和 About 流程确定性恢复焦点。

### CI、依赖审计和打包产物门禁

从干净检出运行 Windows CI 等效命令。审计生产依赖版本和许可证，以 Dependency Review 的 moderate 阈值审计完整开发/构建工具链，生成可解析 SBOM，验证命令文档与可执行脚本一致，并证明打包产物启动时没有开发 URL 或权限回退。生产依赖图保持只使用 MIT。Dependency Review 按精确审阅的宽松许可证集合 MIT、Apache-2.0、BSD-2-Clause、BSD-3-Clause、ISC、0BSD、BlueOak-1.0.0、Python-2.0 和 WTFPL 评估更广泛的开发/构建图；未知或未列出许可证继续阻断，不允许依赖级绕过。

本地门禁特意由窄边界组成。生产依赖/许可证/漏洞和完整工具链漏洞规范化生成无路径 JSON；CycloneDX 生成要求组件/许可证/依赖精确覆盖；包哈希只接受明确的仓库相对普通文件。有限编排器按顺序运行规划、依赖审计、SBOM、工作流验证、品牌验证和产物哈希，每步有超时和输出预算。GitHub 自动化保留既有 `quality` 检查标识，增加 CodeQL 和 Dependency Review，只使用已审阅提交 SHA 和最小权限，并且只上传 `artifacts/m0`。

## 模块职责

- `src/main/bootstrap` 组合沙箱设置和不可变主窗口配置。
- `src/main/security` 负责 CSP、权限、WebContents 和外部 URL。
- `src/shared/contracts` 和 `src/shared/errors` 负责 Zod schema 和稳定错误词汇。
- `src/main/ipc` 负责路由校验和应用派生的 sender 上下文。
- `src/preload/api` 只暴露冻结且已校验的方法。
- `src/domain/commands`、`src/shared/commands` 和 `src/shared/i18n` 负责命令行为、元数据和本地化标签。
- `scripts/audit` 负责规范化生产依赖证据、完整工具链漏洞证据、CycloneDX、产物哈希和有限 M0 门禁；它不成为产品运行时依赖。
- `scripts/verify-workflows.mjs` 负责精确 GitHub 自动化白名单、action 固定版本、权限、命令一致性和产物上传边界。

## 接口与数据流

`渲染器命令状态 -> 冻结 preload schema 校验 -> 固定 IPC 路由 -> sender/窗口校验 -> 受限 Zod 载荷 -> 原生菜单快照`。

`原生菜单点击 -> 已授权聚焦窗口 -> 固定已校验事件 -> preload 校验 -> CommandRegistry.execute`。

`渲染器应用请求 -> 冻结 preload 请求 ID -> 固定路由 -> 主进程派生身份 -> 预算和 Zod 校验 -> Result 响应 -> preload 响应校验 -> 渲染器`。

## 数据安全、失败处理、迁移与兼容性约束

这里不引入产品文档模型或富文本模型。安全策略失败、无效 sender、无效 schema、序列化预算超限或诊断接收器失败都会返回稳定的失败关闭结果，且不记录原始载荷。不允许任意通道、事件注册、文件方法或权限降级。打包和依赖失败保留证据并阻断迭代，不能通过削弱检查绕过。

## 依赖准入

生产依赖必须在技术栈文档记录用途，采用兼容许可证和固定版本，可被审计，并纳入 SBOM。可选工具不得成为核心编辑或原生导出行为的前置条件。

保留的 M0 基础工作准入精确开发依赖 `electron-builder@26.15.3`，用于 Windows x64 `dir` 和 NSIS 打包。其用途、许可证、原生工具和安装脚本暴露、替代方案及包影响记录在技术栈台账中。M0 不使用 Squirrel，因此根 `pnpm-workspace.yaml` 应用精确、限定版本的 override，只移除未使用的 `app-builder-lib@26.15.3 -> electron-builder-squirrel-windows` peer 边。解析后的包图因此既不包含 Squirrel packager，也不包含 `electron-winstaller`，锁文件同样没有二者的包或 snapshot 记录；其他依赖继续使用 pnpm 正常 peer 处理。只允许先前审阅的 `esbuild` 安装脚本。打包前，冻结安装必须报告没有自动待构建项。升级 `electron-builder` 或未来决定支持 Squirrel 时，必须先重新审阅依赖和安装脚本，再修改 override。

Windows 打包把 `build.electronDist` 设为 `node_modules/electron/dist`。冻结安装和明确 Electron 运行时验证必须先完整生成精确 `electron@43.1.1` 目录；electron-builder 随后使用这些经校验和验证的本地字节，不为同一运行时开启第二条下载路径。如果目录、`electron.exe`、`resources/` 或版本文件缺失，或与声明 Electron 版本不符，打包契约测试失败关闭。禁用上游校验和校验不是可接受的回退方案。

原创 Lattice SVG、确定性 PNG 和 ICO 位于 `build/brand/`。`scripts/assets/build-lattice-icon.mjs --check` 在内存中重新生成预期字节，拒绝与已提交资源不一致的结果。自举验证器把完整 `pnpm ignored-builds` 输出当作严格契约：只接受有效自动区段，以及存在时精确且非空的显式拒绝区段；未知标题、裸后缀、混合 `None` 值、畸形包名和不完整区段均失败关闭。

保留实现以提交 `3ae487861f0535f2d17e8558aebc5f15bb37cb78` 集成进迭代治理历史，该提交来自保留提交 `ea8aac1a94d89d0ffdb61f91882b661c8f5eb856`；随后解析器加固提交 `644ad699384cfe608a84132b44ebbb43af950817` 来自保留提交 `a82f9369d958fbcd9c9c91a7dc410436f5205d35`。旧任务状态和任务文档提交有意未集成。

## 人工门禁设计

评估人检查打包 Windows 构建、进程参数、DevTools 与导航行为、冻结 preload 表面、CI 证据、许可证和 SBOM。生成的截图、哈希、审计报告和签署结论属于 M0 证据记录；代理可以准备材料，但不能批准门禁。

## 实施顺序

- [x] 建立可复现自举、锁文件、严格检查和故障注入覆盖。
- [x] 应用生产沙箱、窗口、session、WebContents 和 URL 策略。
- [x] 增加严格共享契约、sender 所有权、受限值和脱敏错误。
- [x] 交付共享命令元数据、注册表、菜单投影和可访问外壳。
- [x] 准入精确打包依赖、确定性品牌资源和失败关闭 ignored-build 解析器。
- [x] 实现并在本地验证依赖/许可证/漏洞审计、CycloneDX SBOM、Windows 打包、打包启动、产物哈希和 TC-M0-007 有限门禁。
- [ ] 发布并证明干净检出的 GitHub 检查和 main ruleset，然后把 MAN-M0-001 移交评估人。
