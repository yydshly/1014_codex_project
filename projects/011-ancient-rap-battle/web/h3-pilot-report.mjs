// The explicit website audio-input trial is separate from the rejected full-song montage.
export function validateH3PilotReport(report) {
  const require = (ok, message) => { if (!ok) throw new Error(`H3音频参考试验记录无效：${message}`); };
  require(report?.schema_version === 1 && report.experiment_id === '004-performance-film' && report.trial_id === 'web-h3-audio-VA01' && ['submitted-awaiting-output', 'output-returned-awaiting-review', 'pilot-accepted-by-user'].includes(report.status), '需要独立试验与真实等待、待验收或用户确认状态。');
  require(report.task?.provider_task_id === '1027778' && report.task.route === 'ordinary-image-to-video' && report.task.model_label === 'MiniMax H3' && report.task.mode_label === '全能模式' && report.task.mv_feature_used === false && report.task.submissions === 1 && report.task.requested_duration === 5, '任务、普通视频模式和一次提交事实不可更改。');
  require(report.input?.image_count === 2 && report.input.audio_count === 1 && report.input.audio_label === '音频 1' && report.input.song_in === 9.4 && report.input.song_out === 14.4 && report.input.source_song_sha256 === 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0', '需要明确的两图一音频及原曲区间。');
  require(report.evaluation?.agent_subjective_audio_review_claimed === false, '不得把用户试听结论称为代理主观听音。');
  if (report.status === 'pilot-accepted-by-user') {
    const acceptance = report.evaluation.human_acceptance;
    require(report.evaluation.singing_lip_sync_passed === true && acceptance?.accepted_by === 'human-user' && acceptance.source_kind === 'direct-user-feedback' && acceptance.scope === 'this-pilot-only' && acceptance.source_video_sha256 === report.output?.sha256 && /^[a-f0-9]{64}$/.test(acceptance.evidence_sha256 || '') && acceptance.evidence_path && acceptance.feedback && report.evaluation.full_film_accepted === false, '试片通过须来自可信用户、绑定此片SHA，不能外推整片。');
  } else require(report.evaluation.singing_lip_sync_passed === false && report.evaluation.full_song_batch_enabled === false, '不能以已上传音频或生成完成声称带声演唱通过。');
  require(report.cost?.reported_credits === 75 && report.cost.balance_before === 3450 && report.cost.balance_after === 3375 && report.cost.invoice_verified === false && report.cost.actual_credits_spent === null, '75钻余额观察须与独立账单核验区分。');
  require(report.source_audio?.duration === 5 && report.source_audio.sha256 === '79f91a413fee6811b2c1a90e762f44150cc0a0d98c8bd207fb0958a719e18962', '试听须为实际提交的同一5秒WAV。');
  require(Array.isArray(report.evidence_images) && report.evidence_images.length >= 2 && report.evidence_images.length <= 3, '提交前、受理与输入槽位截图需分别标明。');
  if (report.status === 'submitted-awaiting-output') require(report.output === null && report.task.provider_status === 'pending', '等待中不得虚构返回视频或写生成失败。');
  if (['output-returned-awaiting-review', 'pilot-accepted-by-user'].includes(report.status)) require(report.task.provider_status === 'completed' && report.output?.width === 1344 && report.output.height === 768 && report.output.fps === 24 && report.output.frames === 124 && Math.abs(report.output.duration - 5.166667) < 1e-5 && report.output.model_native_audio_preserved === true && report.poster, '返回原片须保留实际尺寸、时长、原声和真实首帧。');
  if (report.diagnostic) require(report.diagnostic.video_stream_copy === true && report.diagnostic.original_audio_offset_seconds === 0 && report.diagnostic.copied_reference_audio_not_lipsync_evidence === true, '配原曲诊断不能作为嘴部修复或口型合格证据。');
  const assets = [report.source_audio, ...report.evidence_images, ...(report.output ? [report.output] : []), ...(report.poster ? [report.poster] : []), ...(report.diagnostic ? [report.diagnostic] : [])];
  for (const asset of assets) require(/^media\/h3-audio-pilot-004\/[A-Za-z0-9._-]+$/.test(asset.path || '') && /^[a-f0-9]{64}$/.test(asset.sha256 || '') && Number.isSafeInteger(asset.bytes) && asset.bytes > 0, '资源须记录安全路径、实际字节与SHA。');
  return assets;
}
