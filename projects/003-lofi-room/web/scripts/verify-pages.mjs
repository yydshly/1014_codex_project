import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const project=resolve(import.meta.dirname,'../..');
const root=resolve(project,'../..');
const base='https://yydshly.github.io/1014_codex_project/';
const entry=base+'003-lofi-room/';
const results=[];
async function get(url,expected=200){
  for(let attempt=0;;attempt++){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'});assert.equal(response.status,expected,`${url} HTTP`);const bytes=Buffer.from(await response.arrayBuffer());results.push({url,status:response.status,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});return bytes;}
    catch(error){if(attempt>=2)throw error;await new Promise(r=>setTimeout(r,1500));}
  }
}
const publication=JSON.parse(await get(entry+'publication.json'));
assert.equal(publication.mode,'static-demo');assert.equal(publication.runtimeAPI,false);assert.equal(publication.requiresMiniMaxSecret,false);
const sourceGuide=await readFile(resolve(project,'assets/understanding-overview/agent-studio-understanding.png'));
assert.equal(publication.guideSHA256,createHash('sha256').update(sourceGuide).digest('hex'));
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<publication.files.length){const file=publication.files[cursor++];const raw=await get(entry+file.path);assert.equal(raw.length,file.bytes,file.path);assert.equal(createHash('sha256').update(raw).digest('hex'),file.sha256,file.path);}}));
const html=(await get(entry+'research.html')).toString();
for(const id of ['synthesis','source','principle','exploration','overview','capabilities','evidence','future','deployment'])assert.ok(html.includes(`id="${id}"`),id);
for(const word of ['原场景仓库','独立实现','后续方向','本地 Node','MINIMAX_API_KEY'])assert.ok(html.includes(word),word);
const catalog=JSON.parse(await get(base+'projects.json')),entrances=JSON.parse(await get(base+'entries.json'));
assert.equal(catalog.projects.length,15);assert.equal(entrances.projects['003'].length,4);
const manifest=JSON.parse(await readFile(resolve(root,'web/pages.json'),'utf8'));
for(const name of manifest.projects){const body=(await get(base+name+'/')).toString();assert.ok(/<!doctype html/i.test(body),name);}
await get(base);
for(const privatePath of ['api/status','api/tasks','.env.local','server/config.js'])await get(entry+privatePath,404);
const report={checkedAt:new Date().toISOString(),entry,sourceCommit:process.argv[2]||null,workflowRun:process.argv[3]||null,
  mode:publication.mode,runtimeAPI:false,guideSHA256:publication.guideSHA256,guidePreserved:true,resourceCount:publication.files.length,
  projectCount:catalog.projects.length,publishedProjects:manifest.projects,apiAndPrivateFilesNotPublished:true,checks:results};
await mkdir(resolve(project,'assets/publication'),{recursive:true});
await writeFile(resolve(project,'assets/publication/http-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({resources:report.resourceCount,requests:results.length,preservedProjects:manifest.projects.length,guidePreserved:true,errors:0}));
