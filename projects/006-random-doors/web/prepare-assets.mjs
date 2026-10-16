import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = dirname(fileURLToPath(import.meta.url));
const output = resolve(web, 'public/research');
await mkdir(output, { recursive: true });
for (const [source, target] of [
  ['references/four-seasons-readme.jpg', 'four-seasons-reference.jpg'],
  ['understanding-overview-20261016.png', 'understanding-overview.png'],
  ['understanding-overview-20261016.svg', 'understanding-overview.svg'],
  ['understanding-overview-20261016.sources.json', 'understanding-overview.sources.json'],
]) await copyFile(resolve(web, '../assets', source), resolve(output, target));
