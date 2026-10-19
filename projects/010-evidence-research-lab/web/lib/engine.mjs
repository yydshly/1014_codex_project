import {randomUUID,randomInt} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {hash} from './store.mjs';
import {analysisSchema,evidenceSchema,validateShape} from './schema.mjs';
import {VERSION,directPrompt,extractPrompt,evidencePrompt} from './prompts.mjs';

export const LIMITS=Object.freeze({corpus_utf8_bytes:36000,prompt_utf8_bytes:65000,model_calls_per_arm:2,reported_tokens_per_arm:120000,findings:6});
export function freezeManifest(sources,question,model) {
  if(typeof question!=='string'||question.trim().length<5||question.length>2000)throw new Error('研究问题须为 5–2000 字');
  if(!sources.length)throw new Error('请先导入资料');
  const frozen=sources.map(({id,title,text,url,kind,origin,permission_note,cluster_id,sha256})=>({id,title,text,url,kind,origin,permission_note,cluster_id,sha256})).sort((a,b)=>a.id.localeCompare(b.id));
  const corpus=JSON.stringify(frozen);
  if(Buffer.byteLength(corpus)>LIMITS.corpus_utf8_bytes)throw new Error('本轮资料超过 36 KB；请减少资料。两组均不截断正文。');
  return {schema_version:1,question:question.trim(),model,reasoning:'medium',temperature:'provider_default_not_exposed',prompt_version:VERSION,corpus_sha256:hash(corpus),sources:frozen,limits:LIMITS};
}
export function locateEvidence(ref,sources,index,extra={}) {
  const source=sources.find(s=>s.id===ref.source_id);
  const quote=typeof ref.quote==='string'?ref.quote:'';
  const start=source&&quote.trim()?source.text.indexOf(quote):-1;
  if(!source||start<0)return {valid:false,source_id:ref.source_id,quote,reason:!source?'来源编号不存在':'引文不在原文中'};
  return {valid:true,id:`E${String(index).padStart(4,'0')}`,source_id:source.id,source_sha256:source.sha256,cluster_id:source.cluster_id,origin:source.origin,quote,start,end:start+quote.length,line:source.text.slice(0,start).split('\n').length,role:ref.role,...extra,review_status:'pending'};
}
function totalUsage(calls) {
  if(calls.some(c=>!c.usage||!Number.isFinite(c.usage.input_tokens)||!Number.isFinite(c.usage.output_tokens)))return null;
  return calls.reduce((n,c)=>n+c.usage.input_tokens+c.usage.output_tokens,0);
}
export function compileReport(raw,exp,arm,calls,elapsed) {
  validateShape(raw,analysisSchema);
  if(raw.findings.length>LIMITS.findings||!raw.scope.trim()||raw.findings.some(f=>!f.statement.trim()||!f.next_validation.trim()||f.references.length>4))throw new Error('模型报告超出发现/引用上限或缺少必要内容');
  const evidence=[],invalid=[],findings=[],rejected=[];
  const get=ref=>{
    const previous=evidence.find(e=>e.source_id===ref.source_id&&e.quote===ref.quote&&e.role===ref.role);
    if(previous)return previous;
    const row=locateEvidence(ref,exp.manifest.sources,evidence.length+1);
    if(row.valid)evidence.push(row);else invalid.push(row);return row;
  };
  raw.findings.forEach((finding,i)=>{
    const refs=finding.references.map(get),support=refs.filter(r=>r.valid&&r.role==='support'),counter=refs.filter(r=>r.valid&&r.role==='counter');
    if(refs.some(r=>!r.valid)||!support.length){rejected.push({index:i+1,statement:finding.statement,reason:'存在无效引文，或没有有效的支持引文；完整输出见调用记录'});return;}
    findings.push({finding_id:`F${i+1}`,statement:finding.statement,kind:finding.kind,evidence_ids:[...new Set(support.map(r=>r.id))],counterevidence_ids:[...new Set(counter.map(r=>r.id))],unknowns:finding.unknowns,next_validation:finding.next_validation,review_status:'pending'});
  });
  const tokens=totalUsage(calls);
  const report={schema_version:1,study_id:exp.id,run_id:`${exp.id}-${arm}`,arm:arm==='B'?'B_same_corpus':'C_evidence',status:rejected.length?'partial':'draft',model_snapshot:exp.manifest.model,input_manifest_sha256:exp.manifest_sha256,scope:raw.scope,findings,hypotheses:[],predictions:[],limitations:[...raw.limitations.filter(l=>l.trim()),'主张是否被引文支持需人工判断，当前复核状态见各条发现。','仅锁定请求模型标识；服务方未公开不可变快照与温度。ChatGPT 登录调用的美元费用不可观测。',...(exp.manifest.sources.some(s=>s.origin==='synthetic')?['包含合成资料，本轮仅验证流程，不证明真实用户需求或 C 优于 B。']:[])],measurements:{total_tokens:tokens,total_usd:null,elapsed_seconds:Number(elapsed.toFixed(2)),human_active_minutes:null,includes_all_pipeline_steps:true}};
  const attempted=raw.findings.reduce((n,f)=>n+f.references.length,0);
  return {report,evidence,rejected_findings:rejected,invalid_references:invalid,metrics:{attempted_findings:raw.findings.length,accepted_findings:findings.length,citation_occurrences:attempted,valid_citation_rate:attempted?(attempted-invalid.length)/attempted:null,unique_source_clusters:new Set(evidence.map(e=>e.cluster_id)).size,counter_citations:evidence.filter(e=>e.role==='counter').length,semantic_accuracy:null,human_utility_score:null}};
}
export function renderReport(result,manifest) {
  const r=result.report,lookup=id=>result.evidence.find(e=>e.id===id);
  return `# ${r.arm==='B_same_corpus'?'B · 直接分析':'C · 证据流程'}\n\n研究问题：${manifest.question}\n\n模型：${r.model_snapshot}（快照未公开）\n\n资料指纹：${manifest.corpus_sha256}\n\n状态：${r.status}；${r.findings.length} 条可回查发现；人工语义复核未完成时不得视为事实已确认。\n\n${r.findings.map((f,i)=>`## ${i+1}. ${f.statement}\n\n类型：${f.kind}；复核：${f.review_status}\n\n${[...f.evidence_ids,...f.counterevidence_ids].map(id=>{const e=lookup(id),s=manifest.sources.find(s=>s.id===e.source_id);return `- ${id} / ${e.role==='counter'?'反证':'支持'} / ${s.title} / 第 ${e.line} 行 / ${e.start}–${e.end} UTF-16：${JSON.stringify(e.quote)}${s.url?`（${s.url}）`:''}`;}).join('\n')}\n\n未知：${f.unknowns.join('；')||'未列出'}\n\n下一步：${f.next_validation}`).join('\n\n')}\n\n## 局限\n\n${r.limitations.map(l=>`- ${l}`).join('\n')}\n\n## 全流程计量\n\n${JSON.stringify(r.measurements,null,2)}\n`;
}
export class Engine {
  constructor(store,model){this.store=store;this.model=model;this.active=null;this.controller=null;}
  create(question,modelName) {
    if(this.active)throw new Error('已有实验执行中，请等待或取消');
    const manifest=freezeManifest(this.store.sources(),question,modelName);
    const exp={id:`R-${randomUUID()}`,created_at:new Date().toISOString(),status:'running',progress:'资料已冻结',manifest,manifest_sha256:hash(manifest),order:randomInt(2)?['B','C']:['C','B'],results:{},calls:[],fairness:{same_corpus:true,same_requested_model:true,immutable_snapshot_verified:false,tool_calls:0,independent_sessions:true,manual_workspace_evidence_used:false},limitations:['单次 B/C 是流程验证，不能据此判定产品增益。','B 直接推理 1 次，C 提取与分析 2 次；C 所有调用均计入成本。','token 上限为用量返回后的检查，CLI 不提供本应用可强制的费用或输出 token 上限。'],error:null};
    this.active=exp.id;this.controller=new AbortController();this.store.saveExperiment(exp);return exp;
  }
  cancel(){this.controller?.abort();}
  async execute(exp) {
    const corpus=JSON.stringify(exp.manifest.sources),signal=this.controller.signal;
    const update=message=>{exp.progress=message;this.store.saveExperiment(exp);};
    const call=async(arm,stage,prompt,schema)=>{
      if(signal.aborted)throw new Error('已取消');
      if(Buffer.byteLength(prompt)>LIMITS.prompt_utf8_bytes)throw new Error('提示词超过 65 KB 限制，本轮未截断资料');
      if(exp.calls.filter(c=>c.arm===arm).length>=LIMITS.model_calls_per_arm)throw new Error('达到模型调用次数上限');
      const entry={arm,stage,model_requested:exp.manifest.model,reasoning:'medium',prompt_sha256:hash(prompt),schema_sha256:hash(schema),started_at:new Date().toISOString(),status:'running',usage:null};
      exp.calls.push(entry);const begin=performance.now();update(`${arm} · ${stage}`);
      this.store.artifact(exp.id,`${arm}-${stage}.prompt.txt`,prompt);
      this.store.artifact(exp.id,`${arm}-${stage}.schema.json`,schema);
      try {
        const output=await this.model.generate({prompt,schema,signal});
        entry.usage=output.usage;entry.model_returned=output.returned_model;entry.elapsed_seconds=Number(((performance.now()-begin)/1000).toFixed(2));entry.status='succeeded';
        this.store.artifact(exp.id,`${arm}-${stage}.output.json`,output);
        validateShape(output.data,schema);
        const tokens=totalUsage(exp.calls.filter(c=>c.arm===arm));
        if(tokens!==null&&tokens>LIMITS.reported_tokens_per_arm)throw new Error('返回用量超过本组 token 上限，本轮无效（已发生的消耗仍计入记录）');
        return output.data;
      }catch(error){entry.status='failed';entry.error=error.message;entry.usage=entry.usage||error.usage||null;entry.elapsed_seconds=Number(((performance.now()-begin)/1000).toFixed(2));throw error;}
      finally{this.store.saveExperiment(exp);}
    };
    try {
      exp.runtime=await this.model.inspect();
      if(!exp.runtime.available)throw new Error(exp.runtime.auth||'模型不可用');
      for(const arm of exp.order) {
        const start=performance.now();let raw,extraction=null;
        if(arm==='B')raw=await call(arm,'analysis',directPrompt(exp.manifest.question,corpus),analysisSchema);
        else {
          const extracted=await call(arm,'extract',extractPrompt(exp.manifest.question,corpus),evidenceSchema);
          if(extracted.evidence.length>24)throw new Error('提取结果超过 24 条证据上限');
          const rows=extracted.evidence.map((e,i)=>locateEvidence(e,exp.manifest.sources,i+1,{summary:e.summary,kind:e.kind}));
          const valid=[];for(const e of rows.filter(e=>e.valid))if(!valid.some(v=>v.source_id===e.source_id&&v.quote===e.quote&&v.role===e.role))valid.push(e);
          extraction={evidence:valid,invalid:rows.filter(e=>!e.valid),limitations:extracted.limitations};
          raw=await call(arm,'analysis',evidencePrompt(exp.manifest.question,corpus,{evidence:extraction.evidence,limitations:extraction.limitations,rejected_quote_count:extraction.invalid.length}),analysisSchema);
        }
        const result=compileReport(raw,exp,arm,exp.calls.filter(c=>c.arm===arm),(performance.now()-start)/1000);result.extraction=extraction;
        exp.results[arm]=result;
        this.store.artifact(exp.id,`${arm}-report.json`,result.report);this.store.artifact(exp.id,`${arm}-evidence.json`,result.evidence);this.store.artifact(exp.id,`${arm}-report.md`,renderReport(result,exp.manifest));
        update(`${arm} 报告已生成，等待人工复核`);
      }
      exp.status='succeeded';exp.progress='B/C 均已生成；语义复核待完成';
    }catch(error){exp.status=signal.aborted?'cancelled':'failed';exp.error=error.message;exp.progress=signal.aborted?'已取消':'执行未完成；保留已发生的调用记录';}
    finally{exp.finished_at=new Date().toISOString();this.active=null;this.controller=null;this.store.saveExperiment(exp);}
    return exp;
  }
  review(id,arm,findingId,status) {
    if(!['verified','rejected','pending'].includes(status))throw new Error('复核状态无效');
    const exp=this.store.experiment(id);if(exp.status==='running')throw new Error('执行中暂不能复核');
    const result=exp.results[arm],finding=result?.report.findings.find(f=>f.finding_id===findingId);if(!finding)throw new Error('发现不存在');
    finding.review_status=status;result.report.status=result.rejected_findings.length?'partial':result.report.findings.length&&result.report.findings.every(f=>f.review_status==='verified')?'completed':'draft';
    result.reviews??=[];result.reviews.push({finding_id:findingId,status,at:new Date().toISOString(),actor:'local_operator'});
    this.store.saveExperiment(exp);this.store.artifact(id,`${arm}-report.json`,result.report);this.store.artifact(id,`${arm}-report.md`,renderReport(result,exp.manifest));return exp;
  }
}
