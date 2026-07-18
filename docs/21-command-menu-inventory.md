# 命令、菜单、按钮与上下文清单

本清单以 Typora 1.13.8 官方公开工作流为基线，固定信息架构而非像素和素材。无法从官方资料确认的平台细节标为 documented gap，在 M7 核对。

## 1. 固定标题栏按钮

| 位置 | Command | 可见/启用 |
| --- | --- | --- |
| 左 | `view.toggleSidebar` | 始终可见；无工作区时仍可打开大纲占位状态 |
| 左 | `workspace.quickOpen` | 有工作区启用 |
| 中 | 文档标题/dirty | 非按钮；点击可显示完整路径和重命名入口 |
| 右 | `view.sourceMode` | 有活动文档启用并显示 checked |
| 右 | `file.export` | 已保存或可生成快照的文档启用 |
| 右 | `app.more` | 打开紧凑菜单 |
| 最右 | 最小化/最大化/关闭 | Windows 系统语义，不受文档主题影响 |

不放置固定粗体/斜体 Ribbon；格式化通过菜单、快捷键、选择浮层和右键实现。

## 2. 文件菜单

1. 新建 `file.new`
2. 新建窗口 `window.new`
3. 打开文件 `file.open`
4. 快速打开 `workspace.quickOpen`
5. 打开文件夹 `file.openFolder`
6. 导入子菜单 `file.import`：DOCX、RTF、EPUB、LaTeX/TeX、RST、Org、MediaWiki/DokuWiki、Textile、OPML；Pandoc 缺失时显示安装/配置诊断
7. 打开最近文件/文件夹子菜单 `file.openRecent.*`，含清空
8. 保存 `file.save`
9. 另存为 `file.saveAs`
10. 重新载入磁盘版本 `file.reload`
11. 导出子菜单：HTML、无样式 HTML、PDF、图片、Pandoc 格式、使用上次设置、覆盖上次目标
12. 打印 `file.print`
13. 偏好设置 `app.preferences`
14. 关闭 `file.close`
15. 退出 `app.quit`

保存/另存/重载根据 dirty、路径、只读和冲突状态启用；取消对话框不改变状态。

## 3. 编辑菜单

1. 撤销/重做 `edit.undo/redo`
2. 剪切/复制/粘贴 `edit.cut/copy/paste`
3. 复制为 Markdown/HTML/纯文本 `edit.copyMarkdown/copyHtml/copyPlain`
4. 粘贴为纯文本 `edit.pastePlain`
5. 全选 `edit.selectAll`
6. 查找、查找下一个/上一个 `edit.find/findNext/findPrevious`
7. 替换 `edit.replace`
8. 目录全局搜索 `workspace.globalSearch`
9. 行/段上移下移 `edit.moveBlockUp/moveBlockDown`
10. 删除当前块 `edit.deleteBlock`

剪贴板相关命令在只读模式按是否修改区分；无选区行级 copy/cut 遵守 EDT-014 设置。

## 4. 段落菜单

1. 普通段落、标题 1–6 `paragraph.paragraph/heading1..6`
2. 提升/降低标题级别 `paragraph.increaseHeading/decreaseHeading`
3. 引用 `paragraph.quote`
4. 无序/有序/任务列表 `paragraph.unorderedList/orderedList/taskList`
5. 增加/减少缩进 `paragraph.indent/outdent`
6. 代码块 `paragraph.codeBlock`
7. 数学块 `paragraph.mathBlock`
8. 表格 `paragraph.table`
9. YAML Front Matter `paragraph.yaml`
10. TOC `paragraph.toc`
11. 分隔线 `paragraph.horizontalRule`
12. Alert/Callout 子菜单 `paragraph.alert.*`

命令对多选块执行时先验证可转换范围；不支持的混合选择保持原文并解释。

## 5. 格式菜单

1. 加粗、斜体、下划线 `format.strong/emphasis/underline`
2. 行内代码、删除线、高亮 `format.code/strike/highlight`
3. 上标/下标 `format.superscript/subscript`
4. 链接、图片 `format.link/image`
5. 清除格式 `format.clear`

未开启的 Markdown 扩展可以显示在菜单中但标明开关并引导设置；首个实现阶段不得放不可用假项。

## 6. 视图菜单

1. 侧栏 `view.toggleSidebar`
2. 文件树/文章列表/大纲 `view.files/view.fileList/view.outline`
3. 源码模式 `view.sourceMode`
4. 焦点模式/打字机模式/只读 `view.focusMode/typewriterMode/readOnly`
5. 状态栏 `view.statusBar`
6. 放大/缩小/实际大小 `view.zoomIn/zoomOut/actualSize`
7. 全屏 `view.fullScreen`
8. 开发者工具仅开发构建 `dev.toggleTools`

互斥项由 Command Registry checked 状态表达；菜单关闭后状态仍正确。

## 7. 主题和帮助

主题菜单动态列出内置和用户主题，标记当前主题，并提供“打开主题目录”“重新加载主题”。帮助包含快速入门、Markdown 参考、快捷键、打开日志、检查更新（仅签名发布）、反馈/安全报告和关于/许可证。

## 8. 编辑器右键菜单

- 撤销/重做、剪切/复制/粘贴、粘贴纯文本。
- 拼写候选和加入词典（系统提供时）。
- 当前块类型、格式命令、插入链接/图片。
- 复制为 Markdown/HTML/纯文本。
- 打开/复制链接（安全协议）。
- 有选区时字数统计。

菜单根据 selection/read-only/composition 状态生成；composition 期间不执行结构转换。

## 9. 块上下文工具

- **表格**：增删/移动行列、列对齐、复制表格、删除表格。
- **代码块**：语言、复制全部、自动缩进、删除块。
- **公式**：编辑、复制 TeX/MathML/图片、编号设置、删除。
- **图表**：编辑、重新渲染、复制源码/图片、删除。
- **图片**：缩放、打开、复制、复制路径、移动/重命名/删除、上传、重新加载。
- **链接**：打开、编辑、复制地址、移除链接保留文字。

所有磁盘副作用调用 ResourceTransaction，不直接从组件操作文件。

## 10. 设置和命令覆盖验证

M7 自动生成 Command Registry 报告，证明：每个菜单/按钮 ID 存在 handler、每个 handler 至少一个入口或明确内部用途、默认快捷键无未解释冲突、所有 checked/disabled 状态有测试。公开资料缺失的细节进入 documented gap，不复制未知私有行为。
