import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
for (const script of ['build_web.py', 'check_web.py']) {
  const result = spawnSync(python, [resolve(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
