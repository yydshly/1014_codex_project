import { mkdir, readFile, copyFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.resolve(web, '..');
const output = path.join(web, 'dist');
const publicStatic=process.argv.includes('--public');
await import('./build-understanding.mjs');
const data = JSON.parse(await readFile(path.join(project, 'data/platforms.json'), 'utf8'));
const allowedCategories = ['discussion', 'reviews', 'jobs', 'developer', 'vertical', 'trends'];
const ids = new Set();
for (const item of data.platforms) {
  if (ids.has(item.id)) throw new Error(`平台编号重复：${item.id}`);
  ids.add(item.id);
  for (const key of ['id','name','url','category','region','audience','observe','discovery_question','access','access_note','bias','reference_url','checked_at','verification']) {
    if (!item[key]) throw new Error(`${item.id} 缺少 ${key}`);
  }
  if (!allowedCategories.includes(item.category)) throw new Error(`平台分类错误：${item.category}`);
  for (const url of [item.url, item.reference_url]) if (new URL(url).protocol !== 'https:') throw new Error(`来源链接需要 HTTPS：${item.id}`);
}
if (data.platforms.length < 20) throw new Error('本轮目录需要至少 20 个平台入口');
if(path.dirname(output)!==web||path.basename(output)!=='dist')throw new Error('构建目录越界');
await rm(output,{recursive:true,force:true});
await mkdir(path.join(output, 'data'), { recursive: true });
await mkdir(path.join(output, 'notes'), { recursive: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
await Promise.all([
  ...['index.html', 'styles.css', 'live.css', 'app.js', 'live.js', 'content.js', 'mark.svg', 'understanding.html', 'understanding.css', 'understanding.js'].map(file => copyFile(path.join(web, file), path.join(output, file))),
  ...['platforms.json', 'cases.json'].map(file => copyFile(path.join(project, 'data', file), path.join(output, 'data', file))),
  copyFile(path.join(project,'data/discovery-latest.json'),path.join(output,'data/discovery-latest.json')),
  ...['RESEARCH.md', 'PRODUCT.md', 'SOURCES.md','EXPERIMENT-001.md','UNDERSTANDING.md'].map(file => copyFile(path.join(project, file), path.join(output, 'notes', file))),
  copyFile(path.join(project,'assets/understanding-map.svg'),path.join(output,'assets/understanding-map.svg')),
  copyFile(path.join(web, 'README.md'), path.join(output, 'notes/RUNNING.md')),
  copyFile(path.join(project, '../004-jasonzhu-ai/RESEARCH.md'), path.join(output, 'notes/ORIGIN-004.md')),
]);
await writeFile(path.join(output,'mode.js'),`export const PUBLIC_STATIC=${publicStatic};\n`);
if(publicStatic){
  const indexPath=path.join(output,'index.html');
  const html=await readFile(indexPath,'utf8');
  await writeFile(indexPath,html.replace('正在检查本机 OpenAI 执行状态…','公开研究档案 · 正在读取已保存的实验结果…'));
}
try { await access(path.join(project,'assets/understanding-map.png')); await copyFile(path.join(project,'assets/understanding-map.png'),path.join(output,'assets/understanding-map.png')); }
catch(error) { if(error.code!=='ENOENT') throw error; }
console.log(`009 ${publicStatic?'公开档案':'本地研究台'}已构建：${data.platforms.length} 个平台入口，2 条已有研究案例，完整研究与产品说明。`);
