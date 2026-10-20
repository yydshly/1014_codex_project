# 013 中文研究网页与知向工作台

纯 HTML、CSS、原生 ES Module，无字体 CDN 或第三方前端依赖。原研究页展示固定源码分析；新增 `explore/index.html` 是独立 AI 探索产品，Node 本地服务可真实读取四个预设公开来源，不需要密钥。没有运行上游服务或调用模型。

## 启动与构建

```powershell
cd F:\codex_project\1014_codex_project\projects\013-crawl-hive\web
npm run dev
```

本地入口：<http://127.0.0.1:4183/1014_codex_project/013-crawl-hive/>。PORT 环境变量可更换端口，服务默认只监听 127.0.0.1。

产品入口：<http://127.0.0.1:4183/1014_codex_project/013-crawl-hive/explore/index.html>。总入口：<http://127.0.0.1:4183/1014_codex_project/>，保留原有项目并提供 013 双入口。

```powershell
npm run check
npm run build
```

输出 dist/，包含页面、脚本、样式、图片、研究记录和许可证。可复制到 _site/013-crawl-hive/，配合总站点一起发布。当前未发布，不能登记线上演示地址。

## 文件

- index.html：四环节主线、11 个延伸章节与无障碍结构。
- styles.css：原有桌面、手机、减少动态效果与打印样式。
- four-pillars.css：四环节正文、来源表格、搜索路径、关键词交互和信号示意。
- keyword-lab.js：复现共享关键词规则与词表规范化，无网络请求。
- data.js：12 项能力、8 步链路、12 项改造、3 组示例、26 条证据。
- app.js：能力筛选、键盘切换、流程解说、截图放大、成本假设、教学演示、来源搜索与阅读目录。
- media/：3 张固定版本的上游文档截图。
- scripts/：本地预览、资源／引用检查与静态构建。
- explore/：产品界面、规则引擎、真实数据快照与来源说明。`server.mjs` 只用于本地采集，不打包发布；收藏与方向偏好保存在当前浏览器。
- scripts/refresh-explore.mjs：`npm run refresh:data` 主动更新真实快照；运行缓存保存在忽略的 `.runtime/`。

## 交互与范围

关键词交互支持输入包含词、排除词和文本，解释 OR、排除优先、空包含与子串匹配；结果仅代表关键词这一层。

原研究页的教学示例使用固定虚构数据，不发出请求；成本计算器的单价和任务数是可编辑假设，不是实际报价。工作台独立显示公开 RSS/GitHub 原文短摘，并在本地服务下支持按需真实刷新；静态构建使用带采集时间的快照。关键词只筛选已采集内容，不是全网语义检索。

能力和链路使用 Tab、方向键、Home、End 操作；图片对话框支持 Esc。手机目录可展开，点击章节后关闭。内容保留来源与验证状态，完整静态文字见上一级 RESEARCH.md。

资源使用相对地址，兼容 /1014_codex_project/013-crawl-hive/。构建完成后，003 的目录网关可以映射整个 dist/，013 产品页也包含在内。总入口多页面名称由根 `web/entries.json` 维护，发布时需一起复制；详细约定见根 `docs/DEPLOYMENT.md`。
