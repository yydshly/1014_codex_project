// A new audio-driven repair never overwrites the rejected montage.
export const REJECTED_STAGE_SHA = '525c42dfe2bbe7bf0fe0dff77f122451464927e5aede6488a1b19f9691a0cb45';
export function validateRepairedFilmReport(report) {
  const require = (ok, message) => { if (!ok) throw new Error(`004修复版记录无效：${message}`); };
  const sha = value => /^[a-f0-9]{64}$/.test(value || '');
  require(report?.schema_version === 1 && report.experiment_id === '004-performance-film' && report.repair_id === 'audio-driven-repair-004' && ['in-production', 'exported-awaiting-full-review', 'user-accepted-final'].includes(report.status), '需独立的新修复版状态。');
  require(report.old_rejected_video_sha256 === REJECTED_STAGE_SHA && report.original_rejection_unchanged === true && report.mv_feature_used === false && report.local_generation_models_used === false, '原拒收结论与普通远端路线须保留。');
  if (report.status === 'in-production') {
    require(report.assets === null && report.full_film_completed === false, '制作中不能展示旧视频冒充新成片。');
    return [];
  }
  require(report.pilot_gate?.accepted_by === 'human-user' && sha(report.pilot_gate.evidence_sha256) && report.pilot_gate.source_video_sha256 === '13af814763a8ede67fb627e5724342bb760446e80a7610b8ce2a07d61668d129', '需绑定用户确认的同一H3试片。');
  require(report.video?.duration === 94.64 && report.video.full_decode === true && report.audio?.source_sha256 === 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0' && report.audio.full_song_preserved === true, '须有新整片和完整原曲的真实核验。');
  require(report.old_rejected_singing_reused === false && Array.isArray(report.singing_sources) && report.singing_sources.length > 0 && report.singing_sources.every(item => sha(item.sha256) && item.audio_reference_submitted === true && item.task_id), '演唱部分须来自明确提交原曲音频的远端新镜头。');
  require(report.quality?.agent_subjective_audio_review_claimed === false && typeof report.quality.full_film_user_accepted === 'boolean', '试片用户确认与整片验收须分开。');
  if (report.budget) {
    const b = report.budget;
    require(['cap', 'committed', 'unconfirmed_reserve', 'exposure', 'remaining', 'production_tasks', 'production_reported_credits'].every(key => Number.isFinite(b[key]) && b[key] >= 0), '费用汇总必须是实际非负数值。');
    require(b.exposure === b.committed + b.unconfirmed_reserve && b.remaining === b.cap - b.exposure && b.exposure <= b.cap && b.invoice_verified === false, '费用承诺、预留与未核对账单状态需一致。');
  }
  require(report.status !== 'user-accepted-final' || (report.quality.full_film_user_accepted === true && sha(report.final_user_acceptance?.evidence_sha256) && report.final_user_acceptance.source_video_sha256 === report.assets?.video?.sha256), '整片用户通过需绑定新成片本身的可信验收。');
  const assets = [report.assets?.video, report.assets?.poster];
  for (const asset of assets) require(/^media\/repaired-film-004\/[A-Za-z0-9._-]+$/.test(asset?.path || '') && sha(asset.sha256) && Number.isSafeInteger(asset.bytes) && asset.bytes > 0, '新视频与首帧需要独立路径和实际SHA。');
  require(report.assets.video.sha256 !== REJECTED_STAGE_SHA, '不可把被拒收文件改名当作修复版。');
  return assets;
}
