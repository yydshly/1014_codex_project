export const snapshot = {
  commit: '5a69f11ef0b2bdbdee611620af0f438c68d90f1e',
  shortCommit: '5a69f11',
  version: '2.16.6',
  date: '2026-10-15',
  repository: 'https://github.com/aozorae/Edgechat'
};
const tree = `${snapshot.repository}/blob/${snapshot.commit}/`;
export const sources = {
  readme: { title: '项目定位与功能说明', path: 'README.md', kind: '说明', note: '定位、邀请制、客户端与静态加密边界。' },
  config: { title: 'Cloudflare 资源与默认配置', path: 'wrangler.example.toml', kind: '配置', note: 'D1 / KV / R2 / DO 绑定，20 MiB 上传限制和消息保留配置。' },
  room: { title: '房间连接与消息广播', path: 'worker/src/do/ChannelRoom.js', kind: '源码', note: '会话鉴权、消息提交、WebSocket 广播及异步投影。' },
  submit: { title: '消息提交与去重', path: 'worker/src/message-submission.js', kind: '源码', note: '处理拉黑、回复、提及和 clientMessageId。' },
  messages: { title: '消息存储与解密读取', path: 'worker/src/data/messages.js', kind: '源码', note: '新正文先加密写入，再按会话读取和解密。' },
  socket: { title: '实时连接与断线恢复', path: 'docs/api/websocket-v1.md', kind: '协议', note: 'WebSocket 推送不作为唯一事实来源；恢复后进行 HTTP 同步。' },
  upload: { title: '附件上传与下载', path: 'worker/src/api/upload.js', kind: '源码', note: '上传校验、R2 密文存储，以及下载权限与解密。' },
  encryption: { title: 'AES-GCM 与版本化密钥', path: 'worker/src/encryption.js', kind: '源码', note: '32 字节密钥、随机 nonce、认证上下文与历史明文兼容。' },
  telegram: { title: 'Telegram 双向转发', path: 'worker/src/integrations/telegram/bridge.js', kind: '源码', note: 'Bot API 出站、来源去重、附件导入与尽力转发。' },
  webhook: { title: 'Telegram Webhook 入口', path: 'worker/src/api/telegram.js', kind: '源码', note: '验证 Webhook Secret，再按群绑定接收消息。' },
  bridge: { title: '跨实例群组绑定协议', path: 'docs/api/instance-bridge-v1.md', kind: '协议', note: '双向确认、HMAC、持久化 outbox、去重和投递范围。' },
  calls: { title: '一对一语音通话', path: 'docs/api/voice-calls.md', kind: '协议', note: 'WebRTC 媒体与信令分离；P2P / TURN 及网页通话范围。' },
  webmcp: { title: '五个 WebMCP 站点工具', path: 'frontend/src/webmcp.ts', kind: '源码', note: '注册登录、列群、读消息、发文字和打开私聊工具。' },
  roles: { title: '角色与权限模型', path: 'docs/rbac.md', kind: '说明', note: '角色、动作权限与服务端授权。' },
  notifications: { title: 'Telegram 离线提醒', path: 'docs/telegram-notifications.md', kind: '说明', note: '账号绑定 Bot、私信与提及提醒，不含消息正文。' },
  admin: { title: '首次管理员初始化', path: 'docs/admin-bootstrap.md', kind: '说明', note: '没有默认管理员密码，首次部署需要初始化。' },
  package: { title: '版本与技术依赖', path: 'package.json', kind: '配置', note: '固定提交中的应用版本为 2.16.6。' },
  license: { title: '上游许可证', path: 'LICENSE', kind: '许可', note: 'GNU GPL v3 正文；README 声明 GPL v3 or later。' }
};
for (const source of Object.values(sources)) source.url = tree + source.path;

export const roles = {
  member: {
    label: '我是使用者', heading: '打开一个网址，就能和自己的团队聊天。',
    description: '部署完成后，成员使用账号登录，在群里讨论、私信同伴、分享文件。它已经包含页面和后台，是一套可用的应用。',
    points: ['群组讨论与一对一私信', '网页、PWA 与 Android 入口', '通过邀请或管理员创建账号'], source: 'readme'
  },
  operator: {
    label: '我是部署者', heading: '你拥有一个实例，也承担这个实例的运营责任。',
    description: '应用与数据资源放进你的 Cloudflare 账号。平台承担底层服务器运行，你仍要管理账号、资源配置、密钥、更新与备份。',
    points: ['准备 Workers、D1、KV、R2 和 DO', '初始化管理员并保存加密密钥', '按实际用量关注配额与成本'], source: 'config'
  },
  developer: {
    label: '我是开发者', heading: '你研究的是完整系统，可以沿业务链路拆解。',
    description: '从 Vue 界面到权限、消息持久化和实时广播都有实现。二次开发应先理解会话权限和存储协议，再选择需要修改的层。',
    points: ['Vue 3 前端 + Hono / Workers 后端', '房间消息与用户收件箱分别推送', '通过 API 和 WebMCP 扩展入口'], source: 'room'
  }
};

export const features = [
  { id: 'chat', category: 'communication', icon: 'chat', title: '群聊与私信', label: '日常沟通', status: '已有实现',
    description: '公开群、私有群、一对一私信；带回复、@ 提及、置顶与未读状态。',
    principle: '服务端核验会话权限，再保存消息并推送。clientMessageId 用于识别同一条重试消息。',
    boundary: '可访问的会话由账号和服务端权限决定；私信还检查双方拉黑状态。', sources: ['submit', 'room', 'socket'] },
  { id: 'files', category: 'communication', icon: 'file', title: '文件与语音消息', label: '异步分享', status: '已有实现',
    description: '分享图片、视频和文件，也可以录音后发送语音消息。',
    principle: '附件先校验类型和大小，再加密写入 R2；消息保存附件引用。录音文件与实时通话走不同链路。',
    boundary: '默认单个上传上限 20 MiB，可配置；Telegram 入站源码对超过 16 MB 的附件提示未同步。', sources: ['upload', 'telegram', 'config'] },
  { id: 'calls', category: 'communication', icon: 'phone', title: '一对一语音通话', label: '实时声音', status: '范围明确',
    description: '网页私信可发起语音通话，支持静音、挂断与 P2P / TURN。',
    principle: 'WebRTC 负责声音；Worker 和 VoiceCall DO 传递 SDP、ICE 与通话控制。配置 TURN 后，直连失败可回退中继。',
    boundary: '当前文档范围仅网页一对一；群语音、视频、SFU 与 Android 通话不在该版范围。没有 TURN 配置时只能尝试直连。', sources: ['calls'] },
  { id: 'telegram', category: 'bridge', icon: 'plane', title: 'Telegram 双向桥接', label: '跨应用互通', status: '需配置 Bot',
    description: '一个讨论，两种入口。网页群与 Telegram 群互通文字和多种媒体。',
    principle: 'Bot API 向 Telegram 转发；Webhook 接收入站消息，转换来源身份并落入本站群聊。',
    boundary: '只桥接群组；私信不进入桥接。来自另一条桥的消息不会再转发，Telegram 出站采用尽力转发。', sources: ['telegram', 'webhook', 'bridge'] },
  { id: 'instance', category: 'bridge', icon: 'network', title: '独立站点群组互联', label: '跨实例互通', status: '需双方确认',
    description: '两个 EdgeChat 站点可以把各自的一个群连接起来。',
    principle: '一次性邀请与双方管理员确认后，通过签名 HTTPS 请求、持久化 outbox、重试和去重投递。',
    boundary: '只转发绑定后的本站原创无附件新消息；不补历史，不跨站传播编辑或撤回，每群最多一个未撤销绑定。', sources: ['bridge'] },
  { id: 'accounts', category: 'management', icon: 'shield', title: '邀请、权限与封禁', label: '成员管理', status: '已有实现',
    description: '由管理员创建账号或发送邀请，支持权限控制及临时、永久封禁。',
    principle: '权限判断在服务端执行；重要业务重新核验账号、会话成员与动作权限。',
    boundary: '不开放公开自助注册；首次管理员需要初始化，不存在开箱默认管理员密码。', sources: ['readme', 'roles', 'admin'] },
  { id: 'clients', category: 'management', icon: 'device', title: '多端与离线提醒', label: '访问与通知', status: '部分需配置',
    description: '响应式网页、PWA、Android Web UI 客户端；可绑定 Telegram 接收提醒。',
    principle: 'Android 客户端内置 Web UI 并接入少量系统能力；离线提醒通过个人绑定的 Bot 发送。',
    boundary: '当前 Android 客户端不含 FCM 或离线 Outbox，不承诺应用停止后的即时通知；Telegram 提醒不含正文。', sources: ['readme', 'notifications'] },
  { id: 'ai', category: 'extension', icon: 'spark', title: 'AI 可操作的站点', label: 'WebMCP', status: '需兼容客户端',
    description: '向外部 AI 提供登录、列群、读消息、发文字和打开私聊五个工具。',
    principle: '网页向兼容的 modelContext 注册工具，工具复用现有账号会话和业务 API。',
    boundary: '站点工具是操作入口。摘要、推理、自动回复由外部 AI 实现；工具当前发送的是纯文字。', sources: ['webmcp'] }
];

export const nodes = {
  client: { label: 'Vue 前端', type: '交互层', title: '把系统变成可使用的聊天界面',
    job: '展示会话、历史消息、录音、上传和通话入口。浏览器承担 UI 与 WebRTC 客户端逻辑。',
    why: '使用者面对的是完整页面，开发者不用从空白界面开始搭建。',
    boundary: '前端不能替代服务端授权；本研究页中的示意聊天只在浏览器内运行。', source: 'package' },
  worker: { label: 'Workers + Hono', type: '请求入口', title: '先确认是谁，再决定能做什么',
    job: '处理 HTTP API、登录会话、权限检查、文件读写入口和第三方回调，把请求路由到对应业务。',
    why: '按请求运行应用后端，把常驻进程与机器维护交给 Cloudflare。',
    boundary: '仍需配置环境、密钥与云资源；平台依赖和配额仍然存在。', source: 'config' },
  room: { label: 'Durable Objects', type: '有状态协调', title: '让同一个会话拥有共同的协调点',
    job: 'ChannelRoom 管理房间连接与广播，UserInbox 投递用户级提醒，其他 DO 处理通话与跨实例任务。',
    why: '普通请求入口之外，聊天还需要管理长连接和持续状态。WebSocket Hibernation 让连接可以由平台托管。',
    boundary: '实时广播不是永久消息存储；消息历史仍依赖数据库。', source: 'room' },
  d1: { label: 'D1', type: '持久化', title: '消息历史与业务数据的存放处',
    job: '保存用户、群组、成员关系、消息与跨实例 outbox 等结构化数据。新消息正文加密后写入。',
    why: '用户重新打开页面、断线或切换设备时，可以重新取回允许访问的记录。',
    boundary: '加密覆盖正文不等于所有元数据均加密；历史明文保持兼容读取。', source: 'messages' },
  kv: { label: 'KV', type: '会话存储', title: '保存登录会话',
    job: 'SESSIONS 绑定提供登录会话存储，业务操作据此识别当前身份。',
    why: '让后续请求延续登录状态，再结合业务权限判断可访问范围。',
    boundary: 'KV 会话存储和 D1 聊天历史承担不同职责。', source: 'config' },
  r2: { label: 'R2', type: '对象存储', title: '文件内容与消息记录分开保存',
    job: '保存新上传附件的加密字节。下载经 Worker 验权、读取和解密后返回。',
    why: '文件适合放进对象存储；数据库保存引用与必要元数据。',
    boundary: '文件类型、大小和访问受限制；文件名等元数据并非全部加密。', source: 'upload' }
};

const step = (title, subtitle, explanation, trace, source, state) => ({ title, subtitle, explanation, trace, source, state });
export const journeys = {
  message: { label: '群聊文字', note: '一次发送，分成权限、存储、推送和外部投递几个职责。', badge: '文字消息路径',
    steps: [
      step('发出请求', '前端 → Worker', '成员提交文字与当前会话信息。可携带 clientMessageId，帮助重试时识别同一条消息。', '界面收集输入，调用消息业务入口。', 'submit', 'draft'),
      step('核验权限', '身份 → 会话', '服务端检查登录状态和会话访问权；私信还需检查拉黑关系。被拒绝的请求不能继续写入。', '授权先于消息提交；浏览器的界面状态不能代替授权。', 'room', 'authorized'),
      step('加密落库', '正文 → D1', '正文使用当前版本的 AES-GCM 密钥加密后写入 D1。记录包含密钥版本，供后续读取时选择旧密钥。', '这是存储前加密，Worker 此时接触到了明文。', 'messages', 'stored'),
      step('实时广播', '房间 → 在线成员', 'ChannelRoom 将保存后的规范消息广播给有权限的连接；用户 Inbox 更新未读等信号。', 'WebSocket 用于实时通知；断线恢复仍通过 HTTP 同步。', 'room', 'received'),
      step('异步后续', '提醒 / 已配置的桥', '提交后再更新未读、转发 Telegram、唤醒跨实例任务。跨实例 outbox 与消息写入同事务登记，再异步投递。', '本站发出成功与外部系统已收到是两个状态；重试能力因桥而异。', 'bridge', 'complete')
    ] },
  attachment: { label: '上传附件', note: '文件存 R2，消息存引用；上传成功并不等于消息已经发送。', badge: '附件消息路径',
    steps: [
      step('选择文件', '浏览器 → 上传接口', '成员选择文件并上传。服务端检查会话、内容类型、文件大小；默认最大 20 MiB。', '上传限制由服务端配置与校验决定。', 'upload', 'draft'),
      step('加密保存', '文件字节 → R2', '服务端生成附件对象键，加密文件字节后写入 R2，并记录上传元数据。', '加密认证数据包含对象键，防止密文被替换到另一个下载地址。', 'encryption', 'stored'),
      step('引用入消息', '附件引用 → D1', '发消息时携带附件引用。服务端检查附件是否存在、能否使用，再保存并广播消息。', '文件与消息关联后，接收者才在会话中看到附件。', 'submit', 'received'),
      step('验权下载', 'R2 → Worker → 成员', '接收者请求文件时先核验访问权；Worker 从 R2 读取并解密，返回文件内容。', '浏览器得到可用文件；存储中的文件字节保持加密。', 'upload', 'complete')
    ] },
  telegram: { label: 'Telegram 回流', note: '群绑定把外部消息导入本站；来源标记让它不会再次跨桥扩散。', badge: '入站桥接路径',
    steps: [
      step('收到回调', 'Telegram → Webhook', '群成员发言后，Telegram 向配置的 Webhook 推送更新。接口验证 Bot Webhook Secret。', '来自 Telegram 的 HTTP 请求也需要验证。', 'webhook', 'draft'),
      step('映射群组', 'TG 群 → 本站群', '服务端查找已启用的群映射，解析发送者与消息；用来源消息 ID 避免重复导入。', '外部成员以来源身份显示，不需要注册为本站账号。', 'telegram', 'authorized'),
      step('导入与落库', '外部消息 → 本站存储', '媒体按规则下载导入，文字与附件进入本站消息提交链路。外部来源也有自己的加密认证上下文。', '入站超过大小限制的附件会被跳过，并附带说明。', 'telegram', 'stored'),
      step('站内可见', 'ChannelRoom → 网页成员', '消息广播到本站群里并显示 TG 来源。它不再进入其他桥的出站链路，避免循环转发。', 'Telegram → EdgeChat → 另一实例，不是当前支持的跨桥传播路径。', 'bridge', 'complete')
    ] },
  voice: { label: '语音通话', note: '通话控制经过后端，音频由 WebRTC 传输，和录音消息不同。', badge: '通话连接路径',
    steps: [
      step('发起呼叫', '私信 → 通话控制', '网页私信的一方发起呼叫；服务端核验两人会话、有效状态与拉黑关系，再投递来电。', '本版要求双方在线并留在聊天工作区。', 'calls', 'draft'),
      step('协商连接', '双方交换 SDP / ICE', 'VoiceCall DO 与用户 Inbox 协调接听、连接候选和通话状态。信令不写入聊天记录。', 'Worker 负责传信令，不转发或保存音频。', 'calls', 'authorized'),
      step('连接声音', 'WebRTC P2P / TURN', '默认先尝试直连。已配置 TURN 时，直连未成功可重新协商中继；也能主动选择中继模式。', 'WebRTC 负责音频加密与传输；TURN 是网络中继。', 'calls', 'received'),
      step('结束与释放', '挂断 / 超时 / 离开', '挂断、离开工作区或超时后结束通话并释放席位。后台、锁屏或网络挂起时不保证继续通话。', '当前通话文档上限为单次 1 小时；不提供录音归档能力。', 'calls', 'complete')
    ] }
};

export const bridges = {
  telegram: { label: 'Telegram 桥接', left: 'EdgeChat 群', right: 'Telegram 群', via: 'Bot API + Webhook',
    title: '保留不同入口，让讨论继续流动。',
    description: '网页用户与 Telegram 用户可以在各自的入口参与绑定群的讨论。入站消息带外部来源身份，附件按两侧规则转换。',
    rows: [['内容范围', '文字、图片、视频、语音与文件，受格式及大小限制'], ['建立方式', '部署者配置 Bot，再由管理员绑定群组'], ['可靠性', 'Telegram 出站为尽力转发，不能等同跨实例持久化重试'], ['不参与同步', '一对一私信，以及从其他桥导入的消息']], source: 'telegram' },
  instance: { label: '跨实例桥接', left: 'EdgeChat A 的群', right: 'EdgeChat B 的群', via: '签名 HTTPS + Outbox',
    title: '各自管理自己的站点，只连接选定的群。',
    description: 'A 生成一次性邀请，B 选择本群并认领，A 最终确认后激活。双方不交换本站主加密密钥，也不会创建远端可登录账号。',
    rows: [['内容范围', '绑定之后的本站原创无附件新消息，可含 Markdown'], ['建立方式', '10 分钟一次性邀请，双方管理员确认；每群最多一个绑定'], ['可靠性', '持久化 outbox、签名、重试与接收去重；不保证来源发送顺序'], ['不参与同步', '旧消息、附件及其说明、跨站编辑与撤回、其他桥的消息']], source: 'bridge' }
};

export const suitability = {
  team: { label: '小团队 / 私人圈子', verdict: '值得进一步试部署',
    reason: '需要独立聊天入口、邀请制成员管理，又希望减少常驻服务器维护，和项目的目标比较一致。',
    checks: ['确认成员的实际网络可达性', '验证备份、密钥保管与消息保留策略', '真实设备测试录音、文件和离线提醒'] },
  telegram: { label: '已有 Telegram 社区', verdict: '桥接是最直接的价值',
    reason: '成员可以继续用 Telegram，同时提供自己的网页入口。先确认需要同步的群与媒体类型，再测试双向实际投递。',
    checks: ['配置 Bot 与群绑定', '确认哪些讨论允许进入 Telegram', '测试媒体大小、重复消息与失败表现'] },
  privacy: { label: '严格隐私通信', verdict: '先核对信任模型',
    reason: '服务端可以解密正文与附件，因此需要信任部署方与 Cloudflare。若需求是运营者也无法读取内容，当前存储加密模型无法满足。',
    checks: ['区分静态加密和端到端加密', '考虑桥接后外部副本的保存与传播', '确认元数据、历史明文与密钥生命周期'] },
  enterprise: { label: '大规模 / 企业协作', verdict: '当前证据不足，需另行评估',
    reason: '功能列表不能证明容量或企业级适配。本研究没有进行压测，也未核验 SSO、审计、合规归档等能力是否满足你的要求。',
    checks: ['测量并发连接、广播延迟与数据库负载', '评估资源配额、实际费用和故障恢复', '逐项核验企业身份、治理与审计需求'] }
};

// 后续讨论形成的产品假设；不作为上游现成功能或已验证市场需求。
export const productDirections = {
  delivery: {
    label: '客户交付协作室', audience: '设计师、外包团队与客户', priority: '有实际交付需求后再验证',
    title: '让讨论、文件与确认留在同一个项目里。',
    problem: '围绕交付物反复确认时，文件版本、修改意见和最终结论容易散落在不同聊天入口。',
    reuse: '私有群、私信、附件与未读提醒，可以作为一个项目沟通空间的基础。',
    build: '项目与会话映射、网站账号与成员权限、文件版本、待办和交付确认。',
    value: '价值来自交付更清楚、少找文件、少重复确认；这些效果需要真实项目验证。',
    gate: '先确认已有沟通方式具体卡在哪里，以及客户是否愿意在项目内协作。'
  },
  feedback: {
    label: '页面反馈与处理', audience: '网站用户与开发维护者', priority: '适合自用验证，未必需要聊天',
    title: '用户就在遇到问题的页面反馈，处理进展能被看见。',
    problem: '收到“页面不好用”时，维护者还需要追问页面、操作和表现；处理后也容易忘记回告。',
    reuse: '消息、图片和附件可承载补充交流，现有接口可作为接入基础。',
    build: '嵌入入口、问题上下文、身份对接、独立会话权限、处理状态和完成通知。',
    value: '验证是否减少追问、提高问题解决率。如果没有实时交流需求，反馈表加状态可能已经够用。',
    gate: '先观察实际反馈量和往返沟通次数，不为了使用聊天后端而增加整套系统。'
  },
  telegram: {
    label: 'Telegram 支持台', audience: '已有 Telegram 群的运营团队', priority: '人群明确时较匹配',
    title: '群里的求助有人接手，也有处理结果。',
    problem: '活跃群中的问题容易被新消息淹没，重复提问与未解决求助难以跟进。',
    reuse: '已有 Telegram 群双向桥接、来源标记和站内群聊。',
    build: '求助提取、负责人、状态、回答回流和知识整理；网站访客私有客服路由仍需另外开发。',
    value: '与该项目的桥接特色较匹配，但只对已经使用 Telegram 且有跟进痛点的人群成立。',
    gate: '现有桥接是群组互通，不能直接视为访客私信、客服分配或全渠道支持台。'
  },
  agent: {
    label: 'AI 任务协作室', audience: '需要人与 AI 共同处理任务的团队', priority: '潜力假设，新增工作较多',
    title: '围绕任务交流，并把执行结果带回会话。',
    problem: '人和 AI 在多个工具之间复制上下文、传递结果，任务状态和失败处理不连贯。',
    reuse: '聊天会话、附件、现有 API 与五个 WebMCP 操作入口。',
    build: '模型、任务状态、执行工具、明确授权、人工确认、结果来源和失败恢复。',
    value: '需要证明任务真的更容易完成。增加一个会说话的机器人本身不足以证明产品价值。',
    gate: 'WebMCP 是操作入口，不是现成的持续运行 Agent、执行引擎或任务编排系统。'
  },
  sdk: {
    label: '通用嵌入聊天 SDK', audience: '为网站或软件接入聊天的开发者', priority: '自用可复用，对外暂不优先',
    title: '封装成组件可以省重复工作，售卖还需要明确优势。',
    problem: '多个自有网站重复开发聊天界面和接口整合，有机会通过统一模块减少重复工作。',
    reuse: '消息接口、会话、文件与实时推送的已有后端逻辑。',
    build: '可嵌入界面、账号互认、稳定 API、框架适配、版本兼容；对外服务还需隔离、监控与运维。',
    value: '有潜在复用价值，实际节省需结合接入与维护成本评估；商业价值需要与成熟 SDK 比较接入体验和具体购买理由。',
    gate: '网站能访问完整聊天室，不等于任意网站已可一键嵌入。当前不主动开发通用 SDK。'
  },
  media: {
    label: '多人音视频会议', audience: '需要群语音、视频或屏幕共享的团队', priority: '当前不优先',
    title: '扩展音视频种类，会进入更大的媒体工程。',
    problem: '多人会议需要处理并发媒体、网络差异、设备兼容和持续通话体验。',
    reuse: '当前网页一对一 WebRTC 语音和通话控制思路。',
    build: '多人媒体服务、视频与共享逻辑、网络质量管理、移动端适配及相关运营能力。',
    value: '改造范围明显扩大，而现有基础能省下的工作相对有限。需先有明确场景再讨论。',
    gate: '群语音、视频会议和屏幕共享不属于当前已核读版本的通话范围。'
  }
};

export const comparisonProducts = [
  { title: 'Chatwoot', url: 'https://www.chatwoot.com/features', capability: '网页客服挂件、多渠道支持与 AI 自动化', implication: '通用客服和加一个 AI 模型，已有现成替代方案。' },
  { title: 'CometChat', url: 'https://www.cometchat.com/chat-and-messaging', capability: '聊天 SDK、API 与预制界面组件', implication: '封装聊天 SDK 还需要证明接入便利性或特定适配优势。' },
  { title: 'Canny', url: 'https://canny.io/features/portal', capability: '用户反馈、讨论、状态和进展通知', implication: '反馈方向也需要具体问题，不能把可开发当作市场空白。' }
];
