import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const execute=promisify(execFile);
export class CodexModel {
  constructor(config){this.config=config;}
  async inspect() {
    try {
      const options={windowsHide:true,timeout:12000,maxBuffer:20000};
      const [v,l]=await Promise.all([execute(this.config.binary,['--version'],options),execute(this.config.binary,['login','status'],options)]);
      return {available:/logged in/i.test(l.stdout+l.stderr),version:v.stdout.trim(),model:this.config.model,reasoning:'medium',auth:/logged in/i.test(l.stdout+l.stderr)?'本机已登录':'请先登录 Codex',snapshot_verified:false};
    }catch{return {available:false,version:null,model:this.config.model,reasoning:'medium',auth:'本机 Codex 不可用，请检查安装和登录',snapshot_verified:false};}
  }
  async generate({prompt,schema,signal}) {
    const cwd=await mkdtemp(path.join(os.tmpdir(),'erl-010-'));
    try {
      await mkdir(path.join(cwd,'.codex'),{recursive:true});
      await writeFile(path.join(cwd,'AGENTS.md'),'Only return structured analysis of the supplied text. No tools, shell, files, web, connectors, subagents, or external actions.\n');
      const schemaPath=path.join(cwd,'output.schema.json');await writeFile(schemaPath,JSON.stringify(schema));
      const args=['--no-daemon','--ask-for-approval','never','exec','--ignore-user-config','--skip-git-repo-check','--sandbox','read-only','--ephemeral','--json','--model',this.config.model,'-c','model_reasoning_effort="medium"','-c','web_search="disabled"'];
      for(const feature of ['shell_tool','unified_exec','multi_agent','apps','plugins','shell_snapshot','image_generation','computer_use','browser_use'])args.push('--disable',feature);
      args.push('--output-schema',schemaPath,'-');
      return await new Promise((resolve,reject)=>{
        const child=spawn(this.config.binary,args,{cwd,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
        let buffer='',bytes=0,result=null,usage=null,settled=false,failure='',returnedModel=null;
        const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(Object.assign(error,{usage})):resolve(value);};
        const stop=reason=>{child.kill();done(new Error(reason));};
        const cancel=()=>stop('已取消，模型执行未完成');
        const timer=setTimeout(()=>stop('模型调用超时；没有自动重试，以免隐藏额外费用'),this.config.timeout);
        signal?.addEventListener('abort',cancel,{once:true});
        const line=value=>{
          let e;try{e=JSON.parse(value);}catch{return;}
          if(e.model)returnedModel=e.model;
          if(e.item && !['agent_message','reasoning'].includes(e.item.type))return stop(`检测到被禁止的工具或动作：${e.item.type}`);
          if(e.type==='item.completed'&&e.item?.type==='agent_message'){try{result=JSON.parse(e.item.text);}catch{failure='模型没有返回有效 JSON';}}
          if(e.type==='turn.completed')usage=e.usage||null;
          if(['turn.failed','error'].includes(e.type))failure='模型执行失败，请检查登录状态、模型名或用量限制';
        };
        child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>300000)return stop('模型输出超过 300 KB 限制');buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();for(const v of lines)line(v);});
        // stderr may contain environment details. Do not expose it to the UI or artifacts.
        child.stderr.resume();child.on('error',()=>done(new Error('无法启动本机 Codex')));
        child.on('close',code=>{if(buffer.trim())line(buffer);if(settled)return;if(code!==0||!result||failure)return done(new Error(failure||'模型进程未成功完成'));done(null,{data:result,usage,returned_model:returnedModel});});
        child.stdin.on('error',()=>{});child.stdin.end(prompt,'utf8');if(signal?.aborted)cancel();
      });
    }finally{await rm(cwd,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
  }
}
