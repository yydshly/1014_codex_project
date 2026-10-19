const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let state=null,selected='',experiment=null,polling=false;
const kinds={user_self_report:'用户自述',vendor_claim:'厂商说明',observed:'直接观察',inferred:'分析推断'};
const statuses={running:'运行中',succeeded:'报告已生成',failed:'未完成',cancelled:'已取消'};
async function api(url,options={}) {
  const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(state?{'X-ERL-CSRF':state.csrf}:{}),...options.headers}});
  const value=await res.json();if(!res.ok)throw new Error(value.error||'请求失败');return value;
}
function notice(text,error=false){const n=$('#notice');n.hidden=!text;n.className=error?'error':'';n.textContent=text;}
function tab(name){document.querySelectorAll('[data-tab]').forEach(n=>n.classList.toggle('active',n.dataset.tab===name));for(const id of ['sources','evidence','compare'])$('#'+id).hidden=id!==name;}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
function badge(text,type=''){return el('span',text,`badge ${type}`);}
function sourceDetails(s){const d=el('details'),summary=el('summary','查看原文与来源');d.append(summary,el('pre',s.text),el('p',`编号 ${s.id} · 事件簇 ${s.cluster_id}`,'muted'),el('p',`使用说明：${s.permission_note}`,'muted'));if(s.url){const a=el('a',s.url);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';d.append(a);}d.append(el('p',`SHA-256 ${s.sha256}`,'fingerprint'));return d;}
function renderSources(){
  $('#source-count').textContent=state.sources.length;$('#evidence-count').textContent=state.evidence.length;
  $('#corpus-summary').textContent=`${state.sources.length} 份 · ${new Set(state.sources.map(s=>s.cluster_id)).size} 个事件簇`;
  const list=$('#source-list');list.replaceChildren();if(!state.sources.length)list.append(el('p','还没有资料。先导入一份正文，或载入合成样例。','empty'));
  for(const s of state.sources){const card=el('article',undefined,'source-card'),head=el('div',undefined,'heading'),del=el('button','撤回','text-button');del.type='button';del.addEventListener('click',async()=>{if(!confirm('撤回资料会同时删除引用它的实验及导出文件，是否继续？'))return;try{const r=await api(`/api/sources/${s.id}`,{method:'DELETE'});if(experiment?.manifest.sources.some(v=>v.id===s.id)){selected='';experiment=null;$('#comparison').replaceChildren();$('#reports').replaceChildren();}await refresh();notice(`资料已撤回，同时移除 ${r.removed_experiments} 份关联实验。`);}catch(e){notice(e.message,true);}});head.append(el('h3',s.title),del);card.append(head,badge(kinds[s.kind]),badge(s.origin==='synthetic'?'合成样例':'提供资料',s.origin==='synthetic'?'synthetic':''),el('p',s.text.slice(0,140)+(s.text.length>140?'…':''),'preview'),sourceDetails(s));list.append(card);}
  const select=$('#evidence-source'),prev=select.value;select.replaceChildren(...state.sources.map(s=>{const o=el('option',s.title);o.value=s.id;return o;}));if(state.sources.some(s=>s.id===prev))select.value=prev;updateOriginal();
  const cards=$('#evidence-list');cards.replaceChildren();if(!state.evidence.length)cards.append(el('p','还没有人工卡片。复制一段原文，记录它支持或反驳什么。','empty'));
  for(const e of state.evidence){const card=el('article',undefined,'source-card');card.append(badge(e.role==='counter'?'反例 / 冲突':'支持线索',e.role==='counter'?'counter':''),el('h3',e.summary),el('blockquote',e.quote),el('p',`${state.sources.find(s=>s.id===e.source_id)?.title} · 第 ${e.line} 行 · 人工复核待完成`,'muted'));const remove=el('button','移除卡片','text-button');remove.onclick=async()=>{try{await api(`/api/evidence/${e.id}`,{method:'DELETE'});await refresh();}catch(e){notice(e.message,true);}};card.append(remove);cards.append(card);}
}
function updateOriginal(){$('#evidence-original').textContent=state?.sources.find(s=>s.id===$('#evidence-source').value)?.text||'请先导入资料';}
$('#evidence-source').onchange=updateOriginal;
async function refresh(){
  state=await api('/api/state');$('#model-status').textContent=`${state.model.auth} · ${state.model.model}`;$('#model-status').classList.toggle('ready',state.model.available);renderSources();
  const select=$('#experiments');select.replaceChildren();if(!state.experiments.length)select.append(el('option','尚无实验记录'));
  for(const e of state.experiments){const o=el('option',`${new Date(e.created_at).toLocaleString('zh-CN')} · ${statuses[e.status]} · ${e.question.slice(0,26)}`);o.value=e.id;select.append(o);}
  if(!selected&&state.experiments.length)selected=state.experiments[0].id;if(selected)select.value=selected;
  $('#run').disabled=!!state.active||!state.model.available||!state.sources.length;$('#sample').disabled=!!state.active;
  if(selected)await loadExperiment();
}
$('#source-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;try{const source=Object.fromEntries(new FormData(form));const r=await api('/api/sources',{method:'POST',body:JSON.stringify({sources:[source]})});await refresh();form.reset();notice(r.imported[0].duplicate?'正文已存在，未重复导入。':'资料已保存，可在证据台回查。');}catch(e){notice(e.message,true);}};
$('#sample').onclick=async()=>{try{const result=await api('/api/sample',{method:'POST'});$('#question').value=result.question;await refresh();notice('合成样例已载入：4 份资料、3 个事件簇。这些不是实际用户访谈，仅用于验证流程。');}catch(e){notice(e.message,true);}};
$('#files').onchange=async event=>{
  const files=[...event.target.files];try{
    if(files.some(f=>f.size>500000))throw new Error('单个文件不能超过 500 KB');
    const sources=[];for(const file of files){const text=await file.text();if(file.name.toLowerCase().endsWith('.json')){const v=JSON.parse(text);sources.push(...(Array.isArray(v)?v:v.sources||[v]));}else sources.push({title:file.name.replace(/\.(txt|md)$/i,''),text,url:'',kind:'user_self_report',origin:'provided',cluster_key:'',permission_note:'操作者选择本地文件导入；具体使用权需由操作者确认'});}
    if(!sources.length)return;
    if(!confirm(`将导入 ${sources.length} 份资料，并发送给所选模型分析。请确认你有权使用这些资料。`))return;
    const r=await api('/api/sources',{method:'POST',body:JSON.stringify({sources})});await refresh();notice(`已处理 ${r.imported.length} 份资料，其中 ${r.imported.filter(s=>s.duplicate).length} 份正文重复。可展开原文核对资料类型；类型需更改时撤回重导。`);
  }catch(e){notice(e.message,true);}finally{event.target.value='';}
};
$('#evidence-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;try{await api('/api/evidence',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.elements.quote.value='';form.elements.summary.value='';await refresh();notice('证据卡已保存，引文可定位到原文；解释仍需你判断。');}catch(e){notice(e.message,true);}};
$('#run').onclick=async()=>{try{$('#run').disabled=true;const r=await api('/api/experiments',{method:'POST',body:JSON.stringify({question:$('#question').value})});selected=r.id;notice('资料已冻结，开始独立执行 B/C。可以继续查看原文，暂不能修改本轮资料。');await refresh();startPolling();}catch(e){notice(e.message,true);$('#run').disabled=false;}};
$('#cancel').onclick=async()=>{try{await api(`/api/experiments/${selected}/cancel`,{method:'POST'});notice('正在取消，已发生的调用记录会保留。');}catch(e){notice(e.message,true);}};
$('#experiments').onchange=async event=>{selected=event.target.value;try{await loadExperiment();}catch(e){notice(e.message,true);}};
async function loadExperiment(){experiment=await api(`/api/experiments/${selected}`);$('#progress').textContent=experiment.progress+(experiment.error?`：${experiment.error}`:'');$('#cancel').hidden=experiment.status!=='running';$('#question').value=experiment.manifest.question;renderExperiment();if(experiment.status==='running')startPolling();}
function startPolling(){if(polling)return;polling=true;const tick=async()=>{try{await refresh();if(state.active){setTimeout(tick,1600);return;}}catch(e){notice(e.message,true);}polling=false;};setTimeout(tick,1600);}
const pct=value=>value===null?'未测量':`${Math.round(value*100)}%`;
function renderExperiment(){
  const exp=experiment,comparison=$('#comparison'),reports=$('#reports');comparison.replaceChildren();reports.replaceChildren();
  const box=el('div',undefined,'metrics'),grid=el('div',undefined,'metric-grid');
  for(const row of [['核对项目','B · 直接分析','C · 证据流程'],['可回查发现',exp.results.B?.report.findings.length??'—',exp.results.C?.report.findings.length??'—'],['引文存在率',exp.results.B?pct(exp.results.B.metrics.valid_citation_rate):'—',exp.results.C?pct(exp.results.C.metrics.valid_citation_rate):'—'],['模型调用次数',exp.calls.filter(c=>c.arm==='B').length,exp.calls.filter(c=>c.arm==='C').length],['全流程 token',exp.results.B?.report.measurements.total_tokens??'未知 / 未完成',exp.results.C?.report.measurements.total_tokens??'未知 / 未完成'],['耗时（秒）',exp.results.B?.report.measurements.elapsed_seconds??'—',exp.results.C?.report.measurements.elapsed_seconds??'—']])row.forEach((value,i)=>grid.append(el('div',String(value),grid.childNodes.length<3?'head':i===0?'label':'')));
  box.append(grid,el('p',`执行顺序：${exp.order.join(' → ')} · 请求模型：${exp.manifest.model} · 语料 ${exp.manifest.sources.length} 份 / ${new Set(exp.manifest.sources.map(s=>s.cluster_id)).size} 个事件簇。两组输入正文相同，人工笔记未参与对照。`),el('p','这些数字只表示流程和引用检查结果。语义准确率、决策价值、付费意愿均未测量；模型快照未公开，美元费用未知。'),el('div',`资料 SHA-256 ${exp.manifest.corpus_sha256}`,'fingerprint'));comparison.append(box);
  for(const arm of ['B','C']){
    const result=exp.results[arm],panel=el('article',undefined,'panel');
    const heading=el('div',undefined,'report-title');heading.append(el('h2',arm==='B'?'B · 直接分析':'C · 证据流程'));if(result){const actions=el('div',undefined,'report-actions');for(const format of ['md','json']){const link=el('a',format.toUpperCase());link.href=`/api/experiments/${exp.id}/export?arm=${arm}&format=${format}`;link.download='';actions.append(link);}heading.append(actions);}panel.append(heading);
    if(!result){panel.append(el('p',exp.status==='running'?'正在执行，报告完成后会显示在这里。':'本组尚未完成，可查看上方执行状态。','empty'));reports.append(panel);continue;}
    panel.append(el('p',result.report.scope,'muted'),badge(result.report.status==='completed'?'人工已复核':result.report.status==='partial'?'部分结果 · 有引文被拒绝':'草稿 · 待人工复核'));
    if(!result.report.findings.length)panel.append(el('p','当前资料未形成有效发现，请检查资料与模型输出。','empty'));
    for(const finding of result.report.findings){const card=el('section',undefined,'finding');card.append(el('h3',finding.statement),badge(kinds[finding.kind]));
      for(const id of [...finding.evidence_ids,...finding.counterevidence_ids]){const e=result.evidence.find(v=>v.id===id),source=exp.manifest.sources.find(s=>s.id===e.source_id),cite=el('div',undefined,'citation');cite.append(badge(e.role==='counter'?'反证':'支持',e.role==='counter'?'counter':''),el('p',e.quote),el('small',`${id} · ${source.title} · 第 ${e.line} 行`),sourceDetails(source));card.append(cite);}
      card.append(el('p',`未知：${finding.unknowns.join('；')||'未列出'}`),el('p',`下一步：${finding.next_validation}`));
      const review=el('select');review.setAttribute('aria-label',`${arm} ${finding.finding_id} 人工复核`);for(const [value,text]of [['pending','人工复核：待判断'],['verified','我已检查：主张受到证据支持'],['rejected','我已检查：主张不成立']]){const o=el('option',text);o.value=value;review.append(o);}review.value=finding.review_status;review.disabled=exp.status==='running';review.onchange=async()=>{try{experiment=await api(`/api/experiments/${exp.id}/review`,{method:'POST',body:JSON.stringify({arm,finding_id:finding.finding_id,status:review.value})});renderExperiment();notice('复核判断已记录，报告已更新。');}catch(e){notice(e.message,true);}};card.append(review);panel.append(card);
    }
    const limitations=el('details'),summary=el('summary','局限与调用记录');limitations.append(summary,...result.report.limitations.map(l=>el('p',l,'muted')));
    if(result.extraction){limitations.append(el('p',`证据提取：${result.extraction.evidence.length} 条有效；${result.extraction.invalid.length} 条引文无效。`,'muted'));const details=el('details');details.append(el('summary','查看本组生成的证据表'),el('pre',JSON.stringify(result.extraction,null,2)));limitations.append(details);}
    if(result.rejected_findings.length)limitations.append(el('pre',JSON.stringify(result.rejected_findings,null,2)));
    limitations.append(el('pre',JSON.stringify(exp.calls.filter(c=>c.arm===arm),null,2)));panel.append(limitations);reports.append(panel);
  }
}
refresh().catch(e=>notice(e.message,true));
