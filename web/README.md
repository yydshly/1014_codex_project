# 项目研究首页

首页读取 `projects.json`，按固定编号升序列出全部研究摘要、配图、记录与来源。总索引和应用发布分别维护：完整目录目前为 001—015，`pages.json` 仅控制已上线应用的构建。

## 公开模式

运行根目录的 `node scripts/build_pages.mjs` 后，全部研究记录与配图复制到 `_site/projects/`，完整目录写入 `_site/projects.json`。`_site/entries.json` 包含 `mode: static`、`publishedProjects` 和已上线的入口映射。

首页默认显示全部项目；已发布应用提供真实入口，其他项目提供研究记录并注明需本地运行或没有独立演示。点击未发布项目的配图打开研究记录，不链接不存在的演示地址。公开构建把全部 README 同时写入 `records.json`，目录加载时预先读入，打开记录无需再次等待 Markdown 请求。

## 本地模式

003 的本地服务可提供同一首页与已有构建，入口为 `http://127.0.0.1:4175/1014_codex_project/`。本地 `entries.json` 不带静态模式声明，保留原有房间、Agent 工作室等本地入口。涉及模型和服务端的项目仍按其运行说明启动。

完整核对见 [研究收录记录](../docs/CATALOG_AUDIT.md)。
