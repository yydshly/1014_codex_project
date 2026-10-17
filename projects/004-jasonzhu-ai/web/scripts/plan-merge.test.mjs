import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePlan, planFields } from '../plan-merge.js';

const blank = () => Object.fromEntries(planFields.map((name) => [name, '']));
const limits = { audience: 180, task: 600, current: 600, signals: 600, sources: 1800, nextQuestion: 300 };
const source = 'GitHub：https://github.com/\n检索：site:github.com client feedback README\n关注：现有项目';

test('adding an entry preserves every populated field and the original source text', () => {
  const current = Object.fromEntries(planFields.map((name) => [name, `  我的 ${name} 内容\n`]));
  const original = { ...current };
  const result = mergePlan(current, { audience: '新观察人群', task: '新任务', sources: source }, limits);
  for (const name of planFields.filter((field) => field !== 'sources')) assert.equal(result.values[name], current[name]);
  assert.equal(result.values.sources, `${current.sources}\n\n${source}`);
  assert.equal(result.sourceStatus, 'added');
  assert.deepEqual(current, original);
});

test('an entry fills only empty audience and task and does not invent other plan fields', () => {
  const current = { ...blank(), audience: '  ', current: '已有的办法' };
  const result = mergePlan(current, { audience: '设计师', task: '客户反馈', sources: source }, limits);
  assert.equal(result.values.audience, '设计师');
  assert.equal(result.values.task, '客户反馈');
  assert.equal(result.values.current, '已有的办法');
  assert.equal(result.values.signals, '');
  assert.deepEqual(result.filledFields, ['audience', 'task']);
});

test('browsing without a task keeps the plan task empty while preserving the selected entry', () => {
  const result = mergePlan(blank(), { task: '', sources: source }, limits);
  assert.equal(result.values.task, '');
  assert.equal(result.values.audience, '');
  assert.equal(result.values.sources, source);
  assert.deepEqual(result.filledFields, []);
});

test('loading an example fills blanks and appends its source without replacing existing research', () => {
  const current = { ...blank(), audience: '我研究的人群', task: '我研究的任务', sources: '已有原话与链接' };
  const example = Object.fromEntries(planFields.map((name) => [name, `示例 ${name}`]));
  const result = mergePlan(current, example, limits);
  assert.equal(result.values.audience, current.audience);
  assert.equal(result.values.task, current.task);
  assert.equal(result.values.sources, `${current.sources}\n\n${example.sources}`);
  for (const name of ['current', 'signals', 'nextQuestion']) assert.equal(result.values[name], example[name]);
});

test('adding the same entry or loading the same example twice does not duplicate sources', () => {
  const example = Object.fromEntries(planFields.map((name) => [name, `示例 ${name}`]));
  const first = mergePlan(blank(), example, limits);
  const second = mergePlan(first.values, example, limits);
  assert.deepEqual(second.values, first.values);
  assert.equal(second.sourceStatus, 'duplicate');
  assert.equal(second.changed, false);
  const refill = mergePlan({ ...first.values, task: '' }, example, limits);
  assert.equal(refill.sourceStatus, 'duplicate');
  assert.equal(refill.values.task, example.task);
  assert.equal(refill.changed, true);
});

test('a full source field rejects the entire merge without truncating or partially filling the plan', () => {
  const current = { ...blank(), sources: '原'.repeat(limits.sources) };
  const result = mergePlan(current, { task: '待填入任务', sources: source }, limits);
  assert.deepEqual(result.values, current);
  assert.equal(result.sourceStatus, 'full');
  assert.equal(result.changed, false);
});

test('source limits allow an exact fit and long additions never truncate field values', () => {
  const current = { ...blank(), sources: '旧' };
  const additions = { task: '很长的任务', sources: '新' };
  const result = mergePlan(current, additions, { ...limits, sources: 4, task: 2 });
  assert.equal(result.values.sources, '旧\n\n新');
  assert.equal(result.values.task, '');
  assert.equal(result.sourceStatus, 'added');
});
