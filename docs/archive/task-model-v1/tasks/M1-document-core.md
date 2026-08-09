# M1：无损文件与源码编辑

必读：[架构](../docs/03-architecture.md)、[数据安全](../docs/05-data-safety-and-security.md)、[公共契约](../docs/15-public-contracts.md)、[存储 schema](../docs/17-settings-and-storage-schema.md)、[错误目录](../docs/18-error-catalog.md)、[测试](../docs/09-test-strategy.md)、[M1 测试用例](../docs/test-cases/M1-document-core.md)。

## M1-T01 SourceBuffer、编码与 EOL

- 依赖：M0-T06
- 需求：DOC-003、DOC-009；风险 R-003
- 交付：纯领域 `SourceBuffer`，UTF-8/BOM/UTF-16 BOM 解码编码、严格未知编码错误、每行 EOL 索引、原始字节快路和 fixture 元数据。
- 验证：DATA-001..025；fast-check round-trip；未编辑 fixture 重新编码哈希相同；`pnpm check`。

## M1-T02 授权打开文件

- 依赖：M1-T01
- 需求：DOC-002、DOC-009
- 交付：原生选择器、路径授权、stat/hash、打开 IPC、只读未知编码流程；取消不产生错误和空会话。
- 验证：DATA-026..032、SEC 路径遍历/符号链接/任意 renderer 路径；真实临时目录集成测试。

## M1-T03 原子保存与外部冲突

- 依赖：M1-T02
- 需求：DOC-003..006；风险 R-006
- 交付：同目录临时文件、fsync、替换/备份、故障点清理、expected DiskVersion、冲突结果和另存为。
- 验证：DATA-033..055，注入每个写入故障；旧文件或完整新文件始终存在；外部修改不被静默覆盖。

## M1-T04 DocumentSession 与 dirty 模型

- 依赖：M1-T03
- 需求：DOC-001、DOC-005、EDT-005
- 交付：session/revision/savedRevision、source changes、path 切换、关闭决策、纯领域测试；React 不持有全文。
- 验证：DATA-056..070、随机 change/undo 性质；撤销到保存 revision 清除 dirty。

## M1-T05 崩溃恢复

- 依赖：M1-T04
- 需求：DOC-007、DOC-008
- 交付：版本化恢复 schema、节流原子快照、上一版本轮转、启动扫描、恢复/丢弃/另存流程和清理策略。
- 验证：DATA-071..095，强杀、坏最后快照、多会话、正常保存清理；日志无正文。

## M1-T06 CodeMirror 源码编辑器

- 依赖：M1-T04
- 需求：EDT-002、EDT-003、EDT-005
- 交付：CodeMirror 6、Markdown 高亮、transaction 到 session、selection/history 生命周期、自动换行、行号；切换文件不通过 React 重建全文。
- 验证：EDIT-001..018，输入/undo/redo/切换/长行/Unicode；组件卸载无丢失 transaction。

## M1-T07 文档命令和关闭流程

- 依赖：M1-T05、M1-T06
- 需求：DOC-001..008、UI-002
- 交付：新建、打开、保存、另存、关闭、恢复命令；原生菜单/顶部按钮/快捷键共用 registry；完整脏文档对话框。
- 验证：DATA-096..110、UI-001..010 E2E；取消操作保持窗口和会话不变。

## M1-T08 外部 watcher 与自动保存

- 依赖：M1-T07
- 需求：DOC-006、DOC-007；风险 R-007
- 交付：watcher 适配、事件去重、clean 自动重载策略、dirty 冲突 UI、自动保存节流和暂停。
- 验证：DATA-111..135，模拟自身保存、外部写/删/重命名、OneDrive 式事件风暴；无误覆盖。

## M1-T09 查找替换和状态栏

- 依赖：M1-T06、M1-T07
- 需求：EDT-009、EDT-013、UI-001；兼容：COMP-036
- 交付：查找/替换/正则/全部替换，状态栏行列、全文/选区字数、字符、行、阅读时间、编码、EOL、dirty、缩放；替换为单一可撤销事务组。
- 验证：EDIT-019..035、UI-011..020，零宽正则、Unicode、跨行、取消和 undo。

## M1-T10 数据安全与源码编辑门禁

- 依赖：M1-T08、M1-T09
- 需求：COMP-001..004、NFR-001
- 交付：M1 报告、全部字节 fixture、性能基线、已知限制；修复所有 P0/P1。
- 自动验证：全量 check、integration、E2E、security、1/5/10MB performance。
- 人工门禁：微软拼音连续 30 分钟、LF/CRLF/BOM、外部冲突、强杀恢复、关闭三选项。Codex 设 `awaiting_manual` 后停止；用户通过才解锁 M2-T01。
