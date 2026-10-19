// Copy an already completed and verified ordinary-video montage; never submits generation.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateStageFilmReport } from '../stage-film-report.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experiment = path.resolve(webRoot, '../experiments/004-performance-film');
const input = process.argv[2];
if (!input) throw new Error('用法：node scripts/prepare-stage-film.mjs <004实验内的最终舞台版报告路径>');
const inputPath = await realpath(path.resolve(experiment, input));
const within = value => { const rel = path.relative(experiment, value); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
if (!within(inputPath)) throw new Error('最终报告必须保存在004实验目录内。');
const raw = await readFile(inputPath), report = JSON.parse(raw);
const existing = await readFile(path.join(webRoot, 'public/data/004-stage-film.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
if (existing?.user_acceptance?.status === 'rejected-for-singing-performance' && existing.assets.video.sha256 === report.assets?.video?.sha256 && report.user_acceptance?.status !== 'rejected-for-singing-performance') throw new Error('用户已拒收此片的演唱效果，不能用旧导出报告覆盖验收结论；请从最新报告同步。');
const { assets } = validateStageFilmReport(report);
async function verify(relative, expectedHash, expectedBytes) {
  const resolved = await realpath(path.resolve(experiment, relative));
  if (!within(resolved)) throw new Error(`来源越过实验目录：${relative}`);
  const content = await readFile(resolved);
  if (createHash('sha256').update(content).digest('hex') !== expectedHash || (expectedBytes !== undefined && content.length !== expectedBytes)) throw new Error(`来源实际内容与记录不同：${relative}`);
  return { resolved, content };
}
for (const source of report.source_files) await verify(source.path, source.sha256, source.bytes);
await verify(report.budget_ledger.path, report.budget_ledger.sha256);
await verify(report.audio.source_path, report.audio.source_sha256);
await verify(report.verification.full_speed_browser_playback.path, report.verification.full_speed_browser_playback.sha256);
await verify(report.assembly_evidence.path, report.assembly_evidence.sha256);
for (const asset of assets) {
  const { resolved, content } = await verify(asset.source_path, asset.sha256, asset.bytes);
  if (asset.path.endsWith('.mp4') && content.toString('ascii', 4, 8) !== 'ftyp') throw new Error('最终视频不是MP4。');
  const target = path.join(webRoot, 'public', asset.path);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(resolved, target);
}
report.evidence_snapshot = { source_path: path.relative(experiment, inputPath).replaceAll('\\', '/'), sha256: createHash('sha256').update(raw).digest('hex') };
await mkdir(path.join(webRoot, 'public/data'), { recursive: true });
await writeFile(path.join(webRoot, 'public/data/004-stage-film.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`已接入《压轴人间》94.64秒普通视频舞台版，${report.source_files.length}条实际动态来源；原口型验收记录不变。`);
