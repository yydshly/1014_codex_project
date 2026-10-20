import test from "node:test";
import assert from "node:assert/strict";
import { Scene, Box3, Vector3 } from "three";
import { createRoom, ROOM, OBSTACLES } from "../src/room.js";
import { createResidents } from "../src/residents.js";
import { updateResidentPose } from "../src/resident-motion.js";
import { HOME_SPOTS, WORK_SPOTS, STAGE_OBSTACLES } from "../src/stage-layout.js";
import { CUSHIONS } from "../src/ground-surfaces.js";
import { canOccupy } from "../src/navigation.js";

// Read boxes from the rendered meshes, independently of the contact solver.
function renderedRoom() {
  const previous = globalThis.document;
  const context = new Proxy({}, { get: (_, key) => key.startsWith("create") ? () => ({ addColorStop() {} }) : () => {} });
  globalThis.document = { createElement: () => ({ getContext: () => context, data: new Uint8Array(0) }) };
  try {
    const scene = new Scene(); createRoom(scene); scene.updateMatrixWorld(true);
    const surfaces = [];
    scene.traverse((o) => { if (/^(floor-surface|rug-surface|rug-tassel|cushion-seam|.*-cushion)$/.test(o.name)) surfaces.push(new Box3().setFromObject(o)); });
    return { surfaces, frame: new Box3().setFromObject(scene.getObjectByName("sofa-frame")) };
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}
const room = renderedRoom();
function contact(r) {
  for (const ankle of r.ankles) {
    const shoe = new Box3().setFromObject(ankle.children[0]);
    for (const surface of room.surfaces) {
      const overlap = shoe.max.x > surface.min.x && shoe.min.x < surface.max.x && shoe.max.z > surface.min.z && shoe.min.z < surface.max.z;
      if (overlap) assert.ok(shoe.min.y >= surface.max.y - .00001, `${r.data.id} 的鞋跟/鞋尖穿入支撑物：${shoe.min.y} < ${surface.max.y}`);
    }
  }
}
function studio(id) {
  const c = createResidents(new Scene(), ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
  c.enableTeam({ choreographed: true });
  c.residents.forEach((r) => r.root.visible = r.data.id === id);
  return { c, r: c.residents.find((r) => r.data.id === id) };
}

test("跨地毯、流苏、侧步和转向：检查鞋的完整网格而非鞋底中心", () => {
  const { r } = studio("mori");
  for (const delta of [1 / 60, .05, .16]) {
    for (let f = 0; f < 180; f++) {
      r.root.position.set(-1.9, 0, -1.25 + f * .02); r.root.rotation.y = f * .025;
      r.traffic = { heading: { x: 1, z: 0 }, yieldTarget: f > 60 && f < 120 ? {} : null };
      updateResidentPose(r, { time: f * delta, delta, distanceMoved: delta * .8 }); contact(r);
    }
  }
});

test("三个厚坐垫会使人物绕行，抵达目标前不能冒充已经到岗", () => {
  for (const pad of CUSHIONS) {
    const { c, r } = studio("mori");
    const vertical = pad.id === "reading-cushion";
    const start = vertical ? { x: pad.x, z: -.7 } : { x: pad.x - .85, z: pad.z };
    const target = vertical ? { x: pad.x, z: 1.65 } : { x: pad.x + .85, z: pad.z };
    assert.ok(canOccupy(start.x, start.z, ROOM, OBSTACLES, .19));
    assert.ok(canOccupy(target.x, target.z, ROOM, OBSTACLES, .19));
    r.root.position.set(start.x, 0, start.z);
    c.moveTo("mori", { ...target, pose: "listen", yaw: 0 });
    for (let f = 0; f < 1200 && !r.action.arrived; f++) {
      c.update(f * .04, .04, false, null);
      assert.ok(canOccupy(r.root.position.x, r.root.position.z, ROOM, OBSTACLES, .19)); contact(r);
    }
    assert.ok(r.action.arrived && Math.hypot(r.root.position.x - target.x, r.root.position.z - target.z) < .035, pad.id);
  }
});

test("坐垫入座、阅读与接任务起身时，两只鞋始终在可见地面之上", () => {
  const { c, r } = studio("luna");
  let previous;
  const observe = () => {
    contact(r);
    const feet = r.ankles.map((a) => a.getWorldPosition(new Vector3()));
    if (previous) feet.forEach((foot, i) => assert.ok(foot.distanceTo(previous[i]) < .13, "支撑修正不能令脚在相邻帧瞬移"));
    previous = feet;
  };
  c.moveTo("luna", HOME_SPOTS.luna);
  for (let f = 0; f < 700; f++) { c.update(f * .025, .025, false, null); observe(); }
  assert.ok(r.action.arrived && r.sitAmount > .99);
  c.moveTo("luna", WORK_SPOTS.luna);
  for (let f = 0; f < 700; f++) { c.update(18 + f * .025, .025, false, null); observe(); }
  assert.ok(r.action.arrived && Math.abs(r.root.position.y) < .001);
});

test("沙发底座留出脚跟空间，坐稳和起身时鞋不穿过木框", () => {
  const { c, r } = studio("momo");
  c.moveTo("momo", HOME_SPOTS.momo);
  for (let f = 0; f < 600; f++) { c.update(f * .025, .025, false, null); contact(r); }
  assert.ok(r.action.arrived);
  for (const ankle of r.ankles) assert.equal(new Box3().setFromObject(ankle.children[0]).intersectsBox(room.frame), false);
  c.moveTo("momo", WORK_SPOTS.momo);
  for (let f = 0; f < 600; f++) {
    c.update(15 + f * .025, .025, false, null); contact(r);
    for (const ankle of r.ankles) assert.equal(new Box3().setFromObject(ankle.children[0]).intersectsBox(room.frame), false);
  }
  assert.ok(r.action.arrived);
});

test("暂时失去路径不会在原地喝水，而会重新寻路到饮水角", () => {
  const { c, r } = studio("mori");
  const target = { x: -.15, z: -2.85 };
  c.moveTo("mori", { ...target, pose: "drink", yaw: Math.PI });
  r.path = []; r.traffic.nextPlan = 1;
  c.update(0, .05, false, null);
  assert.equal(r.action.arrived, false); assert.equal(r.drinkGrip, 0);
  for (let f = 1; f < 800 && !r.action.arrived; f++) c.update(f * .05, .05, false, null);
  assert.ok(r.action.arrived && r.root.position.distanceTo(new Vector3(target.x, 0, target.z)) < .035);
});

function verifyPlant(r, anchors) {
  let bearing = 0;
  for (const [i, ankle] of r.ankles.entries()) {
    const foot = r.footContacts[i];
    if (foot.phase !== "stance") { anchors[i] = null; continue; }
    bearing++;
    const box = new Box3().setFromObject(ankle.children[0]);
    const top = Math.max(...room.surfaces.filter((s) => box.max.x >= s.min.x && box.min.x <= s.max.x && box.max.z >= s.min.z && box.min.z <= s.max.z).map((s) => s.max.y));
    const gap = box.min.y - top;
    assert.ok(gap >= .002 && gap <= .006, `支撑脚应贴地，不能只是高于地面：${gap}`);
    const sole = r.soles[i].getWorldPosition(new Vector3());
    if (anchors[i]?.plantId === foot.plantId) assert.ok(Math.hypot(sole.x - anchors[i].sole.x, sole.z - anchors[i].sole.z) < .0005, "同一次支撑中，脚底不能跟着身体滑动");
    else anchors[i] = { plantId: foot.plantId, sole };
  }
  assert.ok(bearing >= 1, "步行与座位转换应始终至少有一只脚支撑");
}

test("平地慢走、正常走和快走：支撑脚贴地并锁在原落脚点", () => {
  for (const speed of [.25, .8, 1.08]) for (const delta of [1 / 60, .05, .16]) {
    const { r } = studio("mori"), anchors = [];
    r.root.position.set(-3, 0, -1.8); r.root.rotation.y = Math.PI / 2;
    const plants = new Set(); let swingFrames = 0;
    const frames = Math.ceil(4 / delta);
    for (let f = 0; f < frames; f++) {
      r.root.position.x += speed * delta;
      updateResidentPose(r, { time: f * delta, delta, distanceMoved: speed * delta });
      verifyPlant(r, anchors); contact(r);
      r.footContacts.forEach((foot, i) => { if (foot.phase === "swing") swingFrames++; else plants.add(`${i}:${foot.plantId}`); });
    }
    assert.ok(plants.size >= 6 && swingFrames > frames / 5, "不能用脚固定、身体独自滑行来伪装步行");
  }
});

test("起步、停止、原地转身与侧向让路后收脚，地面支撑不丢失", () => {
  const { r } = studio("mori"), anchors = [];
  r.root.position.set(-1.5, 0, -1.6); r.root.rotation.y = Math.PI / 2;
  for (let f = 0; f < 600; f++) {
    const speed = f < 100 ? Math.min(.8, f * .012) : f < 160 ? Math.max(0, .8 - (f - 100) * .02) : f >= 270 && f < 350 ? .45 : 0;
    const dx = speed / 60, dz = f >= 270 && f < 350 ? speed / 120 : 0;
    r.root.position.x += dx; r.root.position.z += dz;
    if (f >= 180 && f < 240) r.root.rotation.y += Math.PI / 120;
    r.traffic = { yieldTarget: f >= 270 && f < 350 ? {} : null, heading: { x: 1, z: .5 } };
    updateResidentPose(r, { time: f / 60, delta: 1 / 60, distanceMoved: Math.hypot(dx, dz) });
    verifyPlant(r, anchors); contact(r);
    if (f > 450) assert.ok(r.footContacts.every((foot) => foot.phase === "stance"), "停止后应收脚站稳，不能持续小碎步");
  }
});

test("靠近坐垫边缘站稳时在旁边落脚，不在空角上方悬脚", () => {
  const { r } = studio("mori"), anchors = [];
  r.root.position.set(-1.95, 0, .6); r.root.rotation.y = Math.PI / 2;
  for (let f = 0; f < 90; f++) {
    updateResidentPose(r, { time: f / 60, delta: 1 / 60 });
    verifyPlant(r, anchors); contact(r);
    assert.ok(r.footContacts.filter((foot) => foot.phase === "stance").every((foot) => !foot.surface.endsWith("cushion")));
  }
});

test("电脑椅、沙发和地垫进出：先准备落脚，再降低或抬起身体", () => {
  for (const id of ["indigo", "momo", "luna"]) {
    const { c, r } = studio(id), anchors = [];
    const floorSteps = new Set(); let supportedRise = 0;
    for (const target of [HOME_SPOTS[id], WORK_SPOTS[id]]) {
      c.moveTo(id, target);
      for (let f = 0; f < 850; f++) {
        const before = r.root.position.y;
        c.update(f * .025, .025, false, null); verifyPlant(r, anchors); contact(r);
        if (r.footSupport.mode === "floor-rise") r.footContacts.forEach((foot, i) => { if (foot.phase === "swing") floorSteps.add(i); });
        if (r.root.position.y > before + .002) supportedRise++;
      }
      assert.ok(r.action.arrived && r.footContacts.every((foot) => foot.phase === "stance"));
    }
    if (id === "luna") assert.equal(floorSteps.size, 2, "地垫起身应两脚依次收回，不能一起抬起悬空");
    assert.ok(supportedRise > 5);
  }
});
