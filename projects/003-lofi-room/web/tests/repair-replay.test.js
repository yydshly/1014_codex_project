import test from "node:test";
import assert from "node:assert/strict";
import { repairMoments, repairSnapshot } from "../shared/repair-replay.js";

test("真实返工回看只选择已有失败、对话、源码写入和通过记录，缺少闭环则不伪造", () => {
  const activity = (kind, rest) => ({ type: "work.activity", actor: kind === "write" ? "indigo" : "momo", activity: { kind, ...rest } });
  const events = [
    { type: "agent.state", actor: "momo", status: "testing" },
    activity("browser", { round: 1, criterion: 1, action: "assertEnabled", status: "failed", target: { selector: "#archive" }, expected: false, actual: true }),
    { type: "revision", round: 1 },
    { type: "speech", purpose: "repair", actor: "momo", text: "实际仍启用" },
    { type: "speech", purpose: "repair", actor: "indigo", text: "修复草稿态" },
    { type: "agent.state", actor: "indigo", status: "working" },
    activity("write", { status: "completed", after: "真实写入" }),
    { type: "agent.state", actor: "momo", status: "testing" },
    activity("browser", { round: 2, criterion: 1, action: "assertEnabled", status: "done", passed: true, target: { selector: "#archive" }, expected: false, actual: false }),
    { type: "run.complete" },
  ];
  assert.deepEqual(repairMoments(events), events.map((_, i) => i));
  assert.deepEqual(repairMoments(events.slice(0, -1)), []);
  assert.deepEqual(repairMoments(events.filter((e) => e.activity?.status !== "failed")), []);
  const frame = repairSnapshot({ goal: { title: "实际任务" } }, events, 1);
  assert.equal(frame.live, false); assert.equal(frame.replaying, true);
  assert.equal(frame.events.length, 2); assert.ok(!frame.events.some((e) => e.activity?.kind === "write"));
  assert.equal(frame.tasks.find((t) => t.id === "momo").status, "testing");
});
