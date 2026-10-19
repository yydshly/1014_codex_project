/** Publish only a real 004 film. No generation, uploads, network requests or old-experiment writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PERFORMANCE_EXPERIMENT, PERFORMANCE_SONG_SHA, validatePerformanceFilmReport } from '../../../web/performance-report.mjs';
import { summarizeBudgetLedger } from './budget-ledger.mjs';
import { sourceKind, validateCorrectedSource, validateCorrectedShotActors, has720pEquivalentSourceFrame, validateNativeFrameEvidence } from './source-provenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.resolve(root, '../../web/public');
const mode = process.argv[2];
assert(process.argv.length === 3 && ['--check', '--publish'].includes(mode), '用法：node scripts/publish-film.mjs --check|--publish');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const probeFile = file => JSON.parse(execFileSync(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
const local = value => {
  assert(typeof value === 'string' && value.trim(), '缺少004本地路径');
  const result = path.resolve(root, value), relative = path.relative(root, result);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), '004发布输入须在本实验目录内'); return result;
};
const read = async file => JSON.parse(await fs.readFile(local(file), 'utf8'));
const checkedBytes = async (file, expected) => {
  assert(/^[a-f0-9]{64}$/i.test(expected || ''), `${file}缺少固定SHA`);
  const bytes = await fs.readFile(local(file)); assert.equal(hash(bytes), expected, `${file}实际SHA不符`); return bytes;
};
const verifiedRecord = async (record, spec) => {
  assert(record?.path && record.sha256 && record.original_result, '缺少带SHA的真实来源记录');
  const document = JSON.parse(await checkedBytes(record.path, record.sha256));
  if (spec) assert.equal(local(spec.path), local(record.path), '来源记录路径不同');
  const actual = spec?.key ? document.clips?.[spec.key] ?? document.sources?.[spec.key] ?? document.shots?.find?.(item => item.id === spec.key) : document;
  assert(actual, '来源文件没有指定审查条目'); assert.deepEqual(actual, record.original_result, '完成报告中的审查内容与原文件不同');
  return actual;
};
const decodedDuration = file => {
  const pcm = execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-i', local(file), '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 's16le', 'pipe:1'], { maxBuffer: 8 * 1024 * 1024 });
  assert(pcm.length > 0 && pcm.length % 2 === 0, '口型驱动实际解码无效'); return pcm.length / 2 / 48000;
};
const realVideo = async (file, expected) => {
  const bytes = await checkedBytes(file, expected), probe = probeFile(local(file)), video = probe.streams.find(item => item.codec_type === 'video');
  const [n, d] = String(video?.avg_frame_rate).split('/').map(Number), fps = n / d;
  const frames = Number(video?.nb_read_frames || video?.nb_frames), duration = Number(video?.duration || probe.format.duration);
  assert(video && has720pEquivalentSourceFrame(video.width, video.height), '源视频像素面积/高度/画幅不符合真实HD底片');
  assert(fps >= 20 && fps <= 60 && Number.isSafeInteger(frames) && frames > 0 && Number.isFinite(duration) && Math.abs(frames / fps - duration) < .1, '源片真实帧率/帧数/时长无效');
  return { path: local(file), sha256: expected, bytes: bytes.length, frames, fps, duration, probe };
};
const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'absolute_path').map(([key, item]) => [key, strip(item)])) : value;
const frozenStage = {
  'history/003-jing-feng-shuang-stage-v3.mp4': '011c49f6527f84ca834ac319ad14bb97dd4a410b75a37729b00bf025382970d6',
  'history/003-stage-v3.png': '93f81dc4d6b4eb21c8c119e0825be461ce027325665da2122bc1ed5106e5cd49',
  'history/003-run.json': '145aaffd378e9af8b26fe472b3e9fa80568064c2cd7feb5a8f8db8fe9bfee8c8',
};
for (const [name, expected] of Object.entries(frozenStage)) assert.equal(hash(await fs.readFile(path.join(publicRoot, name))), expected, `003原字节归档变化：${name}`);
const [report, timeline, manifest] = await Promise.all(['work/final-report.json', 'work/timeline.json', 'work/film-manifest.json'].map(read));
assert.equal(report.experiment_id, PERFORMANCE_EXPERIMENT); assert.equal(report.status, 'completed', '004没有真实完成报告');
assert.equal(timeline.experiment_id, PERFORMANCE_EXPERIMENT); assert.equal(timeline.status, 'confirmed');
assert.equal(manifest.experiment_id, PERFORMANCE_EXPERIMENT); assert.equal(manifest.status, 'approved-for-render');
for (const field of ['source_hashes_matched', 'native_frame_counts_verified', 'no_001_003_video_reuse', 'motion_reviewed_for_all_sources', 'lyrics_reviewed_for_performance_sources', 'every_heard_lyric_covered_by_matching_performance', 'timeline_continuous', 'full_original_song_retained', 'tail_silence_within_one_frame', 'output_frame_count_matched', 'aac_float_samples_below_full_scale']) assert.equal(report.checks?.[field], true, `成片检查未通过：${field}`);
assert.equal(report.checks?.audio_correlation_used_as_visual_lipsync_evidence, false, '不能以音轨复制作为视觉口型证据');
assert.equal(report.checks?.precise_phoneme_lip_sync_claimed, false, '不能宣称自动逐音素口型认证');
for (const field of ['final_whole_film_review', 'final_whole_film_human_review']) if (report.checks?.[field] !== undefined) assert((field === 'final_whole_film_human_review' ? ['not_claimed', 'pending', true] : ['pending', true]).includes(report.checks[field]), `全片审看信息状态无效：${field}`);
for (const [field, value] of Object.entries(report.checks || {})) if (!['audio_correlation_used_as_visual_lipsync_evidence', 'precise_phoneme_lip_sync_claimed', 'final_whole_film_review', 'final_whole_film_human_review'].includes(field)) assert.equal(value, true, `存在未通过的实际检查：${field}`);
for (const [name, filename] of [['manifest', 'work/film-manifest.json'], ['timeline', 'work/timeline.json']]) assert.equal(hash(await fs.readFile(local(filename))), report.inputs?.[name]?.sha256, `${name}与完成报告不一致`);
const ledgerRecord = report.budget_ledger || report.inputs?.budget_ledger || report.inputs?.ledger;
const ledgerPath = ledgerRecord?.path || manifest.budget_ledger?.path || manifest.ledger?.path;
const ledgerBytes = await fs.readFile(local(ledgerPath)), ledger = JSON.parse(ledgerBytes);
assert.equal(ledger.experiment_id, PERFORMANCE_EXPERIMENT); assert.equal(ledger.credit_cap, 2400);
assert.equal(hash(ledgerBytes), ledgerRecord?.sha256, '预算账本与完成报告不一致');
assert.equal(local(ledgerPath), local(manifest.budget_ledger?.path || manifest.ledger?.path), '实际预算账本与获批manifest不同');
const budget = summarizeBudgetLedger(ledger), committed = budget.submittedVideoTasks;
const finalPath = typeof report.output === 'string' ? report.output : report.output?.path;
const finalSha = report.sha256 || report.output?.sha256, finalSize = report.size_bytes ?? report.output?.size_bytes;
const parameters = report.parameters || { width: report.assembly?.width, height: report.assembly?.height, fps: report.assembly?.fps };
const totalDuration = report.total_duration ?? report.assembly?.duration;
const videoFrames = report.video_frames ?? report.assembly?.frames;
const audio = { ...report.audio, duration: report.audio.duration ?? report.audio.decoded_duration,
  source_clip_audio_used: report.audio.source_clip_audio_used ?? (report.assembly?.original_source_audio_replaced_by_single_song === true ? false : undefined),
  alignment: { ...report.audio.alignment,
    original_audio_trimmed_seconds: report.audio.alignment?.original_audio_trimmed_seconds ?? (report.audio.alignment?.trim_start + report.audio.alignment?.trim_end),
    original_audio_speed: report.audio.alignment?.original_audio_speed ?? report.audio.alignment?.speed,
    padding_seconds: report.audio.alignment?.padding_seconds ?? report.audio.alignment?.padding_tail_seconds } };
assert.equal(audio.sha256, PERFORMANCE_SONG_SHA, '不是用户本轮提供的新完整歌曲');
assert.equal(hash(await fs.readFile(local(audio.path))), PERFORMANCE_SONG_SHA, '新歌实际字节变化');
const movie = await fs.readFile(local(finalPath));
assert.equal(hash(movie), finalSha); assert.equal(movie.length, finalSize); assert.equal(movie.toString('ascii', 4, 8), 'ftyp');
const oldHashes = new Set(Object.values(frozenStage));
for (const experiment of ['001-libai-dufu', '002-moon-and-earth']) {
  const folder = path.resolve(root, '..', experiment, 'clips');
  for (const name of await fs.readdir(folder)) if (name.endsWith('.mp4')) oldHashes.add(hash(await fs.readFile(path.join(folder, name))));
}
for (const name of ['001-three-line-demo.mp4', '001-full-four-line-demo.mp4', '002-jing-feng-shuang-v2.mp4']) oldHashes.add(hash(await fs.readFile(path.join(publicRoot, 'history', name))));
assert(!oldHashes.has(finalSha), '不能用旧成片冒充004');
const sources = report.source_files.map(source => ({ ...source, source_kind: sourceKind(source), source_experiment: source.source_experiment || source.source_exp, duration: source.duration ?? source.native_duration }));
assert(Array.isArray(sources) && sources.length > 0);
for (const source of sources) {
  assert.equal(source.source_experiment, PERFORMANCE_EXPERIMENT);
  const relativeSource = path.relative(root, local(source.path)).replaceAll('\\', '/');
  assert(/\.mp4$/i.test(source.path) && (relativeSource.startsWith('clips/') || (source.source_kind === 'audio_driven_lip_correction' && relativeSource.startsWith('work/'))), '原生成源须在004/clips，口型子源可在clips或work');
  assert(!oldHashes.has(source.sha256), '004不能沿用旧实验视频');
  const child = await realVideo(source.path, source.sha256);
  const task = committed.find(item => item.id === source.task_id);
  assert(task && task.status === 'downloaded', `原片未关联本轮已下载任务：${source.task_id}`);
  const taskHash = task.output?.sha256 || task.output_sha256;
  const taskBytes = task.output?.size_bytes;
  const taskPath = task.clip || (typeof task.output === 'string' ? task.output : task.output?.path);
  const references = task.references || (task.reference ? [{ path: task.reference, sha256: task.reference_sha256 }] : []);
  for (const reference of references) await checkedBytes(reference.path, reference.sha256);
  const driver = task.audio || task.reference_audio;
  if (driver) await checkedBytes(driver, task.audio_sha256 || references.find(item => local(item.path) === local(driver))?.sha256);
  assert(Math.abs(child.duration - source.duration) <= .05, '源视频实际时长与素材记录不同');
  assert.equal(child.frames, source.native_frames); assert.equal(child.fps, source.native_fps);
  source.native_video = { width: child.probe.streams.find(item => item.codec_type === 'video').width, height: child.probe.streams.find(item => item.codec_type === 'video').height, fps: child.fps, frames: child.frames, duration: child.duration };
  const manifestSource = manifest.sources?.find(item => item.id === source.id); assert(manifestSource, '完成报告中的源不在实际manifest内');
  assert.equal(local(manifestSource.path), local(source.path)); assert.equal(manifestSource.sha256, source.sha256); assert.equal(manifestSource.task_id, source.task_id); assert.equal(sourceKind(manifestSource), source.source_kind);
  assert.equal(Boolean(source.driver), Boolean(manifestSource.driver), '驱动是否存在与获批manifest不同');
  if (manifestSource.driver) {
    for (const [field, value] of Object.entries(manifestSource.driver)) {
      if (field === 'path') assert.equal(local(source.driver.path), local(value));
      else assert.deepEqual(source.driver[field], value, `驱动${field}与获批manifest不同`);
    }
    assert.equal(source.driver.gain_db, manifestSource.driver.gain_db ?? audio.gain_db);
    assert.equal(source.driver.song_sha256, PERFORMANCE_SONG_SHA);
  }
  const generalReview = await verifiedRecord(source.review_record, manifestSource.review);
  assert.equal(generalReview.source_sha256 || generalReview.video_sha256 || generalReview.sha256, source.sha256, '实际整体审查不是当前子视频');
  assert(generalReview.accepted_for_final === true && generalReview.motion_reviewed === true, '实际源尚未接受动态与成片观感');
  source.review = { ...generalReview, record_path: source.review_record.path, record_sha256: source.review_record.sha256 };
  if (source.source_kind === 'generated_video') {
    assert.equal(taskHash, source.sha256); assert.equal(taskBytes, child.bytes); assert.equal(local(taskPath), local(source.path));
    if (source.driver) {
      const rawQa = await verifiedRecord(source.raw_qa, manifestSource.qa);
      assert.equal(rawQa.source_sha256 || rawQa.video_sha256 || rawQa.sha256, source.sha256, '原生演唱QA不是当前原片');
      assert.equal(rawQa.native_audio_only, true, '原生演唱QA不得先换音轨');
      assert.equal(rawQa.reference_sha256 || rawQa.reference_audio_sha256 || rawQa.audio_sha256 || rawQa.ref_sha256, source.driver.sha256, '原生演唱QA的驱动来源不同');
    }
  } else {
    assert.equal(report.checks.local_correction_parent_child_hash_chain_verified, true);
    assert.equal(report.checks.corrected_sources_have_independent_visual_lipsync_approval, true);
    const parent = source.parent_source;
    assert(parent && !oldHashes.has(parent.sha256), '口型父源不能冒用旧实验视频');
    assert(path.relative(root, local(parent.path)).replaceAll('\\', '/').startsWith('clips/') && /\.mp4$/i.test(parent.path), '口型父源必须保留在004/clips');
    assert.equal(local(taskPath), local(parent.path), '原任务必须保留父视频路径');
    assert.equal(local(manifestSource.parent_source?.path), local(parent.path)); assert.equal(manifestSource.parent_source?.sha256, parent.sha256);
    assert.deepEqual(manifestSource.correction, source.correction, '口型处理声明与获批manifest不同');
    assert.deepEqual(parent.review, manifestSource.parent_source.review, '父源审查规格与获批manifest不同');
    assert.deepEqual(parent.qa, manifestSource.parent_source.qa, '父源原片QA规格与获批manifest不同');
    assert.deepEqual(source.lip_sync_review, manifestSource.lip_sync_review, '口型审查规格与获批manifest不同');
    assert.equal(local(source.processing_report?.path), local(manifestSource.correction.report.path)); assert.equal(source.processing_report?.sha256, manifestSource.correction.report.sha256);
    const actualParent = await realVideo(parent.path, parent.sha256);
    assert.equal(parent.bytes, actualParent.bytes); assert.equal(parent.native_frames, actualParent.frames); assert.equal(parent.native_fps, actualParent.fps); assert(Math.abs(parent.native_duration - actualParent.duration) < .0001);
    const parentReview = await verifiedRecord(parent.review_record, manifestSource.parent_source.review);
    if (parent.raw_qa) {
      const parentQa = await verifiedRecord(parent.raw_qa, parent.qa);
      assert.equal(parentQa.source_sha256 || parentQa.video_sha256 || parentQa.sha256, parent.sha256, '父视频原始QA与真实原片不同');
    }
    const processing = await verifiedRecord(source.processing_report);
    const visualQa = await verifiedRecord(source.lip_sync_qa, manifestSource.lip_sync_review);
    const weightsPath = processing.model?.weights_manifest_path, weightsSha = processing.model?.weights_manifest_sha256;
    await checkedBytes(weightsPath, weightsSha);
    const actualOutput = await realVideo(processing.output?.path, processing.output?.sha256);
    assert(source.driver && source.driver.source_song_sha256 === PERFORMANCE_SONG_SHA, '校正驱动缺少完整原歌SHA');
    await checkedBytes(source.driver.path, source.driver.sha256);
    assert(Math.abs(decodedDuration(source.driver.path) - source.driver.decoded_duration) <= 2 / 48000, '校正驱动解码时长不同');
    const evidence = [];
    for (const spec of visualQa.evidence || []) {
      assert(['native_frame_review', 'audio_event_review', 'independent_syncnet'].includes(spec.kind), '未知口型审查证据类型');
      const bytes = await checkedBytes(spec.path, spec.sha256);
      evidence.push({ kind: spec.kind, path: path.relative(root, local(spec.path)).replaceAll('\\', '/'), sha256: spec.sha256,
        ...(spec.kind === 'native_frame_review' ? { native_frame_data_verified: validateNativeFrameEvidence(JSON.parse(bytes), child, source.driver) } : {}) });
    }
    const provenance = validateCorrectedSource({ source, child,
      parent: { ...actualParent, task_id: parent.task_id, ledger_sha256: taskHash, ledger_bytes: taskBytes, review: parentReview },
      driver: { ...source.driver, path: local(source.driver.path) }, report: processing, visualQa,
      weights: { path: local(weightsPath), sha256: weightsSha }, reportedOutput: actualOutput, evidence, resolvePath: local });
    assert.deepEqual(strip(provenance), strip(source.provenance), '完成报告中的派生来源与发布时重新核对结果不同');
    assert.equal(source.copied_reference_audio_not_lipsync_evidence, true);
  }
}
for (const shot of report.visual_timeline) {
  const source = sources.find(item => item.sha256 === shot.sha256); assert(source, '镜头缺少实际源'); validateCorrectedShotActors(source, shot);
}
const posterPath = report.inputs?.poster?.path || manifest.poster?.path;
const poster = await fs.readFile(local(posterPath));
assert.equal(hash(poster), report.inputs?.poster?.sha256);
assert(poster.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), '新封面不是PNG');
const probe = probeFile(local(finalPath));
const video = probe.streams.find(item => item.codec_type === 'video'), sound = probe.streams.find(item => item.codec_type === 'audio');
const [num, den] = video.avg_frame_rate.split('/').map(Number), fps = num / den;
assert(video.width >= 1280 && video.height >= 720 && Number.isFinite(fps) && fps > 0 && video.codec_name === 'h264');
assert.equal(video.width, parameters.width); assert.equal(video.height, parameters.height); assert.equal(fps, parameters.fps);
assert.equal(Number(video.nb_read_frames || video.nb_frames), videoFrames); assert(Math.abs(Number(probe.format.duration) - totalDuration) <= 1 / fps + 1e-5);
assert(sound?.codec_name === 'aac' && sound.sample_rate === '48000' && sound.channels === 2);
const production = report.production || manifest.production;
assert(production && ['image_provider', 'voice_provider', 'video_provider', 'music_provider', 'music_title'].every(key => typeof production[key] === 'string' && production[key].trim()), '须由实际制作记录提供图片、声音、音乐与视频来源，不推测音乐模型');
const clips = report.clips.map(clip => ({ ...strip(clip), status: clip.status || 'completed', video_generated: clip.video_generated ?? true, qa: strip(clip.qa || { scope: '唱词与运动取舍，具体结果见带来源证据的审片记录', source_reviews: sources.filter(source => clip.occurrences.some(item => (item.source_sha256s || [item.source_sha256]).includes(source.sha256))).map(source => ({ sha256: source.sha256, ...source.review })) }) }));
const run = {
  schema_version: 1, title: report.title, generated_at: report.generated_at || report.completed_at, status: 'completed',
  provenance: { kind: 'locally-produced', project_id: '011', experiment_id: PERFORMANCE_EXPERIMENT },
  production: { ...strip(production), music_mode: 'user-supplied-song', total_duration: totalDuration },
  video_service: { provider: 'ChatArt', status: 'completed', created_tasks: committed.length },
  budget_ledger: { path: ledgerPath, sha256: hash(ledgerBytes), verified: true },
  cost: { provider: 'ChatArt', credit_cap: 2400, credits_committed: budget.submittedCredits,
    video_credits_committed: budget.videoCredits, image_credits_committed: budget.imageCredits,
    reserved_unconfirmed_credits: budget.reservedCredits, budget_exposure_credits: budget.exposureCredits,
    video_credits_estimate: budget.videoCredits, video_credits_spent: null, invoice_verified: false,
    note: '按submitted=true的图片与视频任务credits_committed累计，失败、重做和未采用任务均计入；未创建不计，未确认预留单列。承诺额度不是已核对消费，旧实验不计入本轮。' },
  clips, source_files: strip(sources), visual_timeline: strip(report.visual_timeline), audio: strip(audio),
  assembly: { ...strip(report.assembly), source_hashes_verified: true, final_hash_verified: true, unified_audio: true },
  assets: { video: { path: 'media/own-libai-dufu-v1.mp4', sha256: finalSha, size_bytes: movie.length, width: video.width, height: video.height, fps, video_codec: 'h264', audio_codec: 'aac' },
    poster: { path: 'media/own-poets-v1.png', sha256: hash(poster) } },
  limitations: strip(report.limitations),
};
assert(typeof run.title === 'string' && run.title.trim() && !Number.isNaN(Date.parse(run.generated_at)));
assert(Array.isArray(run.limitations) && run.limitations.length > 0);
validatePerformanceFilmReport(run);

if (mode === '--publish') {
  const nonce = `${process.pid}-${Date.now()}`, lock = local('work/.publish-film.lock');
  const guard = await fs.open(lock, 'wx'); await guard.close();
  const entries = [['media/own-libai-dufu-v1.mp4', movie], ['media/own-poets-v1.png', poster], ['data/own-sample-run.json', Buffer.from(JSON.stringify(run, null, 2) + '\n')]]
    .map(([name, bytes]) => ({ name, bytes, target: path.join(publicRoot, name), replaced: false }));
  let keepBackups = false;
  try {
    for (const entry of entries) {
      entry.temporary = `${entry.target}.${nonce}.next`; entry.backup = `${entry.target}.${nonce}.backup`;
      await fs.copyFile(entry.target, entry.backup); await fs.writeFile(entry.temporary, entry.bytes, { flag: 'wx' });
    }
    for (const entry of entries) { await fs.rename(entry.temporary, entry.target); entry.replaced = true; }
    await fs.writeFile(local('work/publish-report.json'), JSON.stringify({ status: 'published-local', at: new Date().toISOString(), experiment_id: PERFORMANCE_EXPERIMENT,
      video_sha256: finalSha, song_sha256: PERFORMANCE_SONG_SHA, ledger_sha256: hash(ledgerBytes), committed_credits: budget.submittedCredits,
      video_committed_credits: budget.videoCredits, image_committed_credits: budget.imageCredits, reserved_unconfirmed_credits: budget.reservedCredits,
      public_files: entries.map(entry => entry.name), deployed: false }, null, 2) + '\n');
  } catch (error) {
    const errors = [];
    for (const entry of entries.filter(item => item.replaced).reverse()) try { await fs.copyFile(entry.backup, entry.target); } catch (rollbackError) { errors.push(rollbackError); }
    if (errors.length) { keepBackups = true; throw new AggregateError([error, ...errors], '回滚未完成，备份已保留在原文件旁'); }
    throw error;
  } finally {
    for (const entry of entries) {
      if (entry.temporary) await fs.unlink(entry.temporary).catch(() => {});
      if (entry.backup && !keepBackups) await fs.unlink(entry.backup).catch(() => {});
    }
    await fs.unlink(lock).catch(() => {});
  }
}
console.log(JSON.stringify({ status: mode === '--publish' ? 'published-local' : 'ready', experiment_id: PERFORMANCE_EXPERIMENT,
  sha256: finalSha, source_clips: sources.length, committed_credits: budget.submittedCredits, reserved_unconfirmed_credits: budget.reservedCredits, duration: totalDuration,
  modified_public_files: mode === '--publish' ? 3 : 0, deployed: false }, null, 2));
