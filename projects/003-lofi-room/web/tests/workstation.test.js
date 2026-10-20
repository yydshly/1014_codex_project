import test from "node:test";
import assert from "node:assert/strict";
import { workstationState, workstationFrame, SCREEN_EXAMPLE } from "../shared/workstation.js";
import { createWorkstationDisplay } from "../src/workstation-display.js";

const activity = (actor, id, kind, data) => ({ type: "work.activity", actor, activity: { id, kind, status: "completed", ...data } });
const snapshot = { live: true, tasks: [{ id: "indigo", status: "working" }, { id: "momo", status: "testing" }], events: [
  activity("indigo", "code", "write", { path: "src/main.js", after: 'export const answer = "real source";\nreturn answer;', line: 28 }),
  activity("indigo", "build", "command", { command: "npm run build", output: "built successfully", exitCode: 0 }),
  activity("momo", "test", "command", { command: "npm test", output: "not ok 1 - actual assertion", exitCode: 1, status: "failed" }),
] };
test("开发屏幕同时保留真实源码和最新终端，测试屏幕只接收验证员的数据", () => {
  const develop = workstationState(snapshot, "indigo"), testing = workstationState(snapshot, "momo");
  assert.match(develop.code, /real source/); assert.equal(develop.command.command, "npm run build");
  assert.equal(develop.line, 28); assert.equal(develop.active, true);
  assert.equal(testing.code, ""); assert.equal(testing.command.exitCode, 1); assert.match(testing.output, /actual assertion/);
});
test("实际写入按时间回显；历史默认静止，显式回放不冒称实时任务", () => {
  const live = workstationState(snapshot, "indigo");
  const first = workstationFrame(live, { time: 1, changeStart: 0 });
  const second = workstationFrame(live, { time: 3, changeStart: 0 });
  assert.ok(second.visibleCode.length > first.visibleCode.length);
  const history = workstationState({ ...snapshot, live: false }, "indigo");
  assert.equal(workstationFrame(history, { time: .1, changeStart: 0 }).visibleCode, history.code);
  const replay = workstationFrame(history, { time: 2, replayStart: 0 });
  assert.match(replay.label, /记录回放/); assert.doesNotMatch(replay.label, /真实任务/);
  const testing = workstationState({ ...snapshot, live: false }, "momo");
  assert.match(workstationFrame(testing, { time: 6, replayStart: 0 }).output, /actual assertion/);
});
test("无真实任务的动效使用明确示意标识，减少动态效果时不逐字播放", () => {
  const idle = workstationState({}, "indigo");
  assert.equal(workstationFrame(idle).code, "");
  const sample = workstationFrame(idle, { time: 2, replayStart: 0 });
  assert.equal(sample.illustrative, true); assert.match(sample.label, /动效示意.*无真实任务/);
  const reduced = workstationFrame(idle, { time: 2, replayStart: 0, reducedMotion: true });
  assert.equal(reduced.visibleCode, SCREEN_EXAMPLE); assert.equal(reduced.animating, false);
});
test("房间Canvas显示实际失败而非虚假PASS，源码使用颜色与行号绘制", () => {
  const text = [], colors = [];
  const context = { fillStyle: "", font: "", fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, rect() {}, clip() {},
    measureText: (value) => ({ width: value.length * 12 }), fillText(value) { text.push(value); colors.push(this.fillStyle); } };
  const surface = { context, texture: {} };
  const testing = createWorkstationDisplay(surface, "momo"); testing.sync(snapshot, 0); testing.draw(6, false);
  assert.ok(text.some((value) => value.includes("FAIL"))); assert.ok(text.some((value) => value.includes("actual assertion")));
  assert.ok(!text.some((value) => value.includes("PASS")));
  text.length = 0; colors.length = 0;
  const coding = createWorkstationDisplay(surface, "indigo"); coding.sync(snapshot, 0); coding.draw(6, false);
  assert.ok(text.some((value) => value.trim() === "28")); assert.ok(colors.includes("#b5a3ed")); assert.equal(surface.texture.needsUpdate, true);
});
