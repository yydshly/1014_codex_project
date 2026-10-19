import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(web, '..');
const target = resolve(web, 'public/research');
await mkdir(target, { recursive: true });
for (const [source, destination] of [
  ['assets/pet/farewell/desktop.jpg', 'final-effect.jpg'],
  ['README.md', 'README.md'], ['RESEARCH.md', 'RESEARCH.md'],
  ['web/licenses/THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
]) await copyFile(resolve(project, source), resolve(target, destination));
console.log('002：理解摘要使用现有最终截图的原始字节，运行资源不包含用户记录。');
