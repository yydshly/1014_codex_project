import { validateFinding, parseLibrary, mergeLibraries, appendResearchFindings } from './findings-model.js';

const $ = (selector) => document.querySelector(selector);
const storageKey = 'research-004-findings-v1';
const kinds = { need: '需求线索', github: 'GitHub 项目', ai: 'AI 产品' };
const statuses = { todo: '待研究', researching: '研究中', done: '已整理', paused: '暂缓' };
const fields = ['kind', 'status', 'title', 'url', 'source', 'evidence', 'understanding', 'nextStep'];
const form = $('#finding-form');
const dialog = $('#finding-dialog');
let items = [];
let editItem = null;
let draftAtOpen = '';
let limit = 12;
let pendingImport = null;
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const button = (text, className, action) => {
  const element = node('button', className, text);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
};
const feedback = (text) => { $('#findings-feedback').textContent = text; };
const stamp = (previous) => new Date(Math.max(Date.now(), Date.parse(previous || '') + 1 || 0)).toISOString();
const formatDate = (value) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value));
const fileDate = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type).value).join('-');
};
const draft = () => Object.fromEntries(fields.map((name) => [name, form.elements.namedItem(name).value]));
const isDirty = () => JSON.stringify(draft()) !== draftAtOpen;

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = node('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showReadError(error, raw) {
  const warning = $('#findings-warning');
  warning.replaceChildren(node('p', '', `暂时无法读取发现库：${error.message}。原有数据未被改写。`));
  if (typeof raw === 'string' && raw) {
    warning.append(button('导出原始数据备份', 'text-button', () => download('004-findings-recovery.json', raw, 'application/json;charset=utf-8')));
  }
  warning.append(button('重新读取', 'text-button', () => { if (refresh()) feedback('已重新读取当前浏览器中的发现。'); }));
  warning.hidden = false;
}
function readLibrary() {
  let raw;
  try {
    raw = localStorage.getItem(storageKey);
    const result = raw === null ? [] : parseLibrary(raw).items;
    $('#findings-warning').hidden = true;
    return result;
  } catch (error) {
    showReadError(error, raw);
    throw new Error('发现库无法读取，请先保留原始备份并检查数据；本次没有覆盖已有记录。');
  }
}
function refresh() {
  try { items = readLibrary(); render(); return true; }
  catch { render(); return false; }
}
function commit(next) {
  const text = JSON.stringify({ version: 1, items: next });
  parseLibrary(text);
  try { localStorage.setItem(storageKey, text); }
  catch { throw new Error('未能写入浏览器存储，可能空间不足或存储被禁用。当前输入仍保留，请先导出已有记录备份后重试。'); }
  items = next;
  render();
}

function openEditor(item = null, context = {}) {
  if (dialog.open) return;
  editItem = item ? { ...item } : null;
  for (const name of fields) form.elements.namedItem(name).value = item?.[name] || (name === 'kind' ? (kinds[context.kind] ? context.kind : 'need') : name === 'status' ? 'todo' : name === 'source' ? context.source || '' : '');
  draftAtOpen = JSON.stringify(draft());
  $('#finding-dialog-title').textContent = item ? '继续整理这条发现' : '保存一条发现';
  $('#finding-save').textContent = item ? '保存修改' : '保存发现';
  $('#finding-edit-meta').textContent = item ? `创建于 ${formatDate(item.createdAt)}` : '保存后可随时回来补充。';
  $('#finding-error').textContent = '';
  $('#finding-discard').hidden = true;
  $('.finding-evidence-editor').open = Boolean(item?.evidence);
  dialog.showModal();
  $('#finding-title').focus();
}
function requestClose() {
  if (!isDirty()) { dialog.close(); return; }
  $('#finding-discard').hidden = false;
  $('#finding-keep').focus();
}
$('#finding-new').addEventListener('click', () => openEditor());
$('#finding-close').addEventListener('click', requestClose);
dialog.addEventListener('cancel', (event) => { event.preventDefault(); requestClose(); });
$('#finding-keep').addEventListener('click', () => { $('#finding-discard').hidden = true; $('#finding-save').focus(); });
$('#finding-discard-confirm').addEventListener('click', () => dialog.close());
form.addEventListener('input', () => { $('#finding-error').textContent = ''; $('#finding-discard').hidden = true; });
window.addEventListener('beforeunload', (event) => {
  if (dialog.open && isDirty()) { event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('research-entry:save-finding', (event) => openEditor(null, event.detail));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const current = readLibrary();
    if (editItem) {
      const latest = current.find((item) => item.id === editItem.id);
      if (!latest || JSON.stringify(latest) !== JSON.stringify(editItem)) throw new Error('这条记录已在其他页面更新。请先保留当前输入，关闭后重新打开最新记录再编辑。');
    }
    const time = stamp(editItem?.updatedAt);
    const record = validateFinding({ ...draft(), id: editItem?.id || crypto.randomUUID(), createdAt: editItem?.createdAt || time, updatedAt: time, trashedAt: null });
    commit(editItem ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    const wasEditing = Boolean(editItem);
    draftAtOpen = JSON.stringify(draft());
    dialog.close();
    // A saved record is always visible, even if the previous list had restrictive filters.
    resetFilters();
    location.hash = 'discoveries';
    feedback(`${wasEditing ? '修改' : '发现'}已保存到当前浏览器，可以继续补充理解和下一步。`);
    [...document.querySelectorAll('[data-finding-id]')].find((element) => element.dataset.findingId === record.id)?.querySelector('.finding-title-button')?.focus({ preventScroll: true });
  } catch (error) { $('#finding-error').textContent = error.message; }
});

function updateTrash(id, deleted) {
  try {
    const current = readLibrary();
    const found = current.find((item) => item.id === id);
    if (!found) throw new Error('这条记录已发生变化，请重新读取列表。');
    const time = stamp(found.updatedAt);
    commit(current.map((item) => item.id === id ? { ...item, updatedAt: time, trashedAt: deleted ? time : null } : item));
    feedback(deleted ? '已移到回收站，可切换“查看范围”恢复。' : '已恢复到“我的发现”。');
  } catch (error) { feedback(error.message); }
}
function visibleItems() {
  const query = $('#findings-query').value.trim().toLocaleLowerCase();
  const kind = $('#findings-kind').value;
  const status = $('#findings-status-filter').value;
  const trash = $('#findings-view').value === 'trash';
  return items.filter((item) => Boolean(item.trashedAt) === trash
    && (kind === 'all' || item.kind === kind) && (status === 'all' || item.status === status)
    && (!query || [item.title, item.url, item.source, item.evidence, item.understanding, item.nextStep].join(' ').toLocaleLowerCase().includes(query)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
function resetFilters() {
  $('#findings-query').value = '';
  $('#findings-kind').value = 'all';
  $('#findings-status-filter').value = 'all';
  $('#findings-view').value = 'active';
  limit = 12;
  render();
}
function findingCard(item) {
  const card = node('article', 'finding-card');
  card.dataset.findingId = item.id;
  const top = node('div', 'finding-card-top');
  top.append(node('span', `finding-kind finding-kind-${item.kind}`, kinds[item.kind]), node('span', `finding-progress finding-progress-${item.status}`, statuses[item.status]));
  const heading = node('h3');
  const title = button(item.title, 'finding-title-button', () => openEditor(item));
  title.disabled = Boolean(item.trashedAt);
  heading.append(title);
  const url = node('a', 'finding-url', item.url);
  url.href = item.url;
  url.target = '_blank';
  url.rel = 'noopener noreferrer';
  const notes = node('div', 'finding-notes');
  notes.append(node('span', 'small-label', '自己的理解'), node('p', item.understanding ? '' : 'finding-missing', item.understanding || '还没写，继续研究时补充。'));
  const next = node('div', 'finding-next-step');
  next.append(node('span', 'small-label', '下一步'), node('p', item.nextStep ? '' : 'finding-missing', item.nextStep || '还没确定下一步。'));
  const detail = node('details', 'finding-original');
  detail.append(node('summary', '', '查看完整记录与证据'));
  for (const [label, value] of [['来自哪里', item.source], ['原话或证据摘录', item.evidence], ['完整理解', item.understanding], ['完整下一步', item.nextStep]]) {
    if (value) detail.append(node('strong', '', label), node('p', '', value));
  }
  detail.append(node('p', 'finding-dates', `创建 ${formatDate(item.createdAt)} · 更新 ${formatDate(item.updatedAt)}`));
  const actions = node('div', 'finding-card-actions');
  if (item.trashedAt) {
    actions.append(node('span', '', `移入回收站 ${formatDate(item.trashedAt)}`), button('恢复记录', 'text-button', () => updateTrash(item.id, false)));
  } else {
    actions.append(button('继续整理', 'text-button', () => openEditor(item)), button('带入采集计划', 'text-button', () => document.dispatchEvent(new CustomEvent('research-finding:add-plan', { detail: item }))), button('移到回收站', 'text-button finding-trash', () => updateTrash(item.id, true)));
  }
  card.append(top, heading, url, notes, next, detail, actions);
  return card;
}
function render() {
  const active = items.filter((item) => !item.trashedAt).length;
  const filtered = visibleItems();
  const trash = $('#findings-view').value === 'trash';
  $('#findings-count').textContent = `${trash ? '回收站' : '我的发现'} ${trash ? items.length - active : active} 条 · 当前显示 ${Math.min(limit, filtered.length)} / ${filtered.length} 条`;
  $('#findings-export-json').disabled = items.length === 0;
  $('#findings-export-md').disabled = active === 0;
  const list = $('#findings-list');
  list.replaceChildren(...filtered.slice(0, limit).map(findingCard));
  if (!filtered.length) {
    const empty = node('div', 'findings-empty');
    empty.append(node('span', 'small-label', '每一条记录，都有一个下一步'), node('h3', '', items.length === 0 ? '把第一条值得研究的发现留下来。' : trash ? '当前没有符合条件的回收站记录。' : '当前筛选没有匹配的发现。'));
    empty.append(node('p', '', items.length === 0 ? '从一条求助、一个仓库或一个 AI 产品开始。先保存具体链接，再慢慢补充理解。' : '可以清除筛选查看全部记录，或保存一条新发现。'));
    const actions = node('div', 'findings-empty-actions');
    if (!items.length) {
      for (const [kind, label] of Object.entries(kinds)) actions.append(button(`＋ ${label}`, 'button button-outline', () => openEditor(null, { kind })));
    } else actions.append(button('清除筛选，查看我的发现', 'button button-outline', resetFilters));
    empty.append(actions);
    list.append(empty);
  }
  $('#findings-more').hidden = filtered.length <= limit;
}
for (const id of ['findings-kind', 'findings-status-filter', 'findings-view']) {
  $(`#${id}`).addEventListener('change', () => { limit = 12; render(); });
}
$('#findings-query').addEventListener('input', () => { limit = 12; render(); });
$('#findings-more').addEventListener('click', () => { limit += 12; render(); });

$('#findings-export-json').addEventListener('click', () => {
  try {
    const current = readLibrary();
    download(`004-findings-${fileDate()}.json`, JSON.stringify({ version: 1, items: current }, null, 2), 'application/json;charset=utf-8');
    feedback(`已生成 JSON 备份，包含全部 ${current.length} 条记录（含回收站），不受当前筛选影响。`);
  } catch (error) { feedback(error.message); }
});
$('#findings-export-md').addEventListener('click', () => {
  try {
    const current = readLibrary().filter((item) => !item.trashedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    // Quote user text as plain Markdown content; never render it as HTML in the page.
    const quote = (text) => String(text).replace(/\r\n?/g, '\n').split('\n').map((line) => `> ${line.replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char])}`).join('\n');
    const sections = current.map((item, index) => [
      `## ${index + 1}. ${kinds[item.kind]} · ${statuses[item.status]}`,
      '### 标题', quote(item.title), '### 原始链接', quote(item.url),
      '### 来自哪里', quote(item.source || '未填写'), '### 原话或证据摘录', quote(item.evidence || '未填写'),
      '### 自己的理解', quote(item.understanding || '未填写'), '### 下一步', quote(item.nextStep || '未填写'),
      `记录编号：${item.id}`, `创建：${item.createdAt}；更新：${item.updatedAt}`,
    ].join('\n\n'));
    download(`004-research-notes-${fileDate()}.md`, ['# 004 · 我的发现', '这些是个人研究记录，理解与价值判断仍需核实。', ...sections].join('\n\n'), 'text/markdown;charset=utf-8');
    feedback(`已导出 ${current.length} 条研究笔记，不含回收站，不受当前筛选影响。`);
  } catch (error) { feedback(error.message); }
});
$('#findings-import').addEventListener('click', () => $('#findings-import-file').click());
$('#findings-import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  pendingImport = null;
  $('#findings-import-preview').hidden = true;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('备份文件超过 10 MB，请先拆分记录后导入。');
    const incoming = parseLibrary(await file.text()).items;
    const result = mergeLibraries(readLibrary(), incoming);
    pendingImport = incoming;
    $('#findings-import-summary').textContent = `此文件包含 ${incoming.length} 条记录（回收站 ${incoming.filter((item) => item.trashedAt).length} 条）。预计新增 ${result.added} 条、更新 ${result.updated} 条、跳过 ${result.skipped} 条。`;
    $('#findings-import-preview').hidden = false;
    $('#findings-import-confirm').focus();
    feedback('已读取备份，确认合并后才会写入当前发现库。');
  } catch (error) { feedback(`导入未执行：${error.message}`); }
});
$('#findings-import-confirm').addEventListener('click', () => {
  if (!pendingImport) return;
  try {
    const result = mergeLibraries(readLibrary(), pendingImport);
    commit(result.items);
    pendingImport = null;
    $('#findings-import-preview').hidden = true;
    resetFilters();
    feedback(`已合并导入：新增 ${result.added} 条、更新 ${result.updated} 条、跳过 ${result.skipped} 条。回收站记录可在“查看范围”切换查看。`);
  } catch (error) { feedback(`导入未保存：${error.message}`); }
});
$('#findings-import-cancel').addEventListener('click', () => { pendingImport = null; $('#findings-import-preview').hidden = true; feedback('已取消导入，原有记录保持不变。'); });
window.addEventListener('storage', (event) => {
  if (event.key === storageKey || event.key === null) {
    if (refresh()) feedback('发现库已从其他页面同步更新。正在编辑的内容仍保留。');
  }
});
refresh();

export function saveResearchFindings(records) {
  const result=appendResearchFindings(readLibrary(),records);
  if(result.added)commit(result.items);
  resetFilters();
  feedback(`自动研究：新增 ${result.added} 条，跳过 ${result.skipped} 条已有链接；你的理解和回收站记录保持原样。`);
  return {added:result.added,skipped:result.skipped};
}
