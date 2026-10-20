import test from "node:test";
import assert from "node:assert/strict";
import { Scene } from "three";
import { createResidents } from "../src/residents.js";
import { createTeamScene } from "../src/team-scene.js";
import { ROOM, OBSTACLES } from "../src/room.js";
import { STAGE_OBSTACLES } from "../src/stage-layout.js";
import { ROOM_CLIPS, workLines } from "../shared/room-lines.js";
import { runCollaboration } from "../shared/workflow.js";

function office() {
  const scene = new Scene();
  const characters = createResidents(scene, ROOM, [...OBSTACLES, ...STAGE_OBSTACLES]);
  const stage = createTeamScene(scene, characters);
  let time = 0;
  const step = () => { time += 0.05; characters.update(time, 0.05, false, null); stage.update(time, 0.05, 0.4, false); };
  const drive = async (promise) => {
    let done = false, failure;
    promise.then(() => { done = true; }, (error) => { failure = error; done = true; });
    for (let i = 0; i < 18000 && !done; i++) { step(); await new Promise(setImmediate); }
    assert.ok(done, "互动与原工作必须能够完成");
    if (failure) throw failure;
  };
  return { characters, stage, step, drive };
}

test("自然相遇触发双向招呼和休息闲聊，只有空闲伙伴参加，结束后继续原活动", () => {
  const { characters, stage, step } = office();
  stage.idle();
  const original = characters.residents.map((r) => r.team.status);
  let greeting = false, chat = false, resumed = false, previousActors = [];
  for (let i = 0; i < 6000; i++) {
    step();
    const state = stage.social;
    if (state.active) {
      assert.equal(state.actors.length, 2);
      assert.ok(state.actors.every((id) => characters.residents.find((r) => r.data.id === id).action.ambient));
      greeting ||= state.kind === "greeting" && state.phase === "talk" && state.line === 1;
      chat ||= state.kind === "chat" && state.phase === "talk" && state.line === 1;
      previousActors = state.actors;
    } else if (previousActors.length) {
      resumed ||= previousActors.every((id) => !characters.residents.find((r) => r.data.id === id).action.socialId);
      previousActors = [];
    }
  }
  assert.ok(greeting && chat && resumed);
  assert.deepEqual(characters.residents.map((r) => r.team.status), original, "闲聊不生成虚假工作状态");
});

test("工作、手动讨论和停止可抢占闲聊，释放两人，不留下过期发言", async () => {
  const { characters, stage, step, drive } = office();
  const lines = [], cancelled = [];
  stage.configureDialogue({
    speak(event, signal) { lines.push(event); signal.addEventListener("abort", () => cancelled.push(event.actor), { once: true }); },
    cancel() {},
  });
  stage.idle();
  for (let i = 0; i < 1200 && stage.social.phase !== "talk"; i++) step();
  assert.equal(stage.social.active, true);
  const [actor, partner] = stage.social.actors;
  for (let i = 0; i < 10; i++) step();
  assert.ok(lines.some((line) => line.kind === "room"));
  const signal = new AbortController().signal;
  await stage.play({ type: "agent.state", actor, status: "working" }, signal);
  stage.setAgent(actor, { status: "working" });
  assert.equal(stage.social.active, false);
  assert.ok(cancelled.length);
  assert.equal(characters.residents.find((r) => r.data.id === actor).action.ambient, undefined);
  assert.ok(!characters.residents.find((r) => r.data.id === partner).action.socialId);
  await drive(stage.play({ type: "artifact", artifact: { actor } }, signal));
  for (let i = 0; i < 1500 && !stage.social.active; i++) step();
  await drive(stage.beginDiscussion(["mori", "indigo"], signal));
  assert.equal(stage.social.active, false);
  stage.endDiscussion(false);
  stage.stop();
  const count = lines.length;
  for (let i = 0; i < 1200; i++) step();
  assert.equal(lines.length, count, "停止后不能继续说下一句");
});

test("完整工作流包含主动核对和当面交接回应，所有语音发生在两人会合之后", async () => {
  const { characters, stage, drive } = office();
  const lines = [];
  stage.configureDialogue({
    speak(event) {
      const a = characters.residents.find((r) => r.data.id === event.actor);
      const b = characters.residents.find((r) => r.data.id === event.to);
      assert.ok(a.action.arrived && b.action.arrived);
      assert.ok(a.root.position.distanceTo(b.root.position) < 1.65);
      lines.push(event);
    }, cancel() {},
  });
  const signal = new AbortController().signal;
  let tail = Promise.resolve();
  const run = runCollaboration({ pace: 0, signal, emit(event) {
    tail = tail.then(async () => {
      await stage.play(event, signal);
      if (event.type === "agent.state") stage.setAgent(event.actor, event);
    });
    tail.catch(() => {});
  }, narrate: async (event) => { await tail; await stage.prepareSpeech(event, signal); stage.finishSpeech(event); } });
  await drive(run.then(async () => { await tail; }));
  assert.ok(lines.filter((line) => line.kind === "handoff").length >= 10);
  assert.ok(lines.some((line) => line.kind === "work" && line.actor === "indigo"));
  assert.ok(lines.some((line) => line.kind === "work" && line.actor === "sleepy"));
  assert.ok(characters.residents.every((r) => r.action.ambient));
});

test("互动短句覆盖六个人的招呼、回应、闲聊与工作音色", () => {
  assert.equal(Object.keys(ROOM_CLIPS).length, 36);
  assert.equal(new Set(Object.values(ROOM_CLIPS).map((line) => line.actor)).size, 6);
  for (const line of Object.values(ROOM_CLIPS)) {
    assert.ok(line.text.length < 80);
    assert.equal(line.collection, "room");
  }
});

test("工作回应被临时讨论暂停时保留原话，不会取消本轮或在讨论中提前交接", async () => {
  const { stage, step, drive } = office();
  const signal = new AbortController().signal;
  await drive(stage.play({ type: "run.start" }, signal));
  let finishVoice, cancelled = 0, delivered = false;
  stage.configureDialogue({ speak() { return new Promise((resolve) => { finishVoice = resolve; }); }, cancel() { cancelled++; }, pause() {} });
  const handoff = stage.play({ type: "handoff", from: "mori", to: "indigo", title: "工作资料" }, signal).then(() => { delivered = true; });
  for (let i = 0; i < 1500 && !finishVoice; i++) { step(); await new Promise(setImmediate); }
  assert.ok(finishVoice);
  stage.pause(true);
  await drive(stage.beginDiscussion(["mori", "indigo"], signal));
  assert.equal(cancelled, 0, "临时讨论应暂停原工作回应，不能把工作当成闲聊取消");
  finishVoice();
  for (let i = 0; i < 30; i++) { step(); await new Promise(setImmediate); }
  assert.equal(delivered, false);
  stage.endDiscussion(true);
  await drive(stage.resume(signal));
  stage.pause(false);
  await drive(handoff);
  assert.equal(delivered, true);
});

test("真实工作对齐引用实际交接摘要，区分准备好的短句，不虚构新的检查结论", () => {
  const artifact = { title: "审阅意见 v2", summary: "仍需补上取消队列的验收条件。" };
  const lines = workLines({ mode: "live", actor: "indigo", partner: "luna", task: "处理返工反馈", artifact });
  assert.equal(lines[0].actor, "indigo");
  assert.equal(lines[1].actor, "luna");
  assert.ok(lines[0].text.includes(artifact.title) && lines[0].text.includes("处理返工反馈"));
  assert.ok(lines[1].text.startsWith(artifact.summary));
  assert.ok(lines.every((line) => !line.clip && line.text.length < 160));
  const preset = workLines({ mode: "demo", actor: "indigo", partner: "luna", artifact });
  assert.ok(preset.every((line) => line.collection === "room" && ROOM_CLIPS[line.clip]));
});
