import { mergePlan, planFields as fieldNames } from './plan-merge.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const create = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
};
let toastTimer;
function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-visible'), 3200);
}

const steps = [
  {
    title: '先选一群人，观察一项任务。',
    description: '从具体角色和工作过程进入，暂时保留多种问题可能性。先找到这群人在哪里讨论工作。',
    example: '探索例子：自由职业设计师收集客户反馈。这个任务还需搜索取证，不能预设一定存在需求。',
    human: '选择能理解、能接触的人群，列出他的工作步骤与常用工具。',
    ai: '补充角色称呼、英文表达和相邻任务词，标明哪些只是探索假设。',
    output: '一个观察范围：人群、任务、语言、渠道与时间范围。',
    gate: '如果只找到产品介绍，就改用任务词和求助表达，再找实际使用者的讨论。',
  },
  {
    title: '搜任务，再搭配痛点和反例。',
    description: '同一任务要同时寻找求助、手工补救、替代品和已经解决的讨论。搜索范围会影响你能看到什么。',
    example: 'client feedback + looking for / manual / workaround；同时搜索 solved 与现有工具名。',
    human: '检查结果是否属于目标角色，记录使用过的关键词、渠道和未找到的内容。',
    ai: '扩展同义词、口语表达和中英文检索式，覆盖几个不同工作场景。',
    output: '一份搜索词表与检索记录，包含正向线索和反例入口。',
    gate: '若只出现文件转换问题，检查是否被 PDF、CSV 等检索词限定；换人群或任务继续探索。',
  },
  {
    title: '抓取内容时，先保留上下文。',
    description: '搜索结果用于定位。进入正文、评论和后续回复，记录任务经过与当前状态。',
    example: 'R07 提供 CSV 格式不匹配线索；已有社区建议，最终成效仍未确认。',
    human: '确认作者在说自己的经历，保存定位与时间；读取失败或只有摘要时如实记录。',
    ai: '在可访问的内容内辅助定位相关段落、翻译和整理。批量读取依赖实际可用的数据接口。',
    output: '可回溯的原始记录：链接、作者或评论定位、日期、采集时间、原话与读取条件。',
    gate: '先用小样本确认能收集到有用信息。需要持续采集时，再逐站确认接口和更新机制。',
    record: 'R07',
  },
  {
    title: '从原话中，提取任务和障碍。',
    description: '一条记录分清“对方实际说了什么”和“我们怎样解释”。AI 的每个判断都应能回到具体片段。',
    example: '“很麻烦”需要上下文：谁在什么情况下，哪一步反复失败，现在怎样补救？',
    human: '抽查原文，确认人群、任务、障碍、频率、代价与替代办法是否有依据。',
    ai: '按统一字段整理内容，为关键判断附原话片段；未出现的频率、金额、耗时填未知。',
    output: '结构化线索：场景、任务、卡点、当前办法、原话证据、已知事实与待核实项。',
    gate: '只有泛泛感受时补上下文；有明确任务和处理经过时，再进入同类问题的比较。',
  },
  {
    title: '去重，并把相似问题放在一起。',
    description: '先按来源去重，再按“同类人群 + 同一任务 + 相似障碍”归类。表面词语相似，未必是同一需求。',
    example: '批量图片托管与 SKU 匹配相关，但属于不同步骤；一个通用“格式转换”标签会掩盖这种差异。',
    human: '复查合并和排除的样本，保留推广、历史缺陷、已解决问题等排除理由。',
    ai: '提出分组和重复项建议，分别列出来源数量、独立作者与反例，供人复核。',
    output: '一张问题分组表，包含独立来源、共同任务、关键差异与证据缺口。',
    gate: '同一作者的转发不算多人重复；同一 App 评论页上的不同评论，需要靠作者和日期区分。',
  },
  {
    title: '筛出候选，带着缺口继续核实。',
    description: '优先追问具体任务、已经发生的代价和仍未解决的缺口。公开线索只支持形成候选。',
    example: 'CSV 候选下一步：取得脱敏样本，确认导入卡点、出现频率，以及现有应用是否已解决。',
    human: '回看最新状态，邀请使用者讲最近一次经历，确认问题今天是否仍成立。',
    ai: '比较证据强弱、整理反例和访谈问题，帮助安排下一轮搜索。',
    output: '需求候选清单：支持证据、反例、未知项、可接触的人群与下一步核实动作。',
    gate: '有任务、有代价、有可核实对象时继续追；资料不足就补采，问题已经解决则记录后暂缓。',
  },
];

function bindTabs(buttons, activate) {
  const select = (button, focus = false) => {
    for (const item of buttons) {
      const active = item === button;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    activate(button);
    if (focus) button.focus();
  };
  for (const button of buttons) {
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', (event) => {
      const index = buttons.indexOf(button);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        select(buttons[next], true);
      }
    });
  }
  select(buttons.find((button) => button.getAttribute('aria-selected') === 'true') || buttons[0]);
}

bindTabs($$('[data-step]'), (button) => {
  const index = Number(button.dataset.step);
  const step = steps[index];
  const panel = $('#step-panel');
  panel.setAttribute('aria-labelledby', button.id);
  const intro = create('div', 'step-intro');
  intro.append(create('span', 'step-number', `0${index + 1} / 06`), create('h3', '', step.title), create('p', '', step.description));
  const example = create('div', 'step-example');
  example.append(create('span', 'small-label', '一个观察例子'), create('p', '', step.example));
  if (step.record) {
    const open = create('button', 'text-button', '查看这条原始线索 ↗');
    open.type = 'button';
    open.dataset.openRecord = step.record;
    example.append(open);
  }
  intro.append(example);
  const details = create('dl', 'step-detail');
  for (const [label, key, symbol] of [['人做什么', 'human', '↗'], ['AI 帮什么', 'ai', '✳'], ['留下什么', 'output', '▤'], ['怎样决定下一步', 'gate', '→']]) {
    const item = create('div', 'step-detail-item');
    const title = create('dt');
    const icon = create('span', '', symbol);
    icon.setAttribute('aria-hidden', 'true');
    title.append(icon, document.createTextNode(label));
    item.append(title, create('dd', '', step[key]));
    details.append(item);
  }
  panel.replaceChildren(intro, details);
});

let records = [];
let channel = 'all';
let visibleLimit = 6;
const search = $('#source-search');
const grid = $('#evidence-grid');
const more = $('#load-more');
const preferred = ['R07', 'A04', 'U02', 'R01', 'A06', 'U06'];

function budgetText(record) {
  if (!record.budget) return '';
  if (record.budget.amount === null) return '时薪未取得；未确认成交';
  return `发布预算 US$${record.budget.amount.toLocaleString('en-US')}；未确认成交`;
}

function renderSources() {
  const term = search.value.trim().toLocaleLowerCase();
  const filtered = records.filter((record) => (channel === 'all' || record.channel === channel) &&
    [record.problem, record.platform, record.app, record.locator, record.cluster, record.limitation].filter(Boolean).join(' ').toLocaleLowerCase().includes(term));
  $('#results-count').textContent = `匹配 ${filtered.length} / ${records.length} 条 · 已展示 ${Math.min(visibleLimit, filtered.length)} 条`;
  const cards = filtered.slice(0, visibleLimit).map((record) => {
    const card = create('article', 'evidence-card');
    const top = create('div', 'evidence-card-top');
    top.append(create('span', 'channel-label', record.channel), create('span', 'record-date', record.published_date || '日期待确认'));
    const meta = create('p', 'card-meta', `${record.platform}${record.app ? ` · ${record.app}` : ''}`);
    meta.title = `${record.platform} · ${record.locator}`;
    const limit = create('p', 'card-limit');
    limit.append(create('span', '', '判断边界'), document.createTextNode(record.limitation));
    card.append(top, create('h3', '', record.problem), meta, limit);
    if (record.budget) card.append(create('p', 'budget-note', budgetText(record)));
    const bottom = create('div', 'evidence-card-bottom');
    const tag = create('span', `cluster-tag${record.cluster === '暂缓' ? ' is-hold' : ''}`, record.cluster);
    const open = create('button', 'card-detail', '查看来源 ↗');
    open.type = 'button';
    open.dataset.openRecord = record.id;
    open.setAttribute('aria-label', `查看来源：${record.problem}`);
    bottom.append(tag, open);
    card.append(bottom);
    return card;
  });
  if (!cards.length) {
    const empty = create('div', 'empty-state');
    const reset = create('button', 'text-button', '清除筛选');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      search.value = '';
      setChannel('all');
      search.focus();
    });
    empty.append(create('p', '', '没有匹配的线索，试试其他关键词。'), reset);
    cards.push(empty);
  }
  grid.replaceChildren(...cards);
  more.hidden = visibleLimit >= filtered.length;
}

function setChannel(value) {
  channel = value;
  visibleLimit = 6;
  for (const button of $$('[data-channel]')) {
    const active = button.dataset.channel === channel;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  renderSources();
}
for (const button of $$('[data-channel]')) button.addEventListener('click', () => setChannel(button.dataset.channel));
search.addEventListener('input', () => { visibleLimit = 6; renderSources(); });
more.addEventListener('click', () => {
  const previousCount = grid.children.length;
  visibleLimit += 6;
  renderSources();
  grid.children[previousCount]?.querySelector('button')?.focus({ preventScroll: true });
});

async function loadSources() {
  try {
    const response = await fetch('./data/sources.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.records) || !data.records.length) throw new Error('来源数据为空');
    records = [...data.records].sort((a, b) => {
      const order = (record) => preferred.includes(record.id) ? preferred.indexOf(record.id) : preferred.length + data.records.findIndex((item) => item.id === record.id);
      return order(a) - order(b);
    });
    renderSources();
  } catch {
    $('#results-count').textContent = '来源清单暂时加载失败';
    const empty = create('div', 'empty-state');
    const retry = create('button', 'text-button', '重新加载');
    retry.type = 'button';
    retry.addEventListener('click', loadSources);
    const note = create('a', 'text-link', '阅读完整问题记录 ↗');
    note.href = './notes/DEMAND_RESEARCH.md';
    empty.append(create('p', '', '可以重新加载，或直接阅读已保存的研究记录。'), retry, document.createTextNode('　'), note);
    grid.replaceChildren(empty);
    more.hidden = true;
  }
}
loadSources();

const dialog = $('#source-dialog');
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-record]');
  if (!button) return;
  const record = records.find((item) => item.id === button.dataset.openRecord);
  if (!record) { toast('来源还未加载，请稍后重试或阅读完整研究记录。'); return; }
  $('#dialog-channel').textContent = `${record.channel} · ${record.id}`;
  $('#dialog-title').textContent = record.problem;
  $('#dialog-locator').textContent = `${record.platform}${record.app ? ` · ${record.app}` : ''} / ${record.locator}`;
  const details = [
    ['原始日期', `${record.published_date || '绝对日期待确认'}；${record.date_basis}`],
    ['读取情况', record.access],
    ['本轮判断', record.limitation],
    ['研究归类', `${record.cluster}；需求与付费意愿待进一步验证`],
  ];
  if (record.budget) details.push(['预算信号', `${budgetText(record)}。任务外包预算不能直接当作软件订阅价格。`]);
  $('#dialog-details').replaceChildren(...details.map(([title, value]) => {
    const row = create('div');
    row.append(create('dt', '', title), create('dd', '', value));
    return row;
  }));
  const link = $('#dialog-original');
  const url = new URL(record.url);
  if (url.protocol !== 'https:') return;
  link.href = url.href;
  dialog.showModal();
});
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});

const form = $('#needs-form');
const storageKey = 'research-004-demand-collection-v2';
let activePrompt = 'discover';
let storageAvailable = true;
const captions = {
  discover: '扩展任务词与求助表达，同时搜索已解决的反例。',
  verify: '对提供的原文逐条提取，每个关键判断附证据片段。',
  deliver: '先按来源去重，再按人群和任务归类，筛出待核实候选。',
};
function readCard(trim = true) {
  return Object.fromEntries(fieldNames.map((name) => {
    const value = form.elements.namedItem(name).value;
    return [name, trim ? value.trim() : value];
  }));
}
function mergeIntoCard(additions) {
  const limits = Object.fromEntries(fieldNames.map((name) => [name, form.elements.namedItem(name).maxLength]));
  const result = mergePlan(readCard(false), additions, limits);
  if (result.changed) {
    for (const name of fieldNames) form.elements.namedItem(name).value = result.values[name];
    saveCard();
    generatePrompt();
  }
  return result;
}
function saveCard() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(readCard(false)));
    storageAvailable = true;
    $('#save-status').textContent = '已保存在此浏览器';
  } catch {
    storageAvailable = false;
    $('#save-status').textContent = '浏览器存储不可用，可复制右侧指令保留';
  }
}
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && typeof saved === 'object') {
    for (const name of fieldNames) {
      const field = form.elements.namedItem(name);
      if (typeof saved[name] === 'string') field.value = saved[name].slice(0, field.maxLength);
    }
    $('#save-status').textContent = '已恢复此浏览器保存的采集计划';
  }
} catch {
  storageAvailable = false;
  $('#save-status').textContent = '浏览器存储不可用，可复制指令保留';
}

function generatePrompt() {
  const data = readCard();
  const context = [
    `观察人群：${data.audience || '待填写具体角色'}`,
    `观察任务：${data.task || '待填写具体工作任务'}`,
    `已知工具与替代办法：${data.current || '待探索，不能预设现有工具不够用'}`,
    `要寻找的信号：${data.signals || '求助、反复手工、返工、寻找替代工具与外包行为'}`,
    `采集范围或已有来源：\n${data.sources || '待确定渠道、语言、时间范围与原始来源'}`,
    `这一轮要核实：${data.nextQuestion || '同一任务是否重复出现障碍，现有办法是否已经解决'}`,
  ].join('\n');
  const prompts = {
    discover: `请作为需求发现助手，为以下范围制定并执行你有能力执行的搜索计划。\n\n${context}\n\n请按顺序进行：\n1. 列出角色称呼、任务动词、常用工具、英文口语与中文同义词。用任务词分别搭配求助、手工补救、耗时、寻找替代品和已解决的表达。\n2. 优先使用采集范围中已选的网站与检索式。尚未选定来源时，从社区求助、产品反馈、付费任务中选适合目标人群的渠道；产品发现渠道用于比较已有方案。先读具体任务和讨论，再按证据缺口扩展搜索。\n3. 如果能联网，在实际可访问范围读取原文与后续。逐条记录原始链接、作者或评论定位、发布日期、采集时间、关键原话、任务经过和读取状态；搜索摘要标记为摘要，日期未知就填未知。\n4. 如果不能联网，明确说明，只输出搜索词与采集计划。不要编造帖子、评论、作者、日期、预算或“已抓取”结果。\n5. 汇总本轮用过的查询、渠道、结果类型和遗漏，建议下一轮如何扩展或收窄观察范围。\n\n最终交付可回溯的线索台账和证据缺口。产品推广与使用者求助分别标记，保留已解决的反例。`,
    verify: `请对我接下来提供的原文或可读取链接提取需求线索。\n\n${context}\n\n请使用同一字段结构逐条整理：\n来源 URL / 帖子或评论 ID / 作者或定位 / 发布时间 / 采集时间 / 读取情况 / 关键原话 / 人群 / 触发场景 / 要完成的任务 / 具体障碍 / 当前办法 / 频率 / 耗时或损失 / 已有解决建议 / 后续状态 / 证据缺口。\n\n处理要求：\n1. 原文与我们的解释分列，每个重要判断附对应原话片段或具体定位。只取足以支持判断的短片段。\n2. 未明确说明的频率、耗时、预算、成交与付费意愿填未知。外包发布预算单列。\n3. 保留后续已经解决、开发者已回应、当前版本已变化等信息。\n4. 无法打开链接时标记不可读取；可以请我提供原文，不把搜索摘要当完整正文。\n5. 原文未提供前，先给空的记录模板与缺失材料清单；不要补写任何用户经历。\n\n输出表格或 JSON，并列出需要人工回读检查的记录。`,
    deliver: `请对我提供的结构化线索进行去重、归类和候选筛选。\n\n${context}\n\n请按顺序输出：\n1. 先按来源 ID 与具体记录定位识别重复。不同评论可能共用同一 App 页面，不能只按页面 URL 全部合并；同一作者的转发不视为多人证据。\n2. 按“人群 + 任务 + 障碍”提出分组，保留关键差异。表面都涉及表格或文档，不代表同一个需求。\n3. 对每组列出独立来源、独立使用者、证据片段、当前办法、实际代价、最新状态和反例。没有原文支持的数量或判断填未知。\n4. 分为优先核实、继续补采、暂缓三种，并说明依据。推广内容、模糊感受、历史已解决记录保留排除理由，供人工复查。\n5. 为每个候选写一个需求陈述：“某类人在某场景需要完成某任务，但因某障碍，只能用某办法应对”；缺失部分明确标注。\n6. 写下下一轮具体核实动作：补哪类来源、回看哪条后续、找谁讲最近一次经历。发布预算和点赞不能直接当作产品付费意愿。\n\n线索未提供前只给分析框架。输出的是待核实的问题候选，不声称市场需求已经成立。`,
  };
  $('#prompt-output').value = prompts[activePrompt];
  $('#prompt-caption').textContent = captions[activePrompt];
  $('#prompt-feedback').textContent = '';
}
bindTabs($$('[data-prompt]'), (button) => {
  activePrompt = button.dataset.prompt;
  $('#prompt-panel').setAttribute('aria-labelledby', button.id);
  generatePrompt();
});
form.addEventListener('input', () => { saveCard(); generatePrompt(); });
form.addEventListener('submit', (event) => {
  event.preventDefault();
  saveCard();
  generatePrompt();
  $('#prompt-feedback').textContent = `已按当前范围生成指令${storageAvailable ? '，计划已保存在此浏览器' : ''}。可切换类型后复制使用。`;
  toast('采集指令已更新。');
});
$('#load-example').addEventListener('click', () => {
  const example = {
    audience: '需要把供应商商品批量上架到 Shopify 的小商家',
    task: '将供应商提供的 CSV 整理成符合目标导入要求的商品文件，并定位导入错误。',
    current: '已知 R07 社区建议 AI、Airtable 和现有应用；实际效果需要回看后续。',
    signals: '寻找导入报错、字段映射困难、重复手工与寻找替代办法的经历；同时记录已经成功解决的案例。',
    sources: '已有线索 R07：https://www.reddit.com/r/shopify/comments/1ui6dic/csv_conversion/\n扩展范围：其他商家求助、相关应用评论与外包任务，区分近期和历史记录。',
    nextQuestion: '相同任务是否在多个独立来源反复出现？哪一步卡住？现有建议是否已解决？',
  };
  const result = mergeIntoCard(example);
  const message = result.sourceStatus === 'full'
    ? '来源栏字数已满，示例尚未加入；请先整理采集范围，原有计划已保留。'
    : result.changed
      ? '已用 R07 示例补充空白字段并保留示例来源，原有计划内容已保留。请确认示例与自己的研究范围是否相关。'
      : '示例来源已在计划中，已有字段保持原样。';
  $('#prompt-feedback').textContent = message;
  toast(message);
});
$('#copy-prompt').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#prompt-output').value);
    $('#prompt-feedback').textContent = '已复制采集指令，可粘贴到你使用的 AI 工具。';
    toast('采集指令已复制。');
  } catch {
    $('#prompt-output').focus();
    $('#prompt-output').select();
    $('#prompt-feedback').textContent = '浏览器未允许自动复制，指令已选中，请按 Ctrl+C（Mac 使用 ⌘C）。';
  }
});

document.addEventListener('research-entry:add-plan', (event) => {
  const entry = event.detail;
  const sourceField = form.elements.namedItem('sources');
  const sourceLine = `${entry.name}：${entry.url}\n检索：${entry.query}\n关注：${entry.signal}`;
  const result = mergeIntoCard({ sources: sourceLine, task: entry.task, audience: entry.audience });
  const status = $('#entry-status');
  if (result.sourceStatus === 'full') {
    status.textContent = '计划中的来源已接近字数上限，请先整理下方采集范围，再添加入口。原有计划已保留。';
    return;
  }
  status.textContent = result.changed
    ? `已将 ${entry.name} 加入采集范围，原有计划内容已保留。`
    : '这个入口与检索式已经在计划中，无需重复添加。';
  $('#prompt-feedback').textContent = status.textContent;
  location.hash = 'canvas';
  sourceField.focus({ preventScroll: true });
});

document.addEventListener('research-finding:add-plan', (event) => {
  const finding = event.detail;
  const result = mergeIntoCard({
    sources: `已保存的发现：${finding.title}\n${finding.url}`,
    task: finding.title,
    nextQuestion: finding.nextStep.length > 300 ? `${finding.nextStep.slice(0, 299)}…` : finding.nextStep,
  });
  const message = result.sourceStatus === 'full'
    ? '计划的来源栏空间不足，请先整理采集范围。发现和原计划均已保留。'
    : result.changed ? '已将发现带入采集计划，只补空字段，已有内容已保留。' : '这条发现已在计划中，已有内容保持原样。';
  $('#findings-feedback').textContent = message;
  if (result.sourceStatus === 'full') return;
  $('#prompt-feedback').textContent = message;
  location.hash = 'canvas';
  form.elements.namedItem('sources').focus({ preventScroll: true });
});

function revealHashTarget(hash, scrollAfterOpening = false) {
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
  const legacy = id === 'radar';
  if (legacy) id = 'directory';
  const target = document.getElementById(id);
  if (!target) return;
  let opened = false;
  for (let details = target.closest('details'); details; details = details.parentElement?.closest('details')) {
    if (!details.open) { details.open = true; opened = true; }
  }
  if (legacy) history.replaceState(null, '', `${location.pathname}${location.search}#directory`);
  if (scrollAfterOpening && (opened || legacy)) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const hash = link.getAttribute('href');
  if (hash === '#radar') {
    event.preventDefault();
    location.hash = 'directory';
    document.getElementById('directory')?.scrollIntoView({ block: 'start' });
    return;
  }
  revealHashTarget(hash);
});
window.addEventListener('hashchange', () => revealHashTarget(location.hash, true));
revealHashTarget(location.hash, true);

if ('IntersectionObserver' in window) {
  const navLinks = $$('.site-header nav a');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        for (const link of navLinks) if (link.hash === `#${entry.target.id}`) link.removeAttribute('aria-current');
        continue;
      }
      for (const link of navLinks) {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
  for (const id of ['research', 'directory', 'discoveries', 'canvas', 'reddit', 'workflow']) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}
