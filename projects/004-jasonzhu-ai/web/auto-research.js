import { saveResearchFindings } from './findings.js';
const $=s=>document.querySelector(s);
const staticMode=document.documentElement.dataset.researchMode==='static';
const node=(tag,text,cls='')=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const activeStates=new Set(['queued','searching','reading','analysing','checking']);
const storageKey='research-004-auto-session-v1';
let health=null,activeId=null,report=null,timer=null,pollErrors=0,submitting=false,pending=null;
const notices=new Map();
const date=value=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Shanghai'}).format(new Date(value));
const link=(url,label)=>{const a=node('a',label);try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new Error();a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{a.removeAttribute('href');}return a;};
async function api(route,body){const res=await fetch(`./api/research/${route}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let data;try{data=await res.json();}catch{throw new Error('研究服务未连接，请运行004本地服务并刷新连接。');}if(!res.ok)throw new Error(data.error||'请求失败');return data;}
function persistPending(){try{if(pending)localStorage.setItem(storageKey,JSON.stringify(pending));else localStorage.removeItem(storageKey);}catch{$('#research-save-status').textContent='浏览器无法保存运行标记；本轮结束后请手动保存结果。';}}
function controls(){const busy=Boolean(activeId||submitting);$('#research-start').disabled=busy||!health?.available;$('#research-direction').disabled=busy;$('#research-use-plan').disabled=busy;$('#research-focus').disabled=busy;$('#research-autosave').disabled=busy;$('#research-history').disabled=busy;$('#research-cancel').hidden=!activeId;$('#research-save-all').disabled=!report?.records.length||report.status!=='completed';}
function render(job){
  report=job;$('#research-output').hidden=false;$('#research-run-title').textContent=job.input.direction;if([...$('#research-history').options].some(option=>option.value===job.id))$('#research-history').value=job.id;
  $('#research-progress').textContent=job.message;$('#research-summary').textContent=job.status==='completed'?`来源检查后保留 ${job.records.length} 条发现。以下是 AI 整理的研究线索，具体经历、效果与付费意愿仍需回到原文核实。` : '';
  $('#research-meta').textContent=`${date(job.created_at)} · ${job.actions.filter(a=>a.type==='search').length} 次搜索 · ${job.actions.filter(a=>['open','open_page','openPage'].includes(a.type)).length} 次页面打开`;
  const cards=job.records.map(record=>{const card=node('article',undefined,'auto-result');card.append(node('span',{need:'需求线索',github:'GitHub 项目',ai:'AI 产品'}[record.kind],'small-label'),node('h4',record.title),link(record.url,'查看主来源 ↗'),node('p',record.understanding),node('strong','下一步'),node('p',record.nextStep));return card;});
  $('#research-results').replaceChildren(...cards);
  const sources=job.sources.map(source=>{const item=node('div',undefined,'research-source');item.append(link(source.url,source.title||source.url),node('span',source.verification==='local_quote_checked'?'短引文已逐字匹配':source.verification==='tool_read_excerpt'?'有原文打开记录 · 摘录待复核':'摘要或不可读 · 未当作原文','research-source-badge'));if(source.quote)item.append(node('blockquote',source.quote));item.append(node('p',`${source.location||'定位未知'} · ${source.date_basis||'日期未知'}`));if(source.verification_note)item.append(node('p',source.verification_note));return item;});
  $('#research-sources').replaceChildren(...sources);$('#research-source-count').textContent=`来源与读取情况（${job.sources.length}）`;
  const omitted=job.excluded.map(value=>{const li=node('li');li.append(node('strong',value.title||'未保留的材料'),node('p',value.reason));if(value.url)li.append(link(value.url,'查看材料'));return li;});
  $('#research-excluded').replaceChildren(...omitted);$('#research-excluded-details').hidden=!omitted.length;
  $('#research-limitations').replaceChildren(...job.limitations.map(value=>node('li',value)));
  $('#research-actions').replaceChildren(...job.actions.map(action=>node('li',`${action.type==='search'?'搜索':'读取'}：${action.queries.concat(action.urls).join('；')||'工具未返回公开定位'}`)));
  $('#research-save-status').textContent=notices.get(job.id)||'';controls();
}
function save(job){try{const result=saveResearchFindings(job.records);const text=`已保存 ${result.added} 条发现，跳过 ${result.skipped} 条已有链接。可到“我的发现”继续补充。`;notices.set(job.id,text);$('#research-save-status').textContent=text;if(pending?.id===job.id){pending=null;persistPending();}return true;}catch(error){$('#research-save-status').textContent=`结果已保留，但写入发现库失败：${error.message} 可修复后点“保存本轮发现”重试。`;return false;}}
async function loadRun(id){const job=await api(`runs/${id}`);render(job);return job;}
function schedule(){clearTimeout(timer);timer=setTimeout(poll,3000);}
async function poll(){if(!activeId)return;try{const job=await loadRun(activeId);pollErrors=0;if(activeStates.has(job.status)){schedule();return;}activeId=null;controls();if(job.status==='completed'&&pending?.id===job.id&&pending.autoSave)save(job);else if(pending?.id===job.id){pending=null;persistPending();}await refreshHistory();}catch(error){pollErrors++;$('#research-progress').textContent=`暂时无法读取进度：${error.message}`;if(pollErrors<3)schedule();else{$('#research-progress').textContent+=' 点击“刷新连接”继续查看，服务器任务可能仍在运行。';}}}
async function refreshHistory(){const state=await api('status');health=state;$('#research-connection').textContent=state.message;const select=$('#research-history');select.replaceChildren(node('option','选择一次已保存的研究'));select.firstElementChild.value='';for(const run of state.runs){const option=node('option',`${date(run.created_at)} · ${run.input.direction} · ${run.count}条`);option.value=run.id;select.append(option);}if(report)select.value=report.id;controls();return state;}
async function reconnect(refresh=false){try{if(refresh)await api('refresh',{});const state=await refreshHistory();activeId=state.active_run_id;pollErrors=0;if(activeId){await loadRun(activeId);schedule();}else if(pending?.id){const job=await loadRun(pending.id);if(job.status==='completed'&&pending.autoSave)save(job);else{pending=null;persistPending();}}else if(!report&&state.runs.length){await loadRun(state.runs[0].id);}controls();}catch(error){health=null;controls();$('#research-connection').textContent=error.message;}}
$('#research-form').addEventListener('submit',async event=>{event.preventDefault();if(activeId||submitting)return;submitting=true;controls();$('#research-output').hidden=false;$('#research-progress').textContent='正在提交研究方向…';try{const direction=$('#research-direction').value.trim();const focus=$('#research-focus').value;const autoSave=$('#research-autosave').checked;const job=await api('runs',{direction,focus});pending={id:job.id,autoSave};persistPending();activeId=job.id;await loadRun(job.id);schedule();}catch(error){$('#research-progress').textContent=error.message;}finally{submitting=false;controls();}});
$('#research-cancel').addEventListener('click',async()=>{if(!activeId)return;try{await api(`runs/${activeId}/cancel`,{});$('#research-progress').textContent='正在停止本轮…';schedule();}catch(error){$('#research-progress').textContent=error.message;}});
$('#research-refresh').addEventListener('click',()=>reconnect(true));
$('#research-save-all').addEventListener('click',()=>{if(report?.status==='completed')save(report);});
$('#research-history').addEventListener('change',async event=>{if(event.target.value)try{await loadRun(event.target.value);}catch(error){$('#research-progress').textContent=error.message;}});
$('#research-use-plan').addEventListener('click',()=>{const task=$('#user-task').value.trim();const audience=$('#target-user').value.trim();if(task){$('#research-direction').value=[audience,task].filter(Boolean).join('：').slice(0,300);$('#research-direction').focus();}else{$('#research-connection').textContent='采集计划还没有任务，可直接在这里输入研究方向。';}});
try{pending=JSON.parse(localStorage.getItem(storageKey)||'null');if(!pending||typeof pending.id!=='string'||typeof pending.autoSave!=='boolean')pending=null;}catch{pending=null;}
if(staticMode){
  $('#research-connection').textContent='公开展示模式：自动研究需要本地 Node 服务与 Codex 登录。网站入口、采集计划和发现库可在当前浏览器使用。';
  for(const control of $('#research-form').querySelectorAll('input,textarea,select,button'))control.disabled=true;
  $('#research-history').disabled=true;$('#research-refresh').hidden=true;
  const help=document.createElement('a');help.href='./research.html#local';help.textContent='查看本地运行方式 ↗';help.className='text-link';$('#research-connection').append(' ',help);
  const entry=$('[data-auto-entry]');if(entry){entry.href='#directory';entry.textContent='浏览网站入口 ↓';}
  $('.research-cost-note').textContent='在本地版提交研究后才使用 Codex 额度，每轮最多整理 3 条发现；公开页不执行模型调用。';
  for(const anchor of document.querySelectorAll('a[href="#research"]'))if(anchor.textContent.includes('直接执行')){anchor.href='./research.html#local';anchor.textContent='了解本地自动研究 ↗';}
}else reconnect();
