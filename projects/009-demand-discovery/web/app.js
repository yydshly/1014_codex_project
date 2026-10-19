import { categories, accessLabels, timeline, signals, entryModes, loop, extensions, roadmap, presets } from './content.js';

const $ = selector => document.querySelector(selector);
const create = (tag, className = '', text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const add = (parent, ...children) => { parent.append(...children.filter(Boolean)); return parent; };
const external = (url, text, className = '') => {
  const element = create('a', className, text);
  try { if (new URL(url).protocol !== 'https:') return create('span', className, text); }
  catch { return create('span', className, text); }
  element.href = url; element.target = '_blank'; element.rel = 'noopener noreferrer'; return element;
};
const STORAGE_KEY = 'research-009-discovery-plan-v1';
let sourceData = { platforms: [], references: [] };
let caseData = { records: [] };
let activeCategory = 'all';
let visibleLimit = 9;
let selectedSources = [];
let currentCase = 0;
let currentLoop = 0;
let currentEntry = 'open';
let toastTimer;
let storageAvailable = true;

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2600);
}
function toggleButtons(container, value) {
  for (const button of container.querySelectorAll('button')) {
    const active = button.dataset.value === String(value);
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
}
function renderTimeline() {
  const container = $('#timeline');
  for (const item of timeline) {
    const article = create('article', 'timeline-item');
    add(article, create('span', 'timeline-no', item.n), create('h3', '', item.title), create('p', '', item.text), create('p', 'takeaway', `↳ ${item.takeaway}`));
    container.append(article);
  }
}
function renderSignals() {
  for (const signal of signals) {
    const article = create('article', 'signal-item');
    add(article, add(create('div', 'signal-title'), create('h3', '', signal.title), create('span', '', signal.eyebrow)), create('p', 'signal-example', signal.example));
    const details = create('details'); details.append(create('summary', '', 'AI 应继续追问什么？'));
    const body = create('div', 'signal-extra');
    add(body, create('strong', '', '继续追问'), create('p', '', signal.question), create('strong', '', '避免误判'), create('p', '', signal.trap));
    for (const query of signal.searches) body.append(create('code', 'query-chip', query));
    add(article, add(details, body)); $('#signal-grid').append(article);
  }
}
function renderEntry() {
  const container = $('#entry-description'); const mode = entryModes[currentEntry];
  container.replaceChildren(create('h3', '', mode.title), create('p', '', mode.text), create('p', 'entry-example', mode.example));
  toggleButtons($('#entry-tabs'), currentEntry);
}
function renderLoop() {
  const item = loop[currentLoop]; const detail = $('#loop-detail');
  const dl = create('dl');
  for (const [title, value] of [['输入材料', item.input], ['AI 的调查动作', item.action], ['留下什么', item.output]]) add(dl, create('dt', '', title), create('dd', '', value));
  detail.replaceChildren(create('div', 'loop-no', `STEP ${String(currentLoop + 1).padStart(2, '0')} / ${item.verb}`), create('h3', '', item.title), dl, add(create('div', 'loop-decision'), create('strong', '', '继续 / 转向 / 停止的依据'), create('p', '', item.decision)));
  toggleButtons($('#loop-steps'), currentLoop);
}
function initDiscovery() {
  for (const [id, mode] of Object.entries(entryModes)) {
    const button = create('button', '', mode.label); button.type = 'button'; button.dataset.value = id;
    button.addEventListener('click', () => { currentEntry = id; renderEntry(); }); $('#entry-tabs').append(button);
  }
  loop.forEach((item, index) => {
    const button = add(create('button'), create('span', '', String(index + 1).padStart(2, '0')), create('strong', '', item.title), create('i', '', '→'));
    button.type = 'button'; button.dataset.value = index; button.addEventListener('click', () => { currentLoop = index; renderLoop(); }); $('#loop-steps').append(button);
  });
  renderEntry(); renderLoop();
}
function renderRoadmap() {
  for (const item of extensions) {
    const article = create('article', 'extension-card');
    add(article, add(create('div', 'extension-top'), create('span', '', item.n), create('span', '', item.label)), create('h3', '', item.title), create('p', '', item.detail), add(create('div', 'extension-condition'), create('strong', '', '成立条件'), create('p', '', item.condition)), create('div', 'extension-metric', `看什么：${item.metric}`));
    $('#extension-grid').append(article);
  }
  for (const item of roadmap) {
    const article = create('article', 'roadmap-item');
    add(article, create('div', 'roadmap-stage', item.stage), add(create('div'), create('h4', '', item.title), create('p', '', item.text)), add(create('div', 'roadmap-gate'), create('span', '', '进入下一步的条件'), create('strong', '', item.state), create('p', '', item.gate)));
    $('#roadmap-list').append(article);
  }
}
function filteredSources() {
  const query = $('#source-search').value.trim().toLocaleLowerCase();
  const region = $('#region-filter').value; const access = $('#access-filter').value;
  return sourceData.platforms.filter(item => {
    const haystack = [item.name,item.audience,item.observe,item.discovery_question,...item.signals,categories[item.category]].join(' ').toLocaleLowerCase();
    return (activeCategory === 'all' || item.category === activeCategory) && (region === 'all' || item.region === region) && (access === 'all' || item.access === access) && (!query || haystack.includes(query));
  });
}
function sourceCard(item) {
  const selected = selectedSources.includes(item.id);
  const article = create('article', `source-card${selected ? ' selected' : ''}`);
  const verification = { official_checked:'官方说明已核查', entry_checked:'入口已核查', pending:'待核查' }[item.verification] || '待核查';
  add(article, add(create('div', 'source-card-top'), create('span', 'category-tag', categories[item.category]), create('span', '', item.region === 'china' ? 'CN / 国内' : 'GLOBAL / 海外')),
    add(create('h3'), external(item.url, item.name), create('span', '', '↗')), create('p', 'audience', item.audience), create('p', 'observe', item.observe));
  const chips = create('div', 'source-signals'); item.signals.forEach(signal => chips.append(create('span', '', signal))); article.append(chips);
  const details = create('details'); details.append(create('summary', '', `看发现方式与接入条件 · ${verification}`));
  for (const [label, value] of [['先追问', item.discovery_question], ['接入条件', item.access_note], ['采样偏差', item.bias]]) details.append(add(create('p'), create('strong', '', `${label}：`), document.createTextNode(value)));
  details.append(external(item.reference_url, `核查依据 ↗ · ${item.checked_at}`)); article.append(details);
  const button = create('button', 'add-source', selected ? '已加入 ✓' : '加入计划 ＋'); button.type = 'button'; button.setAttribute('aria-label', `${selected ? '移出' : '加入'}探索计划：${item.name}`); button.setAttribute('aria-pressed', String(selected));
  button.addEventListener('click', () => {
    selectedSources = selectedSources.includes(item.id) ? selectedSources.filter(id => id !== item.id) : [...selectedSources, item.id];
    savePlan(); renderSources(); renderPlan(); toast(selectedSources.includes(item.id) ? `已将 ${item.name} 加入计划` : `已将 ${item.name} 移出计划`);
  });
  add(article, add(create('div', 'source-card-bottom'), create('span', `access-tag${item.access === 'public_api' ? ' api' : ''}`, accessLabels[item.access] || item.access), button));
  return article;
}
function renderSources() {
  const records = filteredSources(); const displayed = records.slice(0, visibleLimit);
  const container = $('#source-grid'); container.replaceChildren(...displayed.map(sourceCard));
  if (!records.length) container.append(create('p', 'source-empty', '没有匹配的入口。可以减少关键词，或清除筛选后按人群与任务重新观察。'));
  $('#source-count').textContent = `找到 ${records.length} 个入口 · 已显示 ${displayed.length} 个 · 已选 ${selectedSources.length} 个`;
  $('#platform-total').textContent = sourceData.platforms.length;
  const button = $('#load-more'); button.hidden = records.length <= visibleLimit;
  button.textContent = `查看更多平台（还有 ${Math.max(0,records.length - visibleLimit)} 个）`;
  toggleButtons($('#source-categories'), activeCategory);
}
function initSources() {
  for (const [id,label] of [['all','全部入口'],...Object.entries(categories)]) {
    const button = create('button', '', label); button.dataset.value = id; button.type = 'button';
    button.addEventListener('click', () => { activeCategory = id; visibleLimit = 9; renderSources(); }); $('#source-categories').append(button);
  }
  for (const id of ['source-search','region-filter','access-filter']) $(`#${id}`).addEventListener(id === 'source-search' ? 'input' : 'change', () => { visibleLimit = 9; renderSources(); });
  $('#clear-filters').addEventListener('click', () => { activeCategory = 'all'; $('#source-search').value = ''; $('#region-filter').value = 'all'; $('#access-filter').value = 'all'; visibleLimit = 9; renderSources(); });
  $('#load-more').addEventListener('click', () => { visibleLimit += 9; renderSources(); });
}
function renderCase() {
  const record = caseData.records[currentCase]; if (!record) return;
  const article = create('article', 'case-card');
  add(article, create('div', 'case-overline', `REDDIT / r/${record.subreddit} / ${record.id}`), create('h4', '', record.problem), external(record.url, `${record.title} ↗`, 'case-source'));
  const audience = create('div', 'case-audience');
  for (const [label,value] of [['人群',record.audience],['正在完成的任务',record.task]]) add(audience, add(create('div'),create('span','',label),create('p','',value)));
  article.append(audience);
  const evidence = add(create('div'), create('h5', '', '原话 · 保留发帖与回复的区别'));
  for (const quote of record.evidence) add(evidence, add(create('blockquote'), document.createTextNode(quote.quote), create('cite', '', quote.location)));
  const solutions = add(create('div'), create('h5', '', '材料中出现的已有办法'));
  for (const solution of record.solutions) add(solutions, add(create('div','case-solution'),create('strong','',solution.name),create('p','',solution.summary)));
  add(article, add(create('div','case-content'),evidence,solutions));
  const list = create('ul'); record.unknowns.forEach(text => list.append(create('li','',text)));
  add(article, add(create('div','case-unknowns'),create('strong','','仍需调查'),list), create('p','case-footnote',`采样时间：2026-10-15。来源：004 的 OpenAI 会话检索与页面读取；只含可读片段，不是完整评论导出。原帖绝对发布日期未知；本页没有重新抓取。`));
  $('#case-detail').replaceChildren(article); toggleButtons($('#case-tabs'), currentCase);
}
function initCases() {
  caseData.records.forEach((item,index) => {
    const button = create('button','',`${String(index+1).padStart(2,'0')} / ${index === 0 ? '修改与工作量' : '轮次与分散反馈'}`); button.type='button'; button.dataset.value=index;
    button.addEventListener('click',()=>{ currentCase=index; renderCase(); }); $('#case-tabs').append(button);
  }); renderCase();
}
const formKeys = ['preset','domain','role','activity','market','limit','constraints','notes'];
function readPlan() { return Object.fromEntries(formKeys.map(key=>[key,$(`#plan-${key}`).value.trim()])); }
function savePlan() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1,...readPlan(),selectedSources}));
    storageAvailable = true; $('#plan-save-status').textContent = '已自动保存到当前浏览器；换设备不会同步。';
  } catch { storageAvailable = false; $('#plan-save-status').textContent = '当前浏览器无法保存；可以下载计划保留本次修改。'; }
}
function loadPlan() {
  let stored;
  try { stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { stored=null; }
  if (!stored || stored.version !== 1 || !presets[stored.preset]) { applyPreset('explore'); return; }
  for (const key of formKeys) {
    const field=$(`#plan-${key}`); const value=stored[key];
    if (typeof value !== 'string') continue;
    if (field.tagName === 'SELECT') { if ([...field.options].some(option=>option.value===value)) field.value=value; }
    else field.value=value.slice(0,field.maxLength>0?field.maxLength:1800);
  }
  if (Array.isArray(stored.selectedSources)) selectedSources=[...new Set(stored.selectedSources.filter(id=>typeof id==='string'))].slice(0,40);
  $('#plan-save-status').textContent='已恢复保存在此浏览器的探索计划。';
}
function applyPreset(id) {
  const item=presets[id]; $('#plan-preset').value=id; $('#plan-domain').value=item.domain; $('#plan-role').value=item.role; $('#plan-activity').value=item.activity;
}
function plannedSources(plan=readPlan()) {
  if (selectedSources.length) return sourceData.platforms.filter(item=>selectedSources.includes(item.id));
  const names=presets[plan.preset].channels;
  return names.map(name=>sourceData.platforms.find(item=>item.name.toLowerCase().startsWith(name.toLowerCase()))).filter(Boolean);
}
function planText() {
  const plan=readPlan(); const preset=presets[plan.preset]; const sources=plannedSources(plan);
  return `# 009 · 需求发现探索计划\n\n整理日期：2026-10-15\n本计划由本地研究模板组织；尚未执行自动采集或 AI 分析。\n\n## 探索边界\n- 领域：${plan.domain}\n- 角色假设：${plan.role}\n- 活动：${plan.activity}\n- 语言与市场：${plan.market}\n- 实现边界：${plan.constraints}\n- 单轮阅读上限：${plan.limit} 条材料；这个上限用于控制工作，不代表充分采样。\n\n## 研究目标\n在没有预设具体痛点的前提下，发现有具体活动的人群、重复费力的行为和值得进一步核实的问题。\n优先追问：${preset.question}\n\n## 观察入口\n${sources.length?sources.map(item=>`- ${item.name}：${item.url}\n  观察：${item.observe}\n  接入边界：${item.access_note}`).join('\n'):'- 先发现相关人群的聚集地，再说明为什么选择该来源。'}\n\n## 启动检索示例\n${preset.queries.map(query=>`- ${query}`).join('\n')}\n这些是模板示例，请按目标语言、真实角色与上下文改写，不局限于抱怨词。\n\n## 给 AI 的调查任务\n1. 先提出角色与任务候选，用真实材料核对谁在做什么；候选不是已证实群体画像。\n2. 阅读工作过程、求助、教程、评论与任务说明，记录重复、等待、返工、人工补缝、外包或放弃行为。\n3. 每条线索保存原链接、原话定位、来源角色、采集时间、发布日期依据和读取完整度；读不到要记录。\n4. 区分事实、解释、假设与未知。不要编造频率、耗时、预算、收入或购买意愿。\n5. 根据原话中的角色名、任务词、约束和工具继续调查，明确本轮发现怎样改变下一轮搜索。\n6. 合并同帖、转载和同一人的重复表达；比较相同任务下的独立经历，不机械累计帖子数量。\n7. 主动寻找反例和已有有效办法；判断是否只是流程、培训或一次性故障。\n8. 产出人群地图、问题候选、支持与反例、现有办法、关键未知和下一步调查动作。\n9. 对每项给出继续 / 转向 / 搁置的理由；材料不足就保留未知，不能把抱怨认定为付费市场。\n10. 达到材料上限、没有新增独立线索或访问受限时停止，并报告覆盖与缺失。不得自行发送联系信息或发布内容。\n\n## 每个候选的输出字段\n人群｜任务｜情境｜障碍｜已付出的代价｜原文与来源｜独立性｜反例｜已有办法｜关键未知｜下一步｜发现路径。\n\n## 我的观察与待追问\n${plan.notes||'尚未记录。'}\n\n## 进入下一阶段的条件\n能解释从哪个活动发现了谁、哪些行为暴露了问题、是否存在独立证据，以及什么事实仍需与目标使用者核实。\n`;
}
function planBlock(title,text) { return add(create('div','plan-block'),create('h4','',title),create('p','',text)); }
function renderPlan() {
  const plan=readPlan(); const preset=presets[plan.preset]; const container=$('#plan-preview');
  const steps=create('ol'); ['找角色与聚集地，记录选择依据。','观察怎样做事，捕捉具体的费力行为。','沿真实术语追查相似经历与反例。','形成问题候选，保留未知与下一步。'].forEach(text=>steps.append(create('li','',text)));
  const starter=add(create('div','plan-block'),create('h4','','启动检索示例 · 执行时可继续扩展'));
  const sources=plannedSources(plan);
  preset.queries.forEach((query,index)=>{
    const source=sources[index%sources.length]; const qualifier=source?`site:${new URL(source.url).hostname.replace(/^www\./,'')} `:'';
    starter.append(external(`https://www.google.com/search?q=${encodeURIComponent(qualifier+query)}`,`${source?`${source.name} · `:''}${query} ↗`,'search-query'));
  });
  container.replaceChildren(planBlock('先观察谁，在做什么',`${plan.role}。优先观察：${plan.activity}。`),planBlock('这轮最重要的追问',preset.question),add(create('div','plan-block'),create('h4','','研究路径'),steps),starter,planBlock('继续或停止',`最多阅读 ${plan.limit} 条材料；没有新增独立线索或访问受限时，记录原因。保留反例、已有办法和关键未知。`));
  const selected=$('#selected-sources'); selected.replaceChildren();
  for (const source of sources) {
    const chip=create('span','selected-chip',source.name);
    if(selectedSources.length){ const remove=create('button','','×');remove.type='button';remove.setAttribute('aria-label',`移出探索计划：${source.name}`);remove.addEventListener('click',()=>{selectedSources=selectedSources.filter(id=>id!==source.id);savePlan();renderPlan();renderSources();});chip.append(remove); }
    selected.append(chip);
  }
  $('#plan-prompt').textContent=planText();
}
function download(filename,text) {
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
  const link=create('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function initPlan() {
  loadPlan();
  $('#plan-preset').addEventListener('change',()=>{applyPreset($('#plan-preset').value);selectedSources=[];savePlan();renderPlan();renderSources();});
  $('#plan-form').addEventListener('input',()=>{savePlan();renderPlan();});
  $('#plan-form').addEventListener('change',()=>{savePlan();renderPlan();});
  $('#plan-form').addEventListener('submit',event=>{event.preventDefault();savePlan();renderPlan();toast(storageAvailable?'探索计划已更新并保存在此浏览器':'探索计划已更新，请下载保留');});
  $('#copy-plan').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(planText());toast('已复制 AI 研究指令');}
    catch{$('#plan-prompt').parentElement.open=true;toast('浏览器未允许复制，请在展开的指令中手动选择');}
  });
  $('#download-plan').addEventListener('click',()=>{download('009-demand-discovery-plan.md',planText());toast('探索计划已准备下载');});
}
function renderReferences() {
  const items=[
    {title:'思考起点：JasonZhu.AI',url:'https://jasonzhu.ai/',note:'个人网站、独立开发内容与研究入口。能力边界和许可见本项目记录。'},
    {title:'原站固定版本与权利说明',url:'https://github.com/zhuyansen/jasonzhu.ai/blob/9780c4408227e9b0bace1b1e2ed5160f341f2753/README.md',note:'参考 commit 9780c440…；未复制其代码或图片。'},
    ...(sourceData.references||[]),
  ];
  for(const item of items){const article=add(create('article','reference-item'),external(item.url,`${item.title} ↗`),create('p','',item.note));$('#reference-list').append(article);}
}
function understandingSummary() {
  return `\n\n## 2026-10-19 · 理解全景补充\n\n原库是个人品牌网站，另有来源采集、AI 筛选摘要和快讯发布管线。我们将流程启发向上游扩展：从宽泛活动发现角色与任务，沿费力行为形成问题假设，追查独立证据、已有办法和反例，再决定继续、收窄或搁置。\n\n已做探索：工具演示与研究对象校准；004 的20条问题取样及偏差反思；009 的27入口目录与三轮 OpenAI 自动探索。实验001识别3类人群、3个候选、10条链接，6条可关联打开动作，本地逐字核验成功0条。\n\n后续方向：来源覆盖、持续观察、机会研究、需求验证、最小产品、研究工作台或专题服务。以独立证据、判断变化、真实任务改善、复用与交易衡量，不把来源数量当商业验证。\n\n完整说明：${new URL('./notes/UNDERSTANDING.md',location.href).href}\n全景图：${new URL('./understanding.html',location.href).href}\n原库依据：https://github.com/zhuyansen/jasonzhu.ai/tree/9780c4408227e9b0bace1b1e2ed5160f341f2753\n`;
}
function reflectionSummary(){
  return '\n\n## 个人主页带来的直接反思\n\n值得参考的是自己的研究沉淀、入口引导与复习更新。做之前回看，做之后记录，有反馈就更新。给自己留下来源、判断、实践结果和下一步；给读者提供摘要、案例、方法与产品入口。\n\n研究 → 实践 → 记录 → 展示 → 接触用户 → 获得反馈 → 更新研究。\n\n进一步可把上游探索产品化：发现需求、验证任务，再实现最小网页工具；持续观察、机会研究与专题服务需以真实复用或交易验证。\n';
}
function researchSummary() {
  return `# 009 · 需求发现研究台\n\n整理日期：2026-10-15\n\n## 思考来源与转向\n${timeline.map(item=>`${item.n}. ${item.title}：${item.text}\n   ${item.takeaway}`).join('\n')}\n\n## 核心目标\n从活动发现人群，从真实行为发现问题；让 AI 根据证据决定下一步调查，并输出可复查的问题候选。\n\n## 平台地图（${sourceData.platforms.length} 个入口）\n${sourceData.platforms.map(item=>`- ${item.name}：${item.url}\n  ${item.observe}\n  接入：${item.access_note}\n  偏差：${item.bias}\n  核查依据：${item.reference_url}`).join('\n')}\n\n## 观察信号\n${signals.map(item=>`- ${item.title}：${item.question}\n  误判提醒：${item.trap}`).join('\n')}\n\n## AI 探索方法\n${loop.map((item,index)=>`${index+1}. ${item.title}\n   动作：${item.action}\n   产物：${item.output}\n   判断：${item.decision}`).join('\n')}\n\n## 产品扩展\n${extensions.map(item=>`- ${item.title}：${item.detail}\n  成立条件：${item.condition}\n  衡量：${item.metric}`).join('\n')}\n\n## 当前边界\n本页已实现资料浏览、筛选、方法切换、旧样本展示、探索计划与导出。本地第一版已接入 OpenAI 三轮自主探索和真实来源展示。跨来源自动聚类、持续监测和付费市场仍待开发或验证。\n\n## 参考来源\n${(sourceData.references||[]).map(item=>`- ${item.title}：${item.url}`).join('\n')}\n\n---\n\n${planText()}`;
}
function initNav() {
  const navLinks=[...document.querySelectorAll('.nav-list a')];
  const observer=new IntersectionObserver(entries=>{
    const entry=entries.filter(item=>item.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(entry)navLinks.forEach(link=>link.classList.toggle('active',link.hash===`#${entry.target.id}`));
  },{rootMargin:'-12% 0px -65% 0px',threshold:0});
  document.querySelectorAll('main>section[id]').forEach(section=>observer.observe(section));
}
async function readJSON(file) { const response=await fetch(file);if(!response.ok)throw new Error('资料读取失败');return response.json(); }
async function main() {
  renderTimeline();renderSignals();initDiscovery();renderRoadmap();initSources();initPlan();initNav();
  const results=await Promise.allSettled([readJSON('./data/platforms.json'),readJSON('./data/cases.json')]);
  if(results[0].status==='fulfilled'){
    sourceData=results[0].value;
    selectedSources=selectedSources.filter(id=>sourceData.platforms.some(item=>item.id===id));
    renderSources();renderReferences();
  }else{
    $('#source-count').textContent='平台数据读取失败；可以从本页研究文档查看完整目录。';
    $('#source-grid').replaceChildren(create('p','source-empty','未能读取平台资料。请确认通过本地服务打开网页，或查看来源目录说明。'));
  }
  if(results[1].status==='fulfilled'){caseData=results[1].value;initCases();}
  else $('#case-detail').append(create('p','source-empty','样本资料暂时读取失败，可在 004 研究记录中查看来源。'));
  renderPlan();
  $('#export-research').addEventListener('click',()=>{download('009-demand-discovery-research.md',researchSummary()+understandingSummary()+reflectionSummary());toast('研究摘要、理解补充与当前计划已准备下载');});
}
main().catch(()=>toast('部分资料未能加载，请查看本页研究文档。'));
