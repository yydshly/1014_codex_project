import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { snapshot, sources } from '../data.js';

const files = await Promise.all(Object.entries(sources).map(async ([id, source]) => {
  const rawUrl = `https://raw.githubusercontent.com/aozorae/Edgechat/${snapshot.commit}/${source.path}`;
  const response = await fetch(rawUrl, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`${source.path}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (id === 'package' && JSON.parse(bytes.toString()).version !== snapshot.version) throw new Error('版本与固定提交不一致');
  return { id, title: source.title, path: source.path, url: source.url, raw_url: rawUrl, http_status: response.status, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const folder = new URL('../../research/', import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL('upstream.json', folder), JSON.stringify({ repository: snapshot.repository, commit: snapshot.commit, version: snapshot.version, research_date: snapshot.date, license: 'README: GPL-3.0-or-later; LICENSE: GNU GPL v3 text', method: '读取固定提交的原始文件并记录 HTTP 状态、字节数和 SHA-256；不代表上游功能已运行验证。', files }, null, 2) + '\n');
console.log(`已核验 ${files.length} 处固定版本来源，版本 ${snapshot.version}；清单写入 research/upstream.json。`);
