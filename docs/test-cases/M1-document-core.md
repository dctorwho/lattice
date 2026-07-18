# M1 测试用例：无损文件与源码编辑

目标：证明文件打开/保存/冲突/恢复不会损坏数据，源码编辑、撤销、查找替换和状态栏可长期使用。

## 自动化与半自动用例

| ID | 任务 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-M1-001 | M1-T01 | unit-property/P0 | BYTE-M1 | 解码后不编辑再编码；对文本/EOL 随机往返；比较元数据和 SHA-256 | 受支持文件字节完全相同；非法编码只读报错；新行按相邻/主导 EOL | `pnpm test -- tests/unit/domain/source-buffer.property.spec.ts` |
| TC-M1-002 | M1-T02 | integration-security/P0 | PATH-M1 | 通过选择器打开合法文件，再伪造未授权、遍历、symlink 和取消请求 | 仅授权路径成功；取消不建会话；越权不读取字节；未知编码不允许覆盖 | `pnpm test:integration -- tests/integration/open-file.spec.ts` |
| TC-M1-003 | M1-T03 | integration/P0 | FI-SAVE × BYTE-M1 | 修改一个范围，在每个保存阶段注入失败并检查目标、临时、备份和会话状态 | 只存在完整旧文件或完整新文件；未触及字节不变；失败保持 dirty；冲突不静默覆盖 | `pnpm test:integration -- tests/integration/atomic-save.spec.ts` |
| TC-M1-004 | M1-T04 | unit-property/P0 | CHANGE-M1 | 随机 apply/undo/redo/save/path-change/close-decision 序列 | revision 单调；撤销到 savedRevision 清 dirty；undo 恢复完全相同 SourceBuffer | `pnpm test -- tests/unit/domain/document-session.property.spec.ts` |
| TC-M1-005 | M1-T05 | integration/P0 | FI-RECOVERY × REC-M1 | 写多版快照，强杀；损坏最后一版；并存多个会话；重启恢复/丢弃/另存 | 恢复最新有效 revision，坏版回退；未确认项不被清理；日志不含正文 | `pnpm test:integration -- tests/integration/recovery.spec.ts` |
| TC-M1-006 | M1-T06 | component-e2e/P1 | EDIT-M1 | 输入 Unicode/长行/多行，撤销重做，切文件，卸载并重建编辑视图 | transaction 不丢；选择和历史按会话隔离；React 不持有全文副本 | `pnpm test:e2e -- tests/e2e/source-editor.spec.ts` |
| TC-M1-007 | M1-T07 | e2e/P0 | DOCFLOW-M1 | 从菜单/按钮/快捷键执行新建、打开、保存、另存和关闭；逐个选择保存/不保存/取消 | 入口一致；取消不改窗口/会话；另存后只修改新路径；脏文档不会静默关闭 | `pnpm test:e2e -- tests/e2e/document-commands.spec.ts` |
| TC-M1-008 | M1-T08 | integration/P0 | WATCH-M1 | 模拟自身保存、外部改/删/重命名和事件风暴，分别在 clean/dirty/自动保存状态执行 | 自身事件去重；clean 按策略重载；dirty 停止自动保存并保留两份内容 | `pnpm test:integration -- tests/integration/file-watcher.spec.ts` |
| TC-M1-009 | M1-T09 | unit-e2e/P1 | FIND-M1 | 查找/替换普通、大小写、全词、零宽、Unicode、跨行和非法正则；撤销全部替换 | 计数/选区正确；全部替换是单一撤销组；错误不改源码；状态栏中英文统计稳定 | `pnpm test:e2e -- tests/e2e/find-status.spec.ts` |
| TC-M1-010 | M1-T10 | regression-performance/P0 | GATE-M1 | 运行完整 DATA/EDIT/SEC 回归及 1/5/10MB 打开、输入、保存基准 | 数据不变量全通过；5MB 达预算；10MB 可降级编辑；无 P0/P1 | `pnpm test:performance -- tests/performance/m1-gate.spec.ts` |
| TC-M1-011 | M1-T03 | property/P0 | MINPATCH-M1 | 对每个编码/EOL 文件随机选择一个字符范围修改并保存，二进制 diff | diff 只覆盖编码后目标范围和必要 EOL 索引；BOM、尾换行、其他行不变 | `pnpm test -- tests/unit/domain/minimal-save.property.spec.ts` |
| TC-M1-012 | M1-T08 | e2e/P0 | CONFLICT-M1 | 脏文档遇外部变化后依次选择比较、重载、本地另存、确认覆盖 | 每个选择前两份内容可恢复；覆盖有二次确认；取消维持冲突状态 | `pnpm test:e2e -- tests/e2e/external-conflict.spec.ts` |

## 参数矩阵

- `BYTE-M1`：empty；UTF-8/UTF-8 BOM/UTF-16LE/BE BOM；LF/CRLF/混合 EOL；有/无尾换行；ASCII/中文/Emoji/组合字符/NUL；非法 UTF-8。
- `PATH-M1`：普通、空格、中文、`#`、长路径、只读、占用、工作区内外、`..`、junction/symlink、UNC；选择器取消。
- `CHANGE-M1`：插入、删除、替换、跨行、首尾、换行合并/拆分；固定 100 种子，门禁 10,000 组。
- `REC-M1`：未命名/已命名、clean/dirty、单/多窗口、最后快照截断/校验错/schema 新旧版、30 天边界。
- `WATCH-M1`：write/delete/rename、mtime 不变但 hash 变、同 hash 事件、OneDrive 式 create-change-rename 风暴、事件乱序。
- `FIND-M1`：空模式、中文、Emoji、组合字符、CRLF 文档、零宽 `^/$`、捕获组、非法正则、只读模式。
- `GATE-M1`：1/5/10MB；参考机记录冷/热打开、首帧、输入 P50/P95、保存和峰值内存。

## 人工门禁

| ID | 任务 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M1-001 | M1-T10 | ENV-IME、Windows 11 | 1. 微软拼音连续输入 30 分钟；2. 编辑 LF/CRLF/BOM 样本并核对哈希；3. 外部编辑制造冲突并走四种选择；4. 强杀后恢复；5. 关闭脏文档分别选保存/不保存/取消 | 无重复/丢字；未编辑和未触及字节不变；两份冲突内容可恢复；恢复 revision 正确；关闭选择无误 | 输入法版本、样本前后哈希、恢复/冲突截图和签署结果 |

## 证据与停止条件

保存每个 BYTE/FI 参数的前后哈希、二进制 diff、会话状态和磁盘目录清单。发现静默覆盖、截断、编码/EOL 漂移、恢复虚假成功或 undo 不一致时立即停止后续里程碑，夹具化并修复根因。
