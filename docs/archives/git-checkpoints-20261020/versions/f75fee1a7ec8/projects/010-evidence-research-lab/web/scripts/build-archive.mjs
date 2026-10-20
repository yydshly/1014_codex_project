import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {content} from '../archive/content.mjs';
import {journey,journeyMarkdown} from '../archive/journey.mjs';
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),project=path.resolve(web,'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const normalizeInline=value=>value.replace(/\r\n?/g,'\n');
const external=(url,text)=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(text)}</a>`;
const rows=values=>values.map(columns=>`<tr>${columns.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('');
const sources=structuredClone(content.sourceNotes),known=new Set(sources.map(s=>s.url));
const sourceDocument=await readFile(path.join(project,'SOURCES.md'),'utf8');
let extra=0;
for(const line of sourceDocument.split('\n'))for(const match of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)){
  const [,title,url]=match;if(known.has(url))continue;known.add(url);
  sources.push({id:`T${String(++extra).padStart(3,'0')}`,url,title,category:'数据与实现',status:'来源补充记录 · 核查范围见说明',note:line.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^[-# ]+/,'').trim()});
}
for(const item of [...content.discussions,...journey.chapters.flatMap(c=>c.sections)])for(const ref of item.refs||[])if(!sources.some(s=>s.id===ref))throw new Error(`缺少引用来源 ${ref}`);
if(new Set(sources.map(s=>s.id)).size!==sources.length)throw new Error('来源编号重复');
const journal=journeyMarkdown(journey,content.discussions,sources);
await writeFile(path.join(project,'DISCUSSION.md'),journal,'utf8');
const documents=[];
for(const [file,title,category] of content.materials){
  const resolved=path.resolve(project,file);
  if(!resolved.startsWith(project+path.sep)||file.includes('.runtime')||path.basename(file).startsWith('.env'))throw new Error('禁止打包私有路径');
  const buffer=await readFile(resolved);documents.push({path:file,title,category,text:buffer.toString('utf8'),sha256:hash(buffer),bytes:buffer.byteLength});
}
const smoke=JSON.parse(documents.find(d=>d.path==='evaluation/bc-smoke-result.json').text);
const full=JSON.parse(documents.find(d=>d.path==='data/bc-smoke-archive.json').text);
if(!smoke.all_sources_synthetic||full.manifest.sources.some(s=>s.origin!=='synthetic')||full.manifest.corpus_sha256!==smoke.corpus_sha256)throw new Error('归档只允许已经核对的合成资料试跑，不打包私人实验');
const archive={...content,journey,journey_markdown:journal,sources,documents,smoke,archive_note:'归档既有研究、后续讨论与原创合成试跑；不是逐字聊天转录或外站全文镜像。构建与阅读不调用模型、不抓取外站、不打包私有目录。'};
const refs=ids=>ids.length?`<div class="refs">相关来源 ${ids.map(id=>`<a href="#source-${id}">${id}</a>`).join('')}</div>`:'';
const topicHTML=chapter=>`<section class="chapter topic" id="${escape(chapter.id)}"><div class="chapter-head"><span class="chapter-no">${chapter.number}</span><h2>${escape(chapter.title)}</h2></div><span class="tag amber">${escape(chapter.status)}</span><p class="section-intro">${escape(chapter.lead)}</p>${chapter.sections.map(block=>`<article class="topic-block"><h3>${escape(block.heading)}</h3>${(block.paragraphs||[]).map(p=>`<p>${escape(p)}</p>`).join('')}${block.table?`<div class="table-wrap"><table><thead><tr>${block.table.headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows(block.table.rows)}</tbody></table></div>`:''}${block.items?`<ul>${block.items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`:''}${block.note?`<p class="topic-note">${escape(block.note)}</p>`:''}${refs(block.refs||[])}</article>`).join('')}</section>`;
const metrics=rows([
  ['方法','一次直接分析','提取证据 + 分析'],['可回查发现',smoke.results.B.metrics.accepted_findings,smoke.results.C.metrics.accepted_findings],['引用逐字存在率（非语义准确率）','100% · 11 次引用','100% · 11 次引用'],['模型调用','1','2（全部计量）'],['输入 + 输出 token',smoke.results.B.measurements.total_tokens,smoke.results.C.measurements.total_tokens],['全流程耗时',`${smoke.results.B.measurements.elapsed_seconds} 秒`,`${smoke.results.C.measurements.elapsed_seconds} 秒`],['美元费用 / 人工时间 / 语义准确率','未观测 / 未测量 / 未测量','未观测 / 未测量 / 未测量']
]);
function reportHTML(arm){
  const result=full.results[arm],report=result.report;
  return `<article class="report"><h3>${arm==='B'?'B · 直接分析':'C · 证据流程'}</h3><p>${escape(report.scope)}</p><span class="tag amber">真实模型 · 合成资料 · 待人工复核</span>${report.findings.map(f=>`<div class="finding"><h4>${escape(f.finding_id)} / ${escape(f.statement)}</h4><div class="tag">${escape(f.kind)}</div>${[...f.evidence_ids,...f.counterevidence_ids].map(id=>{const e=result.evidence.find(e=>e.id===id);if(!e)throw new Error('报告引用缺失');const s=full.manifest.sources.find(s=>s.id===e.source_id);return `<blockquote>${escape(e.quote)}<small>${escape(id)} · ${e.role==='counter'?'反证':'支持'} · ${escape(s.title)} · 第 ${e.line} 行</small></blockquote>`;}).join('')}<p class="muted">未知：${escape(f.unknowns.join('；')||'未列出')}</p><p class="muted">下一步：${escape(f.next_validation)}</p></div>`).join('')}<details class="screenshot"><summary>展开本报告的全部局限</summary>${report.limitations.map(l=>`<p class="muted">${escape(l)}</p>`).join('')}</details></article>`;
}
const categories=['全部',...new Set(sources.map(s=>s.category))];
const screenshot=(await readFile(path.join(project,'assets/preview.jpg'))).toString('base64');
const replacements={
  TITLE:escape(content.title),SUBTITLE:escape(content.subtitle),
  CURRENT_OVERVIEW:`<p class="section-intro">${escape(journey.lead)}</p><div class="principles">${journey.principles.map((p,i)=>`<article><span class="principle-number">${String(i+1).padStart(2,'0')}</span><h3>${escape(p.title)}</h3><p>${escape(p.text)}</p></article>`).join('')}</div><h3 class="understanding-subhead">从哪里读起</h3><div class="reading-routes">${journey.entries.map(e=>`<a href="${escape(e.href)}"><strong>${escape(e.title)}</strong><span>${escape(e.text)}</span></a>`).join('')}</div>`,
  JOURNEY_NAV:journey.chapters.map(c=>`<a href="#${escape(c.id)}"><span>${c.number}</span>${escape(c.title.split('：')[0])}</a>`).join(''),
  JOURNEY:journey.chapters.map(topicHTML).join(''),
  QUESTION_COUNT:content.discussions.length,
  UNDERSTANDING_UPDATED:escape(content.understanding.updated_at),
  UNDERSTANDING:`<div class="understanding-intro"><span class="tag">当前理解 · ${escape(content.understanding.updated_at)}</span><h2>${escape(content.understanding.headline)}</h2><p>${escape(content.understanding.answer)}</p><p>${escape(content.understanding.meaning)}</p></div><div class="understanding-people">${content.understanding.participants.map(p=>`<article><h3>${escape(p.name)}</h3><p>${escape(p.text)}</p></article>`).join('')}</div><h3 class="understanding-subhead">从客户表达，到需求判断</h3><ol class="understanding-steps">${content.understanding.steps.map(s=>`<li><h4>${escape(s.title)}</h4><p>${escape(s.text)}</p></li>`).join('')}</ol><h3 class="understanding-subhead">“处理需求”具体指哪一层？</h3><div class="table-wrap"><table><thead><tr><th>层次</th><th>期望解决的问题</th><th>010 的实际位置</th></tr></thead><tbody>${rows(content.understanding.boundaries.map(b=>[b.area,b.meaning,b.current]))}</tbody></table></div><div class="understanding-example"><h3>一个具体例子</h3><p class="footnote">${escape(content.understanding.example.label)}</p><dl>${content.understanding.example.rows.map(r=>`<div><dt>${escape(r.stage)}</dt><dd>${escape(r.text)}</dd></div>`).join('')}</dl></div><p class="trial-highlight">${escape(content.understanding.takeaway)}</p><p class="footnote">${escape(content.understanding.scope_note)}</p>`,
  SCOPE:escape(content.scope),CONCLUSION:escape(content.conclusion),
  STATS:[[sources.length,'网页与参考链接'],[content.discussions.length,'个关键问题'],[documents.length,'份完整材料'],['B / C','一次真实模型流程试跑']].map(([n,label])=>`<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join(''),
  ORIGIN:`<div class="origin"><span class="tag amber">作者自述，未独立核验</span><h3>${external(content.origin.url,content.origin.title+' ↗')}</h3><p>${escape(content.origin.summary)}</p><p class="caution">${escape(content.origin.boundary)}</p><p><strong>最初的问题：</strong>${escape(content.origin.question)}</p></div>`,
  TIMELINE:content.timeline.map(s=>`<article><div class="step">${s.step}</div><h3>${escape(s.title)}</h3><p>${escape(s.text)}</p></article>`).join(''),
  DISCUSSIONS:content.discussions.map((q,i)=>`<details class="question" id="${q.id}"${i===0?' open':''}><summary><span class="q-number">${String(i+1).padStart(2,'0')}</span>${escape(q.question)}</summary><div class="answer"><span class="tag">${escape(q.tag)}</span>${q.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${refs(q.refs)}</div></details>`).join(''),
  LAYERS:rows(content.layers.map(l=>[l.name,l.meaning,l.actual])),
  FILTERS:categories.map(c=>`<button class="filter" data-category-filter="${escape(c)}" aria-pressed="${c==='全部'}" type="button">${escape(c)}</button>`).join(''),
  SOURCE_COUNT:sources.length,SOURCES:sources.map(s=>`<article class="source" id="source-${s.id}" data-category="${escape(s.category)}"><h3><span class="source-id">${s.id}</span>${external(s.url,s.title+' ↗')}</h3><span class="tag${/候选|自述|厂商|边界|反证/.test(s.status)?' amber':''}">${escape(s.status)}</span><p>${escape(s.note)}</p><div class="domain">${escape(s.url)}</div></article>`).join(''),
  BLUEPRINT:content.blueprint.map(b=>`<article><h3>${escape(b.title)}</h3><p>${escape(b.text)}</p></article>`).join(''),
  METRICS:`<div class="table-wrap"><table><thead><tr><th>核对项目</th><th>B · 直接分析</th><th>C · 证据流程</th></tr></thead><tbody>${metrics}</tbody></table></div>`,
  TRIAL_NOTE:escape(`运行日期 2026-10-15 · 请求模型 ${smoke.requested_model} / ${smoke.reasoning} · ${smoke.source_count} 份合成资料 / ${smoke.cluster_count} 个事件簇 · 顺序 ${smoke.order.join(' → ')}。同一请求模型标识不保证不可变权重快照。资料 SHA-256：${smoke.corpus_sha256}`),
  COMPARISON:rows(content.comparison.map(c=>[c.topic,c.b,c.c,c.assessment])),REPORTS:['B','C'].map(reportHTML).join(''),
  SCREENSHOT:`<details class="screenshot"><summary>展开当时的实验工具运行截图</summary><figure><img alt="旧 B/C 工具的真实模型合成资料试跑截图" loading="lazy" src="data:image/jpeg;base64,${screenshot}"><figcaption>本项目 2026-10-15 原始运行截图。全部输入为合成资料，报告仍待人工复核；不是本归档页面的设计图。</figcaption></figure></details>`,
  UNKNOWNS:content.unknowns.map(u=>`<li>${escape(u)}</li>`).join(''),DOCUMENT_COUNT:documents.length,
  DOCUMENTS:documents.map(d=>`<details class="material"><summary><span class="tag">${escape(d.category)}</span>${escape(d.title)}</summary><div class="file-path">${escape(d.path)}</div><div class="file-bar"><span>${d.bytes} bytes · SHA-256 ${d.sha256}</span><button class="file-download" data-file="${escape(d.path)}" type="button">下载原件</button></div><pre>${escape(d.text)}</pre></details>`).join(''),
  ARCHIVE_DATA:json(archive),ARCHIVE_STYLE:normalizeInline(await readFile(path.join(web,'archive/style.css'),'utf8')),ARCHIVE_SCRIPT:normalizeInline(await readFile(path.join(web,'archive/app.js'),'utf8'))
};
let html=await readFile(path.join(web,'archive/template.html'),'utf8');
html=html.replace(/__([A-Z_]+)__/g,(_,key)=>{if(!(key in replacements))throw new Error(`未识别的模板字段 ${key}`);return String(replacements[key]);});
if(/__[A-Z_]+__/.test(html))throw new Error('归档存在未替换模板');
await mkdir(path.join(web,'dist'),{recursive:true});
await writeFile(path.join(web,'index.html'),html,'utf8');await writeFile(path.join(web,'dist/index.html'),html,'utf8');
console.log(`010 研究归档已构建：${sources.length} 条来源、${documents.length} 份完整材料、${content.discussions.length} 个讨论问题、${journey.chapters.length} 个专题；${Buffer.byteLength(html)} bytes。`);
