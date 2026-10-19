import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// 独立三句实测交付，不改变要求四片到齐的 assemble/publish 流程。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, '../../web/public');
const args = process.argv.slice(2);
if (args.length > 1 || args.some(a => !['--check', '--publish'].includes(a))) throw new Error('用法：node scripts/publish-demo.mjs [--check|--publish]');
const ids = ['A01', 'A02', 'B01'];
const hash = b => createHash('sha256').update(b).digest('hex');
const check = (ok, why) => { if (!ok) throw new Error(why); };
const doc = async p => JSON.parse(await readFile(resolve(root, p), 'utf8'));
const [demo, tasks, qa, timeline] = await Promise.all([
  doc('work/three-line-demo-report.json'), doc('work/chatart-tasks.json'), doc('work/chatart-video-qa.json'), doc('work/lines.json'),
]);
check(demo.status === 'three_line_demo_completed' && demo.full_four_line_assembly === false, '缺少真实三句实测报告');
check(demo.duration === 19.2 && demo.parameters?.fps === 25 && demo.parameters?.frames === 480 && demo.parameters?.width === 1280 && demo.parameters?.height === 720, '三句输出参数不匹配');
check(demo.parameters.video_codec === 'h264' && demo.parameters.audio_codec === 'aac', '需要H264/AAC输出');
check(Object.values(demo.checks).every(v => v === true) && demo.media_review?.full_decode === 'passed', '媒体复核未完成');
const videoFile = resolve(root, 'final/libai-dufu-three-line-demo-v1.mp4');
check(resolve(demo.output).toLowerCase() === videoFile.toLowerCase(), '三句输出路径不匹配');
const video = await readFile(videoFile);
check(hash(video) === demo.sha256 && video.length === demo.size_bytes && video.toString('ascii', 4, 8) === 'ftyp', '最终视频SHA/长度/签名不一致');
const poster = await readFile(resolve(root, 'refs/poets-stage-v1.png'));
check(hash(poster) === demo.poster.sha256, '海报SHA不一致');
check(demo.shots.length === 3 && new Set(demo.shots.map(s => s.id)).size === 3, '三句必须包含三个独立真实镜头');
const clips = [];
for (const id of ids) {
  const shot = demo.shots.find(s => s.id === id), task = tasks.clips[id], rawQa = qa.clips[id], line = timeline.lines.find(l => l.id === id);
  check(shot && task?.status === 'downloaded' && rawQa && line, `${id}缺少下载、时间轴或原始筛查记录`);
  const raw = await readFile(resolve(root, `clips/${id}_t1.mp4`));
  check([shot.sha256, task.output_sha256, rawQa.video_sha256].every(s => s === hash(raw)), `${id}原片SHA链不一致`);
  check(hash(await readFile(resolve(root, `work/audio/${id}.mp3`))) === rawQa.audio_sha256, `${id}参考音频被改变`);
  check(task.model_label === rawQa.model_label, `${id}模型登记不一致`);
  const assembly = Object.fromEntries(['source_in', 'source_out', 'source_duration', 'slot_start', 'slot_end'].map(k => [k, shot[k]]));
  if (shot.retime) assembly.retime = { method: 'piecewise_linear_video_retime', control_points: shot.retime.control_points, sync_passed: false };
  const publicQa = Object.fromEntries(['audio_match', 'correlation', 'min_window_correlation', 'thresholds', 'suggested_picture_advance_seconds', 'manual_lip_review', 'video_sha256', 'audio_sha256', 'checked_at'].map(k => [k, rawQa[k]]));
  publicQa.scope = '原片音轨与输入人声的能量包络筛查，不是口型评分';
  clips.push({ id, actor: line.actor, text: line.text, start: line.start, end: line.end, heard_start: line.heard_start, heard_end: line.heard_end,
    status: 'completed', video_generated: true, provider: 'ChatArt', model_label: task.model_label, credits_displayed: task.credits_displayed,
    asset: { sha256: hash(raw), size_bytes: raw.length }, assembly, qa: publicQa });
}
check(clips.filter(c => c.model_label === 'MiniMax H3').length === 2 && clips.filter(c => c.model_label === 'Seedance 2.0 Fast').length === 1, '模型组合与真实三句不符');
check(hash(await readFile(resolve(root, 'work/music_final.wav'))) === demo.audio.sha256 && demo.audio.source_clip_audio_used === false, '统一配音来源不匹配');
const report = {
  schema_version: 1, title: '李白 × 杜甫 · 三句原创小样', status: 'partial-generated', generated_at: new Date().toISOString(),
  provenance: { kind: 'locally-produced', project_id: '011', experiment_id: '001-libai-dufu' },
  production: { image_provider: '内置 ImageGen · 3张原创参考图', voice_provider: 'MiniMax speech-2.8-turbo · 两种声线',
    video_provider: 'ChatArt 网页 · MiniMax H3 × 2 / Seedance 2.0 Fast × 1', music_provider: '本地原创合成节拍', bpm: 100, total_duration: 19.2 },
  video_service: { provider: 'ChatArt', status: 'partially_completed', created_tasks: 4, outputs_available: 3, full_four_line_assembly: false },
  clips,
  cost: { provider: 'ChatArt', video_credits_estimate: 285, returned_clip_credits_estimate: 210, video_credits_spent: null, credit_cap: 300, invoice_verified: false,
    note: '285钻石是四任务网页标价，三条已返回素材标价合计210；实际扣减及图像/TTS费用未核对。' },
  assets: { video: { path: 'media/own-libai-dufu-v1.mp4', size_bytes: video.length, sha256: hash(video), width: 1280, height: 720, fps: 25, video_codec: 'h264', audio_codec: 'aac' },
    poster: { path: 'media/own-poets-v1.png', sha256: hash(poster) } },
  assembly: { status: 'three_line_demo_completed', source_clips: 3, source_hashes_verified: true, final_hash_verified: true, intro_still_seconds: 2.4, outro_still_seconds: 2.4,
    unified_audio: true, full_four_line_assembly: false, audio_source_ranges: demo.audio.source_ranges, fade_out: demo.audio.output_fade_out },
  remote_generation: { provider: 'ChatArt', status: 'pending', submitted_clips: 4, outputs_available: 3, planned_credits: 285, credit_cap: 300,
    models: ['MiniMax H3', 'Seedance 2.0 Fast'], last_checked_at: tasks.last_checked_at,
    outputs: ids.map(id => ({ id, video_url: tasks.clips[id].source_media_url, model: tasks.clips[id].model_label })), actual_credit_debit_verified: false },
  limitations: [
    '当前交付为19.2秒三句实测：李白两句、杜甫一句。第四句B02尚未回传，完整四句交锋未完成。',
    '中间三句采用真实生成视频；片头片尾各2.4秒为原创静态共同舞台图。',
    'A01原始音轨筛查通过；A02与B01原始音轨筛查未通过，均保留失败结果，不作为精准口型成片。',
    'A02按两组声学活动对画面分段重定时，统一配音不变；B01保持原画面时间。抽帧、音轨相关性和tiny转写均不能证明逐音素准确。',
    '人声为节奏化TTS加原创100 BPM节拍，尚未使用Suno歌曲生成；人物与歌词为AI娱乐演绎。',
    '四任务网页标价合计285钻石，上限300，无重抽；实际总扣减和账单未核对。',
    '直接MiniMax API首条曾被HTTP402/2068拒绝；ChatArt网页另行生成，网页标注的后台模型实现未独立验证。',
  ],
};
if (args.includes('--publish')) {
  await mkdir(resolve(web, 'media'), { recursive: true });
  await mkdir(resolve(web, 'data'), { recursive: true });
  await copyFile(videoFile, resolve(web, 'media/own-libai-dufu-v1.mp4'));
  await writeFile(resolve(web, 'media/own-poets-v1.png'), poster);
  await writeFile(resolve(web, 'data/own-sample-run.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: args.includes('--publish') ? 'published_three_line_demo' : 'checked_only', sha256: hash(video), duration: 19.2, clips: 3, fourth_clip: 'pending', estimated_credits: 285 }, null, 2));
