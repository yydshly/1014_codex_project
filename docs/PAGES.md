# GitHub Pages 发布与验证

本站使用一个 GitHub Pages 站点和编号子路径，发布来源为 `main` 分支的 GitHub Actions 工作流。2026-10-15首次发布已成功，公网入口、正文、引导图、章节导航与来源文件均已验证，记录见[014验证文件](../projects/014-cyber-xiaoya-study/sources/verification.json)。

- 总入口：<https://yydshly.github.io/1014_codex_project/>
- 006 研究页：<https://yydshly.github.io/1014_codex_project/006-random-doors/research.html>
- 006 世界与身份实验：<https://yydshly.github.io/1014_codex_project/006-random-doors/worlds.html>
- 007 Atlas 研究页：<https://yydshly.github.io/1014_codex_project/007-autumn-courtyard-blender/research.html>
- 014 研究页：<https://yydshly.github.io/1014_codex_project/014-cyber-xiaoya-study/>
- 工作流：`.github/workflows/pages.yml`。
- 发布清单：`web/pages.json`。每次重新构建清单中的全部项目，避免发布单个项目时覆盖已有入口。
- 目录数据：`projects.json`；静态首页只列出发布清单中的项目，沿用原编号，不重排。

## 构建

需要 Node.js 22 和 Python 3.12。004 与 006 由项目构建器按锁文件安装依赖并执行检查；014 不需要第三方包、密钥或模型；007 用 Pillow 11.3.0 打包已有媒体并校验源工程、GLB 与依赖。静态部署无需 Blender、GPU 或模型调用。

```sh
python scripts/project_catalog.py sync
python scripts/project_catalog.py check
python -m pip install -r projects/007-autumn-courtyard-blender/requirements-web.txt
node scripts/build_pages.mjs
```

构建器先执行各项目的 `web/build.mjs`，将完整 `web/dist/` 复制到 `_site/编号-slug/`，再放入静态首页、已发布目录、研究简介与引导图。只删除经过绝对路径检查的临时 `_site/`，不删除源码。`_site/` 与各项目 `dist/` 均不提交到Git。

新增发布项目时，将其已有目录名加入 `web/pages.json`，并保证构建产生完整静态产物。不要把本地服务、环境文件、运行缓存或模型权重放入静态产物。

## 发布与检查

提交并推送 `main` 后，工作流检查目录、构建完整站点，再使用官方 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages` 发布。

首次启用时，仓库 Pages 来源需设为 GitHub Actions。只有部署成功且公网入口、引导图、CSS/JS、正文、章节跳转和来源文件实际可访问后，才能登记 `demo_url`；随后运行目录同步并提交验证记录。

014沿用我们生成的 `assets/overview.png` 作为首页引导图和总索引配图，保留原始SVG和来源登记。页面是能力、原理、价值与扩展方向的研究展示，不运行真人数字人模型。原片按需从第三方媒体地址加载，源站可能不可达；本地保存的原封面和能力图不依赖它。

[返回部署约定](DEPLOYMENT.md)

## 006 随机门研究与原型

006 发布研究页 `006-random-doors/research.html`、连续开门主入口、`seaside.html` 三维候车亭与新增的 `worlds.html` 世界身份实验。研究页解释 Portal Cube 原作灵感、Four-Seasons 独立源码参考的能力与参数化原理，以及我们的随机遭遇、世界身份、相容任务、参与反馈、本地回访、价值和扩展方向；不是把参考库当作现成故事或无限生成引擎。

在 `projects/006-random-doors/web/` 执行 `node build.mjs`，按锁文件安装缺失依赖，执行检查与 45 项行为测试，再构建四入口。`prepare-assets.mjs` 在构建前复制已登记的参考图和高清总览图。站点构建器完整发布清单中的所有项目，并按 `web/entries.json` 登记多个入口。原作视频与图片保留作者、出处和校验记录；页面不含后端、账号、密钥或运行时模型调用，手记保存在当前浏览器。

006 于 2026-10-16 通过现有 Actions 成功部署，公网研究页、三处体验入口、参考图、高清 PNG/SVG、原作视频分段请求及现有 014 均验证成功。浏览器确认摘要与交互可用，手机无横向页面溢出。验证详情见 [006 部署记录](../projects/006-random-doors/deployment.json)。

0.8 世界与身份实验于 2026-10-16 发布并完成公网核验，三世界八身份与研究摘要可访问。原型资源与本地构建字节一致，保留旧体验与现有项目。见 [0.8 验收](../projects/006-random-doors/verification/worlds-0.8-public.json)。

0.9 于 2026-10-17 深化列车第一人称附身，七张本地 WebP 承载六种身体/空间视角和取物后状态；通路、权限、动作与旧记录迁移由列车状态机维护。制作阶段调用内置 ImageGen，运行时不调用模型；语法检查和 45 项测试随完整站点构建执行。详见 [列车设计](../projects/006-random-doors/TRAIN_IMMERSION.md)。

## 007 Atlas 资产工作流研究与月门水庭实证

发布 `007-autumn-courtyard-blender/research.html` 完整研究、`overview.html` 高清一图总览，以及 `index.html#scene` 真实三维。摘要先解释 Atlas 的源库能力、依赖模型与工具的工作原理、可编辑交付的价值，再说明非游戏用途、可扩展方向和证据范围。月门水庭为独立实验，没有完整执行 Atlas 技能包，不能据此宣称源库带来确定增益。

项目 `web/build.mjs` 调用 `scripts/build_web.py` 与 `check_web.py`。Three.js 和 Draco 原文件、许可证与哈希随项目保存，网页不依赖 CDN。Python 构建使用已有图片、视频、Blender 工程与 GLB；不重新生成图像、三维或总览图。原始代码、来源、工程下载和检查记录一并发布。部署与公网验证记录见项目根的 `deployment.json`，验证后才登记 `demo_url`。

2026-10-16 已通过 Actions 发布。浏览器实测五项研究摘要、14 个章节和真实三维旋转、缩放、机位切换、线框与全屏显示；总览网页改用约 0.75 MB WebP 预览，保留 4,000 × 9,001 PNG 与 SVG 高清下载。三页入口、本地资源、模型、工程与图片的公网核验详情见 [007 部署记录](../projects/007-autumn-courtyard-blender/deployment.json)。现有 006 与 014 保留在同一发布清单中。

## 004 问题驱动研究工作台

新增 `004-jasonzhu-ai/research.html` 产品总览与 `index.html` 研究工作区。摘要说明公开来源检索、模型分析与程序检查的工作原理，面向个人开发者积累有出处的判断和下一步；区分已有能力、适用方向、产品目标与未来扩展。引导图使用已经生成的 `assets/product-overview.png`，保留 SVG 与 Mermaid 图源。

发布清单同时保留 006、007 与 014。004 构建器执行语法检查与 39 项测试，校验本地资源和锚点，以静态模式发布；服务器、环境文件与运行缓存不进入站点。公开页支持导航、采集计划、发现保存与备份；自动研究需要本机服务与 Codex 登录，线上入口明确标注并禁用执行。公网与本地浏览器数据需通过 JSON 迁移。

实际部署状态、工作流与公网检查见 [004 部署记录](../projects/004-jasonzhu-ai/deployment.json)。公网核验后再补充正式演示地址。
