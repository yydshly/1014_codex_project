import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const web = dirname(fileURLToPath(import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, shell = false) {
  const result = spawnSync(command, args, { cwd: web, stdio: 'inherit', shell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync(resolve(web, 'node_modules/vite/package.json'))) run(npm, ['ci', '--no-fund', '--no-audit'], process.platform === 'win32');
run(npm, ['run', 'check'], process.platform === 'win32');
run(npm, ['run', 'check:publish'], process.platform === 'win32');
run(npm, ['test'], process.platform === 'win32');
run(npm, ['run', 'build'], process.platform === 'win32');
await import('./scripts/validate-static.mjs');
