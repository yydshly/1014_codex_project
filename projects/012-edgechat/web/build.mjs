import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = dirname(fileURLToPath(import.meta.url));
for (const file of ['app.js', 'data.js', 'server.mjs', 'scripts/build.mjs']) {
  const result = spawnSync(process.execPath, ['--check', resolve(web, file)], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`语法检查失败：${file}`);
}
await import('./scripts/build.mjs');
const dist = resolve(web, 'dist');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (ids.length !== new Set(ids).size) throw new Error('页面存在重复编号。');
for (const match of html.matchAll(/\bhref="#([^"]+)"/g)) {
  if (!ids.includes(match[1])) throw new Error(`页内目标不存在：${match[1]}`);
}
for (const match of html.matchAll(/\b(?:src|href)="\.\/([^"?#]+)"/g)) {
  if (!(await stat(resolve(dist, match[1]))).isFile()) throw new Error(`资源不存在：${match[1]}`);
}
const expected = ['RESEARCH.md', 'app.js', 'data.js', 'edgechat-summary.png', 'edgechat-summary.svg', 'favicon.svg', 'index.html', 'research', 'standalone.html', 'styles.css'];
const files = await readdir(dist);
if (files.length !== expected.length || files.some(name => !expected.includes(name))) throw new Error('静态产物超出白名单。');
const standalone = await readFile(resolve(dist, 'standalone.html'), 'utf8');
if (standalone.includes('src="./edgechat-summary.png"')) throw new Error('离线引导图未完整内嵌。');
console.log(`012：语法、${ids.length} 个页内编号、资源与静态白名单检查通过。`);
