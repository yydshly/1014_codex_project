import { TEAM_BY_ID } from "./team.js";

export const MISSION_STEPS = ["明确任务", "研究项目", "编写代码", "审阅与测试", "体验与验收"];
export function executionIndicator(runtime, client = {}, historical = false) {
  const demo = client.running && client.mode === "demo";
  if (runtime?.connected !== true) return {
    kind: demo ? "demo" : "unknown",
    label: demo ? "流程演示中 · 后台状态未连接" : runtime?.connected === false ? "真实任务状态无法确认" : "正在核对真实任务状态",
    detail: runtime?.connected === false ? "无法连接执行服务，当前是否有真实任务尚不确定。" : "正在读取后台执行状态…",
  };
  if (runtime.task) {
    const task = runtime.task;
    const type = task.mode === "live" ? "真实方案协作" : task.execution === "upstream" ? "原仓库任务" : "离线 Demo 任务";
    return { kind: "real", label: task.status === "paused" ? "真实任务已暂停 · 等待修改" : task.status === "pausing" ? "真实任务正在暂停 · 当前操作收尾" : "真实任务执行中", detail: `${type} · ${task.goal}${client.paused ? " · 场景回放已暂停" : ""}` };
  }
  if (demo) return { kind: "demo", label: "流程演示中 · 无真实任务", detail: "人物正在按预设流程演示分工、交接和返工。" };
  if (runtime.maintenance) return { kind: "idle", label: "成果服务启动中 · 无开发任务", detail: "正在启动已交付成果，没有运行新的 Agent 开发任务。" };
  if (client.running) return client.started
    ? { kind: "presentation", label: "后台无真实任务 · 人物展示中", detail: "后台执行已结束，房间仍在展示本轮人物交接与语音。" }
    : { kind: "pending", label: "正在提交真实任务", detail: "等待执行服务接收，接收后显示真实执行标识。" };
  return { kind: "idle", label: "当前无真实任务执行", detail: historical ? "当前展示已完成的任务；人物日常活动不代表任务执行。" : "房间处于待命状态，下发真实任务后会更新此标识。" };
}
// All views derive from the selected goal and its matching run, never from a
// globally cached delivery belonging to a different task or an earlier brief.
export function missionView(goal, now = Date.now()) {
  const latest = goal.runs[0];
  const run = latest?.goal === goal.brief && JSON.stringify(latest.criteria) === JSON.stringify(goal.criteria) ? latest : null;
  const events = run?.events || [];
  const delivery = events.findLast((e) => e.type === "run.complete")?.delivery || null;
  const active = ["running", "paused"].includes(goal.status);
  const control = active && events.findLast((event) => event.type === "execution.control")?.control;
  const actors = Object.keys(TEAM_BY_ID).map((actor) => events.findLast((e) => e.type === "agent.state" && e.actor === actor))
    .filter((e) => e && ["working", "reviewing", "testing"].includes(e.status));
  const actor = actors.at(-1)?.actor;
  const phases = { mori: 0, amber: 1, indigo: 2, luna: 3, momo: 3, sleepy: 4 };
  const revision = events.findLastIndex((e) => e.type === "revision");
  const lastWork = events.findLastIndex((e) => e.type === "agent.state" && ["working", "reviewing", "testing"].includes(e.status));
  const fixing = active && revision >= 0 && (lastWork < revision || actor === "indigo");
  const step = delivery || run?.status === "done" ? 4 : fixing ? 2 : phases[actor] ?? 0;
  const last = events.findLast((e) => ["tool", "handoff", "revision", "run.error", "run.cancelled"].includes(e.type));
  let activity = "填写仓库、具体需求和验收要求，再交给团队。";
  if (delivery) activity = goal.accepted ? "你已确认验收，这一轮成果与记录已保留。" : "团队已交付。打开成果，按原需求体验并确认验收，或提出修改。";
  else if (run?.status === "done") activity = "本轮方案已完成，可查看角色产物；这一轮没有可运行网页。";
  else if (last) activity = last.type === "handoff" ? `${TEAM_BY_ID[last.from]?.name} → ${TEAM_BY_ID[last.to]?.name}：${last.title}` : `${TEAM_BY_ID[last.actor]?.name ? TEAM_BY_ID[last.actor].name + " · " : ""}${last.label || last.message}`;
  if (goal.status === "ready" && latest && !run) activity = "需求已更新，旧成果保留在历史中；下发后开始新一轮。";
  if (goal.pendingFeedback && !active) activity = "修改意见已保存到本任务白板。下发后继承上一轮源码，开始新一轮修改。";
  if (control?.state === "paused") activity = `使用者接管${TEAM_BY_ID[control.actor]?.name || "角色"} · 后续工具步骤已暂停，修改版本 ${control.version}；继续后沿用同一任务。`;
  if (control?.state === "pausing") activity = "正在收尾已启动的操作，后续工具步骤已拦住。";
  const expired = Boolean(delivery?.expiresAt && Date.parse(delivery.expiresAt) <= now);
  return { run, delivery, active, step, actors: active ? actors : [], activity, fixing, expired,
    status: control?.state === "paused" ? "执行暂停 · 使用者接管" : control?.state === "pausing" ? "正在暂停执行" : goal.pendingFeedback && !active ? "修改待下发" : goal.accepted ? "已验收" : delivery ? "待你体验" : fixing ? "讨论返工" : goal.status === "error" ? "执行遇阻" : active ? "团队执行中" : run?.status === "done" ? "方案已交付" : "准备下发",
    round: goal.runs.length,
  };
}

export function previewURL(value, base) {
  try {
    const url = new URL(value, base);
    if (url.username || url.password) return null;
    if (url.origin === new URL(base).origin || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) || url.protocol === "https:") return url.href;
  } catch {}
  return null;
}
