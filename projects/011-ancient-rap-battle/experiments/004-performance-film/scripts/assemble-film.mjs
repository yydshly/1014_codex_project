/**
 * 004 完整新歌 / 全动态视频合成入口。没有生成模型或付费调用。
 * 默认 --check 只读；--render 仅接受已审核的真实输入。缺片时不创建完成报告。
 *
 * node scripts/assemble-film.mjs [--check|--render|--describe] [--manifest work/film-manifest.json]
 *
 * manifest 最小契约（路径均相对004，数值单位秒）：
 * {schema_version:1, experiment_id:'004-performance-film', status:'approved-for-render',
 *  title:'压轴人间', fps:25, size:{width:1280,height:720}, duration:<ceil(decoded*25)/25>,
 *  audio:{path,sha256,gain_db,kind:'user-supplied-song',provider,
 *         full_song:true,trim_start:0,trim_end:0,speed:1,lyrics_confirmed_by_user:true},
 *  lyrics_reference:{path:'docs/full-song-lyrics.txt',sha256},
 *  ledger:{path:'work/chatart-tasks.json'},timeline:{path:'work/timeline.json',sha256},
 *  sources:[{id,task_id,path:'clips/<new>.mp4',sha256,model_label,
 *    review:{path:'work/visual-review.json',key:<id>},
 *    // review原件中accepted_for_final/motion_reviewed；唱词源另需lyrics_reviewed=true。
 *    driver:{path,sha256,song_in,song_out,pad_lead_seconds:0,pad_tail_seconds:0},
 *    qa:{path:'work/video-qa.json',key:<id>}}],
 *  // lyrics与visual_timeline置于status=confirmed的timeline中；以下为字段示意。
 *  lyrics:[{id,reference_line_index:1,actor:'李白',actor_ids:['libai'],text,start,end,heard_start,heard_end,color:'#D5EEE5'}],
 *  lyrics_review:{status:'reviewed-for-edit',expected_reference_lyrics:22,
 *    actual_confirmed_occurrences:<已确认可闻数>,reference_unconfirmed:[{reference_line_index,text,reason}]},
 *  visual_timeline:[{id,type:'performance'|'generated_scene',is_generated_video:true,
 *    source_id,slot_start,slot_end,source_in,source_out,actor_ids:['libai'],
 *    picture_advance_seconds:0}],
 *  poster:{path,sha256},output:'final/ya-zhou-ren-jian-film-v4.mp4'}
 *
 * source_in/out 为原始MP4绝对秒，不能自动拉伸；performance映射必须为
 * slot_start - driver.song_in + pad_lead_seconds + picture_advance_seconds。
 * 偏移默认0，非0须shift_review:{approved:true,reason:<人工理由>}；相关性不会自动批准偏移。
 * ledger.tasks取用源须submitted=true、status=downloaded和output{sha256,size_bytes}。
 * 图像和视频只按已提交credits_committed计承诺，失败/未采用任务仍计；独立预留不重计。
 * credits_displayed仅为界面报价，不是承诺或实扣；实际账单未知时保留null。
 * 一个歌词可跨多条真实performance镜头；歌词数组按听见顺序记录每次出现，包括重唱。
 * 参考词不等于全部唱出；缺少可闻窗的参考句须在lyrics_review登记，不捏造字幕时间。
 *
 * 本地口型派生源须显式source_kind:'audio_driven_lip_correction'，task_id仍为原底片任务；
 * parent_source:{task_id,path,sha256,review:{path,key}}匹配账本原MP4，不能改账本输出SHA。
 * correction:{processor:'MuseTalk',actor_ids:['libai'],report:{path,sha256}}固定真实推理报告；
 * lip_sync_review:{path,key}可指agent全原生帧/PTS+音频开闭事件证据审核；真实人工播放为可选路线。
 * 子path/sha256、driver与普通源相同字段，但qa.native_audio_only不再冒充视觉口型证据。
 * generated_video普通源/原生演唱分支保持原有要求；外部口型未通过时不允许合成。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { summarizeBudgetLedger } from './budget-ledger.mjs';
import { sourceKind, validateCorrectedSource, validateCorrectedShotActors, validateNativeFrameEvidence, has720pEquivalentSourceFrame } from './source-provenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = process.argv.slice(2), mode = cli.find(x => ['--check', '--render', '--describe'].includes(x)) || '--check';
assert(cli.every((x, i) => ['--check', '--render', '--describe', '--manifest'].includes(x) || cli[i - 1] === '--manifest'), '未知参数。');
assert(cli.filter(x => ['--check', '--render', '--describe'].includes(x)).length <= 1, '只允许一种运行方式。');
const manifestArg = cli.includes('--manifest') ? cli[cli.indexOf('--manifest') + 1] : 'work/film-manifest.json';
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg', ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const num = value => typeof value === 'number' && Number.isFinite(value);
const near = (a, b, epsilon = 1e-6) => Math.abs(a - b) <= epsilon;
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const local = value => {
  assert(typeof value === 'string' && value.trim(), '缺少本实验内的相对路径。');
  const file = path.resolve(root, value), relative = path.relative(root, file);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `素材必须在004目录内：${value}`);
  return file;
};
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checkedFile = (value, expected) => {
  const file = local(value); assert(fs.existsSync(file) && fs.statSync(file).isFile(), `缺少真实素材：${value}`);
  assert(/^[0-9a-f]{64}$/.test(expected || ''), `${value}缺少固定SHA256。`);
  assert(hash(file) === expected, `${value}SHA256与记录不符。`); return file;
};
const probe = file => JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
const run = (tool, args, options = {}) => {
  const r = spawnSync(tool, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  assert(r.status === 0, `${tool}失败：${r.error?.message || (r.stderr || '').slice(-4500)}`); return r.stdout;
};
const readRecord = spec => {
  assert(spec && typeof spec.key === 'string', '审核记录须给path和key。');
  const file = local(spec.path); assert(fs.existsSync(file), `缺少原始审核记录：${spec.path}`);
  const document = json(file), value = document.clips?.[spec.key] ?? document.sources?.[spec.key] ?? document.shots?.find?.(s => s.id === spec.key);
  assert(value, `${spec.path}缺少${spec.key}的真实记录。`);
  return { path: rel(file), sha256: hash(file), original_result: value };
};
const recordVideoHash = r => r.source_sha256 || r.video_sha256 || r.sha256;
const plain = text => text.replace(/[\s，。！？、；：,.!?;:“”「」『』]/g, '');
const canonicalLyricKey = line => JSON.stringify([line.actor, plain(line.text)]);
const fps = 25, width = 1280, height = 720, sampleRate = 48000;
const forbiddenAudioHashes = new Set([
  '91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8',
  '0c8580e73d360b26165aa1efef253d225f69d15e7fc02829f206dc78120939ec',
]);

function oldVideoHashes() {
  const hashes = new Set(), experiments = path.dirname(root);
  const walk = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.mp4$/i.test(entry.name)) hashes.add(hash(file));
    }
  };
  for (const entry of fs.readdirSync(experiments, { withFileTypes: true })) {
    if (entry.isDirectory() && /^00[1-3]-/.test(entry.name)) {
      walk(path.join(experiments, entry.name, 'clips')); walk(path.join(experiments, entry.name, 'final'));
    }
  }
  return hashes;
}

function decodeAudio(file, gainDb) {
  const pcm = execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:a:0', '-af', `volume=${gainDb}dB`, '-ar', String(sampleRate), '-ac', '2', '-f', 'f32le', 'pipe:1'], { maxBuffer: 512 * 1024 * 1024 });
  assert(pcm.length % 8 === 0 && pcm.length > 0, '音轨解码长度无效。');
  let peak = 0, over = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const value = pcm.readFloatLE(i); assert(Number.isFinite(value), '音轨含非有限采样。');
    peak = Math.max(peak, Math.abs(value)); if (Math.abs(value) >= 1) over++;
  }
  return { frames: pcm.length / 8, duration: pcm.length / 8 / sampleRate, peak_linear: peak, peak_dbfs: peak ? 20 * Math.log10(peak) : null, samples_abs_ge_1: over, sample_rate: sampleRate, channels: 2, oversampled_true_peak_measured: false };
}

function checkedVideo(file, id) {
  const p = probe(file), v = p.streams.find(x => x.codec_type === 'video');
  const frames = Number(v?.nb_read_frames || v?.nb_frames), duration = Number(v?.duration || p.format.duration);
  const rate = String(v?.avg_frame_rate || '').split('/').map(Number), fps = rate[0] / rate[1];
  assert(v && has720pEquivalentSourceFrame(v.width, v.height) && Number.isInteger(frames) && frames >= 80 && num(duration) && duration > 0, `${id}缺少真实视频帧或原生像素面积/高度不足720p。`);
  assert(fps >= 20 && fps <= 60 && Math.abs(frames / fps - duration) < .1, `${id}真实帧数/帧率/时长不一致。`);
  return { path: file, sha256: hash(file), bytes: fs.statSync(file).size, frames, duration, fps, probe: p };
}

function validate() {
  const manifestFile = local(manifestArg); assert(fs.existsSync(manifestFile), `尚无真实审核后的manifest：${manifestArg}；没有生成报告。`);
  const manifest = json(manifestFile);
  const timelineFile = checkedFile(manifest.timeline?.path, manifest.timeline?.sha256), timeline = json(timelineFile);
  assert(timeline.schema_version === 1 && timeline.experiment_id === '004-performance-film' && timeline.status === 'confirmed', '只接受人工确认编辑的正式timeline，不读候选或ASR草稿。');
  const m = { ...manifest, fps: timeline.fps, size: timeline.size, duration: timeline.duration, lyrics: timeline.lyrics, lyrics_review: timeline.lyrics_review, visual_timeline: timeline.visual_timeline };
  assert(m.schema_version === 1 && m.experiment_id === '004-performance-film', '004 manifest版本不匹配。');
  assert(m.status === 'approved-for-render', '仅可检查/渲染approved-for-render的真实清单；草案不能冒充成片。');
  assert(m.fps === fps && m.size?.width === width && m.size?.height === height, '本轮输出固定1280×720/25fps。');
  assert(typeof m.title === 'string' && m.title.trim(), '缺少片名。');
  assert(m.audio?.full_song === true && m.audio.trim_start === 0 && m.audio.trim_end === 0 && m.audio.speed === 1, '本轮须完整保留新歌，不裁切或变速。');
  assert(m.audio.lyrics_confirmed_by_user === true, '缺少用户确认歌词记录。');
  assert(num(m.audio.gain_db) && m.audio.gain_db >= -12 && m.audio.gain_db <= 0, 'audio.gain_db必须显式设为[-12,0]的恒定增益。');
  assert(typeof m.audio.provider === 'string' && m.audio.provider.trim() && m.audio.kind === 'user-supplied-song', '须记录用户供歌及实际来源，不能猜测模型。');
  const audioFile = checkedFile(m.audio.path, m.audio.sha256); assert(!forbiddenAudioHashes.has(m.audio.sha256), '不能沿用旧歌或38.24秒重剪。');
  assert(m.audio.sha256 === 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0', '004当前音轨须为已导入的《压轴人间》原文件。');
  const levels = decodeAudio(audioFile, m.audio.gain_db), duration = Math.ceil((levels.duration - 1e-9) * fps) / fps;
  assert(levels.duration > 60 && levels.duration <= 180, '新完整歌曲解码长度不在本轮60–180秒范围。');
  assert(near(m.duration, duration), `duration须按完整解码音轨向上对齐一帧：${duration}秒。`);
  assert(duration - levels.duration >= -1e-6 && duration - levels.duration < 1 / fps + 1e-6, '末尾静音padding超过一帧。');
  assert(levels.samples_abs_ge_1 === 0, '恒定增益后float采样触限；停止，不自动归一化或压缩。');
  const lyricsFile = checkedFile(m.lyrics_reference?.path, m.lyrics_reference?.sha256);
  const expectedLyrics = fs.readFileSync(lyricsFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !/^\[.*\]$/.test(s));
  assert(Array.isArray(m.lyrics) && m.lyrics.length > 0, '须录入实际确认可闻的歌词，不能从参考词捏造时间。');
  assert(m.lyrics_review?.status === 'reviewed-for-edit' && m.lyrics_review.expected_reference_lyrics === expectedLyrics.length && m.lyrics_review.actual_confirmed_occurrences === m.lyrics.length && Array.isArray(m.lyrics_review.reference_unconfirmed), '须区分参考歌词数、确认可闻数和可能漏唱的参考句。');
  let previous = 0;
  for (const [index, line] of m.lyrics.entries()) {
    assert(typeof line.id === 'string' && /^[a-z0-9_-]+$/i.test(line.id), '歌词id仅可含字母、数字、下划线、连字符。');
    assert(typeof line.actor === 'string' && line.actor.trim() && Array.isArray(line.actor_ids) && line.actor_ids.length > 0 && line.actor_ids.every(a => ['libai', 'dufu'].includes(a)), `${line.id}缺少角色。`);
    assert(Number.isInteger(line.reference_line_index) && line.reference_line_index > 0 && line.reference_line_index <= expectedLyrics.length, `${line.id}须指出参考词中的1基行号。`);
    const referenceText = expectedLyrics[line.reference_line_index - 1];
    assert(plain(line.text || '') === plain(referenceText) || (line.lyric_variant_review?.approved === true && typeof line.lyric_variant_review.reason === 'string' && line.lyric_variant_review.reason.trim()), `${line.id}与参考词不同须保留人工听音理由，ASR不能自行改词。`);
    assert([line.start, line.end, line.heard_start, line.heard_end].every(num) && line.start >= previous - 1e-6 && line.start <= line.heard_start && line.heard_start < line.heard_end && line.heard_end <= line.end && line.end <= duration, `${line.id}字幕/可听时段非法或乱序。`);
    assert(line.color === undefined || /^#[a-f0-9]{6}$/i.test(line.color), '歌词颜色须为六位HEX。'); previous = line.heard_start;
  }
  assert(new Set(m.lyrics.map(l => l.id)).size === m.lyrics.length, '歌词id不得重复。');
  const confirmedReference = new Set(m.lyrics.map(l => l.reference_line_index));
  for (const [index, value] of expectedLyrics.entries()) {
    if (confirmedReference.has(index + 1)) continue;
    const issue = m.lyrics_review.reference_unconfirmed.find(x => x.reference_line_index === index + 1);
    assert(issue && plain(issue.text || '') === plain(value) && ['reference_unconfirmed', 'possibly_omitted'].includes(issue.status) && typeof issue.reason === 'string' && issue.reason.trim(), `参考第${index + 1}句缺少可闻记录，须诚实登记待确认/可能漏唱，不补字幕。`);
  }
  const ledgerFile = local(m.ledger?.path), ledger = json(ledgerFile);
  assert(ledger.experiment_id === m.experiment_id && ledger.credit_cap === 2400 && ledger.authorization?.source === 'direct-human-user', '缺少本轮2400钻授权账本。');
  assert(ledger.music_source?.sha256 === m.audio.sha256 && ledger.music_source.full_song_required === true, '账本指向的歌曲与完整新音轨不符。');
  assert(Array.isArray(ledger.tasks) && ledger.tasks.length > 0, '账本没有真实生成任务。');
  const budget = summarizeBudgetLedger(ledger), committed = budget.submittedCredits;
  const forbidden = oldVideoHashes(), sources = [];
  assert(Array.isArray(m.sources) && m.sources.length > 0 && new Set(m.sources.map(s => s.id)).size === m.sources.length, '须提供id唯一的新视频sources。');
  for (const s of m.sources) {
    const kind = sourceKind(s);
    const file = checkedFile(s.path, s.sha256);
    assert(/\.mp4$/i.test(file) && (rel(file).startsWith('clips/') || (kind === 'audio_driven_lip_correction' && rel(file).startsWith('work/'))), '原生成源须位于004/clips；本地口型子源可位于004/clips或work。');
    assert(!forbidden.has(s.sha256), `${s.id}与001–003旧MP4相同，不能冒充新动态视频。`);
    const task = budget.submittedVideoTasks.find(t => t.id === s.task_id); assert(task && task.status === 'downloaded', `${s.id}缺少已提交且下载的真实视频任务。`);
    if (kind === 'generated_video') assert(task.output?.sha256 === s.sha256 && task.output.size_bytes === fs.statSync(file).size, `${s.id}原片SHA/字节与账本不一致。`);
    assert(typeof s.model_label === 'string' && s.model_label.trim(), `${s.id}须保留模型网页标签。`);
    const child = checkedVideo(file, s.id), { probe: p, frames, duration: nativeDuration, fps: nativeFps } = child;
    const review = readRecord(s.review); assert(recordVideoHash(review.original_result) === s.sha256, `${s.id}人工审片SHA不符。`);
    assert(review.original_result.accepted_for_final === true && review.original_result.motion_reviewed === true, `${s.id}尚未接受真实动态与成片观感。`);
    let driver = null, rawQa = null, parentSource = null, processingReport = null, lipSyncQa = null, provenance = null;
    if (s.driver) {
      const d = s.driver, driverFile = checkedFile(d.path, d.sha256);
      assert([d.song_in, d.song_out, d.pad_lead_seconds ?? 0, d.pad_tail_seconds ?? 0].every(num) && d.song_in >= 0 && d.song_out > d.song_in && d.song_out <= levels.duration && (d.pad_lead_seconds || 0) >= 0 && (d.pad_tail_seconds || 0) >= 0, `${s.id}驱动歌曲映射非法。`);
      const decoded = decodeAudio(driverFile, 0), wanted = d.song_out - d.song_in + (d.pad_lead_seconds || 0) + (d.pad_tail_seconds || 0);
      assert(near(decoded.duration, wanted, 2 / sampleRate), `${s.id}驱动真实长度与声明的全歌区间不符。`);
      assert(decoded.duration >= 4 && decoded.duration <= 15 + 2 / sampleRate, `${s.id}驱动必须符合本轮4–15秒UI长度。`);
      assert(review.original_result.lyrics_reviewed === true, `${s.id}唱词源缺少逐句人工审听。`);
      if (kind === 'generated_video') {
        rawQa = readRecord(s.qa); assert(recordVideoHash(rawQa.original_result) === s.sha256, `${s.id}原片音轨QA SHA不符。`);
        assert(rawQa.original_result.native_audio_only === true, `${s.id}须保留原片原生音轨QA，不能用配回音乐替代。`);
        const qaDriver = rawQa.original_result.reference_sha256 || rawQa.original_result.reference_audio_sha256 || rawQa.original_result.audio_sha256 || rawQa.original_result.ref_sha256;
        assert(qaDriver === d.sha256, `${s.id}原片QA的参考驱动SHA不符。`);
      }
      driver = { ...d, gain_db: d.gain_db ?? m.audio.gain_db, decoded_duration: decoded.duration, song_sha256: m.audio.sha256 };
    }
    if (kind === 'audio_driven_lip_correction') {
      assert(driver && s.parent_source && s.correction?.report, `${s.id}缺少口型驱动、父源或实际处理报告。`);
      assert(driver.source_song_sha256 === m.audio.sha256, `${s.id}校正驱动须显式保留当前原歌SHA。`);
      const parentFile = checkedFile(s.parent_source.path, s.parent_source.sha256);
      assert(rel(parentFile).startsWith('clips/') && /\.mp4$/i.test(parentFile) && !forbidden.has(s.parent_source.sha256), `${s.id}父源必须是004真实新生成MP4。`);
      const parent = checkedVideo(parentFile, `${s.id}父源`), parentReview = readRecord(s.parent_source.review);
      const reportFile = checkedFile(s.correction.report.path, s.correction.report.sha256), report = json(reportFile);
      const weightsFile = checkedFile(report.model?.weights_manifest_path, report.model?.weights_manifest_sha256);
      const reportedOutputFile = checkedFile(report.output?.path, report.output?.sha256);
      lipSyncQa = readRecord(s.lip_sync_review);
      const visualEvidence = (lipSyncQa.original_result.evidence || []).map(spec => {
        assert(['native_frame_review', 'audio_event_review', 'independent_syncnet'].includes(spec.kind), `${s.id}未知视觉证据种类。`);
        const evidenceFile = checkedFile(spec.path, spec.sha256);
        return { kind: spec.kind, path: rel(evidenceFile), sha256: hash(evidenceFile), ...(spec.kind === 'native_frame_review' ? { native_frame_data_verified: validateNativeFrameEvidence(json(evidenceFile), child, driver) } : {}) };
      });
      provenance = validateCorrectedSource({ source: s, child,
        parent: { ...parent, task_id: s.parent_source.task_id, ledger_sha256: task.output?.sha256, ledger_bytes: task.output?.size_bytes, review: parentReview.original_result },
        driver: { ...driver, path: local(driver.path) }, report, visualQa: lipSyncQa.original_result,
        weights: { path: weightsFile, sha256: hash(weightsFile) }, reportedOutput: { ...child, path: reportedOutputFile, sha256: hash(reportedOutputFile) }, evidence: visualEvidence, resolvePath: local });
      lipSyncQa.verified_evidence = visualEvidence;
      let parentRawQa = null;
      if (s.parent_source.qa) {
        parentRawQa = readRecord(s.parent_source.qa);
        assert(recordVideoHash(parentRawQa.original_result) === parent.sha256, `${s.id}父源原始QA SHA不符。`);
      }
      parentSource = { ...s.parent_source, path: rel(parentFile), bytes: parent.bytes, probe: parent.probe, native_frames: parent.frames, native_fps: parent.fps, native_duration: parent.duration, review_record: parentReview, raw_qa: parentRawQa };
      processingReport = { path: rel(reportFile), sha256: hash(reportFile), original_result: report };
    }
    sources.push({ ...s, source_kind: kind, path: rel(file), file, source_exp: '004-performance-film', is_generated_video: true, probe: p, native_frames: frames, native_fps: nativeFps, native_duration: nativeDuration, driver, review: { ...review.original_result, record_path: review.path, record_sha256: review.sha256 }, review_record: review, raw_qa: rawQa,
      ...(kind === 'audio_driven_lip_correction' ? { parent_source: parentSource, processing_report: processingReport, lip_sync_qa: lipSyncQa, provenance, copied_reference_audio_not_lipsync_evidence: true } : {}) });
  }
  let cursor = 0; const sourceById = new Map(sources.map(s => [s.id, s]));
  assert(Array.isArray(m.visual_timeline) && m.visual_timeline.length > 0, '缺少整曲动态镜头时间表。');
  assert(new Set(m.visual_timeline.map(s => s.id)).size === m.visual_timeline.length, '镜头id不得重复。');
  const visuals = m.visual_timeline.map(s => {
    assert(/^[a-z0-9_-]+$/i.test(s.id) && ['performance', 'generated_scene'].includes(s.type) && s.is_generated_video === true, `${s.id}只能使用真实生成的performance/generated_scene。`);
    assert([s.slot_start, s.slot_end, s.source_in, s.source_out].every(num) && near(s.slot_start, cursor) && s.slot_end > s.slot_start && s.source_in >= 0 && s.source_out > s.source_in, `${s.id}必须连续覆盖且源区间有效。`);
    assert([s.slot_start, s.slot_end].every(t => near(t * fps, Math.round(t * fps))), `${s.id}切口须精确位于25fps帧界。`);
    const source = sourceById.get(s.source_id); assert(source, `${s.id}引用了未知源。`);
    assert(near(s.source_out - s.source_in, s.slot_end - s.slot_start), `${s.id}禁止隐式变速或循环。`);
    const hold = Math.max(0, s.source_out - source.native_duration); assert(hold <= 1 / fps + 1e-6, `${s.id}超出真实视频长度，不能长定格补片。`);
    assert(s.source_in < source.native_duration - 1 / fps, `${s.id}没有足够真实帧。`);
    if (s.type === 'performance') {
      validateCorrectedShotActors(source, s);
      assert(source.driver && Array.isArray(s.actor_ids) && s.actor_ids.length, `${s.id}表演镜头缺少驱动/演员映射。`);
      const advance = s.picture_advance_seconds ?? 0;
      assert(num(advance) && Math.abs(advance) <= .5, `${s.id}画面偏移无效。`);
      assert(advance === 0 || (s.shift_review?.approved === true && typeof s.shift_review.reason === 'string' && s.shift_review.reason.trim()), `${s.id}非零偏移须明确人工理由，不接受自动QA移位。`);
      assert(near(s.source_in, s.slot_start - source.driver.song_in + (source.driver.pad_lead_seconds || 0) + advance, 1 / sampleRate), `${s.id}画面源局部秒与歌曲驱动不对应。`);
    }
    cursor = s.slot_end;
    return { ...s, start: s.slot_start, end: s.slot_end, task_id: source.task_id, path: source.path, sha256: source.sha256, native_frames: source.native_frames, rounding_hold_seconds: hold };
  });
  assert(near(cursor, duration), '全部动态镜头须覆盖完整原歌及≤1帧尾补，不能有空洞。');
  for (const line of m.lyrics) {
    let covered = line.heard_start;
    for (const shot of visuals.filter(s => s.slot_end > line.heard_start && s.slot_start < line.heard_end)) {
      assert(shot.type === 'performance' && line.actor_ids.every(a => shot.actor_ids.includes(a)), `${line.id}可听唱词被非对应演员表演遮替。`);
      assert(shot.slot_start <= covered + 1e-6, `${line.id}演唱镜头覆盖有空洞。`); covered = shot.slot_end;
    }
    assert(covered >= line.heard_end - 1e-6, `${line.id}没有真实动态主唱覆盖到末字。`);
  }
  const poster = m.poster ? { ...m.poster, path: rel(checkedFile(m.poster.path, m.poster.sha256)) } : null;
  const output = local(m.output || 'final/ya-zhou-ren-jian-film-v4.mp4'); assert(rel(output).startsWith('final/') && /\.mp4$/i.test(output), '输出须在004/final内。');
  return { m, manifestFile, timelineFile, audioFile, levels, duration, sources, visuals, ledger, ledgerFile, budget, committed, poster, output };
}

function assText(s) { return s.replaceAll('\\', '＼').replaceAll('{', '（').replaceAll('}', '）').replaceAll('\n', '\\N'); }
function assTime(s) {
  const t = Math.round(s * 100); return `${Math.floor(t / 360000)}:${String(Math.floor(t / 6000) % 60).padStart(2, '0')}:${String(Math.floor(t / 100) % 60).padStart(2, '0')}.${String(t % 100).padStart(2, '0')}`;
}
function makeSubtitles(m) {
  let text = '[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Lyric,Microsoft YaHei,35,&H00F5F7F7,&H000000FF,&HBD080B10,&H00000000,-1,0,0,0,100,100,1,0,1,2,1,2,35,35,34,1\nStyle: Small,Microsoft YaHei,15,&H30F0EBDD,&H000000FF,&HAD080B10,&H00000000,0,0,0,0,100,100,0,0,1,1,0,9,26,26,22,1\nStyle: Title,Microsoft YaHei,48,&H00B4DDF2,&H000000FF,&HAD080B10,&H00000000,-1,0,0,0,100,100,3,0,1,2,1,8,30,30,70,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n';
  const event = (start, end, style, value) => `Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,0,,${value}\n`;
  text += event(0, m.duration, 'Small', 'AI 原创演绎');
  if (m.lyrics[0].start > .4) text += event(.4, Math.min(3.6, m.lyrics[0].start), 'Title', assText(m.title));
  for (const l of m.lyrics) {
    const c = (l.color || (l.actor_ids.includes('libai') ? '#D5EEE5' : '#E8C497')).slice(1), bgr = c.slice(4) + c.slice(2, 4) + c.slice(0, 2);
    text += event(l.start, l.end, 'Lyric', `{\\c&H${bgr}&}${assText(l.text)}`);
  }
  return text;
}

function render(c) {
  const started = Date.now(), work = local('work/render-film'), final = path.dirname(c.output);
  assert(!fs.existsSync(c.output), '最终MP4已存在；保留已有结果，请在manifest选择新的输出名后重渲染。');
  const reportFile = local('work/final-report.json'); assert(!fs.existsSync(reportFile), '完成报告已存在，拒绝覆盖。');
  fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(final, { recursive: true });
  const ass = path.join(work, 'film.ass'); fs.writeFileSync(ass, makeSubtitles(c.m));
  const pieces = [];
  for (const [i, s] of c.visuals.entries()) {
    const source = c.sources.find(x => x.id === s.source_id), piece = path.join(work, `shot-${String(i).padStart(3, '0')}-${s.id}.mp4`), frames = Math.round((s.slot_end - s.slot_start) * fps);
    // 最多0.04s尾部重复仅用于源帧率转换的舍入；不足整段会在输入验证时拒绝。
    run(ffmpeg, ['-v', 'error', '-y', '-i', source.file, '-an', '-vf', `trim=start=${s.source_in}:end=${s.source_out},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},tpad=stop_mode=clone:stop_duration=0.04,trim=end_frame=${frames}`, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', piece]);
    const p = probe(piece), v = p.streams.find(x => x.codec_type === 'video'); assert(Number(v.nb_read_frames) === frames, `${s.id}实际输出帧数不足，停止。`); pieces.push(piece);
  }
  const list = path.join(work, 'concat.txt'); fs.writeFileSync(list, pieces.map(p => `file '${p.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n') + '\n');
  const temporary = c.output.replace(/\.mp4$/i, '.rendering.mp4');
  run(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', c.audioFile, '-filter_complex', `[0:v]ass=filename=film.ass[v];[1:a]volume=${c.m.audio.gain_db}dB,aresample=${sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_len=${Math.round(c.duration * sampleRate)},atrim=end_sample=${Math.round(c.duration * sampleRate)},asetpts=PTS-STARTPTS[a]`, '-map', '[v]', '-map', '[a]', '-frames:v', String(Math.round(c.duration * fps)), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', String(sampleRate), '-ac', '2', '-movflags', '+faststart', '-metadata', `title=${c.m.title}`, temporary], { cwd: work });
  const p = probe(temporary), video = p.streams.find(x => x.codec_type === 'video'), audio = p.streams.find(x => x.codec_type === 'audio'), frames = Number(video.nb_read_frames);
  assert(video.width === width && video.height === height && video.avg_frame_rate === '25/1' && frames === Math.round(c.duration * fps), '成片视频尺寸/帧率/帧数不符。');
  assert(audio?.sample_rate === String(sampleRate) && audio.channels === 2 && Math.abs(Number(p.format.duration) - c.duration) < 1 / fps, '成片音轨规格/时长不符。');
  const encodedLevels = decodeAudio(temporary, 0); assert(encodedLevels.samples_abs_ge_1 === 0, 'AAC解码后float触限；保留rendering文件供核查，不自动压缩或归一化。');
  fs.renameSync(temporary, c.output);
  const report = {
    schema_version: 1, experiment_id: c.m.experiment_id, status: 'completed', title: c.m.title, completed_at: new Date().toISOString(),
    output: { path: rel(c.output), sha256: hash(c.output), size_bytes: fs.statSync(c.output).size, probe: p },
    inputs: { manifest: { path: rel(c.manifestFile), sha256: hash(c.manifestFile) }, timeline: { path: rel(c.timelineFile), sha256: hash(c.timelineFile) }, audio: { ...c.m.audio }, poster: c.poster, lyrics_reference: c.m.lyrics_reference, ledger: { path: rel(c.ledgerFile), sha256: hash(c.ledgerFile) }, budget_ledger: { path: rel(c.ledgerFile), sha256: hash(c.ledgerFile) }, processing_reports: c.sources.filter(s => s.processing_report).map(s => ({ path: s.processing_report.path, sha256: s.processing_report.sha256 })) },
    audio: { ...c.m.audio, decoded_duration: c.levels.duration, decoded_sample_frames: c.levels.frames, sample_rate: sampleRate, channels: 2, source_song_sha256: c.m.audio.sha256, alignment: { output_duration: c.duration, trim_start: 0, trim_end: 0, speed: 1, padding_tail_seconds: c.duration - c.levels.duration, gain_db: c.m.audio.gain_db, gain_kind: 'constant-only' }, preencode_float_levels: c.levels, encoded_float_levels: encodedLevels, additions: [], note: '完整用户歌曲，仅恒定音量调整及不足一帧末尾静音补齐；无剪歌、变速、归一化或额外旋律。' },
    source_files: c.sources.map(({ file, ...s }) => s), visual_timeline: c.visuals, lyric_lines: c.m.lyrics, lyrics_review: c.m.lyrics_review, production: c.m.production || null,
    clips: c.m.lyrics.map(line => {
      const matches = c.visuals.filter(s => s.slot_end > line.heard_start && s.slot_start < line.heard_end), hashes = [...new Set(matches.map(s => s.sha256))];
      return { id: line.id, canonical_key: canonicalLyricKey(line), actor: line.actor, actor_ids: line.actor_ids, text: line.text, start: line.start, end: line.end, occurrences: [{ id: line.id, start: line.start, end: line.end, heard_start: line.heard_start, heard_end: line.heard_end, source_sha256: hashes[0], source_sha256s: hashes, shot_ids: matches.map(s => s.id) }] };
    }),
    assembly: { duration: c.duration, fps, width, height, frames, full_dynamic_coverage: true, old_video_reuse: false, image_motion_seconds: 0, static_placeholder_seconds: 0, static_image_coverage_seconds: 0, generated_video_duration: c.duration, source_clips: c.sources.length, unique_generated_parent_tasks: new Set(c.sources.map(s => s.task_id)).size, local_lip_corrected_sources: c.sources.filter(s => s.source_kind === 'audio_driven_lip_correction').length, shot_count: c.visuals.length, lyric_occurrences: c.m.lyrics.length, unique_lyric_shots: new Set(c.m.lyrics.map(canonicalLyricKey)).size, performance_occurrences: c.m.lyrics.length, performance_seconds: c.visuals.filter(s => s.type === 'performance').reduce((a, s) => a + s.slot_end - s.slot_start, 0), performance_duration: c.visuals.filter(s => s.type === 'performance').reduce((a, s) => a + s.slot_end - s.slot_start, 0), generated_scene_seconds: c.visuals.filter(s => s.type === 'generated_scene').reduce((a, s) => a + s.slot_end - s.slot_start, 0), generated_scene_duration: c.visuals.filter(s => s.type === 'generated_scene').reduce((a, s) => a + s.slot_end - s.slot_start, 0), original_source_audio_replaced_by_single_song: true, elapsed_seconds: (Date.now() - started) / 1000 },
    cost: { ledger_path: rel(c.ledgerFile), ledger_sha256: hash(c.ledgerFile), credit_cap: 2400, committed_credits: c.committed, videoCredits: c.budget.videoCredits, imageCredits: c.budget.imageCredits, reservedCredits: c.budget.reservedCredits, exposureCredits: c.budget.exposureCredits, actual_credits_spent: c.ledger.actual_credits_spent ?? null, invoice_verified: c.ledger.invoice_verified === true, note: '仅已提交图像与视频的credits_committed计承诺，失败和未采用任务仍计；未确认预留独立列出一次，界面报价不计承诺。承诺与预留不是实际消费，实扣以独立账单证据为准。' },
    checks: { source_hashes_matched: true, native_frame_counts_verified: true, no_001_003_video_reuse: true, motion_reviewed_for_all_sources: true, lyrics_reviewed_for_performance_sources: true, local_correction_parent_child_hash_chain_verified: true, corrected_sources_have_independent_visual_lipsync_approval: true, audio_correlation_used_as_visual_lipsync_evidence: false, every_heard_lyric_covered_by_matching_performance: true, timeline_continuous: true, full_original_song_retained: true, tail_silence_within_one_frame: true, output_frame_count_matched: true, aac_float_samples_below_full_scale: true, final_whole_film_review: 'pending', final_whole_film_human_review: 'not_claimed', final_review_may_be_agent: true, precise_phoneme_lip_sync_claimed: false },
    limitations: ['AI原创娱乐演绎，人物为虚构艺术形象。', '原片音轨筛查与视觉审查不等同逐音素口型准确；完整成片仍须整体与切口复核，未声称人类已看片。', '模型名称来自任务网页标签；音乐生成平台以用户说明记录。'],
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, output: report.output.path, sha256: report.output.sha256, size_bytes: report.output.size_bytes, duration: c.duration, frames, report: rel(reportFile) }, null, 2));
}

try {
  if (mode === '--describe') {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0] + '*/');
  } else {
    const c = validate();
    if (mode === '--render') render(c);
    else console.log(JSON.stringify({ status: 'inputs_checked_no_output_written', duration: c.duration, frames: Math.round(c.duration * fps), source_videos: c.sources.length, visual_shots: c.visuals.length, lyric_occurrences: c.m.lyrics.length, committed_credits: c.committed, videoCredits: c.budget.videoCredits, imageCredits: c.budget.imageCredits, reservedCredits: c.budget.reservedCredits, exposureCredits: c.budget.exposureCredits, audio_gain_db: c.m.audio.gain_db }, null, 2));
  }
} catch (error) {
  console.error(`004合成未完成：${error.message}`); process.exitCode = 1;
}
