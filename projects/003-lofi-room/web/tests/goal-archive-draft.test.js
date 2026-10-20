import test from "node:test";
import assert from "node:assert/strict";
import { goalArchiveEnabled, goalArchiveLabel } from "../shared/goal-draft.js";

test("未保存的新目标草稿禁用归档入口", () => {
  assert.equal(goalArchiveEnabled({ newGoal: true }), false);
  assert.equal(goalArchiveEnabled({ newGoal: true, running: false, discussionBusy: false }), false);
});

test("已保存目标（未归档或已归档）保持归档/恢复可用", () => {
  assert.equal(goalArchiveEnabled({ newGoal: false }), true);
  assert.equal(goalArchiveEnabled({ newGoal: false, running: false, discussionBusy: false }), true);
});

test("协作运行或讨论进行中仍然禁用归档", () => {
  assert.equal(goalArchiveEnabled({ newGoal: false, running: true }), false);
  assert.equal(goalArchiveEnabled({ newGoal: false, discussionBusy: true }), false);
});

test("草稿态按钮文案固定为归档目标，已有目标按归档状态切换", () => {
  assert.equal(goalArchiveLabel({ newGoal: true, status: "archived" }), "归档目标");
  assert.equal(goalArchiveLabel({ newGoal: true, status: "ready" }), "归档目标");
  assert.equal(goalArchiveLabel({ newGoal: false, status: "ready" }), "归档目标");
  assert.equal(goalArchiveLabel({ newGoal: false, status: "archived" }), "恢复目标");
});
