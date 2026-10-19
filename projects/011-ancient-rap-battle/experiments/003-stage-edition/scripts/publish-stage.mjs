/** Publish a real stage re-edit; preserve 002 and never create generation tasks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { validateSongReport } from '../../../web/sample-report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.resolve(root, '../../web/public');
const baseRoot = path.resolve(root, '../002-moon-and-earth');
const mode = process.argv[2];
assert(process.argv.length === 3 && ['--check', '--publish'].includes(mode), '用法：node scripts/publish-stage.mjs --check|--publish');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(path.resolve(root, file), 'utf8'));
const local = value => {
  assert(typeof value === 'string' && value.trim(), '缺少003本地素材路径');
  const resolved = path.resolve(root, value), rel = path.relative(root, resolved);
  assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel), '舞台新增素材与输出必须留在003目录');
  return resolved;
};
const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'absolute_path').map(([key, item]) => [key, strip(item)])) : value;
const archiveHashes = {
  'history/002-jing-feng-shuang-v2.mp4': '88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e',
  'history/002-poets-v2.png': '807a064b780e0c12007e1e3469daad2e33eb004b2bafad247799bb4529f14d05',
  'history/002-run.json': '69fb6cb33ce2699bdcbbd80b39aa91ca9d9c420b5d87d5b52abb26ece4965a14',
};
for (const [name, expected] of Object.entries(archiveHashes)) assert.equal(hash(await fs.readFile(path.join(web, name))), expected, `第二版原字节归档缺失或变化：${name}`);
const base = JSON.parse(await fs.readFile(path.join(web, 'history/002-run.json'), 'utf8'));
validateSongReport(base);
const [report, timeline, manifest] = await Promise.all(['work/final-report.json', 'work/timeline.json', 'work/stage-manifest.json'].map(read));
assert.equal(report.status, 'completed', '舞台版尚无真实完成报告');
assert.equal(report.experiment_id, '003-stage-edition');
assert.equal(report.output, 'final/jing-feng-shuang-stage-v3.mp4');
assert.equal(timeline.status, 'confirmed');
assert.equal(timeline.experiment_id, '003-stage-edition');
assert.equal(manifest.status, 'approved-for-render');
assert(Object.keys(report.checks || {}).length >= 8 && Object.values(report.checks).every(value => value === true), '舞台成片检查未全部通过');
assert.equal(report.total_duration, 63.28); assert.equal(report.video_frames, 1582);
assert.equal(report.parameters.width, 1280); assert.equal(report.parameters.height, 720); assert.equal(report.parameters.fps, 25);
assert.equal(report.assembly.source_clips, 2); assert.equal(report.assembly.unique_lyric_shots, 4); assert.equal(report.assembly.performance_occurrences, 5);
assert.equal(report.audio.sha256, base.audio.sha256); assert.equal(report.audio.source_clip_audio_used, false);
assert.equal(report.audio.alignment.original_audio_trimmed_seconds, 0); assert.equal(report.audio.alignment.original_audio_speed, 1);
assert.equal(report.audio.gain_db, -1.5);
const music = await fs.readFile(path.resolve(root, timeline.audio.path));
assert.equal(hash(music), base.audio.sha256, '重剪必须继续使用同一完整原曲');
const movie = await fs.readFile(local(report.output));
assert.equal(hash(movie), report.sha256); assert.equal(movie.length, report.size_bytes);
assert.equal(movie.toString('ascii', 4, 8), 'ftyp');
assert.notEqual(report.sha256, base.assets.video.sha256, '不能把第二版原视频复制成舞台新版本');
const sources = report.source_files;
assert.equal(sources.length, 2);
assert.deepEqual(sources.map(item => item.sha256).sort(), base.source_files.map(item => item.sha256).sort(), '人物表演只沿用已核对的002两条原片');
for (const source of sources) {
  const resolved = path.resolve(root, source.path), rel = path.relative(baseRoot, resolved);
  assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel), '复用表演来源必须是002目录中的原文件');
  assert.equal(hash(await fs.readFile(resolved)), source.sha256);
  assert.equal(source.source_experiment, '002-moon-and-earth');
}
const sceneKeys = ['wide', 'duel', 'crowd', 'detail'];
const scenes = [];
for (const id of sceneKeys) {
  const scene = manifest.images?.[id]; assert(scene, `缺少已批准的舞台场景${id}`);
  const bytes = await fs.readFile(local(scene.path));
  assert.equal(hash(bytes), scene.sha256);
  assert(report.new_scene_assets.some(item => item.sha256 === scene.sha256), `${id}未记入成片素材来源`);
  assert(report.visual_timeline.some(item => item.type === 'instrumental_art_motion' && item.sha256 === scene.sha256), `${id}没有实际出现在成片`);
  assert(!base.visual_timeline.some(item => item.type === 'instrumental_art_motion' && item.sha256 === scene.sha256), '新场景不能由旧图片重复计数');
  scenes.push({ id, path: scene.path, sha256: scene.sha256 });
}
assert.equal(new Set(scenes.map(item => item.sha256)).size, 4);
const poster = await fs.readFile(local(report.inputs.poster.path));
assert.equal(hash(poster), manifest.images.wide.sha256);
assert.equal(hash(poster), report.inputs.poster.sha256);
assert.equal(hash(await fs.readFile(local('work/timeline.json'))), report.inputs.timeline.sha256);
assert.equal(report.stage_effects.generated_video, false);
assert.equal(hash(await fs.readFile(local(report.stage_effects.path))), report.stage_effects.sha256);
const ambience = report.stage_ambience;
assert.equal(typeof ambience?.enabled, 'boolean', '须明确舞台成片是否混入氛围声音');
assert.equal(ambience.enabled, manifest.stage_ambience?.enabled === true, '实际氛围混音须与批准清单一致');
if (ambience.enabled) {
  const approved = manifest.stage_ambience;
  assert.equal(approved.approved, true); assert.equal(ambience.approved, true);
  assert.equal(approved.source, 'local-synthesis'); assert.equal(ambience.new_melody, false);
  assert.equal(ambience.sha256, approved.sha256); assert.equal(ambience.gain_db, approved.gain_db);
  assert.equal(local(ambience.path), local(approved.path));
  assert.equal(hash(await fs.readFile(local(ambience.path))), ambience.sha256, '已混入合成氛围文件须核对真实SHA');
  assert(Array.isArray(report.audio.additions) && report.audio.additions.length === 1 && report.audio.additions[0].sha256 === ambience.sha256 && report.audio.additions[0].source === 'local-synthesis', '最终报告须把合成氛围单列为原歌曲之外的声音');
  const addition = report.audio.additions[0];
  assert.equal(local(addition.path), local(ambience.path)); assert.equal(addition.gain_db, ambience.gain_db);
  assert.equal(addition.start, 0); assert.equal(addition.end, report.total_duration);
} else assert(!report.audio.additions?.length, '未采用氛围声音时不得登记新增音效');
const changes = report.stage_direction?.changes;
assert.equal(report.stage_direction?.new_video_generation_calls, 0);
assert(Array.isArray(changes) && changes.length > 0 && changes.every(item => typeof item === 'string' && item.trim()), '须读取实际完成报告中的舞台改动');
const clips = base.clips.map(clip => {
  const occurrences = timeline.visual_timeline.filter(item => item.type === 'performance' && item.line_id === clip.id).map(item => {
    const shot = report.shots.find(entry => entry.id === item.id); assert(shot);
    return { id: item.id, start: item.start, end: item.end, heard_start: item.heard_start, heard_end: item.heard_end,
      source_sha256: shot.sha256, source_in: shot.source_in, source_out: shot.source_out,
      ...(shot.retime ? { retime: strip(shot.retime) } : {}) };
  });
  assert.equal(occurrences.length, clip.occurrences.length, '不应增删实际演唱次数');
  occurrences.forEach((item, index) => {
    const old = clip.occurrences[index];
    for (const key of ['id', 'start', 'end', 'heard_start', 'heard_end', 'source_sha256']) assert.equal(item[key], old[key], '舞台版必须保留原曲演唱与表演对应');
  });
  return { ...structuredClone(clip), assembly: strip(report.shots.find(item => item.id === occurrences[0].id)), occurrences };
});
const run = {
  ...structuredClone(base), title: report.title, generated_at: report.generated_at,
  provenance: { kind: 'locally-produced', project_id: '011', experiment_id: '003-stage-edition' },
  revision: { kind: 'stage-reedit', base_experiment_id: '002-moon-and-earth', base_video_sha256: base.assets.video.sha256,
    new_video_generation_calls: 0, new_scene_assets: scenes, changes },
  production: { ...base.production, image_provider: 'ImageGen · 4张新舞台场景，人物表演沿用第二版',
    video_provider: '第二版两条H3人物表演复用；本轮舞台与剪辑重制', total_duration: report.total_duration },
  video_service: { provider: 'local-reedit', status: 'completed', created_tasks: 0, reused_source_clips: 2 },
  cost: { provider: 'ChatArt', video_credits_estimate: 0, video_credits_spent: null, credit_cap: 0, invoice_verified: false,
    new_video_credits_estimate: 0, new_video_generation_calls: 0, reused_source_cost: structuredClone(base.cost),
    note: '本轮新增视频模型请求0次；沿用002两条原片的网页标价300钻石是既有素材历史记录，独立账单未核对。新图像与本地制作费用未单独核对。' },
  clips, source_files: strip(sources), visual_timeline: strip(report.visual_timeline), audio: strip(report.audio),
  stage_direction: strip(report.stage_direction), stage_effects: strip(report.stage_effects),
  stage_ambience: strip({ ...ambience, ...(ambience.enabled ? { source: manifest.stage_ambience.source } : {}) }),
  assembly: { ...strip(report.assembly), source_hashes_verified: true, final_hash_verified: true, unified_audio: true },
  assets: { video: { path: 'media/own-libai-dufu-v1.mp4', size_bytes: movie.length, sha256: report.sha256, width: 1280, height: 720, fps: 25, video_codec: 'h264', audio_codec: 'aac' },
    poster: { path: 'media/own-poets-v1.png', sha256: hash(poster) } },
  subtitles: report.subtitles, limitations: report.limitations,
};
delete run.remote_generation;
run.reused_generation = { experiment_id: '002-moon-and-earth', ...structuredClone(base.remote_generation) };
validateSongReport(run);

if (mode === '--publish') {
  const nonce = `${process.pid}-${Date.now()}`, lock = path.join(root, 'work/.publish-stage.lock');
  const guard = await fs.open(lock, 'wx'); await guard.close();
  const entries = [ ['media/own-libai-dufu-v1.mp4', movie], ['media/own-poets-v1.png', poster], ['data/own-sample-run.json', Buffer.from(JSON.stringify(run, null, 2) + '\n')] ]
    .map(([name, bytes]) => ({ name, bytes, target: path.join(web, name), replaced: false }));
  let keepBackups = false;
  try {
    for (const entry of entries) {
      entry.temporary = `${entry.target}.${nonce}.next`; entry.backup = `${entry.target}.${nonce}.backup`;
      await fs.copyFile(entry.target, entry.backup); await fs.writeFile(entry.temporary, entry.bytes, { flag: 'wx' });
    }
    for (const entry of entries) { await fs.rename(entry.temporary, entry.target); entry.replaced = true; }
    await fs.writeFile(path.join(root, 'work/publish-report.json'), JSON.stringify({ status: 'published-local', at: new Date().toISOString(), video_sha256: report.sha256,
      base_video_sha256: base.assets.video.sha256, new_video_generation_calls: 0, public_files: entries.map(entry => entry.name), deployed: false }, null, 2) + '\n');
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of entries.filter(item => item.replaced).reverse()) {
      try { await fs.copyFile(entry.backup, entry.target); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      keepBackups = true;
      throw new AggregateError([error, ...rollbackErrors], '发布回滚未完全完成，备份已保留在原文件旁。');
    }
    throw error;
  } finally {
    for (const entry of entries) {
      if (entry.temporary) await fs.unlink(entry.temporary).catch(() => {});
      if (entry.backup && !keepBackups) await fs.unlink(entry.backup).catch(() => {});
    }
    await fs.unlink(lock).catch(() => {});
  }
}
console.log(JSON.stringify({ status: mode === '--publish' ? 'published-local' : 'ready', experiment_id: '003-stage-edition',
  duration: report.total_duration, source_clips: 2, new_scene_assets: 4, new_video_generation_calls: 0,
  sha256: report.sha256, modified_public_files: mode === '--publish' ? 3 : 0, deployed: false }, null, 2));
