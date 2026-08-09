# M8：Windows 发布

必读：[发布门禁](../docs/10-release-quality-gates.md)、[数据安全](../docs/05-data-safety-and-security.md)、[用户旅程](../docs/19-user-journeys.md)、[风险](../docs/12-risk-register.md)、[M8 测试用例](../docs/test-cases/M8-windows-release.md)。

## M8-T01 NSIS 打包

- 依赖：M7-T09
- 需求：OS-005
- 交付：electron-builder NSIS、x64 unpacked/installer、应用资源、版本信息、安装目录与用户数据分离、可重复构建配置。
- 验证：REL-001..015，构建/安装/启动/修复安装、哈希和无开发文件；不误删用户数据。

## M8-T02 单实例、文件关联与命令行

- 依赖：M8-T01
- 需求：OS-001..003
- 交付：single instance lock、二次启动路由、文件/文件夹/定位参数、支持扩展关联、Open With、路径引用和不存在文件策略。
- 验证：OS-021..060，Unicode/长路径/多个参数/当前或新窗口/管理员差异/非法参数。

## M8-T03 安装、升级与卸载

- 依赖：M8-T02
- 需求：OS-005
- 交付：per-user 安装、升级保留设置/主题/恢复、卸载选择保留数据、失败回滚和旧版本迁移测试。
- 验证：REL-016..035，干净 VM、覆盖安装、降级拒绝/说明、被占用文件、卸载后用户 Markdown 原样存在。

## M8-T04 更新基础设施

- 依赖：M8-T03
- 需求：OS-006
- 交付：默认关闭的签名更新 adapter、稳定/预览通道、静态 feed schema、下载校验、安装前保存/恢复；自用构建不请求更新网络。
- 验证：REL-036..055，fake feed、签名错误、断网/中断/回滚；未配置公钥时完全禁用。

## M8-T05 制品、SBOM、许可证与签名准备

- 依赖：M8-T04
- 需求：发布安全
- 交付：SBOM、第三方声明、二进制哈希、签名步骤文档、制品命名、发布说明模板、安全报告入口和隐私说明。
- 验证：制品内容与 SBOM 一致，无开发密钥/源码日志/测试 fixture；签名后哈希与验证流程清楚。

## M8-T06 Windows VM 发布门禁

- 依赖：M8-T05
- 需求：COMP-033..035
- 交付：Windows 10/11 干净 VM，100%/150%/250% 缩放，安装—关联—编辑—恢复—导出—升级—卸载证据。
- 验证：打包 E2E、security、installer checks 全部通过并关联 VM 制品哈希。
- 人工门禁：真实资源管理器、命令行、打印、输入法、多显示器和卸载数据检查；Codex 设 awaiting_manual 后停止。

## M8-T07 Stable 完成审计

- 依赖：M8-T06
- 需求：全部产品目标
- 交付：RC 七天记录、全需求/兼容/任务/测试/发布门禁审计，P0/P1 为零，documented gaps 明示，回滚演练完成。
- 验证：`docs/10-release-quality-gates.md` Stable 每项证据；所有任务 passed，无 ready/in_progress/failed/awaiting_manual。
- 人工：用户核验七天 RC、签名/制品/回滚证据并批准 Stable；Codex 只能汇总证据。
- 完成：产品文档定义的 1.13.8 公开功能目标达成；后续 Typora 版本和商业化进入新路线图。
