import test from "node:test";
import assert from "node:assert/strict";
import { Scene, Group, Vector3, Box3 } from "three";
import { createResidents } from "../src/residents.js";
import { createTeamScene } from "../src/team-scene.js";
import { createPersonalProps } from "../src/personal-props.js";
import { createWaterCorner } from "../src/daily-props.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { BOOK_STATIONS, STAGE_OBSTACLES, HOME_SPOTS, WORK_SPOTS, WATER_STATION } from "../src/stage-layout.js";
import { canOccupy } from "../src/navigation.js";
import { runCollaboration } from "../shared/workflow.js";
import { FLOOR_Y } from "../src/ground-surfaces.js";

function studio(check) {
  const previous = globalThis.document;
  const ctx = new Proxy({}, { get: (_, key) => key === "measureText" ? (text) => ({ width: text.length * 24 }) : () => {} });
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  try {
    const scene = new Scene(), characters = createResidents(scene, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
    const stage = createTeamScene(scene, characters), props = createPersonalProps(scene, characters, stage.waterCup, createWaterCorner(new Group()));
    characters.residents.forEach((r) => { r.observedProp = true; });
    let time = 0;
    const step = (count = 1) => { for (let i = 0; i < count; i++) { time += .025; characters.update(time, .025, false, null); stage.update(time, .025, 0, false); props.update(.025, false); assert.deepEqual(characters.trafficState().contacts, [], "取放、携带和离座时人物不能重叠"); } };
    const until = (predicate, observe = () => {}) => { for (let i = 0; i < 6000 && !predicate(); i++) { step(); observe(); } assert.ok(predicate(), "动作应在有限时间完成"); };
    return check({ scene, characters, stage, props, step, until });
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}

test("所有读本停放点均有可达且面向书本的取书位置", () => {
  for (const station of Object.values(BOOK_STATIONS)) {
    assert.ok(canOccupy(station.x, station.z, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES], .19));
    const dx = station.book[0] - station.x, dz = station.book[2] - station.z;
    assert.ok(dx * Math.sin(station.yaw) + dz * Math.cos(station.yaw) > .4);
    assert.ok(Math.hypot(dx, dz) < .58);
  }
});

test("走到取书点、伸手接触、合书携带再打开；任务等待合书归还后才就位，实体全程连续", () => studio(({ scene, characters, props, step, until }) => {
  const r = characters.residents.find((r) => r.data.id === "amber"), station = BOOK_STATIONS.amber;
  characters.moveTo("amber", { ...HOME_SPOTS.amber, ambient: true });
  const book = r.document, phases = new Set(); let previous = book.position.clone(), initialized = false, maxStep = 0;
  const observe = () => {
    phases.add(r.bookHandling.phase);
    if (initialized) maxStep = Math.max(maxStep, previous.distanceTo(book.position));
    previous.copy(book.position); initialized = true;
    assert.equal(book.parent, scene); assert.equal(scene.getObjectByName(book.name), book);
    if (r.bookHandling.phase === "pickup" && !r.bookHandling.held) {
      assert.ok(book.position.distanceTo(new Vector3(...station.book)) < .001, "抓住之前书应留在桌上");
      assert.ok(Math.hypot(r.root.position.x - station.x, r.root.position.z - station.z) < .02);
    }
    if (["travel", "returning"].includes(r.bookHandling.phase)) assert.equal(r.bookHandling.open, 0, "移动时应合上书");
  };
  until(() => props.state("amber", "book").reading, observe);
  assert.ok(["fetch", "pickup", "travel", "opening", "reading"].every((phase) => phases.has(phase)));
  assert.ok(r.sitAmount > .98); assert.ok(r.legs[0].rotation.x < -1.1 && r.knees[0].rotation.x > 1.1);
  r.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y >= FLOOR_Y));
  characters.moveTo("amber", WORK_SPOTS.amber);
  assert.equal(r.propBusy, true);
  until(() => !r.propBusy && r.action.arrived, observe);
  assert.ok(["closing", "returning", "placing", "stored"].every((phase) => phases.has(phase)));
  assert.equal(r.action.pose, WORK_SPOTS.amber.pose); assert.equal(r.bookHandling.held, false);
  assert.ok(book.position.distanceTo(new Vector3(...station.book)) < .001);
  assert.ok(maxStep < .09, `书本逐帧位移不应跳变，最大 ${maxStep}`);
}));

test("拿书中收到新任务仍完成安全放回；归还中再次改派采用最新目标，暂停冻结书与人物", () => studio(({ characters, stage, props, step, until }) => {
  const r = characters.residents.find((r) => r.data.id === "mori");
  characters.moveTo("mori", { ...HOME_SPOTS.mori, ambient: true });
  until(() => r.bookHandling.phase === "pickup" && r.bookHandling.held);
  characters.moveTo("mori", WORK_SPOTS.mori);
  until(() => r.bookHandling.phase === "placing");
  stage.pause(true); const position = r.document.position.clone(), actorPosition = r.root.position.clone(), age = r.bookHandling.age;
  step(200);
  assert.equal(r.document.position.distanceTo(position), 0); assert.equal(r.root.position.distanceTo(actorPosition), 0); assert.equal(r.bookHandling.age, age);
  stage.pause(false);
  const latest = { x: -1.5, z: -1.2, pose: "listen", yaw: .4, label: "最新改派" };
  characters.moveTo("mori", latest);
  until(() => !r.propBusy && r.action.arrived);
  assert.ok(Math.hypot(r.root.position.x - latest.x, r.root.position.z - latest.z) < .01);
  assert.equal(props.state("mori", "book").held, false);
}));

test("沙发入座先转身、屈膝后坐稳，起身向前移出坐垫；重复进出不累积偏移", () => studio(({ characters, step, until }) => {
  const r = characters.residents.find((r) => r.data.id === "momo"), home = HOME_SPOTS.momo;
  for (let cycle = 0; cycle < 3; cycle++) {
    characters.moveTo("momo", home);
    until(() => r.action.arrived, () => {
      if (r.sitAmount > .15) assert.ok(Math.abs(Math.atan2(Math.sin(r.root.rotation.y - home.yaw), Math.cos(r.root.rotation.y - home.yaw))) < .1, "降低身体之前应面向房间");
      r.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > FLOOR_Y));
    });
    assert.ok(Math.abs(r.root.position.y - home.seat.y) < .02);
    characters.moveTo("momo", WORK_SPOTS.momo);
    until(() => r.action.arrived, () => {
      if (r.sitAmount > .1 && r.sitAmount < .8) assert.ok(r.root.position.x < home.seat.x - .04, "站起时臀部先移向坐垫前方");
      r.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > FLOOR_Y));
    });
  }
}));

test("六个角色的取书手掌实际接触书缘，地垫入座与离座保持道具连续", () => studio(({ characters, props, step, until }) => {
  const checked = new Set(), previous = new Map();
  for (const r of characters.residents) characters.moveTo(r.data.id, { ...HOME_SPOTS[r.data.id], pose: "read", ambient: true });
  until(() => characters.residents.every((r) => r.bookHandling.phase === "reading"), () => {
    for (const r of characters.residents) {
      const b = r.bookHandling;
      if (previous.has(r)) assert.ok(previous.get(r).distanceTo(b.position) < .09, `${r.data.id} 的书本不能跳变`);
      previous.set(r, b.position.clone());
      if (b.phase === "pickup" && b.age >= .8 && b.age <= .85) {
        checked.add(r.data.id);
        r.wrists.forEach((wrist, index) => {
          const target = new Vector3(index === 0 ? -.035 : -.16, index === 0 ? .072 : -.005, .025).applyQuaternion(b.quaternion).add(b.position);
          const palm = wrist.localToWorld(new Vector3(0, -.055, 0));
          assert.ok(palm.distanceTo(target) < .045, `${r.data.id} 伸手须接触书缘，距离 ${palm.distanceTo(target)}`);
        });
      }
    }
  });
  assert.equal(checked.size, 6);
  const floorReader = characters.residents.find((r) => r.data.id === "luna");
  assert.ok(new Box3().setFromObject(floorReader.document).min.y > .82, "地垫阅读时书角不能穿入约 .805 米高的茶几桌面");
  characters.moveTo("luna", { x: -1.7, z: -1.1, yaw: 0, pose: "listen" });
  const luna = characters.residents.find((r) => r.data.id === "luna");
  until(() => !luna.propBusy && luna.action.arrived, () => {
    assert.ok(previous.get(luna).distanceTo(luna.bookHandling.position) < .09);
    previous.set(luna, luna.bookHandling.position.clone());
    luna.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > -.025));
  });
}));

test("个人水杯从各自杯位取放，不交换或自动加水；笔记本留在书写桌面", () => studio(({ scene, characters, stage, props, step, until }) => {
  step();
  const cups = scene.children.filter((object) => object.name === "workspace-water-cup" && object.userData.personalActor);
  const rests = new Map(cups.map((cup) => [cup.userData.personalActor, cup.position.clone()]));
  for (const id of ["mori", "amber"]) {
    const r = characters.residents.find((r) => r.data.id === id), cup = cups.find((c) => c.userData.personalActor === id);
    characters.moveTo(id, { ...WATER_STATION, pose: "drink" });
    let previous = cup.position.clone(), lifted = false;
    until(() => r.action.age >= 6.3, () => {
      assert.ok(previous.distanceTo(cup.position) < .06, "杯子在杯架与手中之间连续移动"); previous.copy(cup.position);
      lifted ||= r.drinkLift > .8;
      cups.filter((other) => other !== cup).forEach((other) => assert.ok(other.position.distanceTo(rests.get(other.userData.personalActor)) < .001));
    });
    assert.ok(lifted); assert.ok(cup.position.distanceTo(rests.get(id)) < .001);
    const fill = props.state(id, "drink").fill;
    step(80); assert.equal(props.state(id, "drink").fill, fill, "放回杯架不能凭空加水");
    characters.moveTo(id, { x: id === "mori" ? -1.5 : .5, z: -1.1, pose: "idle", yaw: 0 });
    until(() => r.action.arrived);
  }
  const writer = characters.residents.find((r) => r.data.id === "sleepy"), note = scene.getObjectByName("personal-note-sleepy");
  const location = note.position.clone(); characters.moveTo("sleepy", WORK_SPOTS.sleepy);
  until(() => writer.action.arrived); step(80);
  assert.ok(props.state("sleepy", "note").writing); assert.equal(note.parent, scene); assert.equal(note.position.distanceTo(location), 0);
}));

test("工作场景确认等待收书、归还和实际到岗；不会把放书点当成工位", async () => studio(async ({ characters, stage, step, until }) => {
  const r = characters.residents.find((r) => r.data.id === "mori");
  characters.moveTo("mori", { ...HOME_SPOTS.mori, ambient: true });
  until(() => r.bookHandling.phase === "reading");
  let acknowledged = false;
  const signal = new AbortController().signal;
  const pending = stage.play({ type: "agent.state", actor: "mori", status: "working" }, signal).then(() => stage.waitForActor("mori", signal)).then(() => { acknowledged = true; });
  let sawPlacement = false;
  for (let frame = 0; frame < 4000 && !acknowledged; frame++) {
    step();
    if (r.bookHandling.phase === "placing") { sawPlacement = true; assert.equal(acknowledged, false); }
    await new Promise(setImmediate);
  }
  assert.ok(acknowledged); assert.ok(sawPlacement); await pending;
  assert.equal(r.bookHandling.held, false); assert.ok(Math.hypot(r.root.position.x - WORK_SPOTS.mori.x, r.root.position.z - WORK_SPOTS.mori.z) < .01);
}));

test("持书去沙发途中改派不会误从未到达的座位离场，停止后可继续收书", () => studio(({ characters, stage, step, until }) => {
  const r = characters.residents.find((r) => r.data.id === "amber");
  characters.moveTo("amber", { ...HOME_SPOTS.amber, ambient: true });
  until(() => r.bookHandling.phase === "travel" && r.path.length > 0);
  characters.moveTo("amber", WORK_SPOTS.amber);
  assert.equal(r.action.seat, null, "途中改派不能把尚未到达的沙发当作当前座位");
  step(8); stage.stop();
  assert.equal(r.bookHandling.held, true, "停止不会把手上的道具瞬移回桌面");
  step(20); characters.moveTo("amber", WORK_SPOTS.amber);
  until(() => !r.propBusy && r.action.arrived, () => {
    assert.ok(canOccupy(r.root.position.x, r.root.position.z, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES], .19));
  });
  assert.equal(r.bookHandling.held, false);
}));

test("接入实体道具后完整分工、工作、交接、返工与散场仍能完成", async () => studio(async ({ characters, stage, step }) => {
  stage.idle(); step(500);
  const signal = new AbortController().signal;
  let tail = Promise.resolve();
  const emit = (event) => {
    tail = tail.then(async () => { await stage.play(event, signal); if (event.type === "agent.state") stage.setAgent(event.actor, event); });
    tail.catch(() => {});
  };
  let done = false, failure;
  const run = runCollaboration({ pace: 0, signal, emit, narrate: async (event) => {
    await tail; await stage.prepareSpeech(event, signal); stage.finishSpeech(event);
  } }).then(async () => { await tail; done = true; }).catch((error) => { failure = error; done = true; });
  for (let frame = 0; frame < 24000 && !done; frame++) { step(); await new Promise(setImmediate); }
  assert.ok(done, `道具动作不能阻塞完整协作：${JSON.stringify(characters.residents.map((r) => ({ id: r.data.id, position: r.root.position.toArray(), action: r.action, phase: r.bookHandling.phase, traffic: r.traffic })))}`); if (failure) throw failure; await run;
  for (const r of characters.residents) { assert.equal(r.propBusy, false); assert.equal(r.action.arrived, true); assert.ok(r.action.ambient); }
}));
