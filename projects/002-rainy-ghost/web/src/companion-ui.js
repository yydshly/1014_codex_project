import { CompanionMemory, togetherTime } from './companion-memory.js';

export class CompanionUI {
  constructor({ announce, react, onOpen, onSound = () => {}, onQuiet = () => {} }) {
    this.announce = announce; this.react = react; this.onOpen = onOpen; this.onSound = onSound; this.onQuiet = onQuiet;
    this.panel = document.querySelector('#companion-panel');
    this.entry = document.querySelector('#companion-toggle');
    this.bubble = document.querySelector('#companion-bubble');
    this.listeners = [];
    this.lastResponse = -Infinity;
    this.lastInteraction = Date.now();
    let storage;
    try { storage = localStorage; } catch { /* The UI discloses memory-only mode. */ }
    this.memory = new CompanionMemory({ storage });
    this.returning = !document.hidden && this.memory.enter();
    this.bind(this.entry, 'click', () => this.setOpen(this.panel.hidden));
    this.bind(document.querySelector('#companion-close'), 'click', () => this.setOpen(false, true));
    this.bind(document.querySelector('#companion-stay'), 'click', () => { this.setOpen(false, true); this.respond('settled', '好，就这样待一会儿。', true); });
    this.bind(document.querySelector('#companion-quiet'), 'click', () => {
      this.memory.setQuiet(!this.memory.state.quiet);
      if (this.memory.state.quiet) this.hideBubble();
      this.render();
      this.announce(this.memory.state.quiet ? '已开启安静陪伴。靠近和回来时，小幽灵只用动作回应。' : '已恢复轻声回应。');
    });
    this.bind(document, 'keydown', event => { if (event.key === 'Escape' && !this.panel.hidden) this.setOpen(false, true); });
    this.bind(document, 'visibilitychange', () => {
      if (document.hidden) { this.memory.leave(); clearTimeout(this.timer); this.hideBubble(); }
      else { if (this.memory.enter()) this.respond('return', this.memory.familiar ? '回来啦，还是这里。' : '回来啦，灯还亮着。'); this.tick(); }
    });
    this.bind(window, 'pagehide', () => { this.memory.leave(); clearTimeout(this.timer); });
    this.bind(window, 'pageshow', () => { if (!document.hidden && !this.memory.active) { this.memory.enter(); this.tick(); } });
    this.bind(document.querySelector('#scene'), 'pointerdown', () => { this.lastInteraction = Date.now(); });
    this.render(); this.schedule();
  }
  bind(target, type, handler) { target.addEventListener(type, handler); this.listeners.push(() => target.removeEventListener(type, handler)); }
  ready() {
    const known = this.memory.previousSeen !== null;
    const text = !known ? '今晚，就一起听雨吧。' : !this.returning ? '还在呢，接着听雨吧。' : this.memory.familiar ? '认得你啦。来，靠近一点。' : '你又来啦，灯还亮着。';
    this.respond(known ? 'return' : 'welcome', text, false, true);
  }
  respond(kind, text, manual = false, initial = false) {
    if (!manual && !initial && Date.now() - this.lastResponse < 40_000) return;
    this.lastResponse = Date.now();
    this.react(kind, this.memory.familiar);
    this.panel.dataset.response = kind;
    if (this.memory.state.quiet && !manual) return;
    this.onSound(kind, { familiar: this.memory.familiar, manual });
    document.querySelector('#companion-whisper').textContent = text;
    this.bubble.textContent = text; this.bubble.hidden = false;
    this.announce(text);
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.hideBubble(), 5500);
  }
  approach() { this.respond('approach', this.memory.familiar ? '嗯，看见你啦。' : '这边有一点光。'); }
  greet() {
    this.lastInteraction = Date.now();
    const fresh = this.memory.greet();
    if (!fresh) return;
    const phrases = this.memory.familiar ? ['嗯，我在。', '认得你的招呼啦。', '不用说话也可以。'] : ['嗯，我在。', '灯借你一点。', '一起听会儿雨吧。'];
    this.respond('greet', phrases[(this.memory.state.greetings - 1) % phrases.length], true);
    this.render();
  }
  pet({ sound = true } = {}) {
    this.lastInteraction = this.lastResponse = Date.now();
    this.react('pet', this.memory.familiar);
    this.panel.dataset.response = 'pet';
    this.hideBubble();
    if (sound) this.onSound('pet', { manual: true });
    this.announce('小幽灵害羞地缩了缩，又慢慢放松下来。');
  }
  hideBubble() { clearTimeout(this.bubbleTimer); this.bubble.hidden = true; }
  anchor({ x, y }) {
    const width = document.querySelector('#experience').clientWidth;
    const intro = document.querySelector('.intro').getBoundingClientRect();
    const minY = width <= 650 ? intro.bottom + 40 : 100;
    this.bubble.style.left = `${Math.max(110, Math.min(width - 110, x))}px`;
    this.bubble.style.top = `${Math.max(minY, y)}px`;
    this.bubble.style.visibility = x < -80 || x > width + 80 ? 'hidden' : '';
  }
  setOpen(open, restoreFocus = false) {
    this.panel.hidden = !open;
    this.entry.setAttribute('aria-expanded', String(open));
    document.querySelector('#experience').classList.toggle('companion-open', open);
    if (open) { this.onOpen(); this.memory.checkpoint(); this.render(); document.querySelector('#companion-close').focus(); }
    else if (restoreFocus) this.entry.focus();
  }
  render() {
    const state = this.memory.state;
    this.onQuiet(state.quiet);
    document.querySelector('#companion-session').textContent = this.memory.sessionMs < 60_000 ? '刚刚坐下' : togetherTime(this.memory.sessionMs);
    document.querySelector('#companion-total').textContent = togetherTime(state.totalMs);
    document.querySelector('#companionship-label').textContent = this.memory.sessionMs < 60_000 ? '这一会儿，什么也不用完成。' : `这一会儿，已一起听雨 ${togetherTime(this.memory.sessionMs)}。`;
    document.querySelector('#companion-familiar').textContent = this.memory.familiar ? '它已经熟悉你的招呼了。' : state.greetings ? '一声招呼，也会慢慢熟悉。' : this.memory.previousSeen !== null ? '上次的雨声，也留在小记里。' : '初次见面，慢慢熟悉就好。';
    document.querySelector('#companion-quiet').setAttribute('aria-pressed', String(state.quiet));
    document.querySelector('#companion-quiet-state').textContent = state.quiet ? '开' : '关';
    document.querySelector('#companion-storage').textContent = this.memory.saved ? '只记页面可见时的相处。小记保存在此浏览器，清除网站数据会丢失。' : '本地保存暂时不可用，小记仅保留在当前页面。';
    const list = document.querySelector('#companion-days');
    const fragment = document.createDocumentFragment();
    [...state.days].reverse().slice(0, 7).forEach(day => {
      const item = document.createElement('li');
      const date = document.createElement('span'); date.textContent = `${Number(day.date.slice(5, 7))} 月 ${Number(day.date.slice(8))} 日`;
      const time = document.createElement('span'); time.textContent = `一起听雨 ${togetherTime(day.ms)}`;
      item.append(date, time); fragment.append(item);
    });
    list.replaceChildren(fragment);
    Object.assign(this.panel.dataset, { totalMs: String(Math.floor(state.totalMs)), sessionMs: String(Math.floor(this.memory.sessionMs)),
      familiar: String(this.memory.familiar), greetings: String(state.greetings), quiet: String(state.quiet), saved: String(this.memory.saved) });
  }
  tick() {
    this.memory.checkpoint(); this.render();
    if (Date.now() - this.lastInteraction > 45_000 && Date.now() - this.lastResponse > 90_000) {
      this.lastResponse = Date.now(); this.react('settled', this.memory.familiar);
    }
    this.schedule();
  }
  schedule() { clearTimeout(this.timer); if (!document.hidden) this.timer = setTimeout(() => this.tick(), 5000); }
  dispose() { this.memory.leave(); clearTimeout(this.timer); this.hideBubble(); this.listeners.forEach(remove => remove()); }
}
