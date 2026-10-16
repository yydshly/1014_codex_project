import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { frameSeasideCamera } from '../src/view.js';

test('the drip point stays reachable in wide, narrow desktop and portrait windows', () => {
  for (const [width, height] of [[1280, 720], [797, 903], [960, 1080], [390, 844]]) {
    for (const seated of [0, 1]) {
      const camera = new PerspectiveCamera(55, 1, 0.06, 480);
      frameSeasideCamera(camera, { width, height, seated });
      const point = new Vector3(1.85, 1.4, -1.75).project(camera);
      assert.ok(Math.abs(point.x) < 0.85 && Math.abs(point.y) < 0.75, `${width}x${height}, seated=${seated}: ${point.toArray()}`);
    }
  }
});

test('reaching brings the hand back toward view after looking away in a narrow window', () => {
  for (const lookX of [-0.6, 0.6]) {
    const camera = new PerspectiveCamera(55, 1, 0.06, 480);
    frameSeasideCamera(camera, { width: 797, height: 903, seated: 1, reach: 1, lookX });
    const point = new Vector3(1.85, 1.4, -1.75).project(camera);
    assert.ok(Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.75 && point.z < 1);
  }
});
