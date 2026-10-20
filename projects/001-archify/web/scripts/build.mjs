import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { diagram, publicProject, revision, repository, version } from '../data/project.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = path.join(root, '.cache/upstream');
const dist = path.join(root, 'dist');
fs.mkdirSync(path.dirname(upstream), { recursive: true });
if (!fs.existsSync(path.join(upstream, '.git'))) {
  execFileSync('git', ['clone', '--depth', '1', '--branch', version, `${repository}.git`, upstream], { stdio: 'inherit' });
}
const actual = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== revision) throw new Error(`Upstream revision mismatch: ${actual}`);
if (execFileSync('git', ['-C', upstream, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) {
  throw new Error('The upstream checkout has modifications. Restore or inspect them before rebuilding.');
}

fs.mkdirSync(path.join(dist, 'diagrams'), { recursive: true });
fs.cpSync(path.join(root, 'src'), dist, { recursive: true });
fs.copyFileSync(path.join(upstream, 'LICENSE'), path.join(dist, 'ARCHIFY-LICENSE.txt'));
fs.copyFileSync(path.join(upstream, 'THIRD_PARTY_NOTICES.md'), path.join(dist, 'THIRD_PARTY_NOTICES.md'));
fs.writeFileSync(path.join(dist, 'project.json'), JSON.stringify(publicProject(), null, 2) + '\n');

for (const language of ['zh', 'en']) {
  const input = path.join(root, 'data', `archify-${language}.json`);
  fs.writeFileSync(input, JSON.stringify(diagram(language), null, 2) + '\n');
  fs.copyFileSync(input, path.join(dist, 'diagrams', `archify-${language}.json`));
  const outDir = path.join(root, '.cache/receipts', `${language}-${Date.now()}`);
  const result = spawnSync(process.execPath, [path.join(upstream, 'archify/bin/archify.mjs'),
    'finalize', 'architecture', input, path.join(dist, 'diagrams', `archify-${language}.html`),
    '--repo-root', upstream, '--quality', 'showcase', '--out-dir', outDir, '--json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' }
  });
  fs.mkdirSync(path.join(root, '.cache/receipts'), { recursive: true });
  fs.writeFileSync(path.join(root, '.cache/receipts', `${language}-latest.json`), result.stdout || '{}');
  let receipt;
  try { receipt = JSON.parse(result.stdout); } catch { /* Report the original tool failure below. */ }
  if (result.status !== 0 || !receipt?.ok) {
    process.stderr.write(result.stderr || '');
    process.stderr.write(result.stdout || '');
    throw new Error(`Archify ${language} finalize did not pass. See .cache/receipts/${language}-latest.json`);
  }
  console.log(`${language}: Archify validation, delivery, HTML and browser checks passed.`);
  // Copy the compact upstream receipt alongside the diagram for local inspection.
  fs.writeFileSync(path.join(dist, 'diagrams', `archify-${language}.checks.json`), JSON.stringify(receipt, null, 2) + '\n');
}
console.log('Built 001 Archify demo in dist/.');
