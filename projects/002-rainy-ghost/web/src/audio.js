import { renderGhostVoice, voiceKind } from './ghost-voice.js';

export const SOUND_SETTINGS_KEY = 'night-voyage.sound.v1';
const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.45;

export class NightAudio {
  constructor({ contextFactory, now = () => performance.now(), onChange = () => {} } = {}) {
    this.contextFactory = contextFactory || (() => {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('这个浏览器暂不支持声音，请换用较新的浏览器。');
      return new Context();
    });
    this.now = now; this.onChange = onChange;
    this.context = null; this.rainEnabled = this.voiceEnabled = false;
    this.rainVolume = 0.5; this.voiceVolume = 0.45; this.rain = 0.72;
    this.paused = this.hidden = this.quiet = false;
    this.buffers = new Map(); this.voices = new Set();
    this.lastVoice = -Infinity; this.playCount = 0; this.variation = 0; this.epoch = 0; this.pan = 0;
  }

  async unlock() {
    if (this.disposed) return false;
    if (!this.context) {
      const context = this.context = this.contextFactory();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -12; compressor.knee.value = 18; compressor.ratio.value = 4;
      compressor.attack.value = 0.008; compressor.release.value = 0.18;
      this.output = context.createGain(); this.output.connect(compressor).connect(context.destination);
      this.voiceGain = context.createGain(); this.voiceGain.gain.value = 0;
      this.panner = context.createStereoPanner(); this.panner.pan.value = this.pan;
      this.voiceGain.connect(this.panner).connect(this.output);
      context.onstatechange = () => this.publish();
    }
    if (this.context.state !== 'running') await this.context.resume();
    return !this.disposed;
  }

  createRain() {
    if (this.rainSource) return;
    const context = this.context, length = context.sampleRate * 4;
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let previous = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        previous = (previous + white * 0.025) / 1.025;
        data[i] = previous * 3.2 + white * 0.12;
      }
      const seam = Math.floor(context.sampleRate * 0.08);
      for (let i = 0; i < seam; i++) {
        const blend = i / seam;
        data[length - seam + i] = data[length - seam + i] * (1 - blend) + data[i] * blend;
      }
    }
    this.rainSource = context.createBufferSource(); this.rainSource.buffer = buffer; this.rainSource.loop = true;
    const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 3300;
    this.rainGain = context.createGain(); this.rainGain.gain.value = 0;
    this.rainSource.connect(lowpass).connect(this.rainGain).connect(this.output); this.rainSource.start();
  }

  async toggleRain() {
    if (this.rainEnabled) this.rainEnabled = false;
    else {
      const epoch = this.epoch;
      if (!await this.unlock() || epoch !== this.epoch) return false;
      this.createRain(); this.rainEnabled = true;
    }
    this.setEnvironment(); return this.rainEnabled;
  }

  async toggleVoice() {
    if (this.voiceEnabled) { this.voiceEnabled = false; this.epoch++; this.stopVoices(); }
    else {
      const epoch = this.epoch;
      if (!await this.unlock() || epoch !== this.epoch) return false;
      this.voiceEnabled = true;
    }
    this.setEnvironment(); return this.voiceEnabled;
  }

  setVolume(channel, value) {
    if (channel === 'voice') {
      this.voiceVolume = clamp(value);
      if (!this.voiceVolume) { this.epoch++; this.stopVoices(); }
    } else if (channel === 'rain') this.rainVolume = clamp(value);
    this.update();
  }

  setEnvironment({ paused = this.paused, hidden = this.hidden, quiet = this.quiet } = {}) {
    clearTimeout(this.sleepTimer);
    const silence = paused || hidden, becameQuiet = quiet && !this.quiet;
    if (silence || becameQuiet) { this.epoch++; this.stopVoices(); }
    this.paused = paused; this.hidden = hidden; this.quiet = quiet;
    this.update();
    if (this.context && (silence || !this.voiceEnabled && !this.rainEnabled)) {
      this.sleepTimer = setTimeout(() => {
        if (!this.disposed && (this.paused || this.hidden || !this.voiceEnabled && !this.rainEnabled)) this.context.suspend().catch(() => {});
      }, 70);
    } else if (this.context && this.context.state !== 'running') {
      this.context.resume().then(() => this.update()).catch(() => this.publish());
    }
  }

  setPan(value) {
    this.pan = Math.max(-0.22, Math.min(0.22, value));
    if (this.context && this.panner) this.panner.pan.setTargetAtTime(this.pan, this.context.currentTime, 0.08);
  }

  update() {
    if (this.context) {
      const time = this.context.currentTime;
      const rain = this.rainEnabled && !this.paused && !this.hidden ? Math.min(0.7, (0.18 + this.rain * 0.25) * this.rainVolume * 2) : 0;
      const voice = this.voiceEnabled && !this.paused && !this.hidden ? this.voiceVolume * 0.55 : 0;
      for (const [node, value] of [[this.rainGain, rain], [this.voiceGain, voice]]) {
        if (node) { node.gain.cancelScheduledValues(time); node.gain.setTargetAtTime(value, time, value ? 0.045 : 0.012); }
      }
    }
    this.publish();
  }

  async playVoice(kind, { manual = false, preview = false } = {}) {
    if (!this.voiceEnabled || this.paused || this.hidden || this.disposed || this.voiceVolume === 0 || this.quiet && !manual) return false;
    const gap = preview ? 650 : manual ? 3000 : 8000;
    if (this.now() - this.lastVoice < gap) return false;
    const epoch = this.epoch;
    if (!await this.unlock() || epoch !== this.epoch || !this.voiceEnabled || this.paused || this.hidden || this.quiet && !manual) return false;
    if (this.now() - this.lastVoice < gap) return false;
    this.lastVoice = this.now();
    const key = voiceKind(kind);
    const variation = this.variation++ % 3, cacheKey = `${key}:${variation}`;
    if (!this.buffers.has(cacheKey)) {
      // At most nine mono PCM buffers; voices never loop.
      if (this.buffers.size >= 9) this.buffers.delete(this.buffers.keys().next().value);
      const samples = renderGhostVoice(key, this.context.sampleRate, variation);
      const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
      buffer.copyToChannel(samples, 0); this.buffers.set(cacheKey, buffer);
    }
    this.stopVoices();
    const source = this.context.createBufferSource(); source.buffer = this.buffers.get(cacheKey);
    const gain = this.context.createGain(); gain.gain.value = 1;
    source.connect(gain).connect(this.voiceGain);
    const voice = { source, gain, stopped: false };
    this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); this.publish(); };
    source.start(this.context.currentTime + (preview ? 0.015 : 0.09));
    this.playCount++; this.lastKind = key; this.publish();
    return true;
  }

  stopVoices() {
    if (!this.context) return;
    for (const voice of this.voices) {
      if (voice.stopped) { voice.source.stop(); this.voices.delete(voice); continue; }
      voice.stopped = true;
      voice.gain.gain.cancelScheduledValues(this.context.currentTime);
      voice.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
      voice.source.stop(this.context.currentTime + 0.035);
    }
  }

  publish() {
    this.onChange({ rain: this.rainEnabled, voice: this.voiceEnabled, rainVolume: this.rainVolume, voiceVolume: this.voiceVolume,
      paused: this.paused, hidden: this.hidden, quiet: this.quiet, context: this.context?.state || 'locked',
      voices: this.voices.size, plays: this.playCount, kind: this.lastKind || '', buffers: this.buffers.size });
  }

  dispose() {
    clearTimeout(this.sleepTimer);
    this.disposed = true; this.epoch++; this.stopVoices(); this.rainSource?.stop(); this.buffers.clear();
    if (this.context) { this.context.onstatechange = null; this.context.close().catch(() => {}); }
  }
}
