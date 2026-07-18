# Codex CLI 执行手册

## 1. 使用模型

Codex CLI 不是一次性产品生成器。本仓库把长期目标拆为有状态任务；一次 `codex exec` 只实现一个任务。`AGENTS.md` 保存长期约束，任务文件保存当前工作，`tasks/state.json` 保存进度。

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

确认输出包含本仓库的任务选择、Markdown 唯一真相和停止条件。Codex 官方要求非交互模式位于 Git 仓库；不要用 `--skip-git-repo-check` 绕过正常项目保护。

M0-T01 使用 `AGENTS.md` 和测试策略定义的自举例外：此时尚无 `pnpm check`，只允许以安装、开发窗口 smoke、构建和 lockfile 检查取证；M0-T02 建立质量脚本后再将该检查自动化。不要创建固定成功的占位脚本。

## 3. 执行下一任务

```powershell
codex exec `
  --sandbox workspace-write `
  --ask-for-approval on-request `
  "读取 AGENTS.md、tasks/state.json 和 tasks/README.md。选择第一个 ready 且依赖 passed 的任务，读取其里程碑文件、引用文档和对应 docs/test-cases/Mx-*.md。只实现该任务关联的 TC-*；运行全部验收，更新状态，然后停止。"
```

更推荐明确指定任务，避免并行状态歧义：

```powershell
codex exec `
  --sandbox workspace-write `
  --ask-for-approval on-request `
  "执行 M0-T01。遵守 AGENTS.md，只处理该任务；验证并报告后停止。"
```

依赖下载需要网络时允许 Codex发起审批。不要预先给予全盘写入或无限网络权限。

## 4. 保存机器可读日志

```powershell
New-Item -ItemType Directory -Force .codex-runs | Out-Null
codex exec --json `
  --sandbox workspace-write `
  --ask-for-approval on-request `
  "执行 M1-T03，只完成该任务。" `
  | Tee-Object -FilePath .codex-runs\M1-T03.jsonl
```

`.codex-runs/` 必须加入 `.gitignore`。日志可能包含命令和路径，不公开上传。

## 5. 中断后继续同一任务

只有同一任务的上下文仍有效时使用：

```powershell
codex exec resume --last `
  "继续当前任务。先读取磁盘和 tasks/state.json，确认未完成验收；不要开始后继任务。"
```

不同任务启动新 run，让 Codex 重新加载最新 `AGENTS.md` 和规格。不要用 resume 跨越人工门禁。

## 6. 审核一次运行

Codex 报告后人工检查：

1. `tasks/state.json` 是否只改变当前任务和直接后继。
2. `git diff --stat` 与 `git diff` 是否出现后续功能、跳过测试或依赖漂移。
3. 验收命令是否真的运行，并逐个覆盖任务在 `docs/test-cases/` 中关联的 `TC-*` 参数矩阵。
4. 是否存在 `.skip`、`.only`、`@ts-ignore`、`any`、假按钮、临时安全放宽。
5. 对 `manual_gate:true` 任务按关联的 `MAN-*` 执行并保存证据，尤其 IME、外部修改、恢复、打印和安装。

通过后可明确要求 Codex 提交：

```powershell
codex exec --sandbox workspace-write `
  "复核 M1-T03 已是 passed 且工作树只含该任务改动；创建一个符合 docs/08-development-plan.md 的提交。不要推送。"
```

## 7. 失败处理

- 测试失败：保持任务 `in_progress` 或 `failed`，下次仍执行同一任务。
- 规格冲突：停止编码，新增/更新 ADR 和任务说明，等待确认。
- 网络/权限失败：只为具体命令申请最小审批，不修改安全配置绕过。
- 数据不变量失败：新增回归 fixture，冻结所有功能任务直到修复。
- Codex实现范围过大：恢复或拆出无关改动，但不要使用破坏用户工作的 Git 命令。

## 8. 人工门禁

状态为 `awaiting_manual` 时，Codex 不得自己改成 `passed`。用户完成步骤后运行：

```powershell
codex exec --sandbox workspace-write `
  "我已按任务完成全部人工验收且结果通过。记录证据，将该任务设为 passed，只解锁直接后继，然后停止。"
```

如果失败，描述复现步骤，让 Codex把状态改为 `failed` 并在同一任务修复。

## 9. 禁止的运行方式

- “完成整个 Typora 替代品，自己一直做完”为单条任务。
- 默认 `danger-full-access`、关闭审批、跳过 Git 仓库检查。
- 并发运行会修改同一工作树或 `tasks/state.json` 的多个 Codex。
- 要求 Codex 自己做 IME 手感、打印机、安装器和真实日用的最终验收。
- 在测试失败时让 Codex先实现后续功能。

## 10. 推荐节奏

- 普通任务：一次实现 run，一次必要的修复 run，一次人工验收。
- 每 3–5 个任务：运行全量检查并审阅架构漂移。
- 每个里程碑：新开规格复核任务，确认下一里程碑任务仍符合实际代码后再解锁。
- M1/M2 期间保持短周期；编辑器底层问题越早暴露，返工越小。

## 11. 官方参考

- `AGENTS.md`：https://developers.openai.com/codex/guides/agents-md
- `codex exec`、sandbox、JSONL、resume：https://developers.openai.com/codex/noninteractive
- CLI flags：https://developers.openai.com/codex/cli/reference
