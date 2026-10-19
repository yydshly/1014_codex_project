import { readFile, writeFile, copyFile, mkdir, rename, unlink, stat, open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// 离线发布闸门：默认只校验；全部真实素材和SHA一致后，显式--publish才替换网页预演。
// node scripts/publish.mjs --check
// node scripts/publish.mjs --publish
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, '../../web/public');
const expectedIds = ['A01', 'A02', 'B01', 'B02'];
const finalFile = resolve(root, 'final/libai-dufu-sample-v1.mp4');
const posterFile = resolve(root, 'refs/poets-stage-v1.png');
const args = process.argv.slice(2);
if (args.some(value => !['--check', '--publish'].includes(value)) || args.length > 1) throw new Error('用法：node scripts/publish.mjs [--check|--publish]；默认只校验');
const publish = args.includes('--publish');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const validSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const sameSha = (actual, expected, label) => requireValue(validSha(expected) && actual === expected.toLowerCase(), `${label}的SHA与记录不一致，请重新核查`);
const number = value => typeof value === 'number' && Number.isFinite(value);
const samePath = (actual, expected) => typeof actual === 'string' && resolve(root, actual).toLowerCase() === expected.toLowerCase();
async function document(path, optional = false) {
  try { return JSON.parse(await readFile(resolve(root, path), 'utf8')); }
  catch (error) { if (optional && error.code === 'ENOENT') return null; if (error.code === 'ENOENT') throw new Error(`缺少${path}；保留现有预演，等待真实素材完成`); throw new Error(`${path}无法读取为有效JSON`); }
}
async function bytes(path, label) {
  try { const value = await readFile(path); requireValue(value.length > 0, `${label}为空`); return value; }
  catch (error) { if (error.code === 'ENOENT') throw new Error(`缺少${label}；不会发布缺片或预演`); throw error; }
}
function actualQa(entry) {
  const output = { scope: '生成音轨与输入人声的能量包络比较，不是口型评分' };
  // 保留筛查原值，包括false、null、负偏移，绝不把“完成”转写为“质检通过”。
  for (const key of ['audio_match', 'correlation', 'min_window_correlation', 'suggested_picture_advance_seconds', 'compared_seconds', 'voiced_frames', 'generated_audio_seconds', 'reference_audio_seconds', 'video_bytes']) {
    if (Object.hasOwn(entry, key)) { const value = entry[key]; requireValue(value === null || typeof value === 'boolean' || number(value), `QA字段${key}类型不合法`); output[key] = value; }
  }
  if (entry.thresholds) {
    requireValue(number(entry.thresholds.overall) && number(entry.thresholds.min_window), 'QA阈值缺失');
    output.thresholds = { overall: entry.thresholds.overall, min_window: entry.thresholds.min_window };
  }
  if (Array.isArray(entry.windows)) output.windows = entry.windows.map(item => {
    requireValue(number(item.start) && number(item.correlation), 'QA短窗数据不合法');
    return { start: item.start, correlation: item.correlation };
  });
  if (entry.reason) {
    const known = ['音轨缺失、过短或有效声音/变化不足'];
    output.reason = known.includes(entry.reason) ? entry.reason : '详见本地筛查记录';
  }
  requireValue(typeof entry.manual_lip_review === 'string' && /^[a-z-]{1,40}$/.test(entry.manual_lip_review), 'QA人工口型复核状态未登记');
  output.manual_lip_review = entry.manual_lip_review;
  if (typeof entry.checked_at === 'string' && Number.isFinite(Date.parse(entry.checked_at))) output.checked_at = entry.checked_at;
  output.video_sha256 = entry.video_sha256;
  output.audio_sha256 = entry.audio_sha256;
  return output;
}
function shotWhitelist(shot) {
  const output = {};
  for (const key of ['source_duration', 'requested_advance_seconds', 'source_in', 'source_out', 'start_frame_hold_seconds', 'end_frame_hold_seconds', 'slot_start', 'slot_end', 'slot_duration']) {
    requireValue(number(shot[key]), `组装镜头${shot.id}缺少${key}`); output[key] = shot[key];
  }
  if (shot.retime !== undefined && shot.retime !== null) {
    requireValue(shot.id === 'A02', '本轮仅允许对A02登记分段重定时');
    const points = shot.retime.control_points;
    requireValue(Array.isArray(points) && points.length >= 2 && points.length <= 32, 'A02重定时需要2–32个source/target控制点');
    requireValue(Math.abs(shot.slot_duration - 4.8) < 1e-6 && shot.source_out > 0 && shot.source_out <= shot.source_duration + 1e-6, 'A02重定时源终点或4.8秒目标范围无效');
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      requireValue(Array.isArray(point) && point.length === 2 && point.every(number), `A02重定时控制点${i}必须是有限数值[source,target]`);
      requireValue(point[0] >= 0 && point[0] <= shot.source_out + 1e-6 && point[1] >= 0 && point[1] <= shot.slot_duration + 1e-6, `A02重定时控制点${i}超出真实源片或目标时长`);
      if (i > 0) requireValue(point[0] > points[i - 1][0] && point[1] > points[i - 1][1], 'A02重定时source与target必须各自严格递增');
    }
    requireValue(Math.abs(points[0][0]) < 1e-6 && Math.abs(points[0][1]) < 1e-6, 'A02重定时必须从[source=0,target=0]开始');
    const last = points.at(-1);
    requireValue(Math.abs(last[0] - shot.source_out) < 1e-6 && Math.abs(last[1] - 4.8) < 1e-6, 'A02重定时必须覆盖source_out真实源终点，并结束于target=4.8秒');
    output.retime = {
      control_points: points.map(point => [point[0], point[1]]),
      method: 'piecewise_linear_video_retime',
      reason: '依据A02输入与输出的两组声学活动区间对画面分段重定时；统一原始配音保持不变，不能证明逐音素准确。',
    };
  }
  return output;
}

async function prepare() {
  const assembly = await document('work/assembly-report.json');
  requireValue(assembly.status === 'completed', `组装尚未完成（${String(assembly.status || '无状态')}）；保留现有预演`);
  requireValue(!assembly.is_static_image_camera_preview && samePath(assembly.output, finalFile), '组装输出不是约定的真实四镜头成片');
  requireValue(Array.isArray(assembly.shots) && assembly.shots.length === 4 && new Set(assembly.shots.map(item => item.id)).size === 4 && expectedIds.every(id => assembly.shots.some(shot => shot.id === id)), '组装必须包含A01、A02、B01、B02四条真实镜头');
  requireValue(['dimensions', 'fps', 'duration', 'audio_codec'].every(key => assembly.checks?.[key] === true), '组装参数检查未全部通过');
  requireValue(number(assembly.total_duration) && Math.abs(assembly.total_duration - 24) < 0.05, '成片必须为约24秒');
  const parameters = assembly.parameters;
  requireValue(parameters?.width === 1280 && parameters.height === 720 && parameters.fps === 24 && parameters.video_codec === 'h264' && parameters.audio_codec === 'aac', '成片参数不符合本小样输出约定');
  const tasks = await document('work/chatart-tasks.json');
  const qaReport = await document('work/chatart-video-qa.json');
  const timeline = await document('work/lines.json');
  const audioRun = await document('work/audio-run.json');
  requireValue(qaReport.episode_id === '001-libai-dufu' && timeline.bpm === 100, 'QA或节拍记录不属于本次小样');
  requireValue(audioRun.model === 'speech-2.8-turbo' && expectedIds.every(id => audioRun.requests?.some(request => request.id === id && request.model === audioRun.model)), '缺少四句真实TTS制作记录');
  const finalBytes = await bytes(finalFile, '四镜头最终成片');
  const finalSha = sha(finalBytes);
  sameSha(finalSha, assembly.sha256, '成片');
  const preview = await document('work/preview-report.json', true);
  requireValue(!preview?.sha256 || preview.sha256.toLowerCase() !== finalSha, '最终文件仍是静态节奏预演，不能发布为真实小样');
  const posterBytes = await bytes(posterFile, '原创舞台封面');
  const posterSha = sha(posterBytes);
  requireValue(samePath(assembly.poster?.path, posterFile), '组装封面来源不一致');
  sameSha(posterSha, assembly.poster.sha256, '封面');
  const mixedAudio = await bytes(resolve(root, 'work/music_final.wav'), '统一人声与节拍混音');
  sameSha(sha(mixedAudio), assembly.audio?.sha256, '成片混音');
  requireValue(assembly.audio?.source_clip_audio_used === false, '组装必须使用本地统一混音');
  const publishedClips = [];
  let estimatedCredits = 0;
  for (const id of expectedIds) {
    const task = tasks.clips?.[id], entry = qaReport.clips?.[id], line = timeline.lines?.find(item => item.id === id), shot = assembly.shots.find(item => item.id === id);
    requireValue(task && ['downloaded', 'completed'].includes(task.status) && task.output, `${id}未登记为已下载；保留现有预演`);
    requireValue(entry && Object.hasOwn(entry, 'audio_match'), `${id}缺少真实音轨筛查记录`);
    requireValue(line && number(line.start) && number(line.end) && typeof line.text === 'string', `${id}歌词时间轴缺失`);
    const rawPath = resolve(root, `clips/${id}_t1.mp4`);
    requireValue(samePath(task.output, rawPath) && samePath(shot.path, rawPath) && samePath(entry.video, rawPath), `${id}任务、QA与组装素材路径不一致`);
    const rawBytes = await bytes(rawPath, `${id}真实原片`), rawSha = sha(rawBytes);
    sameSha(rawSha, shot.sha256, `${id}组装输入`);
    sameSha(rawSha, task.output_sha256, `${id}下载记录`);
    sameSha(rawSha, entry.video_sha256, `${id}筛查输入`);
    const audioBytes = await bytes(resolve(root, `work/audio/${id}.mp3`), `${id}参考人声`);
    sameSha(sha(audioBytes), entry.audio_sha256, `${id}筛查参考音频`);
    requireValue(number(shot.source_duration) && shot.source_duration > 0 && number(shot.source_stream?.width) && number(shot.source_stream?.height), `${id}缺少真实视频流参数`);
    requireValue(['MiniMax H3', 'Seedance 2.0 Fast'].includes(task.model_label) && task.model_label === entry.model_label, `${id}网页模型标签未登记或与QA不一致`);
    requireValue(number(task.credits_displayed) && task.credits_displayed >= 0, `${id}网页标价未登记`);
    estimatedCredits += task.credits_displayed;
    publishedClips.push({ id, actor: line.actor, text: line.text, start: line.start, end: line.end, heard_start: line.heard_start, heard_end: line.heard_end,
      status: 'completed', video_generated: true, provider: 'ChatArt', model_label: task.model_label, duration: shot.source_duration,
      resolution_label: task.resolution_label, ratio: task.ratio, credits_displayed: task.credits_displayed,
      asset: { sha256: rawSha, size_bytes: rawBytes.length }, assembly: shotWhitelist(shot), qa: actualQa(entry) });
  }
  const h3Count = publishedClips.filter(clip => clip.model_label === 'MiniMax H3').length;
  const fastCount = publishedClips.filter(clip => clip.model_label === 'Seedance 2.0 Fast').length;
  requireValue(h3Count === 3 && fastCount === 1 && estimatedCredits === 285, '实际模型或网页标价与本轮3条H3＋1条Fast／285钻石记录不符，需人工核对');
  const cost = { provider: 'ChatArt', video_credits_estimate: estimatedCredits, video_credits_spent: null, credit_cap: 300, invoice_verified: false,
    note: '285钻石为四任务网页标价合计，非已核对支出。图像与TTS费用未核对；直接API的10元计划估算不属于本网页支出。' };
  const observation = tasks.credit_observations;
  if (observation && [observation.initial_displayed, observation.after_A01_displayed, observation.difference].every(number)
    && observation.initial_displayed - observation.after_A01_displayed === observation.difference && observation.difference >= 0) {
    cost.observations = [{ coverage: 'A01', observed_delta_credits: observation.difference, observed_at: Number.isFinite(Date.parse(observation.observed_at)) ? observation.observed_at : null,
      scope: '已登记的网页余额显示差额，仅覆盖A01；不是四条任务的最终扣费或账单核对。' }];
  }
  const report = {
    schema_version: 1, title: '李白 × 杜甫 · 四句原创小样', status: 'completed', generated_at: new Date().toISOString(),
    provenance: { kind: 'locally-produced', project_id: '011', experiment_id: '001-libai-dufu' },
    production: { image_provider: '内置 ImageGen · 3张原创参考图', voice_provider: 'MiniMax speech-2.8-turbo · 两种声线',
      video_provider: 'ChatArt 网页 · MiniMax H3 × 3 / Seedance 2.0 Fast × 1', music_provider: '本地原创合成节拍', bpm: 100, total_duration: assembly.total_duration,
      models: [{ model: 'MiniMax H3', clips: h3Count }, { model: 'Seedance 2.0 Fast', clips: fastCount }] },
    video_service: { provider: 'ChatArt', status: 'completed', created_tasks: 4, outputs_available: 4, source: '网页标注模型；未直接调用这些模型的官方API' },
    clips: publishedClips, cost,
    assets: { video: { path: 'media/own-libai-dufu-v1.mp4', size_bytes: finalBytes.length, sha256: finalSha, width: parameters.width, height: parameters.height, fps: parameters.fps, video_codec: parameters.video_codec, audio_codec: parameters.audio_codec },
      poster: { path: 'media/own-poets-v1.png', sha256: posterSha } },
    assembly: { status: 'completed', source_clips: 4, source_hashes_verified: true, final_hash_verified: true, intro_still_seconds: 2.4, outro_still_seconds: 2.4, unified_audio: true },
    limitations: [
      '人声为节奏化TTS加本地原创100 BPM节拍，未使用Suno，也不代表完成歌曲生成链路。',
      '音轨相关性仅说明输出音轨与输入人声相似，不能证明逐音素口型准确；人工嘴形复核状态保留在每条QA中。',
      ...(publishedClips.some(clip => clip.id === 'A02' && clip.assembly.retime) ? ['A02原始音轨未通过相似度筛查，画面按两组声学活动分段重定时；不证明逐音素准确。'] : []),
      '片头与片尾各2.4秒使用原创静态舞台图；中间四句采用真实生成视频，偏移和补帧记录另列。',
      '285钻石是ChatArt四任务网页标价合计；实际总扣减和账单尚未核对。图像与TTS费用亦未核对。',
      '原片来自ChatArt网页标注的MiniMax H3和Seedance 2.0 Fast模型，未独立验证其后台模型实现。',
      '直接MiniMax API首条曾被HTTP402／2068拒绝；原API拒绝记录与本次网页生成记录独立保留。',
      '诗人外貌与四句歌词为原创AI娱乐演绎，不表示历史人物真实相貌或言论。',
    ],
  };
  return { report, finalBytes, posterBytes };
}

async function commit(prepared) {
  const destinations = [
    { path: resolve(web, 'media/own-libai-dufu-v1.mp4'), bytes: prepared.finalBytes },
    { path: resolve(web, 'media/own-poets-v1.png'), bytes: prepared.posterBytes },
    { path: resolve(web, 'data/own-sample-run.json'), bytes: Buffer.from(JSON.stringify(prepared.report, null, 2) + '\n') },
  ];
  const nonce = `${process.pid}-${Date.now()}`;
  const lock = resolve(root, 'work/.publish.lock');
  let handle;
  try { handle = await open(lock, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('另一个发布过程持有锁；未替换现有文件'); throw error; }
  await handle.close();
  const entries = destinations.map(item => ({ ...item, temp: `${item.path}.${nonce}.tmp`, backup: `${item.path}.${nonce}.backup.tmp`, existed: false, replaced: false }));
  let rollbackFailed = false;
  try {
    for (const entry of entries) {
      await mkdir(dirname(entry.path), { recursive: true });
      entry.existed = await stat(entry.path).then(value => value.isFile()).catch(error => { if (error.code === 'ENOENT') return false; throw error; });
      if (entry.existed) await copyFile(entry.path, entry.backup);
      await writeFile(entry.temp, entry.bytes, { flag: 'wx' });
    }
    for (const entry of entries) { await rename(entry.temp, entry.path); entry.replaced = true; }
  } catch (error) {
    for (const entry of entries.filter(item => item.replaced).reverse()) {
      try { if (entry.existed) await copyFile(entry.backup, entry.path); else await unlink(entry.path); }
      catch { rollbackFailed = true; }
    }
    if (rollbackFailed) throw new Error('发布失败且部分回滚未完成；原文件备份已保留为同目录.backup.tmp，请人工恢复');
    throw error;
  } finally {
    for (const entry of entries) {
      await unlink(entry.temp).catch(() => {});
      if (!rollbackFailed) await unlink(entry.backup).catch(() => {});
    }
    await unlink(lock).catch(() => {});
  }
}

try {
  const prepared = await prepare();
  if (publish) await commit(prepared);
  console.log(JSON.stringify({ status: publish ? 'published' : 'ready_for_explicit_publish', clips: 4, models: prepared.report.production.models,
    video_sha256: prepared.report.assets.video.sha256, video_credits_estimate: 285, video_credits_spent: null,
    output: 'web/public/media/own-libai-dufu-v1.mp4', record: 'web/public/data/own-sample-run.json', modified_files: publish ? 3 : 0,
    note: publish ? '真实四镜头成片与脱敏记录已替换网页预演。' : '仅校验，未覆盖现有预演；确认完成后显式添加--publish。' }, null, 2));
} catch (error) {
  console.error(`发布未进行：${error.message}`);
  process.exitCode = 2;
}
