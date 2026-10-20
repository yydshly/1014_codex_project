import { workbenchView } from "./workbench.js";

export const SCREEN_EXAMPLE = `// 屏幕动效示意 · 不执行真实任务
export function assignTask(task, team) {
  const developer = team.find(agent =>
    agent.role === "developer"
  );
  developer.accept(task);
  return { owner: developer.id,
    status: "ready for review" };
}`;

export function workstationState(snapshot, actor) {
  const view = workbenchView(snapshot, { actor });
  const codeSteps = view.steps.filter((step) => ["read", "write"].includes(step.kind) && (step.after || step.output));
  const source = codeSteps.findLast((step) => /\.(?:[cm]?[jt]sx?|css|html?)$/i.test(step.path || "")) || codeSteps.at(-1);
  const command = view.steps.findLast((step) => step.kind === "command");
  const browser = view.activity?.kind === "browser" ? view.activity : null;
  const paused = snapshot?.backendTask?.control?.state === "paused";
  const active = !paused && view.live && ["working", "reviewing", "testing"].includes(view.task?.status);
  return { actor, name: view.member.name, color: view.member.color, source, command,
    activity: view.activity, browser, active, paused, live: view.live,
    code: source?.after || source?.output || "",
    path: source?.path || "",
    line: source?.line || 1,
    output: browser?.output || command?.output || "",
    mode: view.mode === "demo" ? "demo" : view.live ? "live" : view.steps.length ? "record" : "idle" };
}

export function workstationFrame(state, { time = 0, replayStart = null, changeStart = null, reducedMotion = false } = {}) {
  const replay = replayStart !== null;
  const illustrative = replay && !state.code && !state.output;
  const code = state.code || (illustrative ? SCREEN_EXAMPLE : "");
  const elapsed = replay ? time - replayStart : changeStart === null ? 99 : time - changeStart;
  const reveal = !state.paused && !reducedMotion && (replay || (state.live && state.source?.kind === "write" && changeStart !== null));
  const phase = replay ? Math.max(0, elapsed) % 10 : Math.max(0, elapsed);
  const count = reveal ? Math.floor(Math.min(1, phase / 4.5) * code.length) : code.length;
  const visibleCode = code.slice(0, count);
  const outputRows = state.output.split("\n");
  const output = replay && !reducedMotion
    ? outputRows.slice(0, Math.max(1, Math.ceil(Math.min(1, phase / 4.5) * outputRows.length))).join("\n") : state.output;
  const lines = visibleCode.split("\n");
  const firstLine = Math.max(0, lines.length - 9);
  const lastLine = lines.at(-1) || "";
  const animating = !reducedMotion && (replay || state.active);
  return { ...state, code, output, visibleCode, lines: lines.slice(firstLine), firstLine: state.line + firstLine,
    cursorRow: Math.min(8, lines.length - 1), cursorColumn: lastLine.length,
    cursor: animating && Math.floor(time * 2) % 2 === 0,
    animating, replay, illustrative,
    label: replay ? illustrative ? "动效示意 / 无真实任务" : "记录回放 / 不执行任务" :
      state.mode === "live" ? state.paused ? "执行已暂停 / 等待修改指导" : state.active ? "真实任务 / 处理中" : "真实任务 / 等待交接" :
        state.mode === "record" ? "执行记录 / 已停止更新" : state.mode === "demo" ? "预设演示" : "待命 / 无真实任务" };
}
