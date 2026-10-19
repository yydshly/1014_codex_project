export const COMPANION_KEY = 'night-voyage.companion.v1';
const blank = () => ({ version: 1, totalMs: 0, visits: 0, greetings: 0, lastSeen: null, quiet: false, days: [] });
const validTime = value => Number.isFinite(value) && value >= 0;
const dayKey = at => {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export class CompanionMemory {
  constructor({ storage, now = Date.now } = {}) {
    this.storage = storage;
    this.now = now;
    this.state = blank();
    this.saved = Boolean(storage);
    this.readable = true;
    this.active = false;
    this.sessionMs = 0;
    this.lastGreeting = -Infinity;
    try {
      const raw = storage?.getItem(COMPANION_KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value.version !== 1 || !validTime(value.totalMs) || !Number.isInteger(value.visits)
          || value.visits < 0 || !Number.isInteger(value.greetings) || value.greetings < 0
          || !(value.lastSeen === null || validTime(value.lastSeen)) || !Array.isArray(value.days)) throw new Error('invalid memory');
        this.state = { ...blank(), ...value, quiet: Boolean(value.quiet),
          days: value.days.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && validTime(day.ms)).slice(-30) };
      }
    } catch { this.saved = false; this.readable = false; }
    this.previousSeen = this.state.lastSeen;
  }

  save() {
    if (!this.storage || !this.readable) { this.saved = false; return; }
    try { this.storage.setItem(COMPANION_KEY, JSON.stringify(this.state)); this.saved = true; }
    catch { this.saved = false; }
  }

  enter() {
    if (this.active) return false;
    const at = this.now();
    const gap = this.state.lastSeen === null ? Infinity : Math.max(0, at - this.state.lastSeen);
    const returning = this.state.lastSeen !== null;
    if (!returning || gap >= 30 * 60_000) this.state.visits++;
    this.active = true;
    this.lastTick = at;
    this.state.lastSeen = at;
    this.save();
    return returning && gap >= 20_000;
  }

  checkpoint() {
    if (!this.active) return;
    const at = this.now();
    // A suspended foreground process must not count an entire sleeping night.
    const delta = Math.max(0, Math.min(at - this.lastTick, 15_000));
    const key = dayKey(at);
    let day = this.state.days.find(item => item.date === key);
    if (!day) { day = { date: key, ms: 0 }; this.state.days.push(day); this.state.days = this.state.days.slice(-30); }
    day.ms += delta;
    this.state.totalMs += delta;
    this.sessionMs += delta;
    this.lastTick = at;
    this.state.lastSeen = at;
    this.save();
  }

  leave() { this.checkpoint(); this.active = false; }

  greet() {
    if (this.now() - this.lastGreeting < 4000) return false;
    this.lastGreeting = this.now();
    this.state.greetings++;
    this.save();
    return true;
  }

  setQuiet(quiet) { this.state.quiet = quiet; this.save(); }
  get familiar() { return this.state.greetings >= 5 || this.state.visits >= 3 || this.state.totalMs >= 15 * 60_000; }
}

export function togetherTime(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (!minutes) return '不到 1 分钟';
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`;
}
