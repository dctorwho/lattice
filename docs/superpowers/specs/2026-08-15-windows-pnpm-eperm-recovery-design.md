# 移除未使用 Squirrel peer 的设计

## 背景

M0 要求在含中文和空格的路径中完成冻结、可离线的 Windows 自举。GitHub 托管 Windows runner 在 pnpm 导入 `electron-winstaller@5.4.0` 时持续失败：Windows 以 `ERR_PNPM_EPERM` 拒绝 pnpm 临时目录重命名。

有限清理和单次重试实现已在本地及必需 GitHub `quality` 作业测试。第二次安装遇到同一包锁，因此不能把失败安全归因于一次性瞬态事件。路径分析也排除经典 260 字符限制：失败包目录为 158 字符，其最深预计子项为 207 字符。

该依赖存在是因为 pnpm 自动满足 `app-builder-lib@26.15.3` 的 `electron-builder-squirrel-windows` peer。Lattice M0 只使用 Windows x64 `dir` 和 NSIS 打包，不使用 Squirrel，因此该 peer 及其 `electron-winstaller` 依赖没有提供任何已准入能力。

## 目标

保留固定 `electron-builder@26.15.3` 的 NSIS/dir 能力，同时从解析和安装图中移除未使用的 Squirrel 依赖边。之后自举必须保持严格：任何安装失败都是终止结果，不重试，也不扩大超时。

## 依赖策略

在 `pnpm-workspace.yaml` 增加一个限定版本的根 override：

```yaml
overrides:
  'app-builder-lib@26.15.3>electron-builder-squirrel-windows': '-'
```

pnpm 11 会把根 override 应用于 peer 依赖，并支持以 `-` 显式移除依赖边。父包和版本均固定，因此 electron-builder 升级不能静默继承该例外。

移除 `allowBuilds.electron-winstaller: false`，因为该包不再属于依赖图。保持 `allowBuilds.esbuild: true` 不变。不要全局禁用 `autoInstallPeers`；无关 peer 解析必须保持当前行为。

使用固定 pnpm 11.12.0 重新生成 `pnpm-lock.yaml`。结果图不得包含 `electron-winstaller@5.4.0` 或 `electron-builder-squirrel-windows@26.15.3` 的 package 或 snapshot 条目。限定版本 override 继续作为锁文件策略元数据记录。

## 自举行为

把 `verifyBootstrap` 恢复为单次 pnpm 安装尝试。移除注入的等待边界、EPERM 分类器、部分 `node_modules` 清理和重试测试。既有安装阶段错误测试继续证明每次安装失败都会停止自举并保留退出码。

ignored-build 解析器继续失败关闭并支持 pnpm 显式拒绝区段，但活跃项目输出必须为：

```text
Automatically ignored builds during installation:
  None
```

## 验证

增加聚焦配置测试以证明：

- 存在精确限定版本 override；
- 不存在全局 `autoInstallPeers: false`；
- `allowBuilds` 下只保留 `esbuild: true`；
- 锁文件没有 Squirrel 或 electron-winstaller package/snapshot 条目；
- 仍声明固定 electron-builder 版本。

然后重新生成依赖并要求：

- 冻结离线安装成功；
- `pnpm peers check` 报告无问题；
- `pnpm ignored-builds` 报告自动 `None`，且无显式拒绝；
- 聚焦单元覆盖通过；
- 隔离中文和空格路径自举通过；
- `node scripts/verify-planning-docs.mjs` 和 `pnpm check` 通过；
- GitHub 必需 `quality` 作业成功。

## 文档

更新技术台账和 M0 详细设计，记录精确移除的 peer 边、版本范围、保留的 NSIS/dir 能力、未使用安装脚本暴露的移除，以及必需升级审阅。M0 测试报告只记录实际观察到的命令和结果。

## 非目标

- 重试或忽略任意 pnpm 失败。
- 在全项目禁用 peer 自动安装。
- 增加 Squirrel 打包支持。
- 更改 pnpm、Electron、electron-builder、runner 安全、杀毒软件或工作流超时设置。
- 替换 electron-builder 或削弱中文和空格路径契约。
