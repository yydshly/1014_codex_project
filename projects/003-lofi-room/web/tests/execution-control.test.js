import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ExecutionControl } from "../server/execution-control.js";
import { BackgroundTasks } from "../server/background-tasks.js";
import { runCollaboration } from "../shared/workflow.js";
import { takeoverView } from "../shared/workbench.js";
import { workstationState, workstationFrame } from "../shared/workstation.js";
import { executionIndicator, missionView } from "../shared/mission.js";
import { linkedTaskId } from "../src/background-client.js";

const turn = () => new Promise(setImmediate);
const input = (version = 0) => ({ actor: "indigo", version });
const taskInput = () => ({ requestId: randomUUID(), mode: "repository", execution: "upstream", goal: "调整真实文件", context: {}, client: {} });

test("并行操作全部收尾才暂停；后续写入不启动，原任务继续且不重做已完成操作", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-takeover-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const events = [], control = new ExecutionControl({ changed: async (event) => events.push(event) });
  const finishDeveloper = await control.enter({ actor: "indigo", label: "写入源码" });
  const finishTester = await control.enter({ actor: "momo", label: "运行测试" });
  await control.pause(input()); assert.equal(control.state, "pausing");
  let nextStarted = false;
  const next = (async () => {
    const finish = await control.enter({ actor: "indigo", label: "下一份修改" });
    nextStarted = true; await writeFile(join(directory, "result.txt"), control.notes.at(-1).text); await finish();
  })();
  await finishDeveloper(); assert.equal(control.state, "pausing");
  await finishTester(); assert.equal(control.state, "paused");
  await turn(); assert.equal(nextStarted, false);
  await control.feedback({ ...input(), text: "按使用者要求完成实际写入" });
  await assert.rejects(control.resume(input()), /版本已更新/);
  await control.resume(input(1)); await next;
  assert.equal(await readFile(join(directory, "result.txt"), "utf8"), "按使用者要求完成实际写入");
  assert.deepEqual(events.map((event) => event.reason), ["pausing", "paused", "feedback", "resumed"]);
});

test("暂停跨越浏览器观察重连，意见脱敏落盘；刷新不继续执行，进程重启标为中断", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-takeover-journal-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manager = new BackgroundTasks(directory);
  let reach, done;
  const started = new Promise((resolve) => { reach = resolve; });
  const task = await manager.create(taskInput(), async ({ signal, control, emit }) => {
    await control.pause(input()); reach();
    await control.checkpoint(signal);
    done = true; emit({ type: "run.complete" });
  }, ["private-secret"]);
  await started;
  await manager.control(task.id, "feedback", { ...input(), text: "不要输出 private-secret" });
  const reconnect = await manager.get(task.id);
  assert.equal(reconnect.task.status, "paused"); assert.equal(reconnect.task.id, task.id); assert.equal(done, undefined);
  assert.equal(reconnect.task.control.notes[0].text, "不要输出 [redacted]");
  const saved = await readFile(join(directory, ".cache/background-tasks", task.id, "task.json"), "utf8");
  assert.ok(!saved.includes("private-secret")); assert.match(saved, /redacted/);
  const restarted = new BackgroundTasks(directory); assert.equal((await restarted.get(task.id)).task.status, "interrupted");
  await manager.control(task.id, "resume", input(1)); await manager.records.get(task.id).done;
  assert.equal(done, true); assert.equal((await manager.get(task.id)).task.status, "completed");
  await assert.rejects(manager.control(task.id, "pause", input(1)), /正在执行/);
});

test("暂停中停止会解除所有等待；并行阶段取消不会遗留挂起的工具", async () => {
  const parent = new AbortController(), peer = new AbortController();
  const control = new ExecutionControl({ signal: parent.signal });
  await control.pause(input());
  const waiting = control.checkpoint(peer.signal); peer.abort(new Error("同轮伙伴失败"));
  await assert.rejects(waiting, /同轮伙伴失败/); assert.equal(control.waiters.size, 0);
  const stopped = control.checkpoint(); parent.abort(new Error("使用者停止"));
  await assert.rejects(stopped, /使用者停止/); assert.equal(control.waiters.size, 0);
});

test("使用者暂停期间不消耗模型执行时限，继续后仍有明确超时", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const control = new ExecutionControl(), budget = control.budget(1000);
  t.mock.timers.tick(500); await control.pause(input());
  t.mock.timers.tick(60000); assert.equal(budget.signal.aborted, false);
  await control.resume(input()); t.mock.timers.tick(499); assert.equal(budget.signal.aborted, false);
  t.mock.timers.tick(1); assert.equal(budget.signal.aborted, true);
  budget.dispose(); assert.equal(control.observers.size, 0);
});

test("重复或冲突修改不会覆盖新意见，收尾前不能继续，封存后拒绝接管", async () => {
  const control = new ExecutionControl();
  const release = await control.enter({ actor: "momo", label: "独立测试" });
  await control.pause(input());
  await assert.rejects(control.resume(input()), /尚未进入/);
  await assert.rejects(control.feedback({ ...input(), text: "修改" }), /请等/);
  await release();
  await assert.rejects(control.feedback({ ...input(), text: " " }), /2000/);
  await control.feedback({ ...input(), text: "第一份意见" });
  await assert.rejects(control.feedback({ ...input(), text: "过期意见" }), /版本已更新/);
  await control.resume(input(1));
  assert.throws(() => control.seal(0), /重新验证/);
  control.seal(1); await assert.rejects(control.pause(input(1)), /最终交付/);
});

test("验证期间提出修改必须回到开发并重新审阅测试，保持同一个run.start", async () => {
  const control = new ExecutionControl(), events = [], stages = []; let changes = 0;
  const result = await runCollaboration({ goal: "保留原需求并调整实现", mode: "repository", control, maxRevisions: 3, emit: (event) => events.push(event),
    execute: async ({ stage, context }) => {
      stages.push(stage);
      if (stage === "test" && !changes++) {
        await control.pause(input()); await control.feedback({ ...input(), text: "保留原契约，补充边界处理" }); await control.resume(input(1));
      }
      if (stage === "develop" && changes) assert.equal(context.interventions[0].text, "保留原契约，补充边界处理");
      return { title: stage, summary: "实际处理", content: "保留证据", verdict: "approve", data: {} };
    } });
  assert.equal(events.filter((e) => e.type === "run.start").length, 1);
  assert.equal(stages.filter((s) => s === "develop").length, 2);
  assert.equal(stages.filter((s) => s === "test").length, 2);
  assert.equal(stages.filter((s) => s === "record").length, 1);
  assert.match(events.find((e) => e.type === "revision").message, /使用者/);
  assert.equal(result.artifacts.findLast((a) => a.stage === "develop").controlVersion, 1);
});

test("历史步骤与预设演示不能接管；暂停后的实体屏幕停止编码动效并标明等待指导", () => {
  const snapshot = { live: true, mode: "repository", backendTask: { id: randomUUID(), execution: "upstream", status: "paused", control: { state: "paused", version: 1, notes: [] } },
    tasks: [{ id: "indigo", status: "working" }], events: [] };
  assert.equal(takeoverView(snapshot).paused, true);
  assert.equal(takeoverView(snapshot, true).available, false);
  assert.equal(takeoverView({ ...snapshot, live: false }).available, false);
  const screen = workstationFrame(workstationState(snapshot, "indigo"), { time: 2 });
  assert.equal(screen.animating, false); assert.match(screen.label, /暂停/);
});

test("任务卡与后台标识一致显示执行暂停，继续事件恢复工作状态", () => {
  const event = { type: "execution.control", control: { actor: "indigo", state: "paused", version: 2 } };
  const run = { goal: "修改代码", criteria: ["原需求"], events: [event], status: "paused" };
  const goal = { brief: "修改代码", criteria: ["原需求"], runs: [run], status: "paused" };
  assert.match(missionView(goal).status, /使用者接管/); assert.match(missionView(goal).activity, /修改版本 2/);
  assert.match(executionIndicator({ connected: true, task: { status: "paused", execution: "upstream" } }).label, /已暂停/);
  run.events.push({ ...event, control: { ...event.control, state: "running" } }); goal.status = "running";
  assert.equal(missionView(goal).status, "团队执行中");
});

test("任务链接只接收UUID，用原任务恢复记录，不把目录或命令当任务", () => {
  const id = randomUUID();
  assert.equal(linkedTaskId(`http://localhost/?view=workspace&task=${id}`), id);
  for (const value of ["../source", "new", "", "a".repeat(36)]) assert.equal(linkedTaskId(`http://localhost/?task=${value}`), null);
});
