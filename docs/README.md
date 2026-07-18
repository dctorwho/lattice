# 工程文档索引

这些文档共同构成实现规范。发生冲突时，优先级为：数据安全与安全边界、架构决策、产品需求、界面细节、任务描述。

| 文档 | 用途 |
| --- | --- |
| [00-product-charter.md](00-product-charter.md) | 产品目标、范围、成功标准和法律边界 |
| [01-product-requirements.md](01-product-requirements.md) | 完整功能需求和非功能需求 |
| [02-compatibility-matrix.md](02-compatibility-matrix.md) | Typora 1.13.8 能力到里程碑和测试的映射 |
| [03-architecture.md](03-architecture.md) | 进程、模块、数据流和核心接口 |
| [04-technology-stack.md](04-technology-stack.md) | 技术栈、依赖策略和替代方案 |
| [05-data-safety-and-security.md](05-data-safety-and-security.md) | 无损保存、恢复、外部冲突和 Electron 安全 |
| [06-ui-interaction-spec.md](06-ui-interaction-spec.md) | 窗口布局、菜单、工具栏和编辑交互 |
| [07-iteration-roadmap.md](07-iteration-roadmap.md) | M0–M8 里程碑、入口与退出门禁 |
| [08-development-plan.md](08-development-plan.md) | 分支、提交、评审、依赖和实施方式 |
| [09-test-strategy.md](09-test-strategy.md) | 测试分层、夹具、性能与验收设计 |
| [10-release-quality-gates.md](10-release-quality-gates.md) | 发布等级和阻断条件 |
| [11-codex-cli-runbook.md](11-codex-cli-runbook.md) | Codex CLI 的逐任务执行手册 |
| [12-risk-register.md](12-risk-register.md) | 技术、产品、安全和法律风险 |
| [13-source-baseline.md](13-source-baseline.md) | 规范所依据的官方资料与版本日期 |
| [14-planning-acceptance.md](14-planning-acceptance.md) | 文档包完整性与开发启动验收 |
| [15-public-contracts.md](15-public-contracts.md) | 跨进程、文档补丁、命令、导出和资源事务契约 |
| [16-project-structure-and-standards.md](16-project-structure-and-standards.md) | 目录、依赖方向、命名与编码规则 |
| [17-settings-and-storage-schema.md](17-settings-and-storage-schema.md) | 设置默认值、应用数据布局与迁移 |
| [18-error-catalog.md](18-error-catalog.md) | 稳定错误码、重试和用户处理 |
| [19-user-journeys.md](19-user-journeys.md) | 端到端用户旅程和人工验收 |
| [20-markdown-compatibility-profile.md](20-markdown-compatibility-profile.md) | Markdown 扩展默认值和源码保留语义 |
| [21-command-menu-inventory.md](21-command-menu-inventory.md) | 菜单、固定按钮、右键和块上下文命令清单 |
| [test-cases/README.md](test-cases/README.md) | M0–M8 可执行测试用例、参数矩阵、人工门禁与证据规则 |

任务规格位于 [`tasks/`](../tasks/README.md)。任何实现任务都必须引用需求 ID、架构约束和测试 ID。
