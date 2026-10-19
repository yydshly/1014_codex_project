import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GhostScene } from '../src/scene.js';
import { HeadStroke } from '../src/head-stroke.js';
import { CompanionMotion } from '../src/companion-motion.js';
import { CompanionUI } from '../src/companion-ui.js';

function setup(y = 2.1) {
  const events = [], captures = new Set();
  const ghost = new THREE.Group(), body = new THREE.Mesh(), lantern = new THREE.Group();
  const lamp = new THREE.Mesh(); lantern.add(lamp); ghost.add(body, lantern);
  ghost.position.set(1.05, 0.9, -0.3); ghost.rotation.set(0.1, 0.6, 0.03); ghost.scale.set(1.04, 0.91, 1.03);
  ghost.updateMatrixWorld(true);
  const hit = { object: body, point: ghost.localToWorld(new THREE.Vector3(0.1, y, 0.4)) };
  const scene = Object.assign(Object.create(GhostScene.prototype), {
    ghost, body, lantern, pickTargets: [body, lamp], target: new THREE.Vector3(),
    hitPoint: new THREE.Vector3(), pullTarget: new THREE.Vector3(), pullPoint: new THREE.Vector3(),
    pull: new THREE.Vector3(), pullVelocity: new THREE.Vector3(), dragPlane: new THREE.Plane(),
    raycaster: { intersectObjects: () => [hit], ray: { intersectPlane: (_, point) => point.copy(hit.point).add(new THREE.Vector3(0.4, 0.1, 0)) } },
    camera: new THREE.PerspectiveCamera(), controls: { enabled: true }, headStroke: new HeadStroke(), strokeCenter: new THREE.Vector3(),
    companionMotion: new CompanionMotion(),
    strokeRight: new THREE.Vector3(), strokeUp: new THREE.Vector3(), strokeForward: new THREE.Vector3(), strokeRotation: new THREE.Quaternion(), strokeDeparture: new THREE.Vector2(),
    canvas: { clientHeight: 800, clientWidth: 1280, getBoundingClientRect: () => ({ left: 0, top: 0 }), dataset: {}, focus() {}, classList: { add() {}, remove() {} }, setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) },
    time: 10, lastPet: -Infinity, lastStrokeVoice: -Infinity, paused: false, hidden: false, drag: null,
    onEvent: (type, detail) => events.push({ type, detail }),
    stopCameraMotion() {}, setPointer() {}, invalidate() {}, updateCompanionAttention() {},
  });
  scene.camera.position.set(0, 3, 10);
  const pointer = (x = 100, extra = {}) => ({ pointerId: 1, clientX: x, clientY: 100, timeStamp: 1000, buttons: 0, isPrimary: true, button: 0, pointerType: 'mouse', stopImmediatePropagation() {}, ...extra });
  return { scene, events, hit, lamp, pointer };
}

test('旋转、缩身后的头顶仍按角色局部位置识别；点击头顶摸头，点身体打招呼', () => {
  for (const [height, expected] of [[2.1, 'pet'], [1.4, 'greet']]) {
    const { scene, events, pointer } = setup(height);
    scene.pointerDown(pointer()); scene.pointerUp(pointer());
    assert.equal(events.filter(event => event.type === expected).length, 1);
    assert.equal(scene.controls.enabled, true);
  }
});

test('轻微触摸不挪动角色，身体越过阈值仍可拖动，松手不会误打招呼或摸头', () => {
  const { scene, events, pointer } = setup(1.4);
  scene.pointerDown(pointer()); scene.pointerMove(pointer(106));
  assert.equal(scene.target.length(), 0);
  scene.pointerUp(pointer(106));
  assert.equal(events.filter(e => e.type === 'greet').length, 1);
  scene.time += 3;
  scene.pointerDown(pointer()); scene.pointerMove(pointer(118));
  assert.ok(scene.target.length() > 0);
  scene.pointerUp(pointer(118));
  assert.equal(events.filter(e => e.type === 'greet').length, 1);
  assert.equal(events.filter(e => e.type === 'pet').length, 0);
});

test('鼠标不按键在头顶慢慢来回能轻抚，单次掠过不会摸头', () => {
  const { scene, events, pointer } = setup();
  scene.pointerMove(pointer(100));
  scene.pointerMove(pointer(127, { timeStamp: 1180 }));
  assert.equal(events.some(e => e.type === 'pet'), false);
  scene.pointerMove(pointer(101, { timeStamp: 1380 }));
  assert.equal(events.filter(e => e.type === 'pet').length, 1);
  assert.equal(scene.target.length(), 0);
  assert.equal(scene.canvas.dataset.hitTarget, 'head');
});

test('单指在头顶轻抚期间会回应，角色与镜头都不会被拖走，松手不重复摸头', () => {
  const { scene, events, pointer } = setup();
  scene.pointerDown(pointer(100, { pointerType: 'touch' }));
  scene.pointerMove(pointer(128, { timeStamp: 1250, pointerType: 'touch' }));
  assert.equal(events.filter(e => e.type === 'pet').length, 1);
  assert.equal(scene.target.length(), 0);
  assert.equal(scene.controls.enabled, false);
  scene.pointerUp(pointer(128, { timeStamp: 1260, pointerType: 'touch' }));
  assert.equal(events.filter(e => e.type === 'pet').length, 1);
  assert.equal(scene.controls.enabled, true);
});

test('离开头部、快速滑动、多指和暂停会阻断未完成的轻抚', () => {
  for (const mode of ['leave', 'fast', 'multi', 'pause']) {
    const { scene, events, hit, pointer } = setup();
    scene.pointerDown(pointer());
    if (mode === 'leave') hit.point.copy(scene.ghost.localToWorld(new THREE.Vector3(0.1, 1.3, 0.4)));
    if (mode === 'multi') scene.pointerDown(pointer(110, { pointerId: 2, isPrimary: false }));
    if (mode === 'pause') scene.paused = true;
    scene.pointerMove(pointer(130, { timeStamp: mode === 'fast' ? 1010 : 1300 }));
    scene.pointerUp(pointer(130));
    assert.equal(events.filter(e => e.type === 'pet').length, 0, mode);
    assert.equal(scene.target.length(), 0, mode);
  }
});

test('人物各部位提供不同鼠标目标：头部、身体、衣角、提灯和背景', () => {
  for (const [height, kind] of [[2.1, 'head'], [1.4, 'ghost'], [0.4, 'hem']]) {
    const { scene, pointer } = setup(height);
    scene.pointerMove(pointer());
    assert.equal(scene.canvas.dataset.hitTarget, kind);
  }
  const { scene, hit, lamp, pointer } = setup();
  hit.object = lamp; scene.pointerMove(pointer());
  assert.equal(scene.canvas.dataset.hitTarget, 'lamp');
  scene.raycaster.intersectObjects = () => []; scene.pointerMove(pointer());
  assert.equal(scene.canvas.dataset.hitTarget, 'background');
});

test('按住头顶轻抚期间允许害羞动作，身体拖动中则不被陪伴动作打断', () => {
  const { scene } = setup();
  const cues = [];
  scene.companionMotion.cue = kind => cues.push(kind);
  scene.drag = { kind: 'head' };
  scene.reactToCompanion('pet', true);
  scene.reactToCompanion('approach', true);
  assert.deepEqual(cues, ['pet']);
  scene.drag.kind = 'ghost';
  scene.reactToCompanion('pet', true);
  assert.deepEqual(cues, ['pet']);
  scene.drag.kind = 'head'; scene.drag.multi = true;
  scene.reactToCompanion('pet', true);
  assert.deepEqual(cues, ['pet']);
});

test('触屏轻点可摸头，取消、多指和位移后的松手都不会误触', () => {
  for (const mode of ['tap', 'cancel', 'multi', 'release-moved']) {
    const { scene, events, pointer } = setup();
    scene.pointerDown(pointer(100, { pointerType: 'touch' }));
    if (mode === 'multi') scene.pointerDown(pointer(102, { pointerType: 'touch', pointerId: 2, isPrimary: false }));
    scene.pointerUp(pointer(mode === 'release-moved' ? 120 : 100, { pointerType: 'touch' }), mode === 'cancel');
    assert.equal(events.some(e => e.type === 'pet'), mode === 'tap');
  }
});

test('摸头有动作冷却，暂停、后台或拖动中不触发；键盘 H 不响应按住连发', () => {
  const { scene, events } = setup();
  assert.equal(scene.petHead(), true);
  scene.time += 1;
  assert.equal(scene.petHead(), false);
  scene.time += 2;
  scene.paused = true; assert.equal(scene.petHead(), false);
  scene.paused = false; scene.hidden = true; assert.equal(scene.petHead(), false);
  scene.hidden = false; scene.drag = {}; assert.equal(scene.petHead(), false);
  scene.drag = null;
  scene.keyDown({ key: 'h', repeat: true });
  assert.equal(events.filter(e => e.type === 'pet').length, 1);
  scene.keyDown({ key: 'h', repeat: false });
  assert.equal(events.filter(e => e.type === 'pet').length, 2);
});

test('真实节奏的鼠标与单指来回轻抚会从害羞变安心，一段只轻叫一次', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const { scene, events, pointer } = setup();
    const record = scene.onEvent;
    scene.onEvent = (type, detail) => { record(type, detail); if (type === 'pet') scene.reactToCompanion('pet', true); };
    if (pointerType === 'touch') scene.pointerDown(pointer(100, { pointerType }));
    for (let i = 0; i <= 240; i++) {
      scene.time = 10 + i * 0.025;
      scene.pointerMove(pointer(100 + 28 * Math.sin(i * 0.025 * Math.PI * 2), { pointerType, timeStamp: 1000 + i * 25 }));
      scene.companionMotion.sample(scene.time, 0.025, pointerType === 'touch');
    }
    const pets = events.filter(event => event.type === 'pet');
    assert.equal(pets.length, 1, pointerType);
    assert.equal(pets[0].detail.sound, true);
    assert.equal(scene.companionMotion.pose.kind, 'content');
    assert.ok(scene.companionMotion.pose.eyes < 0.35);
    assert.equal(scene.target.length(), 0);
    scene.stopHeadStroke();
    for (let i = 1; i <= 160; i++) scene.companionMotion.sample(16 + i * 0.025, 0.025);
    assert.ok(scene.companionMotion.pose.nuzzle < 0.001);
    assert.ok(scene.companionMotion.pose.comfort < 0.001);
  }
});

test('重新轻抚的叫声至少间隔十二秒，按钮仍使用原来的主动回应', () => {
  const { scene, events } = setup();
  const sounds = [], reactions = [];
  const ui = Object.assign(Object.create(CompanionUI.prototype), {
    memory: { familiar: true }, panel: { dataset: {} }, hideBubble() {}, announce() {},
    react: kind => reactions.push(kind), onSound: kind => sounds.push(kind),
  });
  scene.onEvent = (type, detail) => { events.push({ type, detail }); if (type === 'pet') ui.pet(detail); };
  scene.petHead({ stroke: true });
  scene.time = 13; scene.petHead({ stroke: true });
  scene.time = 23; scene.petHead({ stroke: true });
  assert.deepEqual(events.map(e => e.detail.sound), [true, false, true]);
  assert.equal(reactions.length, 3);
  assert.equal(sounds.length, 2);
  scene.time = 26; scene.petHead();
  assert.equal(sounds.length, 3);
});

test('转过镜头后仍向屏幕中手势的方向轻歪与轻蹭，不改变身体拖动目标', () => {
  const { scene } = setup();
  for (const angle of [0, 0.8, -1.3, Math.PI]) {
    scene.camera.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10);
    scene.camera.lookAt(0, 1.8, 0); scene.camera.updateMatrixWorld(true);
    scene.ghost.position.set(0, 1, 0); scene.ghost.quaternion.identity();
    const before = scene.ghost.localToWorld(new THREE.Vector3(0, 2, 0)).project(scene.camera);
    scene.applyStrokePose({ strokeX: 1, strokeY: 0.5, nuzzle: 0.03 });
    scene.ghost.updateMatrixWorld(true);
    const after = scene.ghost.localToWorld(new THREE.Vector3(0, 2, 0)).project(scene.camera);
    assert.ok(after.x > before.x, `镜头角度 ${angle} 时仍向右`);
    assert.ok(after.x - before.x < 0.06, '保持轻微幅度');
    assert.equal(scene.target.length(), 0);
    assert.ok(scene.ghost.quaternion.angleTo(new THREE.Quaternion()) < 0.08);
  }
});

test('害羞缩身不会把头顶从手下移走，离开原头部区域仍会结束；新按身体仍拖动', () => {
  const { scene, hit, pointer } = setup(1.4);
  scene.strokeAnchor = { x: 100, y: 100, width: 100 };
  scene.companionMotion.stroke(0, 0, 10, true);
  assert.equal(scene.pickStrokeKind(undefined, pointer(110)), 'head');
  assert.equal(scene.pickStrokeKind(hit, pointer(110)), 'head');
  assert.equal(scene.pickStrokeKind(hit, pointer(110, { clientY: 150 })), 'ghost');
  scene.pointerDown(pointer());
  assert.equal(scene.drag.kind, 'ghost');
  assert.equal(scene.strokeAnchor, null);
  assert.equal(scene.companionMotion.isStroking(scene.time), false);
});

test('鼠标离开头部时轻轻目送最后离开的方向，后续移动不会重启，也不新增声音事件', () => {
  for (const direction of [-1, 1]) {
    const { scene, pointer, events } = setup();
    scene.pointerMove(pointer());
    scene.time = 10.18; scene.pointerMove(pointer(127, { timeStamp: 1180 }));
    scene.time = 10.38; scene.pointerMove(pointer(101, { timeStamp: 1380 }));
    assert.equal(events.filter(e => e.type === 'pet').length, 1);
    scene.raycaster.intersectObjects = () => [];
    scene.time = 10.4; scene.pointerMove(pointer(101 + direction * 200, { timeStamp: 1400 }));
    const since = scene.companionMotion.farewellSince;
    for (let i = 1; i <= 32; i++) scene.companionMotion.sample(10.4 + i * 0.025, 0.025);
    assert.equal(Math.sign(scene.companionMotion.pose.farewellX), direction);
    assert.ok(scene.companionMotion.pose.farewell > 0.9);
    scene.time = 11.2; scene.pointerMove(pointer(101 - direction * 200, { timeStamp: 2200 }));
    assert.equal(scene.companionMotion.farewellSince, since);
    assert.equal(events.filter(e => !['hover', 'pet'].includes(e.type)).length, 0);
    assert.equal(events.filter(e => e.type === 'pet').length, 1);
    assert.equal(scene.target.length(), 0);
  }
});

test('单指抬起沿最后轻抚方向目送；取消、多指、暂停和后台不产生目送', () => {
  for (const mode of ['release-left', 'release-right', 'cancel', 'multi', 'pause', 'hidden']) {
    const { scene, pointer, events } = setup();
    const travel = mode === 'release-left' ? 72 : 128;
    scene.pointerDown(pointer(100, { pointerType: 'touch' }));
    scene.time = 10.25;
    scene.pointerMove(pointer(travel, { timeStamp: 1250, pointerType: 'touch' }));
    assert.equal(events.filter(e => e.type === 'pet').length, 1);
    if (mode === 'multi') scene.pointerDown(pointer(100, { pointerType: 'touch', pointerId: 2 }));
    if (mode === 'pause') scene.paused = true;
    if (mode === 'hidden') scene.hidden = true;
    scene.pointerUp(pointer(travel, { timeStamp: 1260, pointerType: 'touch' }), mode === 'cancel');
    for (let i = 1; i <= 32; i++) scene.companionMotion.sample(10.25 + i * 0.025, 0.025);
    const expected = mode.startsWith('release');
    assert.equal(scene.companionMotion.pose.farewell > 0.9, expected, mode);
    if (expected) assert.equal(Math.sign(scene.companionMotion.pose.farewellX), mode === 'release-left' ? -1 : 1);
    assert.equal(events.filter(e => e.type === 'pet').length, 1, '松手只目送，不再叫');
    assert.equal(scene.controls.enabled, true);
  }
});

test('目送时注意力不会被旧的鼠标位置留住；重新抓取身体会退出目送', () => {
  const { scene, pointer, hit } = setup(1.4);
  scene.companionMotion.stroke(1, 0, 10, true);
  scene.companionMotion.releaseStroke(10, 1, 0);
  for (let i = 1; i <= 32; i++) scene.companionMotion.sample(10 + i * 0.025, 0.025);
  scene.time = 10.8;
  // Use the real attention method: it must return before touching the ray.
  GhostScene.prototype.updateCompanionAttention.call(scene);
  assert.equal(scene.companionMotion.target, 0);
  scene.pointerDown(pointer());
  assert.equal(scene.drag.kind, 'ghost');
  assert.equal(scene.companionMotion.isSeeingOff(scene.time), false);
  assert.equal(scene.companionMotion.strokeSession, false);
  assert.equal(scene.pickKind(hit), 'ghost');
});

test('目送的偏头幅度比轻抚更小，换视角后方向一致；暂停清除输入而不跳姿势', () => {
  const { scene } = setup();
  for (const angle of [0, 1.2, Math.PI]) {
    scene.camera.position.set(Math.sin(angle) * 10, 3, Math.cos(angle) * 10);
    scene.camera.lookAt(0, 1.8, 0); scene.camera.updateMatrixWorld(true);
    scene.ghost.position.set(0, 1, 0); scene.ghost.quaternion.identity();
    const before = scene.ghost.localToWorld(new THREE.Vector3(0, 2, 0)).project(scene.camera);
    scene.applyStrokePose({ strokeX: 0, strokeY: 0, nuzzle: 0, farewellX: 0.8, farewellY: 0.2 });
    scene.ghost.updateMatrixWorld(true);
    const after = scene.ghost.localToWorld(new THREE.Vector3(0, 2, 0)).project(scene.camera);
    assert.ok(after.x > before.x && after.x - before.x < 0.02);
    assert.ok(scene.ghost.quaternion.angleTo(new THREE.Quaternion()) < 0.02);
    assert.equal(scene.target.length(), 0);
  }
  scene.companionMotion.stroke(1, 0, 10, true);
  scene.companionMotion.releaseStroke(10, 1, 0);
  for (let i = 1; i <= 32; i++) scene.companionMotion.sample(10 + i * 0.025, 0.025);
  const frozen = { ...scene.companionMotion.pose };
  scene.paused = true; scene.stopHeadStroke();
  assert.deepEqual({ ...scene.companionMotion.sample(10.8, 0) }, frozen);
  assert.equal(scene.companionMotion.isSeeingOff(10.8), false);
});
