import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report=JSON.parse(await readFile(path.join(root,'.runtime/latest.json'),'utf8'));
if(!['completed','partial'].includes(report.status)||report.mode!=='openai_codex_discovery'||!report.sources?.length)throw new Error('只有真实完成并含来源的探索可以导出为样本。');
await writeFile(path.join(root,'../data/discovery-latest.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(`已保存真实探索样本：${report.people.length} 类人群、${report.candidates.length} 个问题候选、${report.sources.length} 条来源。`);
