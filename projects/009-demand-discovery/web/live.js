import {PUBLIC_STATIC} from './mode.js';
const $=selector=>document.querySelector(selector);
const node=(tag,cls='',text)=>{const result=document.createElement(tag);if(cls)result.className=cls;if(text!==undefined)result.textContent=text;return result;};
const append=(parent,...children)=>{parent.append(...children.filter(Boolean));return parent;};
const statuses={queued:'准备中',running:'调查中',verifying:'核对来源',completed:'本轮完成',partial:'部分完成',failed:'未完成',cancelled:'已停止',interrupted:'已中断',pending:'等待开始'};
const phaseLabels={people:'发现人群',problems:'寻找问题',investigate:'追查证据'};
const activeStates=new Set(['queued','running','verifying']);
const apiBase=new URL('./api/discovery/',location.href);
let health=null,report=null,activeId=null,tab='people',pollTimer=null,pollFailures=0,pendingStart=false,history=[];
function safeLink(url,text,cls=''){
  const link=node('a',cls,text);try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)return node('span',cls,text);link.href=parsed.href;}catch{return node('span',cls,text);}link.target='_blank';link.rel='noopener noreferrer';return link;
}
const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'';
async function request(route,options={}){if(PUBLIC_STATIC)throw new Error('公开档案只读取已保存实验；新的探索需要本地服务。');const response=await fetch(new URL(route,apiBase),{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});let data;try{data=await response.json();}catch{throw new Error('本地服务返回了无法读取的结果。');}if(!response.ok)throw new Error(data.error||'本地请求未完成。');return data;}
function sourceNo(url){const index=report?.sources.findIndex(item=>item.url===url)??-1;return index<0?'来源':`S${String(index+1).padStart(2,'0')}`;}
function updateControls(){
  $('#live-start').disabled=!health?.available||!!activeId||pendingStart;
  $('#live-start').textContent=PUBLIC_STATIC?'新探索需本地运行':activeId?'探索进行中…':pendingStart?'正在启动…':'开始自动探索 ↗';
  $('#live-stop').hidden=!activeId;$('#live-stop').disabled=false;
  $('#live-export').disabled=!report;
}
function renderHealth(){
  $('#live-health-dot').classList.toggle('ready',!!health?.available);
  $('#live-health').textContent=health?.available?`${health.provider} · 已就绪 · ${health.model}`:health?.auth||'本地服务未连通；可查看已保存结果，新的探索需要启动本地服务。';updateControls();
}
function renderHistory(){
  const select=$('#live-history');select.replaceChildren();
  const rows=[...history];if(report&&!rows.some(item=>item.id===report.id))rows.unshift({id:report.id,domain:report.input.domain,status:report.status,created_at:report.created_at});
  for(const item of rows){const option=node('option','',`${date(item.created_at)} · ${item.domain} · ${statuses[item.status]||item.status}`);option.value=item.id;select.append(option);}
  if(!rows.length)append(select,append(node('option','','尚无运行记录')));
  if(report)select.value=report.id;
}
function empty(message){return append(node('div','live-empty'),node('strong','',message),node('p','','真实调查结果会在对应阶段完成后出现。可以切到“发现过程”查看已执行的查询。'));}
function renderProgress(){
  const container=$('#live-progress');if(!report)return;
  const status=append(node('div','live-status-line'),node('strong','',report.message),node('span','',`${report.provider} · ${date(report.created_at)}`));
  const stages=node('div','live-stages');
  for(const stage of report.stages){append(stages,append(node('div',`live-stage ${stage.status}`),append(node('div','live-stage-top'),node('strong','',stage.label),node('span','',statuses[stage.status]||stage.status)),node('p','',`检索调用 ${stage.search_count||0} · 页面打开 ${stage.open_count||0}`)));}
  container.replaceChildren(status,stages);
  const stats=$('#live-stats');stats.hidden=false;stats.replaceChildren();
  for(const [number,label] of [[report.people.length,'类人群'],[report.candidates.length,'个问题候选'],[report.sources.length,'条来源'],[report.sources.filter(item=>item.verification==='local_quote_checked').length,'条引文逐字核对']])append(stats,append(node('div'),node('strong','',number),document.createTextNode(label)));
  $('#live-tabs').hidden=false;$('#live-people-count').textContent=report.people.length;$('#live-candidate-count').textContent=report.candidates.length;$('#live-action-count').textContent=report.actions.length;$('#live-source-count').textContent=report.sources.length;
  $('#live-limitations').hidden=false;const limitations=$('#live-limitations-content');const list=node('ul');
  for(const text of [...new Set(report.limitations||[])])list.append(node('li','',text));
  limitations.replaceChildren(list,append(node('div','live-provider-note'),node('p','',`执行方式：${report.provider}，${report.model}。使用官方 codex exec --search 非交互模式，由本地服务自动调用；未提取登录令牌。`),node('p','','页面展示公开工具动作和研究决策摘要，不展示模型内部推理。工具打开记录不保证全文可读；原话核验、摘要与缺失逐条标记。'),node('p','','本轮是需求候选探索，未验证作者独立性、市场规模或付费意愿。对外产品需要独立的模型与数据授权方案。'),safeLink('https://learn.chatgpt.com/docs/non-interactive-mode','官方执行与认证说明 ↗')));
}
function sourceLinks(urls){const links=node('div','live-source-links');for(const url of urls)links.append(safeLink(url,`${sourceNo(url)} 原始来源 ↗`));return links;}
function sourceView(source){
  const verified=source.verification==='local_quote_checked';
  const label=verified?'本地逐字核对':source.opened_in_trace&&source.access==='page_excerpt'?'联网页面摘录 · 待独立核验':'模型报告链接 · 待核查';
  const article=node('article','live-source');
  let host='';try{host=new URL(source.url).hostname;}catch{}
  append(article,append(node('div','live-source-top'),node('span','live-source-id',sourceNo(source.url)),node('span','',host),node('span',`live-grounding${verified?' checked':''}`,label)),append(node('h4'),safeLink(source.url,`${source.title} ↗`)),node('p','',source.claim));
  if(source.quote)article.append(append(node('blockquote'),document.createTextNode(source.quote),node('cite','',`${source.location||'位置未明确'} · ${verified?'已在本地取得的文本中核对':'AI 提取短引文，尚未独立逐字核对'}`)));
  append(article,node('p','live-source-condition',`${phaseLabels[source.phase]||'调查'} · ${source.kind||'来源类型未知'} · ${source.opened_in_trace?'有页面打开记录':'未取得可关联的页面打开记录'} · ${source.date_basis||'发布日期未知'}`));
  if(source.verification_note)article.append(node('p','live-source-condition',source.verification_note));return article;
}
function peopleView(){
  if(!report.people.length)return empty('正在从活动中发现具体人群。');
  const grid=node('div','live-people-grid');
  for(const person of report.people){
    const article=node('article','live-person');
    append(article,append(node('div','live-person-top'),node('span','',person.id.toUpperCase()),node('span','','由真实讨论识别')),node('h3','',person.label),node('h4','','正在完成什么'),node('p','',person.task),node('h4','','具体情境'),node('p','',person.context),append(node('div','live-person-why'),node('h4','','为什么继续观察'),node('p','',person.why)),node('h4','','下一问题'),node('p','',person.next_question),sourceLinks(person.source_urls));grid.append(article);
  }
  return append(node('div'),node('p','live-results-note','这些是本轮从材料中识别的角色与工作情境，仍需核实适用范围；不是完整市场画像。'),grid);
}
function candidateView(){
  if(!report.candidates.length)return empty('正在沿人群与工作过程寻找问题。');
  const container=node('div','live-candidates');
  if(report.summary)container.append(append(node('details','live-report-summary'),node('summary','','查看本轮总体结论与反例'),node('p','live-results-note',report.summary)));
  for(const item of report.candidates){
    const card=node('article','live-candidate');
    const heading=node('h3','',item.problem.split(/[；。]/)[0]);heading.title=item.problem;
    append(card,append(node('div','live-candidate-top'),node('span','',item.id.toUpperCase()),node('span','live-decision',item.decision)),heading,node('p','live-audience',item.audience));
    const fields=node('div','live-candidate-fields');
    for(const [label,text] of [['触发情境',item.context],['遇到的障碍',item.obstacle],['材料中描述的代价',item.impact]])append(fields,append(node('div','live-field'),node('strong','',label),node('p','',text)));
    append(card,fields,append(node('div','live-reason'),node('strong','','为什么继续或搁置：'),document.createTextNode(item.reason)));
    const details=append(node('details'),node('summary','',`查看原话与原始来源（${item.evidence_urls.length}）`));const evidence=node('div','live-evidence-list');
    item.evidence_urls.forEach(url=>{const source=report.sources.find(row=>row.url===url);if(source)evidence.append(sourceView(source));});details.append(evidence);card.append(details);
    if(item.existing_solutions.length){const solutions=node('div','live-solutions');for(const solution of item.existing_solutions)append(solutions,append(node('div','live-solution'),solution.url?safeLink(solution.url,`${solution.name} ↗`):node('strong','',solution.name),node('p','',solution.description)));card.append(solutions);}
    const unknowns=append(node('details'),node('summary','',`还需要核实什么（${item.unknowns.length}）`));const list=node('ul');item.unknowns.forEach(text=>list.append(node('li','',text)));unknowns.append(list);card.append(unknowns);
    append(card,append(node('div','live-next'),node('strong','','下一步调查'),document.createTextNode(item.next_question)),sourceLinks(item.evidence_urls));container.append(card);
  }return container;
}
function processView(){
  const container=node('div');
  container.append(node('p','live-results-note','以下是程序记录的公开搜索 / 打开动作，以及每轮明确产出的调查问题、转向依据和摘要。一次检索调用可以包含多个查询词。'));
  for(const stage of report.stages){
    const article=node('article','live-process-stage');append(article,append(node('div','live-process-heading'),node('h3','',stage.label),node('span','',statuses[stage.status]||stage.status)));
    for(const [title,text] of [['本轮追问',stage.question],['沿什么线索继续',stage.reason],['本轮发现',stage.summary]])if(text)append(article,append(node('p'),node('strong','',`${title}：`),document.createTextNode(text)));
    const actions=node('div','live-actions');
    for(const action of report.actions.filter(item=>item.phase===stage.id)){
      const row=append(node('div','live-action'),node('span','',action.type==='search'?'联网检索':['open_page','open'].includes(action.type)?'打开页面':action.type==='find_in_page'?'页内查找':'其他联网动作'));const detail=node('div');
      action.queries.filter(query=>!query.endsWith(' ...')).forEach(query=>detail.append(node('code','',query)));
      action.urls.forEach(url=>detail.append(safeLink(url,url)));
      if(!action.queries.length&&!action.urls.length)detail.append(node('small','','工具返回内部引用，未提供可关联的公开 URL。'));
      detail.append(node('small','',date(action.at)));append(actions,append(row,detail));
    }
    if(!actions.children.length)actions.append(node('p','live-results-note',stage.status==='pending'?'等待前一轮结果。':'正在执行，工具完成后会显示真实动作。'));
    article.append(actions);container.append(article);
  }return container;
}
function renderResults(){
  if(!report)return;for(const button of $('#live-tabs').querySelectorAll('button')){const active=button.dataset.tab===tab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  const container=$('#live-results');
  if(tab==='people')container.replaceChildren(peopleView());
  else if(tab==='candidates')container.replaceChildren(candidateView());
  else if(tab==='process')container.replaceChildren(processView());
  else{const list=node('div','live-source-list');for(const source of report.sources)list.append(sourceView(source));container.replaceChildren(node('p','live-results-note','每条来源保留读取条件与核验状态。搜索摘要、AI 联网片段与本地逐字核对是不同证据强度。'),report.sources.length?list:empty('正在收集原始来源。'));}
}
function applyReport(value){
  const openDetails=[...$('#live-results').querySelectorAll('details')].map((element,index)=>element.open?index:-1).filter(index=>index>=0);
  report=value;history=history.map(item=>item.id===report.id?{...item,status:report.status,message:report.message}:item);
  renderProgress();renderResults();renderHistory();updateControls();
  const details=$('#live-results').querySelectorAll('details');openDetails.forEach(index=>{if(details[index])details[index].open=true;});
}
async function poll(id){
  clearTimeout(pollTimer);
  try{
    const run=await request(`runs/${id}`);pollFailures=0;
    if(!report||report.id===id)applyReport(run);
    if(activeStates.has(run.status)){activeId=id;updateControls();pollTimer=setTimeout(()=>poll(id),1800);}
    else{activeId=null;updateControls();await loadStatus(false);}
  }catch(error){pollFailures++;$('#live-health').textContent=`运行状态暂时无法读取：${error.message} 已取得的材料保留。`;if(pollFailures<4)pollTimer=setTimeout(()=>poll(id),2500);}
}
async function loadStatus(loadResult=true){
  if(PUBLIC_STATIC){
    health={available:false,auth:'公开研究档案 · 展示 2026-10-15 已保存的真实实验；新的 OpenAI 探索需本地服务。'};
    activeId=null;renderHealth();$('#live-refresh').hidden=true;$('#live-history').disabled=true;
    for(const control of $('#live-form').querySelectorAll('input,select'))control.disabled=true;
    try{const response=await fetch('./data/discovery-latest.json');if(!response.ok)throw new Error();const saved=await response.json();if(!saved.id)throw new Error();applyReport(saved);tab='candidates';renderResults();}
    catch{$('#live-progress').replaceChildren(node('p','live-error','实验快照暂未读取成功，可从实验001文档查看原始记录。'));}
    return;
  }
  try{
    health=await request('status');history=health.runs||[];activeId=health.active_run_id;
    renderHealth();renderHistory();
    if(loadResult){
      if(activeId){tab='process';applyReport(await request(`runs/${activeId}`));poll(activeId);}
      else if(health.latest_id){applyReport(await request('latest'));tab=report.candidates.length?'candidates':'people';renderResults();}
    }
  }catch{
    health=null;renderHealth();
    if(!report)try{const response=await fetch('./data/discovery-latest.json');if(response.ok){const saved=await response.json();if(saved.id){applyReport(saved);tab='candidates';renderResults();}}}catch{}
  }
}
function markdownReport(){
  if(!report)return'';
  return `# 009 · OpenAI 自动需求探索\n\n领域：${report.input.domain}\n市场：${report.input.market}\n执行方式：${report.provider} / ${report.model}\n时间：${report.created_at}\n状态：${statuses[report.status]}\n\n## 摘要\n${report.summary||report.message}\n\n## 发现的人群\n${report.people.map(person=>`### ${person.label}\n任务：${person.task}\n情境：${person.context}\n继续观察：${person.why}\n来源：${person.source_urls.join('\n')}\n下一问题：${person.next_question}`).join('\n\n')}\n\n## 问题候选\n${report.candidates.map(item=>`### ${item.problem}\n人群：${item.audience}\n情境：${item.context}\n障碍：${item.obstacle}\n代价：${item.impact}\n判断：${item.decision}，${item.reason}\n来源：${item.evidence_urls.join('\n')}\n已有办法：${item.existing_solutions.map(solution=>`${solution.name}：${solution.description}`).join('；')}\n未知：${item.unknowns.join('；')}\n下一步：${item.next_question}`).join('\n\n')}\n\n## 发现过程\n${report.stages.map(stage=>`### ${stage.label}\n追问：${stage.question||''}\n依据：${stage.reason||''}\n结果：${stage.summary||''}\n${report.actions.filter(action=>action.phase===stage.id).map(action=>`- ${action.type}：${[...action.queries,...action.urls].join(' | ')}`).join('\n')}`).join('\n\n')}\n\n## 原始来源\n${report.sources.map(source=>`### ${sourceNo(source.url)} ${source.title}\n${source.url}\n解释：${source.claim}\n短引文：${source.quote}\n位置：${source.location}\n核验：${source.verification_note||'AI 联网材料，尚未独立逐字核验。'}\n工具打开记录：${source.opened_in_trace?'有':'无可关联记录'}\n日期：${source.date_basis}`).join('\n\n')}\n\n## 覆盖与未知\n${report.limitations.map(value=>`- ${value}`).join('\n')}\n`;
}
$('#live-form').addEventListener('submit',async event=>{
  event.preventDefault();if(PUBLIC_STATIC||pendingStart||activeId)return;pendingStart=true;updateControls();
  try{
    const input={domain:$('#live-domain').value.trim(),market:$('#live-market').value,constraints:$('#live-constraints').value.trim()};
    const run=await request('runs',{method:'POST',body:JSON.stringify(input)});activeId=run.id;history=[run,...history.filter(item=>item.id!==run.id)];report=null;tab='process';await poll(run.id);
  }catch(error){$('#live-progress').replaceChildren(node('p','live-error',error.message));}
  finally{pendingStart=false;updateControls();}
});
$('#live-stop').addEventListener('click',async()=>{if(!activeId)return;$('#live-stop').disabled=true;try{await request(`runs/${activeId}/cancel`,{method:'POST',body:'{}'});await poll(activeId);}catch(error){$('#live-health').textContent=error.message;}});
$('#live-refresh').addEventListener('click',async()=>{if(PUBLIC_STATIC)return;try{await request('refresh',{method:'POST',body:'{}'});}catch{}await loadStatus(true);});
$('#live-history').addEventListener('change',async()=>{if(PUBLIC_STATIC)return;const id=$('#live-history').value;if(!id)return;try{applyReport(await request(`runs/${id}`));}catch(error){$('#live-health').textContent=error.message;}});
for(const button of $('#live-tabs').querySelectorAll('button'))button.addEventListener('click',()=>{tab=button.dataset.tab;renderResults();});
$('#live-export').addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([markdownReport()],{type:'text/markdown;charset=utf-8'}));const link=node('a');link.href=url;link.download=`009-discovery-${report.id.slice(0,8)}.md`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);});
loadStatus();
