// Isolated contract fixtures; no actual film, QA, manifest or publication is produced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFORMANCE_EXPERIMENT, PERFORMANCE_SONG_SHA, validatePerformanceFilmReport } from './performance-report.mjs';

const hash = character => character.repeat(64);
function fixture() {
  const corrected = {
    id: 'fixture-corrected', source_kind: 'audio_driven_lip_correction', task_id: 'fixture-generated-B', path: 'work/fixture-child.mp4', sha256: hash('c'), duration: 5, model_label: 'fixture-model', source_experiment: PERFORMANCE_EXPERIMENT,
    review: { accepted_for_final: true, motion_reviewed: true, lyrics_reviewed: true },
    parent_source: { task_id: 'fixture-generated-B', path: 'clips/fixture-parent.mp4', sha256: hash('b') },
    correction: { processor: 'MuseTalk', actor_ids: ['libai'] },
    driver: { sha256: hash('d'), source_song_sha256: PERFORMANCE_SONG_SHA },
    processing_report: { path: 'work/fixture-processing.json', sha256: hash('e') },
    lip_sync_qa: { path: 'work/fixture-qa.json', sha256: hash('f'), original_result: { source_sha256: hash('c'), reference_audio_sha256: hash('d'), reviewer_kind: 'agent', visual_lip_sync_reviewed: true, accepted_for_lip_sync: true, audio_correlation_used_as_lipsync_evidence: false } },
    provenance: { kind: 'audio_driven_lip_correction', parent_sha256: hash('b'), generation_task_id: 'fixture-generated-B', corrected_output_sha256: hash('c'), visual_lip_sync_accepted: true, audio_correlation_is_lipsync_evidence: false, inference_status_is_visual_approval: false },
    copied_reference_audio_not_lipsync_evidence: true,
  };
  return {
    schema_version: 1, status: 'completed', provenance: { experiment_id: PERFORMANCE_EXPERIMENT },
    production: { music_mode: 'user-supplied-song', music_provider: 'isolated fixture', music_title: 'fixture only', total_duration: 8, bpm: 100, bpm_is_estimate: true },
    assets: { video: { sha256: hash('1'), fps: 25 }, poster: { sha256: hash('2') } },
    source_files: [{ id: 'fixture-stage', task_id: 'fixture-generated-A', path: 'clips/fixture-stage.mp4', sha256: hash('a'), duration: 3, model_label: 'fixture-model', source_experiment: PERFORMANCE_EXPERIMENT, review: { accepted_for_final: true, motion_reviewed: true } }, corrected],
    visual_timeline: [{ id: 'fixture-scene', type: 'generated_scene', task_id: 'fixture-generated-A', sha256: hash('a'), is_generated_video: true, slot_start: 0, slot_end: 3, source_in: 0, source_out: 3 }, { id: 'fixture-performance', type: 'performance', task_id: 'fixture-generated-B', sha256: hash('c'), actor_ids: ['libai'], is_generated_video: true, slot_start: 3, slot_end: 8, source_in: 0, source_out: 5 }],
    assembly: { source_hashes_verified: true, final_hash_verified: true, unified_audio: true, old_video_reuse: false, static_image_coverage_seconds: 0, source_clips: 2, unique_generated_parent_tasks: 2, local_lip_corrected_sources: 1, generated_video_duration: 8, performance_duration: 5, generated_scene_duration: 3, unique_lyric_shots: 4, performance_occurrences: 4 },
    clips: [3.1, 4.2, 5.8, 6.9].map((start, i) => ({ id: `fixture-line-${i}`, actor: 'libai', text: `fixture line ${i}`, status: 'completed', video_generated: true, occurrences: [{ id: `fixture-occurrence-${i}`, start, end: start + .8, heard_start: start, heard_end: start + .8, source_sha256: hash('c') }] })),
    audio: { sha256: PERFORMANCE_SONG_SHA, duration: 7.99, gain_db: -1.5, source_clip_audio_used: false, alignment: { original_audio_trimmed_seconds: 0, original_audio_speed: 1, padding_seconds: .01 } },
    cost: { provider: 'ChatArt', credit_cap: 2400, video_credits_estimate: 240, video_credits_spent: null, invoice_verified: false, credits_committed: 240, video_credits_committed: 240, image_credits_committed: 0, reserved_unconfirmed_credits: 50, budget_exposure_credits: 290 },
    budget_ledger: { path: 'work/fixture-ledger.json', sha256: hash('3'), verified: true }, video_service: { created_tasks: 2 },
  };
}

test('corrected child retains one platform parent and independent visual approval', () => {
  const result = validatePerformanceFilmReport(fixture());
  assert.equal(result.generatedParentTaskCount, 2); assert.equal(result.lipCorrectedSourceCount, 1);
});

test('two local children of the same verified parent do not add a paid generation task', () => {
  const f = fixture(), second = structuredClone(f.source_files[1]);
  second.id = 'fixture-second-child'; second.path = 'work/fixture-second-child.mp4'; second.sha256 = hash('9');
  second.lip_sync_qa.original_result.source_sha256 = second.sha256; second.provenance.corrected_output_sha256 = second.sha256;
  f.source_files.push(second);
  f.visual_timeline[1].slot_end = 5.5; f.visual_timeline[1].source_out = 2.5;
  f.visual_timeline.push({ ...f.visual_timeline[1], id: 'fixture-second-performance', sha256: second.sha256, slot_start: 5.5, slot_end: 8, source_in: 2.5, source_out: 5 });
  for (const clip of f.clips.slice(2)) clip.occurrences[0].source_sha256 = second.sha256;
  f.assembly.source_clips = 3; f.assembly.local_lip_corrected_sources = 2;
  const result = validatePerformanceFilmReport(f);
  assert.equal(result.sourceCount, 3); assert.equal(result.generatedParentTaskCount, 2); assert.equal(result.lipCorrectedSourceCount, 2);
});

test('same singer reprise keeps its real occurrence while canonical lyric count stays distinct', () => {
  const f = fixture(); f.clips[1].text = f.clips[0].text;
  for (const clip of f.clips) clip.canonical_key = JSON.stringify([clip.actor, clip.text.replace(/[\s，。！？、；：,.!?;:“”「」『』]/g, '')]);
  f.assembly.unique_lyric_shots = 3;
  const result = validatePerformanceFilmReport(f);
  assert.equal(result.canonicalLyricCount, 3); assert.equal(result.performanceCount, 4);
});

test('only explicitly recorded one-frame rounding hold may extend a real moving source', () => {
  const f = fixture();
  f.production.total_duration = 8.04; f.audio.duration = 8.03;
  Object.assign(f.visual_timeline[0], { source_out: 3.04, slot_end: 3.04, rounding_hold_seconds: .04 });
  Object.assign(f.visual_timeline[1], { slot_start: 3.04, slot_end: 8.04 });
  f.assembly.generated_video_duration = 8.04; f.assembly.generated_scene_duration = 3.04;
  assert.equal(validatePerformanceFilmReport(f).sceneDuration, 3.04);
  const missing = structuredClone(f); delete missing.visual_timeline[0].rounding_hold_seconds;
  assert.throws(() => validatePerformanceFilmReport(missing));
  const long = structuredClone(f); long.visual_timeline[0].rounding_hold_seconds = .08;
  assert.throws(() => validatePerformanceFilmReport(long));
});

for (const [name, mutate] of [
  ['missing processing evidence', f => { delete f.source_files[1].processing_report; }],
  ['copied soundtrack used as lip evidence', f => { f.source_files[1].provenance.audio_correlation_is_lipsync_evidence = true; }],
  ['inference completion used as visual approval', f => { f.source_files[1].provenance.inference_status_is_visual_approval = true; }],
  ['unapproved visual result', f => { f.source_files[1].lip_sync_qa.original_result.accepted_for_lip_sync = false; }],
  ['wrong driver', f => { f.source_files[1].lip_sync_qa.original_result.reference_audio_sha256 = hash('8'); }],
  ['parent bytes passed off as corrected output', f => { f.source_files[1].parent_source.sha256 = hash('c'); }],
  ['uncorrected second face claimed in shot', f => { f.visual_timeline[1].actor_ids = ['libai', 'dufu']; }],
  ['incorrect parent task count', f => { f.assembly.unique_generated_parent_tasks = 3; }],
]) test(`reject ${name}`, () => { const f = fixture(); mutate(f); assert.throws(() => validatePerformanceFilmReport(f)); });
