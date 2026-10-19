import test from 'node:test';
import assert from 'node:assert/strict';
import { HeadStroke } from '../src/head-stroke.js';

test('不同头部尺寸的慢速来回轻抚都能触发，单向悬停滑过不会触发', () => {
  for (const width of [70, 160, 300]) {
    const stroke = new HeadStroke(), travel = width < 100 ? 15 : 30;
    assert.equal(stroke.move(100, 100, 0, width), false);
    assert.equal(stroke.move(100 + travel, 100, 180, width), false);
    assert.equal(stroke.move(100, 100, 380, width), true);
  }
});

test('轻抚可以竖向进行，明确按住头顶时单次慢滑也可以', () => {
  const stroke = new HeadStroke();
  stroke.move(50, 50, 0, 100);
  assert.equal(stroke.move(50, 70, 180, 100), false);
  assert.equal(stroke.move(50, 50, 400, 100), true);
  stroke.begin(50, 50, 1000);
  assert.equal(stroke.move(70, 50, 1260, 100, true), true);
});

test('微小抖动、快速挥过和短促左右甩动都不算轻抚', () => {
  const stroke = new HeadStroke();
  let count = 0;
  for (let i = 0; i < 100; i++) if (stroke.move(100 + (i % 2 ? 2 : -2), 100, i * 20, 100)) count++;
  assert.equal(count, 0);
  stroke.begin(0, 0, 3000);
  assert.equal(stroke.move(60, 0, 3010, 100), false);
  assert.equal(stroke.move(0, 0, 3020, 100), false);
  stroke.begin(0, 0, 4000);
  assert.equal(stroke.move(20, 0, 4100, 100), false);
  assert.equal(stroke.move(0, 0, 4200, 100), false);
});

test('离开、久停和重新接触不会继承上一次尚未完成的来回动作', () => {
  const stroke = new HeadStroke();
  stroke.move(100, 0, 0, 100); stroke.move(125, 0, 180, 100);
  stroke.reset();
  assert.equal(stroke.move(100, 0, 380, 100), false);
  stroke.move(125, 0, 560, 100);
  assert.equal(stroke.move(100, 0, 1800, 100), false);
  assert.equal(stroke.move(125, 0, 2000, 100), false);
  assert.equal(stroke.move(100, 0, 2220, 100), true);
});
