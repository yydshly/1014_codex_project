import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderGhostVoice, encodeWav } from '../src/ghost-voice.js';

const sampleRate = 48_000;
const destination = new URL('../../assets/sound/soft/', import.meta.url);
await mkdir(destination, { recursive: true });
const kinds = ['happy', 'shy', 'settled'];
const gap = Math.floor(sampleRate * 0.8);
const clips = kinds.map((kind, i) => renderGhostVoice(kind, sampleRate, i));
const combined = new Float32Array(clips.reduce((length, clip) => length + clip.length + gap, 0));
let offset = Math.floor(sampleRate * 0.25);
const checks = [];
const exportKinds = [...kinds, 'pet'];
for (let i = 0; i < exportKinds.length; i++) {
  const clip = clips[i] || renderGhostVoice(exportKinds[i], sampleRate, 1);
  // Same nominal gain as the app's 45% default; these auditions contain no rain.
  const output = Float32Array.from(clip, sample => sample * 0.45 * 0.55);
  if (i < clips.length) { combined.set(output, offset); offset += clip.length + gap; }
  await writeFile(new URL(`${exportKinds[i]}.wav`, destination), encodeWav(output, sampleRate));
  let peak = 0, squared = 0, mean = 0, step = 0;
  for (let j = 0; j < clip.length; j++) {
    peak = Math.max(peak, Math.abs(clip[j])); squared += clip[j] ** 2; mean += clip[j];
    if (j) step = Math.max(step, Math.abs(clip[j] - clip[j - 1]));
  }
  checks.push({ kind: exportKinds[i], seconds: clip.length / sampleRate, peak, rms: Math.sqrt(squared / clip.length), mean: mean / clip.length, maxStep: step });
}
await writeFile(new URL('voice-preview.wav', destination), encodeWav(combined, sampleRate));
await writeFile(new URL('signal-checks.json', destination), JSON.stringify({ sampleRate, gain: 0.45 * 0.55, checks }, null, 2));
console.log(`已生成开心、害羞、安心组合试听及摸头小叫声：${fileURLToPath(destination)}`);
