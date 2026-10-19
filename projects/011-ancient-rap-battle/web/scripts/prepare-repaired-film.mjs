// Publish an existing audio-driven re-edit. No generation, task or ledger writes.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateRepairedFilmReport, REJECTED_STAGE_SHA } from '../repaired-film-report.mjs';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experiment = path.resolve(web, '../experiments/004-performance-film');
const input = process.argv[2];
if (!input) throw new Error('用法：node scripts/prepare-repaired-film.mjs <004实验内的真实reedit-film-report.json>');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const require = (condition, message) => { if (!condition) throw new Error(message); };
const relative = absolute => path.relative(experiment, absolute).replaceAll('\\', '/');
async function actual(file, expectedHash, expectedBytes) {
  const resolved = await realpath(path.resolve(experiment, file));
  const rel = path.relative(experiment, resolved);
  require(rel && !rel.startsWith('..') && !path.isAbsolute(rel), `来源越过004实验目录：${file}`);
  const bytes = await readFile(resolved);
  require(!expectedHash || digest(bytes) === expectedHash, `来源SHA不符：${file}`);
  require(expectedBytes === undefined || bytes.length === expectedBytes, `来源字节数不符：${file}`);
  return { resolved, bytes, path: relative(resolved), sha256: digest(bytes) };
}
const sourceReport = await actual(input), source = JSON.parse(sourceReport.bytes);
require(source.mode === 'original-audio-driven-stage-reedit' && source.ordinary_video_only === true && source.mv_feature_used === false && source.local_models_used === false, '必须是实际原曲驱动普通视频修复版。');
require(source.verification?.all_video_audio_frames_decoded_without_errors === true && source.verification.all_clear_singing_source_windows_match_original_song === true && source.verification.audio_content_check_not_lip_sync_score === true, '整片技术核验尚未完成。');
require(source.output?.duration === 94.64 && source.output.width === 1280 && source.output.height === 720 && source.output.fps === 25 && source.output.frames === 2366, '实际成片元数据不符合94.64秒输出。');
require(source.edit_summary?.still_image_motion === false && source.edit_summary.source_speed === 1 && source.edit_summary.old_wrong_mouth_faces_in_vocal_sections === false, '不能用静图或旧错误嘴部补演唱。');
require(source.audio?.full_song_preserved === true && source.audio.output_verification?.status === 'passed-full-song-audio-content-check', '完整原曲内容尚未核验。');

const pilot = await actual(source.pilot_acceptance.path, source.pilot_acceptance.sha256);
const acceptance = JSON.parse(pilot.bytes);
require(acceptance.accepted_for_lip_sync === true && acceptance.acceptance?.trusted === true && acceptance.acceptance.source === 'direct-human-user' && acceptance.acceptance.review_type === 'audiovisual-playback-feedback', '缺少可信的原试片用户试听反馈。');
const timeline = await actual(source.timeline.path, source.timeline.sha256);
const plan = JSON.parse(timeline.bytes);
require(Array.isArray(source.shots) && source.shots.length === plan.shots.length && source.shots.reduce((sum, shot) => sum + shot.frames, 0) === 2366, '分镜与完整片帧数不一致。');
const singing = source.sources.filter(item => item.source_role === 'original-audio-driven-performance');
require(singing.length > 0 && source.shots.every(shot => shot.kind !== 'corresponding-performance' || singing.some(item => item.id === shot.source_id)), '演唱镜头缺少明确原曲驱动来源。');
for (const item of source.sources) await actual(item.path, item.sha256, item.bytes);
for (const item of singing) {
  require(item.driver && item.task_id && (item.id === 'PILOT_H3' || item.typed_audio_input_confirmed === true), `未确认原曲音频输入：${item.id}`);
  await actual(item.driver.path, item.driver.sha256);
  if (item.independent_review) await actual(item.independent_review.path, item.independent_review.sha256);
}
const song = await actual(source.audio.path, source.audio.sha256);
const budget = await actual(source.budget_ledger.snapshot_path, source.budget_ledger.snapshot_sha256);
const ledger = JSON.parse(budget.bytes);
const ledgerTasks = [...ledger.tasks, ...(ledger.image_tasks || [])];
const committed = ledgerTasks.filter(task => task.submitted).reduce((sum, task) => sum + (task.credits_committed || 0), 0);
const reserved = (ledger.reservations || []).reduce((sum, item) => sum + item.credits, 0);
const productionIds = new Set(source.sources.filter(item => (item.source_role === 'original-audio-driven-performance' && item.id !== 'PILOT_H3') || item.source_role === 'new-faceless-stage-detail').map(item => String(item.task_id)));
const productionTasks = ledgerTasks.filter(task => productionIds.has(String(task.provider_task_id)));
require(productionTasks.length === 6 && productionTasks.every(task => Number.isFinite(task.credits_reported_by_provider)), '六条后续任务需有真实费用回报。');
require(committed + reserved <= ledger.credit_cap, '预算敞口超出授权。');
const output = await actual(source.output.path, source.output.sha256, source.output.bytes);
const poster = await actual(source.poster.path, source.poster.sha256, source.poster.bytes);
require(output.sha256 !== REJECTED_STAGE_SHA && output.bytes.toString('ascii', 4, 8) === 'ftyp', '新修复版不能复用旧拒收文件或伪装MP4。');
const existing = JSON.parse(await readFile(path.join(web, 'public/data/004-repaired-film.json'), 'utf8'));
require(existing.status !== 'user-accepted-final', '已存在整片用户验收，须保留其结论，不能覆盖为待验收。');
const asset = (item, filename) => ({ path: `media/repaired-film-004/${filename}`, source_path: item.path, sha256: item.sha256, bytes: item.bytes.length });
const report = {
  schema_version: 1, experiment_id: '004-performance-film', repair_id: 'audio-driven-repair-004',
  status: 'exported-awaiting-full-review', full_film_completed: true,
  old_rejected_video_sha256: REJECTED_STAGE_SHA, original_rejection_unchanged: true,
  mv_feature_used: false, local_generation_models_used: false, old_rejected_singing_reused: false,
  pilot_gate: { accepted_by: 'human-user', source_video_sha256: acceptance.output_video_sha256, evidence_path: pilot.path, evidence_sha256: pilot.sha256, scope: 'this-pilot-only' },
  video: { ...source.output, full_decode: true },
  audio: { ...source.audio, source_sha256: song.sha256 },
  singing_sources: singing.map(item => ({ id: item.id, task_id: item.task_id, sha256: item.sha256, audio_reference_submitted: true, song_in: item.driver.song_in, song_out: item.driver.song_out, acceptance_scope: item.acceptance_scope || 'independent-visual-and-technical-review-only' })),
  assets: { video: asset(output, 'ya-zhou-ren-jian-audio-driven.mp4'), poster: asset(poster, 'ya-zhou-ren-jian-audio-driven.jpg') },
  quality: { agent_subjective_audio_review_claimed: false, full_film_user_accepted: false },
  edit_summary: source.edit_summary, caption_policy: source.caption_policy,
  budget_ledger_snapshot: { source_path: budget.path, sha256: budget.sha256 },
  budget: { cap: ledger.credit_cap, committed, unconfirmed_reserve: reserved, exposure: committed + reserved, remaining: ledger.credit_cap - committed - reserved, production_tasks: productionTasks.length, production_reported_credits: productionTasks.reduce((sum, task) => sum + task.credits_reported_by_provider, 0), invoice_verified: false },
  assembly_evidence: { source_path: sourceReport.path, sha256: sourceReport.sha256 },
  limitations: source.limitations,
};
validateRepairedFilmReport(report);
for (const [item, target] of [[output, report.assets.video.path], [poster, report.assets.poster.path]]) {
  await mkdir(path.dirname(path.join(web, 'public', target)), { recursive: true });
  await copyFile(item.resolved, path.join(web, 'public', target));
}
await writeFile(path.join(web, 'public/data/004-repaired-film.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('新94.64秒原曲驱动修复版已接入；整片仍待用户验收，旧拒收样片未改。');
