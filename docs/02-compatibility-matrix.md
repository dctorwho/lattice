# Typora 1.13.8 Windows 复刻验收矩阵

状态值：`planned`、`in_progress`、`awaiting_manual`、`passed`、`evidence_gap`。完整明细由证据基线和测试用例共同展开，本表用于证明没有复刻能力类别被遗漏。

| ID       | 能力                       | 需求            | 迭代  | 公开证据         | 核心验收                   | 状态         |
| -------- | -------------------------- | --------------- | ----- | ---------------- | -------------------------- | ------------ |
| COMP-001 | 新建/打开/保存/另存        | DOC-001..005    | M1    | REF-001          | DATA-001..012              | passed       |
| COMP-002 | 编码、BOM、换行无损        | DOC-003,009     | M1    | REF-002          | DATA-013..025              | passed       |
| COMP-003 | 外部修改与恢复             | DOC-006..008    | M1    | REF-003          | DATA-026..040              | passed       |
| COMP-004 | 源码模式                   | EDT-002,003     | M1    | REF-004          | EDIT-001..010              | passed       |
| COMP-005 | 混合实时预览               | EDT-001,003,004 | M2    | REF-006          | EDIT-011..040              | planned      |
| COMP-006 | 撤销、IME、选择            | EDT-005,006     | M2    | REF-007          | EDIT-041..070              | planned      |
| COMP-007 | 基础 Markdown              | MD-001,002,012  | M2    | REF-008          | MD-001..045                | planned      |
| COMP-008 | 输入规则和自动配对         | EDT-007,008     | M2    | REF-009          | EDIT-071..095              | planned      |
| COMP-009 | 查找替换                   | EDT-009         | M2    | REF-010          | EDIT-096..110              | planned      |
| COMP-010 | 窗口、菜单、工具栏、状态栏 | UI-001,002      | M3    | REF-011          | UI-001..030                | planned      |
| COMP-011 | 文件树和文章列表           | WS-001..003,007 | M3    | REF-011          | WS-001..035                | planned      |
| COMP-012 | 大纲                       | WS-004          | M3    | REF-011          | WS-036..050                | planned      |
| COMP-013 | 快速打开和全局搜索         | WS-005,006      | M3    | REF-011          | WS-051..075                | planned      |
| COMP-014 | 表格可视化编辑             | MD-004          | M4    | REF-012          | MD-046..080                | planned      |
| COMP-015 | YAML、TOC、Alerts          | MD-006,007      | M4    | REF-013          | MD-081..105                | planned      |
| COMP-016 | 脚注、引用和内部链接       | MD-005          | M4    | REF-013          | MD-106..130                | planned      |
| COMP-017 | 代码块                     | MD-008          | M4    | REF-014          | MD-131..150                | planned      |
| COMP-018 | MathJax 公式               | MD-009          | M4    | REF-015          | MD-151..185                | planned      |
| COMP-019 | Mermaid/图表               | MD-010          | M4    | REF-016          | MD-186..220                | planned      |
| COMP-020 | HTML/视频/嵌入             | MD-011          | M4    | REF-017          | SEC-001..020               | planned      |
| COMP-021 | 智能复制粘贴               | EDT-010         | M5    | REF-018          | CLIP-001..035              | planned      |
| COMP-022 | 图片路径和管理             | IMG-001..006    | M5    | REF-019          | IMG-001..060               | planned      |
| COMP-023 | 焦点/打字机/拼写           | EDT-011,012     | M5    | REF-020          | EDIT-111..135              | planned      |
| COMP-024 | 主题和外观                 | UI-003,004      | M5    | REF-021          | THEME-001..030             | evidence_gap |
| COMP-025 | HTML/纯 HTML               | EXP-001,002     | M6    | REF-022          | EXP-001..025               | planned      |
| COMP-026 | PDF/打印                   | EXP-003,008     | M6    | REF-022          | EXP-026..060               | planned      |
| COMP-027 | 图片导出                   | EXP-004         | M6    | REF-022          | EXP-061..075               | planned      |
| COMP-028 | Pandoc 导入导出            | EXP-005,007,009 | M6    | REF-023          | EXP-076..115、IMP-001..030 | planned      |
| COMP-029 | 导出记忆                   | EXP-006         | M6    | REF-022          | EXP-116..130               | planned      |
| COMP-030 | 设置和快捷键               | UI-005,006      | M7    | REF-024          | PREF-001..050              | planned      |
| COMP-031 | 国际化和无障碍             | UI-007,008      | M7    | REF-025          | A11Y-001..035              | evidence_gap |
| COMP-032 | 最近文件和窗口恢复         | WS-008,OS-004   | M7    | REF-026          | OS-001..020                | planned      |
| COMP-033 | 文件关联和命令行           | OS-001..003     | M8    | REF-027          | OS-021..050                | planned      |
| COMP-034 | 安装卸载                   | OS-005          | M8    | REF-028          | REL-001..025               | planned      |
| COMP-035 | 自动更新                   | OS-006          | M8    | REF-029          | REL-026..040               | evidence_gap |
| COMP-036 | 字数、选区统计与状态栏     | EDT-013、UI-001 | M1/M7 | REF-005、REF-030 | EDIT-181..195              | passed       |

## 差异管理

可执行测试规格位于各迭代的 `03-test-cases.md`：M1 对应 `TC-M1-*`，M2 对应 `TC-M2-*`，依此类推；M0 负责测试基础设施。表中 `DATA-*` 等“核心验收”是复刻数据集范围，由对应 `TC-*` 的参数矩阵展开，不是缺少步骤的独立用例。

- 每个差异必须记录：来源、复现输入、预期、实际、是否影响 Markdown 文件、决策和测试。
- 没有合法运行中的 Typora 对照实例时，使用[版本化公开证据基线](22-typora-1.13.8-windows-evidence-baseline.md)并记录可信度；资料不足标记为 `evidence_gap`，不能声称通过。
- `evidence_gap` 只能描述暂时的证据风险，不能替代已经确认的复刻行为，也不能让 M8 带已知差异通过。
- 每个 `COMP-*` 必须至少关联一条 `REF-*`、一个所属迭代和可执行 `TC-*`/`MAN-*` 证据。
- 不允许为了让矩阵变绿而缩小需求、删除夹具或把失败测试改成快照。
