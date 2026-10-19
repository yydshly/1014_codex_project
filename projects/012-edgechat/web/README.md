# 012 EdgeChat 研究展示网页

原生 HTML / CSS / JavaScript，Node.js 20 或更高版本，无第三方依赖。页面不连接上游后端或 AI 服务；示意消息仅在当前浏览器内显示，不保存。

## 启动与构建

在本目录执行：

```powershell
npm run dev
```

默认地址：`http://127.0.0.1:4182/1014_codex_project/012-edgechat/`。用 PORT 环境变量可更换端口。`/` 跳转到编号入口，`/1014_codex_project/` 提供项目总入口。

```powershell
npm run check
npm run build
```

产物为 dist/，包含 index.html、styles.css、app.js、data.js 与 favicon.svg。资源采用相对路径、章节采用页内锚点，可部署到 `/1014_codex_project/012-edgechat/`。

同时生成 `dist/standalone.html`，内嵌全部样式、研究数据和交互逻辑。直接用浏览器打开该文件即可离线阅读与操作；只有点击上游来源链接时才需要网络。

页面前部新增“一张图看完我们的理解”。构建会从项目 `assets/` 复制 `edgechat-summary.png` / `.svg`，并把 PNG 及 SVG 下载链接内嵌到单文件版本，避免离线阅读丢图。图片以原始分辨率提供下载。

原有 003 服务的通用 dist 映射也能读取此构建。静态发布按根部署约定汇总全部已登记项目，使用现有 GitHub Pages 子路径。2026-10-19 已发布并完成公网核验，正式入口为 [理解摘要](https://yydshly.github.io/1014_codex_project/012-edgechat/#synthesis)，具体范围见项目 deployment.json。

## 文件职责

- index.html / styles.css：六项理解摘要、九章研究、原总结图引导、响应式布局、架构图、共同理解与产品判断、焦点和减少动画支持。
- data.js：版本、18 处上游来源、八项能力、六个组件、四条流程、六类扩展假设及三项成熟产品比较参考。
- app.js：标签键盘操作、能力与扩展方向切换、流程播放、来源搜索和章节导航。
- server.mjs：仅绑定本地回环地址，提供预览和项目总入口。
- build.mjs：统一发布入口，执行语法、页内编号、锚点、资源与静态白名单检查。
- scripts/build.mjs：复制静态产物、固定来源清单与研究笔记，内嵌原图生成离线版本。
- scripts/verify-sources.mjs：读取固定提交的原始文件并写入来源核验清单。

## 来源复查

```powershell
node scripts/verify-sources.mjs
```

该命令联网访问 GitHub，结果写入项目 research/upstream.json，记录 HTTP 状态、字节数和 SHA-256；不启动上游应用。更新上游版本前，应先阅读变化、修订研究内容，再修改 data.js 并重建。

浏览器已检查桌面和手机界面及主要交互。上游后端部署、真实桥接和性能仍待实测。

新增第 08 章“共同理解与产品判断”，将已有能力、可开发扩展、工程复用价值和商业判断分别标记，并记录“保留研究，暂不开发通用聊天产品”的当前取舍。产品比较链接单列，不混入 18 处固定提交上游来源。
