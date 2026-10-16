export class SeasideAudio {
  constructor() { this.context = null; this.enabled = false; this.volume = 0.45; this.lastDrop = 0; }
  async enable() {
    try {
      if (!this.context) this.build();
      await this.context.resume();
      this.enabled = true;
      return true;
    } catch { this.enabled = false; return false; }
  }
  build() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('当前浏览器未提供声音播放。');
    const context = this.context = new Audio();
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < channel.length; i++) { const white = Math.random() * 2 - 1; last = (last + 0.025 * white) / 1.025; channel[i] = last * 5; }
    const noise = context.createBufferSource();
    noise.buffer = buffer; noise.loop = true;
    const seaFilter = context.createBiquadFilter(); seaFilter.type = 'lowpass'; seaFilter.frequency.value = 480;
    this.seaGain = context.createGain(); this.seaGain.gain.value = 0.25;
    noise.connect(seaFilter).connect(this.seaGain).connect(this.master);
    const rainFilter = context.createBiquadFilter(); rainFilter.type = 'highpass'; rainFilter.frequency.value = 1400;
    this.rainGain = context.createGain(); this.rainGain.gain.value = 0.08;
    noise.connect(rainFilter).connect(this.rainGain).connect(this.master);
    noise.start();
  }
  setEnabled(enabled) { this.enabled = enabled; }
  update(time, weather, inside, seated, visible) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const target = this.enabled && visible ? this.volume * (inside ? 0.72 : 0.16) : 0;
    this.master.gain.setTargetAtTime(target, now, 0.28);
    this.rainGain.gain.setTargetAtTime(0.015 + weather.rain * (seated ? 0.14 : 0.1), now, 0.3);
    this.seaGain.gain.setTargetAtTime(0.2 + Math.sin(time * 0.34) * 0.07 + Math.sin(time * 0.17) * 0.035, now, 0.3);
  }
  drop(onHand) {
    if (!this.context || !this.enabled) return;
    const context = this.context;
    if (context.currentTime - this.lastDrop < 0.09) return;
    this.lastDrop = context.currentTime;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(onHand ? 780 : 1020, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(onHand ? 320 : 430, context.currentTime + 0.08);
    gain.gain.setValueAtTime(onHand ? 0.055 : 0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(this.master); oscillator.start(); oscillator.stop(context.currentTime + 0.13);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
