import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GhostScene } from '../src/scene.js';

test('脸红贴合实际布料，布料变形与角色转身缩放后仍附着在脸上', () => {
  const fixture = { scene: new THREE.Scene(), glowTexture: new THREE.Texture() };
  GhostScene.prototype.createGhost.call(fixture);
  const { blush, body, ghost } = fixture;
  const before = new Float32Array(blush.geometry.attributes.position.array);
  const source = body.geometry.attributes.position;
  for (let i = 0; i < source.count; i++) source.setY(i, source.getY(i) + 0.06);
  body.geometry.computeVertexNormals();
  blush.setAmount(1); // Its first visible frame must read the latest cloth pose.
  const patch = blush.geometry.attributes.position;
  for (let i = 0; i < patch.count; i++) {
    assert.ok(Math.abs(patch.getY(i) - before[i * 3 + 1] - 0.06) < 0.00001);
    assert.ok(Math.abs(patch.getX(i) - before[i * 3]) < 0.00001);
    assert.ok(Math.abs(patch.getZ(i) - before[i * 3 + 2]) < 0.00001);
  }
  ghost.position.set(-1, 0.7, 0.3); ghost.rotation.set(0.1, 1.2, -0.03); ghost.scale.set(1.05, 0.9, 1.03);
  ghost.updateMatrixWorld(true);
  const point = new THREE.Vector3().fromBufferAttribute(patch, 24);
  assert.ok(blush.localToWorld(point.clone()).distanceTo(body.localToWorld(point.clone())) < 1e-8);
  blush.setAmount(0);
  assert.equal(blush.visible, false);
  fixture.scene.traverse(object => { object.geometry?.dispose(); if (object.material) { object.material.map?.dispose(); object.material.dispose(); } });
  fixture.glowTexture.dispose();
});
