# M0-T06 CI、依赖与里程碑审计设计

- 日期：2026-08-02
- 状态：已选定唯一实施方案
- 任务：M0-T06
- 依赖：M0-T05 `passed` 后才实施

## 1. 目标与实际起点

M0-T06 建立 Windows GitHub CI、生产制品、传递依赖/许可证审计、CycloneDX
SBOM、CodeQL、Dependency Review、Dependabot 和 `main` ruleset，并完成
`MAN-M0-001` 人工门禁。

用户已于 2026-07-31 明确授权并提前创建公开仓库
`https://github.com/dctorwho/lattice`，配置 `origin`，并把当时的 `main`
完整历史推送到远端。M0-T06 不重建或覆盖仓库；首先验证 owner、visibility、
default branch、remote URL 和本地/远端提交，再继续工作流引导。

## 2. 唯一依赖方案

### 2.1 新增开发依赖

只新增 `electron-builder@26.15.3`：

- 用途：Windows x64 unpacked 应用与 NSIS 安装器。
- 许可证：MIT。
- 直接包本身无 npm install script；传递依赖包含受控平台打包辅助二进制。
- 构建阶段可能获取 Electron Builder/NSIS 辅助工具，必须记录来源、缓存、哈希
  和网络行为；CI 与本地首次打包均为显式允许联网门禁。
- 替代方案 Electron Forge/手工 NSIS 会增加迁移或维护成本，不采用。
- 包体影响：仅开发/打包期，不进入 renderer 生产依赖。

不新增许可证扫描器、漏洞扫描器或 SBOM npm 包。权威输入使用：

```powershell
pnpm list --prod --json --depth Infinity
pnpm licenses list --prod --json
pnpm audit --prod --json
```

项目脚本把这些 JSON 规范化为依赖清单、许可证报告和 CycloneDX JSON。这样审计
逻辑可测试、输入可固定、无需给第三方审计工具新增自身供应链。

### 2.2 固定 GitHub Actions

所有 `uses:` 固定完整 commit SHA，并在注释记录 release：

| Action                             | Release   | Commit SHA                                 | License |
| ---------------------------------- | --------- | ------------------------------------------ | ------- |
| `actions/checkout`                 | `v7.0.1`  | `3d3c42e5aac5ba805825da76410c181273ba90b1` | MIT     |
| `pnpm/action-setup`                | `v6.0.9`  | `0ebf47130e4866e96fce0953f49152a61190b271` | MIT     |
| `actions/setup-node`               | `v7.0.0`  | `820762786026740c76f36085b0efc47a31fe5020` | MIT     |
| `actions/upload-artifact`          | `v7.0.1`  | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | MIT     |
| `github/codeql-action`             | `v4.37.4` | `f205ea1c3313d32999d8d6a48b4f6530d4437b38` | MIT     |
| `actions/dependency-review-action` | `v5.0.0`  | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` | MIT     |

版本证据记录 GitHub release URL、发布日期、SHA 和许可证。升级必须重复审查。

## 3. 打包设计

`package.json` 固定 `build` 配置：

- `appId`: `io.github.dctorwho.lattice`
- `productName`: `Lattice`
- x64 Windows `dir` 与 `nsis` 目标。
- ASAR 启用；只包含 `out/`、生产 `package.json`/依赖和批准资源。
- 输出到 `dist/`；确定性 artifact name 不包含本机路径。
- NSIS 为 per-user、非 web installer，不要求管理员权限。
- 不启用发布、自动更新或代码签名；未签名状态进入 M8 风险所有权。
- `npmRebuild:false`，因为当前没有原生生产依赖；未来出现原生依赖必须重审。
- 使用项目原创的 Lattice 几何图标；提交可审阅的 SVG 源、Windows PNG/ICO
  制品和 SHA-256，不使用 Electron 默认图标、Typora 素材或运行时图标生成依赖。
- 生成后的 ICO 作为受审二进制资源进入仓库；CI 核对固定哈希，不依赖本机图形
  工具重新生成。源图与生成步骤记录在资源说明中。

脚本：

```text
package:dir  -> pnpm build && electron-builder --win dir --x64
package:win  -> pnpm build && electron-builder --win nsis --x64
audit:deps   -> 生成并验证依赖/许可证/漏洞报告
audit:sbom   -> 生成并验证 CycloneDX SBOM
audit:m0     -> planning docs + deps + SBOM + artifact metadata
```

打包测试从 unpacked 应用启动真实窗口，验证 file URL、sandbox/preload 表面、无
开发服务器、无 DevTools、资源存在和进程退出。NSIS 只做结构/哈希自动验证；
真实安装窗口由 MAN-M0-001 覆盖。

## 4. 审计与 SBOM

审计脚本位于 `scripts/audit/`，所有 filesystem、clock、command runner 均可注入。
输出到忽略的 `artifacts/m0/`：

- `dependency-inventory.json`
- `licenses.json`
- `audit.json`
- `sbom.cdx.json`
- `artifact-hashes.json`
- `planning-verification.json`

生产依赖许可证 allowlist 初始只允许实际出现的 MIT；未知、缺失、copyleft 或
多许可证表达式必须人工评估并默认阻断。开发依赖另出完整清单，不因 dev-only
自动豁免，但不计入发布 SBOM 的 production component 集合。

CycloneDX 使用 JSON 1.6，包含 metadata/component、唯一 bom-ref、purl、版本、
许可证、依赖边和生成工具信息。测试验证 schema 必需字段、唯一引用、无绝对
路径，以及每个 `pnpm list --prod` 组件恰好被覆盖。

`pnpm audit --prod --json` 网络失败、格式未知或达到门槛均失败关闭。门槛：
high/critical 为 0；moderate/low 必须记录但在 M0 不自动阻断。任何例外必须有
任务 ID、原因、期限和用户批准，本任务不预设例外。

## 5. GitHub 工作流

### 5.1 `ci.yml`

触发：PR 到 main、main push、workflow_dispatch。Windows runner 上：

1. checkout，固定 Node 24、pnpm 11.12.0 和 pnpm store cache。
2. frozen install。
3. planning docs verification。
4. `pnpm check`。
5. `pnpm test:e2e` 与 `pnpm test:security`。
6. `pnpm audit:m0`。
7. `pnpm package:dir` 与打包窗口 smoke。
8. 上传测试、审计、SBOM、哈希和允许的 unpacked 元数据；不上传 token、用户
   正文或本机绝对路径。

冷自举和性能使用 `workflow_dispatch` 独立 job，不混入离线 `pnpm check`。

### 5.2 `codeql.yml`

JavaScript/TypeScript default setup：PR、main push、每周定时和手工触发。权限
最小化为 `contents:read`、`security-events:write`；不使用
`pull_request_target`。

### 5.3 `dependency-review.yml`

仅 PR，`contents:read`、`pull-requests:read`。阻断 moderate 及以上已知漏洞；
许可证 allow/deny 与项目台账一致。它是增量前置门禁，不替代本地全量审计。

### 5.4 Dependabot

每周 pnpm 与 GitHub Actions 更新；Electron、构建、安全和测试主版本不分组、
不自动合并。所有 PR 走同一 required checks。

## 6. Ruleset 引导

工作流先在 M0-T06 分支通过本地测试，然后推送该分支并创建 bootstrap PR。
PR 自身产生 CI、CodeQL 与 Dependency Review 的真实检查；全部成功后才通过
GitHub CLI 合并。main push 再次产生稳定检查后创建 active ruleset：

- target `main`
- required pull request
- required status checks：CI、Electron E2E、安全、M0 审计、CodeQL、
  Dependency Review
- required conversation resolution
- linear history
- block force push and deletion
- 不要求第二人批准，不设置日常 bypass
- 合并后自动删除分支

基础设施 PR 合并时 `tasks/state.json` 保持 `awaiting_manual`。随后创建独立测试
分支/PR：先提交一个可恢复的故障验证失败检查阻止合并，再修复并验证全部检查
通过、conversation 已解决后允许合并。直接推送验证只使用无内容变化的受控
测试引用或 GitHub ruleset evaluate/API 证据；不得冒险改写 main。

MAN-M0-001 通过后，最终状态变更在受保护分支上提交为第二个小型 PR，依靠同一
required checks 合入 main，把 M0-T06 从 `awaiting_manual` 设为 `passed` 并只
解锁 M1-T01。人工门禁未通过时不得创建该状态 PR。

## 7. 安全与失败处理

- workflow 默认 `contents:read`；仅 CodeQL job 获得必要写权限。
- fork PR 不获得 secrets 或写 token。
- action 全部使用完整 SHA，不执行浮动 tag。
- GitHub API 步骤幂等读取现状；owner、visibility、default branch 或 origin
  不一致立即停止。
- 工作流失败时不激活/不弱化 ruleset；已部分配置时逐项读取并安全恢复。
- 打包、审计和 GitHub 命令都有显式超时；不运行无限轮询。
- 日志和 artifact 删除绝对路径、token、正文及未脱敏环境信息。

## 8. 测试与验收

TC-M0-007 覆盖：

1. 审计脚本的正常、未知许可证、缺组件、漏洞、路径泄漏和命令失败矩阵。
2. SBOM production 覆盖、唯一 bom-ref、依赖边和确定性输出。
3. clean checkout 的 frozen install、planning、check、E2E、安全、审计和打包。
4. unpacked 应用真实启动与安全边界。
5. workflow YAML action SHA、权限、触发器、命令和 artifact allowlist。
6. GitHub 实际 run/check、CodeQL、Dependency Review、Dependabot 和 ruleset。
7. 直接推送被拒绝、失败 PR 不可合并、成功 PR 可合并。

本地/CI 门禁均通过后，任务进入 `awaiting_manual`。用户执行 MAN-M0-001：

1. Windows 11 普通用户查看 unpacked 与 NSIS 安装窗口。
2. 尝试 DevTools、导航和 renderer 权限。
3. 审阅 preload API、CI、依赖许可证、漏洞报告和 SBOM。
4. 确认构建哈希、GitHub ruleset 和测试 PR 证据。

只有用户明确签署通过后，M0-T06 才设为 `passed` 并只解锁 M1-T01。
