# M0 测试报告

## 迭代上下文

- 迭代： `M0`
- 当前状态：`passed`
- 状态权威： [`iterations/state.json`](../state.json)
- 测试契约： [`03-test-cases.md`](03-test-cases.md)
- 人工门禁：必需

下文历史 `Mx-Tnn` 名称只是证据标签，不定义活跃工作所有权或活跃规划层级。五条链接的旧记录是只读任务模型归档中的历史输入。

## 报告状态

这是 M0 已完成的受控测试报告，汇总历史证据、最终自动门禁证据和用户于 2026-08-15 提供的 MAN-M0-001 结论。所有声明的自动和人工用例均已通过。最终交付结论另行记录在 `05-exit-report.md`。

## 范围

本报告覆盖可复现项目自举、可执行质量工具链、安全 Electron 外壳、严格共享 IPC 契约、命令注册表和可访问窗口外壳；还记录已集成的依赖准入、确定性品牌资源、失败关闭 ignored-build 解析器、生产依赖/许可证/漏洞审计、CycloneDX SBOM、Windows 打包、打包产物启动和本地 TC-M0-007 门禁。

原剩余范围是由用户或另一名指定 Windows 11 普通用户评估人执行的 M0 人工审阅；该项现已完成。

## 基线与环境

- main 基线：`6db91f13f88f5349f4afea24525fcf64b7d00d82`。
- 历史 Windows 证据使用 Node.js `v24.18.0`、Corepack `0.35.0`、pnpm `11.12.0` 和 Electron `v43.1.1`。
- 当主机执行策略阻止生成的 `pnpm.ps1` shim 时，PowerShell 证据使用 `pnpm.cmd` 或 `corepack pnpm`。
- 保留实施分支：`codex/m0-t06-ci-audit-gate`。
- 已集成依赖和品牌资源提交：
  `3ae487861f0535f2d17e8558aebc5f15bb37cb78`, derived from preserved commit
  `ea8aac1a94d89d0ffdb61f91882b661c8f5eb856`.
- 已集成失败关闭 ignored-build 解析器提交：
  `644ad699384cfe608a84132b44ebbb43af950817`, derived from preserved commit
  `a82f9369d958fbcd9c9c91a7dc410436f5205d35`.
- 确定性依赖/许可证/漏洞和 CycloneDX 实现：
  `defe45c`.
- Windows x64 unpacked/NSIS、包哈希和打包应用实现：
  `95c975f`.
- 有限 TC-M0-007 门禁和固定 SHA 的 GitHub 自动化实现：
  `e6433a9`.
- 工具链漏洞和离线 Electron 分发打包修复：本地提交 `a1d60b7`，发布为
  `f42559688f4d90d1dea9bb1da2ff939da7387cd0`.
- 已审阅工具链许可证准入修复：本地提交 `0661f87`，发布为 `ccd06f0d604429e1ebfc70fad211967bb0cd8830`。
- 精确外部 URL 边界回归：本地提交 `7d429c0`，发布为最终自动候选
  `3c4ae5d7f268165409570da5dc5d603e4149fda0`.
- 旧任务状态和任务文档提交 `9a286ad` 与 `c50a8e0` 有意未集成。

本报告只是汇总既有记录，不因此声称新增产品、打包或人工验证。

## 已有验证

| Capability                                    | Historical evidence                                                                                                                          | Recorded result                                                                                                                                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible bootstrap                        | [Legacy M0-T01 bootstrap evidence](../../docs/archive/task-model-v1/evidence/M0-T01-bootstrap-2026-07-18.md)                                 | Frozen installation, development-window smoke, two production builds, strict type checks and a Chinese-and-space-path repeatability run exited `0`; the required artifact hashes matched across the repeated builds.                                                    |
| Quality toolchain                             | [Legacy M0-T02 quality-toolchain evidence](../../docs/archive/task-model-v1/evidence/M0-T02-quality-toolchain-2026-07-18.md)                 | Two consecutive `pnpm check` runs and the closure run exited `0`; unit, integration, E2E, security, performance-harness, offline-bootstrap and cold-bootstrap gates were recorded.                                                                                      |
| Secure Electron shell                         | [Legacy M0-T03 secure-shell evidence](../../docs/archive/task-model-v1/evidence/M0-T03-secure-electron-shell-2026-07-25.md)                  | The full quality gate passed with 105 unit and 18 integration tests; focused real-Electron security and navigation gates passed, with sandboxing, privilege denial, CSP, permission and external-navigation policies verified.                                          |
| Shared contracts and errors                   | [Legacy M0-T04 shared-contract evidence](../../docs/archive/task-model-v1/evidence/M0-T04-shared-contracts-2026-07-26.md)                    | The full quality gate passed with 259 unit and 18 integration tests; focused Electron security and E2E gates passed 2/2 each, covering strict schemas, sender ownership, bounded values, stable errors, redacted logs and the frozen preload API.                       |
| Command registry and window shell             | [Legacy M0-T05 command-shell evidence](../../docs/archive/task-model-v1/evidence/M0-T05-command-window-shell-2026-08-02.md)                  | The full quality gate passed with 324 unit and 18 integration tests; real-Electron E2E passed 3/3 and security passed 2/2, covering one command authority, native-menu projection, shared entry paths, localization, focus and preload boundaries.                      |
| Dependency, brand assets and parser hardening | Integrated commits `3ae487861f0535f2d17e8558aebc5f15bb37cb78` and `644ad699384cfe608a84132b44ebbb43af950817`; retained-work execution record | `electron-builder@26.15.3`, reviewed Lattice assets and dependency metadata are integrated. Frozen installation, asset verification, focused unit, standalone integration and full quality verification exited `0`; malformed `pnpm ignored-builds` output is rejected. |

## 已执行命令与结果

本表复述链接历史证据和保留工作执行记录中的命令与结果，不代表新的 M0 出口运行。

| Date       | Environment                                                          | Command or procedure                                                                          | Exit code | Cases or coverage                                            | Result                                                                                          | Evidence                                                                                                    |
| ---------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-07-18 | Windows ordinary-user paths, including Chinese characters and spaces | Frozen install, development-window smoke, two builds and strict TypeScript checks             | `0`       | TC-M0-001 / ENV-M0-A                                         | Repeatable bootstrap and stable required-artifact hashes                                        | [Bootstrap record](../../docs/archive/task-model-v1/evidence/M0-T01-bootstrap-2026-07-18.md)                |
| 2026-07-19 | Windows `10.0.26200.0`; Node `v24.18.0`; pnpm `11.12.0`              | Two consecutive `pnpm check` runs plus the post-state closure run                             | `0`       | 61 unit and 18 integration tests per recorded full run       | Offline format, lint, typecheck, unit, integration and production-build chain passed            | [Quality record](../../docs/archive/task-model-v1/evidence/M0-T02-quality-toolchain-2026-07-18.md)          |
| 2026-07-19 | Same quality environment                                             | E2E, security, performance harness, cold bootstrap and focused offline bootstrap              | `0`       | TC-M0-001, TC-M0-002 and TC-M0-008 evidence                  | Explicit foundation gates passed and cleanup scans were clean                                   | [Quality record](../../docs/archive/task-model-v1/evidence/M0-T02-quality-toolchain-2026-07-18.md)          |
| 2026-07-26 | Windows; pnpm `11.12.0`; Electron `43.1.1`                           | Full `pnpm check` and focused real-Electron security/navigation commands                      | `0`       | 105 unit, 18 integration, security 1/1 and E2E 1/1           | Secure window, navigation, permission, CSP and privilege boundaries passed                      | [Secure-shell record](../../docs/archive/task-model-v1/evidence/M0-T03-secure-electron-shell-2026-07-25.md) |
| 2026-07-31 | Windows; pnpm `11.12.0`; Electron production build                   | Full `pnpm check`, focused security and E2E commands                                          | `0`       | 259 unit, 18 integration, security 2/2 and E2E 2/2           | Shared contract and preload boundaries passed                                                   | [Shared-contract record](../../docs/archive/task-model-v1/evidence/M0-T04-shared-contracts-2026-07-26.md)   |
| 2026-08-02 | Windows normal process environment                                   | Full `pnpm check`, real-Electron E2E and security commands                                    | `0`       | 324 unit, 18 integration, E2E 3/3 and security 2/2           | Command shell, lifecycle, accessibility and security regressions passed                         | [Command-shell record](../../docs/archive/task-model-v1/evidence/M0-T05-command-window-shell-2026-08-02.md) |
| 2026-08-04 | Preserved branch, normal Windows process environment                 | Focused bootstrap helper tests, `pnpm.cmd test:integration`, `pnpm.cmd check` and diff checks | `0`       | Focused parser matrix plus full unit/integration/build chain | Malformed ignored-build output is rejected; formatting, lint, typecheck, tests and build passed | Phase 1 execution record and commit `a82f936`                                                               |

### 保留工作集成验证

以下有限命令在两个保留实施提交集成后执行。它们属于集成证据，不是 M0 出口运行。

| Command                                                                                                     | Exit code | Recorded result                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd install --frozen-lockfile`                                                                        | `0`       | pnpm `11.12.0`; `251` packages reused, `0` downloaded; the frozen graph contains exact `electron-builder@26.15.3`.                                                                                |
| `pnpm.cmd ignored-builds`                                                                                   | `0`       | Historical result: automatically ignored builds were `None`; the then-current explicit denial of `electron-winstaller` has since been superseded by the dependency-edge removal recorded below.   |
| `node scripts/assets/build-lattice-icon.mjs --check`                                                        | `0`       | PNG SHA-256 `4317ae0aecca27dddd570e511b073bc8b6963e46a49fe025d2c4c98775036014`; ICO SHA-256 `06e6f68ec6f11a92e6df43e35c83f72abe1f6eeff6fa378328fc17a3ff36896c`, matching `build/brand/README.md`. |
| `pnpm.cmd test -- tests/unit/helpers/bootstrap-project.spec.ts tests/unit/planning/iteration-model.spec.ts` | `0`       | pnpm-managed unit run passed `26` files and `400` tests, including the strict ignored-build parser and iteration model.                                                                           |
| `pnpm.cmd test:integration`                                                                                 | `0`       | Standalone integration run passed `2` files and `18` tests.                                                                                                                                       |
| `node scripts/verify-planning-docs.mjs`                                                                     | `0`       | Verified `9` iterations, `86` automated cases, `13` manual cases, `83` requirements and `36` compatibility items.                                                                                 |
| `pnpm.cmd check`                                                                                            | `0`       | Format, lint, strict type checking, `400` unit tests, `18` integration tests and the production build passed.                                                                                     |

上述资源哈希还与已提交文件及 `build/brand/README.md` 中精确值核对。脱离 pnpm 支持的调用上下文直接执行 pnpm 管理的工具 shim，只作为排除的诊断前置条件，不属于验收证据。

### 集成期间的治理门禁修正

为使新迭代治理门禁准确评估集成仓库，需要三个后续提交。它们只改变治理格式、验证或测试夹具行为，不属于 M0 产品实现：

| Commit    | Correction                                                                         | Reason                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `5aead02` | Exclude `docs/archive/task-model-v1` from active Prettier checks.                  | The archive is immutable historical evidence and must not be rewritten by the active formatting gate.                         |
| `99b9e53` | Remove an unnecessary initial value in the planning verifier's regular-file probe. | The iteration verifier remained fail-closed while satisfying the active no-warning lint gate.                                 |
| `7798105` | Guard the optional regex capture before a planning-fixture target is joined.       | The fixture now fails explicitly on a missing capture and satisfies strict type checking without weakening target validation. |

## 失败、修复与回归证据

| Finding                                                                                                                                           | Impact                                                                                         | Resolution                                                                                                                                                               | Regression evidence                                                                                         | Status                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Electron 43 runtime was not present immediately after package installation, and the initial development launch reached the runtime path too late. | A successful install did not by itself prove that the application window could start.          | The development script now resolves Electron before `electron-vite dev`; the runtime was downloaded with Electron checksums enabled.                                     | Two responding development-window smoke runs and two successful builds in the bootstrap record.             | Resolved in the main baseline.                       |
| Externalized Zod prevented the sandboxed preload from exposing the approved API.                                                                  | The shared IPC contract was unavailable at runtime.                                            | Preload bundling now inlines only Zod; real-Electron tests verify the exact frozen API and continued privilege denial.                                                   | Shared-contract security and E2E evidence.                                                                  | Resolved in the main baseline.                       |
| Some malformed `pnpm ignored-builds` output could be interpreted too permissively.                                                                | Dependency-build admission could fail open on an unknown or malformed output suffix.           | Integrated commit `644ad699384cfe608a84132b44ebbb43af950817` validates the complete automatic section and optional exact explicit section, with fail-closed regressions. | Focused parser tests, integration tests and the full quality gate passed in the normal Windows environment. | Resolved and integrated.                             |
| Sandboxed child-process cleanup reported `taskkill exited with 1` during the preserved-work check.                                                | The sandbox produced an environment-specific false failure in unrelated timeout cleanup tests. | The same finite checks were run once in the normal Windows process environment without weakening cleanup assertions.                                                     | Focused, integration and full quality gates exited `0`; `git diff --check` was clean.                       | Environment issue resolved for the preserved commit. |

## 未使用 Squirrel peer 修正（2026-08-15）

GitHub 质量运行
[`31871899038`](https://github.com/dctorwho/lattice/actions/runs/31871899038)
证明重试相同 pnpm 导入操作没有解决 Windows `EPERM` 失败：第二次有限尝试仍在同一 `electron-winstaller` 重命名上失败。该重试不计入验收证据，并已移除。

替代策略只移除未使用的 `app-builder-lib@26.15.3 -> electron-builder-squirrel-windows` peer 边。全新离线解析使用 pnpm `11.12.0` 安装 `489` 个包，没有安装任一 Squirrel 包，`pnpm peers check` 报告无 peer 问题。聚焦配置和自举辅助器回归通过 `25/25` 个测试。隔离离线自举通过 `1/1`，包括在中文和空格路径中冻结安装、没有自动忽略构建，以及两次相同生产构建。随后 `pnpm.cmd check` 通过格式、lint、严格类型检查、`423/423` 单元测试、`18/18` 集成测试和生产构建。这些是修正开发结果，不是 M0 出口证据；验收仍由下文 GitHub CI 门禁和剩余 M0 出口工作控制。

## 当前本地出口证据（2026-08-15）

审计、打包和工作流实现集成后，下列命令从活跃 Windows 工作树运行。GitHub 随后从干净检出运行相同质量、Electron、打包和审计门禁。两条自动路径都不能替代 MAN-M0-001。

| Command / boundary                                   | Exit code | Result                                                                                                                                                                              |
| ---------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused audit, package-config and TC-M0-007 suites   | `0`       | Audit regressions passed; package configuration passed `3/3`; TC-M0-007 passed `20/20`, including workflow mutations, exact license-set enforcement and real child timeout/failure. |
| External-URL policy focused suite and mutation probe | `0`       | The suite passed `25/25`; changing the 2,081-unit boundary from `>` to `>=` made exactly the new boundary case fail, then the restored implementation passed.                       |
| `pnpm.cmd check`                                     | `0`       | Format, lint, strict typecheck, `445/445` unit tests, `38/38` integration tests and production build passed.                                                                        |
| `pnpm.cmd test:e2e`                                  | `0`       | The pre-package configuration ran only app, command and navigation cases: `3/3` passed.                                                                                             |
| `pnpm.cmd test:security`                             | `0`       | Real Electron privilege-boundary cases passed `2/2`.                                                                                                                                |
| `pnpm.cmd test:performance`                          | `0`       | The currently applicable M0 performance harness passed `2/2`.                                                                                                                       |
| `pnpm.cmd test:bootstrap:cold`                       | `0`       | Network-enabled empty-store bootstrap in the controlled path passed `1/1`, including two builds.                                                                                    |
| `pnpm.cmd package:win` then `pnpm.cmd test:packaged` | `0`       | x64 per-user NSIS and unpacked application were produced; the dedicated packaged case passed `1/1`.                                                                                 |
| `pnpm.cmd verify:workflows`                          | `0`       | Exactly `3` workflows and `9` reviewed, SHA-pinned Action references passed policy verification.                                                                                    |
| `pnpm.cmd audit:m0`                                  | `0`       | Planning, dependency audit, CycloneDX, workflows, brand assets and artifact hashes passed all `6` finite steps.                                                                     |
| `node scripts/verify-planning-docs.mjs`              | `0`       | Verified `9` iterations, `86` automated cases, `13` manual cases, `83` requirements and `36` compatibility items.                                                                   |

被忽略的 `artifacts/m0/` 证据集包含七个 JSON 文件：
`dependency-inventory.json`, `licenses.json`, `audit.json`,
`toolchain-audit.json`, `sbom.cdx.json`, `artifact-hashes.json` and
`m0-gate.json`。生产图包含四个组件（`react`、`react-dom`、`scheduler`、`zod`），四者均有 MIT 许可证覆盖，生产 high 和 critical 漏洞数为零，完整工具链没有 moderate、high 或 critical 发现。CycloneDX 文档使用规范版本 1.6，具有精确组件/依赖覆盖。

重新构建的本地候选哈希如下：

| Artifact                               | Bytes       | SHA-256                                                            |
| -------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `dist/Lattice-0.0.0-windows-x64.exe`   | `100714244` | `e222476b899e54fc058f274555db2df48ed5188183c58e2d5ede5debb60efffd` |
| `dist/win-unpacked/Lattice.exe`        | `225486336` | `bed2669c3cb88124818c4355c395864061da8692fa7ff8c44201161e41f733a9` |
| `dist/win-unpacked/resources/app.asar` | `12743609`  | `d2a95adc68444b4184a2432d1b082a6516d46f2a8f0f2b15e876a69ec0efe86d` |
| `build/brand/lattice-icon-256.png`     | `2754`      | `4317ae0aecca27dddd570e511b073bc8b6963e46a49fe025d2c4c98775036014` |
| `build/brand/lattice.ico`              | `2776`      | `06e6f68ec6f11a92e6df43e35c83f72abe1f6eeff6fa378328fc17a3ff36896c` |

两次依赖 electron-builder 冗余 Electron 下载路径的有限打包尝试因 GitHub 网络超时被排除。随后 TDD 修复把 electron-builder 绑定到已安装的精确 `node_modules/electron/dist` 运行时。之后一次沙箱诊断因 pnpm SQLite 存储不可写而失败；同一有限打包命令在正常 Windows 环境运行一次，使用自定义 unpacked Electron 分发且不下载 Electron，并生成上述候选。没有引入重试循环或放宽验收。

## GitHub 精确候选证据（2026-08-15）

公开 PR head 为 `3c4ae5d7f268165409570da5dc5d603e4149fda0`；在这些仅报告状态变更前，本地和远程 Git tree 均为 `8b38bd10bf3ef74f08eb3beb801ac4c488d46db7`。

| Gate                    | Result | Evidence                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality                 | passed | [Run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255): planning verification; `445/445` unit and `38/38` integration tests; Electron E2E `3/3`; security `2/2`; Windows package; packaged application `1/1`; six-step M0 audit; evidence artifact `9248010039`.            |
| CodeQL                  | passed | [Run 31888333231](https://github.com/dctorwho/lattice/actions/runs/31888333231) completed successfully for the same PR head.                                                                                                                                                                         |
| Dependency Review       | passed | [Run 31888333221](https://github.com/dctorwho/lattice/actions/runs/31888333221) completed successfully with no moderate-or-higher vulnerability and the exact reviewed permissive toolchain-license allowlist.                                                                                       |
| Main ruleset            | passed | [Ruleset 20752831](https://github.com/dctorwho/lattice/rules/20752831) is active, has no bypass actors, preserves PR/thread/deletion/non-fast-forward protection, and requires `quality`, `codeql` and `dependency-review` from GitHub Actions app `15368`.                                          |
| Required-check pressure | passed | [Earlier Dependency Review run 31887390234](https://github.com/dctorwho/lattice/actions/runs/31887390234) failed on the incomplete license policy and the PR was observed `BLOCKED`; after the reviewed fix, all required contexts passed and PR #1 was observed `MERGEABLE / CLEAN` without bypass. |

## 阻断项

无。用户审阅当前应用结果后提供必需 MAN-M0-001 结论，并以所有已设计迭代测试用例通过为验收条件；自动结果表和 GitHub 证据证明该条件已满足。

## 未执行验证

已接受 M0 候选没有未执行验证。任何后续代码、依赖、打包、工作流或安全变更都会使受影响证据失效，必须重跑适用的精确候选门禁。

## 覆盖情况

| Test contract area                              | Current evidence state | Remaining work                                                                                        |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| TC-M0-001 reproducible bootstrap                | passed                 | Historical repeated offline bootstrap plus frozen clean-checkout Quality installation.                |
| TC-M0-002 quality failure sensitivity           | passed                 | Fault-injection integration matrix and final Quality run passed.                                      |
| TC-M0-008 cold bootstrap                        | passed                 | Controlled empty-store `pnpm test:bootstrap:cold` passed `1/1` with two builds.                       |
| TC-M0-003 secure renderer boundary              | passed                 | Final clean-checkout Electron security run passed `2/2`.                                              |
| TC-M0-004 navigation and external-link policy   | passed                 | Final Electron E2E passed `3/3`; exact 2,081 UTF-16-unit acceptance is mutation-backed.               |
| TC-M0-005 shared contracts and preload API      | passed                 | Final unit, Electron security and packaged-app gates passed.                                          |
| TC-M0-006 command registry and window shell     | passed                 | Final unit and Electron E2E gates passed.                                                             |
| TC-M0-007 CI, audit, SBOM and packaged artifact | passed                 | Quality, CodeQL, Dependency Review and ruleset-pressure evidence passed for the published candidate.  |
| MAN-M0-001 ordinary-user production review      | passed                 | User reported no observed issue and accepted the candidate after all designed iteration cases passed. |

## 剩余风险

- Windows 包没有被描述为公开可信或代码签名；公共签名与发布信任仍属于 M8 职责，不成为未记录的 M0 声明。
- SBOM、审计报告和包哈希证明已记录候选，不证明未来依赖或打包变更。
- M0 只建立安全工程和外壳基础；文档、工作区、混合编辑、导出和最终发布行为仍分配给 M1–M8。

## 自动化用例结果

| 用例 ID   | 结果   | 证据                                                                                                                                                                                                                                                                                                           | 备注                                                                                                          |
| --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| TC-M0-001 | passed | Historical bootstrap record and [Quality run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255)                                                                                                                                                                                        | Frozen dependency installation and repeatability evidence are complete.                                       |
| TC-M0-002 | passed | Fault-injection integration suite and [Quality run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255)                                                                                                                                                                                  | Format, lint, type, unit, integration and build failures are fail-closed without recursive check execution.   |
| TC-M0-008 | passed | `pnpm.cmd test:bootstrap:cold` (`1/1`)                                                                                                                                                                                                                                                                         | Empty-store network bootstrap in the controlled Chinese-and-space path completed two builds and cleanup.      |
| TC-M0-003 | passed | [Quality run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255) security step (`2/2`)                                                                                                                                                                                                  | Production renderer privilege and window-policy boundaries passed.                                            |
| TC-M0-004 | passed | [Quality run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255) E2E step (`3/3`) and exact-limit mutation regression                                                                                                                                                                   | Navigation, permission and external-link policy passed, including the 2,081 UTF-16-unit accepted boundary.    |
| TC-M0-005 | passed | [Quality run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255) unit/security/package evidence                                                                                                                                                                                         | Strict IPC contracts, sender ownership, bounded/redacted results and frozen preload API passed.               |
| TC-M0-006 | passed | [Quality run 31888333255](https://github.com/dctorwho/lattice/actions/runs/31888333255) unit and E2E evidence                                                                                                                                                                                                  | Registry, native menu, renderer entry paths, focus and preload surface passed.                                |
| TC-M0-007 | passed | [Quality](https://github.com/dctorwho/lattice/actions/runs/31888333255), [CodeQL](https://github.com/dctorwho/lattice/actions/runs/31888333231), [Dependency Review](https://github.com/dctorwho/lattice/actions/runs/31888333221), and [ruleset 20752831](https://github.com/dctorwho/lattice/rules/20752831) | Clean-checkout CI, package launch, audit, SBOM, hashes and required-check pressure all passed without bypass. |

## 人工用例结果

用户于 2026-08-15 在本任务提供人工结论：“目前看没什么问题，如果设计的迭代测试用例都通过了，那就没问题”。所有声明的迭代测试用例和最终 GitHub 门禁均已通过，满足所述验收条件。包哈希、依赖/许可证审计、SBOM 和 ruleset 证明保留在上文；代理没有用自己的人工结论替代。

| 用例 ID    | 结果   | 评估人                              | 证据                                                                                                                                                                                 |
| ---------- | ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MAN-M0-001 | passed | User / designated release evaluator | User acceptance message dated 2026-08-15, conditioned on all designed iteration cases passing; automated result table, package hashes, audit/SBOM and GitHub ruleset evidence above. |

## 人工门禁交接

| Manual case | Required evaluator                                                     | Evidence location                                                                                                           | Current handoff status                                                                                           |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MAN-M0-001  | User or designated release evaluator on Windows 11 as an ordinary user | This report, final package hashes, user acceptance message, dependency/license audit, SBOM and GitHub check/ruleset records | Completed: user reported no observed issue and accepted the candidate after all designed iteration cases passed. |

编写本报告的代理不提供人工结论。

## 退出就绪声明

M0 为 `passed`。全部自动用例和 MAN-M0-001 均已通过，不存在 M0 阻断项；`05-exit-report.md` 记录最终完成结论、交付摘要和释放给 M1 的输入。
