import { readFile,writeFile,mkdir,cp,stat,readdir } from 'node:fs/promises';
import { dirname,resolve,relative,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const web=dirname(fileURLToPath(import.meta.url)),project=resolve(web,'..'),dist=resolve(web,'dist');
for(const name of ['app.js','build.mjs']){
  const check=spawnSync(process.execPath,['--check',resolve(web,name)],{stdio:'inherit'});
  if(check.status!==0)throw new Error('Syntax check failed: '+name);
}
await mkdir(dist,{recursive:true});
for(const name of ['index.html','styles.css','app.js','demo.html','native','zh','vendor'])await cp(resolve(web,name),resolve(dist,name),{recursive:true});
await mkdir(resolve(dist,'assets'),{recursive:true});
for(const name of ['specreel-understanding.png','specreel-understanding.svg','chinese-title.png'])await cp(resolve(project,'assets',name),resolve(dist,'assets',name));
await mkdir(resolve(dist,'artifacts'),{recursive:true});
for(const name of ['verification.json','sources.json','understanding-layout.json'])await cp(resolve(project,'artifacts',name),resolve(dist,'artifacts',name));
await cp(resolve(project,'RESEARCH.md'),resolve(dist,'RESEARCH.md'));

const html=await readFile(resolve(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate page IDs.');
for(const match of html.matchAll(/href="#([^"]+)"/g))if(!ids.includes(match[1]))throw new Error('Missing anchor: '+match[1]);
for(const match of html.matchAll(/(?:src|href|poster|data-src)="\.\/([^"?#]+)"/g)){
  const target=resolve(dist,match[1]);
  if(!target.startsWith(dist+sep)||!(await stat(target)).isFile())throw new Error('Missing public asset: '+match[1]);
}
if(/https?:\/\/(localhost|127\.0\.0\.1)/.test(html))throw new Error('Research page links to local services.');
const verification=JSON.parse(await readFile(resolve(project,'artifacts/verification.json'),'utf8'));
if(verification.captureResults.length!==3||verification.captureResults.some(result=>result.failed))throw new Error('Saved capture verification is incomplete.');
const layout=JSON.parse(await readFile(resolve(project,'artifacts/understanding-layout.json'),'utf8'));
if(layout.layout_issues.length)throw new Error('Infographic layout has overflow.');
const files=[];
async function walk(folder){for(const item of await readdir(folder,{withFileTypes:true})){const path=resolve(folder,item.name);if(item.isDirectory())await walk(path);else files.push(path);}}
await walk(dist);
const allowed=new Set(['index.html','styles.css','app.js','demo.html','RESEARCH.md']);
const manifest=[];
for(const file of files.sort()){
  const name=relative(dist,file).split(sep).join('/');
  if(name==='asset-manifest.json')continue;
  if(!allowed.has(name)&&!['native/','zh/','vendor/','assets/','artifacts/'].some(prefix=>name.startsWith(prefix)))throw new Error('Unexpected static file: '+name);
  if(/(^|\/)(node_modules|\.env|captures|server|upstream)(\/|$)/.test(name))throw new Error('Runtime file in public build: '+name);
  const body=await readFile(file);manifest.push({path:name,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
}
await writeFile(resolve(dist,'asset-manifest.json'),JSON.stringify({project:'008-specreel',files:manifest,mode:'static-existing-artifacts',runtimeModels:false,runtimeBrowserAutomation:false},null,2)+'\n');
console.log(`008 research built: ${ids.length} IDs, ${manifest.length+1} static files; existing HTML/MP4 only, no model or browser task executed.`);
