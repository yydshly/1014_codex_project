# Web 展示与部署

本站通过 GitHub Actions 汇总并发布静态研究网页。当前发布清单为 004、006、007 与 014，其他项目保留各自本地环境；正式清单见 `web/pages.json`，上线验证记录见 [Pages 说明](PAGES.md)。

## 一个站点，多个子项目入口

[GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)规定，每个仓库最多对应一个 Pages 站点，并托管静态 HTML、CSS、JavaScript。因此本仓库内多个 Web 统一组织为不同子路径：

```text
https://yydshly.github.io/1014_codex_project/                     # 总展示入口
https://yydshly.github.io/1014_codex_project/001-project-name/    # 子项目 001
https://yydshly.github.io/1014_codex_project/002-another-project/ # 子项目 002
```

上述 001、002 为路径示例；已上线项目以 `web/pages.json` 为准。正式访问并验证后，才将链接登记到 `projects.json`。

## 源码与构建结果

每个 Web 的源码放在 `projects/NNN-slug/web/`，依赖和构建命令由本项目维护。部署时先分别构建，再将全部需要发布的静态产物汇总到 `_site/`：

```text
_site/
├── index.html
├── .nojekyll
├── 001-project-name/
│   ├── index.html
│   └── assets/
└── 002-another-project/
    ├── index.html
    └── assets/
```

`_site/` 是临时发布目录，已被 Git 忽略。每次发布都重新构建完整站点，包含所有仍需展示的项目，避免只发布某个子项目时覆盖其他入口。

## 资源路径与页面路由

本地已提供 `web/index.html` 项目首页，003 服务将根 `projects.json`、配图、研究说明与其他已有构建映射到同一编号站点。003 的 `?view=room` 和 `?view=workspace` 分别进入原房间与 Agent 工作室。静态发布时除各项目 `dist/` 外，还需复制首页、`projects.json` 及首页引用的 `projects/NNN-slug/assets/` 和研究说明；这一步尚未发布执行。真实 Agent 与动态语音仍需要独立服务端，静态页面只运行预设协作与已生成录音。

- 原生页面优先使用相对资源路径。
- 使用打包框架时，将资源基础路径设为 `/1014_codex_project/NNN-slug/`。
- 单页应用优先使用 hash 路由，或使用框架支持的静态导出方案；检查刷新深层页面的行为。
- 后端服务需要独立部署，再由前端访问；Pages 只承载静态产物。

## 后续启用发布

### 010 研究归档

010 的完整研究归档由 `projects/010-evidence-research-lab/web/` 中的 `npm run build` 生成。产物 `dist/index.html` 为自包含单文件，内嵌样式、交互、来源、完整研究材料、明确的合成试跑快照与历史截图；构建不访问私有 `.runtime`。现有 003 项目首页的通用 `dist/` 映射可以直接读取它。

静态汇总时将该文件复制到 `_site/010-evidence-research-lab/index.html`。010 本地服务的 `/` 和 `/1014_codex_project/010-evidence-research-lab/` 均显示归档，原动态实验工具在 `/workbench/`，不包含在静态发布中。当前未部署，`demo_url` 仍为空。

### 011 古人说唱 Battle 研究网页

011 为无第三方运行依赖的静态中文研究网页。在 `projects/011-ancient-rap-battle/web/` 执行 `npm run build`，产物为 `dist/`；本地运行 `npm run dev`，端口 `4184`，支持根路径和 `/1014_codex_project/011-ancient-rap-battle/`。003 现有的通用项目映射可读取该 `dist/`，项目首页通过总索引自动呈现新入口。

静态发布时把整个 `dist/` 复制到 `_site/011-ancient-rap-battle/`。页面使用相对资源路径，示例图片、研究资料、来源登记和许可证随产物分发。上游固定版本的原作分享视频（约 9.38MB、102 秒、540p）保留原字节并随产物分发，通过 HTML `video` 直接播放；011 本地服务与 003 通用映射支持 `video/mp4`、HEAD 和字节范围请求，以支持按需读取与跳转。预算、制作清单和机制示意在浏览器本地运行，不包含模型服务、任务提交或付费调用。当前尚未发布，`demo_url` 保持为空。

有真实 Web 项目后，按照 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)配置：

1. 在仓库 Settings → Pages 中选择 GitHub Actions 作为发布来源。
2. 添加工作流，分别执行各项目构建，并汇总完整 `_site/`。
3. 使用 `configure-pages`、`upload-pages-artifact`、`deploy-pages` 发布完整产物。
4. 检查总入口、各项目入口、图片、资源路径与刷新行为。
5. 在 `projects.json` 中填写已验证的 `demo_url`，然后更新 README 索引。

若某个项目以后需要独立域名、独立发布周期或服务端能力，可以部署到单独仓库或其他平台；总索引继续使用 `demo_url` 指向它。

### 012 EdgeChat 研究图解

`projects/012-edgechat/web/` 使用原生 HTML/CSS/JS，运行 `npm run build` 后把 `dist/` 全部复制到 `_site/012-edgechat/`。资源使用相对路径，章节使用页内锚点，无上游聊天后端或云端凭据依赖。

本地可在该目录运行 `npm run dev`，默认打开 `http://127.0.0.1:4182/1014_codex_project/012-edgechat/`；同一服务的 `/1014_codex_project/` 提供项目总入口。原有 003 服务若已运行，其通用 `dist/` 映射也能读取 012 构建。首页引用的截图仍需随根索引复制。

本页是研究展示与浏览器内原理模拟，不等于部署 EdgeChat 上游应用。尚未发布公网地址，`demo_url` 保持为空。

[返回总入口](../README.md)

### 013 CrawlHive 研究与知向工作台

013 保留 `013-crawl-hive/index.html` 中文研究，并新增 `013-crawl-hive/explore/index.html` AI 方向探索产品。二者均由 `projects/013-crawl-hive/web/` 中的 `npm run build` 输出到同一个 `dist/`，发布时需完整复制，不能只取顶层 `index.html`。

总入口的多页面登记独立放在 `web/entries.json`，基本项目数据仍来自 `projects.json`。静态汇总还必须将 `web/index.html` 和 `web/entries.json` 分别复制到站点根目录的 `index.html` 与 `entries.json`，并保留原有配图、研究说明和其他项目。003 与 013 的本地目录服务都提供该入口元数据。

013 本地服务默认端口 4183；`/1014_codex_project/` 为总入口，工作台通过同源 API 按需采集公开 RSS 与 GitHub。构建产物仅含网页、原文短摘、固定来源说明和带时间的真实数据快照，不含采集服务器或 `.runtime` 缓存。GitHub Pages 上仍可使用筛选、方向配置、收藏和导出；实时刷新需单独运行服务。当前没有发布公网地址，`demo_url` 保持为空。

## 014 真人拟人化研究的发布

静态站点已配置GitHub Actions发布流程，入口和命令见[GitHub Pages发布与验证](PAGES.md)。发布清单为`web/pages.json`，每次构建其中全部项目；当前包含006、007与014。引导图沿用原创能力总览，不把研究网页当作实时数字人部署。2026-10-15已发布并完成公网验证，demo_url已登记；研究展示不等于真人应用运行。

### 006 随机门公开研究页

发布 006 的研究总览、连续开门和旧版三维候车亭；源码准备、入口元数据与完整站点构建见 [Pages 发布说明](PAGES.md#006-随机门研究与原型)。源库能力与产品探索分开描述，保持原作、参考源码与本项目来源可核验。

### 007 Atlas 与月门水庭研究

007 发布完整研究、高清一图总览与可旋转缩放的真实 3D 场景，分别使用 `research.html`、`overview.html` 与 `index.html#scene`。构建器 `web/build.mjs` 打包已有图片、视频、工程和 GLB，并检查资源、锚点、依赖与哈希；CI 仅新增 Pillow 11.3.0，无需运行 Blender 或模型服务。详细发布方式与验收见 [Pages 说明](PAGES.md#007-atlas-资产工作流研究与月门水庭实证)。

### 004 问题驱动研究工作台

004 发布 `research.html` 产品总览与 `index.html` 研究工作区，沿用 `assets/product-overview.png` 引导图。总览解释能力、原理、价值、产品目标、适用方向和十类扩展构想；工作区提供 10 个网站入口、历史样本、浏览器采集计划与发现库。

`web/build.mjs` 执行依赖安装、检查与测试，再以静态模式构建。公开版本不请求本地研究 API，不包含服务器、环境文件或 `.runtime`；自动联网研究仍需本机 Node 服务和 Codex。发布与公网验证记录见 [004 部署记录](../projects/004-jasonzhu-ai/deployment.json)。
