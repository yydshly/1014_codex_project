import { TEAM_BY_ID } from "./team.js";

export function workSteps(events = [], actor) {
  const steps = new Map();
  for (const event of events) {
    if (event.type !== "work.activity" || !TEAM_BY_ID[event.actor]) continue;
    const item = event.activity;
    if (!item?.id || (actor && actor !== event.actor)) continue;
    const key = `${event.actor}:${item.id}`;
    steps.set(key, { ...steps.get(key), ...item, actor: event.actor, stage: event.stage, time: event.time });
  }
  return [...steps.values()];
}

// Selection is independent of the narrator and never follows ambient small talk.
export function taskActor(events = [], fallback = "mori") {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type === "execution.control" && event.control?.state === "paused" && TEAM_BY_ID[event.control.actor]) return event.control.actor;
    if (event.type === "work.activity" && TEAM_BY_ID[event.actor]) return event.actor;
    if (event.type === "agent.state" && ["working", "reviewing", "testing"].includes(event.status)) return event.actor;
    if (event.type === "revision") return "indigo";
    if (event.type === "run.complete") return "sleepy";
  }
  return fallback;
}

export function workbenchView(snapshot, { actor = "mori", follow = false, stepId = null } = {}) {
  const events = snapshot?.events || [];
  const selected = follow ? taskActor(events, actor) : actor;
  const steps = workSteps(events, selected);
  const activity = (stepId && steps.find((step) => step.id === stepId)) || steps.findLast((step) => step.kind !== "inspect") || steps.at(-1) || null;
  const artifact = snapshot?.artifacts?.findLast((item) => item.actor === selected);
  const task = snapshot?.tasks?.find((item) => item.id === selected || item.actor === selected);
  const last = events.at(-1);
  const live = Boolean(snapshot?.live && !["run.complete", "run.error", "run.cancelled"].includes(last?.type));
  return { actor: selected, member: TEAM_BY_ID[selected], steps, activity, artifact, task,
    live, historical: Boolean(stepId), mode: snapshot?.goal?.mode === "demo" || snapshot?.mode === "demo" ? "demo" : "real",
    delivery: events.findLast((item) => item.type === "run.complete")?.delivery,
    exchanges: events.filter((item) => item.type === "handoff" && [item.from, item.to].includes(selected)).slice(-4) };
}

export function takeoverView(snapshot, historical = false) {
  const task = snapshot?.backendTask, control = task?.control;
  const available = Boolean(snapshot?.live && !snapshot?.replaying && !historical && task?.execution === "upstream" &&
    ["running", "pausing", "paused"].includes(task.status) && control && !control.sealed);
  return { available, task, control, paused: available && control.state === "paused",
    label: historical ? "步骤回看 · 回到最新步骤后可接管" : !snapshot?.live ? "当前没有正在执行的真实任务" : !available ? "当前任务不支持接管，或已进入最终交付" :
      control.state === "paused" ? "执行已暂停 · 后续工具不会启动" : control.state === "pausing" ? "正在收尾当前操作 · 后续步骤已拦住" : "真实执行中 · 可在工具步骤之间接管" };
}

// Keep the changed region visible instead of showing only the beginning of long files.
export function changedExcerpt(before = "", after = "") {
  const previous = before.split("\n"), next = after.split("\n");
  let start = 0;
  while (start < Math.min(previous.length, next.length) && previous[start] === next[start]) start++;
  const first = Math.max(0, start - 3);
  const excerpt = (lines) => lines.slice(first, first + 36).join("\n").slice(0, 4500);
  return { line: first + 1, before: excerpt(previous), after: excerpt(next) };
}
