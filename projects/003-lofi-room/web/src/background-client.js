export const activeTask = (task) => ["running", "pausing", "paused", "cancelling"].includes(task?.status);
export function linkedTaskId(url) {
  const id = new URL(url).searchParams.get("task");
  return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id || "") ? id : null;
}
export const taskToReconnect = (listing, runs) => listing.active || listing.recent.find((task) => runs.some((run) => {
  const status = task.status === "completed" ? "done" : task.status === "cancelled" ? "stopped" : "error";
  return run.id === task.client?.runId && (run.backendTaskId === task.id || ["stopped", "running", "paused"].includes(run.status)) &&
    ((run.backendCursor || 0) < task.lastSeq || run.status !== status);
}));
const pause = (ms, signal) => new Promise((resolve, reject) => {
  signal?.throwIfAborted();
  const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, ms);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  signal?.addEventListener("abort", abort, { once: true });
});

export class BackgroundClient {
  constructor({ base = document.baseURI, request = fetch, interval = 900, sleep = pause } = {}) {
    this.base = base; this.request = request.bind(globalThis); this.interval = interval; this.sleep = sleep;
  }
  async call(path, { signal, ...options } = {}) {
    const response = await this.request(new URL(`api/tasks${path}`, this.base), { ...options, cache: "no-store",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
    const body = await response.json().catch(() => ({ error: "后台任务接口没有返回有效记录。" }));
    if (!response.ok) throw Object.assign(new Error(body.error || "后台任务连接失败。"), { status: response.status });
    return body;
  }
  async create(input, signal) {
    // Reusing the same requestId makes an uncertain POST safe to retry.
    for (let attempt = 0; ; attempt++) {
      try { return (await this.call("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal })).task; }
      catch (error) {
        if (signal?.aborted || error.status || attempt >= 2) throw error;
        await this.sleep(400, signal);
      }
    }
  }
  list(signal) { return this.call("", { signal }); }
  cancel(id) { return this.call(`/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); }
  control(id, action, input) { return this.call(`/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  async snapshot(id, signal) {
    const events = []; let after = 0, result;
    do {
      result = await this.call(`/${id}?after=${after}&limit=200`, { signal });
      for (const event of result.events) {
        if (event.seq !== after + 1) throw new Error("后台任务事件顺序异常，不能恢复不完整记录。");
        events.push(event); after = event.seq;
      }
    } while (result.hasMore);
    return { task: result.task, events, cursor: after };
  }
  async follow(id, { cursor = 0, signal, onEvents, onTask = () => {}, onConnection = () => {} }) {
    let disconnected = false;
    for (;;) {
      signal.throwIfAborted();
      let result;
      try { result = await this.call(`/${id}?after=${cursor}&limit=200`, { signal }); }
      catch (error) {
        if (signal.aborted) throw signal.reason;
        if (error.status === 404 || error.status === 400) throw error;
        disconnected = true; onConnection("reconnecting"); await this.sleep(1500, signal); continue;
      }
      onConnection(disconnected ? "restored" : "connected");
      const batch = [];
      for (const event of result.events) {
        if (event.seq <= cursor) continue;
        if (event.seq !== cursor + 1) throw new Error("后台任务事件出现缺口，请重新打开房间接回任务。");
        batch.push(event); cursor = event.seq;
      }
      if (batch.length) await onEvents(batch, { catchup: disconnected, cursor });
      disconnected = false; onTask(result.task, cursor);
      if (!result.hasMore && !activeTask(result.task)) return result.task;
      if (!result.hasMore) await this.sleep(this.interval, signal);
    }
  }
}
