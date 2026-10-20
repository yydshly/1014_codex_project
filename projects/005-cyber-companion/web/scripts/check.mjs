import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'public', '.runtime'].includes(entry.name)) continue;
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(m?js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status) throw new Error(result.stderr);
    }
  }
}
await walk(process.cwd());
console.log('JavaScript 语法检查通过。');
