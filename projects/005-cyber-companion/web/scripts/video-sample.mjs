import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../server/config.js';
import { SpeechService } from '../server/api.js';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(webRoot);
if (!config.apiKey) throw new Error('缺少现有 MiniMax 配置。');
const [command, name = 'realistic-greeting'] = process.argv.slice(2);
if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error('样片名称仅支持英文小写、数字和短横线。');
const runtime = resolve(webRoot, '.runtime/video', name);
const requestPath = resolve(webRoot, '../samples', `${name}.json`);
const statePath = resolve(runtime, 'task.json');
await mkdir(runtime, { recursive: true });
const redact = value => String(value || '').replaceAll(config.apiKey, '[redacted]').slice(0, 1000);

async function request(path, payload) {
  const response = await fetch(`${config.baseURL}${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${config.apiKey}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(45000), redirect: 'error',
  });
  const data = await response.json().catch(() => ({}));
  const failed = !response.ok || data.error || (data.base_resp?.status_code && data.base_resp.status_code !== 0);
  if (failed) {
    const detail = { http: response.status, message: redact(data.error?.message || data.base_resp?.status_msg || '请求失败') };
    await writeFile(resolve(runtime, 'last-error.json'), JSON.stringify({ checked_at: new Date().toISOString(), ...detail }, null, 2));
    throw new Error(`MiniMax HTTP ${detail.http}: ${detail.message}`);
  }
  return data;
}

if (command === 'create') {
  // 重复运行复用本地任务；不自动重试创建，避免重复计费。
  const existing = await readFile(statePath, 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing?.task_id) {
    console.log(JSON.stringify({ reused: true, task_id: existing.task_id }));
  } else {
    const payload = JSON.parse(await readFile(requestPath, 'utf8'));
    if (!['MiniMax-H3', 'MiniMax-H3-Max'].includes(payload.model) || payload.duration > 10 || payload.resolution !== '768P')
      throw new Error('首轮样片限定为 H3 系列、768P、不超过10秒。');
    const created = await request('/v2/video_generation', payload);
    if (!created.task_id) throw new Error('接口没有返回任务编号，请到控制台核对后再重试。');
    await writeFile(statePath, JSON.stringify({ task_id: created.task_id, model: payload.model, created_at: new Date().toISOString(), request: payload }, null, 2));
    console.log(JSON.stringify({ task_id: created.task_id, model: payload.model, duration: payload.duration, resolution: payload.resolution }));
  }
} else if (command === 'status') {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const result = await request(`/v2/query/video_generation/${encodeURIComponent(state.task_id)}`);
  const task = result.task;
  if (!task?.status) throw new Error('任务查询没有返回状态。');
  await writeFile(statePath, JSON.stringify({ ...state, last_checked_at: new Date().toISOString(), task }, null, 2));
  console.log(JSON.stringify({ task_id: state.task_id, status: task.status, duration: task.duration, resolution: task.resolution, usage: task.usage, error: task.error ? redact(task.error.message) : undefined }));
} else if (command === 'speech') {
  const path = resolve(webRoot, '../samples/audio', `${name}.mp3`);
  const existing = await readFile(path).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing) {
    console.log(JSON.stringify({ reused: true, path, bytes: existing.length }));
  } else {
    const text = '你回来啦。今天过得怎么样？慢慢说，我在听。';
    const result = await new SpeechService().synthesize(text, config);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, result.audio);
    await writeFile(resolve(runtime, 'speech.json'), JSON.stringify({ text, model: config.ttsModel, voice: config.voice, duration_ms: result.duration, bytes: result.audio.length, created_at: new Date().toISOString() }, null, 2));
    console.log(JSON.stringify({ path, duration_ms: result.duration, bytes: result.audio.length }));
  }
} else {
  throw new Error('用法：node scripts/video-sample.mjs create|status|speech [样片名称]');
}
