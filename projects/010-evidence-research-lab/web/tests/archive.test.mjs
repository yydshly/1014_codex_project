import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {content} from '../archive/content.mjs';
import {journey,journeyMarkdown} from '../archive/journey.mjs';
import {createApp} from '../server.mjs';
import {inlineSourceHashes} from '../lib/csp.mjs';
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),project=path.resolve(web,'..');
const html=readFileSync(path.join(web,'dist/index.html'),'utf8');
const data=JSON.parse(html.match(/<script id="archive-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const hash=value=>createHash('sha256').update(value).digest('hex');

test('Windows CRLF、单独 CR 与混合换行的 CSP 匹配浏览器规范化文本',()=>{
  const style=':root {\r\n  color: green;\r}\n';
  const script='const title="研究档案";\r\nconst ready=true;\r';
  const hashes=inlineSourceHashes(`<style>${style}</style><script>${script}</script>`);
  const token=source=>`'sha256-${createHash('sha256').update(source).digest('base64')}'`;
  assert.deepEqual(hashes.style,[token(':root {\n  color: green;\n}\n')]);
  assert.deepEqual(hashes.script,[token('const title="研究档案";\nconst ready=true;\n')]);
  assert.ok(!hashes.style.includes(token(style)));
  assert.ok(!hashes.script.includes(token(script)));
});
test('单文件完整保存每份研究材料原文与哈希，涵盖全部来源和讨论',()=>{
  assert.equal(data.documents.length,content.materials.length);assert.equal(data.discussions.length,content.discussions.length);
  const originalQuestions=['q-demand','q-atypica','q-web','q-model','q-simulation','q-barrier','q-pay','q-build','q-difference','q-stop'];
  assert.deepEqual(data.discussions.slice(0,10).map(q=>q.id),originalQuestions);
  assert.ok(data.discussions.some(q=>q.id==='q-gameplay-space'));assert.ok(data.discussions.some(q=>q.id==='q-public-data'));
  for(const doc of data.documents){assert.ok(!doc.path.includes('.runtime'));assert.ok(!doc.path.includes('.env'));const original=readFileSync(path.join(project,doc.path));assert.equal(doc.text,original.toString('utf8'));assert.equal(doc.sha256,hash(original));}
  const sources=readFileSync(path.join(project,'SOURCES.md'),'utf8');for(const match of sources.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g))assert.ok(data.sources.some(s=>s.url===match[1]),`来源未保留：${match[1]}`);
  assert.equal(new Set(data.sources.map(s=>s.url)).size,data.sources.length);assert.ok(data.sources.some(s=>s.url===content.origin.url));assert.ok(!/__([A-Z_]+)__/.test(html));
  assert.equal(readFileSync(path.join(web,'index.html'),'utf8'),html);
});

test('新增专题与完整理解记录、JSON 和 Markdown 使用同一内容，保留已做与设想边界',()=>{
  assert.equal(data.journey.updated_at,'2026-10-19');
  assert.equal(data.journey.chapters.length,journey.chapters.length);
  assert.ok(data.journey.chapters.some(c=>c.id==='action-plan'));
  const journal=data.documents.find(d=>d.path==='DISCUSSION.md');assert.ok(journal);
  assert.equal(data.journey_markdown,journal.text);
  assert.equal(journeyMarkdown(journey,content.discussions,data.sources,data.overview.model),journal.text);
  for(const chapter of data.journey.chapters){
    assert.ok(html.includes(`id="${chapter.id}"`));assert.ok(journal.text.includes(chapter.title));assert.ok(journal.text.includes(chapter.status));
    for(const section of chapter.sections){assert.ok(journal.text.includes(section.heading));for(const ref of section.refs||[])assert.ok(data.sources.some(s=>s.id===ref));}
  }
  for(const q of data.discussions){assert.ok(journal.text.includes(q.question));for(const paragraph of q.paragraphs)assert.ok(journal.text.includes(paragraph));}
  assert.ok(journal.text.includes('R0/R1/R2'));assert.ok(journal.text.includes('未执行'));
  assert.equal(data.smoke.corpus_sha256,'f333eda1300fb1a0bb4ceb3325ed57eb2ad4689be29b471d16c43cf5a6634b81');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'不能有重复锚点');
});

test('总览图与图源、网页和导出一致，保持原试跑及未验证边界',()=>{
  const model=JSON.parse(readFileSync(path.join(project,'data/understanding-map.json'),'utf8'));
  const svg=readFileSync(path.join(project,'assets/understanding-map.svg'),'utf8');
  const png=readFileSync(path.join(project,'assets/understanding-map.png'));
  assert.deepEqual(data.overview.model,model);assert.equal(data.overview.source_sha256,hash(JSON.stringify(model)));
  assert.equal(data.overview.svg,svg);assert.equal(data.overview.svg_sha256,hash(svg));assert.equal(data.overview.png_sha256,hash(png));
  assert.ok(svg.includes(`data-source-sha256="${data.overview.source_sha256}"`));
  assert.ok(!/<(?:script|foreignObject|image)\b|\bon\w+=|(?:href|url)\s*[=(]/i.test(svg),'原创 SVG 不携带脚本或外部资源');
  assert.ok(html.includes(`src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"`));
  assert.ok(html.includes(`href="data:image/png;base64,${png.toString('base64')}"`));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let pngSourceHash;
  for(let offset=8;offset+12<=png.length;){const size=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);assert.ok(offset+12+size<=png.length);if(type==='tEXt'){const [key,value]=png.toString('utf8',offset+8,offset+8+size).split('\0');if(key==='source_sha256')pngSourceHash=value;}offset+=size+12;}
  assert.equal(pngSourceHash,data.overview.source_sha256,'PNG 与 SVG 必须使用同一份当前图源');
  assert.equal(model.trial.corpus_sha256,data.smoke.corpus_sha256);
  assert.ok(model.trial.notes.includes('这不是对 Atypica 产品的效果验证。'));
  assert.ok(model.status.includes('暂不推进'));assert.ok(model.core.boundary.includes('不等于已证明'));
  for(const text of [model.title,model.conclusion,model.boundary,model.core.boundary,...model.pipeline.map(s=>s.title)])assert.ok(data.journey_markdown.includes(text));
  for(const ref of model.source.refs)assert.ok(data.sources.some(s=>s.id===ref));
});

test('研究行动样例沿用实际历史计量与来源，不补写事前预期或新增模型执行',()=>{
  const example=JSON.parse(data.documents.find(d=>d.path==='data/research-action.example.json').text);
  const full=JSON.parse(data.documents.find(d=>d.path==='data/bc-smoke-archive.json').text);
  assert.equal(example.record_type,'historical_retrospective');assert.equal(example.runtime_import_supported,false);
  assert.equal(example.action_and_result.expectation_before_run,null);assert.equal(example.action_and_result.new_outreach_or_model_calls,false);
  for(const source of example.sources)assert.ok(data.documents.some(d=>d.path===source.path));
  for(const evidence of example.evidence)assert.ok(example.sources.some(s=>s.id===evidence.source_id));
  const measurements=example.evidence.find(e=>e.id==='EV-010-01').measurements;
  for(const arm of ['B','C']){
    assert.equal(measurements[arm].total_tokens,data.smoke.results[arm].measurements.total_tokens);
    assert.equal(measurements[arm].elapsed_seconds,data.smoke.results[arm].measurements.elapsed_seconds);
    assert.equal(measurements[arm].model_calls,full.calls.filter(c=>c.arm===arm).length);
  }
  for(const id of example.judgment.evidence_ids)assert.ok(example.evidence.some(e=>e.id===id));
  assert.equal(example.learning.action_id,example.action_and_result.id);assert.equal(example.learning.automatic_revisit_scheduled,false);
});
test('归档试跑仅有原始合成资料，每条引用和提示哈希均可回查',()=>{
  const full=JSON.parse(data.documents.find(d=>d.path==='data/bc-smoke-archive.json').text);
  assert.equal(full.manifest.corpus_sha256,data.smoke.corpus_sha256);assert.ok(full.manifest.sources.every(s=>s.origin==='synthetic'));
  for(const [arm,result]of Object.entries(full.results))for(const e of result.evidence){const source=full.manifest.sources.find(s=>s.id===e.source_id);assert.equal(source.text.slice(e.start,e.end),e.quote);assert.equal(source.sha256,e.source_sha256);assert.equal(result.report.input_manifest_sha256,full.manifest_sha256);}
  for(const [name,artifact] of Object.entries(full.artifacts))assert.equal(hash(artifact.text),artifact.sha256,name);
  for(const call of full.calls){assert.equal(hash(full.artifacts[`${call.arm}-${call.stage}.prompt.txt`].text),call.prompt_sha256);assert.equal(hash(JSON.stringify(JSON.parse(full.artifacts[`${call.arm}-${call.stage}.schema.json`].text))),call.schema_sha256);}
  assert.equal(Object.keys(full.artifacts).length,11);
});
test('归档为无远程资源依赖的独立 HTML，引用锚点有效',()=>{
  assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html));assert.ok(html.includes('data:image/jpeg;base64,'));
  for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${match[1]}"`),`锚点不存在：${match[1]}`);
  assert.ok(!readFileSync(path.join(web,'archive/app.js'),'utf8').includes('fetch('));assert.ok(!html.includes('onclick='));
});
test('HTTP 归档和编号入口均可用、CSP 与实际内联内容匹配，阅读不触发模型',async t=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'erl-archive-'));let called=0;const model={inspect:async()=>{called++;throw new Error('阅读归档不应检查模型');},generate:async()=>{called++;throw new Error('不应调用模型');}};
  const app=createApp({dataDir:root,model:'unavailable'},{model});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.close();rmSync(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  for(const endpoint of ['/','/research.html','/1014_codex_project/010-evidence-research-lab/']){
    const res=await fetch(base+endpoint);assert.equal(res.status,200);const body=await res.text();assert.equal(body,html);const csp=res.headers.get('content-security-policy');assert.ok(!csp.includes('unsafe-inline'));for(const match of body.matchAll(/<(script|style)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)){const browserSource=match[2].replace(/\r\n?/g,'\n');const digest=createHash('sha256').update(browserSource).digest('base64');assert.ok(csp.includes(`'sha256-${digest}'`),`${match[1]} 的安全指纹必须匹配 HTML 换行规范化后的内容`);}
  }
  const lab=await fetch(base+'/workbench/');assert.equal(lab.status,200);assert.ok((await lab.text()).includes('原 B/C 实验工具'));assert.equal(called,0);
});
