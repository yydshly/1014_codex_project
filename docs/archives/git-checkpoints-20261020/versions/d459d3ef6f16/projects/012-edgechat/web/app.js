import { snapshot, sources, roles, features, nodes, journeys, bridges, suitability, productDirections, comparisonProducts } from './data.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const paths = {
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-4 3v-7.5A8.5 8.5 0 0 1 9.5 3h3a8.5 8.5 0 0 1 8.5 8.5Z"/><path d="M7 9h9M7 13h6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  phone: '<path d="m8 3 2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v4a2 2 0 0 1-2 2A19 19 0 0 1 2 5a2 2 0 0 1 2-2Z"/>',
  plane: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>',
  network: '<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="2" y="16" width="7" height="6" rx="1"/><rect x="15" y="16" width="7" height="6" rx="1"/><path d="M12 8v4M5.5 16v-4h13v4"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="m8 12 3 3 5-6"/>',
  device: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M8 21h8"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>',
  cloud: '<path d="M6 18a5 5 0 0 1-1-9.9A7 7 0 0 1 18.7 9 4.5 4.5 0 0 1 19 18Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  key: '<circle cx="8" cy="9" r="5"/><path d="m12 12 9 9m-5-5 3-3m-6 0 3-3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
  external: '<path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`; }
function paintIcons(root = document) { root.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = icon(element.dataset.icon); }); }
function sourceLink(id) {
  const source = sources[id];
  return `<a class="source-link" href="${source.url}" target="_blank" rel="noreferrer">${icon('external')} ${source.title}</a>`;
}
function list(items) { return `<ul class="check-list">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`; }

function tabs(containerId, items, selected, onSelect, panelId) {
  const container = $(`#${containerId}`);
  const buttons = Object.entries(items).map(([key, item]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `${containerId}-${key}`;
    button.dataset.key = key;
    button.textContent = item.label;
    button.setAttribute('role', 'tab');
    if (panelId) button.setAttribute('aria-controls', panelId);
    container.append(button);
    return button;
  });
  function select(key) {
    buttons.forEach((button) => {
      const active = button.dataset.key === key;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    if (panelId) $(`#${panelId}`).setAttribute('aria-labelledby', `${containerId}-${key}`);
    onSelect(key);
  }
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[role="tab"]');
    if (button) select(button.dataset.key);
  });
  container.addEventListener('keydown', (event) => {
    const vertical = container.getAttribute('aria-orientation') === 'vertical';
    const previousKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    if (![previousKey, nextKey, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === nextKey ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    select(buttons[next].dataset.key);
  });
  select(selected);
}

tabs('role-tabs', roles, 'member', (key) => {
  const role = roles[key];
  $('#role-panel').innerHTML = `<h3>${role.heading}</h3><p>${role.description}</p>${list(role.points)}${sourceLink(role.source)}`;
}, 'role-panel');

$('#feature-grid').innerHTML = features.map((feature) => `<article class="feature-card" data-category="${feature.category}"><div class="feature-top"><span class="feature-icon">${icon(feature.icon)}</span><span class="feature-status">${feature.status}</span></div><h3>${feature.title}<small>${feature.label}</small></h3><p>${feature.description}</p><details><summary>原理与边界<span aria-hidden="true">＋</span></summary><div class="feature-expanded"><p><b>如何实现</b>${feature.principle}</p><p><b>能力边界</b>${feature.boundary}</p><div class="source-links">${feature.sources.map(sourceLink).join('')}</div></div></details></article>`).join('');
$$('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  $$('[data-filter]').forEach((item) => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  let count = 0;
  $$('.feature-card').forEach((card) => { card.hidden = filter !== 'all' && card.dataset.category !== filter; if (!card.hidden) count++; });
  $('#feature-count').textContent = `显示 ${count} 项`;
}));

function selectNode(key) {
  const node = nodes[key];
  $$('[data-node]').forEach((button) => { const active = button.dataset.node === key; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  $('#node-detail').innerHTML = `<span class="node-type">${node.type} / ${node.label}</span><h3>${node.title}</h3><dl><dt>做什么</dt><dd>${node.job}</dd><dt>为什么存在</dt><dd>${node.why}</dd><dt>理解边界</dt><dd>${node.boundary}</dd></dl>${sourceLink(node.source)}`;
}
$$('[data-node]').forEach((button) => button.addEventListener('click', () => selectNode(button.dataset.node)));
selectNode('room');

let journeyKey = 'message';
let stepIndex = 0;
let timer = null;
function stopPlayback() {
  if (timer) clearInterval(timer);
  timer = null;
  $('#step-play').innerHTML = '自动播放 <span aria-hidden="true">▷</span>';
  $('#step-play').setAttribute('aria-pressed', 'false');
}
const statusLabels = { draft: '准备发送', authorized: '权限核验中（示意）', stored: '已保存到存储（示意）', received: '已到达会话成员（示意）', complete: '本条业务路径结束（示意）' };
function showStep(index) {
  const journey = journeys[journeyKey];
  stepIndex = Math.max(0, Math.min(index, journey.steps.length - 1));
  const step = journey.steps[stepIndex];
  $('#step-number').textContent = `${String(stepIndex + 1).padStart(2, '0')} / ${String(journey.steps.length).padStart(2, '0')}`;
  $$('.step-button').forEach((button, i) => {
    button.classList.toggle('active', i === stepIndex);
    button.classList.toggle('completed', i < stepIndex);
    if (i === stepIndex) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  });
  $('#stage-label').textContent = step.subtitle;
  $('#message-status').textContent = statusLabels[step.state];
  $('#step-explanation').innerHTML = `<h3>${step.title}</h3><p>${step.explanation}</p><div class="trace">${step.trace}</div>${sourceLink(step.source)}`;
  $('#step-prev').disabled = stepIndex === 0;
  $('#step-next').disabled = stepIndex === journey.steps.length - 1;
}
tabs('journey-tabs', journeys, 'message', (key) => {
  stopPlayback();
  journeyKey = key;
  const journey = journeys[key];
  $('#journey-badge').textContent = journey.badge;
  $('#journey-note').textContent = journey.note;
  $('#step-list').style.gridTemplateColumns = `repeat(${journey.steps.length}, minmax(0, 1fr))`;
  $('#step-list').innerHTML = journey.steps.map((step, index) => `<button class="step-button" type="button" data-step="${index}" aria-label="第 ${index + 1} 步：${step.title}"><span class="step-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${step.title}</strong><small>${step.subtitle}</small></span></button>`).join('');
  $('#message-form').hidden = key !== 'message';
  $('#demo-message').textContent = key === 'message' ? ($('#message-input').value.trim() || '周五一起把版本发布吧。') : key === 'attachment' ? '设计稿.pdf · 附件引用与文件内容分开保存' : key === 'telegram' ? 'TG 成员：我也来参加这次讨论。' : '小林正在呼叫你 · 网页一对一语音';
  showStep(0);
}, 'journey-panel');
$('#step-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-step]');
  if (!button) return;
  stopPlayback(); showStep(Number(button.dataset.step));
});
$('#step-prev').addEventListener('click', () => { stopPlayback(); showStep(stepIndex - 1); });
$('#step-next').addEventListener('click', () => { stopPlayback(); showStep(stepIndex + 1); });
$('#step-play').addEventListener('click', () => {
  if (timer) { stopPlayback(); return; }
  if (stepIndex === journeys[journeyKey].steps.length - 1) showStep(0);
  $('#step-play').innerHTML = '暂停播放 <span aria-hidden="true">Ⅱ</span>';
  $('#step-play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => { showStep(stepIndex + 1); if (stepIndex === journeys[journeyKey].steps.length - 1) stopPlayback(); }, 2300);
});
$('#message-form').addEventListener('submit', (event) => {
  event.preventDefault();
  stopPlayback();
  const value = $('#message-input').value.trim();
  $('#demo-message').textContent = value || '周五一起把版本发布吧。';
  showStep(0);
  $('#step-play').click();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });

tabs('bridge-tabs', bridges, 'telegram', (key) => {
  const bridge = bridges[key];
  $('#bridge-left').textContent = bridge.left;
  $('#bridge-right').textContent = bridge.right;
  $('#bridge-via').textContent = bridge.via;
  $('#bridge-detail').innerHTML = `<h3>${bridge.title}</h3><p>${bridge.description}</p><dl>${bridge.rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${sourceLink(bridge.source)}`;
}, 'bridge-detail');
tabs('scenario-tabs', suitability, 'team', (key) => {
  const scenario = suitability[key];
  $('#scenario-detail').innerHTML = `<h4>${scenario.verdict}</h4><p>${scenario.reason}</p>${list(scenario.checks)}`;
}, 'scenario-detail');

tabs('direction-tabs', productDirections, 'delivery', (key) => {
  const direction = productDirections[key];
  $('#direction-detail').innerHTML = `<span class="direction-priority">${direction.priority}</span><h3>${direction.title}</h3><p class="direction-audience">使用者：${direction.audience}</p><dl><dt>具体问题</dt><dd>${direction.problem}</dd><dt>可以复用</dt><dd>${direction.reuse}</dd><dt>仍需开发</dt><dd>${direction.build}</dd><dt>价值判断</dt><dd>${direction.value}</dd></dl><div class="direction-gate"><b>先确认这一点</b><p>${direction.gate}</p></div>`;
}, 'direction-detail');
$('#comparison-list').innerHTML = comparisonProducts.map((product) => `<a class="comparison-product" href="${product.url}" target="_blank" rel="noreferrer"><span>${product.title}<b aria-hidden="true">↗</b></span><p>${product.capability}</p><small>${product.implication}</small></a>`).join('');

const sourceEntries = Object.entries(sources);
$('#source-list').innerHTML = sourceEntries.map(([id, source], index) => `<a class="source-row" data-source-id="${id}" href="${source.url}" target="_blank" rel="noreferrer"><span class="source-index">${String(index + 1).padStart(2, '0')}</span><div class="source-info"><h3>${source.title}</h3><p>${source.note}</p><code>${source.path}</code></div><span class="source-kind">${source.kind}<b aria-hidden="true">↗</b></span></a>`).join('');
function filterSources() {
  const term = $('#source-search').value.trim().toLocaleLowerCase();
  let count = 0;
  $$('.source-row').forEach((row) => { row.hidden = !row.textContent.toLocaleLowerCase().includes(term); if (!row.hidden) count++; });
  $('#source-count').textContent = `${count} / ${sourceEntries.length} 处固定版本来源`;
  $('#source-empty').hidden = count !== 0;
}
$('#source-search').addEventListener('input', filterSources);
filterSources();
$$('[data-source]').forEach((anchor) => {
  const source = sources[anchor.dataset.source];
  anchor.href = source.url; anchor.target = '_blank'; anchor.rel = 'noreferrer';
  anchor.innerHTML = `${icon('external')} ${source.title}`;
});
paintIcons();

const summaryImage = $('#summary-poster');
const summaryDownload = $('#summary-png-download');
if (summaryImage && summaryDownload) summaryDownload.href = summaryImage.src;

const chapterLinks = $$('.chapter-nav a');
let ticking = false;
function updateChapter() {
  let current = '';
  for (const link of chapterLinks) if ($(link.getAttribute('href')).getBoundingClientRect().top <= 170) current = link.getAttribute('href');
  chapterLinks.forEach((link) => {
    const active = link.getAttribute('href') === current;
    link.classList.toggle('current', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
  ticking = false;
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateChapter); } }, { passive: true });
updateChapter();
document.documentElement.dataset.researchVersion = snapshot.shortCommit;
