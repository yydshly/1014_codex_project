import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer, basePath } from '../server.mjs';
import { validateSongReport } from '../sample-report.mjs';
import { validatePilotReport } from '../pilot-report.mjs';
import { validateStageFilmReport } from '../stage-film-report.mjs';
import { validateH3PilotReport } from '../h3-pilot-report.mjs';
import { validateRepairedFilmReport } from '../repaired-film-report.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(webRoot, 'dist');
const files = [
  'index.html', 'styles.css', 'app.js', 'sample-report.mjs', 'performance-report.mjs', 'pilot-report.mjs', 'stage-film-report.mjs', 'h3-pilot-report.mjs', 'favicon.svg',
  'data/004-h3-audio-pilot.json', 'repaired-film-report.mjs', 'data/004-repaired-film.json',
  'data/004-pilot-demo.json',
  'media/cover-16x9.jpg', 'media/frame-1.jpg', 'media/frame-2.jpg',
  'media/research-overview-011.png',
  'media/research-overview-011-preview.jpg', 'media/research-overview-011.svg',
  'data/research-overview-sources.json', 'docs/UNDERSTANDING.md',
  'media/demo-github.mp4',
  'docs/README.md', 'docs/RESEARCH.md', 'docs/SOURCES.md',
  'docs/VERIFICATION.md',
  'licenses/UPSTREAM-MIT.txt',
  'data/source-register.json',
  'history/001-three-line-demo.mp4', 'history/001-poets.png', 'history/001-run.json',
  'history/001-full-four-line-demo.mp4', 'history/001-full-run.json',
  'history/002-jing-feng-shuang-v2.mp4', 'history/002-poets-v2.png', 'history/002-run.json',
  'history/003-jing-feng-shuang-stage-v3.mp4', 'history/003-stage-v3.png', 'history/003-run.json',
];

for (const script of ['app.js', 'sample-report.mjs', 'performance-report.mjs', 'pilot-report.mjs', 'stage-film-report.mjs', 'h3-pilot-report.mjs', 'repaired-film-report.mjs', 'server.mjs', 'scripts/build.mjs', 'scripts/check.mjs', 'scripts/prepare-pilot-demo.mjs', 'scripts/prepare-stage-film.mjs', 'scripts/sync-stage-film.mjs', 'scripts/prepare-h3-pilot.mjs', 'scripts/prepare-repaired-progress.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(webRoot, script)], { stdio: 'pipe' });
}
for (const file of files) {
  const info = await stat(path.join(dist, file));
  assert(info.isFile() && info.size > 0, `静态产物缺失或为空：${file}`);
}
const videoPath = 'media/demo-github.mp4';
const videoInfo = await stat(path.join(dist, videoPath));
assert(videoInfo.size > 32, '上游示例视频为空或不完整。');
const videoFile = await open(path.join(dist, videoPath), 'r');
let firstBytes, lastBytes;
try {
  firstBytes = Buffer.alloc(32);
  lastBytes = Buffer.alloc(32);
  assert.equal((await videoFile.read(firstBytes, 0, 32, 0)).bytesRead, 32);
  assert.equal((await videoFile.read(lastBytes, 0, 32, videoInfo.size - 32)).bytesRead, 32);
} finally {
  await videoFile.close();
}
assert.equal(firstBytes.toString('ascii', 4, 8), 'ftyp', '示例视频不是有效的 MP4 文件签名。');

const registerText = await readFile(path.join(dist, 'data/source-register.json'), 'utf8');
const register = JSON.parse(registerText);
const videoSource = register.versioned_example_video;
assert(videoSource?.locally_hosted, '来源登记必须标明本地分发上游示例视频。');
assert.equal(videoInfo.size, videoSource.size_bytes, '视频大小与来源登记不同。');
assert.match(videoSource.sha256 || '', /^[a-f0-9]{64}$/i, '视频来源登记缺少 SHA-256 校验值。');
const videoHash = createHash('sha256');
for await (const chunk of createReadStream(path.join(dist, videoPath))) videoHash.update(chunk);
assert.equal(videoHash.digest('hex'), videoSource.sha256.toLowerCase(), '视频 SHA-256 与固定来源登记不同。');
const commits = [...registerText.matchAll(/\b[a-f0-9]{40}\b/gi)].map(match => match[0].toLowerCase());
assert(commits.length > 0, '来源登记必须包含完整的 40 位固定 commit SHA。');
const sourceSha = commits[0];
assert(!/ancient-rap-battle\/(?:blob|tree)\/(?:main|master|HEAD)(?:\/|["#?])/i.test(registerText), '来源登记的代码链接必须固定到 commit。');
for (const file of ['docs/README.md', 'docs/RESEARCH.md', 'docs/SOURCES.md']) {
  assert((await readFile(path.join(dist, file), 'utf8')).toLowerCase().includes(sourceSha), `${file} 未记录来源登记中的固定 SHA。`);
}

const html = await readFile(path.join(dist, 'index.html'), 'utf8');
assert.match(html, /<section\b[^>]*id="pilot-004"/, '需要独立可直达的004真实试片区。');
assert.match(html, /href="#pilot-004"/, '需要004实测导航入口。');
assert.match(html, /<section\b[^>]*id="stage-film-004"[^>]*\bhidden/, '004完整舞台版应默认隐藏，实际报告有效后展示。');
assert(html.indexOf('id="stage-film-004"') < html.indexOf('id="own-sample"'), '最新完整舞台版应位于003之前。');
assert(!/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html) && !/\sstyle\s*=|<style\b/i.test(html), '页面不得引入CSP禁止的内联脚本或样式。');
const pilotReport = JSON.parse(await readFile(path.join(dist, 'data/004-pilot-demo.json'), 'utf8'));
const pilotAssets = validatePilotReport(pilotReport);
assert.throws(() => validatePilotReport({ ...pilotReport, full_film_completed: true }), /不可宣称/);
assert.throws(() => validatePilotReport({ ...pilotReport, cost: { ...pilotReport.cost, actual_credits_spent: 225 } }), /费用须区分/);
const pilotMedia = [];
const h3Report = JSON.parse(await readFile(path.join(dist, 'data/004-h3-audio-pilot.json'), 'utf8'));
if (h3Report.prior_pending_snapshot) {
  const prior = JSON.parse(await readFile(path.join(dist, h3Report.prior_pending_snapshot), 'utf8'));
  assert.equal(prior.status, 'submitted-awaiting-output');
  assert.equal(prior.task.provider_task_id, h3Report.task.provider_task_id);
  assert.equal(prior.output, null);
  files.push(h3Report.prior_pending_snapshot);
}
const h3Assets = validateH3PilotReport(h3Report);
if (h3Report.status === 'pilot-accepted-by-user') {
  const acceptance = h3Report.evaluation.human_acceptance;
  const bytes = await readFile(path.join(dist, acceptance.public_evidence_path));
  const raw = JSON.parse(bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), acceptance.evidence_sha256);
  assert.equal(raw.acceptance.source, 'direct-human-user');
  assert.equal(raw.acceptance.trusted, true);
  assert.equal(raw.output_video_sha256, h3Report.output.sha256);
  assert.equal(raw.subjective_audio_review_claimed_by_agent, false);
  files.push(acceptance.public_evidence_path);
  assert.throws(() => validateH3PilotReport({ ...h3Report, evaluation: { ...h3Report.evaluation, human_acceptance: { ...acceptance, accepted_by: 'audio-correlation' } } }), /可信用户/);
} else assert.throws(() => validateH3PilotReport({ ...h3Report, evaluation: { ...h3Report.evaluation, singing_lip_sync_passed: true } }), /不能以已上传音频/);
assert.match(html, /<section\b[^>]*id="h3-audio-pilot"/, 'H3明确音频输入试验需要独立章节。');
for (const asset of h3Assets) {
  const content = await readFile(path.join(dist, asset.path));
  assert.equal(content.length, asset.bytes);
  assert.equal(createHash('sha256').update(content).digest('hex'), asset.sha256);
  if (/\.(wav|mp4)$/.test(asset.path)) pilotMedia.push({ ...asset, firstBytes: content.subarray(0, 32), lastBytes: content.subarray(-32) });
  files.push(asset.path);
}
const repairedReport = JSON.parse(await readFile(path.join(dist, 'data/004-repaired-film.json'), 'utf8'));
const repairedAssets = validateRepairedFilmReport(repairedReport);
assert.equal(html.includes('data-repaired-film-ready="true"'), repairedAssets.length > 0);
if (!repairedAssets.length) assert.match(html, /<section\b[^>]*id="repaired-film-004"[^>]*\bhidden/, '新修复版未到齐前须保持隐藏。');
for (const asset of repairedAssets) {
  const content = await readFile(path.join(dist, asset.path));
  assert.equal(content.length, asset.bytes);
  assert.equal(createHash('sha256').update(content).digest('hex'), asset.sha256);
  if (asset.path.endsWith('.mp4')) pilotMedia.push({ ...asset, firstBytes: content.subarray(0, 32), lastBytes: content.subarray(-32) });
  files.push(asset.path);
}
for (const asset of pilotAssets) {
  const content = await readFile(path.join(dist, asset.path));
  assert.equal(content.length, asset.bytes, `004资源字节数错误：${asset.path}`);
  assert.equal(createHash('sha256').update(content).digest('hex'), asset.sha256, `004资源SHA错误：${asset.path}`);
  if (asset.path.endsWith('.mp4')) assert.equal(content.toString('ascii', 4, 8), 'ftyp');
  if (/\.(mp4|mp3)$/.test(asset.path)) pilotMedia.push({ ...asset, firstBytes: content.subarray(0, 32), lastBytes: content.subarray(-32) });
  files.push(asset.path);
}
const stageFilmEnabled = html.includes('data-stage-film-ready="true"');
if (stageFilmEnabled) {
  const report = JSON.parse(await readFile(path.join(dist, 'data/004-stage-film.json'), 'utf8'));
  const stage = validateStageFilmReport(report);
  if (report.status === 'exported-visual-sample-singing-not-accepted') {
    assert(html.includes('嘴部不对应') && html.includes('不能作为合格演唱成果'), '用户拒收的演唱口型结论须在播放器上方直说。');
    assert.throws(() => validateStageFilmReport({ ...report, user_acceptance: { ...report.user_acceptance, singing_lip_sync_passed: true } }), /用户拒收/);
  }
  assert.throws(() => validateStageFilmReport({ ...report, presentation: { ...report.presentation, precise_lip_sync_claimed: true } }), /不宣称精准口型/);
  assert.throws(() => validateStageFilmReport({ ...report, generation: { ...report.generation, mv_feature_used: true } }), /不使用MV/);
  assert.throws(() => validateStageFilmReport({ ...report, visual_timeline: report.visual_timeline.slice(1) }), /连续/);
  files.push('data/004-stage-film.json');
  for (const asset of stage.assets) {
    const content = await readFile(path.join(dist, asset.path));
    assert.equal(content.length, asset.bytes, `004完整成片资源字节数错误：${asset.path}`);
    assert.equal(createHash('sha256').update(content).digest('hex'), asset.sha256, `004完整成片SHA错误：${asset.path}`);
    if (asset.path.endsWith('.mp4')) {
      assert.equal(content.toString('ascii', 4, 8), 'ftyp');
      pilotMedia.push({ ...asset, firstBytes: content.subarray(0, 32), lastBytes: content.subarray(-32) });
    }
    files.push(asset.path);
  }
} else {
  await assert.rejects(stat(path.join(dist, 'data/004-stage-film.json')), { code: 'ENOENT' }, '没有真实报告时不能残留旧的完整舞台版记录。');
}
assert(html.includes('data-own-history-ready="true"'), '首次实验历史留档应在构建校验后启用。');
assert.match(html, /<details\b[^>]*id="own-sample-history"[^>]*\bhidden/, '历史入口应在确认留档资源后展示。');
const historyVideoPath = 'history/001-three-line-demo.mp4';
const fullHistoryVideoPath = 'history/001-full-four-line-demo.mp4';
const songHistoryVideoPath = 'history/002-jing-feng-shuang-v2.mp4';
const stageHistoryVideoPath = 'history/003-jing-feng-shuang-stage-v3.mp4';
const historyHashes = {
  [historyVideoPath]: 'ea4ed6b799176315c69a5505756117a61dca7d215fb91670d26bff900709d1a4',
  'history/001-poets.png': '0c1e7a6b62264024d5d63a0e0d73ddae8fd5b3ff5929c4aa1b53a76f52ed12a7',
  'history/001-run.json': 'bb509a20fd81ecc7e126dbe13a13e8555333cf2b3143e5f9dbd7047965f105e3',
  [fullHistoryVideoPath]: 'd3ff4396ae24c9b9540a006267232aebea738e112d34e02cacdfb964b42e0e37',
  'history/001-full-run.json': '0f393d277e6c7c6db1a4bfda3c5e3a664cbf643152519794785b9b0e51360461',
  [songHistoryVideoPath]: '88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e',
  'history/002-poets-v2.png': '807a064b780e0c12007e1e3469daad2e33eb004b2bafad247799bb4529f14d05',
  'history/002-run.json': '69fb6cb33ce2699bdcbbd80b39aa91ca9d9c420b5d87d5b52abb26ece4965a14',
  [stageHistoryVideoPath]: '011c49f6527f84ca834ac319ad14bb97dd4a410b75a37729b00bf025382970d6',
  'history/003-stage-v3.png': '93f81dc4d6b4eb21c8c119e0825be461ce027325665da2122bc1ed5106e5cd49',
  'history/003-run.json': '145aaffd378e9af8b26fe472b3e9fa80568064c2cd7feb5a8f8db8fe9bfee8c8',
};
for (const [file, expected] of Object.entries(historyHashes)) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join(dist, file))) hash.update(chunk);
  assert.equal(hash.digest('hex'), expected, `首次实验原字节留档被改动：${file}`);
}
const historyReport = JSON.parse(await readFile(path.join(dist, 'history/001-run.json'), 'utf8'));
assert.equal(historyReport.provenance?.experiment_id, '001-libai-dufu');
assert.equal(historyReport.status, 'partial-generated');
assert.equal(historyReport.clips.length, 3);
const fullHistoryReport = JSON.parse(await readFile(path.join(dist, 'history/001-full-run.json'), 'utf8'));
assert.equal(fullHistoryReport.status, 'full_four_line_baseline_completed');
assert.equal(fullHistoryReport.duration, 24);
assert.equal(fullHistoryReport.parameters.frames, 576);
assert.equal(fullHistoryReport.full_decode, true);
assert.equal(fullHistoryReport.source_hashes_verified, true);
assert.equal(fullHistoryReport.sha256, historyHashes[fullHistoryVideoPath]);
const songHistoryReport = JSON.parse(await readFile(path.join(dist, 'history/002-run.json'), 'utf8'));
assert.equal(songHistoryReport.provenance?.experiment_id, '002-moon-and-earth');
validateSongReport(songHistoryReport);
assert.equal(songHistoryReport.assets.video.sha256, historyHashes[songHistoryVideoPath]);
const stageHistoryReport = JSON.parse(await readFile(path.join(dist, 'history/003-run.json'), 'utf8'));
assert.equal(stageHistoryReport.provenance?.experiment_id, '003-stage-edition');
validateSongReport(stageHistoryReport);
assert.equal(stageHistoryReport.assets.video.sha256, historyHashes[stageHistoryVideoPath]);
const historyVideos = [];
for (const file of [historyVideoPath, fullHistoryVideoPath, songHistoryVideoPath, stageHistoryVideoPath]) {
  const info = await stat(path.join(dist, file)), firstBytes = Buffer.alloc(32), lastBytes = Buffer.alloc(32);
  const handle = await open(path.join(dist, file), 'r');
  try {
    assert.equal((await handle.read(firstBytes, 0, 32, 0)).bytesRead, 32);
    assert.equal((await handle.read(lastBytes, 0, 32, info.size - 32)).bytesRead, 32);
    assert.equal(firstBytes.toString('ascii', 4, 8), 'ftyp');
  } finally { await handle.close(); }
  historyVideos.push({ file, info, firstBytes, lastBytes });
}
const ownSampleEnabled = html.includes('data-own-sample-ready="true"');
const ownVideoPath = 'media/own-libai-dufu-v1.mp4';
const ownImagePath = 'media/own-poets-v1.png';
const ownReportPath = 'data/own-sample-run.json';
let ownVideoInfo, ownFirstBytes, ownLastBytes, ownSampleStatus;
assert.match(html, /<section\b[^>]*id="own-sample"[^>]*\bhidden/, '可选小样须默认隐藏，待真实记录加载后展示。');
if (ownSampleEnabled) {
  for (const file of [ownVideoPath, ownImagePath, ownReportPath]) {
    const info = await stat(path.join(dist, file));
    assert(info.isFile() && info.size > 0, `自制小样资源缺失：${file}`);
  }
  const report = JSON.parse(await readFile(path.join(dist, ownReportPath), 'utf8'));
  assert.equal(report.schema_version, 1);
  assert(['completed', 'rhythm-preview', 'partial-generated'].includes(report.status), '只允许完整小样、如实标注的节奏预演或一到三句真实生成片段。');
  ownSampleStatus = report.status;
  const isPartial = report.status === 'partial-generated';
  const isFilm = report.provenance?.experiment_id === '004-performance-film';
  const expectedClipCount = (isPartial || isFilm) && Array.isArray(report.clips) ? report.clips.length : 4;
  const expectedClipStatus = report.status === 'rhythm-preview' ? 'audio-ready' : 'completed';
  assert(typeof report.title === 'string' && report.title.trim());
  assert(!Number.isNaN(Date.parse(report.generated_at)));
  assert(report.production && ['image_provider', 'voice_provider', 'video_provider'].every(key => typeof report.production[key] === 'string' && report.production[key].trim()), '缺少真实制作服务来源。');
  const isNewExperiment = ['002-moon-and-earth', '003-stage-edition', '004-performance-film'].includes(report.provenance?.experiment_id);
  if (report.production.music_mode !== undefined || isNewExperiment) assert(['minimax-song', 'tts-code-beat', 'user-supplied-song'].includes(report.production.music_mode), '音乐须明确为 MiniMax 歌曲生成、TTS 加代码伴奏或用户提供歌曲。');
  if (isNewExperiment) assert(typeof report.production.music_provider === 'string' && report.production.music_provider.trim(), '新作品缺少实际音乐模型或代码来源。');
  assert(Number.isFinite(report.production.bpm) && report.production.bpm > 0);
  assert(Number.isFinite(report.production.total_duration) && report.production.total_duration > 0);
  assert(Array.isArray(report.clips) && report.clips.length === expectedClipCount);
  if (isPartial) assert(expectedClipCount >= 1 && expectedClipCount <= 3);
  assert(report.clips.every(clip => typeof clip.id === 'string' && clip.id && clip.status === expectedClipStatus && clip.qa && typeof clip.qa === 'object' && !Array.isArray(clip.qa)));
  assert.equal(new Set(report.clips.map(clip => clip.id)).size, expectedClipCount);
  assert(report.clips.every(clip => typeof clip.actor === 'string' && clip.actor.trim() && typeof clip.text === 'string' && clip.text.trim()));
  if (isPartial) {
    assert(report.clips.every(clip => clip.video_generated === true), '部分生成状态必须是实际生成镜头。');
  }
  if (isNewExperiment) validateSongReport(report);
  for (const [file, asset] of [[ownVideoPath, report.assets?.video], [ownImagePath, report.assets?.poster]]) {
    assert.match(asset?.sha256 || '', /^[a-f0-9]{64}$/i, `小样资源缺少SHA：${file}`);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(dist, file))) hash.update(chunk);
    assert.equal(hash.digest('hex'), asset.sha256.toLowerCase(), `小样资源内容与报告不同：${file}`);
    if (asset.size_bytes !== undefined) assert.equal((await stat(path.join(dist, file))).size, asset.size_bytes);
  }
  const cost = report.cost;
  const validCny = cost && Number.isFinite(cost.video_estimate_cny) && cost.video_estimate_cny >= 0;
  const validCredits = cost?.provider === 'ChatArt' && ['video_credits_spent', 'video_credits_estimate'].some(key => Number.isFinite(cost[key]) && cost[key] >= 0);
  assert(validCny || validCredits, '缺少人民币原计划或 ChatArt 钻石记录。');
  if (report.remote_generation?.status === 'pending') {
    const remote = report.remote_generation;
    assert(Number.isInteger(remote.submitted_clips) && remote.submitted_clips >= 1 && remote.submitted_clips <= 4);
    assert(Number.isFinite(remote.planned_credits) && remote.planned_credits >= 0);
    assert(Number.isFinite(remote.credit_cap) && remote.credit_cap >= 0);
    assert(Array.isArray(remote.models) && remote.models.length);
    if (remote.outputs_available !== undefined) assert(Number.isInteger(remote.outputs_available) && remote.outputs_available >= 0 && remote.outputs_available <= remote.submitted_clips);
    if (remote.outputs !== undefined) {
      assert(Array.isArray(remote.outputs));
      for (const output of remote.outputs) {
        assert(typeof output?.id === 'string' && output.id.trim());
        assert.equal(typeof output.video_url, 'string');
        const url = new URL(output.video_url);
        assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, '原片只允许无凭据的 HTTP(S) 链接。');
      }
    }
  }
  assert(Array.isArray(report.limitations) && report.limitations.length && report.limitations.every(text => typeof text === 'string' && text.trim()));
  if (report.provenance) {
    assert.equal(report.provenance.kind, 'locally-produced');
    assert.equal(report.provenance.project_id, '011');
  }
  const imageFile = await open(path.join(dist, ownImagePath), 'r');
  try {
    const header = Buffer.alloc(8);
    assert.equal((await imageFile.read(header, 0, 8, 0)).bytesRead, 8);
    assert(header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), '自制参考图 PNG 签名无效。');
  } finally { await imageFile.close(); }
  ownVideoInfo = await stat(path.join(dist, ownVideoPath));
  assert(ownVideoInfo.size > 32);
  const ownVideoFile = await open(path.join(dist, ownVideoPath), 'r');
  try {
    ownFirstBytes = Buffer.alloc(32);
    ownLastBytes = Buffer.alloc(32);
    assert.equal((await ownVideoFile.read(ownFirstBytes, 0, 32, 0)).bytesRead, 32);
    assert.equal((await ownVideoFile.read(ownLastBytes, 0, 32, ownVideoInfo.size - 32)).bytesRead, 32);
    assert.equal(ownFirstBytes.toString('ascii', 4, 8), 'ftyp');
  } finally { await ownVideoFile.close(); }
  files.push(ownVideoPath, ownImagePath, ownReportPath);
} else {
  for (const file of [ownVideoPath, ownImagePath, ownReportPath]) {
    await assert.rejects(stat(path.join(dist, file)), { code: 'ENOENT' }, '未激活时不应残留旧小样。');
  }
}
const localResources = new Set();
for (const match of html.matchAll(/<(?:script|link|img|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
  const reference = match[1].split(/[?#]/, 1)[0];
  if (!reference || /^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
  assert(!reference.startsWith('/'), `网页资源应使用相对路径以支持编号子路径：${reference}`);
  const resolved = path.resolve(dist, reference);
  assert(!path.relative(dist, resolved).startsWith('..'), `网页资源超出静态目录：${reference}`);
  assert((await stat(resolved)).isFile(), `网页引用了缺失资源：${reference}`);
  localResources.add(reference.replace(/^(?:\.\/)+/, ''));
}
assert(localResources.has('styles.css') && localResources.has('app.js'), '页面应引用相对路径的 styles.css 和 app.js。');

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const prefix of ['', basePath]) {
    const response = await fetch(`${origin}${prefix}/`);
    assert.equal(response.status, 200, `入口不可访问：${prefix || '/'}`);
    assert.equal(await response.text(), html, '入口内容与静态构建不同。');
    for (const file of files.filter(file => file !== 'index.html' && file !== videoPath && file !== ownVideoPath && !historyVideos.some(item => item.file === file) && !pilotMedia.some(item => item.path === file))) {
      const resource = await fetch(`${origin}${prefix}/${file}`);
      assert.equal(resource.status, 200, `资源不可访问：${prefix}/${file}`);
      assert((await resource.arrayBuffer()).byteLength > 0, `HTTP 资源为空：${file}`);
    }
    const head = await fetch(`${origin}${prefix}/styles.css`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.match(head.headers.get('content-type') || '', /^text\/css/);
    assert.equal((await head.arrayBuffer()).byteLength, 0, 'HEAD 不应返回消息正文。');
    for (const media of pilotMedia) {
      const url = `${origin}${prefix}/${media.path}`;
      const mime = media.path.endsWith('.mp4') ? 'video/mp4' : media.path.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
      const response = await fetch(url, { method: 'HEAD' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), mime);
      assert.equal(response.headers.get('content-length'), String(media.bytes));
      assert.equal(response.headers.get('accept-ranges'), 'bytes');
      assert.equal((await response.arrayBuffer()).byteLength, 0);
      for (const [range, start, end, expected] of [
        ['bytes=0-31', 0, 31, media.firstBytes],
        ['bytes=-32', media.bytes - 32, media.bytes - 1, media.lastBytes],
      ]) {
        const part = await fetch(url, { headers: { Range: range } });
        assert.equal(part.status, 206);
        assert.equal(part.headers.get('content-type'), mime);
        assert.equal(part.headers.get('content-range'), `bytes ${start}-${end}/${media.bytes}`);
        assert.deepEqual(Buffer.from(await part.arrayBuffer()), expected);
      }
    }
    const videoUrl = `${origin}${prefix}/${videoPath}`;
    const videoHead = await fetch(videoUrl, { method: 'HEAD' });
    assert.equal(videoHead.status, 200);
    assert.equal(videoHead.headers.get('content-type'), 'video/mp4');
    assert.equal(videoHead.headers.get('content-length'), String(videoInfo.size));
    assert.equal(videoHead.headers.get('accept-ranges'), 'bytes');
    assert.equal((await videoHead.arrayBuffer()).byteLength, 0);
    for (const [range, start, end, expected] of [
      ['bytes=0-31', 0, 31, firstBytes],
      [`bytes=${videoInfo.size - 32}-`, videoInfo.size - 32, videoInfo.size - 1, lastBytes],
      ['bytes=-32', videoInfo.size - 32, videoInfo.size - 1, lastBytes],
    ]) {
      const part = await fetch(videoUrl, { headers: { Range: range } });
      assert.equal(part.status, 206, `视频范围请求失败：${range}`);
      assert.equal(part.headers.get('content-type'), 'video/mp4');
      assert.equal(part.headers.get('content-range'), `bytes ${start}-${end}/${videoInfo.size}`);
      assert.equal(part.headers.get('content-length'), '32');
      assert.equal(part.headers.get('accept-ranges'), 'bytes');
      assert.deepEqual(Buffer.from(await part.arrayBuffer()), expected, `视频范围内容不匹配：${range}`);
    }
    for (const range of [`bytes=${videoInfo.size}-`, 'bytes=9-2', 'bytes=-0', 'bytes=0-1,3-4', 'invalid']) {
      const invalid = await fetch(videoUrl, { headers: { Range: range } });
      assert.equal(invalid.status, 416, `无效范围应返回 416：${range}`);
      assert.equal(invalid.headers.get('content-range'), `bytes */${videoInfo.size}`);
      await invalid.arrayBuffer();
    }
    for (const history of historyVideos) {
      const historyUrl = `${origin}${prefix}/${history.file}`;
      const historyHead = await fetch(historyUrl, { method: 'HEAD' });
      assert.equal(historyHead.status, 200);
      assert.equal(historyHead.headers.get('content-type'), 'video/mp4');
      assert.equal(historyHead.headers.get('content-length'), String(history.info.size));
      assert.equal((await historyHead.arrayBuffer()).byteLength, 0);
      for (const [range, start, end, expected] of [
        ['bytes=0-31', 0, 31, history.firstBytes],
        ['bytes=-32', history.info.size - 32, history.info.size - 1, history.lastBytes],
      ]) {
        const part = await fetch(historyUrl, { headers: { Range: range } });
        assert.equal(part.status, 206);
        assert.equal(part.headers.get('content-range'), `bytes ${start}-${end}/${history.info.size}`);
        assert.deepEqual(Buffer.from(await part.arrayBuffer()), expected);
      }
    }
    if (ownSampleEnabled) {
      const ownUrl = `${origin}${prefix}/${ownVideoPath}`;
      const ownHead = await fetch(ownUrl, { method: 'HEAD' });
      assert.equal(ownHead.status, 200);
      assert.equal(ownHead.headers.get('content-type'), 'video/mp4');
      assert.equal(ownHead.headers.get('content-length'), String(ownVideoInfo.size));
      assert.equal((await ownHead.arrayBuffer()).byteLength, 0);
      for (const [range, start, end, expected] of [
        ['bytes=0-31', 0, 31, ownFirstBytes],
        ['bytes=-32', ownVideoInfo.size - 32, ownVideoInfo.size - 1, ownLastBytes],
      ]) {
        const part = await fetch(ownUrl, { headers: { Range: range } });
        assert.equal(part.status, 206);
        assert.equal(part.headers.get('content-type'), 'video/mp4');
        assert.equal(part.headers.get('content-range'), `bytes ${start}-${end}/${ownVideoInfo.size}`);
        assert.deepEqual(Buffer.from(await part.arrayBuffer()), expected);
      }
    }
  }
  assert.equal((await fetch(`${origin}${basePath}`, { redirect: 'manual' })).status, 308);
  assert.equal((await fetch(`${origin}/missing-resource`)).status, 404);
  assert.equal((await fetch(`${origin}/`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${origin}/%2e%2e%5cREADME.md`)).status, 403);
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
console.log(`检查通过：JavaScript 语法、${files.length} 个产物、固定来源 ${sourceSha}、两种入口、MP4 签名与字节范围播放均有效。`);
console.log(ownSampleEnabled ? `${ownSampleStatus === 'rhythm-preview' ? '节奏预演（非口型成片）' : (ownSampleStatus === 'partial-generated' ? '主播放器保留部分生成历史版' : '自制成片')}：状态记录、制作来源、PNG/MP4 与两入口分段播放均有效。` : '自制小样：尚未激活，不影响现有上游视频与研究功能。');
console.log('首次两版、完整歌曲原版与舞台重剪版：原字节校验通过，四条历史视频支持两入口分段播放。');
console.log('004早期快照：试片状态、费用预留、11份媒体SHA，以及4条视频和原曲的两入口首尾Range请求均通过。');
console.log(stageFilmEnabled ? '004视觉样片：来源、导出、原曲、预算与播放检查通过；用户验收演唱口型未通过，拒收结论保留。' : '004视觉样片：真实报告尚未接入，独立播放区隐藏。');
console.log(h3Report.status === 'pilot-accepted-by-user' ? 'H3试片：可信用户试听反馈与真实SHA匹配，仅该试片的用户确认保留；代理主观听音仍未主张。' : 'H3试验：状态、原片、对照、WAV和Range检查通过，待试听验收。');
console.log(repairedAssets.length ? '新94.64秒修复版：实际视频、封面、来源和两入口Range检查通过；整片用户验收另行记录。' : '新修复版：素材制作中，完整播放区隐藏。');
