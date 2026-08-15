# M8 test cases

## Iteration context

- Iteration: `M8`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers. They are not subtask IDs and do not own planning
state, dependencies, implementation work, manual gates, or reports. The `覆盖能力` column names
the capability covered by the case.

## Automated test cases

| ID        | 覆盖能力                     | 层级/级别               | 数据/环境   | 步骤                                                                                                                               | 预期                                                                                                                                   | 自动化                                                                                                                                                                                                 |
| --------- | ---------------------------- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC-M8-001 | NSIS 打包                    | packaging/P1            | PKG-M8      | Build x64 unpacked/NSIS twice from clean source; inspect version/resources/content/start/repair/hashes.                            | Artifacts install/start; no dev files/keys/test bodies; userData separate; differences explained.                                      | `pnpm test:integration -- tests/integration/package.spec.ts`；证据：Build logs, inventories, hashes.；停止条件：Nonreproducible unexplained content or secret leak stops M8.                           |
| TC-M8-002 | 单实例、文件关联与命令行     | e2e-security/P0         | ROUTE-M8    | Send Explorer/PowerShell/second-launch file, folder, location, and invalid arguments under current/new-window policy.              | Quotes/Unicode/long paths correct; no shell interpretation; single instance keeps dirty work; invalid/out-of-scope input fails safely. | `pnpm test:e2e -- tests/e2e/windows-routing.spec.ts`；证据：Routing E2E and session trace.；停止条件：Dirty loss, shell path behavior, or authorization bypass stops M8.                               |
| TC-M8-003 | 安装、升级与卸载             | installer/P0            | INSTALL-M8  | Exercise clean install, upgrade, occupied-file failure, downgrade, repair, retain/clean uninstall, reinstall, and data comparison. | Failure rolls back; settings/themes/recovery retained by choice; user Markdown/workspace never deleted.                                | `pnpm test:integration -- tests/integration/installer-lifecycle.spec.ts`；证据：Installer log and before/after hashes.；停止条件：User-file deletion or unrecoverable install state stops M8.          |
| TC-M8-004 | 更新基础设施                 | integration-security/P0 | UPDATE-M8   | Use fake stable/preview feeds with valid/bad signatures, offline/interrupted/corrupt downloads, dirty session, and rollback.       | No key means disabled; only signed artifacts accepted; failures keep runnable old version; save/recovery preserves content.            | `pnpm test:security -- tests/security/update-adapter.spec.ts`；证据：Feed/signature and rollback report.；停止条件：Signature bypass or data loss stops M8.                                            |
| TC-M8-005 | 制品、SBOM、许可证与签名准备 | supply-chain/P1         | ARTIFACT-M8 | Produce/cross-check SBOM, licenses, hashes, signing steps, names, notes, privacy/security entry points; recheck after signing.     | SBOM covers artifacts; licenses complete; no keys/body logs; signature verifies; hash chain clear.                                     | `pnpm test:integration -- tests/integration/release-artifacts.spec.ts`；证据：Release manifest and verification results.；停止条件：Missing supply-chain evidence or secret/content exposure stops M8. |
| TC-M8-006 | Windows VM 发布门禁          | vm-e2e/P0               | VM-M8       | On clean Win10/11 VM run install→association→edit→forced-kill recovery→export→upgrade→uninstall at all scales.                     | Journey passes; association/argv/print/IME/multi-monitor work; uninstall scope correct; artifact hashes match.                         | `pnpm test:e2e -- tests/e2e/windows-vm-gate.spec.ts`；证据：VM snapshots, hashes, E2E report.；停止条件：Any journey failure or data loss stops M8.                                                    |
| TC-M8-007 | Stable 完成审计              | release-audit/P0        | STABLE-M8   | Inspect seven-day RC, requirements/compatibility/tests/gates/P0/P1/gaps, rollback rehearsal, support channels, and artifacts.      | Evidence complete; no unapproved gap/P0/P1; rollback preserves settings/documents; Stable is traceable.                                | `pnpm test:integration -- tests/integration/stable-audit.spec.ts`；证据：Audit matrix and rollback evidence.；停止条件：Missing evidence, unresolved blocker, or failed rollback stops M8.             |
| TC-M8-008 | 卸载删除范围安全             | installer-security/P0   | DELETE-M8   | Place canaries in install/userData/workspace/neighboring directories; execute upgrade and retain/clean uninstall.                  | Only declared app/optional userData removed; workspace, user Markdown, and neighbor hashes unchanged.                                  | `pnpm test:security -- tests/security/uninstall-scope.spec.ts`；证据：Canary hash manifest and installer trace.；停止条件：Any undeclared deletion stops M8.                                           |

## Manual test cases

| ID         | 覆盖能力            | 环境                 | 步骤                                                                                                                                           | 通过条件                                                                  | 证据                                                                                                                  |
| ---------- | ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| MAN-M8-001 | Windows VM 发布旅程 | ENV-WIN10、ENV-WIN11 | 1. 干净安装；2. 双击关联和 PowerShell 打开中文路径；3. 微软拼音编辑并强杀恢复；4. PDF/打印；5. 多显示器/缩放；6. 覆盖升级；7. 卸载保留与清理。 | 旅程可用；签名/哈希正确；无数据丢失；卸载不碰用户文档；窗口和输入法正常。 | VM 快照、制品哈希、命令记录、数据前后哈希、截图/录屏。；停止条件：数据丢失、签名异常、关联/IME/打印失败或误删停止 M8. |
| MAN-M8-002 | Stable 审计与回滚   | Stable 审计环境      | 1. RC 真实使用七天；2. 审阅签名/SBOM/许可证/gaps；3. 从 RC 回滚上版再升级；4. 核验支持和安全入口；5. 批准 Stable。                             | 七天无 P0/P1；回滚/再升级不丢设置/文档；证据归档；用户明确批准。          | 七天记录、回滚哈希、审计签署、最终制品清单。；停止条件：无用户批准、P0/P1、回滚数据损失或证据缺失停止 M8.             |

## Parameter matrix

| Parameter ID | Variables                                                                                                                 | Fixture                 | Required cases               | Expected result        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------- | ---------------------- |
| PKG-M8       | 普通/空格中文构建路径；x64 unpacked/NSIS；首次/重复；普通用户；修复安装                                                   | Clean source/checkouts  | NSIS 打包                    | 可解释的可重复制品。   |
| ROUTE-M8     | `.md/.markdown/.mdown/.mkd/.txt/.qmd`、文件夹、不存在文件、行列定位、多个参数、空格/中文/长路径、普通/管理员、当前/新窗口 | Route fixtures          | 单实例、文件关联与命令行     | 解析安全且不丢脏文档。 |
| INSTALL-M8   | Win10/11；全新/同版/旧新/降级/占用/磁盘不足/断电；保留/清理 userData                                                      | Installer VM fixtures   | 安装、升级与卸载             | 回滚且删除范围精确。   |
| UPDATE-M8    | 稳定/预览；无/有效/过期/错误签名；404/断网/中断/hash 错/损坏；clean/dirty/recovery 会话                                   | Fake feeds and packages | 更新基础设施                 | 签名安全与可用旧版。   |
| ARTIFACT-M8  | unpacked/installer/签名 installer；SBOM、第三方声明、SHA-256、说明、隐私/安全入口                                         | Artifact manifests      | 制品、SBOM、许可证与签名准备 | 完整供应链证据。       |
| VM-M8        | Win10/11，100/150/250%，单/多显示器，微软拼音，系统 PDF/真实打印机，在线/离线                                             | Clean VMs               | Windows VM 发布门禁          | 全旅程可复现。         |
| DELETE-M8    | 安装目录、userData/settings/themes/recovery/logs、Documents/工作区、相邻目录、junction/symlink canary                     | Canary filesystem       | 卸载删除范围安全             | 无越界删除。           |

## Fixtures

| Fixture                          | Source and integrity                                                                    | Covered behavior                           | Required environment      |
| -------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------- |
| Packaging and artifact manifests | Clean identified source, checksummed resources, public signing-verification data.       | Reproducible build and supply chain.       | Windows packaging runner. |
| Routing/installer canaries       | Unicode/long path fixtures and checksummed userData/workspace/neighbor/symlink probes.  | argv, instance protection, deletion scope. | Clean Win10/11 VMs.       |
| Update/VM corpus                 | Fake signed/invalid feeds, controlled old/current artifacts, release journey documents. | Update safety, rollback, Stable evidence.  | Network-controlled VMs.   |

## Evidence requirements

Record command, environment, exit code, parameter selection, result, and artifact or report reference for each executed automated case. Record operator, date, environment, step results, and conclusion evidence for each manual case.

## Stop conditions

Installation/update rollback failure, signature bypass, single-instance dirty-document loss,
undeclared deletion, secret/private-content exposure, missing Stable evidence, or release-blocking
security/data failure stops iteration progress until fixed and regression evidence is recorded.
