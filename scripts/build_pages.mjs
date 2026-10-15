import { readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '_site');
const catalog = JSON.parse(await readFile(resolve(root, 'projects.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(root, 'web/pages.json'), 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.projects) || !manifest.projects.length) throw new Error('发布清单为空或版本无效。');
if (new Set(manifest.projects).size !== manifest.projects.length) throw new Error('发布项目重复。');
const published = manifest.projects.map(name => {
  if (!/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`无效项目路径：${name}`);
  const item = catalog.projects.find(p => `${p.id}-${p.slug}` === name);
  if (!item) throw new Error(`发布项目未登记：${name}`);
  return { name, item };
});
// 只删除经过绝对路径验证的临时发布目录，不触碰任何项目或源码。
if (output !== resolve(root, '_site') || !output.startsWith(root + sep)) throw new Error('发布目录越界。');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const {name, item} of published) {
  const project = resolve(root, 'projects', name);
  const build = resolve(project, 'web/build.mjs');
  const result = spawnSync(process.execPath, [build], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`构建失败：${name}`);
  const dist = resolve(project, 'web/dist');
  if (!(await stat(resolve(dist, 'index.html'))).isFile()) throw new Error(`缺少入口：${name}`);
  await cp(dist, resolve(output, name), { recursive: true });
  const notes = resolve(output, 'projects', name);
  await mkdir(notes, { recursive: true });
  for (const file of ['README.md', 'RESEARCH.md']) await cp(resolve(project, file), resolve(notes, file));
  if (item.preview) {
    const source = resolve(project, item.preview);
    if (!source.startsWith(project + sep)) throw new Error(`配图路径越界：${name}`);
    const target = resolve(notes, item.preview);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target);
  }
}
await cp(resolve(root, 'web/index.html'), resolve(output, 'index.html'));
await writeFile(resolve(output, '.nojekyll'), '');
await writeFile(resolve(output, 'projects.json'), JSON.stringify({ schema_version: 1, projects: published.map(p => p.item) }, null, 2) + '\n');
await writeFile(resolve(output, 'entries.json'), JSON.stringify({ version: 1, projects: Object.fromEntries(published.map(p => [p.item.id, [{label: '阅读研究', path: `${p.name}/`}]])) }, null, 2) + '\n');
console.log(`Pages完整站点已生成：${published.map(p => p.name).join('、')}。仅发布清单中明确登记的静态项目。`);
