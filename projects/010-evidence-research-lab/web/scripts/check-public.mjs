import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(web,'dist');
const html=await readFile(path.join(dist,'index.html'),'utf8');
const data=JSON.parse(html.match(/<script id="archive-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(data.site_mode,'public');
assert.ok(!/href="https?:\/\/(?:127\.0\.0\.1|localhost)/.test(html),'公开导航不能指向读者自己的本机');
assert.ok(html.includes('id="synthesis"'));assert.ok(html.includes('公开研究档案'));
for(const row of data.researchSummary){assert.ok(html.includes(row.title));assert.ok(html.includes(row.text));}
for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${match[1]}"`),`缺少锚点 ${match[1]}`);
for(const [file,digest]of [['assets/understanding-map.svg',data.overview.svg_sha256],['assets/understanding-map.png',data.overview.png_sha256]])assert.equal(createHash('sha256').update(await readFile(path.join(dist,file))).digest('hex'),digest);
assert.deepEqual(JSON.parse(await readFile(path.join(dist,'sources.json'),'utf8')),data.sources);
assert.deepEqual(JSON.parse(await readFile(path.join(dist,'understanding-map.json'),'utf8')),data.overview.model);
async function list(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?list(path.join(dir,e.name)):[path.relative(dist,path.join(dir,e.name)).replaceAll('\\','/')]))).flat();}
assert.deepEqual((await list(dist)).sort(),['assets/understanding-map.png','assets/understanding-map.svg','index.html','sources.json','understanding-map.json']);
console.log('010 公开静态产物检查通过：摘要、锚点、原引导图、资料与发布范围一致；不含本地 API。');
