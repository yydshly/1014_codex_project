# 配图与录音来源

2026-10-20 [Pages发布证据](publication/README.md)：四张浏览器原始JPEG分别记录本地静态摘要、预设协作、公网摘要与公网工作室；没有生成、裁切或合成。公网63份资源与引导图原字节已核验，发布清单中的12个应用入口可访问；实际范围、音频观察与本地预设完整结束状态见同目录JSON。

2026-10-20 新增 [项目理解总览图](understanding-overview/agent-studio-understanding.png) 与 [矢量源图](understanding-overview/agent-studio-understanding.svg)，汇总来源、原理、扩展、探索、能力、验证及后续方向。信息图使用可编辑文字与矢量流程，并按原比例嵌入三张本项目实际截图，没有图像生成或改写截图内容。来源待确认事项、截图所涉两次不同任务和统计范围见 [制作与来源说明](understanding-overview/README.md)。

2026-10-20原项目目录执行验收：`workspace-local-source-delivery.png` 是原仓库build/test通过、12份产物归档后的真实工作室画面；`workspace-local-source-revision.png` 是首轮真实测试失败后，开发、审阅及验证前往白板核对的实际画面；`original-repository-demo-browser.png` 是加载原项目dist/mitt.mjs，完成浏览器交互验收后的一键示例。均为实际浏览器截图，场景及界面由代码生成，未合成图像。

`example-original-repository-demo.zip` 为实际下载并解包检查的原项目交付，211,698字节、20文件，含固定来源、MIT原文、源码、生成的锁文件、原命令stdout/stderr及复验清单。`example-original-repository-run.json` 分别保留202个原始人物事件、12份产物，以及浏览器验收后的交付清单；两次返工中包含一次清单工具误判，已修正工具。浏览器发现通配状态问题后本地补两行，并重新运行原build/test及HTTP检查；没有改写原始模型记录或将模型中的HTTP描述当实测结论。

`workspace-local-source-research.png`、`workspace-local-source-install.png` 来自2026-10-19真实目录执行任务：固定版本mitt已克隆，人物在场景中研究交接，小蓝坐在电脑前实际执行npm依赖安装，其余伙伴恢复个人活动。均为实际浏览器截图，无图像合成，不表示当时已完成构建测试。

`workspace-source-runner-setup.png` 为2026-10-19原仓库执行器接入后的实际浏览器截图：保留房间背景，显示执行方式、Node项目范围、缺少沙箱的原因与禁用启动按钮。它证明入口及环境检测状态，不代表原仓库已构建或启动成功；未合成图像。

2026-10-19 真实项目闭环案例：

- `workspace-repository-delivery.png`：六位角色完成真实 `developit/mitt` 任务后的房间，显示 10 份产物、24/24 检查和 Demo/源码入口。
- `repository-demo-browser.png`：实际生成的事件总线 Demo，已在浏览器触发普通事件与星号事件，日志显示正确参数。
- `workspace-repository-work.png`、`workspace-repository-handoff.png`：联调中的真实编码与当面交接。
- `workspace-repository-revision.png`：返工开发期间，待命伙伴继续交流；`workspace-repository-triage.png`：断言纠错后的再审与验证工位。两张是当时实际画面，不用作最终交付数量证明。
- `example-repository-demo.zip`：实际下载并解包验证的独立离线 Demo；`example-repository-run.json`：原始模型协作、后续浏览器验收修订与测试历史。原始模型文字保持原样，实际验证范围以清单和测试日志为准。

该案例来源为 `developit/mitt` 固定 commit `6b41670516ed8e8b738612f60491995470aa63b3`，MIT 原文包含在包中。浏览器验收修正了重置按钮与星号提示后重新检查通过，具体见研究记录。所有图片为实际页面截图，没有图像合成。新增实时语音通过既有 MiniMax 接口合成，没有新增公开录音文件。

初版图片为 2026-10-14 本项目实际运行的浏览器截图；第二版日期见下文。模型、纹理和角色由代码生成，没有使用效果图代替实现，也没有复制原帖资产。

2026-10-15 新增第二版证据：`workspace-v2.jpg` 为真实目标协作中的共享白板、电脑、角色交接与字幕；`workspace-discussion.jpg` 为收起文字窗后的房间内双人讨论（预设语音，界面注明）；`whiteboard-v2.jpg` 为真实目标的六位角色任务、反馈与手动验收。`example-goals-v2.json` 是本次自建演示目标的导出，包含两项目标、一次真实运行和讨论记录；模型文中的任务单编号和文档建议是方案内容。

| 文件 | 说明 |
| --- | --- |
| `workspace.jpg` | Agent 工作室：任务面板、六位角色、语音字幕和交接记录，用于总索引 |
| `workspace-live.jpg` | MiniMax 真实 Agent 模式的实际运行画面 |
| `workspace-mobile.jpg` | 390 × 844 窄屏视口的协作入口与房间 |
| `preview.jpg`、`mobile.jpg`、`first-person.jpg` | 初版房间的自由观察、窄屏和第一人称截图，保留作实现历史 |

`web/public/voices/demo/` 包含使用 MiniMax 官方 `speech-2.8-turbo` 于 2026-10-14 生成的十段 MP3。文本由本项目编写，音色为官方系统音色，未使用真人声音克隆。

| 角色 | 系统音色 |
| --- | --- |
| 小森 / 协调员 | `male-qn-jingying` |
| 阿橘 / 研究员 | `male-qn-daxuesheng` |
| 小蓝 / 开发员 | `male-qn-qingse` |
| 月白 / 审阅员 | `female-chengshu` |
| 桃桃 / 验证员 | `female-shaonv` |
| 栗子 / 记录员 | `female-yujie` |

每段音频的台词、人物、模型、音色与文件名见 录音清单：`../web/public/voices/demo/manifest.json`（本地路径，本轮未收录）。语音服务和生成录音的使用受 [MiniMax 平台条款](https://platform.minimax.cn) 约束，不将第三方服务生成的音频标记为库的 MIT 许可。背景 lo-fi 和雨声另由本地 Web Audio 原创合成。

视觉灵感与技术依赖见 [项目说明](../README.md)。

2026-10-15 人物动作版截图：`workspace-actions-computer.png` 来自真实 MiniMax 协作，暂停在开发员已入座的电脑工位，用于当前总索引；`workspace-actions-handoff.png` 来自真实验证员与记录员在桌边会合交流；`workspace-actions-delivery.png` 为六份产物归档后，六位人物回到白板前。均为实际浏览器截图，场景、家具和关节由本项目代码生成。模型生成的任务单编号仍属于方案内容，不代表写入了外部文件。

`posture-room.png` 为 2026-10-15 姿态修正后的实际房间截图：屈肘打字、地垫托书、正常行走、放松站立与躺卧。使用页面原有旋转和缩放观察，没有后期合成或生成模型；早期截图保留作实现历史。

2026-10-15 散场与个人活动版：`workspace-scatter-work.png` 为预设协作中月白向栗子说明审阅结论，其他人物分散在电脑、桌边、地垫和沙发；`workspace-scatter-complete.png` 为同一轮九份产物归档后，白板前已散场，六位伙伴回到各自的个人活动位置。两张为实际浏览器截图，未合成或生成；本轮使用已有 MiniMax 录音，没有新增云端模型调用。

`goals-v2.jpg` 展示目标、六个角色任务与每轮交付；`goals-mobile-v2.jpg` 是 390 × 844 的目标看板。两张均于 2026-10-15 在实际浏览器中保存。

2026-10-15 日常活动版：`workspace-daily-drink.png` 是小森在窗边饮水角举杯喝水，月白在房间内活动；`workspace-daily-stretch.png` 是阿橘离开沙发后站立举臂伸展，其他伙伴继续自己的活动。两张都是待命场景的实际浏览器截图，无图像合成、动作捕捉或新增语音模型调用；饮水柜、杯子和动作均由本项目代码生成。

2026-10-15 自然互动版：`workspace-social-chat.png` 是阿橘与桃桃在沙发上轮流语音聊天，其余角色继续活动；`workspace-social-work.png` 是预设协作中，栗子开工前找小蓝核对「展示方案 v2」（截图使用字幕回放）。均为实际页面截图，没有图像合成。新建的「人物自然互动与协作演示」目标完成九份预设产物，未覆盖既有目标历史。

`web/public/voices/room/` 新增 36 段 MiniMax `speech-2.8-turbo` 录音，于 2026-10-15 使用本项目编写的短句和上表六种系统音色生成，涵盖招呼、回应、休息闲聊与工作短句。完整文本、音色、类别与文件名见 互动录音清单：`../web/public/voices/room/manifest.json`（本地路径，本轮未收录）。录音受 MiniMax 平台条款约束，没有使用真人音色克隆。

2026-10-20 任务关联版：`workspace-task-linked.png` 为房间中的当前任务卡、执行阶段和体验入口；`workspace-task-result-linked.png` 为同一任务的原始需求、实际可交互成果和人工验收要求。均通过本机真实浏览器保存，原始尺寸726×875，未裁切、合成或生成。成果来自此前实际构建测试通过的mitt任务，本轮验证了从既有目录重启及嵌入交互，没有把UI修改作为新的一次模型开发执行。

2026-10-20 执行标识：`workspace-execution-status.png` 为真实浏览器中的工作室右上角状态。后台当前无真实任务，页面展示此前已完成的mitt成果，人物处于日常活动；截图未合成或生成。本轮状态回归使用明确的请求测试替身覆盖运行、完成、报错和取消，未为截图制造一轮虚假的真实任务。

2026-10-20 本仓库真实任务：`own-workspace-task-plan.png`、`own-workspace-task-computer.png`、`own-workspace-task-interrupted.png` 来自初轮分工、电脑操作和模型中断；`own-workspace-task-revision.png` 来自第三轮真实测试失败后的返工；`own-workspace-task-board-discussion.png` 实际展示电脑旁的面对面交接，不能据文件名解读为所有人围白板的画面。五轮过程完整保存在 `example-own-workspace-task.json`，最终Agent源码与命令证据为 `example-own-workspace-task.zip`。

`workspace-role-research.png` 为成功轮研究员读取实际模板源码并回看旧步骤；`workspace-role-develop.png` 为开发员入座、对应安装命令执行中的工作台；`workspace-role-tests.png` 为验证员原66项测试输出与退出码0，截图时查看历史步骤；`own-workspace-task-delivered-templates.png` 为实际交付Demo中三模板按钮及填充结果。均来自本机真实浏览器，无图像生成、裁切或合成。角色工作台由操作者实现，模板功能由角色工作流完成，二者来源在执行记录中分别注明。

2026-10-20 实体屏幕细节：`workspace-physical-code-screen.png` 展示小蓝身前真实三维显示器中的编辑器、源码着色与终端，使用上一轮真实源码记录回放，界面明确标注不执行任务；`workspace-physical-test-screen.png` 展示桃桃桌上笔记本的实际测试命令、输出和退出码。截图来自本机浏览器，无裁切、合成或图像生成，本轮没有另发模型任务。

2026-10-20 日常道具内容：`workspace-personal-reading.png` 展示月白手中有章节、正文和摘记的三维读本；`workspace-personal-notes.png` 展示小蓝笔记中上一轮实际任务的目标与开发产物摘录；`workspace-personal-water.png` 展示带姓名、角色颜色和杯内水面的个人杯子。均为本机浏览器原始截图，无裁切、合成或图像生成。六本角色读本的文字由本项目原创编写，不是外部出版物，也不代表 Agent 实际研究成果；笔记中的任务摘录来自已有公开产物并注明来源。此次道具开发未重新调用任务模型或语音服务。

2026-10-20 道具关联审查：props-audit/ 下六张 JPEG 均来自本轮实际浏览器，无裁切、合成或图像生成。01-before-reading 为修正前镜头与所选角色脱离；02-before-overview 为工具栏重叠和较大的任务卡；03-idle-book 为闲置书合上并停止自动翻页；04-reader-view 为按人物方向阅读的手持书；05-free-observation 为自由观察及恢复跟随入口；06-compact-overview 为分行工具栏和简洁任务卡。完整问题与验证边界见项目 PROP_AUDIT.md。截图未使用新的任务模型或语音调用。

2026-10-20 连续动作：`book-motion/sofa-reading.jpg` 为阿橘在修正高度的沙发上持书阅读与动作预览入口；`closing-book.jpg` 为坐姿合拢封面的中间状态；`after-return.jpg` 为书已放回边桌、人物空手走向工位；`floor-reading.jpg` 为自由观察下月白在地垫上持书，书角保持在茶几桌面上方。均为本机真实浏览器截图，无裁切、合成或图像生成。拿放预览没有调用任务模型、生成交付结果或改变历史任务。截图尺寸随应用面板宽度变化。

2026-10-20 人物避碰：`traffic-audit/` 下 `fetch.jpg`、`pickup.jpg`、`travel.jpg`、`opening.jpg`、`reading.jpg` 是本机浏览器连续观察桃桃取书、携带、坐稳和打开读本时的实际画面。截图没有裁切、合成或图像生成；属于动作预览，未启动新的真实开发任务、调用模型或修改已有任务成果。角色间距诊断与自动回归指标见项目 `COLLISION_AUDIT.md`。

2026-10-20 自然避让：`natural-avoidance/` 的 `slowing.jpg`、`sidestep.jpg`、`waiting.jpg` 来自最终构建在多人返回个人位置时的实际浏览器画面，分别记录提前减速、局部侧步和通道边等候；`resumed.jpg` 为此后恢复日常活动的画面。通过页面原有拖动调整观察角度，未裁切、合成或图像生成。`browser-trace.json` 是同轮页面公开 `#scene[data-state]` 的抽样轨迹与稍后的最终状态，包含实际速度、位置、侧步量与任务动作，未覆盖样本之间的每一渲染帧。截图没有启动模型、语音或新真实任务，没有修改已有目标与交付历史；页面保留“当前无真实任务执行”标识。自然避让规则、复现参数和测试边界见 `../COLLISION_AUDIT.md`。

2026-10-20 完整度检查：`completeness-audit/` 的 `01-workspace.jpg`、`02-task-entry.jpg`、`03-evidence.jpg` 分别为当前房间、空白新任务表单和此前已完成任务的交付记录，均为本轮本机浏览器原始截图，未裁切、合成或生成。没有提交新任务或重启成果服务；查看后关闭弹窗并返回房间。`review.json` 记录截图对应观察、代码证据、建议优先级与未验证范围，不将已有日志当成本轮新执行。

2026-10-20 后台任务与重连：`background-task/` 的八张 JPEG 为本机真实浏览器原始截图，无裁切、合成或图像生成。01/02记录首轮刷新前与接回后的工作室；03记录第二轮真实任务；04/05记录暂停观察及后台继续增长的工具记录；06记录交付后房间与无真实任务标识；07为同一任务的成果、7/7自动检查和未勾选的人工验收；08为独立交付副本的实际工作室页面。截图只证明当时可见状态，连续执行证据以事件日志为准。

`execution-evidence.json` 保留两轮任务元数据与原始504/206条事件。首轮因 Demo 端口配置问题返工，操作者主动停止，最终为取消，不当作成功交付。第二轮实际安装依赖、修改副本源码、运行原构建和68项测试，再启动动态端口 Demo；`delivery.json` 与 `delivered-source.zip` 为该轮真实交付，来源为本仓库003工作区固定快照 `fbff9810c71685cb5c5e587beb8e57bd0b7806d9`，保留仓库及依赖原许可。归档已检查不含 `.env`、API密钥、依赖目录和任务缓存。

第二轮自动检查通过但人工验收未完成：模型改了两处文案，却没有完整命中原先电脑面板中的到期提示。操作者另在主工作区修正原提示；该修正未冒充模型交付改动，也未改写原始任务记录。后台任务管理器、刷新重连与场景恢复均由操作者实现，模型任务用于验证执行生命周期。详情及125项回归范围见 `background-task/verification.json`。旧4175服务进程重启被自动审批拒绝，故本轮最新版在4176验证，保留旧入口及其浏览器历史；两个端口的浏览器本地目标存储相互独立。

2026-10-20 浏览器功能验收：`browser-acceptance/` 的01至09号JPEG均为本机实际浏览器原始截图，无裁切、合成或图像生成。01/02来自首轮后来取消的任务，分别为浏览器初探工作台和实体电脑；03为无效验收计划导致的误判；04/05为后来因URL错误而取消的任务关联与初探。不得将01至05解释为成功交付。

06为最终成功任务的桃桃工作台，展示真实浏览器第三项断言通过，此时记录员正归档；07为同一任务完成后的实体笔记本，显示实际Demo截图、原需求编号、预期与实际，并明确为已停止更新的执行记录；08为同一目标的成果页，浏览器三项通过、自动检查8/8，而人工验收仍未勾选；09为独立交付Demo中的「清空草稿」按钮。画面只证明当时可见状态，完整32步操作与结果以 `browser.json` 为准，三项末步截图另存为 `case-1-passed.jpg` 至 `case-3-passed.jpg`。

最终真实MiniMax任务 `be09c8df-cbb3-4ccc-b5d4-53358383a8f9`、执行目录记录 `16cdf601-8a21-4de4-9349-492e5c8d843f`：继承此前未交付草稿的固定本地快照 `2963155d86743457b5825d2e0b09c237dc976c3b`，仅修改003的 `index.html`、`src/workspace.js`、`src/workspace.css`。实际安装依赖、运行原构建和72项原测试，独立Chromium完成三项场景后才交付。`delivery.json`、`delivered-source.zip` 为实际清单与源码/命令/浏览器证据；已检查不含密钥、私有环境文件、依赖目录和缓存。`execution-evidence.json` 如实保留13轮模型错误、主动取消及最终成功，不将失败用例的误判当作成功功能返工。

`fixture-flow.json`、`fixture-failed.jpg`、`fixture-passed.jpg` 单独记录确定性回归夹具：真实Chromium发现问候功能缺失，协作流程发起讨论返工，测试驱动修复，再用同一冻结计划重测通过。该夹具未调用MiniMax、未运行原仓库构建，不与上方真实任务混淆。`rejected-plan.json`、`invalid-select-case.jpg` 保留首轮错误选项值和按钮断言问题。环境与规划错误由操作者修正，浏览器执行器和场景接入也由操作者实现；模型负责副本中的清空草稿功能。本轮141项回归、验证边界与地址有效期说明见 `browser-acceptance/verification.json`。旧4176服务重启被自动审批拒绝（仅返回blocked by policy），故最新版工作室在4177验证，旧入口保留；本机限时Demo不作为公网发布登记。

2026-10-20 真实缺陷返工：`real-browser-repair/` 保存本仓库003原有的“新建未保存目标草稿仍可归档旧目标”问题。01为改动前实际浏览器中空白草稿及仍启用的归档按钮，未点击归档、未改用户旧目标；02来自随后取消的首轮任务，不表示成功；03为真实任务运行中回看桃桃的实际失败步骤，预期false、实际true。04、05、06为最终交付后在房间回看原始事件，明确标注不执行新任务；05/06分别展示第一、第二次真实MiniMax对话及人物当面交流，06拍摄时音频元素正在播放，时长约15秒。全部JPEG为本机浏览器原始截图，无裁切、合成或图像生成；回看不重新调用编码工具，也没有把回归夹具拿来充当真实任务。

原始任务 `3444da84-5de0-40c2-a7a8-24f5aa6ef7a1`、源码运行 `84047db7-5300-4384-a0cf-14c8016b5a89` 在未修改的原版上实际得到浏览器FAIL，继而产生桃桃→小蓝、小蓝→桃桃的模型发言，再修改源码。首次修改漏导入辅助函数，浏览器报ReferenceError而被再次退回，修复后两轮浏览器通过；审阅模型误判既有openGoals代码，导致该后台任务最终为error，未交付。最终任务 `38b68da3-cbad-440f-a776-26b14e2537c7`、源码运行 `30b89d02-a24f-433f-8d68-dc9ba675f22b` 从其检查点继续，保留相同用例及原始截图、重新运行原构建、77项原测试、4项新增测试，完成三项场景最后28步浏览器操作，再由审阅独立批准与记录员交付。

07是最终独立Demo中的空白目标草稿，08是已同步修复的主工程，两者归档按钮都实际禁用；09是同一目标的最终交付页，自动检查9/9且人工验收三项未勾选。均为本机浏览器原始截图，无裁切、合成或图像生成。`browser-observation.json` 记录房间回看自然播放完毕、回看按钮恢复可用、两处禁用状态，以及第二次对话期间音频元素实际播放的时间与时长。临时验收页已关闭，未归档或删除用户原目标。

`browser-plan.json`、`browser.json` 保存相同冻结用例及有效源码链的五次结果（失败、失败、通过、通过、续跑通过）；历史记录包含原始运行编号，复制截图保留原始路径。`actual-defect-failed.jpg`、`actual-defect-passed.jpg` 为执行器的原始页面截图。`execution-evidence.json` 保留五轮后台任务，含两次操作者主动取消的验收器问题、一轮审阅误判中断及一次续跑入口配置错误取消；这些都未算作成功。`delivery.json`、`delivered-source.zip` 为实际交付，ZIP包含源码、命令证据、浏览器记录与截图，保留原有许可；已检查不含密钥、私有环境文件、依赖目录和缓存。模型修改的三个相关文件已同步到主工程，摘要见 `applied-source.json`。执行器、续跑保护、布尔断言解析和房间回看由操作者实现，未冒充模型修复源码的工作。验证顺序、原始固定快照、边界及本机限时地址见 `verification.json`。自动审批拒绝重启4177（只返回blocked by policy），最新版使用4182，旧服务及记录保留。
## 地面接触复查截图（2026-10-20）

`ground-contact/reading-side.jpg`、`reading-state.json` 来自本机实际运行的工作室页面，使用浏览器侧面视角观察月白在坐垫上阅读，公开诊断记录脚底和地毯接触高度。`return-to-work.jpg`、`return-state.json` 记录「收书回工位」后的实际状态。图片为本仓库原创场景的直接截图，没有生成、合成或修改场景内容；操作仅预览人物动作，没有提交任务或调用语音。

## 悬空与滑步复查（2026-10-20）

`foot-support/seated-support.jpg`、`rising-support.jpg`、`walking-support.jpg`、`standing-support.jpg` 是本机浏览器中月白阅读、依次收腿、行走及回工位站稳的直接截图。`browser-observation.json` 保存公开场景诊断的实际采样，区分每只脚的支撑/摆动、落脚编号、高度与落脚误差；包含同帧重复采样，不能按数组长度当作独立动画帧数。`measurements.json` 来自 `web/scripts/audit-foot-support.mjs` 的 9 组实际模型变换测量，其中 before 是本次修改前单独记录的平地复现。截图为本仓库原创场景，未裁切、合成或生成；动作预览不提交真实任务、不调用语音。

## 执行中接管角色（2026-10-20）

`takeover-voice/` 新增真实MiniMax语音回应、伙伴白板讨论、两版修改方案、显式继续及同任务交付的证据。五张JPEG为本机浏览器原始截图，无图像生成、合成或裁切；实际音频播放采样另行保存，未新增公开录音。首版分工错误、第二版纠正及最新角色职责绑定验证均保留；暂停期间零工具活动、原81项测试和三项需求20步浏览器验收通过。详见 [语音接管实测](takeover-voice/README.md)。

`role-takeover/` 保存本仓库真实MiniMax任务的两次接管、刷新恢复、实际源码差异、独立重测及交付。五张JPEG均为本机浏览器直接截图，没有生成、合成或裁切。暂停期间没有新的工具活动，原任务编号与源码执行编号保持不变，最终原79项测试及三项浏览器场景22步通过；首次内存不足的失败记录保留。实现者、CPU资源调整、入口变更、源归档与验收边界见 [角色接管说明](role-takeover/README.md) 与 `role-takeover/verification.json`。
