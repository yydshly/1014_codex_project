import assert from 'node:assert/strict';

const credits = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const near = (a, b) => Math.abs(a - b) < 1e-6;
const beforeCreation = status => /^(?:not-created|rejected-before-creation|cancelled_before_submission|planned$|draft$)/.test(status || '');

/** Commitments are budget exposure, never proof of an actual debit. No filesystem or mutations. */
export function summarizeBudgetLedger(ledger) {
  assert.equal(ledger.experiment_id, '004-performance-film');
  assert.equal(ledger.credit_cap, 2400);
  assert(Array.isArray(ledger.tasks), '视频任务账本须为数组');
  assert(ledger.image_tasks === undefined || Array.isArray(ledger.image_tasks), '图片任务账本须为数组');
  const videoTasks = ledger.tasks, imageTasks = ledger.image_tasks || [], all = [...videoTasks, ...imageTasks];
  assert(all.every(task => typeof task.id === 'string' && task.id.trim() && typeof task.submitted === 'boolean'), '每次尝试须有唯一编号与明确submitted状态');
  assert.equal(new Set(all.map(task => task.id)).size, all.length, '图像和视频任务编号不能重复');
  for (const task of all) {
    if (task.submitted) {
      assert(!beforeCreation(task.status), `${task.id}创建前拒绝状态不能同时记为已提交`);
      assert(credits(task.credits_committed), `${task.id}已提交任务须记录承诺积分，失败与未采用任务也不能省略`);
    } else assert(task.credits_committed === undefined || task.credits_committed === 0, `${task.id}未创建不能记入承诺积分；不确定费用须另列预留`);
  }
  const submittedVideoTasks = videoTasks.filter(task => task.submitted === true);
  const submittedImageTasks = imageTasks.filter(task => task.submitted === true);
  const videoCredits = submittedVideoTasks.reduce((sum, task) => sum + task.credits_committed, 0);
  const imageCredits = submittedImageTasks.reduce((sum, task) => sum + task.credits_committed, 0);
  const submittedCredits = videoCredits + imageCredits;
  assert(credits(ledger.submitted_credits_total) && near(submittedCredits, ledger.submitted_credits_total), '图片与视频承诺合计和账本总额不一致');

  const reservations = ledger.reservations || [];
  assert(Array.isArray(reservations), '预留须为独立明细数组');
  assert.equal(new Set(reservations.map(item => item.task_id)).size, reservations.length, '同一未确认尝试不能重复预留');
  for (const item of reservations) {
    const task = all.find(task => task.id === item.task_id);
    assert(task && task.submitted === false && credits(item.credits) && item.credits > 0, '预留只对应未提交的已记录尝试，不能重复累计已承诺费用');
    assert(!/^(?:rejected-before-creation|cancelled_before_submission)/.test(task.status || ''), '明确创建前拒绝的尝试不应保留付费风险预留');
  }
  const reservedCredits = reservations.reduce((sum, item) => sum + item.credits, 0);
  const declaredReserve = ledger.reserved_unconfirmed_credits ?? 0;
  assert(credits(declaredReserve) && near(reservedCredits, declaredReserve), '非零预留须提供未提交任务明细，明细与汇总仅计一次');
  const exposureCredits = submittedCredits + reservedCredits;
  assert(exposureCredits <= ledger.credit_cap, '已承诺与未确认预留合计超过2400钻上限');
  return { submittedVideoTasks, submittedImageTasks, videoCredits, imageCredits, submittedCredits, reservedCredits, exposureCredits };
}
