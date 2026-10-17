import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { createAutoResearchService } from './auto-research.mjs';
import { normalizeSources,finalizeResult,publicURL,actionFromEvent,quoteInText } from './auto-grounding.mjs';
import { publicIPv4,htmlText,verifySource } from './auto-verify.mjs';
const url='https://example.com/user-story';
const actions=[{type:'search',status:'completed',queries:['client feedback'],urls:[]},{type:'open_page',status:'completed',queries:[],urls:[url]}];
const source={url,title:'用户经历',role:'user_experience',quote:'I spend hours organizing client feedback.',location:'原帖正文',date_basis:'原帖日期待核实',access:'page_excerpt'};
const finding={kind:'need',title:'客户反馈整理',url,source_urls:[url],understanding:'设计师手动整理分散意见。',existing_solutions:'统一文档，效果未知。',unknowns:'频率和付费意愿未知。',nextStep:'核对一组脱敏记录。',decision:'needs_verification',reason:'有具体经历，仍需补采'};
const data={summary:'值得继续核查。',sources:[source],findings:[finding],excluded:[],limitations:['小样本不能推算市场规模。']};
const job={id:'12345678-1234-1234-1234-123456789012',input:{direction:'客户反馈整理',focus:'need'},finished_at:'2026-10-17T00:00:00.000Z'};

test('只有关联到打开记录的短引文才进入发现，摘要不能冒充原文',()=>{
 const sources=normalizeSources(data.sources,actions);const result=finalizeResult(data,sources,job);
 assert.equal(result.records.length,1);assert.match(result.records[0].evidence,/尚未独立逐字核验/);assert.equal(result.records[0].status,'todo');
 const rejected=finalizeResult(data,normalizeSources(data.sources,actions.slice(0,1)),job);
 assert.equal(rejected.records.length,0);assert.match(rejected.excluded[0].reason,/未取得/);
});
test('推广不能充当真实需求，重复主来源和无效字段被排除',()=>{
 assert.equal(finalizeResult(data,normalizeSources([{...source,role:'promotion'}],actions),job).records.length,0);
 const mixed={...data,findings:[finding,{...finding,title:'重复'},{...finding,url:'https://example.com/missing'}]};
 const out=finalizeResult(mixed,normalizeSources(data.sources,actions),job);assert.equal(out.records.length,1);assert.equal(out.excluded.length,2);
 assert.equal(finalizeResult({...data,findings:[{...finding,kind:'invalid'}]},normalizeSources(data.sources,actions),job).records.length,0);
});
test('GitHub与AI产品分类可保存，同时保留未试用边界',()=>{
 for(const kind of ['github','ai']){const info={...data,findings:[{...finding,kind,understanding:'官方描述的能力，尚未运行或试用。'}]};const result=finalizeResult(info,normalizeSources([{...source,role:kind==='github'?'official_repo':'official_product'}],actions),job);assert.equal(result.records[0].kind,kind);assert.match(result.records[0].understanding,/尚未运行或试用/);}
});
test('公开链接和IPv4校验拒绝本机、私网、认证信息与非HTTPS',()=>{
 for(const value of ['http://example.com','https://127.0.0.1/','https://localhost/','https://host.local/','https://[::1]/','https://user:secret@example.com/','https://example.com:8000/'])assert.equal(publicURL(value),null);
 for(const ip of ['127.0.0.1','10.0.0.2','169.254.169.254','192.168.1.1','172.16.0.1','100.64.1.1','0.0.0.0','224.0.0.1','invalid'])assert.equal(publicIPv4(ip),false,ip);
 assert.equal(publicIPv4('1.1.1.1'),true);
});
test('引文长度、去重与逐字匹配不将HTML脚本或近似句当证据',()=>{
 assert.equal(normalizeSources([{...source,quote:'字'.repeat(100)}],actions)[0].quote.length,70);
 assert.equal(normalizeSources([{...source,quote:'word '.repeat(30)}],actions)[0].quote.split(' ').length,25);
 assert.equal(normalizeSources([source,{...source,url:url+'/?utm_source=test#part'}],actions).length,1);
 assert.equal(htmlText('<script>fake quote</script><p>I spend hours &amp; effort.</p>'),'I spend hours & effort.');
 assert.equal(quoteInText('I spend hours',htmlText('<p>I spend hours</p>')),true);assert.equal(quoteInText('I save hours','I spend hours'),false);
});
test('公开动作只记录完成的web搜索，不混入推理与私有工具输出',()=>{
 assert.equal(actionFromEvent({type:'item.completed',item:{type:'reasoning',text:'private'}}),null);
 const action=actionFromEvent({type:'item.completed',item:{type:'web_search',id:'1',status:'completed',action:{type:'open_page',url,refs:['turn0search0','https://127.0.0.1/']}}});
 assert.deepEqual(action.urls,[url]);assert.equal(action.type,'open_page');
});
test('本地无法读取时保留未独立核验标签，不声称引文核对成功',async()=>{
 const result=await verifySource({...source,url:'https://127.0.0.1/',opened_in_trace:true});assert.equal(result.verification,'tool_read_excerpt');assert.equal(result.local_read.status,'unavailable');
});

async function harness(t,runner,overrides={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'research-004-test-'));
 const config={runtimeRoot:root,binary:'unused',model:'test',timeout:1000};
 const service=await createAutoResearchService({config,inspect:async()=>({available:true,message:'test'}),runner,verify:async value=>value,...overrides});
 const server=http.createServer((req,res)=>{service.handle(req,res,req.url.slice(1)).catch(error=>{res.writeHead(500);res.end(JSON.stringify({error:error.message}));});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await service.close();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 const get=route=>fetch(`${origin}/${route}`).then(r=>r.json());
 const post=(route,body,headers={})=>fetch(`${origin}/${route}`,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
 return {root,config,service,get,post};
}
async function ended(h,id){let result;for(let i=0;i<100;i++){result=await h.get(`runs/${id}`);if(['completed','failed','cancelled','interrupted'].includes(result.status))return result;await new Promise(r=>setTimeout(r,10));}throw new Error(`test task did not finish: ${JSON.stringify(result)}`);}
const success=async({onAction})=>{actions.forEach(onAction);return{data:structuredClone(data),actions,usage:{input_tokens:1}};};
test('HTTP提交→实际动作→候选→运行落盘→重启可读完整链路',async t=>{
 const h=await harness(t,success);const response=await h.post('runs',job.input);assert.equal(response.status,202);const started=await response.json();const result=await ended(h,started.id);
 assert.equal(result.status,'completed');assert.equal(result.records.length,1);assert.deepEqual(result.actions,actions);
 assert.deepEqual(JSON.parse(await readFile(path.join(h.root,`${started.id}.json`),'utf8')),result);
 const recovered=await createAutoResearchService({config:h.config,inspect:async()=>({available:true}),runner:success});
 const res={writeHead(status){this.status=status;},end(text){this.body=JSON.parse(text);}};
 await recovered.handle({method:'GET'},res,`runs/${started.id}`);assert.deepEqual(res.body.records,result.records);await recovered.close();
});
test('无搜索或模型失败不会产出假记录',async t=>{
 for(const runner of [async()=>({data,actions:[]}),async()=>{throw new Error('RUNNER_FAILED');}]){const h=await harness(t,runner);const start=await(await h.post('runs',job.input)).json();const result=await ended(h,start.id);assert.equal(result.status,'failed');assert.deepEqual(result.records,[]);}
});
test('重复提交被挡住，取消可结束任务并保留过程',async t=>{
 const h=await harness(t,({signal,onAction})=>new Promise((resolve,reject)=>{onAction(actions[0]);if(signal.aborted)reject(new Error('CANCELLED'));else signal.addEventListener('abort',()=>reject(new Error('CANCELLED')),{once:true});}));
 const start=await(await h.post('runs',job.input)).json();assert.equal((await h.post('runs',job.input)).status,409);assert.equal((await h.post(`runs/${start.id}/cancel`,{})).status,200);
 const result=await ended(h,start.id);assert.equal(result.status,'cancelled');assert.equal(result.actions.length,1);assert.equal((await h.get('status')).active_run_id,null);
});
test('跨站调用、无效输入、超长输入和未连接状态均不启动模型',async t=>{
 let count=0;const h=await harness(t,async()=>{count++;return success({onAction:()=>{}});});
 assert.equal((await h.post('runs',job.input,{origin:'https://example.com'})).status,403);
 assert.equal((await h.post('runs',{direction:'a',focus:'need'})).status,400);
 assert.equal((await h.post('runs',{direction:'正常内容',focus:'invalid'})).status,400);
 assert.equal((await h.post('runs',{direction:'字'.repeat(6000),focus:'need'})).status,413);assert.equal(count,0);
 const unavailable=await harness(t,success,{inspect:async()=>({available:false,message:'未登录'})});assert.equal((await unavailable.post('runs',job.input)).status,503);
});
test('重启后未完成运行标记中断，不自动再次消费模型额度',async t=>{
 const h=await harness(t,success);const id=job.id;
 const partial={...job,status:'searching',message:'搜索中',created_at:job.finished_at,records:[],actions};
 await writeFile(path.join(h.root,`${id}.json`),JSON.stringify(partial));await writeFile(path.join(h.root,'index.json'),JSON.stringify([{id,status:'searching'}]));
 let count=0;const service=await createAutoResearchService({config:h.config,inspect:async()=>({available:true}),runner:async()=>{count++;}});await service.close();
 const saved=JSON.parse(await readFile(path.join(h.root,`${id}.json`),'utf8'));assert.equal(saved.status,'interrupted');assert.equal(saved.actions.length,2);assert.equal(count,0);
});
