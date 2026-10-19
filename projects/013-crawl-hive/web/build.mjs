// GitHub Pages entry: verify and package existing results; never fetch sources.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const cwd = path.dirname(fileURLToPath(import.meta.url));
for (const args of [['scripts/check.mjs'], ['--test','explore/engine.test.mjs'], ['scripts/build.mjs'], ['scripts/check-public.mjs']]) {
  const result = spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
