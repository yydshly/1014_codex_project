const data=JSON.parse(document.querySelector('#archive-data').textContent);
const $=selector=>document.querySelector(selector);
const status=message=>$('#action-status').textContent=message;
function download(name,text,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('#download-json').addEventListener('click',()=>{download('010-atypica-research-archive.json',JSON.stringify(data,null,2),'application/json');status('完整归档已导出，包含研究记录、来源、原始材料和合成资料试跑。');});
$('#download-md').addEventListener('click',()=>{
  const full=JSON.parse(data.documents.find(d=>d.path==='data/bc-smoke-archive.json').text);
  const u=data.understanding;
  const sections=[`# 010 · ${data.title}`,data.subtitle,`原研究归档日期：${data.date}\n\n当前理解更新：${u.updated_at}\n\n状态：${data.status}`,
    `## 当前理解\n\n${u.headline}\n\n${u.answer}\n\n${u.meaning}`,...u.participants.map(p=>`### ${p.name}\n\n${p.text}`),
    '### 从客户表达，到需求判断',...u.steps.map((s,i)=>`${i+1}. ${s.title}：${s.text}`),'### 处理需求的范围',...u.boundaries.map(b=>`- ${b.area}：${b.meaning} 本项目：${b.current}`),
    `### 具体例子\n\n${u.example.label}`,...u.example.rows.map(r=>`- ${r.stage}：${r.text}`),u.takeaway,u.scope_note,
    `## 前期试跑判断\n\n${data.conclusion}`,`## 研究起点\n\n[${data.origin.title}](${data.origin.url})\n\n${data.origin.summary}\n\n${data.origin.boundary}`,
    '## 研究演进',...data.timeline.map(s=>`### ${s.step} ${s.title}\n\n${s.text}`),data.journey_markdown,
    '## 价值与能力分层',...data.layers.map(l=>`### ${l.name}\n\n作用：${l.meaning}\n\n实际情况：${l.actual}`),'## 来源目录',...data.sources.map(s=>`### ${s.id} ${s.title}\n\n[原始链接](${s.url})\n\n${s.category} / ${s.status}\n\n${s.note}`),
    '## 设计与范围',...data.blueprint.map(s=>`### ${s.title}\n\n${s.text}`),'## 真实模型流程试跑',`输入均为合成资料；请求模型 ${data.smoke.requested_model} / ${data.smoke.reasoning}。\n\nB：3 条发现、13062 token、40.28 秒。\n\nC：4 条发现、27337 token、85.65 秒。\n\n不能据此证明 C 优于 B，原始记录见后附材料。`,'## 未验证事项',...data.unknowns.map(u=>`- ${u}`),
    '## 两组结论的具体对照',...data.comparison.map(c=>`### ${c.topic}\n\nB：${c.b}\n\nC：${c.c}\n\n复盘：${c.assessment}`),'## 完整 B 报告',full.artifacts['B-report.md'].text,'## 完整 C 报告',full.artifacts['C-report.md'].text,
    '## 完整原始材料',...data.documents.map(d=>`### ${d.path} · ${d.title}\n\nSHA-256：${d.sha256}\n\n${d.path.endsWith('.md')?d.text:'````'+(d.path.endsWith('.json')?'json':'text')+'\n'+d.text+'\n````'}`)];
  download('010-atypica-research-archive.md',sections.join('\n\n')+'\n','text/markdown;charset=utf-8');status('完整 Markdown 已导出，包含全部原始材料。');
});
document.querySelectorAll('[data-file]').forEach(button=>button.addEventListener('click',()=>{const doc=data.documents.find(d=>d.path===button.dataset.file);if(doc)download(doc.path.replaceAll('/','__'),doc.text);status(`已导出 ${doc?.path||'文件'}`);}));
let category='全部';const sourceCards=[...document.querySelectorAll('.source')];
function filterSources(){const query=$('#source-search').value.trim().toLowerCase();let count=0;for(const card of sourceCards){card.hidden=!(category==='全部'||card.dataset.category===category)||!card.textContent.toLowerCase().includes(query);if(!card.hidden)count++;}$('#source-count').textContent=`显示 ${count} / ${sourceCards.length} 条来源` ;$('#source-empty').hidden=count>0;}
document.querySelectorAll('[data-category-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.categoryFilter;document.querySelectorAll('[data-category-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filterSources();}));
$('#source-search').addEventListener('input',filterSources);
$('#material-search').addEventListener('input',()=>{const query=$('#material-search').value.trim().toLowerCase();let count=0;for(const material of document.querySelectorAll('.material')){material.hidden=!material.textContent.toLowerCase().includes(query);if(!material.hidden)count++;}$('#material-count').textContent=`显示 ${count} / ${data.documents.length} 份材料`;});
const questions=[...document.querySelectorAll('.question')];
function filterQuestions(){const query=$('#discussion-search').value.trim().toLowerCase();let count=0;for(const question of questions){question.hidden=!question.textContent.toLowerCase().includes(query);if(!question.hidden)count++;}$('#discussion-count').textContent=`显示 ${count} / ${questions.length} 个问题`;$('#discussion-empty').hidden=count>0;}
$('#discussion-search').addEventListener('input',filterQuestions);
$('#expand-discussion').addEventListener('click',event=>{const visible=questions.filter(q=>!q.hidden);const expand=visible.some(q=>!q.open);visible.forEach(q=>q.open=expand);event.currentTarget.textContent=expand?'收起全部讨论':'展开全部讨论';});
function revealQuestion(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);if(target?.classList.contains('question')){$('#discussion-search').value='';filterQuestions();target.open=true;}}
addEventListener('hashchange',revealQuestion);
document.querySelectorAll('a[href^="#source-"]').forEach(a=>a.addEventListener('click',()=>{category='全部';$('#source-search').value='';document.querySelectorAll('[data-category-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoryFilter==='全部')));filterSources();}));
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)document.querySelectorAll('aside nav a').forEach(a=>a.classList.toggle('active',a.hash===`#${entry.target.id}`));},{rootMargin:'-10% 0px -65% 0px',threshold:0});
document.querySelectorAll('section.chapter').forEach(s=>observer.observe(s));
filterSources();
filterQuestions();
revealQuestion();
