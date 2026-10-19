// Map the actual editor result to the independent web montage contract. No generation calls.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateStageFilmReport } from '../stage-film-report.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experiment = path.resolve(webRoot, '../experiments/004-performance-film');
const work = 'work/stage-film-20261016';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const raw = await readFile(path.join(experiment, work, 'stage-film-report.json'));
const source = JSON.parse(raw);
if (source.status !== 'completed-visual-stage-montage' || source.verification.full_speed_visual_review?.passed !== true || source.verification.root_final_storyboard_and_cut_review?.passed !== true || source.verification.all_video_audio_frames_decoded_without_errors !== true) throw new Error('实际编辑报告或最终原速播放审查尚未通过，不启用完整舞台区。');
const playbackRef = source.verification.full_speed_visual_review;
const playbackBytes = await readFile(path.join(experiment, playbackRef.path));
if (hash(playbackBytes) !== playbackRef.sha256) throw new Error('最终浏览器播放记录SHA不符。');
const playback = JSON.parse(playbackBytes);
if (!playback.passed || !playback.ended || playback.playback_rate !== 1 || playback.source_sha256 !== source.output.sha256 || playback.media_error !== null || JSON.stringify(playback.complete_played_range) !== '[0,94.64]') throw new Error('浏览器未证实同一真实文件在原速连续播放至94.64秒结束。');
const budgetPath = 'work/chatart-tasks.json';
const budgetBytes = await readFile(path.join(experiment, budgetPath)), budget = JSON.parse(budgetBytes);
for (const item of source.sources) {
  const task = budget.tasks.find(task => task.id === item.ledger_local_id);
  if (!task || String(task.provider_task_id) !== item.task_id || task.output_sha256 !== item.sha256 || task.submitted !== true) throw new Error(`源片与实际远端任务账本不符：${item.id}`);
}
const report = {
  schema_version: 1,
  experiment_id: '004-performance-film',
  report_kind: 'ordinary-video-stage-montage',
  status: source.user_acceptance?.status === 'rejected-for-singing-performance' ? 'exported-visual-sample-singing-not-accepted' : 'completed',
  title: '压轴人间',
  completed_at: playback.reviewed_at,
  user_acceptance: source.user_acceptance || null,
  delivery_qualification: source.delivery_qualification || null,
  generation: { provider: 'ChatArt', skill_used: true, ordinary_video_only: source.ordinary_video_only, mv_feature_used: source.mv_feature_used, local_models_used: source.local_lipsync_model_used, model_labels: [...new Set(source.sources.map(item => item.model_label))], new_remote_tasks: 9, new_tasks_received_original_audio: false, existing_pilot_tasks_reused: 2, image_provider: 'OpenAI内置图像生成；以同一主图派生人物与环境参考，具体底层模型未暴露' },
  presentation: { precise_lip_sync_claimed: source.precise_lip_sync_claim, lip_sync_gate_passed: false, static_image_coverage_seconds: source.edit_summary.still_image_motion === false ? 0 : null, repeated_source_time_ranges: source.edit_summary.repeated_source_time_ranges, audience_picture_seconds: source.edit_summary.audience_picture_seconds },
  video: { ...source.output, full_decode: source.verification.all_video_audio_frames_decoded_without_errors },
  assets: {
    video: { source_path: source.output.path, path: 'media/stage-film-004/ya-zhou-ren-jian-stage.mp4', sha256: source.output.sha256, bytes: source.output.bytes },
    poster: { source_path: source.poster.path, path: 'media/stage-film-004/poster.jpg', sha256: source.poster.sha256, bytes: source.poster.bytes },
  },
  audio: { source_path: source.audio.path, source_sha256: source.audio.sha256, provider: source.audio.provider, duration: source.audio.source_sample_frames_48k / 48000, padding_seconds: source.audio.tail_silence_seconds, gain_db: source.audio.gain_db, gain_applications: source.audio.gain_applications, original_audio_trimmed_seconds: source.audio.trim_start + source.audio.trim_end, original_audio_speed: source.audio.speed, source_clip_audio_used: false, full_song_verified: source.audio.full_song_preserved && source.audio.output_verification.status === 'passed-full-song-audio-content-check', output_verification: source.audio.output_verification },
  source_files: source.sources.map(item => ({ ...item, kind: item.id === 'LIBAI2' ? 'detail' : ['libai', 'dufu'].includes(item.kind) ? 'performance' : item.kind, is_generated_video: item.source_kind === 'remote-ordinary-generated-video', review: { ...item.review, identity_reviewed: item.review.identity_preserved === true } })),
  visual_timeline: source.shots.map(item => ({ ...item, start: item.slot_start, end: item.slot_end, task_id: item.source_task_id, playback_rate: item.speed, freeze_seconds: 0, is_generated_video: true })),
  chapters: [{ start: 0, title: '月下开场' }, { start: 9.4, title: '李白开唱' }, { start: 28.52, title: '杜甫回应' }, { start: 42.24, title: '双人副歌' }, { start: 54.32, title: '桥段相和' }, { start: 64.64, title: '舞台高潮' }, { start: 82.6, title: '尾奏谢幕' }],
  caption_policy: source.caption_policy,
  verification: { source_hashes_verified: true, final_hash_verified: true, full_song_audio_verified: true, full_speed_browser_playback: { path: playbackRef.path, sha256: playbackRef.sha256, passed: playback.passed, complete_played_range: playback.complete_played_range, playback_rate: playback.playback_rate, media_error: playback.media_error, subjective_audio_listening_claimed: false }, editor_cut_review: source.verification.cut_review, root_storyboard_review: source.verification.root_final_storyboard_and_cut_review, independent_final_review: source.verification.independent_final_review },
  budget_ledger: { path: budgetPath, sha256: hash(budgetBytes), submitted_tasks_matched_to_sources: true, render_snapshot: { path: source.budget_ledger.snapshot_path, sha256: source.budget_ledger.snapshot_sha256 } },
  cost: { provider: 'ChatArt', credit_cap: budget.credit_cap, credits_committed: budget.submitted_credits_total, new_video_credits_reported: budget.tasks.filter(item => item.id.startsWith('STAGE_') && item.submitted === true).reduce((sum, item) => sum + item.credits_committed, 0), earlier_video_credits_reported: 225, reserved_unconfirmed_credits: budget.reserved_unconfirmed_credits, budget_exposure_credits: budget.submitted_credits_total + budget.reserved_unconfirmed_credits, actual_credits_spent: budget.actual_credits_spent, invoice_verified: budget.invoice_verified, evidence_type: '官方任务返回费用与余额观察；没有独立账单核验' },
  assembly_evidence: { path: `${work}/stage-film-report.json`, sha256: hash(raw), source_manifest: source.source_manifest, timeline: source.timeline, review_evidence: source.review_evidence },
  limitations: [...(source.user_acceptance?.status === 'rejected-for-singing-performance' ? ['用户反馈口型一点不对应；本版演唱口型未通过，不能作为合格演唱成果。', '新增9条没有提交原曲音频驱动，现片只将画面配回原曲，无法修正嘴部动作。', '舞台和观众可复用；主角演唱须先验证远端原曲音频驱动，再重做。'] : source.limitations), '字幕三条未定位/改词疑点没有强行写入。', '相近镜头仍有细微面部与刺绣变化。', 'LIBAI2只取0–7.2秒衣袖与靴步，后段与设定不符的现代观众画面已排除。', '任务费用按官方返回值汇总，含早期两条试片225钻；旧图片尝试50钻仅作未确认预留，未核对独立消费账单。'],
};
validateStageFilmReport(report);
if (report.user_acceptance?.feedback_path) {
  const feedback = await readFile(path.join(experiment, report.user_acceptance.feedback_path));
  if (hash(feedback) !== report.user_acceptance.feedback_sha256) throw new Error('用户拒收记录SHA不符。');
}
report.evidence_snapshot = { source_path: `${work}/stage-film-report.json`, sha256: hash(raw) };
const output = path.join(webRoot, 'public/data/004-stage-film.json');
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`已映射实际导出、播放及用户验收结论：${output}`);
