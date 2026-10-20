import { capabilities, stages, scenarios, changes, evidence, source, code } from './data.js';
import { initKeywordLab } from './keyword-lab.js';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const esc = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const refs = (ids) => `<div class="ref-links">${ids.map(id => {
  const item = source(id);
  return `<a href="${code(item.file)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ↗</a>`;
}).join('')}</div>`;

$$('[data-source]').forEach(anchor => {
  const item = source(anchor.dataset.source);
  anchor.href = code(item.file);
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.title = item.file + ' · 固定版本 77cfe1c';
});

let capFilter = 'all';
let capId = 'x';
function renderCapabilities(focus = false) {
  const list = capabilities.filter(item => capFilter === 'all' || item.category === capFilter);
  if (!list.some(item => item.id === capId)) capId = list[0].id;
  $('#cap-list').innerHTML = list.map(item => `<button class="cap-item ${item.id === capId ? 'active' : ''}" id="cap-tab-${item.id}" role="tab" aria-controls="cap-detail" aria-selected="${item.id === capId}" tabindex="${item.id === capId ? 0 : -1}" data-cap="${item.id}"><span>${esc(item.label)}<small>${esc(item.title)}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('');
  const item = list.find(item => item.id === capId);
  $('#cap-detail').setAttribute('aria-labelledby', 'cap-tab-' + item.id);
  $('#cap-detail').innerHTML = `<p class="cap-type">${esc(item.label)}</p><span class="tag">源码有实现 · 运行效果待验证</span><h3>${esc(item.title)}</h3><p class="desc">${esc(item.desc)}</p><div class="io-grid"><div><span>INPUT / 输入</span><p>${esc(item.input)}</p></div><div><span>OUTPUT / 输出</span><p>${esc(item.output)}</p></div></div><h4>能力边界</h4><p class="detail-text">${esc(item.boundary)}</p><h4>通用化时怎样处理</h4><p class="detail-text">${esc(item.reuse)}</p>${refs(item.refs)}`;
  if (focus) $(`#cap-tab-${capId}`).focus({ preventScroll: true });
}
$('#cap-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  capFilter = button.dataset.filter;
  $$('#cap-filters button').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', item === button);
  });
  renderCapabilities();
});
$('#cap-list').addEventListener('click', event => {
  const button = event.target.closest('[data-cap]');
  if (!button) return;
  capId = button.dataset.cap; renderCapabilities(true);
});

let stageIndex = 0;
function renderPipeline(focus = false) {
  $('#pipeline-steps').innerHTML = stages.map((item, index) => `<button class="pipeline-step ${index === stageIndex ? 'active' : ''}" id="stage-tab-${index}" role="tab" aria-selected="${index === stageIndex}" aria-controls="pipeline-detail" tabindex="${index === stageIndex ? 0 : -1}" data-stage="${index}"><span>${String(index + 1).padStart(2, '0')} / ${esc(item.tag)}</span><strong>${esc(item.title)}</strong><small>${esc(item.short)}</small></button>`).join('');
  const item = stages[stageIndex];
  $('#pipeline-detail').setAttribute('aria-labelledby', 'stage-tab-' + stageIndex);
  $('#pipeline-detail').innerHTML = `<div><span class="pipeline-number">STEP ${String(stageIndex + 1).padStart(2, '0')} / 08</span><h3>${esc(item.title)}</h3><div class="flow-field"><span>INPUT / 输入</span><p>${esc(item.input)}</p></div><div class="flow-field"><span>OUTPUT / 输出</span><p>${esc(item.output)}</p></div></div><div><p class="pipeline-action">${esc(item.action)}</p><p class="pipeline-warning">需要留意：${esc(item.note)}</p>${refs(item.refs)}</div>`;
  if (focus) $(`#stage-tab-${stageIndex}`).focus({ preventScroll: true });
}
$('#pipeline-steps').addEventListener('click', event => {
  const button = event.target.closest('[data-stage]');
  if (!button) return;
  stageIndex = Number(button.dataset.stage); renderPipeline(true);
});

function arrowTabs(container, change) {
  container.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const tabs = $$('[role="tab"]', container);
    const current = tabs.findIndex(item => item === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    let next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
    change(tabs[next]);
  });
}
arrowTabs($('#cap-list'), button => { capId = button.dataset.cap; renderCapabilities(true); });
arrowTabs($('#pipeline-steps'), button => { stageIndex = Number(button.dataset.stage); renderPipeline(true); });

const gallery = {
  home: { src: './media/upstream-home.png', alt: '上游文档中的 CrawlHive 首页，包含代币扫描和功能入口', caption: '上游文档截图 · 扫描是低门槛入口，持续监控是进一步使用路径。' },
  spec: { src: './media/upstream-spec.png', alt: '上游文档中的监控任务规则编辑界面，包含关键词、过滤与结果目标', caption: '上游文档截图 · 用户将关注点写成任务规则；其中多项过滤仍与币圈绑定。' },
  xray: { src: './media/upstream-xray.png', alt: '上游文档中的 Contract X-Ray 风险因素与合约检查界面', caption: '上游文档截图 · 合约检查是领域专用分析，通用版需要替换其判断标准。' }
};
$('#gallery-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-image]');
  if (!button) return;
  const item = gallery[button.dataset.image];
  $('#original-image').src = item.src;
  $('#original-image').alt = item.alt;
  $('#original-caption').textContent = item.caption;
  $$('#gallery-tabs button').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', tab === button); });
});
$('#image-expand').addEventListener('click', () => {
  const image = $('#original-image');
  const full = $('#image-dialog img');
  full.src = image.src; full.alt = image.alt;
  $('#image-dialog').showModal();
});
$('.dialog-close').addEventListener('click', () => $('#image-dialog').close());
$('#image-dialog').addEventListener('click', event => { if (event.target === $('#image-dialog')) $('#image-dialog').close(); });

function calculateCost() {
  const tasks = Number($('#cost-tasks').value);
  const interval = Number($('#cost-interval').value);
  const raw = Number($('#cost-unit').value);
  const unit = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  const runs = tasks * 1440 / interval;
  $('#tasks-label').value = tasks;
  $('#interval-label').value = interval;
  $('#cost-runs').textContent = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(runs);
  $('#cost-total').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(runs * unit);
}
['#cost-tasks', '#cost-interval', '#cost-unit'].forEach(selector => $(selector).addEventListener('input', calculateCost));
$('#cost-unit').addEventListener('change', () => {
  const value = Number($('#cost-unit').value);
  $('#cost-unit').value = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  calculateCost();
});

const changeLabels = { keep: '保留', rewrite: '重写', remove: '移除', new: '新增' };
function renderChanges(filter = 'all') {
  $('#change-list').innerHTML = changes.filter(item => filter === 'all' || item.kind === filter).map(item => `<article class="change-item" data-kind="${item.kind}"><span class="change-badge">${changeLabels[item.kind]}</span><div><h3>${esc(item.title)}</h3><code>${esc(item.file)}</code><p>${esc(item.desc)}</p></div></article>`).join('');
}
$('#change-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-change]');
  if (!button) return;
  $$('#change-filters button').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', tab === button); });
  renderChanges(button.dataset.change);
});

let scenarioId = 'release';
let demoStep = 0;
const demoCopy = [
  ['先保留原始信息', '每个来源保留自己的编号、发布时间、采集时间和原文链接。此示例有 5 条虚构内容，尚未筛选；不要在采集时只保存模型摘要。', '先解决覆盖与可追溯', '真实产品需要分别实现来源鉴权、增量进度、错误恢复与原文保存。'],
  ['按用户关注点筛选', '用关键词、排除条件和可选模型判断相关性。此处使用预设规则，过滤 1 条无关内容，保留 4 条。没有调用真实模型。', '相关性与真假分开', '“符合关注点”只说明它值得阅读。消息真伪、来源身份和事实依据需要另外核实。'],
  ['把报道组织成事件', '4 条相关内容关联成 2 个事件。同一公告的官网文章和转发合并展示；另一项实质变化独立保留。', '同主题不等于同一事件', '多个平台转发同一公告也不构成多个独立证据。事件要保留来源关系；新日期、新状态或冲突说法应作为进展。'],
  ['交付有依据的新进展', '向用户展示 2 个事件摘要、来源构成与触发原因；真实系统还需检查是否已通知、静默时间和投递结果。此演示不会发送消息。', '提醒后的反馈闭环', '允许标记有用／无关、调整规则并回到原文。长期评估应同时观察无关提醒、重复、发现延迟与遗漏。']
];
function renderDemo() {
  const scenario = scenarios[scenarioId];
  $('#demo-rule').textContent = scenario.rule;
  $$('.demo-stepper button').forEach(button => { const active = Number(button.dataset.demoStep) === demoStep; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  if (demoStep < 2) {
    $('#demo-list-title').textContent = demoStep ? '相关性筛选' : '原始条目';
    $('#demo-count').textContent = demoStep ? '4 保留 / 1 过滤' : '5 ITEMS';
    $('#demo-items').innerHTML = scenario.items.map(item => `<article class="demo-item ${demoStep && !item.keep ? 'muted' : ''}"><span class="source-chip">${esc(item.from)}</span><div><h4>${esc(item.title)}</h4><small>${demoStep ? (item.keep ? '保留 · 符合预设规则' : '过滤 · 不符合关注规则') : '虚构条目 · 尚未处理'}</small></div></article>`).join('');
  } else {
    const grouped = new Map();
    scenario.items.filter(item => item.keep).forEach(item => { const group = grouped.get(item.event) || []; group.push(item); grouped.set(item.event, group); });
    $('#demo-list-title').textContent = demoStep === 2 ? '关联后的事件' : '待交付的事件卡片';
    $('#demo-count').textContent = '2 EVENTS';
    $('#demo-items').innerHTML = [...grouped].map(([name, items]) => `<article class="demo-item event-item"><span class="source-chip">${demoStep === 3 ? '提醒' : '事件'}</span><div><h4>${esc(name)}</h4><small>${esc(items[0].title)}</small><small>关联条目 ${items.length} 条 · ${items.map(item => esc(item.from)).join(' / ')}</small><small>${demoStep === 3 ? '触发原因：符合关注规则，且包含尚未通知的变化。' : '保留原文关系，不把转发当独立事实证明。'}</small></div></article>`).join('');
  }
  const copy = demoCopy[demoStep];
  $('#demo-step-label').textContent = `ILLUSTRATIVE / STEP 0${demoStep + 1}`;
  $('#demo-title').textContent = copy[0];
  $('#demo-description').textContent = copy[1];
  $('#demo-result').className = 'demo-result';
  $('#demo-result').innerHTML = `<strong>${esc(copy[2])}</strong><p>${esc(copy[3])}</p>`;
  $('#demo-next').textContent = demoStep === 3 ? '再走一遍 ↺' : '下一步 →';
}
$('#scenario-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-scenario]');
  if (!button) return;
  scenarioId = button.dataset.scenario; demoStep = 0;
  $$('#scenario-tabs button').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', tab === button); });
  renderDemo();
});
$('.demo-stepper').addEventListener('click', event => {
  const button = event.target.closest('[data-demo-step]');
  if (!button) return;
  demoStep = Number(button.dataset.demoStep); renderDemo();
});
$('#demo-next').addEventListener('click', () => { demoStep = (demoStep + 1) % 4; renderDemo(); });
$('#demo-reset').addEventListener('click', () => { demoStep = 0; renderDemo(); });

function renderSources(query = '') {
  const normalized = query.toLocaleLowerCase().trim();
  const items = evidence.filter(item => `${item.title} ${item.file} ${item.note} ${item.type}`.toLocaleLowerCase().includes(normalized));
  $('#source-count').textContent = `${items.length} / ${evidence.length}`;
  $('#source-list').innerHTML = items.length ? items.map(item => `<a class="source-card" href="${code(item.file)}" target="_blank" rel="noopener noreferrer"><header><h3>${esc(item.title)} ↗</h3><span class="tag ${item.type === '声明' ? 'amber' : ''}">${esc(item.type)}</span></header><code>${esc(item.file)}</code><p>${esc(item.note)}</p></a>`).join('') : '<p class="source-empty">没有匹配的证据。可以尝试模块名、平台名或“去重”“安全”等词。</p>';
}
$('#source-query').addEventListener('input', event => renderSources(event.target.value));

const menu = $('.menu-toggle');
function closeMenu() { document.body.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false'); }
menu.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  menu.setAttribute('aria-expanded', open);
});
$('#chapter-nav').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.addEventListener('click', event => { if (document.body.classList.contains('menu-open') && !event.target.closest('.sidebar,.menu-toggle')) closeMenu(); });

const chapters = $$('.chapter');
const navLinks = $$('#chapter-nav a');
let scheduled = false;
function updateReading() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  $('#progress').style.width = (total > 0 ? Math.min(100, window.scrollY / total * 100) : 0) + '%';
  let active = chapters[0];
  for (const chapter of chapters) { if (chapter.getBoundingClientRect().top <= 140) active = chapter; }
  navLinks.forEach(link => {
    const current = link.hash === '#' + active.id;
    link.classList.toggle('active', current);
    if (current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
  scheduled = false;
}
window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateReading); } }, { passive: true });
window.addEventListener('resize', updateReading);
renderCapabilities(); renderPipeline(); renderChanges(); renderDemo(); renderSources(); calculateCost(); initKeywordLab(); updateReading();
