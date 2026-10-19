const TAU = Math.PI * 2;
const presets = {
  // [onset, duration, starting pitch, rounded crest, ending pitch, strength].
  // Two buoyant calls, two hesitant peeps, and one unhurried release.
  happy: { breath: 0.019, flutter: 0.0035, room: 0.065, cutoff: 1550, calls: [
    [0.02, 0.39, 340, 505, 405, 0.94], [0.48, 0.48, 390, 555, 430, 1],
  ] },
  shy: { breath: 0.026, flutter: 0.007, room: 0.045, cutoff: 1200, calls: [
    [0.04, 0.3, 360, 415, 320, 0.65], [0.5, 0.31, 325, 370, 295, 0.49],
  ] },
  pet: { breath: 0.025, flutter: 0.006, room: 0.04, cutoff: 1200, calls: [
    [0.035, 0.38, 330, 390, 290, 0.5],
  ] },
  settled: { breath: 0.023, flutter: 0.0025, room: 0.075, cutoff: 1250, calls: [
    [0.02, 1.15, 305, 330, 225, 0.86],
  ] },
  approach: { breath: 0.024, flutter: 0.006, room: 0.045, cutoff: 1200, calls: [
    [0.035, 0.48, 335, 410, 305, 0.6],
  ] },
  light: { breath: 0.012, flutter: 0.003, room: 0.08, cutoff: 1600, calls: [
    [0.02, 0.4, 410, 495, 355, 0.74],
  ] },
};

export function voiceKind(kind) {
  if (['welcome', 'return', 'greet'].includes(kind)) return 'happy';
  if (kind === 'nod') return 'shy';
  return Object.hasOwn(presets, kind) ? kind : 'approach';
}

const smooth = value => value * value * (3 - 2 * value);
const bend = (u, start, crest, end) => u < 0.43
  ? start + (crest - start) * smooth(u / 0.43)
  : crest + (end - crest) * smooth((u - 0.43) / 0.57);

// A small, rounded creature call. No speech, formants, phonemes or recordings.
// The same PCM renderer supplies both the browser and the downloadable audition.
export function renderGhostVoice(kind = 'greet', sampleRate = 48_000, variant = 0) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192_000) throw new RangeError('Invalid sample rate');
  const preset = presets[voiceKind(kind)];
  const duration = Math.max(...preset.calls.map(([onset, length]) => onset + length));
  const data = new Float32Array(Math.ceil((duration + 0.38) * sampleRate));
  const variation = ((Math.floor(variant) % 3) + 3) % 3;
  const tuning = 2 ** ((variation - 1) * 9 / 1200);
  let seed = 0x6d2b79f5 ^ (variation * 0x45d9f3b) ^ data.length;
  for (const [onset, seconds, start, crest, end, strength] of preset.calls) {
    let phase = 0, air = 0, slowAir = 0, rounded = 0;
    const offset = Math.round(onset * sampleRate), length = Math.round(seconds * sampleRate);
    const airFilter = 1 - Math.exp(-TAU * 1300 / sampleRate);
    const bodyFilter = 1 - Math.exp(-TAU * preset.cutoff / sampleRate);
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate, u = i / (length - 1);
      const flutter = Math.sin(time * TAU * 7.3 + variation * 0.4);
      const frequency = bend(u, start, crest, end) * tuning * (1 + flutter * preset.flutter * Math.sin(Math.PI * u));
      phase += TAU * frequency / sampleRate;
      const envelope = Math.sin(Math.PI * u) ** 1.65 * (1 - Math.exp(-time / 0.028));
      // Mostly a sine body, a little soft harmonic warmth and a faint octave below.
      // No ringing non-integer partials: pitch and breath carry the character.
      const body = Math.sin(phase) * 0.58 + Math.sin(2 * phase + 0.15) * 0.075
        + Math.sin(3 * phase) * 0.018 + Math.sin(phase * 0.5) * 0.045;
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const noise = (seed >>> 0) / 0xffffffff * 2 - 1;
      air += (noise - air) * airFilter;
      slowAir += (air - slowAir) * (1 - Math.exp(-TAU * 260 / sampleRate));
      rounded += (body + (air - slowAir) * preset.breath - rounded) * bodyFilter;
      data[offset + i] += rounded * envelope * strength * (0.98 + 0.02 * flutter);
    }
  }
  // A very small room keeps the call close; no metallic or long echoed tail.
  const dry = data.slice(0, Math.ceil(duration * sampleRate));
  for (const [delay, level] of [[0.047, 1], [0.083, 0.55], [0.137, 0.3], [0.211, 0.12]]) {
    const offset = Math.round(delay * sampleRate);
    for (let i = 0; i < dry.length && i + offset < data.length; i++) data[i + offset] += dry[i] * level * preset.room;
  }
  let previous = 0, dc = 0;
  const dcPole = Math.exp(-TAU * 12 / sampleRate);
  for (let i = 0; i < data.length; i++) {
    const input = data[i];
    const highPassed = input - previous + dcPole * dc;
    previous = input; dc = highPassed;
    const fade = Math.min(1, i / (sampleRate * 0.014), (data.length - 1 - i) / (sampleRate * 0.045));
    data[i] = Math.tanh(highPassed * 1.05) * 0.76 * Math.max(0, fade);
  }
  return data;
}

export function encodeWav(samples, sampleRate = 48_000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const tag = (at, value) => [...value].forEach((character, i) => view.setUint8(at + i, character.charCodeAt(0)));
  tag(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return new Uint8Array(buffer);
}
