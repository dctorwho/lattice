# 活跃文档中文化实施计划

> **供执行代理使用：** 必须使用 `superpowers:executing-plans` 在当前任务中按顺序执行；本计划不建立子任务状态、子任务报告或 T 级编号。

**目标：** 将所有活跃项目文档、迭代资料、模板和报告统一为中文，并让自动验证器以中文结构作为唯一有效契约。

**架构：** 文档展示层、规划解析契约和语言门禁同时迁移。稳定 ID、命令、路径、技术专名和状态枚举保持不变；历史归档保持只读；M1 继续保持 `ready`。

**技术栈：** Markdown、Node.js 24、ECMAScript 模块、Vitest、Prettier、现有规划验证器。

## 全局约束

- 设计依据为 `docs/superpowers/specs/2026-08-16-active-documentation-chinese-design.md`。
- 不修改 `docs/archive/` 或 `.superpowers/` 中的历史与临时资料。
- 不翻译 ID、命令、路径、包名、版本、哈希、网址、代码、JSON 键和状态枚举。
- 不改变需求、架构、测试参数、验收结论和迭代依赖。
- `M0` 保持 `passed`，`M1` 保持 `ready`，`M2` 至 `M8` 保持现有阻塞关系。
- 不新增生产依赖，不引入新的锁文件。
- 所有命令均为有明确终止条件的有限命令。
- 当前仓库规则未授权创建提交，因此执行阶段只修改和验证文件；提交、推送和合并须另获用户明确授权。

---

## 文件结构与职责

### 中文结构契约

- 修改：`scripts/verify-planning-docs.mjs`，把入口文档、测试报告和出口报告的必需标题、表头与结论行迁移为中文。
- 修改：`tests/unit/planning/planning-verifier.spec.ts`，用中文夹具验证完整性，并证明废弃英文结构不能通过。
- 修改：`scripts/planning/iteration-model.mjs`，仅在当前表头角色映射缺少中文同义项时补充精确映射。
- 修改：`tests/unit/planning/iteration-model.spec.ts`，仅为新增中文角色映射增加回归测试。

### 中文语言门禁

- 创建：`scripts/verify-document-language.mjs`，清点活跃 Markdown、忽略归档和代码区，报告英文结构或整段英文叙述。
- 创建：`scripts/verify-document-language.d.mts`，声明语言扫描器的输入和返回类型。
- 创建：`tests/unit/planning/document-language.spec.ts`，验证范围、排除项和误报边界。
- 修改：`package.json`，增加 `verify:docs`，并把它接入 `check`。

### 活跃文档

- 修改：`AGENTS.md`、`README.md`、`build/brand/README.md`。
- 修改：`docs/README.md`、`docs/00-product-charter.md` 至 `docs/21-command-menu-inventory.md`。
- 修改：`docs/test-cases/README.md`、`docs/test-cases/fixture-catalog.md`。
- 修改：`docs/superpowers/specs/2026-08-04-iteration-level-governance-design.md`。
- 修改：`docs/superpowers/specs/2026-08-15-windows-pnpm-eperm-recovery-design.md`。
- 修改：`docs/superpowers/plans/2026-08-04-iteration-governance-migration.md`。
- 修改：`docs/superpowers/plans/2026-08-15-windows-pnpm-eperm-recovery.md`。
- 保持中文：`docs/superpowers/specs/2026-08-16-active-documentation-chinese-design.md` 和本计划。

### 迭代资料

- 修改：`iterations/README.md` 和 `iterations/templates/*.md`。
- 修改：`iterations/M0-foundation/01-requirements.md` 至 `05-exit-report.md`。
- 修改：`iterations/M1-document-core/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M2-hybrid-editor/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M3-workspace-shell/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M4-advanced-markdown/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M5-media-theme/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M6-export/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M7-parity-hardening/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/M8-windows-release/01-requirements.md` 至 `03-test-cases.md`。
- 修改：`iterations/state.json` 中三个 M0 证据对象的 `summary`，其他键和值保持不变。

---

## 实施阶段一：建立中文结构契约的失败测试

- [ ] 在 `tests/unit/planning/planning-verifier.spec.ts` 中，把完整测试报告夹具改为以下结构：

```markdown
## 自动化用例结果

| 用例 ID | 结果 | 证据 | 备注 |
| ------- | ---- | ---- | ---- |

## 人工用例结果

| 用例 ID | 结果 | 评估人 | 证据 |
| ------- | ---- | ------ | ---- |
```

- [ ] 把完整出口报告夹具改为以下结构：

```markdown
## 需求完成矩阵

| 全局 ID | 要求结果 | 完成证据 | 结果 |
| ------- | -------- | -------- | ---- |

## 最终迭代结论

结论：passed
```

- [ ] 增加回归用例：完整中文报告通过；把任一中文标题替换为旧英文标题时失败；旧英文表头失败；`结论：passed` 缺失、改为 `结论：failed` 或改成列表项时失败。

- [ ] 运行聚焦测试并确认出现预期失败：

```powershell
pnpm.cmd exec vitest run --config vitest.config.ts tests/unit/planning/planning-verifier.spec.ts
```

预期：新增中文契约用例失败，失败原因是验证器仍查找英文标题、表头或结论行；原有完整性负向用例继续运行。

## 实施阶段二：迁移规划验证器和模板契约

- [ ] 在 `scripts/verify-planning-docs.mjs` 中将五类必需章节数组改为中文，保持每类章节数量和职责不变。
- [ ] 将 `validateTestReportCompletion` 的固定参数改为：

```js
heading: '自动化用例结果'
header: ['用例 ID', '结果', '证据', '备注']
```

以及：

```js
heading: '人工用例结果'
header: ['用例 ID', '结果', '评估人', '证据']
```

- [ ] 将出口报告解析改为 `需求完成矩阵`、中文四列表头、`最终迭代结论` 和精确行 `结论：passed`。
- [ ] 将验证器面向使用者的规划错误消息翻译为中文，但保留文件路径、ID 和状态值原样。
- [ ] 检查 `scripts/planning/iteration-model.mjs` 的角色映射；只补充缺少的中文列名，不保留会让错误列角色通过的宽泛别名。
- [ ] 把 `iterations/templates/requirements.md`、`detailed-design.md`、`test-cases.md`、`test-report.md`、`exit-report.md` 全部改为中文，并使用同一固定结构。
- [ ] 运行聚焦测试：

```powershell
pnpm.cmd exec vitest run --config vitest.config.ts tests/unit/planning/iteration-model.spec.ts tests/unit/planning/planning-verifier.spec.ts
```

预期：所有测试通过；中文结构被识别，英文旧结构被拒绝，ID 精确集合和证据完整性规则保持有效。

## 实施阶段三：建立活跃资料中文门禁

- [ ] 先创建 `tests/unit/planning/document-language.spec.ts`，覆盖以下真实边界：

```ts
test('拒绝没有中文的英文标题和叙述段落', () => {
  expect(
    findChineseDocumentationViolations(
      'README.md',
      '# Project guide\n\nThis document explains how contributors verify the project.'
    )
  ).not.toEqual([])
})

test('允许中文叙述中的稳定技术名词和命令', () => {
  expect(
    findChineseDocumentationViolations(
      'README.md',
      '# Lattice 项目\n\n运行 `pnpm check` 验证 Electron 和 CodeMirror 集成。'
    )
  ).toEqual([])
})

test('忽略代码围栏、链接目标和历史归档', () => {
  expect(collectActiveDocumentationFiles(root)).not.toContain(
    'docs/archive/task-model-v1/README.md'
  )
})
```

- [ ] 运行该测试并确认因模块不存在而失败：

```powershell
pnpm.cmd exec vitest run --config vitest.config.ts tests/unit/planning/document-language.spec.ts
```

- [ ] 创建 `scripts/verify-document-language.mjs`，导出：

```js
export const collectActiveDocumentationFiles = (root) => {}
export const findChineseDocumentationViolations = (relativePath, content) => []
export const verifyActiveDocumentationLanguage = (root) => []
```

实际实现必须满足：

- 从根目录说明、`build/brand/README.md`、`docs/` 和 `iterations/` 递归收集 Markdown；
- 排除 `docs/archive/`、`.superpowers/`、依赖目录和构建产物；
- 忽略围栏代码、行内代码、网址、链接目标、Markdown 表格分隔行和纯机器值；
- 无中文且含两个以上普通英文单词的标题报错；
- 无中文且含六个以上普通英文单词的叙述行报错；
- 明确报告旧英文迭代标题、报告标题、表头和 `Decision:` 行；
- 输出 `文件:行号:原因`，发现任一问题时进程退出码为 1。

- [ ] 创建严格声明 `scripts/verify-document-language.d.mts`，不使用 `any` 或 unchecked assertion。
- [ ] 在 `package.json` 增加：

```json
"verify:docs": "node scripts/verify-document-language.mjs"
```

并把 `check` 开头改为：

```json
"check": "pnpm format:check && pnpm verify:docs && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build"
```

- [ ] 运行语言扫描器测试，确认全部通过。

## 实施阶段四：翻译根目录、治理说明和模板

- [ ] 翻译 `AGENTS.md`，完整保留使命、阅读顺序、迭代选择、架构不变量、实现约定和数据丢失响应。
- [ ] 翻译 `README.md`、`build/brand/README.md`、`docs/README.md`、`docs/test-cases/README.md`。
- [ ] 翻译 `iterations/README.md`，并把机器可检查的报告契约改为阶段二确定的中文标题、表头和结论行。
- [ ] 逐一核对五个 `iterations/templates/*.md`，确认 `{{ITERATION_ID}}` 保持原样且没有未解决的规划内容。
- [ ] 运行以下有限检查：

```powershell
pnpm.cmd verify:docs
node scripts/verify-planning-docs.mjs
```

预期：若其余迭代文档尚未翻译，`verify:docs` 只报告下一阶段待处理的精确文件和行；规划验证器可能因实例文档仍使用英文契约而失败，该失败在阶段五关闭。

## 实施阶段五：翻译 M0 至 M4 迭代资料和 M0 出口证据

- [ ] 按“需求、详细设计、测试用例”顺序翻译 `iterations/M0-foundation/`、`M1-document-core/`、`M2-hybrid-editor/`、`M3-workspace-shell/`、`M4-advanced-markdown/` 中的活跃 Markdown。
- [ ] 翻译 M0 的 `04-test-report.md` 和 `05-exit-report.md`，保留全部命令、退出码、用例 ID、哈希、提交号、GitHub 运行号和证据链接。
- [ ] 将 `iterations/state.json` 中三个 M0 `summary` 改为中文，不改变 `kind`、`path`、`recorded_at` 或任何状态字段。
- [ ] 对每个测试用例表逐行检查列数、自动化命令和参数矩阵，确认 99 个测试 ID 总集合没有变化。
- [ ] 运行聚焦规划测试和实时验证器，确认 M0 完成证据仍满足 `passed` 契约。

## 实施阶段六：翻译 M5 至 M8 及全局活跃资料

- [ ] 翻译 `iterations/M5-media-theme/`、`M6-export/`、`M7-parity-hardening/`、`M8-windows-release/` 中的三个入口文档，保留导出参数、资源状态、性能规模、Windows 发布矩阵和人工门禁要求。
- [ ] 逐一检查并翻译 `docs/00-product-charter.md` 至 `docs/21-command-menu-inventory.md` 中残留的英文标题和叙述；已是中文的段落只做术语与结构一致性修正。
- [ ] 翻译 `docs/test-cases/fixture-catalog.md` 中残留的英文说明，保持夹具 ID 和路径不变。
- [ ] 翻译四个既有 `docs/superpowers/specs/`、`docs/superpowers/plans/` 文件中的英文叙述，保留命令、代码和历史事实。
- [ ] 执行中文扫描并逐条消除真实遗漏；对稳定值造成的误报，收紧解析规则，不通过无限增长的字符串白名单绕过。

## 实施阶段七：完整性核验和最终验证

- [ ] 保存修改前的稳定集合，并在修改后比较：

```powershell
node scripts/verify-planning-docs.mjs
```

预期摘要仍为 9 个迭代、86 个自动化用例、13 个人工用例、83 个需求和 36 个兼容性项。

- [ ] 确认历史归档没有内容差异：

```powershell
git diff --exit-code -- docs/archive
```

- [ ] 扫描旧英文结构和未解决标记：

```powershell
rg -n "^#{1,6} (Iteration|Automated|Manual|Requirement|Final|Document|Lifecycle|Evidence)|Decision:" AGENTS.md README.md build/brand/README.md docs iterations -g "*.md" -g "!docs/archive/**"
```

预期：不存在活跃英文结构；语言验证器另行确认没有未解决的规划内容。

- [ ] 运行格式和空白检查：

```powershell
pnpm.cmd format:check
git diff --check
```

- [ ] 运行聚焦测试：

```powershell
pnpm.cmd exec vitest run --config vitest.config.ts tests/unit/planning/document-language.spec.ts tests/unit/planning/iteration-model.spec.ts tests/unit/planning/planning-verifier.spec.ts
```

- [ ] 运行完整质量门禁：

```powershell
pnpm.cmd check
```

- [ ] 最终人工抽查：根说明、治理说明、模板、M0 出口报告、M1 入口文档以及每个后续迭代各抽查一个测试用例表，确认中文自然、链接有效、表格未错列、语义未删减。
- [ ] 输出变更文件、命令、结果、残余风险和当前迭代状态；未经明确授权不创建提交、标签、发布或推送。
