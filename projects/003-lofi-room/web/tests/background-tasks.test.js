import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApi, BASE } from "../server/api.js";
import { BackgroundTasks } from "../server/background-tasks.js";
import { BackgroundClient, taskToReconnect } from "../src/background-client.js";
import { Collaboration } from "../src/collaboration.js";
import { GoalStore } from "../shared/goals.js";

const input = () => {
  const id = randomUUID();
  return { requestId: id, mode: "repository", execution: "upstream", url: "https://github.com/example/project", goal: "增加任务重连",
    context: { criteria: ["刷新后接回同一任务"] }, client: { goalId: randomUUID(), runId: id, title: "持续执行验证" } };
};
async function fixture(t, sourceTask) {
  const directory = await mkdtemp(join(tmpdir(), "lofi-background-"));
  const api = createApi({ directory, getConfig: () => ({ apiKey: "background-test-secret", voices: {} }), sourceTask,
    takeoverFactory: () => null,
    sandboxProbe: async () => ({ available: true }) });
  const server = createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}${BASE}`;
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const post = (body, suffix = "tasks") => fetch(new URL("api/" + suffix, base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { directory, base, post, get: (path) => fetch(new URL("api/" + path, base)).then(async (r) => ({ status: r.status, body: await r.json() })) };
}
async function until(check) {
  for (let i = 0; i < 100; i++) { const result = await check(); if (result) return result; await new Promise((resolve) => setTimeout(resolve, 10)); }
  assert.fail("后台任务应在限定时间进入预期状态");
}

test("HTTP接管保留任务编号与修改版本，等待真实操作收尾，继续后读取新指导", async (t) => {
  let release, entered = false, seen;
  const f = await fixture(t, async ({ signal, emit, control }) => {
    const finish = await control.enter({ actor: "indigo", label: "写入文件" }, signal);
    entered = true; await new Promise((resolve) => { release = resolve; }); await finish();
    await control.checkpoint(signal); seen = control.notes.at(-1)?.text;
    emit({ type: "run.complete" });
  });
  const initial = await f.post(input()), task = (await initial.json()).task;
  await until(() => entered);
  const pause = await f.post({ actor: "indigo", version: 0 }, `tasks/${task.id}/pause`);
  assert.equal(pause.status, 200); assert.equal((await pause.json()).task.status, "pausing");
  assert.equal((await f.post({ actor: "indigo", version: 0, text: "新指导" }, `tasks/${task.id}/feedback`)).status, 409);
  release(); await until(async () => (await f.get(`tasks/${task.id}`)).body.task.status === "paused");
  assert.equal((await f.post({ actor: "unknown", version: 0, text: "新指导" }, `tasks/${task.id}/feedback`)).status, 400);
  const edited = await (await f.post({ actor: "indigo", version: 0, text: "按新指导修改源码" }, `tasks/${task.id}/feedback`)).json();
  assert.equal(edited.task.id, task.id); assert.equal(edited.task.control.version, 1);
  assert.equal((await f.post({ actor: "indigo", version: 0 }, `tasks/${task.id}/resume`)).status, 409);
  assert.equal((await f.post({ actor: "indigo", version: 1 }, `tasks/${task.id}/resume`)).status, 200);
  await until(async () => (await f.get(`tasks/${task.id}`)).body.task.status === "completed");
  assert.equal(seen, "按新指导修改源码");
});

test("提交后关闭观察连接仍执行；重新进入按同一任务和事件游标补齐实际结果", async (t) => {
  let release, executions = 0, aborted = false;
  const f = await fixture(t, async ({ signal, emit }) => {
    executions++; signal.addEventListener("abort", () => { aborted = true; });
    emit({ type: "run.start", goal: "增加任务重连", time: Date.now() });
    emit({ type: "agent.state", actor: "indigo", status: "working", task: "修改源码", time: Date.now() });
    await new Promise((resolve) => { release = resolve; });
    emit({ type: "work.activity", actor: "indigo", activity: { id: "write-1", status: "completed", output: "actual file write" } });
    emit({ type: "run.complete", artifactCount: 1, time: Date.now() });
  });
  const body = input(), initial = await f.post(body);
  assert.equal(initial.status, 202); const task = (await initial.json()).task;
  assert.equal((await f.get("execution-status")).body.task.id, task.id);
  const connection = new AbortController();
  const observed = await fetch(new URL(`api/tasks/${task.id}`, f.base), { signal: connection.signal });
  const first = await observed.json(); connection.abort();
  assert.ok(first.events.length >= 2); assert.equal(aborted, false);
  release();
  await until(async () => (await f.get(`tasks/${task.id}`)).body.task.status === "completed");
  const following = (await f.get(`tasks/${task.id}?after=${first.cursor}&limit=1`)).body;
  assert.equal(following.events[0].type, "work.activity"); assert.equal(following.hasMore, true);
  const finish = (await f.get(`tasks/${task.id}?after=${following.cursor}`)).body;
  assert.equal(finish.events[0].type, "run.complete"); assert.equal(finish.task.client.runId, body.requestId);
  assert.equal(executions, 1); assert.equal(aborted, false);
  assert.equal((await f.get("execution-status")).body.task, null);
  const disk = await readFile(join(f.directory, ".cache/background-tasks", task.id, "events.ndjson"), "utf8");
  assert.deepEqual(disk.trim().split("\n").map(JSON.parse).map((e) => e.seq), [1, 2, 3, 4]);
});

test("不确定的重复POST不会重复开工；拒绝同编号换需求，只有显式停止才取消", async (t) => {
  let executions = 0, cancelled = false;
  const f = await fixture(t, async ({ signal, emit }) => {
    executions++; emit({ type: "agent.state", actor: "momo", status: "testing", task: "运行测试" });
    await new Promise((resolve) => signal.addEventListener("abort", () => { cancelled = true; resolve(); }, { once: true }));
  });
  const body = input();
  const responses = await Promise.all([f.post(body), f.post(body), f.post(body)]);
  const tasks = await Promise.all(responses.map((r) => r.json()));
  assert.equal(new Set(tasks.map((r) => r.task.id)).size, 1); assert.equal(executions, 1);
  assert.equal((await f.post({ ...body, goal: "换成另一项任务" })).status, 409);
  assert.equal((await f.post(input())).status, 429);
  const id = tasks[0].task.id;
  assert.equal((await f.post({}, `tasks/${id}/cancel`)).status, 200);
  await until(async () => (await f.get(`tasks/${id}`)).body.task.status === "cancelled");
  assert.equal(cancelled, true);
  const result = (await f.get(`tasks/${id}`)).body;
  assert.equal(result.events.at(-1).type, "run.cancelled"); assert.equal(executions, 1);
  assert.equal((await f.post({}, `tasks/${id}/cancel`)).status, 200);
});

test("失败证据与后台状态保持一致，API密钥不进入事件或持久化文件", async (t) => {
  const f = await fixture(t, async ({ emit }) => { emit({ type: "tool", actor: "mori", label: "background-test-secret" }); throw new Error("failed background-test-secret"); });
  const { task } = await (await f.post(input())).json();
  await until(async () => (await f.get(`tasks/${task.id}`)).body.task.status === "error");
  const result = (await f.get(`tasks/${task.id}`)).body;
  assert.equal(result.events.at(-1).type, "run.error"); assert.ok(!JSON.stringify(result).includes("background-test-secret"));
  for (const file of ["task.json", "events.ndjson"])
    assert.ok(!(await readFile(join(f.directory, ".cache/background-tasks", task.id, file), "utf8")).includes("background-test-secret"));
  assert.equal((await f.get("execution-status")).body.task, null);
  assert.equal((await f.get(`tasks/${task.id}?after=-1`)).status, 400);
});

test("执行服务重启后保留事件，未完成轮次明确标为中断，不擅自重跑命令", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-recover-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const id = randomUUID(), root = join(directory, ".cache/background-tasks", id);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "task.json"), JSON.stringify({ id, status: "running", startedAt: new Date().toISOString(), lastSeq: 1, input: input() }));
  await writeFile(join(root, "events.ndjson"), JSON.stringify({ type: "tool", actor: "indigo", label: "原构建日志", seq: 1 }) + "\n");
  const manager = new BackgroundTasks(directory), result = await manager.get(id);
  assert.equal(result.task.status, "interrupted"); assert.equal(result.events[0].label, "原构建日志");
  assert.equal(result.events.at(-1).type, "run.error"); assert.equal(manager.active, undefined);
  const again = new BackgroundTasks(directory), second = await again.get(id);
  assert.deepEqual(second.events, result.events, "重复读取不能重复追加中断事件");
});

test("观察客户端断网重连使用游标，去重补回日志，观察取消不向后台发送停止", async () => {
  let calls = 0; const seen = [], connections = [], paths = [];
  const client = new BackgroundClient({ base: "http://localhost/room/", sleep: async () => {},
    request: async (url) => {
      paths.push(String(url)); calls++;
      if (calls === 2) throw new TypeError("offline");
      return Response.json(calls === 1 ? { task: { status: "running" }, events: [{ seq: 1, type: "run.start" }] }
        : { task: { status: "completed" }, events: [{ seq: 1, type: "run.start" }, { seq: 2, type: "run.complete" }] });
    } });
  const result = await client.follow(randomUUID(), { signal: new AbortController().signal,
    onEvents: (events, info) => { seen.push(...events.map((e) => e.seq)); if (events[0].seq === 2) assert.equal(info.catchup, true); },
    onConnection: (state) => connections.push(state) });
  assert.deepEqual(seen, [1, 2]); assert.equal(result.status, "completed"); assert.ok(connections.includes("reconnecting"));
  assert.ok(paths[2].includes("after=1")); assert.ok(paths.every((p) => !p.includes("cancel")));
});

test("浏览器fetch保持全局接收者，避免类方法调用触发Illegal invocation", async () => {
  const client = new BackgroundClient({ base: "http://localhost/room/", request: function () {
    assert.equal(this, globalThis); return Promise.resolve(Response.json({ active: null, recent: [] }));
  } });
  assert.deepEqual(await client.list(), { active: null, recent: [] });
});

test("恢复目标沿用同一轮；浏览器存储清空时仍可由后台元数据重建关联", () => {
  const data = input(), task = { id: randomUUID(), ...data, repository: data.url, startedAt: new Date().toISOString() };
  const store = new GoalStore(null), first = store.attachTask(task), second = store.attachTask(task);
  assert.equal(first.run.id, data.requestId); assert.equal(first.goal.id, data.client.goalId);
  assert.equal(first.goal.runs.length, 1); assert.equal(first.run, second.run); assert.equal(first.run.backendTaskId, task.id);
});

test("最后一条事件已保存但终态尚未同步时，刷新仍接回完成状态", () => {
  const id = randomUUID(), task = { id, client: { runId: "same-round" }, status: "completed", lastSeq: 12 };
  assert.equal(taskToReconnect({ active: null, recent: [task] }, [{ id: "same-round", backendTaskId: id, backendCursor: 12, status: "stopped" }]), task);
  assert.equal(taskToReconnect({ active: null, recent: [task] }, [{ id: "same-round", backendTaskId: id, backendCursor: 12, status: "done" }]), undefined);
});

test("浏览器语音解锁未完成也立即提交后台任务", async (t) => {
  const originalDocument = globalThis.document; t.after(() => { globalThis.document = originalDocument; });
  globalThis.document = { getElementById: () => ({ value: "一个真实目标", checked: true }) };
  let submitted = false;
  const c = { mode: "live", running: false, beforeStart: () => ({}), reset() {}, onRunStart() {}, updateControls() {}, select() {},
    roomSoundEnabled: true, unlockRoomVoice: () => new Promise(() => {}),
    narrator: { unlock: () => new Promise(() => {}), stop() {} },
    runBackground: async () => { submitted = true; }, events: [] };
  await Collaboration.prototype.start.call(c);
  assert.equal(submitted, true); assert.equal(c.running, false);
});

test("停止后的日常位置暂时不可达也不阻止新任务提交", async (t) => {
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  const fields = new Map();
  globalThis.document = { getElementById: (id) => { if (!fields.has(id)) fields.set(id, { value: "新的真实目标", checked: false, replaceChildren() {} }); return fields.get(id); } };
  let submitted = false, noticed = false;
  const c = { mode: "live", running: false, states: new Map(), beforeStart: () => ({}), onRunStart() {}, onAgent() {}, updateControls() {}, select() {},
    stage: { stop() {}, idle() { throw new Error("人物无法到达工作位置"); }, notice() { noticed = true; } },
    narrator: { stop() {}, async unlock() {} }, reset() { Collaboration.prototype.reset.call(this); },
    runBackground: async () => { submitted = true; } };
  await Collaboration.prototype.start.call(c);
  assert.equal(submitted, true); assert.equal(noticed, true);
});

test("断线补进度保留使用者暂停，后台完成后再解除人物暂停", () => {
  let actorPaused = false;
  const c = { paused: true, states: new Map(), narrator: { stop() {}, pause() {} }, onAgent() {},
    stage: { followSnapshot() {}, pause(value) { actorPaused = value; } } };
  Collaboration.prototype.catchUpScene.call(c, false);
  assert.equal(c.paused, true); assert.equal(actorPaused, true);
  Collaboration.prototype.catchUpScene.call(c, true);
  assert.equal(c.paused, false);
});

test("接回已交付任务时，历史继续事件不能把后台终态改回执行中", async (t) => {
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { getElementById: () => ({ value: "" }) };
  const task = { id: randomUUID(), status: "completed", mode: "repository", execution: "upstream", goal: "原目标", control: { state: "running", version: 2 } };
  const c = { running: false, reset() {}, apply(event) { if (event.type === "execution.control") this.backendTask = { ...this.backendTask, status: event.control.state }; },
    catchUpScene(finished) { assert.equal(finished, true); }, renderMode() {}, updateControls() {}, syncExecutionControl() { assert.fail("终态不能恢复暂停动作"); } };
  await Collaboration.prototype.reconnectBackground.call(c, { task, cursor: 2, events: [{ type: "execution.control", control: { state: "running" } }, { type: "run.complete" }] });
  assert.equal(c.backendTask.status, "completed"); assert.equal(c.running, false);
});

test("实际浏览器开工先接回当前工位，旧交接旁白不会拖延显示，每轮只对齐一次", async (t) => {
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { hidden: false };
  let aligned = 0;
  const c = { states: new Map(), events: [], presentationPending: 5, narrator: { async waitResumed() {} }, stage: { async play() {} },
    apply(event) { this.events.push(event); }, syncState() {},
    catchUpScene() { aligned++; this.presentationController?.abort(); this.presentationController = new AbortController(); this.presentation = Promise.resolve(); this.presentationPending = 0; } };
  const event = { type: "work.activity", actor: "momo", runId: "source-fixture", activity: { kind: "browser", round: 1 } };
  Collaboration.prototype.receiveBackground.call(c, [event]); await c.presentation;
  assert.equal(aligned, 1);
  Collaboration.prototype.receiveBackground.call(c, [event]); await c.presentation;
  assert.equal(aligned, 1, "同一轮后续点击不能反复重置人物动作");
  Collaboration.prototype.receiveBackground.call(c, [{ ...event, activity: { kind: "browser", round: 2 } }]); await c.presentation;
  assert.equal(aligned, 2, "返工重测应重新跟上验证员");
});

test("关闭页面只停止观察和动作，显式停止则取消后台并等待终态", async (t) => {
  const before = globalThis.document; t.after(() => { globalThis.document = before; });
  globalThis.document = { getElementById: () => ({ textContent: "" }) };
  let cancels = 0;
  function room() {
    return { running: true, mode: "repository", backendTask: { id: randomUUID(), status: "running" },
      backend: { cancel: async () => { cancels++; return { task: { status: "cancelling" } }; } },
      controller: new AbortController(), presentationController: new AbortController(),
      stage: { stop() {} }, narrator: { stop() {}, dispose() {} }, roomNarrator: { dispose() {} }, states: new Map(), select() {}, syncState() {},
      stop: Collaboration.prototype.stop };
  }
  const closed = room(); Collaboration.prototype.dispose.call(closed);
  assert.equal(cancels, 0); assert.equal(closed.controller.signal.aborted, true);
  const stopped = room(); stopped.stop(); await new Promise(setImmediate);
  assert.equal(cancels, 1); assert.equal(stopped.controller.signal.aborted, false); assert.equal(stopped.stopping, true);
});

test("大量工具输出不会挤掉真实返工讨论，收到返工时优先播放该节点", async (t) => {
  const previous = globalThis.document; t.after(() => { globalThis.document = previous; });
  globalThis.document = { hidden: false };
  let aligned = 0; const played = [];
  const c = { states: new Map(), presentationPending: 20, narrator: { async waitResumed() {} },
    stage: { async play(e) { played.push(e.type); } }, apply() {}, syncState() {},
    catchUpScene() { aligned++; this.presentationController = new AbortController(); this.presentation = Promise.resolve(); this.presentationPending = 0; } };
  Collaboration.prototype.receiveBackground.call(c, Array.from({ length: 80 }, () => ({ type: "work.activity", activity: { kind: "command" } })));
  assert.equal(c.presentationPending, 20); assert.equal(aligned, 0);
  Collaboration.prototype.receiveBackground.call(c, [{ type: "speech", text: "过期交接" }, { type: "revision", round: 1 }]);
  await c.presentation;
  assert.equal(aligned, 1); assert.equal(played.at(-1), "revision");
  assert.ok(!played.includes("speech"), "旧交接不应挤占当前返工节点");
});
