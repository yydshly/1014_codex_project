# 010 · 从 Atypica 到 AI 社区：研究与思考档案

完整整理 2026-10-15 至 2026-10-19 的讨论：从 X 帖子、Atypica 的研究价值，走到 B/C 最小版本、停止实验，再到真实数据、身份记忆、娱乐社区、传统 NPC 与开放式玩法。编号和目录保持 010 不变。

**当前状态：原 B/C 产品实验保持停止；后续理解与扩展统一归档。** 合成资料试跑只证明流程能运行，未证明研究增益、真实付费需求或 Atypica 的效果。真实数据采集、人设模拟、AI 社区、游戏原型、真人评价、留存与付费验证均未执行。

## 当前理解 · 2026-10-19

我们区分两条路线：研究工具辅助客户需求调研，依靠真实资料、证据和真人验证；娱乐型 AI 世界依靠人物、共同历史、选择与后果，是否好玩需要体验验证。娱乐社区是后续设想，不能当作 Atypica 的已核实功能。

身份和记忆可以支持不同角色，但人物真实体感不等于预测真人准确。传统 NPC 也可以有记忆、目标、关系与动态剧情；大模型新增多少玩法，取决于自由表达能否形成可执行、有代价、后果不同的有效策略，而不是生成多少台词。

完整主题记录见 [DISCUSSION.md](DISCUSSION.md)，由 [专题内容源](web/archive/journey.mjs) 与 [问题库](web/archive/content.mjs) 构建。它涵盖入口、思考、已做事项、数据处理、产品分支、验证方法和核心问题；不是逐字聊天转录。原有设计、来源、报告和停止决定保留。

后续进一步讨论信息获取与经验沉淀，新增[研究与行动工作台规格](http://127.0.0.1:4184/#action-plan)：七步工作流、五类页面、六种关联对象、七天试用与实施顺序。已把 010 旧实验整理成[完整历史记录样例](data/research-action.example.json)，可在材料库下载；问题、判断、行动和经验的新编辑系统尚未实现。网页现有 7 个专题、26 个问题、34 条来源、23 份材料。

## 统一网页入口

启动后打开 [010 研究与思考档案](http://127.0.0.1:4184/)。同站编号入口为 `/1014_codex_project/010-evidence-research-lab/`。在项目总索引中找到固定编号 010，即可定位本目录。

网页阅读顺序：

1. [当前理解](http://127.0.0.1:4184/#understanding)、[研究入口与演进](http://127.0.0.1:4184/#origin)。
2. 七个专题：[研究价值](http://127.0.0.1:4184/#research-value)、[身份与记忆](http://127.0.0.1:4184/#identity-memory)、[真实数据](http://127.0.0.1:4184/#real-data)、[娱乐社区](http://127.0.0.1:4184/#community-design)、[NPC 与玩法空间](http://127.0.0.1:4184/#npc-gameplay)、[扩展与核心问题](http://127.0.0.1:4184/#extensions)、[流程产品与行动](http://127.0.0.1:4184/#action-plan)。
3. [完整问题库](http://127.0.0.1:4184/#discussion)、[来源目录](http://127.0.0.1:4184/#sources)、[实际 B/C 报告](http://127.0.0.1:4184/#experiment)。
4. [完整材料与 HTML / Markdown / JSON 导出](http://127.0.0.1:4184/#materials)。

原实验工具保留在 [B/C 工作台](http://127.0.0.1:4184/workbench/)。浏览归档不调用模型。

`npm run build` 生成 `web/dist/index.html` 和本目录 `DISCUSSION.md`。CSS、脚本、来源、研究材料、合成资料试跑及历史截图嵌入同一 HTML，可离线阅读和完整导出。构建只读取明确列出的文件，不打包 `.runtime` 或私人资料，不运行模型。仅本地整理，未发布线上演示。

以下为前期工具的历史运行截图：

![合成资料 B/C 真实模型运行截图](assets/preview.jpg)

| 信息 | 内容 |
| --- | --- |
| 固定编号 | 010 |
| 实现版本 | MVP v0.1.0，2026-10-15，Asia/Shanghai |
| 项目性质 | 原创设计；研究 Atypica 的方法，不宣称复现其私有模型或数据 |
| 本仓库 | [yydshly/1014_codex_project](https://github.com/yydshly/1014_codex_project) |
| 首个领域 | 微型烘焙商家的订单整理、生产汇总与分装工作流 |
| 产品使用者 | 为该领域寻找产品机会的个人开发者、产品顾问 |
| 真人研究对象 | 实际负责订单的店主或员工，与产品使用者分开 |
| 研究状态 | 已归档；本轮停止探索，实际增益未验证 |
| 与 009 的关系 | [009](../009-demand-discovery/README.md)保留平台地图和方法；010 实现资料与证据研究流程 |

## 保留的最小版本

输入一个明确的产品决策、目标人群和资料，输出最多 6 条发现的决策简报：用户的问题、当前办法、现有产品、证据支持的缺口、冲突和下一步验证。

首轮支持粘贴、TXT、Markdown、JSON 导入。人工卡片可定位到原文；B/C 公平对照重新从原文分析，不读取人工笔记。不加入人设模拟，不输出未经测量的市场占比。

## 阅读入口

- [MVP.md](MVP.md)：用户、范围、交互、核心流程和验收。
- [本地运行说明](web/README.md)：启动、导入格式、模型、数据存储与限制。
- [真实模型流程试跑记录](evaluation/bc-smoke-result.json)：合成资料，不是效果或商业需求验证。
- [完整合成试跑快照](data/bc-smoke-archive.json)：全部输入、B/C 结果、引用、11 份原始提示 / 输出 / schema / Markdown 文件；明确排除其他私有运行。
- [DATA.md](DATA.md)：来源准入、去重、证据、真人资料与留出数据。
- [EVALUATION.md](EVALUATION.md)：四组对照、公平预算、盲评与继续标准。
- [IMPLEMENTATION.md](IMPLEMENTATION.md)：模块、接口、运行边界与实施顺序。
- [SOURCES.md](SOURCES.md)：原始链接、固定参考版本与许可证。
- [RESEARCH.md](RESEARCH.md)：完成情况、设计判断与未验证假设。
- [资料登记](data/source-register.json)：6 条候选链接，尚非实验语料。
- [实验配置](evaluation/experiment.json)、[12 个开发问题](evaluation/briefs.json)、[真人场景题模板](evaluation/holdout-questions.template.json)、[评分表](evaluation/ratings.csv)。
- [四组提示词](prompts/arms.md)、[报告接口](contracts/report.schema.json)、[研究输入示例](data/study.example.json)。

## 验证框架

下表保留完整研究路线；本次仅实现 B、C。A 的联网和 D 的人设模拟没有执行入口。

| 组 | 方法 | 解释 |
| --- | --- | --- |
| A | 同一模型直接联网调研 | 整体产品相对现有做法的增益 |
| B | 同一模型直接读同一份冻结资料 | 排除数据覆盖差异 |
| C | 同一资料 + 结构化证据与反证流程 | 研究工程的增益 |
| D | C + 数据约束的人设模拟 | 模拟本身的增益 |

模型、总预算、问题和报告上限一致。B/C/D 禁止联网，底层资料相同；C/D 的整理、画像和模拟费用全部计入成本。

**D 没有超过 C，就关闭模拟；C 没有超过 B，就暂停扩展。** A 的差异单独解释为整体效果，不用来证明模型推理更强。

## 当前使用方式

需要 Node.js ≥22.15 和已登录的本机 Codex。无第三方依赖，无需新建 API 密钥。

~~~powershell
cd projects/010-evidence-research-lab/web
npm run dev
~~~

打开 [研究归档](http://127.0.0.1:4184)。如果需要查看原有工具，进入 [/workbench/](http://127.0.0.1:4184/workbench/)。归档页面不需要模型登录或调用；工具中的模型运行会消耗账户用量并发送正文。详细配置和检验命令见[运行说明](web/README.md)。仅本地展示，未发布线上演示。

仓库根目录检查：

~~~powershell
python scripts/project_catalog.py sync
python scripts/project_catalog.py check
~~~

未复制 Atypica 服务端代码，也未导入其公开数据集；固定版本与非商业许可见 [SOURCES.md](SOURCES.md)。原创文件未另行声明独立许可证。

[返回项目总索引](../../README.md)
