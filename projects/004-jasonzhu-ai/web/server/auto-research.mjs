import path from 'node:path';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { inspectRunner, runResearch } from './auto-runner.mjs';
import { researchSchema, researchPrompt } from './auto-schema.mjs';
import { normalizeSources, finalizeResult } from './auto-grounding.mjs';
import { verifySource } from './auto-verify.mjs';
const activeStates = new Set(['queued','searching','reading','analysing','checking']);
const send = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
const readJSON = async (file,fallback) => { try { return JSON.parse(await readFile(file,'utf8')); } catch(error) { if(error.code==='ENOENT')return fallback; throw error; } };
const summary = j => ({id:j.id,input:j.input,status:j.status,message:j.message,created_at:j.created_at,count:j.records.length});
const messageFor = error => ({ CANCELLED:'已停止，本轮过程保留，已有发现不受影响。', TIMEOUT:'本轮超时，过程已保留。可缩小研究方向后重试。', RUNNER_FAILED:'模型执行失败，请检查本机 Codex 登录、模型访问和额度，再重新运行。', NO_SEARCH:'未观察到实际联网搜索，本轮没有生成发现。', INVALID_RESULT:'返回格式未通过校验，本轮没有保存发现。', UNEXPECTED_TOOL:'执行超出公开网页研究范围，本轮已停止。', TOOL_LIMIT:'本轮已达搜索次数上限，可缩小研究范围重试。' }[error.message] || '本轮执行失败，之前的研究与发现保留。');
export async function createAutoResearchService(overrides = {}) {
  const base=loadConfig();
  const config=overrides.config || {binary:base.codexBinary,model:base.codexModel,timeout:base.researchTimeout,runtimeRoot:path.join(base.runtimeRoot,'auto-research')};
  const runner=overrides.runner || runResearch; const inspect=overrides.inspect || inspectRunner; const verify=overrides.verify || verifySource;
  await mkdir(config.runtimeRoot,{recursive:true}); let health=await inspect(config); let active=null; let tail=Promise.resolve();
  let jobs=await readJSON(path.join(config.runtimeRoot,'index.json'),[]);
  async function atomic(file,value) { const tmp=`${file}.${randomUUID()}.tmp`; await writeFile(tmp,JSON.stringify(value,null,2));for(let attempt=0;;attempt++){try{await rename(tmp,file);return;}catch(error){if(attempt>=4||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));}} }
  function readSaved(id){const reading=tail.catch(()=>{}).then(()=>readJSON(path.join(config.runtimeRoot,`${id}.json`),null));tail=reading.then(()=>{},()=>{});return reading;}
  function persist(job) {
    jobs=[summary(job),...jobs.filter(j=>j.id!==job.id)].slice(0,20);
    const copy=JSON.parse(JSON.stringify(job)), index=JSON.parse(JSON.stringify(jobs));
    tail=tail.catch(()=>{}).then(async()=>{ await atomic(path.join(config.runtimeRoot,`${copy.id}.json`),copy); await atomic(path.join(config.runtimeRoot,'index.json'),index); }).catch(error=>{console.error('Research persistence error:',error.code);throw error;}); return tail;
  }
  for(const item of [...jobs]) if(activeStates.has(item.status)) {
    const old=await readJSON(path.join(config.runtimeRoot,`${item.id}.json`),null);
    if(old){old.status='interrupted';old.message='服务重启，本轮已中断；可以查看已保存过程后重新运行。';await persist(old);}
  }
  async function execute(job,controller) {
    try {
      job.status='searching';job.message='正在搜索公开资料…';await persist(job);
      const result=await runner({config,id:job.id,prompt:researchPrompt(job.input),schema:researchSchema,signal:controller.signal,onAction:action=>{
        job.actions.push(action);job.status=action.type==='search'?'searching':'reading';
        job.message=`已完成 ${job.actions.filter(a=>a.type==='search').length} 次搜索、${job.actions.filter(a=>['open','open_page','openPage'].includes(a.type)).length} 次原文打开，正在分析筛选…`;persist(job).catch(()=>{});
      }});
      if(controller.signal.aborted)throw new Error('CANCELLED');
      if(!result.actions.some(a=>a.type==='search'&&a.status==='completed'))throw new Error('NO_SEARCH');
      job.actions=result.actions;job.usage=result.usage;job.status='checking';job.message='已返回分析，正在核对来源、短引文和重复内容…';await persist(job);
      const sources=normalizeSources(result.data.sources,result.actions);
      for(let i=0;i<sources.length;i+=3) {
        if(controller.signal.aborted)throw new Error('CANCELLED');
        const checked=await Promise.all(sources.slice(i,i+3).map(source=>verify(source,{signal:controller.signal})));sources.splice(i,checked.length,...checked);
      }
      if(controller.signal.aborted)throw new Error('CANCELLED');
      job.finished_at=new Date().toISOString();Object.assign(job,finalizeResult(result.data,sources,job));
      job.status='completed';job.message=job.records.length?`研究完成，得到 ${job.records.length} 条可保存发现。`:'研究完成；本轮没有达到来源条件的发现，查看筛选理由后可调整方向。';
      await persist(job);
    } catch(error) { job.status=controller.signal.aborted?'cancelled':'failed';job.message=messageFor(controller.signal.aborted?new Error('CANCELLED'):error);job.finished_at=new Date().toISOString();await persist(job); }
    finally { if(active?.job.id===job.id)active=null; }
  }
  return { async handle(req,res,route) {
    if(req.method==='GET'&&route==='status')return send(res,200,{...health,model:config.model||'Codex 默认模型',active_run_id:active?.job.id||null,runs:jobs});
    const match=route.match(/^runs\/([a-f0-9-]{36})(\/cancel)?$/);
    if(req.method==='GET'&&match&&!match[2]) { const job=await readSaved(match[1]);return send(res,job?200:404,job||{error:'找不到运行记录'}); }
    if(req.method==='POST') {
      if(req.headers.origin!==`http://${req.headers.host}` || !String(req.headers['content-type']).startsWith('application/json'))return send(res,403,{error:'只接受当前网页的研究操作。'});
      if(route==='refresh'){health=await inspect(config);return send(res,200,health);}
      if(match?.[2]) { if(active?.job.id!==match[1])return send(res,409,{error:'这次研究已经结束。'});active.controller.abort();return send(res,200,{message:'正在停止…'}); }
      if(route==='runs') {
        if(active)return send(res,409,{error:'已有研究正在执行。',run_id:active.job.id});
        if(!health.available)return send(res,503,{error:health.message});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>5000)return send(res,413,{error:'输入过长'});}
        let input;try{const raw=JSON.parse(body);if(typeof raw.direction!=='string'||raw.direction.trim().length<2||raw.direction.trim().length>300||!['all','need','github','ai'].includes(raw.focus))throw new Error();input={direction:raw.direction.trim(),focus:raw.focus};}catch{return send(res,400,{error:'请填写2–300字研究方向，并选择有效的研究目的。'});}
        if(active)return send(res,409,{error:'已有研究正在执行。',run_id:active.job.id});
        const job={id:randomUUID(),input,status:'queued',message:'已提交研究',created_at:new Date().toISOString(),records:[],sources:[],actions:[],excluded:[],limitations:[],summary:''};
        const controller=new AbortController();active={job,controller};
        try{await persist(job);}catch{active=null;return send(res,500,{error:'无法保存运行记录，研究尚未开始。'});}
        send(res,202,summary(job));active.done=execute(job,controller).catch(()=>{if(active?.job.id===job.id)active=null;});return;
      }
    }
    send(res,404,{error:'接口不存在'});
  }, async close() { const running=active;running?.controller.abort();await running?.done;await tail.catch(()=>{}); } };
}
