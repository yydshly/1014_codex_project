// Read the root-owned repair status; update web progress only, never tasks or ledger.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateRepairedFilmReport } from '../repaired-film-report.mjs';
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experiment = path.resolve(web, '../experiments/004-performance-film');
const sourcePath = 'work/audio-driven-repair/repair-status.json';
const bytes = await readFile(path.join(experiment, sourcePath)), status = JSON.parse(bytes);
const reportPath = path.join(web, 'public/data/004-repaired-film.json');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
if (report.status !== 'in-production') throw new Error('已有新成片记录时不能用制作进度覆盖。');
if (status.full_film_completed !== false || status.pilot_acceptance_scope !== 'exact-pilot-1027778-only') throw new Error('当前实际修复状态与制作中记录不符。');
report.production_progress = {
  observed_at: status.updated_at,
  confirmed_tasks: status.production_tasks.length,
  reviewed_source_keys: status.production_reviewed_source_keys,
  completed_source_keys: status.production_completed_source_keys,
  pending_source_keys: status.production_pending_source_keys,
  source_path: sourcePath,
  source_sha256: createHash('sha256').update(bytes).digest('hex'),
};
report.budget_snapshot = { committed: status.budget_committed, reserved_unconfirmed: status.reserved, exposure: status.budget_exposure_including_reservation, remaining_authorized: status.remaining_authorized, note: '仅为此时状态快照，不改历史样片成本或根账本；未确认尝试保留在预留中。' };
validateRepairedFilmReport(report);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log('已将实际修复任务进度同步到网页；新完整视频仍隐藏。');
