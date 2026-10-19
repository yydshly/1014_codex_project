// 仓库 Pages 统一入口；只检查与打包静态研究，不启动本机模型服务。
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const cwd=path.dirname(fileURLToPath(import.meta.url));
const files=['app.js','content.js','live.js','mode.js','understanding.js','server/service.mjs','server/codex.mjs','server/grounding.mjs','server/verify.mjs','server/prompts.mjs','scripts/build.mjs','scripts/build-understanding.mjs','scripts/serve.mjs','build.mjs'];
const commands=[...files.map(file=>['--check',file]),['--test','server/discovery.test.mjs','tests/public.test.mjs'],['scripts/build.mjs','--public'],['scripts/check-public.mjs']];
for(const args of commands){
  const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
