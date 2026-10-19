import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeBudgetLedger } from './budget-ledger.mjs';

const ledger = (tasks, imageTasks, total, extra = {}) => ({ experiment_id: '004-performance-film', credit_cap: 2400,
  tasks, image_tasks: imageTasks, submitted_credits_total: total, reserved_unconfirmed_credits: 0, ...extra });

test('创建前失败和旧submitted_at不计报价；已提交且响应失败的图片仍计承诺', () => {
  const input = ledger([
    { id: 'OPEN_t1', submitted: false, status: 'not-created-no-card', credits_committed: 0, credits_displayed: 180 },
    { id: 'OPEN_t2', submitted: false, status: 'rejected-before-creation', credits_committed: 0, credits_displayed: 180 },
    { id: 'OPEN_t3', submitted: false, status: 'not-created-after-verification', credits_committed: 0, credits_displayed: 270, submitted_at: '2026-10-15T12:52:15Z' },
  ], [{ id: 'MASTER_IMAGE_t1', submitted: true, status: 'response-failed-awaiting-persistence-verification', credits_committed: 50, credits_displayed: 50 }], 50);
  const before = JSON.stringify(input), result = summarizeBudgetLedger(input);
  assert.deepEqual([result.videoCredits, result.imageCredits, result.submittedCredits, result.exposureCredits], [0, 50, 50, 50]);
  assert.equal(result.submittedVideoTasks.length, 0); assert.equal(JSON.stringify(input), before);
});

test('失败、重做与未采用的已提交任务都计承诺，而非显示报价', () => {
  const result = summarizeBudgetLedger(ledger([
    { id: 'A_t1', submitted: true, status: 'failed', credits_committed: 100, credits_displayed: 999 },
    { id: 'A_t2', submitted: true, status: 'downloaded', credits_committed: 150, used_in_final: false },
  ], [{ id: 'REF', submitted: true, status: 'downloaded', credits_committed: 50 }], 300));
  assert.deepEqual([result.videoCredits, result.imageCredits, result.submittedCredits], [250, 50, 300]);
});

test('预留独立计一次且不能再覆盖已提交任务', () => {
  const input = ledger([{ id: 'A', submitted: true, status: 'downloaded', credits_committed: 200 },
    { id: 'B', submitted: false, status: 'unconfirmed', credits_committed: 0 }], [], 200,
    { reserved_unconfirmed_credits: 180, reservations: [{ task_id: 'B', credits: 180 }] });
  assert.equal(summarizeBudgetLedger(input).exposureCredits, 380);
  assert.throws(() => summarizeBudgetLedger({ ...input, reservations: [{ task_id: 'A', credits: 180 }] }), /不能重复累计/);
  assert.throws(() => summarizeBudgetLedger({ ...input, reservations: [] }), /明细与汇总/);
});

test('拒绝矛盾状态、漏记总额及超额预算', () => {
  assert.throws(() => summarizeBudgetLedger(ledger([{ id: 'A', submitted: false, credits_committed: 100 }], [], 0)), /未创建不能/);
  assert.throws(() => summarizeBudgetLedger(ledger([{ id: 'A', submitted: true, status: 'rejected-before-creation', credits_committed: 100 }], [], 100)), /拒绝状态/);
  assert.throws(() => summarizeBudgetLedger(ledger([], [{ id: 'I', submitted: true, credits_committed: 50 }], 0)), /账本总额/);
  assert.throws(() => summarizeBudgetLedger(ledger([{ id: 'A', submitted: true, credits_committed: 2401 }], [], 2401)), /超过2400/);
});
