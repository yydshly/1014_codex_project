import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const allow=new Set(['index.html','styles.css','live.css','app.js','live.js','content.js','mark.svg','mode.js','understanding.html','understanding.css','understanding.js','assets/understanding-map.svg','assets/understanding-map.png','data/platforms.json','data/cases.json','data/discovery-latest.json','notes/RESEARCH.md','notes/PRODUCT.md','notes/SOURCES.md','notes/EXPERIMENT-001.md','notes/UNDERSTANDING.md','notes/RUNNING.md','notes/ORIGIN-004.md']);
async function walk(dir){const names=[];for(const entry of await readdir(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())names.push(...await walk(target));else names.push(path.relative(root,target).replaceAll(path.sep,'/'));}return names;}
const files=await walk(root);assert.deepEqual(new Set(files),allow,'静态产物白名单发生变化');
assert.match(await readFile(path.join(root,'mode.js'),'utf8'),/PUBLIC_STATIC=true/);
for(const page of ['index.html','understanding.html']){
  const html=await readFile(path.join(root,page),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(ids.length,new Set(ids).size,`${page} 存在重复编号`);
  assert.doesNotMatch(html,/(?:href|src)="https?:\/\/(?:localhost|127\.0\.0\.1)/);
  for(const match of html.matchAll(/(?:href|src)="([^"#]+|#[^"]+)"/g)){
    const value=match[1];
    if(value.startsWith('#'))assert.ok(ids.includes(value.slice(1)),`无效锚点：${value}`);
    if(!value.startsWith('./'))continue;
    const file=value.split('#')[0];
    if(file==='./')continue;
    assert.ok((await stat(path.resolve(root,file))).isFile(),`资源不存在：${value}`);
  }
}
const html=await readFile(path.join(root,'index.html'),'utf8');
for(const term of ['个人品牌网站','入口引导','做之前回看','研究 → 实践 → 记录 → 展示 → 接触用户 → 获得反馈 → 更新研究','发现需求 → 验证问题 → 产品化扩展'])assert.ok(html.includes(term),`摘要缺少：${term}`);
const svg=await readFile(path.join(root,'assets/understanding-map.svg'),'utf8');
const png=await readFile(path.join(root,'assets/understanding-map.png'));
assert.equal(png.readUInt32BE(16),Number(svg.match(/width="(\d+)"/)[1]));assert.equal(png.readUInt32BE(20),Number(svg.match(/height="(\d+)"/)[1]));
console.log(`009 公开产物检查通过：${files.length} 个文件，摘要、锚点、资源、图像尺寸和静态边界有效。`);
