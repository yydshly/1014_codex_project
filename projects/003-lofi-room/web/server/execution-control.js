import { randomUUID } from "node:crypto";
import { TEAM_BY_ID } from "../shared/team.js";

const failure = (message, status = 409) => Object.assign(new Error(message), { status });

// A cooperative barrier: running commands finish; no subsequent side effect
// starts while held. It never kills or repeats an in-flight command.
export class ExecutionControl {
  constructor({ signal, changed = async () => {}, redact = (value) => value, respond } = {}) {
    this.signal = signal; this.changed = changed; this.redact = redact;
    this.state = "running"; this.version = 0; this.notes = []; this.operations = new Map(); this.waiters = new Set();
    this.actor = null; this.sealed = false; this.observers = new Set();
    this.respond = respond; this.discussion = null;
  }
  snapshot() {
    return { state: this.state, version: this.version, actor: this.actor, sealed: this.sealed,
      notes: structuredClone(this.notes), operations: [...this.operations.values()], discussion: structuredClone(this.discussion) };
  }
  async publish(reason, note) {
    for (const observer of this.observers) observer();
    await this.changed({ type: "execution.control", reason, control: this.snapshot(), ...(note ? { note } : {}), time: Date.now() });
  }
  budget(milliseconds, signal = this.signal) {
    const timeout = new AbortController(); let remaining = milliseconds, since = null, timer;
    const update = () => {
      clearTimeout(timer);
      if (since !== null) remaining -= Date.now() - since;
      since = this.state === "running" ? Date.now() : null;
      if (since !== null) { timer = setTimeout(() => timeout.abort(new DOMException("角色调用超时。", "TimeoutError")), Math.max(0, remaining)); timer.unref?.(); }
    };
    this.observers.add(update); update();
    return { signal: AbortSignal.any([...(signal ? [signal] : []), timeout.signal]), dispose: () => { clearTimeout(timer); this.observers.delete(update); } };
  }
  async checkpoint(signal = this.signal) {
    signal = signal && this.signal && signal !== this.signal ? AbortSignal.any([signal, this.signal]) : signal;
    signal?.throwIfAborted();
    while (this.state !== "running") {
      await new Promise((resolve, reject) => {
        const finish = (error) => { this.waiters.delete(wake); signal?.removeEventListener("abort", abort); error ? reject(error) : resolve(); };
        const wake = () => finish();
        const abort = () => finish(signal.reason);
        this.waiters.add(wake); signal?.addEventListener("abort", abort, { once: true });
      });
      signal?.throwIfAborted();
    }
  }
  async enter(operation, signal) {
    // Recheck after the await: pause can arrive between checkpoint and entry.
    do { await this.checkpoint(signal); } while (this.state !== "running");
    const id = randomUUID(); this.operations.set(id, { ...operation, id });
    return async () => {
      this.operations.delete(id);
      if (this.state === "pausing" && !this.operations.size) { this.state = "paused"; await this.publish("paused"); }
    };
  }
  validate({ actor, version }) {
    this.signal?.throwIfAborted();
    if (this.sealed) throw failure("本轮已进入最终交付，不能再接管；请在成果页提出下一轮反馈。");
    if (!TEAM_BY_ID[actor]) throw failure("请选择有效角色。", 400);
    if (!Number.isSafeInteger(version) || version !== this.version) throw failure("修改版本已更新，请核对最新意见后重试。");
  }
  async pause(input) {
    this.validate(input);
    if (this.state !== "running") return this.snapshot();
    this.actor = input.actor; this.state = this.operations.size ? "pausing" : "paused";
    await this.publish(this.state); return this.snapshot();
  }
  async feedback(input) {
    this.validate(input);
    if (this.state !== "paused") throw failure("请等当前操作完成并进入执行暂停后，再提交修改意见。");
    if (typeof input.text !== "string" || !input.text.trim() || input.text.trim().length > 2000) throw failure("修改意见需为1至2000字。", 400);
    if (this.notes.length >= 20) throw failure("本轮修改意见已达20条，请整理后在下一轮继续。");
    this.actor = input.actor;
    const note = { id: randomUUID(), actor: input.actor, text: this.redact(input.text.trim()), version: ++this.version, time: Date.now() };
    this.notes.push(note);
    if (this.respond) this.prepareDiscussion(note);
    await this.publish("feedback", note);
    if (this.respond) this.runDiscussion(note);
    return this.snapshot();
  }
  prepareDiscussion(note) {
    this.discussionController?.abort(); this.discussionController = new AbortController();
    this.discussion = { id: randomUUID(), version: note.version, actor: note.actor, status: "planning", participants: [...new Set([note.actor, "mori"])], lines: [], plan: null };
  }
  runDiscussion(note) {
    const id = this.discussion.id;
    const signal = AbortSignal.any([this.discussionController.signal, ...(this.signal ? [this.signal] : [])]);
    const current = () => !signal.aborted && this.state === "paused" && this.version === note.version && this.discussion?.id === id;
    const update = async ({ status, participants, plan, line }) => {
      if (!current()) return;
      if (status) this.discussion.status = status;
      if (participants) this.discussion.participants = participants;
      if (plan) this.discussion.plan = JSON.parse(this.redact(JSON.stringify(plan)));
      if (line) this.discussion.lines.push({ ...JSON.parse(this.redact(JSON.stringify(line))), id: randomUUID() });
      if (status === "ready") { note.plan = this.discussion.plan; note.dialogue = structuredClone(this.discussion.lines); }
      await this.publish("discussion");
    };
    this.discussionDone = (async () => {
      try {
        await this.respond({ note: { ...note }, signal, update });
        if (current() && (this.discussion.status !== "ready" || !this.discussion.plan || !this.discussion.lines.length)) throw new Error("没有形成完整调整方案，请重试讨论。");
      } catch (error) {
        if (!current()) return;
        this.discussion.status = "error"; this.discussion.error = this.redact(error.message).slice(0, 500);
        await this.publish("discussion");
      }
    })();
    this.discussionDone.catch(() => {});
  }
  async discuss(input) {
    this.validate(input);
    if (!this.respond || this.state !== "paused" || this.discussion?.status !== "error") throw failure("只有暂停中失败的接管讨论可以重试。");
    const note = this.notes.at(-1); this.prepareDiscussion(note); await this.publish("discussion"); this.runDiscussion(note); return this.snapshot();
  }
  async resume(input) {
    this.validate(input);
    if (this.state !== "paused") throw failure("任务尚未进入执行暂停，不能继续。");
    if (this.discussion && this.discussion.status !== "ready") throw failure(this.discussion.status === "error" ? "调整讨论未完成，请重试讨论或提交新的修改意见。" : "角色正在回应并讨论调整方案，请等方案准备好后再继续。");
    this.state = "running"; await this.publish("resumed");
    for (const wake of [...this.waiters]) wake();
    return this.snapshot();
  }
  instructions() {
    return this.notes.length ? "\n使用者在同一任务执行中提交的修改意见（保留原目标、原验收及测试保护；新意见必须落到实际工作，不能只口头答应）：\n" + this.notes.map((note) => `[修改${note.version}，关注${TEAM_BY_ID[note.actor].name}] ${note.text}${note.plan ? "\n已讨论但尚待实际执行的调整方案：" + JSON.stringify(note.plan) : ""}`).join("\n") : "";
  }
  seal(version) {
    if (this.state !== "running" || version !== this.version) throw failure("用户修改尚未经过重新验证，禁止交付。");
    this.sealed = true;
  }
}
