const base=process.env.ERL_URL||'http://127.0.0.1:4184';
let state=await (await fetch(base+'/api/state')).json();
if(!state.model.available)throw new Error('本机模型未就绪');
if(state.sources.some(s=>s.origin!=='synthetic'))throw new Error('真实试跑脚本仅使用合成样例，请在单独 ERL_DATA_DIR 启动，避免混入已有资料');
async function post(path,body={}){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-ERL-CSRF':state.csrf},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw new Error(v.error);return v;}
const sample=await post('/api/sample');const run=await post('/api/experiments',{question:sample.question});console.log(`开始真实模型 B/C：${run.id}，${state.model.model}`);
let previous='';const deadline=Date.now()+12*60*1000;
while(Date.now()<deadline){const exp=await(await fetch(`${base}/api/experiments/${run.id}`)).json();if(exp.progress!==previous){console.log(exp.progress);previous=exp.progress;}
  if(exp.status!=='running'){
    console.log(JSON.stringify({id:exp.id,status:exp.status,error:exp.error,corpus_sha256:exp.manifest.corpus_sha256,model:exp.manifest.model,results:Object.fromEntries(Object.entries(exp.results).map(([arm,v])=>[arm,{metrics:v.metrics,measurements:v.report.measurements}]))},null,2));
    if(exp.status!=='succeeded')process.exitCode=1;break;
  }
  await new Promise(resolve=>setTimeout(resolve,3000));
}
if(Date.now()>=deadline){await post(`/api/experiments/${run.id}/cancel`);throw new Error('试跑超过 12 分钟，已请求取消');}
