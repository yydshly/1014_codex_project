import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUEST_TIMEOUT = 18_000;
const MAX_RESPONSE_BYTES = 2_600_000;
const RSS_LIMIT = 12;
const REPO_LIMIT = 6;
const MAX_RUNS = 20;
const TOPIC_LABELS = {
  'coding-agents': 'AI 编程与智能体', multimodal: '多模态',
  'llm-tools': '模型与开发工具', 'ai-news': 'AI 新闻', 'ai-products': 'AI 产品',
};

// Fixed queries deliberately avoid accepting arbitrary URLs or search expressions.
export const REPOSITORY_QUERIES = [
  { id: 'coding-agents', label: 'AI 编程智能体', query: 'topic:coding-agent archived:false' },
  { id: 'multimodal', label: '多模态项目', query: 'topic:multimodal archived:false' },
  { id: 'llm-tools', label: 'LLM 开发工具', query: 'topic:llm-tools archived:false' },
];

export const SOURCE_DEFINITIONS = [
  { id: 'huggingface', name: 'Hugging Face Blog', kind: 'rss', url: 'https://huggingface.co/blog/feed.xml',
    description: 'Hugging Face 官方站点博客订阅，包含官方及社区作者文章；取最近 12 条。' },
  { id: 'google-ai', name: 'Google AI Blog', kind: 'rss', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/',
    description: 'Google 官方 AI 新闻与产品更新；取最近 12 条。' },
  { id: 'github-blog', name: 'GitHub AI & ML Blog', kind: 'rss', url: 'https://github.blog/ai-and-ml/feed/',
    description: 'GitHub 官方 AI 与机器学习博客；取最近 12 条。' },
  { id: 'github-repos', name: 'GitHub 公开仓库', kind: 'github', url: 'https://api.github.com/search/repositories',
    description: '固定搜索 coding-agent、multimodal、llm-tools 三个 topic；每组按当前总星数取前 6 项，不代表新增或趋势。',
    queries: REPOSITORY_QUERIES.map(({ id, label, query }) => ({ id, label, query })) },
];

function publicSource(source) {
  return { ...source, checkedAt: null, status: 'idle', itemCount: 0 };
}

function emptyState() {
  return { version: 1, items: [], sources: SOURCE_DEFINITIONS.map(publicSource), lastUpdated: null, runs: [],
    capabilities: { live: true, analysis: 'rules' } };
}

function decodeEntities(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return named[entity.toLowerCase()] ?? whole;
  });
}

function plainText(value) {
  let text = String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Some feeds encode their HTML descriptions, including an encoded img tag.
  // Decode before stripping markup so both ordinary and escaped HTML stay text.
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodeEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tag(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'))?.[1] || '';
}

function safeUrl(value) {
  try {
    const url = new URL(decodeEntities(String(value).trim()));
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}

function dateOrNull(value) {
  if (!value || !String(value).trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function idFor(url) { return createHash('sha256').update(url).digest('hex').slice(0, 20); }
function excerpt(value) { return [...plainText(value)].slice(0, 200).join(''); }

function classify(title, summary, existing = []) {
  const text = `${title} ${summary}`.toLowerCase();
  const topics = new Set(existing);
  if (/\b(cod(e|ing|ex)|copilot|developer|agent(ic|s)?|software engineering)\b/.test(text)) topics.add('coding-agents');
  if (/\b(multimodal|vision|image|video|audio|speech|visual|diffusion)\b/.test(text)) topics.add('multimodal');
  if (/\b(llm|model|transformer|inference|training|framework|dataset|embedding|tool|benchmark)\b/.test(text)) topics.add('llm-tools');
  if (/\b(launch|introduc|releas|announc|new |available|update|gemini|copilot)/.test(text)) topics.add('ai-products');
  topics.add('ai-news');
  return [...topics];
}

function decorate(item) {
  return { ...item, topicLabels: item.topics.map(topic => TOPIC_LABELS[topic] || topic) };
}

export function parseRss(xml, source, collectedAt = new Date().toISOString()) {
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, RSS_LIMIT);
  if (!blocks.length) throw new Error('订阅响应没有可解析的 RSS 条目');
  const items = [];
  for (const [, block] of blocks) {
    const title = plainText(tag(block, 'title'));
    const url = safeUrl(plainText(tag(block, 'link')) || plainText(tag(block, 'guid')));
    if (!title || !url) continue;
    const summary = excerpt(tag(block, 'description') || tag(block, 'content:encoded'));
    const topics = classify(title, summary);
    const isProduct = topics.includes('ai-products');
    items.push(decorate({ id: idFor(url), title, url, summary, sourceId: source.id, sourceName: source.name,
      kind: isProduct ? 'product' : 'news', publishedAt: dateOrNull(plainText(tag(block, 'pubDate'))),
      collectedAt, topics, author: plainText(tag(block, 'dc:creator') || tag(block, 'author')) || undefined,
      evidence: '官方来源', summaryMethod: '来源原文摘录', stale: false,
      note: `${source.id === 'huggingface' ? '官方站点包含社区作者；文章观点属于原作者。' : ''}${isProduct ? '按标题与原文关键词识别为产品线索，尚未试用。' : '来源报道，未独立核验全部主张。'}`,
    }));
  }
  if (!items.length) throw new Error('订阅条目缺少有效标题或链接');
  return [...new Map(items.map(item => [item.id, item])).values()];
}

async function fetchLimited(url, accept) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: {
      Accept: accept, 'User-Agent': 'AI-Explorer-Research-Prototype/1.0',
      ...(url.startsWith('https://api.github.com/') ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}),
    } });
    if (!response.ok) {
      const limited = response.status === 403 || response.status === 429;
      throw new Error(`HTTP ${response.status}${limited ? '：公开接口可能触发限流，请稍后重试' : ''}`);
    }
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('响应超过 2.6 MB 上限');
    if (!response.body) throw new Error('来源返回空响应');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('响应超过 2.6 MB 上限'); }
      chunks.push(value);
    }
    return { text: Buffer.concat(chunks).toString('utf8'), bytes: size, finalUrl: response.url };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('请求超过 18 秒，已停止');
    if (error.message === 'fetch failed') throw new Error('网络连接失败');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function collectSource(source) {
  const collectedAt = new Date().toISOString();
  if (source.kind === 'rss') {
    const response = await fetchLimited(source.url, 'application/rss+xml, application/xml, text/xml');
    return { items: parseRss(response.text, source, collectedAt), requests: [{ url: source.url, finalUrl: response.finalUrl, status: 'ready', bytes: response.bytes }] };
  }
  const byId = new Map();
  const requests = [];
  for (const group of REPOSITORY_QUERIES) {
    const url = new URL('https://api.github.com/search/repositories');
    url.search = new URLSearchParams({ q: group.query, sort: 'stars', order: 'desc', per_page: String(REPO_LIMIT) }).toString();
    const response = await fetchLimited(url.href, 'application/vnd.github+json');
    const data = JSON.parse(response.text);
    if (!Array.isArray(data.items)) throw new Error('GitHub 响应缺少仓库列表');
    if (data.incomplete_results) throw new Error('GitHub 搜索暂未返回完整结果，请稍后重试');
    requests.push({ group: group.id, query: group.query, url: url.href, status: 'ready', count: Math.min(data.items.length, REPO_LIMIT), bytes: response.bytes });
    for (const repo of data.items.slice(0, REPO_LIMIT)) {
      const repoUrl = safeUrl(repo.html_url);
      if (!repoUrl) continue;
      const id = idFor(repoUrl);
      const previous = byId.get(id);
      const summary = excerpt(repo.description);
      const topics = [...new Set([...(previous?.topics || []), ...classify(repo.full_name, summary, [group.id]), 'ai-products'])];
      byId.set(id, decorate({ id, title: repo.full_name, url: repoUrl, summary, sourceId: source.id,
        sourceName: source.name, kind: 'repo', publishedAt: dateOrNull(repo.created_at),
        updatedAt: dateOrNull(repo.updated_at), collectedAt, topics, author: repo.owner?.login,
        searchGroups: [...new Set([...(previous?.searchGroups || []), group.id])], evidence: '仓库信息',
        summaryMethod: '仓库 description 原文', stale: false,
        repo: { fullName: repo.full_name, stars: repo.stargazers_count, language: repo.language || null,
          license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : null,
          pushedAt: dateOrNull(repo.pushed_at), createdAt: dateOrNull(repo.created_at), topics: (repo.topics || []).slice(0, 20) },
        note: '星数是采集时总数，不是增长量；发布日期显示仓库创建时间，更新时间不等于发布；尚未运行或试用。',
      }));
    }
  }
  return { items: [...byId.values()], requests };
}

function files(webRoot) {
  return { cache: path.join(webRoot, '.runtime', 'explore-state.json'), snapshot: path.join(webRoot, 'explore', 'snapshot.json') };
}

async function loadState(webRoot) {
  for (const location of [files(webRoot).cache, files(webRoot).snapshot]) {
    try {
      const saved = JSON.parse(await readFile(location, 'utf8'));
      if (saved.version !== 1 || !Array.isArray(saved.items) || !Array.isArray(saved.sources)) continue;
      const allowed = new Set(SOURCE_DEFINITIONS.map(source => source.id));
      return { ...emptyState(), ...saved, items: saved.items.filter(item => allowed.has(item.sourceId)),
        sources: SOURCE_DEFINITIONS.map(source => ({ ...publicSource(source), ...saved.sources.find(item => item.id === source.id), ...source })),
        runs: (saved.runs || []).slice(0, MAX_RUNS), capabilities: { live: true, analysis: 'rules' } };
    } catch { /* Missing cache or snapshot is a valid first run. */ }
  }
  return emptyState();
}

async function saveState(location, state) {
  await mkdir(path.dirname(location), { recursive: true });
  const temporary = `${location}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', 'utf8');
  await rename(temporary, location);
}

function selectedSources(sourceIds) {
  const ids = sourceIds?.length ? sourceIds : SOURCE_DEFINITIONS.map(source => source.id);
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !SOURCE_DEFINITIONS.some(source => source.id === id))) {
    throw new Error('只能选择预设来源');
  }
  return SOURCE_DEFINITIONS.filter(source => ids.includes(source.id));
}

async function runCollection({ webRoot, state, sourceIds, jobId = randomUUID(), onProgress = () => {} }) {
  const chosen = selectedSources(sourceIds);
  const run = { id: jobId, startedAt: new Date().toISOString(), finishedAt: null, status: 'running',
    sourceIds: chosen.map(source => source.id), results: [] };
  state.runs = [run, ...state.runs.filter(item => item.id !== jobId)].slice(0, MAX_RUNS);
  const progress = { running: true, jobId, done: 0, total: chosen.length,
    sources: chosen.map(source => ({ id: source.id, name: source.name, status: 'queued' })), lastUpdated: state.lastUpdated };
  onProgress(structuredClone(progress));
  await saveState(files(webRoot).cache, state);
  for (const source of chosen) {
    const current = progress.sources.find(item => item.id === source.id);
    current.status = 'running';
    onProgress(structuredClone(progress));
    const checkedAt = new Date().toISOString();
    try {
      const result = await collectSource(source);
      const collectedAt = new Date().toISOString();
      state.items = [...state.items.filter(item => item.sourceId !== source.id), ...result.items];
      state.sources = state.sources.map(item => item.id === source.id
        ? { ...publicSource(source), checkedAt, lastSuccessAt: collectedAt, status: 'ready', itemCount: result.items.length, stale: false }
        : item);
      state.lastUpdated = collectedAt;
      Object.assign(current, { status: 'ready', count: result.items.length });
      run.results.push({ sourceId: source.id, checkedAt, status: 'ready', count: result.items.length, requests: result.requests });
    } catch (error) {
      const message = String(error.message || '来源采集失败').slice(0, 180);
      state.items = state.items.map(item => item.sourceId === source.id ? { ...item, stale: true, staleReason: '本次来源采集失败，保留上次结果' } : item);
      state.sources = state.sources.map(item => item.id === source.id
        ? { ...item, checkedAt, status: 'error', error: message, stale: true, itemCount: state.items.filter(item => item.sourceId === source.id).length }
        : item);
      Object.assign(current, { status: 'error', error: message, count: state.items.filter(item => item.sourceId === source.id).length });
      run.results.push({ sourceId: source.id, checkedAt, status: 'error', error: message, retainedCount: current.count });
    }
    progress.done += 1;
    progress.lastUpdated = state.lastUpdated;
    await saveState(files(webRoot).cache, state);
    onProgress(structuredClone(progress));
  }
  run.finishedAt = new Date().toISOString();
  const errors = run.results.filter(item => item.status === 'error').length;
  run.status = errors === 0 ? 'ready' : errors === chosen.length ? 'error' : 'partial';
  run.itemCount = state.items.length;
  state.items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  await saveState(files(webRoot).cache, state);
  progress.running = false;
  onProgress(structuredClone(progress));
  return state;
}

/** Refresh preset public sources; used by both the API and snapshot command. */
export async function refreshExplorer({ webRoot, sourceIds, writeSnapshot = false, onProgress }) {
  const state = await loadState(webRoot);
  await runCollection({ webRoot, state, sourceIds, onProgress });
  if (writeSnapshot) await saveState(files(webRoot).snapshot, state);
  return state;
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error('请求内容超过 4 KB 上限');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw.trim() ? JSON.parse(raw) : {}; } catch { throw new Error('请求内容必须是 JSON'); }
}

/** Mount after the parent server strips its numbered project path. */
export function createExplorerApi({ webRoot }) {
  const stateReady = loadState(webRoot);
  let active = null;
  let status = { running: false, jobId: null, done: 0, total: 0, sources: [], lastUpdated: null };
  return async function handle(req, res, pathname) {
    if (!pathname.startsWith('/api/explore/')) return false;
    const endpoint = pathname.slice('/api/explore/'.length);
    const state = await stateReady;
    if (endpoint === 'state' && req.method === 'GET') {
      json(res, 200, state); return true;
    }
    if (endpoint === 'status' && req.method === 'GET') {
      json(res, 200, { ...status, lastUpdated: state.lastUpdated }); return true;
    }
    if (endpoint === 'refresh' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求内容必须是对象');
        if (body.sourceIds !== undefined && !Array.isArray(body.sourceIds)) throw new Error('sourceIds 必须是来源 ID 数组');
        selectedSources(body.sourceIds);
        if (active) { json(res, 202, { jobId: status.jobId, running: true }); return true; }
        const jobId = randomUUID();
        const chosen = selectedSources(body.sourceIds);
        status = { running: true, jobId, done: 0, total: chosen.length,
          sources: chosen.map(source => ({ id: source.id, name: source.name, status: 'queued' })), lastUpdated: state.lastUpdated };
        active = runCollection({ webRoot, state, sourceIds: body.sourceIds, jobId, onProgress: progress => { status = progress; } })
          .catch(() => { status = { ...status, running: false, error: '保存采集结果失败，请重试' }; })
          .finally(() => { active = null; });
        json(res, 202, { jobId, running: true });
      } catch (error) { json(res, 400, { error: error.message }); }
      return true;
    }
    json(res, ['state', 'status', 'refresh'].includes(endpoint) ? 405 : 404, { error: '接口或请求方法不存在' });
    return true;
  };
}
