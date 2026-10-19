import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { actionFromEvent, parseJSON } from './grounding.mjs';
const execute=promisify(execFile);
export async function inspectCodex(config){
  try{
    const options={windowsHide:true,timeout:12000,maxBuffer:20000};
    const version=await execute(config.binary,['--version'],options);
    const login=await execute(config.binary,['login','status'],options);
    const loggedIn=/logged in/i.test(`${login.stdout} ${login.stderr}`);
    return {available:loggedIn,installed:true,version:version.stdout.trim(),auth:loggedIn?'本机 Codex 已登录':'需要先登录 Codex',provider:'OpenAI · Codex 本地执行',model:config.model||'Codex 默认模型'};
  }catch(error){return {available:false,installed:error.code!=='ENOENT',provider:'OpenAI · Codex 本地执行',model:config.model||'Codex 默认模型',auth:error.code==='ENOENT'?'未找到本机 Codex CLI':'本机 Codex 尚未就绪，请检查登录状态'};}
}
export async function runCodex({config,phase,prompt,schema,onAction,onProgress,signal}){
  const cwd=path.join(config.runtimeRoot,'runner');await mkdir(cwd,{recursive:true});
  await writeFile(path.join(cwd,'AGENTS.md'),'Public-web research only. Do not read local files, run shell commands, change files, contact people, use subagents, or call private connectors. Use only the built-in web search and return the requested structured JSON.\n','utf8');
  const schemaPath=path.join(cwd,`${phase}-schema.json`);await writeFile(schemaPath,JSON.stringify(schema),'utf8');
  const args=['--search','--ask-for-approval','never','exec','--ignore-user-config','--sandbox','read-only','--ephemeral','--json'];
  for(const feature of ['shell_tool','unified_exec','multi_agent','apps','plugins','shell_snapshot','image_generation','computer_use','browser_use'])args.push('--disable',feature);
  args.push('--output-schema',schemaPath,'-');
  if(config.model)args.splice(args.length-1,0,'--model',config.model);
  return new Promise((resolve,reject)=>{
    const child=spawn(config.binary,args,{cwd,windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    let buffer='',lastJSON='',stderr='',settled=false,toolCount=0;const actions=[];let usage={};let blocked=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(error):resolve(value);};
    const cancel=()=>{child.kill();finish(new Error('CANCELLED'));};
    const timer=setTimeout(()=>{child.kill();finish(new Error('PHASE_TIMEOUT'));},config.phaseTimeout);
    signal?.addEventListener('abort',cancel,{once:true});
    const processLine=line=>{
      let event;try{event=JSON.parse(line);}catch{return;}
      const type=event.item?.type;
      if(['command_execution','file_change','mcp_tool_call'].includes(type)){blocked=true;child.kill();finish(new Error('UNEXPECTED_TOOL'));return;}
      const action=actionFromEvent(event,phase);
      if(action){
        actions.push(action);toolCount++;onAction(action);
        if(toolCount>config.maxSearchEvents){child.kill();finish(new Error('TOOL_LIMIT'));return;}
      }
      if(event.type==='item.started'&&type==='web_search')onProgress('正在联网检索或打开来源…');
      if(event.type==='item.completed'&&type==='agent_message'){
        try{parseJSON(event.item.text);lastJSON=event.item.text;}catch{}
      }
      if(event.type==='turn.completed')usage=event.usage||{};
      if(event.type==='turn.failed'||event.type==='error')stderr=String(event.error?.message||event.message||'OpenAI 执行失败').slice(0,800);
    };
    child.stdout.on('data',chunk=>{buffer+=chunk.toString('utf8');if(buffer.length>3000000){child.kill();finish(new Error('OUTPUT_LIMIT'));return;}const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)processLine(line);});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString('utf8')).slice(-4000);});
    child.on('error',error=>finish(error));
    child.on('close',code=>{
      if(buffer.trim())processLine(buffer);
      if(settled||blocked)return;
      if(code!==0){const error=new Error(/auth|login|unauthorized|401/i.test(stderr)?'AUTH_REQUIRED':'CODEX_FAILED');finish(error);return;}
      if(!lastJSON)return finish(new Error('NO_STRUCTURED_RESULT'));
      if(!actions.some(action=>action.type==='search'))return finish(new Error('SEARCH_NOT_EXECUTED'));
      try{finish(null,{data:parseJSON(lastJSON),actions,usage});}catch{finish(new Error('INVALID_RESULT'));}
    });
    child.stdin.on('error',()=>{});child.stdin.end(prompt,'utf8');
    if(signal?.aborted)cancel();
  });
}
