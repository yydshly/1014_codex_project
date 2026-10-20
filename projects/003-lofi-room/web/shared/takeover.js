import { TEAM_BY_ID } from "./team.js";

export const DISCUSSION_STATUS = { planning: "角色正在回应修改意见", discussing: "伙伴正在白板前讨论调整", ready: "调整方案已准备好 · 等你点击继续", error: "讨论遇到问题 · 执行仍暂停" };
export function takeoverBoard(snapshot) {
  const control = snapshot?.backendTask?.control || snapshot?.events?.findLast((event) => event.type === "execution.control")?.control;
  const discussion = control?.discussion;
  if (!discussion || discussion.version !== control.version) return null;
  const ending = snapshot?.events?.findLast((event) => ["run.complete", "run.error", "run.cancelled"].includes(event.type));
  const terminal = Boolean(ending || ["completed", "error", "interrupted", "cancelled"].includes(snapshot?.backendTask?.status));
  const completed = snapshot?.backendTask?.status === "completed" || ending?.type === "run.complete";
  const paused = !terminal && control.state === "paused";
  const label = terminal ? `本轮已${completed ? "交付" : "结束"} · 保留接管调整方案` : !paused && discussion.status === "ready" ? "已按此方案继续执行" : DISCUSSION_STATUS[discussion.status];
  return { ...discussion, paused, terminal, completed, label,
    feedback: control.notes.find((note) => note.version === discussion.version)?.text || "",
    names: discussion.participants.map((actor) => TEAM_BY_ID[actor]?.name).filter(Boolean).join("、") };
}
