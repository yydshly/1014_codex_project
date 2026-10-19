# AI 方向探索：公开数据来源与边界

本页是 CrawlHive 通用化探索的独立原型，采集器为本仓库新增实现，不运行上游的币圈扫描逻辑。数据来自公开接口，无需 API key；没有调用模型或生成 AI 摘要。

## 固定来源

| 来源 | 公开入口 | 获取方式与数量 | 需要理解的边界 |
|---|---|---|---|
| Hugging Face Blog | <https://huggingface.co/blog/feed.xml> | RSS 最近 12 条 | 官方站点同时收录社区作者；不能将每条文章视作 Hugging Face 官方立场。 |
| Google AI Blog | <https://blog.google/innovation-and-ai/technology/ai/rss/> | RSS 最近 12 条 | Google 自身发布的新闻与产品描述，未独立验证产品效果。 |
| GitHub AI & ML Blog | <https://github.blog/ai-and-ml/feed/> | RSS 最近 12 条 | GitHub 官方报道和教程，不等于已试用或审计。 |
| GitHub 公开仓库 | <https://api.github.com/search/repositories> | 三组固定 topic，按当前 stars 降序，各最多 6 个仓库；按 URL 合并重复 | 高星仓库发现，不是实时趋势、增长排行或新发布榜。未克隆运行。 |

GitHub 固定查询为 `topic:coding-agent archived:false`、`topic:multimodal archived:false`、`topic:llm-tools archived:false`。不接受任意用户 URL、任意 GitHub 查询或私有仓库凭据。公开接口存在匿名限流，失败会显示错误并保留旧结果。

## 实际处理

1. 每个 HTTP 请求最长 18 秒、响应最多 2.6 MB；每个 RSS 只取前 12 个条目，GitHub 三次搜索各取 6 项。
2. RSS 标题、短摘、原链接、作者与发布时间取自订阅原文。短摘去除 HTML 后最多 200 字符，标注为原文摘录；没有日期时保存 `null`，不用采集时间冒充发布日期。
3. GitHub 短摘来自仓库 description。创建时间、仓库信息更新时间和最后推送时间分别保留；星数为采集时总数，许可证字段缺失则保持未知。
4. 规则按英文标题与短摘给信息添加主题标签。带有发布、更新、Gemini、Copilot 等词的 RSS 条目可能被标为“产品线索”；这只是可解释的候选分类，未声称已试用，用户筛选时仍应阅读原文。
5. 用规范化原文 URL 的 SHA-256 前 20 位生成稳定 ID，去除 `utm_*`、`fbclid`、`gclid`；同 URL 合并。当前没有语义事件聚类，不会把内容相似误报成已确认的同一事件。
6. 来源成功后仅替换该来源条目；失败保留原数据并标明过期。每个来源的成功或失败结果、请求概要和时间写入运行日志，最多保留 20 轮。

## 本地运行

在 `projects/013-crawl-hive/web` 中运行：

```text
node scripts/refresh-explore.mjs
```

可只更新预设来源，例如 `node scripts/refresh-explore.mjs google-ai github-repos`。命令写入 `explore/snapshot.json` 作为初次真实采集快照，同时在 `.runtime/explore-state.json` 保存本地缓存。快照包含采集时间；页面不应将它显示为持续在线监控。

本地开发服务器挂载 `createExplorerApi({ webRoot })` 后支持：

- `GET /api/explore/state`：条目、来源、最近成功采集时间、最近运行记录和能力声明。
- `POST /api/explore/refresh`，JSON `{ "sourceIds": ["google-ai"] }`：仅按需启动后台采集并返回 `202`；空数组或省略来源时采集全部预设来源。
- `GET /api/explore/status`：本次运行进度和各来源结果。

没有自动定时刷新、模型分析、登录、支付或通知。收藏和阅读状态由前端管理。静态部署只能读取已保存的快照，真实刷新需要本地服务器。接口返回内容不含本地绝对路径或凭据。

## 引用与再利用

本原型只展示来源短摘与链接，不复制全文，不引入上游源代码。新闻与博客版权归各作者及发布方；GitHub 仓库许可证以每个仓库当前声明为准，列表中的许可证字段不能代替使用前审阅 LICENSE。页面内每张卡片均应保留原文入口与来源名称。
