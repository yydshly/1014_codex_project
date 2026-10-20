import test from "node:test";
import assert from "node:assert/strict";
import { Scene, Group, Box3, Vector3 } from "three";
import { OBB } from "three/addons/math/OBB.js";
import { canOccupy, moveWithCollisions } from "../src/navigation.js";
import { createResidents } from "../src/residents.js";
import { createTeamScene } from "../src/team-scene.js";
import { createPersonalProps } from "../src/personal-props.js";
import { createWaterCorner } from "../src/daily-props.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { STAGE_OBSTACLES, HOME_SPOTS, WORK_SPOTS } from "../src/stage-layout.js";
import { PERSON_SPACE } from "../src/resident-traffic.js";

function pair() {
  const characters = createResidents(new Scene(), ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
  characters.enableTeam({ choreographed: true });
  const a = characters.residents.find((r) => r.data.id === "mori"), b = characters.residents.find((r) => r.data.id === "momo");
  characters.residents.forEach((r) => { r.root.visible = [a, b].includes(r); });
  let time = 0;
  const step = (delta = .05) => {
    time += delta; characters.update(time, delta, false, null);
    assert.deepEqual(characters.trafficState().contacts, [], "人物每帧都应有实体间距");
    for (const r of [a, b]) {
      const allowed = r.action?.depart || r.action?.seat ? OBSTACLES.filter((o) => o.id !== (r.action?.seat?.obstacle || r.sittingSeat?.obstacle)) : OBSTACLES;
      assert.ok(canOccupy(r.root.position.x, r.root.position.z, ROOM, [...allowed, ...STAGE_OBSTACLES], .19));
    }
  };
  const until = (check, observe = () => {}) => { for (let i = 0; i < 2400 && !check(); i++) { step(); observe(); } assert.ok(check(), "让行后仍须实际到达，不能永久堵塞"); };
  return { characters, a, b, step, until };
}

test("站立很久的伙伴开始让路时重置进展计时，不会每帧取消刚开始的侧步", () => {
  const { characters, a, b, step, until } = pair();
  a.root.position.set(-1, 0, -1.4); b.root.position.set(.3, 0, -1.4);
  characters.moveTo(b.data.id, { x: .3, z: -1.4, pose: "listen", yaw: 0 });
  until(() => b.action.arrived);
  for (let i = 0; i < 240; i++) step();
  characters.moveTo(a.data.id, { x: 1.6, z: -1.4, pose: "listen", yaw: Math.PI / 2 });
  until(() => a.action.arrived && b.action.arrived);
  assert.ok((b.traffic.yieldCount || 0) >= 1 && b.traffic.yieldCount <= 3);
});

test("人物圆形碰撞在低帧率大位移下阻挡穿越，并允许沿侧面通过", () => {
  const people = [{ x: 0, z: -1.4, radius: PERSON_SPACE - .19 }];
  const next = moveWithCollisions({ x: -2, z: -1.4 }, 4, 0, ROOM, people, .19);
  assert.ok(next.x <= -PERSON_SPACE + 1e-6);
  assert.ok(canOccupy(next.x, next.z, ROOM, people, .19));
});

test("相向交换位置时绕行且不互穿；重复交会后双方都能完成原目标", () => {
  const { characters, a, b, until } = pair();
  a.root.position.set(-1, 0, -1.4); b.root.position.set(1.3, 0, -1.4);
  for (let i = 0; i < 4; i++) {
    const left = { x: -1, z: -1.4, pose: "listen", yaw: 0 }, right = { x: 1.3, z: -1.4, pose: "listen", yaw: 0 };
    characters.moveTo(a.data.id, i % 2 ? left : right); characters.moveTo(b.data.id, i % 2 ? right : left);
    until(() => a.action.arrived && b.action.arrived);
  }
});

test("交会提前减速、稳定侧步而非转圈；让行不改任务，路程有界且通过后及时恢复", () => {
  const { characters, a, b, until } = pair();
  a.root.position.set(-1, 0, -1.4); b.root.position.set(1.3, 0, -1.4);
  a.root.rotation.y = Math.PI / 2; b.root.rotation.y = -Math.PI / 2;
  characters.moveTo(a.data.id, { x: 1.3, z: -1.4, pose: "listen", yaw: Math.PI / 2 });
  characters.moveTo(b.data.id, { x: -1, z: -1.4, pose: "listen", yaw: -Math.PI / 2 });
  const goals = [a.action, b.action], previous = [a.root.position.clone(), b.root.position.clone()];
  const yaw = [a.root.rotation.y, b.root.rotation.y], length = [0, 0], rotation = [0, 0], speed = [0, 0];
  let sawSlow = false, sawSide = false, firstYieldDistance, heldFrames = 0, maxSpeedChange = 0;
  until(() => a.action.arrived && b.action.arrived, () => {
    const gap = Math.hypot(a.root.position.x - b.root.position.x, a.root.position.z - b.root.position.z);
    for (const [i, r] of [a, b].entries()) {
      assert.equal(r.action, goals[i], "临时让行保留同一任务与目标");
      const moved = r.root.position.distanceTo(previous[i]); length[i] += moved; previous[i].copy(r.root.position);
      rotation[i] += Math.abs(Math.atan2(Math.sin(r.root.rotation.y - yaw[i]), Math.cos(r.root.rotation.y - yaw[i]))); yaw[i] = r.root.rotation.y;
      maxSpeedChange = Math.max(maxSpeedChange, Math.abs(moved / .05 - speed[i])); speed[i] = moved / .05;
      if (r.traffic.yieldTarget) {
        firstYieldDistance ??= gap;
        assert.equal(r.action.arrived, false, "不能把侧让点当成工位完成");
        assert.ok(Math.hypot(r.traffic.yieldTarget.x - r.traffic.yieldOrigin.x, r.traffic.yieldTarget.z - r.traffic.yieldOrigin.z) < 1.25);
      }
      sawSlow ||= r.traffic.slowing && gap > PERSON_SPACE + .1 && moved > .001;
      sawSide ||= Math.abs(r.sideStep || 0) > .7 && moved > .005;
      heldFrames += r.traffic.hold ? 1 : 0;
    }
  });
  assert.ok(firstYieldDistance > 1.4, "预判发生在身体接触之前");
  assert.ok(sawSlow && sawSide); assert.equal(b.traffic.yieldCount, 1, "一次交会只作一次让行决定");
  assert.ok(length[0] + length[1] < 6.3, `无需大绕行：${length}`);
  assert.ok(Math.max(...rotation) < 1.5, `不原地掉头或转圈：${rotation}`);
  assert.ok(maxSpeedChange < .2, `逐帧加减速而不是突然刹停：${maxSpeedChange}`);
  assert.ok(heldFrames < 30, "通道空后不再固定等待数秒");
});

test("伙伴在让行途中被暂停时可以重新寻找安全通路，解除暂停后双方继续原任务", () => {
  const { characters, a, b, until, step } = pair();
  a.root.position.set(-1, 0, -1.4); b.root.position.set(1.3, 0, -1.4);
  characters.moveTo(a.data.id, { x: 1.3, z: -1.4, pose: "listen", yaw: Math.PI / 2 });
  characters.moveTo(b.data.id, { x: -1, z: -1.4, pose: "listen", yaw: -Math.PI / 2 });
  until(() => Boolean(b.traffic.yieldTarget)); a.stageFrozen = true;
  for (let i = 0; i < 180; i++) step();
  assert.ok(b.action.arrived || !b.traffic.hold, "伙伴不再前进时，不能永远等通过信号");
  a.stageFrozen = false; until(() => a.action.arrived && b.action.arrived);
});

test("低帧率交会和白板多人集结仍可完成，已在目标处的伙伴不被反复驱赶", () => {
  const { characters, a, b, step } = pair();
  a.root.position.set(-1, 0, -1.4); b.root.position.set(1.3, 0, -1.4);
  characters.moveTo(a.data.id, { x: 1.3, z: -1.4, pose: "listen" });
  characters.moveTo(b.data.id, { x: -1, z: -1.4, pose: "listen" });
  for (let i = 0; i < 160 && !(a.action.arrived && b.action.arrived); i++) step(.2);
  assert.ok(a.action.arrived && b.action.arrived);
  characters.moveTo(a.data.id, { x: -3.85, z: -1.95, pose: "point" });
  characters.moveTo(b.data.id, { x: -2.95, z: -1.95, pose: "listen" });
  for (let i = 0; i < 300 && !(a.action.arrived && b.action.arrived); i++) step(.2);
  assert.ok(a.action.arrived && b.action.arrived);
  const positions = [a.root.position.clone(), b.root.position.clone()];
  for (let i = 0; i < 150; i++) step(.2);
  [a, b].forEach((r, i) => assert.ok(r.root.position.distanceTo(positions[i]) < .001));
});

test("沙发入座和离座需要伙伴让出通道，随后恢复原工位", () => {
  const { characters, a, b, until } = pair();
  a.root.position.set(3.15, 0, .78); b.root.position.set(1.8, 0, 2.5);
  characters.moveTo(a.data.id, { x: 3.15, z: .78, pose: "listen", yaw: 0 });
  characters.moveTo(b.data.id, HOME_SPOTS.momo);
  let yielded = false;
  until(() => b.action.arrived, () => { yielded ||= Boolean(a.traffic?.yieldTarget); });
  assert.ok(yielded, "通道内的人须主动挪开");
  until(() => a.action.arrived);
  characters.moveTo(b.data.id, WORK_SPOTS.momo);
  until(() => b.action.arrived && a.action.arrived);
});

test("座位通道只豁免自己的椅子，仍不能穿过桌子等其他家具", () => {
  const { characters, a, b, step } = pair(); b.root.visible = false;
  a.root.position.set(2.7, 0, -2.32);
  characters.moveTo(a.data.id, { x: 2.7, z: -2.32, yaw: Math.PI, pose: "type", seat: { x: 3.42, z: -3.35, y: -.28, obstacle: "chair" } });
  for (let i = 0; i < 300; i++) step();
  assert.equal(a.action.arrived, false); assert.ok(a.root.position.z > -2.56, "错误的座位位置不能把人带进桌体");
});

test("第一人称与住客双向碰撞；住客绕开观察者，观察者也不能走进人物", () => {
  const { characters, a, b, until } = pair(); b.root.visible = false;
  a.root.position.set(-1, 0, -1.4); const visitor = { x: .3, z: -1.4 };
  characters.setVisitor(visitor); characters.moveTo(a.data.id, { x: 1.6, z: -1.4, pose: "listen" });
  until(() => a.action.arrived, () => assert.ok(Math.hypot(a.root.position.x - visitor.x, a.root.position.z - visitor.z) >= PERSON_SPACE - .0001));
  const next = moveWithCollisions(visitor, 3, 0, ROOM, characters.personObstacles(), .28);
  assert.ok(Math.hypot(a.root.position.x - next.x, a.root.position.z - next.z) >= PERSON_SPACE - .0001);
});

test("原穿人复现：六人日常活动连续两分钟无重叠，仍会取书、喝水、走动和互相让行", () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: (_, k) => k === "measureText" ? (v) => ({ width: v.length * 24 }) : () => {} }) }) };
  try {
    const scene = new Scene(), c = createResidents(scene, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]), s = createTeamScene(scene, c);
    const props = createPersonalProps(scene, c, s.waterCup, createWaterCorner(new Group())); s.idle();
    const core = c.residents.map((r) => [r.body.children.find((o) => o.isMesh), r.head.children.find((o) => o.isMesh)]);
    const unit = new OBB().fromBox3(new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)));
    let minimum = Infinity, sawDrink = false, sawRead = false, sawAvoid = false;
    const traveled = new Map(c.residents.map((r) => [r, 0]));
    for (let frame = 1; frame <= 2400; frame++) {
      const positions = c.residents.map((r) => r.root.position.clone());
      c.update(frame * .05, .05, false, null); s.update(frame * .05, .05, 0, false); props.update(.05, false);
      const state = c.trafficState(); minimum = Math.min(minimum, state.minimumDistance); assert.deepEqual(state.contacts, []);
      const boxes = core.map((meshes) => meshes.map((mesh) => unit.clone().applyMatrix4(mesh.matrixWorld)));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
        for (const a of boxes[i]) for (const b of boxes[j]) assert.equal(a.intersectsOBB(b), false, "实际旋转后的头部与躯干也不能相交");
      c.residents.forEach((r, i) => {
        traveled.set(r, traveled.get(r) + Math.hypot(r.root.position.x - positions[i].x, r.root.position.z - positions[i].z));
        sawDrink ||= r.drinkLift > .8; sawRead ||= r.bookHandling.phase === "reading"; sawAvoid ||= r.traffic.nextPlan != null || Boolean(r.traffic.yieldTarget);
      });
    }
    assert.ok(minimum >= PERSON_SPACE - .0001); assert.ok(sawDrink && sawRead && sawAvoid);
    c.residents.forEach((r) => assert.ok(traveled.get(r) > 5, `${r.data.id} 不能靠停掉动画避免碰撞`));
  } finally { globalThis.document = previous; }
});

test("书本面向读者后左右手不交叉，阅读、打字、书写及休息的前臂不穿入躯干内部", () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: (_, k) => k === "measureText" ? (v) => ({ width: v.length * 24 }) : () => {} }) }) };
  try {
    const scene = new Scene(), c = createResidents(scene, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]), s = createTeamScene(scene, c);
    const props = createPersonalProps(scene, c, s.waterCup, createWaterCorner(new Group()));
    c.residents.forEach((r) => { r.observedProp = true; props.setAuto(r.data.id, false); }); s.idle();
    const checked = new Set(), unit = new OBB().fromBox3(new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5)));
    for (let frame = 1; frame <= 800; frame++) {
      c.update(frame * .05, .05, false, null); s.update(frame * .05, .05, 0, false); props.update(.05, false);
      for (const r of c.residents) {
        if (!r.action?.arrived || r.propBusy || r.action.age < 4 || r.bookHandling.phase === "reading" && r.bookHandling.age < 2 || !["type", "write", "rest", "read"].includes(r.action.pose)) continue;
        checked.add(r.action.pose);
        const torso = unit.clone().applyMatrix4(r.body.children.find((o) => o.isMesh).matrixWorld); torso.halfSize.multiplyScalar(.8);
        for (const joint of [...r.elbows, ...r.wrists]) {
          const limb = unit.clone().applyMatrix4(joint.children[0].matrixWorld);
          assert.equal(limb.intersectsOBB(torso), false, `${r.data.id} 的 ${r.action.pose} 姿态不能把前臂或手掌穿入胸腹`);
        }
        if (r.bookHandling.phase === "reading") {
          const palms = r.wrists.map((w) => r.body.worldToLocal(w.localToWorld(new Vector3(0, -.055, 0))));
          assert.ok(palms[0].x < 0 && palms[1].x > 0, "旋转书本后必须同步转换左右手抓取点");
        }
      }
    }
    assert.deepEqual([...checked].sort(), ["read", "rest", "type", "write"]);
  } finally { globalThis.document = previous; }
});
