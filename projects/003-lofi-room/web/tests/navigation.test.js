import test from "node:test";
import assert from "node:assert/strict";
import {
  canOccupy,
  moveWithCollisions,
  findSafeSpawn,
  movementVector,
} from "../src/navigation.js";
import { ROOM, OBSTACLES } from "../src/room.js";

test("家具和边界阻挡玩家，低帧率的大位移也不能穿过桌子", () => {
  assert.equal(canOccupy(0, 0.5, ROOM, OBSTACLES), false);
  assert.equal(canOccupy(6, 0, ROOM, OBSTACLES), false);
  const next = moveWithCollisions({ x: -2, z: -0.1 }, 6, 0, ROOM, OBSTACLES);
  assert.ok(next.x < -1.34);
  assert.ok(next.x > -1.44);
  const edge = moveWithCollisions({ x: 2, z: 3 }, 10, 10, ROOM, OBSTACLES);
  assert.ok(canOccupy(edge.x, edge.z, ROOM, OBSTACLES));
});
test("遇到桌边时可沿边滑动", () => {
  const next = moveWithCollisions(
    { x: 0, z: -0.51 },
    0.4,
    0.5,
    ROOM,
    OBSTACLES,
  );
  assert.ok(next.z < -0.49);
  assert.ok(next.x > 0.35);
});
test("从床、沙发和桌前进入时找到可通行位置", () => {
  for (const p of [
    { x: -3.64, z: 2.02 },
    { x: 4.3, z: 0.8 },
    { x: 3.42, z: -2.22 },
    { x: 0, z: 0.5 },
  ]) {
    const spawn = findSafeSpawn(p, ROOM, OBSTACLES);
    assert.ok(canOccupy(spawn.x, spawn.z, ROOM, OBSTACLES));
  }
});
test("移动方向跟随视角，斜向移动不会额外加速", () => {
  const front = movementVector({ forward: true }, 0, 2, 1);
  assert.equal(front.x, 0);
  assert.equal(front.z, -2);
  const turned = movementVector({ forward: true }, Math.PI / 2, 2, 1);
  assert.ok(Math.abs(turned.x + 2) < 1e-9);
  assert.ok(Math.abs(turned.z) < 1e-9);
  const diagonal = movementVector({ forward: true, right: true }, 0, 2, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 2) < 1e-9);
  const opposing = movementVector({ forward: true, backward: true }, 0, 2, 1);
  assert.equal(Math.hypot(opposing.x, opposing.z), 0);
});
