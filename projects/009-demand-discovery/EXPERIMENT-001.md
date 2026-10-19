# 009 · 实验001：从宽泛领域自动发现人群与问题

运行日期：2026-10-15。实际运行编号：`5e8f1bda-3f10-4745-be71-ebf0da5146ca`。

## 本轮输入

- 领域：小型本地服务经营（local service businesses）。
- 市场：英语市场，重点观察独立经营者与小团队。
- 实现边界：个人开发者可实现的网页工具；先发现具体人群与任务，不提前指定痛点，优先真实从业者经历。

输入未指定清洁、擦窗、汽车精洗或排班问题，这些由第一轮联网调查从实际讨论中选出。

## 执行方式

本地 Node 服务通过官方 Codex 非交互模式调用 OpenAI。实际执行文件报告版本 `codex-cli 0.162.0-alpha.17.2`，使用 Codex 自带默认模型，没有显式指定模型名称。

本机没有独立 OpenAI API Key，Codex 已登录 ChatGPT。执行使用其正常认证流程，没有读取、导出或复制登录令牌，没有使用 MiniMax 或其他模型供应商。

每轮开启 live web search，要求结构化 JSON 输出。shell、文件修改、子代理、私人连接器等工具被禁用，使用只读执行范围。网页只显示公开工具动作和结构化决策摘要，不展示模型内部推理。

官方依据：[非交互模式与结构化输出](https://learn.chatgpt.com/docs/non-interactive-mode)、[CLI 搜索与执行说明](https://learn.chatgpt.com/docs/developer-commands?surface=cli)。这是本机原型路径；对外产品需另行设计服务和数据授权。

## 实际运行结果

北京时间 11:35:18 启动，11:40:25 完成，约5分7秒。耗时只描述本轮，不保证后续速度。

| 项目 | 本轮记录 |
| --- | ---: |
| 连续调查阶段 | 3 |
| 识别人群 | 3 类 |
| 问题候选 | 3 个 |
| 来源链接 | 10 条 |
| 检索调用 | 5 次；一次可以包含多个查询 |
| 页面打开动作 | 6 次 |
| 可与打开记录关联的来源 | 6 条 |
| 本地逐字核对成功的引文 | 0 条 |

剩余4条是模型报告的来源链接，未取得可关联的页面打开记录，网页标为待核查。即使有打开动作，也不能证明全文读取成功。相关候选引用的页面在本地独立读取阶段未成功取得可核对文本；没有把这些引文冒充逐字核验结果。

## 第一轮：发现人群

1. 管理少量承包清洁工的住宅清洁公司经营者／排班负责人。
2. 利用学校假期经营上门汽车精洗的单人兼职经营者。
3. 保留办公室本职工作的早期擦窗经营者。

第一轮结合任务与情境选择清洁公司的排班负责人继续调查：同一讨论既有具体约束，也有经营者后续已经奏效的办法，适合追查办法的适用边界。

## 第二轮：沿新线索寻找问题

继续追问：固定周期和地区分组生效后，新增客户、临时取消、天气或病假改期还需要哪些人工操作？

材料中出现周期客户偏好、团队安排、路线、候补名单与补约等不同任务。系统保留其差异，不因为都发生在日历中就合并成一个产品需求。

## 第三轮：补充经历、已有办法和反例

| 候选 | 最终判断 | 依据 |
| --- | --- | --- |
| 周期排班与剩余人工协调 | 优先核实并收窄 | 有人工安排与遗漏经历，但固定周期/地区分组及共享日历已有有效反例；相邻任务只部分对应 |
| 临近服务取消后的空档处理 | 有条件继续调查 | 有相似取消经历，但尚未证明候补工具能增加实际补单，可能主要依赖政策或可接单客户 |
| 天气、病假等主动取消后无法补约 | 暂时搁置 | 主要证据指向可工作时间不足；已有等下次固定服务或只在有余量时补约的流程 |

判断状态按第三轮显式决策统一：保留“优先核实、继续调查、暂时搁置”，没有把未知状态默认映射为继续推荐。没有重新生成或补造研究内容。

## 原始来源

完整原话位置、解释、读取状态与公开动作见 [data/discovery-latest.json](data/discovery-latest.json)。下列链接来自本轮自动结果；“打开记录”指工具事件可关联，不代表独立逐字核验。

| 来源 | 工具打开记录 |
| --- | --- |
| [清洁公司怎样安排工作](https://www.reddit.com/r/sweatystartup/comments/1hbic3f/cleaning_company_owners_whats_your_process_for/) | 有 |
| [单人上门汽车精洗经营过程](https://www.reddit.com/r/AutoDetailing/comments/wbmr8g/) | 有 |
| [擦窗经营者的第一年](https://community.windowcleaner.com/t/1st-year-in-business-revenue/52965) | 有 |
| [Jobber 社区：周期与新增客户排班](https://community.getjobber.com/discussions/job-details-scheduling/scheduling-with-recurring-customers-and-new-customers-/2963) | 待核查 |
| [清洁工关于取消规则的求助](https://www.reddit.com/r/housekeeping/comments/1sqnswb/residential_cleaner_needed_help_with/) | 有 |
| [取消两位客户后怎样补约](https://www.reddit.com/r/housekeeping/comments/1iqwf0w/cancelled_two_clients_dont_even_know_when_i_can/) | 有 |
| [Jobber 帮助：Visits](https://help.getjobber.com/en/articles/visits) | 待核查 |
| [清洁团队的软件与流程求助](https://www.reddit.com/r/cleaning_business/comments/1bztyub/app_or_software_recommendations_for_my_cleaning/) | 有 |
| [清洁服务排班软件讨论](https://www.reddit.com/r/smallbusiness/comments/1bscjmy/scheduling_software_for_cleaning_houses/) | 待核查 |
| [临时取消规则讨论](https://www.reddit.com/r/cleaningbusiness/comments/1wbs53d/cancellation_policys/) | 待核查 |

开发时另用当前会话联网工具抽查了首条清洁公司讨论及 Jobber 社区入口：首条确实包含经营者后续采用固定周期与地区分组的反馈。这次人工抽查没有计入自动管线的本地逐字核验计数。

## 局限与下一步

- 只跑通一个宽泛领域，不能证明对所有行业的效果。
- 结果明显受英语社区、可见索引和模型选源影响；资料包含历史讨论，当前问题是否仍然存在需要核实。
- 账号身份与独立性未验证，未推断市场规模或付费意愿。
- 页面摘录与完整原文不同，模型报告链接与工具观测链接分别标记。
- 本地页面独立读取未成功核验引文，需改进授权读取或证据导入；没有绕过访问限制。
- 优先继续检查有效反例能否覆盖多数用户，以及剩余人工协调究竟是信息操作还是现实产能冲突。

[返回项目简介](README.md)
