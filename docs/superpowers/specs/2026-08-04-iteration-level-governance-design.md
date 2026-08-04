# Lattice 迭代级治理重构设计

- 日期：2026-08-04
- 状态：已确认，待实施计划
- 决策范围：项目规划、状态、验证、报告和历史资料治理

## 1. 背景与目标

当前规划把一个里程碑拆成大量 `M0-T01`、`M0-T02` 等任务，并要求每个任务分别准备计划、设计、测试、证据和状态迁移。这使工程治理成本超过实际开发成本，也让 M0 的整体完成情况难以直接判断。

本次重构把唯一执行和验收单位提升为迭代：`M0`、`M1`……`M8`。代码仍可按小步提交和审查，但不再为每个实现步骤建立独立任务 ID、状态节点、计划文档或测试报告。

重构必须保留现有代码、依赖、测试和历史证据。尤其是 `codex/m0-t06-ci-audit-gate` 上已完成的依赖准入、品牌资源和安全解析修复，均作为新 M0 的既有成果继续使用。

## 2. 核心决策

采用“每个迭代三个入口、两个出口”的单层模型：

```text
需求文档 -> 详细设计文档 -> 测试用例文档 -> 开发与持续验证
                                             |
                                             v
                                  测试报告 -> 迭代出口报告
```

### 2.1 唯一规划单位

- 活跃 ID 只允许 `M0` 至 `M8`。
- 状态、依赖、人工门禁和证据只挂在迭代上。
- 不再创建或解析 `Mx-Tnn` 任务。
- 详细设计可以列实施顺序和检查清单，但这些段落没有独立状态、依赖或报告。
- 开发过程中允许多个小提交；提交是变更历史，不是规划层级。

### 2.2 每个迭代的入口

每个迭代固定三份入口文档：

1. `01-requirements.md`
   - 目标、用户可观察结果、范围、非目标；
   - 对应的产品需求和兼容性要求；
   - 前置迭代、外部依赖、风险和迭代级验收标准。
2. `02-detailed-design.md`
   - 架构边界、模块职责、接口和数据流；
   - 数据安全、失败处理、迁移和兼容性约束；
   - 依赖准入和实施顺序；
   - 不创建子任务状态。
3. `03-test-cases.md`
   - 单元、集成、E2E、性能、安全和人工用例；
   - 参数矩阵、夹具、预期结果、证据要求和停止条件；
   - 测试用例可保留 `TC-Mx-*`、`MAN-Mx-*` ID，但它们不是任务。

只有三份入口完整、无 `TBD`，且前置迭代 `passed`，迭代才能进入 `ready` 或 `in_progress`。

### 2.3 每个迭代的出口

每个迭代固定两份出口文档：

1. `04-test-report.md`
   - 实际执行的命令、环境、退出码和测试结果；
   - 失败、修复、回归证据、未执行项和残余风险；
   - M0 将汇总旧 M0 子任务已完成的证据，并继续追加剩余验证。
2. `05-exit-report.md`
   - 需求完成矩阵、最终交付物、主要提交和文档变更；
   - 自动与人工门禁结论、已知限制、回滚方式；
   - 下一迭代允许依赖的明确输入。

`04-test-report.md` 可以在迭代中作为受控工作报告逐步填写；`05-exit-report.md` 只在准备退出时形成最终结论。进入 `awaiting_manual` 必须已有完整测试报告；进入 `passed` 必须同时具备最终出口报告和所需人工验收。

## 3. 目录与权威来源

新的活跃规划目录为：

```text
iterations/
  README.md
  state.json
  state.schema.json
  templates/
    requirements.md
    detailed-design.md
    test-cases.md
    test-report.md
    exit-report.md
  M0-foundation/
    01-requirements.md
    02-detailed-design.md
    03-test-cases.md
    04-test-report.md
    05-exit-report.md        # 到退出阶段完成
  M1-document-core/
    ...
  ...
  M8-windows-release/
    ...
```

`iterations/state.json` 是唯一状态来源。产品级文档仍位于 `docs/`，用于跨迭代的产品、架构、安全、技术栈和兼容性约束；迭代入口文档引用这些全局规则，不复制整篇正文。

旧 `tasks/`、T 级 Superpowers 规格/计划和 T 级证据迁入 `docs/archive/task-model-v1/`。归档只用于追溯，不再参与任务选择、依赖计算或开发门禁。Git 历史中的旧任务名保持不变。

## 4. 状态模型

`iterations/state.json` 使用 schema v2，结构只包含迭代：

```json
{
  "schema_version": 2,
  "product_baseline": "Typora 1.13.8 documented feature compatibility",
  "current_iteration": "M0",
  "allowed_statuses": ["blocked", "ready", "in_progress", "awaiting_manual", "passed", "failed"],
  "iterations": [
    {
      "id": "M0",
      "status": "in_progress",
      "depends_on": [],
      "manual_gate": true,
      "entry": {
        "requirements": "iterations/M0-foundation/01-requirements.md",
        "detailed_design": "iterations/M0-foundation/02-detailed-design.md",
        "test_cases": "iterations/M0-foundation/03-test-cases.md"
      },
      "exit": {
        "test_report": "iterations/M0-foundation/04-test-report.md",
        "iteration_report": "iterations/M0-foundation/05-exit-report.md"
      },
      "evidence": []
    }
  ]
}
```

状态流为：

```text
blocked -> ready -> in_progress -> awaiting_manual -> passed
                         |                |
                         +---- failed <---+
```

- 同时最多一个迭代为 `in_progress` 或 `awaiting_manual`。
- `M1` 仅依赖 `M0`，依此类推；不再维护迭代内部依赖图。
- `failed` 保留失败证据并在同一迭代修复，不另建绕过任务。
- M0 在迁移后为 `in_progress`；M1 至 M8 保持 `blocked`。

## 5. 开发和验证工作流

### 5.1 进入迭代

1. 读取 `AGENTS.md`、`iterations/state.json` 和当前迭代三份入口文档。
2. 核对前置迭代状态、工作树和已有成果。
3. 将当前迭代设为 `in_progress`；只实现入口文档定义的范围。

### 5.2 迭代内开发

- 按详细设计中的实施顺序小步开发和提交。
- 功能或缺陷仍采用相称的测试先行和代码审查，但不为每一步建立独立规划文档。
- 定向测试在相关变更后运行；完整 `pnpm check` 和适用的 E2E、安全、性能、打包套件在迭代出口前统一运行。
- 数据损坏、安全边界破坏或恢复失败仍是立即停止条件。
- 公共接口、架构、安全边界、依赖或验收标准变化时，同步当前迭代文档和对应全局文档。

### 5.3 退出迭代

1. 运行迭代测试用例文档列出的完整门禁。
2. 完成测试报告并处理所有发布阻断问题。
3. 有人工门禁时进入 `awaiting_manual`；无人工门禁可直接准备出口报告。
4. 人工验收通过后完成迭代出口报告，将当前迭代设为 `passed`，只解锁下一个迭代。

## 6. 自动规划校验

`scripts/verify-planning-docs.mjs` 改为验证迭代模型：

- schema v2、M0 至 M8 唯一且顺序完整；
- 依赖存在、无自依赖或环，并且只形成迭代级依赖；
- 最多一个活动迭代；
- 三份入口文件存在、结构完整、无 `TBD`；
- `awaiting_manual`/`passed` 迭代具备相应出口报告；
- 产品需求和兼容性 ID 至少被一个迭代需求文档覆盖；
- 每个迭代测试文档含自动用例、参数/夹具、人工门禁、证据和停止条件；
- 活跃规划和运行手册不再包含 `Mx-Tnn` 执行指令；
- 本地 Markdown 链接可解析。

旧归档目录不参与上述门禁，但需要有归档索引和来源说明。

## 7. M0 迁移规则

M0 已完成的工作不重新开发：

- 原 M0-T01 至 M0-T05 的代码和已通过证据汇总到 M0 测试报告的“既有验证”部分；
- 原证据文件迁入历史归档并从 M0 测试报告链接；
- `codex/m0-t06-ci-audit-gate` 的 `ea8aac1` 依赖/品牌资产提交和当前两处安全解析修复先完成验证并形成保留提交；
- 旧的 `9a286ad`、`c50a8e0` 只修改 T 级状态和合同，不进入新的活跃规划；它们通过分支和 Git 历史保留；
- 经审查的实现提交再纳入新 M0，剩余 CI、审计、打包和 GitHub 门禁作为 M0 详细设计中的未完成实施顺序继续完成；
- M0 只有一个最终测试报告和一个最终出口报告。

## 8. 仓库规则迁移

`AGENTS.md`、`docs/08-development-plan.md`、`docs/09-test-strategy.md`、`docs/11-codex-cli-runbook.md`、`docs/14-planning-acceptance.md` 和相关目录索引统一改为迭代术语：

- 一次执行一个迭代；
- 未指定时继续唯一 `in_progress` 迭代，或选择第一个依赖已通过的 `ready` 迭代；
- 不生成子任务计划或子任务报告；
- 以三份入口文档限制范围，以两份出口文档证明完成；
- 用户已明确授权某次迭代执行时，可以在每个经过测试和审查的内聚变更后提交；推送、PR、合并仍遵循用户对远端工作流的授权。

## 9. 失败处理与安全边界

- 迁移不重写 Git 历史，不删除未合并分支，不丢弃未提交修改。
- 旧路径迁移使用可追踪的 Git rename；归档索引记录原路径、提交和新位置。
- 如果新验证器与现有需求覆盖关系不一致，先修正文档映射，不通过放宽校验绕过。
- 如果保留的 M0 代码验证失败，在 M0 内修复并记录，不恢复 T 级任务模型。
- 本次治理重构不改变 Markdown 单一权威、CodeMirror、IPC、sandbox、数据无损和 Pandoc 可选等产品架构约束。

## 10. 验收标准

重构完成必须满足：

1. 活跃状态只包含 M0 至 M8，没有 `Mx-Tnn` 项。
2. 每个迭代具有三份入口和两份出口路径，M0 的既有成果可追溯。
3. 旧 T 级资料全部标为历史归档，不再影响门禁。
4. 规划验证器和对应测试只验证迭代模型并通过。
5. `AGENTS.md` 与所有运行手册不再要求按 T 任务执行。
6. M0 保持 `in_progress`，M1 至 M8 保持 `blocked`，不会提前宣称 M0 完成。
7. `main` 和未合并 M0 分支的既有成果均未丢失或改写。
