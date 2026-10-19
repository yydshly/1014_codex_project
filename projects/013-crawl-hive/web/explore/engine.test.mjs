import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitKeywords, matchesTerm, canonicalUrl, mergeItems,
  itemDate, evaluateItem, selectItems,
} from './engine.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const DAY = 86_400_000;
const dateAgo = days => new Date(NOW - days * DAY).toISOString();
const item = (id, overrides = {}) => ({
  id,
  title: 'AI product update',
  summary: '',
  topics: [],
  kind: 'news',
  sourceId: 'official',
  sourceName: '官方公告',
  url: `https://example.com/${id}`,
  publishedAt: dateAgo(1),
  ...overrides,
});

test('中英文逗号和换行都能分隔词表，去掉空白、空项和重复项', () => {
  assert.deepEqual(splitKeywords(' AI, agent，模型\n AI ,, 代码 ， '), ['AI', 'agent', '模型', '代码']);
  assert.deepEqual(splitKeywords(''), []);
  assert.deepEqual(splitKeywords(null), []);
  assert.equal(splitKeywords(Array.from({ length: 40 }, (_, i) => `term${i}`).join(',')).length, 30);
});

test('AI 匹配英文词边界，避免 chain、OpenAI 等子串误报', () => {
  for (const text of ['chain release', 'OpenAI model', 'daily updates']) {
    assert.equal(matchesTerm(text, 'AI'), false, text);
  }
  for (const text of ['AI release', 'a new ai tool', 'AI-powered editor', 'AI 编程']) {
    assert.equal(matchesTerm(text, ' AI '), true, text);
  }
  assert.equal(matchesTerm('AI release', ''), false);
});

test('通用资讯标签不会让 AI 关键词误命中所有条目', () => {
  const entry=item('tag-only',{title:'A chain update',topics:['ai-news','ai-products']});
  assert.equal(evaluateItem(entry,{include:'AI'}).pass,false);
  assert.equal(evaluateItem(entry,{exclude:'AI'}).pass,true);
});

test('中文词仍可匹配组合词，英文技术名中的符号按字面匹配', () => {
  assert.equal(matchesTerm('新的多模态模型', '模型'), true);
  assert.equal(matchesTerm('C++ coding assistant', 'C++'), true);
  assert.equal(matchesTerm('C-- coding assistant', 'C++'), false);
  assert.equal(matchesTerm('NodeXjs tool', 'Node.js'), false);
  assert.equal(matchesTerm('A Node.js tool', 'node.js'), true);
});

test('排除词优先于包含词和匹配度，不被任何包含模式覆盖', () => {
  const candidate = item('excluded', { title: 'AI agent recruiting notice' });
  for (const mode of ['any', 'all']) {
    const result = evaluateItem(candidate, { include: 'AI,agent', exclude: 'recruiting', mode }, NOW);
    assert.equal(result.pass, false);
    assert.match(result.reason, /排除词.*recruiting/);
  }
});

test('any 只需包含一词，all 要求所有词；空包含词不限制内容', () => {
  const candidate = item('one-word', { title: 'A coding assistant' });
  assert.equal(evaluateItem(candidate, { include: 'coding，video', mode: 'any' }, NOW).pass, true);
  assert.equal(evaluateItem(candidate, { include: 'coding，video', mode: 'all' }, NOW).pass, false);
  assert.equal(evaluateItem(candidate, { include: 'coding,assistant', mode: 'all' }, NOW).pass, true);
  assert.equal(evaluateItem(candidate, { include: '', mode: 'all' }, NOW).pass, true);
});

test('匹配可使用摘要、主题和仓库名，不要求所有线索都出现在标题', () => {
  const candidate = item('metadata', {
    title: 'New release',
    summary: 'A local coding assistant',
    topics: ['智能体'],
    repo: { fullName: 'example/agent-tool' },
  });
  assert.equal(evaluateItem(candidate, { include: 'coding，智能体，agent', mode: 'all' }, NOW).pass, true);
});

test('方向筛选只留下该方向内容，全部方向不额外要求匹配词', () => {
  const candidate = item('coding', { title: 'A coding assistant for developers' });
  assert.equal(evaluateItem(candidate, { direction: 'coding' }, NOW).pass, true);
  assert.equal(evaluateItem(candidate, { direction: 'multimodal' }, NOW).pass, false);
  assert.equal(evaluateItem(candidate, { direction: 'all' }, NOW).pass, true);
});

test('新闻、产品和仓库类型分别筛选，综合探索保留所有类型', () => {
  for (const kind of ['news', 'product', 'repo']) {
    const candidate = item(kind, { kind });
    assert.equal(evaluateItem(candidate, { goal: kind }, NOW).pass, true);
    assert.equal(evaluateItem(candidate, { goal: 'all' }, NOW).pass, true);
    assert.equal(evaluateItem(candidate, { goal: kind === 'news' ? 'repo' : 'news' }, NOW).pass, false);
  }
});

test('已停用来源和暂时隐藏的条目被排除，停用全部来源不回退成全选', () => {
  const candidate = item('hidden');
  assert.equal(evaluateItem(candidate, { enabledSources: ['community'] }, NOW).pass, false);
  assert.equal(evaluateItem(candidate, { enabledSources: [] }, NOW).pass, false);
  assert.equal(evaluateItem(candidate, { enabledSources: ['official'] }, NOW).pass, true);
  assert.equal(evaluateItem(candidate, { hiddenIds: ['hidden'] }, NOW).pass, false);
});

test('快速搜索的多个词必须全部匹配，AI 也不在搜索中误命中 chain', () => {
  const candidate = item('query', { title: 'An agent with code tools' });
  assert.equal(evaluateItem(candidate, { query: 'agent code' }, NOW).pass, true);
  assert.equal(evaluateItem(candidate, { query: 'agent video' }, NOW).pass, false);
  assert.equal(evaluateItem(item('chain', { title: 'chain release' }), { query: 'AI' }, NOW).pass, false);
});

test('时间筛选保留边界当天，排除过期、无有效日期和明显未来日期', () => {
  const filters = { days: 7 };
  assert.equal(evaluateItem(item('boundary', { publishedAt: dateAgo(7) }), filters, NOW).pass, true);
  assert.equal(evaluateItem(item('old', { publishedAt: new Date(NOW - 7 * DAY - 1).toISOString() }), filters, NOW).pass, false);
  assert.equal(evaluateItem(item('unknown', { publishedAt: 'not-a-date' }), filters, NOW).pass, false);
  assert.equal(evaluateItem(item('future', { publishedAt: new Date(NOW + 2 * DAY).toISOString() }), filters, NOW).pass, false);
});

test('开源项目按最近推送时间判断活跃度，缺失时回退更新时间与发布时间', () => {
  const active = item('active-repo', { kind: 'repo', publishedAt: dateAgo(90), updatedAt: dateAgo(20), repo: { pushedAt: dateAgo(1) } });
  assert.equal(itemDate(active), dateAgo(1));
  assert.equal(evaluateItem(active, { days: 7 }, NOW).pass, true);
  assert.equal(itemDate(item('updated-repo', { kind: 'repo', updatedAt: dateAgo(2) })), dateAgo(2));
  assert.equal(itemDate(item('published-repo', { kind: 'repo' })), dateAgo(1));
  assert.equal(itemDate(item('news-date', { updatedAt: dateAgo(0) })), dateAgo(1));
});

test('URL 去掉跟踪参数与锚点、统一参数顺序，但保留实质不同的页面参数', () => {
  assert.equal(canonicalUrl('https://example.com/post?b=2&utm_source=news&a=1#part'), canonicalUrl('https://example.com/post?a=1&b=2&fbclid=abc'));
  assert.equal(canonicalUrl('https://example.com/post/'), canonicalUrl('https://example.com/post'));
  assert.notEqual(canonicalUrl('https://example.com/post?page=1'), canonicalUrl('https://example.com/post?page=2'));
});

test('同一 URL 合并为一项并保留独立来源，同来源重复出现不重复计数', () => {
  const items = [
    item('primary', { url: 'https://example.com/shared?utm_source=official' }),
    item('secondary', { url: 'https://example.com/shared#discussion', sourceId: 'community', sourceName: '社区讨论' }),
    item('duplicate', { url: 'https://example.com/shared', sourceId: 'community', sourceName: '社区讨论' }),
    item('different'),
  ];
  const merged = mergeItems(items);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].sourceIds, ['official', 'community']);
  assert.deepEqual(merged[0].sourceNames, ['官方公告', '社区讨论']);
  assert.equal(items[0].sourceIds, undefined, '合并不应改写输入条目');
  assert.equal(selectItems(items, { enabledSources: ['community'] }, NOW).length, 1, '第二来源启用时仍应保留合并条目');
});

test('相关优先按词命中排序，同等相关时较新内容靠前', () => {
  const items = [
    item('recent-one-hit', { title: 'AI release', publishedAt: dateAgo(0) }),
    item('older-two-hits', { title: 'AI agent release', publishedAt: dateAgo(3) }),
    item('newer-two-hits', { title: 'AI agent tool', publishedAt: dateAgo(1) }),
  ];
  assert.deepEqual(selectItems(items, { include: 'AI,agent', sort: 'relevance' }, NOW).map(entry => entry.id), ['newer-two-hits', 'older-two-hits', 'recent-one-hit']);
  assert.deepEqual(items.map(entry => entry.id), ['recent-one-hit', 'older-two-hits', 'newer-two-hits'], '排序不应重排原输入');
});

test('最新优先忽略相关分高低，并使用仓库最近推送时间', () => {
  const items = [
    item('strong-older', { title: 'AI agent release', publishedAt: dateAgo(3) }),
    item('recent-news', { title: 'AI release', publishedAt: dateAgo(1) }),
    item('active-repo', { title: 'AI repository', kind: 'repo', publishedAt: dateAgo(90), repo: { pushedAt: dateAgo(0) } }),
  ];
  assert.deepEqual(selectItems(items, { include: 'AI,agent', sort: 'newest' }, NOW).map(entry => entry.id), ['active-repo', 'recent-news', 'strong-older']);
});
