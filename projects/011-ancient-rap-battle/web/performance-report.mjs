// Public, side-effect-free contract for 004. Media bytes and ledger are checked by its publisher.
export const PERFORMANCE_EXPERIMENT = '004-performance-film';
export const PERFORMANCE_SONG_SHA = 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const text = value => typeof value === 'string' && value.trim();
const close = (a, b) => finite(a) && finite(b) && Math.abs(a - b) < 1e-5;
const canonicalLyricKey = clip => JSON.stringify([clip.actor, clip.text.replace(/[\s，。！？、；：,.!?;:“”「」『』]/g, '')]);

export function validatePerformanceFilmReport(report) {
  if (report.provenance?.experiment_id !== PERFORMANCE_EXPERIMENT) return null;
  const require = (condition, message) => { if (!condition) throw new Error(`新歌曲动态成片记录无效：${message}`); };
  require(report.schema_version === 1 && report.status === 'completed', '仅真实完成的作品可接入。');
  const production = report.production, assembly = report.assembly, audio = report.audio;
  require(production?.music_mode === 'user-supplied-song' && text(production.music_provider) && text(production.music_title), '需要用户新完整歌曲的实际来源。');
  require(finite(production.total_duration) && production.total_duration > 0 && finite(production.bpm) && production.bpm > 0 && typeof production.bpm_is_estimate === 'boolean', '需实测时长与明确的节拍来源。');
  const duration = production.total_duration, video = report.assets?.video, fps = video?.fps;
  require(finite(fps) && fps > 0 && sha(video.sha256) && sha(report.assets?.poster?.sha256), '成片、帧率与封面散列缺失。');
  require(assembly?.source_hashes_verified === true && assembly.final_hash_verified === true && assembly.unified_audio === true, '缺少实际源文件、成片或统一音轨核对。');
  require(assembly.old_video_reuse === false && assembly.static_image_coverage_seconds === 0, '新作品不得沿用旧表演或图像运镜覆盖。');
  const sources = report.source_files;
  require(Array.isArray(sources) && sources.length >= 2, '至少需要两条本轮新动态源片。');
  require(sources.every(item => sha(item.sha256) && text(item.task_id) && text(item.path) && text(item.model_label || item.model) && finite(item.duration) && item.duration > 0 && item.source_experiment === PERFORMANCE_EXPERIMENT && item.review?.accepted_for_final === true && item.review.motion_reviewed === true), '新原片须关联本轮任务、实际网页模型标签、真实时长及动态人工取舍。');
  const byHash = new Map(sources.map(item => [item.sha256, item]));
  const generatedParents = new Map(), corrected = sources.filter(item => item.source_kind === 'audio_driven_lip_correction');
  for (const source of sources) {
    const kind = source.source_kind || 'generated_video';
    require(['generated_video', 'audio_driven_lip_correction'].includes(kind), '未知视频来源种类。');
    const parentHash = kind === 'generated_video' ? source.sha256 : source.parent_source?.sha256;
    require(sha(parentHash) && (!generatedParents.has(source.task_id) || generatedParents.get(source.task_id) === parentHash), '同一平台任务须关联同一原始父视频，不能把本地校正当成新请求。');
    generatedParents.set(source.task_id, parentHash);
    if (kind === 'audio_driven_lip_correction') {
      const parent = source.parent_source, proof = source.provenance, qa = source.lip_sync_qa?.original_result;
      require(parent.task_id === source.task_id && parent.sha256 !== source.sha256 && text(parent.path) && sha(source.processing_report?.sha256) && text(source.processing_report?.path) && sha(source.lip_sync_qa?.sha256) && text(source.lip_sync_qa?.path), '口型处理须保留父生成任务、独立处理报告和视觉审核。');
      require(source.correction?.processor === 'MuseTalk' && Array.isArray(source.correction.actor_ids) && source.correction.actor_ids.length === 1 && ['libai', 'dufu'].includes(source.correction.actor_ids[0]), '口型处理须明确被校正的单一人物。');
      require(proof?.kind === kind && proof.parent_sha256 === parent.sha256 && proof.generation_task_id === source.task_id && proof.corrected_output_sha256 === source.sha256 && proof.visual_lip_sync_accepted === true && proof.audio_correlation_is_lipsync_evidence === false && proof.inference_status_is_visual_approval === false && source.copied_reference_audio_not_lipsync_evidence === true, '本地校正必须有经发布器重新核对的来源链，不能以复制音轨或推理完成冒充口型通过。');
      require(qa?.visual_lip_sync_reviewed === true && qa.accepted_for_lip_sync === true && qa.audio_correlation_used_as_lipsync_evidence === false && ['agent', 'human'].includes(qa.reviewer_kind), '口型子源缺少真实视觉与原曲审看结果。');
      require((qa.source_sha256 || qa.video_sha256 || qa.sha256) === source.sha256 && sha(source.driver?.sha256) && qa.reference_audio_sha256 === source.driver.sha256 && source.driver.source_song_sha256 === PERFORMANCE_SONG_SHA, '口型审查与实际子视频、原曲驱动不同。');
    }
  }
  require(byHash.size === sources.length && generatedParents.size >= 2 && assembly.source_clips === sources.length, '重复文件或同一平台任务的派生文件不能冒充多条新生成原片。');
  if (corrected.length || assembly.unique_generated_parent_tasks !== undefined) require(assembly.unique_generated_parent_tasks === generatedParents.size && assembly.local_lip_corrected_sources === corrected.length, '本地口型源数量与独立平台父任务统计不一致。');
  const visuals = report.visual_timeline;
  require(Array.isArray(visuals) && visuals.length > 0 && new Set(visuals.map(item => item.id)).size === visuals.length, '缺少唯一编号的动态剪辑表。');
  let cursor = 0, performanceDuration = 0, sceneDuration = 0;
  const used = new Set();
  for (const item of visuals) {
    const source = byHash.get(item.sha256);
    require(text(item.id) && source && item.task_id === source.task_id && item.is_generated_video === true && ['performance', 'generated_scene'].includes(item.type), `${item.id}没有关联本轮真实动态来源。`);
    require(close(item.slot_start, cursor) && finite(item.slot_end) && item.slot_end > cursor && item.slot_end <= duration + 1e-5, '动态画面须连续覆盖全部音乐。');
    require(finite(item.source_in) && finite(item.source_out) && item.source_in >= 0 && item.source_in < source.duration - 1 / fps && item.source_out > item.source_in && item.source_out <= source.duration + 1 / fps + 1e-5, `${item.id}取用区间超出实际原片或只剩定格帧。`);
    const roundingHold = Math.max(0, item.source_out - source.duration);
    if (roundingHold > 1e-5 || item.rounding_hold_seconds !== undefined) require(finite(item.rounding_hold_seconds) && item.rounding_hold_seconds >= 0 && item.rounding_hold_seconds <= 1 / fps + 1e-5 && close(item.rounding_hold_seconds, roundingHold), `${item.id}不足一帧的舍入补齐须明确且与实际源长度相符。`);
    require(close(item.source_out - item.source_in, item.slot_end - item.slot_start) && !item.retime && !item.freeze_seconds, `${item.id}须使用真实连续运动，不以变速或冻结补缺片。`);
    if (item.type === 'performance') {
      require(source.review.lyrics_reviewed === true, `${item.id}唱词表演缺少带声审核。`);
      if (source.source_kind === 'audio_driven_lip_correction') require(Array.isArray(item.actor_ids) && item.actor_ids.length > 0 && item.actor_ids.every(actor => source.correction.actor_ids.includes(actor)), `${item.id}不能宣称未被校正的另一张脸已经对上口型。`);
      performanceDuration += item.slot_end - item.slot_start;
    } else sceneDuration += item.slot_end - item.slot_start;
    cursor = item.slot_end; used.add(item.sha256);
  }
  require(close(cursor, duration) && used.size === sources.length && performanceDuration > 0 && sceneDuration > 0, '唱词和舞台动态镜头均须实际使用，不能只登记素材。');
  require(close(assembly.generated_video_duration, duration) && close(assembly.performance_duration, performanceDuration) && close(assembly.generated_scene_duration, sceneDuration), '新动态秒数须与剪辑表相同。');
  require(Array.isArray(report.clips) && report.clips.length >= 4 && new Set(report.clips.map(item => item.id)).size === report.clips.length, '完整新歌须有实际歌词，不锁定旧四句格式。');
  const occurrences = [];
  for (const clip of report.clips) {
    require(text(clip.id) && text(clip.actor) && text(clip.text) && clip.status === 'completed' && clip.video_generated === true && Array.isArray(clip.occurrences) && clip.occurrences.length > 0, '每句实际歌词须有演唱位置与对应画面。');
    if (clip.canonical_key !== undefined) require(clip.canonical_key === canonicalLyricKey(clip), '同词重唱的规范编号须由实际角色和歌词生成。');
    for (const occurrence of clip.occurrences) {
      require(text(occurrence.id) && [occurrence.start, occurrence.end, occurrence.heard_start, occurrence.heard_end].every(finite) && occurrence.start >= 0 && occurrence.end <= duration + 1e-5 && occurrence.end > occurrence.start && occurrence.heard_start >= occurrence.start && occurrence.heard_end > occurrence.heard_start && occurrence.heard_end <= occurrence.end, `${clip.id}实际演唱时间无效。`);
      const hashes = occurrence.source_sha256s || [occurrence.source_sha256];
      require(Array.isArray(hashes) && hashes.length > 0 && new Set(hashes).size === hashes.length && hashes.every(hash => byHash.has(hash) && visuals.some(item => item.type === 'performance' && item.sha256 === hash && item.slot_start < occurrence.heard_end && item.slot_end > occurrence.heard_start)), `${clip.id}未关联实际使用的新演唱画面。`);
      if (occurrence.shot_ids !== undefined) require(Array.isArray(occurrence.shot_ids) && occurrence.shot_ids.length > 0 && occurrence.shot_ids.every(id => visuals.some(item => item.id === id && item.type === 'performance' && hashes.includes(item.sha256) && item.slot_start < occurrence.heard_end && item.slot_end > occurrence.heard_start)), `${clip.id}跨机位记录与实际剪辑不符。`);
      occurrences.push({ ...occurrence, line_id: clip.id });
    }
  }
  const canonicalLyricCount = new Set(report.clips.map(canonicalLyricKey)).size;
  require(new Set(occurrences.map(item => item.id)).size === occurrences.length && assembly.unique_lyric_shots === canonicalLyricCount && assembly.performance_occurrences === occurrences.length, '实际歌词和演唱次数统计不一致。');
  require(audio?.sha256 === PERFORMANCE_SONG_SHA && audio.source_clip_audio_used === false && finite(audio.duration) && audio.duration > 0 && finite(audio.gain_db), '必须使用本轮新歌原音轨，不使用视频模型重配的声音。');
  const alignment = audio.alignment;
  require(alignment?.original_audio_trimmed_seconds === 0 && alignment.original_audio_speed === 1 && finite(alignment.padding_seconds) && alignment.padding_seconds >= 0 && alignment.padding_seconds <= 1 / fps + 1 / 48000 && close(audio.duration + alignment.padding_seconds, duration), '须完整保留新歌曲，仅在末尾补不超过一帧静音。');
  require(!audio.additions?.length, '新增声效须另行扩展并核对混音契约，不能静默添加。');
  const cost = report.cost;
  require(cost?.provider === 'ChatArt' && cost.credit_cap === 2400 && finite(cost.video_credits_estimate) && cost.video_credits_estimate >= 0 && cost.video_credits_estimate <= cost.credit_cap && (cost.video_credits_spent === null || (finite(cost.video_credits_spent) && cost.video_credits_spent >= 0 && cost.video_credits_spent <= cost.credit_cap)) && typeof cost.invoice_verified === 'boolean', '须登记本轮2400上限与全部已提交网页标价。');
  require([cost.credits_committed, cost.video_credits_committed, cost.image_credits_committed, cost.reserved_unconfirmed_credits, cost.budget_exposure_credits].every(value => finite(value) && value >= 0) && close(cost.credits_committed, cost.video_credits_committed + cost.image_credits_committed) && close(cost.budget_exposure_credits, cost.credits_committed + cost.reserved_unconfirmed_credits) && cost.budget_exposure_credits <= cost.credit_cap, '图片、视频承诺与未确认预留须分别统计，避免重复或超额。');
  require(cost.invoice_verified || cost.video_credits_spent === null, '没有独立账单时不能将页面标价写成实支。');
  require(sha(report.budget_ledger?.sha256) && text(report.budget_ledger.path) && report.budget_ledger.verified === true, '缺少真实任务预算账本的散列核对。');
  require(Number.isInteger(report.video_service?.created_tasks) && report.video_service.created_tasks >= generatedParents.size, '实际创建任务数不得小于使用的独立生成父任务数。');
  return { isFilm: true, occurrences, sourceCount: sources.length, performanceCount: occurrences.length,
    generatedParentTaskCount: generatedParents.size, lipCorrectedSourceCount: corrected.length, canonicalLyricCount,
    performanceDuration, sceneDuration, artDuration: 0, artSegments: 0,
    audioDuration: audio.duration, audioPadding: alignment.padding_seconds, audioGainDb: audio.gain_db,
    isStage: false, stageChanges: [], newSceneCount: 0, hasStageAmbience: false };
}
