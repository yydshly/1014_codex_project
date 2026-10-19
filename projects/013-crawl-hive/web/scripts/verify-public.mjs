import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const repository=fileURLToPath(new URL('../../../../',import.meta.url));
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const base='https://yydshly.github.io/1014_codex_project/';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
async function walk(folder){return (await Promise.all((await readdir(folder,{withFileTypes:true})).map(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):path.join(folder,entry.name)))).flat();}
async function get(relative){const response=await fetch(base+relative,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});assert(response.ok,`${relative}: HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer());}
const localFiles=await walk(dist), records=[];
for(let start=0;start<localFiles.length;start+=4){
  const results=await Promise.allSettled(localFiles.slice(start,start+4).map(async file=>{
    const relative='013-crawl-hive/'+path.relative(dist,file).replaceAll('\\','/');
    const [local,remote]=await Promise.all([readFile(file),get(relative)]);
    assert.equal(sha(remote),sha(local),'公网字节不匹配：'+relative);
    return {path:relative,status:200,bytes:remote.length,sha256:sha(remote)};
  }));
  for(const result of results){if(result.status==='rejected')throw result.reason;records.push(result.value);}
}
const html=(await get('013-crawl-hive/')).toString('utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size,'公网重复ID');
for(const name of ['synthesis','understanding-map','research-synthesis','source-access-catalog','source-control','information-search','information-filtering','information-presentation'])assert(ids.includes(name),'公网缺少章节：'+name);
for(const match of html.matchAll(/href="#([^"]+)"/g))assert(ids.includes(match[1]),'公网锚点不存在：'+match[1]);
const catalog=JSON.parse(await get('projects.json'));
const entries=JSON.parse(await get('entries.json'));
const manifest=JSON.parse(await readFile(path.join(repository,'web/pages.json'),'utf8'));
assert.equal(catalog.projects.length,manifest.projects.length,'已发布项目被遗漏');
for(const item of catalog.projects)assert(manifest.projects.includes(item.id+'-'+item.slug));
for(const anchor of ['synthesis','understanding-map','source-access-catalog'])assert(entries.projects['013'].some(entry=>entry.path.endsWith('#'+anchor)),'主入口缺少013章节');
const routes=[...new Set(['',...Object.values(entries.projects).flat().map(entry=>entry.path.split(/[?#]/)[0]),'projects/013-crawl-hive/README.md','projects/013-crawl-hive/assets/understanding-overview.jpg'])];
for(const route of routes)await get(route);
const result={checkedAt:new Date().toISOString(),base,staticFiles:records,staticFileCount:records.length,routeCount:routes.length,projectIds:catalog.projects.map(item=>item.id),uniquePageIds:ids.length,anchorsChecked:[...html.matchAll(/href="#([^"]+)"/g)].length,publicSnapshotOnly:true,scope:'HTTP、静态字节、入口与锚点核验；浏览器交互结果单独记录'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(`公网验证通过：${records.length}份静态文件字节一致，${routes.length}个入口/资料，${ids.length}个唯一ID，保留${catalog.projects.length}个发布项目。`);
