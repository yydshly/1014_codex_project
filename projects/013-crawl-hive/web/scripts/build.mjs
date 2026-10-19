import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'styles.css', 'four-pillars.css', 'understanding.css', 'app.js', 'data.js', 'keyword-lab.js', 'understanding.js', 'source-catalog.js', 'source-catalog-ui.js', 'favicon.svg']) {
  await copyFile(path.join(root, name), path.join(out, name));
}
await cp(path.join(root, 'media'), path.join(out, 'media'), { recursive: true });
await mkdir(path.join(out, 'explore'), { recursive: true });
for (const name of ['index.html', 'styles.css', 'mark.svg', 'app.js', 'engine.js', 'snapshot.json', 'SOURCES.md']) {
  await copyFile(path.join(root, 'explore', name), path.join(out, 'explore', name));
}
await writeFile(path.join(out,'explore/deployment-mode.js'),'// Static publication reads only the bundled snapshot.\nexport const publicMode = true;\n');
await cp(path.join(root, '..', 'licenses'), path.join(out, 'licenses'), { recursive: true });
for (const name of ['README.md', 'RESEARCH.md']) {
  await copyFile(path.join(root, '..', name), path.join(out, name));
}
const html = await readFile(path.join(out, 'index.html'), 'utf8');
if (html.includes('TODO') || !html.includes('CrawlHive')) throw new Error('静态页面内容不完整');
console.log('已构建 dist/；可部署至 /1014_codex_project/013-crawl-hive/。');
