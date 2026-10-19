import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSongReport } from '../sample-report.mjs';
import { validatePilotReport } from '../pilot-report.mjs';
import { validateStageFilmReport } from '../stage-film-report.mjs';
import { validateH3PilotReport } from '../h3-pilot-report.mjs';
import { validateRepairedFilmReport } from '../repaired-film-report.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.dirname(webRoot);
const dist = path.join(webRoot, 'dist');
const files = [
  ['index.html', 'index.html'],
  ['styles.css', 'styles.css'],
  ['app.js', 'app.js'],
  ['sample-report.mjs', 'sample-report.mjs'],
  ['performance-report.mjs', 'performance-report.mjs'],
  ['pilot-report.mjs', 'pilot-report.mjs'],
  ['stage-film-report.mjs', 'stage-film-report.mjs'],
  ['h3-pilot-report.mjs', 'h3-pilot-report.mjs'],
  ['repaired-film-report.mjs', 'repaired-film-report.mjs'],
  ['public/data/004-repaired-film.json', 'data/004-repaired-film.json'],
  ['public/data/004-h3-audio-pilot.json', 'data/004-h3-audio-pilot.json'],
  ['public/data/004-pilot-demo.json', 'data/004-pilot-demo.json'],
  ['public/favicon.svg', 'favicon.svg'],
  ['public/media/cover-16x9.jpg', 'media/cover-16x9.jpg'],
  ['public/media/frame-1.jpg', 'media/frame-1.jpg'],
  ['public/media/frame-2.jpg', 'media/frame-2.jpg'],
  ['../assets/ancient-rap-battle-research-overview.png', 'media/research-overview-011.png'],
  ['../assets/ancient-rap-battle-research-overview-preview.jpg', 'media/research-overview-011-preview.jpg'],
  ['../assets/ancient-rap-battle-research-overview.svg', 'media/research-overview-011.svg'],
  ['../assets/ancient-rap-battle-research-overview-sources.json', 'data/research-overview-sources.json'],
  ['../UNDERSTANDING.md', 'docs/UNDERSTANDING.md'],
  ['public/media/demo-github.mp4', 'media/demo-github.mp4'],
  ['../README.md', 'docs/README.md'],
  ['../RESEARCH.md', 'docs/RESEARCH.md'],
  ['../SOURCES.md', 'docs/SOURCES.md'],
  ['../VERIFICATION.md', 'docs/VERIFICATION.md'],
  ['../licenses/UPSTREAM-MIT.txt', 'licenses/UPSTREAM-MIT.txt'],
  ['../data/source-register.json', 'data/source-register.json'],
  ['public/history/001-three-line-demo.mp4', 'history/001-three-line-demo.mp4'],
  ['public/history/001-poets.png', 'history/001-poets.png'],
  ['public/history/001-run.json', 'history/001-run.json'],
  ['public/history/001-full-four-line-demo.mp4', 'history/001-full-four-line-demo.mp4'],
  ['public/history/001-full-run.json', 'history/001-full-run.json'],
  ['public/history/002-jing-feng-shuang-v2.mp4', 'history/002-jing-feng-shuang-v2.mp4'],
  ['public/history/002-poets-v2.png', 'history/002-poets-v2.png'],
  ['public/history/002-run.json', 'history/002-run.json'],
  ['public/history/003-jing-feng-shuang-stage-v3.mp4', 'history/003-jing-feng-shuang-stage-v3.mp4'],
  ['public/history/003-stage-v3.png', 'history/003-stage-v3.png'],
  ['public/history/003-run.json', 'history/003-run.json'],
];
const ownSampleFiles = [
  ['public/media/own-libai-dufu-v1.mp4', 'media/own-libai-dufu-v1.mp4'],
  ['public/media/own-poets-v1.png', 'media/own-poets-v1.png'],
  ['public/data/own-sample-run.json', 'data/own-sample-run.json'],
];

const pilotReport = JSON.parse(await readFile(path.join(webRoot, 'public/data/004-pilot-demo.json'), 'utf8'));
for (const asset of validatePilotReport(pilotReport)) {
  const content = await readFile(path.join(webRoot, 'public', asset.path));
  if (content.length !== asset.bytes || createHash('sha256').update(content).digest('hex') !== asset.sha256) throw new Error(`004试片快照与真实证据不符：${asset.path}`);
  if (asset.path.endsWith('.mp4') && content.toString('ascii', 4, 8) !== 'ftyp') throw new Error(`004视频签名无效：${asset.path}`);
  if (asset.path.endsWith('.png') && !content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`004参考图签名无效：${asset.path}`);
  files.push([`public/${asset.path}`, asset.path]);
}
const h3Report = JSON.parse(await readFile(path.join(webRoot, 'public/data/004-h3-audio-pilot.json'), 'utf8'));
if (h3Report.prior_pending_snapshot) files.push([`public/${h3Report.prior_pending_snapshot}`, h3Report.prior_pending_snapshot]);
if (h3Report.evaluation?.human_acceptance) {
  const acceptance = h3Report.evaluation.human_acceptance;
  const bytes = await readFile(path.join(webRoot, 'public', acceptance.public_evidence_path));
  if (createHash('sha256').update(bytes).digest('hex') !== acceptance.evidence_sha256) throw new Error('H3用户试听验收实际证据SHA不符。');
  files.push([`public/${acceptance.public_evidence_path}`, acceptance.public_evidence_path]);
}
for (const asset of validateH3PilotReport(h3Report)) {
  const content = await readFile(path.join(webRoot, 'public', asset.path));
  if (content.length !== asset.bytes || createHash('sha256').update(content).digest('hex') !== asset.sha256) throw new Error(`H3试验资源与事实快照不符：${asset.path}`);
  if (asset.path.endsWith('.wav') && (content.toString('ascii', 0, 4) !== 'RIFF' || content.toString('ascii', 8, 12) !== 'WAVE')) throw new Error('H3输入音频不是WAV。');
  files.push([`public/${asset.path}`, asset.path]);
}
const repairedReport = JSON.parse(await readFile(path.join(webRoot, 'public/data/004-repaired-film.json'), 'utf8'));
const repairedAssets = validateRepairedFilmReport(repairedReport);
const repairedFilmEnabled = repairedAssets.length > 0;
for (const asset of repairedAssets) {
  const content = await readFile(path.join(webRoot, 'public', asset.path));
  if (content.length !== asset.bytes || createHash('sha256').update(content).digest('hex') !== asset.sha256) throw new Error('新修复版文件与实际记录不同。');
  files.push([`public/${asset.path}`, asset.path]);
}

// The new stage edition has its own honest montage contract. Earlier lip-sync results stay unchanged.
let stageFilmEnabled = false;
const stageReportPath = 'public/data/004-stage-film.json';
const stageReportInfo = await stat(path.join(webRoot, stageReportPath)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
if (stageReportInfo?.isFile()) {
  const stageReport = JSON.parse(await readFile(path.join(webRoot, stageReportPath), 'utf8'));
  for (const asset of validateStageFilmReport(stageReport).assets) {
    const content = await readFile(path.join(webRoot, 'public', asset.path));
    if (content.length !== asset.bytes || createHash('sha256').update(content).digest('hex') !== asset.sha256) throw new Error(`004完整舞台版与真实文件不符：${asset.path}`);
    if (asset.path.endsWith('.mp4') && content.toString('ascii', 4, 8) !== 'ftyp') throw new Error('004完整舞台版MP4签名无效。');
    files.push([`public/${asset.path}`, asset.path]);
  }
  files.push([stageReportPath, 'data/004-stage-film.json']);
  stageFilmEnabled = true;
}

function validateOwnReport(report) {
  const fail = message => { throw new Error(`自制小样记录无效：${message}`); };
  if (report.schema_version !== 1 || !['completed', 'rhythm-preview', 'partial-generated'].includes(report.status)) fail('需要 schema_version=1 和 completed、rhythm-preview 或 partial-generated 状态。');
  const isPartial = report.status === 'partial-generated';
  const isFilm = report.provenance?.experiment_id === '004-performance-film';
  const expectedClipCount = (isPartial || isFilm) && Array.isArray(report.clips) ? report.clips.length : 4;
  const expectedClipStatus = report.status === 'rhythm-preview' ? 'audio-ready' : 'completed';
  if (typeof report.title !== 'string' || !report.title.trim() || Number.isNaN(Date.parse(report.generated_at))) fail('缺少标题或有效生成时间。');
  const production = report.production;
  if (!production || ['image_provider', 'voice_provider', 'video_provider'].some(key => typeof production[key] !== 'string' || !production[key].trim())) fail('缺少图片、人声或视频来源。');
  const isNewExperiment = ['002-moon-and-earth', '003-stage-edition', '004-performance-film'].includes(report.provenance?.experiment_id);
  if (isNewExperiment && (!['minimax-song', 'tts-code-beat', 'user-supplied-song'].includes(production.music_mode) || typeof production.music_provider !== 'string' || !production.music_provider.trim())) fail('新作品须记录实际音乐来源，以及歌曲模型、TTS 加代码伴奏或用户提供歌曲模式。');
  if (production.music_mode !== undefined && !['minimax-song', 'tts-code-beat', 'user-supplied-song'].includes(production.music_mode)) fail('未知音乐制作模式。');
  if (!Number.isFinite(production.bpm) || production.bpm <= 0 || !Number.isFinite(production.total_duration) || production.total_duration <= 0) fail('节拍和成片时长须为正数。');
  if (!Array.isArray(report.clips) || report.clips.length !== expectedClipCount || (isPartial && (expectedClipCount < 1 || expectedClipCount > 3)) || report.clips.some(clip => typeof clip.id !== 'string' || !clip.id || clip.status !== expectedClipStatus || !clip.qa || typeof clip.qa !== 'object' || Array.isArray(clip.qa))) fail('完整状态需要四条记录；部分生成状态只允许一到三条已完成镜头及各自的检测说明。');
  if (new Set(report.clips.map(clip => clip.id)).size !== expectedClipCount) fail('镜头编号重复。');
  if (report.clips.some(clip => typeof clip.actor !== 'string' || !clip.actor.trim() || typeof clip.text !== 'string' || !clip.text.trim())) fail('每句需要真实角色名与歌词。');
  if (isPartial && report.clips.some(clip => clip.video_generated !== true)) fail('部分生成状态中的镜头均须标明 video_generated=true。');
  if (isNewExperiment && report.status === 'completed' && report.clips.some(clip => clip.video_generated !== true)) fail('新作品完成状态须由四段真实生成画面组成。');
  if (isNewExperiment) validateSongReport(report);
  const cost = report.cost;
  const validCny = cost && Number.isFinite(cost.video_estimate_cny) && cost.video_estimate_cny >= 0;
  const validCredits = cost?.provider === 'ChatArt' && ['video_credits_spent', 'video_credits_estimate'].some(key => Number.isFinite(cost[key]) && cost[key] >= 0);
  if (!validCny && !validCredits) fail('缺少人民币原计划或 ChatArt 钻石记录。');
  if (report.remote_generation?.status === 'pending') {
    const remote = report.remote_generation;
    if (!Number.isInteger(remote.submitted_clips) || remote.submitted_clips < 1 || remote.submitted_clips > 4 || !Number.isFinite(remote.planned_credits) || remote.planned_credits < 0 || !Number.isFinite(remote.credit_cap) || remote.credit_cap < 0 || !Array.isArray(remote.models) || !remote.models.length) fail('网页生成中的提交数量、页面标价、额度上限或模型列表缺失。');
    if (remote.outputs_available !== undefined && (!Number.isInteger(remote.outputs_available) || remote.outputs_available < 0 || remote.outputs_available > remote.submitted_clips)) fail('已返回数量必须在零与已提交数量之间。');
    if (remote.outputs !== undefined) {
      if (!Array.isArray(remote.outputs)) fail('已返回原片清单须为数组。');
      for (const output of remote.outputs) {
        if (typeof output?.id !== 'string' || !output.id.trim() || typeof output.video_url !== 'string') fail('已返回原片缺少编号或链接。');
        let url;
        try { url = new URL(output.video_url); } catch { fail('已返回原片链接无效。'); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('原片只允许无凭据的 HTTP(S) 链接。');
      }
    }
  }
  if (!Array.isArray(report.limitations) || !report.limitations.length || report.limitations.some(text => typeof text !== 'string' || !text.trim())) fail('需要真实制作局限。');
  if (report.provenance && (report.provenance.kind !== 'locally-produced' || report.provenance.project_id !== '011')) fail('样例来源标记不匹配本项目。');
}

// The first experiment is an immutable historical record, independent of the current work.
const historyHashes = {
  'public/history/001-three-line-demo.mp4': 'ea4ed6b799176315c69a5505756117a61dca7d215fb91670d26bff900709d1a4',
  'public/history/001-poets.png': '0c1e7a6b62264024d5d63a0e0d73ddae8fd5b3ff5929c4aa1b53a76f52ed12a7',
  'public/history/001-run.json': 'bb509a20fd81ecc7e126dbe13a13e8555333cf2b3143e5f9dbd7047965f105e3',
  'public/history/001-full-four-line-demo.mp4': 'd3ff4396ae24c9b9540a006267232aebea738e112d34e02cacdfb964b42e0e37',
  'public/history/001-full-run.json': '0f393d277e6c7c6db1a4bfda3c5e3a664cbf643152519794785b9b0e51360461',
  'public/history/002-jing-feng-shuang-v2.mp4': '88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e',
  'public/history/002-poets-v2.png': '807a064b780e0c12007e1e3469daad2e33eb004b2bafad247799bb4529f14d05',
  'public/history/002-run.json': '69fb6cb33ce2699bdcbbd80b39aa91ca9d9c420b5d87d5b52abb26ece4965a14',
  'public/history/003-jing-feng-shuang-stage-v3.mp4': '011c49f6527f84ca834ac319ad14bb97dd4a410b75a37729b00bf025382970d6',
  'public/history/003-stage-v3.png': '93f81dc4d6b4eb21c8c119e0825be461ce027325665da2122bc1ed5106e5cd49',
  'public/history/003-run.json': '145aaffd378e9af8b26fe472b3e9fa80568064c2cd7feb5a8f8db8fe9bfee8c8',
};
for (const [source, expected] of Object.entries(historyHashes)) {
  const actual = createHash('sha256').update(await readFile(path.join(webRoot, source))).digest('hex');
  if (actual !== expected) throw new Error(`首次实验归档内容发生变化：${source}`);
}
const historyReport = JSON.parse(await readFile(path.join(webRoot, 'public/history/001-run.json'), 'utf8'));
validateOwnReport(historyReport);
if (historyReport.provenance?.experiment_id !== '001-libai-dufu' || historyReport.status !== 'partial-generated' || historyReport.clips.length !== 3) throw new Error('首次实验归档须保留原始三句部分完成状态。');
const fullHistoryReport = JSON.parse(await readFile(path.join(webRoot, 'public/history/001-full-run.json'), 'utf8'));
if (fullHistoryReport.status !== 'full_four_line_baseline_completed' || fullHistoryReport.full_decode !== true || fullHistoryReport.source_hashes_verified !== true || fullHistoryReport.duration !== 24 || fullHistoryReport.sha256 !== historyHashes['public/history/001-full-four-line-demo.mp4']) throw new Error('完整四句历史归档须与24秒真实基线报告一致。');
const songHistoryReport = JSON.parse(await readFile(path.join(webRoot, 'public/history/002-run.json'), 'utf8'));
validateOwnReport(songHistoryReport);
if (songHistoryReport.provenance?.experiment_id !== '002-moon-and-earth' || songHistoryReport.assets.video.sha256 !== historyHashes['public/history/002-jing-feng-shuang-v2.mp4']) throw new Error('第二版歌曲归档必须保留真实原片及来源记录。');
const stageHistoryReport = JSON.parse(await readFile(path.join(webRoot, 'public/history/003-run.json'), 'utf8'));
validateOwnReport(stageHistoryReport);
if (stageHistoryReport.provenance?.experiment_id !== '003-stage-edition' || stageHistoryReport.assets.video.sha256 !== historyHashes['public/history/003-jing-feng-shuang-stage-v3.mp4']) throw new Error('舞台版归档须保留原字节与真实来源记录。');

const ownStats = await Promise.all(ownSampleFiles.map(async ([source]) => {
  try { return await stat(path.resolve(webRoot, source)); }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null; throw error; }
}));
let ownSampleEnabled = false;
let ownSampleStatus = '';
if (ownStats.every(info => info?.isFile() && info.size > 0)) {
  const report = JSON.parse(await readFile(path.join(webRoot, ownSampleFiles[2][0]), 'utf8'));
  if (['completed', 'rhythm-preview', 'partial-generated'].includes(report.status)) {
    validateOwnReport(report);
    for (const [source, asset] of [[ownSampleFiles[0][0], report.assets?.video], [ownSampleFiles[1][0], report.assets?.poster]]) {
      if (!/^[a-f0-9]{64}$/i.test(asset?.sha256 || '')) throw new Error(`小样资源缺少实际SHA-256：${source}`);
      const content = await readFile(path.join(webRoot, source));
      if (createHash('sha256').update(content).digest('hex') !== asset.sha256.toLowerCase()) throw new Error(`小样资源与实际记录SHA不一致：${source}`);
      if (asset.size_bytes !== undefined && asset.size_bytes !== content.length) throw new Error(`小样资源大小与实际记录不同：${source}`);
    }
    for (const [source, expected] of [[ownSampleFiles[0][0], 'mp4'], [ownSampleFiles[1][0], 'png']]) {
      const handle = await open(path.join(webRoot, source), 'r');
      try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        const valid = expected === 'mp4' ? header.toString('ascii', 4, 8) === 'ftyp' : header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        if (bytesRead < 12 || !valid) throw new Error(`自制小样文件签名无效：${source}`);
      } finally { await handle.close(); }
    }
    ownSampleEnabled = true;
    ownSampleStatus = report.status;
  }
}

// Read every required input first. An incomplete research package must not look built.
for (const [source] of files) {
  const filename = path.resolve(webRoot, source);
  const info = await stat(filename);
  if (!info.isFile() || info.size === 0) throw new Error(`构建输入为空或不是文件：${filename}`);
}
JSON.parse(await readFile(path.join(projectRoot, 'data/source-register.json'), 'utf8'));

const outputFiles = [...files.filter(([, destination]) => destination !== 'index.html'), ...(ownSampleEnabled ? ownSampleFiles : []), files[0]];
for (const [source, destination] of outputFiles) {
  const output = path.join(dist, destination);
  await mkdir(path.dirname(output), { recursive: true });
  if (destination === 'index.html') {
    const html = await readFile(path.resolve(webRoot, source), 'utf8');
    if (!html.includes('data-own-sample-ready="false"')) throw new Error('页面缺少可选小样的默认隐藏标记。');
    if (!html.includes('data-own-history-ready="false"')) throw new Error('页面缺少首次实验归档标记。');
    if (!html.includes('data-stage-film-ready="false"')) throw new Error('页面缺少完整舞台版的默认隐藏标记。');
    await writeFile(output, html.replace('data-own-sample-ready="false"', `data-own-sample-ready="${ownSampleEnabled}"`).replace('data-own-history-ready="false"', 'data-own-history-ready="true"').replace('data-stage-film-ready="false"', `data-stage-film-ready="${stageFilmEnabled}"`).replace('data-repaired-film-ready="false"', `data-repaired-film-ready="${repairedFilmEnabled}"`));
  } else await copyFile(path.resolve(webRoot, source), output);
}
if (!stageFilmEnabled) await unlink(path.join(dist, 'data/004-stage-film.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
if (!ownSampleEnabled) {
  // Delete only these three known optional outputs, preventing an old sample from appearing complete.
  for (const [, destination] of ownSampleFiles) {
    await unlink(path.join(dist, destination)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
console.log(`已构建 ${files.length + (ownSampleEnabled ? ownSampleFiles.length : 0)} 个静态文件：${dist}`);
console.log(ownSampleEnabled ? (ownSampleStatus === 'rhythm-preview' ? '自制节奏预演及执行记录已接入；完整口型小样尚未组装。' : (ownSampleStatus === 'partial-generated' ? '主播放器保留部分生成历史版；首次四句完整基线另行归档。' : '自制成片及真实任务记录已接入。')) : '自制小样尚未具备完整完成记录，页面保持隐藏。');
console.log('此命令只打包已有静态结果；页面不调用生成服务或付费接口，公网状态见部署记录。');
console.log('004早期试片快照独立保留：4个视频版本、完整原曲、6张GPT参考；历史口型结论不变。');
console.log(stageFilmEnabled ? '004舞台视觉样片可播放；演唱口型未通过，不作为合格演唱成果。' : '004视觉样片尚未接入真实文件与报告，独立播放区保持隐藏。');
console.log(h3Report.status === 'pilot-accepted-by-user' ? 'H3试片已绑定可信用户试听确认；新整片尚未验收，不外推通过。' : 'H3普通网页两图加音频试验独立展示；等待或待验收。');
console.log(repairedFilmEnabled ? '新修复版独立接入，原拒收样片继续保留。' : '新修复版制作中，最终播放区保持隐藏，不借用旧视频冒充。');
