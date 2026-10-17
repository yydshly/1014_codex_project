import { createHash } from 'node:crypto';
import { validateFinding } from '../findings-model.js';
export const cut = (value, max = 600) => typeof value === 'string' ? value.slice(0, max).trim() : '';
export function publicURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
    const host = u.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    return u.href;
  } catch { return null; }
}
export function urlKey(value) {
  const safe = publicURL(value); if (!safe) return null;
  const u = new URL(safe); u.hostname = u.hostname.replace(/^www\./, ''); u.hash = '';
  for (const name of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(name)) u.searchParams.delete(name);
  u.pathname = u.pathname.replace(/\/+$/, '') || '/'; return u.href;
}
export function actionFromEvent(event) {
  if (event.type !== 'item.completed' || event.item?.type !== 'web_search') return null;
  const item = event.item; const action = item.action || {};
  return { id: cut(item.id, 100), type: action.type || 'search', status: item.status || 'completed',
    queries: (Array.isArray(action.queries) ? action.queries : [action.query || item.query]).filter(v => typeof v === 'string' && v && !v.startsWith('http')).map(v => cut(v, 400)),
    urls: [action.url, ...(action.urls || []), ...(action.refs || [])].map(v => publicURL(typeof v === 'string' ? v : v?.url)).filter(Boolean), at: new Date().toISOString() };
}
export function normalizeSources(rows, actions) {
  const opened = new Set(actions.filter(a => a.status === 'completed' && ['open', 'open_page', 'openPage'].includes(a.type)).flatMap(a => a.urls.map(urlKey)));
  const seen = new Set(); const sources = [];
  for (const raw of Array.isArray(rows) ? rows.slice(0, 6) : []) {
    const url = publicURL(raw.url); const key = urlKey(url); if (!url || seen.has(key)) continue; seen.add(key);
    const linked = opened.has(key); const quote = cut(raw.quote, /[\u3400-\u9fff]/.test(raw.quote || '') ? 70 : 250).split(/\s+/).slice(0, 25).join(' ');
    sources.push({ url, title: cut(raw.title, 180), role: cut(raw.role, 50), quote, location: cut(raw.location, 150), date_basis: cut(raw.date_basis, 180),
      access: linked && raw.access === 'page_excerpt' ? 'page_excerpt' : raw.access === 'unavailable' ? 'unavailable' : 'search_snippet', opened_in_trace: linked,
      verification: linked && raw.access === 'page_excerpt' ? 'tool_read_excerpt' : 'search_snippet', collected_at: new Date().toISOString() });
  } return sources;
}
export function quoteInText(quote, text) {
  const norm = v => String(v).replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(quote).length >= 12 && norm(text).includes(norm(quote));
}
export function finalizeResult(data, sources, job) {
  if (!Array.isArray(data.findings) || !Array.isArray(data.excluded)) throw new Error('INVALID_RESULT');
  const lookup = new Map(sources.map(s => [urlKey(s.url), s])); const seen = new Set(); const records = [];
  const excluded = data.excluded.slice(0, 10).map(r => ({ title: cut(r.title, 180), url: publicURL(r.url), reason: cut(r.reason, 600) }));
  for (const raw of data.findings.slice(0, 6)) {
    const source = lookup.get(urlKey(raw.url));
    const fail = (reason) => excluded.push({ title: cut(raw.title, 180), url: publicURL(raw.url), reason });
    if (!['keep','needs_verification'].includes(raw.decision)) { fail(cut(raw.reason) || '模型建议排除'); continue; }
    if (!source || !source.quote || !['tool_read_excerpt','local_quote_checked'].includes(source.verification)) { fail('未取得可关联原文读取的来源，暂不保存为发现。'); continue; }
    if (raw.kind === 'need' && !['user_experience','discussion'].includes(source.role)) { fail('主来源属于产品介绍或推广，不能作为用户需求证据。'); continue; }
    if (seen.has(urlKey(source.url))) { fail('同一主来源已保留一条，本轮去重。'); continue; }
    const related = [source, ...(Array.isArray(raw.source_urls) ? raw.source_urls.map(u => lookup.get(urlKey(u))).filter(s => s && s !== source) : [])].slice(0, 2);
    const now = job.finished_at || new Date().toISOString();
    const record = { id: `auto-${job.id}-${createHash('sha256').update(source.url).digest('hex').slice(0,12)}`, kind: raw.kind, title: cut(raw.title,120), url: source.url,
      source: `004 自动研究 · ${new URL(source.url).hostname}`,
      evidence: cut(related.map(s => `${s.title}\n${s.url}\n> ${s.quote}\n定位：${s.location || '未注明'}\n日期依据：${s.date_basis || '未知'}\n读取状态：${s.verification === 'local_quote_checked' ? '本地页面逐字匹配短引文' : s.verification === 'tool_read_excerpt' ? '工具曾打开页面；AI摘录尚未独立逐字核验' : '只有搜索摘要，不能当作原文'}\n${s.verification_note || ''}`).join('\n\n') + `\n\n研究方向：${job.input.direction}\n采集：${now}\n运行编号：${job.id}`,3000),
      understanding: cut(`${raw.decision === 'needs_verification' ? '继续核实' : '保留研究'}：${cut(raw.reason,300)}\n\n${cut(raw.understanding,1500)}\n\n已有办法与边界：${cut(raw.existing_solutions,500)}\n\n未知：${cut(raw.unknowns,500)}${related.some(s=>s.verification==='search_snippet')?'\n\n来源提醒：部分辅助材料只有搜索摘要，相关判断需要回读原文，不能当作已确认事实。':''}`,3000),
      nextStep: cut(raw.nextStep,1500), status: 'todo', createdAt: now, updatedAt: now, trashedAt: null };
    try { records.push(validateFinding(record)); seen.add(urlKey(source.url)); } catch { fail('字段未通过发现库校验，未保存。'); }
    if (records.length >= 3) break;
  }
  return { summary: cut(data.summary,1600), sources, records, excluded,
    limitations: (Array.isArray(data.limitations) ? data.limitations : []).slice(0,6).map(v => cut(v,500)) };
}
