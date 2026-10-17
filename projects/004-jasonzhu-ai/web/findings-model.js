const kinds = new Set(['need', 'github', 'ai']);
const statuses = new Set(['todo', 'researching', 'done', 'paused']);
const maximumItems = 1000;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function textField(value, label, limit, { optional = false, trim = false } = {}) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`${label}必须是文字`);
  const result = trim ? value.trim() : value;
  if (!optional && !result.trim()) throw new Error(`${label}不能为空`);
  if (result.length > limit) throw new Error(`${label}不能超过 ${limit} 个字符`);
  return result;
}

function isoDate(value, label) {
  if (typeof value !== 'string') throw new Error(`${label}必须是有效的 ISO 日期`);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/);
  if (!match) throw new Error(`${label}必须是有效的 ISO 日期`);
  const [, yearText, monthText, dayText, hourText = '00', minuteText = '00', secondText = '00'] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const milliseconds = Date.parse(value);
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59 || !Number.isFinite(milliseconds)) {
    throw new Error(`${label}必须是有效的 ISO 日期`);
  }
  return new Date(milliseconds).toISOString();
}

export function normalizeURL(value) {
  const text = textField(value, '来源网址', 2000, { trim: true });
  if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error('来源网址不能包含控制字符');
  let url;
  try { url = new URL(text); } catch { throw new Error('来源网址格式不正确，请填写完整的 HTTP 或 HTTPS 网址'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('来源网址只支持 HTTP 或 HTTPS');
  if (url.username || url.password) throw new Error('来源网址不能携带用户名或密码');
  if (url.href.length > 2000) throw new Error('来源网址不能超过 2000 个字符');
  return url.href;
}

export function validateFinding(raw) {
  if (!isObject(raw)) throw new Error('每条发现必须是一个完整的记录对象');
  const id = textField(raw.id, '记录编号', 160, { trim: true });
  if (/[\u0000-\u001f\u007f]/.test(id)) throw new Error('记录编号不能包含控制字符');
  if (!kinds.has(raw.kind)) throw new Error('发现类型必须是需求、GitHub 项目或 AI 产品');
  if (!statuses.has(raw.status)) throw new Error('研究状态必须是待研究、研究中、已整理或暂缓');
  return {
    id,
    kind: raw.kind,
    title: textField(raw.title, '发现标题', 120, { trim: true }),
    url: normalizeURL(raw.url),
    source: textField(raw.source, '来源说明', 120, { optional: true, trim: true }),
    evidence: textField(raw.evidence, '原文摘录', 3000, { optional: true }),
    understanding: textField(raw.understanding, '自己的理解', 3000, { optional: true }),
    nextStep: textField(raw.nextStep, '下一步', 1500, { optional: true }),
    status: raw.status,
    createdAt: isoDate(raw.createdAt, '创建时间'),
    updatedAt: isoDate(raw.updatedAt, '更新时间'),
    trashedAt: raw.trashedAt === null ? null : isoDate(raw.trashedAt, '移入回收站的时间'),
  };
}

function validateItems(items) {
  if (!Array.isArray(items)) throw new Error('发现库的 items 必须是记录数组');
  if (items.length > maximumItems) throw new Error('发现库最多保存 1000 条记录（包含回收站）');
  const ids = new Set();
  return items.map((raw, index) => {
    let item;
    try { item = validateFinding(raw); } catch (error) { throw new Error(`第 ${index + 1} 条发现：${error.message}`); }
    if (ids.has(item.id)) throw new Error(`第 ${index + 1} 条发现的编号重复，请先整理重复记录`);
    ids.add(item.id);
    return item;
  });
}

export function parseLibrary(text) {
  if (typeof text !== 'string') throw new Error('导入内容必须是 JSON 文字');
  let library;
  try { library = JSON.parse(text); } catch { throw new Error('发现库 JSON 已损坏或格式不正确'); }
  if (!isObject(library) || library.version !== 1) throw new Error('发现库格式或版本不支持，需要 version 为 1 的发现库');
  return { version: 1, items: validateItems(library.items) };
}

export function mergeLibraries(current, incoming) {
  const itemsById = new Map(validateItems(current).map((item) => [item.id, item]));
  const additions = validateItems(incoming);
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const item of additions) {
    const existing = itemsById.get(item.id);
    if (!existing) {
      if (itemsById.size >= maximumItems) throw new Error('合并后超过 1000 条记录（包含回收站），请先整理发现库');
      itemsById.set(item.id, item);
      added += 1;
    } else if (Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)) {
      itemsById.set(item.id, { ...item, createdAt: existing.createdAt });
      updated += 1;
    } else skipped += 1;
  }
  return { items: [...itemsById.values()], added, updated, skipped };
}

// Automatic research may be replayed after a reload; never overwrite personal notes.
export function appendResearchFindings(current, incoming) {
  const items = validateItems(current); const candidates = validateItems(incoming);
  const key = (value) => { const u=new URL(value);u.hostname=u.hostname.replace(/^www\./,'');u.hash='';u.pathname=u.pathname.replace(/\/+$/,'')||'/';for(const name of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(name))u.searchParams.delete(name);return u.href; };
  const ids=new Set(items.map(v=>v.id));const urls=new Set(items.map(v=>key(v.url)));let added=0,skipped=0;
  for(const item of candidates) {
    if(ids.has(item.id)||urls.has(key(item.url))){skipped++;continue;}
    if(items.length>=maximumItems)throw new Error('发现库已达1000条上限，本轮结果仍保留在研究记录中。');
    items.push(item);ids.add(item.id);urls.add(key(item.url));added++;
  }
  return {items,added,skipped};
}
