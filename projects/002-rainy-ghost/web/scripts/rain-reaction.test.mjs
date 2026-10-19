import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RainReaction } from '../src/rain-reaction.js';

function fixture() {
  const scene = new THREE.Scene();
  const ghost = new THREE.Group();
  const cloth = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), cloth);
  body.position.y = 1.8;
  ghost.add(body);
  scene.add(ghost);
  const reaction = new RainReaction(scene, ghost, body, cloth);
  scene.updateMatrixWorld(true);
  return { scene, ghost, body, cloth, reaction, stops: new Float32Array(2).fill(-100) };
}

test('a falling drop collides with the actual mesh once and is stopped until its next fall', () => {
  const { reaction, stops } = fixture();
  const seed = new Float32Array([0, 3, 0, 0.4]);
  assert.equal(reaction.traceRain(seed, stops, 0, 0.3, 1), true);
  assert.equal(reaction.hitCount, 1);
  assert.ok(stops[0] > 2.2 && stops[0] < 2.31);
  assert.equal(stops[0], stops[1], 'both vertices must disappear below contact');
  reaction.traceRain(seed, stops, 0.3, 0.4, 1);
  assert.equal(reaction.hitCount, 1, 'an absorbed drop cannot hit twice');
  reaction.traceRain(seed, stops, 0.4, 1.7, 1);
  assert.equal(stops[0], -100, 'wrapping to the top reactivates the drop');
  reaction.traceRain(seed, stops, 1.7, 2, 1);
  assert.equal(reaction.hitCount, 2);
});

test('collision follows the translated and rotated character', () => {
  const { scene, ghost, body, reaction, stops } = fixture();
  ghost.position.set(2, 0.4, -1);
  ghost.rotation.z = 0.2;
  scene.updateMatrixWorld(true);
  const center = body.getWorldPosition(new THREE.Vector3());
  const seed = new Float32Array([center.x, center.y + 1.4, center.z, 0.4]);
  reaction.traceRain(seed, stops, 0, 0.4, 1);
  assert.equal(reaction.hitCount, 1);
  assert.ok(reaction.impacts[0].point.y > 2, 'contact is stored in character-local space');
  ghost.position.x += 6;
  scene.updateMatrixWorld(true);
  stops.fill(-100);
  reaction.traceRain(seed, stops, 0, 0.4, 1);
  assert.equal(reaction.hitCount, 1, 'the old world position cannot keep receiving hits');
});

test('weather intensity gates collisions with the same seed threshold as the rain shader', () => {
  const { reaction, stops } = fixture();
  const seed = new Float32Array([0, 3, 0, 0.8]);
  reaction.traceRain(seed, stops, 0, 0.3, 0.38);
  assert.equal(reaction.hitCount, 0);
  reaction.traceRain(seed, stops, 0, 0.3, 1);
  assert.equal(reaction.hitCount, 1);
});

test('quality limits collisions to the same active prefix used by the GPU draw range', () => {
  const { reaction } = fixture();
  const seeds = new Float32Array([4, 3, 0, 0.4, 0, 3, 0, 0.4]);
  const stops = new Float32Array(4).fill(-100);
  reaction.traceRain(seeds, stops, 0, 0.3, 1, 0, 1);
  assert.equal(reaction.hitCount, 0, 'an inactive rain seed must not hit an invisible drop');
  reaction.traceRain(seeds, stops, 0, 0.3, 1, 0, 2);
  assert.equal(reaction.hitCount, 1);
});

test('wetness and local response freeze with simulation time and reset completely', () => {
  const { reaction, stops, cloth } = fixture();
  const dry = cloth.color.clone();
  reaction.traceRain(new Float32Array([0, 3, 0, 0.4]), stops, 0, 0.3, 1);
  reaction.advance(0.38, 0.08);
  const wetness = reaction.wetness;
  assert.ok(wetness > 0);
  assert.notDeepEqual(cloth.color.toArray(), dry.toArray());
  const contact = reaction.impacts[0].point;
  const offset = reaction.sampleCloth(contact.x, contact.y, contact.z, new THREE.Vector3());
  assert.ok(offset.length() > 0 && offset.length() < 0.1);
  reaction.advance(0.38, 0);
  assert.equal(reaction.wetness, wetness);
  assert.deepEqual(reaction.sampleCloth(contact.x, contact.y, contact.z, new THREE.Vector3()).toArray(), offset.toArray());
  reaction.reset();
  assert.equal(reaction.wetness, 0);
  assert.equal(reaction.hitCount, 0);
  assert.equal(reaction.impacts.length, 0);
  assert.deepEqual(cloth.color.toArray(), dry.toArray());
  assert.ok(reaction.marks.every(mark => !mark.mesh.visible));
});
