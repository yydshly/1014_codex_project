# GitHub 项目研究集

把最近遇到的优秀 GitHub 项目，整理成可以查阅、复现和展示的研究记录。

这里是总入口：按编号浏览项目摘要，进入各子项目查看研究笔记、运行方式、界面截图与演示。每个子项目独立保存代码和依赖，适合同时研究不同技术栈。

本地可从 [项目首页](http://127.0.0.1:4175/1014_codex_project/) 浏览全部项目。启动 `projects/003-lofi-room/web/start.ps1` 后，001、002 的已有构建和 003 的两个场景共用这个入口；003 同时保留 [夜半小屋](http://127.0.0.1:4175/1014_codex_project/003-lofi-room/?view=room) 与 [Agent 工作室](http://127.0.0.1:4175/1014_codex_project/003-lofi-room/?view=workspace)。这些是本地地址，003 的线上演示尚未发布。

网页入口：[研究总览](https://yydshly.github.io/1014_codex_project/) · [014 赛博小雅研究](https://yydshly.github.io/1014_codex_project/014-cyber-xiaoya-study/)。发布与验证见[部署说明](docs/PAGES.md)。

## 项目索引

编号按收录顺序从 `001` 递增，目录采用 `projects/001-project-name/`。编号创建后保持不变，首页始终按编号升序展示。

<!-- PROJECTS:START -->

| 编号 | 项目 | 摘要 | 状态 | 研究记录 | 来源链接 | Web 演示 |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | [Archify：交互式代码库图解](projects/001-archify/README.md) | 已本地复现中英文交互式代码库导览，展示 Archify 的生成链路、组件讲解和固定版本源码证据。 | 已复现 | [研究笔记](projects/001-archify/RESEARCH.md) | [GitHub](https://github.com/tt-a1i/archify) | — |
| 002 | [雨夜提灯小幽灵：Three.js 交互场景](projects/002-rainy-ghost/README.md) | 已本地复现雨夜提灯小幽灵，支持雨滴碰撞与渐湿、镜头环绕、拖拽回弹和水面提灯交互。 | 已复现 | [研究笔记](projects/002-rainy-ghost/RESEARCH.md) | [GitHub](https://github.com/mrdoob/three.js) | — |
| 003 | [夜半小屋与 Agent 工作室：3D 协作空间](projects/003-lofi-room/README.md) | 人物随目标到白板讨论、电脑入座、桌边检查与当面交接；MiniMax 驱动真实角色、语音与交付，保留原房间及目标验收。 | 已完成 | [研究笔记](projects/003-lofi-room/RESEARCH.md) | [GitHub](https://github.com/mrdoob/three.js) | — |
| 004 | [需求研究入口与采集实践](projects/004-jasonzhu-ai/README.md) | 已整理 10 个中英文网站入口，支持按研究目的筛选、生成检索式与追加采集计划；保留原话样本、来源限制和后续核实方法。 | 研究中 | [研究笔记](projects/004-jasonzhu-ai/RESEARCH.md) | [GitHub](https://github.com/zhuyansen/jasonzhu.ai) | — |
| 005 | [小汐：AI 虚拟角色互动实验](projects/005-cyber-companion/README.md) | 已跑通真实中文对话、MiniMax 语音、Live2D 嘴型与表情、打断重听和模拟弹幕；全本地推理及真实直播接入待验证。 | 研究中 | [研究笔记](projects/005-cyber-companion/RESEARCH.md) | [GitHub](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | — |
| 006 | [随机门：源库原理、偶遇体验与作品馆](projects/006-random-doors/README.md) | Four-Seasons 以固定种子和季节参数驱动三维场景；我们探索六场景随机遇见、参与与手记回访，让已有作品重新被发现，并延伸作品馆、故事回响等方向。 | 研究中 | [研究笔记](projects/006-random-doors/RESEARCH.md) | [原帖](https://x.com/techartist_/status/2109737086601556195) | [演示](https://yydshly.github.io/1014_codex_project/006-random-doors/research.html) |
| 007 | [原创参考图到 Blender：月门水庭](projects/007-autumn-courtyard-blender/README.md) | 已将原创月门水庭的 Blender 几何接入网页，支持旋转、缩放、平移、机位切换与线框；保留图像对照、真实环绕和模型生成三维的研究说明。 | 已复现 | [研究笔记](projects/007-autumn-courtyard-blender/RESEARCH.md) | [GitHub](https://github.com/xikhar/atlas) | — |
| 008 | [Specreel：004 需求采集页面演示生成实测](projects/008-specreel/README.md) | 已用004真实操作生成三条原生与中文回放及MP4，验证更新标记；记录网址推荐、中文字体与播放节奏的限制。 | 已复现 | [研究笔记](projects/008-specreel/RESEARCH.md) | [GitHub](https://github.com/specreel/specreel) | — |
| 009 | [需求发现：从个人网站到 AI 研究工具](projects/009-demand-discovery/README.md) | 已用本机OpenAI跑通三轮自动探索：从宽泛领域识别人群、追查问题与反例，展示真实查询和来源，支持停止、历史及导出。 | 研究中 | [研究笔记](projects/009-demand-discovery/RESEARCH.md) | [GitHub](https://github.com/yydshly/1014_codex_project) | — |
| 010 | [Atypica 与 AI 用户研究：完整归档](projects/010-evidence-research-lab/README.md) | 完整归档原帖、20条来源、10个关键问题、MVP设计、B/C完整报告与21份材料；本轮探索已停止，额外价值未证实。 | 已归档 | [研究笔记](projects/010-evidence-research-lab/RESEARCH.md) | [GitHub](https://github.com/yydshly/1014_codex_project) | — |
| 011 | [古人说唱 Battle：AI 视频制作流程研究](projects/011-ancient-rap-battle/README.md) | 已制作《敬风霜》63.28秒舞台版：完整用户歌曲、双人舞台与观众反打，结合既有人物表演、灯光运镜及合成现场声；保留原版对照。 | 研究中 | [研究笔记](projects/011-ancient-rap-battle/RESEARCH.md) | [GitHub](https://github.com/10291124jcjc-dotcom/ancient-rap-battle) | — |
| 012 | [EdgeChat：自部署聊天系统原理研究](projects/012-edgechat/README.md) | 已整理能力、架构、网页模块化与六类产品扩展假设，补充成熟方案下的价值判断；保留研究，暂不推进通用聊天产品。 | 研究中 | [研究笔记](projects/012-edgechat/RESEARCH.md) | [GitHub](https://github.com/aozorae/Edgechat) | — |
| 013 | [CrawlHive：跨平台信息监控的能力与本质](projects/013-crawl-hive/README.md) | 保留四环节源码研究，新增知向AI探索工作台：4个公开来源、真实采集快照、方向与关键词筛选、规则分析、收藏导出及采集记录。 | 研究中 | [研究笔记](projects/013-crawl-hive/RESEARCH.md) | [GitHub](https://github.com/h100envy/crawl-hive) | — |
| 014 | [赛博小雅：真人拟人化效果与模型依赖研究](projects/014-cyber-xiaoya-study/README.md) | 真人互动角色研究：识别、语言、声音与视觉模型提供听想说动，工程负责同步和打断；价值在在场感，扩展到陪练、讲解、直播与角色记忆。原作源码及完整闭环待核验。 | 研究中 | [研究笔记](projects/014-cyber-xiaoya-study/RESEARCH.md) | [原帖](https://x.com/huoshan007/status/2109919568617484522) | [演示](https://yydshly.github.io/1014_codex_project/014-cyber-xiaoya-study/) |

### 项目配图

#### 001 · Archify：交互式代码库图解

![001 Archify 本地演示：交互式结构图、组件讲解与固定版本源码证据。](projects/001-archify/assets/preview.png)

001 Archify 本地演示：交互式结构图、组件讲解与固定版本源码证据。

[查看项目](projects/001-archify/README.md)

#### 002 · 雨夜提灯小幽灵：Three.js 交互场景

![002 雨夜小幽灵实际运行截图：雨滴命中斗篷、湿润材质、暖色提灯与水面倒影。](projects/002-rainy-ghost/assets/rain-impact.jpg)

002 雨夜小幽灵实际运行截图：雨滴命中斗篷、湿润材质、暖色提灯与水面倒影。

[查看项目](projects/002-rainy-ghost/README.md)

#### 003 · 夜半小屋与 Agent 工作室：3D 协作空间

![003 真实 Agent 协作运行截图：开发员走到窗边电脑并入座处理任务，人物动作随目标推进，同项目保留原房间。](projects/003-lofi-room/assets/workspace-actions-computer.png)

003 真实 Agent 协作运行截图：开发员走到窗边电脑并入座处理任务，人物动作随目标推进，同项目保留原房间。

[查看项目](projects/003-lofi-room/README.md)

#### 004 · 需求研究入口与采集实践

![004 需求研究入口：按目的选择网站，查看适用场景、搜索模板和原文阅读要点。](projects/004-jasonzhu-ai/assets/research-entries.png)

004 需求研究入口：按目的选择网站，查看适用场景、搜索模板和原文阅读要点。

[查看项目](projects/004-jasonzhu-ai/README.md)

#### 005 · 小汐：AI 虚拟角色互动实验

![005 小汐实际运行截图：Live2D 角色、真实模型聊天、中文语音与音频驱动嘴型。](projects/005-cyber-companion/assets/preview.jpg)

005 小汐实际运行截图：Live2D 角色、真实模型聊天、中文语音与音频驱动嘴型。

[查看项目](projects/005-cyber-companion/README.md)

#### 006 · 随机门：源库原理、偶遇体验与作品馆

![006 随机门线上研究页：区分原作灵感、源库参数化原理与我们的随机遭遇，说明价值、记忆和作品馆方向。](projects/006-random-doors/assets/research-public-hero.jpg)

006 随机门线上研究页：区分原作灵感、源库参数化原理与我们的随机遭遇，说明价值、记忆和作品馆方向。

[查看项目](projects/006-random-doors/README.md)

#### 007 · 原创参考图到 Blender：月门水庭

![007 月门水庭实际网页：同一 Blender 场景可拖动旋转、缩放与切换机位，支持线框和水面实时反射。](projects/007-autumn-courtyard-blender/web/screenshots/interactive-hero.jpg)

007 月门水庭实际网页：同一 Blender 场景可拖动旋转、缩放与切换机位，支持线框和水面实时反射。

[查看项目](projects/007-autumn-courtyard-blender/README.md)

#### 008 · Specreel：004 需求采集页面演示生成实测

![008 实际回放：004 需求采集计划的截图、操作步骤与中文说明，可切换原生结果。](projects/008-specreel/assets/preview.png)

008 实际回放：004 需求采集计划的截图、操作步骤与中文说明，可切换原生结果。

[查看项目](projects/008-specreel/README.md)

#### 009 · 需求发现：从个人网站到 AI 研究工具

![009 OpenAI自动探索实测：从小型本地服务经营识别3类人群、3个问题候选和10条来源链接，保留调查过程与证据边界。](projects/009-demand-discovery/assets/openai-discovery.png)

009 OpenAI自动探索实测：从小型本地服务经营识别3类人群、3个问题候选和10条来源链接，保留调查过程与证据边界。

[查看项目](projects/009-demand-discovery/README.md)

#### 010 · Atypica 与 AI 用户研究：完整归档

![010 原创研究归档导览配图（非浏览器截图）：保留来源、讨论、B/C试跑、停止原因与完整材料。](projects/010-evidence-research-lab/assets/archive-cover.svg)

010 原创研究归档导览配图（非浏览器截图）：保留来源、讨论、B/C试跑、停止原因与完整材料。

[查看项目](projects/010-evidence-research-lab/README.md)

#### 011 · 古人说唱 Battle：AI 视频制作流程研究

![011《敬风霜》舞台重剪实际网页截图：圆形舞台、观众、双人站位与灯光；人物表演沿用002，本轮未新增视频请求。](projects/011-ancient-rap-battle/assets/own-sample-v3.png)

011《敬风霜》舞台重剪实际网页截图：圆形舞台、观众、双人站位与灯光；人物表演沿用002，本轮未新增视频请求。

[查看项目](projects/011-ancient-rap-battle/README.md)

#### 012 · EdgeChat：自部署聊天系统原理研究

![012 EdgeChat 研究页实际截图：从完整聊天应用的本质出发，展示 Cloudflare 架构、消息流转及能力边界。](projects/012-edgechat/assets/preview.jpg)

012 EdgeChat 研究页实际截图：从完整聊天应用的本质出发，展示 Cloudflare 架构、消息流转及能力边界。

[查看项目](projects/012-edgechat/README.md)

#### 013 · CrawlHive：跨平台信息监控的能力与本质

![013 CrawlHive 四环节研究网页：来源控制、信息搜索、信息过滤与信息呈现，附关键词交互及源码依据。](projects/013-crawl-hive/assets/preview.jpg)

013 CrawlHive 四环节研究网页：来源控制、信息搜索、信息过滤与信息呈现，附关键词交互及源码依据。

[查看项目](projects/013-crawl-hive/README.md)

#### 014 · 赛博小雅：真人拟人化效果与模型依赖研究

![014 原创能力总览图：引用原视频画面，串起真人效果、听想说动模型、实时交互工程、产品价值与证据边界。](projects/014-cyber-xiaoya-study/assets/overview.png)

014 原创能力总览图：引用原视频画面，串起真人效果、听想说动模型、实时交互工程、产品价值与证据边界。

[查看项目](projects/014-cyber-xiaoya-study/README.md)

<!-- PROJECTS:END -->

## 开始一个研究

在仓库根目录运行以下命令，将示例名称和地址替换为实际项目：

```sh
python scripts/project_catalog.py add --slug project-name --title "项目名称" --repo "https://github.com/owner/repository" --summary "一句话说明项目用途和研究重点"
```

命令会分配下一个编号、创建子项目目录与研究模板、登记项目信息，并更新上方索引。

随后在子项目内完善研究记录，把截图放入 `assets/`，并在 [projects.json](projects.json) 中填写配图、状态或已经发布的演示链接。更新后运行：

```sh
python scripts/project_catalog.py sync
python scripts/project_catalog.py check
```

## 仓库导航

| 位置 | 用途 |
| --- | --- |
| [projects/](projects/README.md) | 按编号组织的子项目、研究笔记、截图与可选 Web |
| [projects.json](projects.json) | 项目索引的数据来源 |
| [研究与目录约定](docs/CONVENTIONS.md) | 编号、研究流程、配图及来源记录 |
| [Web 展示与部署](docs/DEPLOYMENT.md) | 为后续多个 Web 准备的 GitHub Pages 路径方案 |
| [templates/project/](templates/project/README.md) | 新项目使用的统一模板 |

## 研究方式

先记录原仓库与研究版本，再复现核心功能，最后总结值得学习的设计和实现。首页保留简短摘要，详细结论、截图说明和运行步骤写在对应子项目中。

引用原项目的代码、文档和图片时，在子项目内保留来源及许可证信息；尚未核实的信息标为待确认。
