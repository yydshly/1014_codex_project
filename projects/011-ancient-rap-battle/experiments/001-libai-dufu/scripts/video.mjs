import { readFile, writeFile, mkdir, rename, unlink, open, stat } from 'node:fs/promises';
import { resolve, dirname, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// 独立小样客户端：创建不自动重试；仅明确的402/2068拒绝可显式重试。断线只恢复查询。
// 密钥永不进入状态与请求文件。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(root, 'work');
const statePath = resolve(work, 'video-tasks.json');
const cachePath = resolve(work, 'upload-cache.json');
const lockPath = resolve(work, '.video-runner.lock');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const usage = 'node scripts/video.mjs estimate|submit|watch|qa [A01 ...] [--env-file ABS] [--retry-rejected]';
const args = process.argv.slice(2);
const command = args.shift();
const ids = [];
let envFile, retryRejected = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env-file') { envFile = args[++i]; if (!envFile || !isAbsolute(envFile)) throw new Error('--env-file 必须是绝对路径'); }
  else if (args[i] === '--retry-rejected') retryRejected = true;
  else if (args[i].startsWith('--')) throw new Error(`未知选项 ${args[i]}`);
  else ids.push(args[i]);
}
if (!['estimate', 'submit', 'watch', 'qa'].includes(command)) throw new Error(usage);
if (command === 'submit' && !ids.length) throw new Error('submit 必须明确指定镜头 ID，首次请只提交 A01');
if (retryRejected && (command !== 'submit' || !envFile)) throw new Error('--retry-rejected 仅用于submit，且必须明确提供 --env-file ABS');
await mkdir(work, { recursive: true });
const episode = JSON.parse(await readFile(resolve(root, 'episode.json'), 'utf8'));
const clips = new Map((episode.clips || []).map(clip => [clip.id, clip]));
if (!clips.size || clips.size !== episode.clips.length) throw new Error('episode.clips 为空或 ID 重复');
const selected = ids.length ? [...new Set(ids)] : [...clips.keys()];
for (const id of selected) if (!clips.has(id) || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw new Error(`未知或无效镜头 ID: ${id}`);
if (episode.model !== 'MiniMax-H3' || episode.resolution !== '768P' || episode.ratio !== '16:9') throw new Error('首轮限定 MiniMax-H3 / 768P / 16:9');
if (episode.reference_price_cny_per_second !== 0.5 || episode.max_video_estimate_cny > 10 || !(episode.max_video_estimate_cny > 0)) throw new Error('首轮刊例单价应为0.50元/秒，视频预估上限不超过10元');
for (const clip of clips.values()) {
  if (!Number.isInteger(clip.duration) || clip.duration < 4 || clip.duration > 5 || !clip.prompt?.trim()) throw new Error(`${clip.id}: 首轮只接受4–5秒和非空提示词`);
}
const cost = clip => Number((clip.duration * episode.reference_price_cny_per_second).toFixed(2));

function safePath(path) {
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('素材路径必须位于实验目录内');
  return target;
}
async function json(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, path);
}
async function takeLock() {
  let handle;
  try { handle = await open(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const old = await json(lockPath, {});
    let alive = true;
    try { process.kill(old.pid, 0); } catch (failure) { if (failure.code === 'ESRCH') alive = false; }
    if (alive) throw new Error('另一个 video runner 正在运行；请等待该进程完成');
    await unlink(lockPath);
    handle = await open(lockPath, 'wx');
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, started_at: now(), command }));
  await handle.close();
  return () => unlink(lockPath).catch(() => {});
}
const readEnv = async path => parseEnv(await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; }));
const nonempty = source => Object.fromEntries(Object.entries(source).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => [key, value.trim()]));
async function config() {
  const local = { ...nonempty(await readEnv(resolve(root, '.env'))), ...nonempty(await readEnv(resolve(root, '.env.local'))) };
  const explicit = envFile ? nonempty(await readEnv(envFile)) : {};
  const merged = { ...local, ...explicit, ...nonempty(process.env) };
  const indirect = merged.MINIMAX_ENV_FILE;
  const source = indirect ? nonempty(await readEnv(resolve(envFile ? dirname(envFile) : root, indirect))) : {};
  const env = { ...source, ...merged };
  if (!env.MINIMAX_API_KEY) throw new Error('缺少服务端 MINIMAX_API_KEY 配置');
  const base = new URL(env.MINIMAX_BASE_URL || env.MINIMAX_API_BASE || 'https://api.minimax.cn');
  if (base.protocol !== 'https:' || !['api.minimax.cn', 'api.minimaxi.com', 'api.minimax.io'].includes(base.hostname) || base.username || base.password || base.port || base.search || base.hash || !['', '/'].includes(base.pathname)) throw new Error('MiniMax 必须使用官方 HTTPS 接口根地址');
  return { key: env.MINIMAX_API_KEY, base: base.origin };
}
// 文件/任务 ID 是标识符；即使服务返回 JSON 整数也先转字符串，避免 JS 精度损失。
function parseResponse(text) { return JSON.parse(text.replace(/("(?:file_id|task_id|id)"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"')); }
function redact(value, key) { return String(value || '').replaceAll(key || '\u0000', '[redacted]').replace(/https?:\/\/[^\s"<>]+/g, '[URL]').slice(0, 700); }
async function request(cfg, method, path, body, multipart = false) {
  let response;
  try {
    response = await fetch(cfg.base + path, {
      method, redirect: 'error', headers: { Authorization: `Bearer ${cfg.key}`, ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(multipart ? 180000 : 60000),
    });
  } catch (error) { const failure = new Error(`网络请求结果未知 (${error.name || 'network'})`); failure.unknown = true; throw failure; }
  let data;
  try { data = parseResponse(await response.text()); }
  catch { const failure = new Error(`HTTP ${response.status}: 非JSON响应，任务状态需核对`); failure.unknown = response.ok || response.status >= 500; throw failure; }
  if (!response.ok || data.error || (data.base_resp?.status_code && data.base_resp.status_code !== 0)) {
    const failure = new Error(`HTTP ${response.status}: ${redact(data.error?.message || data.base_resp?.status_msg || '请求失败', cfg.key)}`);
    failure.unknown = response.status >= 500;
    throw failure;
  }
  return data;
}
async function fingerprint(clip) {
  const reference = await readFile(safePath(clip.reference));
  const audio = await readFile(safePath(clip.audio));
  if (!reference.length || reference.length > 30 * 1024 * 1024 || !audio.length || audio.length > 15 * 1024 * 1024) throw new Error(`${clip.id}: 素材为空或超过官方大小上限`);
  const imageHash = hash(reference), audioHash = hash(audio);
  return { input_hash: hash(JSON.stringify({ clip, imageHash, audioHash, model: episode.model, resolution: episode.resolution, ratio: episode.ratio })), image_hash: imageHash, audio_hash: audioHash };
}
async function upload(cfg, path, cache, forceFresh = false) {
  const bytes = await readFile(safePath(path));
  const digest = hash(bytes);
  const hit = cache[digest];
  if (!forceFresh && hit?.file_id && hit.base_url === cfg.base && Date.now() - Date.parse(hit.uploaded_at) < 6 * 86400000) return `mm_file://${hit.file_id}`;
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' }[extname(path).toLowerCase()];
  if (!mime) throw new Error(`不支持的上传类型: ${extname(path)}`);
  const form = new FormData();
  form.append('purpose', 'video_generation_input');
  form.append('file', new Blob([bytes], { type: mime }), `sample_${digest.slice(0, 12)}${extname(path)}`);
  const result = await request(cfg, 'POST', '/v1/files/upload', form, true);
  const id = result.file?.file_id;
  if (!id) throw new Error('上传响应缺少 file_id');
  cache[digest] = { file_id: String(id), base_url: cfg.base, uploaded_at: now(), source: path, bytes: bytes.length };
  await save(cachePath, cache);
  return `mm_file://${id}`;
}
async function loadState() {
  const state = await json(statePath, { schema_version: 1, episode_id: episode.id, created_at: now(), clips: {} });
  if (state.episode_id !== episode.id) throw new Error('状态与episode.id不一致');
  return state;
}
async function saveState(state) { state.updated_at = now(); await save(statePath, state); }
function reserved(state) { return Object.values(state.clips).reduce((sum, entry) => sum + (entry.estimate_cny || 0), 0); }
function retryableRejection(record) {
  return record?.status === 'create_rejected' && !record.task_id && !record.task?.id && !record.output
    && /^HTTP 402:/.test(record.error || '') && /\(2068\)(?:\s|$)/.test(record.error || '');
}
function print(value) { console.log(JSON.stringify(value, null, 2)); }

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
function analyze(video, audio) {
  const a = envelope(decodeAudio(video)), b = envelope(decodeAudio(audio));
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
async function runQa(state, targets) {
  const report = await json(resolve(work, 'video-qa.json'), { schema_version: 1, clips: {}, note: '音轨筛查，未经人工嘴形验收。' });
  for (const id of targets) {
    const record = state.clips[id];
    if (!record?.output) { console.log(`${id}: 尚无已下载视频，跳过音轨筛查`); continue; }
    const result = analyze(safePath(record.output), safePath(clips.get(id).audio));
    report.clips[id] = { ...result, checked_at: now(), video: record.output, audio: clips.get(id).audio };
    record.qa = report.clips[id];
    print({ clip: id, audio_match: result.audio_match, correlation: result.correlation, min_window_correlation: result.min_window_correlation, suggested_picture_advance_seconds: result.suggested_picture_advance_seconds, manual_lip_review: 'required' });
  }
  report.updated_at = now();
  await save(resolve(work, 'video-qa.json'), report);
  await saveState(state);
}

if (command === 'estimate') {
  const state = await loadState();
  const newCost = selected.filter(id => !state.clips[id]).reduce((sum, id) => sum + cost(clips.get(id)), 0);
  print({ episode: episode.id, model: episode.model, resolution: episode.resolution, clips: selected.map(id => ({ id, seconds: clips.get(id).duration, estimate_cny: cost(clips.get(id)), existing_status: state.clips[id]?.status || null })), selected_total_cny: selected.reduce((sum, id) => sum + cost(clips.get(id)), 0), reserved_cny: reserved(state), new_estimate_cny: newCost, projected_cny: reserved(state) + newCost, limit_cny: episode.max_video_estimate_cny, within_limit: reserved(state) + newCost <= episode.max_video_estimate_cny, note: '按中国区0.50元/秒刊例估算，仅视频；无参考视频，单图/音频无输入费用。' });
} else {
  const release = await takeLock();
  try {
    const state = await loadState();
    if (command === 'qa') await runQa(state, selected);
    else {
      const cfg = await config();
      if (cfg.base !== 'https://api.minimax.cn' && cfg.base !== 'https://api.minimaxi.com') throw new Error('本轮人民币预算仅适用于中国区端点');
      if (command === 'submit') {
        // 整批先验证，任何不符合条件的记录都不会触发上传或生成。
        if (retryRejected) for (const id of selected) {
          if (!retryableRejection(state.clips[id])) throw new Error(`${id}: 只允许对无task_id的明确HTTP402/2068拒绝使用 --retry-rejected；其他状态不可重发`);
        }
        const additional = selected.filter(id => !state.clips[id]).reduce((sum, id) => sum + cost(clips.get(id)), 0);
        if (reserved(state) + additional > episode.max_video_estimate_cny + 1e-6) throw new Error('本轮视频预估会超过10元上限，未提交');
        const cache = await json(cachePath, {});
        for (const id of selected) {
          const clip = clips.get(id), input = await fingerprint(clip), previous = state.clips[id];
          if (previous) {
            if (previous.input_hash !== input.input_hash) throw new Error(`${id}: 输入已变更，需新小样目录；不能覆盖既有任务`);
            if (!retryRejected) {
              print({ clip: id, reused: true, status: previous.status, task_id: previous.task_id || null, note: previous.task_id ? '使用watch继续恢复' : '创建结果需核对，禁止自动重发' });
              continue;
            }
          }
          // 在付费创建之前检查本地音频规格；这里只解码，不调用生成服务。
          const audioDuration = decodeAudio(safePath(clip.audio)).length / 8000;
          if (audioDuration < 2 || audioDuration > 15.01) throw new Error(`${id}: 参考音频必须2–15秒`);
          // 换用新凭据时重新上传，避免跨账户误用旧上传ID；原拒绝记录在生成前才归档。
          const image = await upload(cfg, clip.reference, cache, retryRejected), audio = await upload(cfg, clip.audio, cache, retryRejected);
          const payload = { model: episode.model, content: [{ type: 'text', text: clip.prompt }, { type: 'image_url', image_url: { url: image }, role: 'reference_image' }, { type: 'audio_url', audio_url: { url: audio }, role: 'reference_audio' }], resolution: episode.resolution, duration: clip.duration, ratio: episode.ratio };
          const history = [...(previous?.attempt_history || [])];
          if (previous) {
            const { attempt_history, ...snapshot } = previous;
            history.push({ ...snapshot, archived_at: now(), retry_reason: 'explicit_retry_after_HTTP402_2068' });
          }
          const record = state.clips[id] = { ...input, take: 1, attempt_number: history.length + 1, attempt_history: history, status: 'submitting', created_at: now(), estimate_cny: cost(clip), base_url: cfg.base, request: payload, reference_audio_seconds: audioDuration, manual_lip_review: 'required' };
          await saveState(state);
          try {
            const result = await request(cfg, 'POST', '/v2/video_generation', payload);
            const taskId = result.task_id || result.task?.id || result.id;
            if (!taskId) { const failure = new Error('创建响应未返回任务编号；须核对控制台，禁止自动重发'); failure.unknown = true; throw failure; }
            record.task_id = String(taskId); record.status = result.task?.status || 'queued'; record.submitted_at = now();
            await saveState(state);
            print({ clip: id, task_id: record.task_id, status: record.status, estimate_cny: record.estimate_cny });
          } catch (error) {
            record.status = error.unknown ? 'submission_unknown' : 'create_rejected'; record.error = redact(error.message, cfg.key); record.failed_at = now();
            await saveState(state);
            throw new Error(`${id}: ${record.error}；保留状态，不自动重发`);
          }
        }
      } else {
        const started = Date.now();
        while (true) {
          let pending = 0;
          for (const id of selected) {
            const record = state.clips[id];
            if (!record?.task_id) { console.log(`${id}: 无已保存任务编号，未创建任何任务`); continue; }
            if (record.base_url !== cfg.base) throw new Error(`${id}: 任务端点与当前配置不一致`);
            if (record.output && await stat(safePath(record.output)).then(s => s.size > 0).catch(() => false)) { console.log(`${id}: 复用已下载视频`); continue; }
            try {
              const result = await request(cfg, 'GET', `/v2/query/video_generation/${encodeURIComponent(record.task_id)}`);
              const task = result.task;
              if (!task?.status) throw new Error('查询响应没有task.status');
              record.status = task.status; record.last_checked_at = now(); record.usage = task.usage || {}; record.remote_error = task.error ? redact(task.error.message, cfg.key) : null;
              await saveState(state);
              print({ clip: id, task_id: record.task_id, status: record.status, usage: record.usage });
              if (task.status === 'succeeded') {
                const url = new URL(task.content?.url || '');
                if (url.protocol !== 'https:' || url.username || url.password) throw new Error('下载地址必须是HTTPS');
                // 签名下载地址只在内存使用，既不打印也不保存到日志/状态。
                const download = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(180000) });
                if (!download.ok) throw new Error(`视频下载HTTP ${download.status}`);
                const bytes = Buffer.from(await download.arrayBuffer());
                if (!bytes.length) throw new Error('下载视频为空');
                const output = `clips/${id}_t1.mp4`, destination = safePath(output);
                await mkdir(dirname(destination), { recursive: true });
                await writeFile(`${destination}.part`, bytes); await rename(`${destination}.part`, destination);
                record.output = output; record.output_sha256 = hash(bytes); record.downloaded_at = now(); record.bytes = bytes.length; delete record.last_error;
                await saveState(state);
              } else if (!['failed', 'cancelled'].includes(task.status)) pending++;
            } catch (error) {
              record.last_error = redact(error.message, cfg.key); record.last_checked_at = now(); await saveState(state);
              console.log(`${id}: ${record.last_error}；可再次watch恢复，未重复创建`); pending++;
            }
          }
          if (!pending) break;
          if (Date.now() - started > 30 * 60 * 1000) { console.log('本轮查询达30分钟；状态已保存，再次watch即可恢复'); break; }
          await sleep(15000);
        }
        await runQa(state, selected);
      }
    }
  } finally { await release(); }
}
