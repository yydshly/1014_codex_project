# 来源、版本与引用范围

前期访问日期 2026-10-15；后续讨论整理日期 2026-10-19，Asia/Shanghai，按来源单独标记。公开可见不等于获准批量采集、训练或商用。本项目未镜像第三方全文、图片、个人资料或原项目代码；本次整理不代表重新逐站审核。

## 领域候选资料

| ID | 原始来源 | 线索与边界 |
| --- | --- | --- |
| U001 | [家庭烘焙店手工订单](https://www.reddit.com/r/smallbusiness/comments/1ll3itm/small_family_bakery_overwhelmed_by_manual_orders/) | 聊天/电话订单、生产数量整理与重复录入；用户自述 |
| U002 | [Bakery Ordering and Invoice systems](https://www.reddit.com/r/smallbusiness/comments/1dfzscy/bakery_ordering_and_invoice_systems/) | 电话订单录 Excel，再手算与录入；不能外推全部经营者 |
| U003 | [订单跟踪平台求助](https://www.reddit.com/r/Baking/comments/1joxysv/best_platforms_to_automate_bakery_order_tracking/) | Square 与表格同步；规模可能超出目标，边界样本 |
| U004 | [分装清单与公式](https://www.reddit.com/r/googlesheets/comments/1r15miy/how_to_turn_my_sheet_of_baked_goods_orders_into_a/) | 有公式方案，保留为反证线索；不复制私人表格、地址与姓名 |
| C001 | [Bakesy 定价](https://www.bakesy.app/pricing) | 核实现有方案；功能表不能独立证明缺口 |
| C002 | [Bake That Batter](https://www.bakethatbatter.com/home-bakery-software) | 已有订单表单与业务管理，新工具需明确增益 |

帖子以稳定 ID 定位，已检查链接但未取得语料使用许可，未保存正文。产品网页无固定 tag；正式实验前建立获准摘录、时间与内容哈希。当前登记不是正式语料。

## 方法与基础设施

- [Atypica Scout](https://atypica.ai/features/scout-agent)：动态文档，借鉴观察/综合/回查与定性边界，未复制实现。
- [Atypica 评测复盘](https://atypica.ai/research/ai-user-research-agent-evals)：2026-07-27 文章，借鉴人设趋同、虚构引文、夸大覆盖等失败类别。
- [CSFBench 固定版本](https://huggingface.co/datasets/atypica/consumer-simulation-fidelity-benchmark/tree/8b1a03fbb0a9e61a926c4df2307279531dad389b)：元数据返回该 revision，数据 CC BY-NC 4.0；代码另列 Apache-2.0。本项目未下载样本/复制代码，只作非商业方法参考，不能据此转用于商业研究或模型训练；其分数不作为本项目成绩。
- [个体模拟论文固定 v3](https://arxiv.org/abs/2411.10109v3)：2026-06-28 版本，用于理解访谈/问卷和留出评测；未复制图表与数据。
- [eve 入门](https://eve.dev/docs/getting-started)、[原仓库](https://github.com/vercel/eve)：候选框架，当前未安装/复制；精确版本、许可证在实现时从所锁版本核实，动态文档不是依赖锁。
- [GitHub issues REST](https://docs.github.com/en/rest/issues/issues)：可选技术反馈读取方式；不意味着任意内容可再分发，本次未调用该 API。
- [Reddit 平台规则](https://support.reddithelp.com/hc/en-us/articles/360043512931-Don-t-break-the-site)、[数据访问说明](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data)、[API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)：按实际用途确认适用权限；当前无获准的批量连接器。

## 原创与许可

### 当前运行依赖记录

- Node.js 本机验证版本 22.15.0，采用内置 HTTP、SQLite 和文件模块；[原仓库 v22.15.0](https://github.com/nodejs/node/tree/v22.15.0)，Node 核心为 MIT，捆绑组件按其原许可证。本项目未复制运行时源码，无 npm 生产依赖。
- 本机 Codex CLI 0.162.0-alpha.17.2，通过子进程调用，不复制、不再分发其二进制或代码。[官方命令文档](https://learn.chatgpt.com/docs/developer-commands)已核对；[上游仓库](https://github.com/openai/codex)为 Apache-2.0，但本机 alpha 构建对应提交未确认，不虚构固定上游 commit。
- 复用本仓库 009 的 CLI 适配结构思路，改为无检索、无工具、独立临时会话，加入本项目 JSON 契约、逐字引用校验、冻结语料、计量和运行记录；未复用它的公开资料或研究结果。
- [sample.json](web/sample.json) 为本项目原创的明确合成测试文本。报告和截图中的合成用户、虚构品牌不是外部引用，不得用于宣称真实需求成立。
- eve 仅作为已研究候选；查询到 0.79.1 要求 Node ≥24，本次未安装到项目、未调用 API。当前工作流不依赖 eve。

领域范围、四组实验、预算、阈值、提示词、契约和验收顺序为本次原创设计；阈值不是上游实验结论。没有可据此声明已复现的 Atypica 服务端原仓库。

本仓库未声明统一许可证，本项目不擅自补充授权。未来引用代码/图片时另记原仓库、精确 tag/commit、许可证与改动。

## 原始讨论入口与归档范围

- [gkxspace 的原始 X 帖子](https://x.com/gkxspace/status/2109970698303373750)：本轮研究的起点。前期对话记录转述其组合使用 Claude / Codex 与 Atypica 做研究、制作网站并获客的经历。约 20 个注册、8 个付费与 ChatGPT 推荐归因均按作者自述保留，未独立验证，不据此推断 Atypica 的单独贡献。
- [归档内容源](web/archive/content.mjs)：整理本轮研究路径和 10 个关键问题，明确分析、作者自述、厂商资料与未验证事项；它不是完整逐字聊天转录或对私有架构的确认。
- [完整合成试跑快照](data/bc-smoke-archive.json)：从已核对 run R-9397508f-3e8f-4ff6-a62b-0b37088fafbc 归档，只有原创 synthetic 输入；保存原始提示、模型输出、schema、两份报告、证据、用量与哈希。构建归档不会扫描 .runtime 或复制其他真实业务资料。

2026-10-15 阶段归档沿用当时记录。后续来源补充如下；动态页面的现状可能变化，固定版本只对明确记录的 revision / tag / 论文版本成立。网页目录自动收集本文件全部外部链接，不会因此自动抓取外站或将内容加入模型语料。

## 2026-10-19 · 角色、真实数据、娱乐社区与 NPC

这些入口在后续讨论中用于核对或方法参考；本次统一整理链接、版本和使用边界，不复制其数据、图表、代码或游戏资产。

| 来源 | 固定版本 / 核查范围 | 用途、许可与改动 |
| --- | --- | --- |
| [Generative Agents 论文](https://arxiv.org/abs/2304.03442) | arXiv:2304.03442v2，2023-08-06 | 记忆、规划、反思与小镇互动；仅摘要，不作留存证明；未复制素材 |
| [产品发现验证研究](https://arxiv.org/abs/2603.29890) | arXiv:2603.29890v1，2026-03-10；作者 Zichao Wang、Alexa Siu | 区分整体分布与个体一致性；HTML 标示 CC BY-NC-SA 4.0，未复制数据或图表 |
| [Generative Agents 作者仓库](https://github.com/joonspk-research/generative_agents) | 未锁 commit，未安装或复现 | 仅公开架构参考；如复用代码，应先锁定版本、许可证和子资源使用范围；本项目无代码改动 |
| [AI Town](https://github.com/a16z-infra/ai-town) | README / 主许可证 MIT；未锁 commit | 共享状态与模拟引擎的起步实现；未引入代码、美术或依赖，资产需另核许可 |
| [Façade 演示论文](https://cdn.aaai.org/ojs/18733/18733-52-22385-1-10-20210928.pdf) | Mateas、Stern，AIIDE 2005，153–154 页 | 历史对照：动态叙事、角色协同和开放文字输入；版权按原文，只有链接与概述 |
| [Façade 架构论文](https://ojs.aaai.org/index.php/AIIDE/article/view/18722) | 2005 年固定论文 | 传统角色与叙事组织方法；未移植内容或实现 |
| [Ubisoft Teammates 英文介绍](https://news.ubisoft.com/en-us/article/3mWlITIuWuu0MoVuR6o8ps/ubisoft-reveals-teammates-an-ai-experiment-to-change-the-game) | 2025-11-21 官方研究实验说明 | 语音意图与伙伴行动连接；实验演示不等于商业与留存证明 |
| [Teammates 中文说明](https://zh-cn.ubisoft.com/news_detail?id=4286) | 2025-11-24 官方说明 | 发布时的封闭测试状态，不据此推断当前开放范围 |
| [Player-Driven Emergence](https://www.microsoft.com/en-us/research/publication/player-driven-emergence-in-llm-driven-game-narrative/) | IEEE CoG 2024 研究页，28 位玩家 | 叙事新节点与玩家共创；不能外推玩法倍数或长期留存 |
| [Emergence 项目](https://www.microsoft.com/en-us/research/project/emergence/) | 动态研究项目页 | 区分已研究的叙事/角色与未来游戏世界愿景 |
| [Reddit Data API Terms](https://redditinc.com/policies/data-api-terms) | 2026-10-19 讨论时读取；动态条款 | 商业 API、训练、用途与删除边界；未取得接入或内容许可，未采集正文 |
| [Reddit Developer Terms](https://redditinc.com/policies/developer-terms) | 检索摘要参考，未完整逐条审核 | 不把“不微调”等同任意使用；具体项目仍需核对适用条款 |
| [Stack Overflow licensing](https://stackoverflow.com/help/licensing) | 2026-10-19 讨论时读取 | 贡献按时间分 CC BY-SA 版本，2018-05-02 起为 4.0；未复制正文，访问与内容许可分别确认 |
| [GitHub Issue comments API](https://docs.github.com/en/rest/issues/comments) | 动态官方接口文档 | 读取技术反馈的可能方式；本次未新增调用或采集，接口不替代内容授权 |

本次原创部分为专题组织、判断框架、事件卡方案、R0/R1/R2 未执行对照、虚构公寓与协商玩法示例。新示例不是引用的真人证言，也不是 Atypica 的已实现功能。全文在 [DISCUSSION.md](DISCUSSION.md)，结构化源在 [journey.mjs](web/archive/journey.mjs)。
