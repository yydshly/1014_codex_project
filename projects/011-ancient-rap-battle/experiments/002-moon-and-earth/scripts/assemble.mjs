/**
 * 002 完整四句成片。读取本实验 clips 中至少两条真实新视频并映射四句；缺片时拒绝成片。
 * node scripts/assemble.mjs --check    # 只检查输入与记录
 * node scripts/assemble.mjs --prepare  # 只绘制字幕图层
 * node scripts/assemble.mjs            # 验证、合成并核验完整成片
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { dirname, resolve, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, 'work'), finalDir = join(root, 'final'), overlaysDir = join(work, 'overlays');
const reportPath = join(work, 'final-report.json');
const target = join(finalDir, 'moon-and-earth-v2.mp4');
const rendering = join(finalDir, 'moon-and-earth-v2.rendering.mp4');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg', ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const args = process.argv.slice(2), ids = ['A01', 'A02', 'B01', 'B02'];
mkdirSync(work, { recursive: true });
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const number = value => typeof value === 'number' && Number.isFinite(value);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const probe = path => JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { encoding: 'utf8' }));
const localPath = value => {
  requireValue(typeof value === 'string' && value.trim(), '素材路径必须为非空字符串。');
  const path = resolve(root, value), rel = relative(root, path);
  requireValue(rel && !rel.startsWith('..') && !/^[a-z]:/i.test(rel), `素材必须位于002实验内：${value}`);
  return path;
};
const saveReport = report => writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
let inputs = {}, shots = [], visualShots = [], started = Date.now(), validatedFinalReport = null;

function visualPlan(t) {
  if (!t.visual_timeline) return [
    { id: 'intro-art', type: 'instrumental_art_motion', start: 0, end: t.intro.duration, image: typeof t.poster === 'object' ? t.poster.path : t.poster, motion: 'slow-push' },
    ...t.lines.map(line => ({ ...line, id: `${line.id}-first`, line_id: line.id, type: 'performance', qa_id: line.qa_id || line.id })),
    { id: 'outro-art', type: 'instrumental_art_motion', start: t.duration - t.outro.duration, end: t.duration, image: typeof t.poster === 'object' ? t.poster.path : t.poster, motion: 'slow-pull' },
  ];
  requireValue(Array.isArray(t.visual_timeline), 'visual_timeline须为连续覆盖整片的数组。');
  return t.visual_timeline.map(item => {
    if (item.type !== 'performance') return { ...item };
    const line = t.lines.find(line => line.id === item.line_id);
    requireValue(line, `${item.id}引用了不存在的canonical歌词。`);
    return { ...line, ...item, actor: line.actor, text: line.text, qa_id: item.qa_id || line.qa_id || line.id, line_id: line.id };
  });
}

function validateTimeline(t) {
  requireValue(t.schema_version === 1 && t.experiment_id === '002-moon-and-earth', '时间轴schema_version/experiment_id不匹配。');
  requireValue(t.status === 'confirmed', '仅接受status=confirmed的实测时间轴；计划稿不能用于合成。');
  requireValue(number(t.duration) && t.duration >= 24 && t.duration <= 120, '完整成片时长必须为24–120秒。');
  requireValue([24, 25].includes(t.fps), 'fps须为24或25。');
  requireValue(Math.abs(t.duration * t.fps - Math.round(t.duration * t.fps)) < 1e-6, '整片时长须能精确表示为完整输出帧。');
  const size = t.size || { width: 1280, height: 720 };
  requireValue(Number.isInteger(size.width) && Number.isInteger(size.height) && size.width >= 1280 && size.height >= 720 && size.width % 2 === 0 && size.height % 2 === 0, '输出至少1280×720，且宽高须为偶数。');
  requireValue(Math.abs(size.width / size.height - 16 / 9) < .001, '当前包装布局只支持16:9。');
  requireValue(t.intro && t.outro && [t.intro.duration, t.outro.duration].every(n => number(n) && n > 0), '必须保留开场和收尾。');
  requireValue(Array.isArray(t.lines) && t.lines.length === 4 && ids.every((id, i) => t.lines[i].id === id), '必须依次包含A01、A02、B01、B02四句；不能以部分素材声明完整。');
  let cursor = -Infinity;
  for (const line of t.lines) {
    requireValue(typeof line.actor === 'string' && line.actor.trim() && typeof line.text === 'string' && line.text.trim(), `${line.id}缺少角色或歌词。`);
    requireValue([line.start, line.end, line.heard_start, line.heard_end].every(number), `${line.id}缺少完整时间轴。`);
    requireValue(line.start >= cursor - 1e-6 && line.end > line.start, `${line.id}首次出现必须按歌词顺序且互不重叠。`);
    requireValue(line.heard_start >= line.start && line.heard_end > line.heard_start && line.heard_end <= line.end, `${line.id}可听歌词时间超出该句镜头。`);
    requireValue(Math.abs(line.start * 100 - Math.round(line.start * 100)) < 1e-6 && Math.abs(line.end * 100 - Math.round(line.end * 100)) < 1e-6, '中间时间轴边界须精确到0.01秒。');
    if (line.color !== undefined) requireValue(/^#[0-9a-f]{6}$/i.test(line.color), '角色颜色须为六位十六进制色值。');
    requireValue(line.generated_video !== false, `${line.id}明确不是生成视频，拒绝作为真实表演镜头。`);
    cursor = line.end;
  }
  const visuals = visualPlan(t), seen = new Set(), firstIds = [];
  requireValue(visuals.length >= 6 && new Set(visuals.map(item => item.id)).size === visuals.length, '视觉时间表须有至少六段且id互不重复。');
  cursor = 0;
  for (const item of visuals) {
    requireValue(typeof item.id === 'string' && /^[a-z0-9_-]+$/i.test(item.id), '视觉段id须为字母数字、下划线或连字符。');
    requireValue([item.start, item.end].every(number) && Math.abs(item.start - cursor) < 1e-6 && item.end > item.start, `${item.id}必须从上一段结束处开始，不允许空洞或重叠。`);
    requireValue([item.start, item.end].every(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6), `${item.id}视觉边界须在0.01秒网格上。`);
    if (item.type === 'performance') {
      requireValue(ids.includes(item.line_id), `${item.id}缺少有效line_id。`);
      requireValue(item.generated_video !== false, `${item.id}明确不是生成表演视频。`);
      requireValue([item.heard_start, item.heard_end].every(number) && item.heard_start >= item.start && item.heard_end > item.heard_start && item.heard_end <= item.end, `${item.id}实际歌词位置必须位于本次表演范围内。`);
      if (!seen.has(item.line_id)) {
        const line = t.lines.find(line => line.id === item.line_id);
        requireValue(Math.abs(item.start - line.start) < 1e-6 && Math.abs(item.end - line.end) < 1e-6 && Math.abs(item.heard_start - line.heard_start) < 1e-6 && Math.abs(item.heard_end - line.heard_end) < 1e-6, `${item.line_id}首次表演和canonical歌词时间不一致。`);
        seen.add(item.line_id); firstIds.push(item.line_id);
      }
    } else {
      requireValue(item.type === 'instrumental_art_motion', `${item.id}只允许performance或instrumental_art_motion。`);
      requireValue(typeof item.image === 'string' && item.image.trim() && ['slow-push', 'slow-pull'].includes(item.motion || 'slow-push'), `${item.id}器乐图须注明image及slow-push/slow-pull运镜。`);
    }
    cursor = item.end;
  }
  requireValue(Math.abs(cursor - t.duration) < 1e-6, '视觉时间表必须完整覆盖0到整曲结束。');
  requireValue(firstIds.join(',') === ids.join(','), '四句canonical歌词首次出现须依次为A01、A02、B01、B02。');
  if (t.expected_performance_occurrences !== undefined) requireValue(Number.isInteger(t.expected_performance_occurrences) && visuals.filter(item => item.type === 'performance').length === t.expected_performance_occurrences, '实际演唱次数和已确认的expected_performance_occurrences不一致。');
  requireValue(typeof t.title === 'string' && t.title.trim(), '缺少片名。');
  requireValue(t.audio && typeof t.audio.kind === 'string' && typeof t.audio.provider === 'string' && t.audio.provider.trim(), '统一音轨须注明kind/provider，区分TTS编排与歌曲模型。');
  requireValue(t.audio.gain_db === undefined || (number(t.audio.gain_db) && t.audio.gain_db >= -12 && t.audio.gain_db <= 0), 'audio.gain_db仅允许-12至0dB的恒定音量调整。');
  requireValue(t.max_frame_hold_seconds === undefined || (number(t.max_frame_hold_seconds) && t.max_frame_hold_seconds >= 0 && t.max_frame_hold_seconds <= .5), 'max_frame_hold_seconds只能设为0–0.5秒，不能用长定格补齐表演。');
  return size;
}

function readQa(t, line, rawHash) {
  const id = line.qa_id || line.line_id || line.id;
  const paths = t.qa_reports || ['work/video-qa.json', 'work/chatart-video-qa.json'];
  requireValue(Array.isArray(paths), 'qa_reports必须为实验内JSON路径数组。');
  const records = [];
  for (const value of paths) {
    const path = localPath(value);
    if (!existsSync(path)) continue;
    const doc = readJson(path), entry = doc.clips?.[id] ?? doc.shots?.find?.(item => item.id === id);
    if (!entry) continue;
    if (entry.video_sha256) requireValue(entry.video_sha256 === rawHash, `${id} QA记录所核查的原片与当前输入SHA不一致。`);
    records.push({ source: relative(root, path).replaceAll('\\', '/'), record_sha256: hash(path), original_result: entry });
  }
  return { status: records.length ? 'recorded' : 'not_run', records, lip_sync_passed: null,
    note: '原始音轨筛查值原样保留，包括false；统一混音和画面重定时不会将失败改成通过。音轨相关性不能证明口型。' };
}

function retimeFor(line, sourceDuration, duration, advance) {
  if (!line.retime || line.retime.enabled === false) return null;
  requireValue(Math.abs(advance) < 1e-9, `${line.id}启用分段重定时时不能叠加advance_seconds。`);
  const points = line.retime.control_points;
  requireValue(Array.isArray(points) && points.length >= 2 && points.length <= 32, `${line.id}分段重定时须有2–32个控制点。`);
  points.forEach((point, i) => {
    requireValue(Array.isArray(point) && point.length === 2 && point.every(n => number(n) && n >= 0), `${line.id}控制点必须为非负[source,target]。`);
    requireValue(Math.abs(point[1] * 100 - Math.round(point[1] * 100)) < 1e-6, `${line.id}目标重定时边界须在0.01秒网格上。`);
    if (i) requireValue(point[0] > points[i - 1][0] && point[1] > points[i - 1][1], `${line.id}控制点必须分别严格递增。`);
  });
  requireValue(points[0][0] === 0 && points[0][1] === 0 && points.at(-1)[0] <= sourceDuration + .001 && Math.abs(points.at(-1)[1] - duration) < 1e-6, `${line.id}控制点须从[0,0]到句槽末尾，且不能超出原片。`);
  return { method: 'piecewise_linear_video_retime', reason: line.retime.reason || '按人工登记控制点仅调整画面时间轴。', control_points: points,
    lip_sync_passed: null, segments: points.slice(1).map((point, i) => ({ source_start: points[i][0], source_end: point[0],
      target_duration: Number((point[1] - points[i][1]).toFixed(6)), scale: (point[1] - points[i][1]) / (point[0] - points[i][0]) })) };
}

function makeOverlays(t) {
  const visuals = visualPlan(t);
  const overlays = [
    { id: 'badge', kind: 'badge', text: 'AI 角色演绎 · 原创小样', start: 0, end: t.duration },
    { id: 'intro', kind: 'title', text: t.intro.title || t.title, sub: t.intro.subtitle || t.subtitle || '月光与人间 · 四句交锋', start: 0, end: t.intro.duration },
    { id: 'outro', kind: 'title', text: t.outro.title || '月光入诗，人间回响。', sub: t.outro.subtitle || '原创歌词 · 合成声音 · AI 画面', start: t.duration - t.outro.duration, end: t.duration },
    ...visuals.filter(item => item.type === 'instrumental_art_motion').map(item => ({ id: `art-${item.id}`, kind: 'artlabel', text: '原创图像 · 程序运镜', start: item.start, end: item.end })),
    ...visuals.filter(item => item.type === 'performance').flatMap(line => [
      { id: `name-${line.id}`, kind: 'name', text: line.actor, sub: line.name_subtitle || `月光与人间 / ${line.line_id}`, color: line.color || (line.line_id.startsWith('A') ? '#F0CF8D' : '#8DD6DF'), start: line.start, end: line.end },
      { id: `caption-${line.id}`, kind: 'caption', text: line.text, color: line.color || (line.line_id.startsWith('A') ? '#F0CF8D' : '#8DD6DF'), start: line.heard_start, end: Math.min(line.end, line.heard_end + .15) },
    ]),
  ].map(item => ({ ...item, path: join(overlaysDir, `${item.id}.png`) }));
  mkdirSync(overlaysDir, { recursive: true });
  const python = String.raw`
import json,os,sys
from PIL import Image,ImageDraw,ImageFont
items=json.load(sys.stdin)
fontpath=os.environ.get('CJK_FONT_PATH','C:/Windows/Fonts/msyh.ttc')
if not os.path.isfile(fontpath): raise RuntimeError('请用CJK_FONT_PATH提供中文字体。')
def font(n): return ImageFont.truetype(fontpath,n)
def center(d,text,y,size,color):
 f=font(size)
 while d.textbbox((0,0),text,font=f)[2]>1120 and size>18:
  size-=1;f=font(size)
 box=d.textbbox((0,0),text,font=f)
 d.text(((1280-(box[2]-box[0]))/2,y),text,font=f,fill=color,stroke_width=1,stroke_fill=(0,0,0,190))
for item in items:
 im=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(im);c=item.get('color','#F0CF8D')
 if item['kind']=='badge':
  d.rounded_rectangle((992,23,1254,65),12,fill=(5,12,20,185));d.text((1007,32),item['text'],font=font(18),fill='#EDF0F4')
 elif item['kind']=='title':
  d.rounded_rectangle((95,510,1185,690),24,fill=(5,12,20,215),outline=(240,207,141,120),width=1)
  center(d,item['text'],529,43,'#F0CF8D');center(d,item['sub'],605,25,'#EDF0F4')
 elif item['kind']=='artlabel':
  d.rounded_rectangle((28,663,332,699),10,fill=(5,12,20,190));d.text((42,670),item['text'],font=font(17),fill='#D8DFE9')
 elif item['kind']=='name':
  d.rounded_rectangle((28,25,386,111),15,fill=(5,12,20,190));d.text((47,34),item['text'],font=font(31),fill=c);d.text((47,80),item['sub'],font=font(15),fill='#EDF0F4')
 else:
  d.rounded_rectangle((125,617,1155,697),16,fill=(5,12,20,220));center(d,item['text'],634,35,'#FAF8F1');d.rounded_rectangle((145,641,152,674),3,fill=c)
 im.save(item['path'])
`;
  const result = spawnSync(process.env.PYTHON_PATH || 'python', ['-X', 'utf8', '-c', python], { input: JSON.stringify(overlays), encoding: 'utf8', maxBuffer: 2_000_000 });
  requireValue(result.status === 0, `中文包装绘制失败：${result.stderr || result.error?.message}`);
  return overlays;
}

function appendRetime(graph, input, output, retime, size, prefix) {
  graph.push(`[${input}]setpts=PTS-STARTPTS,${size},split=${retime.segments.length}${retime.segments.map((_, i) => `[${prefix}s${i}]`).join('')}`);
  retime.segments.forEach((segment, i) => graph.push(`[${prefix}s${i}]trim=start=${segment.source_start}:end=${segment.source_end},setpts=(PTS-STARTPTS)*${segment.scale},fps=100,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=${segment.target_duration},setpts=PTS-STARTPTS[${prefix}p${i}]`));
  graph.push(`${retime.segments.map((_, i) => `[${prefix}p${i}]`).join('')}concat=n=${retime.segments.length}:v=1:a=0[${output}]`);
}

try {
  requireValue(args.length <= 1 && args.every(arg => ['--check', '--prepare'].includes(arg)), '用法：node scripts/assemble.mjs [--check|--prepare]。');
  const timelinePath = join(work, 'timeline.json');
  requireValue(existsSync(timelinePath), '缺少work/timeline.json；尚未生成成片。');
  const t = readJson(timelinePath), size = validateTimeline(t), plan = visualPlan(t);
  const poster = localPath(typeof t.poster === 'object' ? t.poster.path : t.poster), mix = localPath(t.audio.path);
  inputs = { timeline: { path: relative(root, timelinePath), sha256: hash(timelinePath) }, poster: { path: relative(root, poster) }, audio: { ...t.audio, path: relative(root, mix), gain_db: t.audio.gain_db ?? 0,
    gain_note: '成片仅施恒定音量调整；用户原始文件保持不变，不裁切、不变速。' } };
  if (args.includes('--prepare')) {
    const overlays = makeOverlays(t);
    console.log(JSON.stringify({ status: 'overlays_ready', overlays: overlays.length, output_created: false }, null, 2));
    process.exit(0);
  }
  const missing = [...new Set([poster, mix, ...plan.map(item => localPath(item.type === 'performance' ? (item.clip || `clips/${item.line_id}_t1.mp4`) : item.image))])].filter(path => !existsSync(path));
  if (missing.length) {
    saveReport({ schema_version: 1, experiment_id: t.experiment_id, status: 'awaiting_real_inputs', checked_at: new Date().toISOString(), missing: missing.map(path => relative(root, path).replaceAll('\\', '/')), output_created: false, inputs });
    console.error(`真实素材未齐，没有生成或替换成片：${missing.map(path => relative(root, path)).join('、')}。`);
    process.exit(2);
  }
  inputs.poster.sha256 = hash(poster); inputs.audio.sha256 = hash(mix);
  const audioProbe = probe(mix), audioStream = audioProbe.streams.find(stream => stream.codec_type === 'audio');
  requireValue(audioStream, '统一音轨没有有效音频流。');
  // 以实际解码后的样本数为准，避免MP3容器时长或编码延迟造成误判。
  const decodedAudio = execFileSync(ffmpeg, ['-v', 'error', '-i', mix, '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '48000', '-f', 's16le', 'pipe:1'], { maxBuffer: 32_000_000 });
  const audioDuration = decodedAudio.length / (48000 * 2 * 2), audioEndPadding = t.duration - audioDuration;
  requireValue(audioDuration > 0 && audioEndPadding >= -1e-9 && audioEndPadding <= 1 / t.fps + 1 / 48000, '必须完整保留原音轨；只允许在末尾补不超过一帧静音对齐视频，不自动裁歌或拉伸。');
  inputs.audio.duration = audioDuration;
  inputs.audio.sample_count_note = 's16解码仅用于计数和时长测量，不用于证明原始音频峰值或是否削波；电平需另用浮点解码检验。';
  inputs.audio.container_duration = Number(audioStream.duration ?? audioProbe.format?.duration);
  inputs.audio.alignment = { method: 'append_silence_only', decoded_sample_rate: 48000, decoded_stereo_sample_frames: decodedAudio.length / 4,
    padding_seconds: Math.max(0, audioEndPadding), maximum_padding_seconds: 1 / t.fps, original_audio_trimmed_seconds: 0, original_audio_speed: 1,
    note: '完整保留原音轨的解码内容；仅在歌曲结束后补不超过一个视频帧的静音。AAC重新编码可能另含编码器延迟。' };
  // 第二版不能悄悄沿用第一版原片。只用于拒绝重复文件，不读取任何密钥或账户资料。
  const oldClipsDir = resolve(root, '../001-libai-dufu/clips');
  const oldHashes = existsSync(oldClipsDir) ? readdirSync(oldClipsDir).filter(file => extname(file).toLowerCase() === '.mp4').map(file => hash(join(oldClipsDir, file))) : [];
  shots = plan.filter(item => item.type === 'performance').map(line => {
    const path = localPath(line.clip || `clips/${line.line_id}_t1.mp4`), clipRelative = relative(join(root, 'clips'), path);
    requireValue(clipRelative && !clipRelative.startsWith('..') && extname(path).toLowerCase() === '.mp4', `${line.id}须映射到002/clips内的真实新MP4视频。`);
    const rawHash = hash(path); requireValue(!oldHashes.includes(rawHash), `${line.id}仍是001旧原片，拒绝当作重新定制版本。`);
    const info = probe(path), stream = info.streams.find(item => item.codec_type === 'video'), duration = line.end - line.start;
    const sourceDuration = Number(stream?.duration ?? info.format?.duration);
    requireValue(stream && number(sourceDuration) && sourceDuration > 0 && stream.width >= 1280 && stream.height >= 720, `${line.id}必须含有效720p以上视频流。`);
    requireValue(!stream.nb_frames || Number(stream.nb_frames) >= 24, `${line.id}视频帧数不足，不能当成真实表演。`);
    const baseIn = line.source_in ?? 0, advance = line.advance_seconds ?? 0;
    requireValue(number(baseIn) && baseIn >= 0 && baseIn < sourceDuration, `${line.id}source_in必须位于实际源片范围内。`);
    requireValue(number(advance) && Math.abs(advance) <= 1, `${line.id}偏移须在正负1秒内。`);
    const retime = retimeFor(line, sourceDuration - baseIn, duration, advance), sourceIn = baseIn + Math.max(0, advance), startHold = Math.max(0, -advance);
    const used = Math.min(sourceDuration - sourceIn, duration - startHold), endHold = Math.max(0, duration - startHold - used);
    if (!retime) requireValue(sourceIn < sourceDuration && startHold + endHold <= (t.max_frame_hold_seconds ?? .25), `${line.id}真实视频过短或偏移过大；需要补片，不能用长定格补齐表演。`);
    return { id: line.id, type: 'performance', line_id: line.line_id, actor: line.actor, text: line.text, path: relative(root, path).replaceAll('\\', '/'), absolute_path: path, sha256: rawHash, source_duration: sourceDuration,
      source_stream: { codec: stream.codec_name, width: stream.width, height: stream.height, fps: stream.avg_frame_rate, frames: stream.nb_frames ? Number(stream.nb_frames) : null },
      requested_source_in: baseIn, source_in: sourceIn, source_out: retime ? sourceIn + retime.control_points.at(-1)[0] : sourceIn + used, requested_advance_seconds: advance,
      start_frame_hold_seconds: retime ? 0 : startHold, end_frame_hold_seconds: retime ? 0 : Number(endHold.toFixed(6)), slot_start: line.start, slot_end: line.end, slot_duration: duration,
      ...(retime ? { retime } : {}), qa: readQa(t, line, rawHash) };
  });
  visualShots = plan.map(item => item.type === 'performance' ? shots.find(shot => shot.id === item.id) : {
    id: item.id, type: 'instrumental_art_motion', path: relative(root, localPath(item.image)).replaceAll('\\', '/'), absolute_path: localPath(item.image),
    sha256: hash(localPath(item.image)), motion: item.motion || 'slow-push', slot_start: item.start, slot_end: item.end, slot_duration: item.end - item.start,
    is_generated_video: false, label: '原创图像 · 程序运镜',
  });
  const sourceGroups = new Map();
  for (const shot of shots) {
    const group = sourceGroups.get(shot.sha256) || { path: shot.path, sha256: shot.sha256, duration: shot.source_duration, segments: [] };
    requireValue(group.path === shot.path, '相同原片不能复制成多个文件冒充不同生成任务。');
    group.segments.push({ id: shot.id, line_id: shot.line_id, source_in: shot.source_in, source_out: shot.source_out }); sourceGroups.set(shot.sha256, group);
  }
  requireValue(sourceGroups.size >= 2, '完整交锋至少需要两条独立新原片；不能重复一条视频覆盖全部四句。');
  for (const group of sourceGroups.values()) {
    const segments = [...group.segments].sort((a, b) => a.source_in - b.source_in);
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i], b = segments[j], overlaps = b.source_in < a.source_out - .001 && a.source_in < b.source_out - .001;
      if (overlaps) requireValue(a.line_id === b.line_id && Math.abs(a.source_in - b.source_in) < .001 && Math.abs(a.source_out - b.source_out) < .001,
        `${group.path}仅允许同一canonical歌词重复取用相同源区间，禁止跨不同歌词复用。`);
    }
  }
  const uniqueLyricShots = new Set(shots.map(shot => shot.line_id)).size;
  requireValue(uniqueLyricShots === 4, '四句canonical歌词必须全部具有真实新人物表演。');
  const artShots = visualShots.filter(shot => shot.type === 'instrumental_art_motion');
  if (args.includes('--check')) {
    saveReport({ schema_version: 1, experiment_id: t.experiment_id, status: 'inputs_ready', checked_at: new Date().toISOString(), output_created: false, inputs, source_files: [...sourceGroups.values()], shots, visual_timeline: visualShots,
      assembly: { source_clips: sourceGroups.size, unique_lyric_shots: uniqueLyricShots, performance_occurrences: shots.length, instrumental_art_motion: artShots.length } });
    console.log(JSON.stringify({ status: 'inputs_ready', unique_lyric_shots: uniqueLyricShots, performance_occurrences: shots.length, generated_source_files: sourceGroups.size, duration: t.duration, fps: t.fps, output_created: false }, null, 2));
    process.exit(0);
  }
  mkdirSync(finalDir, { recursive: true });
  const overlays = makeOverlays(t), ffArgs = ['-hide_banner', '-loglevel', 'warning', '-y'];
  for (const shot of visualShots) {
    if (shot.type === 'performance') { if (shot.source_in > 0) ffArgs.push('-ss', String(shot.source_in)); }
    else ffArgs.push('-loop', '1', '-framerate', String(t.fps));
    ffArgs.push('-i', shot.absolute_path);
  }
  const audioInputIndex = visualShots.length, overlayInputStart = audioInputIndex + 1;
  ffArgs.push('-i', mix);
  for (const overlay of overlays) ffArgs.push('-loop', '1', '-framerate', '1', '-i', overlay.path);
  const fit = `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
  const graph = [`[${audioInputIndex}:a:0]volume=${inputs.audio.gain_db}dB,apad=pad_dur=${Math.max(0, audioEndPadding)},asetpts=PTS-STARTPTS[fullaudio]`];
  visualShots.forEach((shot, i) => {
    if (shot.type === 'instrumental_art_motion') {
      const frames = Math.max(1, Math.round(shot.slot_duration * t.fps));
      const zoom = shot.motion === 'slow-pull' ? `1.04-0.04*min(on/${frames},1)` : `1+0.04*min(on/${frames},1)`;
      graph.push(`[${i}:v]${fit},zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${size.width}x${size.height}:fps=${t.fps},fps=100,trim=duration=${shot.slot_duration},setpts=PTS-STARTPTS[c${i}]`);
    } else if (shot.retime) appendRetime(graph, `${i}:v`, `c${i}`, shot.retime, fit, `rt${i}`);
    else graph.push(`[${i}:v]setpts=PTS-STARTPTS,${fit},fps=100,tpad=start_mode=clone:start_duration=${shot.start_frame_hold_seconds}:stop_mode=clone:stop_duration=${Math.max(.15, shot.end_frame_hold_seconds + .05)},trim=duration=${shot.slot_duration},setpts=PTS-STARTPTS[c${i}]`);
  });
  graph.push(`${visualShots.map((_, i) => `[c${i}]`).join('')}concat=n=${visualShots.length}:v=1:a=0,fps=${t.fps},tpad=stop_mode=clone:stop_duration=0.05,trim=duration=${t.duration},format=yuv420p[base]`);
  overlays.forEach((overlay, i) => {
    graph.push(`[${overlayInputStart + i}:v]scale=${size.width}:${size.height}[layer${i}]`);
    graph.push(`[${i ? `ov${i - 1}` : 'base'}][layer${i}]overlay=0:0:enable='gte(t,${overlay.start})*lt(t,${overlay.end})':format=auto[${i === overlays.length - 1 ? 'out' : `ov${i}`}]`);
  });
  ffArgs.push('-filter_complex_threads', '2', '-filter_complex', graph.join(';'), '-map', '[out]', '-map', '[fullaudio]', '-t', String(t.duration), '-r', String(t.fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', rendering);
  try { execFileSync(ffmpeg, ffArgs, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 5_000_000 }); }
  catch (error) { throw new Error(`FFmpeg合成失败：${String(error.stderr || error.message).slice(-12000)}`); }
  const info = probe(rendering), video = info.streams.find(stream => stream.codec_type === 'video'), audio = info.streams.find(stream => stream.codec_type === 'audio');
  const duration = Number(info.format.duration), frameCount = Number(video?.nb_frames), expectedFrames = Math.round(t.duration * t.fps);
  const checks = { four_unique_lyrics_with_real_new_performance: uniqueLyricShots === 4, at_least_two_unique_new_sources: sourceGroups.size >= 2,
    visual_timeline_covers_full_song: visualShots[0].slot_start === 0 && Math.abs(visualShots.at(-1).slot_end - t.duration) < 1e-6,
    dimensions: video?.width === size.width && video?.height === size.height, fps: video?.avg_frame_rate === `${t.fps}/1`,
    duration: Math.abs(duration - t.duration) <= 1 / t.fps + .005, frame_count: frameCount === expectedFrames,
    codecs: video?.codec_name === 'h264' && audio?.codec_name === 'aac', audio_format: audio?.sample_rate === '48000' && audio.channels === 2 };
  const passed = Object.values(checks).every(Boolean);
  if (passed) renameSync(rendering, target);
  const output = passed ? target : rendering;
  validatedFinalReport = { schema_version: 1, experiment_id: t.experiment_id, title: t.title, status: passed ? 'completed' : 'validation_failed', generated_at: new Date().toISOString(),
    output: relative(root, output).replaceAll('\\', '/'), sha256: hash(output), size_bytes: readFileSync(output).length, output_created: true,
    is_static_image_camera_preview: false, expected_duration: t.duration, total_duration: duration, video_frames: frameCount, expected_video_frames: expectedFrames,
    parameters: { ...size, fps: t.fps, video_codec: video.codec_name, audio_codec: audio.codec_name, audio_sample_rate: 48000, audio_channels: 2, audio_bitrate: 192000, crf: 19 },
    inputs, source_files: [...sourceGroups.values()], shots, visual_timeline: visualShots, audio: { ...inputs.audio, source_clip_audio_used: false },
    assembly: { intro_title_seconds: t.intro.duration, outro_title_seconds: t.outro.duration, source_clips: sourceGroups.size, unique_lyric_shots: uniqueLyricShots,
      performance_occurrences: shots.length, instrumental_art_motion: { segments: artShots.length, duration: Number(artShots.reduce((sum, shot) => sum + shot.slot_duration, 0).toFixed(6)), is_model_performance: false },
      generated_source_files: sourceGroups.size, original_generated_clip_audio_used: false, overlays: overlays.length },
    subtitles: plan.filter(item => item.type === 'performance').map(line => ({ id: line.id, line_id: line.line_id, text: line.text, start: line.heard_start, end: Math.min(line.end, line.heard_end + .15) })),
    checks, elapsed_ms: Date.now() - started, limitations: [
      '人物外貌、歌词和声音为AI娱乐演绎，不代表历史人物的真实相貌或言论。',
      `四句独立歌词来自本实验${sourceGroups.size}条真实新原片，共${shots.length}次演唱出现；同词重唱可复用原片同一区间，分段或复用不算额外生成任务。`,
      `器乐段${artShots.length}段使用原创图像与程序镜头运动，画面持续标注“原创图像 · 程序运镜”，不冒充视频模型人物表演。`,
      `统一音轨类型为${t.audio.kind}，来源：${t.audio.provider}；未自动将TTS编排描述成歌曲模型生成。`,
      '原音乐不裁切、不变速；若末尾不能落在完整视频帧上，只补不超过一帧静音，并在audio.alignment中记录。',
      `统一音轨仅调整恒定音量${inputs.audio.gain_db}dB，原始歌曲文件保持不变；s16时长计数不证明无削波，最终AAC电平需另行核验。`,
      '未宣称逐音素口型准确；原片QA状态及失败结果原样保留，需人工看片判断人物与口型自然度。',
      ...(shots.some(shot => shot.retime) ? ['部分镜头按已记录控制点调整画面速度；此修正不改变原始音轨QA，也不是口型通过证明。'] : []),
    ] };
  saveReport(validatedFinalReport);
  requireValue(passed, '成片参数检查未全部通过；未替换正式文件，详情见work/final-report.json。');
  console.log(JSON.stringify({ status: 'completed', output: target, duration, video_frames: frameCount, clips: shots.length, sha256: hash(target) }, null, 2));
} catch (error) {
  if (!validatedFinalReport) saveReport({ schema_version: 1, experiment_id: '002-moon-and-earth', status: 'blocked_or_failed', checked_at: new Date().toISOString(), error: error.message,
    output_created: existsSync(rendering), previous_final_preserved: existsSync(target), inputs, shots, elapsed_ms: Date.now() - started });
  console.error(`完整成片尚未生成：${error.message}`);
  process.exitCode = 2;
}
