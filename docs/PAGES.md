# GitHub Pages 发布与验证

本站使用一个 GitHub Pages 站点和编号子路径，发布来源为 `main` 分支的 GitHub Actions 工作流。2026-10-15首次发布已成功，公网入口、正文、引导图、章节导航与来源文件均已验证，记录见[014验证文件](../projects/014-cyber-xiaoya-study/sources/verification.json)。

- 总入口：<https://yydshly.github.io/1014_codex_project/>
- 014 研究页：<https://yydshly.github.io/1014_codex_project/014-cyber-xiaoya-study/>
- 工作流：`.github/workflows/pages.yml`。
- 发布清单：`web/pages.json`。每次重新构建清单中的全部项目，避免发布单个项目时覆盖已有入口。
- 目录数据：`projects.json`；静态首页只列出发布清单中的项目，沿用原编号，不重排。

## 构建

需要 Node.js 22 和 Python 3.12。当前014不需要安装第三方包、配置密钥或下载模型。

```sh
python scripts/project_catalog.py sync
python scripts/project_catalog.py check
node scripts/build_pages.mjs
```

构建器先执行各项目的 `web/build.mjs`，将完整 `web/dist/` 复制到 `_site/编号-slug/`，再放入静态首页、已发布目录、研究简介与引导图。只删除经过绝对路径检查的临时 `_site/`，不删除源码。`_site/` 与各项目 `dist/` 均不提交到Git。

新增发布项目时，将其已有目录名加入 `web/pages.json`，并保证构建产生完整静态产物。不要把本地服务、环境文件、运行缓存或模型权重放入静态产物。

## 发布与检查

提交并推送 `main` 后，工作流检查目录、构建完整站点，再使用官方 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages` 发布。

首次启用时，仓库 Pages 来源需设为 GitHub Actions。只有部署成功且公网入口、引导图、CSS/JS、正文、章节跳转和来源文件实际可访问后，才能登记 `demo_url`；随后运行目录同步并提交验证记录。

014沿用我们生成的 `assets/overview.png` 作为首页引导图和总索引配图，保留原始SVG和来源登记。页面是能力、原理、价值与扩展方向的研究展示，不运行真人数字人模型。原片按需从第三方媒体地址加载，源站可能不可达；本地保存的原封面和能力图不依赖它。

[返回部署约定](DEPLOYMENT.md)
