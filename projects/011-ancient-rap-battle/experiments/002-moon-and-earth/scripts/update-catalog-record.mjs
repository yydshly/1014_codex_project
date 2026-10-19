/**
 * 仅在002真实完成并已发布本地网页、截图保存后核对来源和总索引。
 * node scripts/update-catalog-record.mjs          # 默认--check，不写入
 * node scripts/update-catalog-record.mjs --check  # 不写入
 * node scripts/update-catalog-record.mjs --write  # 只更新项目来源JSON与根projects.json
 * 不调用模型、不改历史归档、不运行catalog sync/check、不修改根README。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const experiment = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.resolve(experiment, '../..'), repository = path.resolve(project, '../..'), web = path.join(project, 'web/public');
const args = process.argv.slice(2), mode = args[0] || '--check';
assert(args.length <= 1 && ['--check', '--write'].includes(mode), '用法：node scripts/update-catalog-record.mjs [--check|--write]');
const sourcePath = path.join(project, 'data/source-register.json'), catalogPath = path.join(repository, 'projects.json');
const currentRecord = 'web/public/data/own-sample-run.json', historicalRecord = 'web/public/history/001-run.json', baselineRecord = 'web/public/history/001-full-run.json';
const expected = {
  song: '91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8',
  historyRun: 'bb509a20fd81ecc7e126dbe13a13e8555333cf2b3143e5f9dbd7047965f105e3',
  historyVideo: 'ea4ed6b799176315c69a5505756117a61dca7d215fb91670d26bff900709d1a4',
  historyPoster: '0c1e7a6b62264024d5d63a0e0d73ddae8fd5b3ff5929c4aa1b53a76f52ed12a7',
  baseline: 'd3ff4396ae24c9b9540a006267232aebea738e112d34e02cacdfb964b42e0e37',
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8'));
const json = async file => parse(await fs.readFile(file));
const within = (base, value) => {
  assert(typeof value === 'string' && value, '缺少本地素材路径');
  const resolved = path.resolve(base, value), rel = path.relative(base, resolved);
  assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel), '来源路径越出约定目录');
  return resolved;
};
const relativeProject = file => path.relative(project, file).replaceAll('\\', '/');
const checkedAsset = async (file, hash, size) => {
  assert(/^[a-f0-9]{64}$/i.test(hash || ''), '缺少SHA-256');
  const bytes = await fs.readFile(file);
  assert(bytes.length > 32 && sha(bytes) === hash, `素材SHA不符：${relativeProject(file)}`);
  if (size !== undefined) assert.equal(bytes.length, size, '素材长度与记录不一致');
  return { path: relativeProject(file), sha256: hash, size_bytes: bytes.length };
};
const withoutAbsolutePaths = value => Array.isArray(value) ? value.map(withoutAbsolutePaths) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'absolute_path').map(([key, item]) => [key, withoutAbsolutePaths(item)])) : value;
const appendUnique = (array, value) => [...new Set([...(array || []), value])];
const numeric = value => typeof value === 'number' && Number.isFinite(value);

async function prepare() {
  const [sourceBytes, catalogBytes, runBytes, reportBytes, timeline, ledger, qa, visual, historyBytes, baselineBytes, imageSourcesBytes, screenshotBytes] = await Promise.all([
    fs.readFile(sourcePath), fs.readFile(catalogPath), fs.readFile(path.join(project, currentRecord)),
    fs.readFile(path.join(experiment, 'work/final-report.json')), json(path.join(experiment, 'work/timeline.json')),
    json(path.join(experiment, 'work/chatart-tasks.json')), json(path.join(experiment, 'work/video-qa.json')),
    json(path.join(experiment, 'work/visual-review.json')), fs.readFile(path.join(project, historicalRecord)),
    fs.readFile(path.join(project, baselineRecord)), fs.readFile(path.join(experiment, 'refs/GENERATION-SOURCES.md')),
    fs.readFile(path.join(project, 'assets/own-sample-v2.png')),
  ]);
  const register = parse(sourceBytes), catalog = parse(catalogBytes), run = parse(runBytes), report = parse(reportBytes), historyRun = parse(historyBytes), baseline = parse(baselineBytes);
  assert.equal(register.project_id, '011');
  assert.equal(run.schema_version, 1);
  assert.equal(run.status, 'completed', '网页主run尚未完成，拒绝更新来源和索引');
  assert.equal(run.provenance?.experiment_id, '002-moon-and-earth', '网页主run仍不是002真实成片');
  assert.equal(run.provenance?.project_id, '011');
  assert.equal(report.status, 'completed'); assert.equal(report.experiment_id, '002-moon-and-earth'); assert.equal(timeline.status, 'confirmed');
  assert(Object.keys(report.checks || {}).length && Object.values(report.checks).every(value => value === true), '成片参数核验未全部通过');
  assert.deepEqual(screenshotBytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'own-sample-v2.png不是有效PNG截图');
  assert(screenshotBytes.length > 1000, '网页截图为空或过小');
  assert.equal(run.assets?.video?.sha256, report.sha256);
  const currentVideo = await checkedAsset(within(web, run.assets.video.path), report.sha256, report.size_bytes);
  const finalVideo = await checkedAsset(within(experiment, report.output), report.sha256, report.size_bytes);
  assert(within(experiment, report.output).startsWith(path.join(experiment, 'final') + path.sep), '成片不在002/final中');
  assert.equal(run.assets.video.size_bytes, report.size_bytes);
  assert.equal(run.production?.total_duration, report.total_duration);
  assert.equal(run.assets.video.width, report.parameters.width); assert.equal(run.assets.video.height, report.parameters.height); assert.equal(run.assets.video.fps, report.parameters.fps);
  assert(report.parameters.width >= 1280 && report.parameters.height >= 720);
  const poster = await checkedAsset(within(web, run.assets.poster.path), run.assets.poster.sha256);
  assert.equal(run.assets.poster.sha256, report.inputs?.poster?.sha256);
  await checkedAsset(within(experiment, timeline.poster), report.inputs.poster.sha256);
  const song = await checkedAsset(within(experiment, timeline.audio.path), expected.song);
  assert.equal(ledger.source_song_sha256, expected.song); assert.equal(report.audio.sha256, expected.song); assert.equal(run.audio?.sha256, expected.song);
  for (const value of [report.audio.alignment, run.audio.alignment]) {
    assert.equal(value.original_audio_trimmed_seconds, 0); assert.equal(value.original_audio_speed, 1);
    assert(numeric(value.padding_seconds) && value.padding_seconds >= 0 && value.padding_seconds <= 1 / report.parameters.fps + 1 / 48000);
  }
  assert.equal(run.audio.gain_db, report.audio.gain_db); assert(numeric(run.audio.gain_db) && run.audio.gain_db >= -12 && run.audio.gain_db <= 0);
  assert.equal(run.audio.source_clip_audio_used, false);
  for (const assembly of [run.assembly, report.assembly]) {
    assert.equal(assembly.source_clips, 2); assert.equal(assembly.unique_lyric_shots, 4); assert.equal(assembly.performance_occurrences, 5);
  }
  assert.deepEqual(run.source_files, withoutAbsolutePaths(report.source_files));
  assert.deepEqual(run.visual_timeline, withoutAbsolutePaths(report.visual_timeline));
  assert.equal(run.clips.length, 4); assert.equal(new Set(run.clips.map(item => item.id)).size, 4);
  assert.equal(run.clips.reduce((sum, clip) => sum + clip.occurrences.length, 0), 5);
  assert.equal(ledger.tasks.length, 2); assert.deepEqual([...ledger.tasks.map(task => task.id)].sort(), ['A-block', 'B-block']);
  assert.equal(ledger.planned_credits, 300); assert.equal(ledger.credit_cap, 300);
  assert.equal(run.cost.provider, 'ChatArt'); assert.equal(run.cost.video_credits_estimate, ledger.planned_credits); assert.equal(run.cost.credit_cap, ledger.credit_cap);
  assert.equal(run.cost.invoice_verified, false); assert.equal(run.cost.video_credits_spent, null, '实际账单字段变化，需人工核对后再更新此闸门');
  assert.equal(ledger.tasks.reduce((sum, task) => sum + task.credits_displayed, 0), 300);
  const rawQa = [];
  for (const task of ledger.tasks) {
    assert(['A-block', 'B-block'].includes(task.id) && task.status === 'downloaded');
    assert.equal(task.model_label, 'MiniMax H3'); assert.equal(task.duration_requested, 10); assert.equal(task.credits_displayed, 150);
    const asset = await checkedAsset(within(experiment, task.clip), task.output_sha256, task.output_size_bytes);
    await checkedAsset(within(experiment, task.audio), task.audio_sha256);
    const entry = qa.clips?.[task.id], review = visual.clips?.[task.id];
    assert(entry && Object.hasOwn(entry, 'audio_match')); assert.equal(entry.video_sha256, task.output_sha256); assert.equal(entry.audio_sha256, task.audio_sha256);
    assert.equal(entry.native_audio_only, true); assert.equal(entry.raw_download_hash_matched_ledger, true);
    assert.equal(review?.video_sha256, task.output_sha256); assert.equal(review?.accepted_for_demo, true);
    assert(report.source_files.some(item => item.sha256 === task.output_sha256));
    for (const clip of run.clips.filter(item => item.source_task_id === task.id)) {
      assert.equal(clip.asset.sha256, task.output_sha256);
      for (const key of ['audio_match', 'correlation', 'min_window_correlation', 'suggested_picture_advance_seconds']) assert.deepEqual(clip.qa[key], entry[key], '网页QA和原片筛查不同，拒绝把失败转成通过');
    }
    rawQa.push({ id: task.id, asset, model_label: task.model_label, audio_sha256: task.audio_sha256,
      original_result: withoutAbsolutePaths(entry), visual_review: withoutAbsolutePaths(review) });
  }
  const imageNames = ['moon-and-earth-stage.png', 'libai-v2.png', 'dufu-v2.png', 'moonlit-city-v2.png', 'frost-and-poetry-v2.png'];
  const imageAssets = await Promise.all(imageNames.map(async name => {
    const file = path.join(experiment, 'refs', name), bytes = await fs.readFile(file), hash = sha(bytes);
    assert(imageSourcesBytes.toString('utf8').includes(hash), `原创图散列未出现在来源记录：${name}`);
    return { path: relativeProject(file), sha256: hash, size_bytes: bytes.length, source: '内置ImageGen原创图像；人物与场景不是历史容貌复原' };
  }));
  assert.equal(sha(historyBytes), expected.historyRun, '历史三句run必须保留原字节');
  assert.equal(historyRun.status, 'partial-generated'); assert.equal(historyRun.assets.video.sha256, expected.historyVideo);
  const historyVideo = await checkedAsset(path.join(web, 'history/001-three-line-demo.mp4'), expected.historyVideo);
  const historyPoster = await checkedAsset(path.join(web, 'history/001-poets.png'), expected.historyPoster);
  const baselineVideo = await checkedAsset(path.join(web, 'history/001-full-four-line-demo.mp4'), expected.baseline, 6374421);
  assert.equal(baseline.status, 'full_four_line_baseline_completed'); assert.equal(baseline.sha256, expected.baseline);
  assert.equal(baseline.duration, 24); assert.equal(baseline.parameters.fps, 24); assert.equal(baseline.parameters.frames, 576);
  assert.equal(baseline.all_four_tasks_downloaded, true); assert.equal(baseline.source_hashes_verified, true);
  assert.equal(baseline.raw_qa.A02.audio_match, false); assert.equal(baseline.raw_qa.B01.audio_match, false);
  const firstAssembly = await json(path.resolve(experiment, '../001-libai-dufu/work/assembly-report.json'));
  assert.equal(firstAssembly.status, 'completed'); assert.equal(firstAssembly.sha256, expected.baseline);
  await checkedAsset(path.resolve(experiment, '../001-libai-dufu/final/libai-dufu-sample-v1.mp4'), expected.baseline, 6374421);

  const records = Array.isArray(register.own_experiment_history) ? structuredClone(register.own_experiment_history) : [];
  let old = register.own_experiment?.id === '001-libai-dufu' && register.own_experiment.status === 'partial-generated'
    ? structuredClone(register.own_experiment) : records.find(item => item.history_key === '001-three-line-19.2s');
  assert(old && old.video?.sha256 === expected.historyVideo, '未找到原有三句own_experiment历史对象；拒绝丢弃历史来源');
  old = { ...old, history_key: '001-three-line-19.2s', historical: true, original_record: old.original_record || old.record, record: historicalRecord,
    archived_assets: { run: { path: historicalRecord, sha256: expected.historyRun, size_bytes: historyBytes.length }, video: historyVideo, poster: historyPoster,
      note: '归档run保留原字节，其内部assets.path是当时路径；实际历史文件位置以本外层archived_assets为准。' } };
  const full = { id: '001-libai-dufu', history_key: '001-full-four-line-24s', historical: true, status: 'completed', record: baselineRecord,
    result: 'experiments/001-libai-dufu/RESULT.md', video: { ...baselineVideo, ...baseline.parameters },
    duration: baseline.duration, full_four_line_assembly: true, upstream_media_used: false, lipsync_generated: true, lipsync_verified: false,
    archived_assets: { run: { path: baselineRecord, sha256: sha(baselineBytes), size_bytes: baselineBytes.length }, video: baselineVideo, poster: historyPoster },
    reviews: { assembly: 'experiments/001-libai-dufu/work/assembly-report.json', raw_audio_qa: 'experiments/001-libai-dufu/work/chatart-video-qa.json', qa_results: baseline.raw_qa },
    note: '24秒四句完整基线；A02/B01原QA失败保留，TTS与原创节拍，不等于上游完整歌曲制作复现。' };
  register.own_experiment_history = [...records.filter(item => !['001-three-line-19.2s', '001-full-four-line-24s'].includes(item.history_key)), old, full];
  register.own_experiment = { id: '002-moon-and-earth', status: run.status, record: currentRecord, record_sha256: sha(runBytes), result: 'experiments/002-moon-and-earth/README.md',
    production: run.production, video: run.assets.video, poster: run.assets.poster, upstream_media_used: false, lipsync_generated: true, lipsync_verified: false,
    full_four_line_assembly: true, source_song: { ...song, provider_claim: '用户自述Gemini生成，具体平台和模型未独立核验', audio: run.audio },
    original_images: { source_record: 'experiments/002-moon-and-earth/refs/GENERATION-SOURCES.md', source_record_sha256: sha(imageSourcesBytes), count: imageAssets.length, assets: imageAssets },
    assembly: run.assembly, source_files: run.source_files, visual_timeline: run.visual_timeline, subtitles: run.subtitles,
    remote_generation: run.remote_generation, cost: run.cost,
    evidence_sources: { final_report: 'experiments/002-moon-and-earth/work/final-report.json', final_report_sha256: sha(reportBytes), final_file: finalVideo,
      raw_tasks: 'experiments/002-moon-and-earth/work/chatart-tasks.json', raw_audio_qa: 'experiments/002-moon-and-earth/work/video-qa.json', visual_review: 'experiments/002-moon-and-earth/work/visual-review.json',
      cost: 'web/public/data/own-sample-run.json#cost；网页任务标价与余额观察，未核对独立账单' },
    reviews: { raw_results: rawQa, note: '原生混音筛查值原样保留；含伴奏的高相关不能证明歌词或逐音素口型准确。' }, limitations: run.limitations };
  register.scope.completed = (register.scope.completed || []).filter(item => !/ChatArt网页四条提交、三条|19\.2秒三句原创交锋|三条原音轨筛查/.test(item));
  for (const item of ['实验001四条真实原片下载、原生音轨筛查与24秒四句基线，原QA失败保留', '实验002用户完整歌曲、五张新原创图、两条H3源片、四词五次表演出现及诚实标注的图像运镜', '实验002完成本地成片与网页资源核验；未登记公网部署']) register.scope.completed = appendUnique(register.scope.completed, item);
  register.scope.not_executed = (register.scope.not_executed || []).filter(item => item !== '第四句B02本地审片与完整四句组装');
  register.scope.unverified = (register.scope.unverified || []).filter(item => !/第四句B02最后观察|真实歌曲自动对齐质量/.test(item));
  register.scope.unverified = appendUnique(register.scope.unverified, '真实歌曲逐字对齐、重唱口型与自动筛查准确性；ASR和音轨相关性不构成逐音素证明');
  register.local_additions = (register.local_additions || []).filter(item => !item.includes('三句实测交付及独立四句任务流程'));
  register.local_additions = appendUnique(register.local_additions, '实验001完整四句基线与实验002敬风霜完整歌曲人物短片；保留历史三句、原片QA及来源');
  const screenshot = { id: 'local-own-sample-v2', kind: 'local_browser_screenshot', path: 'assets/own-sample-v2.png', sha256: sha(screenshotBytes), size_bytes: screenshotBytes.length,
    purpose: '002完整音乐短片本地网页截图', note: '截图仅证明网页呈现；生成与声画检查依据原片及合成报告。' };
  register.media = [...(register.media || []).filter(item => item.id !== screenshot.id), screenshot];
  const items = catalog.projects.filter(item => item.id === '011'); assert.equal(items.length, 1); const entry = items[0];
  assert.equal(entry.slug, 'ancient-rap-battle');
  const originalCatalog = structuredClone(catalog), duration = Number(report.total_duration.toFixed(2));
  Object.assign(entry, { summary: `已制作《敬风霜》${duration}秒完整音乐短片：用户歌曲、五张新图、两段H3表演覆盖四句与末句复用，保留图像运镜及原片质检记录。`,
    preview: 'assets/own-sample-v2.png', preview_caption: '011《敬风霜》实际网页截图：完整用户歌曲、重新定制人物、真实生成表演与原创图像运镜；同页保留001历史基线。', status: '研究中', demo_url: null });
  const allowed = new Set(['summary', 'preview', 'preview_caption', 'status', 'demo_url']);
  for (let i = 0; i < catalog.projects.length; i++) {
    const before = originalCatalog.projects[i], after = catalog.projects[i];
    if (before.id !== '011') assert.deepEqual(after, before, '禁止修改其他项目');
    else for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) if (!allowed.has(key)) assert.deepEqual(after[key], before[key], `禁止修改011的${key}`);
  }
  return { sourceBytes, catalogBytes, register, catalog, video_sha256: report.sha256, duration };
}

async function writeBoth(prepared) {
  const lockPath = path.join(experiment, 'work/.catalog-record.lock'), lock = await fs.open(lockPath, 'wx'); await lock.close();
  const nonce = `${process.pid}-${Date.now()}`;
  const entries = [{ file: sourcePath, original: prepared.sourceBytes, next: prepared.register }, { file: catalogPath, original: prepared.catalogBytes, next: prepared.catalog }]
    .map(item => ({ ...item, temp: `${item.file}.${nonce}.tmp`, replaced: false }));
  try {
    for (const item of entries) { assert((await fs.readFile(item.file)).equals(item.original), '目标JSON已被其他任务改动，请重新运行核对'); await fs.writeFile(item.temp, `${JSON.stringify(item.next, null, 2)}\n`, { flag: 'wx' }); }
    for (const item of entries) assert((await fs.readFile(item.file)).equals(item.original), '写入前发现并发改动，已停止');
    for (const item of entries) { await fs.rename(item.temp, item.file); item.replaced = true; }
  } catch (error) {
    for (const item of entries.filter(item => item.replaced).reverse()) await fs.writeFile(item.file, item.original);
    throw error;
  } finally { for (const item of entries) await fs.unlink(item.temp).catch(() => {}); await fs.unlink(lockPath).catch(() => {}); }
}

try {
  const prepared = await prepare();
  if (mode === '--write') await writeBoth(prepared);
  console.log(JSON.stringify({ status: mode === '--write' ? 'records_updated' : 'ready_no_files_written', modified_files: mode === '--write' ? 2 : 0,
    video_sha256: prepared.video_sha256, duration: prepared.duration, preserved_history_records: 2, catalog_project: '011',
    note: '未修改历史媒体或run、其他项目字段、根README，未执行catalog sync/check。' }, null, 2));
} catch (error) { console.error(`来源与索引未更新：${error.message}`); process.exitCode = 2; }
