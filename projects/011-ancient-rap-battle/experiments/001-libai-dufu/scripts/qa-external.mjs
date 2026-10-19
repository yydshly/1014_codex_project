import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ChatArt下载素材的本地音轨筛查。算法与video.mjs一致；不更改API任务状态。
// 使用：node scripts/qa-external.mjs clips/A01_t1.mp4 A01
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [videoArg, clipId, ...extra] = process.argv.slice(2);
if (!videoArg || !clipId || extra.length) throw new Error('用法：node scripts/qa-external.mjs <本地视频路径> <A01等镜头ID>');
const episode = JSON.parse(await readFile(resolve(root, 'episode.json'), 'utf8'));
const clip = episode.clips.find(item => item.id === clipId);
if (!clip || !/^[A-Za-z0-9_-]{1,40}$/.test(clipId)) throw new Error('episode.json中找不到指定镜头');
const video = resolve(process.cwd(), videoArg), audio = resolve(root, clip.audio);
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const reportPath = resolve(root, 'work/chatart-video-qa.json');
let taskLog;
try { taskLog = JSON.parse(await readFile(resolve(root, 'work/chatart-tasks.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; taskLog = { clips: {} }; }
const modelLabel = taskLog.clips?.[clipId]?.model_label?.trim() || '网页模型未登记';
const videoStat = await stat(video);
if (!videoStat.isFile() || !videoStat.size) throw new Error('视频文件不存在或为空');

function decodeAudio(path) {
  const result = spawnSync(ffmpeg, ['-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('FFmpeg 无法解码音轨；请确认 FFMPEG_PATH 或本地文件');
  const samples = [];
  for (let i = 0; i + 3 < result.stdout.length; i += 4) samples.push(result.stdout.readFloatLE(i));
  return samples;
}
function envelope(samples) {
  const result = [];
  for (let i = 0; i + 79 < samples.length; i += 80) {
    let sum = 0;
    for (let j = 0; j < 80; j++) sum += samples[i + j] ** 2;
    result.push(Math.log(Math.sqrt(sum / 80) + 1e-4));
  }
  return result;
}
function corr(a, b) {
  if (a.length < 20 || a.length !== b.length) return null;
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let aa = 0, bb = 0, ab = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; aa += x * x; bb += y * y; ab += x * y; }
  if (aa / a.length < 0.0025 || bb / b.length < 0.0025) return null;
  const value = ab / Math.sqrt(aa * bb);
  return Number.isFinite(value) ? value : null;
}
function analyze(videoSamples, audioSamples) {
  const a = envelope(videoSamples), b = envelope(audioSamples);
  let best = null;
  for (let lag = -40; lag <= 60; lag++) {
    const a0 = Math.max(0, lag), b0 = Math.max(0, -lag);
    const length = Math.min(a.length - a0, b.length - b0);
    if (length < 100 || length < b.length * 0.7) continue;
    const x = [], y = [];
    for (let i = 0; i < length; i++) if (b[b0 + i] > -8.5 && Number.isFinite(a[a0 + i]) && Number.isFinite(b[b0 + i])) { x.push(a[a0 + i]); y.push(b[b0 + i]); }
    const value = corr(x, y);
    if (value !== null && (!best || value > best.correlation)) best = { correlation: value, lag, a0, b0, length, voiced_frames: x.length };
  }
  if (!best) return { audio_match: false, reason: '音轨缺失、过短或有效声音/变化不足', manual_lip_review: 'required' };
  const windows = [];
  for (let i = 0; i + 60 <= best.length; i += 50) {
    const end = Math.min(i + 100, best.length), x = [], y = [];
    for (let j = i; j < end; j++) if (b[best.b0 + j] > -8.5) { x.push(a[best.a0 + j]); y.push(b[best.b0 + j]); }
    const value = corr(x, y);
    if (value !== null && y.length >= 30) windows.push({ start: Number(((best.b0 + i) / 100).toFixed(2)), correlation: Number(value.toFixed(3)) });
  }
  const minimum = windows.length ? Math.min(...windows.map(w => w.correlation)) : null;
  return { audio_match: best.correlation >= 0.85 && minimum !== null && minimum >= 0.8, correlation: Number(best.correlation.toFixed(3)), min_window_correlation: minimum, thresholds: { overall: 0.85, min_window: 0.8 }, suggested_picture_advance_seconds: best.lag / 100, compared_seconds: best.length / 100, voiced_frames: best.voiced_frames, windows, manual_lip_review: 'required', note: '仅比较音轨形态；正偏移表示生成音轨较晚，可尝试让画面提前；不代表嘴形准确。' };
}

const videoSamples = decodeAudio(video), audioSamples = decodeAudio(audio);
const result = analyze(videoSamples, audioSamples);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const [videoBytes, audioBytes] = await Promise.all([readFile(video), readFile(audio)]);
let report;
try { report = JSON.parse(await readFile(reportPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; report = { schema_version: 1, episode_id: episode.id, note: '独立网页素材的音轨筛查，未经人工嘴形验收；与官方API任务记录分离。', clips: {} }; }
if (report.episode_id !== episode.id) throw new Error('现有筛查记录属于其他episode');
report.source = 'ChatArt 网页';
const videoPath = relative(root, video).replaceAll('\\', '/');
report.clips[clipId] = {
  ...result, model_label: modelLabel, checked_at: new Date().toISOString(), video: videoPath.startsWith('..') ? video : videoPath,
  audio: clip.audio, video_sha256: sha256(videoBytes), audio_sha256: sha256(audioBytes),
  video_bytes: videoBytes.length, generated_audio_seconds: Number((videoSamples.length / 8000).toFixed(3)),
  reference_audio_seconds: Number((audioSamples.length / 8000).toFixed(3)),
};
report.updated_at = new Date().toISOString();
await mkdir(dirname(reportPath), { recursive: true });
const temporary = `${reportPath}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
await rename(temporary, reportPath);
console.log(JSON.stringify({ clip: clipId, source: report.source, model_label: modelLabel, video: report.clips[clipId].video, audio_match: result.audio_match, correlation: result.correlation ?? null, min_window_correlation: result.min_window_correlation ?? null, suggested_picture_advance_seconds: result.suggested_picture_advance_seconds ?? null, manual_lip_review: 'required', reason: result.reason || null, report: 'work/chatart-video-qa.json' }, null, 2));
