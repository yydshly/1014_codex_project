import { sourceCatalog, scopeLabels, validationDate } from './source-catalog.js';

const initialized = new WeakSet();
const fields = [
  ['category', '来源类别'], ['method', '接入方式'], ['access', '认证与成本'],
  ['coverage', '覆盖范围'], ['query', '搜索与筛选'], ['incremental', '增量与进度'],
  ['limits', '限流与稳定性'], ['value', '使用价值'],
];

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = String(text);
  return item;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function searchText(record) {
  return [
    record.id, record.name, record.status, scopeLabels[record.scope],
    ...fields.map(([field]) => record[field]), record.note,
    record.endpoint, record.requestExample,
    ...(record.methodType || []), ...(record.links || []).map(link => `${link.label} ${link.url}`),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function createCard(record) {
  const card = node('details', undefined, 'catalog-card');
  card.id = `catalog-${record.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  card.dataset.scope = record.scope;
  const summary = node('summary');
  const heading = node('span', undefined, 'catalog-head');
  heading.append(
    node('strong', record.name, 'catalog-name'),
    node('span', record.status, 'catalog-status'),
  );
  summary.append(
    heading,
    node('span', record.method, 'catalog-method'),
    node('span', record.value, 'catalog-value'),
  );

  const details = node('dl', undefined, 'catalog-details');
  const rows = [
    ['登记范围', scopeLabels[record.scope] || record.scope],
    ...fields.map(([field, label]) => [label, record[field]]),
    ['证据状态', record.status],
    [record.scope === 'prototype' ? '采集实测日期' : '资料核对日期', record.verifiedAt],
  ];
  if (record.note) rows.push(['补充说明', record.note]);
  rows.forEach(([label, value]) => {
    const row = node('div');
    row.append(node('dt', label), node('dd', value || '待确认'));
    details.append(row);
  });
  if (record.endpoint) {
    const row = node('div');
    const value = node('dd');
    value.append(node('code', record.endpoint));
    row.append(node('dt', '请求入口'), value);
    details.append(row);
  }
  if (record.requestExample) {
    const row = node('div');
    const value = node('dd');
    const example = node('pre');
    example.append(node('code', record.requestExample));
    value.append(example);
    row.append(node('dt', '请求示例（未执行）'), value);
    details.append(row);
  }

  const links = node('div', undefined, 'catalog-links');
  (record.links || []).forEach(link => {
    const url = safeUrl(link.url);
    if (!url) return;
    const anchor = node('a', `${link.label} ↗`);
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    links.append(anchor);
  });
  const metadata = record.scope === 'prototype'
    ? '实测日期沿用已有快照；本次没有重新采集。'
    : record.scope === 'native'
      ? '固定版本有实现，不代表本次已运行上游服务。'
      : '候选来源；文档或公开入口核对不代表已接入，也不代表取得数据许可。';
  card.append(summary, details, links, node('p', metadata, 'catalog-meta'));
  return card;
}

export function initSourceCatalog() {
  const controls = document.querySelector('#source-catalog-controls');
  const method = document.querySelector('#catalog-method');
  const search = document.querySelector('#catalog-search');
  const count = document.querySelector('#catalog-count');
  const list = document.querySelector('#source-catalog-list');
  const empty = document.querySelector('#catalog-empty');
  if (!controls || !method || !search || !count || !list || !empty || initialized.has(list)) return;
  initialized.add(list);

  const buttons = [...controls.querySelectorAll('[data-catalog-scope]')];
  const allowedScopes = new Set(['all', ...Object.keys(scopeLabels)]);
  const activeButton = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
  let scope = allowedScopes.has(activeButton?.dataset.catalogScope) ? activeButton.dataset.catalogScope : 'all';
  const records = sourceCatalog.map(record => ({ record, text: searchText(record) }));

  function render() {
    const selectedMethod = ['rss', 'api', 'web'].includes(method.value) ? method.value : 'all';
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = records.filter(({ record, text }) =>
      (scope === 'all' || record.scope === scope)
      && (selectedMethod === 'all' || record.methodType?.includes(selectedMethod))
      && terms.every(term => text.includes(term)),
    );
    buttons.forEach(button => {
      const active = button.dataset.catalogScope === scope;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    list.replaceChildren(...matches.map(({ record }) => createCard(record)));
    empty.hidden = matches.length > 0;
    count.textContent = `显示 ${matches.length} / ${sourceCatalog.length} 项来源；接入资料核对日期 ${validationDate}，实测日期见各项。`;
  }

  controls.addEventListener('click', event => {
    const button = event.target.closest?.('[data-catalog-scope]');
    if (!button || !controls.contains(button) || !allowedScopes.has(button.dataset.catalogScope)) return;
    scope = button.dataset.catalogScope;
    render();
  });
  method.addEventListener('change', render);
  search.addEventListener('input', render);
  render();
}
