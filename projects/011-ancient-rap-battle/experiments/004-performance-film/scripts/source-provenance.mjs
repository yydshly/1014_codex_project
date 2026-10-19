/** Pure validation of real generated-video -> local lip-correction provenance.
 * Files, hashes and ffprobe values are supplied by assemble-film after reading them.
 * A completed inference report or copied audio is never a visual lip-sync pass.
 */
import assert from 'node:assert/strict';

const number = n => typeof n === 'number' && Number.isFinite(n);
const near = (a, b, epsilon = 1e-6) => number(a) && number(b) && Math.abs(a - b) <= epsilon;
const nonempty = s => typeof s === 'string' && s.trim().length > 0;
const sameActors = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(id => b.includes(id));
const videoHash = qa => qa?.source_sha256 || qa?.video_sha256 || qa?.sha256;

// Some provider "720p" files are 1268x728: preserve actual values, normalize only final output.
export function has720pEquivalentSourceFrame(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && height >= 720 && width * height >= 1280 * 720 && Math.abs(width / height - 16 / 9) < .08;
}

export function validateNativeFrameEvidence(document, child, driver) {
  assert.equal(document.video?.sha256, child.sha256, '全帧证据对应的子视频SHA不符。');
  assert.equal(document.reference_audio?.sha256, driver.sha256, '全帧证据对应的参考音频SHA不符。');
  assert.equal(document.video?.decoded_frames, child.frames, '全帧证据的真实帧数不符。');
  assert(near(document.reference_audio?.song_start_seconds, driver.song_in), '全帧证据原曲起点不符。');
  assert(document.reference_audio?.speed === 1 && document.reference_audio?.offset_seconds === 0, '全帧证据不能预先变速或移动参考音频。');
  const frames = document.frame_timing;
  assert(Array.isArray(frames) && frames.length === child.frames, '全帧PTS证据不完整。');
  for (const [i, frame] of frames.entries()) {
    assert(frame.frame === i && number(frame.pts_seconds) && frame.pts_seconds >= 0 && frame.pts_seconds < child.duration + 1e-6 && (i === 0 ? near(frame.pts_seconds, 0) : frame.pts_seconds > frames[i - 1].pts_seconds), '全帧PTS顺序、帧索引或起点不符。');
  }
  return true;
}

export function sourceKind(source) {
  const kind = source.source_kind ?? 'generated_video';
  assert(['generated_video', 'audio_driven_lip_correction'].includes(kind), `${source.id}未知source_kind。`);
  return kind;
}

export function validateCorrectedSource({ source, child, parent, driver, report, visualQa, weights, reportedOutput = child, evidence = [], resolvePath }) {
  const id = source.id;
  assert.equal(sourceKind(source), 'audio_driven_lip_correction');
  assert(source.correction && source.parent_source && driver, `${id}缺少父源、处理记录或驱动。`);
  assert.equal(source.task_id, source.parent_source.task_id, `${id}生成任务必须指向父源任务。`);
  assert.equal(parent.task_id, source.parent_source.task_id, `${id}父源任务不一致。`);
  assert.equal(parent.sha256, parent.ledger_sha256, `${id}父源SHA未与原始生成账本匹配。`);
  assert.equal(parent.bytes, parent.ledger_bytes, `${id}父源字节未与原始生成账本匹配。`);
  assert.equal(parent.sha256, source.parent_source.sha256, `${id}父源SHA与清单不同。`);
  assert.notEqual(child.sha256, parent.sha256, `${id}处理子文件不能冒用父源原文件。`);
  assert(parent.review?.motion_reviewed === true && (parent.review.accepted_as_lip_base === true || parent.review.accepted_for_final === true), `${id}父视频未接受为真实动态口型底片。`);
  assert.equal(videoHash(parent.review), parent.sha256, `${id}父源审片SHA不符。`);

  const c = source.correction;
  assert.equal(c.processor, 'MuseTalk', `${id}当前仅接受已授权的本地MuseTalk路线。`);
  assert(Array.isArray(c.actor_ids) && c.actor_ids.length === 1 && ['libai', 'dufu'].includes(c.actor_ids[0]), `${id}当前口型处理仅批准一个明确演员。`);
  assert.equal(report.status, 'completed', `${id}推理未真实完成。`);
  assert(report.input_video && report.reference_audio && report.output && report.model && report.config && report.time_preservation, `${id}处理报告缺少真实输入、模型、输出或时间保持记录。`);
  assert.equal(resolvePath(report.input_video.path), parent.path, `${id}报告父视频路径不符。`);
  assert.equal(report.input_video.sha256, parent.sha256, `${id}报告父视频SHA不符。`);
  assert.equal(report.input_video.task_id, parent.task_id, `${id}报告父生成任务不符。`);
  const range = report.input_video_time_range;
  assert(Array.isArray(range) && range.length === 2 && range.every(number) && range[0] >= 0 && range[1] > range[0] && range[1] <= parent.duration + 1e-6, `${id}报告父视频裁切区间非法。`);
  assert(near(range[1] - range[0], driver.decoded_duration, 1 / child.fps + 1e-6), `${id}父视频片段与驱动长度不同，禁止隐式变速。`);
  assert.equal(resolvePath(report.reference_audio.path), driver.path, `${id}报告参考音频路径不符。`);
  assert.equal(report.reference_audio.sha256, driver.sha256, `${id}报告参考音频SHA不符。`);
  assert.equal(report.reference_audio.source_song_sha256, driver.source_song_sha256, `${id}处理参考音频的原歌SHA不符。`);
  assert(near(report.reference_audio.song_in, driver.song_in) && near(report.reference_audio.song_out, driver.song_out), `${id}报告音频窗口与原曲映射不符。`);
  assert.equal(report.reference_audio.no_additional_gain, true, `${id}处理时不能再次调整驱动音量。`);
  assert(near(report.reference_audio.gain_already_applied_db, driver.gain_db), `${id}参考驱动已施增益记录不符。`);
  assert.equal(resolvePath(report.output.path), reportedOutput.path, `${id}报告输出路径不符。`);
  assert.equal(reportedOutput.sha256, child.sha256, `${id}实际处理输出与剪辑子文件不同。`);
  assert.equal(report.output.sha256, child.sha256, `${id}报告输出SHA与真实子文件不符。`);
  assert.equal(report.output.bytes, child.bytes, `${id}报告输出字节不符。`);
  assert.equal(report.output.frames, child.frames, `${id}报告输出帧数不符。`);
  assert(near(report.output.fps, child.fps) && near(report.output.duration, child.duration, 1e-4), `${id}报告输出帧率/时长与ffprobe不符。`);
  assert(near(child.frames / child.fps, child.duration, 1e-4), `${id}真实子视频帧数/时长不符。`);
  assert(near(child.duration, driver.decoded_duration, 1 / child.fps + 1e-6), `${id}处理结果未完整保留驱动时间。`);
  assert(report.time_preservation.speed === 1 && report.time_preservation.retimed === false && report.time_preservation.looped === false, `${id}口型输出禁止变速、重定时或循环。`);
  assert(number(report.time_preservation.frame_hold_seconds) && report.time_preservation.frame_hold_seconds >= 0 && report.time_preservation.frame_hold_seconds <= 1 / child.fps + 1e-6, `${id}处理结果定格超过一帧舍入。`);
  assert(nonempty(report.model.repo) && /^[a-f0-9]{7,64}$/i.test(report.model.code_commit || '') && nonempty(report.model.version) && nonempty(report.model.run_id), `${id}模型来源、固定代码版本和实际运行ID不可缺。`);
  assert.equal(resolvePath(report.model.weights_manifest_path), weights.path, `${id}权重清单路径不符。`);
  assert.equal(report.model.weights_manifest_sha256, weights.sha256, `${id}权重清单SHA不符。`);
  assert(['single_detected_face', 'manual_tracked_face'].includes(report.config.face_selection), `${id}未明确选择单张人脸。`);

  assert(visualQa && videoHash(visualQa) === child.sha256, `${id}缺少对应真实子视频的视觉口型审核。`);
  assert.equal(visualQa.reference_audio_sha256, driver.sha256, `${id}视觉口型审核的参考音频SHA不符。`);
  assert(visualQa.visual_lip_sync_reviewed === true && visualQa.accepted_for_lip_sync === true, `${id}视觉唇形尚未通过，不能用推理完成或音轨相关代替。`);
  const agentReview = visualQa.reviewer_kind === 'agent' && visualQa.method === 'timestamped_all_frame_review_and_audio_event_checks';
  const humanReview = visualQa.reviewer_kind === 'human' && visualQa.method === 'human_frame_and_playback';
  assert(agentReview || humanReview, `${id}须声明可核验的agent全帧/音频事件审查或真实人工播放审查。`);
  if (humanReview) assert.equal(visualQa.viewed_complete_clip, true, `${id}所声明人工路线未完整看片。`);
  assert.equal(visualQa.audio_correlation_used_as_lipsync_evidence, false, `${id}禁止以音轨高相关代替视觉唇形。`);
  for (const field of ['identity_preserved', 'mouth_unobstructed', 'no_obvious_viseme_drift', 'mouth_artifacts_acceptable']) assert.equal(visualQa[field], true, `${id}视觉审核${field}未通过。`);
  assert(sameActors(visualQa.actor_ids, c.actor_ids), `${id}视觉审核与被校正演员不符。`);
  assert(nonempty(visualQa.reviewer) && nonempty(visualQa.reviewed_at) && Number.isFinite(Date.parse(visualQa.reviewed_at)) && nonempty(visualQa.notes), `${id}缺少真实审核者标识、时间或观察说明。`);
  assert(Array.isArray(visualQa.sampled_frames) && visualQa.sampled_frames.length >= 3 && new Set(visualQa.sampled_frames).size === visualQa.sampled_frames.length && visualQa.sampled_frames.every(n => Number.isInteger(n) && n >= 0 && n < child.frames), `${id}视觉抽帧索引缺失、重复或越界。`);
  assert(Math.min(...visualQa.sampled_frames) <= child.frames * .25 && Math.max(...visualQa.sampled_frames) >= child.frames * .75, `${id}视觉抽帧未覆盖前后段。`);
  if (agentReview) {
    assert(visualQa.all_native_frames_reviewed === true && visualQa.native_pts_reviewed === true && visualQa.native_frame_count_reviewed === child.frames, `${id}agent全原生帧与PTS尚未审看完成。`);
    assert(visualQa.sampled_frames.length === child.frames, `${id}agent路线须记录全部原生帧索引。`);
    const events = visualQa.audio_event_checks;
    assert(Array.isArray(events) && events.length >= 3 && events.every(e => number(e.audio_time) && e.audio_time >= 0 && e.audio_time <= driver.decoded_duration && Number.isInteger(e.video_frame) && e.video_frame >= 0 && e.video_frame < child.frames && number(e.video_pts) && e.video_pts >= 0 && e.video_pts <= child.duration && nonempty(e.visual_event) && nonempty(e.notes) && ['consistent', 'acceptable_minor_error', 'inconclusive'].includes(e.result)), `${id}缺少真实音频开闭事件核对或存在失败事件。`);
    assert(new Set(events.filter(e => e.result !== 'inconclusive').map(e => e.audio_time)).size >= 3, `${id}至少三个独立可核对口型事件尚无结论。`);
    for (const kind of ['native_frame_review', 'audio_event_review']) {
      const spec = visualQa.evidence?.find(e => e.kind === kind), actual = evidence.find(e => e.kind === kind);
      assert(spec && actual && resolvePath(spec.path) === resolvePath(actual.path) && spec.sha256 === actual.sha256, `${id}缺少固定SHA的${kind}真实证据。`);
      if (kind === 'native_frame_review') assert.equal(actual.native_frame_data_verified, true, `${id}全帧证据未与实际子视频/参考音频核验。`);
    }
  }
  if (visualQa.independent_syncnet_checked === true) {
    const spec = visualQa.evidence?.find(e => e.kind === 'independent_syncnet'), actual = evidence.find(e => e.kind === 'independent_syncnet');
    assert(spec && actual && resolvePath(spec.path) === resolvePath(actual.path) && spec.sha256 === actual.sha256, `${id}声称独立SyncNet检查却缺少实际报告。`);
  }

  return { kind: 'audio_driven_lip_correction', processor: c.processor, actor_ids: c.actor_ids,
    generation_task_id: parent.task_id, parent_path: parent.path, parent_sha256: parent.sha256,
    input_video_time_range: range, reference_audio: { ...report.reference_audio }, model: { ...report.model },
    config: { ...report.config }, time_preservation: { ...report.time_preservation },
    corrected_output_sha256: child.sha256, visual_lip_sync_accepted: true, reviewer_kind: visualQa.reviewer_kind,
    visual_review_method: visualQa.method, verified_visual_evidence: evidence,
    audio_correlation_is_lipsync_evidence: false, inference_status_is_visual_approval: false };
}

export function validateCorrectedShotActors(source, shot) {
  if (sourceKind(source) !== 'audio_driven_lip_correction' || shot.type !== 'performance') return;
  assert(Array.isArray(shot.actor_ids) && shot.actor_ids.length > 0 && shot.actor_ids.every(id => source.correction.actor_ids.includes(id)), `${shot.id}宣称了未被本条单脸校正及审核的演唱演员。`);
}
