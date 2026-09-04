# Lattice 品牌资源

这些资源由 Lattice 项目于 2026-08-02 原创建，不复制 Typora、Electron 或其他产品的品牌材料。

## 几何结构与配色

`lattice-icon.svg` 是一个 `256×256` 的正方形，背景色为 `#161A2B`。四个独立的圆角网格块分别位于 `(40,44)`、`(120,44)`、`(40,124)` 和 `(120,124)`，每块尺寸为 `64×64`，圆角半径为 `16`。各块依次使用 `#8B5CF6`、`#A78BFA`、`#C4B5FD` 和 `#8B5CF6`；一条宽 10 像素、颜色为 `#FFFFFF` 的白色对角源码线从 `(48,208)` 延伸到 `(208,48)`。

源文件只包含项目原创的 SVG 几何，不含字体、嵌入位图、远程引用或复制的元数据。

## 可复现生成

在仓库根目录运行生成器：

```powershell
node scripts/assets/build-lattice-icon.mjs
node scripts/assets/build-lattice-icon.mjs --check
```

脚本只使用 Node 内置模块 `node:crypto`、`node:fs` 和 `node:zlib`，生成具有确定性分块 CRC32 与压缩结果的固定 RGBA PNG，然后把该 PNG 作为 ICO 中唯一的 `256×256` 图像。脚本不接受输出路径参数，只把固定目标解析为仓库相对路径；生成字节不包含时间戳。

## 已记录哈希

- `lattice-icon-256.png` SHA-256：
  `4317ae0aecca27dddd570e511b073bc8b6963e46a49fe025d2c4c98775036014`
- `lattice.ico` SHA-256：
  `06e6f68ec6f11a92e6df43e35c83f72abe1f6eeff6fa378328fc17a3ff36896c`

CI 必须验证这些已提交哈希，不得重新生成打包资源。
