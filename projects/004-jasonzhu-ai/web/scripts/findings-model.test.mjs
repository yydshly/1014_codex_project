import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFinding, normalizeURL, parseLibrary, mergeLibraries, appendResearchFindings } from '../findings-model.js';

const makeFinding = (overrides = {}) => ({
  id: 'finding-1', kind: 'need', title: '反复核对订单',
  url: 'https://example.com/post?comment=20#reply-2', source: '社区求助',
  evidence: '原话：这一步每次都要重做。', understanding: '需要核实实际操作与频率。', nextStep: '回读后续回复。',
  status: 'todo', createdAt: '2026-10-16T01:00:00.000Z', updatedAt: '2026-10-16T02:00:00.000Z', trashedAt: null,
  ...overrides,
});

test('自动入库重复链接不覆盖用户修改，也不复活回收站记录',()=>{
 const current=[makeFinding({url:'https://www.example.com/post/?utm_source=test#reply',understanding:'我自己的判断',trashedAt:'2026-10-17T00:00:00.000Z'})];
 const incoming=[makeFinding({id:'auto-2',url:'https://example.com/post',understanding:'AI的新分析',updatedAt:'2026-10-18T00:00:00.000Z'})];
 const result=appendResearchFindings(current,incoming);assert.deepEqual(result.items,current);assert.equal(result.added,0);assert.equal(result.skipped,1);
});
test('自动入库可重放且整批校验，失败不改变原库',()=>{
 const current=[makeFinding()];const addition=makeFinding({id:'auto-2',url:'https://example.com/other'});
 const result=appendResearchFindings(current,[addition]);assert.equal(result.added,1);assert.equal(current.length,1);
 assert.equal(appendResearchFindings(result.items,[addition]).skipped,1);
 assert.throws(()=>appendResearchFindings(current,[addition,makeFinding({id:'bad',url:'javascript:1'})]));assert.equal(current.length,1);
 const full=Array.from({length:1000},(_,i)=>makeFinding({id:`item-${i}`,url:`https://example.com/${i}`}));assert.throws(()=>appendResearchFindings(full,[addition]),/1000/);assert.equal(full.length,1000);
});

test('来源网址规范化且保留用于定位评论的查询和片段', () => {
  assert.equal(normalizeURL(' HTTPS://EXAMPLE.COM:443/post?comment=20&sort=new#reply-2 '), 'https://example.com/post?comment=20&sort=new#reply-2');
  assert.equal(normalizeURL('http://example.com'), 'http://example.com/');
});

test('拒绝不安全协议、账号密码、控制字符和无效网址', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///test', 'ftp://example.com', '//example.com', 'example.com', 'https://user:pass@example.com', 'https://user@example.com', 'https://exa\nmple.com', 'not a url', '', null]) {
    assert.throws(() => normalizeURL(url), Error, String(url));
  }
});

test('记录只保留白名单字段，可选文字缺省为空且原话格式保留', () => {
  const raw = makeFinding({ title: '  一个标题  ', source: undefined, evidence: '  原话\n第二行  ', understanding: undefined, nextStep: undefined, secret: '不应导出' });
  const result = validateFinding(raw);
  assert.equal(result.title, '一个标题');
  assert.equal(result.source, '');
  assert.equal(result.evidence, raw.evidence);
  assert.equal(result.understanding, '');
  assert.equal(result.nextStep, '');
  assert.equal('secret' in result, false);
  assert.equal(raw.title, '  一个标题  ');
});

test('非法类型、状态、必填内容及非文字可选字段均被拒绝', () => {
  for (const invalid of [null, [], 'record', { kind: 'need' }]) assert.throws(() => validateFinding(invalid), Error);
  for (const overrides of [{ id: '' }, { id: 'a\nb' }, { kind: 'product' }, { kind: 1 }, { status: 'deleted' }, { title: ' ' }, { title: 1 }, { source: null }, { evidence: {} }, { understanding: [] }, { nextStep: false }, { trashedAt: undefined }]) {
    assert.throws(() => validateFinding(makeFinding(overrides)), Error, JSON.stringify(overrides));
  }
});

test('各文本字段按上限校验而不截断资料', () => {
  for (const [name, limit] of [['id', 160], ['title', 120], ['source', 120], ['evidence', 3000], ['understanding', 3000], ['nextStep', 1500]]) {
    assert.equal(validateFinding(makeFinding({ [name]: '字'.repeat(limit) }))[name].length, limit);
    assert.throws(() => validateFinding(makeFinding({ [name]: '字'.repeat(limit + 1) })), /不能超过/);
  }
  assert.throws(() => normalizeURL(`https://example.com/${'a'.repeat(2000)}`), /不能超过/);
});

test('时间必须为有效 ISO 日期，拒绝自动滚动的无效日期', () => {
  for (const value of ['昨天', '2026-02-30T01:00:00Z', '2026-13-01', '2026-01-01T24:00:00Z', '10/16/2026', 0, null]) {
    assert.throws(() => validateFinding(makeFinding({ updatedAt: value })), /ISO 日期/);
  }
  assert.equal(validateFinding(makeFinding({ updatedAt: '2026-10-16T10:00:00+08:00' })).updatedAt, '2026-10-16T02:00:00.000Z');
  assert.equal(validateFinding(makeFinding({ createdAt: '2024-02-29' })).createdAt, '2024-02-29T00:00:00.000Z');
});

test('导出再导入同构，并保留同网址的不同观察与回收站资料', () => {
  const library = { version: 1, items: [makeFinding(), makeFinding({ id: 'finding-2', kind: 'github', trashedAt: '2026-10-16T03:00:00.000Z' })] };
  const loaded = parseLibrary(JSON.stringify(library));
  assert.deepEqual(loaded, library);
  assert.deepEqual(parseLibrary(JSON.stringify(loaded)), loaded);
});

test('损坏库、错误版本、重复编号、非数组和超过1000条均拒绝', () => {
  for (const data of ['{', 'null', '[]', JSON.stringify({ version: 2, items: [] }), JSON.stringify({ version: '1', items: [] }), JSON.stringify({ version: 1, items: {} }), JSON.stringify({ version: 1, items: [makeFinding(), makeFinding()] })]) {
    assert.throws(() => parseLibrary(data), Error);
  }
  assert.throws(() => parseLibrary({ version: 1, items: [] }), /JSON 文字/);
  const items = Array.from({ length: 1001 }, (_, index) => makeFinding({ id: `item-${index}` }));
  assert.throws(() => parseLibrary(JSON.stringify({ version: 1, items })), /1000/);
});

test('同编号只接受较新修改并保留本地原始创建时间', () => {
  const current = makeFinding();
  const incoming = makeFinding({ title: '已补充证据', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T01:00:00Z', status: 'researching' });
  const result = mergeLibraries([current], [incoming]);
  assert.equal(result.items[0].title, incoming.title);
  assert.equal(result.items[0].createdAt, current.createdAt);
  assert.deepEqual({ added: result.added, updated: result.updated, skipped: result.skipped }, { added: 0, updated: 1, skipped: 0 });
  assert.equal(current.title, '反复核对订单');
});

test('旧修改和同一时间冲突不能覆盖已有资料', () => {
  for (const updatedAt of ['2026-10-16T01:30:00Z', '2026-10-16T10:00:00+08:00']) {
    const current = makeFinding();
    const result = mergeLibraries([current], [makeFinding({ title: '旧标题', updatedAt })]);
    assert.deepEqual(result.items, [current]);
    assert.deepEqual({ added: result.added, updated: result.updated, skipped: result.skipped }, { added: 0, updated: 0, skipped: 1 });
  }
});

test('同网址不同编号独立保留，较新删除状态也能合并', () => {
  const current = makeFinding();
  const incoming = [makeFinding({ id: 'finding-2' }), makeFinding({ updatedAt: '2026-10-17T01:00:00Z', trashedAt: '2026-10-17T01:00:00Z' })];
  const result = mergeLibraries([current], incoming);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].trashedAt, '2026-10-17T01:00:00.000Z');
  assert.equal(result.items[1].url, current.url);
  assert.deepEqual({ added: result.added, updated: result.updated, skipped: result.skipped }, { added: 1, updated: 1, skipped: 0 });
});

test('合并先拒绝重复编号或超量资料，失败不会改写输入库', () => {
  const current = Array.from({ length: 1000 }, (_, index) => makeFinding({ id: `item-${index}` }));
  const original = structuredClone(current);
  assert.throws(() => mergeLibraries(current, [makeFinding()]), /1000/);
  assert.deepEqual(current, original);
  assert.throws(() => mergeLibraries([makeFinding(), makeFinding()], []), /编号重复/);
  assert.throws(() => mergeLibraries([], [makeFinding(), makeFinding()]), /编号重复/);
  const result = mergeLibraries(current, [makeFinding({ id: 'item-0', updatedAt: '2026-10-17T01:00:00Z' })]);
  assert.equal(result.items.length, 1000);
  assert.equal(result.updated, 1);
});
