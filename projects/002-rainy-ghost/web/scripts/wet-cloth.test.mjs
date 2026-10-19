import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WetCloth } from '../src/wet-cloth.js';
import { HemDrips } from '../src/hem-drips.js';

test('wet patches remain local, wrap around the cloth seam and freeze without simulation time', () => {
  const wet = new WetCloth();
  wet.deposit(new THREE.Vector2(0.995, 0.45));
  assert.ok(wet.sample(0.005, 0.45) > 0.3, 'both sides of the UV seam receive one continuous patch');
  assert.equal(wet.sample(0.5, 0.45), 0, 'the opposite side must stay dry');
  assert.ok(wet.coverage > 0 && wet.coverage < 0.08);
  const before = wet.field.slice();
  const flow = { ...wet.flows[0] };
  wet.advance(0);
  assert.deepEqual(wet.field, before);
  assert.deepEqual(wet.flows[0], flow);
  wet.dispose();
});

test('runoff travels downward from the hit, collects at the hem and resets completely', () => {
  const wet = new WetCloth();
  wet.deposit(new THREE.Vector2(0.3, 0.25));
  wet.advance(0.05);
  assert.equal(wet.takeDrip(), null, 'a head hit must not immediately drip from the hem');
  for (let i = 0; i < 95; i++) wet.advance(0.05);
  assert.ok(wet.sample(0.3, 0.9) > 0, 'runoff leaves a damp trail below the initial hit');
  const u = wet.takeDrip();
  assert.ok(u !== null && Math.abs(u - 0.3) < 0.05);
  wet.reset();
  assert.equal(wet.coverage, 0);
  assert.equal(wet.flows.length, 0);
  assert.equal(wet.takeDrip(), null);
  assert.ok(wet.field.every(value => value === 0));
  wet.dispose();
});

function dripsFixture() {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col <= 4; col++) {
    const angle = col / 4 * Math.PI * 2;
    positions.push(Math.sin(angle), 1 - row, Math.cos(angle));
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  body.position.set(2, 1, -1);
  body.rotation.z = 0.15;
  scene.add(body);
  scene.updateMatrixWorld(true);
  const wet = new WetCloth();
  wet.runoff[8] = 0.13;
  const impacts = [];
  const drips = new HemDrips(scene, body, { geometry, columns: 4, rows: 1 }, wet,
    (point, time) => impacts.push({ point: point.clone(), time }));
  return { scene, body, wet, drips, impacts };
}

test('drips start at the current deformed and transformed hem, freeze and land exactly once', () => {
  const { body, wet, drips, impacts } = dripsFixture();
  // A lifted corner must influence the source of the next drop.
  body.geometry.attributes.position.setY(6, 0.25);
  const u = 8.5 / 24;
  const expected = drips.sampleHem(u, new THREE.Vector3());
  drips.advance(1, 0.02);
  const drop = drips.pool.find(item => item.active);
  assert.ok(drop);
  assert.ok(Math.abs(drop.start.x - expected.x) < 0.00001);
  assert.ok(Math.abs(drop.start.y - (expected.y - 0.018)) < 0.00001);
  const matrixBefore = drips.mesh.instanceMatrix.array.slice();
  drips.advance(1, 0);
  assert.deepEqual(drips.mesh.instanceMatrix.array, matrixBefore);
  assert.equal(impacts.length, 0);
  const start = drop.start.clone(), velocity = drop.velocity.clone(), landingTime = drop.birth + drop.life;
  body.position.x += 5;
  body.updateMatrixWorld(true);
  drips.advance(landingTime + 0.01, 0.02);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].point.y, 0);
  assert.ok(Math.abs(impacts[0].point.x - (start.x + velocity.x * drop.life)) < 0.00001,
    'a detached drop stays in world space while the ghost is dragged');
  assert.equal(impacts[0].time, landingTime);
  drips.advance(landingTime + 0.1, 0.02);
  assert.equal(impacts.length, 1);
  drips.reset();
  assert.equal(drips.active, 0);
  assert.equal(drips.emitted, 0);
  assert.equal(drips.landed, 0);
  wet.dispose();
});
