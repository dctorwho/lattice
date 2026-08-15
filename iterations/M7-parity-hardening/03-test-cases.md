# M7 test cases

## Iteration context

- Iteration: `M7`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers. They are not subtask IDs and do not own planning
state, dependencies, implementation work, manual gates, or reports. The `覆盖能力` column names
the capability covered by the case.

## Automated test cases

| ID        | 覆盖能力               | 层级/级别               | 数据/环境 | 步骤                                                                                                                   | 预期                                                                                                                         | 自动化                                                                                                                                                                                 |
| --------- | ---------------------- | ----------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-M7-001 | 设置 schema、迁移与 UI | unit-component/P1       | PREF-M7   | Load all schema versions and invalid settings; change each UI control and observe consumer/multi-window behavior.      | Values migrate atomically; bad files back up/recover; every setting has one consumer and immediate/restart meaning.          | `pnpm test -- tests/unit/component/settings.spec.ts`；证据：Migration/report and atomic-write evidence.；停止条件：Lost settings or no-effect setting stops M7.                        |
| TC-M7-002 | 快捷键覆盖             | unit-e2e/P1             | KEY-M7    | Validate every command default; override, conflict, use invalid/reserved keys, reset, reload, and multiple windows.    | Mappings deterministic; conflicts visible not overwritten; menus update; reserved keys explained.                            | `pnpm test:e2e -- tests/e2e/keybindings.spec.ts`；证据：Keybinding E2E report.；停止条件：Silent collision or inaccessible command stops M7.                                           |
| TC-M7-003 | 国际化                 | component-visual/P1     | I18N-M7   | Switch Chinese/English/pseudo locale, rebuild menus, traverse pages/errors, and screenshot scales.                     | No missing key or critical scattered literal; dates/numbers/plurals correct; hot switch complete; key actions not truncated. | `pnpm test -- tests/unit/component/i18n.spec.ts`；证据：Catalog and visual report.；停止条件：Missing critical text/action stops M7.                                                   |
| TC-M7-004 | 无障碍                 | component-e2e/P1        | A11Y-M7   | Run axe; keyboard-complete J-001/J-003; inspect order/restoration/names/live region/contrast/reduced motion.           | No serious axe issue; core controls reachable; focus stable/visible; status announced; 200% reflows.                         | `pnpm test:e2e -- tests/e2e/accessibility.spec.ts`；证据：Axe and E2E report.；停止条件：Keyboard trap or inaccessible critical control stops M7.                                      |
| TC-M7-005 | COMP 全量追踪          | traceability/P0         | COMP-M7   | For each COMP-001..036 load official/self-authored fixture, execute stated command/settings/output, and link evidence. | Each is passed or has sourced reproduction/impact/alternative documented gap; category smoke is insufficient.                | `pnpm test:integration -- tests/integration/compatibility-matrix.spec.ts`；证据：Traceability ledger and fixture results.；停止条件：Missing/untracked COMP or unsourced gap stops M7. |
| TC-M7-006 | 大文档与性能预算       | performance/P1          | PERF-M7   | Measure packaged cold start, 1/5/10MB open, input/switch, 10k tree/search, 100 charts, export, and long edit.          | P50/P95/peaks recorded; NFR budgets meet; regression ≤20%; degraded large file remains editable.                             | `pnpm test:performance -- tests/performance/product-budgets.spec.ts`；证据：Raw metrics and benchmark report.；停止条件：NFR or regression-threshold failure stops M7.                 |
| TC-M7-007 | 泄漏与长期稳定性       | soak/P1                 | LEAK-M7   | Open/close documents/windows 100 times, edit two hours, repeatedly render formulas/charts, sample resources.           | After GC, no persistent growth; worker/renderer/handles/temp files clean.                                                    | `pnpm test:performance -- tests/performance/leak-soak.spec.ts`；证据：Memory/handle curves and cleanup report.；停止条件：Sustained leak or residue stops M7.                          |
| TC-M7-008 | 日志与隐私             | security-integration/P0 | PRIV-M7   | Trigger file, conflict, search, clipboard, export, recovery errors; scan logs/diagnostic package and clean.            | No body/full path/search/clipboard/YAML; paths redacted; preview/clean work; help actionable.                                | `pnpm test:security -- tests/security/log-privacy.spec.ts`；证据：Canary scan and diagnostic report.；停止条件：Private-content leak stops M7.                                         |
| TC-M7-009 | 四周日用回归           | regression-soak/P0      | SOAK-M7   | Weekly run full regression/security/performance; archive local crash/recovery/export statistics and defect state.      | Four weeks complete; no P0/P1; P2 disposition exists; no critical test skipped.                                              | `pnpm test:integration -- tests/integration/m7-weekly-gate.spec.ts`；证据：Weekly evidence archive.；停止条件：P0/P1, missing week, or skipped critical coverage stops M7.             |
| TC-M7-010 | RC 审计                | audit/P0                | RC-M7     | Produce requirement/compatibility/test trace; inspect SBOM/licenses/security/performance/docs/gaps/gates.              | References resolve and have evidence; Alpha/Beta/RC criteria met; scope frozen; unapproved gap blocks.                       | `pnpm test:integration -- tests/integration/rc-audit.spec.ts`；证据：Audit report and gate matrix.；停止条件：Broken traceability or unapproved gap stops M7.                          |

## Manual test cases

| ID         | 覆盖能力       | 环境                                | 步骤                                                                               | 通过条件                                                            | 证据                                                                                             |
| ---------- | -------------- | ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MAN-M7-001 | 无障碍实机路径 | Windows Narrator、键盘、200%/高对比 | 1. 键盘完成 J-001/J-003；2. Narrator 检查名称/状态/错误；3. 切换高对比和减少动画。 | 无键盘陷阱；焦点可见并恢复；控件名称/状态明确；缩放后无功能不可达。 | Narrator/系统版本、逐步结果、截图/录屏、问题清单。；停止条件：无法到达核心操作或语义缺失停止 M7. |
| MAN-M7-002 | 四周真实日用   | 日常真实环境                        | 连续四周每日完成写作、文件、搜索、图片、导出；每周回归并登记异常。                 | 四周无 P0/P1；每周证据归档；P2 有处置；数据不变量从未失败。         | 每日日志、每周报告、缺陷链接、签署结论。；停止条件：P0/P1、数据不变量失败或缺少周证据停止 M7.    |
| MAN-M7-003 | RC 范围审计    | RC 审计环境                         | 逐项审阅 36 个 COMP、P2、documented gaps、许可证、安全/性能和用户文档。            | 每项证据充分；gap 范围不隐瞒；RC 范围和残余风险由用户签署。         | 审计表、gap/P2 列表、RC 签署。；停止条件：无签署或未说明 gap 停止 M7.                            |

## Parameter matrix

| Parameter ID | Variables                                                                             | Fixture                   | Required cases         | Expected result                |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------- | ---------------------- | ------------------------------ |
| PREF-M7      | 默认、历史 schema、缺/未知/错字段、截断 JSON；全部分类；单/多窗口；写入失败           | Settings fixtures         | 设置 schema、迁移与 UI | 保值、备份、原子和消费者正确。 |
| KEY-M7       | 所有 command ID；Ctrl/Alt/Shift、功能/IME/系统保留键、重复映射、损坏配置              | Command metadata fixtures | 快捷键覆盖             | 冲突可见且映射稳定。           |
| I18N-M7      | 简中/英文/伪本地化；菜单、对话框、错误、设置、状态栏；100/150/200/250%，窄窗口        | Locale fixtures           | 国际化                 | 完整可读的本地化。             |
| A11Y-M7      | 浅/深/高对比、减少动画、100/200/250%；键盘、Narrator、正常/错误/进度/对话框           | Accessibility fixtures    | 无障碍                 | 可访问的所有状态。             |
| COMP-M7      | 固定 COMP-001..036，每项链接需求、用例、夹具/环境、结果、差异                         | Compatibility corpus      | COMP 全量追踪          | 细粒度证据。                   |
| PERF-M7      | ENV-WIN11 打包构建；冷/热；1/5/10MB；10k；100 公式和 100 图表；HTML/PDF；P50/P95/峰值 | Performance corpus        | 大文档与性能预算       | 有预算的性能数据。             |
| PRIV-M7      | 中文/绝对路径/正文/搜索词/剪贴板/YAML/自定义导出 canary，成功和错误                   | Privacy canaries          | 日志与隐私             | 不泄露内容。                   |

## Fixtures

| Fixture                                    | Source and integrity                                                                | Covered behavior                       | Required environment            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------- |
| Settings/localization/accessibility corpus | Versioned settings, catalog completeness probes, semantic UI states.                | Migration, locale, keyboard, Narrator. | Windows with supported scaling. |
| Compatibility corpus                       | Official/public or self-authored examples with provenance and expected differences. | COMP-001..036 traceability.            | Packaged product harness.       |
| Performance/privacy corpus                 | Checksummed large docs/workspaces plus redaction canaries.                          | Budgets, soak, and safe logs.          | Reference Windows hardware.     |

## Evidence requirements

Record command, environment, exit code, parameter selection, result, and artifact or report reference for each executed automated case. Record operator, date, environment, step results, and conclusion evidence for each manual case.

## Stop conditions

Data integrity or security failure, false settings, missing COMP traceability, privacy leak,
NFR/performance failure, P0/P1 defect, or unapproved documented gap stops iteration progress
until fixed and regression evidence is recorded.
