# M7 测试用例：设置、兼容与质量收口

目标：证明所有设置和快捷键真实接线，中英文与无障碍可用，全部 COMP 项有细粒度证据，大文档性能达预算，日志保护隐私，并通过四周日用和 RC 审计。

## 自动化与半自动用例

| ID        | 任务   | 层级/级别               | 数据/环境 | 步骤                                                                                   | 预期                                                                                   | 自动化                                                                    |
| --------- | ------ | ----------------------- | --------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| TC-M7-001 | M7-T01 | unit-component/P1       | PREF-M7   | 加载每个 schema 版本、损坏/缺失/未知设置；逐个修改 UI 控件并观察消费者和多窗口         | 迁移保值且原子写入；坏文件备份恢复；每个设置有唯一消费者和即时/重启语义                | `pnpm test -- tests/unit/component/settings.spec.ts`                      |
| TC-M7-002 | M7-T02 | unit-e2e/P1             | KEY-M7    | 校验全部 command ID 默认映射；覆盖、冲突、非法/保留键、重置、重载和多窗口              | 每个命令映射确定；冲突可见不静默覆盖；菜单显示更新；系统保留键说明                     | `pnpm test:e2e -- tests/e2e/keybindings.spec.ts`                          |
| TC-M7-003 | M7-T03 | component-visual/P1     | I18N-M7   | 切换中/英/伪本地化，重建菜单，遍历页面/错误；各缩放截图                                | 无缺 key/关键散落 literal；日期数字复数正确；热切换完整；长文本不截断关键操作          | `pnpm test -- tests/unit/component/i18n.spec.ts`                          |
| TC-M7-004 | M7-T04 | component-e2e/P1        | A11Y-M7   | 运行 axe；纯键盘完成 J-001/J-003；检查焦点顺序/恢复/name/live region/对比/减少动画     | 无严重 axe 问题；所有核心操作可达；焦点可见稳定；状态被读出；200% 可重排               | `pnpm test:e2e -- tests/e2e/accessibility.spec.ts`                        |
| TC-M7-005 | M7-T05 | traceability/P0         | COMP-M7   | 对 COMP-001..036 逐项加载官方/自建 fixture，执行声明的命令/设置/输出并链接证据         | 每项为 passed 或有来源、复现、影响和替代路径的 documented_gap；类别 smoke 不代替具体项 | `pnpm test:integration -- tests/integration/compatibility-matrix.spec.ts` |
| TC-M7-006 | M7-T06 | performance/P1          | PERF-M7   | 在打包构建测冷启动、1/5/10MB 打开、输入、切换、10k 树/搜索、100 图表、导出、长期编辑   | 记录 P50/P95/峰值；满足 NFR；相对基线回退≤20%；大文件降级仍可编辑                      | `pnpm test:performance -- tests/performance/product-budgets.spec.ts`      |
| TC-M7-007 | M7-T06 | soak/P1                 | LEAK-M7   | 循环打开/关闭文档和窗口 100 次，编辑 2 小时，反复渲染公式图表并采样内存/句柄           | GC 后稳定平台无持续增长；worker/renderer/句柄/临时目录被清理                           | `pnpm test:performance -- tests/performance/leak-soak.spec.ts`            |
| TC-M7-008 | M7-T07 | security-integration/P0 | PRIV-M7   | 触发打开/保存/冲突/搜索/剪贴板/导出/崩溃错误，扫描日志和诊断包，执行清理               | 不含正文、完整路径、搜索词、剪贴板/YAML；路径脱敏；用户可预览和清理；帮助可操作        | `pnpm test:security -- tests/security/log-privacy.spec.ts`                |
| TC-M7-009 | M7-T08 | regression-soak/P0      | SOAK-M7   | 每周运行 full regression/security/performance，归档崩溃/恢复/导出本地统计和缺陷状态    | 连续四周证据完整；P0/P1 为零；P2 有负责人/目标；无被跳过关键测试                       | `pnpm test:integration -- tests/integration/m7-weekly-gate.spec.ts`       |
| TC-M7-010 | M7-T09 | audit/P0                | RC-M7     | 生成需求—兼容—任务—测试追踪，检查依赖/SBOM/许可证、安全、性能、文档、known gaps 和门禁 | 所有引用可解析且有证据；Alpha/Beta/RC 每项满足；范围冻结；未批准 gap 阻断              | `pnpm test:integration -- tests/integration/rc-audit.spec.ts`             |

## 参数矩阵

- `PREF-M7`：默认、每个历史 schema、缺字段/未知字段/类型错/截断 JSON；所有设置分类；单/多窗口；写入失败。
- `KEY-M7`：所有 command ID；Ctrl/Alt/Shift 组合、功能键、输入法保留键、系统保留键、重复映射、损坏配置。
- `I18N-M7`：简中/英文/伪本地化；菜单、对话框、错误、设置、状态栏；100/150/200/250%、窄窗口。
- `A11Y-M7`：浅/深/高对比、减少动画、100/200/250%；键盘、Narrator 人工；正常/错误/进度/对话框状态。
- `COMP-M7`：固定 COMP-001..036；每项必须链接需求、任务、`TC-*`、fixture/环境、结果和差异。
- `PERF-M7`：ENV-WIN11 打包构建；冷/热；1/5/10MB；10,000 文件；100 公式/图表；HTML/PDF；P50/P95/峰值。
- `PRIV-M7`：中文/绝对路径/正文/搜索词/剪贴板/YAML/导出自定义内容作为 canary，分别触发成功和错误。

## 人工门禁

| ID         | 任务   | 环境                                | 步骤                                                                                           | 通过条件                                                              | 证据                                             |
| ---------- | ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| MAN-M7-001 | M7-T04 | Windows Narrator、键盘、200%/高对比 | 1. 纯键盘完成 J-001 和 J-003 核心路径；2. 用 Narrator确认名称/状态/错误；3. 切高对比和减少动画 | 无键盘陷阱；焦点可见且恢复；关键控件名称/状态明确；放大后无功能不可达 | Narrator/系统版本、逐步结果、截图/录屏、问题清单 |
| MAN-M7-002 | M7-T08 | 日常真实环境                        | 连续四周每日完成写作、文件、搜索、图片和导出；每周运行回归并登记所有异常                       | 四周无 P0/P1；每周证据归档；P2 有处置；数据不变量从未失败             | 每日日志、每周报告、缺陷链接、签署结论           |
| MAN-M7-003 | M7-T09 | RC 审计环境                         | 逐项审阅 36 个 COMP、P2、documented gaps、许可证、安全/性能和用户文档                          | 每项证据充分；gap 范围不被隐瞒；RC 范围和残余风险由用户签署           | 审计表、gap/P2 列表、RC 签署                     |

## 证据与停止条件

保存完整追踪表、性能原始数据、内存曲线、axe/Narrator 报告、日志 canary 扫描和四周记录。任何假设置、未追踪 COMP、日志泄露、性能/NFR 失败、P0/P1 或未经批准的 gap 都阻断 RC。
