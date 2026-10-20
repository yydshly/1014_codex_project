import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Deterministic information diagram. Original screenshots are embedded unchanged.
const dir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Resvg } = require('../../web/.cache/overview-render/node_modules/@resvg/resvg-js');
const W=2560, H=5580;
const evidence=JSON.parse(await fs.readFile(path.join(dir,'../takeover-voice/verification.json'),'utf8'));
assert.equal(evidence.status,'completed');
assert.equal(evidence.pauseInterval.workActivityCount,0);
assert.equal(evidence.implementationChecks.takeoverTests.passed,58);
assert.equal(evidence.browser.at(-1).cases.length,3);
assert.equal(evidence.browser.at(-1).cases.reduce((sum,item)=>sum+item.steps,0),20);
assert.match(evidence.commands.find(item=>item.command.join(' ')==='npm run test').stdoutTail,/# pass 81/);
const c={bg:'#f4f1e9',paper:'#fffdf8',ink:'#19383b',muted:'#536b6b',line:'#d8dfd8',green:'#286658',soft:'#e6eee5',gold:'#bf8e4e',sand:'#f0e6d5',dark:'#172e31',white:'#f6f5e9',gray:'#ebeeea',future:'#726d60',red:'#a45c53'};
const out=[], blocks=[];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function rect(x,y,w,h,fill=c.paper,rx=22,stroke){out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="2"`:''}/>`);}
function line(x1,y1,x2,y2,color=c.line,width=2,dash){out.push(`<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}"${dash?` stroke-dasharray="${dash}"`:''}/>`);}
function text(s,x,y,size=32,color=c.ink,weight=400,extra=''){out.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(s)}</text>`);}
function units(s){return [...s].reduce((a,ch)=>a+(/[\u0000-\u00ff]/.test(ch)?(/[@MW]/.test(ch)?.83:/[il.,:;!| ]/.test(ch)?.28:.56):1),0);}
function wrap(s,width,size){const lines=[];let current='';for(const ch of s.match(/[A-Za-z0-9][A-Za-z0-9._/+:-]*|[\s\S]/g)||[]){if(ch==='\n'){lines.push(current);current='';continue;}if(units(current+ch)*size>width&&current&&!/^[、，。；：）】》！？]$/.test(ch)){lines.push(current.trimEnd());current=ch.trimStart();}else current+=ch;}if(current)lines.push(current);return lines;}
function para(s,x,y,width,size=32,lh=48,color=c.ink,weight=400){const lines=wrap(s,width,size);lines.forEach((v,i)=>text(v,x,y+i*lh,size,color,weight));blocks.push({text:s,x,y,width,size,lines:lines.length,bottom:y+(lines.length-1)*lh});return y+lines.length*lh;}
function pill(s,x,y,w,fill=c.soft,ink=c.green,size=25){rect(x,y,w,42,fill,21);text(s,x+19,y+29,size,ink,600);}
function heading(n,title,y,subtitle){text(n,88,y,35,c.green,700);text(title,166,y,43,c.ink,700);if(subtitle)text(subtitle,2472,y,27,c.muted,400,'text-anchor="end"');}
function bullet(title,body,x,y,width){text(title,x,y,32,c.green,700);return para(body,x,y+44,width,29,43,c.ink);}
function arrow(x1,y1,x2,y2,color=c.green,width=3){line(x1,y1,x2,y2,color,width);out.push(`<path d="M${x2-11} ${y2-8} L${x2} ${y2} L${x2-11} ${y2+8}" fill="none" stroke="${color}" stroke-width="${width}"/>`);}
async function image(file,x,y,w,h){const bytes=await fs.readFile(path.join(dir,'..',file));out.push(`<image href="data:image/jpeg;base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`);return {file,sha256:createHash('sha256').update(bytes).digest('hex')};}

out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif"><title>从3D lo-fi小屋到可接管的Agent工作室：003项目理解总览</title><desc>来源、技术原理、六位角色、任务闭环、接管流程、探索、现有效果、验证、未来方向与边界，包含三张本地实际截图。</desc>`);
rect(0,0,W,H,c.bg,0);
rect(0,0,W,302,c.dark,0);
text('PROJECT 003  /  研究理解总览  /  2026.10.20',88,68,28,'#afc7bd',600,'letter-spacing="3"');
text('3D lo-fi 小屋 → 可接管的 Agent 工作室',88,159,76,c.white,700);
text('让目标、角色、动作、语音与交付，共用同一条真实执行主线。',92,225,36,'#d3dfd5');
pill('本地可运行 · V1 研究原型',1908,243,564,'#294746','#e2e9d6',26);

heading('01','源能力是什么？我们的理解是什么？',365);
rect(88,402,1154,410);rect(1274,402,1198,410,c.soft);
pill('原演示：已观察；源仓库：待确认',120,429,618,c.sand,'#80633b',26);
let y=para('原帖展示 3D lo-fi 房间、方块人物与动画，作者提及 Three.js、Opus、Midjourney。',120,520,1088,33,48);
y=para('场景仓库、固定版本、资产许可及内部实现尚未确认。不能把我们的扩展归为原作者已有能力。',120,y+15,1088,30,45,c.muted);
para('本项目独立实现房间、角色、纹理、界面与合成音乐；未复制原作者图片、视频、模型或音乐。',120,y+14,1088,29,43,c.muted);
text('人物成为 Agent 的身份与工作入口',1310,469,40,c.green,700);
const values=[['谁在做什么','角色、工位、电脑与实际执行状态'],['怎样协作','白板、伙伴对话、产物交接与返工'],['如何介入','工作台、暂停、修改意见与显式继续'],['交付在哪里','Demo、源码、测试、截图与任务历史']];
values.forEach(([a,b],i)=>{text(a,1310,533+i*61,30,c.green,700);text('→ '+b,1517,533+i*61,30,c.ink);});
text('价值：观察进展、定位问题、介入协作、核对交付。',1310,784,29,c.green,600);

heading('02','现在呈现什么效果？',890,'跨两次真实任务的实拍 · 原图按比例嵌入');
rect(88,926,1510,1007,c.dark);rect(1630,926,842,487,c.dark);rect(1630,1473,842,487,c.dark);
const sources=[];
sources.push(await image('takeover-voice/02-waiting-for-continue.jpg',88,926,1510,849.375));
text('A  房间里的协作现场',122,1827,36,c.white,700);
text('小蓝与伙伴到白板讨论，方案形成后仍等待确认。',122,1876,29,'#d1ded2');
sources.push(await image('role-takeover/03-code-and-control.jpg',1630,926,842,473.625));
text('B  较早接管实测：代码、差异、命令与工作台控制',1635,1450,27,c.ink,600);
sources.push(await image('takeover-voice/04-delivery-and-browser-results.jpg',1630,1473,842,473.625));
text('C  同一任务的成果：可操作 Demo、证据与人工验收',1635,1998,27,c.ink,600);
pill('真实执行 / 历史回看 / 预设演示分别标识',122,1955,1022,c.soft,c.green,29);

heading('03','原理是什么？从真实工具到房间表现',2080,'执行事实由后台产生，场景负责可观察与可交互');
const arch=[
 {x:88,t:'角色与协作编排',sub:'身份 + 职责 + 输入产物',lines:['AI SDK ToolLoopAgent 按角色与阶段调用 MiniMax，Zod 校验结构化交付。','协调、研究、开发、审阅、验证、记录共享目标与验收，传递产物和来源。','角色按阶段创建执行实例；当前不具备跨任务的长期个人记忆。']},
 {x:904,t:'后台执行与证据',sub:'受限工具 + 可追踪事件',lines:['Node 在独立目录固定源码版本、安装依赖、修改文件、运行原构建与测试。','Playwright 打开真实 Demo，执行冻结的需求用例；结果、截图和日志落盘。','任务 ID、源码运行 ID、意见版本与有序事件保持关联，可重连与导出。']},
 {x:1720,t:'房间、人物与语音',sub:'状态机 + 场景映射',lines:['Three.js 几何、灯光与纹理构成房间；寻路、姿态与脚底接触控制动作。','工具事件更新人物动作、实体电脑、白板和工作台；播放与执行解耦。','MiniMax TTS 串行播报公开回应；音频能量驱动口型，字幕与发言人同步。']},
];
for(const a of arch){rect(a.x,2118,752,414);text(a.t,a.x+30,2174,37,c.green,700);text(a.sub,a.x+30,2218,27,c.muted);let yy=2270;for(const s of a.lines)yy=para(s,a.x+30,yy,692,29,42,c.ink)+13;}
arrow(854,2310,892,2310);arrow(1670,2310,1708,2310);
text('同一条事实链：目标 / 任务 ID → 角色 Agent → 实际工具事件 → 房间与语音 → 可核验交付',1280,2566,35,c.green,600,'text-anchor="middle"');

heading('04','我们扩展出的任务闭环与接管闭环',2650);
const roles=[['小森','协调员','拆目标、分工与交接','#839b72'],['阿橘','研究员','读仓库、整理证据','#c59a65'],['小蓝','开发员','装依赖、修改源码','#7c9ba6'],['月白','审阅员','读差异、审查改动','#a599b4'],['桃桃','验证员','原测试与浏览器验收','#b8878e'],['栗子','记录员','汇总证据、打包交付','#c2b99b']];
roles.forEach(([name,role,job,col],i)=>{const x=88+i*402;rect(x,2684,374,140);rect(x,2684,8,140,col,4);text(name+' · '+role,x+26,2734,32,c.ink,700);text(job,x+26,2785,27,c.muted);});
const stages=[['输入','仓库 + 需求 + 验收'],['固定源码','克隆 / 本地固定快照'],['开发','依赖安装 + 读写源码'],['审阅与验证','并行审阅 / 构建测试 / 浏览器'],['交付','Demo + 源码 + 证据'],['人工体验','确认验收 / 反馈续轮']];
stages.forEach(([t,s],i)=>{const x=88+i*402;rect(x,2866,374,112,i===3?c.soft:c.paper);text(t,x+187,2909,31,c.green,700,'text-anchor="middle"');text(s,x+187,2949,i===3?22:25,c.muted,400,'text-anchor="middle"');if(i<5)arrow(x+379,2920,x+397,2920);});
out.push(`<path d="M1481 2986 L1481 3022 L1079 3022 L1079 2990" fill="none" stroke="${c.red}" stroke-width="3"/><path d="M1071 3002 L1079 2990 L1087 3002" fill="none" stroke="${c.red}" stroke-width="3"/>`);
text('不通过 → 伙伴讨论 → 修改 → 原用例重测；最多三轮返工',1846,3029,27,c.red,600,'text-anchor="middle"');
rect(88,3060,2384,158,c.green);
text('执行中接管',122,3110,33,c.white,700);
text('点人物看代码 / 差异 / 命令 → 暂停执行 → 当前操作收尾 → 提交意见',402,3110,31,c.white,500);
text('角色语音回应 → 必要时找伙伴讨论 → 白板同步方案与分工 → 等你点继续 → 同一任务回工位执行',122,3171,32,c.white,500);

heading('05','我们做了哪些探索？现在支持哪些能力？',3300);
rect(88,3338,1154,635);rect(1274,3338,1198,635);
text('探索路径：逐步把展示接到执行事实',122,3396,34,c.green,700);
const explorations=[
 ['展示 → 任务','从房间动画、文字方案，走到实际代码与可运行 Demo。'],
 ['道具 → 内容','电脑回显真实工具内容；手持书、笔记、杯子与动作对应。'],
 ['动作 → 自然','办公姿态、连续拿放书、沙发起身、减速避让与脚底支撑。'],
 ['测试 → 功能','保留原测试，冻结浏览器用例，失败当面讨论后返工重测。'],
 ['回放 → 后台','持久事件、刷新重连、真实执行标识；历史与实时区分。'],
 ['观看 → 接管','角色工作台、意见版本、语音方案，用户明确继续才开工。'],
];
explorations.forEach(([t,s],i)=>{const yy=3453+i*82;text(t,122,yy,29,c.green,700);para(s,344,yy,858,27,39,c.ink);});
text('能力清单：使用者可以直接操作',1310,3396,34,c.green,700);
const capabilities=[
 ['目标管理','新建 / 切换 / 归档、任务模板、逐项验收、反馈续轮。'],
 ['真实执行','公开 Node 项目、固定版本、独立目录、原 build / test。'],
 ['观察工作','自由观察 / 第一人称、锁定角色、跟随步骤、历史回看。'],
 ['场景协作','白板分工、伙伴对话、工位工作、交接与失败返工。'],
 ['人机共作','工作台查代码 / 差异 / 命令，暂停、指导、讨论与继续。'],
 ['成果核对','体验 Demo、下载源码 ZIP、查看命令 / 截图 / 来源。'],
];
capabilities.forEach(([t,s],i)=>{const yy=3453+i*82;text(t,1310,yy,29,c.green,700);para(s,1480,yy,956,27,39,c.ink);});
text('运行模式：预设演示 ｜ 真实文字方案协作 ｜ 离线 Demo（QuickJS）｜ 原仓库执行 + 浏览器验收',1280,3943,27,c.muted,500,'text-anchor="middle"');

heading('06','当前效果已验证到什么程度？',4050,'数字来自不同范围，不能相加为总通过数');
const metrics=[['81 / 81','最新真实任务：原项目测试'],['3 场景 · 20 步','最新真实任务：浏览器操作'],['58 / 58','接管功能专项回归'],['0 项新执行活动','暂停期：原任务工具保持等待']];
metrics.forEach(([a,b],i)=>{const x=88+i*604;rect(x,4088,572,137,c.soft);text(a,x+28,4146,44,c.green,700);text(b,x+28,4193,28,c.muted);});
text('外部仓库实测',122,4282,29,c.green,700);text('developit/mitt：真实克隆、原构建与 19 个 Mocha 用例、类型检查 / lint，交付可操作 Demo。',406,4282,28,c.ink);
text('真实缺陷闭环',122,4336,29,c.green,700);text('本库“草稿误归档旧目标”：发现真实失败 → 对话修复 → 再次报错 → 重测通过，保留全过程。',406,4336,28,c.ink);
text('真实接管闭环',122,4390,29,c.green,700);text('小蓝回应、桃桃建议、白板修订；原任务继续后修改与验收通过，8 项交付检查全部通过。',406,4390,28,c.ink);

heading('07','后期可以向哪些方向扩展？',4494,'以下为规划方向 · 尚未实现或尚未完整验证');
const future=[
 ['可靠运行','断点续跑与幂等重试','多任务排队、资源与成本控制'],
 ['更强的 Agent','MCP / 多模型 / 更多技术栈','角色长期记忆、技能与项目知识'],
 ['多人共作','多人在线、跨设备观察','语音输入、角色权限与共同接管'],
 ['生产交付','受控隔离、云端运行','Git 分支 / PR / CI、部署与视觉验收'],
];
future.forEach(([t,a,b],i)=>{const x=88+i*604;rect(x,4532,572,221,c.gray,22,c.line);text(t,x+28,4589,35,c.future,700);para(a,x+28,4643,516,29,44,c.ink);para(b,x+28,4700,516,27,40,c.muted);});
rect(88,4791,2384,67,c.sand,16);text('优先顺序：运行可靠与可复现 → 可控权限与隔离 → 更丰富的工具与团队协作 → 长期运营',1280,4834,30,'#7a603e',600,'text-anchor="middle"');

heading('08','归档时保留的能力边界',4950,'阶段定位：可运行研究原型');
rect(88,4988,2384,328,c.paper);
const limits=[
 ['适用范围','公开 Node.js 项目，已有 build / test；最多 3000 源文件、20 MB。本机目录使用当前用户权限，无系统隔离。'],
 ['恢复与时效','刷新、关页可接回同一任务；服务崩溃标记中断，不自动续跑外部命令。Demo 是本机限时地址，可从已有成果重启。'],
 ['验收边界','浏览器覆盖冻结的 DOM 需求用例；不代表全部业务路径、所有三维动作或像素级视觉都已验收。'],
 ['语音与发布','人物语音使用 MiniMax TTS，需要密钥、网络与播放手势；当前意见以文本提交。尚无已验证的公网部署。'],
 ['归档状态','源码与证据部分仍在本地、尚未完整提交；最终人工体验验收仍由用户确认。'],
];
limits.forEach(([a,b],i)=>{const yy=5039+i*58;text(a,122,yy,28,c.green,700);para(b,330,yy,2105,27,39,c.ink);});

line(88,5370,2472,5370);
text('来源与证据',88,5420,26,c.green,700);
text('原演示：x.com/fe_yukichi/status/2110271992041750752（依早期观察记录；源场景仓库 / 版本 / 许可待确认）',292,5420,25,c.muted);
text('技术底座：Three.js 0.186.1 · AI SDK 7.0.140 · Zod 4.6.7 · MiniMax 文本 / TTS · Playwright 1.64.1 · Node / Vite',88,5470,25,c.muted);
text('本地证据：web/README.md · assets/real-browser-repair/ · assets/role-takeover/ · assets/takeover-voice/；截图为本项目实拍，非原作者画面。',88,5518,24,c.muted);
text('003 · 从可看见的房间，到可观察、可介入、可核验的协作过程。',2472,5558,24,c.green,600,'text-anchor="end"');
out.push('</svg>');
const svg=out.join('\n');
await fs.writeFile(path.join(dir,'agent-studio-understanding.svg'),svg);
const opts={font:{loadSystemFonts:false,fontFiles:['C:/Windows/Fonts/msyh.ttc','C:/Windows/Fonts/msyhbd.ttc'],defaultFontFamily:'Microsoft YaHei'}};
await fs.writeFile(path.join(dir,'agent-studio-understanding.png'),new Resvg(svg,opts).render().asPng());
const previewDir=path.resolve(dir,'../../web/.cache/overview-render');
await fs.mkdir(previewDir,{recursive:true});
for(const [name,start,height] of [['top',0,2050],['middle',2030,1960],['bottom',3990,1590]]){
  const section=svg.replace(`width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`,`width="1280" height="${height/2}" viewBox="0 ${start} ${W} ${height}"`);
  await fs.writeFile(path.join(previewDir,`preview-${name}.png`),new Resvg(section,opts).render().asPng());
}
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({title:'从3D lo-fi小屋到可接管的Agent工作室',date:'2026-10-20',width:W,height:H,renderer:'SVG + @resvg/resvg-js 2.6.2',screenshots:sources,sourceStatus:'原帖已于早期研究观察；源场景仓库、版本、许可待确认；2026-10-20直接网页回访403，未推断新事实。',contentSources:['../../RESEARCH.md','../../web/README.md','../real-browser-repair/verification.json','../takeover-voice/verification.json'],layoutBlocks:blocks},null,2));
console.log(JSON.stringify({file:path.join(dir,'agent-studio-understanding.png'),width:W,height:H,paragraphs:blocks.length,images:sources.length}));
