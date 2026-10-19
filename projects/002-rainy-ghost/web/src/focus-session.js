export const FOCUS_STORAGE_KEY = 'night-voyage.focus.v1';
const MINUTE = 60_000;
const finite = value => Number.isFinite(value) && value >= 0;
const empty = () => ({ version: 1, active: null, records: [] });

function cleanSession(value) {
  if (!value || typeof value.id !== 'string' || typeof value.title !== 'string'
    || !finite(value.createdAt) || !finite(value.targetMs) || value.targetMs < MINUTE
    || value.targetMs > 180 * MINUTE || !finite(value.elapsedMs)
    || !(value.runningSince === null || finite(value.runningSince))) return null;
  return { id: value.id, title: value.title.slice(0, 80), createdAt: value.createdAt,
    targetMs: value.targetMs, elapsedMs: Math.min(value.elapsedMs, value.targetMs), runningSince: value.runningSince };
}

function decode(raw) {
  if (!raw) return empty();
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.records)) throw new Error('记录格式无法读取');
  const ids = new Set();
  const records = value.records.filter(record => {
    if (!record || typeof record.id !== 'string' || typeof record.title !== 'string'
      || !finite(record.startedAt) || !finite(record.endedAt) || !finite(record.elapsedMs)
      || !finite(record.targetMs) || !['completed', 'stopped'].includes(record.status) || ids.has(record.id)) return false;
    ids.add(record.id);
    return true;
  }).map(record => ({ ...record, title: record.title.slice(0, 80) }));
  const active = cleanSession(value.active);
  return { version: 1, active: active && !ids.has(active.id) ? active : null, records };
}

// Calendar timestamps survive throttled background tabs, refreshes and browser restarts.
// Animation time belongs to the rain scene and never enters this model.
export class FocusSession {
  constructor({ storage, now = Date.now, id = () => crypto.randomUUID() } = {}) {
    this.storage = storage;
    this.now = now;
    this.id = id;
    this.state = empty();
    this.lastRaw = undefined;
    this.saved = Boolean(storage);
    this.readable = true;
    this.refresh();
  }

  refresh() {
    if (!this.storage || !this.readable) return;
    try {
      const raw = this.storage.getItem(FOCUS_STORAGE_KEY);
      if (raw !== this.lastRaw) { this.state = decode(raw); this.lastRaw = raw; }
    } catch {
      // Preserve unreadable data instead of replacing it with an empty history.
      this.saved = false;
      this.readable = false;
    }
  }

  save() {
    if (!this.storage || !this.readable) { this.saved = false; return; }
    try {
      const raw = JSON.stringify(this.state);
      this.storage.setItem(FOCUS_STORAGE_KEY, raw);
      this.lastRaw = raw;
      this.saved = true;
    } catch { this.saved = false; }
  }

  elapsed(at = this.now()) {
    const active = this.state.active;
    if (!active) return 0;
    return Math.min(active.targetMs, active.elapsedMs
      + (active.runningSince === null ? 0 : Math.max(0, at - active.runningSince)));
  }

  finish(status, at) {
    const active = this.state.active;
    if (!active) return null;
    const record = { id: active.id, title: active.title, startedAt: active.createdAt,
      endedAt: Math.max(active.createdAt, at), elapsedMs: status === 'completed' ? active.targetMs : this.elapsed(at),
      targetMs: active.targetMs, status };
    this.state.records.unshift(record);
    this.state.active = null;
    this.save();
    return record;
  }

  tick() {
    this.refresh();
    const active = this.state.active;
    if (active && this.elapsed() >= active.targetMs) {
      const end = active.runningSince === null ? this.now()
        : active.runningSince + active.targetMs - active.elapsedMs;
      return this.finish('completed', end);
    }
    return null;
  }

  start(title, minutes) {
    this.refresh();
    if (this.state.active) return false;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return false;
    const at = this.now();
    this.state.active = { id: this.id(), title: String(title).trim().slice(0, 80) || '陪自己专注一会儿',
      createdAt: at, targetMs: minutes * MINUTE, elapsedMs: 0, runningSince: at };
    this.save();
    return true;
  }

  pause() {
    const completed = this.tick();
    const active = this.state.active;
    if (active && active.runningSince !== null) {
      active.elapsedMs = this.elapsed();
      active.runningSince = null;
      this.save();
    }
    return completed;
  }

  resume() {
    const completed = this.tick();
    const active = this.state.active;
    if (active && active.runningSince === null) { active.runningSince = this.now(); this.save(); }
    return completed;
  }

  stop() {
    return this.tick() || this.finish('stopped', this.now());
  }

  checkpoint() {
    const completed = this.tick();
    const active = this.state.active;
    if (active && active.runningSince !== null) {
      active.elapsedMs = this.elapsed();
      active.runningSince = this.now();
      this.save();
    }
    return completed;
  }

  get summary() {
    return this.state.records.reduce((summary, record) => {
      summary.elapsedMs += record.elapsedMs;
      if (record.status === 'completed') summary.lights++;
      return summary;
    }, { elapsedMs: 0, lights: 0 });
  }
}

export function countdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function duration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分${seconds % 60 ? ` ${seconds % 60} 秒` : '钟'}`;
}
