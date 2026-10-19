# GitHub Pages 发布与验证

本站使用一个 GitHub Pages 站点和编号子路径，发布来源为 `main` 分支的 GitHub Actions 工作流。2026-10-15首次发布已成功，公网入口、正文、引导图、章节导航与来源文件均已验证，记录见[014验证文件](../projects/014-cyber-xiaoya-study/sources/verification.json)。

- 总入口：<https://yydshly.github.io/1014_codex_project/>
- 004 产品总览：<https://yydshly.github.io/1014_codex_project/004-jasonzhu-ai/research.html>
- 006 研究页：<https://yydshly.github.io/1014_codex_project/006-random-doors/research.html>
- 006 世界与身份实验：<https://yydshly.github.io/1014_codex_project/006-random-doors/worlds.html>
- 007 Atlas 研究页：<https://yydshly.github.io/1014_codex_project/007-autumn-courtyard-blender/research.html>
- 009 个人主页启发与需求发现：<https://yydshly.github.io/1014_codex_project/009-demand-discovery/#synthesis>
- 010 数据与需求调研：<https://yydshly.github.io/1014_codex_project/010-evidence-research-lab/#synthesis>
- 011 古人说唱机制与舞台成果：<https://yydshly.github.io/1014_codex_project/011-ancient-rap-battle/>
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

## 011 古人说唱机制研究与原曲驱动舞台版

011以已经生成的`assets/ancient-rap-battle-research-overview.png`为引导图，首页摘要明确说明源库效果与能力、我们的探索、原曲驱动修复、引发的思考及可扩展方向。保留源库周瑜×诸葛亮原作、我们的94.64秒《压轴人间》、失败样片和5秒获确认试片；新成片与历史拒收分别标明。

2026-10-19经既有Actions发布，67份静态文件、公网正文与锚点、新成片完整SHA、全部媒体首尾Range以及原有六个项目入口通过核验。构建只打包既有结果，不调用模型；模型缓存、账号配置和制作中间文件不公开。5秒试片确认不外推为整片口型验收，精确范围见[011发布记录](../projects/011-ancient-rap-battle/deployment.json)。

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

2026-10-17 已通过 Actions 发布并验证，产品总览、工作区、引导图、静态资源、文档与既有项目共 34 个公网地址全部通过检查；浏览器确认摘要、十类扩展、导航及静态模式。实际工作流与公网检查见 [004 部署记录](../projects/004-jasonzhu-ai/deployment.json)，正式演示地址已登记。

## 010 Atypica 与数据驱动需求调研

010 用五项摘要说明源产品能力、使用场景、我们的 B/C 实践、引发的核心思考及可扩展方向，沿用原创 `assets/understanding-map.png` 引导图。公开页保留完整讨论、来源与合成试跑材料，主线是 Atypica 调研用途 → 模型、身份与流程 → 数据与证据 → 需求判断 → 产品验证 → 反馈沉淀。

`web/build.mjs` 不安装第三方依赖或调用模型；执行语法检查、已有测试与公开产物检查。公开导航不指向读者的 localhost，不发布本地 API 或实验运行目录。发布清单保留已有四个项目。2026-10-19 已通过 Actions 发布；13 个公网地址、94 个页内编号及原引导图哈希核对通过。正式入口为 [https://yydshly.github.io/1014_codex_project/010-evidence-research-lab/#synthesis](https://yydshly.github.io/1014_codex_project/010-evidence-research-lab/#synthesis)，详见 [010 发布记录](../projects/010-evidence-research-lab/deployment.json)。页面视觉和点击未自动复测，验证范围为实际 HTTP、字节和静态结构。

## 009 个人主页启发、研究沉淀与需求发现

009 先说明源库的个人主页展示与自动快讯能力，重点学习研究沉淀、入口引导和复习更新，形成“研究 → 实践 → 记录 → 展示 → 接触用户 → 获得反馈 → 更新研究”；再向需求发现工具、证据追查、任务验证和产品化扩展。全景图保留原库事实、我们的推导、本地实测与未来假设。

- [理解摘要与主页启发](https://yydshly.github.io/1014_codex_project/009-demand-discovery/#synthesis)
- [沉淀、入口与复习](https://yydshly.github.io/1014_codex_project/009-demand-discovery/#accumulation)
- [可缩放全景图](https://yydshly.github.io/1014_codex_project/009-demand-discovery/understanding.html)
- [真实探索档案](https://yydshly.github.io/1014_codex_project/009-demand-discovery/#explore)

2026-10-19 已通过已有 Actions 发布，35 个公网地址、34 份资源内容对照、77 个页内编号和 31 处锚点链接通过核对，包含既有五个项目入口。009 的 10 项测试与完整站点构建通过；总图 PNG 为 2000×4375，与 SVG 一并发布。公开模式只读实验快照，不请求本机 API 或执行模型。

本轮浏览器接入被 URL 安全策略拒绝，未进行新的视觉和点击验收；HTTP、结构、渲染与隔离行为测试的范围分别记录。正式地址、提交、工作流及资源核对见 [009 发布记录](../projects/009-demand-discovery/deployment.json)。
