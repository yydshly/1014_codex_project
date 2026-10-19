import test from 'node:test';
import assert from 'node:assert/strict';
import { CompanionMemory, COMPANION_KEY, togetherTime } from '../src/companion-memory.js';
import { CompanionMotion } from '../src/companion-motion.js';

function setup() {
  let at = new Date(2026, 9, 14, 21).getTime();
  const data = new Map();
  const options = { now: () => at, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } };
  return { options, data, memory: new CompanionMemory(options), advance: ms => { at += ms; } };
}

test('自然陪伴只累计可见时间，暂停式离开不累计，睡眠长间隔有上限', () => {
  const { memory, advance } = setup();
  assert.equal(memory.enter(), false);
  advance(5000); memory.checkpoint();
  advance(2000); memory.leave();
  advance(90_000); memory.checkpoint();
  assert.equal(memory.state.totalMs, 7000);
  assert.equal(memory.enter(), true);
  advance(3000); memory.checkpoint();
  assert.equal(memory.sessionMs, 10_000);
  advance(8 * 60 * 60_000); memory.checkpoint();
  assert.equal(memory.state.totalMs, 25_000);
});

test('熟悉的招呼、安静偏好和小记刷新后保留，原专注数据不变', () => {
  const { memory, advance, options, data } = setup();
  data.set('night-voyage.focus.v1', 'existing-focus-records');
  memory.enter();
  for (let i = 0; i < 5; i++) {
    assert.equal(memory.greet(), true);
    assert.equal(memory.greet(), false);
    advance(4000); memory.checkpoint();
  }
  memory.setQuiet(true); memory.leave();
  const restored = new CompanionMemory(options);
  assert.equal(restored.familiar, true);
  assert.equal(restored.state.quiet, true);
  assert.equal(restored.state.greetings, 5);
  assert.equal(restored.state.totalMs, 20_000);
  assert.equal(restored.sessionMs, 0);
  assert.equal(restored.state.visits, 1);
  assert.equal(data.get('night-voyage.focus.v1'), 'existing-focus-records');
});

test('小记按天有界，累计时间不会随旧日子移出而丢失', () => {
  const { memory, advance } = setup();
  memory.enter();
  for (let day = 0; day < 35; day++) { advance(24 * 60 * 60_000); memory.checkpoint(); }
  assert.equal(memory.state.days.length, 30);
  assert.equal(memory.state.totalMs, 35 * 15_000);
  assert.equal(togetherTime(0), '不到 1 分钟');
  assert.equal(togetherTime(80 * 60_000), '1 小时 20 分钟');
});

test('损坏数据不覆盖，写入失败仍保留页面内相处', () => {
  const { options, data, advance } = setup();
  data.set(COMPANION_KEY, '{broken');
  const memory = new CompanionMemory(options);
  memory.enter(); advance(5000); memory.leave();
  assert.equal(memory.saved, false);
  assert.equal(memory.state.totalMs, 5000);
  assert.equal(data.get(COMPANION_KEY), '{broken');
  const full = new CompanionMemory({ now: () => 1000, storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } } });
  full.enter(); assert.equal(full.saved, false); assert.equal(full.active, true);
});

test('靠近需停留，视线平滑跟随，离开后自然回落；冻结时间不继续动作', () => {
  const motion = new CompanionMotion();
  motion.setAttention(1, 1, 0.5);
  let noticed = 0;
  for (let i = 0; i < 25; i++) if (motion.sample(i * 0.04, 0.04).noticed) noticed++;
  assert.equal(noticed, 1);
  assert.ok(motion.pose.lookX > 0.9);
  assert.ok(motion.pose.lift > 0.12);
  const before = { ...motion.sample(1, 0) };
  assert.deepEqual({ ...motion.sample(1, 0) }, before);
  motion.setAttention(0);
  for (let i = 0; i < 50; i++) motion.sample(1 + i * 0.04, 0.04);
  assert.ok(motion.pose.attention < 0.001);
  assert.ok(motion.pose.lift < 0.001);
});

test('熟悉后的点头与抬灯有限时，重置不留下姿势偏移', () => {
  const motion = new CompanionMotion();
  motion.cue('nod', 10, true);
  const pose = { ...motion.sample(10.6, 0) };
  assert.ok(pose.lift > 0);
  assert.equal(pose.eyes, 0.25);
  assert.ok(Math.abs(pose.nod) <= 0.065);
  motion.sample(14, 0.04);
  assert.equal(motion.pose.lift, 0);
  assert.equal(Math.abs(motion.pose.nod), 0);
  motion.reset();
  assert.equal(motion.sample(20, 0).kind, 'rest');
});

test('摸头会平滑缩身眯眼，暂停冻结，之后完整恢复', () => {
  const motion = new CompanionMotion({ random: () => 0.5 });
  motion.cue('pet', 10, true);
  const first = { ...motion.sample(10, 0) };
  assert.equal(first.tuck, 0);
  assert.equal(first.blush, 0);
  const tucked = { ...motion.sample(10.35, 0.035) };
  assert.equal(tucked.kind, 'pet');
  assert.ok(tucked.tuck > 0.95);
  assert.ok(tucked.eyes < 0.25);
  assert.ok(tucked.blush > 0.99);
  assert.deepEqual({ ...motion.sample(10.35, 0) }, tucked);
  const recovering = { ...motion.sample(11.1, 0.04) };
  assert.ok(recovering.tuck > 0 && recovering.tuck < tucked.tuck);
  const restored = motion.sample(12, 0.04);
  assert.equal(restored.tuck, 0);
  assert.equal(restored.eyes, 1);
  assert.ok(restored.blush > 0 && restored.blush < tucked.blush, '缩身恢复后脸红会继续缓缓消退');
  assert.equal(motion.sample(12.7, 0.04).blush, 0);
  motion.reset();
  assert.equal(motion.sample(0, 0).tuck, 0);
  assert.equal(motion.pose.blush, 0);
});

test('安静待着才偶尔缓慢眯眼，输入会唤醒，拖动和冻结不会启动待机动作', () => {
  const motion = new CompanionMotion({ random: () => 0 });
  assert.equal(motion.sample(17, 0.04).squint, 0);
  motion.sample(18, 0.04);
  const quiet = { ...motion.sample(19.4, 0.04) };
  assert.equal(quiet.kind, 'squint');
  assert.ok(quiet.eyes < 0.3);
  assert.equal(quiet.tuck, 0);
  assert.deepEqual({ ...motion.sample(19.4, 0) }, quiet);
  motion.wake(19.4);
  assert.equal(motion.sample(19.4, 0).eyes, 1);
  assert.equal(motion.sample(38, 0.04, true).squint, 0);
  assert.equal(motion.sample(58, 0).squint, 0);
  motion.sample(58, 0.04);
  assert.ok(motion.sample(59.4, 0.04).squint > 0.99);
  assert.equal(motion.sample(62, 0.04).squint, 0);
});

test('轻抚方向有柔和延迟，反向时不跳动；持续轻抚才会安心眯眼', () => {
  const motion = new CompanionMotion();
  assert.equal(motion.stroke(1, 0.4, 0), false, '未识别轻抚前仅移动不会跟随');
  assert.equal(motion.stroke(1, 0.4, 0, true), true);
  motion.cue('pet', 0);
  assert.equal(motion.sample(0, 0).strokeX, 0);
  for (let i = 1; i <= 200; i++) {
    const at = i * 0.025;
    const fresh = motion.stroke(i < 60 ? 1 : -1, 0.4, at, i % 20 === 0);
    assert.equal(fresh, false, '同一段轻抚只开始一次害羞动作');
    const before = motion.pose.strokeX;
    motion.sample(at, 0.025, true);
    assert.ok(Math.abs(motion.pose.strokeX - before) < 0.25);
    if (i === 40) { assert.ok(motion.pose.strokeX > 0.9); assert.equal(motion.pose.comfort, 0); }
    if (i === 60) assert.ok(motion.pose.strokeX > 0, '换向先缓缓回正');
  }
  assert.ok(motion.pose.strokeX < -0.99);
  assert.ok(motion.pose.comfort > 0.98);
  assert.equal(motion.pose.kind, 'content');
  assert.ok(motion.pose.eyes < 0.32);
  assert.ok(motion.pose.blush > 0 && motion.pose.blush < 0.3);
  assert.ok(motion.pose.nuzzle > 0 && motion.pose.nuzzle < 0.034);
  const frozen = { ...motion.pose };
  motion.endStroke();
  assert.deepEqual({ ...motion.sample(5, 0, true) }, frozen, '暂停清除输入但保持当前姿势');
  for (let i = 1; i <= 160; i++) motion.sample(5 + i * 0.025, 0.025);
  assert.ok(Math.abs(motion.pose.strokeX) < 0.001);
  assert.ok(motion.pose.nuzzle < 0.001);
  assert.ok(motion.pose.comfort < 0.001);
  assert.ok(motion.pose.eyes > 0.99);
  motion.reset();
  assert.equal(motion.sample(0, 0).nuzzle, 0);
});

test('静止按住、悬停抖动和断续抚摸不会累积出安心眯眼', () => {
  for (const mode of ['hold', 'jitter', 'interrupted']) {
    const motion = new CompanionMotion();
    motion.stroke(1, 0, 0, true);
    for (let i = 1; i <= 200; i++) {
      const at = i * 0.025;
      if (mode === 'jitter') motion.stroke(0.01, 0, at, false);
      if (mode === 'interrupted' && i % 80 === 0) motion.stroke(1, 0, at, true);
      motion.sample(at, 0.025, true);
    }
    assert.equal(motion.pose.comfort, 0, mode);
    if (mode !== 'interrupted') assert.ok(motion.pose.nuzzle < 0.001, mode);
  }
});

test('停手后轻轻目送离开方向，稍留片刻后完整恢复待机，冻结时不推进', () => {
  const motion = new CompanionMotion();
  for (let i = 0; i <= 200; i++) {
    const at = i * 0.025;
    motion.stroke(0.6, 0.1, at, i % 20 === 0);
    motion.sample(at, 0.025);
  }
  const before = { ...motion.pose };
  assert.equal(motion.releaseStroke(5, -0.8, 0.6), true);
  assert.equal(motion.pose.farewell, 0, '停手当下不跳姿势');
  for (let i = 1; i <= 32; i++) motion.sample(5 + i * 0.025, 0.025);
  const glance = { ...motion.pose };
  assert.equal(glance.kind, 'farewell');
  assert.ok(glance.farewell > 0.9);
  assert.ok(glance.lookX < -0.35 && glance.lookX > -0.5);
  assert.ok(glance.lookY > 0.2 && glance.lookY < 0.3);
  assert.ok(glance.eyes > before.eyes, '安心眯眼后缓缓睁眼目送');
  assert.equal(glance.attention, 0, '目送结束不继承旧的悬停凝视');
  assert.deepEqual({ ...motion.sample(5.8, 0) }, glance);
  for (let i = 1; i <= 160; i++) motion.sample(5.8 + i * 0.025, 0.025);
  assert.equal(motion.pose.kind, 'rest');
  assert.ok(motion.pose.farewell < 0.001);
  assert.ok(Math.abs(motion.pose.lookX) < 0.001);
  assert.ok(Math.abs(motion.pose.lookY) < 0.001);
  assert.ok(motion.pose.eyes > 0.99);
});

test('没有抬起事件的停手也只目送一次，短暂停顿不会误结束，再轻抚可平滑接回', () => {
  const motion = new CompanionMotion();
  motion.stroke(1, -0.4, 0, true);
  for (let i = 1; i <= 12; i++) motion.sample(i * 0.025, 0.025);
  assert.equal(motion.farewellSince, -100);
  motion.stroke(1, -0.4, 0.3);
  for (let i = 13; i <= 72; i++) motion.sample(i * 0.025, 0.025);
  assert.ok(motion.pose.farewell > 0.7);
  const since = motion.farewellSince;
  assert.ok(since >= 0.85 && since < 0.9);
  assert.equal(motion.releaseStroke(1.8, -1, 0), false);
  motion.sample(1.825, 0.025);
  assert.equal(motion.farewellSince, since);
  const previous = { ...motion.pose };
  assert.equal(motion.stroke(-1, 0, 1.85, true), true);
  const next = motion.sample(1.85, 0.025);
  assert.equal(motion.isSeeingOff(1.85), false);
  assert.ok(Math.abs(next.lookX - previous.lookX) < 0.1);
  assert.ok(next.farewell < previous.farewell);
  motion.reset();
  assert.equal(motion.sample(0, 0).farewell, 0);
});
