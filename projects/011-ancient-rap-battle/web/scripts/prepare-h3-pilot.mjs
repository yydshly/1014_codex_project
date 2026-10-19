// Snapshot existing submitted-task evidence only. Never uploads or submits generation.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateH3PilotReport } from '../h3-pilot-report.mjs';
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experiment = path.resolve(web, '../experiments/004-performance-film');
const work = 'work/audio-driven-repair';
const statusBytes = await readFile(path.join(experiment, work, 'repair-status.json'));
const status = JSON.parse(statusBytes);
const historyBytes = await readFile(path.join(experiment, work, 'history-after-first-poll-timeout.json'));
const history = JSON.parse(historyBytes);
const recoveryBytes = await readFile(path.join(experiment, work, 'recovery-progress.json'));
const recovery = JSON.parse(recoveryBytes);
if (status.provider_task_id !== '1027778' || status.generation_submitted !== true) throw new Error('没有同一已提交H3试验记录。');
if (history.row?.task_id !== '1027778' || history.row.status !== 'pending' || history.row.result !== 'N/A') throw new Error('最新官方等待状态与此快照不符，不能写成等待或失败。');
if (recovery.provider_task_id !== '1027778') throw new Error('恢复查询不是同一任务。');
const completed = recovery.status === 'completed-with-file';
const dataPath = path.join(web, 'public/data/004-h3-audio-pilot.json');
const prior = await readFile(dataPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
if (completed && prior?.status === 'submitted-awaiting-output') await writeFile(path.join(web, 'public/data/004-h3-audio-pilot-pending-0856.json'), `${JSON.stringify(prior, null, 2)}\n`);
const assets = [];
for (const [source, filename, extra] of [
  [`${work}/VA01-original-song-9.4-to-14.4.wav`, 'reference-9.4-14.4.wav', { duration: 5, label: '实际提交的原曲9.4–14.4秒' }],
  [`${work}/web-pilot-review/before-submit.png`, 'before-submit.png', { label: '提交前的网页设置与75钻标价' }],
  [`${work}/web-pilot-review/accepted.png`, 'accepted.png', { label: '08:43已受理任务卡与余额3375' }],
  [`${work}/web-pilot-review/typed-inputs-after-submit.png`, 'typed-inputs.png', { label: '两图加音频1槽位；连接异常的余额0是占位，不是费用证据' }],
]) {
  const bytes = await readFile(path.join(experiment, source));
  const relative = `media/h3-audio-pilot-004/${filename}`;
  await mkdir(path.dirname(path.join(web, 'public', relative)), { recursive: true });
  await copyFile(path.join(experiment, source), path.join(web, 'public', relative));
  assets.push({ ...extra, path: relative, source_path: source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const report = {
  schema_version: 1, experiment_id: '004-performance-film', trial_id: 'web-h3-audio-VA01', status: completed ? 'output-returned-awaiting-review' : 'submitted-awaiting-output',
  snapshot_at: completed ? recovery.updated_at : history.at,
  task: { provider: 'ChatArt', provider_task_id: '1027778', route: 'ordinary-image-to-video', model_label: 'MiniMax H3', mode_label: '全能模式', mv_feature_used: false, submissions: 1, submitted_at_ui: '2026/10/16 08:43', requested_duration: 5, quality_label: '768p', aspect_ratio: '16:9', provider_status: completed ? 'completed' : 'pending', ui_progress_connection: 'network-error-but-task-persists', official_query_confirmed_pending: !completed, official_query_observed_at: completed ? recovery.updated_at : history.at },
  input: { image_count: 2, audio_count: 1, audio_label: '音频 1', image_references: ['R02-LIBAI', 'R04-STAGE'], song_in: 9.4, song_out: 14.4, lyrics: '我携一身月色，踏过长安的墙', source_song_sha256: 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0', audio_gain_db: 0, contains_original_instrumental: true },
  source_audio: assets[0], evidence_images: assets.slice(1), output: null, poster: null, diagnostic: null,
  evaluation: { status: completed ? 'awaiting-user-audiovisual-review' : 'not-evaluated-output-pending', singing_lip_sync_passed: false, agent_subjective_audio_review_claimed: false, full_song_batch_enabled: false },
  cost: { reported_credits: 75, balance_before: 3450, balance_after: 3375, evidence: '页面标价与余额观察，非独立消费账单', invoice_verified: false, actual_credits_spent: null },
  clarification: '已实际验证ChatArt网页普通H3全能模式允许两图加音频。此前Skill接口没有明确audio参数，不能泛化为网页或模型不支持音频。上传成功也不等于演唱效果已通过。',
  source_snapshot: { path: `${work}/repair-status.json`, sha256: createHash('sha256').update(statusBytes).digest('hex') },
  official_history_snapshot: { path: `${work}/history-after-first-poll-timeout.json`, sha256: createHash('sha256').update(historyBytes).digest('hex') },
  recovery_snapshot: { path: `${work}/recovery-progress.json`, sha256: createHash('sha256').update(recoveryBytes).digest('hex') },
  prior_pending_snapshot: completed ? 'data/004-h3-audio-pilot-pending-0856.json' : null,
};
async function copyActual(source, filename, expectedSha, extra = {}) {
  const absolute = path.resolve(experiment, source), relative = path.relative(experiment, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('H3返回素材越过实验目录。');
  const bytes = await readFile(absolute), sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha && expectedSha !== sha256) throw new Error('H3返回素材与官方恢复记录SHA不同。');
  const destination = `media/h3-audio-pilot-004/${filename}`;
  await copyFile(absolute, path.join(web, 'public', destination));
  return { ...extra, path: destination, source_path: relative.replaceAll('\\', '/'), bytes: bytes.length, sha256 };
}
function probeVideo(source) {
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source], { encoding: 'utf8' }));
  const video = probe.streams.find(item => item.codec_type === 'video'), rate = video.r_frame_rate.split('/').map(Number);
  return { width: video.width, height: video.height, fps: rate[0] / rate[1], frames: Number(video.nb_frames), duration: Number(video.duration), container_duration: Number(probe.format.duration), has_audio: probe.streams.some(item => item.codec_type === 'audio') };
}
if (completed) {
  const actual = recovery.files?.[0];
  if (!actual || recovery.reported_cost !== 75) throw new Error('缺少真实返回文件或75钻官方结果。');
  report.output = await copyActual(actual.path, 'model-original.mp4', actual.sha256, { ...probeVideo(actual.path), model_native_audio_preserved: true });
  report.poster = await copyActual(`${work}/web-pilot-review/model-first-frame.jpg`, 'model-first-frame.jpg', null, { label: '真实模型原片首帧' });
  const visualBytes = await readFile(path.join(experiment, work, 'visual-review/review.json'));
  const visual = JSON.parse(visualBytes);
  const diagnosticPath = path.join(experiment, work, 'visual-review', visual.diagnostic.path);
  report.diagnostic = await copyActual(diagnosticPath, 'reference-listen-only.mp4', visual.diagnostic.sha256, { ...probeVideo(diagnosticPath), video_stream_copy: true, original_audio_offset_seconds: 0, tail_silence_pad_seconds: visual.diagnostic.tail_silence_pad_seconds, copied_reference_audio_not_lipsync_evidence: true, label: '零偏移配原曲诊断；只替换声音，未修嘴部' });
  const audioBytes = await readFile(path.join(experiment, work, 'audio-content-analysis.json'));
  const audio = JSON.parse(audioBytes);
  if (audio.generated_video_sha256 !== report.output.sha256 || audio.reference_sha256 !== report.source_audio.sha256) throw new Error('音轨内容比较不属于同一原片与原曲。');
  report.audio_comparison = { source_path: `${work}/audio-content-analysis.json`, sha256: createHash('sha256').update(audioBytes).digest('hex'), zero_lag_correlation_first_5s: audio.zero_lag_normalized_correlation_first_5s, best_lag_seconds: audio.lag_seconds_generated_later_positive, lip_sync_pass_claimed: false, subjective_audio_review_claimed: false, interpretation: '只支持原片声轨保留了原曲内容，不是口型评分或带声主观验收。' };
  const acceptancePath = path.join(experiment, work, 'pilot-acceptance.json');
  const acceptanceBytes = await readFile(acceptancePath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (acceptanceBytes) {
    const acceptance = JSON.parse(acceptanceBytes);
    if (acceptance.accepted_for_lip_sync !== true || acceptance.output_video_sha256 !== report.output.sha256 || acceptance.original_audio_sha256 !== report.source_audio.sha256 || acceptance.acceptance?.source !== 'direct-human-user' || acceptance.acceptance.trusted !== true || acceptance.acceptance.reviewer !== 'user' || acceptance.acceptance.review_type !== 'audiovisual-playback-feedback' || acceptance.subjective_audio_review_claimed_by_agent !== false || acceptance.audio_correlation_only !== false) throw new Error('试片用户验收证据不完整或不是同一视频，不能提升状态。');
    const evidenceSha = createHash('sha256').update(acceptanceBytes).digest('hex');
    await writeFile(path.join(web, 'public/data/004-h3-pilot-acceptance.json'), acceptanceBytes);
    report.status = 'pilot-accepted-by-user';
    report.snapshot_at = acceptance.accepted_at;
    report.evaluation = { status: 'this-pilot-accepted-by-human-user', singing_lip_sync_passed: true, agent_subjective_audio_review_claimed: false, full_song_batch_enabled: true, full_film_accepted: false, full_film_status: 'in-production', human_acceptance: { accepted_by: 'human-user', source_kind: 'direct-user-feedback', scope: 'this-pilot-only', source_video_sha256: report.output.sha256, source_audio_sha256: report.source_audio.sha256, evidence_path: `${work}/pilot-acceptance.json`, public_evidence_path: 'data/004-h3-pilot-acceptance.json', evidence_sha256: evidenceSha, feedback: acceptance.acceptance.answer, accepted_at: acceptance.accepted_at } };
    const repairedDataPath = path.join(web, 'public/data/004-repaired-film.json');
    const repaired = await readFile(repairedDataPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (repaired?.status === 'in-production') {
      repaired.pilot_gate = { accepted_by: 'human-user', source_video_sha256: report.output.sha256, evidence_path: `${work}/pilot-acceptance.json`, evidence_sha256: evidenceSha, scope: 'this-pilot-only' };
      await writeFile(repairedDataPath, `${JSON.stringify(repaired, null, 2)}\n`);
    }
  }
}
validateH3PilotReport(report);
await writeFile(dataPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(report.status === 'pilot-accepted-by-user' ? '已绑定可信用户对此H3试片的试听确认；整片修复中，不外推整片验收。' : completed ? '已接入真实H3模型原片、首帧与零偏移配原曲诊断；等待用户带声验收。' : '已保留H3任务1027778等待结果的事实、原曲输入和受理截图；未声称演唱通过。');
