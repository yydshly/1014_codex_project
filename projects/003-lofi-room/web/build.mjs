import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const web=dirname(fileURLToPath(import.meta.url));
function run(command,args,extra={}) { const result=spawnSync(command,args,{cwd:web,stdio:'inherit',...extra});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1); }
if(!existsSync(resolve(web,'node_modules/vite/package.json')))run(process.platform==='win32'?'npm.cmd':'npm',['ci','--no-fund','--no-audit'],{shell:process.platform==='win32'});
run(process.execPath,['scripts/check.mjs']);
const pkg=JSON.parse(await readFile(resolve(web,'package.json'),'utf8'));
run(process.execPath,['--test','--test-concurrency=1',...pkg.scripts.test.split(' ').slice(2)]);
run(process.execPath,['--test','--test-concurrency=1','tests/deployment.test.js','tests/execution-control.test.js','tests/takeover-discussion.test.js','tests/background-tasks.test.js']);
run(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,LOFI_PAGES_BUILD:'1'}});
const dist=resolve(web,'.cache/pages-dist'),files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const target=resolve(dir,item.name);if(item.isDirectory())await walk(target);else files.push(target);}}
await walk(dist);
const inventory=[];
for(const file of files){const name=relative(dist,file).split('\\').join('/');assert.ok(!/(^|\/)(?:\.env(?:\.|$)|\.cache|node_modules|server|src)(\/|$)/.test(name),`禁止公开文件：${name}`);const bytes=await readFile(file);inventory.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const sourceGuide=await readFile(resolve(web,'../assets/understanding-overview/agent-studio-understanding.png'));
const guideSHA=createHash('sha256').update(sourceGuide).digest('hex');
assert.equal(inventory.filter(file=>file.sha256===guideSHA).length,1,'既有引导图必须原字节发布');
assert.ok(files.some(file=>relative(dist,file)==='research.html'));
const summary=await readFile(resolve(dist,'research.html'),'utf8');
for(const id of ['synthesis','source','principle','exploration','overview','capabilities','evidence','future','deployment'])assert.ok(summary.includes(`id="${id}"`),`缺少章节：${id}`);
await writeFile(resolve(dist,'publication.json'),JSON.stringify({project:'003-lofi-room',mode:'static-demo',runtimeAPI:false,requiresMiniMaxSecret:false,guideSHA256:guideSHA,guideBytes:sourceGuide.length,files:inventory},null,2)+'\n');
console.log(`003 Pages：${inventory.length+1}份静态产物；引导图原始字节已核对，实时执行保留本地。`);
