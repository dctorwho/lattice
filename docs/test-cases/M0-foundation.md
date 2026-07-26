# M0 测试用例：工程基础

目标：证明项目可重复构建、质量命令真实阻断失败、Electron 权限边界安全、共享契约可运行、命令入口统一，并产出可审计 CI 证据。

## 自动化与半自动用例

| ID        | 任务   | 层级/级别        | 数据/环境                                                              | 步骤                                                                                                                | 预期                                                                                           | 自动化                                                                 |
| --------- | ------ | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| TC-M0-001 | M0-T01 | integration/P1   | ENV-M0-A with validated store and offline install; automated by M0-T02 | frozen offline install and two builds in a Chinese-and-space path                                                   | unique lockfile, no pending builds, stable artifact hashes, cleanup                            | `pnpm test:integration -- tests/integration/project-bootstrap.spec.ts` |
| TC-M0-002 | M0-T02 | integration/P1   | isolated temporary copies                                              | run normal scripts; inject format, lint, type, unit, integration, and build faults                                  | direct commands and guarded nested `check` fail correctly without recursion                    | `pnpm test:integration -- tests/integration/quality-scripts.spec.ts`   |
| TC-M0-008 | M0-T02 | integration/P1   | Chinese-and-space path, empty project store, network allowed           | frozen install and two builds                                                                                       | unique lockfile, no pending builds, stable artifacts, cleanup                                  | `pnpm test:bootstrap:cold`                                             |
| TC-M0-003 | M0-T03 | security/P0      | SEC-M0-A                                                               | 启动生产配置，探测主窗口/伪造窗口/已销毁窗口、Node/Electron/裸 IPC/preload 表面，并投递污染对象和超大 renderer 消息 | `require/process/ipcRenderer/fs/shell` 不可得；preload 表面为空；无消息进入 main；窗口保持存活 | `pnpm test:security -- tests/security/electron-boundary.spec.ts`       |
| TC-M0-004 | M0-T03 | e2e-security/P0  | SEC-M0-B                                                               | 触发 http/file/javascript/data/自定义协议、导航、新窗口和权限请求                                                   | 仅经确认的 https/mailto 外链交给系统；其余拒绝；主窗口不导航；无 DevTools 后门                 | `pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts`                 |
| TC-M0-005 | M0-T04 | unit-security/P1 | CONTRACT-M0                                                            | 对每个 Zod 请求/响应运行有效值、缺字段、未知字段、超限值、错误 sender 和不可序列化结果                              | 返回稳定 `Result`/错误码/request ID；日志脱敏；未知 channel 不可调用                           | `pnpm test -- tests/unit/shared/contracts.spec.ts`                     |
| TC-M0-006 | M0-T05 | component/P1     | COMMAND-M0                                                             | 从菜单、按钮、右键和快捷键调用同一命令；切换可见/启用/选中上下文                                                    | 四入口使用同一 command ID 和状态；禁用命令不执行；焦点回到合理控件                             | `pnpm test -- tests/unit/component/command-registry.spec.ts`           |
| TC-M0-007 | M0-T06 | integration/P1   | ENV-M0-A                                                               | 在干净 checkout 运行 CI 等价命令、许可证审计、SBOM 和构建制品检查                                                   | CI 命令与文档一致；制品可启动；依赖有版本/许可证；SBOM 可解析且覆盖生产依赖                    | `pnpm test:integration -- tests/integration/m0-gate.spec.ts`           |

M0-T01 自举执行说明：TC-M0-001 的“自动化”列固定其最终回归目标，但该文件和 `test:integration` 脚本在 M0-T01 尚不存在。M0-T01 按 AGENTS/测试策略运行等价命令并以退出码取证即可完成；M0-T02 必须创建该测试文件、让同一检查进入 `pnpm test:integration` 并重新通过。此例外不适用于其他 TC。

### M0-T03 external-link acceptance detail

`TC-M0-004` covers the following independently observable requirements:

- A maximum of 2,081 UTF-16 code units and rejection of leading/trailing
  whitespace, control characters, parse failures, credentials, empty targets,
  and non-`https:`/`mailto:` protocols.
- Synchronous denial of renderer navigation, redirects, new windows, and
  webview attachment. Redirects never inherit the original URL's confirmation.
- A main-process confirmation double and `shell.openExternal` double establish
  that only a confirmed normalized URL reaches the OS handoff; no real browser
  or mail client is launched.
- CSP restrictions (`connect-src 'none'`, script/style `'self'`, and denied
  object/frame/form/base capabilities), default permission denial, and
  `devTools: false` from a no-development-URL launch. The M0-T03
  `resolve-main-window-options` factory/unit test separately proves packaged
  development-URL rejection; M0-T06 supplies final packaged-artifact coverage.

## 参数矩阵

- `ENV-M0-A`：含空格和中文的普通用户路径；复用已验证的 pnpm store；每日回归时冻结离线安装并重复执行两次验证幂等。
- `ENV-M0-B`：含空格和中文的普通用户路径；空项目级 pnpm store；允许联网执行冻结安装和两次构建的冷自举门禁。
- `SEC-M0-A`：主窗口、伪造窗口、已销毁窗口；有效/缺失/错误 request ID；对象原型污染和超大 payload。
- `SEC-M0-B`：`https:`、`mailto:`、`http:`、`file:`、`javascript:`、`data:`、大小写/编码混淆协议、重定向。
- `CONTRACT-M0`：成功、业务错误、校验错误、权限错误、取消、超时；错误详情不得含正文或绝对路径。
- `COMMAND-M0`：无会话、clean/dirty 会话、无 editor、对话框打开、窗口失焦。

## 人工门禁

| ID         | 任务   | 环境                | 步骤                                                                                                          | 通过条件                                                                 | 证据                               |
| ---------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| MAN-M0-001 | M0-T06 | Windows 11 普通用户 | 1. 查看打包窗口和进程参数；2. 尝试打开 DevTools/导航；3. 审阅 preload API、CI、许可证和 SBOM；4. 重跑发布构建 | 无 Node/裸 IPC/开发 URL；应用能启动；依赖来源和许可证可接受；CI 证据完整 | 截图、构建哈希、审计报告、签署结论 |

## 证据与停止条件

必须保存脚本退出码、构建哈希、preload 表面快照、CSP/安全配置、SBOM 和许可证报告。任何 renderer 获得 Node/裸 IPC、危险协议执行、质量脚本假绿或不可重复构建均停止 M0。
