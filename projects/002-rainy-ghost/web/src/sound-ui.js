import { SOUND_SETTINGS_KEY } from './audio.js';

export class SoundUI {
  constructor(audio, { announce, onOpen, previewGesture }) {
    this.audio = audio; this.announce = announce; this.onOpen = onOpen; this.previewGesture = previewGesture;
    this.panel = document.querySelector('#sound-panel'); this.entry = document.querySelector('#sound-toggle');
    this.listeners = []; this.saved = true;
    try {
      const value = JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) || 'null');
      if (value?.version === 1) {
        if (Number.isFinite(value.voiceVolume)) audio.voiceVolume = Math.max(0, Math.min(1, value.voiceVolume));
        if (Number.isFinite(value.rainVolume)) audio.rainVolume = Math.max(0, Math.min(1, value.rainVolume));
      }
    } catch { this.saved = false; }
    audio.onChange = state => this.render(state);
    this.bind(this.entry, 'click', () => this.setOpen(this.panel.hidden));
    this.bind(document.querySelector('#sound-close'), 'click', () => this.setOpen(false, true));
    this.bind(document, 'keydown', event => { if (event.key === 'Escape' && !this.panel.hidden) this.setOpen(false, true); });
    this.bind(document, 'visibilitychange', () => audio.setEnvironment({ hidden: document.hidden }));
    this.bind(document.querySelector('#audio-toggle'), 'click', event => this.action(event.currentTarget, async () => {
      const enabled = await audio.toggleRain();
      announce(enabled ? '雨声已打开。' : '雨声已关闭。');
    }));
    this.bind(document.querySelector('#ghost-audio-toggle'), 'click', event => this.action(event.currentTarget, async () => {
      const enabled = await audio.toggleVoice();
      if (enabled && await audio.playVoice('greet', { manual: true, preview: true })) this.previewGesture('greet');
      announce(enabled ? '小幽灵的声音已打开。轻轻叫它一声，听听它的回应。' : '小幽灵的声音已关闭。');
    }));
    for (const channel of ['voice', 'rain']) {
      const slider = document.querySelector(`#${channel}-volume`);
      this.bind(slider, 'input', () => audio.setVolume(channel, Number(slider.value) / 100));
      this.bind(slider, 'change', () => this.save());
    }
    document.querySelectorAll('[data-voice-preview]').forEach(button => this.bind(button, 'click', () => this.action(button, async () => {
      if (audio.paused) return;
      if (!audio.voiceEnabled) await audio.toggleVoice();
      const kind = button.dataset.voicePreview;
      if (await audio.playVoice(kind, { manual: true, preview: true })) {
        this.previewGesture(kind);
        document.querySelector('#sound-feedback').textContent = `试听：${button.textContent.trim()}。`;
      }
    })));
    audio.setEnvironment({ hidden: document.hidden });
  }

  bind(target, type, handler) { target.addEventListener(type, handler); this.listeners.push(() => target.removeEventListener(type, handler)); }
  async action(button, action) {
    button.dataset.pending = 'true';
    button.disabled = true;
    try { await action(); }
    catch (error) { document.querySelector('#sound-feedback').textContent = error.message || '声音暂时没能打开，请再试一次。'; this.announce(document.querySelector('#sound-feedback').textContent); }
    finally { delete button.dataset.pending; button.disabled = false; this.audio.publish(); }
  }
  save() {
    try {
      localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify({ version: 1, voiceVolume: this.audio.voiceVolume, rainVolume: this.audio.rainVolume }));
      this.saved = true;
    } catch { this.saved = false; }
    this.audio.publish();
  }
  respond(kind, detail) {
    this.audio.playVoice(kind, detail).catch(() => { document.querySelector('#sound-feedback').textContent = '点一次试听，可以重新唤醒声音。'; });
  }
  setQuiet(quiet) { if (quiet !== this.audio.quiet) this.audio.setEnvironment({ quiet }); }
  setOpen(open, restoreFocus = false) {
    this.panel.hidden = !open; this.entry.setAttribute('aria-expanded', String(open));
    document.querySelector('#experience').classList.toggle('sound-open', open);
    if (open) { this.onOpen(); document.querySelector('#sound-close').focus(); }
    else if (restoreFocus) this.entry.focus();
  }
  render(state) {
    const enabled = state.rain || state.voice;
    document.querySelector('#sound-state').textContent = enabled ? '开' : '关';
    this.entry.classList.toggle('sound-enabled', enabled);
    for (const [button, active, label, output] of [
      [document.querySelector('#audio-toggle'), state.rain, '雨声', '#audio-state'],
      [document.querySelector('#ghost-audio-toggle'), state.voice, '小幽灵的声音', '#ghost-audio-state'],
    ]) {
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? '关闭' : '打开'}${label}`);
      document.querySelector(output).textContent = active ? '开' : '关';
    }
    for (const channel of ['voice', 'rain']) {
      const percentage = Math.round(state[`${channel}Volume`] * 100);
      document.querySelector(`#${channel}-volume`).value = String(percentage);
      document.querySelector(`#${channel}-volume-value`).textContent = `${percentage}%`;
    }
    document.querySelectorAll('[data-voice-preview]').forEach(button => { button.disabled = state.paused || button.dataset.pending === 'true'; });
    document.querySelector('#sound-hint').textContent = state.paused ? '雨夜已暂停，继续后可以试听。'
      : enabled && !state.hidden && state.context !== 'running' ? '点一次试听，可以唤醒声音。'
      : state.quiet ? '安静陪伴中：只在你主动叫它或试听时回应。'
        : '招呼时开心回应，摸头时小小声；安静待着只用动作陪你。';
    document.querySelector('#sound-storage').textContent = this.saved ? '音量会记住。每次进入，声音都由你开启；切到后台会安静下来。' : '本次音量只保留在当前页面；切到后台会安静下来。';
    Object.assign(this.panel.dataset, { voice: String(state.voice), rain: String(state.rain),
      voiceVolume: String(state.voiceVolume), rainVolume: String(state.rainVolume), paused: String(state.paused),
      hidden: String(state.hidden), quiet: String(state.quiet), context: state.context,
      plays: String(state.plays), voices: String(state.voices), kind: state.kind, buffers: String(state.buffers) });
  }
  dispose() { this.listeners.forEach(remove => remove()); this.audio.onChange = () => {}; }
}
