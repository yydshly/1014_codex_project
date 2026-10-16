import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const web = dirname(fileURLToPath(import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(args) {
  const result = spawnSync(npm, args, { cwd: web, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync(resolve(web, 'node_modules/vite/package.json'))) run(['ci', '--no-fund', '--no-audit']);
run(['run', 'check']);
run(['test']);
run(['run', 'build']);
