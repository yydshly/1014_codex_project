/** One official MiniMax music request, no retry. Keys remain in memory. */
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../../../..');
const music = join(root, 'music');
mkdirSync(music, { recursive: true });
const planPath = join(music, 'music-request.json');
const runPath = join(music, 'music-api-run.json');
const source = 'https://platform.minimax.cn/docs/api-reference/music-generation';
const priceSource = 'https://platform.minimax.cn/docs/pricing/overview';
const request = {
  model: 'music-3.0',
  prompt: '约27秒的完整中文国风说唱短曲，100 BPM，D minor，开头约一小节古筝拨弦和笛声，清晰厚重的hip hop鼓与低音，唐代诗人友好交锋的舞台感。两位明显不同的成年男性声音，前两句由明亮洒脱的青年男声以有旋律的rap演唱，后两句切换低沉坚定的成熟男声回应；吐字清楚，押重音，避免朗读感。完整演唱提供的四句歌词，每句只唱一次，不添加任何歌词，不重复副歌。开场和最后约一小节为器乐，最后一个低音和古筝音形成明确收束，短余响自然结束。总长目标24到30秒，精炼完整的开场、交锋、结尾，录音室成品，鼓和人声保持清晰。',
  lyrics: '[Intro]\n[Verse]\n酒杯一举，银河都来捧场\n你的工整，装不下我的月光\n[Verse]\n月光再亮，也得照见风霜\n我把人间，写成压轴的回响\n[Outro]',
  stream: false,
  output_format: 'hex',
  lyrics_optimizer: false,
  is_instrumental: false,
  audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
};
const plan = {
  schema_version: 1, title: '月光与人间', checked_on: '2026-10-15',
  endpoint: 'https://api.minimax.cn/v1/music_generation', request,
  pricing: { reference_cny_per_song: 1, max_requests: 1, max_estimate_cny: 1, actual_cost_cny: null, source: priceSource },
  availability: '官方自2026-08-20起仅对历史付费用户保留；本地配置是否具备音乐权限需一次请求验证。免费版本已停服。',
  timing: '接口没有精确duration参数；24–30秒和双声线均为提示词目标，返回后实测，不保证遵循。',
  sources: [source, priceSource], no_paid_retry: true,
};
writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
if (!process.argv.includes('--generate')) {
  console.log(JSON.stringify({ prepared: true, model: request.model, estimate_cny: 1, paid_requests: 0 }));
  process.exit(0);
}
if (existsSync(runPath)) throw new Error('已有一次音乐请求记录；禁止再次付费尝试，请查记录。');
const lock = openSync(join(music, '.music-request-attempted'), 'wx');
closeSync(lock);
const args = process.argv.slice(2), flag = args.indexOf('--env-file');
const explicit = flag >= 0 ? args[flag + 1] : null;
function readEnv(file) { return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}; }
const cfgDir = resolve(repo, 'projects/003-lofi-room/web');
const local = { ...readEnv(join(cfgDir, '.env')), ...readEnv(join(cfgDir, '.env.local')) };
const indirect = explicit || process.env.MINIMAX_ENV_FILE || local.MINIMAX_ENV_FILE;
const env = { ...(indirect ? readEnv(resolve(cfgDir, indirect)) : {}), ...local, ...process.env };
if (!env.MINIMAX_API_KEY) throw new Error('缺少配置；未发请求。密钥不会写入记录。');
const api = new URL(env.MINIMAX_BASE_URL || env.MINIMAX_API_BASE || 'https://api.minimax.cn');
if (api.protocol !== 'https:' || !['api.minimax.cn', 'api.minimaxi.com', 'api.minimax.io'].includes(api.hostname) || api.username || api.password)
  throw new Error('仅允许 MiniMax 官方HTTPS地址。');
// China pricing is explicitly verified; avoid silently charging another region.
if (api.hostname === 'api.minimax.io') throw new Error('此实验只核验了国内1元/首价格，未发国际区请求。');
const run = { schema_version: 1, provider: 'MiniMax', model: request.model, endpoint: `${api.origin}/v1/music_generation`,
  started_at: new Date().toISOString(), status: 'request_started', request_count: 1,
  reference_estimate_cny: 1, actual_cost_cny: null, no_retry: true, sources: [source, priceSource] };
writeFileSync(runPath, JSON.stringify(run, null, 2) + '\n');
const save = () => writeFileSync(runPath, JSON.stringify(run, null, 2) + '\n');
let response;
try {
  response = await fetch(run.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.MINIMAX_API_KEY}` },
    body: JSON.stringify(request), signal: AbortSignal.timeout(240000) });
} catch {
  Object.assign(run, { status: 'network_error_unknown_outcome', finished_at: new Date().toISOString(), note: '不自动重试，计费结果未知。' }); save();
  console.log(JSON.stringify({ status: run.status, requests: 1 })); process.exit(2);
}
run.http_status = response.status;
let payload;
try { payload = await response.json(); } catch { payload = {}; }
run.status_code = payload.base_resp?.status_code ?? null;
run.status_msg = String(payload.base_resp?.status_msg || '').slice(0, 300);
if (!response.ok || payload.base_resp?.status_code !== 0 || typeof payload.data?.audio !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(payload.data.audio)) {
  Object.assign(run, { status: 'rejected_no_audio', finished_at: new Date().toISOString(), audio_returned: false }); save();
  console.log(JSON.stringify({ status: run.status, http_status: run.http_status, status_code: run.status_code, message: run.status_msg, requests: 1 }));
  process.exit(3);
}
const bytes = Buffer.from(payload.data.audio, 'hex');
const output = join(music, 'minimax-song-raw.mp3');
writeFileSync(output, bytes);
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', output], { encoding: 'utf8' }));
Object.assign(run, { status: 'completed', finished_at: new Date().toISOString(), audio_returned: true,
  output: 'music/minimax-song-raw.mp3', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  duration_s: Number(probe.format.duration), streams: probe.streams,
  extra_info: payload.extra_info ? { music_duration: payload.extra_info.music_duration, music_sample_rate: payload.extra_info.music_sample_rate,
    music_channel: payload.extra_info.music_channel, bitrate: payload.extra_info.bitrate, music_size: payload.extra_info.music_size } : null });
save();
console.log(JSON.stringify({ status: run.status, duration_s: run.duration_s, output: run.output, requests: 1 }));
