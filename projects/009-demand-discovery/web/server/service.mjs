import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { inspectCodex, runCodex } from './codex.mjs';
import { normalizeSources, mergeSources, normalizePeople, normalizeCandidates, reconcileDecisions } from './grounding.mjs';
import { verifySource } from './verify.mjs';
import { schemas } from './schema.mjs';
import { phasePrompt } from './prompts.mjs';

const phases=[['people','发现人群'],['problems','寻找问题'],['investigate','追查证据']];
const activeStates=new Set(['queued','running','verifying']);
const readJSON=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch{return null;}};
async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(value,null,2),'utf8');await rename(temp,file);}
function summary(job){return {id:job.id,status:job.status,domain:job.input.domain,created_at:job.created_at,finished_at:job.finished_at||null,message:job.message,people_count:job.people.length,candidate_count:job.candidates.length,source_count:job.sources.length};}
function failureMessage(error){return ({CANCELLED:'本轮已停止，已取得的过程和材料保留。',PHASE_TIMEOUT:'本轮调查超时，已取得的过程与材料保留，可缩小范围后再试。',AUTH_REQUIRED:'本机 Codex 登录需要更新，请在终端运行 codex login 后重试。',SEARCH_NOT_EXECUTED:'未观察到真实联网搜索，未将回答认定为在线研究结果。',NO_STRUCTURED_RESULT:'模型没有返回可解析的结构化结果，已保留搜索过程。',INVALID_RESULT:'结果格式未通过检查，已保留搜索过程。',UNEXPECTED_TOOL:'执行请求超出公开网页研究范围，本轮已停止。',TOOL_LIMIT:'本轮达到查询与页面打开上限，已保留过程。',NO_GROUNDED_PEOPLE:'没有取得带来源的人群，已保留搜索过程；没有补造结果。',NO_GROUNDED_CANDIDATES:'没有取得带来源的问题候选，已保留人群与搜索过程。',CODEX_FAILED:'OpenAI 本地执行未成功结束，已保留本轮过程；可检查 Codex 登录与额度后重试。'}[error.message]||'本轮未成功完成，已取得的过程保留，上次成功结果不受影响。');}
export async function createDiscoveryService(){
  const config=await loadConfig();await mkdir(config.runtimeRoot,{recursive:true});
  let health=await inspectCodex(config);
  let jobs=(await readJSON(path.join(config.runtimeRoot,'index.json')))||[];
  let latest=(await readJSON(path.join(config.runtimeRoot,'latest.json')))||(await readJSON(config.snapshot));
  if(latest&&!latest.id)latest=null;
  let active=null;let writeTail=Promise.resolve();
  for(const item of jobs)if(activeStates.has(item.status)){
    const old=await readJSON(path.join(config.runtimeRoot,'runs',`${item.id}.json`));
    item.status='interrupted';item.message='本地服务重启，上一轮已中断。';
    if(old){old.status='interrupted';old.message=item.message;old.finished_at=new Date().toISOString();await atomic(path.join(config.runtimeRoot,'runs',`${item.id}.json`),old);}
  }
  await atomic(path.join(config.runtimeRoot,'index.json'),jobs);
  function persist(job){
    const copy=JSON.parse(JSON.stringify(job));const index=jobs.map(row=>row.id===job.id?summary(job):row);
    jobs=index;writeTail=writeTail.catch(()=>{}).then(async()=>{await atomic(path.join(config.runtimeRoot,'runs',`${job.id}.json`),copy);await atomic(path.join(config.runtimeRoot,'index.json'),index);});return writeTail;
  }
  const setMessage=(job,message)=>{job.message=message;persist(job).catch(()=>{});};
  async function execute(job,controller){
    try{
      job.status='running';job.started_at=new Date().toISOString();await persist(job);
      for(const [phase,label] of phases){
        if(controller.signal.aborted)throw new Error('CANCELLED');
        const stage=job.stages.find(item=>item.id===phase);stage.status='running';stage.started_at=new Date().toISOString();
        if(phase==='people'){stage.question='这个领域里，谁在什么情境下完成哪些任务？';stage.reason='从宽泛领域出发，先用真实活动发现角色，不提前指定痛点。';}
        else if(phase==='problems'){stage.question=job.next_focus?.question||'这些人在哪些任务里反复费力？';stage.reason=job.next_focus?.reason||'沿第一轮的人群和活动继续找具体工作过程。';}
        else{stage.question=job.candidates.filter(item=>job.focus_ids.includes(item.id)).map(item=>item.next_question).join('；')||'候选问题是否有其他经历支持，有什么反例和已有办法？';stage.reason='依据第二轮留下的问题，补独立经历、反例和已有有效办法。';}
        job.phase=phase;job.message=`${label}：正在调用 OpenAI 联网调查…`;await persist(job);
        const result=await runCodex({config,phase,prompt:phasePrompt(phase,job.input,job),schema:schemas[phase],signal:controller.signal,onAction:action=>{job.actions.push(action);stage.search_count=job.actions.filter(item=>item.phase===phase&&item.type==='search').length;stage.open_count=job.actions.filter(item=>item.phase===phase&&['open_page','open'].includes(item.type)).length;setMessage(job,`${label}：已执行 ${stage.search_count} 次检索、${stage.open_count} 次页面打开。`);},onProgress:()=>setMessage(job,`${label}：正在联网检索或打开来源…`)});
        const sources=normalizeSources(result.data.sources,result.actions,phase);job.sources=mergeSources(job.sources,sources);
        stage.summary=String(result.data.summary||'').slice(0,1800);stage.status='completed';stage.finished_at=new Date().toISOString();stage.source_count=sources.length;
        job.usage.push({phase,...result.usage});job.limitations.push(...(Array.isArray(result.data.limitations)?result.data.limitations:[]).map(value=>String(value).slice(0,700)));
        if(phase==='people'){
          job.people=normalizePeople(result.data.people,job.sources);if(!job.people.length)throw new Error('NO_GROUNDED_PEOPLE');
          job.next_focus=result.data.next_focus;
          if(!job.people.some(item=>item.id===job.next_focus?.audience_id))job.next_focus={audience_id:job.people[0].id,question:job.people[0].next_question,reason:'沿已取得来源支持的人群继续调查；其他角色未通过来源关联检查。'};
        }else{
          const candidates=normalizeCandidates(result.data.candidates,job.sources,job.people);if(!candidates.length)throw new Error('NO_GROUNDED_CANDIDATES');
          if(phase==='problems'){
            job.candidates=candidates;job.focus_ids=(result.data.focus_ids||[]).filter(id=>candidates.some(item=>item.id===id)).slice(0,2);if(!job.focus_ids.length)job.focus_ids=[candidates[0].id];
          }else{
            const previousIds=new Set(job.candidates.map(item=>item.id));const updated=candidates.filter(item=>previousIds.has(item.id));
            if(updated.length)job.candidates=job.candidates.map(item=>updated.find(row=>row.id===item.id)||item);
            job.summary=stage.summary;job.decisions=(result.data.decisions||[]).filter(item=>previousIds.has(item.candidate_id)).slice(0,8);
            job.candidates=reconcileDecisions(job.candidates,job.decisions);
          }
        }await persist(job);
      }
      if(controller.signal.aborted)throw new Error('CANCELLED');job.status='verifying';job.message='调查已返回，正在检查来源短引文和本地可读性…';await persist(job);
      const relevant=new Set(job.candidates.flatMap(item=>item.evidence_urls));const toCheck=job.sources.filter(item=>relevant.has(item.url)).slice(0,12);
      for(let index=0;index<toCheck.length;index+=3){
        if(controller.signal.aborted)throw new Error('CANCELLED');
        const checked=await Promise.all(toCheck.slice(index,index+3).map(verifySource));job.sources=mergeSources(job.sources,checked);
        job.message=`正在核对来源：${Math.min(index+3,toCheck.length)} / ${toCheck.length}`;await persist(job);
      }
      const opened=job.sources.filter(item=>item.opened_in_trace||item.verification==='local_quote_checked').length;
      job.status=opened&&job.people.length>=2?'completed':'partial';job.finished_at=new Date().toISOString();
      job.limitations=[...new Set([...job.limitations,'公开搜索与可读页面只能覆盖部分讨论；没有验证市场规模或付费意愿。','工具打开记录表示发生过访问；模型短引文与本地逐字核验分别标记。'])];
      job.message=`本轮${job.status==='completed'?'完成':'部分完成'}：${job.people.length} 类人群、${job.candidates.length} 个问题候选、${job.sources.length} 条来源。`;
      job.quality={searched:job.actions.filter(item=>item.type==='search').length,opened:job.actions.filter(item=>['open_page','open'].includes(item.type)).length,trace_linked_sources:job.sources.filter(item=>item.opened_in_trace).length,quote_checked_sources:job.sources.filter(item=>item.verification==='local_quote_checked').length};
      await persist(job);await writeTail;await atomic(path.join(config.runtimeRoot,'latest.json'),job);latest=JSON.parse(JSON.stringify(job));
    }catch(error){
      job.status=error.message==='CANCELLED'?'cancelled':'failed';job.error_code=error.message;job.message=failureMessage(error);job.finished_at=new Date().toISOString();
      for(const stage of job.stages)if(stage.status==='running')stage.status=job.status;await persist(job);
    }finally{if(active?.id===job.id)active=null;}
  }
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  return {async handle(req,res,route){
    if(req.method==='GET'&&route==='status')return send(res,200,{...health,active_run_id:active?.id||null,runs:jobs.slice(0,12),latest_id:latest?.id||null,note:'官方 Codex 非交互模式使用本机 OpenAI 登录；不提取登录令牌，不调用其他模型供应商。'});
    if(req.method==='GET'&&route==='latest')return send(res,latest?200:404,latest||{error:'尚无完成的探索，输入领域后可开始。'});
    if(req.method==='POST'&&route==='refresh'){health=await inspectCodex(config);return send(res,200,health);}
    const match=route.match(/^runs\/([a-f0-9-]{36})(\/cancel)?$/);
    if(req.method==='GET'&&match&&!match[2]){const run=active?.id===match[1]?active.job:await readJSON(path.join(config.runtimeRoot,'runs',`${match[1]}.json`));return send(res,run?200:404,run||{error:'没有这条运行记录。'});}
    if(req.method==='POST'){
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(res,403,{error:'只接受当前本地网页的运行操作。'});
      if(match?.[2]){if(active?.id!==match[1])return send(res,409,{error:'本轮已结束。'});const id=active.id;active.controller.abort();return send(res,200,{status:'stopping',id});}
      if(route==='runs'){
        if(active)return send(res,409,{error:'已有探索正在运行。',run_id:active.id});if(!health.available)return send(res,503,{error:health.auth,code:'CODEX_NOT_READY'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>10000)return send(res,413,{error:'输入过长。'});}
        let raw;try{raw=JSON.parse(body);}catch{return send(res,400,{error:'输入格式不正确。'});}
        const domain=String(raw.domain||'').trim().slice(0,180);if(domain.length<2)return send(res,400,{error:'请先填写一个宽泛领域。'});
        const input={domain,market:String(raw.market||'英语市场').slice(0,120),constraints:String(raw.constraints||'适合个人开发者实现的网页工具').slice(0,500)};
        if(active)return send(res,409,{error:'已有探索正在运行。',run_id:active.id});
        const job={schema_version:1,id:randomUUID(),mode:'openai_codex_discovery',provider:'OpenAI · Codex 本地执行',model:config.model||'Codex 默认模型',input,status:'queued',message:'探索已进入队列。',created_at:new Date().toISOString(),people:[],candidates:[],sources:[],actions:[],decisions:[],usage:[],limitations:[],focus_ids:[],stages:phases.map(([id,label])=>({id,label,status:'pending',search_count:0,open_count:0}))};
        const controller=new AbortController();active={id:job.id,job,controller};jobs=[summary(job),...jobs].slice(0,12);await persist(job);send(res,202,summary(job));void execute(job,controller);return;
      }
    }return send(res,404,{error:'接口不存在。'});
  },async close(){
    active?.controller.abort();
    await new Promise(resolve=>setImmediate(resolve));
    await writeTail.catch(()=>{});
  }};
}
