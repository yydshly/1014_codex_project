const $ = (selector) => document.querySelector(selector);
const staticMode = document.documentElement.dataset.researchMode === 'static';
const el = (tag, className = '', text) => { const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node; };
let ready = false;
let running = false;
let polling = null;
let activeRun = null;
let pollErrors = 0;
const date = (value) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '未知';
function sourceLink(url, text) {
  const link = el('a', 'reddit-source-link', text);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !(parsed.hostname === 'reddit.com' || parsed.hostname.endsWith('.reddit.com'))) throw new Error();
    link.href = parsed.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  } catch { link.removeAttribute('href'); }
  return link;
}
function buttons() { $('#reddit-run').disabled = !ready || running; $('#reddit-reanalyse').disabled = !ready || running; }
function quote(text, label) {
  const block = el('blockquote', 'reddit-quote');
  block.append(el('p', '', text), el('cite', '', label));
  return block;
}
function render(report) {
  const meta = $('#reddit-report-meta');
  const records = Array.isArray(report.records) ? report.records : [];
  meta.replaceChildren(el('strong', '', `${records.length} 条独立帖子`), el('span', '', report.acquisition), el('span', '', `采集于 ${date(report.collected_at)}`), el('p', '', report.analysis_engine));
  const cards = records.map(({ source, analysis }, index) => {
    const card = el('article', 'reddit-card');
    const top = el('div', 'reddit-card-top');
    top.append(el('span', 'reddit-record-index', `0${index + 1} / r/${source.subreddit}`), sourceLink(source.url, '打开原始来源 ↗'));
    const badge = el('span', `reddit-grounding ${analysis.grounding === 'excerpt_checked' ? '' : 'needs-check'}`, analysis.grounding === 'excerpt_checked' ? '引文已与保存片段核对' : 'API 引用 · 原话待独立复核');
    card.append(top, el('h3', '', analysis.problem), el('p', 'reddit-original-title', source.title), badge);
    const context = el('dl', 'reddit-context');
    for (const [label, value] of [['观察人群', analysis.audience], ['工作任务', analysis.task], ['卡住的地方', analysis.obstacle], ['实际影响', analysis.impact]]) {
      const row = el('div'); row.append(el('dt', '', label), el('dd', '', value || '未知')); context.append(row);
    }
    card.append(context);
    const columns = el('div', 'reddit-evidence-columns');
    const evidence = el('div'); evidence.append(el('h4', '', '问题原话与证据'));
    for (const item of analysis.evidence || []) evidence.append(quote(item.quote, item.location));
    const solutions = el('div'); solutions.append(el('h4', '', '回复里已有的解决办法'));
    for (const item of analysis.existing_solutions || []) {
      const solution = el('div', 'reddit-solution');
      solution.append(el('span', '', item.kind), el('h5', '', item.name), el('p', '', item.summary), quote(item.quote, item.location));
      solutions.append(solution);
    }
    if (!analysis.existing_solutions?.length) solutions.append(el('p', 'reddit-muted', '本次材料中未找到可回溯的解决建议，继续补采。'));
    columns.append(evidence, solutions); card.append(columns);
    const checks = el('div', 'reddit-unknowns'); checks.append(el('h4', '', '还不能确定什么'));
    const list = el('ul'); for (const value of analysis.unknowns || []) list.append(el('li', '', value)); checks.append(list);
    checks.append(el('p', 'reddit-interpretation', analysis.interpretation));
    card.append(checks, el('p', 'reddit-next-step', `下一步：${analysis.next_step}`));
    const details = el('details', 'reddit-raw'); details.append(el('summary', '', '查看采集片段与来源条件'));
    details.append(el('p', '', `${source.access}。${source.date_basis}。采集时间：${date(source.collected_at)}。`));
    if (source.content) details.append(el('pre', '', source.content));
    else details.append(el('p', '', '本次 API 返回引用来源；未取得可独立核对的原始页面文本。上方摘录为模型报告的引文，需要回源复核。'));
    details.append(sourceLink(source.url, `${source.url} ↗`)); card.append(details);
    return card;
  });
  if (report.limitations?.length) {
    const note = el('div', 'reddit-report-note'); note.append(el('h4', '', '这批结果的读取范围'));
    const list = el('ul'); for (const value of report.limitations) list.append(el('li', '', value)); note.append(list); cards.push(note);
  }
  $('#reddit-results').replaceChildren(...cards);
}
async function latest() {
  if (staticMode) { const response = await fetch('./data/reddit-latest.json'); if (!response.ok) throw new Error('采集材料加载失败'); render(await response.json()); return; }
  try { const response = await fetch('./api/reddit/latest'); if (!response.ok) throw new Error(); render(await response.json()); }
  catch {
    const response = await fetch('./data/reddit-latest.json');
    if (!response.ok) throw new Error('采集材料加载失败');
    render(await response.json());
  }
}
async function status() {
  if (staticMode) { ready = false; $('#reddit-connection').textContent = '公开展示模式：展示已保存样本，独立 API 实验未连接。'; $('#reddit-connection-label').textContent = '历史实采材料'; $('#reddit-refresh').hidden = true; buttons(); return; }
  try {
    const response = await fetch('./api/reddit/status');
    if (!response.ok) throw new Error();
    const data = await response.json(); ready = data.configured;
    $('#reddit-connection').textContent = data.note;
    $('#reddit-connection-label').textContent = ready ? 'OpenAI API 配置已读取' : '网页独立更新待接入';
    if (data.activeRun && !activeRun) { activeRun = data.activeRun; running = true; schedulePoll(); }
  } catch {
    ready = false;
    $('#reddit-connection').textContent = '当前仅展示已保存的真实样本；本地分析服务未连接。';
  }
  buttons();
}
function schedulePoll() { clearTimeout(polling); polling = setTimeout(poll, 1600); }
async function poll() {
  if (!activeRun) return;
  try {
    const response = await fetch(`./api/reddit/runs/${encodeURIComponent(activeRun)}`);
    if (!response.ok) throw new Error();
    const job = await response.json(); pollErrors = 0;
    $('#reddit-run-status').textContent = job.message;
    if (['completed', 'failed', 'interrupted'].includes(job.status)) {
      running = false; activeRun = null; buttons();
      if (job.status === 'completed') await latest();
    } else schedulePoll();
  } catch {
    pollErrors += 1;
    if (pollErrors < 3) schedulePoll();
    else { running = false; activeRun = null; buttons(); $('#reddit-run-status').textContent = '暂时无法读取运行状态。点击刷新状态重新连接，上次结果仍保留。'; }
  }
}
async function start(mode) {
  if (running || !ready) return;
  running = true; buttons();
  $('#reddit-run-status').textContent = '正在提交本轮请求…';
  try {
    const response = await fetch('./api/reddit/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, query: $('#reddit-query').value.trim(), community: $('#reddit-community').value.trim(), limit: Number($('#reddit-limit').value) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '运行请求失败');
    activeRun = data.id; pollErrors = 0; $('#reddit-run-status').textContent = data.message; schedulePoll();
  } catch (error) { running = false; buttons(); $('#reddit-run-status').textContent = error.message; }
}
$('#reddit-form').addEventListener('submit', (event) => { event.preventDefault(); start('search'); });
$('#reddit-reanalyse').addEventListener('click', () => start('analyse_saved'));
$('#reddit-refresh').addEventListener('click', () => status());
Promise.all([latest(), status()]).catch(() => { $('#reddit-results').textContent = '真实材料暂时加载失败，请刷新页面重试。'; });
