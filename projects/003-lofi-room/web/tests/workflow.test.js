import test from "node:test";
import assert from "node:assert/strict";

test("并行审阅只涉及旧测试且验证已通过时，由验证员交给审阅员复核，不重复开发", async () => {
  const counts = { develop: 0, review: 0, test: 0 };
  const result = await runCollaboration({
    mode: "repository",
    execute: async ({ stage, inputs }) => {
      if (stage in counts) counts[stage]++;
      const reconciled = inputs.some(
        (artifact) =>
          artifact.stage === "test" && artifact.verdict === "approve",
      );
      return {
        title: stage,
        summary: "当前角色已处理实际输入",
        content: "角色复核记录",
        verdict: stage === "review" && !reconciled ? "revise" : "approve",
        data: { fixTarget: stage === "review" ? "tests" : "code" },
      };
    },
  });
  assert.deepEqual(counts, { develop: 1, review: 2, test: 1 });
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "handoff" &&
        event.from === "momo" &&
        event.to === "luna",
    ),
  );
  assert.ok(!result.events.some((event) => event.type === "revision"));
  assert.equal(result.events.at(-1).type, "run.complete");
});
import {
  runCollaboration,
  createDemoExecutor,
  checkPlan,
} from "../shared/workflow.js";

test("协作串联产物依赖，审阅与验证并行，返工后交付", async () => {
  const result = await runCollaboration({ pace: 0 });
  assert.equal(result.artifacts.length, 9);
  const states = result.events.filter((e) => e.type === "agent.state");
  const reviewStart = states.find(
    (e) => e.actor === "luna" && e.status === "reviewing",
  ).seq;
  const testStart = states.find(
    (e) => e.actor === "momo" && e.status === "testing",
  ).seq;
  const firstReviewDone = states.find(
    (e) => e.actor === "luna" && e.status === "blocked",
  ).seq;
  assert.ok(reviewStart < firstReviewDone && testStart < firstReviewDone);
  assert.equal(result.events.filter((e) => e.type === "revision").length, 1);
  const final = result.artifacts.find(
    (a) => a.stage === "develop" && a.revision === 1,
  );
  assert.ok(checkPlan(final.data).every((check) => check.passed));
  const report = result.artifacts.find((a) => a.id === result.reportId);
  assert.equal(report.actor, "sleepy");
  assert.ok(report.inputIds.includes(final.id));
  const ids = new Set(result.artifacts.map((a) => a.id));
  for (const event of result.events.filter((e) => e.type === "handoff"))
    assert.ok(ids.has(event.artifactId));
  assert.equal(result.events.at(-1).type, "run.complete");
});

test("停止后不继续交接或生成下游产物", async () => {
  const controller = new AbortController(),
    events = [];
  await assert.rejects(
    runCollaboration({
      pace: 0,
      signal: controller.signal,
      emit: (event) => {
        events.push(event);
        if (event.type === "artifact") controller.abort();
      },
    }),
    (error) => error.name === "AbortError",
  );
  assert.equal(events.filter((e) => e.type === "artifact").length, 1);
  assert.equal(events.filter((e) => e.type === "handoff").length, 0);
  assert.equal(events.at(-1).type, "run.cancelled");
});

test("语音回放完成后才交接，模型失败不会切换为预设成功", async () => {
  let narrated = 0;
  const events = [];
  await runCollaboration({
    pace: 0,
    narrate: async () => {
      narrated++;
    },
    emit: (event) => {
      events.push(event);
      if (event.type === "handoff") assert.ok(narrated > 0);
    },
  });
  assert.equal(narrated, 10);
  const failures = [];
  await assert.rejects(
    runCollaboration({
      mode: "live",
      execute: async () => {
        throw new Error("模型不可用");
      },
      emit: (e) => failures.push(e),
    }),
    /模型不可用/,
  );
  assert.equal(failures.at(-1).type, "run.error");
  assert.equal(failures.filter((e) => e.type === "artifact").length, 0);
});

test("不完整的模型产物被拒绝，不进入语音或下游", async () => {
  const events = [];
  await assert.rejects(
    runCollaboration({
      mode: "live",
      execute: async () => ({ content: "缺少标题和摘要", verdict: "approve" }),
      emit: (event) => events.push(event),
    }),
    /未提交完整产物/,
  );
  assert.equal(events.filter((event) => event.type === "artifact").length, 0);
  assert.equal(events.filter((event) => event.type === "speech").length, 0);
  assert.equal(events.at(-1).type, "run.error");
});

test("每个真实角色都读取目标验收和白板意见，播报指向下一位伙伴", async () => {
  const context = {
    criteria: ["对话可追踪"],
    notes: ["补充意见转任务单"],
    historicalArtifacts: [
      {
        runId: "previous-run",
        actor: "mori",
        mode: "live",
        title: "上一轮交付",
        summary: "先验收再归档",
        content: "上一轮方案摘要",
      },
    ],
  };
  const actors = [];
  const result = await runCollaboration({
    mode: "live",
    context,
    execute: async ({ role, context: received }) => {
      assert.deepEqual(received, context);
      actors.push(role.id);
      return {
        title: role.name + "提交",
        summary: "请下一位伙伴查看",
        content: "本角色读取验收要求并提出方案。",
        verdict: "approve",
      };
    },
  });
  assert.equal(actors.length, 6);
  const speech = result.events.find((event) => event.type === "speech");
  assert.equal(speech.actor, "mori");
  assert.equal(speech.to, "amber");
});

test("浏览器失败后先完成双人讨论，开发员收到讨论与同轮失败证据后才返工", async () => {
  const order = [];
  const result = await runCollaboration({ mode: "repository", maxRevisions: 1, context: { verifyCurrentFirst: true },
    discussRepair: async ({ test, onSpeech }) => {
      assert.equal(test.data.tests.browser.passed, false); order.push("discuss");
      const replies = [{ actor: "momo", to: "indigo", text: "实际仍启用，请修复" }, { actor: "indigo", to: "momo", text: "我会检查草稿状态" }];
      replies.forEach(onSpeech); return replies;
    }, execute: async ({ stage, revision, context, inputs }) => {
      if (stage === "develop" && revision) {
        assert.deepEqual(order, ["discuss"]); assert.equal(context.repairDiscussion[1].actor, "indigo");
        assert.equal(inputs.find((a) => a.stage === "test").data.tests.browser.passed, false); order.push("fix");
      }
      return { title: stage, summary: "该阶段的实际测试替身", content: "仅验证编排顺序，真实任务另行执行", verdict: stage === "test" && !revision ? "revise" : "approve",
        ...(stage === "test" ? { data: { tests: { browser: { passed: Boolean(revision) } } } } : {}) };
    } });
  assert.deepEqual(order, ["discuss", "fix"]);
  assert.equal(result.events.filter((e) => e.purpose === "repair").length, 2);
  assert.equal(result.events.at(-1).type, "run.complete");
});

test("同轮浏览器通过后把真实证据交回审阅员复核，不强行改写审阅结论", async () => {
  for (const stillReject of [false, true]) {
    let reviews = 0;
    const run = runCollaboration({ mode: "repository", maxRevisions: 0, execute: async ({ stage, inputs }) => {
      if (stage === "review") { reviews++; if (reviews === 2) assert.ok(inputs.some((item) => item.stage === "test" && item.data.tests.browser.passed)); }
      return { title: stage, summary: "真实证据复核的测试替身", content: "只检验编排，不代替真实任务。", verdict: stage === "review" && (reviews === 1 || stillReject) ? "revise" : "approve",
        ...(stage === "test" ? { data: { tests: { browser: { passed: true } } } } : {}) };
    } });
    if (stillReject) await assert.rejects(run, /仍需修改/); else await run;
    assert.equal(reviews, 2);
  }
});
