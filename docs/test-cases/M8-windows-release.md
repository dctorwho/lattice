# M8 测试用例：Windows 发布

目标：证明 Windows 安装制品、文件关联、命令行、单实例、升级/卸载、签名更新和回滚在干净 VM 中可重复，且永不删除用户 Markdown。

## 自动化与半自动用例

| ID        | 任务   | 层级/级别               | 数据/环境   | 步骤                                                                                    | 预期                                                                             | 自动化                                                                   |
| --------- | ------ | ----------------------- | ----------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| TC-M8-001 | M8-T01 | packaging/P1            | PKG-M8      | 从干净 tag/checkout 构建 x64 unpacked/NSIS 两次，检查版本/资源/内容/启动/修复安装和哈希 | 制品可安装启动；无开发文件/密钥/测试正文；userData 与安装目录分离；差异可解释    | `pnpm test:integration -- tests/integration/package.spec.ts`             |
| TC-M8-002 | M8-T02 | e2e-security/P0         | ROUTE-M8    | 从资源管理器/PowerShell/二次启动传文件、文件夹、定位和非法参数，切当前/新窗口策略       | 引号/Unicode/长路径正确；参数不经 shell；单实例不丢脏文档；非法/越权参数安全失败 | `pnpm test:e2e -- tests/e2e/windows-routing.spec.ts`                     |
| TC-M8-003 | M8-T03 | installer/P0            | INSTALL-M8  | 干净安装、覆盖升级、被占用失败、降级、修复、卸载保留/清理，再重装并比较数据             | 应用失败可回滚；设置/主题/恢复按选择保留；用户 Markdown/工作区永不删除           | `pnpm test:integration -- tests/integration/installer-lifecycle.spec.ts` |
| TC-M8-004 | M8-T04 | integration-security/P0 | UPDATE-M8   | 用 fake feed 测稳定/预览、有效/错误签名、断网/中断/损坏包、安装前脏文档和回滚           | 未配公钥完全禁用；只接受签名制品；失败留在可启动旧版；保存/恢复不丢内容          | `pnpm test:security -- tests/security/update-adapter.spec.ts`            |
| TC-M8-005 | M8-T05 | supply-chain/P1         | ARTIFACT-M8 | 生成并交叉检查 SBOM、许可证、哈希、签名步骤、命名、说明、隐私和安全入口；签名后复验     | SBOM 覆盖制品；许可证齐全；无密钥/正文日志；签名可验证；哈希链明确               | `pnpm test:integration -- tests/integration/release-artifacts.spec.ts`   |
| TC-M8-006 | M8-T06 | vm-e2e/P0               | VM-M8       | 在 Win10/11 干净 VM 执行安装→关联→编辑→强杀恢复→导出→升级→卸载，覆盖缩放                | 全旅程通过；关联/命令行/打印/IME/多显示器可用；卸载数据范围正确；制品哈希匹配    | `pnpm test:e2e -- tests/e2e/windows-vm-gate.spec.ts`                     |
| TC-M8-007 | M8-T07 | release-audit/P0        | STABLE-M8   | 检查 RC 七天、全部任务/测试/门禁/P0/P1/gaps、回滚演练、支持渠道和制品归档               | 所有任务 passed；无未批准 gap/P0/P1；回滚到上版不丢设置/文档；Stable 可追溯      | `pnpm test:integration -- tests/integration/stable-audit.spec.ts`        |
| TC-M8-008 | M8-T03 | installer-security/P0   | DELETE-M8   | 在安装目录、userData、工作区和相邻目录放置 canary，执行升级/卸载保留和清理              | 只删除声明的应用/可选 userData；工作区、用户 Markdown和相邻 canary 哈希完全不变  | `pnpm test:security -- tests/security/uninstall-scope.spec.ts`           |

## 参数矩阵

- `PKG-M8`：普通/含空格中文构建路径；x64 unpacked/NSIS；首次/重复构建；普通用户；修复安装。
- `ROUTE-M8`：`.md/.markdown/.mdown/.mkd/.txt/.qmd`、文件夹、不存在文件、行列定位、多个参数、空格/中文/长路径、普通/管理员、当前/新窗口。
- `INSTALL-M8`：ENV-WIN10/11；全新、同版覆盖、旧→新、降级、占用文件、磁盘不足、断电模拟；保留/清理 userData。
- `UPDATE-M8`：稳定/预览 feed；无/有效/过期/错误签名；404/断网/中断/hash 错/损坏包；clean/dirty/恢复中会话。
- `ARTIFACT-M8`：unpacked/installer/签名 installer；SBOM、第三方声明、SHA-256、发布说明、隐私/安全入口。
- `VM-M8`：Win10/11，100/150/250%，单/多显示器，微软拼音，系统 PDF/真实打印机；在线/离线。
- `DELETE-M8`：安装目录、userData/settings/themes/recovery/logs、用户 Documents/工作区、相邻目录、junction/symlink canary。

## 人工门禁

| ID         | 任务   | 环境                 | 步骤                                                                                                                                         | 通过条件                                                                    | 证据                                                 |
| ---------- | ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| MAN-M8-001 | M8-T06 | ENV-WIN10、ENV-WIN11 | 1. 干净安装；2. 双击关联和 PowerShell 打开中文路径；3. 微软拼音编辑并强杀恢复；4. PDF/打印；5. 多显示器/缩放；6. 覆盖升级；7. 卸载保留与清理 | 所有旅程可用；签名/哈希正确；无数据丢失；卸载不碰用户文档；窗口和输入法正常 | VM 快照、制品哈希、命令记录、数据前后哈希、截图/录屏 |
| MAN-M8-002 | M8-T07 | Stable 审计环境      | 1. RC 真实使用七天；2. 审阅签名/SBOM/许可证/gaps；3. 从 RC 回滚上版再升级；4. 核验支持和安全入口；5. 批准 Stable                             | 七天无 P0/P1；回滚/再升级不丢设置/文档；所有证据归档；用户明确批准          | 七天记录、回滚哈希、审计签署、最终制品清单           |

## 证据与停止条件

保存 VM 快照/版本、安装器日志、命令行、注册表差异、制品/用户数据前后哈希、签名验证和回滚结果。安装/更新不可回滚、签名绕过、单实例丢脏文档或安装卸载删除用户文件均为 P0，禁止 Stable。
