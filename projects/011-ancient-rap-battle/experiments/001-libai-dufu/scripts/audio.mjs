/**
 * 4句节奏化TTS小样。仅 --generate 会发送至多4次付费请求；现存原音始终复用。
 * Key只从进程环境或 --env-file 指定的现有配置读入内存，不写入产物。
 * node scripts/audio.mjs --generate --env-file <existing-config-file>
 * node scripts/audio.mjs   # 用已保存原音重新合成，无网络调用
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { execFileSync, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, 'work');
const rawDir = join(work, 'audio', 'raw');
mkdirSync(rawDir, { recursive: true });
const args = process.argv.slice(2);
const arg = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const envFile = arg('--env-file') || process.env.MINIMAX_ENV_FILE;
const env = { ...(envFile ? parseEnv(readFileSync(resolve(envFile), 'utf8')) : {}), ...process.env };
const model = env.MINIMAX_TTS_MODEL || 'speech-2.8-turbo';
const base = new URL(env.MINIMAX_BASE_URL || env.MINIMAX_API_BASE || 'https://api.minimax.cn');
if (base.protocol !== 'https:' || !['api.minimax.cn', 'api.minimax.io', 'api.minimaxi.com'].includes(base.hostname) || base.username || base.password)
  throw new Error('仅允许 MiniMax 官方 HTTPS 地址。');
const ffmpeg = env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = env.FFPROBE_PATH || 'ffprobe';
const duration = path => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path], {encoding:'utf8'}).trim());
const decodedDuration = path => execFileSync(ffmpeg, ['-v','error','-i',path,'-ar','48000','-ac','1','-f','s16le','pipe:1'],{maxBuffer:2_000_000}).length / 2 / 48000;
const encode = argv => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['ignore', 'pipe', 'pipe'] });
const metadataOnly = args.includes('--metadata-only');
function heardBounds(path) {
  const result = spawnSync(ffmpeg, ['-hide_banner','-i',path,'-af','silencedetect=noise=-38dB:d=0.10','-f','null','NUL'], {encoding:'utf8'});
  if (result.status !== 0) throw new Error('语音边界检测失败。');
  const starts = [...result.stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m=>Number(m[1]));
  const ends = [...result.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m=>Number(m[1]));
  return { start:starts[0]===0 ? ends[0] : 0, end:Math.abs(ends.at(-1)-slot)<0.1 ? starts.at(-1) : slot };
}
const BPM = 100, beat = 60 / BPM, slot = beat * 8, intro = beat * 4, total = Number((intro + slot * 4 + intro).toFixed(3)), lead = 0.15;
const defs = [
  { id: 'A01', actor: '李白', actor_id: 'libai', text: '酒杯一举，银河都来捧场', voice: 'Chinese (Mandarin)_Unrestrained_Young_Man', speed: 1.18, pitch: 1, emotion: 'happy' },
  { id: 'A02', actor: '李白', actor_id: 'libai', text: '你的工整，装不下我的月光', voice: 'Chinese (Mandarin)_Unrestrained_Young_Man', speed: 1.18, pitch: 1, emotion: 'happy' },
  { id: 'B01', actor: '杜甫', actor_id: 'dufu', text: '月光再亮，也得照见风霜', voice: 'Chinese (Mandarin)_Radio_Host', speed: 1.18, pitch: -1, emotion: 'calm' },
  { id: 'B02', actor: '杜甫', actor_id: 'dufu', text: '我把人间，写成压轴的回响', voice: 'Chinese (Mandarin)_Radio_Host', speed: 1.18, pitch: -1, emotion: 'calm' },
];
const runPath = join(work, 'audio-run.json');
const previous = existsSync(runPath) ? JSON.parse(readFileSync(runPath, 'utf8')) : {};
const records = previous.requests || [];
for (const line of defs) {
  const raw = join(rawDir, `${line.id}.mp3`);
  if (existsSync(raw)) continue;
  if (!args.includes('--generate')) throw new Error(`缺少原音 ${line.id}；使用 --generate 明确启用最多4条TTS请求。`);
  if (!env.MINIMAX_API_KEY) throw new Error('未配置 MiniMax Key；没有发送付费请求。');
  const started = Date.now();
  const voiceSetting = { voice_id: line.voice, speed: line.speed, vol: 1, pitch: line.pitch, emotion: line.emotion };
  let response;
  try {
    response = await fetch(`${base.origin}/v1/t2a_v2`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:`Bearer ${env.MINIMAX_API_KEY}`},
      body: JSON.stringify({ model, text: line.text, stream: false, output_format: 'hex', language_boost: 'Chinese', voice_setting: voiceSetting,
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 } }), signal: AbortSignal.timeout(60000) });
  } catch { throw new Error(`${line.id} 请求超时或网络错误；不自动重试。`); }
  if (!response.ok) throw new Error(`${line.id} MiniMax HTTP ${response.status}；不自动重试。`);
  const payload = await response.json();
  if (payload.base_resp?.status_code !== 0 || typeof payload.data?.audio !== 'string' || !/^(?:[a-f0-9]{2})+$/i.test(payload.data.audio))
    throw new Error(`${line.id} MiniMax未返回有效音频，状态码${payload.base_resp?.status_code ?? 'unknown'}；不自动重试。`);
  writeFileSync(raw, Buffer.from(payload.data.audio, 'hex'));
  const info = payload.extra_info || {};
  records.push({ id: line.id, provider: 'MiniMax', model, voice_setting: voiceSetting, language_boost: 'Chinese', text: line.text,
    elapsed_ms: Date.now() - started, usage_characters: info.usage_characters ?? null, audio_length_ms: info.audio_length ?? null,
    raw_duration_s: duration(raw), audio_sample_rate: info.audio_sample_rate ?? null, audio_size: info.audio_size ?? null });
  writeFileSync(runPath, JSON.stringify({ schema_version: 1, method: '节奏化TTS＋原创程序合成节拍，非Suno/非歌曲生成模型', requested_max: 4,
    model, endpoint: `${base.origin}/v1/t2a_v2`, sources: ['https://platform.minimax.io/docs/api-reference/speech-t2a-http','https://platform.minimax.io/docs/faq/system-voice-id'],
    requests: records }, null, 2) + '\n');
  console.log(`${line.id}: 原音已保存，${duration(raw).toFixed(3)}秒，耗时${((Date.now()-started)/1000).toFixed(2)}秒。`);
}

// 原创100 BPM节拍；确定性伪随机噪声合成军鼓和踩镲，不引用外部音乐采样。
const sr = 48000, samples = new Float64Array(Math.round(sr * total));
let seed = 20261015;
const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
function add(at, length, signal, gain=1) { const offset = Math.round(at*sr), count=Math.round(length*sr); for(let i=0;i<count&&offset+i<samples.length;i++) samples[offset+i]+=signal(i/sr,i)*gain; }
for (let b=0; b<total/beat; b++) {
  const at=b*beat;
  // 底鼓、2/4拍军鼓、每半拍踩镲，短暂尾奏渐弱。
  if (b%4===0 || b%4===2 || (b>=4&&b%8===7)) add(at,0.4,t=>Math.sin(2*Math.PI*(48*t+10*(1-Math.exp(-t*28))))*Math.exp(-t*13),0.44);
  if (b%4===1 || b%4===3) add(at,0.22,t=>(noise()*0.65+Math.sin(2*Math.PI*185*t)*0.35)*Math.exp(-t*24),0.24);
  for(let h=0;h<2;h++) add(at+h*beat/2,0.07,t=>noise()*Math.exp(-t*70),h===0?0.055:0.038);
  if(b%2===0) {
    const notes=[73.416,73.416,87.307,65.406];
    const f=notes[Math.floor(b/8)%4];
    add(at,0.45,t=>(Math.sin(2*Math.PI*f*t)+0.25*Math.sin(2*Math.PI*2*f*t))*Math.exp(-t*7),0.14);
  }
}
const wav = Buffer.alloc(44 + samples.length*2);
wav.write('RIFF',0); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(sr,24); wav.writeUInt32LE(sr*2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(samples.length*2,40);
for(let i=0;i<samples.length;i++){ const t=i/sr; const fade=Math.min(1,t/0.04,(total-t)/0.8); wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]*fade))*32767),44+i*2); }
if (!metadataOnly) writeFileSync(join(work,'beat_original.wav'),wav);
const lines=[];
for (let i=0;i<defs.length;i++) {
  const line=defs[i], raw=join(rawDir,`${line.id}.mp3`), out=join(work,'audio',`${line.id}.mp3`), rawDuration=duration(raw);
  if (rawDuration+lead>slot-0.03) throw new Error(`${line.id} 原音${rawDuration}秒超出句槽，未截尾或加速；需调整时间轴。`);
  if (!metadataOnly) encode(['-i',raw,'-af',`loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000,asetpts=PTS-STARTPTS,adelay=${lead*1000}:all=1,apad=whole_len=${Math.round(slot*48000)},atrim=end_sample=${Math.round(slot*48000)},asetpts=PTS-STARTPTS`,'-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','192k',out]);
  const start=Number((intro+i*slot).toFixed(3));
  const heard = heardBounds(out);
  lines.push({ id:line.id, actor:line.actor, actor_id:line.actor_id, text:line.text, start, end:Number((start+slot).toFixed(3)), duration:slot,
    audio:`audio/${line.id}.mp3`, raw_audio:`audio/raw/${line.id}.mp3`, raw_duration:rawDuration, raw_decoded_duration:decodedDuration(raw), slot_decoded_duration:decodedDuration(out),
    voice_start:Number((start+lead).toFixed(3)), voice_end:Number((start+lead+rawDuration).toFixed(3)),
    heard_start:Number((start+heard.start).toFixed(3)), heard_end:Number((start+heard.end).toFixed(3)), heard_detection_db:-38, slot_lead:lead, voice_id:line.voice });
}
const inputs=lines.flatMap(l=>['-i',join(work,l.audio)]);
const delays=lines.map((l,i)=>`[${i}:a]adelay=${Math.round(l.start*1000)}:all=1[a${i}]`).join(';');
if (!metadataOnly) {
  encode([...inputs,'-filter_complex',`${delays};${lines.map((_,i)=>`[a${i}]`).join('')}amix=inputs=4:duration=longest:normalize=0,apad=whole_dur=${total},atrim=duration=${total}[out]`,'-map','[out]','-ar','48000','-ac','1','-c:a','pcm_s16le',join(work,'vocals_final.wav')]);
  encode(['-i',join(work,'vocals_final.wav'),'-i',join(work,'beat_original.wav'),'-filter_complex','[0:a]volume=0.92[v];[1:a]volume=0.66[b];[v][b]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.94:level=0[out]','-map','[out]','-ar','48000','-ac','2','-c:a','pcm_s16le',join(work,'music_final.wav')]);
  encode(['-i',join(work,'music_final.wav'),'-c:a','libmp3lame','-b:a','192k',join(work,'music_final.mp3')]);
}
writeFileSync(join(work,'lines.json'),JSON.stringify({schema_version:1,bpm:BPM,source:'原创4句；MiniMax TTS；非歌唱模型；无强制时间压缩',total_duration:total,lines},null,2)+'\n');
writeFileSync(join(work,'grid.json'),JSON.stringify({schema_version:1,bpm:BPM,beat_duration:beat,beats_per_bar:4,slot_bars:2,intro_duration:intro,outro_duration:intro,total_duration:total,
  beats:Array.from({length:Math.round(total/beat)+1},(_,i)=>Number((i*beat).toFixed(3))),
  slots:lines.map(({id,start,end,duration,voice_start,voice_end,heard_start,heard_end,raw_duration,audio})=>({id,start,end,duration,voice_start,voice_end,heard_start,heard_end,raw_duration,audio}))},null,2)+'\n');
const time = n => { const ms=Math.round(n*1000); return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`; };
writeFileSync(join(work,'字幕.srt'),lines.map((l,i)=>`${i+1}\n${time(l.heard_start)} --> ${time(l.heard_end+0.15)}\n${l.actor}：${l.text}\n`).join('\n'),'utf8');
console.log(JSON.stringify({done:true,total_duration:total,bpm:BPM,slots:lines.map(({id,start,end,raw_duration})=>({id,start,end,raw_duration})),paid_requests_this_run:records.length-(previous.requests?.length||0)},null,2));
