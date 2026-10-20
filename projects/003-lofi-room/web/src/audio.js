// Original Web Audio lo-fi, synthesized locally. No samples or remote requests.
export const TRACKS = [
  {
    name: "窗边的晚安",
    bpm: 72,
    chords: [
      [48, 55, 59, 62],
      [45, 52, 55, 59],
      [41, 48, 52, 57],
      [43, 50, 53, 57],
    ],
    melody: [74, 71, 67, 62, 64, 67, 71, 69],
  },
  {
    name: "月亮不打烊",
    bpm: 66,
    chords: [
      [50, 57, 60, 65],
      [46, 53, 57, 60],
      [48, 55, 58, 62],
      [45, 52, 55, 60],
    ],
    melody: [77, 72, 69, 65, 67, 69, 72, 74],
  },
  {
    name: "给明天的便笺",
    bpm: 78,
    chords: [
      [51, 58, 62, 65],
      [48, 55, 58, 62],
      [44, 51, 55, 60],
      [46, 53, 56, 60],
    ],
    melody: [75, 74, 70, 67, 65, 67, 70, 74],
  },
];

export class LofiAudio {
  constructor() {
    this.ducking = false;
    this.context = null;
    this.playing = false;
    this.trackIndex = 0;
    this.volume = 0.4;
    this.weather = "rain";
    this.timer = null;
    this.step = 0;
    this.activeSources = new Set();
  }
  async init() {
    if (!this.context) {
      this.context = new AudioContext();
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume * 0.7 * (this.ducking ? 0.2 : 1);
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.ratio.value = 5;
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = 0.72;
      this.music.connect(this.master);
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.29;
      const echo = ctx.createGain();
      echo.gain.value = 0.2;
      this.delay.connect(echo);
      echo.connect(this.delay);
      echo.connect(this.music);
      const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const channel = noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < channel.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.035) / 1.02;
        channel[i] = previous;
      }
      this.rain = ctx.createBufferSource();
      this.rain.buffer = noise;
      this.rain.loop = true;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1600;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = this.weather === "rain" ? 0.22 : 0.025;
      this.rain.connect(lowpass);
      lowpass.connect(this.rainGain);
      this.rainGain.connect(this.master);
      this.rain.start();
      this.noiseBuffer = noise;
    }
    await this.context.resume();
  }
  voice(note, time, duration = 0.9, level = 0.045, type = "sine") {
    const ctx = this.context,
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = type === "triangle" ? 1100 : 2500;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.music);
    gain.connect(this.delay);
    osc.start(time);
    osc.stop(time + duration + 0.02);
    this.activeSources.add(osc);
    osc.onended = () => {
      this.activeSources.delete(osc);
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  drum(time, kick) {
    const ctx = this.context,
      gain = ctx.createGain();
    gain.gain.setValueAtTime(kick ? 0.16 : 0.07, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    gain.connect(this.music);
    const source = kick ? ctx.createOscillator() : ctx.createBufferSource();
    if (kick) {
      source.frequency.setValueAtTime(105, time);
      source.frequency.exponentialRampToValueAtTime(42, time + 0.15);
      source.connect(gain);
    } else {
      source.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 2200;
      source.connect(filter);
      filter.connect(gain);
    }
    source.start(time);
    source.stop(time + 0.2);
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
  }
  schedule() {
    if (!this.playing) return;
    const ctx = this.context,
      track = TRACKS[this.trackIndex],
      beat = 60 / track.bpm;
    while (this.nextTime < ctx.currentTime + 0.16) {
      const i = this.step,
        chord = track.chords[Math.floor(i / 8) % track.chords.length],
        time = this.nextTime;
      if (i % 8 === 0) {
        chord.forEach((note, n) =>
          this.voice(note, time + n * 0.016, beat * 3, 0.035, "triangle"),
        );
        this.voice(chord[0] - 12, time, beat * 1.5, 0.12);
      }
      if (i % 4 === 0) this.drum(time, true);
      if (i % 8 === 4) this.drum(time, false);
      if (i % 4 === 2)
        this.voice(
          track.melody[Math.floor(i / 4) % track.melody.length],
          time,
          beat * 1.2,
          0.032,
        );
      this.step++;
      this.nextTime += beat / 2 + (i % 2 === 0 ? 0.026 : -0.026);
    }
  }
  async play() {
    await this.init();
    this.playing = true;
    this.master.gain.setTargetAtTime(
      this.volume * 0.7 * (this.ducking ? 0.2 : 1),
      this.context.currentTime,
      0.12,
    );
    this.nextTime = this.context.currentTime + 0.04;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 65);
  }
  async pause() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    if (this.context) await this.context.suspend();
  }
  async next() {
    const wasPlaying = this.playing;
    clearInterval(this.timer);
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already ended */
      }
    });
    this.activeSources.clear();
    this.trackIndex = (this.trackIndex + 1) % TRACKS.length;
    this.step = 0;
    if (wasPlaying) {
      this.nextTime = this.context.currentTime + 0.05;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 65);
    }
    return TRACKS[this.trackIndex];
  }
  setVolume(value) {
    this.volume = value;
    if (this.context)
      this.master.gain.setTargetAtTime(
        value * 0.7 * (this.ducking ? 0.2 : 1),
        this.context.currentTime,
        0.1,
      );
  }
  setDucking(value) {
    this.ducking = value;
    if (this.context)
      this.master.gain.setTargetAtTime(
        this.volume * 0.7 * (value ? 0.2 : 1),
        this.context.currentTime,
        0.18,
      );
  }
  setWeather(value) {
    this.weather = value;
    if (this.context)
      this.rainGain.gain.setTargetAtTime(
        value === "rain" ? 0.22 : 0.025,
        this.context.currentTime,
        0.5,
      );
  }
  dispose() {
    clearInterval(this.timer);
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already ended */
      }
    });
    if (this.context) this.context.close();
  }
}
