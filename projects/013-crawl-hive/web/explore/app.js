import {DIRECTIONS,GOALS,selectItems,mergeItems,evaluateItem,itemDate,splitKeywords} from './engine.js';
import {publicMode} from './deployment-mode.js';

const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?escape(url.href):'#';}catch{return '#';}};
const date=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'时间未知';
const fullDate=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-CN',{hour12:false}):'来源未提供';
const kindName={news:'资讯与文章',product:'产品线索',repo:'开源项目'};
const topicNames={'coding-agents':'编程与智能体',multimodal:'多模态','llm-tools':'模型与工具','ai-news':'AI 资讯','ai-products':'产品线索'};
const defaultFilters={direction:'all',goal:'all',query:'',include:'',exclude:'',mode:'any',days:'all',sort:'relevance'};
let preferences={filters:{...defaultFilters},sources:null,saved:[],profiles:[],hidden:[]};
try{const saved=JSON.parse(localStorage.getItem('zhixiang-v1')||'null');if(saved&&typeof saved==='object')preferences={...preferences,...saved,filters:{...defaultFilters,...saved.filters}};}catch{}
for(const key of ['saved','profiles','hidden'])if(!Array.isArray(preferences[key]))preferences[key]=[];
let state={items:[],sources:[],runs:[]},live=false,loadFailed=false,apiBase='',view='discover',activeProfile='',editingProfile=null,busy=false,toastTimer;
function persist(){try{localStorage.setItem('zhixiang-v1',JSON.stringify(preferences));}catch{toast('浏览器存储不可用，本次修改仅在当前页面保留');}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function enabledSources(){return preferences.sources??state.sources.map(source=>source.id);}
function filters(){return {...preferences.filters,enabledSources:enabledSources(),hiddenIds:preferences.hidden};}
function allItems(){return mergeItems(state.items);}
function getItem(id){return allItems().find(item=>item.id===id)||preferences.saved.find(item=>item.id===id);}
function itemAnalysis(item){return evaluateItem(item,{...filters(),enabledSources:undefined,hiddenIds:[],goal:'all',days:'all'});}
function setFilters(change){Object.assign(preferences.filters,change);activeProfile='';persist();render();}

function card(item){
  const match=item.match?.pass?item.match:itemAnalysis(item);
  const saved=preferences.saved.some(value=>value.id===item.id);
  return `<article class="info-card"><div class="card-top"><span class="source-mark">${item.kind==='repo'?'GH':escape(item.sourceName.slice(0,2))}</span><div class="source-label"><strong>${escape(item.sourceNames?.join(' · ')||item.sourceName)}</strong><small>${item.kind==='repo'?'公开仓库元数据':'来源原文 · 未经实测'}</small></div><span class="kind-badge">${kindName[item.kind]||'公开信息'}</span></div><h3 class="card-title"><button class="text-button" data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p class="card-summary">${escape(item.summary||'来源未提供摘要，打开原文了解完整内容。')}</p><div class="card-tags">${(item.topics||[]).filter(topic=>item.kind!=='repo'||!['ai-news','ai-products'].includes(topic)).slice(0,3).map(topic=>`<span class="tag">${escape(topicNames[topic]||topic)}</span>`).join('')}${item.stale?'<span class="tag">采集失败 · 保留旧数据</span>':''}</div><p class="match-reason">↳ ${escape(match.pass?match.reasons.join('；'):'收藏保留，当前筛选未命中')}</p><div class="card-meta"><span>${item.kind==='repo'?'最后推送':'发布'} ${date(itemDate(item))}</span>${item.repo?`<span>☆ ${Number(item.repo.stars).toLocaleString()} 总星数</span>`:''}</div><div class="card-actions"><button class="text-button" data-open="${escape(item.id)}">查看分析 <span aria-hidden="true">↗</span></button><a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">原文 ↗</a><button class="save-button" data-save="${escape(item.id)}" aria-pressed="${saved}" aria-label="${saved?'取消收藏':'收藏'}：${escape(item.title)}">${saved?'▣ 已收藏':'＋ 收藏'}</button></div></article>`;
}
function renderControls(){
  const f=preferences.filters;
  $('#direction-chips').innerHTML=DIRECTIONS.map(d=>`<button class="direction-chip ${f.direction===d.id?'active':''}" aria-pressed="${f.direction===d.id}" data-direction="${d.id}" title="${d.description}">${d.name}</button>`).join('');
  $('#goal-tabs').innerHTML=GOALS.map(g=>`<button class="goal-tab ${f.goal===g.id?'active':''}" data-goal="${g.id}" aria-pressed="${f.goal===g.id}">${g.name}</button>`).join('');
  for(const [id,key] of [['global-search','query'],['include-keywords','include'],['exclude-keywords','exclude'],['match-mode','mode'],['time-filter','days'],['sort-filter','sort']]) if($('#'+id).value!==f[key])$('#'+id).value=f[key];
  $('#active-profile-summary').textContent=activeProfile?'当前方向：'+activeProfile:'规则分析 · 不调用模型';
}
function renderDiscover(){
  const items=selectItems(state.items,filters());
  $('#result-list').innerHTML=items.map(card).join('');
  $('#result-summary').textContent=`显示 ${items.length} / ${allItems().length} 条 · ${preferences.filters.sort==='newest'?'按发布 / 推送时间':'按关键词命中数排序'}`;
  $('#empty-state').hidden=items.length>0;
  $('#empty-state').innerHTML=`<h3>当前范围内没有匹配信息</h3><p>试试放宽方向与关键词，或到来源管理开启更多来源。当前仅搜索已经采集的 ${allItems().length} 条公开内容。</p><button class="button button-secondary" data-action="reset">重置筛选</button>${preferences.hidden.length?'<button class="text-button" data-action="restore">恢复暂时隐藏的线索</button>':''}`;
  $('#stats-strip').innerHTML=[[enabledSources().length,'启用来源'],[allItems().length,'采集条目'],[items.length,'当前命中'],[preferences.saved.length,'研究收藏']].map(([number,label])=>`<div class="stat-item"><strong>${number}</strong><span>${label}</span></div>`).join('');
  $('#process-strip').innerHTML=[['01 来源控制',`${enabledSources().length} / ${state.sources.length} 个来源启用`],['02 信息搜索','RSS 最新条目 + GitHub 固定 topic'],['03 信息过滤',`本地规则保留 ${items.length} 条`],['04 信息呈现','原文短摘、命中理由与研究清单']].map(([title,text])=>`<div class="process-stage"><strong>${title}</strong><p>${text}</p></div>`).join('');
}
function renderSources(){
  $('#source-list').innerHTML=state.sources.map(source=>`<article class="source-row"><span class="source-mark">${source.kind==='github'?'GH':'RSS'}</span><div class="source-info"><h3>${escape(source.name)}</h3><p>${escape(source.description)}</p><p><a href="${safeUrl(source.kind==='github'?'https://github.com/topics/coding-agent':source.url)}" target="_blank" rel="noopener noreferrer">查看公开入口 ↗</a> · ${source.itemCount} 条 · 最近检查 ${date(source.checkedAt)}</p>${source.error?`<p class="source-error">${escape(source.error)}；保留上次数据</p>`:''}</div><span class="source-status ${source.status==='ready'?'success':'error'}">${source.status==='ready'?'● 采集成功':source.status==='error'?'● 采集失败':'○ 尚未采集'}</span><label class="source-toggle"><input type="checkbox" data-source="${escape(source.id)}" aria-label="启用 ${escape(source.name)}" ${enabledSources().includes(source.id)?'checked':''}><span aria-hidden="true"></span></label></article>`).join('');
}
const starterProfiles=[{id:'starter-agent',name:'研究开源智能体',direction:'agents',goal:'repo',include:'',exclude:''},{id:'starter-product',name:'发现 AI 产品线索',direction:'all',goal:'product',include:'',exclude:''},{id:'starter-multimodal',name:'跟进多模态进展',direction:'multimodal',goal:'all',include:'',exclude:''}];
function renderProfiles(){
  $('#profile-list').innerHTML=[...starterProfiles,...preferences.profiles].map(profile=>`<article class="profile-card"><span class="section-kicker">${profile.id.startsWith('starter-')?'预设方向':'我的方向'}</span><h3>${escape(profile.name)}</h3><p>${DIRECTIONS.find(d=>d.id===profile.direction)?.description||'自定义探索方向'}</p><div class="card-tags"><span class="tag">${GOALS.find(g=>g.id===profile.goal)?.name||'综合探索'}</span>${splitKeywords(profile.include).map(word=>`<span class="tag">${escape(word)}</span>`).join('')}</div><p>${profile.exclude?'排除：'+escape(profile.exclude):'不额外排除关键词'}</p><div class="card-actions"><button class="text-button" data-profile="${escape(profile.id)}">开始探索 ↗</button>${!profile.id.startsWith('starter-')?`<button class="text-button" data-edit-profile="${escape(profile.id)}">编辑</button><button class="text-button" data-delete-profile="${escape(profile.id)}">删除</button>`:''}</div></article>`).join('');
}
function renderSaved(){
  $('#saved-list').innerHTML=preferences.saved.length?preferences.saved.map(item=>card(getItem(item.id)||item)).join(''):'<div class="empty-panel"><h3>从第一条值得研究的线索开始</h3><p>在信息卡片上点击收藏，原文与当时的元数据会保留在本浏览器，即使下一次采集没有该条目也能回看。</p><button class="button button-secondary" data-view="discover">去发现信息</button></div>';
  $('#export-saved-button').disabled=!preferences.saved.length;
}
function renderLogs(){
  $('#run-list').innerHTML=state.runs.length?state.runs.map(run=>`<article class="run-card"><div class="run-top"><h3>${({ready:'采集完成',partial:'部分来源失败',error:'采集失败',running:'正在采集'})[run.status]||'采集记录'}</h3><time>${fullDate(run.startedAt)}</time></div><p>${run.results.map(result=>`${escape(state.sources.find(source=>source.id===result.sourceId)?.name||result.sourceId)}：${result.status==='ready'?result.count+' 条':escape(result.error||'失败，保留旧数据')}`).join('<br>')}</p><p>结束：${fullDate(run.finishedAt)} · ${run.itemCount??'待完成'} 条来源条目</p><details><summary>查看实际请求</summary>${run.results.flatMap(result=>(result.requests||[]).map(request=>`<p>${escape(JSON.stringify(request))}</p>`)).join('')||'<p>本轮没有可用请求记录。</p>'}</details></article>`).join(''):'<div class="empty-panel"><h3>尚无采集记录</h3><p>点击获取最新，主动采集已启用的来源。</p></div>';
}
function render(){renderControls();renderDiscover();renderSources();renderProfiles();renderSaved();renderLogs();}
const viewLabels={discover:['发现值得研究的 AI','选择你关心的方向，让新闻、产品与开源项目成为清晰的研究线索。'],directions:['我的关注方向','把探索目标保存下来，用同一套标准持续发现信息。'],sources:['管理信息的起点','了解覆盖范围，自主决定哪些来源进入你的信息流。'],saved:['我的研究收藏','保存原文与证据，再判断哪些值得试用、阅读或深入研究。'],logs:['每次采集都有来路','真实记录请求与来源状态，失败会保留旧数据。']};
function switchView(next,updateHash=true){
  view=Object.hasOwn(viewLabels,next)?next:'discover';
  for(const key of Object.keys(viewLabels))$('#view-'+key).hidden=key!==view;
  for(const button of document.querySelectorAll('.primary-nav [data-view]')){button.classList.toggle('active',button.dataset.view===view);if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  $('#view-title').textContent=viewLabels[view][0];$('#view-subtitle').textContent=viewLabels[view][1];
  $('#nav-toggle').setAttribute('aria-expanded','false');
  if(updateHash)history.replaceState(null,'','#'+view);
  window.scrollTo({top:0,behavior:'instant'});
}
function openDetail(id){
  const item=getItem(id);if(!item)return;
  const analysis=itemAnalysis(item),isRepo=item.kind==='repo';
  $('#item-detail').innerHTML=`<div class="detail-header"><span class="section-kicker">${kindName[item.kind]} / 规则分析</span><h2 id="item-detail-title">${escape(item.title)}</h2><p>${escape(item.summary||'来源未提供摘要，请查看原文。')}</p></div><div class="detail-grid"><div><small>来源</small><strong>${escape(item.sourceNames?.join('、')||item.sourceName)}</strong></div><div><small>${isRepo?'最后推送':'发布时间'}</small><strong>${fullDate(itemDate(item))}</strong></div><div><small>采集时间</small><strong>${fullDate(item.collectedAt)}</strong></div><div><small>证据范围</small><strong>${isRepo?'仓库公开元数据':'来源发布的标题与短摘'}</strong></div></div><section class="detail-section"><h3>为什么进入这次探索</h3><p>${escape(analysis.pass?analysis.reasons.join('；'):analysis.reason)}</p><p>方向词与关键词匹配标题、短摘和主题标签。英文按完整词或短语匹配，中文按字面包含匹配；排除优先，包含词可选任一或全部。排序依据命中数，不是事实置信度。</p></section>${isRepo?`<section class="detail-section"><h3>仓库事实</h3><p>${escape(item.repo.fullName)} · ${escape(item.repo.language||'语言未知')}<br>采集时总星数：${Number(item.repo.stars).toLocaleString()}，不代表近期增长<br>许可证：${escape(item.repo.license||'未提供，使用前需确认')}</p></section>`:''}<section class="detail-section"><h3>下一步怎么研究</h3><p>${isRepo?'先读 README、LICENSE 与最近提交，再在隔离环境尝试最小示例；核对安装成本与实际可运行性。':item.kind==='product'?'把它当作待核实的产品线索：确认能否访问、定价与地区限制，选一个真实任务试用，再与现有工具比较。':'先读原文确认发布时间与作者陈述，再找独立资料或原始研究核对关键结论。'}</p></section><aside class="evidence-note"><strong>已知与待验证</strong><p>标题、短摘与仓库数字取自公开来源，未调用模型改写。${item.kind==='product'?'“产品线索”由发布词规则归类，可能误判。':''} 未实测功能、效果、安全性或作者结论。${item.stale?'本次来源采集失败，当前展示上次结果。':''}</p></aside><div class="card-actions"><a class="button button-primary" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a><button class="button button-secondary" data-save="${escape(item.id)}">${preferences.saved.some(saved=>saved.id===id)?'取消收藏':'收藏线索'}</button><button class="text-button" data-hide="${escape(item.id)}">暂时不感兴趣</button></div>`;
  if(!$('#item-dialog').open)$('#item-dialog').showModal();
}
function openProfile(profile=null){editingProfile=profile?.id||null;$('#profile-form').reset();$('#profile-dialog-title').textContent=profile?'编辑关注方向':'创建你的关注方向';for(const key of ['name','direction','goal','include','exclude'])if(profile)$('#profile-'+key).value=profile[key];$('#profile-dialog').showModal();}
function updateHeader(){
  if(publicMode){$('#refresh-button').disabled=true;$('#refresh-label').textContent='历史快照';$('#refresh-button').title='公开页只读取随站快照；实时采集需下载源码并运行本地服务。';}
  if(loadFailed){$('#data-state').textContent='数据载入失败';$('#snapshot-notice p').textContent='数据加载失败，请检查服务后重新载入页面。';return;}
  $('#data-state').textContent=live?'公开来源 · 按需采集':'公开数据快照';
  $('#snapshot-notice p').textContent=live?'已连接本地采集服务。获取最新只刷新启用的来源；方向和关键词只筛选当前已采集内容。':'当前浏览已保存的真实快照。静态网页不会持续监控；实时刷新需启动本地 Node 服务。';
  $('#last-updated').textContent='最近成功采集 '+fullDate(state.lastUpdated);
  $('#last-updated').dateTime=state.lastUpdated||'';
}
async function jsonRequest(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('请求失败 '+response.status);return response.json();}
async function load(){
  const path='/1014_codex_project/013-crawl-hive/api/explore/';
  const candidates=[new URL(path,location.origin).href];
  if(['127.0.0.1','localhost'].includes(location.hostname)&&location.port!=='4183')candidates.push('http://127.0.0.1:4183'+path);
  const snapshotOnly=publicMode || new URLSearchParams(location.search).get('snapshot')==='1';
  for(const candidate of snapshotOnly?[]:candidates){try{const result=await jsonRequest(candidate+'state');if(!Array.isArray(result.items)||!Array.isArray(result.sources))throw new Error('数据格式不完整');state=result;apiBase=candidate;live=true;break;}catch{}}
  if(!live){try{state=await jsonRequest(new URL('./snapshot.json',location.href));}catch{loadFailed=true;toast('公开数据暂未载入，请稍后重试');$('#snapshot-notice p').textContent='数据加载失败，请检查服务后重新载入页面。';}}
  updateHeader();render();
}
async function refresh(){
  if(busy)return;
  if(!live){toast('当前为静态快照。启动本地服务后重新打开页面，即可采集最新信息。');return;}
  const sourceIds=enabledSources();if(!sourceIds.length){toast('请先在来源管理中启用至少一个来源');switchView('sources');return;}
  busy=true;$('#refresh-button').disabled=true;
  try{
    await jsonRequest(apiBase+'refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceIds})});
    const deadline=Date.now()+240000;
    for(;;){
      const progress=await jsonRequest(apiBase+'status');$('#refresh-label').textContent=`采集中 ${progress.done} / ${progress.total}`;
      if(!progress.running){if(progress.error)throw new Error(progress.error);break;}
      if(Date.now()>deadline)throw new Error('采集仍在后台进行，请稍后重新载入查看');
      await new Promise(resolve=>setTimeout(resolve,900));
    }
    state=await jsonRequest(apiBase+'state');updateHeader();render();
    const latest=state.runs[0];toast(latest?.status==='ready'?'采集完成，已更新真实来源内容':'部分来源采集失败，旧数据已保留，可查看采集记录');
  }catch(error){toast('刷新未完成：'+error.message);}finally{busy=false;$('#refresh-button').disabled=false;$('#refresh-label').textContent='获取最新';}
}
document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.view)switchView(target.dataset.view);
  if(target.dataset.direction)setFilters({direction:target.dataset.direction});
  if(target.dataset.goal)setFilters({goal:target.dataset.goal});
  if(target.dataset.open)openDetail(target.dataset.open);
  if(target.dataset.save){const item=getItem(target.dataset.save);if(!item)return;const index=preferences.saved.findIndex(saved=>saved.id===item.id);if(index<0)preferences.saved.push({...item,match:undefined,savedAt:new Date().toISOString()});else preferences.saved.splice(index,1);persist();render();if($('#item-dialog').open)openDetail(item.id);toast(index<0?'已加入研究收藏':'已取消收藏');}
  if(target.dataset.hide){preferences.hidden.push(target.dataset.hide);persist();$('#item-dialog').close();render();toast('已暂时隐藏。重置筛选可恢复。');}
  if(target.dataset.profile){const profile=[...starterProfiles,...preferences.profiles].find(p=>p.id===target.dataset.profile);if(profile){preferences.filters={...defaultFilters,...profile};activeProfile=profile.name;persist();render();switchView('discover');}}
  if(target.dataset.editProfile)openProfile(preferences.profiles.find(p=>p.id===target.dataset.editProfile));
  if(target.dataset.deleteProfile){preferences.profiles=preferences.profiles.filter(p=>p.id!==target.dataset.deleteProfile);persist();renderProfiles();toast('已删除关注方向');}
  if(target.dataset.action==='reset')reset();
  if(target.dataset.action==='restore'){preferences.hidden=[];persist();render();}
});
function reset(){preferences.filters={...defaultFilters};preferences.hidden=[];activeProfile='';persist();render();}
for(const [id,key,event] of [['global-search','query','input'],['include-keywords','include','input'],['exclude-keywords','exclude','input'],['match-mode','mode','change'],['time-filter','days','change'],['sort-filter','sort','change']])$('#'+id).addEventListener(event,e=>setFilters({[key]:e.target.value}));
$('#source-list').addEventListener('change',event=>{if(!event.target.dataset.source)return;const chosen=new Set(enabledSources());event.target.checked?chosen.add(event.target.dataset.source):chosen.delete(event.target.dataset.source);preferences.sources=[...chosen];persist();renderDiscover();});
$('#clear-filters').onclick=reset;
$('#nav-toggle').onclick=()=>$('#nav-toggle').setAttribute('aria-expanded',$('#nav-toggle').getAttribute('aria-expanded')==='true'?'false':'true');
$('#refresh-button').onclick=refresh;
$('#open-profile-button').onclick=()=>openProfile();$('#create-profile-secondary').onclick=()=>openProfile();
$('#close-item-dialog').onclick=()=>$('#item-dialog').close();$('#cancel-profile').onclick=()=>$('#profile-dialog').close();
for(const dialog of [$('#item-dialog'),$('#profile-dialog')])dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
$('#profile-form').onsubmit=event=>{event.preventDefault();const profile={id:editingProfile||'custom-'+crypto.randomUUID(),name:$('#profile-name').value.trim(),direction:$('#profile-direction').value,goal:$('#profile-goal').value,include:$('#profile-include').value,exclude:$('#profile-exclude').value};if(!profile.name)return;const index=preferences.profiles.findIndex(p=>p.id===profile.id);if(index<0)preferences.profiles.push(profile);else preferences.profiles[index]=profile;preferences.filters={...defaultFilters,...profile};activeProfile=profile.name;persist();render();$('#profile-dialog').close();switchView('discover');toast('关注方向已保存并应用');};
$('#export-saved-button').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),analysis:'规则匹配；未实测产品或仓库',items:preferences.saved},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='知向-研究收藏-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('已导出收藏清单');};
window.addEventListener('hashchange',()=>switchView(location.hash.slice(1),false));
switchView(location.hash.slice(1)||'discover',false);
await load();
