export const REV = '77cfe1c7a42f0d071bee49ac9ebb77fdf0556827';
export const upstream = 'https://github.com/h100envy/crawl-hive';
export const code = (file, lines = '') => `${upstream}/blob/${REV}/${file}${lines ? '#L' + lines : ''}`;

export const evidence = [
  { id: 'readme', title: '项目定位与产品声明', file: 'README.md', type: '声明', note: '定位、截图、功能状态与更新记录；新旧段落存在矛盾，不能据此认定线上运行状态。' },
  { id: 'types', title: '核心数据模型', file: 'src/lib/types.ts', type: '源码', note: 'Crawler、Signal、钱包、链、价格结果和租赁关系混在核心领域对象中。' },
  { id: 'spec', title: '任务规则与默认值', file: 'src/lib/spec.ts', type: '源码', note: '来源对应的信号类别、关键词和过滤参数；通用化首先需要替换这些领域约束。' },
  { id: 'scheduler', title: '定时调度与价格采样', file: 'src/lib/server/crawl/scheduler.ts', type: '源码', note: '进程内定时器，15 秒检查，最多 3 个采集任务并行；每次任务最多等待 4 分钟。' },
  { id: 'x', title: 'X 的实际采集方式', file: 'src/lib/server/crawl/sources/x.ts', type: '源码', note: '通过 Grok 的 x_search 搜索，不是直接订阅 X 全量消息；缺少 XAI_API_KEY 会报错。' },
  { id: 'telegram', title: 'Telegram 公开频道采集', file: 'src/lib/server/crawl/sources/telegram.ts', type: '源码', note: '抓取 t.me/s 公开预览，以消息编号增量读取；首次只取最近 5 条。' },
  { id: 'docs', title: '网页变化检测', file: 'src/lib/server/crawl/sources/docs.ts', type: '源码', note: '读取 HTML，移除脚本与样式，保存前 12,000 字符，以新增文本行判断变化。' },
  { id: 'onchain', title: '链上来源与“巨鲸”标签', file: 'src/lib/server/crawl/sources/onchain.ts', type: '源码', note: '读取 DexScreener；whale_buy 来自成交量异常规则，不能据此确认某个巨鲸钱包买入。' },
  { id: 'analyze', title: '提取、去重、AI 分流与安全门', file: 'src/lib/server/crawl/analyze.ts', type: '源码', note: '无 AI 的通用提取要求币名或地址；docs 有独立变化规则。安全扫描连续第二次失败会放行无判定信号。' },
  { id: 'grok', title: 'Grok 调用与每日预算', file: 'src/lib/server/crawl/grok.ts', type: '源码', note: '固定版本中的 XAI_DAILY_CALLS 默认是 60；与 CRAWLERS 文档中的 300 不同。' },
  { id: 'jev', title: '可选的轻量决策层', file: 'src/lib/server/crawl/jev.ts', type: '源码', note: '经 OpenRouter 调用，提供选择与概率；它辅助相关性筛选，不验证消息真假。' },
  { id: 'scan', title: '代币扫描与分数', file: 'src/lib/server/scan.ts', type: '源码', note: '并行获取市场、持币、关联钱包、创建者等信息，以加减分规则输出风险等级。' },
  { id: 'xray', title: '合约字节码检查', file: 'src/lib/server/scan-xray.ts', type: '源码', note: '使用函数选择器、代理识别和 evmole 推断危险权限；包含启发式结论。' },
  { id: 'site', title: '网站静态安全检查', file: 'src/lib/server/scan-site.ts', type: '源码', note: '读取网站及脚本，结合 AST 与模式规则寻找疑似钱包盗取行为；不执行网站代码。' },
  { id: 'safe', title: '公开网页获取边界', file: 'src/lib/server/safe-fetch.ts', type: '源码', note: '限制协议、端口、私有地址、跳转和响应大小，适合在通用化后保留。' },
  { id: 'track', title: '判定后的结果追踪', file: 'src/lib/server/track.ts', type: '源码', note: '记录扫描时价格与流动性，随后持续采样；扫描追踪与爬虫自定义命中窗口是两种机制。' },
  { id: 'radar', title: '新币雷达', file: 'src/lib/server/radar.ts', type: '源码', note: '定时从新币数据中选候选再扫描；不是覆盖全部新发行代币的链上索引器。' },
  { id: 'duty', title: '可选的 Grok Bot 分析', file: 'src/lib/server/grok-duty.ts', type: '源码', note: '对新信号批量生成 LOOK / WATCH / AVOID；这是分析标签，不是自动下单。' },
  { id: 'tgpublic', title: 'Telegram 扫描与观察列表', file: 'src/lib/server/telegram-public.ts', type: '源码', note: '扫描回复、观察列表、预警与后续通知；需配置 Bot 并验证实际交付。' },
  { id: 'mcp', title: '供外部助手调用的 MCP', file: 'src/app/mcp/route.ts', type: '源码', note: '5 个工具：增量查询、代币扫描、信号、任务状态、最近扫描；没有资金转移工具。' },
  { id: 'auth', title: '钱包身份与会话', file: 'src/lib/server/auth.ts', type: '源码', note: '通过钱包签名登录，绑定私有信号读取权限；通用化必须一起改身份与所有权校验。' },
  { id: 'store', title: '状态、积分市场与治理', file: 'src/lib/server/store.ts', type: '源码', note: '核心业务集中在进程状态；市场和投票使用应用内积分，线上限制不能仅凭 README 确认。' },
  { id: 'persist', title: '真实的持久化方式', file: 'src/lib/server/persist.ts', type: '源码', note: '将状态保存到单个 JSON 文件，临时文件写入后重命名；存在 SQL 文件不等于已使用数据库。' },
  { id: 'buyback', title: '回购交易的签名边界', file: 'src/lib/server/buyback-tx.ts', type: '源码', note: '服务器构造交易，由金库钱包签名；定时窗口不代表服务器全自动完成交易。' },
  { id: 'limits', title: '来源、限制与运行成本说明', file: 'docs/CRAWLERS.md', type: '声明', note: '可作设计参考；预算、价格取样和去重细节应以固定版本代码复核。' },
  { id: 'license', title: '上游 MIT 许可证', file: 'LICENSE', type: '许可', note: 'Copyright (c) 2026 h100envy；引用上游材料时保留署名与许可证。' }
];
export const source = (id) => evidence.find((item) => item.id === id);

export const capabilities = [
  { id: 'x', category: 'collect', label: 'X / 社交动态', title: '关注指定账号和检索主题', desc: '将目标账号、查询词和时间范围交给 Grok 搜索，再按任务偏好提取结构化信号。', input: '@账号、查询词、关键词、自然语言要求', output: '带摘要、置信度和引用链接的候选信息', boundary: '依赖付费 API。搜索结果有覆盖与时效边界，不能当成 X 的完整消息订阅。', reuse: '采集外壳可保留，币圈提示词与输出字段需改写。', refs: ['x', 'grok'] },
  { id: 'telegram', category: 'collect', label: 'Telegram / 公开频道', title: '轮询公开频道的新消息', desc: '读取频道网页预览，用消息编号记录进度。无需通过用户账号读取聊天记录。', input: '公开频道名称或链接', output: '新增消息的文本、作者、时间和原文链接', boundary: '只覆盖有公开网页预览的频道；首次仅取最近 5 条。私有群与完整历史不在这条采集链路中。', reuse: '保留增量采集；规则提取与 AI 提示词改成通用事件。', refs: ['telegram', 'analyze'] },
  { id: 'docs', category: 'collect', label: 'Web / 网页变化', title: '发现公开页面新增了什么', desc: '第一次记住页面，之后比较新增文本行。可按关键词筛选，再用 AI 概述变化。', input: '官网、文档或博客 URL', output: '页面变化摘要和来源链接', boundary: '主要读取 HTML 文本，截取前 12,000 字符；没有执行 JavaScript，也不是递归抓取全站。版式变化可能造成噪声。', reuse: '最接近通用监控的现有模块，可补结构化提取和正文定位。', refs: ['docs', 'safe'] },
  { id: 'onchain', category: 'collect', label: 'DexScreener / 代币行情', title: '从行情中筛出新币和成交量变化', desc: '读取新代币档案、推广列表和搜索结果，按流动性、交易量、估值与年龄过滤。', input: '链、行情阈值、币名、观察地址', output: '新交易对与成交量异常候选', boundary: 'whale_buy 标签是成交量异常推断；没有逐笔证明具体巨鲸钱包买入。', reuse: '通用版移除这个适配器，改接 RSS、GitHub 或其他领域数据源。', refs: ['onchain'] },
  { id: 'scan', category: 'analyze', label: 'Instant Crawl / 风险扫描', title: '一次性检查一个代币', desc: '并行读取市场、持币分布、关联钱包、创建者历史和同名币，生成分数与解释。', input: '代币地址、链接或 $代码', output: '0–100 分及 CLEAN / OK / RISKY / DANGER / TOO_EARLY', boundary: '规则评分不是安全证明；接口失败可能造成数据缺失。各链支持的检查项目不同。', reuse: '检查框架可参考；通用版应替换为来源校验、相关性与变化重要度。', refs: ['scan'] },
  { id: 'xray', category: 'analyze', label: 'Contract X-Ray / 合约检查', title: '分析项目方仍掌握哪些权限', desc: 'EVM 侧读取字节码并分析危险权限；Solana 侧读取 Token-2022 扩展；项目网站检查疑似钱包盗取代码。', input: '已部署合约、代币扩展、项目网页脚本', output: '权限和风险因素，部分结论明确属于推断', boundary: '静态与启发式分析无法穷尽所有恶意行为；不等同于正式审计或交易执行模拟。', reuse: '属于币圈专用能力；安全取网页的底层设施值得保留。', refs: ['xray', 'site', 'safe'] },
  { id: 'jev', category: 'analyze', label: 'AI / 相关性分流', title: '先筛噪声，再做较重分析', desc: '可选 Jev 决策层判断候选是否值得关注；Grok 负责信息提取，或对不确定的信号进一步解释。', input: '候选信息、用户偏好、部分市场上下文', output: '相关性概率、结构化摘要或关注建议', boundary: '概率不是事实正确率。当前判断标准围绕交易；外部内容必须作为不可信输入。', reuse: '保留分层思路；重写判断标准，并将模型提供方配置化。', refs: ['analyze', 'jev', 'duty'] },
  { id: 'delivery', category: 'deliver', label: 'Inbox / Telegram / Mini App', title: '把结果送到用户正在看的地方', desc: '私有信号收件箱、Telegram 推送和移动端小程序，减少反复打开多个平台的操作。', input: '归属于某个用户的信号', output: '摘要、原文链接、风险说明及观察入口', boundary: '消息 Bot 需要配置与实际交付测试。通用版还需要通知去重、静默时间和摘要策略。', reuse: '保留推送通道，改写币卡片与用户绑定方式。', refs: ['tgpublic', 'auth'] },
  { id: 'outcome', category: 'deliver', label: 'Track Record / 结果回看', title: '记录提醒之后发生了什么', desc: '爬虫信号按用户窗口与涨幅目标评估；扫描判定另有 24 小时价格和流动性跟踪。', input: '信号时点、代币价格、用户阈值', output: '命中／未命中、峰值、回撤或扫描后结果', boundary: '达到涨幅不等于信息因果成立，也没有扣除交易滑点或证明可成交收益。', reuse: '改成“有用／无关”反馈、发现延迟、重复率与漏报抽样。', refs: ['scheduler', 'track', 'types', 'store'] },
  { id: 'radar', category: 'extend', label: 'Launch Radar / 自动发现', title: '系统主动寻找候选目标', desc: '从新币数据流筛选近期候选，再复用扫描流程；README 描述公开结果存在延迟策略。', input: 'DexScreener 档案与推广列表', output: '一组已扫描的新币条目', boundary: '覆盖受上游数据、候选过滤、扫描数量与预算约束；并非全网新币索引。', reuse: '可改成主题发现，但必须先定义领域来源与“值得发现”的标准。', refs: ['radar', 'readme'] },
  { id: 'mcp', category: 'extend', label: 'MCP / 助手接口', title: '让外部 AI 助手读取监控结果', desc: '提供 whats_new、scan_token、crawler_signals、my_crawlers、trending_scans 五个工具，支持凭据鉴权。', input: '经过授权的助手请求', output: '新信号、扫描报告、任务状态', boundary: '这些是读取与扫描工具，没有自动买卖或转账工具；客户端兼容性仍需逐一实测。', reuse: '保留鉴权与增量查询；将代币工具换成主题和事件工具。', refs: ['mcp'] },
  { id: 'economy', category: 'extend', label: 'Economy / 产品机制', title: '围绕监控任务设计付费与声誉', desc: '包含钱包付费创建与续期、积分市场、租赁、治理，以及金库回购相关代码。', input: '钱包签名、付款交易、积分余额', output: '监控权益、应用内交易与投票记录', boundary: 'README 的新旧状态冲突；市场和治理使用应用内积分，实际线上开放状态待验证。回购交易需要钱包签名。', reuse: '个人通用版可移除；商业版先明确普通账号、额度与付费关系。', refs: ['store', 'buyback', 'readme'] }
];

export const stages = [
  { title: '定时调度', short: '什么时候看', tag: '周期任务', input: '任务目标、来源、间隔、上次进度', action: '每 15 秒检查到期任务，最多并行运行 3 个；X 还受分档最小间隔限制。失败后退避，减少重复冲击来源。', output: '一次有超时限制的来源采集任务', note: '这是应用进程内的调度器。进程停止，监控也停止；不是分布式爬虫网络。', refs: ['scheduler', 'store'] },
  { title: '分源采集', short: '从哪里看', tag: '来源适配器', input: 'X 账号、公开频道、URL、行情条件', action: '每种来源使用各自实现：Grok 搜索、Telegram 网页预览、HTML 文本比较、DexScreener 请求。通过游标记住读到哪里。', output: '文本、URL、作者、时间等原始条目', note: '每种来源的覆盖范围都不同。统一界面不代表获得所有平台的完整数据。', refs: ['x', 'telegram', 'docs', 'onchain'] },
  { title: '规则与 AI 提取', short: '哪些值得看', tag: '结构化候选', input: '新条目、关键词、排除词、自然语言偏好', action: 'Grok 将信息转成 JSON 候选；无 AI 时使用规则。通用文本规则要求出现币名或地址；网页变化检测有独立规则，不受这一条件完全限制。', output: '信号类型、摘要、置信度、币名或地址、引用', note: '这一步包含大量领域假设。通用化时改提示词，还要改规则、类别与结构字段。', refs: ['analyze', 'docs', 'spec'] },
  { title: '关联与去重', short: '是不是同一个', tag: '代币身份', input: '候选币名、合约地址、已见记录', action: '通过 DexScreener 解析代币与行情，记录当时价格。按代币和信号类别，在 12 小时窗口中抑制重复。', output: '带代币标识与价格上下文的候选信号', note: '当前去重围绕代币，并未实现通用的跨平台事件聚类。同主题的新进展不能简单当作重复。', refs: ['analyze'] },
  { title: '可选 AI 分流', short: '先处理哪条', tag: 'Jev', input: '候选、任务关注点、市场上下文', action: '启用 Jev 时，判断它是否值得交易者关注。默认低于 15% 的候选被过滤，其余优先处理更有希望的条目。', output: '排序后的候选和可选概率标记', note: '模型是在判断相关性与关注价值，并没有替用户核实事实或证明未来表现。', refs: ['analyze', 'jev'] },
  { title: '代币安全门', short: '有哪些风险', tag: '规则扫描', input: '支持链上的已关联代币', action: '复用 Instant Crawl 扫描。DANGER 被过滤；扫描数量和时间预算不足的条目延后；首次失败重试，连续第二次失败会无判定放行。', output: '带判定的信号，或明确缺少判定的信号', note: '“全部安全验证、骗局绝不会到达用户”超出了实现保证。', refs: ['analyze', 'scan'] },
  { title: '私有交付', short: '怎么送到你', tag: '收件箱与 Bot', input: '信号、所属用户、通知设置', action: '保存到私有收件箱并向 Telegram 交付；可选 Grok Bot 为新信号补一行关注建议。外部助手可以经 MCP 读取授权范围内的结果。', output: '可追溯的摘要、引用、风险与建议', note: '公共地图主要显示任务与状态，不会让所有用户自动共享私有信号。', refs: ['store', 'duty', 'mcp'] },
  { title: '结果追踪', short: '后来怎么样', tag: '反馈闭环', input: '起始价格、时间窗口、涨幅阈值', action: '爬虫信号窗口内每 5 分钟采样，记录峰值和回撤，再判断是否达到目标；扫描记录另有 24 小时追踪机制。', output: '命中结果、运行统计与声誉输入', note: '通用监控没有统一的“涨了就正确”，需要设计与具体任务相符的评价标准。', refs: ['scheduler', 'track', 'types', 'store'] }
];

export const scenarios = {
  release: { title: '开源项目进展', rule: '只关注示例项目的新版本、兼容性变化和发布日期，忽略招聘与重复转发。', topic: '示例项目 · 版本进展', items: [
    { from: 'GitHub', title: '示例项目发布 v2.4，新增离线导出', kind: '相关', event: '版本发布', keep: true },
    { from: '官网', title: 'v2.4 更新说明与迁移指南', kind: '相关', event: '版本发布', keep: true },
    { from: 'X', title: '开发者转发 v2.4 发布公告', kind: '重复', event: '版本发布', keep: true },
    { from: 'Telegram', title: '社区招聘设计师', kind: '无关', event: '', keep: false },
    { from: '文档', title: '旧版插件需先升级 API 配置', kind: '相关', event: '兼容性变化', keep: true }
  ] },
  competitor: { title: '竞品变化', rule: '关注示例产品的套餐、价格与功能变化；忽略促销转发，保留官方依据。', topic: '示例产品 · 套餐变化', items: [
    { from: '官网', title: '示例产品新增团队套餐', kind: '相关', event: '套餐更新', keep: true },
    { from: 'RSS', title: '团队套餐现已开放，附功能对照', kind: '相关', event: '套餐更新', keep: true },
    { from: 'X', title: '转发团队套餐公告', kind: '重复', event: '套餐更新', keep: true },
    { from: '博客', title: '品牌故事与团队合影', kind: '无关', event: '', keep: false },
    { from: '文档', title: '单人套餐的导出额度调整', kind: '相关', event: '额度变化', keep: true }
  ] },
  industry: { title: '行业动态', rule: '关注示例行业的正式标准与实施日期，区分公告和观点，忽略活动广告。', topic: '示例行业 · 标准进展', items: [
    { from: '官网', title: '示例标准进入公开征求意见阶段', kind: '相关', event: '标准征求意见', keep: true },
    { from: 'RSS', title: '征求意见稿全文与截止时间', kind: '相关', event: '标准征求意见', keep: true },
    { from: 'X', title: '研究者讨论同一份征求意见稿', kind: '重复', event: '标准征求意见', keep: true },
    { from: 'Telegram', title: '行业活动早鸟票促销', kind: '无关', event: '', keep: false },
    { from: '公告', title: '旧版规范停止受理的日期确认', kind: '相关', event: '实施日期变化', keep: true }
  ] }
};

export const changes = [
  { kind: 'keep', title: '来源采集与游标', file: 'crawl/sources/*', desc: '保留 X、Telegram、网页来源的外壳、增量进度与超时处理；为来源增加能力描述和健康状态。' },
  { kind: 'keep', title: '调度、重试与预算', file: 'crawl/scheduler.ts · grok.ts', desc: '保留按周期执行和退避思路。个人版本可先单进程；稳定运行时增加持久任务状态与重启恢复。' },
  { kind: 'keep', title: '安全取页与访问隔离', file: 'safe-fetch.ts · http.ts', desc: '保留私有地址阻断、请求限制和归属校验思路；身份切换时一并重做授权，不能只删除登录页面。' },
  { kind: 'rewrite', title: '主题与多来源模型', file: 'types.ts · spec.ts · store.ts', desc: '新增主题、来源配置、原始条目、事件、投递记录。一个主题关联多个采集任务；人物、项目和别名替代代币标识。' },
  { kind: 'rewrite', title: '提取与 AI 判断', file: 'crawl/analyze.ts · grok-duty.ts', desc: '去掉币名强制条件与交易提示词；输出事件类型、涉及对象、变化、依据和提醒原因。规则路径也要支持普通信息。' },
  { kind: 'rewrite', title: '去重、关联与进展', file: 'analyze.ts · 新增事件层', desc: '先用来源 ID、规范 URL 和内容哈希去重；再按对象、时间和语义关联。新证据、日期修订和状态变化仍应提醒。' },
  { kind: 'rewrite', title: '账号、通知与页面', file: 'auth.ts · telegram* · app/*', desc: '钱包地址改为普通用户身份；币卡片改成事件卡片；增加已读、收藏、静默、每日摘要和投递去重。' },
  { kind: 'rewrite', title: '评价、存储与 MCP', file: 'reputation.ts · persist.ts · mcp/route.ts', desc: '用相关性反馈、发现延迟和重复率评价；按使用规模选择数据库；MCP 改为主题、事件、变更查询。' },
  { kind: 'remove', title: '链与代币扫描', file: 'scan*.ts · solana.ts · robinhood.ts', desc: '移除行情、合约、持币、创建者与币价追踪。通用安全取页设施单独保留。' },
  { kind: 'remove', title: '币圈经济与展示', file: 'buyback* · rewards* · economy.ts', desc: '移除钱包支付、金库、回购销毁、积分市场与治理。个人版先跑通监控，商业计费以后单独设计。' },
  { kind: 'new', title: '可扩展来源适配器', file: '新增 RSS / GitHub 等', desc: '每个适配器声明鉴权、覆盖范围、频率限制和增量游标。平台接入需要逐个实现，不能承诺全平台。' },
  { kind: 'new', title: '证据与可观察性', file: '新增原文快照与运行记录', desc: '保留发布时间、采集时间、原文、引用和判断版本；区分没更新、抓取失败、被过滤与预算耗尽。' }
];
