import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store,hash} from '../lib/store.mjs';
import {Engine,freezeManifest,locateEvidence,LIMITS} from '../lib/engine.mjs';
import {createApp} from '../server.mjs';
const sample=JSON.parse(readFileSync(new URL('../sample.json',import.meta.url),'utf8'));
function fixture(t){const root=mkdtempSync(path.join(os.tmpdir(),'erl-test-'));const store=new Store(root);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});return store;}
function fakeModel(sources,{invalid=false,tokens=100}={}) {
  const quote=sources[0].text.split('\n')[1];const calls=[];
  return {calls,inspect:async()=>({available:true,auth:'test',version:'fixture',snapshot_verified:false}),generate:async input=>{
    calls.push(input);const data=input.schema.properties.evidence?{evidence:[{source_id:sources[0].id,quote,summary:'资料中的困难',kind:'user_self_report',role:'support'}],limitations:['测试提取']}:{scope:'测试范围',findings:[{statement:'需要进一步检验',kind:'inferred',references:[{source_id:sources[0].id,quote:invalid?'这句话在资料中不存在':quote,role:'support'}],unknowns:['实际付费未知'],next_validation:'访谈核对'}],limitations:['仅测试']};
    return {data,usage:{input_tokens:tokens,output_tokens:10},returned_model:null};
  }};
}
test('导入原文规范化、转载分簇和重复正文去重；无效批次全部回滚',t=>{
  const store=fixture(t);const rows=store.importSources(sample.sources);assert.equal(rows.length,4);assert.equal(new Set(rows.map(s=>s.cluster_id)).size,3);
  assert.equal(store.importSources([sample.sources[0]])[0].duplicate,true);assert.equal(store.sources().length,4);
  assert.throws(()=>store.importSources([sample.sources[0],{...sample.sources[1],text:''}]));assert.equal(store.sources().length,4);
  assert.throws(()=>store.importSources([{...sample.sources[0],url:'javascript:alert(1)'}]));
});
test('证据记录原文 UTF-16 区段与行号；拒绝改写引文',t=>{
  const store=fixture(t),[s]=store.importSources([sample.sources[0]]);const quote=s.text.split('\n')[1];const e=store.addEvidence({source_id:s.id,quote,summary:'测试',role:'counter'});
  assert.equal(s.text.slice(e.start,e.end),quote);assert.equal(e.line,2);assert.equal(e.source_sha256,hash(s.text));
  assert.throws(()=>store.addEvidence({source_id:s.id,quote:'虚构引文',summary:'错误'}));
  assert.equal(locateEvidence({source_id:s.id,quote:'虚构'},[s],1).valid,false);
});
test('B/C 原文逐字相同，独立调用，C 两阶段全计量，不读取人工笔记',async t=>{
  const store=fixture(t),sources=store.importSources(sample.sources);store.addEvidence({source_id:sources[0].id,quote:sources[0].text.split('\n')[1],summary:'仅人工笔记机密标记',role:'support'});
  const model=fakeModel(sources),engine=new Engine(store,model),exp=engine.create(sample.question,'fixture-model');assert.throws(()=>engine.create(sample.question,'fixture-model'));
  const result=await engine.execute(exp);assert.equal(result.status,'succeeded');assert.equal(model.calls.length,3);
  const corpus=JSON.stringify(exp.manifest.sources);for(const c of model.calls){assert.ok(c.prompt.includes(corpus));assert.ok(!c.prompt.includes('仅人工笔记机密标记'));}
  assert.equal(result.results.B.report.measurements.total_tokens,110);assert.equal(result.results.C.report.measurements.total_tokens,220);
  assert.equal(result.results.B.report.input_manifest_sha256,result.results.C.report.input_manifest_sha256);
  assert.equal(result.results.B.report.status,'draft');assert.equal(result.results.C.report.status,'draft');assert.equal(result.results.C.report.hypotheses.length,0);
  assert.equal(result.results.C.extraction.evidence.length,1);
  const reviewed=engine.review(exp.id,'B','F1','verified');assert.equal(reviewed.results.B.report.status,'completed');
  assert.ok(readFileSync(path.join(store.experimentDir(exp.id),'B-report.md'),'utf8').includes('completed'));
});
test('无效引文从发现中拒绝并标记 partial，不能被当作成功事实',async t=>{
  const store=fixture(t),sources=store.importSources(sample.sources),model=fakeModel(sources,{invalid:true});const engine=new Engine(store,model),exp=engine.create(sample.question,'fixture-model');await engine.execute(exp);
  for(const arm of ['B','C']){const r=exp.results[arm];assert.equal(r.report.status,'partial');assert.equal(r.report.findings.length,0);assert.equal(r.invalid_references.length,1);assert.equal(r.metrics.valid_citation_rate,0);}
});
test('预算超额保留消耗记录并停止；大资料不截断后偷偷运行',async t=>{
  const store=fixture(t),sources=store.importSources(sample.sources),model=fakeModel(sources,{tokens:LIMITS.reported_tokens_per_arm+1}),engine=new Engine(store,model),exp=engine.create(sample.question,'fixture-model');await engine.execute(exp);
  assert.equal(exp.status,'failed');assert.equal(model.calls.length,1);assert.ok(exp.calls[0].usage.input_tokens>120000);
  assert.throws(()=>freezeManifest([{...sources[0],text:'中'.repeat(20000)}],sample.question,'fixture-model'),/36 KB/);
});
test('C 的虚构提取引文被隔离，不能进入下一步分析提示词',async t=>{
  const store=fixture(t),sources=store.importSources(sample.sources),model=fakeModel(sources);const generate=model.generate;
  model.generate=async input=>{const output=await generate(input);if(input.schema.properties.evidence)output.data.evidence[0].quote='只存在于错误提取中的虚构句子';return output;};
  const engine=new Engine(store,model),exp=engine.create(sample.question,'fixture-model');await engine.execute(exp);
  assert.equal(exp.status,'succeeded');assert.equal(exp.results.C.extraction.evidence.length,0);assert.equal(exp.results.C.extraction.invalid.length,1);
  const analysis=model.calls.find(c=>c.prompt.includes('rejected_quote_count'));assert.ok(analysis);assert.ok(!analysis.prompt.includes('只存在于错误提取中的虚构句子'));
});
test('取消和模型失败保留阶段记录，不生成假完成状态',async t=>{
  const store=fixture(t);store.importSources(sample.sources);const model={inspect:async()=>({available:true}),generate:({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('已取消')),{once:true}))};
  const engine=new Engine(store,model),exp=engine.create(sample.question,'fixture-model');const running=engine.execute(exp);await new Promise(r=>setImmediate(r));engine.cancel();await running;assert.equal(exp.status,'cancelled');assert.equal(exp.calls[0].status,'failed');assert.deepEqual(exp.results,{});
});
test('撤回来源传播到人工证据、冻结实验与原文导出文件',async t=>{
  const store=fixture(t),sources=store.importSources(sample.sources),model=fakeModel(sources),engine=new Engine(store,model),exp=engine.create(sample.question,'fixture-model');await engine.execute(exp);
  store.addEvidence({source_id:sources[0].id,quote:sources[0].text.split('\n')[1],summary:'测试',role:'support'});const dir=store.experimentDir(exp.id);assert.ok(existsSync(dir));assert.equal(store.removeSource(sources[0].id),1);assert.equal(store.evidence().length,0);assert.equal(store.experiments().length,0);assert.equal(existsSync(dir),false);
});
test('HTTP 完整流程：CSRF、导入、证据、对照、持久化读取和导出',async t=>{
  const store=fixture(t);const sources=store.importSources(sample.sources);const model=fakeModel(sources);const app=createApp({dataDir:store.root,model:'fixture-model'},{store,model});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>app.server.close(resolve)));const base=`http://127.0.0.1:${app.server.address().port}`;
  const state=await(await fetch(base+'/api/state')).json();const options=body=>({method:'POST',headers:{'Content-Type':'application/json','X-ERL-CSRF':state.csrf},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/sources',{method:'POST',body:'{}'})).status,403);
  const imported=await fetch(base+'/api/sources',options({sources:[sample.sources[0]]}));assert.equal(imported.status,200);
  const evidence=await fetch(base+'/api/evidence',options({source_id:sources[0].id,quote:sources[0].text.split('\n')[1],summary:'检查',role:'support'}));assert.equal(evidence.status,200);
  const response=await fetch(base+'/api/experiments',options({question:sample.question}));assert.equal(response.status,202);const {id}=await response.json();
  let exp;for(let i=0;i<30;i++){exp=await(await fetch(base+`/api/experiments/${id}`)).json();if(exp.status!=='running')break;await new Promise(r=>setTimeout(r,5));}assert.equal(exp.status,'succeeded');
  for(const arm of ['B','C']){const json=await(await fetch(base+`/api/experiments/${id}/export?arm=${arm}&format=json`)).json();assert.ok(json.manifest.sources[0].text);assert.equal(json.evidence.length,1);const md=await fetch(base+`/api/experiments/${id}/export?arm=${arm}&format=md`);assert.equal(md.status,200);assert.ok((await md.text()).includes('UTF-16'));}
  assert.equal((await fetch(base+'/lib/model.mjs')).status,404);assert.equal((await fetch(base+'/.runtime/lab.sqlite')).status,404);
});
