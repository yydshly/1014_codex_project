// Ordinary generated-video montage. This is independent of the earlier lip-sync gate.
export const STAGE_SONG_SHA = 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0';
const finite = Number.isFinite;
const close = (a, b, tolerance = 1e-4) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance;
const sha = value => /^[a-f0-9]{64}$/.test(value || '');
const text = value => typeof value === 'string' && value.trim().length > 0;

export function validateStageFilmReport(report) {
  const require = (condition, message) => { if (!condition) throw new Error(`004舞台版记录无效：${message}`); };
  require(report?.schema_version === 1 && report.experiment_id === '004-performance-film' && report.report_kind === 'ordinary-video-stage-montage' && ['completed', 'exported-visual-sample-singing-not-accepted'].includes(report.status), '需要独立的真实导出视觉样片记录。');
  if (report.status === 'exported-visual-sample-singing-not-accepted') require(report.user_acceptance?.status === 'rejected-for-singing-performance' && report.user_acceptance.singing_lip_sync_passed === false && report.generation?.new_tasks_received_original_audio === false && report.generation.new_remote_tasks === 9, '用户拒收与未提交原曲驱动的事实必须保留。');
  require(report.title === '压轴人间' && !Number.isNaN(Date.parse(report.completed_at)), '标题或完成时间缺失。');
  require(report.generation?.provider === 'ChatArt' && report.generation.skill_used === true && report.generation.ordinary_video_only === true && report.generation.mv_feature_used === false && report.generation.local_models_used === false, '须用ChatArt Skill普通视频，不使用MV或本地生成模型。');
  require(report.presentation?.precise_lip_sync_claimed === false && report.presentation.lip_sync_gate_passed === false && report.presentation.static_image_coverage_seconds === 0, '不宣称精准口型，不能用静态图片补齐动态成片。');
  require(close(report.video?.duration, 94.64) && report.video.width === 1280 && report.video.height === 720 && report.video.fps === 25 && report.video.frames === 2366 && report.video.full_decode === true, '完整片应为94.64秒、1280×720、25fps、2366帧，且全片解码通过。');
  const audio = report.audio;
  require(audio?.source_sha256 === STAGE_SONG_SHA && audio.original_audio_trimmed_seconds === 0 && audio.original_audio_speed === 1 && audio.source_clip_audio_used === false && finite(audio.gain_db), '必须使用用户原曲，完整保留，不用模型原声。');
  require(close(audio.duration, 94.61552083333333, 1 / 48000) && close(audio.duration + audio.padding_seconds, report.video.duration, 1 / 48000) && audio.padding_seconds >= 0 && audio.padding_seconds < 1 / 25, '原曲只允许末尾不足一帧的静音补齐。');
  require(audio.full_song_verified === true && report.verification?.source_hashes_verified === true && report.verification.final_hash_verified === true, '缺少整曲和原片实际散列核对。');
  const playback = report.verification.full_speed_browser_playback;
  require(playback?.passed === true && sha(playback.sha256) && text(playback.path) && playback.playback_rate === 1 && playback.media_error === null && playback.complete_played_range?.length === 2 && playback.complete_played_range[0] === 0 && close(playback.complete_played_range[1], 94.64), '需要同一真实成片原速连续播放到结束的浏览器记录。');
  require(sha(report.budget_ledger?.sha256) && text(report.budget_ledger.path), '需要预算账本的来源与散列。');
  const sources = report.source_files;
  require(Array.isArray(sources) && sources.length >= 4 && new Set(sources.map(item => item.sha256)).size === sources.length, '至少四条不同的真实动态原片。');
  const sourceMap = new Map();
  for (const source of sources) {
    require(sha(source.sha256) && text(source.task_id) && text(source.path) && Number.isSafeInteger(source.bytes) && source.bytes > 0 && text(source.model_label) && finite(source.duration) && source.duration > 0 && ['performance', 'duet', 'stage', 'audience', 'detail'].includes(source.kind), '动态来源需关联任务、实测时长、字节数、模型标签和镜头类型。');
    require(source.source_experiment === '004-performance-film' && source.is_generated_video === true && source.review?.accepted_for_final === true && source.review.motion_reviewed === true, '只能使用本轮已审看的真实生成视频。');
    if (['performance', 'duet'].includes(source.kind)) require(source.review.identity_reviewed === true, '主角镜头须检查人物一致性。');
    sourceMap.set(source.sha256, source);
  }
  require(new Set(sources.map(item => item.task_id)).size === sources.length, '同一任务的派生文件不能计作多条远端生成。');
  const cuts = report.visual_timeline;
  require(Array.isArray(cuts) && cuts.length > 0 && new Set(cuts.map(item => item.id)).size === cuts.length, '需要真实连续剪辑表。');
  let cursor = 0;
  const used = new Set(), kinds = new Set();
  for (const cut of cuts) {
    const source = sourceMap.get(cut.source_sha256);
    require(text(cut.id) && source && cut.task_id === source.task_id && close(cut.start, cursor) && finite(cut.end) && cut.end > cut.start, '剪辑表必须连续并关联真实来源。');
    const rate = cut.playback_rate ?? 1;
    require(finite(rate) && rate >= .5 && rate <= 2 && finite(cut.source_in) && finite(cut.source_out) && cut.source_in >= 0 && cut.source_out > cut.source_in && cut.source_out <= source.duration + 1 / 25 && close((cut.source_out - cut.source_in) / rate, cut.end - cut.start, 1 / 25), `${cut.id}取用范围或播放速度与实际原片不符。`);
    require((cut.freeze_seconds ?? 0) === 0 && cut.is_generated_video === true, '不得用定格或静态图片填补镜头。');
    cursor = cut.end; used.add(source.sha256); kinds.add(source.kind);
  }
  require(close(cursor, report.video.duration) && used.size === sources.length && kinds.has('audience') && (kinds.has('stage') || kinds.has('detail')) && (kinds.has('performance') || kinds.has('duet')), '整曲必须实际包含主角、舞台和观众动态镜头。');
  const cost = report.cost;
  require(cost?.provider === 'ChatArt' && cost.credit_cap === 2400 && finite(cost.credits_committed) && cost.credits_committed >= 225 && finite(cost.reserved_unconfirmed_credits) && cost.reserved_unconfirmed_credits >= 0 && close(cost.budget_exposure_credits, cost.credits_committed + cost.reserved_unconfirmed_credits) && cost.budget_exposure_credits <= cost.credit_cap && typeof cost.invoice_verified === 'boolean', '费用须区分任务承诺和预留，并在2400钻上限内。');
  require(cost.invoice_verified || cost.actual_credits_spent === null, '未核对独立账单时不能将返回费用标作实支。');
  require(Array.isArray(report.limitations) && report.limitations.length > 0 && report.limitations.every(text), '需要实际局限说明。');
  require(Array.isArray(report.chapters) && report.chapters.length > 0 && report.chapters.every(item => text(item.title) && finite(item.start) && item.start >= 0 && item.start < report.video.duration), '需要成片段落入口。');
  const assets = [report.assets?.video, report.assets?.poster];
  for (const asset of assets) require(/^media\/stage-film-004\/[A-Za-z0-9._-]+$/.test(asset?.path || '') && sha(asset.sha256) && Number.isSafeInteger(asset.bytes) && asset.bytes > 0, '成片与海报须记录安全路径、真实字节数和SHA。');
  require(report.assets.video.path.endsWith('.mp4') && /\.(png|jpg|webp)$/.test(report.assets.poster.path), '成片或海报格式无效。');
  return { assets, sourceCount: sources.length, cutCount: cuts.length, audienceCuts: cuts.filter(cut => sourceMap.get(cut.source_sha256).kind === 'audience').length };
}
