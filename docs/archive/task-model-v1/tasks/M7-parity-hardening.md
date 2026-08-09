# M7：设置、兼容与质量收口

必读：[兼容矩阵](../docs/02-compatibility-matrix.md)、[设置 schema](../docs/17-settings-and-storage-schema.md)、[用户旅程](../docs/19-user-journeys.md)、[发布门禁](../docs/10-release-quality-gates.md)、[M7 测试用例](../docs/test-cases/M7-parity-hardening.md)。

## M7-T01 设置 schema、迁移与 UI

- 依赖：M6-T09
- 需求：UI-005
- 交付：通用/外观/编辑器/Markdown/文件/图片/导出/高级分类，Zod schema/version/migration、原子设置写入、坏文件恢复、即时生效/重启提示。
- 验证：PREF-001..035，所有设置有消费者，不存在无效果开关；迁移/损坏/重置/多窗口同步。

## M7-T02 快捷键覆盖

- 依赖：M7-T01
- 需求：UI-006
- 交付：Windows 默认映射、用户覆盖、冲突检测、重置、菜单显示和不可覆盖系统保留键说明。
- 验证：PREF-036..060，所有 command ID 映射、冲突/非法键、重载和多窗口。

## M7-T03 国际化

- 依赖：M7-T01
- 需求：UI-007
- 交付：简体中文/英文完整字符串、菜单重建、日期/数字/复数、本地化错误；伪本地化检查截断。
- 验证：UI 文案键完整、无散落关键 literal、中文长文案 100%–250% 截图和语言热切换。

## M7-T04 无障碍

- 依赖：M7-T02、M7-T03
- 需求：UI-008
- 交付：键盘路径、焦点恢复、accessible name、live region、对比、减少动画和高对比主题适配。
- 验证：A11Y-001..045、axe、纯键盘全流程、Narrator 冒烟和缩放。
- 人工：使用 Windows Narrator、键盘和 200%/高对比模式完成 J-001/J-003 的核心路径。

## M7-T05 完整兼容语料与矩阵

- 依赖：M7-T01
- 需求：COMP-001..036
- 交付：逐项官方示例 fixture、命令/设置/文件输出追踪、差异记录；更新 `docs/02-compatibility-matrix.md`。
- 验证：每个 COMP 有测试或 documented_gap 证据；不得用类别级 smoke 代替具体项。

## M7-T06 大文档和性能收口

- 依赖：M7-T05
- 需求：DOC-010、NFR-002..006、NFR-010；风险 R-005、R-019
- 交付：大文件降级模式、视口/worker 调度、内存泄漏修复、参考机 P50/P95 报告和性能预算仪表。
- 验证：1/5/10MB、10,000 文件、100 公式/图表、长时间编辑、100 次窗口/文档切换；回退阈值明确。

## M7-T07 日志、隐私、帮助与诊断

- 依赖：M7-T01
- 需求：NFR-009
- 交付：脱敏滚动日志、日志目录/清理、诊断导出预览、隐私说明、恢复/冲突/导出故障帮助和关于页许可证。
- 验证：日志扫描不含正文/绝对路径/搜索/剪贴板；诊断包用户可检查。

## M7-T08 四周日用与缺陷冻结

- 依赖：M7-T04、M7-T06、M7-T07
- 需求：NFR-001、COMP-001..036
- 交付：四周日用记录、P0/P1 清零、P2 列表、崩溃/恢复/导出统计（本地人工）、版本冻结候选。
- 验证：每周完整 regression/security/performance，四周证据均归档且无未关闭 P0/P1。
- 人工门禁：Codex 只能设 `awaiting_manual`；用户完成四周并记录结果后才能 passed。

## M7-T09 RC 审计

- 依赖：M7-T08
- 需求：M7 退出门禁
- 交付：需求—兼容—任务—测试追踪审计、依赖/SBOM/许可证、安全、性能、用户文档和 known gaps 报告。
- 验证：`docs/10-release-quality-gates.md` Alpha/Beta/RC 条件逐项有证据；通过后解锁 M8-T01。
- 人工：用户签署 documented gaps、P2 列表和 RC 范围，Codex 不得自行批准。
