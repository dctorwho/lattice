# M0-T02 质量工具链开工就绪设计

日期：2026-07-18

状态：已由用户确认

范围：只补齐 M0-T02 的开工规格和质量工具链设计；不提前实现 M0-T03 及后续产品能力。

## 1. 背景与目标

M0-T01 已完成 Electron、React、TypeScript 最小骨架和可重复构建，并留下 TC-M0-001 证据。M0-T02 的任务是建立真实可失败、可离线重复执行的质量工具链，同时把 M0-T01 的自举验收反向自动化。

本设计解决当前开工审查发现的九类问题：

1. M0-T02 缺少 Definition of Ready 要求的设计决策、预期文件、人工验证和失败回退。
2. TC-M0-002 的“质量脚本测试质量脚本”存在递归风险。
3. TC-M0-001 的冷缓存联网自举与每日离线 `pnpm check` 冲突。
4. 质量工具依赖的包名、精确版本和配置边界尚未冻结。
5. NFR-008 在 M0-T02 只能证明工具链基础，不能提前声称文件系统、时钟等产品边界已经可替换。
6. 安全和性能脚本的最小真实行为未定义，容易形成永远成功的占位脚本或越过任务边界。
7. 故障注入的临时副本、超时和清理策略未定义。
8. M0-T02 验证矩阵未覆盖格式、lint 和 build 的反向失败。
9. smoke tests 的文件、断言和证据归属不清晰。

## 2. 设计原则

- `pnpm check` 是日常门禁：无网络、可重复、失败可定位。
- 冷缓存自举是单独门禁：显式运行、允许联网、不进入每日 `check`。
- 所有脚本必须执行真实检查；禁止空脚本、固定退出 0 或只打印成功信息。
- 元测试只修改临时项目副本，绝不污染工作树、依赖目录或 pnpm 全局缓存。
- M0-T02 只建立质量基础设施，不提前验收 M0-T03 的完整 Electron 安全策略或 M0-T06 的产品性能指标。
- `pnpm-lock.yaml` 仍是唯一 lockfile，所有直接依赖使用精确版本。

## 3. 质量命令合同

`package.json` 建立以下稳定命令：

| 命令 | M0-T02 的真实职责 | 是否进入 `check` |
| --- | --- | --- |
| `format` | 使用 Prettier 写入格式化结果 | 否 |
| `format:check` | 检查受控源码、测试、脚本、JSON、Markdown 和配置文件格式 | 是 |
| `lint` | 使用 ESLint 检查 TypeScript、React Hooks、React Refresh 和测试代码 | 是 |
| `typecheck` | 分别执行 Node 与 renderer 严格 TypeScript 检查，不生成产物 | 是 |
| `test` | 运行 Vitest 单元与组件 smoke，生成覆盖率 | 是 |
| `test:integration` | 运行集成测试，包括 TC-M0-001 回归和 TC-M0-002 元测试 | 是 |
| `test:e2e` | 使用 Playwright Electron 启动应用并验证最小窗口 smoke | 否，按任务显式运行 |
| `test:security` | 使用真实 Electron 进程检查当前 renderer 最小权限边界 smoke | 否，按任务显式运行 |
| `test:performance` | 验证性能测量器、统计聚合和阈值失败机制 | 否，按任务显式运行 |
| `test:bootstrap:cold` | 在冷项目副本与空项目级 store 中执行允许联网的完整自举 | 否，只在 M0-T02 完成、CI 或 M0 门禁运行 |
| `build` | 运行 electron-vite 生产构建 | 是 |
| `check` | 顺序执行 `format:check`、`lint`、`typecheck`、`test`、`test:integration`、`build` | 主门禁 |

`check` 不包含 E2E、安全、性能和冷自举。这些命令仍是必需的真实门禁，但由任务或里程碑按风险显式运行，与 `docs/09-test-strategy.md` 的“按任务和里程碑显式运行”保持一致。

## 4. TC-M0-001：日常回归与冷自举分层

### 4.1 日常回归

`tests/integration/project-bootstrap.spec.ts` 在包含中文和空格的临时路径中复制最小项目文件，复用已经验证的 pnpm store，执行冻结 lockfile 安装、两次生产构建并检查：

- `packageManager` 固定为 `pnpm@11.12.0`；
- 只有 `pnpm-lock.yaml`，没有 npm/yarn lockfile；
- 安装使用冻结 lockfile 且无待批准构建脚本；
- 必需构建产物存在；
- 连续两次构建退出 0，产物集合和哈希稳定；
- 临时目录在测试后删除。

该用例不得访问网络；若本地依赖内容缺失，应明确失败并提示运行冷自举门禁，不得悄悄联网。

### 4.2 冷自举门禁

新增稳定用例 ID `TC-M0-008`，由 `pnpm test:bootstrap:cold` 执行。它使用空的项目级 pnpm store，在中文和空格路径中允许联网安装、构建两次并执行与 TC-M0-001 相同的 lockfile、产物和幂等检查。

此门禁在以下时机运行：

- M0-T02 完成验收；
- CI 的显式冷自举作业；
- M0 里程碑审计；
- lockfile、包管理器版本或安装脚本政策变更后。

Electron 首次运行可能下载运行时，因此冷自举与 E2E 分开记录网络、下载和启动结果；安装成功不等于窗口启动成功。

## 5. TC-M0-002：无递归的质量脚本元测试

`tests/integration/quality-scripts.spec.ts` 在临时项目副本中验证所有质量脚本。正常父进程始终运行该文件；当元测试在临时副本中启动嵌套 `pnpm check` 时设置 `LATTICE_QUALITY_META_CHILD=1`。

Vitest 集成配置在该环境变量存在时只排除 `quality-scripts.spec.ts` 本身，仍运行其余全部集成测试。这样可以同时满足：

- 顶层 `test:integration` 必须覆盖 TC-M0-002；
- 嵌套 `check` 必须覆盖真实 integration；
- 元测试不会无限递归；
- 普通开发者不能通过默认环境跳过 TC-M0-002。

元测试必须覆盖以下矩阵：

| 注入 | 预期直接失败命令 | 预期 `pnpm check` |
| --- | --- | --- |
| Prettier 格式错误 | `format:check` | 非 0 |
| ESLint 规则错误 | `lint` | 非 0 |
| TypeScript 类型错误 | `typecheck` | 非 0 |
| 单元测试断言错误 | `test` | 非 0 |
| 集成测试断言错误 | `test:integration` | 非 0 |
| 生产构建语法或入口错误 | `build` | 非 0 |

正常副本中的全部约定脚本应按各自合同退出 0。`.skip`、`.only` 和空测试套件由专门守卫或配置禁止。

## 6. 故障注入隔离设计

元测试使用系统临时目录下的唯一目录名，目录名包含用例类别和随机后缀。复制清单只包含受 Git 跟踪或明确允许的项目文件，排除：

- `.git/`、`node_modules/`、`out/`；
- 本地 pnpm store、日志、覆盖率和测试报告；
- `.superpowers/` 及其他工具临时目录。

每个子命令使用参数数组和 `shell: false` 启动，继承最小必要环境，设置独立超时。失败时保存命令、退出码、标准输出末尾和标准错误末尾；不得保存用户绝对路径之外的不必要环境信息。

清理在 `finally` 中执行。Windows 文件占用导致首次删除失败时进行有限次数退避重试；仍失败则让测试失败并报告精确临时路径，不能静默遗留。

## 7. 依赖准入冻结

M0-T02 在 `devDependencies` 中加入以下精确版本，并同步记录用途、许可证和边界：

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `eslint` | `10.7.0` | lint 引擎 |
| `@eslint/js` | `10.0.1` | ESLint 官方基础规则 |
| `typescript-eslint` | `8.64.0` | TypeScript parser 与规则 |
| `globals` | `17.7.0` | Node、浏览器和测试全局定义 |
| `eslint-plugin-react-hooks` | `7.1.1` | Hooks 规则 |
| `eslint-plugin-react-refresh` | `0.5.3` | React Refresh 导出规则 |
| `prettier` | `3.9.5` | 确定性格式化 |
| `vitest` | `4.1.10` | 单元、组件和集成测试运行器 |
| `@vitest/coverage-v8` | `4.1.10` | V8 覆盖率 |
| `jsdom` | `29.1.1` | React 组件 DOM 环境 |
| `@testing-library/dom` | `10.4.1` | DOM 查询和交互断言 |
| `@testing-library/react` | `16.3.2` | React 组件测试 |
| `@testing-library/jest-dom` | `6.9.1` | DOM 语义断言 |
| `@playwright/test` | `1.61.1` | Electron E2E 运行器 |

这些包仅用于开发，不进入 renderer 生产依赖。实施前在 `docs/04-technology-stack.md` 补齐直接依赖台账，安装后核对 lockfile 中的直接解析版本、peer 兼容性和许可证。不得使用 `latest`、范围版本或生成器隐式带入配置。

## 8. 配置与最小 smoke 设计

预期增加或修改的文件范围：

- `package.json`、`pnpm-lock.yaml`；
- `eslint.config.mjs`、`.prettierignore`、`vitest.config.ts`、`vitest.integration.config.ts`、`playwright.config.ts`；
- `tests/setup.ts`；
- `tests/unit/app.smoke.spec.tsx`；
- `tests/integration/project-bootstrap.spec.ts`；
- `tests/integration/quality-scripts.spec.ts`；
- `tests/e2e/app-launch.spec.ts`；
- `tests/security/electron-boundary.smoke.spec.ts`；
- `tests/performance/harness.smoke.spec.ts`；
- 为临时副本、子进程和产物检查增加的 `tests/helpers/` 纯工具模块；
- `docs/04-technology-stack.md`、`docs/09-test-strategy.md`、`docs/test-cases/M0-foundation.md`、`tasks/M0-foundation.md`、`tasks/state.json` 和 M0-T02 证据文件。

最小 smoke 的声明边界：

- 单元/组件：React 根组件能渲染已存在的 M0-T01 内容；不引入新业务 UI。
- E2E：真实 Electron 应用启动、主窗口出现、renderer 加载完成并可关闭。
- 安全：验证当前窗口仍满足 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，renderer 不能直接取得 Node/Electron 对象。完整 CSP、导航、新窗口、权限和外链政策留给 M0-T03。
- 性能：验证测量器能计算中位数/P95、超过阈值会失败且报告样本；不声称开发构建或当前骨架满足产品性能 NFR。真实产品性能只在规定参考机和打包构建上验收。

## 9. NFR-008 归属

M0-T02 证明的是：严格类型检查、可失败的自动测试、临时项目隔离和可注入测试辅助边界已经建立。它不证明产品文件系统、时钟、随机数、进程或对话框服务已经全部通过依赖注入可替换。

后续创建这些产品边界的任务必须分别提供替换性测试；M0-T02 只提供运行这些测试的基础设施。相关文档和任务验收应明确使用“建立基础”而不是“完成 NFR-008 全部实现”。

## 10. 验收与证据

M0-T02 自动验收：

1. 冻结依赖安装成功，只有 `pnpm-lock.yaml`。
2. `pnpm check` 退出 0，并且第二次重复执行仍退出 0。
3. `pnpm test:e2e`、`pnpm test:security`、`pnpm test:performance` 退出 0。
4. `pnpm test:bootstrap:cold` 在空项目级 store 中退出 0。
5. TC-M0-002 的六类故障分别使直接命令和 `pnpm check` 非 0。
6. 没有 `.skip`、`.only`、空脚本或固定成功脚本。
7. 临时目录均已清理；构建和覆盖率产物未被误跟踪。
8. 依赖版本、许可证、命令合同和测试 ID 与文档一致。

M0-T02 的 `manual_gate` 为 `false`，人工验证明确为“不适用”。Electron 启动由自动 E2E 覆盖；若环境限制无法可靠自动启动，应将任务置为失败或补充可审计的环境说明，不能以未记录的人工观察替代。

证据文件至少记录：环境版本、命令、退出码、测试数量、覆盖率摘要、构建产物哈希、冷自举 store 路径策略、临时目录清理结果和所有已知残余风险。

## 11. 失败回退

- 在实施前把 `tasks/state.json` 中 M0-T02 设置为 `in_progress`。
- 任一门禁失败时保持 `in_progress`，修复根因后重跑；禁止降低规则、删除用例或扩大排除项。
- 依赖不兼容时仅撤销本任务新增依赖与配置，保留 M0-T01 基线；使用可审阅补丁，不使用 `git reset --hard` 或其他破坏性命令。
- 若 Electron 安全 smoke 发现 renderer 获得 Node/Electron 能力，按安全阻断处理，先修复边界再继续。
- 若临时副本可能覆盖工作树或污染全局缓存，立即停止并先修复隔离设计。

## 12. Git 变更序列

1. `M0-T01: bootstrap project baseline`：固定已经通过验收的初始项目。
2. `docs(M0-T02): define quality-toolchain readiness`：只提交本设计规格。
3. `docs(M0-T02): resolve readiness review findings`：用户批准设计后，提交对任务、技术栈、测试策略和测试用例的整改。

质量工具链的实际实现将在书面实施计划获批后按独立、可验证的小提交执行。未经用户明确要求，不创建远程分支、不推送、不创建 PR。

## 13. 非目标

- 不在 M0-T02 实现完整 CSP、导航、外链、权限或 IPC 安全策略。
- 不实现文件服务、编辑器、命令注册表或业务 UI。
- 不建立 CI、SBOM 或完整依赖审计流水线；它们属于 M0-T06。
- 不以开发构建的性能 smoke 替代打包产品性能验收。
- 不改变 Markdown 权威模型、renderer 权限原则或其他既有架构不变量。
