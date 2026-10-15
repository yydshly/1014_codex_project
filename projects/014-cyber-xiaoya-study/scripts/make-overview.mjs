import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = process.env.ARTIFACT_NODE_MODULES
  ? require(resolve(process.env.ARTIFACT_NODE_MODULES, 'sharp'))
  : require('sharp');
const poster = (await readFile(resolve(root, 'assets/original-video-poster.jpg'))).toString('base64');
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const out = [];
const rect = (x,y,w,h,fill,stroke='none',r=24) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
const text = (x,y,s,size=32,color='#233333',weight=400) => out.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(s)}</text>`);
const lines = (x,y,a,size=32,color='#51615f',leading=48,weight=400) => a.forEach((s,i)=>text(x,y+i*leading,s,size,color,weight));
const pill = (x,y,w,s,fill='#e4eee8',color='#286a58') => {rect(x,y,w,47,fill,'none',23);text(x+20,y+32,s,25,color,600);};
const arrow = (x1,y1,x2,y2,color='#7b9288') => out.push(`<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="4" marker-end="url(#arrow)"/>`);

out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2400" height="2720" viewBox="0 0 2400 2720" role="img" aria-labelledby="title desc"><title id="title">赛博小雅：真人拟人化从哪里来</title><desc id="desc">原作封面引用；转帖语音链与画面Vidu S2标注分开；模型负责听懂、回复、声音、视觉，工程负责同步、打断与恢复；原作源码、纯本地、显存和收益未确认。</desc><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,1 L8,5 L0,9" fill="none" stroke="#7b9288" stroke-width="2"/></marker></defs><style>text{font-family:'Microsoft YaHei','Noto Sans CJK SC','SimHei',sans-serif;}</style>`);
rect(0,0,2400,2720,'#f3f1e9','none',0);
rect(100,65,9,139,'#2e7861','none',4);
text(135,99,'014  /  原视频项目研究  /  2026.10.15',27,'#537168',600);
text(130,174,'赛博小雅：真人拟人化从哪里来？',69,'#223a33',700);
text(132,229,'一张图理解效果、模型依赖、实时交互与产品价值',34,'#66736a');

rect(100,270,980,830,'#ffffff','#dedfd5');
out.push(`<image x="120" y="293" width="940" height="705" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/jpeg;base64,${poster}"/>`);
pill(130,1018,191,'原作效果引用');
text(350,1052,'原帖视频封面 · 非本地复现',29,'#596b62');

rect(1120,270,1180,830,'#ffffff','#dedfd5');
text(1170,336,'01  看见什么',28,'#2f7d65',600);
text(1170,406,'像在和一个人面对面交流',53,'#223a33',700);
const effects = [
  ['真人外观与近距离构图','皮肤、光照、视线与半身形象带来具体的存在感。'],
  ['表情与身体的表现空间','手部姿态和面部变化，增强“她在回应我”的感受。'],
  ['直播互动的使用语境','画面出现评论窗口和字幕；自动化细节仍需核实。'],
];
effects.forEach(([head,body],i)=>{
  const y=482+i*114;
  rect(1170,y-31,49,49,'#e7efe8','none',24);
  text(1185,y+3,String(i+1),27,'#35735f',700);
  text(1240,y,head,34,'#2b4137',600);
  text(1240,y+45,body,29,'#65716b');
});
rect(1160,817,1100,210,'#f3eee0','none',19);
text(1190,867,'关键画面证据',27,'#89713c',600);
text(1190,922,'封面直接标注：vidu-s2 数字人模型',37,'#68562f',700);
lines(1190,969,['这比转帖的语音清单更直接地指向视觉层。','但仍不能据此确定完整栈与部署方式。'],28,'#786c52',40);
text(1170,1072,'短片与封面不能证明完整实时性、纯本地或收益。',28,'#a15f4a');

text(100,1195,'02  核心表现能力，来自不同模型',47,'#223a33',700);
text(100,1246,'下图是通用职责拆解；原作精确实现、版本与部署尚未公开确认。',29,'#64736a');
const nodes = [
  {x:100,n:'听',title:'听清你说什么',body:['VAD：判断开口与结束','ASR：声音 → 文字'],name:['转帖提及 Silero VAD','与 SenseVoice'],fill:'#e8f0ea',color:'#285c48'},
  {x:660,n:'想',title:'决定说什么',body:['理解问题与上下文','按照人设组织回复'],name:['转帖提及 Qwen2.5-7B','由 llama.cpp 运行'],fill:'#e8eef3',color:'#365b74'},
  {x:1220,n:'说',title:'决定怎样说',body:['音色、韵律、语气','生成可播放的语音'],name:['转帖提及 CosyVoice2','具体配置未确认'],fill:'#f1eadf',color:'#7e6337'},
  {x:1780,n:'动',title:'决定她怎样动',body:['嘴型、眼神、表情','身体动作与人物连续性'],name:['画面标注 Vidu S2','完整视觉链仍待核实'],fill:'#e9e9f3',color:'#5e577f'},
];
nodes.forEach((n,i)=>{
  rect(n.x,1283,520,288,n.fill,'none',23);
  pill(n.x+27,1308,67,n.n,'#ffffff',n.color);
  text(n.x+115,1345,n.title,35,n.color,700);
  lines(n.x+28,1404,n.body,31,'#465a50',45);
  lines(n.x+28,1510,n.name,26,'#6f776f',36);
  if(i<3) arrow(n.x+525,1420,n.x+552,1420);
});
rect(100,1604,2200,106,'#2b4e40','none',19);
text(143,1671,'只接上文字与语音模型，不会自动得到真人的表情、嘴型和身体动作。',38,'#ffffff',600);

text(100,1799,'03  工程把模型接成可用交互',46,'#223a33',700);
rect(100,1834,1390,291,'#ffffff','#dedfd5');
['待机','说话','打断','倾听'].forEach((s,i)=>{
  const x=136+i*333;
  rect(x,1868,288,79,i===2?'#f3e7dd':'#edf2ed','none',16);
  text(x+92,1920,s,35,i===2?'#9a5e3d':'#315b47',600);
  if(i<3)arrow(x+294,1908,x+327,1908);
});
lines(138,2013,['输入接收 · 流式输出 · 音画同步 · 队列与状态管理','打断需要停止旧轮次，恢复后能回应一个新问题。'],31,'#5b6a61',51);
text(138,2100,'这是后续验收目标；本项目尚未验证真人闭环。',27,'#a1634e');
rect(1530,1834,770,291,'#f0eadd','none',24);
text(1570,1894,'必须保留的证据边界',34,'#695c3e',700);
lines(1570,1954,['原作源码仓库与许可证：未确认','完全本地与15GB全链路：未证实','完整打断、长期记忆和收益：未验证'],28,'#786c52',48);

text(100,2215,'04  价值与我们的理解',46,'#223a33',700);
const values = [
  ['对使用者','让交流对象更具体',['真人形象、语气与即时回应','可能降低开口门槛、增加在场感。','持续使用价值需要真实用户验证。']],
  ['对开发者','把模型组织成产品',['同步、取消、恢复与稳定运行','是集成工程的实际价值。','接入代码不等于创造模型能力。']],
  ['对直播与商业','提供新的互动形式',['直播、练习、导览是可能方向。','还要核对成本、接入与运营。','演示吸引力不等于已经盈利。']],
];
values.forEach(([k,h,b],i)=>{
  const x=100+i*750;
  rect(x,2250,700,240,'#ffffff','#dedfd5');
  text(x+30,2297,k,26,'#758274',600);
  text(x+30,2345,h,35,'#2d4c3a',700);
  lines(x+30,2395,b,28,'#647068',38);
});
text(100,2575,'模型决定表现上限，工程决定交互是否顺畅。',49,'#244c3a',700);
text(100,2632,'来源：X / huoshan007 / 2109919568617484522；组件官方资料；完整证据与限制见项目研究。',25,'#7e8578');
text(100,2674,'014 赛博小雅研究 · 原作画面为引用，图解为原创整理 · 未下载新模型，未宣称复现成功',25,'#7e8578');
out.push('</svg>');
const svg = out.join('\n');
await writeFile(resolve(root,'assets/overview.svg'),svg);
await sharp(Buffer.from(svg)).png({compressionLevel:9}).toFile(resolve(root,'assets/overview.png'));
console.log('总览SVG和2400×2720 PNG已生成。');
