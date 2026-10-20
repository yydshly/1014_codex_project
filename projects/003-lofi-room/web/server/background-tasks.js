import { mkdir, readdir, readFile, writeFile, appendFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ExecutionControl } from "./execution-control.js";

const ACTIVE = new Set(["running", "pausing", "paused", "cancelling"]);
const TERMINAL = new Set(["run.complete", "run.error", "run.cancelled"]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const failure = (message, status = 409) => Object.assign(new Error(message), { status });

// The HTTP connection is an observer. Only an explicit cancel owns execution.
// Persist input metadata and ordered evidence, never provider credentials.
export class BackgroundTasks {
  constructor(directory) {
    this.root = join(directory, ".cache", "background-tasks");
    this.records = new Map();
    this.ready = this.load();
    this.creating = Promise.resolve();
  }
  async load() {
    await mkdir(this.root, { recursive: true });
    for (const name of await readdir(this.root)) {
      if (!uuid.test(name)) continue;
      try {
        const meta = JSON.parse(await readFile(join(this.root, name, "task.json"), "utf8"));
        if (meta.id !== name) continue;
        const text = await readFile(join(this.root, name, "events.ndjson"), "utf8").catch(() => "");
        const events = [];
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          try { const event = JSON.parse(line); if (event.seq === events.length + 1) events.push(event); else break; }
          catch { break; } // A process may have stopped during the final append.
        }
        if (text !== events.map((event) => JSON.stringify(event) + "\n").join(""))
          await writeFile(join(this.root, name, "events.ndjson"), events.map((event) => JSON.stringify(event) + "\n").join(""));
        const record = { meta, events, queue: Promise.resolve() };
        this.records.set(name, record);
        meta.lastSeq = events.length;
        if (ACTIVE.has(meta.status)) {
          const last = events.at(-1);
          meta.status = last?.type === "run.complete" ? "completed" : last?.type === "run.cancelled" ? "cancelled" : "interrupted";
          meta.finishedAt = new Date().toISOString();
          if (!TERMINAL.has(last?.type)) this.emit(record, { type: "run.error", message: "本地执行服务已重启，本轮已中断；源码和执行记录保留，可查看后重新下发。", time: Date.now() });
          await this.persist(record);
        }
      } catch { /* An incomplete creation is not an executable task. */ }
    }
  }
  get active() { return [...this.records.values()].find((r) => ACTIVE.has(r.meta.status)); }
  summary(record) {
    const { input, ...meta } = record.meta;
    return { ...meta, ...(record.control ? { control: record.control.snapshot() } : {}), mode: input.mode, execution: input.execution, goal: input.goal, repository: input.url,
      context: input.context, client: input.client, requestId: input.requestId };
  }
  execution() { return this.active ? this.summary(this.active) : null; }
  async persist(record) {
    const payload = JSON.stringify(record.meta, null, 2);
    record.queue = record.queue.then(async () => {
      const path = join(this.root, record.meta.id, "task.json");
      await writeFile(path + ".tmp", payload); await rename(path + ".tmp", path);
    });
    return record.queue;
  }
  emit(record, event) {
    if (record.controller?.signal.aborted && event.type !== "run.cancelled") return;
    if (TERMINAL.has(record.events.at(-1)?.type)) return;
    const safe = record.redact ? JSON.parse(record.redact(JSON.stringify(event))) : event;
    const copy = { ...safe, taskId: record.meta.id, seq: record.events.length + 1 };
    record.events.push(copy); record.meta.lastSeq = copy.seq;
    if (copy.runId) record.meta.sourceRunId = copy.runId;
    record.queue = record.queue.then(() => appendFile(join(this.root, record.meta.id, "events.ndjson"), JSON.stringify(copy) + "\n"));
    // Surface write failures through completion and reads, without an unhandled rejection.
    record.queue.catch(() => record.controller?.abort(new Error("任务证据写入失败，执行已停止。")));
  }
  async create(input, execute, secrets = [], { respondToFeedback } = {}) {
    await this.ready;
    const pending = this.creating.then(async () => {
      const existing = [...this.records.values()].find((r) => r.meta.input.requestId === input.requestId);
      if (existing) {
        if (JSON.stringify(existing.meta.input) !== JSON.stringify(input)) throw failure("该提交编号已用于另一项任务。");
        return this.summary(existing);
      }
      if (this.active) throw failure("已有后台任务运行中，请接回或停止当前任务。", 429);
      const id = randomUUID();
      const record = { meta: { id, status: "running", startedAt: new Date().toISOString(), lastSeq: 0, input },
        events: [], controller: new AbortController(), queue: Promise.resolve(),
        redact: (text) => secrets.filter(Boolean).reduce((value, secret) => value.split(secret).join("[redacted]"), text) };
      if (input.mode === "repository" && input.execution === "upstream") record.control = new ExecutionControl({
        signal: record.controller.signal, redact: record.redact,
        respond: respondToFeedback && ((args) => respondToFeedback({ ...args, input, events: record.events })),
        changed: async (event) => {
          if (record.controller.signal.aborted || TERMINAL.has(record.events.at(-1)?.type)) return;
          record.meta.status = event.control.state; record.meta.control = event.control;
          this.emit(record, event); await this.persist(record);
        },
      });
      await mkdir(join(this.root, id), { recursive: true });
      await writeFile(join(this.root, id, "events.ndjson"), "");
      await this.persist(record);
      this.records.set(id, record);
      // Start after creation is durable; the response need not remain connected.
      record.done = this.run(record, execute);
      record.done.catch(() => {});
      return this.summary(record);
    });
    this.creating = pending.catch(() => {});
    return pending;
  }
  async run(record, execute) {
    let error;
    try { await execute({ signal: record.controller.signal, emit: (event) => this.emit(record, event), control: record.control }); }
    catch (caught) { error = caught; }
    const cancelled = record.controller.signal.aborted;
    if (!TERMINAL.has(record.events.at(-1)?.type)) this.emit(record, { type: cancelled ? "run.cancelled" : "run.error",
      message: cancelled ? "任务已由使用者停止，源码与记录保留。" : error?.message || "执行结束但没有有效交付记录。", time: Date.now() });
    record.meta.status = cancelled ? "cancelled" : record.events.at(-1)?.type === "run.complete" && !error ? "completed" : "error";
    record.meta.finishedAt = new Date().toISOString();
    await this.persist(record);
  }
  async get(id, after = 0, limit = 100) {
    await this.ready;
    const record = this.records.get(id);
    if (!record) throw failure("后台任务不存在。", 404);
    await record.queue;
    if (after > record.events.length) throw failure("事件游标超出已保存的执行记录。", 400);
    const events = record.events.slice(after, after + limit);
    const cursor = events.at(-1)?.seq ?? after;
    return { task: this.summary(record), events, cursor, hasMore: cursor < record.events.length };
  }
  async list() {
    await this.ready;
    return { active: this.active ? this.summary(this.active) : null,
      recent: [...this.records.values()].sort((a, b) => b.meta.startedAt.localeCompare(a.meta.startedAt)).slice(0, 20).map((r) => this.summary(r)) };
  }
  async cancel(id) {
    await this.ready;
    const record = this.records.get(id);
    if (!record) throw failure("后台任务不存在。", 404);
    if (ACTIVE.has(record.meta.status)) {
      record.meta.status = "cancelling";
      record.controller?.abort(new DOMException("使用者停止了任务。", "AbortError"));
      await this.persist(record);
    }
    return this.summary(record);
  }
  async control(id, action, input) {
    await this.ready;
    const record = this.records.get(id);
    if (!record) throw failure("后台任务不存在。", 404);
    if (!record.control || !ACTIVE.has(record.meta.status) || record.meta.status === "cancelling" || TERMINAL.has(record.events.at(-1)?.type))
      throw failure("仅正在执行的原仓库任务可以接管。");
    record.actions = (record.actions || Promise.resolve()).catch(() => {}).then(() => {
      if (!ACTIVE.has(record.meta.status) || record.meta.status === "cancelling" || TERMINAL.has(record.events.at(-1)?.type)) throw failure("本轮已结束或正在停止，不能再接管。");
      return record.control[action](input);
    });
    await record.actions; return this.summary(record);
  }
}
