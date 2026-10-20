import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { ExecutionControl } from "../server/execution-control.js";
import { createTakeoverResponder, takeoverEvidence } from "../server/takeover-discussion.js";
import { takeoverBoard } from "../shared/takeover.js";
import { Collaboration } from "../src/collaboration.js";

const input = (version = 0) => ({ actor: "indigo", version });
const plan = { title: "调整交互与验证", speech: "我先和桃桃核对验收，再等你继续后修改。", steps: [{ kind: "develop", owner: "mori", change: "修改按钮与说明", verify: "保留原验收" }], partner: "momo", question: "请确认按钮保存后怎样验证。" };
const response = (value) => ({ stream: simulateReadableStream({ initialDelayInMs: 0, chunkDelayInMs: 0, chunks: [
  { type: "tool-call", toolCallId: randomUUID(), toolName: "submit_adjustment", input: JSON.stringify(value) },
  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: { inputTokens: { total: 10 }, outputTokens: { total: 10 } } },
] }) });

test("接管回应与伙伴讨论读取真实意见和工具证据，最终方案包含伙伴反馈", async () => {
  const calls = [], updates = [];
  const model = new MockLanguageModelV4({ doStream: async (options) => {
    calls.push(JSON.stringify(options.prompt));
    return response(calls.length === 1 ? plan : { ...plan, partner: null, question: "", speech: "桃桃建议增加保存后重开的验证，我会纳入方案，等你点击继续。", steps: [...plan.steps, { kind: "test", owner: "momo", change: "保存后关闭重开", verify: "新内容仍在" }] });
  } });
  const responder = createTakeoverResponder({ apiKey: "test", baseURL: "https://api.minimax.cn", textModel: "mock" }, { model, dialogue: async (args) => {
    assert.equal(args.actor, "momo"); assert.equal(args.previous[0].actor, "indigo");
    assert.match(args.context.notes[0], /保存后可重开/);
    return { text: "建议保存后关闭再打开，确认新内容仍在。" };
  } });
  await responder({ note: { ...input(), version: 1, text: "保存后可重开，找验证员核对" }, input: { goal: "完善说明", context: { criteria: ["原需求"] } },
    events: [{ type: "work.activity", actor: "indigo", activity: { id: "actual", kind: "write", path: "src/main.js", after: "actual source change" } }],
    signal: new AbortController().signal, update: async (value) => updates.push(value) });
  assert.equal(calls.length, 2); assert.match(calls[0], /actual source change/); assert.match(calls[1], /确认新内容仍在/);
  assert.deepEqual(updates.map((item) => item.line.actor), ["indigo", "momo", "indigo"]);
  assert.equal(updates.at(-1).plan.steps[0].owner, "indigo"); assert.equal(updates.at(-1).status, "ready"); assert.equal(updates.at(-1).plan.steps[1].owner, "momo");
});

test("独立小改动只回应一次，不强制邀请伙伴", async () => {
  let called = false; const updates = [];
  const responder = createTakeoverResponder({ apiKey: "test", baseURL: "https://api.minimax.cn", textModel: "mock" }, {
    model: new MockLanguageModelV4({ doStream: async () => response({ ...plan, partner: null, question: "" }) }), dialogue: async () => { called = true; },
  });
  await responder({ note: { actor: "indigo", version: 1, text: "调整一处文案" }, input: { goal: "文案", context: { criteria: [] } }, events: [], signal: new AbortController().signal, update: async (item) => updates.push(item) });
  assert.equal(called, false); assert.equal(updates.length, 1); assert.equal(updates[0].status, "ready");
});

test("邀请审阅员时使用她的身份，并保留前轮调整证据", async () => {
  let count = 0;
  const responder = createTakeoverResponder({ apiKey: "test", baseURL: "https://api.minimax.cn", textModel: "mock" }, {
    model: new MockLanguageModelV4({ doStream: async (options) => {
      assert.match(JSON.stringify(options.prompt), /前轮保留的意见/);
      return response(++count === 1 ? { ...plan, partner: "luna" } : { ...plan, partner: null, question: "" });
    } }), dialogue: async ({ actor, question }) => {
      assert.equal(actor, "luna"); assert.match(question, /你是月白（luna）/); assert.doesNotMatch(question, /你就是桃桃/);
      return { text: "我负责审阅改动范围。" };
    },
  });
  await responder({ note: { actor: "indigo", version: 2, text: "请月白审阅范围" }, input: { goal: "调整说明", context: { criteria: [] } },
    events: [{ type: "execution.control", control: { notes: [{ version: 1, text: "前轮保留的意见", plan }] } }],
    signal: new AbortController().signal, update: async () => {} });
  assert.equal(count, 2);
});

test("讨论不会解开执行暂停，方案进入后续角色指导；必须显式点击继续", async () => {
  let finishPlan, nextOperation = false;
  const events = [], control = new ExecutionControl({ changed: async (event) => events.push(event), respond: async ({ update }) => {
    await new Promise((resolve) => { finishPlan = resolve; });
    await update({ status: "ready", plan: { ...plan, partner: null }, line: { actor: "indigo", text: "等你继续后执行。" } });
  } });
  await control.pause(input()); await control.feedback({ ...input(), text: "请修改说明" });
  await assert.rejects(control.resume(input(1)), /角色正在回应/);
  const operation = control.enter({ label: "写入源码" }).then(async (release) => { nextOperation = true; await release(); });
  finishPlan(); await control.discussionDone;
  assert.equal(control.state, "paused"); assert.equal(nextOperation, false);
  assert.match(control.instructions(), /修改按钮与说明/);
  assert.equal(events.find((e) => e.reason === "feedback").control.discussion.plan, null, "历史快照不能被最终方案改写");
  await control.resume(input(1)); await operation; assert.equal(nextOperation, true);
});

test("新版本与取消废弃旧回应；失败可在同一版本重试而不自动执行", async () => {
  const parent = new AbortController(); let oldUpdate, fail = true;
  const control = new ExecutionControl({ signal: parent.signal, respond: async ({ note, update }) => {
    if (note.version === 1) { oldUpdate = update; return; }
    if (fail) throw new Error("模型暂不可用");
    await update({ status: "ready", plan, line: { actor: "indigo", text: "新方案" } });
  } });
  await control.pause(input()); await control.feedback({ ...input(), text: "旧意见" }); await control.discussionDone;
  assert.equal(control.discussion.status, "error");
  await control.feedback({ ...input(1), text: "新意见" }); await control.discussionDone;
  await oldUpdate({ status: "ready", plan, line: { actor: "indigo", text: "过期回应" } });
  assert.equal(control.discussion.version, 2); assert.equal(control.discussion.lines.length, 0);
  fail = false; await control.discuss(input(2)); await control.discussionDone;
  assert.equal(control.discussion.lines[0].text, "新方案"); assert.equal(control.version, 2); assert.equal(control.state, "paused");
  parent.abort(); await assert.rejects(control.resume(input(2)));
});

test("白板展示当前版本、真实分工与验证方法，过期方案不替代新意见", () => {
  const control = { state: "paused", version: 2, notes: [{ version: 2, text: "新修改意见" }], discussion: { version: 2, status: "ready", participants: ["indigo", "momo"], lines: [], plan } };
  const board = takeoverBoard({ backendTask: { control } });
  assert.equal(board.feedback, "新修改意见"); assert.equal(board.paused, true); assert.equal(board.plan.steps[0].verify, "保留原验收");
  assert.match(board.names, /小蓝.*桃桃/);
  assert.equal(takeoverBoard({ backendTask: { control: { ...control, version: 3 } } }), null);
  const resumed = takeoverBoard({ backendTask: { status: "running", control: { ...control, state: "running" } } });
  assert.equal(resumed.paused, false); assert.match(resumed.label, /已按此方案继续执行/);
  const delivered = takeoverBoard({ events: [{ type: "execution.control", control }, { type: "run.complete" }] });
  assert.equal(delivered.paused, false); assert.match(delivered.label, /本轮已交付/);
  const stopped = takeoverBoard({ backendTask: { status: "cancelled", control } });
  assert.equal(stopped.paused, false); assert.match(stopped.label, /本轮已结束/);
  const evidence = takeoverEvidence([{ type: "work.activity", actor: "indigo", activity: { id: "one", command: "npm test", status: "running" } }, { type: "work.activity", actor: "indigo", activity: { id: "one", command: "npm test", status: "failed", output: "actual failure" } }], "indigo");
  assert.equal(evidence.commands.length, 1); assert.equal(evidence.commands[0].status, "failed");
});

test("现场回应按到白板、本人、伙伴的顺序播报，重复快照不重复发声", async () => {
  const played = [], c = { takeoverController: new AbortController(), takeoverPlayback: Promise.resolve(), executionControl: { state: "paused" },
    stage: { async takeover() { played.push("arrive"); }, async takeoverSpeech(line) { played.push(line.actor); }, finishTakeoverSpeech() {}, notice() {} },
    takeoverNarrator: { stop() {}, async speak(line) { played.push(line.text); } }, notice() {} };
  const control = { discussion: { id: "dialogue", version: 1, status: "ready", participants: ["indigo", "momo"], lines: [{ id: "first", actor: "indigo", text: "我的调整" }, { id: "second", actor: "momo", text: "验证建议" }] } };
  Collaboration.prototype.queueTakeover.call(c, control); await c.takeoverPlayback;
  Collaboration.prototype.queueTakeover.call(c, control); await c.takeoverPlayback;
  assert.deepEqual(played, ["arrive", "indigo", "我的调整", "momo", "验证建议"]);
});
