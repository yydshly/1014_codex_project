import { FocusSession, FOCUS_STORAGE_KEY, countdown, duration } from './focus-session.js';

export class FocusUI {
  constructor({ onLights, announce, onOpen, restoreFocus }) {
    this.onLights = onLights;
    this.announce = announce;
    this.onOpen = onOpen;
    this.restoreFocus = restoreFocus;
    this.panel = document.querySelector('#focus-panel');
    this.entry = document.querySelector('#focus-toggle');
    this.form = document.querySelector('#focus-form');
    this.task = document.querySelector('#focus-task');
    this.minutes = document.querySelector('#focus-minutes');
    this.history = document.querySelector('#focus-history');
    this.historyLimit = 20;
    this.listeners = [];
    let storage;
    try { storage = window.localStorage; } catch { /* Memory-only mode is disclosed in the panel. */ }
    this.model = new FocusSession({ storage });
    this.bind(this.entry, 'click', () => this.setOpen(this.panel.hidden));
    this.bind(document.querySelector('#focus-close'), 'click', () => this.setOpen(false, true));
    this.bind(document.querySelector('#focus-toast'), 'click', () => {
      document.querySelector('#focus-toast').hidden = true;
      document.querySelector('#focus-records').open = true;
      this.setOpen(true);
    });
    this.bind(this.form, 'submit', event => {
      event.preventDefault();
      if (!this.form.reportValidity()) return;
      if (this.model.start(this.task.value, Number(this.minutes.value))) {
        this.message('就从这一小会儿开始。小幽灵陪着你。');
        this.render();
        document.querySelector('#focus-pause').focus();
        this.schedule();
      } else { this.render(); this.announce('已有一段专注正在进行，请先继续或结束它。'); }
    });
    document.querySelectorAll('[data-focus-minutes]').forEach(button => this.bind(button, 'click', () => {
      this.minutes.value = button.dataset.focusMinutes;
      this.syncPresets();
    }));
    this.bind(this.minutes, 'input', () => this.syncPresets());
    this.bind(document.querySelector('#focus-pause'), 'click', () => {
      const paused = this.model.state.active?.runningSince === null;
      this.accept(paused ? this.model.resume() : this.model.pause());
      this.render();
      this.schedule();
      if (this.model.state.active) this.message(paused ? '继续吧，我们慢慢来。' : '歇一会儿。已经陪伴的时间都在。');
    });
    this.bind(document.querySelector('#focus-stop'), 'click', () => {
      this.accept(this.model.stop());
      this.render();
      this.schedule();
      this.task.focus();
    });
    this.bind(document.querySelector('#focus-more'), 'click', () => { this.historyLimit += 20; this.renderHistory(); });
    this.bind(document, 'keydown', event => {
      if (event.key === 'Escape' && !this.panel.hidden) this.setOpen(false, true);
    });
    this.bind(document, 'visibilitychange', () => {
      this.accept(document.hidden ? this.model.checkpoint() : this.model.tick());
      this.render();
      this.schedule();
    });
    this.bind(window, 'pagehide', () => { this.accept(this.model.checkpoint()); clearTimeout(this.timer); });
    this.bind(window, 'pageshow', () => this.update());
    this.bind(window, 'storage', event => { if (event.key === FOCUS_STORAGE_KEY || event.key === null) this.update(); });
    this.accept(this.model.tick());
    this.render();
    this.schedule();
  }

  bind(target, type, handler) {
    target.addEventListener(type, handler);
    this.listeners.push(() => target.removeEventListener(type, handler));
  }

  setOpen(open, restoreFocus = false) {
    this.panel.hidden = !open;
    document.querySelector('#experience').classList.toggle('focus-open', open);
    this.entry.setAttribute('aria-expanded', String(open));
    if (open) {
      this.onOpen();
      this.update();
      document.querySelector('#focus-close').focus();
    } else if (restoreFocus) this.restoreFocus ? this.restoreFocus() : this.entry.focus();
  }

  message(text) {
    document.querySelector('#focus-message').textContent = text;
    this.announce(text);
  }

  accept(record) {
    if (!record) return;
    if (record.status === 'completed') {
      this.message(`这一程完成了。你点亮了远处第 ${this.model.summary.lights} 盏灯。`);
      const toast = document.querySelector('#focus-toast');
      toast.textContent = `这一程完成了 · 远处亮起第 ${this.model.summary.lights} 盏灯 ↗`;
      toast.hidden = false;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { toast.hidden = true; }, 12000);
    } else {
      this.message(`这次先到这里，${duration(record.elapsedMs)}的陪伴已经留下。`);
    }
  }

  syncPresets() {
    document.querySelectorAll('[data-focus-minutes]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.focusMinutes) === Number(this.minutes.value)));
    });
  }

  renderClock() {
    const active = this.model.state.active;
    const elapsed = this.model.elapsed();
    const paused = active?.runningSince === null;
    const left = active ? active.targetMs - elapsed : 0;
    const time = countdown(left);
    document.querySelector('#focus-entry-label').textContent = active ? `${time} · ${paused ? '已暂停' : '专注中'} ↗` : '开一小会儿专注 ↗';
    this.entry.classList.toggle('is-running', Boolean(active && !paused));
    this.entry.setAttribute('aria-label', active ? `打开专注面板，${paused ? '已暂停' : '剩余'} ${time}` : '打开可选专注计时');
    document.querySelector('#focus-clock').textContent = time;
    document.querySelector('#focus-elapsed').textContent = `已陪伴 ${duration(elapsed)}`;
    document.querySelector('#focus-progress').value = active ? elapsed / active.targetMs : 0;
    this.panel.dataset.state = active ? paused ? 'paused' : 'running' : 'idle';
    this.panel.dataset.elapsedMs = String(Math.floor(elapsed));
    this.panel.dataset.remainingMs = String(Math.ceil(left));
  }

  render() {
    const activeHadFocus = document.querySelector('#focus-active').contains(document.activeElement);
    const active = this.model.state.active;
    const paused = active?.runningSince === null;
    this.form.hidden = Boolean(active);
    document.querySelector('#focus-active').hidden = !active;
    document.querySelector('#focus-active-task').textContent = active?.title || '';
    document.querySelector('#focus-phase').textContent = paused ? '暂歇片刻，随时继续' : '这一程，慢慢完成';
    const pause = document.querySelector('#focus-pause');
    pause.textContent = paused ? '继续专注' : '暂停计时';
    pause.setAttribute('aria-pressed', String(Boolean(paused)));
    const summary = this.model.summary;
    document.querySelector('#focus-lights').textContent = String(summary.lights);
    document.querySelector('#focus-total').textContent = duration(summary.elapsedMs);
    document.querySelector('#focus-storage').textContent = this.model.saved
      ? '记录只保存在此浏览器。刷新后可继续；清除网站数据会丢失记录。'
      : '本地保存暂时不可用，当前记录仅保留在页面中。请勿关闭或刷新。';
    document.querySelector('#focus-storage').classList.toggle('storage-warning', !this.model.saved);
    this.panel.dataset.saved = String(this.model.saved);
    this.panel.dataset.records = String(this.model.state.records.length);
    this.panel.dataset.lights = String(summary.lights);
    this.onLights(summary.lights);
    this.renderClock();
    this.renderHistory();
    this.syncPresets();
    if (!active && activeHadFocus) this.task.focus();
  }

  renderHistory() {
    const records = this.model.state.records;
    document.querySelector('#focus-history-count').textContent = `陪伴记录 · ${records.length}`;
    document.querySelector('#focus-empty').hidden = records.length > 0;
    document.querySelector('#focus-more').hidden = records.length <= this.historyLimit;
    const fragment = document.createDocumentFragment();
    records.slice(0, this.historyLimit).forEach(record => {
      const item = document.createElement('li');
      const heading = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = record.title;
      const badge = document.createElement('span');
      badge.textContent = record.status === 'completed' ? '点亮一盏灯' : '中途停下';
      badge.className = record.status === 'completed' ? 'record-completed' : '';
      heading.append(title, badge);
      const detail = document.createElement('p');
      const date = new Date(record.endedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      detail.textContent = `${date} · 陪伴 ${duration(record.elapsedMs)}`;
      item.append(heading, detail);
      fragment.append(item);
    });
    this.history.replaceChildren(fragment);
  }

  update() {
    const before = this.model.state.active?.id;
    const records = this.model.state.records;
    this.accept(this.model.tick());
    if (before !== this.model.state.active?.id || records !== this.model.state.records) this.render();
    else this.renderClock();
    this.schedule();
  }

  schedule() {
    clearTimeout(this.timer);
    if (!document.hidden && this.model.state.active?.runningSince !== null && this.model.state.active) {
      this.timer = setTimeout(() => this.update(), 1000);
    }
  }

  dispose() {
    this.model.checkpoint();
    clearTimeout(this.timer);
    clearTimeout(this.toastTimer);
    this.listeners.forEach(remove => remove());
  }
}
