import test from "node:test";
import assert from "node:assert/strict";
import { Scene, Vector3 } from "three";
import { createResidents } from "../src/residents.js";
import { createTeamScene } from "../src/team-scene.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { STAGE_OBSTACLES, WORK_SPOTS, BOARD_SPOTS, HOME_SPOTS } from "../src/stage-layout.js";
import { canOccupy } from "../src/navigation.js";
import { runCollaboration } from "../shared/workflow.js";
import { FLOOR_Y } from "../src/ground-surfaces.js";

function studio(reduced = false) {
  const scene = new Scene(), obstacles = [...OBSTACLES, ...STAGE_OBSTACLES];
  const characters = createResidents(scene, ROOM, obstacles);
  const stage = createTeamScene(scene, characters);
  let time = 0;
  const step = () => {
    time += 0.05;
    characters.update(time, 0.05, reduced, null);
    stage.update(time, 0.05, 0.5, reduced);
    assert.deepEqual(characters.trafficState().contacts, [], "集结、交接、离座和散场时人物之间必须保留空间");
    for (const r of characters.residents) {
      const docking = r.action?.seat || r.action?.depart || r.exitPoint;
      const collisions = docking ? obstacles.filter((o) =>
        o.id !== (r.action?.seat?.obstacle || r.sittingSeat?.obstacle) &&
        !(o.minX === 3 && o.maxX === 3.8) && !(o.minX === 3.52 && o.maxX === 5.12 && r.root.position.x >= 3.15 && [-0.18, 0.78].some((z) => Math.abs(r.root.position.z - z) < 0.02))) : obstacles;
      assert.ok(canOccupy(r.root.position.x, r.root.position.z, ROOM, collisions, 0.19), `${r.data.id} 不应穿过家具；位置 ${r.root.position.x}, ${r.root.position.z}，动作 ${JSON.stringify(r.action)}`);
    }
  };
  const drive = async (promise, observe = () => {}) => {
    let done = false, failure;
    promise.then(() => { done = true; }, (error) => { done = true; failure = error; });
    for (let frame = 0; frame < 16000 && !done; frame++) {
      step(); observe();
      await new Promise(setImmediate);
    }
    assert.ok(done, "动作必须在可达路径上完成，不能无限等待");
    if (failure) throw failure;
  };
  return { scene, characters, stage, step, drive };
}

test("后台快照恢复当前工位，不重播历史集结和语音，完成后回到个人活动", async () => {
  const { characters, stage, drive } = studio();
  let speeches = 0;
  stage.configureDialogue({ speak() { speeches++; }, cancel() {}, pause() {} });
  const states = new Map([["indigo", { status: "working", task: "恢复编码" }], ["momo", { status: "testing", task: "恢复测试" }]]);
  stage.followSnapshot(states);
  await drive(Promise.all([stage.waitForActor("indigo"), stage.waitForActor("momo")]));
  const developer = characters.residents.find((r) => r.data.id === "indigo");
  assert.equal(developer.action.pose, "type"); assert.equal(developer.action.seat.obstacle, "chair");
  assert.equal(speeches, 0, "恢复不能重复历史播报或触发新对话请求");
  stage.followSnapshot(states, true);
  assert.ok(characters.residents.every((r) => r.action.ambient));
});

test("执行接管让开发员离开电脑到白板听取指导，继续同一任务后重新入座编码", async () => {
  const { characters, stage, drive } = studio();
  const states = new Map([["indigo", { status: "working", task: "修改源码" }], ["momo", { status: "testing", task: "等待重测" }]]);
  stage.followSnapshot(states);
  await drive(stage.waitForActor("indigo"));
  const developer = characters.residents.find((r) => r.data.id === "indigo");
  assert.equal(developer.action.pose, "type");
  await drive(stage.takeover({ actor: "indigo", version: 0, notes: [] }, new AbortController().signal));
  assert.equal(developer.action.pose, "listen");
  assert.equal(developer.action.seat, undefined);
  assert.ok(Math.hypot(developer.root.position.x - BOARD_SPOTS.indigo.x, developer.root.position.z - BOARD_SPOTS.indigo.z) < 0.5);
  assert.match(stage.caption, /后台后续工具已暂停/);
  stage.endDiscussion(true); await drive(stage.resume());
  assert.equal(developer.action.pose, "type");
  assert.ok(developer.action.seat); assert.equal(developer.stageFrozen, false);
});

test("接管时邀请验证员到白板当面回应，双方听完保持等待，继续后各回原工位", async () => {
  const { characters, stage, drive } = studio();
  const states = new Map([["indigo", { status: "working", task: "修改源码" }], ["momo", { status: "testing", task: "独立验证" }]]);
  stage.followSnapshot(states); await drive(Promise.all([stage.waitForActor("indigo"), stage.waitForActor("momo")]));
  await drive(stage.takeover({ actor: "indigo", version: 1, notes: [{ text: "请和桃桃核对" }] }, new AbortController().signal));
  const control = { actor: "indigo", version: 1, notes: [{ text: "请和桃桃核对" }], discussion: { participants: ["indigo", "mori", "momo"] } };
  await drive(stage.takeover(control, new AbortController().signal));
  const tester = characters.residents.find((r) => r.data.id === "momo");
  assert.equal(tester.action.seat, undefined);
  await stage.takeoverSpeech({ actor: "indigo", to: "momo", text: "请核对保存后的验证" });
  assert.equal(characters.residents.find((r) => r.data.id === "indigo").action.pose, "point");
  assert.equal(tester.action.pose, "listen");
  await stage.takeoverSpeech({ actor: "momo", to: "indigo", text: "我会关闭重开验证" }); stage.finishTakeoverSpeech();
  for (let frame = 0; frame < 120; frame++) stage.update(frame / 20, 0.05, 0, false);
  assert.equal(tester.action.pose, "listen"); assert.equal(tester.action.seat, undefined);
  stage.endDiscussion(true); await drive(stage.resume());
  assert.equal(tester.action.pose, "type");
  assert.ok(Math.hypot(tester.root.position.x - WORK_SPOTS.momo.x, tester.root.position.z - WORK_SPOTS.momo.z) < 0.3);
  assert.equal(characters.residents.find((r) => r.data.id === "indigo").action.pose, "type");
});

test("验证员浏览器操作对应电脑工位，失败后参与白板返工", async () => {
  const { characters, stage, drive } = studio();
  characters.setTeamState("momo", { status: "testing", task: "打开Demo并操作验收" });
  await drive(stage.play({ type: "agent.state", actor: "momo", status: "testing", task: "打开Demo并操作验收" }));
  await drive(stage.waitForActor("momo"));
  const tester = characters.residents.find((r) => r.data.id === "momo");
  assert.equal(tester.action.pose, "type");
  assert.ok(Math.hypot(tester.root.position.x - WORK_SPOTS.momo.x, tester.root.position.z - WORK_SPOTS.momo.z) < 0.3, "实际浏览器操作应在验证员电脑工位");
  await drive(stage.play({ type: "work.activity", actor: "momo", activity: { kind: "browser", label: "点击保存后内容未更新", status: "failed" } }));
  assert.match(tester.action.label, /浏览器验收.*内容未更新/);
  await drive(stage.play({ type: "revision", round: 1, issues: ["实际内容与预期不符"] }));
  assert.equal(tester.action.seat, undefined, "白板讨论时不保留座位绑定");
  assert.ok(Math.hypot(tester.root.position.x - BOARD_SPOTS.momo.x, tester.root.position.z - BOARD_SPOTS.momo.z) < 0.5);
});

test("完整协作通过白板集结、电脑入座、并行检查、当面交接和返工推进", async () => {
  const { characters, stage, drive } = studio();
  const signal = new AbortController().signal;
  let tail = Promise.resolve(), seated = false, parallel = false, handoffs = 0;
  const emit = (event) => {
    tail = tail.then(async () => {
      await stage.play(event, signal);
      if (event.type === "agent.state") stage.setAgent(event.actor, event);
      if (event.type === "handoff") {
        const a = characters.residents.find((r) => r.data.id === event.from);
        const b = characters.residents.find((r) => r.data.id === event.to);
        assert.ok(a.root.position.distanceTo(b.root.position) < 1.65, "递交必须当面进行");
        handoffs++;
      }
    });
    tail.catch(() => {});
  };
  const run = runCollaboration({ pace: 0, signal, emit, narrate: async (event) => {
    await tail;
    await stage.prepareSpeech(event, signal);
    stage.finishSpeech(event);
  } }).then(async (result) => { await tail; return result; });
  await drive(run, () => {
    const developer = characters.residents.find((r) => r.data.id === "indigo");
    seated ||= Boolean(developer.action?.seat && developer.action.arrived);
    parallel ||= characters.residents.filter((r) => ["reviewing", "testing"].includes(r.team?.status) && r.action?.arrived).length === 2;
  });
  assert.ok(seated, "开发员必须实际入座");
  assert.ok(parallel, "审阅和验证应同时在各自工位进行");
  assert.ok(handoffs >= 10);
  characters.residents.forEach((r) => {
    assert.ok(r.action.arrived);
    const destination = HOME_SPOTS[r.data.id].seat || HOME_SPOTS[r.data.id];
    assert.ok(r.action.ambient, "交付完成后应各自休整");
    assert.ok(Math.hypot(r.root.position.x - destination.x, r.root.position.z - destination.z) < 0.08);
  });
});

test("分工后无关人员离开白板，等待活动不改变任务状态；交接仅邀请相关伙伴", async () => {
  const { characters, stage, drive, step } = studio();
  const signal = new AbortController().signal;
  await drive(stage.play({ type: "run.start" }, signal));
  for (const r of characters.residents) stage.setAgent(r.data.id, { status: "queued" });
  await drive(stage.prepareSpeech({ actor: "mori", to: "amber" }, signal));
  stage.finishSpeech({ actor: "mori", to: "amber" });
  await drive(stage.play({ type: "handoff", from: "mori", to: "amber", title: "任务单" }, signal));
  await drive(stage.play({ type: "agent.state", actor: "amber", status: "working" }, signal));
  stage.setAgent("amber", { status: "working" });
  for (let i = 0; i < 600; i++) step();
  for (const r of characters.residents.filter((person) => person.data.id !== "amber")) {
    assert.ok(r.action.ambient, `${r.data.id} 应回到个人活动，而不是留在白板前`);
    assert.equal(r.team.status, "queued", "个人活动不能冒充任务进度");
    assert.ok(Math.hypot(r.root.position.x - BOARD_SPOTS[r.data.id].x, r.root.position.z - BOARD_SPOTS[r.data.id].z) > 1.5);
  }
  const tester = characters.residents.find((r) => r.data.id === "momo");
  await drive(stage.prepareSpeech({ actor: "indigo", to: "luna" }, signal));
  assert.ok(tester.action.ambient);
  assert.notEqual(tester.action.label, "电脑旁核对与交接", "验证员不应被开发员和审阅员的交流叫过去");
});

test("临时白板讨论结束后参与者散开，其他休息者保持自己的活动", async () => {
  const { characters, stage, drive, step } = studio();
  const signal = new AbortController().signal;
  stage.idle();
  for (let i = 0; i < 600; i++) step();
  const researcher = characters.residents.find((r) => r.data.id === "amber");
  const before = researcher.root.position.clone();
  const previous = researcher.action;
  const age = researcher.action.age;
  await drive(stage.beginDiscussion(["mori", "indigo"], signal));
  assert.ok(!researcher.stageFrozen && researcher.action.ambient);
  assert.ok(researcher.action !== previous || researcher.action.age > age || before.distanceTo(researcher.root.position) > 0.01, "其他伙伴的活动不应被临时讨论冻结");
  stage.endDiscussion(false);
  for (let i = 0; i < 600; i++) step();
  for (const r of characters.residents) {
    assert.ok(r.action.ambient, "临时讨论后回到个人活动");
    assert.ok(Math.hypot(r.root.position.x - BOARD_SPOTS[r.data.id].x, r.root.position.z - BOARD_SPOTS[r.data.id].z) > 1.5);
  }
});

test("回休息区途中仍能被叫去讨论，安全离开沙发后再返回，停止后不会自动散场", async () => {
  const { characters, stage, drive, step } = studio();
  const signal = new AbortController().signal;
  stage.idle();
  const researcher = characters.residents.find((r) => r.data.id === "amber");
  for (let i = 0; i < 250 && !(researcher.sitAmount > 0.1 && !researcher.action.arrived); i++) step();
  assert.ok(researcher.sitAmount > 0.1 && !researcher.action.arrived, "覆盖尚未坐稳就被叫走的情形");
  const grounded = () => {
    for (const r of characters.residents) for (const sole of r.soles)
      assert.ok(sole.getWorldPosition(new Vector3()).y > FLOOR_Y, "休息、起身和返回途中鞋底不能陷入可见地面");
  };
  await drive(stage.beginDiscussion(["amber", "luna"], signal), grounded);
  stage.endDiscussion(false);
  for (let i = 0; i < 600; i++) { step(); grounded(); }
  assert.ok(researcher.action.ambient);
  stage.stop();
  const stopped = characters.residents.map((r) => r.root.position.clone());
  for (let i = 0; i < 100; i++) step();
  characters.residents.forEach((r, i) => assert.ok(Math.hypot(stopped[i].x - r.root.position.x, stopped[i].z - r.root.position.z) < 0.001));
  stage.idle();
  for (let i = 0; i < 600; i++) step();
  assert.ok(characters.residents.every((r) => r.action.ambient));
});

test("待命时错开喝水、伸展和走动，单人用饮水角，之后回到个人位置且不推进任务", () => {
  const { characters, stage, step } = studio();
  stage.idle();
  const seen = new Set(), atHomeAfterBreak = new Set();
  const originalStatuses = characters.residents.map((r) => r.team.status);
  const tookBreak = new Set();
  for (let frame = 0; frame < 5000; frame++) {
    step();
    const away = characters.residents.filter((r) => !["home", undefined].includes(r.action?.ambientKind));
    assert.ok(away.length <= 2, "不能让整个办公室同时做操或散步");
    assert.ok(characters.residents.filter((r) => r.action?.ambientKind === "drink").length <= 1, "喝水位置需排他使用");
    for (const r of characters.residents) {
      if (["drink", "stretch", "walk"].includes(r.action?.ambientKind)) {
        tookBreak.add(r.data.id);
        if (r.action.arrived) seen.add(r.action.ambientKind);
      }
      if (tookBreak.has(r.data.id) && r.action?.ambientKind === "home" && r.action.arrived) atHomeAfterBreak.add(r.data.id);
      r.soles.forEach((sole) => assert.ok(sole.getWorldPosition(new Vector3()).y > -0.025));
    }
  }
  assert.deepEqual([...seen].sort(), ["drink", "stretch", "walk"]);
  assert.equal(atHomeAfterBreak.size, 6, "每个人都应完成休息活动并回到自己的位置");
  assert.deepEqual(characters.residents.map((r) => r.team.status), originalStatuses);
});

test("喝水中接到任务先放下杯子再去工位；散步和伸展也能被任务打断", async () => {
  const { scene, characters, stage, drive, step } = studio();
  const signal = new AbortController().signal;
  stage.idle();
  let drinker;
  for (let frame = 0; frame < 1200 && !drinker; frame++) {
    step();
    drinker = characters.residents.find((r) => r.drinkGrip > 0.95 && r.drinkLift > 0.9 && r.action.age > 2.75);
  }
  assert.ok(drinker, "实际喝水动作必须举杯到嘴边");
  const cup = scene.getObjectByName("workspace-water-cup");
  const palm = drinker.wrists[1].localToWorld(new Vector3(0, -0.055, 0));
  assert.ok(cup.position.distanceTo(palm) < 0.16 && cup.position.y > 1.3, "杯子应随手举起");
  await stage.play({ type: "agent.state", actor: drinker.data.id, status: "working" }, signal);
  stage.setAgent(drinker.data.id, { status: "working" });
  assert.ok(drinker.finishDrinkAge != null && !drinker.action.ambient);
  const before = drinker.root.position.clone();
  for (let frame = 0; frame < 10; frame++) step();
  assert.ok(before.distanceTo(drinker.root.position) < 0.001, "放杯子期间先不迈步");
  await drive(stage.play({ type: "artifact", artifact: { actor: drinker.data.id } }, signal));
  assert.equal(drinker.action.pose, WORK_SPOTS[drinker.data.id].pose);
  assert.equal(drinker.finishDrinkAge, null);
  assert.ok(cup.position.distanceTo(new Vector3(-0.195, 0.99, -3.225)) < 0.01);
  for (const kind of ["walk", "stretch"]) {
    let person;
    for (let frame = 0; frame < 3000 && !person; frame++) {
      step(); person = characters.residents.find((r) => r.action?.ambientKind === kind);
    }
    assert.ok(person, `${kind} 动作应可发生`);
    await stage.play({ type: "agent.state", actor: person.data.id, status: "working" }, signal);
    stage.setAgent(person.data.id, { status: "working" });
    await drive(stage.play({ type: "artifact", artifact: { actor: person.data.id } }, signal));
    assert.equal(person.action.pose, WORK_SPOTS[person.data.id].pose);
    assert.equal(person.action.ambient, undefined);
  }
});

test("暂停冻结日常动作，减少动态效果时不自动散步或做休息动作", () => {
  const { characters, stage, step } = studio();
  stage.idle();
  for (let i = 0; i < 400; i++) step();
  stage.pause(true);
  const before = characters.residents.map((r) => ({ position: r.root.position.clone(), arm: r.arms[1].quaternion.clone(), age: r.action.age }));
  for (let i = 0; i < 1200; i++) step();
  characters.residents.forEach((r, i) => {
    assert.equal(before[i].position.distanceTo(r.root.position), 0);
    assert.ok(before[i].arm.equals(r.arms[1].quaternion), "暂停时保持完全相同的关节四元数");
    assert.equal(before[i].age, r.action.age);
  });
  const reduced = studio(true);
  reduced.stage.idle();
  for (let i = 0; i < 3600; i++) reduced.step();
  assert.ok(reduced.characters.residents.every((r) => r.action.arrived && r.action.ambientKind === "home"));
});

test("暂停冻结人物与工作计时；停止中断等待，随后可安全离开电脑椅", async () => {
  const { characters, stage, drive, step } = studio();
  const controller = new AbortController();
  await drive(stage.play({ type: "agent.state", actor: "indigo", status: "working" }, controller.signal));
  const developer = characters.residents.find((r) => r.data.id === "indigo");
  for (let i = 0; i < 15; i++) step();
  stage.pause(true);
  const before = developer.root.position.clone();
  for (let i = 0; i < 100; i++) step();
  assert.equal(before.distanceTo(developer.root.position), 0);
  stage.pause(false);
  await drive(stage.play({ type: "artifact", artifact: { actor: "indigo" } }, controller.signal));
  assert.equal(developer.action.arrived, true);
  assert.ok(developer.knees.every((knee) => knee.rotation.x > 1));
  const waiting = stage.prepareSpeech({ actor: "indigo", to: "luna" }, controller.signal);
  const rejected = assert.rejects(waiting, { name: "AbortError" });
  controller.abort(); stage.stop();
  await rejected;
  const stopped = developer.root.position.clone();
  for (let i = 0; i < 100; i++) step();
  assert.ok(Math.hypot(stopped.x - developer.root.position.x, stopped.z - developer.root.position.z) < 0.001, "停止后未完成的离座也不能继续走动");
  const next = new AbortController();
  await drive(stage.play({ type: "run.start" }, next.signal));
  assert.ok(developer.action.arrived);
});

test("减少动态效果仍能到工位；临时白板讨论后能恢复原工作位置", async () => {
  const { characters, stage, drive } = studio(true);
  const signal = new AbortController().signal;
  await drive(stage.play({ type: "agent.state", actor: "indigo", status: "working" }, signal));
  await drive(stage.play({ type: "artifact", artifact: { actor: "indigo" } }, signal));
  stage.pause(true);
  await drive(stage.beginDiscussion(["mori", "indigo"], signal));
  stage.endDiscussion(true);
  await drive(stage.resume(signal));
  const developer = characters.residents.find((r) => r.data.id === "indigo");
  assert.equal(developer.action.pose, "type");
  assert.ok(Math.hypot(developer.root.position.x - WORK_SPOTS.indigo.seat.x, developer.root.position.z - WORK_SPOTS.indigo.seat.z) < 0.08);
});

test("临时讨论不会消耗原交接时长，恢复工位后才继续递交", async () => {
  const { stage, drive } = studio();
  const signal = new AbortController().signal;
  await drive(stage.play({ type: "run.start" }, signal));
  let delivered = false;
  const handoff = stage.play({ type: "handoff", from: "mori", to: "amber", title: "任务单" }, signal)
    .then(() => { delivered = true; });
  await new Promise(setImmediate);
  stage.pause(true);
  await drive(stage.beginDiscussion(["mori", "indigo"], signal));
  assert.equal(delivered, false);
  stage.endDiscussion(true);
  await drive(stage.resume(signal));
  assert.equal(delivered, false);
  await drive(handoff);
  assert.equal(delivered, true);
});
