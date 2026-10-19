# Web 展示与部署

本站通过 GitHub Actions 汇总并发布静态研究网页。发布清单包含 004、006、007、010 与 014，其他项目保留各自本地环境；正式清单见 `web/pages.json`，上线验证记录见 [Pages 说明](PAGES.md)。

## 一个站点，多个子项目入口

[GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)规定，每个仓库最多对应一个 Pages 站点，并托管静态 HTML、CSS、JavaScript。因此本仓库内多个 Web 统一组织为不同子路径：

```text
https://yydshly.github.io/1014_codex_project/                     # 总展示入口
https://yydshly.github.io/1014_codex_project/001-project-name/    # 子项目 001
https://yydshly.github.io/1014_codex_project/002-another-project/ # 子项目 002
```

这些路径用于统一发布；项目只有发布并验证后才在`projects.json`登记demo_url。

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

- 原生页面优先使用相对资源路径。
- 使用打包框架时，将资源基础路径设为 `/1014_codex_project/NNN-slug/`。
- 单页应用优先使用 hash 路由，或使用框架支持的静态导出方案；检查刷新深层页面的行为。
- 后端服务需要独立部署，再由前端访问；Pages 只承载静态产物。

## 后续启用发布

有真实 Web 项目后，按照 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)配置：

1. 在仓库 Settings → Pages 中选择 GitHub Actions 作为发布来源。
2. 添加工作流，分别执行各项目构建，并汇总完整 `_site/`。
3. 使用 `configure-pages`、`upload-pages-artifact`、`deploy-pages` 发布完整产物。
4. 检查总入口、各项目入口、图片、资源路径与刷新行为。
5. 在 `projects.json` 中填写已验证的 `demo_url`，然后更新 README 索引。

若某个项目以后需要独立域名、独立发布周期或服务端能力，可以部署到单独仓库或其他平台；总索引继续使用 `demo_url` 指向它。

[返回总入口](../README.md)

## 014 真人拟人化研究的发布

静态站点已配置GitHub Actions发布流程，入口和命令见[GitHub Pages发布与验证](PAGES.md)。发布清单为`web/pages.json`，每次构建其中全部项目；当前包含006、007与014。引导图沿用原创能力总览，不把研究网页当作实时数字人部署。2026-10-15已发布并完成公网验证，demo_url已登记；研究展示不等于真人应用运行。

### 006 随机门公开研究页

发布 006 的研究总览、连续开门和旧版三维候车亭；源码准备、入口元数据与完整站点构建见 [Pages 发布说明](PAGES.md#006-随机门研究与原型)。源库能力与产品探索分开描述，保持原作、参考源码与本项目来源可核验。

### 007 Atlas 与月门水庭研究

007 发布完整研究、高清一图总览与可旋转缩放的真实 3D 场景，分别使用 `research.html`、`overview.html` 与 `index.html#scene`。构建器 `web/build.mjs` 打包已有图片、视频、工程和 GLB，并检查资源、锚点、依赖与哈希；CI 仅新增 Pillow 11.3.0，无需运行 Blender 或模型服务。详细发布方式与验收见 [Pages 说明](PAGES.md#007-atlas-资产工作流研究与月门水庭实证)。

### 004 问题驱动研究工作台

004 发布 `research.html` 产品总览与 `index.html` 研究工作区，沿用 `assets/product-overview.png` 引导图。总览解释能力、原理、价值、产品目标、适用方向和十类扩展构想；工作区提供 10 个网站入口、历史样本、浏览器采集计划与发现库。

`web/build.mjs` 执行依赖安装、检查与测试，再以静态模式构建。公开版本不请求本地研究 API，不包含服务器、环境文件或 `.runtime`；自动联网研究仍需本机 Node 服务和 Codex。发布与公网验证记录见 [004 部署记录](../projects/004-jasonzhu-ai/deployment.json)。

### 010 数据驱动的需求调研档案

010 汇总 Atypica 的研究用途、使用场景、模型/身份/流程的价值，以及我们通过合成资料 B/C 对照形成的理解。主线为“数据是产品调研的事实基础 → 证据整理 → 需求判断 → 产品验证 → 反馈沉淀”，可扩展需求雷达、调研工作台和领域助手。保留原实验与停止决定，不把模拟当作真人反馈。

引导图沿用已生成的 `assets/understanding-map.png`，同时发布 SVG 和结构化图源。`projects/010-evidence-research-lab/web/build.mjs` 执行检查、测试与公开构建，完整产物复制到 `_site/010-evidence-research-lab/`。公开版本仅提供研究阅读、搜索与导出，不包含本机 `/workbench/`、模型服务、环境文件或 `.runtime`。

已加入 `web/pages.json`，与 004、006、007 和 014 一起构建。2026-10-19 Actions 发布及公网核验成功后，已登记正式 `demo_url`；入口、工作流、原图哈希与验证范围见 [010 发布记录](../projects/010-evidence-research-lab/deployment.json)。
