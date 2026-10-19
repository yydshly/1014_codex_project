import test from 'node:test';
import assert from 'node:assert/strict';
import { FocusSession, FOCUS_STORAGE_KEY, countdown, duration } from '../src/focus-session.js';
import { FocusLights } from '../src/focus-lights.js';

function setup() {
  let time = 1_000_000;
  let sequence = 0;
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const options = { storage, now: () => time, id: () => `session-${++sequence}` };
  return { options, data, model: new FocusSession(options), advance: ms => { time += ms; } };
}

test('暂停和刷新保留已经专注的时间，恢复不计入休息时长', () => {
  const { model, options, advance } = setup();
  assert.equal(model.start('读书', 5), true);
  advance(12_300);
  model.pause();
  advance(120_000);
  const restored = new FocusSession(options);
  assert.equal(restored.elapsed(), 12_300);
  assert.equal(restored.state.active.runningSince, null);
  restored.resume();
  advance(27_700);
  const record = restored.stop();
  assert.equal(record.elapsedMs, 40_000);
  assert.equal(record.status, 'stopped');
  assert.deepEqual(restored.summary, { elapsedMs: 40_000, lights: 0 });
  assert.equal(new FocusSession(options).state.records[0].elapsedMs, 40_000);
});

test('后台和关闭后按真实时间完成，只点亮一次且不超过目标时长', () => {
  const { model, options, advance } = setup();
  model.start('写一段话', 1);
  advance(20_000);
  model.checkpoint();
  advance(4 * 60_000);
  const restored = new FocusSession(options);
  const record = restored.tick();
  assert.equal(record.status, 'completed');
  assert.equal(record.elapsedMs, 60_000);
  assert.equal(record.endedAt - record.startedAt, 60_000);
  assert.equal(restored.tick(), null);
  assert.equal(restored.stop(), null);
  assert.equal(new FocusSession(options).tick(), null);
  assert.equal(restored.summary.lights, 1);
  // Another open tab reads the completed state before it can complete again.
  assert.equal(model.tick(), null);
  assert.equal(model.summary.lights, 1);
});

test('期限边界点击暂停或提前结束仍算完成；暂停期间不自动完成', () => {
  const { model, advance } = setup();
  model.start('任务一', 1);
  advance(60_000);
  assert.equal(model.pause().status, 'completed');
  model.start('任务二', 1);
  advance(59_900);
  model.pause();
  advance(60_000);
  assert.equal(model.tick(), null);
  model.resume();
  advance(100);
  assert.equal(model.stop().status, 'completed');
  assert.equal(model.summary.lights, 2);
});

test('非完整分钟和空任务处理、并行任务保护与累计记录', () => {
  const { model, advance } = setup();
  assert.equal(model.start('无效', 0), false);
  assert.equal(model.start('无效', 1.5), false);
  assert.equal(model.start('无效', 181), false);
  assert.equal(model.start('  ', 1), true);
  assert.equal(model.state.active.title, '陪自己专注一会儿');
  assert.equal(model.start('覆盖原任务', 5), false);
  advance(1_234);
  model.stop();
  model.start('<img onerror="alert(1)">', 1);
  advance(60_000);
  model.tick();
  assert.equal(model.state.records.length, 2);
  assert.deepEqual(model.summary, { elapsedMs: 61_234, lights: 1 });
  assert.equal(model.state.records[0].title, '<img onerror="alert(1)">');
  assert.equal(countdown(59_999), '01:00');
  assert.equal(countdown(0), '00:00');
  assert.equal(duration(61_234), '1 分 1 秒');
});

test('本地保存失败仍可使用；损坏的旧记录不会被覆盖', () => {
  const broken = { getItem: () => '{broken', setItem: () => assert.fail('不可覆盖无法读取的旧记录') };
  const model = new FocusSession({ storage: broken, now: () => 1, id: () => 'memory' });
  assert.equal(model.saved, false);
  assert.equal(model.start('暂存', 1), true);
  model.stop();
  assert.equal(model.state.records.length, 1);
  const full = new FocusSession({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } }, now: () => 1, id: () => 'quota' });
  full.start('容量不足', 1);
  assert.equal(full.saved, false);
  assert.equal(full.state.active.title, '容量不足');
});

test('刷新中的时钟回拨不会产生负时长，记录按唯一编号去重', () => {
  const { model, options, advance, data } = setup();
  model.start('任务', 1);
  advance(-1000);
  assert.equal(model.elapsed(), 0);
  advance(61_000);
  model.tick();
  const saved = JSON.parse(data.get(FOCUS_STORAGE_KEY));
  saved.records.push(saved.records[0]);
  data.set(FOCUS_STORAGE_KEY, JSON.stringify(saved));
  assert.equal(new FocusSession(options).summary.lights, 1);
});

test('奖励灯实例固定容量、空记录不改变原场景、同一计数不重复更新', () => {
  const lights = new FocusLights(null);
  lights.setTotal(0);
  assert.equal(lights.visible, false);
  lights.setTotal(1);
  assert.equal(lights.bodies.count, 1);
  assert.equal(lights.glows.geometry.drawRange.count, 1);
  const first = Array.from(lights.glows.geometry.attributes.position.array.slice(0, 3));
  assert.equal(lights.setTotal(1), false);
  lights.setTotal(2);
  assert.deepEqual(Array.from(lights.glows.geometry.attributes.position.array.slice(0, 3)), first);
  lights.setTotal(200);
  assert.equal(lights.total, 200);
  assert.equal(lights.bodies.count, 32);
  assert.equal(lights.glows.geometry.drawRange.count, 32);
  assert.notDeepEqual(Array.from(lights.glows.geometry.attributes.position.array.slice(0, 3)), first);
  const geometries = new Set(), materials = new Set();
  lights.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
});
