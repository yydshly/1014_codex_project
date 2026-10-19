import { readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '_site');
const catalog = JSON.parse(await readFile(resolve(root, 'projects.json'), 'utf8'));
const allProjects = [...catalog.projects].sort((a, b) => Number(a.id) - Number(b.id));
const manifest = JSON.parse(await readFile(resolve(root, 'web/pages.json'), 'utf8'));
const entrances = await readFile(resolve(root, 'web/entries.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return { version: 1, projects: {} };
  throw error;
});
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
}
// 研究收录和应用发布独立：所有研究都有目录与记录，只有发布清单中的项目构建应用。
for (const item of allProjects) {
  const name = `${item.id}-${item.slug}`;
  const project = resolve(root, 'projects', name);
  const notes = resolve(output, 'projects', name);
  await mkdir(notes, { recursive: true });
  for (const file of ['README.md', 'RESEARCH.md', 'assets/README.md', 'web/README.md']) {
    await mkdir(dirname(resolve(notes, file)), { recursive: true });
    await cp(resolve(project, file), resolve(notes, file));
  }
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
await writeFile(resolve(output, 'projects.json'), JSON.stringify({ schema_version: 1, projects: allProjects }, null, 2) + '\n');
const entries = {};
for (const {name, item} of published) {
  const configured = entrances.projects?.[item.id];
  entries[item.id] = Array.isArray(configured) && configured.length ? configured : [{label: '阅读研究', path: `${name}/`}];
  for (const entry of entries[item.id]) {
    if (typeof entry.label !== 'string' || typeof entry.path !== 'string' || !entry.path.startsWith(`${name}/`) || entry.path.includes('..')) throw new Error(`无效项目入口：${name}`);
    const file = entry.path.split(/[?#]/)[0];
    const target = resolve(output, file.endsWith('/') ? `${file}index.html` : file);
    if (!target.startsWith(output + sep) || !(await stat(target)).isFile()) throw new Error(`入口不存在：${entry.path}`);
  }
}
await writeFile(resolve(output, 'entries.json'), JSON.stringify({ version: 1, mode: 'static', publishedProjects: published.map(p => p.name), projects: entries }, null, 2) + '\n');
const delivered = JSON.parse(await readFile(resolve(output, 'projects.json'), 'utf8'));
if (delivered.projects.length !== allProjects.length || delivered.projects.some((item, index) => item.id !== allProjects[index].id)) throw new Error('公开研究索引缺项或顺序错误。');
console.log(`Pages完整站点已生成：${allProjects.length} 项研究全部收录，${published.length} 项静态应用发布：${published.map(p => p.name).join('、')}。`);
