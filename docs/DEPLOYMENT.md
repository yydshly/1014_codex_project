# Web 展示与部署

本仓库采用同一GitHub Pages站点与编号子路径。014已配置静态构建及发布工作流，详细操作见[发布与验证](PAGES.md)。

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

静态站点已配置GitHub Actions发布流程，入口和命令见[GitHub Pages发布与验证](PAGES.md)。发布清单为`web/pages.json`，每次构建其中全部项目；当前只包含014。引导图沿用原创能力总览，不把研究网页当作实时数字人部署。2026-10-15已发布并完成公网验证，demo_url已登记；研究展示不等于真人应用运行。
