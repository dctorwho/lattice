# 设置与持久化 Schema

## 1. 应用数据目录

使用 Electron `app.getPath('userData')`，逻辑布局：

```text
userData/
├─ settings.json
├─ settings.backup.json
├─ session.json
├─ recent.json
├─ recovery/<document-id>/meta.json + content snapshots
├─ themes/<theme-name>.css + optional assets/
├─ export/templates/
├─ import-staging/<staging-id>/
├─ logs/
└─ cache/              可安全删除的索引和渲染缓存
```

用户 Markdown、图片和工作区内容永不复制到数据库作为权威。卸载默认保留 userData；清理需要显式选择。

`import-staging/` 只保存尚未首次保存的导入会话所提取资源和校验清单，不是文档权威。目录名只能使用主进程生成的 staging ID；成功另存并提交资源、取消或明确关闭后清理，崩溃恢复仍引用的 staging 不得按普通缓存删除。

## 2. 顶层设置

```ts
interface SettingsV1 {
  schemaVersion: 1
  general: GeneralSettings
  appearance: AppearanceSettings
  editor: EditorSettings
  markdown: MarkdownSettings
  files: FileSettings
  images: ImageSettings
  export: ExportSettings
  advanced: AdvancedSettings
}
```

未知字段读取时保留在原对象的 `extensions` 区域或迁移备份中，不能静默销毁未来版本数据。

## 3. 默认设置

### general

- `locale: 'zh-CN'`，可选 `en-US`。
- `startup: 'restore-last-workspace'`。
- `openExternalFile: 'new-window'`。
- `autoUpdate: false`，公开签名发布前不可开启。
- `sendDiagnostics: false`，首版不实现网络发送。

### appearance

- `colorMode: 'system'`。
- `lightTheme: 'lattice-light'`，`darkTheme: 'lattice-dark'`。
- `fontFamily: 'system-ui'`，`fontSizePx: 16`，`lineHeight: 1.6`。
- `contentWidthPx: 860`，`showStatusBar: true`，`showSidebar: true`。
- `zoomFactor: 1`，允许 0.5–3.0。

### editor

- `defaultMode: 'hybrid'`，大文件可自动源码模式。
- `autoSave: false`；启用时间隔默认 2000ms。
- `lineWrap: true`、`showLineNumbersInSource: true`。
- `autoPair: true`、`smartPunctuation: false`、`spellcheck: true`。
- `focusMode: false`、`typewriterMode: false`。
- `tabSize: 4`、`insertSpaces: true`。

### markdown

- `gfm: true`、`tables: true`、`taskLists: true`、`footnotes: true`。
- `math: true`、`mathInlineDollar: true`、`mathBackslashDelimiters: true`。
- `diagrams: false`（与 Typora 一样显式开启高级图表更安全）。
- `alerts: false`、`yamlFrontMatter: true`、`toc: true`。
- `subscript: false`、`superscript: false`、`highlight: false`。
- `html: true` 但始终净化，不存在关闭安全的设置。
- `defaultCodeLanguage: ''`、`reuseLastCodeLanguage: false`。

### files

- `defaultExtension: '.md'`、`encoding: 'utf8'`、`newFileEol: 'crlf'`（Windows）。
- `supportedExtensions` 包含 `.md/.markdown/.mdown/.mkd/.txt/.qmd`。
- `externalChange: 'prompt-if-dirty-reload-if-clean'`。
- `showHidden: false`、`followSymlinks: false`。
- `sortBy: 'name'`、`sortDirection: 'asc'`、`mixFilesAndFolders: false`。

### images

- `insertPolicy: 'relative-if-possible'`。
- `copyOnInsert: false`、`copyDirectory: './assets'`。
- `prefixDotSlash: false`、`confirmDelete: true`。
- `uploader: null`。

### export

- 每格式独立 `{ schemaVersion, lastTarget, options }`。
- `openAfterExport: false`、`revealAfterExport: false`。
- `allowYamlOverrides: false`。
- PDF 默认 A4、portrait、1cm 边距、背景开启、当前主题。
- Pandoc 路径默认 null，自动探测只能提出候选并让用户确认。

### advanced

- `gpuMode: 'auto'`。
- `logLevel: 'info'`，生产不允许 trace 正文。
- `largeFileThresholdBytes: 5_000_000`。
- `diagramTimeoutMs: 5000`、`exportTimeoutMs: 120000`。
- `customCssEnabled: true`。

## 4. session.json

包含窗口 ID、bounds、maximize、workspace ID/root、active document path、sidebar mode/width、zoom 和滚动锚点。只存已命名文件的路径，不存正文、selection 文本或搜索词。

## 5. recent.json

最多 50 个文件和 20 个文件夹，记录 path、lastOpenedAt 和 display name。不存在路径在用户触发时移除，不因临时网络盘离线自动删除全部历史。

## 6. recovery schema

```ts
interface RecoveryMetaV1 {
  schemaVersion: 1
  documentId: string
  originalPath: string | null
  encoding: Encoding
  eolByLine: readonly Eol[]
  revision: number
  createdAt: string
  contentFile: string
  contentHash: string
}
```

M6 导入加入显式迁移后的版本：

```ts
interface RecoveryMetaV2 extends Omit<RecoveryMetaV1, 'schemaVersion'> {
  schemaVersion: 2
  importStagingId: string | null
}
```

正文单独文件原子轮转。meta 不可信，读取时验证文件名、大小、哈希和路径；绝不把 `contentFile` 或 `importStagingId` 当任意路径。恢复导入会话时只接受主进程生成且仍位于 `import-staging/` 内的 ID；缺失或损坏资源必须显示警告，但不能阻止 Markdown 正文恢复。M1 只实现 V1，M6 负责 V1→V2 迁移和回归。

## 7. 主题

主题名称来自 CSS 文件 basename，限制字符和长度。资源只允许主题目录内相对路径；阻断 `@import` 远程 URL、`file:` 逃逸和脚本协议。主题选择失效时回退内置主题并保留用户文件。

## 8. 迁移

- 先复制 `settings.backup.json`，再在内存逐版本迁移，Zod 验证后原子写入。
- 任一步失败保留原文件，启动安全默认设置并提示恢复/打开配置目录。
- 迁移测试包含每个历史 schema 到当前版本和损坏/未来版本。
- 不允许“读取失败即覆盖默认值”。

## 9. 安全和隐私

设置中不保存 API key、上传器密码或签名私钥。未来需要凭据时使用 Windows Credential Manager/安全存储并单独设计。导出自定义 HTML 和命令参数视为不可信数据，不能因来自 settings 而跳过校验。
