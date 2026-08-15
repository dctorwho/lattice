# Codex CLI 执行手册

## 1. 使用模型

Codex 不是一次性产品生成器。本仓库把长期目标拆为有状态迭代；一次运行只实施一个 M0–M8 迭代。`AGENTS.md` 保存长期约束，迭代的三份入口文档保存当前范围、设计和测试，`iterations/state.json` 保存唯一进度。

官方行为依据：Codex 每次运行前按目录层级读取 `AGENTS.md`；`codex exec` 可用于非交互任务，默认只读，写代码应显式使用 `--sandbox workspace-write`。不要使用 `danger-full-access` 作为常规开发配置。

## 2. 首次准备

当前目录若还不是 Git 仓库，先执行：

```powershell
git init
git branch -M main
corepack install --global pnpm@11.12.0
pnpm --version
codex --ask-for-approval never "只总结当前生效的 AGENTS.md 指令和工作区根目录，不修改文件。"
```

确认输出包含迭代选择、Markdown 唯一真相和停止条件。Codex 官方要求非交互模式位于 Git 仓库；不要用 `--skip-git-repo-check` 绕过正常项目保护。

## 3. 执行下一迭代

```powershell
codex exec `
  --sandbox workspace-write `
  --ask-for-approval on-request `
  "读取 AGENTS.md、iterations/state.json 和 iterations/README.md。选择一个 ready 且依赖 passed 的迭代，读取其 01-requirements.md、02-detailed-design.md、03-test-cases.md 和引用文档。只实施该迭代；开发中运行聚焦测试，退出时运行完整门禁。写入 04-test-report.md 后再 awaiting_manual；人工证据和 05-exit-report.md 完整后才 passed，然后停止。"
```

更推荐明确指定迭代，避免并行状态歧义：

```powershell
codex exec `
  --sandbox workspace-write `
  --ask-for-approval on-request `
  "执行 M0。遵守 AGENTS.md，只处理该迭代；验证并报告后停止。"
```

依赖下载需要网络时允许 Codex 发起审批。不要预先给予全盘写入或无限网络权限。

## 4. 保存机器可读日志

```powershell
New-Item -ItemType Directory -Force .codex-runs | Out-Null
codex exec --json `
  --sandbox workspace-write `
  --ask-for-approval on-request `
  "执行 M1，只完成该迭代。" `
  | Tee-Object -FilePath .codex-runs\M1.jsonl
```

`.codex-runs/` 必须加入 `.gitignore`。日志可能包含命令和路径，不公开上传。

## 5. 中断后继续同一迭代

只有同一迭代的上下文仍有效时使用：

```powershell
codex exec resume --last `
  "继续当前迭代。先读取磁盘和 iterations/state.json，确认未完成验收；不要开始后续迭代。"
```

不同迭代启动新 run，让 Codex 重新加载最新 `AGENTS.md` 和入口文档。不要用 resume 跨越人工门禁。

## 6. 审核一次运行

Codex 报告后人工检查：

1. `iterations/state.json` 是否只改变当前迭代及其合法状态转换。
2. `git diff --stat` 与 `git diff` 是否出现后续功能、跳过测试或依赖漂移。
3. 聚焦测试和完整门禁是否真的运行，并覆盖该迭代 `03-test-cases.md` 的 `TC-*` 参数矩阵。
4. 是否存在 `.skip`、`.only`、`@ts-ignore`、`any`、假按钮、临时安全放宽。
5. 对人工门禁按关联的 `MAN-*` 执行并保存证据，尤其 IME、外部修改、恢复、打印和安装。

通过后可明确要求 Codex 提交；未经明确请求不提交或推送。

## 7. 失败处理

- 测试失败：保持迭代 `in_progress` 或 `failed`，下次仍处理同一迭代。
- 规格冲突：停止编码，新增或更新 ADR 和迭代文档，等待确认。
- 网络/权限失败：只为具体命令申请最小审批，不修改安全配置绕过。
- 数据不变量失败：新增回归 fixture，冻结所有迭代进展直到修复。
- 实现范围过大：恢复或拆出无关改动，但不要使用破坏用户工作的 Git 命令。

## 8. 人工门禁

状态为 `awaiting_manual` 时，Codex 不得自己改成 `passed`。用户完成步骤后运行：

```powershell
codex exec --sandbox workspace-write `
  "我已按 M1 的 03-test-cases.md 完成全部人工验收且结果通过。记录人工证据和 05-exit-report.md，将 M1 设为 passed，然后停止。"
```

如果失败，描述复现步骤，让 Codex 将状态改为 `failed` 并在同一迭代修复。

## 9. 禁止的运行方式

- “完成整个 Typora 替代品，自己一直做完”为单条请求。
- 默认 `danger-full-access`、关闭审批、跳过 Git 仓库检查。
- 并发运行会修改同一工作树或 `iterations/state.json` 的多个 Codex。
- 要求 Codex 自己做 IME 手感、打印机、安装器和真实日用的最终验收。
- 在测试失败时让 Codex先实施后续迭代。

## 10. 推荐节奏

- 每个迭代：实施和聚焦测试、完整退出门禁、必要的人工验收。
- 每个迭代退出：审阅架构漂移、完整证据和下一迭代的入口完整性。
- M1/M2 期间保持短反馈周期；编辑器底层问题越早暴露，返工越小。

## 11. 官方参考

- `AGENTS.md`：https://developers.openai.com/codex/guides/agents-md
- `codex exec`、sandbox、JSONL、resume：https://developers.openai.com/codex/noninteractive
- CLI flags：https://developers.openai.com/codex/cli/reference
