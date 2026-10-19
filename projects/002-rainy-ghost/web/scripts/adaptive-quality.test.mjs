import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveQuality, qualitySettings } from '../src/adaptive-quality.js';
import { GhostScene } from '../src/scene.js';

function clock(mobile = false, onReport = () => {}) {
  const quality = new AdaptiveQuality(mobile, 0);
  const reports = [];
  let now = 0;
  return {
    quality, reports,
    get now() { return now; },
    frame(delta = 1000 / 60, work = 3, active = true) {
      now += delta;
      const report = quality.sample(now, work, active);
      if (report) { reports.push({ ...report, level: quality.level, now }); onReport(report); }
      return report;
    },
    run(seconds, fps = 60, work = 3) {
      for (let i = 0; i < Math.ceil(seconds * fps); i++) this.frame(1000 / fps, work);
    },
  };
}

test('phone starts conservatively; every tier retains rain, bloom and reflection within its pixel budget', () => {
  assert.equal(new AdaptiveQuality(true).level, 1);
  assert.equal(new AdaptiveQuality(false).level, 2);
  let previous = null;
  for (let level = 0; level < 3; level++) {
    const phone = qualitySettings(level, true, 390, 844, 3);
    const desktop = qualitySettings(level, false, 1280, 800, 2);
    assert.ok(phone.pixelRatio < desktop.pixelRatio);
    assert.ok(phone.rainCount >= 650 && phone.bloomScale > 0 && phone.reflectionSize >= 256);
    assert.ok(phone.clothHz >= 24 && phone.collisionHz >= 24);
    assert.ok(qualitySettings(level, true, 390, 844, 1).pixelRatio <= 1);
    if (previous) {
      assert.ok(phone.pixelRatio >= previous.pixelRatio);
      assert.ok(phone.rainCount > previous.rainCount);
    }
    previous = phone;
  }
  const large = qualitySettings(0, false, 3840, 2160, 2);
  assert.ok(3840 * 2160 * large.pixelRatio ** 2 <= 850001);
});

test('sustained slow RAF intervals downshift one tier at a time with a cooldown', () => {
  const c = clock();
  c.run(6, 40);
  assert.equal(c.quality.level, 1);
  c.run(5, 40);
  assert.equal(c.quality.level, 0);
  const changes = c.reports.filter(item => item.changed);
  assert.equal(changes.length, 2);
  assert.ok(changes[1].now - changes[0].now >= 4000);
  assert.ok(changes.every(item => Math.abs(item.fps - 40) < 0.01));
});

test('mobile presentation targets 60 fps on 60/90/120/144 Hz displays without a false 45 fps cap', () => {
  for (const refresh of [60, 90, 120, 144]) {
    const quality = new AdaptiveQuality(true);
    let presented = 0;
    for (let frame = 0; frame < refresh * 10; frame++) {
      if (quality.shouldRender(frame * 1000 / refresh, true)) presented++;
    }
    assert.ok(Math.abs(presented - 600) <= 1, `${refresh} Hz should present approximately 60 fps`);
    assert.equal(quality.shouldRender(10001, false), true, 'paused interactions bypass the presentation cap');
  }
});

test('mobile recovery requires sustained headroom and does not count paused or hidden time', () => {
  const c = clock(true);
  c.run(5, 20);
  assert.equal(c.quality.level, 0);
  c.frame(120000, 0, false);
  c.run(5, 60);
  assert.equal(c.quality.level, 0, 'time away cannot become recovery evidence');
  c.run(18, 60);
  assert.equal(c.quality.level, 1);
  c.run(22, 60, 11);
  assert.equal(c.quality.level, 1, 'a busy CPU does not have enough headroom to upgrade');
  c.run(22, 60);
  assert.equal(c.quality.level, 2);
});

test('a single hitch does not lower quality; a failed recovery probe backs off for a minute', () => {
  const steady = clock();
  steady.run(5);
  steady.frame(250);
  steady.run(3);
  assert.equal(steady.quality.level, 2);

  const c = clock();
  c.run(5, 20);
  while (!c.reports.some(item => item.reason === 'recovered')) c.frame();
  const recoveredAt = c.now;
  c.run(5, 20);
  assert.equal(c.quality.level, 1);
  assert.ok(c.quality.lastChange - recoveredAt < 10000);
  assert.ok(c.quality.upgradeBlockedUntil - c.quality.lastChange >= 60000);
  c.run(25);
  assert.equal(c.quality.level, 1);
});

test('controller downshifts propagate to renderer, postprocessing, reflector and matching GPU/CPU rain count', () => {
  const originalDpr = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 2, configurable: true });
  try {
    const canvas = { clientWidth: 1280, clientHeight: 800, width: 1280, height: 800 };
    const targets = {};
    const renderer = {
      setPixelRatio(value) { targets.dpr = value; },
      setSize(width, height) { canvas.width = Math.floor(width * targets.dpr); canvas.height = Math.floor(height * targets.dpr); },
    };
    let scene;
    const c = clock(false, report => { if (report.changed) scene.applyQuality(report.reason); });
    scene = Object.assign(Object.create(GhostScene.prototype), {
      canvas, renderer, quality: c.quality, time: 3,
      rain: 1, lightOn: true, wetness: 0.6,
      composer: { setPixelRatio(value) { targets.composerDpr = value; }, setSize() {} },
      bloom: { setSize(width, height) { targets.bloom = [width, height]; } },
      water: { getRenderTarget: () => ({ setSize(width) { targets.reflection = width; } }) },
      waterUniforms: { uRainDetail: { value: 2 } },
      rainLines: { geometry: { setDrawRange(start, count) { targets.rainVertices = count; }, attributes: { aStopHeight: {} } } },
      rainStops: new Float32Array(3600).fill(-100),
      rainReaction: { particleUniforms: { uHeight: { value: 800 } } },
      onEvent(type, detail) { if (type === 'quality') targets.report = detail; },
      invalidate() {},
    });
    scene.applyQuality('startup');
    const highDpr = targets.dpr;
    c.run(10, 25);
    assert.equal(c.quality.level, 0);
    assert.ok(targets.dpr < highDpr);
    assert.equal(targets.composerDpr, targets.dpr);
    assert.equal(targets.reflection, 384);
    assert.equal(targets.rainVertices, scene.activeRainCount * 2);
    assert.equal(scene.activeRainCount, 900);
    assert.equal(scene.waterUniforms.uRainDetail.value, 0);
    assert.ok(targets.bloom[0] > 0 && targets.bloom[0] < canvas.width);
    assert.equal(scene.rain, 1);
    assert.equal(scene.lightOn, true);
    assert.equal(scene.wetness, 0.6);
  } finally {
    if (originalDpr) Object.defineProperty(globalThis, 'devicePixelRatio', originalDpr);
    else delete globalThis.devicePixelRatio;
  }
});
