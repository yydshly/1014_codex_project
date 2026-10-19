import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 原创、可编辑的矢量总图。只汇总已留档的研究，不发起模型调用。
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const W = 2000, M = 64, G = 20, IW = W - M * 2;
const C = { paper:'#f5f4ef', ink:'#202840', muted:'#626d83', line:'#d9dee8', blue:'#223eec', blueBg:'#edf0ff', green:'#276b52', greenBg:'#e8f3ed', amber:'#946025', amberBg:'#fff2df', white:'#ffffff' };
const out = [], boxes = [];
const e = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function rect(x,y,w,h,fill=C.white,stroke=C.line,r=18) { out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`); }
function text(x,y,value,size=25,color=C.ink,weight=400) { out.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${e(value)}</text>`); }
function lines(x,y,values,size=25,color=C.muted,leading=35) { values.forEach((v,i)=>text(x,y+i*leading,v,size,color)); }
function rule(y) { out.push(`<path d="M${M} ${y}H${W-M}" stroke="${C.line}"/>`); }
function section(y,n,title,note,color=C.blue) {
  rect(M,y,48,42,color,color,10); text(M+10,y+29,n,22,'#fff',700);
  text(M+67,y+31,title,35,C.ink,700);
  if(note) text(W-M,y+28,note,21,C.muted,400), out[out.length-1]=out[out.length-1].replace('<text ','<text text-anchor="end" ');
}
function card(x,y,w,h,{label,title,body,fill=C.white,color=C.blue,size=25}) {
  rect(x,y,w,h,fill); rect(x+22,y+23,5,24,color,color,2);
  text(x+40,y+42,label,19,color,650); text(x+24,y+87,title,31,C.ink,700);
  lines(x+24,y+129,body,size,C.muted,35);
  const last = y+129+(body.length-1)*35;
  if(last>y+h-18) throw new Error(`卡片文字超出底部：${title}`);
  boxes.push({title,x,y,w,h});
}
function arrow(x1,y1,x2,y2,dashed=false,color='#8996b5') { out.push(`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5" ${dashed?'stroke-dasharray="7 6"':''} marker-end="url(#arrowhead)"/>`); }
function band(y,h,fill,title,body,color=C.blue) { rect(M,y,IW,h,fill,fill,14); text(M+24,y+39,title,27,color,700); if(body) text(M+24,y+78,body,24,C.muted); }
function link(x,y,label,href,size=19) { out.push(`<a href="${e(href)}" target="_blank"><text x="${x}" y="${y}" font-size="${size}" fill="${C.blue}" text-decoration="underline">${e(label)}</text></a>`); }

text(M,58,'009  /  DEMAND DISCOVERY  /  UNDERSTANDING MAP',21,C.blue,700);
text(W-M,58,'2026.10.19 · 本轮理解全景',21,C.muted); out[out.length-1]=out[out.length-1].replace('<text ','<text text-anchor="end" ');
text(M,133,'从个人网站，走向需求发现工具',63,C.ink,750);
text(M,184,'学习个人主页的沉淀、入口与复习更新；把实践连接到用户反馈，再向需求发现与产品化扩展。',28,C.muted);
[['源库事实',C.ink],['我们的推导',C.blue],['本地实测',C.green],['扩展假设',C.amber]].forEach(([t,c],i)=>{
  rect(M+i*200,218,178,40,c,c,20);text(M+18+i*200,246,t,21,'#fff',600);
});
text(906,246,'实线：当前路径　虚线：证据反馈与后续闭环',23,C.muted);

let y=302;
section(y,'01','源库实现什么？','JasonZhu.AI 个人品牌网站 [S1–S3]',C.ink); y+=66;
const cw=(IW-2*G)/3;
[
 {label:'内容与品牌',title:'把实践沉淀为可访问的内容',body:['博客、工具推荐、实战与出海内容。','项目外链和服务介绍，说明能提供什么。','中英文路由、内容索引与 SEO。'],color:C.ink},
 {label:'触达与承接',title:'让读者有进一步行动的入口',body:['Newsletter、资料领取、联系与服务入口。','浏览、点赞、评论及内容管理模块。','提供获客路径；实际转化效果未核实。'],color:C.ink},
 {label:'自动化管线',title:'来源 → AI → 内容发布',body:['RSS / 网页采集，AI 筛选与摘要。','保存结构化数据、生成 MDX。','定时工作流提交并触发部署。'],color:C.ink},
].forEach((c,i)=>card(M+i*(cw+G),y,cw,231,c)); y+=251;
band(y,94,C.blueBg,'值得迁移的方法：稳定来源 + AI 处理 + 可追溯保存 + 持续触达','源库技术参考：Next.js / MDX / Supabase / GitHub Actions / Vercel；我们的 009 使用独立实现。'); y+=112;
lines(M+4,y+24,['能力边界：快讯筛选围绕资讯价值；需求发现还要找到角色、任务、障碍、独立证据与反例。',
  'Agent Skills Hub 是外链独立项目；Archify 是另一个工具演示。原库未被验证具有我们的需求发现引擎。'],24,C.muted,36); y+=100;

section(y,'02','引发什么思考？','先学习沉淀与入口，再向需求发现扩展'); y+=66;
[
 {label:'01 / 沉淀给自己',title:'让每次探索成为可回看的资产',body:['保存来源、判断、实践结果与限制。','写清为什么继续、搁置或待验证。','让下次选题与实现能复用旧经验。'],fill:C.blueBg},
 {label:'02 / 入口给读者',title:'让别人理解你做过什么',body:['摘要 → 研究案例 → 方法与产品。','引导读者继续阅读、体验或联系。','用实际作品承接能力展示与触达。'],fill:C.blueBg},
 {label:'03 / 复习进入行动',title:'做之前回看，有反馈就更新',body:['相似项目开始时核对旧判断。','实践结束时记录结果和未解决问题。','新证据与用户反馈回来后修订。'],fill:C.blueBg},
].forEach((c,i)=>card(M+i*(cw+G),y,cw,229,c));y+=249;
band(y,98,C.ink,'研究 → 实践 → 记录 → 展示 → 接触用户 → 获得反馈 → 更新研究',null,'#ffffff');
text(M+24,y+78,'让自己找得到，让读者进得来，让反馈回得去；实际触达、使用和付费效果需要验证。',24,'#d2daef');y+=120;
const tw=(IW-4*G)/5;
[
 ['研究个人网站','展示内容、作品与能力。','怎样让成果被理解？'],
 ['连接推广和反馈','有人看到、联系、使用。','开发怎样进入闭环？'],
 ['找到上游瓶颈','没有依据地选题会空转。','谁真正需要什么？'],
 ['发现人群和任务','先看活动、角色与约束。','哪里反复费力？'],
 ['积累判断依据','核对已有办法与反例。','继续、收窄或搁置？'],
].forEach(([title,a,b],i)=>{
  const x=M+i*(tw+G);rect(x,y,tw,148,C.white);text(x+20,y+39,title,28,C.ink,700);lines(x+20,y+82,[a,b],23,C.muted,35);
  if(i<4) arrow(x+tw+2,y+73,x+tw+G-3,y+73);
}); y+=168;
band(y,101,C.blueBg,'可调查的问题 = 谁 + 什么情境 + 要完成的任务 + 障碍 + 已付代价','按“角色 × 任务 × 情境 × 约束”识别人群；按任务障碍聚合，避免只围绕 PDF、表格、AI 等对象词找题目。'); y+=125;

section(y,'03','怎样借助 AI 发现？','来源入口 → 活动与角色 → 问题假设 → 追查修正'); y+=66;
const sw=(IW-5*G)/6;
[
 ['社区与讨论','Reddit / HN','小红书 / 知乎 / V2EX','观察角色、过程与求助'],
 ['评论与评价','App Store / Google Play','G2 / Capterra / Trustpilot','观察失败情境与替代'],
 ['任务与预算','Upwork / Fiverr','Freelancer / 闲鱼','观察交付要求与代价'],
 ['技术与维护','GitHub Issues','Stack Exchange','观察复现、脚本和返工'],
 ['垂直业务','Shopify / WordPress','Etsy 等行业社区','沿同类任务交叉追查'],
 ['趋势与内容','Product Hunt / AppSumo','Trends / 视频平台','发现变化与新用语'],
].forEach(([t,a,b,c],i)=>{
  const x=M+i*(sw+G);rect(x,y,sw,160);text(x+18,y+35,t,27,C.ink,700);lines(x+18,y+74,[a,b,c],21,C.muted,31);
}); y+=188;
text(M,y,'27 个入口是研究目录；实际接入需逐源核查。当前自动探索走可用联网搜索与页面读取路径。',24,C.muted);y+=42;
const fw=(IW-3*G)/4;
const fy=y;
const steps=[
 {label:'01 / 设定探索边界',title:'宽泛领域即可开始',body:['市场、语言、实现范围、成本上限。','不预填具体痛点，也可先找人群。'],fill:C.blueBg},
 {label:'02 / 发现角色',title:'谁在真实地做什么？',body:['活动 → 角色 → 任务 → 聚集地。','用来源核对，按情境和约束细分。'],fill:C.blueBg},
 {label:'03 / 观察行为',title:'反复费力藏在哪里？',body:['手工、补缝、外包、等待、返工。','适配限制、放弃、变化新增负担。'],fill:C.blueBg},
 {label:'04 / 提出问题假设',title:'说明障碍与已付代价',body:['保存原文、上下文与其他解释。','没有依据的频率、预算保持未知。'],fill:C.blueBg},
 {label:'05 / 追查与反证',title:'已有办法为什么不够？',body:['从原文术语生成下一轮查询。','找独立经历、有效办法与反例。'],fill:C.blueBg},
 {label:'06 / 研究判断',title:'继续、收窄或搁置',body:['看重复性、严重度、替代方案。','区分信息操作与现实产能问题。'],fill:C.blueBg},
 {label:'07 / 修正下一轮',title:'新证据改变调查方向',body:['记录为何换人群、换问题或停止。','人工可复核、调整并导出依据。'],fill:C.blueBg},
];
const coords=[[0,0],[1,0],[2,0],[3,0],[3,1],[2,1],[1,1]];
steps.forEach((s,i)=>{const [col,row]=coords[i];card(M+col*(fw+G),fy+row*221,fw,201,{...s,size:23});});
card(M,fy+221,fw,201,{label:'贯穿全程 / 可追溯',title:'保留发现路径',body:['查询理由、来源、动作与失败状态。','区分事实、AI 解释、假设、未知。'],fill:C.white,color:C.ink,size:23});
for(let i=0;i<3;i++) arrow(M+(i+1)*fw+i*G+2,fy+102,M+(i+1)*(fw+G)-3,fy+102);
arrow(M+3*(fw+G)+fw/2,fy+204,M+3*(fw+G)+fw/2,fy+218);
for(let i=3;i>1;i--) arrow(M+i*(fw+G)-2,fy+321,M+i*(fw+G)-G+3,fy+321);
out.push(`<path d="M${M+fw+G+fw/2} ${fy+423}v18H${M+fw+G-10}V${fy-10}h${fw/2+10}v8" fill="none" stroke="${C.blue}" stroke-width="2" stroke-dasharray="7 6" marker-end="url(#arrowhead)"/>`);
y=fy+470;
text(M,y,'AI 的作用：拓展观察范围、理解上下文、连接相似任务、提出下一问；研究者负责核对证据与决定下一步。',25,C.blue,600); y+=52;
const ew=(IW-3*G)/4;
[['E1 找到材料','URL、原话、时间和读取状态'],['E2 看到具体障碍','某人、某任务、某种真实代价'],['E3 形成重复模式','独立表达 + 反例 + 已有办法'],['E4 取得行为验证','访谈中的真实任务、试用、复用或交易']].forEach(([a,b],i)=>{
  const x=M+i*(ew+G);rect(x,y,ew,96,i===3?C.amberBg:C.white);text(x+20,y+36,a,26,i===3?C.amber:C.ink,700);text(x+20,y+72,b,i===3?21:23,C.muted);
});y+=125;

section(y,'04','我们做过什么探索？','过程成果与证据强度分别记录',C.green);y+=66;
[
 {label:'起点 / 回到个人网站',title:'工具演示 → 校准研究对象',body:['001 Archify 做了网页演示。','随后回到个人网站的内容、推广与反馈。','工具能力和原站能力分别归属。'],color:C.green,fill:C.greenBg},
 {label:'004 / 人工取样与反思',title:'20 条问题记录 → 发现采样偏差',body:['Reddit、应用评论、Upwork 等取样。','结果偏文档、格式与交付类问题。','固定关键词会限制看到的人和问题。'],color:C.green,fill:C.greenBg},
 {label:'009 / 方法与运行原型',title:'平台地图 → OpenAI 自动探索',body:['整理 27 个入口、行为信号与证据规则。','从宽泛领域连续运行三轮调查。','人群、问题、来源和转向依据可查看。'],color:C.green,fill:C.greenBg},
].forEach((c,i)=>card(M+i*(cw+G),y,cw,229,c));y+=250;
rect(M,y,IW,402,'#f0f7f3','#c5ddcf');
text(M+26,y+42,'实验 001 · 2026.10.15 · 实际运行约 5 分 7 秒',27,C.green,700);
text(M+26,y+85,'输入：小型本地服务经营 / 英语市场 / 个人可做的网页工具；未预设清洁、擦窗或排班痛点。',25,C.ink);
text(M+26,y+128,'发现：清洁公司排班负责人、兼职上门汽车精洗经营者、兼有本职工作的早期擦窗经营者。',25,C.muted);
const decisions=[
 ['优先核实并收窄','周期排班中的剩余人工协调','已有固定周期、地区分组等有效反例。',C.blue,C.blueBg],
 ['有条件继续','临近服务取消后的空档处理','要区分协调困难与根本没有可接单客户。',C.green,C.greenBg],
 ['暂时搁置','天气 / 病假取消后无法补约','证据偏向时间产能不足，工具不能造时间。',C.amber,C.amberBg],
];
decisions.forEach(([a,b,c,color,fill],i)=>{
  const x=M+24+i*((IW-48-2*G)/3+G), w=(IW-48-2*G)/3;rect(x,y+158,w,138,fill,fill,12);
  text(x+18,y+193,a,23,color,700);text(x+18,y+232,b,26,C.ink,650);text(x+18,y+270,c,22,C.muted);
});
text(M+26,y+335,'记录：3 类人群 · 3 个问题候选 · 10 条来源链接 · 5 次检索调用 · 6 次页面打开动作',26,C.green,650);
text(M+26,y+375,'来源边界：6 条可关联打开动作；4 条为待核查链接；本地独立逐字核验成功 0 条。打开动作也不等于读完原文。',23,C.muted);
y+=425;
lines(M+4,y+22,['执行方式：本机已登录的官方 Codex CLI 调用 OpenAI；保留公开检索动作与结构化决策摘要，不展示内部推理。',
 '尚未证明：跨领域效果、账号独立性、当前问题仍存在、市场规模与付费。一次跑通的是发现管线。'],24,C.muted,36);y+=102;

section(y,'05','可以扩展什么价值？','以下均为下一阶段产品假设，按证据逐步推进',C.amber);y+=66;
const futures=[
 ['01 / 来源与覆盖','多渠道、多语言、垂直采集','目标：带回新角色与独立证据。','成立条件：授权可行、上下文能核对。'],
 ['02 / 持续观察','跟踪问题变化与新证据','目标：区分一次抱怨与反复出现。','成立条件：更新真正改变判断。'],
 ['03 / 机会研究','竞品、替代办法与可行性','目标：缩小到个人可做的切口。','成立条件：明确现有办法的剩余缺口。'],
 ['04 / 需求验证','访谈、真实任务和小实验','目标：验证重要性、使用与支付行为。','成立条件：接触目标人群，记录真实结果。'],
 ['05 / 产品落地','最小网页工具与反馈迭代','目标：把一项已证实的障碍处理好。','成立条件：有人能完成任务并愿意复用。'],
 ['06 / 商业化假设','专题情报、研究工作台或服务','目标：持续减少选题与研究成本。','成立条件：目标客户愿意反复使用或付费。'],
];
futures.forEach(([label,title,a,b],i)=>card(M+(i%3)*(cw+G),y+Math.floor(i/3)*208,cw,188,{label,title,body:[a,b],fill:C.amberBg,color:C.amber,size:23}));y+=425;
band(y,102,C.white,'对你的实际价值：更有依据地选择问题，更早排除不值得做的方向，把研究变成可复用资产','衡量：新增独立证据、判断是否改变、人工复核与调用成本、真实任务改善、复用与交易；不以抓取条数代替效果。',C.ink);y+=124;

rect(M,y,IW,173,C.ink,C.ink,18);
text(M+26,y+39,'产品扩展闭环 · 每一段都需要实际行为验证',24,'#b9c6ff',650);
text(M+26,y+86,'发现人群与问题 → 追查与筛选 → 真实任务验证 → 最小产品 → 使用与反馈 → 个人网站展示与触达',29,'#fff',650);
text(M+26,y+131,'反馈回到下一轮发现；案例、方法与产品沉淀到个人网站，持续接触目标人群。出海要继续验证本地任务、渠道与支付条件。',24,'#d9dfee');
out.push(`<path d="M${W-M-26} ${y+148}v13H${M+26}v-17" fill="none" stroke="#a5b7ff" stroke-width="2" stroke-dasharray="7 6" marker-end="url(#arrowhead)"/>`);
y+=205;rule(y); y+=35;
text(M,y,'来源与归属',23,C.ink,700);
link(M,y+34,'S1 · 原站首页（2026.10.19 复核）','https://jasonzhu.ai/');
link(650,y+34,'S2 · 固定版本 README / 采集脚本 / 定时工作流','https://github.com/zhuyansen/jasonzhu.ai/tree/9780c4408227e9b0bace1b1e2ed5160f341f2753');
link(M,y+68,'S3 · 作者建站记录','https://jasonzhu.ai/zh/blog/jasonzhu-ai-site-building-journey');
link(650,y+68,'S4 · 009 理解说明、实验 001 与结构化运行记录','../notes/UNDERSTANDING.md');
text(M,y+105,'源库版本：9780c4408227e9b0bace1b1e2ed5160f341f2753 · 权利保留；本图与 009 代码为独立整理，未复制原站代码或图片。',20,C.muted);
text(M,y+137,'当前首页另有选品周报与报告入口；属于内容观察参考，尚不能据此确认其后台具备我们的自动需求发现能力。',20,C.muted);
const H=y+175;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc"><title id="title">从个人网站到需求发现工具：009 理解全景图</title><desc id="desc">原库事实、思考演进、来源地图、AI 七步发现循环、证据层次、已做探索、首轮实测、六类扩展与完整产品反馈闭环。完整文字与引用见 UNDERSTANDING.md。</desc><defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L8 5L1 9" fill="none" stroke="#8996b5" stroke-width="1.5"/></marker></defs><rect width="${W}" height="${H}" fill="${C.paper}"/><g font-family="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif">${out.join('\n')}</g></svg>`;
await mkdir(path.join(project,'assets'),{recursive:true});
await writeFile(path.join(project,'assets/understanding-map.svg'),svg,'utf8');
console.log(`理解全景图已生成：${W} × ${H}，${boxes.length} 个内容节点。`);
