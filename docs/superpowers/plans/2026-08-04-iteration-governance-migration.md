# 迭代级治理迁移实施计划

> **供自动化执行者使用：** 必须使用 superpowers:executing-plans 分阶段实施本计划。步骤使用复选框（`- [ ]`）追踪。“阶段”只是临时执行清单，绝不成为仓库任务 ID 或状态节点。

**目标：** 用一个 M0–M8 迭代状态模型替换包含 77 项的 `Mx-Tnn` 规划系统，每个迭代具有三个入口文档和两个出口文档，同时保留并集成所有既有 M0 工作。

**架构：** `iterations/state.json` 成为唯一规划状态并指向迭代拥有的入口/出口文档。小型纯验证模块检查 schema、状态和用例表不变量，`scripts/verify-planning-docs.mjs` 执行仓库文件、覆盖、链接和活跃语言检查。旧任务资料保留在只读归档中并排除在门禁外。

**技术栈：** Node.js 24、ECMAScript 模块、JSON Schema 2020-12、Markdown、Vitest 4.1.10、pnpm 11.12.0、Git。

## 全局约束

- 活跃规划 ID 精确为 `M0` 至 `M8`；绝不创建 `Mx-Tnn` 状态或规格。
- 每个迭代恰好具有三个入口角色：需求、详细设计和测试用例。
- 每个迭代恰好具有两个出口角色：测试报告和迭代出口报告。
- M0 迁移为 `in_progress`；M1 至 M8 保持 `blocked`。
- 保留 `codex/m0-t06-ci-audit-gate`，验证后提交其中两个中断的安全解析器变更，并集成已审阅实施提交，不合并旧任务状态提交。
- 不重写 Git 历史、不删除旧分支、不丢弃未提交变更，也不削弱任何数据丢失/安全门禁。
- `AGENTS.md` 中产品架构规则保持不变。
- 相关变更运行聚焦测试；迁移宣布完成前运行完整 `pnpm check` 和适用集成/安全套件。
- 不允许无界 watch、轮询或重试命令。

---

## 文件映射

### 新活跃规划

| Path                                                                      | Responsibility                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `iterations/README.md`                                                    | Iteration workflow and document-role index              |
| `iterations/state.json`                                                   | Sole M0–M8 state authority                              |
| `iterations/state.schema.json`                                            | Schema v2 for iteration state                           |
| `iterations/templates/*.md`                                               | Five reusable document-role templates                   |
| `iterations/M0-foundation/*`                                              | M0 three entries, working test report, future exit path |
| `iterations/M1-document-core/*` through `iterations/M8-windows-release/*` | Three ready-input documents per future iteration        |

### 验证

| Path                                          | Responsibility                                                       |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `scripts/planning/iteration-model.mjs`        | Pure state/reference/test-table validation                           |
| `scripts/planning/iteration-model.d.mts`      | Strict declarations for TypeScript tests                             |
| `scripts/verify-planning-docs.mjs`            | Filesystem orchestration, links, coverage and active-language checks |
| `tests/unit/planning/iteration-model.spec.ts` | State, dependencies, case parsing and fail-closed regressions        |

### 治理文档

| Path                                         | Responsibility                                    |
| -------------------------------------------- | ------------------------------------------------- |
| `AGENTS.md`                                  | One-iteration execution rules                     |
| `docs/03-architecture.md`                    | Iteration ownership for architecture decisions    |
| `docs/04-technology-stack.md`                | Iteration ownership for dependency reviews        |
| `docs/05-data-safety-and-security.md`        | Iteration ownership for security controls         |
| `docs/06-ui-interaction-spec.md`             | Iteration ownership for UI capabilities           |
| `docs/07-iteration-roadmap.md`               | M0–M8 scope and dependency roadmap                |
| `docs/08-development-plan.md`                | Iteration entry/development/exit workflow         |
| `docs/09-test-strategy.md`                   | Iteration-level test allocation and report policy |
| `docs/11-codex-cli-runbook.md`               | Commands for selecting and finishing an iteration |
| `docs/14-planning-acceptance.md`             | New planning acceptance contract                  |
| `docs/15-public-contracts.md`                | Iteration ownership for public contracts          |
| `docs/README.md`                             | Active planning and archive links                 |
| `docs/16-project-structure-and-standards.md` | Ownership of `iterations/` and archive            |
| `docs/17-settings-and-storage-schema.md`     | Iteration ownership for schema migrations         |
| `docs/18-error-catalog.md`                   | Iteration ownership for error contracts           |

### 历史归档

| Source                                                                   | Destination                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `tasks/**`                                                               | `docs/archive/task-model-v1/tasks/**`                     |
| `docs/test-cases/M0-*.md` through `M8-*.md`                              | `docs/archive/task-model-v1/test-cases/**`                |
| `docs/evidence/M0-T*.md`                                                 | `docs/archive/task-model-v1/evidence/**`                  |
| T-level files in `docs/superpowers/specs/` and `docs/superpowers/plans/` | `docs/archive/task-model-v1/superpowers/{specs,plans}/**` |
| none                                                                     | `docs/archive/task-model-v1/README.md` provenance index   |

---

### 阶段 1：保留并完成中断的 M0 安全修复

**文件：**

- 既有工作树：`.worktrees/m0-t06-ci-audit-gate`
- 修改：`tests/helpers/bootstrap-project.ts`
- 修改：`tests/unit/helpers/bootstrap-project.spec.ts`

**接口：**

- 输入：位于 `ea8aac1` 的分支 `codex/m0-t06-ci-audit-gate`
- 输出：一个已审阅 M0 提交，对畸形 `pnpm ignored-builds` 输出失败关闭

- [ ] **步骤 1：变更前确认保留工作**

```powershell
git -C .worktrees/m0-t06-ci-audit-gate status --short --branch
git -C .worktrees/m0-t06-ci-audit-gate diff -- tests/helpers/bootstrap-project.ts tests/unit/helpers/bootstrap-project.spec.ts
```

预期：精确修改两个已知文件且 HEAD 为 `ea8aac1`；没有文件被丢弃。

- [ ] **步骤 2：运行聚焦解析器测试**

```powershell
pnpm.cmd test -- tests/unit/helpers/bootstrap-project.spec.ts
```

预期：合法自动/显式区段通过；未知后缀、裸行、混合 `None`、缺少标题和畸形区段失败关闭。

- [ ] **步骤 3：运行相关集成和完整回归**

```powershell
pnpm.cmd test:integration
pnpm.cmd check
git diff --check
```

预期：全部命令退出 0。当沙箱进程清理会造成假失败时，在正常 Windows 进程环境运行。

- [ ] **步骤 4：提交保留安全修复**

```powershell
git add tests/helpers/bootstrap-project.ts tests/unit/helpers/bootstrap-project.spec.ts
git diff --cached --check
git commit -m "fix(M0): reject malformed ignored-build output"
```

记录结果 SHA；不要合并或删除分支。

---

### 阶段 2：使用 TDD 构建迭代状态核心

**文件：**

- 创建：`scripts/planning/iteration-model.mjs`
- 创建：`scripts/planning/iteration-model.d.mts`
- 创建：`tests/unit/planning/iteration-model.spec.ts`
- 创建：`iterations/state.schema.json`
- 创建：`iterations/state.json`

**接口：**

- 输出：

```ts
export interface EvidenceRecord {
  readonly kind: 'command' | 'test' | 'report' | 'manual'
  readonly summary: string
  readonly path?: string
  readonly recorded_at: string
}

export interface IterationRecord {
  readonly id: `M${number}`
  readonly status: 'blocked' | 'ready' | 'in_progress' | 'awaiting_manual' | 'passed' | 'failed'
  readonly depends_on: readonly `M${number}`[]
  readonly manual_gate: boolean
  readonly entry: {
    readonly requirements: string
    readonly detailed_design: string
    readonly test_cases: string
  }
  readonly exit: {
    readonly test_report: string
    readonly iteration_report: string
  }
  readonly evidence: readonly EvidenceRecord[]
}

export function validateIterationState(state: unknown, schema: unknown): readonly string[]
export function collectReferenceIds(
  text: string,
  allowedPrefixes: ReadonlySet<string>
): ReadonlySet<string>
export function parseIterationTestCases(
  text: string,
  iterationId: string
): {
  readonly automated: readonly string[]
  readonly manual: readonly string[]
  readonly errors: readonly string[]
}
```

- [ ] **步骤 1：编写失败状态模型测试**

增加测试以证明：

- 有效 M0–M8 线性状态通过；
- 缺失、重复和越界 ID 失败；
- `Mx-Tnn` ID 失败；
- 依赖循环、自依赖和未知依赖失败；
- 多于一个 `in_progress`/`awaiting_manual` 迭代失败；
- M0 为 `in_progress`、M1–M8 为 `blocked`，且依赖已通过的阻塞迭代失败；
- `passed` 人工门禁要求人工证据和两个出口路径；
- 无效 RFC 3339 证据时间失败。

- [ ] **步骤 2：运行 RED**

```powershell
pnpm.cmd test -- tests/unit/planning/iteration-model.spec.ts
```

预期：因 `scripts/planning/iteration-model.mjs` 不存在而失败。

- [ ] **步骤 3：增加 schema v2 和初始状态**

`iterations/state.schema.json` 必须精确要求：

```json
{
  "schema_version": 2,
  "product_baseline": "non-empty string",
  "current_iteration": "M0 through M8",
  "allowed_statuses": "the six fixed statuses",
  "iterations": "nine unique iteration records"
}
```

创建 `iterations/state.json`：M0 为 `in_progress` 且无依赖，M1→M0 至 M8→M7 使用线性依赖。M0 是人工门禁；在后续迭代记录中保留既有人工门禁意图。不要把旧任务证据复制进状态；详细历史由报告拥有。

- [ ] **步骤 4：实现纯验证器**

实现必须：

- 返回错误字符串，不调用 `process.exit`；
- 拒绝未知对象属性和畸形入口/出口路径；
- 要求路径保持仓库相对并匹配所属迭代目录；
- 执行设计中的状态/依赖/证据规则；
- 解析没有任务列的 `TC-Mx-*` 和 `MAN-Mx-*` 表；
- 拒绝重复 ID 和用例/迭代不匹配；
- 确定性展开 `DOC-001..008` 等需求范围。

- [ ] **步骤 5：运行 GREEN 和严格检查**

```powershell
pnpm.cmd test -- tests/unit/planning/iteration-model.spec.ts
pnpm.cmd typecheck
git diff --check
```

预期：新单元测试和严格类型检查通过。

- [ ] **步骤 6：提交状态核心**

```powershell
git add iterations/state.json iterations/state.schema.json scripts/planning tests/unit/planning
git diff --cached --check
git commit -m "chore: introduce iteration-level state model"
```

---

### 阶段 3：创建 M0–M8 入口文档和模板

**文件：**

- 创建：`iterations/README.md`
- 创建：`iterations/templates/requirements.md`
- 创建：`iterations/templates/detailed-design.md`
- 创建：`iterations/templates/test-cases.md`
- 创建：`iterations/templates/test-report.md`
- 创建：`iterations/templates/exit-report.md`
- 在 `iterations/M0-foundation/` 至 `iterations/M8-windows-release/` 的每个目录创建三个入口文件
- 创建：`iterations/M0-foundation/04-test-report.md`

**接口：**

- 输入：`docs/01-product-requirements.md` 中全局需求 ID、`docs/02-compatibility-matrix.md` 中复刻项 ID、旧里程碑规格和旧测试用例矩阵
- 输出：没有子任务所有权的完整入口文档

- [ ] **步骤 1：创建五个模板**

每个模板必须包含设计定义的精确章节。模板使用已记录的字面标记 `{{ITERATION_ID}}`，实例化文档不得包含未解决标记、`TBD` 或“待定”。

- [ ] **步骤 2：整合九份需求文档**

使用以下精确范围映射：

| Iteration | Required coverage                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| M0        | `NFR-007..009`, `UI-001..002`, engineering foundation, CI/audit/package gate                                      |
| M1        | `DOC-001..010`, `EDT-002..003`, `EDT-005`, `EDT-009`, `EDT-013`, `UI-001`, `COMP-001..004`, `COMP-036`, `NFR-001` |
| M2        | `EDT-001..008`, `EDT-014`, `MD-001..003`, `MD-008`, `COMP-005..009`                                               |
| M3        | `WS-001..008`, `UI-001..002`, `UI-006`, `OS-001`, `OS-004`, `COMP-010..013`, `NFR-005`                            |
| M4        | `MD-003..012`, `EDT-004`, `COMP-014..020`                                                                         |
| M5        | `EDT-010..012`, `IMG-001..006`, `UI-003..004`, `COMP-021..024`                                                    |
| M6        | `EXP-001..009`, `COMP-025..029`, `NFR-007`                                                                        |
| M7        | `UI-005..008`, `DOC-010`, `NFR-001..006`, `NFR-009..010`, `COMP-001..036`                                         |
| M8        | `OS-001..003`, `OS-005..006`, `COMP-033..035`, release security and stable audit                                  |

每份文档均包含目标、非目标、外部依赖、风险、迭代级验收标准和全局架构/安全规则链接。

- [ ] **步骤 3：整合九份详细设计**

把旧任务标题转换为无编号能力章节和实施顺序清单。保留全部架构、依赖、数据安全、失败和人工门禁决策，但移除任务状态、解锁声明和逐任务报告要求。

- [ ] **步骤 4：整合九份测试用例文档**

每个既有 `TC-Mx-*` 和 `MAN-Mx-*` 用例精确复制一次。用 `覆盖能力` 替换旧任务所有者列；使用 `原子保存与冲突处理` 等描述值，不使用 `M1-T03`。保留自动化目标、参数矩阵、夹具、预期结果、证据和停止条件。

- [ ] **步骤 5：创建 M0 工作测试报告**

记录：

- main 基线 `6db91f13f88f5349f4afea24525fcf64b7d00d82`；
- 已完成自举、质量工具链、安全 Electron 外壳、共享契约和命令外壳工作的归档证据；
- `ea8aac1` 和阶段 1 安全修复 SHA 的保留分支/提交引用；
- 状态 `in_progress`；CI/审计/打包/ruleset/人工门禁仍未完成；
- 没有 M0 出口结论。

- [ ] **步骤 6：运行文档格式和覆盖准备检查**

```powershell
pnpm.cmd exec prettier --check iterations
rg -n "M[0-8]-T[0-9]{2}|TBD|待定" iterations -g "!M0-foundation/04-test-report.md"
git diff --check
```

预期：Prettier 通过；实例化入口文档不包含任务 ID 或未解决内容。历史文件名只能出现在 M0 测试报告链接中。

- [ ] **步骤 7：提交迭代文档**

```powershell
git add iterations
git diff --cached --check
git commit -m "docs: consolidate planning by iteration"
```

---

### 阶段 4：重写规划验证器和活跃运行手册

**文件：**

- 修改：`scripts/verify-planning-docs.mjs`
- 修改：`AGENTS.md`
- 修改：`docs/03-architecture.md`
- 修改：`docs/04-technology-stack.md`
- 修改：`docs/05-data-safety-and-security.md`
- 修改：`docs/06-ui-interaction-spec.md`
- 修改：`docs/07-iteration-roadmap.md`
- 修改：`docs/08-development-plan.md`
- 修改：`docs/09-test-strategy.md`
- 修改：`docs/11-codex-cli-runbook.md`
- 修改：`docs/14-planning-acceptance.md`
- 修改：`docs/15-public-contracts.md`
- 修改：`docs/16-project-structure-and-standards.md`
- 修改：`docs/17-settings-and-storage-schema.md`
- 修改：`docs/18-error-catalog.md`
- 修改：`docs/README.md`

**接口：**

- 输入：`iterations/state.json`、schema v2 和迭代文档
- 输出：具有单一确定通过/失败结果的 `node scripts/verify-planning-docs.mjs`

- [ ] **步骤 1：记录旧规划验证器行为**

替换前运行：

```powershell
node scripts/verify-planning-docs.mjs
```

预期：退出 0，摘要包含 `77 tasks`。将其记录为特征证据，说明旧命令仍验证过时模型，不能证明新迭代契约。

- [ ] **步骤 2：重写验证器编排**

从 `scripts/planning/iteration-model.mjs` 导入纯函数并验证：

- 精确 M0–M8 状态和全部入口路径；
- 只在状态要求时存在输出文件（active/awaiting/passed 需要 `04-test-report.md`；passed 需要 `05-exit-report.md`）；
- 跨迭代需求的需求和 `COMP-*` 覆盖；
- 唯一且迭代匹配的 `TC-*`/`MAN-*` 用例及有效自动化目标；
- 必需章节、平衡围栏和本地链接；
- `AGENTS.md`、`iterations/` 和活跃运行手册没有匹配 `\bM[0-8]-T\d{2}\b`、`tasks/state.json`、`current_task` 或任务解锁语言的活跃执行指令；
- `AGENTS.md` 保持低于 32 KiB；
- 归档文件排除在活跃覆盖和语言扫描之外。

保留既有依赖表和 Pandoc 契约检查，但把规划所有权从旧任务指向 M6 入口/测试文档。

- [ ] **步骤 3：重写 `AGENTS.md` 和运行手册**

用单迭代执行替换单任务选择。更新每份列出的活跃产品文档，使所有权引用指向 `M0`–`M8`，绝不指向 `Mx-Tnn`。明确：

- 读取状态和当前三个入口文档；
- 不生成子任务计划、状态或报告；
- 开发期间运行聚焦测试，迭代出口运行完整门禁；
- `awaiting_manual` 前完成测试报告，`passed` 前完成出口报告和人工证据；
- 文档和产品架构不变量继续强制执行。

- [ ] **步骤 4：运行 GREEN 和定向测试**

```powershell
pnpm.cmd test -- tests/unit/planning/iteration-model.spec.ts
node scripts/verify-planning-docs.mjs
pnpm.cmd exec prettier --check AGENTS.md iterations scripts/planning scripts/verify-planning-docs.mjs tests/unit/planning docs/03-architecture.md docs/04-technology-stack.md docs/05-data-safety-and-security.md docs/06-ui-interaction-spec.md docs/07-iteration-roadmap.md docs/08-development-plan.md docs/09-test-strategy.md docs/11-codex-cli-runbook.md docs/14-planning-acceptance.md docs/15-public-contracts.md docs/16-project-structure-and-standards.md docs/17-settings-and-storage-schema.md docs/18-error-catalog.md docs/README.md
git diff --check
```

预期：全部命令退出 0，验证器摘要报告 9 个迭代而不是 77 个任务。

- [ ] **步骤 5：提交活跃治理**

```powershell
git add AGENTS.md iterations scripts/planning scripts/verify-planning-docs.mjs tests/unit/planning docs/03-architecture.md docs/04-technology-stack.md docs/05-data-safety-and-security.md docs/06-ui-interaction-spec.md docs/07-iteration-roadmap.md docs/08-development-plan.md docs/09-test-strategy.md docs/11-codex-cli-runbook.md docs/14-planning-acceptance.md docs/15-public-contracts.md docs/16-project-structure-and-standards.md docs/17-settings-and-storage-schema.md docs/18-error-catalog.md docs/README.md
git diff --cached --check
git commit -m "chore: activate iteration-level governance"
```

---

### 阶段 5：无数据丢失归档旧任务模型

**文件：**

- 创建：`docs/archive/task-model-v1/README.md`
- 移动：把文件映射中列出的来源移入 `docs/archive/task-model-v1/`
- 修改：`docs/test-cases/README.md`

**接口：**

- 输出：可从归档索引访问、但被活跃验证忽略的不可变历史路径

- [ ] **步骤 1：移动前记录精确归档清单**

归档 README 记录原始路径、目标、用途和持有来源的 main/feature 提交，并明确说明 T ID 属于历史记录且不可选择。

- [ ] **步骤 2：使用 Git 感知重命名移动文件**

对每个受限来源组使用 `git mv`。保留 `docs/test-cases/fixture-catalog.md` 作为共享活跃夹具目录；把 `docs/test-cases/README.md` 替换为指向 `iterations/*/03-test-cases.md` 和归档的简短说明。

- [ ] **步骤 3：证明归档排除和链接完整性**

```powershell
node scripts/verify-planning-docs.mjs
rg -n "tasks/state.json|current_task|M[0-8]-T[0-9]{2}" AGENTS.md iterations docs -g "!archive/**" -g "!superpowers/**" -g "!M0-foundation/04-test-report.md"
git diff --check
```

预期：验证器通过；除 M0 测试报告中明确允许的历史链接外，活跃扫描无匹配。

- [ ] **步骤 4：提交归档迁移**

```powershell
git add -A -- tasks docs/archive docs/test-cases docs/superpowers
git diff --cached --check
git commit -m "docs: archive legacy task planning"
```

---

### 阶段 6：集成保留的 M0 实现

**文件：**

- Cherry-pick：`ea8aac1`（`build(M0-T06): admit packager and brand assets`）
- Cherry-pick：阶段 1 安全修复 SHA
- 更新：`iterations/M0-foundation/02-detailed-design.md`
- 更新：`iterations/M0-foundation/04-test-report.md`

**接口：**

- 输入：只接收保留分支中的实施提交
- 排除：`9a286ad` 和 `c50a8e0`，其 T 级状态/文档变更继续属于历史记录

- [ ] **步骤 1：Cherry-pick 两个已审阅实施提交**

```powershell
git cherry-pick ea8aac1
$m0SafetySha = git -C .worktrees/m0-t06-ci-audit-gate rev-parse codex/m0-t06-ci-audit-gate
git cherry-pick $m0SafetySha
```

只解决真实内容冲突。不要重新引入 `tasks/state.json` 或活跃 T 级契约。

- [ ] **步骤 2：从结果冻结锁文件安装**

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd ignored-builds
```

预期：`electron-builder@26.15.3` 精确；自动待构建项为 `None`；因未使用 Squirrel，`electron-winstaller` 继续显式拒绝。

- [ ] **步骤 3：验证资源和 M0 回归**

```powershell
node scripts/assets/build-lattice-icon.mjs --check
pnpm.cmd test -- tests/unit/helpers/bootstrap-project.spec.ts tests/unit/planning/iteration-model.spec.ts
pnpm.cmd test:integration
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git diff --check
```

预期：全部命令退出 0；资源哈希匹配已审阅 README；畸形 ignored-build 输出继续被拒绝。

- [ ] **步骤 4：更新 M0 入口/报告事实**

在详细设计顺序中把依赖准入、品牌资源和解析器加固标为已实现。向工作测试报告增加精确命令、退出码、哈希和提交 SHA。保持 CI/审计/打包/ruleset/人工项未完成，M0 为 `in_progress`。

- [ ] **步骤 5：提交 M0 集成记录**

```powershell
git add iterations/M0-foundation/02-detailed-design.md iterations/M0-foundation/04-test-report.md
git diff --cached --check
git commit -m "docs(M0): record retained foundation work"
```

---

### 阶段 7：最终审查、验证和集成

**文件：**

- 审查：从 `c6f3fab` 到最终 HEAD 的全部变更
- 必要时更新：只修改有已验证审查发现的文件

**接口：**

- 输出：一个可供 GitHub 审阅和 main 集成的干净迭代治理分支

- [ ] **步骤 1：运行一次最终本地门禁**

```powershell
node scripts/verify-planning-docs.mjs
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd test:security
git diff --check main...HEAD
git status --short --branch
```

全部命令均有界。如果 Electron 进程清理需要正常 Windows 权限，在该环境重跑一次并记录原因。

- [ ] **步骤 2：执行全分支审查**

审查以下问题：

- 丢失需求、复刻用例或历史证据；
- 活跃 T 级状态/指令；
- 状态/schema/验证器不一致；
- 断链或归档路径错误；
- M0 过早完成；
- 丢失或削弱 M0 安全/依赖行为。

只修复已验证发现，并重跑覆盖检查。

- [ ] **步骤 3：通过 GitHub 推送和合并**

```powershell
git push -u origin codex/iteration-governance
gh pr create --repo dctorwho/lattice --base main --head codex/iteration-governance --title "Replace task tree with iteration-level governance" --body "Replaces active T-level planning with M0-M8 iteration governance, archives legacy artifacts, preserves existing M0 work, and keeps M0 in progress."
gh pr checks --repo dctorwho/lattice --watch --interval 10 --fail-fast
```

用既有外层 30 分钟超时包裹检查监视。仅在全部检查为绿时合并，然后只以快进更新本地 main。在确认已集成 SHA 和保留历史可达前，不删除 `codex/m0-t06-ci-audit-gate`。

- [ ] **步骤 4：验证 main 最终状态**

```powershell
git rev-parse main
git rev-parse origin/main
node scripts/verify-planning-docs.mjs
git status --short --branch
```

预期：本地与远程 main 一致；状态只包含 M0–M8；M0 保持 `in_progress`；工作树干净。
