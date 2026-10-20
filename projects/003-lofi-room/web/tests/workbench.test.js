import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceProject, SourceRun } from "../server/source-project.js";
import { localCommand } from "../server/local-runner.js";
import { workSteps, taskActor, workbenchView, changedExcerpt } from "../shared/workbench.js";
import { GoalStore } from "../shared/goals.js";

const event = (actor, id, status, extra = {}) => ({ type: "work.activity", actor, stage: actor === "momo" ? "test" : "develop", activity: { id, status, label: id, ...extra } });
test("命令进度合并到同一步，固定角色不被并行测试和闲聊抢走", () => {
  const events = [event("indigo", "write-1", "running"), event("indigo", "write-1", "completed", { kind: "write", after: "real code" }), event("momo", "test-1", "failed", { exitCode: 1, output: "actual assertion failure" }), { type: "speech", actor: "amber", kind: "room" }];
  assert.equal(workSteps(events).length, 2);
  assert.equal(taskActor(events), "momo");
  const pinned = workbenchView({ events, live: true }, { actor: "indigo" });
  assert.equal(pinned.actor, "indigo"); assert.equal(pinned.activity.after, "real code");
  const following = workbenchView({ events, live: true }, { actor: "indigo", follow: true });
  assert.equal(following.actor, "momo"); assert.equal(following.activity.exitCode, 1);
});
test("任务完成和历史步骤不伪装成实时进程，历史可精确回到旧步骤", () => {
  const events = [event("momo", "first", "failed"), event("momo", "retry", "completed"), { type: "run.complete", delivery: { demoUrl: "http://localhost:1234/" } }];
  const view = workbenchView({ events, live: true }, { actor: "momo", stepId: "first" });
  assert.equal(view.activity.id, "first"); assert.equal(view.historical, true); assert.equal(view.live, false);
  assert.equal(view.delivery.demoUrl, "http://localhost:1234/");
  assert.equal(taskActor(events), "sleepy");
});
test("长文件改动定位到实际变化区域，而不是只展示文件头", () => {
  const before = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
  const after = before.replace("line 390", "changed source");
  const excerpt = changedExcerpt(before, after);
  assert.equal(excerpt.line, 388); assert.match(excerpt.before, /line 390/); assert.match(excerpt.after, /changed source/);
});
test("辅助快照不覆盖最后一次有意义的测试输出，但仍可手动回看", () => {
  const events = [event("momo", "test", "completed", { kind: "command", output: "66 passed" }), event("momo", "snapshot", "completed", { kind: "inspect" })];
  assert.equal(workbenchView({ events }, { actor: "momo" }).activity.id, "test");
  assert.equal(workbenchView({ events }, { actor: "momo", stepId: "snapshot" }).activity.id, "snapshot");
});
test("大量工具记录后仍保留各角色最终状态，并限制浏览器保存的长日志", () => {
  const store = new GoalStore(); const run = store.begin("repository");
  const events = [{ type: "run.start" }, { type: "agent.state", actor: "amber", status: "done", task: "研究完成" },
    ...Array.from({ length: 200 }, (_, index) => event("momo", String(index), "completed", { kind: "command", output: "x".repeat(6000) }))];
  store.updateRun(store.selected.id, run.id, { events });
  const saved = store.selected.runs[0].events;
  assert.ok(saved.some((item) => item.type === "run.start"));
  assert.ok(saved.some((item) => item.type === "agent.state" && item.actor === "amber"));
  assert.equal(saved.at(-1).activity.output.length, 2500);
});
test("真实子进程在退出前发送输出，执行器给工作台返回真实退出码", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-observe-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = new SourceRun(directory); await run.init();
  const project = new SourceProject(directory, {}, run);
  project.root = directory;
  project.guest = { run: (_cmd, _args, options) => localCommand(process.execPath, ["-e", "process.stdout.write('started\\n');setTimeout(()=>{process.stderr.write('assertion failed\\n');process.exitCode=1},350)"], { ...options, cwd: directory }) };
  const progress = [];
  await project.progress.run((label, activity) => { if (activity) progress.push(activity); }, () => project.command("运行原项目 test", "npm", ["run", "test"]));
  assert.equal(progress[0].status, "running");
  assert.ok(progress.some((item) => item.status === "running" && item.output?.includes("started")));
  assert.equal(progress.at(-1).status, "failed"); assert.equal(progress.at(-1).exitCode, 1);
  assert.match(progress.at(-1).output, /assertion failed/);
  assert.equal(progress.at(-1).command, "npm run test");
});
test("内部快照辅助代码和编码源码不会泄露到工作台", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "lofi-observe-helper-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = new SourceRun(directory); await run.init();
  const project = new SourceProject(directory, {}, run); project.root = directory;
  project.guest = { run: async () => ({ exitCode: 0, stdout: "huge internal snapshot", stderr: "" }) };
  const progress = [];
  await project.progress.run((label, item) => { if (item) progress.push(item); }, () => project.command("记录工作树文件", "node", ["-e", "internal-helper-source"]));
  assert.equal(progress.at(-1).command, undefined);
  assert.doesNotMatch(JSON.stringify(progress), /huge internal snapshot|internal-helper-source/);
});
