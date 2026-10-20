import test from "node:test";
import assert from "node:assert/strict";
import { missionView, previewURL, executionIndicator } from "../shared/mission.js";
import { Workspace } from "../src/workspace.js";
import { GoalStore } from "../shared/goals.js";
const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
};
test("真实执行标识以后台为准，区分历史、预设、展示暂停和状态断连", () => {
  const idle = { connected: true, task: null };
  assert.equal(executionIndicator(idle, {}, true).label, "当前无真实任务执行");
  assert.equal(executionIndicator(idle, { running: true, mode: "demo" }).kind, "demo");
  assert.equal(executionIndicator(idle, { running: true, mode: "repository", started: true }).kind, "presentation");
  assert.equal(executionIndicator(idle, { running: true, mode: "repository" }).kind, "pending");
  const active = { connected: true, task: { mode: "repository", execution: "upstream", goal: "增加搜索" } };
  assert.equal(executionIndicator(active).kind, "real"); // A task from another tab is still real.
  assert.match(executionIndicator(active, { paused: true }).detail, /场景回放已暂停/);
  assert.match(executionIndicator(active).detail, /增加搜索/);
  assert.equal(executionIndicator({ connected: false, task: active.task }).kind, "unknown");
  assert.equal(executionIndicator({ ...idle, maintenance: true }).kind, "idle");
});
test("任务展示只关联当前目标与需求，返工、人工验收与地址到期分别表达", () => {
  const store = new GoalStore(memory());
  store.create({ title: "搜索待办", brief: "增加搜索功能", criteria: ["输入关键词可筛选"] });
  const run = store.begin("repository");
  const events = [{ type: "agent.state", actor: "indigo", status: "working", task: "搜索" }, { type: "revision", message: "空结果需要提示" }];
  store.updateRun(store.selected.id, run.id, { events, status: "running" });
  assert.equal(missionView(store.selected).status, "讨论返工");
  assert.equal(missionView(store.selected).step, 2);
  events.push({ type: "run.complete", delivery: { expiresAt: "2026-01-01T00:00:00Z", tests: { passed: true } } });
  store.updateRun(store.selected.id, run.id, { events, status: "done" });
  const view = missionView(store.selected, Date.parse("2026-01-02T00:00:00Z"));
  assert.equal(view.status, "待你体验"); assert.equal(view.expired, true); assert.equal(view.step, 4);
  store.edit({ brief: "增加搜索和分类" });
  assert.equal(missionView(store.selected).delivery, null);
  assert.equal(missionView(store.selected).run, null);
  assert.match(missionView(store.selected).activity, /旧成果/);
  assert.equal(store.selected.runs[0].goal, "增加搜索功能");
  store.create({ title: "另一个任务", brief: "导出文件", criteria: ["下载成功"] });
  assert.equal(missionView(store.selected).delivery, null);
  assert.equal(previewURL("javascript:alert(1)", "http://localhost:4175/"), null);
  assert.equal(previewURL("http://u:p@localhost:10", "http://localhost/"), null);
  assert.equal(previewURL("http://127.0.0.1:5000/demo/", "http://localhost/"), "http://127.0.0.1:5000/demo/");
});
test("成果反馈交回同一目标，原需求和历史成果保留，意见进入下一轮", () => {
  const store = new GoalStore(memory());
  const previous = store.begin("repository");
  store.updateRun(store.selected.id, previous.id, { status: "done", events: [{ type: "run.complete", delivery: { kind: "upstream", runId: previous.id } }] });
  const selected = store.selected.id, brief = store.selected.brief;
  const fields = { "result-feedback": { value: "增加搜索无结果提示" }, "result-dialog": { close() { this.closed = true; } } };
  const prior = globalThis.document;
  globalThis.document = { getElementById: (id) => fields[id] };
  let next;
  try {
    Workspace.prototype.submitFeedback.call({ store, render() {}, collaboration: { start() { next = store.begin("repository"); } } });
  } finally { globalThis.document = prior; }
  assert.equal(store.selected.id, selected); assert.equal(store.selected.brief, brief);
  assert.equal(next.previousRunId, previous.id);
  assert.match(next.notes.at(-1).text, /增加搜索无结果提示/);
  assert.equal(store.selected.runs[1].events[0].delivery.runId, previous.id);
  assert.equal(fields["result-dialog"].closed, true);
});

test("目标隔离、每轮交付、白板意见和刷新恢复", () => {
  const storage = memory(),
    store = new GoalStore(storage),
    first = store.selected.id;
  const second = store.create({
    title: "第二个目标",
    brief: "一个可检查的目标",
    criteria: ["保留证据"],
  });
  store.addNote("请保留修改历史");
  const run = store.begin("live");
  const artifacts = [{ id: "a1", actor: "mori", content: "产物" }],
    events = [
      { type: "agent.state", actor: "mori", status: "working", task: "分工" },
    ];
  store.updateRun(second.id, run.id, { artifacts, events, status: "running" });
  artifacts[0].content = "被外部修改";
  assert.equal(store.selected.runs[0].artifacts[0].content, "产物");
  const restored = new GoalStore(storage);
  assert.equal(restored.selected.id, second.id);
  assert.equal(restored.selected.status, "stopped");
  assert.equal(restored.selected.runs[0].status, "stopped");
  assert.equal(restored.tasks()[0].status, "cancelled");
  assert.equal(restored.selected.notes[0].text, "请保留修改历史");
  restored.select(first);
  assert.equal(restored.selected.runs.length, 0);
  restored.select(second.id);
  restored.updateRun(second.id, run.id, { status: "done", reportId: "a1" });
  restored.edit({ accepted: true });
  restored.archive();
  assert.throws(() => restored.begin("demo"), /归档/);
  restored.archive();
  assert.equal(restored.selected.status, "done");
  assert.equal(restored.selected.runs[0].reportId, "a1");
  restored.begin("demo");
  assert.equal(restored.selected.runs[0].previousRunId, run.id);
  assert.equal(restored.selected.accepted, false);
  assert.equal(restored.selected.runs.length, 2);
});
test("无效目标不会覆盖已有记录，存储失败可导出内存结果", () => {
  const store = new GoalStore({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  assert.equal(store.persistent, false);
  const title = store.selected.title;
  assert.throws(() => store.edit({ brief: "" }), /填写/);
  assert.equal(store.selected.title, title);
  assert.throws(
    () =>
      store.create({ title: "x", brief: "内容", criteria: ["x".repeat(121)] }),
    /填写/,
  );
  assert.equal(store.list().length, 1);
});
