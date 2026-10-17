import { mkdir, readFile, copyFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.resolve(root, '..');
const output = path.join(root, 'dist');
const staticMode = process.argv.includes('--static');
const entryCatalog = JSON.parse(await readFile(path.join(root, 'data/research-entries.json'), 'utf8'));
if (!entryCatalog.updatedAt || entryCatalog.entries.length !== 10 || new Set(entryCatalog.entries.map((entry) => entry.id)).size !== 10) throw new Error('研究入口需包含 10 个独立来源与核查日期');
for (const entry of entryCatalog.entries) {
  for (const key of ['name', 'mark', 'tagline', 'suitable', 'method', 'check', 'accessLabel', 'access']) {
    if (!entry[key]) throw new Error(`${entry.id} 缺少入口说明 ${key}`);
  }
  if (!['zh', 'en'].includes(entry.language) || !entry.categories.length || entry.categories.some((kind) => !['community', 'feedback', 'paid', 'solutions'].includes(kind))) throw new Error(`${entry.id} 分类或语言异常`);
  if (entry.queries.length !== 3 || entry.queries.some((query) => !query.label || !query.template.includes('{task}'))) throw new Error(`${entry.id} 检索式不完整`);
  if (!entry.references.length || !entry.signals.length) throw new Error(`${entry.id} 缺少依据或信号`);
  for (const url of [entry.url, entry.entryUrl, ...entry.references.map((ref) => ref.url)]) {
    if (new URL(url).protocol !== 'https:') throw new Error(`${entry.id} 外部链接协议异常`);
  }
}
const dataset = JSON.parse(await readFile(path.join(project, 'demand-sources.json'), 'utf8'));
if (dataset.records.length !== 20 || new Set(dataset.records.map((record) => record.id)).size !== 20) throw new Error('需要 20 条独立问题记录');
for (const [channel, count] of [['Reddit', 8], ['App 评论', 6], ['Upwork', 6]]) {
  if (dataset.records.filter((record) => record.channel === channel).length !== count) throw new Error(`${channel} 来源数量异常`);
}
for (const record of dataset.records) {
  for (const key of ['id', 'channel', 'url', 'problem', 'locator', 'date_basis', 'access', 'cluster', 'limitation']) {
    if (!record[key]) throw new Error(`${record.id} 缺少 ${key}`);
  }
  if (new URL(record.url).protocol !== 'https:') throw new Error(`${record.id} 来源链接协议异常`);
}
if (path.resolve(output) !== path.resolve(root, 'dist') || path.dirname(path.resolve(output)) !== root) throw new Error('构建目录越界');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'data'), { recursive: true });
await mkdir(path.join(output, 'notes'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
await Promise.all([
  ...['index.html', 'research.html', 'overview.css', 'styles.css', 'entries.css', 'entries.js', 'findings.css', 'findings.js', 'findings-model.js', 'auto-research.js', 'auto-research.css', 'app.js', 'plan-merge.js', 'reddit.js', 'mark.svg'].map((file) => copyFile(path.join(root, file), path.join(output, file))),
  copyFile(path.join(root, 'data/research-entries.json'), path.join(output, 'data/research-entries.json')),
  copyFile(path.join(root, 'data/reddit-latest.json'), path.join(output, 'data/reddit-latest.json')),
  copyFile(path.join(project, 'demand-sources.json'), path.join(output, 'data', 'sources.json')),
  ...(await readdir(path.join(project, 'assets'))).filter(file => /\.(png|svg|jpg|mmd)$/i.test(file)).map(file => copyFile(path.join(project, 'assets', file), path.join(output, 'assets', file))),
]);
const notes = new Map([
  ...['RESEARCH.md', 'DEMAND_RESEARCH.md', 'SOLUTIONS.md', 'RESEARCH_ENTRIES.md', 'PRODUCT_OVERVIEW.md'].map(file => [path.join(project, file), file]),
  [path.join(project, 'README.md'), 'PROJECT.md'], [path.join(root, 'README.md'), 'RUNNING.md'],
]);
for (const [source, name] of notes) {
  const content = (await readFile(source, 'utf8')).replace(/\]\(([^)]+)\)/g, (match, target) => {
    if (/^http:\/\/127\.0\.0\.1:4176\/1014_codex_project\/004-jasonzhu-ai\//.test(target)) return `](../${target.split('/004-jasonzhu-ai/')[1] || 'index.html'})`;
    if (/^[a-z]+:|^#/.test(target)) return match;
    const [file, fragment] = target.split('#'); const absolute = path.resolve(path.dirname(source), file);
    const anchor = fragment ? `#${fragment}` : '';
    if (notes.has(absolute)) return `](${notes.get(absolute)}${anchor})`;
    if (absolute.startsWith(path.join(project, 'assets') + path.sep) && /\.(png|svg|jpg|mmd)$/i.test(absolute)) return `](../assets/${path.basename(absolute)}${anchor})`;
    const repositoryRoot = path.resolve(project, '../..');
    if (!absolute.startsWith(repositoryRoot + path.sep)) throw new Error(`文档链接越界：${target}`);
    return `](https://github.com/yydshly/1014_codex_project/blob/main/${path.relative(repositoryRoot, absolute).split(path.sep).join('/')}${anchor})`;
  });
  await writeFile(path.join(output, 'notes', name), content);
}
if (staticMode) {
  const indexPath = path.join(output, 'index.html');
  await writeFile(indexPath, (await readFile(indexPath, 'utf8')).replace('<html lang="zh-CN">', '<html lang="zh-CN" data-research-mode="static">'));
}
// 校验要发布的本地资源和锚点，避免编号子路径下出现断链。
for (const file of ['index.html', 'research.html']) {
  const html = await readFile(path.join(output, file), 'utf8');
  for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^[a-z]+:|^\/\//i.test(raw) || raw === '../') continue;
    const [relative, anchor] = raw.split('#');
    const target = path.resolve(output, relative || file);
    if (!target.startsWith(output + path.sep)) throw new Error(`页面资源越界：${raw}`);
    const body = await readFile(target);
    if (anchor && path.extname(target) === '.html' && !body.toString().includes(`id="${anchor}"`)) throw new Error(`锚点不存在：${raw}`);
  }
}
console.log(`004 页面已构建：${output}\n产品总览、原始全景图、10 个研究入口与工作区已复制；${staticMode ? '公开展示模式' : '本地执行模式'}。`);
