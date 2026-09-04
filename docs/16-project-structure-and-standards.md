# 项目结构与编码规范

## 1. 目标目录

```text
.
├─ src/
│  ├─ main/
│  │  ├─ bootstrap/        app、single instance、protocol、security
│  │  ├─ windows/          editor/export/preferences windows
│  │  ├─ ipc/              router、sender validation、handlers
│  │  ├─ services/         files、workspace、watcher、recovery、settings
│  │  ├─ export/           controllers、Pandoc、print/image
│  │  └─ index.ts
│  ├─ preload/
│  │  ├─ api/              per-domain bridge implementations
│  │  └─ index.ts
│  ├─ shared/
│  │  ├─ commands/         layer-neutral command metadata
│  │  ├─ contracts/        Zod request/response/event schemas
│  │  ├─ errors/           ErrorCode、Result、serialization
│  │  ├─ i18n/             shared foundation command/menu catalogs
│  │  └─ types/            readonly cross-process data
│  ├─ domain/
│  │  ├─ document/         SourceBuffer、session、EOL、encoding
│  │  ├─ changes/          SourcePatch、mapping、history metadata
│  │  ├─ commands/         registry and command state
│  │  ├─ markdown/         feature registry and block adapters
│  │  ├─ workspace/        tree/search models
│  │  ├─ resources/        ResourceTransaction
│  │  ├─ settings/         schema and migrations
│  │  └─ export/           RenderDocument and adapters
│  └─ renderer/
│     ├─ app/              composition root and routes
│     ├─ editor/           CodeMirror host/extensions/widgets
│     ├─ shell/            titlebar/sidebar/status/menu surfaces
│     ├─ features/         workspace, outline, search, preferences
│     ├─ components/       reusable accessible primitives
│     ├─ themes/           tokens and built-in original themes
│     ├─ i18n/
│     └─ workers/
├─ tests/
│  ├─ fixtures/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  ├─ security/
│  └─ performance/
├─ .github/
│  ├─ workflows/            SHA-pinned quality, CodeQL, dependency review
│  └─ dependabot.yml        bounded weekly dependency update policy
├─ build/brand/             original deterministic Lattice package assets
├─ artifacts/m0/            ignored, machine-readable audit evidence
├─ resources/              icons, licenses, sidecars, export templates
├─ docs/
├─ iterations/
└─ scripts/
   ├─ assets/               deterministic committed asset generation/check
   ├─ audit/                dependency, SBOM, package hash and M0 gate
   └─ planning/             iteration model and planning verification
```

### M0 当前可执行所有权

| Concern                                      | Current owner                                                                                                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire schemas and renderer-visible API type   | `src/shared/contracts/app-info.ts`, `command.ts`, `channels.ts`, `contract-version.ts`, `ipc-request.ts`, `lattice-desktop-api.ts`, and their barrel files                                                             |
| Stable Result and errors                     | `src/shared/errors/result.ts`, `app-error.ts`, `error-code.ts`, and `index.ts`                                                                                                                                         |
| Trusted main IPC boundary                    | M0 router modules plus `src/main/ipc/register-command-state-ipc.ts`                                                                                                                                                    |
| Command authority and native-menu projection | `src/shared/commands/`, `src/shared/i18n/`, `src/domain/commands/`, `src/main/commands/application-menu.ts`, and `src/main/index.ts`                                                                                   |
| Frozen preload and renderer declaration      | `src/preload/api/create-app-api.ts`, `create-command-api.ts`, `src/preload/index.ts`, and `src/renderer/src/lattice-api.d.ts`                                                                                          |
| Localized accessible renderer shell          | `src/renderer/src/commands/`, `components/`, `i18n/`, `app.tsx`, and `styles.css`                                                                                                                                      |
| Sandbox preload dependency bundling          | `electron.vite.config.ts` inlines only `zod` instead of leaving a runtime `require("zod")`                                                                                                                             |
| Dependency and package evidence              | `scripts/audit/` owns normalized production inventory/licenses/vulnerabilities, complete toolchain vulnerability evidence, CycloneDX 1.6, path-safe SHA-256 manifests and the finite six-step M0 gate                  |
| GitHub automation policy                     | `scripts/verify-workflows.mjs`, `.github/workflows/` and `.github/dependabot.yml` own exact action pins, least privilege, command parity and bounded update policy                                                     |
| Windows package                              | `package.json` electron-builder configuration owns the installed Electron runtime boundary plus x64 unpacked/per-user NSIS output; `build/brand/` supplies deterministic Lattice assets                                |
| Unit proof                                   | `tests/unit/shared/contracts.spec.ts`, `tests/unit/main/ipc-value-budget.spec.ts`, `authorized-window-registry.spec.ts`, `validate-ipc-sender.spec.ts`, `ipc-router.spec.ts`, and `tests/unit/preload/app-api.spec.ts` |
| Real Electron proof                          | Ordinary `playwright.config.ts` owns app/command/navigation E2E; `playwright.packaged.config.ts` owns only `packaged-app.spec.ts`; `tests/security/electron-boundary.spec.ts` owns the production privilege boundary   |

M0 不实现文件、工作区、设置、恢复、导入或导出服务及 preload 方法。目标目录树中的这些入口仍由后续迭代负责。

## 2. 依赖方向

```text
renderer -> domain + shared
preload  -> shared
main     -> domain + shared
domain   -> no Electron, React, DOM or Node filesystem
shared   -> Zod and platform-neutral utilities only
```

main 与 renderer 不互相 import。renderer 不 import `electron` 或 Node built-ins。domain 不读取全局时间、随机数、文件系统或 process；通过接口注入。

## 3. 文件和命名

- 文件使用 kebab-case，React component 文件可 PascalCase，但同目录保持一致。
- 类型/组件 PascalCase，函数/变量 camelCase，常量只在真正全局不变时 UPPER_SNAKE_CASE。
- Command ID 和 ErrorCode 使用集中定义，不散落字符串。
- 事件命名 `<domain>:<past-tense>`，IPC channel 是内部映射，不成为 UI API。
- boolean 使用 `is/has/can/should` 前缀；避免含糊 `data`、`handler`、`utils` 大杂烩。

## 4. TypeScript

- strict、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`useUnknownInCatchVariables`。
- 外部输入从 `unknown` 开始经 Zod 解析。
- 禁止 `any`、非空断言滥用、`@ts-ignore` 和通过双重 assertion 绕过类型。
- public 数据优先 readonly；领域变化通过方法/transaction，不直接 mutate 暴露对象。
- exhaustive switch 用 `never` 检查。

## 5. React 和 CodeMirror

- React 管理壳、面板、偏好和派生 UI；全文、selection、history 留在 CodeMirror/DocumentSession。
- CodeMirror extension 通过 compartment 动态切换，不销毁 EditorView。
- component 不直接调用 preload；通过 feature service/hook 调用类型化 facade。
- effect 必须清理 watcher、subscription、worker 和 AbortController。
- 避免以 Markdown 源码或路径作为 React key。

## 6. 错误和日志

- 领域返回 Result/typed error；只有进程边界捕获未知异常并转换 `INTERNAL_UNEXPECTED`。
- 禁止空 catch。允许忽略的清理错误必须有注释和脱敏日志。
- 用户消息使用 message key，日志记录 code/request ID/安全上下文，不记录正文。
- M0 的 IPC sink 只接受固定字段：level、code、request ID、approved
  channel/`unknown`、safe reason、可选 main-derived window/WebContents ID 和
  可选脱敏 stack。stack 最多 8 帧/每帧 256 字符；只保留 basename，不保留目录。

## 7. CSS 和主题

- 应用壳使用 CSS Modules/语义类和 CSS variables；不依赖生成式原子类作为主题 API。
- 文档根使用稳定 `#write` 兼容入口和项目自己的语义 class；安全/系统 UI 位于主题作用域外。
- 尺寸使用 token，支持 100%–250% 缩放和高对比。
- 用户主题不能通过 JS、远程 `@import` 或任意文件协议扩权。

## 8. 测试布局

- 纯领域测试可与模块相邻或集中 tests/unit，但同类保持一致。
- 每个回归测试名包含需求/测试 ID 或在 fixture metadata 引用。
- E2E 通过 test-only adapter 控制对话框/路径，不在生产构建保留任意调试 IPC。
- 打包前 E2E 与 packaged E2E 使用不同配置；普通 E2E 不得依赖 `dist/`，packaged E2E 不得退回开发入口或未打包 Electron。
- `tests/integration/m0-gate.spec.ts` 对工作流策略和六步审计编排使用真实临时文件与真实子进程；外部网络查询只在显式本地/CI 门禁中执行，不用 mock 结果冒充出口证据。
- 性能测试只运行打包构建并记录环境。

## 9. 注释和文档

- 注释解释不变量、坐标系、浏览器/Windows workaround 和安全原因，不复述代码。
- public contract、设置、迁移和恢复 schema 需要 TSDoc 与对应文档。
- workaround 标明上游 issue/版本、回归测试和删除条件。

## 10. 禁止模式

- `utils.ts` 持续堆积、跨层 service locator、renderer 全局 mutable singleton。
- 用 HTML DOM 反向生成 Markdown 保存。
- 保存时全文件格式化、统一 EOL 或重排 YAML/表格。
- 用 timeout 猜测导出/渲染完成，必须有明确稳定信号。
- 用重试掩盖 flaky selection/IME 或原子保存问题。
