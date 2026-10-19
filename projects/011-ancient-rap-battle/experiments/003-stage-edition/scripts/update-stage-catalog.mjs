import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateSongReport } from '../../../web/sample-report.mjs';

const exp = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(exp, '../..');
const repo = resolve(project, '../..');
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const check = (ok, message) => { if (!ok) throw new Error(message); };
const rel = p => relative(project, p).replaceAll('\\', '/');
const asset = p => ({ path: rel(p), sha256: sha(p), size_bytes: readFileSync(p).length });
try {
  check(process.argv.length <= 3 && [undefined, '--check', '--write'].includes(process.argv[2]), '用法：node scripts/update-stage-catalog.mjs [--check|--write]');
  const publicRunPath = resolve(project, 'web/public/data/own-sample-run.json');
  const run = json(publicRunPath), final = json(resolve(exp, 'work/final-report.json'));
  validateSongReport(run);
  check(run.status === 'completed' && run.provenance.experiment_id === '003-stage-edition', '主播放器尚未发布003完成记录');
  check(final.status === 'completed' && Object.values(final.checks).every(v => v === true), '003正式媒体检查未全通过');
  check(sha(resolve(project, 'web/public/media/own-libai-dufu-v1.mp4')) === final.sha256 && run.assets.video.sha256 === final.sha256, '成片或主播放器SHA不一致');
  const review = json(resolve(exp, 'work/final-media-verification.json'));
  const browser = json(resolve(exp, 'work/browser-verification.json'));
  check(review.sha256 === final.sha256 && review.accepted_for_demo === true, '需先核验媒体并人工看过成片接触表');
  check(browser.film_sha256 === final.sha256 && browser.media_error === null && browser.viewport_restored === true, '需先完成003浏览器检查');
  check(existsSync(resolve(exp, 'work/final-audio-verification.json')), '缺少003最终混音核验');
  const preview = resolve(project, 'assets/own-sample-v3.png');
  check(readFileSync(preview).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), '003实际截图需为有效PNG');
  const srPath = resolve(project, 'data/source-register.json'), catalogPath = resolve(repo, 'projects.json');
  const originalSr = readFileSync(srPath, 'utf8'), originalCatalog = readFileSync(catalogPath, 'utf8');
  const source = JSON.parse(originalSr), catalog = JSON.parse(originalCatalog);
  const history = source.own_experiment_history || [];
  if (source.own_experiment.id === '002-moon-and-earth') {
    const old = structuredClone(source.own_experiment);
    check(old.video.sha256 === '88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e', '当前002来源与固定版本不符');
    const archive = {
      run: asset(resolve(project, 'web/public/history/002-run.json')),
      video: asset(resolve(project, 'web/public/history/002-jing-feng-shuang-v2.mp4')),
      poster: asset(resolve(project, 'web/public/history/002-poets-v2.png')),
      note: '归档run保留原字节，内部旧主路径代表当时状态；历史位置以此外层记录为准。',
    };
    check(archive.video.sha256 === old.video.sha256 && archive.run.sha256 === old.record_sha256 && archive.poster.sha256 === old.poster.sha256, '002历史三件套未原样保留');
    check(!history.some(x => x.id === old.id), '002历史已存在，拒绝重复添加');
    old.historical = true; old.history_key = '002-full-song-v2'; old.original_record = old.record;
    old.record = archive.run.path; old.archived_assets = archive; history.push(old);
  } else check(source.own_experiment.id === '003-stage-edition' && history.some(x => x.id === '002-moon-and-earth'), '仅允许从002推进到003或复核已有003');
  const priorSong = history.find(x => x.id === '002-moon-and-earth').source_song;
  const manifest = json(resolve(exp, 'work/stage-manifest.json'));
  source.own_experiment_history = history;
  source.own_experiment = {
    id: '003-stage-edition', status: 'completed', record: rel(publicRunPath), record_sha256: sha(publicRunPath),
    result: 'experiments/003-stage-edition/README.md', revision: run.revision,
    production: run.production, video: run.assets.video, poster: run.assets.poster,
    upstream_media_used: false, lipsync_generated: true, lipsync_verified: false, full_four_line_assembly: true,
    source_song: { ...priorSong, audio: run.audio },
    original_images: {
      inherited_source_record: 'experiments/002-moon-and-earth/refs/GENERATION-SOURCES.md',
      new_source_record: 'experiments/003-stage-edition/refs/generation-sources.json', new_count: 4,
      new_assets: Object.entries(manifest.images).map(([id, a]) => ({ id, ...asset(resolve(exp, a.path)) })),
    },
    assembly: run.assembly, source_files: run.source_files,
    original_qa_record: 'experiments/002-moon-and-earth/work/video-qa.json', original_qa_unchanged: true,
    cost: run.cost,
    verification: ['final-report.json','final-media-verification.json','final-audio-verification.json','browser-verification.json'].map(name => asset(resolve(exp, 'work', name))),
    note: '新增舞台图、镜头、灯光与合成现场效果；两条人物表演继承002，未新增视频生成；原片QA不因重剪改判。',
  };
  const rows = Array.isArray(catalog) ? catalog : catalog.projects;
  check(Array.isArray(rows), '总索引格式未知');
  const index = rows.findIndex(x => x.id === '011'); check(index >= 0, '缺少011索引');
  const beforeRows = structuredClone(rows);
  Object.assign(rows[index], {
    summary: '已制作《敬风霜》63.28秒舞台版：完整用户歌曲、双人舞台与观众反打，结合既有人物表演、灯光运镜及合成现场声；保留原版对照。',
    preview: 'assets/own-sample-v3.png',
    preview_caption: '011《敬风霜》舞台重剪实际网页截图：圆形舞台、观众、双人站位与灯光；人物表演沿用002，本轮未新增视频请求。',
    status: '研究中', demo_url: null,
  });
  check(rows.every((x, i) => i === index || isDeepStrictEqual(x, beforeRows[i])), '其他项目字段发生变化');
  if (process.argv[2] === '--write') {
    check(readFileSync(srPath, 'utf8') === originalSr && readFileSync(catalogPath, 'utf8') === originalCatalog, '并发写入，未修改来源与总索引');
    const srTemp = srPath + '.stage-v3.tmp', catTemp = catalogPath + '.stage-v3.tmp';
    writeFileSync(srTemp, JSON.stringify(source, null, 2) + '\n');
    writeFileSync(catTemp, JSON.stringify(catalog, null, 2) + '\n');
    try { renameSync(srTemp, srPath); renameSync(catTemp, catalogPath); }
    catch (error) { writeFileSync(srPath, originalSr); writeFileSync(catalogPath, originalCatalog); throw error; }
  }
  console.log(JSON.stringify({ status: process.argv[2] === '--write' ? 'records_updated' : 'ready_no_files_written', experiment: '003-stage-edition', sha256: final.sha256, preserved_history_records: history.length, other_projects_unchanged: true, deployed: false }, null, 2));
} catch (error) { console.error(`舞台版来源与索引未更新：${error.message}`); process.exitCode = 1; }
