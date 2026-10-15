import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = dirname(fileURLToPath(import.meta.url));
const root = resolve(web, '..');
const dist = resolve(web, 'dist');
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function inline(value) {
  const escaped = escape(value);
  return escaped.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => {
    if (!/^(https:\/\/|[a-zA-Z0-9_.\/-])/.test(url)) return label;
    return `<a href="${url}"${url.startsWith('https:') ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  }).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
}
function markdown(source) {
  const rows=source.split(/\r?\n/), html=[], toc=[];
  let paragraph=[], list='', section=false, count=0;
  const flush=()=>{if(paragraph.length){html.push(`<p>${inline(paragraph.join(' '))}</p>`);paragraph=[];}};
  const endList=()=>{if(list){html.push(`</${list}>`);list='';}};
  for(let i=0;i<rows.length;i++) {
    const line=rows[i].trim();
    if(line.startsWith('# ')) continue;
    // 总览图在正文前独立展示，正文不重复放入第二张相同图。
    if(line.startsWith('![')) continue;
    if(!line){flush();endList();continue;}
    if(line.startsWith('## ')){
      flush();endList();if(section)html.push('</section>');
      const title=line.slice(3), id=`section-${String(++count).padStart(2,'0')}`;
      toc.push({title,id});html.push(`<section class="research-section" id="${id}"><h2>${inline(title)}</h2>`);section=true;continue;
    }
    if(line.startsWith('### ')){flush();endList();html.push(`<h3>${inline(line.slice(4))}</h3>`);continue;}
    if(line.startsWith('|') && rows[i+1]?.trim().match(/^\|\s*[-:]/)){
      flush();endList();const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());
      const headers=cells(line);i++;
      const body=[];while(rows[i+1]?.trim().startsWith('|'))body.push(cells(rows[++i]));
      html.push(`<div class="table-scroll" tabindex="0" aria-label="${escape(toc.at(-1)?.title||'研究表格')}"><table><thead><tr>${headers.map(s=>`<th scope="col">${inline(s)}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(s=>`<td>${inline(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
    }
    const ordered=line.match(/^\d+\.\s+(.+)$/), bullet=line.match(/^-\s+(.+)$/);
    if(ordered||bullet){flush();const kind=ordered?'ol':'ul';if(list!==kind){endList();list=kind;html.push(`<${kind}>`);}html.push(`<li>${inline((ordered||bullet)[1])}</li>`);continue;}
    endList();paragraph.push(line);
  }
  flush();endList();if(section)html.push('</section>');
  return {body:html.join('\n'),toc};
}
const research = await readFile(resolve(root,'RESEARCH.md'),'utf8');
const {body,toc}=markdown(research);
if(toc.length!==12)throw new Error(`研究应有12个章节，实际为${toc.length}。`);
const understanding=`<section class="understanding" aria-labelledby="understanding-title"><div class="section-heading"><div><p class="eyebrow">OUR UNDERSTANDING / 能力 · 原理 · 价值 · 扩展</p><h2 id="understanding-title">它的价值，是把模型变成可互动的人物。</h2></div></div><div class="understanding-grid"><article><h3>能力：真人互动角色</h3><p>原片呈现真人形象、声音与直播互动语境。自然待机、连续说话、插话与恢复倾听，需要完整闭环验证。</p><a href="#section-03">原视频展示了什么 ↗</a></article><article><h3>原理：听、想、说、动</h3><p>识别、语言、声音和视觉由专门模型提供；代码负责流式连接、音画同步、状态和取消，模型决定表现上限。</p><a href="#section-05">模型与工程怎样分工 ↗</a></article><article><h3>价值：更具体的在场感</h3><p>真人形象、视线和语气可能降低开口门槛。集成工程让能力可用，持续使用与商业收益要靠真实用户验证。</p><a href="#section-08">价值成立的条件 ↗</a></article><article><h3>扩展：从闭环到场景</h3><p>先用线上服务验证真人交互，再探索陪练、讲解、直播、可管理的记忆和模型替换；这些是后续方向。</p><a href="#section-11">扩展方向与验证顺序 ↗</a></article></div></section>`;
const html=`<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f3f1e9"><meta name="description" content="赛博小雅的真人互动效果、听想说动模型分工、流式同步与打断工程、在场感价值，以及陪练、讲解、直播和角色记忆等扩展方向。原作源码与完整闭环尚未确认。"><title>赛博小雅 · 真人拟人化从哪里来</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%232e6c55'/%3E%3Cpath d='M8 16h16M16 8v16' stroke='white' stroke-width='2'/%3E%3C/svg%3E"><link rel="stylesheet" href="style.css"></head>
<body><a class="skip" href="#research">跳到完整研究</a><header class="site-header"><a class="brand" href="#top"><span class="brand-mark">✳</span><span>赛博小雅<span class="brand-sub">RESEARCH 014</span></span></a><nav aria-label="页面导航"><a href="#overview">一图总览</a><a href="#research">完整研究</a><a href="sources/README.md">来源登记 ↗</a></nav></header>
<main id="top"><section class="hero"><div class="hero-copy"><p class="eyebrow">DIGITAL PRESENCE / 原视频项目研究</p><h1>像人在场。<br><span>能力从模型而来。</span></h1><p class="hero-description">从原视频中的真人效果出发，说明能力、底层原理、价值与扩展方向：模型提供听、想、说、动，工程把它们连成可持续的交互。</p><div class="hero-tags"><span>真人拟人化</span><span>模型 × 工程</span><span>证据分层</span></div><div class="hero-actions"><a class="primary-link" href="#overview">查看一张总览图 <span>↗</span></a><a href="#research">阅读12章研究 ↓</a></div><p class="scope">研究整理已完成 · 原作源码及完整实时闭环尚未验证</p></div><figure class="hero-figure"><a href="assets/overview.png" target="_blank" aria-label="打开原创能力总览图高清版"><img src="assets/overview.png" alt="我们整理的能力总览图：原作真人效果、模型分工、实时闭环、价值与证据边界" width="2400" height="2720"></a><figcaption><span>原创能力总览</span> 点击放大 · 内含原视频画面引用</figcaption></figure></section>
<section class="insight"><span>关键发现</span><p>转帖的四个语音相关模块解释不了真人画面。<strong>视觉模型必须单独看。</strong></p><a href="#section-04">查看证据边界 ↗</a></section>
${understanding}
<section id="overview" class="overview-section"><div class="section-heading"><div><p class="eyebrow">ONE PICTURE / 效果 · 原理 · 价值</p><h2>一张图，把能力与边界放在一起。</h2></div><div class="downloads"><a href="assets/overview.png" download>下载高清PNG ↓</a><a href="assets/overview.svg" target="_blank">打开SVG ↗</a></div></div><a class="overview-image" href="assets/overview.png" target="_blank" aria-label="打开可放大的完整能力总览图"><img src="assets/overview.png" alt="完整能力图：原作效果、听想说动四层模型、待机说话打断倾听闭环、工程和产品价值" width="2400" height="2720" loading="lazy"></a><p class="image-note">点击图片查看高清版。图中的原作画面为引用；流程为本研究解释，未冒充作者源码。</p></section>
<section class="original-video"><div><p class="eyebrow">REFERENCE / 回到原始效果</p><h2>原视频片段</h2><p>按需从原帖媒体地址播放，保留原片语境。片段本身不能证明完整本地部署、实际延迟或收益。</p><a href="https://x.com/huoshan007/status/2109919568617484522" target="_blank" rel="noreferrer">打开原帖 ↗</a></div><div class="video-container"><video id="original-video" controls playsinline preload="none" poster="assets/original-video-poster.jpg" aria-label="原帖视频，仅在点击播放后加载远端媒体"></video><button id="load-video" type="button">加载原帖视频 <span>约28秒 · 按需联网</span></button><p id="video-message" role="status" hidden></p></div></section>
<div class="reading-layout" id="research"><aside class="contents"><p class="eyebrow">READ THE STUDY</p><h2>完整研究</h2><nav aria-label="研究章节">${toc.map(x=>`<a href="#${x.id}">${escape(x.title)}</a>`).join('')}</nav><a class="markdown-link" href="RESEARCH.md">查看Markdown原文 ↗</a></aside><article class="research-content"><div class="research-meta">2026.10.15 · 12章 · 公开资料与我们的理解</div>${body}</article></div>
</main><footer><strong>模型决定表现上限，工程决定交互是否顺畅。</strong><p>014 · 赛博小雅研究 / 本页为研究展示，不运行原作者的数字人系统。</p><a href="README.md">项目说明</a><span> / </span><a href="sources/README.md">来源与版本</a><span> / </span><a href="assets/README.md">图片来源</a></footer><script src="app.js" type="module"></script></body></html>`;
await mkdir(dist,{recursive:true});
await writeFile(resolve(dist,'index.html'),html);
for(const file of ['style.css','app.js'])await cp(resolve(web,file),resolve(dist,file));
for(const dir of ['assets','sources'])await cp(resolve(root,dir),resolve(dist,dir),{recursive:true});
for(const file of ['README.md','RESEARCH.md'])await cp(resolve(root,file),resolve(dist,file));
console.log(`静态阅读页已生成：12章、${(html.match(/<table>/g)||[]).length}张研究表格；没有模型调用。`);
