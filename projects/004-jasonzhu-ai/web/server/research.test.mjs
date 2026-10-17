import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { redditThread, parseAnalysis } from './research.mjs';

const report = JSON.parse(await readFile(new URL('../data/reddit-latest.json', import.meta.url), 'utf8'));
const originals = report.records.map((r) => r.source);
const sources = originals.map((r) => ({ url: r.url }));
const original = report.records[0];
const item = { source_url: original.source.url, title: original.source.title, ...original.analysis };
const run = (records, inputSources = sources, saved = originals) => parseAnalysis(JSON.stringify({ records }), inputSources, saved);

test('只允许真实 Reddit HTTPS 帖子，拒绝相似域名和携带认证信息的地址', () => {
  assert.equal(redditThread('https://reddit.com.evil.test/r/x/comments/abcd/'), null);
  assert.equal(redditThread('http://www.reddit.com/r/x/comments/abcd/'), null);
  assert.equal(redditThread('https://secret@reddit.com/r/x/comments/abcd/'), null);
  assert.equal(redditThread(original.source.url).id, original.source.id);
});
test('模型添加的未取得来源不能混入结果', () => {
  assert.equal(run([{ ...item, source_url: 'https://www.reddit.com/r/graphic_design/comments/unseen/example/' }]).length, 0);
});
test('问题引文必须存在于采集片段，排除生成的原话', () => {
  assert.equal(run([{ ...item, evidence: [{ quote: 'This sentence is a deliberately invented test quotation.' }] }]).length, 0);
});
test('没有证据支持的解决建议被排除，真实办法保留', () => {
  const rows = run([{ ...item, existing_solutions: [...item.existing_solutions, { name: 'fabricated test tool', quote: 'not present in the saved text' }] }]);
  assert.equal(rows[0].analysis.existing_solutions.length, item.existing_solutions.length);
  assert.equal(rows[0].analysis.grounding, 'excerpt_checked');
});
test('同一帖子不同链接只计算一次；API 引用不会标为原话已核对', () => {
  assert.equal(run([item, { ...item, source_url: `${original.source.url}?sort=new` }]).length, 1);
  assert.equal(run([item], sources, [])[0].analysis.grounding, 'citation_only');
});
test('本次保存的两条分析都能回到原始片段', () => {
  for (const record of report.records) {
    for (const e of [...record.analysis.evidence, ...record.analysis.existing_solutions]) {
      const norm = (s) => s.replace(/\s+/g, ' ').toLowerCase();
      assert.ok(norm(record.source.content).includes(norm(e.quote)), record.source.id);
    }
  }
});
