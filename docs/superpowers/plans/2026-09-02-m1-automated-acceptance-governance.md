# M1 全自动验收与门禁治理实施计划

> **执行约束：** 使用 `superpowers:executing-plans` 按顺序实施，并用复选框（`- [ ]`）跟踪步骤。

**目标：** 用有限时、可重放的 Windows Electron 自动验收替代 M1 的 30 分钟人工门禁，并在全部出口门禁通过后把 M1 设置为 `passed`。

**架构：** 规划层取消按迭代编号强制人工门禁，M1 以新的 `TC-M1-013` 接管原 `MAN-M1-001` 的全部能力。测试层在真实生产 Electron 上通过 CDP composition、真实临时文件、隔离 user-data 和可控原生对话框验证输入、字节、冲突、恢复与关闭，并输出不含正文或绝对路径的机器证据。

**技术栈：** TypeScript 严格模式、Node.js 24、pnpm 11.12.0、Electron 43.1.1、Playwright Electron、Vitest、Chrome DevTools Protocol、SHA-256。

**规格：** `docs/superpowers/specs/2026-09-02-m1-automated-acceptance-governance-design.md`

## 全局约束

- 只实现 M1 产品能力及已批准的全项目门禁治理变更，不实现 M2 产品功能。
- 不创建 T01/T02 等子任务状态、依赖或报告；本文件只是 M1 的一次性实施步骤。
- 每项行为修改先运行能因旧行为而失败的测试，再写最小实现并复验。
- Markdown 源字符串和原始字节仍是唯一权威，任何字节漂移、静默覆盖或恢复失效立即阻断。
- 自动化使用真实生产 Electron，不增加 preload 测试后门，不降低 sandbox、CSP、IPC 或路径授权。
- 所有等待都有不超过 15 秒的条件超时；每个 Playwright 用例总超时不超过 90 秒；禁止 `.skip`、重试和无限循环。
- M1 完成前必须运行 `pnpm check`、`pnpm test:e2e`、`pnpm test:security` 和 `pnpm test:performance`。
- 不执行中间提交；M1 全部通过和审查完成后，按用户既定 GitHub 流程生成一个迭代提交并集成。

---

## 阶段 1：取消强制人工门禁并保护自动化状态转换

**文件：**

- 修改：`tests/unit/planning/iteration-model.spec.ts`
- 修改：`tests/unit/planning/planning-verifier.spec.ts`
- 修改：`scripts/planning/iteration-model.mjs`
- 修改：`scripts/verify-planning-docs.mjs`
- 修改：`iterations/state.json`
- 修改：`AGENTS.md`
- 修改：`iterations/README.md`
- 修改：`iterations/templates/detailed-design.md`
- 修改：`iterations/templates/test-cases.md`
- 修改：`iterations/templates/test-report.md`
- 修改：`iterations/templates/exit-report.md`
- 修改：`docs/07-iteration-roadmap.md`
- 修改：`docs/08-development-plan.md`
- 修改：`docs/09-test-strategy.md`
- 修改：`docs/10-release-quality-gates.md`
- 修改：`docs/11-codex-cli-runbook.md`
- 修改：`docs/12-risk-register.md`
- 修改：`docs/14-planning-acceptance.md`

**接口：**

- 保留 `manual_gate: boolean` 和 `awaiting_manual` 状态，供未来经独立设计批准的物理边界使用。
- 删除 `MANDATORY_MANUAL_GATES` 以及 M6 特判。
- `validateIterationState(state, schema)` 只在 `manual_gate:true` 且状态为 `passed` 时要求 `kind:'manual'` 证据。
- `validateTestReportCompletion(...)` 只在 `iteration.manual_gate === true` 时校验人工结果表。

- [ ] **步骤 1：把旧“所有迭代必须人工门禁”测试改成自动化默认的失败测试**

  在 `tests/unit/planning/iteration-model.spec.ts` 增加当前模型尚不能通过的断言：M0 保持历史 `manual_gate:true`，M1 为 `in_progress/manual_gate:false`，M2–M8 为 `blocked/manual_gate:false`，验证结果不得包含 `manual_gate is mandatory`。同时保留 `awaiting_manual + manual_gate:false` 必须失败，以及 `passed + manual_gate:true` 缺少人工证据必须失败。

  ```ts
  it('accepts automatic-only gates without weakening explicit manual gates', () => {
    const state = validState()
    state.iterations.forEach((iteration, index) => {
      if (index > 0) iteration.manual_gate = false
    })
    state.iterations[1]!.status = 'in_progress'

    expect(validateIterationState(state, schema)).not.toContain('M1 manual_gate is mandatory')
  })
  ```

- [ ] **步骤 2：运行规划模型测试并确认 RED**

  运行：

  ```powershell
  pnpm test -- tests/unit/planning/iteration-model.spec.ts
  ```

  预期：因旧 `MANDATORY_MANUAL_GATES` 返回 `M1 manual_gate is mandatory` 而失败。

- [ ] **步骤 3：删除编号强制规则并收窄人工证据条件**

  从 `scripts/planning/iteration-model.mjs` 删除 `MANDATORY_MANUAL_GATES` 和对应必需判断，把通过态证据条件改为：

  ```js
  if (
    iteration.status === 'passed' &&
    iteration.manual_gate === true &&
    !iteration.evidence.some((record) => isPlainObject(record) && record.kind === 'manual')
  ) {
    errors.push(`${iteration.id} passed manual gate requires manual evidence`)
  }
  ```

  在 `scripts/verify-planning-docs.mjs` 中仅对 `manual_gate:true` 的 passed 迭代调用人工结果校验，并删除 M6 必须人工门禁的特判；M6 的 Pandoc 自动化要求继续保留。

- [ ] **步骤 4：运行规划模型与规划验证器单元测试并确认 GREEN**

  运行：

  ```powershell
  pnpm test -- tests/unit/planning/iteration-model.spec.ts tests/unit/planning/planning-verifier.spec.ts
  ```

  预期：所有规划单元测试通过，显式人工门禁仍失败关闭。

- [ ] **步骤 5：更新活跃治理文档与状态**

  把 `AGENTS.md`、`iterations/README.md`、模板和全局计划中的“一律人工门禁”改为“自动化默认；只有经设计确认的不可自动化物理边界才可启用人工门禁”。M0 历史保持不变；M1 改为 `in_progress/manual_gate:false`；M2–M8 保持 `blocked` 并改为 `manual_gate:false`。未来入口文档中的 MAN 场景在对应迭代开始前必须迁移为自动用例，不能因 `manual_gate:false` 被跳过。

- [ ] **步骤 6：运行文档与规划校验**

  运行：

  ```powershell
  pnpm verify:docs
  node scripts/verify-planning-docs.mjs
  ```

  预期：中文文档和规划一致性均退出 `0`。

## 阶段 2：建立版本化字节夹具和自动证据边界

**文件：**

- 创建：`tests/fixtures/bytes/m1-byte-fixtures.json`
- 创建：`tests/helpers/m1-acceptance.ts`
- 创建：`tests/unit/helpers/m1-acceptance.spec.ts`
- 删除：`scripts/manual/m1-manual-gate.mjs`
- 删除：`scripts/manual/m1-manual-gate.d.mts`
- 删除：`tests/unit/manual/m1-manual-gate.spec.ts`
- 修改：`package.json`
- 修改：`.gitignore`

**接口：**

```ts
export interface M1ByteFixture {
  readonly id: string
  readonly fileName: string
  readonly encoding: 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be' | 'unknown'
  readonly eolProfile: 'none' | 'lf' | 'crlf' | 'mixed' | 'lf-no-final-eol'
  readonly baselineBase64: string
  readonly expectedBase64: string
  readonly baselineSha256: string
  readonly expectedSha256: string
  readonly editable: boolean
}

export function loadM1ByteFixtures(rootDirectory: string): Promise<readonly M1ByteFixture[]>
export function sha256(bytes: Uint8Array): string
export function createM1AcceptanceRecorder(options: {
  readonly rootDirectory: string
  readonly environment: Readonly<Record<string, string>>
}): M1AcceptanceRecorder
```

`M1AcceptanceRecorder.record()` 只接受固定场景 ID、通过状态、哈希和 `REF/COMP` ID；`finish()` 要求全部固定场景已记录且都为 passed，然后以同目录临时文件和原子替换写入 `artifacts/m1/automated/acceptance.json`。

- [ ] **步骤 1：编写夹具完整性与证据记录器失败测试**

  测试必须证明：Base64 解码哈希与冻结 SHA-256 一致；fixture ID 不重复；editable 夹具 baseline 与 expected 只在 `M1_EDIT_OLD`/`M1_EDIT_NEW` 对应字节范围变化；证据拒绝未知场景、重复记录、绝对路径、正文和缺失场景。

- [ ] **步骤 2：运行帮助模块测试并确认 RED**

  运行：

  ```powershell
  pnpm test -- tests/unit/helpers/m1-acceptance.spec.ts
  ```

  预期：因 `tests/helpers/m1-acceptance.ts` 和夹具清单不存在而失败。

- [ ] **步骤 3：添加固定夹具清单与最小帮助实现**

  清单固定以下九项：`empty`、`utf8-lf`、`utf8-crlf`、`utf8-no-final-eol`、`utf8-bom-crlf`、`utf16le-bom-lf`、`utf16be-bom-crlf`、`utf8-mixed-eol`、`invalid-utf8-readonly`。所有可编辑正文只把等长 ASCII 标记从 `M1_EDIT_OLD` 变为 `M1_EDIT_NEW`；非法 UTF-8 的 expected 与 baseline 完全相同。

  帮助模块使用 `Buffer.from(value, 'base64')`、`createHash('sha256')`、`lstat/realpath` 和原子 rename，不读取或写出用户文档正文。

- [ ] **步骤 4：运行帮助模块测试并确认 GREEN**

  运行：

  ```powershell
  pnpm test -- tests/unit/helpers/m1-acceptance.spec.ts
  ```

  预期：夹具与证据记录器测试全部通过。

- [ ] **步骤 5：删除被否决的人工验收工具**

  删除 `scripts/manual/m1-manual-gate.*` 和对应单元测试，从 `package.json` 删除 `manual:m1:prepare`、`manual:m1:verify`。保留 `.gitignore` 的 `artifacts/m1/`，其用途改为自动证据；不读取、迁移或提交此前生成的人工目录。

## 阶段 3：自动验证 Chromium composition 与 CodeMirror 历史

**文件：**

- 修改：`tests/e2e/source-editor.spec.ts`
- 修改：`iterations/M1-document-core/03-test-cases.md`

**接口：**

通过 `page.context().newCDPSession(page)` 获得 CDP 会话，只调用：

```ts
session.send('Input.imeSetComposition', {
  text,
  selectionStart: text.length,
  selectionEnd: text.length,
  replacementStart,
  replacementEnd
})
session.send('Input.insertText', { text })
```

- [ ] **步骤 1：增加 CDP composition 特征测试并确认 RED**

  在真实 Electron 编辑器获得焦点后，依次设置组合文本 `zh`、`中`、提交 `中`，断言 DOM 中组合阶段不重复、最终源码恰好为 `中`，一次撤销清除整个提交，一次重做恢复。若 Electron 不支持 `Input.imeSetComposition`，测试必须保留失败，不能改用仅 `insertText` 的弱替代。

- [ ] **步骤 2：运行源码编辑 E2E 并确认旧测试缺少该覆盖**

  运行：

  ```powershell
  pnpm build
  pnpm exec playwright test tests/e2e/source-editor.spec.ts --config playwright.config.ts
  ```

  若 `pnpm exec` 在当前主机不能解析本地二进制，使用同一锁定入口：

  ```powershell
  node node_modules/@playwright/test/cli.js test tests/e2e/source-editor.spec.ts --config playwright.config.ts
  ```

  预期：新断言在 composition 提交或历史分组处失败，证明旧 `insertText` 用例不足。

- [ ] **步骤 3：只在产品边界确有缺陷时修改 CodeMirror 控制器**

  若 CDP 输入揭示产品缺陷，修改 `src/renderer/src/editor/code-mirror-document-controller.ts` 或 `source-editor.tsx`，确保组合期间不重建 EditorView、不镜像 React 全文，并让 composition 提交成为一个历史事务。若现有产品实现已经正确，新测试直接变绿，不制造无必要产品代码。

- [ ] **步骤 4：加入固定种子组合序列**

  使用测试侧固定语料循环有限的 200 个短序列，覆盖中文、Emoji、组合字符、全角标点、候选更新、跨行选择、删除、撤销与重做。每个序列从新文档状态开始，循环上限是常量 200，无条件等待均由 Playwright 断言的 10 秒超时控制。

- [ ] **步骤 5：运行源码编辑 E2E 并确认 GREEN**

  预期：现有 Unicode 用例和新增 composition 用例均通过，无重复或丢失字符。

## 阶段 4：自动验证真实字节、全部冲突分支、强杀恢复与关闭选择

**文件：**

- 创建：`tests/e2e/m1-windows-acceptance.spec.ts`
- 修改：`tests/e2e/external-conflict.spec.ts`
- 修改：`tests/e2e/document-commands.spec.ts`
- 修改：`tests/integration/recovery.spec.ts`
- 修改：`playwright.config.ts`

**场景 ID：** `ime-composition`、`byte-roundtrip`、`conflict-compare-cancel`、`conflict-reload`、`conflict-save-as`、`conflict-confirmed-overwrite`、`crash-recovery`、`close-save`、`close-discard`、`close-cancel`、`reference-evidence`。

- [ ] **步骤 1：先写字节 E2E 的失败测试**

  对每个 fixture 创建真实临时文件，覆盖系统打开对话框返回值，通过 UI 打开。editable 文件在 CodeMirror 中只替换标记并调用保存；readonly 文件尝试保存必须被禁用或返回稳定错误。测试用 Node 读取最终字节并断言：

  ```ts
  expect(sha256(actual)).toBe(fixture.expectedSha256)
  expect(actual).toEqual(Buffer.from(fixture.expectedBase64, 'base64'))
  ```

  首次运行应因自动验收文件和证据记录尚未存在而失败。

- [ ] **步骤 2：实现并通过字节 E2E**

  只使用主进程 `dialog.showOpenDialog` 替身选择测试拥有的临时路径，不放宽 renderer 路径 API。每个 fixture 结束后记录 baseline/expected/actual SHA-256，清理临时目录。

- [ ] **步骤 3：先扩展冲突分支测试并观察缺失覆盖**

  保留现有比较、取消、重载场景，新增独立的另存和确认覆盖场景。另存分支覆盖 `dialog.showSaveDialog`，断言原外部文件哈希不变且新文件等于本地版本；确认覆盖分支断言第一次操作只显示二次确认，确认后目标才变为本地版本。所有场景在选择前保存两份哈希。

- [ ] **步骤 4：实现或修复冲突 UI 行为并运行 GREEN**

  仅当新场景暴露产品缺陷时修改 `external-conflict-dialog.tsx`、文档控制器或主进程保存服务；每个修复必须有对应失败场景，不能合并冲突版本或跳过二次确认。

- [ ] **步骤 5：先写强杀恢复 E2E 并确认 RED**

  使用独立 `--user-data-dir=<临时目录>` 启动生产 Electron，输入固定非敏感文本并等待恢复文件满足明确条件，最长 5 秒。通过 `application.process().kill('SIGKILL')` 强制终止并等待进程退出，随后用同一目录重启，点击恢复并断言正文与预期 SHA-256 相同。

- [ ] **步骤 6：修复恢复边界并运行 GREEN**

  若命令行 user-data 隔离不影响 `app.getPath('userData')`，不改产品代码；若 Electron 未应用该参数，在 `src/main/index.ts` 增加只接受 Electron 标准 `--user-data-dir` 的启动前路径解析，不增加 renderer 或 preload 方法。恢复等待只检查文件存在、大小和最终 UI 状态，不读取日志正文。

- [ ] **步骤 7：扩展关闭三分支并运行 GREEN**

  保存分支覆盖未命名文件的原生保存选择器并核对字节；放弃分支确认窗口关闭且未创建文件；取消分支确认窗口仍存在、正文仍脏。每个分支使用独立应用实例和 10 秒窗口事件超时。

- [ ] **步骤 8：生成自动证据汇总**

  最后一个 `reference-evidence` 场景要求前十个场景证据全部存在并通过，把 `REF-001..005` 映射到 `COMP-001..004`、`COMP-036` 和直接用例，写出原子 JSON。缺少任一场景、哈希或引用时失败。

- [ ] **步骤 9：运行 M1 自动验收文件**

  运行：

  ```powershell
  pnpm build
  node node_modules/@playwright/test/cli.js test tests/e2e/source-editor.spec.ts tests/e2e/m1-windows-acceptance.spec.ts tests/e2e/external-conflict.spec.ts tests/e2e/document-commands.spec.ts --config playwright.config.ts
  ```

  预期：全部真实 Electron 场景通过，命令结束后没有残留 Electron 子进程。

## 阶段 5：闭合 M1 文档、证据、报告和状态

**文件：**

- 修改：`iterations/M1-document-core/01-requirements.md`
- 修改：`iterations/M1-document-core/02-detailed-design.md`
- 修改：`iterations/M1-document-core/03-test-cases.md`
- 修改：`iterations/M1-document-core/04-test-report.md`
- 创建：`iterations/M1-document-core/05-exit-report.md`
- 修改：`docs/02-compatibility-matrix.md`
- 修改：`docs/22-typora-1.13.8-windows-evidence-baseline.md`
- 修改：`docs/test-cases/fixture-catalog.md`
- 修改：`iterations/state.json`

- [ ] **步骤 1：把 `MAN-M1-001` 迁移为自动用例**

  在 M1 测试文档新增 `TC-M1-013` 自动用例表行，明确命令、场景、90 秒单用例上限、哈希和停止条件。人工测试节写明“不适用”，并保留 `MAN-M1-001 → TC-M1-013` 的废止记录及日期，不把历史 ID复用为自动 ID。

- [ ] **步骤 2：更新 M1 需求、设计、夹具和证据映射**

  删除人工评估人、签字和 30 分钟要求；把 `REF-001..005` 的测试列改为直接自动用例；夹具目录记录 Base64、SHA-256 和生成规则。兼容性矩阵在自动证据通过后把 M1 对应项设为 `passed`，证据台账把实现状态设为 `已实现`。

- [ ] **步骤 3：更新测试报告**

  使用本次新鲜命令输出更新测试数量、日期、环境、退出码和自动证据路径。人工用例结果与人工门禁交接明确写为“不适用：已由批准的自动化治理变更替代”，不得伪造评估人。

- [ ] **步骤 4：先把状态切换为候选 passed 并运行规划校验**

  创建完整中文出口报告，逐项列出 `DOC-001..010`、`EDT-002..003`、`EDT-005`、`EDT-009`、`EDT-013`、`UI-001`、`COMP-001..004`、`COMP-036`、`NFR-001` 的直接证据。随后把 M1 设置为 `passed`、M2 设置为 `ready`，添加 test/report evidence，不添加 manual evidence。

  运行：

  ```powershell
  node scripts/verify-planning-docs.mjs
  ```

  预期：报告覆盖、状态前沿、依赖和证据全部通过。

## 阶段 6：完整复验、审查和集成

**文件：** 本阶段原则上不增加文件；失败时回到拥有该行为的前一阶段，以失败测试修复。

- [ ] **步骤 1：运行完整本地门禁**

  依次运行以下有限命令并保存完整退出结果：

  ```powershell
  pnpm check
  pnpm test:e2e
  pnpm test:security
  pnpm test:performance
  git diff --check
  ```

  `pnpm check` 的嵌套干净副本集成测试可能持续约七分钟，但有明确子进程超时，不是循环。若 Windows 沙箱阻止 `taskkill` 或 Electron GPU/缓存，使用同一命令在普通用户权限环境重跑，不改测试断言。

- [ ] **步骤 2：执行需求逐项完成审计**

  对照设计规格、M1 三份入口、13 个 `TC-M1-*`、五个 `REF-*`、五个 `COMP-*` 和全部全局需求，逐项核对直接文件、测试输出或证据 JSON。任何间接、缺失或过期证据都视为未完成。

- [ ] **步骤 3：使用 `superpowers:requesting-code-review` 审查完整差异**

  审查重点：数据丢失、测试是否真正经过 Electron、composition 是否使用 CDP、强杀是否真实、门禁是否被弱化、证据是否泄露正文/绝对路径、是否存在残留进程或无界等待。

- [ ] **步骤 4：修复审查问题并重新运行受影响测试和全部出口门禁**

  每个代码问题先补失败测试；文档问题直接修正并重跑中文与规划校验。只有所有门禁新鲜通过后才能进入集成。

- [ ] **步骤 5：生成一个 M1 迭代提交并按既定 GitHub 流程集成**

  运行 `git status --short` 和 `git diff --stat` 确认范围，提交 `codex/m1-document-core`，推送分支，使用 GitHub CLI 创建 PR，等待并核对 Quality、CodeQL、Dependency Review 与 GitHub 原生审查。全部门禁通过后合并到 `main`，拉取并在本地验证合并提交包含 M1 出口报告和状态。

  建议提交标题：

  ```text
  feat: complete M1 lossless document core
  ```

- [ ] **步骤 6：最终完成声明**

  最终回复列出变更文件、全部命令与退出结果、自动证据路径、GitHub PR/合并结果和剩余风险。只有仓库 `main` 上的 M1 状态为 `passed`、M2 为 `ready` 且所有门禁通过，才把线程目标标记为完成。
