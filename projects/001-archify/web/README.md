# 001 · Archify 本地网页演示

已从固定版本 Archify 生成中文和英文结构图，并制作三个导览页面：结构地图、生成链路、源码证据。

图解说明的是 Archify 自身 `render architecture` 分支。节点与来源经过本地 Git 固定版本核验，图解由上游原生渲染器生成。在线自然语言生成和任意仓库分析尚未实现。

## Windows 启动

在本目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

预览地址：<http://127.0.0.1:4173/1014_codex_project/001-archify/>。

脚本会跳过本机不兼容的 Node.js，选择满足版本要求的已安装运行环境；如果桌面应用的 Node.js 运行环境存在，也可以选用它。不下载 Node.js、不更新系统版本、不安装全局 Skill。

没有可用运行环境时，可安装 Node.js 24.19 或更新版本，或通过 `ARCHIFY_NODE` 指定已有的 `node.exe`。也可更换端口：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Port 4174
```

停止服务：在启动终端按 Ctrl+C。

## 环境与构建

本次实际环境：Windows、Node.js `v24.19.0`、本机 Chrome。网页外壳为原生 HTML / CSS / JavaScript，无 npm 依赖。Archify 的渲染与浏览器检查需要 Node.js 和 Chrome / Chromium。

在兼容的运行环境中可分别执行：

```text
npm run build      # 获取 / 核验固定上游，并生成中英文图解和网页
npm run check      # 检查实际构建产物、来源范围与上游检查结果
npm run preview    # 只启动已有 dist/ 的本地服务
```

首次构建会克隆上游 `v3.1.0` 到 `.cache/upstream`，核对 commit 为 `1c2b42d660e4a7571813fb43839c79e3e9ca7720`，并拒绝使用已修改的上游源码。已有缓存时不再克隆。无需执行上游 npm install；本次使用其自带运行代码与编译后的校验器。

图解生成执行上游 finalize，必须通过 validate、deliver、check、browser-check 四个阶段才视为构建成功。诊断与检查结果保存在 `.cache/receipts/`，失败时命令以非零状态结束。上游的联网更新提示在本研究构建中关闭，保证固定版本研究。

若 Chrome 未位于常用安装位置，使用 `ARCHIFY_CHROME` 指定现有浏览器可执行文件。没有真实浏览器时构建不会将 browser-check 标为通过。

## 目录与复现范围

| 路径 | 用途 |
| --- | --- |
| `src/` | 双语导览网页、样式、交互与原创 SVG 图标 |
| `data/project.mjs` | 节点含义、位置、连接与固定版本来源的统一输入 |
| `data/archify-zh.json` / `data/archify-en.json` | 由统一输入导出的上游格式 JSON |
| `scripts/build.mjs` | 核对上游版本、调用原生生成链路、组织静态网页 |
| `scripts/serve.mjs` | 仅绑定 127.0.0.1 的静态预览服务 |
| `start.ps1` | Windows 本地启动入口 |
| `licenses/` | 固定版本上游许可与第三方来源说明 |
| `.cache/` | 不纳入 Git 的上游源码、诊断与检查缓存 |
| `dist/` | 不纳入 Git 的可重建静态产物 |

已验证：中英文生成、格式与源码证据、页面资源、节点焦点、完整有向路径、主题同步、源码表、窄屏无页面横向溢出。

下载验证限制：内置浏览器点击 SVG 导出后菜单正常关闭、控制台无错误，但没有返回下载完成事件；HTML 下载接口也未返回完成。因此未确认内置浏览器的文件下载成功。上游独立浏览器的 SVG / PNG 导出回归测试通过 4 项检查；这项证据不等同于本页面的文件下载成功。

## 来源与部署

原生阅读器来自 Archify v3.1.0，上游渲染器未修改。本项目新增导览内容、图解数据、网页外壳与构建脚本。每次构建同时附带 `ARCHIFY-LICENSE.txt` 和 `THIRD_PARTY_NOTICES.md`，包含上游程序、嵌入字体等来源说明。

页面使用相对资源路径。本地预览已使用规划的 `/1014_codex_project/001-archify/` 子路径，以验证后续 Pages 路径行为。在线部署需将 dist/ 静态产物放入总站点的 001-archify/，流程见 [部署约定](../../../docs/DEPLOYMENT.md)。

尚未部署；发布并检查可访问后，才在根目录 projects.json 填写 demo_url。
