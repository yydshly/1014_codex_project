import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { capabilities, stages, scenarios, changes, evidence } from '../data.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, '页面存在重复 ID');
for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(match[1]), `章节入口不存在：${match[1]}`);
const evidenceIds = new Set(evidence.map(item => item.id));
assert.equal(evidence.length, evidenceIds.size, '证据编号重复');
for (const match of html.matchAll(/data-source="([^"]+)"/g)) assert(evidenceIds.has(match[1]), `来源未登记：${match[1]}`);
for (const item of [...capabilities, ...stages]) for (const ref of item.refs) assert(evidenceIds.has(ref), `来源未登记：${ref}`);
assert.equal(capabilities.length, 12);
assert.equal(stages.length, 8);
assert.equal(Object.keys(scenarios).length, 3);
assert.equal(changes.length, 12);
for (const file of ['styles.css', 'four-pillars.css', 'keyword-lab.js', 'app.js', 'data.js', 'favicon.svg', 'media/upstream-home.png', 'media/upstream-spec.png', 'media/upstream-xray.png', '../README.md', '../RESEARCH.md', '../licenses/UPSTREAM-MIT.txt']) await access(path.join(root, file));
for (const id of ['source-control', 'information-search', 'information-filtering', 'information-presentation', 'keyword-include', 'keyword-exclude', 'keyword-text', 'keyword-result']) assert(ids.includes(id), '缺少四环节内容或关键词交互：' + id);
const coreOrder = ['source-control', 'information-search', 'information-filtering', 'information-presentation'].map(id => html.indexOf('id="' + id + '"'));
assert(coreOrder.every((value, index) => index === 0 || value > coreOrder[index - 1]), '四个环节的阅读顺序不正确');
assert(html.includes('示例数据') && html.includes('未运行上游服务'), '验证范围或示例标记缺失');
const explorer = await readFile(path.join(root, 'explore/index.html'), 'utf8');
const explorerIds = [...explorer.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(explorerIds.length, new Set(explorerIds).size, '工作台页面存在重复 ID');
const app = await readFile(path.join(root, 'explore/app.js'), 'utf8');
for (const match of app.matchAll(/\$\('#([^' ]+)'\)/g)) {
  if (!match[1].includes(' ')) assert(explorerIds.includes(match[1]), '工作台缺少元素：' + match[1]);
}
for (const file of ['explore/styles.css', 'explore/mark.svg', 'explore/engine.js', 'explore/server.mjs', 'explore/snapshot.json', 'explore/SOURCES.md']) await access(path.join(root, file));
const snapshot = JSON.parse(await readFile(path.join(root, 'explore/snapshot.json'), 'utf8'));
assert(snapshot.items.length > 0 && snapshot.sources.length === 4 && snapshot.lastUpdated, '缺少真实采集快照');
for (const item of snapshot.items) assert(item.id && /^https:\/\//.test(item.url) && item.collectedAt, '快照条目缺少来源或采集时间');
console.log(`工作台检查通过：${explorerIds.length} 个页面标识，${snapshot.sources.length} 个来源，${snapshot.items.length} 条带时间与原文链接的快照。`);
console.log(`检查通过：${ids.length} 个页面标识、12 项能力、8 步链路、3 个示例、${evidence.length} 条固定版本来源；资源与文档齐全。`);
