import { DEFAULT_GOAL, TEAM } from "./team.js";

export const GOAL_STATUS = {
  ready: "待开始",
  running: "协作中",
  paused: "回放暂停",
  done: "已交付",
  stopped: "待继续",
  error: "需处理",
  archived: "已归档",
};
export const DEFAULT_CRITERIA = [
  "六位角色的分工清晰",
  "交接保留输入与产物",
  "声音与字幕一致，支持停止",
];
const clone = (value) => JSON.parse(JSON.stringify(value));
const id = () => globalThis.crypto.randomUUID();
export class GoalStore {
  constructor(storage, key = "lofi-room.goals.v2") {
    this.storage = storage;
    this.key = key;
    this.persistent = Boolean(storage);
    try {
      this.data = JSON.parse(storage?.getItem(key) || "null");
    } catch {
      this.data = null;
    }
    if (
      !this.data ||
      this.data.version !== 2 ||
      !Array.isArray(this.data.goals) ||
      !this.data.goals.length
    )
      this.data = {
        version: 2,
        selectedId: "room-goal",
        goals: [
          {
            id: "room-goal",
            title: "把小屋变成协作工作室",
            brief: DEFAULT_GOAL,
            criteria: DEFAULT_CRITERIA,
            status: "ready",
            notes: [],
            runs: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };
    this.data.goals = this.data.goals.filter(
      (g) =>
        typeof g.id === "string" &&
        typeof g.title === "string" &&
        typeof g.brief === "string" &&
        Array.isArray(g.runs) &&
        Array.isArray(g.criteria) &&
        Array.isArray(g.notes),
    );
    if (!this.data.goals.length) {
      this.data = null;
      throw new Error("目标记录格式异常，请导出备份后清理浏览器站点存储。");
    }
    for (const goal of this.data.goals) {
      if (["running", "paused"].includes(goal.status)) goal.status = "stopped";
      for (const run of goal.runs)
        if (["running", "paused"].includes(run.status)) run.status = "stopped";
    }
    if (!this.data.goals.some((g) => g.id === this.data.selectedId))
      this.data.selectedId = this.data.goals[0].id;
    this.save();
  }
  get selected() {
    return this.data.goals.find((g) => g.id === this.data.selectedId);
  }
  list() {
    return this.data.goals;
  }
  save() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.data));
    } catch {
      this.persistent = false;
    }
  }
  create({ title, brief, criteria }) {
    if (this.data.goals.length >= 30)
      throw new Error("最多保存 30 个目标，请先导出历史记录。");
    const goal = {
      id: id(),
      title,
      brief,
      criteria,
      status: "ready",
      notes: [],
      runs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.validate(goal);
    this.data.goals.unshift(goal);
    this.select(goal.id);
    return goal;
  }
  validate(goal) {
    if (
      !goal.title.trim() ||
      goal.title.length > 80 ||
      !goal.brief.trim() ||
      goal.brief.length > 400 ||
      !Array.isArray(goal.criteria) ||
      goal.criteria.length > 6 ||
      goal.criteria.some(
        (c) => typeof c !== "string" || !c.trim() || c.length > 120,
      )
    )
      throw new Error("请填写目标名称、具体内容和最多 6 条验收要求。");
  }
  select(goalId) {
    if (!this.data.goals.some((g) => g.id === goalId))
      throw new Error("目标不存在。");
    this.data.selectedId = goalId;
    this.save();
  }
  edit(changes) {
    const next = { ...this.selected, ...changes, updatedAt: Date.now() };
    this.validate(next);
    if (
      next.brief !== this.selected.brief ||
      JSON.stringify(next.criteria) !== JSON.stringify(this.selected.criteria)
    ) {
      next.accepted = false;
      next.acceptance = [];
      if (next.status !== "archived") next.status = "ready";
    }
    Object.assign(this.selected, next);
    this.save();
  }
  archive() {
    if (this.selected.status === "archived")
      this.selected.status = this.selected.previousStatus || "ready";
    else {
      this.selected.previousStatus = this.selected.status;
      this.selected.status = "archived";
    }
    this.save();
  }
  addNote(text, actor = "user") {
    if (!text.trim() || text.length > 500)
      throw new Error("白板意见需为 1 至 500 字。");
    this.selected.notes.push({
      id: id(),
      text: text.trim(),
      actor,
      time: Date.now(),
    });
    this.selected.notes = this.selected.notes.slice(-20);
    this.selected.updatedAt = Date.now();
    this.save();
  }
  begin(mode) {
    if (this.selected.status === "archived")
      throw new Error("请先恢复已归档的目标。");
    this.selected.accepted = false;
    this.selected.acceptance = [];
    const run = {
      id: id(),
      previousRunId: this.selected.runs[0]?.id || null,
      mode,
      execution: mode === "repository" ? this.selected.execution || "offline" : undefined,
      startedAt: Date.now(),
      status: "running",
      goal: this.selected.brief,
      title: this.selected.title,
      repositoryUrl: this.selected.repositoryUrl,
      source: this.selected.source || "github",
      criteria: clone(this.selected.criteria),
      notes: clone(this.selected.notes),
      artifacts: [],
      events: [],
      reportId: null,
    };
    this.selected.runs.unshift(run);
    this.selected.runs = this.selected.runs.slice(0, 8);
    this.selected.status = "running";
    this.save();
    return run;
  }
  updateRun(goalId, runId, { artifacts, events, status, reportId }) {
    const goal = this.data.goals.find((g) => g.id === goalId),
      run = goal?.runs.find((r) => r.id === runId);
    if (!run) return;
    if (artifacts) run.artifacts = clone(artifacts);
    if (events) {
      const latestStates = new Map(events.filter((event) => event.type === "agent.state").map((event) => [event.actor, event]));
      const retained = new Set([...events.slice(-150), ...latestStates.values(), ...events.filter((event) => event.type === "run.start")]);
      run.events = clone(events.filter((event) => retained.has(event))).map((event) => {
        if (event.type !== "work.activity") return event;
        const activity = event.activity;
        return { ...event, activity: { ...activity,
          output: activity.output?.slice(activity.kind === "read" ? 0 : -2500, activity.kind === "read" ? 2500 : undefined),
          before: activity.before?.slice(0, 2500), after: activity.after?.slice(0, 2500) } };
      });
    }
    if (status) goal.status = run.status = status;
    if (reportId) run.reportId = reportId;
    goal.updatedAt = Date.now();
    this.save();
  }
  attachTask(task) {
    const { goalId, runId, title } = task.client;
    let goal = this.data.goals.find((g) => g.id === goalId);
    if (!goal) {
      goal = { id: goalId, title, brief: task.goal, criteria: task.context.criteria || [], notes: [], runs: [],
        status: "running", repositoryUrl: task.repository || "", execution: task.execution,
        source: task.context.source || "github", createdAt: Date.parse(task.startedAt), updatedAt: Date.now() };
      this.data.goals.push(goal);
    }
    let run = goal.runs.find((r) => r.id === runId);
    if (!run) {
      run = { id: runId, mode: task.mode, execution: task.execution, startedAt: Date.parse(task.startedAt),
        status: "running", goal: task.goal, title, criteria: task.context.criteria || [], notes: [],
        source: task.context.source || "github", repositoryUrl: task.repository || "", artifacts: [], events: [] };
      goal.runs.unshift(run);
    }
    run.backendTaskId = task.id;
    this.data.selectedId = goal.id;
    this.save();
    return { goal, run };
  }
  tasks(goal = this.selected) {
    const run = goal.runs[0];
    const current =
      run?.goal === goal.brief &&
      JSON.stringify(run.criteria) === JSON.stringify(goal.criteria);
    return TEAM.map((member) => {
      const event = current
        ? run?.events.findLast(
            (e) => e.type === "agent.state" && e.actor === member.id,
          )
        : null;
      const status = ["running", "paused"].includes(goal.status)
        ? event?.status || "idle"
        : ["working", "reviewing", "testing", "queued"].includes(event?.status)
          ? "cancelled"
          : event?.status || "idle";
      return {
        ...member,
        status,
        task: event?.task || member.job,
        artifacts: current ? run?.artifacts.filter((a) => a.actor === member.id) || [] : [],
      };
    });
  }
}
