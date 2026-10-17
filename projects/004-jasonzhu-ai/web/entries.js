const $ = (selector) => document.querySelector(selector);
const categoryNames = { community: '社区求助', feedback: '产品反馈', paid: '付费任务', solutions: '现有方案' };
const presets = {
  orders: { zh: '整理订单', en: 'organize orders', audience: '小店经营者' },
  meetings: { zh: '整理会议记录', en: 'meeting notes', audience: '小团队的项目负责人' },
  feedback: { zh: '客户反馈', en: 'client feedback', audience: '自由职业设计师' },
  content: { zh: '整理创作素材', en: 'organize content assets', audience: '内容创作者' },
};
const intents = {
  explore: {
    title: '还没方向？先读一个具体事例。',
    description: '不用先想产品点子，也不用填关键词。选一个起点，看别人最近在做什么。',
    entries: ['v2ex', 'reddit', 'hacker-news', 'product-hunt'],
    steps: ['打开一个入口，浏览几条标题，挑一个你看得懂的求助或产品。', '读到具体过程：谁在做什么，哪里麻烦，已经用了什么办法？', '抄下一个任务词，例如“核对订单”；展开下方搜索框，再找相似事例。'],
    output: '这次先留下：一条原始链接 + 一个具体任务 + 一个想追问的问题。',
  },
  needs: {
    title: '从一个正在发生的麻烦开始。',
    description: '先看求助与工作经历，再用产品评价或付费任务交叉核实。',
    entries: ['reddit', 'v2ex', 'g2', 'upwork'],
    steps: ['在求助中找到具体任务；没有关键词时，可以先浏览公开列表。', '读正文和后续回复，找频率、耗时、手工补救和已有解决办法。', '用同一任务词找另一处独立来源，核对是否仍然没有解决。'],
    output: '这次先留下：谁 + 什么场景 + 哪一步卡住 + 原话与链接；未知的部分留空。',
  },
  projects: {
    title: '先找到一个能解释清楚用途的项目。',
    description: '从 GitHub 或产品讨论进入仓库，用一个小任务判断是否值得继续研究。',
    entries: ['github', 'hacker-news'],
    steps: ['用任务词定位项目，先读 README 的输入、输出与示例；没有词时从入口浏览。', '核对许可证、运行条件、更新与问题回复，再决定是否安装或运行。', '选一个自己的小任务试用，记录结果、成本与实际没解决的部分。'],
    output: '这次先留下：仓库链接 + 解决的任务 + 运行条件 + 准备验证的小任务。',
  },
  products: {
    title: '看 AI 在真实任务里省掉了哪一步。',
    description: '先找产品，再回到官网和用户反馈，核对实际使用过程。',
    entries: ['product-hunt', 'hacker-news', 'g2', 'capterra'],
    steps: ['从产品介绍或发布讨论找一个具体用途；有任务词时再展开搜索。', '回到官网核对输入、输出、价格和使用限制，区分演示与实际结果。', '与现在的做法比较：省了哪一步，还需要什么人工处理？'],
    output: '这次先留下：产品链接 + 目标用户 + 实际输入输出 + 一个待验证的价值点。',
  },
};
let catalog;
let selected = 'v2ex';
let category = 'all';
let intent = 'explore';
let tasks = { zh: $('#entry-task-zh').value, en: $('#entry-task-en').value, audience: '' };
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
function externalLink(label, url, className = '') {
  const link = node('a', className, label);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('外部入口需要 HTTPS');
  link.href = parsed.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
const setStatus = (text) => { $('#entry-status').textContent = text; };
function openSearch(language) {
  $('#entry-search-controls').open = true;
  $(`#entry-task-${language || 'zh'}`).focus();
}
function renderGuide() {
  const guide = intents[intent];
  for (const button of document.querySelectorAll('[data-entry-intent]')) {
    button.setAttribute('aria-pressed', String(button.dataset.entryIntent === intent));
  }
  const intro = node('div', 'entry-guide-intro');
  const title = node('h3', '', guide.title);
  title.id = 'entry-guide-title';
  intro.append(title, node('p', '', guide.description));
  const steps = node('ol', 'entry-guide-steps');
  guide.steps.forEach((text) => steps.append(node('li', '', text)));
  const picks = node('div', 'entry-picks');
  picks.append(node('span', '', '推荐起点'));
  for (const id of guide.entries) {
    const entry = catalog.entries.find((item) => item.id === id);
    const button = node('button', '', `${entry.name} ↘`);
    button.type = 'button';
    button.dataset.entryPick = id;
    button.addEventListener('click', () => {
      category = 'all';
      $('#entry-language').value = 'all';
      $('#entry-find').value = '';
      selectEntry(id);
      $('#entry-detail').scrollIntoView({ block: 'start', behavior: 'auto' });
      $('#entry-detail').focus({ preventScroll: true });
      setStatus(`已选择 ${entry.name}。先看这次要关注什么，也可以直接打开网站浏览。`);
    });
    picks.append(button);
  }
  const output = node('p', 'entry-guide-output', guide.output);
  $('#entry-guide').replaceChildren(intro, steps, picks, output);
}
function selectIntent(next) {
  intent = next;
  category = 'all';
  selected = intents[intent].entries[0];
  $('#entry-language').value = 'all';
  $('#entry-find').value = '';
  $('#entry-search-controls').open = intent !== 'explore';
  renderGuide();
  render();
  setStatus(`已切换到「${document.querySelector(`[data-entry-intent="${intent}"] strong`).textContent}」。已填的任务词和采集计划保持不变；10 个入口仍可筛选。`);
}
function queriesFor(entry) {
  const definitions = [...entry.queries];
  if (intent === 'projects' && ['github', 'hacker-news'].includes(entry.id)) definitions.unshift(definitions.pop());
  const task = tasks[entry.language];
  const term = intent === 'products' && task && !/\bAI\b/i.test(task) ? `AI ${task}` : task;
  return definitions.map((definition) => ({ label: definition.label, query: definition.template.replaceAll('{task}', term) }));
}
function visibleEntries() {
  const language = $('#entry-language').value;
  const term = $('#entry-find').value.trim().toLocaleLowerCase();
  return catalog.entries.filter((entry) => (category === 'all' || entry.categories.includes(category))
    && (language === 'all' || language === entry.language)
    && `${entry.name} ${entry.tagline} ${entry.suitable} ${entry.signals.join(' ')}`.toLocaleLowerCase().includes(term));
}
function resetFilters() {
  category = 'all';
  $('#entry-language').value = 'all';
  $('#entry-find').value = '';
  render();
  $('#entry-find').focus();
}
function render() {
  if (!catalog) return;
  const entries = visibleEntries();
  if (!entries.some((entry) => entry.id === selected)) selected = entries[0]?.id;
  for (const button of document.querySelectorAll('[data-entry-category]')) {
    button.setAttribute('aria-pressed', String(button.dataset.entryCategory === category));
  }
  $('#entry-count').textContent = `显示 ${entries.length} / ${catalog.entries.length} 个入口`;
  const list = $('#entry-list');
  list.replaceChildren();
  for (const entry of entries) {
    const button = node('button', 'entry-source');
    button.type = 'button';
    button.id = `entry-tab-${entry.id}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(selected === entry.id));
    button.setAttribute('aria-controls', 'entry-detail');
    button.tabIndex = selected === entry.id ? 0 : -1;
    const mark = node('span', 'entry-monogram', entry.mark);
    mark.setAttribute('aria-hidden', 'true');
    const label = node('span');
    label.append(node('strong', '', entry.name), node('small', '', entry.tagline));
    button.append(mark, label);
    button.addEventListener('click', () => selectEntry(entry.id));
    button.addEventListener('keydown', (event) => {
      const index = entries.findIndex((item) => item.id === entry.id);
      let next;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % entries.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + entries.length) % entries.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = entries.length - 1;
      if (next !== undefined) { event.preventDefault(); selectEntry(entries[next].id); }
    });
    list.append(button);
  }
  if (entries.length) renderDetail(entries.find((entry) => entry.id === selected));
  else {
    const empty = node('div', 'entry-empty');
    empty.append(node('h3', '', '这个组合暂时没有入口'), node('p', '', '可以放宽研究目的、语言或网站关键词。'));
    const reset = node('button', 'button button-outline', '清除入口筛选');
    reset.type = 'button';
    reset.addEventListener('click', resetFilters);
    empty.append(reset);
    $('#entry-detail').removeAttribute('aria-labelledby');
    $('#entry-detail').replaceChildren(empty);
  }
}
function selectEntry(id) {
  selected = id;
  render();
  $(`#entry-tab-${id}`).focus({ preventScroll: true });
}
function block(title, text, className = '') {
  const section = node('section', `entry-block ${className}`);
  section.append(node('h4', '', title), node('p', '', text));
  return section;
}
function renderDetail(entry) {
  const panel = $('#entry-detail');
  panel.setAttribute('aria-labelledby', `entry-tab-${entry.id}`);
  const top = node('div', 'entry-detail-top');
  const intro = node('div');
  const badges = node('div', 'entry-badges');
  for (const kind of entry.categories) badges.append(node('span', '', categoryNames[kind]));
  badges.append(node('span', '', entry.language === 'zh' ? '中文为主' : '英文为主'));
  intro.append(badges, node('h3', '', entry.name), node('p', '', entry.tagline));
  top.append(intro, externalLink(`${entry.entryLabel} ↗`, entry.entryUrl, 'entry-home'));
  const suitable = block('适合找什么', entry.suitable);
  const signals = node('div', 'entry-signals');
  entry.signals.forEach((signal) => signals.append(node('span', '', signal)));
  suitable.append(signals);
  const method = block('怎么搜索', entry.method);
  const purpose = block('这次先关注什么', intents[intent].output, 'entry-purpose');
  const queryBlock = node('section', 'entry-block');
  const searchTitle = node('div', 'entry-search-heading');
  const task = tasks[entry.language];
  const engine = $('#entry-engine').value === 'google' ? 'Google' : 'Bing';
  searchTitle.append(node('h4', '', '可直接使用的检索式'), node('span', '', `${engine} · 新标签打开`));
  queryBlock.append(searchTitle);
  if (!task) {
    queryBlock.append(node('p', '', `还没有${entry.language === 'en' ? '英文' : '中文'}任务词？先用右上方入口浏览，遇到一个具体任务后再搜索。`));
    const begin = node('button', 'text-button entry-add-keyword', `填写${entry.language === 'en' ? '英文' : '中文'}任务词 ↗`);
    begin.type = 'button';
    begin.addEventListener('click', () => openSearch(entry.language));
    queryBlock.append(begin);
  }
  for (const definition of task ? queriesFor(entry) : []) {
    const query = definition.query;
    const row = node('div', 'entry-query');
    const heading = node('div', 'entry-query-top');
    const actions = node('div', 'entry-query-actions');
    const searchURL = new URL($('#entry-engine').value === 'google' ? 'https://www.google.com/search' : 'https://www.bing.com/search');
    searchURL.searchParams.set('q', query);
    const link = externalLink('打开搜索 ↗', searchURL.href);
    link.setAttribute('aria-label', `打开${entry.name}搜索：${definition.label}`);
    if (!task) { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
    const code = node('code', '', query);
    const copy = node('button', '', '复制');
    copy.type = 'button';
    copy.disabled = !task;
    copy.setAttribute('aria-label', `复制${entry.name}检索式：${definition.label}`);
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(query);
        setStatus(`已复制「${entry.name} · ${definition.label}」检索式，可粘贴到搜索引擎。`);
      } catch {
        const range = document.createRange();
        range.selectNodeContents(code);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        setStatus('未能自动复制，检索式已选中，请手动复制。');
      }
    });
    actions.append(link, copy);
    heading.append(node('span', '', definition.label), actions);
    row.append(heading, code);
    queryBlock.append(row);
  }
  const reading = block('读结果时，重点核对', entry.check, 'entry-reading');
  const access = node('details', 'entry-access');
  access.append(node('summary', '', `${entry.accessLabel} · 查看访问说明与依据`), node('p', '', entry.access));
  access.append(node('p', '', `核查日期 ${catalog.updatedAt}。用途和检索式为研究建议；本页没有自动搜索或采集这些网站。`));
  const references = node('div', 'entry-references');
  entry.references.forEach((ref) => references.append(externalLink(`${ref.label} ↗`, ref.url)));
  access.append(references);
  const bottom = node('div', 'entry-detail-bottom');
  const add = node('button', 'button button-outline', '加入采集计划 ↓');
  add.type = 'button';
  add.addEventListener('click', () => document.dispatchEvent(new CustomEvent('research-entry:add-plan', {
    detail: { name: entry.name, url: entry.entryUrl, task, audience: tasks.audience, query: task ? queriesFor(entry)[0].query : '先浏览公开列表，记录一个具体任务后再搜索', signal: entry.signals.join('、') },
  })));
  const saveFinding = node('button', 'button button-dark', '记录找到的发现');
  saveFinding.type = 'button';
  saveFinding.addEventListener('click', () => document.dispatchEvent(new CustomEvent('research-entry:save-finding', {
    detail: { kind: intent === 'products' ? 'ai' : intent === 'projects' || (intent === 'explore' && entry.id === 'github') ? 'github' : 'need', source: entry.name },
  })));
  const entryActions = node('div', 'entry-record-actions');
  entryActions.append(saveFinding, add);
  bottom.append(node('p', '', '找到具体内容后，粘贴链接保存发现；准备开始搜索时，可先把入口加入计划。'), entryActions);
  panel.replaceChildren(top, purpose, suitable, method, queryBlock, reading, access, bottom);
}
function applyTasks() {
  const clean = (value) => value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  tasks = { zh: clean($('#entry-task-zh').value), en: clean($('#entry-task-en').value), audience: clean($('#entry-audience').value) };
  render();
  setStatus(tasks.zh || tasks.en ? '已按当前中英文任务词更新检索式。选择入口后，打开搜索并回到原文核实。' : '可以先浏览入口；找到具体任务后，再回来填写关键词。浏览入口也能加入采集计划。');
}
$('#entry-task-form').addEventListener('submit', (event) => { event.preventDefault(); applyTasks(); });
for (const id of ['entry-task-zh', 'entry-task-en', 'entry-audience']) {
  $(`#${id}`).addEventListener('input', () => setStatus('任务词已修改，点击「更新检索式」应用到各入口。'));
}
$('#entry-engine').addEventListener('change', () => { render(); setStatus(`已切换到 ${$('#entry-engine').selectedOptions[0].textContent}，搜索词保持为上次更新的内容。`); });
$('#entry-language').addEventListener('change', render);
$('#entry-find').addEventListener('input', render);
for (const button of document.querySelectorAll('[data-entry-category]')) {
  button.addEventListener('click', () => { category = button.dataset.entryCategory; render(); });
}
for (const button of document.querySelectorAll('[data-entry-preset]')) {
  button.addEventListener('click', () => {
    const preset = presets[button.dataset.entryPreset];
    $('#entry-task-zh').value = preset.zh;
    $('#entry-task-en').value = preset.en;
    $('#entry-audience').value = preset.audience;
    applyTasks();
  });
}
for (const button of document.querySelectorAll('[data-entry-intent]')) {
  button.addEventListener('click', () => { if (catalog) selectIntent(button.dataset.entryIntent); });
}
try {
  const response = await fetch('./data/research-entries.json');
  if (!response.ok) throw new Error('入口清单加载失败');
  catalog = await response.json();
  renderGuide();
  render();
} catch {
  $('#entry-guide').replaceChildren(node('p', '', '开始引导暂未加载，可先阅读下方完整说明中的网站与搜索方法。'));
  $('#entry-count').textContent = '入口清单暂未加载成功';
  const fallback = node('p', 'entry-empty', '请刷新页面，或直接阅读 ');
  const link = node('a', '', '研究入口完整说明');
  link.href = './notes/RESEARCH_ENTRIES.md';
  fallback.append(link);
  $('#entry-detail').replaceChildren(fallback);
  setStatus('网页数据未能加载。完整说明中保留了各个入口、搜索方式和引用来源。');
}
