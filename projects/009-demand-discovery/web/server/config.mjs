import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
export const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function loadConfig(){
  let local={};
  for(const name of ['.env','.env.local']){try{Object.assign(local,parseEnv(await readFile(path.join(webRoot,name),'utf8')));}catch{}}
  const env={...local,...process.env};
  return {
    binary:env.CODEX_BIN||(process.platform==='win32'?'codex.exe':'codex'),
    model:env.CODEX_MODEL||'',
    runtimeRoot:path.join(webRoot,'.runtime'),
    snapshot:path.join(webRoot,'../data/discovery-latest.json'),
    phaseTimeout:Math.min(420000,Math.max(60000,Number(env.DISCOVERY_PHASE_TIMEOUT_MS)||240000)),
    maxSearchEvents:24,
  };
}
