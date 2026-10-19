/** Deterministic original 100 BPM arrangement around previously generated MiniMax voices. No network. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '../001-libai-dufu');
const music = join(root, 'music'), work = join(root, 'work'), audio = join(work, 'audio');
for (const d of [music, work, audio]) mkdirSync(d, { recursive: true });
const sr = 48000, total = 24, bpm = 100, beat = 60 / bpm, slot = 4.8, intro = 2.4;
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const relative = file => file.slice(root.length + 1).replaceAll('\\', '/');
const ff = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 40_000_000 });
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' }));
const decode = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ar', String(sr), '-ac', '2', '-f', 'f32le', 'pipe:1'], { maxBuffer: 40_000_000 });
const sourceLines = JSON.parse(readFileSync(join(source, 'work/lines.json'), 'utf8')).lines;
const defs = sourceLines.map(({id,actor,actor_id,text,voice_id,heard_start,heard_end}) => ({id,actor,actor_id,text,voice_id,heard_start,heard_end}));
for (const l of defs) {
  const original = join(source, 'work/audio', `${l.id}.mp3`), out = join(audio, `${l.id}.mp3`);
  if (!existsSync(original)) throw new Error(`缺少已有 MiniMax 原声 ${l.id}`);
  copyFileSync(original, out);
  if (hash(original) !== hash(out)) throw new Error(`${l.id} 复制校验失败`);
}

// All instruments synthesized below; there are no sampled songs, drum packs or external music files.
const n = total * sr, left = new Float64Array(n), right = new Float64Array(n);
let seed = 2026101502;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const midi = note => 440 * 2 ** ((note - 69) / 12);
function add(at, duration, fn, gain = 1, pan = 0) {
  const offset = Math.round(at * sr), count = Math.round(duration * sr);
  const lg = Math.cos((pan + 1) * Math.PI / 4), rg = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < count && offset + i < n; i++) {
    if (offset + i < 0) continue;
    const value = fn(i / sr, i) * gain;
    left[offset + i] += value * lg; right[offset + i] += value * rg;
  }
}
function pluck(at, note, gain = 0.12, pan = 0) {
  const f = midi(note), ph = random() * Math.PI;
  add(at, 1.8, t => {
    const a = (1 - Math.exp(-t * 1300)) * Math.exp(-t * 4.8);
    return a * (Math.sin(2 * Math.PI * f * t) + .32 * Math.sin(2 * Math.PI * f * 2.002 * t + ph) + .14 * Math.sin(2 * Math.PI * f * 3.001 * t));
  }, gain, pan);
}
function reed(at, note, duration, gain = .065, pan = .2) {
  const f = midi(note);
  add(at, duration + .22, t => {
    const env = Math.min(1, t / .08) * Math.max(0, Math.min(1, (duration + .22 - t) / .22));
    const phase = 2 * Math.PI * f * t + .015 * Math.sin(2 * Math.PI * 5.2 * t);
    return env * (Math.sin(phase) + .18 * Math.sin(phase * 2) + .07 * random());
  }, gain, pan);
}
function pad(at, notes, duration, gain = .027) {
  for (const [i, note] of notes.entries()) {
    const f = midi(note);
    add(at, duration, t => Math.min(1, t / .3, (duration - t) / .45) * (Math.sin(2 * Math.PI * f * .9985 * t) + Math.sin(2 * Math.PI * f * 1.0015 * t)) / 2, gain, (i - 1) * .45);
  }
}
function kick(at, gain = .52) {
  add(at, .33, t => (Math.sin(2 * Math.PI * (46 * t + 1.8 * (1 - Math.exp(-t * 42)))) * Math.exp(-t * 14) + random() * Math.exp(-t * 220) * .1), gain);
}
function snare(at, gain = .19) {
  let previous = 0;
  add(at, .18, t => { const v = random(), high = v - previous * .78; previous = v; return (high * .76 + Math.sin(2 * Math.PI * 188 * t) * .24) * Math.exp(-t * 29); }, gain, -.035);
}
function hat(at, gain = .032, open = false, pan = .3) {
  let previous = 0;
  add(at, open ? .2 : .052, t => { const v = random(), high = v - previous * .88; previous = v; return high * Math.exp(-t * (open ? 25 : 83)); }, gain, pan);
}
function bass(at, note, duration = .43, gain = .15) {
  const f = midi(note);
  add(at, duration, t => Math.min(1, t / .006, (duration - t) / .07) * (Math.sin(2 * Math.PI * f * t) + .22 * Math.sin(2 * Math.PI * f * 2 * t) + .05 * Math.sin(2 * Math.PI * f * 3 * t)), gain);
}

// A two-bar answer motif appears after speech, leaving space for the words.
const chords = [[50, 57, 65], [48, 55, 64], [46, 53, 62], [45, 52, 61]];
const roots = [38, 36, 34, 33];
pad(0, [50,57,65], 2.6, .038);
[[0,74], [.3,77], [.6,81], [1.2,79], [1.8,77]].forEach(([t,note],i) => pluck(t,note,.14,i%2 ? .35 : -.35));
reed(.65, 86, .65, .047, .25);
for (let i = 0; i < 4; i++) {
  const at = intro + i * slot;
  pad(at, chords[i], slot + .12, .025);
  for (let b = 0; b < 8; b++) {
    const t = at + b * beat;
    if (b % 4 === 0 || b % 4 === 2) kick(t);
    if (b % 4 === 1 || b % 4 === 3) snare(t, i === 3 ? .205 : .18);
    if (b === 6) kick(t + beat * .75, .24);
    for (let h = 0; h < 2; h++) hat(t + h * beat / 2, h === 0 ? .036 : .025, h === 1 && b === 7, h % 2 ? -.35 : .35);
    if (i > 0 && b === 7) for (let h = 1; h < 4; h++) hat(t + h * beat / 4, .017, false, h % 2 ? .25 : -.25);
    if (b % 2 === 0) bass(t, roots[i], b === 6 ? .75 : .45, i === 3 ? .17 : .15);
    if (b === 3 || b === 7) bass(t + beat / 2, roots[i] + 12, .22, .075);
    if (b % 2 === 0) pluck(t, chords[i][(b / 2) % 3] + 12, .042, b % 4 ? .5 : -.5);
  }
  const answer = i % 2 === 0 ? [81,79,77,74] : [77,79,81,77];
  answer.forEach((note,k) => pluck(at + 2.85 + k * .3, note, .10, k % 2 ? .3 : -.3));
  reed(at + 3.65, i === 3 ? 74 : 81, .62, .048, .3);
}
// A small fill announces the second character, without moving the voice recording.
for (let j = 0; j < 3; j++) snare(11.55 + j * .15, .085 + j * .02);
const outro = total - intro;
kick(outro,.42); bass(outro,38,1.6,.17); pad(outro,[50,57,65],2.4,.04);
[[0,81],[.3,79],[.6,77],[.9,74],[1.2,62]].forEach(([t,note],i)=>pluck(outro+t,note,.14,i%2?.3:-.3));
reed(outro+.05,86,.65,.05,.3);
// A short stereo room adds cohesion, with a final fade long enough to end cleanly.
for (let i=n-1;i>=0;i--) {
  const l=left[i],r=right[i];
  for (const [delay,gain] of [[.075,.12],[.135,.08],[.215,.045]]) {
    const j=i+Math.round(delay*sr); if(j<n) {left[j]+=r*gain;right[j]+=l*gain;}
  }
}
const wav = Buffer.alloc(44+n*4);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);
let instrumentalPeak=0;
for(let i=0;i<n;i++) {
  const t=i/sr, fade=Math.max(0,Math.min(1,t/.025,(total-t)/.65));
  for(const [c,arr] of [[0,left],[1,right]]) {const v=Math.max(-.98,Math.min(.98,arr[i]*fade));instrumentalPeak=Math.max(instrumentalPeak,Math.abs(v));wav.writeInt16LE(Math.round(v*32767),44+i*4+c*2);}
}
const beatFile=join(work,'beat_original.wav');writeFileSync(beatFile,wav);
const inputs=defs.flatMap(l=>['-i',join(audio,`${l.id}.mp3`)]);
const delays=defs.map((l,i)=>`[${i}:a]adelay=${Math.round((intro+i*slot)*1000)}:all=1[a${i}]`).join(';');
const vocal=join(work,'vocals_final.wav'), final=join(work,'music_final.wav');
ff([...inputs,'-filter_complex',`${delays};${defs.map((_,i)=>`[a${i}]`).join('')}amix=inputs=4:duration=longest:normalize=0,apad=whole_dur=${total},atrim=duration=${total}[out]`,'-map','[out]','-ar',String(sr),'-ac','2','-c:a','pcm_s16le',vocal]);
ff(['-i',vocal,'-i',beatFile,'-filter_complex','[0:a]volume=1.00,asplit=2[v][sc];[1:a]volume=0.95[b];[b][sc]sidechaincompress=threshold=0.035:ratio=3:attack=12:release=150:makeup=1[d];[v][d]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-15:TP=-1.2:LRA=8,aresample=48000[out]','-map','[out]','-ar',String(sr),'-ac','2','-c:a','pcm_s16le',final]);
ff(['-i',final,'-c:a','libmp3lame','-b:a','192k',join(work,'music_final.mp3')]);
const blocks=[];
for(const [id,start,ids] of [['A',intro,['A01','A02']],['B',intro+slot*2,['B01','B02']]]) {
  const path=join(audio,`${id}-block.mp3`);
  ff(['-i',vocal,'-ss',String(start),'-t','9.6','-af','apad=whole_dur=9.6,atrim=duration=9.6','-ar',String(sr),'-ac','1','-c:a','libmp3lame','-b:a','192k',path]);
  const pcm=decode(path);if(pcm.length/(4*2*sr)!==9.6)throw new Error(`${id}块解码时长错误`);
  blocks.push({id:`${id}-block`,source_lines:ids,path:relative(path),decoded_duration_s:9.6,container_duration_s:Number(probe(path).format.duration),sha256:hash(path),music_included:false});
}
const finalPCM=decode(final);let peak=0,energy=0,clipped=0;
for(let i=0;i<finalPCM.length;i+=4) {const value=finalPCM.readFloatLE(i);peak=Math.max(peak,Math.abs(value));energy+=value*value;if(Math.abs(value)>=.9999)clipped++;}
const exactDuration=finalPCM.length/(sr*2*4);
if(exactDuration!==24 || clipped>0 || peak===0)throw new Error('最终混音时长/削波/空音频检查失败');
const measure=spawnSync('ffmpeg',['-hide_banner','-i',final,'-af','loudnorm=I=-15:TP=-1.2:LRA=8:print_format=json','-f','null','NUL'],{encoding:'utf8'});
if(measure.status!==0)throw new Error('响度分析失败');
const loudness=JSON.parse(measure.stderr.slice(measure.stderr.lastIndexOf('{'),measure.stderr.lastIndexOf('}')+1));
const lines=defs.map((l,i)=>({...l,start:intro+i*slot,end:intro+(i+1)*slot,duration:slot,audio:`audio/${l.id}.mp3`,sha256:hash(join(audio,`${l.id}.mp3`)),
  voice_source:`../001-libai-dufu/work/audio/${l.id}.mp3`,voice_bytes_unchanged:true}));
writeFileSync(join(work,'lines.json'),JSON.stringify({schema_version:1,title:'月光与人间',bpm,total_duration:total,intro_duration:intro,outro_duration:intro,
  source:'MiniMax 已有TTS原声＋新编原创程序伴奏；不是歌曲模型演唱',lines},null,2)+'\n');
writeFileSync(join(work,'grid.json'),JSON.stringify({schema_version:1,bpm,beat_duration:beat,beats_per_bar:4,slot_bars:2,intro_duration:intro,outro_duration:intro,total_duration:total,
  beats:Array.from({length:41},(_,i)=>Number((i*beat).toFixed(3))),slots:lines.map(({id,start,end,duration,audio,heard_start,heard_end})=>({id,start,end,duration,audio,heard_start,heard_end}))},null,2)+'\n');
const time=t=>{const m=Math.round(t*1000);return `${String(Math.floor(m/3600000)).padStart(2,'0')}:${String(Math.floor(m/60000)%60).padStart(2,'0')}:${String(Math.floor(m/1000)%60).padStart(2,'0')},${String(m%1000).padStart(3,'0')}`;};
writeFileSync(join(work,'字幕.srt'),lines.map((l,i)=>`${i+1}\n${time(l.heard_start)} --> ${time(l.heard_end+.15)}\n${l.actor}：${l.text}\n`).join('\n'),'utf8');
const priorRun=JSON.parse(readFileSync(join(source,'work/audio-run.json'),'utf8'));
const apiRun=existsSync(join(music,'music-api-run.json'))?JSON.parse(readFileSync(join(music,'music-api-run.json'),'utf8')):null;
const report={schema_version:1,title:'月光与人间',created_at:new Date().toISOString(),status:'completed',method:'MiniMax TTS原声复用＋原创代码配器',
  song_generation_model_used:false,music_api_attempt:{model:apiRun?.model,status:apiRun?.status,http_status:apiRun?.http_status,status_code:apiRun?.status_code,reference_estimate_cny:1,actual_cost_cny:null,requests:apiRun?.request_count??0},
  paid_tts_requests_this_experiment:0,paid_music_retries:0,source_tts_model:priorRun.model,source_tts_requests:priorRun.requests.map(({id,provider,model,voice_setting,usage_characters})=>({id,provider,model,voice_setting,usage_characters})),
  arrangement:{bpm,key:'D minor / D pentatonic',duration_s:total,bars:10,intro_bars:1,verse_bars:8,outro_bars:1,seed:2026101502,sample_rate:sr,
    instruments:['合成底鼓','合成军鼓','合成踩镲','正弦泛音低音','拨弦音色（古筝意象，不是实录古筝）','合成气息笛音','轻弦乐铺底'],
    structure:['0–2.4秒拨弦动机开场','2.4–12秒明亮角色，两句交锋','12–21.6秒低沉角色回应，鼓花和音色递进','21.6–24秒主音收束与自然余响'],
    vocal_time_stretch:false,vocal_pitch_shift:false,external_music_samples:false,sidechain_ducking:true},
  files:[beatFile,vocal,final,join(work,'music_final.mp3')].map(path=>({path:relative(path),bytes:readFileSync(path).length,sha256:hash(path),probe:probe(path)})),
  lines,blocks,qa:{decode_duration_s:exactDuration,expected_duration_s:24,channels:2,sample_rate:sr,sample_peak_dbfs:Number((20*Math.log10(peak)).toFixed(3)),
    rms_dbfs:Number((10*Math.log10(energy/(finalPCM.length/4))).toFixed(3)),clipped_samples:clipped,integrated_lufs:Number(loudness.input_i),true_peak_dbfs:Number(loudness.input_tp),
    passed:exactDuration===24&&clipped===0,scope:'时长、解码、电平、来源字节一致性检查；不等于歌词发音或口型人工验收。'},
  limitations:['music-3.0唯一一次调用被410/2153拒绝，未返回歌曲','人声为MiniMax合成配音，非歌唱模型演唱','本实验新增伴奏为程序合成，拨弦和笛声音色为意象','费用为接口参考报价，实际账单未核实']};
writeFileSync(join(music,'audio-run.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({done:true,duration_s:exactDuration,bpm,voice_lines:4,blocks:blocks.map(({id,decoded_duration_s})=>({id,decoded_duration_s})),paid_requests_this_run:0,
  qa:report.qa,output:relative(final)},null,2));
