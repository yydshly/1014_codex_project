import { TEAM, TEAM_BY_ID, DEFAULT_GOAL } from "./team.js";

export const DEMO_LINES = {
  plan: {
    actor: "mori",
    text: "目标已收到。阿橘先整理证据，小蓝据此出方案，月白和桃桃并行检查，最后交给栗子归档。",
  },
  research: {
    actor: "amber",
    text: "证据整理好了。每个人物要绑定身份、任务和产物，语音需要通过服务端调用。我把研究结果交给小蓝。",
  },
  draft: {
    actor: "indigo",
    text: "第一版方案已提交。角色状态和交接事件都接好了，请月白和桃桃一起检查。",
  },
  review_issue: {
    actor: "luna",
    text: "我发现一个问题：两个人同时播报会互相覆盖。请增加发言队列，并让字幕跟随当前说话的人。",
  },
  test_issue: {
    actor: "momo",
    text: "验证发现停止演示后仍可能继续发声。我建议同时取消任务和语音队列，把这个问题一起退回小蓝。",
  },
  revised: {
    actor: "indigo",
    text: "我已补充串行播报、字幕同步和停止清理。第二版方案已提交，请重新检查。",
  },
  review_pass: {
    actor: "luna",
    text: "第二版审阅通过。角色职责明确，交接可追踪，发言和字幕的规则也完整了。",
  },
  test_pass: {
    actor: "momo",
    text: "方案检查通过。发言队列、停止清理和六位角色映射都已满足约定，可以交给栗子。",
  },
  record: {
    actor: "sleepy",
    text: "最终方案、审阅意见和验证记录已经归档。点击产物可以查看内容，也可以导出这次协作记录。",
  },
  finish: {
    actor: "mori",
    text: "这轮协作完成。六个身份共同交付了一份方案，任务经过研究、开发、并行检查、返工和归档。",
  },
};

export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("已停止", "AbortError"));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("已停止", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
export function checkPlan(plan) {
  return [
    {
      name: "六位角色均有身份与职责",
      passed:
        Array.isArray(plan.roles) &&
        TEAM.every((member) => plan.roles.includes(member.id)),
    },
    { name: "语音按队列串行播放", passed: plan.voiceQueue === true },
    { name: "停止时清理任务与声音", passed: plan.stopCancelsAudio === true },
    { name: "每次交接携带产物引用", passed: plan.artifactHandoff === true },
  ];
}

export function createDemoExecutor() {
  return async ({
    role,
    stage,
    goal,
    inputs,
    revision,
    signal,
    pace = 900,
  }) => {
    await delay(pace, signal);
    const base = {
      title: "",
      summary: "",
      content: "",
      verdict: "approve",
      data: {},
    };
    if (stage === "plan")
      return {
        ...base,
        title: "任务分工",
        summary: "已拆分六位角色的任务与依赖。",
        content: `# 协作目标\n${goal}\n\n${TEAM.map((m) => `- ${m.name} / ${m.role}：${m.job}`).join("\n")}\n\n研究 → 开发 → 审阅与验证并行 → 必要时返工 → 记录。`,
      };
    if (stage === "research")
      return {
        ...base,
        title: "研究证据",
        summary: "整理场景能力、语音接口和展示约束。",
        content:
          "# 研究证据\n- 场景：Three.js，六位原创像素人物。\n- 角色：身份、任务、状态、产物之间建立关联。\n- MiniMax：服务端合成，六位人物使用不同系统音色。\n- 发言需要独立队列，避免并行任务造成语音重叠。\n\n这是预设演示内置的证据，不代表实时网络检索。",
      };
    if (stage === "develop") {
      const data = {
        roles: TEAM.map((m) => m.id),
        voiceQueue: revision > 0,
        stopCancelsAudio: revision > 0,
        artifactHandoff: true,
      };
      return {
        ...base,
        title: revision ? "展示方案 v2" : "展示方案 v1",
        summary: revision
          ? "已根据审阅和验证反馈补齐语音队列与停止清理。"
          : "产出角色状态与交接方案，等待并行检查。",
        data,
        content: `# 多 Agent 展示方案 v${revision + 1}\n\n目标：${goal}\n\n## 可执行配置\n\n${JSON.stringify(data, null, 2)}\n\n${revision ? "已处理反馈：串行播报、当前说话人字幕、取消任务和语音、保留产物引用。" : "预设演示在第一版故意保留语音队列与停止清理缺项，用于展示返工。"}\n\n输入产物：${inputs.map((item) => item.title).join("、")}`,
      };
    }
    const plan = inputs.find((item) => item.data?.roles)?.data || {};
    const checks = checkPlan(plan),
      passed = checks.every((item) => item.passed);
    if (stage === "review")
      return {
        ...base,
        title: revision ? "审阅通过" : "审阅反馈",
        summary: passed
          ? "角色分工与交接规则完整，审阅通过。"
          : "需要补充发言队列与字幕同步。",
        verdict: passed ? "approve" : "revise",
        content: `# 审阅意见\n${passed ? "通过。" : "退回修改：并行 Agent 发言不能互相覆盖，应建立串行播报和字幕归属。"}\n\n审阅的是演示方案，不是执行代码审计。`,
      };
    if (stage === "test")
      return {
        ...base,
        title: revision ? "方案检查通过" : "方案检查反馈",
        summary: passed
          ? "四项方案约束均通过。"
          : "检查发现语音队列与停止清理缺项。",
        verdict: passed ? "approve" : "revise",
        data: { checks },
        content: `# 方案约束检查\n${checks.map((c) => `- ${c.passed ? "通过" : "未通过"}：${c.name}`).join("\n")}\n\n此处执行配置约束检查，不声称运行了仓库构建或浏览器测试。`,
      };
    return {
      ...base,
      title: "协作交付记录",
      summary: "归档最终方案及并行检查结果。",
      content: `# 协作交付\n\n目标：${goal}\n\n运行方式：预设流程演示，无模型推理。\n\n## 产物\n${inputs.map((item) => `### ${item.title}\n${item.summary}`).join("\n\n")}\n\n这份记录由记录员根据本轮实际产物引用汇总。`,
    };
  };
}

export async function runCollaboration({
  goal = DEFAULT_GOAL,
  mode = "demo",
  execute = createDemoExecutor(),
  emit = () => {},
  narrate = async () => {},
  signal,
  pace = 900,
  context = {},
  maxRevisions = 1,
  discussRepair,
  control,
}) {
  if (typeof goal !== "string" || !goal.trim() || goal.length > 400)
    throw new Error("协作目标需为 1 至 400 字。");
  const parentSignal = signal,
    guard = new AbortController();
  signal = AbortSignal.any([
    parentSignal || new AbortController().signal,
    guard.signal,
  ]);
  const artifacts = [],
    events = [];
  let sequence = 0,
    closed = false;
  const send = (type, payload = {}) => {
    const event = { seq: ++sequence, type, time: Date.now(), ...payload };
    if (!closed) {
      events.push(event);
      emit(event);
    }
    return event;
  };
  const state = (actor, status, task) =>
    send("agent.state", { actor, status, task });
  const speech = async (key, artifact) => {
    const line =
      mode === "demo"
        ? DEMO_LINES[key]
        : { actor: artifact.actor, text: artifact.summary };
    const event = send("speech", {
      ...line,
      to:
        {
          plan: "amber",
          research: "indigo",
          draft: "luna",
          review_issue: "indigo",
          test_issue: "indigo",
          revised: "luna",
          review_pass: "sleepy",
          test_pass: "sleepy",
          record: "mori",
        }[key] || null,
      clip: mode === "demo" ? key : null,
    });
    await narrate(event);
    signal?.throwIfAborted();
  };
  const handoff = (from, to, artifact) =>
    send("handoff", {
      from,
      to,
      artifactId: artifact.id,
      title: artifact.title,
    });
  const job = async (actor, stage, inputs = [], revision = 0) => {
    signal?.throwIfAborted();
    await control?.checkpoint(signal);
    const controlVersion = control?.version || 0;
    const task = {
      plan: "拆分目标",
      research: "整理研究证据",
      develop: revision
        ? "处理返工反馈"
        : mode === "repository" && context.verifyCurrentFirst
          ? "准备原版复现，等待验证员"
        : mode === "repository"
          ? "编写可运行 Demo"
          : "产出展示方案",
      review: "审阅方案",
      test: mode === "repository" ? "执行真实功能测试" : "验证方案约束",
      record: "整理交付记录",
    }[stage];
    state(
      actor,
      stage === "review"
        ? "reviewing"
        : stage === "test"
          ? "testing"
          : "working",
      task,
    );
    send("tool", {
      actor,
      label:
        mode !== "demo"
          ? "读取交接产物，调用角色 Agent"
          : "读取交接产物，执行预设处理器",
      stage,
    });
    let output;
    try {
      output = await execute({
        role: TEAM_BY_ID[actor],
        stage,
        goal,
        inputs,
        revision,
        context: { ...context, ...(control ? { interventions: control.snapshot().notes } : {}) },
        signal,
        pace,
        onTool: (label) => send("tool", { actor, label, stage }),
      });
    } catch (error) {
      state(
        actor,
        signal.aborted ? "cancelled" : "error",
        signal.aborted ? "已停止" : "本角色执行失败",
      );
      throw error;
    }
    signal?.throwIfAborted();
    if (
      !output ||
      !["title", "summary", "content"].every(
        (key) => typeof output[key] === "string" && output[key].trim(),
      ) ||
      !["approve", "revise"].includes(output.verdict)
    ) {
      state(actor, "error", "产物格式不完整");
      throw new Error(`${TEAM_BY_ID[actor].name}未提交完整产物，本轮已停止。`);
    }
    const artifact = {
      ...output,
      ...(control ? { controlVersion: output.controlVersion ?? controlVersion } : {}),
      id: `artifact-${artifacts.length + 1}`,
      actor,
      stage,
      revision,
      inputIds: inputs.map((item) => item.id),
    };
    artifacts.push(artifact);
    send("artifact", { artifact });
    state(
      actor,
      output.verdict === "revise" ? "blocked" : "done",
      output.summary,
    );
    return artifact;
  };
  send("run.start", {
    goal,
    mode,
    team: TEAM.map(({ id, name, role }) => ({ id, name, role })),
  });
  TEAM.forEach((member) => state(member.id, "queued", "等待前序产物"));
  try {
    const plan = await job("mori", "plan");
    await speech("plan", plan);
    handoff("mori", "amber", plan);
    const research = await job("amber", "research", [plan]);
    await speech("research", research);
    handoff("amber", "indigo", research);
    let draft = await job("indigo", "develop", [plan, research]);
    await speech("draft", draft);
    let review, test, report;
    for (let revision = 0; revision <= maxRevisions; revision++) {
      handoff("indigo", "luna", draft);
      handoff("indigo", "momo", draft);
      [review, test] = await Promise.all([
        job("luna", "review", [draft, research], revision),
        job(
          "momo",
          "test",
          mode === "repository" ? [draft, research, plan] : [draft],
          revision,
        ),
      ]);
      // A parallel reviewer may see the old test suite just before the tester
      // corrects it. Reconcile that evidence with the reviewer, without sending
      // already-passing code back through another development iteration.
      if (
        mode === "repository" &&
        review.verdict === "revise" &&
        test.verdict === "approve" &&
        (review.data?.fixTarget === "tests" || test.data?.tests?.browser?.passed)
      ) {
        handoff("momo", "luna", test);
        review = await job(
          "luna",
          "review",
          [draft, research, review, test],
          revision,
        );
      }
      await control?.checkpoint(signal);
      let changed = Boolean(control && control.version > (draft.controlVersion || 0));
      let approved = !changed &&
        review.verdict === "approve" && test.verdict === "approve";
      await speech(
        review.verdict === "approve" ? "review_pass" : "review_issue",
        review,
      );
      await speech(
        test.verdict === "approve" ? "test_pass" : "test_issue",
        test,
      );
      if (approved) {
        if (mode === "repository" && draft.data?.fixTarget === "tests")
          state("indigo", "done", "源码保持上游契约，验证断言已复核通过");
        handoff("luna", "sleepy", review);
        handoff("momo", "sleepy", test);
        handoff("indigo", "sleepy", draft);
        report = await job("sleepy", "record", [plan, research, draft, review, test]);
        if (report.verdict === "approve") break;
        approved = false; changed = true;
      }
      if (revision === maxRevisions)
        throw new Error(
          `第 ${revision + 1} 轮检查仍需修改，本轮已停止并保留产物。`,
        );
      send("revision", {
        message: changed ? "使用者在执行中提出修改，保留同一任务和工作目录；开发员落实后重新审阅与验收。" : test.data?.tests?.browser?.passed === false ? "验证员在 Demo 中发现需求未满足，带操作证据到白板讨论后返工。" : "审阅与验证退回开发员，合并修改意见。",
        issues: [review, test]
          .filter((a) => a.verdict === "revise")
          .map((a) => a.summary),
        round: revision + 1,
      });
      if (discussRepair && test.data?.tests?.browser?.passed === false) {
        state("momo", "testing", "带着真实浏览器失败证据与小蓝讨论");
        state("indigo", "working", "听取验证员的问题，确认修复方案");
        const replies = await discussRepair({ goal, context, draft, review, test, revision: revision + 1, signal,
          onSpeech: (reply) => send("speech", { ...reply, kind: "discussion", purpose: "repair", revision: revision + 1 }) });
        context = { ...context, repairDiscussion: replies };
        state("momo", "blocked", "等待开发员修复，随后按原用例重测");
      }
      handoff("luna", "indigo", review);
      handoff("momo", "indigo", test);
      draft = await job(
        "indigo",
        "develop",
        [plan, research, draft, review, test],
        revision + 1,
      );
      await speech("revised", draft);
    }
    await speech("record", report);
    handoff("sleepy", "mori", report);
    state("mori", "done", "确认交付");
    await speech("finish", {
      actor: "mori",
      summary: `协作完成，最终交付：${report.title}。`,
    });
    send("run.complete", {
      reportId: report.id,
      artifactCount: artifacts.length,
      ...(report.data?.delivery ? { delivery: report.data.delivery } : {}),
    });
    return { goal, mode, artifacts, events, reportId: report.id };
  } catch (error) {
    const cancelled = parentSignal?.aborted || error.name === "AbortError";
    guard.abort();
    send(cancelled ? "run.cancelled" : "run.error", {
      message: cancelled ? "任务已停止。" : error.message,
    });
    closed = true;
    error.workflowReported = true;
    throw error;
  }
}
