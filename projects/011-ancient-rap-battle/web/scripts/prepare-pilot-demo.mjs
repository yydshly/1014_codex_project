// Copy existing evidence only. This script never generates media or submits tasks.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validatePilotReport } from '../pilot-report.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experiment = path.resolve(webRoot, '../experiments/004-performance-film');
const evidencePath = 'work/demo-evidence-summary.json';
const raw = await readFile(path.join(experiment, evidencePath));
const report = JSON.parse(raw);
report.evidence_snapshot = { source_path: evidencePath, sha256: createHash('sha256').update(raw).digest('hex') };
const groups = [...report.assets, report.source_song, ...report.references.primary, ...report.references.additional_environment];
for (const asset of groups) {
  const sourcePath = asset.path;
  const filename = report.assets.includes(asset) ? `${asset.id}.mp4` : asset === report.source_song ? 'ya-zhou-ren-jian.mp3' : `${asset.id}.png`;
  const content = await readFile(path.join(experiment, sourcePath));
  if (createHash('sha256').update(content).digest('hex') !== asset.sha256 || (asset.bytes !== undefined && asset.bytes !== content.length)) throw new Error(`实际媒体与证据不符：${sourcePath}`);
  asset.source_path = sourcePath;
  asset.path = `media/pilot-004/${filename}`;
  asset.bytes = content.length;
  await mkdir(path.dirname(path.join(webRoot, 'public', asset.path)), { recursive: true });
  await copyFile(path.join(experiment, sourcePath), path.join(webRoot, 'public', asset.path));
}
validatePilotReport(report);
await mkdir(path.join(webRoot, 'public/data'), { recursive: true });
await writeFile(path.join(webRoot, 'public/data/004-pilot-demo.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`已快照 ${groups.length} 个真实媒体资源；004仍为试片、完整成片未完成。`);
