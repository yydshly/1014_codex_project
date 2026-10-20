import { TEAM } from "./team.js";

// Select actual recorded events, never generate an artificial failure or fix.
export function repairMoments(events) {
  const failure = events.findIndex((e) => e.type === "work.activity" && e.activity?.kind === "browser" && e.activity.criterion > 0 && e.activity.status === "failed");
  const revision = events.findIndex((e, i) => i > failure && e.type === "revision");
  const replies = events.flatMap((e, i) => e.purpose === "repair" && i > revision ? [i] : []);
  if (failure < 0 || revision < 0 || replies.length < 2) return [];
  const write = events.findIndex((e, i) => i > replies[1] && e.type === "work.activity" && e.activity?.kind === "write" && e.activity.status === "completed");
  const retest = events.findIndex((e, i) => i > write && e.type === "agent.state" && e.actor === "momo" && e.status === "testing");
  const passed = events.findIndex((e, i) => i > retest && e.type === "work.activity" && e.activity?.kind === "browser" && e.activity.criterion === events[failure].activity.criterion && e.activity.action === events[failure].activity.action && e.activity.passed === true && JSON.stringify(e.activity.target) === JSON.stringify(events[failure].activity.target));
  const testStart = events.findLastIndex((e, i) => i < failure && e.type === "agent.state" && e.actor === "momo" && e.status === "testing");
  const develop = events.findIndex((e, i) => i > replies[1] && e.type === "agent.state" && e.actor === "indigo" && e.status === "working");
  const record = events.findIndex((e, i) => i > passed && e.type === "agent.state" && e.actor === "sleepy" && e.status === "working");
  const complete = events.findIndex((e) => e.type === "run.complete");
  if ([write, retest, passed, complete].some((i) => i < 0)) return [];
  const extra = [], rounds = new Set();
  for (const [index, event] of events.entries()) {
    if (event.type === "work.activity" && event.activity?.kind === "browser" && event.activity.criterion > 0 && event.activity.status === "failed" && !rounds.has(event.activity.round)) {
      rounds.add(event.activity.round); extra.push(index);
    }
    if (event.type !== "revision" || index <= revision) continue;
    extra.push(index);
    const next = events.findIndex((e, i) => i > index && e.type === "revision");
    const end = next < 0 ? events.length : next;
    const lastReply = events.findLastIndex((e, i) => i > index && i < end && e.purpose === "repair");
    const reply = lastReply < 0 ? index : lastReply;
    extra.push(events.findIndex((e, i) => i > reply && i < end && e.type === "agent.state" && e.actor === "indigo" && e.status === "working"));
    extra.push(events.findIndex((e, i) => i > reply && i < end && e.type === "work.activity" && e.activity?.kind === "write" && e.activity.status === "completed"));
    extra.push(events.findIndex((e, i) => i > reply && i < end && e.type === "agent.state" && e.actor === "momo" && e.status === "testing"));
  }
  return [...new Set([testStart, failure, revision, ...replies, develop, write, retest, passed, record, complete, ...extra].filter((i) => i >= 0))].sort((a, b) => a - b);
}

export function repairSnapshot(original, events, index) {
  const prefix = events.slice(0, index + 1), states = new Map();
  for (const e of prefix) if (e.type === "agent.state") states.set(e.actor, { status: e.status, task: e.task });
  return { ...original, live: false, replaying: true, events: prefix,
    artifacts: prefix.filter((e) => e.type === "artifact").map((e) => e.artifact),
    tasks: TEAM.map((member) => ({ ...member, ...(states.get(member.id) || { status: "idle", task: "待命" }) })), states };
}
