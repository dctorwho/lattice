# 兼容矩阵

状态值：`planned`、`in_progress`、`awaiting_manual`、`passed`、`documented_gap`。完整明细由测试用例展开，本表用于证明没有功能类别被遗漏。

| ID       | 能力                       | 需求            | 里程碑    | 核心验收                   | 状态    |
| -------- | -------------------------- | --------------- | --------- | -------------------------- | ------- |
| COMP-001 | 新建/打开/保存/另存        | DOC-001..005    | M1        | DATA-001..012              | planned |
| COMP-002 | 编码、BOM、换行无损        | DOC-003,009     | M1        | DATA-013..025              | planned |
| COMP-003 | 外部修改与恢复             | DOC-006..008    | M1        | DATA-026..040              | planned |
| COMP-004 | 源码模式                   | EDT-002,003     | M1        | EDIT-001..010              | planned |
| COMP-005 | 混合实时预览               | EDT-001,003,004 | M2        | EDIT-011..040              | planned |
| COMP-006 | 撤销、IME、选择            | EDT-005,006     | M2        | EDIT-041..070              | planned |
| COMP-007 | 基础 Markdown              | MD-001,002,012  | M2        | MD-001..045                | planned |
| COMP-008 | 输入规则和自动配对         | EDT-007,008     | M2        | EDIT-071..095              | planned |
| COMP-009 | 查找替换                   | EDT-009         | M2        | EDIT-096..110              | planned |
| COMP-010 | 窗口、菜单、工具栏、状态栏 | UI-001,002      | M3        | UI-001..030                | planned |
| COMP-011 | 文件树和文章列表           | WS-001..003,007 | M3        | WS-001..035                | planned |
| COMP-012 | 大纲                       | WS-004          | M3        | WS-036..050                | planned |
| COMP-013 | 快速打开和全局搜索         | WS-005,006      | M3        | WS-051..075                | planned |
| COMP-014 | 表格可视化编辑             | MD-004          | M4        | MD-046..080                | planned |
| COMP-015 | YAML、TOC、Alerts          | MD-006,007      | M4        | MD-081..105                | planned |
| COMP-016 | 脚注、引用和内部链接       | MD-005          | M4        | MD-106..130                | planned |
| COMP-017 | 代码块                     | MD-008          | M4        | MD-131..150                | planned |
| COMP-018 | MathJax 公式               | MD-009          | M4        | MD-151..185                | planned |
| COMP-019 | Mermaid/图表               | MD-010          | M4        | MD-186..220                | planned |
| COMP-020 | HTML/视频/嵌入             | MD-011          | M4        | SEC-001..020               | planned |
| COMP-021 | 智能复制粘贴               | EDT-010         | M5        | CLIP-001..035              | planned |
| COMP-022 | 图片路径和管理             | IMG-001..006    | M5        | IMG-001..060               | planned |
| COMP-023 | 焦点/打字机/拼写           | EDT-011,012     | M5        | EDIT-111..135              | planned |
| COMP-024 | 主题和外观                 | UI-003,004      | M5        | THEME-001..030             | planned |
| COMP-025 | HTML/纯 HTML               | EXP-001,002     | M6        | EXP-001..025               | planned |
| COMP-026 | PDF/打印                   | EXP-003,008     | M6        | EXP-026..060               | planned |
| COMP-027 | 图片导出                   | EXP-004         | M6        | EXP-061..075               | planned |
| COMP-028 | Pandoc 导入导出            | EXP-005,007,009 | M6        | EXP-076..115、IMP-001..030 | planned |
| COMP-029 | 导出记忆                   | EXP-006         | M6        | EXP-116..130               | planned |
| COMP-030 | 设置和快捷键               | UI-005,006      | M7        | PREF-001..050              | planned |
| COMP-031 | 国际化和无障碍             | UI-007,008      | M7        | A11Y-001..035              | planned |
| COMP-032 | 最近文件和窗口恢复         | WS-008,OS-004   | M7        | OS-001..020                | planned |
| COMP-033 | 文件关联和命令行           | OS-001..003     | M8        | OS-021..050                | planned |
| COMP-034 | 安装卸载                   | OS-005          | M8        | REL-001..025               | planned |
| COMP-035 | 自动更新                   | OS-006          | M8/发布后 | REL-026..040               | planned |
| COMP-036 | 字数、选区统计与状态栏     | EDT-013、UI-001 | M1/M7     | EDIT-181..195              | planned |

## 差异管理

可执行测试规格按里程碑位于 `docs/test-cases/`：M1 对应 `TC-M1-*`，M2 对应 `TC-M2-*`，依此类推；M0 负责测试基础设施。表中 `DATA-*` 等“核心验收”是兼容数据集范围，由对应 `TC-*` 的参数矩阵展开，不是缺少步骤的独立用例。

- 每个差异必须记录：来源、复现输入、预期、实际、是否影响 Markdown 文件、决策和测试。
- 没有合法运行中的 Typora 对照实例时，只能以官方文档和公开示例为准；这类细节标记 `documented_gap`。
- 不允许为了让矩阵变绿而缩小需求、删除夹具或把失败测试改成快照。
