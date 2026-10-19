import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {inlineSourceHashes} from './lib/csp.mjs';
import {Store} from './lib/store.mjs';
import {Engine,renderReport} from './lib/engine.mjs';
import {CodexModel} from './lib/model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function config() {
  let local={};for(const file of ['.env','.env.local']){try{Object.assign(local,parseEnv(await readFile(path.join(root,file),'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}}
  const env={...local,...process.env};
  return {port:Number(env.ERL_PORT)||4184,dataDir:env.ERL_DATA_DIR||path.join(root,'.runtime'),binary:env.CODEX_BIN||(process.platform==='win32'?'codex.exe':'codex'),model:env.CODEX_MODEL||'gpt-6.1-sol',timeout:Math.min(600000,Math.max(10000,Number(env.ERL_CALL_TIMEOUT_MS)||240000))};
}
async function body(req) {
  let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>1000000)throw new Error('导入内容超过 1 MB 上限');}
  try{return JSON.parse(data);}catch{throw new Error('请求须为有效 JSON');}
}
export function createApp(settings,{store=new Store(settings.dataDir),model=new CodexModel(settings)}={}) {
  store.recover();const engine=new Engine(store,model),csrf=randomBytes(24).toString('hex');let inspect=null;
  const server=http.createServer(async(req,res)=>{
    const send=(status,value,type='application/json; charset=utf-8')=>{
      const hashes=type.startsWith('text/html')?inlineSourceHashes(value):{script:[],style:[]};
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'self'; script-src 'self' ${hashes.script.join(' ')}; style-src 'self' ${hashes.style.join(' ')}; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`});res.end(typeof value==='string'?value:JSON.stringify(value));
    };
    try {
      const host=req.headers.host||'';if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))return send(403,{error:'仅供本机使用'});
      const url=new URL(req.url,`http://${host}`),p=url.pathname;
      if(req.method!=='GET' && (req.headers['x-erl-csrf']!==csrf || req.headers.origin&&req.headers.origin!==`http://${host}`))return send(403,{error:'请在本机工作台中操作'});
      if(p==='/api/state'&&req.method==='GET') {
        inspect??=await model.inspect();
        return send(200,{csrf,model:inspect,sources:store.sources(),evidence:store.evidence(),active:engine.active,experiments:store.experiments().map(e=>({id:e.id,created_at:e.created_at,status:e.status,progress:e.progress,question:e.manifest.question,error:e.error}))});
      }
      if(p==='/api/model/refresh'&&req.method==='POST'){inspect=await model.inspect();return send(200,inspect);}
      if(p==='/api/sample'&&req.method==='POST'){if(engine.active)throw new Error('实验进行中，请结束后再修改资料');const sample=JSON.parse(await readFile(path.join(root,'sample.json'),'utf8'));return send(200,{question:sample.question,imported:store.importSources(sample.sources)});}
      if(p==='/api/sources'&&req.method==='POST'){if(engine.active)throw new Error('实验进行中，请结束后再修改资料');const v=await body(req);return send(200,{imported:store.importSources(v.sources)});}
      const sourceMatch=p.match(/^\/api\/sources\/(S-[a-f0-9]{8})$/);
      if(sourceMatch&&req.method==='DELETE'){if(engine.active)throw new Error('实验进行中，暂不能撤回资料');return send(200,{removed_experiments:store.removeSource(sourceMatch[1])});}
      if(p==='/api/evidence'&&req.method==='POST')return send(200,store.addEvidence(await body(req)));
      const evidenceMatch=p.match(/^\/api\/evidence\/(M-[a-f0-9]{8})$/);
      if(evidenceMatch&&req.method==='DELETE'){store.removeEvidence(evidenceMatch[1]);return send(200,{ok:true});}
      if(p==='/api/experiments'&&req.method==='POST'){
        const v=await body(req),exp=engine.create(v.question,settings.model);send(202,{id:exp.id});void engine.execute(exp);return;
      }
      const match=p.match(/^\/api\/experiments\/(R-[a-f0-9-]{36})(?:\/(cancel|review|export))?$/);
      if(match) {
        const [,id,action]=match;
        if(!action&&req.method==='GET')return send(200,store.experiment(id));
        if(action==='cancel'&&req.method==='POST'){if(engine.active!==id)throw new Error('该实验未在执行');engine.cancel();return send(200,{ok:true});}
        if(action==='review'&&req.method==='POST'){const v=await body(req);return send(200,engine.review(id,v.arm,v.finding_id,v.status));}
        if(action==='export'&&req.method==='GET'){
          const exp=store.experiment(id),arm=url.searchParams.get('arm'),format=url.searchParams.get('format')||'json';
          if(!['B','C'].includes(arm)||!['json','md'].includes(format)||!exp.results[arm])throw new Error('报告不存在');
          res.setHeader('Content-Disposition',`attachment; filename="${id}-${arm}.${format}"`);
          return send(200,format==='md'?renderReport(exp.results[arm],exp.manifest):JSON.stringify({report:exp.results[arm].report,evidence:exp.results[arm].evidence,metrics:exp.results[arm].metrics,manifest:exp.manifest,calls:exp.calls.filter(c=>c.arm===arm)},null,2),format==='md'?'text/markdown; charset=utf-8':'application/json; charset=utf-8');
        }
      }
      const prefix='/1014_codex_project/010-evidence-research-lab';
      const assets={'/':'index.html','/index.html':'index.html','/research.html':'index.html',[prefix]:'index.html',[prefix+'/']:'index.html',[prefix+'/index.html']:'index.html','/workbench':'workbench.html','/workbench/':'workbench.html','/app.js':'app.js','/style.css':'style.css'};
      if(req.method==='GET'&&assets[p]){const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};return send(200,await readFile(path.join(root,assets[p]),'utf8'),types[path.extname(assets[p])]);}
      send(404,{error:'页面或接口不存在'});
    }catch(error){send(400,{error:error.message||'处理失败'});}
  });
  return {server,store,engine,close:()=>{engine.cancel();server.close();store.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const settings=await config(),app=createApp(settings);
  app.server.listen(settings.port,'127.0.0.1',()=>console.log(`证据研究实验室 http://127.0.0.1:${app.server.address().port}`));
  app.server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'端口被占用，请设置 ERL_PORT 后重启':error.message);process.exitCode=1;app.store.close();});
}
