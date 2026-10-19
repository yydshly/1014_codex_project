export const categories = {
  discussion: '人群与讨论', reviews: '产品与评论', jobs: '任务与预算',
  developer: '开发者问题', vertical: '垂直行业', trends: '趋势与内容',
};
export const accessLabels = { public_api: '有公开数据接口', search_or_manual: '索引或人工研究', authorized: '需要授权接入', manual: '先人工观察' };
export const timeline = [
  { n:'01', title:'研究个人网站', text:'起点是 JasonZhu.AI：学习内容组织、项目展示、推广入口与反馈连接。', takeaway:'原站提供学习与观察的入口。' },
  { n:'02', title:'追问对自己的价值', text:'已有实现能力，研究成果可以进入个人网站，但还需要接触真实使用者。', takeaway:'把“做出来”接到“有人需要”。' },
  { n:'03', title:'发现真正的瓶颈', text:'开发、反馈和优化之前，还缺少“从哪里发现人群、怎样发现问题”的方法。', takeaway:'优先向上游寻找需求。' },
  { n:'04', title:'采集样本，暴露偏差', text:'004 整理过 Reddit、应用评论、Upwork 来源；已知关键词容易把结果带向文档、格式与交付类问题。', takeaway:'采样范围会影响你看到的机会。' },
  { n:'05', title:'重新定义发现过程', text:'从不知道痛点的状态出发，先观察活动与角色，再沿着反复费力的行为追查问题。', takeaway:'发现路径必须能被解释和复查。' },
  { n:'06', title:'形成独立产品方向', text:'建立平台地图，开发能主动探索人群与问题的工具，再扩展机会判断、需求验证和产品落地。', takeaway:'009 记录方法、边界和产品演进。' },
];
export const signals = [
  { id:'repeat', title:'反复手工处理', eyebrow:'时间代价', example:'每周都要把几处数据复制到同一张表，再逐项核对。', question:'为什么要重复？哪一步必须由人补上？多久发生一次？', trap:'有重复不等于需要新产品；先确认现有自动化能否覆盖。', searches:['"every week" "manually"','"copy paste" "workflow"'] },
  { id:'bridge', title:'多个工具之间补缝', eyebrow:'衔接代价', example:'从聊天接需求，到邮件确认，再去共享目录找最新文件。', question:'信息在哪次交接丢失？谁需要重新整理？', trap:'工具多不等于流程差；要找到具体返工和错误。', searches:['"my workflow" "tools"','"keep track" "different"'] },
  { id:'hire', title:'付费请人做重复任务', eyebrow:'预算意向', example:'招聘说明中反复出现一项规则明确、按周交付的工作。', question:'预算买的是判断、责任，还是重复操作？任务能否标准化？', trap:'任务标价不是成交；一次性定制也不等于持续订阅需求。', searches:['"weekly" "deliverables"','"data entry" "reconcile"'] },
  { id:'wait', title:'等待、催促与反复确认', eyebrow:'协作代价', example:'任务总停在等反馈、等批准或确认收到的环节。', question:'谁缺少什么信息？等待会让哪个结果受影响？', trap:'组织关系和决策权问题，未必能靠软件解决。', searches:['"waiting for" "approval"','"follow up" "client"'] },
  { id:'error', title:'相同错误反复出现', eyebrow:'返工代价', example:'每次发布或交付前，都要检查同样几类遗漏。', question:'错误在哪产生、由谁发现、怎样补救？', trap:'区分偶发故障、培训不足和跨用户重复的障碍。', searches:['"keep forgetting"','"same mistake" "check"'] },
  { id:'constraint', title:'现有产品不适合某种情境', eyebrow:'适配缺口', example:'软件功能齐全，但某种语言、协作方式或设备条件下仍难完成任务。', question:'哪些约束使它不好用？受影响的是哪一类人？', trap:'一个功能请求不代表足以支撑独立产品。', searches:['"does not support" "workflow"','"alternative" "small team"'] },
  { id:'abandon', title:'缩减目标、拖延或放弃', eyebrow:'机会代价', example:'为了绕开繁琐步骤，用户减少更新次数，或只处理最重要的一部分。', question:'原本想达到什么结果？在哪一步选择不继续？', trap:'放弃可能来自低优先级；需要核实结果是否重要。', searches:['"gave up" "because"','"too much work" "manage"'] },
  { id:'change', title:'变化带来新的工作负担', eyebrow:'新出现的任务', example:'渠道规则、工具或业务规模变化后，原有流程开始吃力。', question:'变化让谁增加了什么工作？新负担是短期还是持续？', trap:'热度和短期迁移不能直接证明长期市场。', searches:['"since the update" "workflow"','"now have to" "manually"'] },
];
export const entryModes = {
  open: { label:'还不知道关注谁', title:'从活动地图开始', text:'先选市场、语言和可做的产品边界，观察经营、接单、创作、组织、维护等活动。AI 提出角色候选，再用真实来源决定继续关注谁。', example:'活动：交付客户作品 → 角色：独立设计师、工作室负责人、客户项目经理 → 找各自的工作过程。' },
  audience: { label:'已有大致人群', title:'把人群拆成任务与情境', text:'输入“小商家”或“自由职业者”，继续按工作任务、协作关系、业务阶段和约束细分，避免把整个群体当成同一种需求。', example:'自由职业者 → 按项目收费 → 同时服务多个客户 → 观察需求确认、交付和收款。' },
  product: { label:'已有产品或竞品', title:'从使用情境反推人群', text:'阅读真实使用过程和评论，找到谁在什么约束下无法完成任务，再到其他社区追查。竞品功能列表只是线索之一。', example:'工具评论提到多人反馈难整理 → 追查哪些团队、什么交付阶段、怎样产生返工。' },
};
export const loop = [
  { title:'圈定探索边界', verb:'定义', input:'市场、语言、可接触的人群、实现边界、研究预算。', action:'把“寻找一个好项目”改写为可执行的研究范围。领域可以暂空，边界需要清楚。', output:'一份探索任务：研究什么、先观察哪些活动、什么时候停止。', decision:'范围太宽时，按活动或业务场景缩小；保留探索未知人群的空间。' },
  { title:'发现角色与聚集地', verb:'找人', input:'活动线索、社区分类、行业论坛、产品分类、任务市场。', action:'提出若干角色假设，找讨论工作过程的地方，保留支持这个人群确实在做某项任务的材料。', output:'角色地图：角色 × 任务 × 情境 × 相关来源。', decision:'找不到具体任务和持续活动的角色，先降级；不要凭职业名称推断痛点。' },
  { title:'观察工作与行为', verb:'观察', input:'求助、工作流程、评论、任务说明、实际替代办法。', action:'读上下文，捕捉重复、等待、手工补缝、返工、付费外包和放弃行为。', output:'带原文定位的行为线索，分别标注事实与解释。', decision:'只出现情绪、广告或空泛观点时，继续找具体经历。' },
  { title:'提出具体问题假设', verb:'追问', input:'谁做什么、在哪一步卡住、产生什么代价。', action:'把“管理很麻烦”缩小到具体任务与触发条件，并列出至少一种其他解释。', output:'问题候选 + 尚未知的事实 + 下一轮搜索问题。', decision:'无法说明任务、障碍和代价时，不进入产品构想。' },
  { title:'寻找独立证据与反例', verb:'核对', input:'真实材料中的术语、同类角色、相邻社区、评论或外包任务。', action:'扩展搜索用语，查相似经历，也查“已经轻松解决”的情况；识别同帖转载和同一人的重复表达。', output:'问题簇：支持证据、反例、现有办法和覆盖边界。', decision:'已有办法充分解决且采用成本可接受时，记录并降级；缺材料时继续调查。' },
  { title:'判断下一步研究价值', verb:'筛选', input:'样本内重复、具体代价、已有解决方式、接触用户的可能性。', action:'按证据充分度和任务价值排序，明确哪些判断来自原话，哪些只是推断。', output:'继续观察 / 值得访谈 / 暂时搁置，每项附原因。', decision:'缺少付费证据就保留未知；热度、点赞和 AI 分数不替代市场验证。' },
  { title:'用新线索修正探索', verb:'迭代', input:'上一轮留下的问题、低覆盖渠道、相邻角色和新出现的术语。', action:'由证据决定下一轮关注的人群和查询，记录为什么转向、继续或停止。', output:'可复查的发现路径和新的探索队列。', decision:'证据不再增加、范围已覆盖或预算到达上限时停止；进入访谈需要单独安排。' },
];
export const extensions = [
  { n:'01', title:'扩展来源', label:'横向覆盖', detail:'增加行业论坛、不同语言、评论、任务市场与授权导入，比较同一问题在不同地方的表达。', condition:'先验证一个来源的可读性、条款、成本与增量价值。', metric:'新增独立证据与新人群，而非抓取总量。' },
  { n:'02', title:'持续观察', label:'时间维度', detail:'跟踪旧问题是否继续出现、哪些办法开始有效、出现了什么新约束。', condition:'支持增量采集、去重、来源失效处理和更新记录。', metric:'真正改变判断的新信息，以及每条有效更新的成本。' },
  { n:'03', title:'机会判断', label:'决策支持', detail:'连接现有产品、工作流、价格资料和实施边界，判断具体缺口与可能切入点。', condition:'有足够原文和反例，竞争信息标注时间与来源。', metric:'用户是否据此缩小、调整或放弃一个方向。' },
  { n:'04', title:'需求验证', label:'接触真实用户', detail:'准备访谈提纲、研究招募入口和验证页面，记录真实经历、试用与付费实验。', condition:'访谈与联系动作由使用者明确安排；记录行为而非只问“会不会买”。', metric:'任务完成、复用、试用承诺与实际交易证据。' },
  { n:'05', title:'产品落地', label:'从判断到实现', detail:'把验证后的问题转为需求说明、最小功能、网页演示、发布素材和反馈记录。', condition:'先确认要解决的任务与范围，避免让生成速度主导选题。', metric:'目标用户完成任务的结果与后续使用。' },
  { n:'06', title:'垂直研究服务', label:'可能的商业形态', detail:'围绕某类人群持续维护问题库、行业简报或团队研究工作台，逐步探索收费。', condition:'先有人持续使用并愿意为减少研究工作付出成本。', metric:'持续使用、实际节省的工作与真实付费；定价待验证。' },
];
export const roadmap = [
  { stage:'现在', title:'把研究方法整理清楚', state:'本页已实现', text:'平台目录、来源条件、发现流程、真实旧样本、产品规划和本地探索计划。', gate:'能区分事实、推断、示例、待验证能力。' },
  { stage:'已跑通', title:'完成一轮真实自动探索', state:'本地第一版', text:'以小型本地服务经营为起点，OpenAI 三轮调查得到3类人群、3个候选和10条来源链接，包含继续、收窄与搁置。', gate:'继续在不同领域验证覆盖、来源准确性、独立性和人工复核成本。' },
  { stage:'再下一步', title:'加入跨来源核对', state:'待验证', text:'围绕同一人群接入第二类来源，建立问题簇、反例和现有办法的对照。', gate:'新增来源能改变结论，而非重复同一帖。' },
  { stage:'形成复用', title:'支持增量观察与协作', state:'产品假设', text:'保存研究项目、复核记录、版本变化、持续追踪和团队共享。', gate:'自己及少量目标用户会反复使用，更新有实质价值。' },
  { stage:'向上扩展', title:'连接验证与产品落地', state:'产品假设', text:'访谈与验证实验、机会判断、最小产品说明与网页演示。', gate:'证据与真实反馈支持扩展，收费方式通过实际使用验证。' },
];
export const presets = {
  explore: { label:'从未知人群开始', domain:'独立经营、接单与内容创作', role:'尚未确定，先发现细分角色', activity:'观察他们怎样交付工作、维护业务与协作', channels:['Reddit','Hacker News','Upwork'], queries:['"my workflow" "client"','"how do you manage" "weekly"','"hiring" "recurring"'], question:'哪些角色出现了具体且反复的任务负担？' },
  freelance: { label:'自由职业者', domain:'创意服务与项目交付', role:'按项目收费、同时服务多个客户的独立工作者', activity:'需求确认、交付、反馈与收款', channels:['Reddit','Upwork','AppSumo'], queries:['"freelance" "my workflow"','"client" "keep track"','"project" "extra work"'], question:'哪些环节需要反复说明、整理或返工？' },
  merchant: { label:'小商家', domain:'小型电商经营', role:'独自处理多个经营环节的小商家', activity:'商品维护、订单、客服与渠道协作', channels:['Shopify Community','Shopify App Store','Upwork'], queries:['"store owner" "manually"','"orders" "workflow"','"product listings" "weekly"'], question:'哪些经营任务反复发生，并需要人工在工具之间补缝？' },
  creator: { label:'内容创作者', domain:'内容制作与商业交付', role:'需要定期产出、同时管理合作方的独立创作者', activity:'资料整理、内容制作、审核与发布', channels:['Reddit','AppSumo','Product Hunt'], queries:['"content creator" "workflow"','"brand" "approval" "content"','"publishing" "keep track"'], question:'产出与协作中，哪些步骤让人等待、重复或减少更新？' },
};
