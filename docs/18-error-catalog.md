# 错误目录与用户处理

错误 code 是稳定契约，文案可本地化。新增 code 必须指定用户动作、日志内容和重试语义。

## 1. 文件与文档

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| FILE_NOT_FOUND | 打开/保存目标不存在 | 重新选择、从最近项移除或另存 |
| FILE_PERMISSION_DENIED | 权限不足/只读 | 另存、调整权限，不建议管理员运行 |
| FILE_UNSUPPORTED_ENCODING | 无法安全解码 | 只读查看、显式选择编码或取消 |
| FILE_CHANGED_EXTERNALLY | 磁盘版本变化 | 比较、重载、保留本地另存、确认覆盖 |
| FILE_DELETED_EXTERNALLY | 文件被删除 | 重新创建或另存 |
| FILE_ATOMIC_SAVE_FAILED | 临时写/替换失败 | 保留原文件，显示临时/备份是否存在和另存 |
| FILE_PATH_TOO_LONG | 平台路径限制 | 选择短路径/移动工作区 |
| DOCUMENT_STALE_PATCH | widget 基于旧 revision | 重新解析并保留用户输入，不显示普通错误弹窗 |
| DOCUMENT_READ_ONLY | 尝试修改只读会话 | 解释原因并提供另存 |

## 2. 恢复与设置

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| RECOVERY_WRITE_FAILED | 快照写入失败 | 持续显示警告，建议立即另存 |
| RECOVERY_CORRUPT | 最新快照校验失败 | 尝试上一快照，提供隔离文件路径 |
| SETTINGS_INVALID | schema/值非法 | 使用安全默认、保留坏文件、打开目录 |
| SETTINGS_MIGRATION_FAILED | 迁移失败 | 恢复备份或使用默认，不覆盖原设置 |

## 3. 工作区与资源

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| WORKSPACE_SCOPE_DENIED | 路径超出授权根 | 重新选择工作区或取消 |
| WORKSPACE_MUTATION_CONFLICT | 文件操作前状态变化 | 刷新树并重试 |
| SEARCH_INVALID_PATTERN | 正则错误 | 高亮具体位置并允许修改 |
| SEARCH_CANCELLED | 用户取消 | 静默结束，不弹错误 |
| SEARCH_PROCESS_FAILED | ripgrep 启动/退出异常 | 显示诊断、回退当前文档搜索 |
| RESOURCE_TRANSACTION_FAILED | 图片文件与源码事务失败 | 显示已完成/回滚操作和修复步骤 |
| UPLOADER_NOT_CONFIGURED | 未配置上传器 | 打开图片设置 |
| UPLOADER_FAILED | 命令失败/输出非法 | 保留本地图片，不修改 Markdown |

## 4. 渲染与安全

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| MARKDOWN_RENDER_FAILED | 语法组件异常 | 回退源码显示 |
| MATH_RENDER_FAILED | TeX 错误 | 显示行列/简短诊断，保留源码 |
| DIAGRAM_RENDER_TIMEOUT | 图表超时 | 显示源码、重试或禁用图表 |
| CONTENT_BLOCKED | HTML/URL 被安全规则阻断 | 说明类型，不提供绕过 sandbox 按钮 |
| IPC_INVALID_REQUEST | 参数/schema 错误 | 普通用户显示内部错误 ID，日志记录安全细节 |
| IPC_UNAUTHORIZED_SENDER | sender/window 不符 | 拒绝并记录安全事件 |

## 5. 导出

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| EXPORT_CANCELLED | 用户取消 | 清理临时文件，静默结束 |
| EXPORT_TARGET_EXISTS | 目标存在 | 确认覆盖或换路径 |
| EXPORT_RESOURCE_MISSING | 图片/字体等缺失 | 列出有限相对资源，继续/取消策略 |
| EXPORT_RENDER_TIMEOUT | 公式/图表/字体未稳定 | 重试、禁用问题特性或导出源码 HTML |
| EXPORT_WRITE_FAILED | 目标写入失败 | 保留编辑会话，换路径 |
| PANDOC_NOT_FOUND | 未安装/路径失效 | 选择可执行文件或查看安装说明 |
| PANDOC_UNSUPPORTED_VERSION | 版本超出测试范围 | 继续基础模式或安装支持版本 |
| PANDOC_FAILED | 非零退出 | 显示裁剪且脱敏的 stderr 和参数摘要 |

## 6. 导入

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| IMPORT_UNSUPPORTED_FORMAT | 文件类型不在公开导入范围 | 保持源文件不变，说明支持格式 |
| IMPORT_CANCELLED | 用户取消或终止转换 | 清理临时输出，不创建会话 |
| IMPORT_OUTPUT_INVALID | Pandoc 输出编码、路径、大小或资源清单非法 | 隔离输出，显示脱敏诊断，不创建部分会话 |
| IMPORT_FAILED | Pandoc 非零退出或 staging 提交失败 | 保留源文件，允许重试或查看裁剪后的警告 |

## 7. 桌面与发布

| Code | 场景 | 用户处理 |
| --- | --- | --- |
| APP_VERSION_MISMATCH | main/preload/renderer 契约不一致 | 重启或重新安装 |
| UPDATE_DISABLED | 自用/未签名构建 | 不显示错误，只隐藏更新入口 |
| UPDATE_SIGNATURE_INVALID | 更新签名错误 | 拒绝安装并提示安全警告 |
| UPDATE_FAILED | 下载/安装失败 | 保持当前版本，稍后重试 |
| INTERNAL_UNEXPECTED | 未知异常 | 提供 request ID、保存/恢复建议和打开日志 |

## 8. 呈现规则

- 取消和 stale patch 通常不弹阻断对话框。
- 数据风险使用持久 banner/对话框，直到用户完成安全动作。
- 同一根因短时间合并，不能弹窗风暴。
- 文案回答“发生什么、文档是否安全、可做什么”，不展示堆栈和完整路径。
- retryable 只在操作幂等或有 token/版本保护时为 true。
- `INTERNAL_UNEXPECTED` 不能吞掉原始异常；日志保留 request ID 和脱敏堆栈。
