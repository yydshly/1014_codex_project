// This record describes real tests, independently of the completed main film.
export function validatePilotReport(report) {
  const fail = message => { throw new Error(`004实测记录无效：${message}`); };
  if (report?.schema_version !== 1 || report.experiment_id !== '004-performance-film' || report.status !== 'real-pilots-only-full-film-not-completed') fail('需要真实试片状态。');
  if (report.full_film_completed !== false || report.mv_feature_used !== false || report.generation_facts?.visual_lip_sync_passed !== false || report.generation_facts?.local_lip_correction_created !== false) fail('不可宣称完整成片、MV或已通过口型。');
  const ids = ['stage-original', 'stage-song-preview', 'singing-original', 'singing-reference-diagnostic'];
  if (!Array.isArray(report.assets) || report.assets.length !== 4 || ids.some(id => report.assets.filter(asset => asset.id === id).length !== 1)) fail('四条原片与对照资产不完整。');
  const singing = report.assets.find(asset => asset.id === 'singing-original');
  const diagnostic = report.assets.find(asset => asset.id === 'singing-reference-diagnostic');
  if (singing.audio_reference_submitted_as_media !== true || singing.audio_reference_recognized_by_backend !== null || singing.native_audio_preserves_reference !== false || singing.accepted_for_lip_sync !== false) fail('试唱必须保留音频识别未知、未通过口型的事实。');
  if (diagnostic.video_stream_copy !== true || diagnostic.accepted_for_lip_sync !== false || diagnostic.copied_audio_is_lipsync_evidence !== false) fail('配原曲对照不能被标为嘴型修复。');
  if (!Array.isArray(report.references?.primary) || report.references.primary.length !== 4 || !Array.isArray(report.references.additional_environment) || report.references.additional_environment.length !== 2) fail('需要四张主参考与两张环境参考。');
  if (report.source_song?.complete_song_video_status !== 'not-completed' || report.source_song.decoded_duration_at_48k_seconds < 94 || !report.source_song.provider) fail('需要真实整曲来源与未成片状态。');
  const cost = report.cost;
  if (!cost || cost.credit_cap !== 2400 || cost.committed_credits !== 225 || cost.reserved_unconfirmed_credits !== 50 || cost.actual_credits_spent !== null || cost.invoice_verified !== false) fail('费用须区分225任务记录、50预留和未核实账单。');
  if (cost.exposure_credits !== cost.committed_credits + cost.reserved_unconfirmed_credits || cost.uncommitted_headroom_after_reserve !== cost.credit_cap - cost.exposure_credits || cost.tasks?.reduce((sum, task) => sum + task.credits_committed, 0) !== cost.committed_credits) fail('预算加总不一致。');
  const assets = [...report.assets, report.source_song, ...report.references.primary, ...report.references.additional_environment];
  if (new Set(assets.map(asset => asset.path)).size !== assets.length) fail('资源路径重复。');
  for (const asset of assets) {
    if (!/^media\/pilot-004\/[A-Za-z0-9._-]+$/.test(asset.path || '') || !/^[a-f0-9]{64}$/.test(asset.sha256 || '') || !Number.isInteger(asset.bytes) || asset.bytes <= 0) fail('资源须有安全相对路径、实际字节数与SHA。');
  }
  return assets;
}
