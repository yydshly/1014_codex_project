// GitHub Pages 统一构建入口：只检查与打包，不启动模型或本机服务。
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const cwd=path.dirname(fileURLToPath(import.meta.url));
for(const args of [['scripts/check.mjs'],['scripts/build-archive.mjs'],['--test','tests/archive.test.mjs','tests/lab.test.mjs'],['scripts/build-archive.mjs','--public'],['scripts/check-public.mjs']]){
  const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
