// Uses the same official CLI integration as 009, with a bounded single research run.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { actionFromEvent } from './auto-grounding.mjs';
const exec = promisify(execFile);
export async function inspectRunner(config) {
  try {
    const options = { windowsHide: true, timeout: 12000, maxBuffer: 20000 };
    const [version, auth] = await Promise.all([exec(config.binary,['--version'],options),exec(config.binary,['login','status'],options)]);
    const available = /logged in/i.test(auth.stdout + auth.stderr);
    return { available, version: version.stdout.trim(), message: available ? '已连接本机 Codex，点击开始后执行联网研究。' : '请先在本机运行 codex login，再刷新连接。' };
  } catch { return { available: false, message: '本机 Codex 尚未就绪，请检查安装和登录后刷新连接。' }; }
}
export async function runResearch({ config, id, prompt, schema, signal, onAction }) {
  const cwd = path.join(config.runtimeRoot,'runner',id); await mkdir(cwd,{recursive:true});
  await writeFile(path.join(cwd,'AGENTS.md'),'Public web research only. Use only built-in web search. Never read local files, run commands, modify files, use private connectors, contact people, or spawn subagents. Return the requested JSON.\n');
  const schemaPath = path.join(cwd,'schema.json'); await writeFile(schemaPath,JSON.stringify(schema));
  const args = ['--no-daemon','--search','--ask-for-approval','never','exec','--ignore-user-config','--skip-git-repo-check','--sandbox','read-only','--ephemeral','--json'];
  for (const feature of ['shell_tool','unified_exec','multi_agent','apps','plugins','shell_snapshot','image_generation','computer_use','browser_use']) args.push('--disable',feature);
  if (config.model) args.push('--model',config.model);
  args.push('--output-schema',schemaPath,'-');
  return new Promise((resolve,reject) => {
    const child = spawn(config.binary,args,{ cwd, windowsHide:true, shell:false, stdio:['pipe','pipe','pipe'] });
    let buffer='', bytes=0, data=null, usage=null, failed=false, settled=false; const actions=[];
    const finish = (error,result) => { if(settled)return; settled=true; clearTimeout(timer); signal.removeEventListener('abort',cancel); error?reject(error):resolve(result); };
    const stop = code => { child.kill(); finish(new Error(code)); };
    const cancel = () => stop('CANCELLED');
    const timer = setTimeout(() => stop('TIMEOUT'),config.timeout);
    signal.addEventListener('abort',cancel,{once:true});
    const line = value => {
      if(settled)return; let event; try { event=JSON.parse(value); } catch { return; }
      if(event.item && !['agent_message','reasoning','web_search','todo_list'].includes(event.item.type)) return stop('UNEXPECTED_TOOL');
      const action=actionFromEvent(event);
      if(action) { actions.push(action); onAction(action); if(actions.length>16) return stop('TOOL_LIMIT'); }
      if(event.type==='item.completed' && event.item?.type==='agent_message') { try { data=JSON.parse(event.item.text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')); } catch { /* Wait for final structured message. */ } }
      if(event.type==='turn.completed')usage=event.usage;
      if(event.type==='error'||event.type==='turn.failed')failed=true;
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk => { bytes+=Buffer.byteLength(chunk); if(bytes>2000000)return stop('OUTPUT_LIMIT'); buffer+=chunk; const lines=buffer.split('\n'); buffer=lines.pop(); for(const value of lines)line(value); });
    // Diagnostics can contain machine details; neither persist nor return them to the browser.
    child.stderr.resume(); child.stdin.on('error',()=>{});
    child.on('error',()=>finish(new Error('RUNNER_FAILED')));
    child.on('close',code => {
      if(buffer.trim())line(buffer); if(settled)return;
      if(code!==0||failed)return finish(new Error('RUNNER_FAILED'));
      if(!data)return finish(new Error('INVALID_RESULT'));
      if(!actions.some(a=>a.type==='search'&&a.status==='completed'))return finish(new Error('NO_SEARCH'));
      finish(null,{data,actions,usage});
    });
    if(signal.aborted)cancel(); else child.stdin.end(prompt,'utf8');
  });
}
