// Isolated contract fixtures only. No actual QA/report/manifest is written or accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCorrectedSource, validateCorrectedShotActors, sourceKind, validateNativeFrameEvidence, has720pEquivalentSourceFrame } from './source-provenance.mjs';

const raw = 'a'.repeat(64), childHash = 'b'.repeat(64), audio = 'c'.repeat(64), song = 'd'.repeat(64), weightsHash = 'e'.repeat(64);
function fixture() {
  return {
    source: { id: 'A1-lip-test', source_kind: 'audio_driven_lip_correction', task_id: 'raw-task', parent_source: { task_id: 'raw-task', sha256: raw }, correction: { processor: 'MuseTalk', actor_ids: ['libai'] } },
    child: { path: 'clips/child.mp4', sha256: childHash, bytes: 2222, frames: 125, duration: 5, fps: 25 },
    parent: { path: 'clips/raw.mp4', task_id: 'raw-task', sha256: raw, bytes: 1111, duration: 10, ledger_sha256: raw, ledger_bytes: 1111, review: { source_sha256: raw, accepted_as_lip_base: true, motion_reviewed: true } },
    driver: { path: 'audio/test.wav', sha256: audio, source_song_sha256: song, song_in: 9.4, song_out: 14.4, decoded_duration: 5, gain_db: -1.5 },
    report: {
      status: 'completed', input_video: { path: 'clips/raw.mp4', sha256: raw, task_id: 'raw-task' }, input_video_time_range: [0, 5],
      reference_audio: { path: 'audio/test.wav', sha256: audio, source_song_sha256: song, song_in: 9.4, song_out: 14.4, gain_already_applied_db: -1.5, no_additional_gain: true },
      output: { path: 'clips/child.mp4', sha256: childHash, bytes: 2222, frames: 125, duration: 5, fps: 25 },
      model: { repo: 'fixture-local-repo', code_commit: '1'.repeat(40), version: 'v15', run_id: 'isolated-contract-test', weights_manifest_path: 'work/test-weights.json', weights_manifest_sha256: weightsHash },
      config: { face_selection: 'single_detected_face' },
      time_preservation: { speed: 1, retimed: false, looped: false, frame_hold_seconds: 0 },
    },
    visualQa: { source_sha256: childHash, reference_audio_sha256: audio, visual_lip_sync_reviewed: true, accepted_for_lip_sync: true, viewed_complete_clip: true, reviewer_kind: 'human', method: 'human_frame_and_playback', audio_correlation_used_as_lipsync_evidence: false, identity_preserved: true, mouth_unobstructed: true, no_obvious_viseme_drift: true, mouth_artifacts_acceptable: true, actor_ids: ['libai'], reviewer: 'fixture-only', reviewed_at: '2026-10-16T00:00:00Z', notes: 'Synthetic fixture for invariant checks, never actual visual QA.', sampled_frames: [0, 62, 124] },
    weights: { path: 'work/test-weights.json', sha256: weightsHash }, resolvePath: value => value,
  };
}

function agentFixture() {
  const d = fixture();
  d.evidence = [{ kind: 'native_frame_review', path: 'work/frames-evidence.json', sha256: raw, native_frame_data_verified: true }, { kind: 'audio_event_review', path: 'work/events-evidence.json', sha256: audio }];
  Object.assign(d.visualQa, { reviewer_kind: 'agent', method: 'timestamped_all_frame_review_and_audio_event_checks', viewed_complete_clip: false,
    all_native_frames_reviewed: true, native_pts_reviewed: true, native_frame_count_reviewed: 125,
    sampled_frames: Array.from({ length: 125 }, (_, i) => i), evidence: structuredClone(d.evidence),
    audio_event_checks: [0.4, 2, 4.5].map(t => ({ audio_time: t, video_frame: Math.round(t * 25), video_pts: t, visual_event: 'fixture-mouth-event', result: 'consistent', notes: 'Synthetic timing event only.' })), independent_syncnet_checked: false });
  return d;
}

test('agent full native-frame/PTS and audio-event evidence needs no human playback approval', () => {
  const d = agentFixture();
  assert.equal(validateCorrectedSource(d).reviewer_kind, 'agent');
});

for (const [name, change, pattern] of [
  ['incomplete full-frame review', d => { d.visualQa.all_native_frames_reviewed = false; }, /全原生帧与PTS/],
  ['native frame missing', d => { d.visualQa.sampled_frames.pop(); }, /全部原生帧索引/],
  ['audio event evidence missing', d => { d.evidence.pop(); }, /audio_event_review/],
  ['event failed', d => { d.visualQa.audio_event_checks[1].result = 'failed'; }, /失败事件/],
  ['all events inconclusive', d => { d.visualQa.audio_event_checks.forEach(e => { e.result = 'inconclusive'; }); }, /尚无结论/],
  ['claimed SyncNet without report', d => { d.visualQa.independent_syncnet_checked = true; }, /SyncNet检查/],
  ['unverified source inside frame artifact', d => { d.evidence[0].native_frame_data_verified = false; }, /全帧证据未与实际/],
]) test(`reject agent ${name}`, () => { const d = agentFixture(); change(d); assert.throws(() => validateCorrectedSource(d), pattern); });

test('accepted visual review plus preserved parent/audio/output chain is valid', () => {
  const result = validateCorrectedSource(fixture());
  assert.equal(result.parent_sha256, raw);
  assert.equal(result.corrected_output_sha256, childHash);
  assert.equal(result.audio_correlation_is_lipsync_evidence, false);
});

test('same verified bytes may be copied from a retained work output to clips', () => {
  const data = fixture();
  data.report.output.path = 'work/retained-output.mp4';
  data.reportedOutput = { ...data.child, path: 'work/retained-output.mp4' };
  assert.doesNotThrow(() => validateCorrectedSource(data));
});

const failures = [
  ['unreviewed output', d => { d.visualQa.accepted_for_lip_sync = false; }, /视觉唇形尚未通过/],
  ['audio correlation of 1 cannot replace visual inspection', d => { d.visualQa = { source_sha256: childHash, reference_audio_sha256: audio, correlation: 1, audio_match: true }; }, /视觉唇形尚未通过/],
  ['claimed visual pass that relies on audio correlation', d => { d.visualQa.audio_correlation_used_as_lipsync_evidence = true; }, /音轨高相关/],
  ['wrong ledger parent', d => { d.parent.ledger_sha256 = 'f'.repeat(64); }, /父源SHA/],
  ['parent not accepted as dynamic base', d => { d.parent.review.motion_reviewed = false; }, /动态口型底片/],
  ['raw file passed off as corrected file', d => { d.child.sha256 = raw; }, /冒用父源/],
  ['different actual output', d => { d.report.output.sha256 = 'f'.repeat(64); }, /真实子文件/],
  ['different retained output copy', d => { d.reportedOutput = { ...d.child, sha256: raw }; }, /实际处理输出/],
  ['wrong audio window hash', d => { d.report.reference_audio.sha256 = raw; }, /参考音频SHA/],
  ['wrong original song', d => { d.report.reference_audio.source_song_sha256 = raw; }, /原歌SHA/],
  ['different original-song time mapping', d => { d.report.reference_audio.song_in = 9.6; }, /原曲映射/],
  ['parent crop beyond real video', d => { d.report.input_video_time_range = [8, 13]; }, /裁切区间非法/],
  ['unreported time stretch', d => { d.report.time_preservation.speed = 1.1; }, /禁止变速/],
  ['hidden long frozen tail', d => { d.report.time_preservation.frame_hold_seconds = .2; }, /定格超过一帧/],
  ['wrong real frame count', d => { d.report.output.frames = 124; }, /输出帧数/],
  ['different weight manifest', d => { d.weights.sha256 = raw; }, /权重清单SHA/],
  ['inference incomplete', d => { d.report.status = 'running'; }, /推理未真实完成/],
  ['multiple actors assumed from one corrected face', d => { d.source.correction.actor_ids = ['libai', 'dufu']; }, /一个明确演员/],
  ['review of wrong face', d => { d.visualQa.actor_ids = ['dufu']; }, /被校正演员/],
  ['complete playback not reviewed', d => { d.visualQa.viewed_complete_clip = false; }, /完整看片/],
  ['mouth obscured despite pass flag', d => { d.visualQa.mouth_unobstructed = false; }, /mouth_unobstructed/],
  ['sample index out of range', d => { d.visualQa.sampled_frames = [0, 62, 125]; }, /抽帧索引/],
  ['only beginning of clip sampled', d => { d.visualQa.sampled_frames = [0, 1, 2]; }, /未覆盖前后段/],
];
for (const [name, change, pattern] of failures) test(`reject ${name}`, () => {
  const data = fixture(); change(data); assert.throws(() => validateCorrectedSource(data), pattern);
});

test('single-face source cannot claim the other performer is corrected', () => {
  const { source } = fixture();
  assert.throws(() => validateCorrectedShotActors(source, { id: 'wrong-actor', type: 'performance', actor_ids: ['libai', 'dufu'] }), /未被本条单脸校正/);
  assert.doesNotThrow(() => validateCorrectedShotActors(source, { id: 'right-actor', type: 'performance', actor_ids: ['libai'] }));
});

test('ordinary source stays native and unknown processing kinds are rejected', () => {
  assert.equal(sourceKind({ id: 'ordinary' }), 'generated_video');
  assert.throws(() => sourceKind({ id: 'invalid', source_kind: 'static_image' }), /未知source_kind/);
});

test('native frame artifact must retain actual child/reference SHA and all PTS', () => {
  const { child, driver } = fixture();
  const document = { video: { sha256: child.sha256, decoded_frames: child.frames }, reference_audio: { sha256: driver.sha256, song_start_seconds: driver.song_in, speed: 1, offset_seconds: 0 }, frame_timing: Array.from({ length: 125 }, (_, i) => ({ frame: i, pts_seconds: i / 25 })) };
  assert.equal(validateNativeFrameEvidence(document, child, driver), true);
  for (const mutate of [d => { d.video.sha256 = raw; }, d => { d.reference_audio.sha256 = raw; }, d => { d.frame_timing.pop(); }, d => { d.frame_timing[12].pts_seconds = 0; }]) {
    const invalid = structuredClone(document); mutate(invalid); assert.throws(() => validateNativeFrameEvidence(invalid, child, driver));
  }
});

test('720p area-equivalent provider dimensions are accepted without relabeling their probe', () => {
  assert.equal(has720pEquivalentSourceFrame(1268, 728), true);
  assert.equal(has720pEquivalentSourceFrame(1280, 720), true);
  assert.equal(has720pEquivalentSourceFrame(1280, 700), false);
  assert.equal(has720pEquivalentSourceFrame(1200, 720), false);
  assert.equal(has720pEquivalentSourceFrame(960, 960), false);
});
