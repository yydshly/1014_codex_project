/**
 * Screen a downloaded raw clip's native audio against its actual uploaded full-mix WAV.
 * Usage (from the experiment directory):
 *   node scripts/qa-external.mjs clips/A-block_t1.mp4 A-block
 * No generation, remux, music replacement or picture retiming occurs here.
 * WARNING: Matching accompaniment can dominate correlation. A pass proves neither
 * correct lyrics nor synchronized mouth movement. Never feed an assembled/remixed video.
 */
import { readFile, writeFile, mkdir, rename, stat, realpath, open, unlink } from 'node:fs/promises';
import { resolve, dirname, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [videoArg, clipId, ...extra] = process.argv.slice(2);
const blockIds = { 'A-block': 'A-main', 'B-block': 'B-main' };
if (!videoArg || !Object.hasOwn(blockIds, clipId || '') || extra.length)
  throw new Error('用法：node scripts/qa-external.mjs <clips中的原片.mp4> <A-block或B-block>');

const experimentId = '002-moon-and-earth';
const candidates = JSON.parse(await readFile(resolve(root, 'music/video-audio-candidates.json'), 'utf8'));
const matches = candidates.blocks?.filter(item => item.id === blockIds[clipId]);
if (!Array.isArray(matches) || matches.length !== 1 || !matches[0].wav?.path || !matches[0].wav?.sha256)
  throw new Error('候选参考记录缺失、不唯一或未登记真实驱动WAV的SHA。');
const block = matches[0];
const taskLog = JSON.parse(await readFile(resolve(root, 'work/chatart-tasks.json'), 'utf8'));
if (taskLog.experiment_id !== experimentId) throw new Error('网页任务记录属于其他实验。');
const taskMatches = taskLog.tasks?.filter(item => item.id === clipId);
if (!Array.isArray(taskMatches) || taskMatches.length !== 1) throw new Error('找不到唯一的真实网页任务。');
const task = taskMatches[0];
if (task.audio !== block.wav.path || (task.audio_sha256 && task.audio_sha256 !== block.wav.sha256))
  throw new Error('任务上传音频与候选WAV来源不一致，停止筛查。');

const video = await realpath(resolve(process.cwd(), videoArg));
const clipDirectory = await realpath(resolve(root, 'clips'));
if (!video.startsWith(clipDirectory + sep) || extname(video).toLowerCase() !== '.mp4')
  throw new Error('仅接受本实验clips目录下的原始MP4；禁止使用final/work或统一配乐后的成片。');
if (task.clip && video !== await realpath(resolve(root, task.clip)))
  throw new Error('输入路径不等于任务登记的原始下载路径，禁止拿合成文件替代原片。');
const audio = await realpath(resolve(root, block.wav.path));
if (!audio.startsWith(root + sep)) throw new Error('参考WAV超出本实验目录。');
const videoStat = await stat(video);
if (!videoStat.isFile() || !videoStat.size) throw new Error('原片为空或不是普通文件。');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const [videoBytes, audioBytes] = await Promise.all([readFile(video), readFile(audio)]);
const videoSha = sha256(videoBytes), audioSha = sha256(audioBytes);
if (audioSha !== block.wav.sha256) throw new Error('真实驱动WAV与登记SHA不一致；不得换用重铺的音乐。');
const recordedVideoSha = task.output_sha256 || task.video_sha256 || task.clip_sha256 || null;
if (recordedVideoSha && recordedVideoSha !== videoSha) throw new Error('原片SHA与任务下载记录不一致。');

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const method = {
  sample_rate_hz: 8000, channels: 1, window_samples: 80, envelope_hop_seconds: 0.01,
  envelope: 'natural_log(sqrt(mean(samples^2)) + 1e-4)',
  lag_search_seconds: [-0.4, 0.6], lag_step_seconds: 0.01,
  minimum_overlap_seconds: 1, minimum_reference_overlap_ratio: 0.7,
  active_reference_log_rms_threshold: -8.5,
  activity_filter_meaning: '仅排除近乎静音参考帧；包含伴奏，绝不是人声检测或说话人分离。',
  minimum_correlation_frames: 20, minimum_log_envelope_variance: 0.0025,
  local_window_seconds: 1, local_window_step_seconds: 0.5, minimum_tail_window_seconds: 0.6,
  minimum_local_active_frames: 30, thresholds: { overall: 0.85, min_window: 0.8 },
};
function probe(path) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=index,codec_type,codec_name,sample_rate,channels,width,height,r_frame_rate', '-of', 'json', path], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('FFprobe无法检查原片/驱动音频。');
  return JSON.parse(result.stdout);
}
function decodeNativeAudio(path) {
  const result = spawnSync(ffmpeg, ['-v', 'error', '-i', path, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('FFmpeg无法解码原片第一条原生音轨/驱动WAV；未替换音轨或创建QA结果。');
  const samples = new Float64Array(result.stdout.length / 4);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = result.stdout.readFloatLE(i * 4);
    if (!Number.isFinite(samples[i])) throw new Error('解码音轨包含非有限采样。');
  }
  return samples;
}
function envelope(samples) {
  const out = [];
  for (let i = 0; i + 79 < samples.length; i += 80) {
    let sum = 0;
    for (let j = 0; j < 80; j++) sum += samples[i + j] ** 2;
    out.push(Math.log(Math.sqrt(sum / 80) + 1e-4));
  }
  return out;
}
function correlation(a, b) {
  if (a.length < 20 || a.length !== b.length) return { value: null, reason: '有效帧不足' };
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let aa = 0, bb = 0, ab = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; aa += x * x; bb += y * y; ab += x * y; }
  const result = { value: null, generated_variance: aa / a.length, reference_variance: bb / b.length };
  if (aa / a.length < .0025 || bb / b.length < .0025) return { ...result, reason: '包络变化不足，相关性不可靠' };
  const value = ab / Math.sqrt(aa * bb);
  return Number.isFinite(value) ? { ...result, value } : { ...result, reason: '相关性非有限值' };
}
function analyze(generatedSamples, referenceSamples) {
  const a = envelope(generatedSamples), b = envelope(referenceSamples), lags = [];
  let best = null;
  for (let lag = -40; lag <= 60; lag++) {
    const a0 = Math.max(0, lag), b0 = Math.max(0, -lag), length = Math.min(a.length - a0, b.length - b0);
    if (length < 100 || length < b.length * .7) { lags.push({ lag_seconds: lag / 100, correlation: null, reason: '重叠长度不足' }); continue; }
    const x = [], y = [];
    for (let i = 0; i < length; i++) if (b[b0 + i] > -8.5) { x.push(a[a0 + i]); y.push(b[b0 + i]); }
    const c = correlation(x, y);
    lags.push({ lag_seconds: lag / 100, correlation: c.value, active_reference_frames: x.length, ...c });
    if (c.value !== null && (!best || c.value > best.correlation)) best = { correlation: c.value, lag, a0, b0, length, active_reference_frames: x.length, generated_variance: c.generated_variance, reference_variance: c.reference_variance };
  }
  const common = { envelope_generated_frames: a.length, envelope_reference_frames: b.length, lag_candidates: lags,
    manual_lip_review: 'required', manual_lyric_review: 'required', native_audio_only: true,
    automatic_picture_retime: false, accompaniment_can_dominate_score: true };
  if (!best) return { ...common, audio_match: false, reason: '音轨过短、参考近乎静音或包络变化不足', windows: [] };
  const windows = [];
  for (let i = 0; i + 60 <= best.length; i += 50) {
    const end = Math.min(i + 100, best.length), x = [], y = [];
    for (let j = i; j < end; j++) if (b[best.b0 + j] > -8.5) { x.push(a[best.a0 + j]); y.push(b[best.b0 + j]); }
    const c = correlation(x, y);
    windows.push({ start: Number(((best.b0 + i) / 100).toFixed(2)), end: Number(((best.b0 + end) / 100).toFixed(2)),
      generated_start: (best.a0 + i) / 100, generated_end: (best.a0 + end) / 100,
      active_reference_frames: y.length, included_in_minimum: c.value !== null && y.length >= 30,
      correlation: c.value, generated_variance: c.generated_variance ?? null, reference_variance: c.reference_variance ?? null, reason: c.reason || null });
  }
  const valid = windows.filter(w => w.included_in_minimum), minimum = valid.length ? Math.min(...valid.map(w => w.correlation)) : null;
  return { ...common, audio_match: best.correlation >= .85 && minimum !== null && minimum >= .8,
    correlation: best.correlation, min_window_correlation: minimum, thresholds: method.thresholds,
    suggested_picture_advance_seconds: best.lag / 100, generated_audio_lag_seconds: best.lag / 100,
    lag_interpretation: '正值表示原片声音较晚；这是混合音轨包络偏移候选，不能自动据此移动嘴形画面。',
    compared_seconds: best.length / 100, reference_start_seconds: best.b0 / 100, generated_start_seconds: best.a0 / 100,
    active_reference_frames: best.active_reference_frames, overall_generated_variance: best.generated_variance, overall_reference_variance: best.reference_variance,
    valid_window_count: valid.length, minimum_window_start: valid.find(w => w.correlation === minimum)?.start ?? null, windows };
}

const videoProbe = probe(video), audioProbe = probe(audio);
if (!videoProbe.streams?.some(s => s.codec_type === 'video') || !videoProbe.streams?.some(s => s.codec_type === 'audio'))
  throw new Error('输入必须是包含原生视频与音轨的下载原片。');
const generatedSamples = decodeNativeAudio(video), referenceSamples = decodeNativeAudio(audio);
if (Math.abs(referenceSamples.length / 8000 - 10) > .02) throw new Error('真实驱动WAV不是登记的10秒候选。');
const result = analyze(generatedSamples, referenceSamples);
if (sha256(await readFile(video)) !== videoSha || sha256(await readFile(audio)) !== audioSha)
  throw new Error('筛查过程中原片或参考WAV发生变化；未保存结果。');
const pathRelative = relative(root, video).replaceAll('\\', '/');
const checked = { ...result, checked_at: new Date().toISOString(), model_label: task.model_label || '网页模型未登记',
  video: pathRelative, audio: block.wav.path, video_sha256: videoSha, audio_sha256: audioSha,
  source_song_sha256: block.source_sha256, source_in: block.source_in, source_out: block.source_out,
  video_bytes: videoBytes.length, audio_bytes: audioBytes.length,
  generated_audio_seconds: generatedSamples.length / 8000, reference_audio_seconds: referenceSamples.length / 8000,
  native_audio_stream: '0:a:0', video_probe: videoProbe, reference_probe: audioProbe,
  raw_download_hash_matched_ledger: recordedVideoSha ? true : null,
  provenance_limit: recordedVideoSha ? '与任务下载SHA一致；仍需核实下载链路。' : '任务尚未登记下载SHA，现记录输入SHA供后续对照；目录和路径限制不能独立证明文件未被人为重混。',
  warning: '参考含伴奏；高相关可能主要来自伴奏，不能证明歌词未改、字音完整或嘴形同步。必须检查原片，不得用统一铺回原曲的成片替代本筛查。' };

const reportPath = resolve(root, 'work/video-qa.json');
await mkdir(dirname(reportPath), { recursive: true });
const lockPath = `${reportPath}.lock`;
let lock;
try { lock = await open(lockPath, 'wx'); } catch (error) {
  if (error.code === 'EEXIST') throw new Error('另一个筛查进程正在更新报告；请顺序运行A/B，未覆盖现有结果。');
  throw error;
}
try {
  let report;
  try { report = JSON.parse(await readFile(reportPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; report = { schema_version: 1, experiment_id: experimentId, clips: {} }; }
  if (report.experiment_id !== experimentId) throw new Error('现有筛查报告属于其他实验。');
  report.source = 'ChatArt 网页下载原片的第一条原生音轨';
  report.method = method;
  report.warning = '混音包络相关仅供素材筛查；伴奏可能主导分数，audio_match=true不是嘴形、歌词、音素或最终成片验收。禁止用配回统一音乐后的文件伪造raw QA。';
  report.clips[clipId] = checked;
  report.updated_at = new Date().toISOString();
  const temporary = `${reportPath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
  await rename(temporary, reportPath);
} finally { await lock.close(); await unlink(lockPath); }
console.log(JSON.stringify({ clip: clipId, video: pathRelative, report: 'work/video-qa.json', audio_match: result.audio_match,
  correlation: result.correlation ?? null, min_window_correlation: result.min_window_correlation ?? null,
  suggested_picture_advance_seconds: result.suggested_picture_advance_seconds ?? null,
  manual_lip_review: 'required', manual_lyric_review: 'required', warning: checked.warning }, null, 2));
