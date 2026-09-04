# 移除未使用 Squirrel peer 的实施计划

> **供自动化执行者使用：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐项实施本计划。步骤使用复选框（`- [ ]`）追踪。

**目标：** 保留 electron-builder 固定的 NSIS/dir 能力，同时从每次冻结安装中移除未使用的 Squirrel peer 和 electron-winstaller 依赖。

**架构：** 用一个限定版本的 pnpm 根 override 表达能力决策，重新生成锁文件，并把自举失败处理恢复为一次严格安装尝试。通过聚焦文本契约测试固定依赖策略，再使用真实离线干净副本和 GitHub Windows 质量门禁验证。

**技术栈：** pnpm 11.12.0 工作区设置和锁文件、TypeScript 5.9、Vitest 4.1、Electron Builder 26.15.3、Windows GitHub Actions。

## 全局约束

- 保留 `electron-builder@26.15.3`、Windows x64 `dir` 和 NSIS 能力。
- 只移除 `app-builder-lib@26.15.3>electron-builder-squirrel-windows`。
- 不全局设置 `autoInstallPeers: false`。
- 只保留已审阅的 `allowBuilds.esbuild: true` 安装脚本。
- 不增加安装重试、超时扩展、Squirrel 支持或新依赖。
- 任何冻结安装错误继续作为终止结果。

---

### 阶段 1：用 RED 测试固定依赖图策略

**文件：**

- 修改：`tests/unit/quality-config.spec.ts`

**接口：**

- 输入：已提交的 `pnpm-workspace.yaml`、`pnpm-lock.yaml` 和 `package.json` 文本。
- 输出：精确 override 和禁止包条目的聚焦回归契约。

- [ ] **步骤 1：增加失败策略测试**

读取三个文件并增加以下用例：

```ts
it('removes only the unused pinned Squirrel peer from the packaging graph', async () => {
  const [workspace, lockfile, manifestText] = await Promise.all([
    readFile(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8'),
    readFile(join(process.cwd(), 'pnpm-lock.yaml'), 'utf8'),
    readFile(join(process.cwd(), 'package.json'), 'utf8')
  ])
  const manifest: unknown = JSON.parse(manifestText)

  expect(workspace).toMatch(
    /overrides:\s*\n\s*['"]app-builder-lib@26\.15\.3>electron-builder-squirrel-windows['"]:\s*['"]-['"]/
  )
  expect(workspace).not.toMatch(/^autoInstallPeers:/m)
  expect(workspace).toMatch(/allowBuilds:\s*\n\s*esbuild:\s*true/)
  expect(workspace).not.toContain('electron-winstaller')
  expect(lockfile).not.toMatch(/^\s{2}electron-winstaller@5\.4\.0:/m)
  expect(lockfile).not.toMatch(/^\s{2}electron-builder-squirrel-windows@26\.15\.3(?:\([^\n]+\))?:/m)
  expect(manifest).toMatchObject({ devDependencies: { 'electron-builder': '26.15.3' } })
})
```

- [ ] **步骤 2：运行聚焦测试并确认 RED**

运行：

```powershell
pnpm.cmd test tests/unit/quality-config.spec.ts
```

预期：新用例因缺少 override 且禁止包条目仍存在而失败；既有质量配置用例继续通过。

### 阶段 2：移除未使用 peer 和症状级重试

**文件：**

- 修改：`pnpm-workspace.yaml`
- 修改：`pnpm-lock.yaml`
- 修改：`tests/helpers/bootstrap-project.ts`
- 修改：`tests/unit/helpers/bootstrap-project.spec.ts`

**接口：**

- 输入：pnpm 根 `overrides` 依赖边移除语法。
- 输出：包含当前 `verifyBootstrap(options): Promise<BootstrapEvidence>` API 且只安装一次的 489 包冻结图。

- [ ] **步骤 1：应用窄工作区策略**

让 `pnpm-workspace.yaml` 精确保留工作区和 esbuild 批准，同时增加限定 override：

```yaml
packages:
  - '.'

allowBuilds:
  esbuild: true

overrides:
  'app-builder-lib@26.15.3>electron-builder-squirrel-windows': '-'
```

- [ ] **步骤 2：离线重新生成锁文件**

运行：

```powershell
pnpm.cmd install --offline --lockfile-only
pnpm.cmd install --offline --frozen-lockfile
```

预期：两个命令均退出 `0`；pnpm 报告安装 489 个包；不存在 Squirrel 或 electron-winstaller 包目录。

- [ ] **步骤 3：恢复严格单次尝试自举行为**

在 `tests/helpers/bootstrap-project.ts` 移除 `BootstrapOptions.wait`、重试延迟与分类辅助器、`runPnpmOnce` 和重试分支。把安装调用恢复为：

```ts
await runPnpm(run, projectRoot, installArguments, 'pnpm install')
```

在 `tests/unit/helpers/bootstrap-project.spec.ts` 移除瞬态失败夹具、有序安装结果支持、公共重试选项辅助器和五个重试专用用例。保留既有 `reports an install-stage exit code` 用例作为失败关闭契约。

- [ ] **步骤 4：运行聚焦 GREEN**

运行：

```powershell
pnpm.cmd test tests/unit/quality-config.spec.ts tests/unit/helpers/bootstrap-project.spec.ts
pnpm.cmd peers check
pnpm.cmd ignored-builds
```

预期：聚焦测试通过；peer 检查报告无问题；ignored builds 报告自动 `None` 且无显式拒绝区段。

### 阶段 3：对齐已准入依赖记录

**文件：**

- 修改：`docs/04-technology-stack.md`
- 修改：`iterations/M0-foundation/02-detailed-design.md`
- 验证后修改：`iterations/M0-foundation/04-test-report.md`

**接口：**

- 输入：阶段 2 的精确依赖图和已观察命令输出。
- 输出：准确的 M0 依赖决策和测试证据。

- [ ] **步骤 1：替换过时显式拒绝决策**

记录限定版本 override 移除未使用 Squirrel peer、electron-winstaller 不再安装或暴露脚本、所有其他 peer 解析继续启用，以及 electron-builder 升级要求重新评估或移除 override。

- [ ] **步骤 2：只记录新鲜验证证据**

阶段 4 后，用精确包数量、peer 检查、ignored-build、本地完整门禁和 GitHub 必需检查结果更新 M0 测试报告。不要把 M0 标为 passed，也不要创建出口报告。

### 阶段 4：验证、提交、发布并观察必需门禁

**文件：**

- 不增加源文件。

**接口：**

- 输入：阶段 1–3 的最终文件树。
- 输出：本地和 GitHub Windows 验收证据。

- [ ] **步骤 1：运行本地门禁**

```powershell
pnpm.cmd test:integration tests/integration/project-bootstrap.spec.ts
node scripts/verify-planning-docs.mjs
pnpm.cmd check
git diff --check
```

预期：每个命令均退出 `0`，包括中文和空格路径干净副本自举、完整单元/集成矩阵和生产构建。

- [ ] **步骤 2：提交修正**

只暂存工作区策略、锁文件、严格自举辅助器/测试、质量配置测试和 M0 文档。提交命令：

```powershell
git commit -m "fix: remove unused Squirrel packaging peer"
```

- [ ] **步骤 3：推送并等待 GitHub**

快进 `codex/iteration-governance`，验证远程文件树与本地已测试文件树一致，并等待 PR #1 必需 `quality` 作业达到终态。pending 或失败时不得合并。
