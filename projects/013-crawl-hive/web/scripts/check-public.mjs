import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
async function walk(folder){return (await Promise.all((await readdir(folder,{withFileTypes:true})).map(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):path.join(folder,entry.name)))).flat();}
const files=await walk(dist);
for(const file of files)assert(!/(?:^|[\\/])(?:\.runtime|\.env|node_modules)(?:[\\/]|$)|\.mjs$/.test(file),'静态产物包含运行文件：'+file);
for(const name of ['index.html','understanding.css','source-catalog.js','media/understanding-map.svg','explore/index.html','explore/app.js','explore/deployment-mode.js','explore/snapshot.json'])await access(path.join(dist,name));
assert((await readFile(path.join(dist,'explore/deployment-mode.js'),'utf8')).includes('publicMode = true'),'公开模式未启用');
const app=await readFile(path.join(dist,'explore/app.js'),'utf8');
assert(app.includes('publicMode')&&app.includes('snapshotOnly'),'公开页缺少快照隔离');
const snapshot=JSON.parse(await readFile(path.join(dist,'explore/snapshot.json'),'utf8'));
assert.equal(snapshot.items.length,51);assert.equal(snapshot.sources.length,4);
const html=await readFile(path.join(dist,'index.html'),'utf8');
for(const id of ['synthesis','understanding-map','source-access-catalog','synthesis-personal'])assert(html.includes('id="'+id+'"'),'公开页缺少摘要/总图/来源/场景：'+id);
console.log(`公开构建通过：${files.length} 份静态文件，51条历史快照；不发布采集服务或运行缓存。`);
