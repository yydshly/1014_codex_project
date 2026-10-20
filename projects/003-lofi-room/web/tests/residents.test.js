import test from "node:test";
import assert from "node:assert/strict";
import { Scene, Vector3, Quaternion } from "three";
import { createResidents } from "../src/residents.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { canOccupy } from "../src/navigation.js";
import { TEAM } from "../shared/team.js";
import { WORK_SPOTS, STAGE_OBSTACLES } from "../src/stage-layout.js";
import { FLOOR_Y } from "../src/ground-surfaces.js";

test("两位散步住客持续走完多个巡回，始终避开家具与墙面", () => {
  const group = createResidents(new Scene(), ROOM, OBSTACLES);
  assert.equal(group.residents.length, 6);
  assert.ok(group.validPatrol());
  const walkers = group.residents.filter((r) => r.data.kind === "walk");
  const distances = [0, 0];
  const waypoints = [new Set(), new Set()];
  for (let frame = 1; frame <= 3600; frame++) {
    const before = walkers.map((r) => r.root.position.clone());
    group.update(frame / 20, 1 / 20, false, null);
    walkers.forEach((r, i) => {
      assert.ok(
        canOccupy(r.root.position.x, r.root.position.z, ROOM, OBSTACLES, 0.19),
      );
      distances[i] += before[i].distanceTo(r.root.position);
      waypoints[i].add(r.routeIndex);
    });
  }
  distances.forEach((distance) =>
    assert.ok(distance > 35, "住客不能停滞在家具附近"),
  );
  waypoints.forEach((visited) => assert.equal(visited.size, 10, "让行结束后必须继续完整路线，不能反复返回临时让路点"));
});

test("工作室角色能到达各自工作位置，发言驱动嘴部动作", () => {
  const group = createResidents(new Scene(), ROOM, OBSTACLES);
  group.enableTeam();
  TEAM.forEach((member) =>
    group.setTeamState(member.id, { status: "working" }),
  );
  for (let frame = 1; frame <= 1200; frame++) {
    group.update(frame / 30, 1 / 30, false, null);
    group.residents.forEach((r) =>
      assert.ok(
        canOccupy(r.root.position.x, r.root.position.z, ROOM, OBSTACLES, 0.19),
      ),
    );
    if (group.residents.every((r) => r.action.arrived && !r.path.length)) break;
  }
  group.residents.forEach((r) => assert.equal(r.path.length, 0));
  group.setSpeaking("mori", 0.7);
  group.update(30, 0.03, false, null);
  assert.ok(group.residents[0].mouth.scale.y > 0.015);
});

test("漫游时冻结所选住客，减少动态效果时冻结自动散步", () => {
  const group = createResidents(new Scene(), ROOM, OBSTACLES);
  const mori = group.residents[0],
    amber = group.residents[1];
  const moriBefore = mori.root.position.clone(),
    amberBefore = amber.root.position.clone();
  for (let i = 1; i <= 60; i++)
    group.update(i / 20, 1 / 20, false, mori.data.id);
  assert.equal(mori.root.position.distanceTo(moriBefore), 0);
  assert.ok(amber.root.position.distanceTo(amberBefore) > 0.8);
  const snapshots = group.residents.map((r) => r.root.position.clone());
  for (let i = 61; i <= 120; i++) group.update(i / 20, 1 / 20, true, null);
  group.residents.forEach((r, i) =>
    assert.equal(r.root.position.distanceTo(snapshots[i]), 0),
  );
});

test("电脑坐姿双脚接近地面，肘部弯曲，手掌落在键盘操作区域", () => {
  const group = createResidents(new Scene(), ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
  group.enableTeam({ choreographed: true });
  group.moveTo("indigo", WORK_SPOTS.indigo);
  const developer = group.residents.find((r) => r.data.id === "indigo");
  let largestHeightChange = 0, largestTurn = 0;
  for (let frame = 1; frame <= 900; frame++) {
    const beforeY = developer.root.position.y, beforeYaw = developer.root.rotation.y;
    group.update(frame / 30, 1 / 30, false, null);
    developer.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > FLOOR_Y, "走动与入座过程中也不能把脚压入可见地板"));
    largestHeightChange = Math.max(largestHeightChange, Math.abs(developer.root.position.y - beforeY));
    largestTurn = Math.max(largestTurn, Math.abs(developer.root.rotation.y - beforeYaw));
  }
  assert.equal(developer.action.arrived, true);
  assert.ok(largestHeightChange < 0.045, "坐下时逐渐降低身体，不能突然切换高度");
  assert.ok(largestTurn < 0.24, "转向使用有限角速度，不能瞬间掉头");
  for (const sole of developer.soles) {
    const y = sole.getWorldPosition(new Vector3()).y;
    assert.ok(y >= FLOOR_Y && y < FLOOR_Y + .008, `鞋底应贴近可见地面，实际 ${y}`);
  }
  for (const [i, wrist] of developer.wrists.entries()) {
    const palm = wrist.localToWorld(new Vector3(0, -0.045, 0));
    assert.ok(palm.x > 3.1 && palm.x < 3.7);
    assert.ok(palm.y > 0.84 && palm.y < 0.93);
    assert.ok(palm.z > -3.12 && palm.z < -2.95, "手掌需靠近前移的键盘");
    assert.ok(developer.elbows[i].quaternion.angleTo(new Quaternion()) > 0.5, "不能整条手臂僵直前伸");
  }
  group.moveTo("indigo", { x: 1.6, z: -1.3, yaw: 0, pose: "listen" });
  for (let frame = 901; frame <= 1500; frame++) {
    group.update(frame / 30, 1 / 30, false, null);
    developer.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > FLOOR_Y, "起身时保持脚的支撑"));
  }
  assert.ok(Math.abs(developer.root.position.y) < 0.005);
});

test("读书时双手托住书页，地垫坐姿的脚不陷入地面", () => {
  const group = createResidents(new Scene(), ROOM, OBSTACLES);
  for (let frame = 1; frame <= 120; frame++) group.update(frame / 30, 1 / 30, false, null);
  const reader = group.residents.find((r) => r.data.id === "luna");
  const book = reader.book.getWorldPosition(new Vector3());
  reader.wrists.forEach((wrist) => {
    const palm = wrist.localToWorld(new Vector3(0, -0.045, 0));
    assert.ok(palm.distanceTo(book) < 0.2, "手掌应在书页两侧");
  });
  assert.ok(reader.head.rotation.x > 0.15);
  reader.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > -0.01));
});
