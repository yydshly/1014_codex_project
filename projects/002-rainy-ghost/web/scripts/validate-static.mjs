import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(web, 'dist');
const base = '/1014_codex_project/002-rainy-ghost/';
const files = [];
async function walk(directory, prefix = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + item.name;
    if (item.isDirectory()) await walk(resolve(directory, item.name), `${path}/`);
    else files.push(path);
  }
}
await walk(dist);
for (const file of files) assert.match(file, /^(?:index\.html|research\.html|ghost\.svg|pet-hand\.svg|assets\/[\w.-]+\.(?:js|css)|licenses\/THREE-LICENSE\.txt|research\/(?:final-effect\.jpg|README\.md|RESEARCH\.md|THIRD_PARTY_NOTICES\.md))$/, `非预期发布文件：${file}`);
for (const page of ['index.html', 'research.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${page} 编号重复`);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(anchor), `${page} 章节不存在：${anchor}`);
  for (const [, reference] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|#)/.test(reference) || reference === '../') continue;
    const pathname = reference.split(/[?#]/)[0].replace(base, '').replace(/^\.\//, '');
    if (!pathname) continue;
    const target = resolve(dist, pathname);
    assert.ok(target.startsWith(dist + sep), `资源路径越界：${reference}`);
    assert.ok((await stat(target)).isFile(), `缺少资源：${reference}`);
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(resolve(dist, 'research/final-effect.jpg'))), hash(await readFile(resolve(web, '../assets/pet/farewell/desktop.jpg'))), '最终效果图必须保持原始字节');
const summary = await readFile(resolve(dist, 'research.html'), 'utf8');
for (const term of ['未取得原作者的场景源码', 'Three.js 0.186.1', '扩展与优化', '够用就停', '目送', '3–4 秒']) assert.ok(summary.includes(term), `摘要缺少关键事实：${term}`);
console.log(`002：双入口、页内章节、${files.length} 份静态文件、原图哈希与发布白名单检查通过。`);
