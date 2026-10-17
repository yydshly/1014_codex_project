import https from 'node:https';
import { lookup } from 'node:dns/promises';
// Adapted from this repository's 009 public-source verifier; 004 runs independently.
import { publicURL, quoteInText } from './auto-grounding.mjs';
export function publicIPv4(address){
  const parts=String(address).split('.').map(Number);
  if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
  const [a,b]=parts;
  return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19))||(a===192&&b===0));
}
export function htmlText(html){
  return String(html).replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,code)=>{const number=parseInt(code,16);return number<=0x10ffff?String.fromCodePoint(number):' ';}).replace(/&#(\d+);/g,(_,code)=>{const number=Number(code);return number<=0x10ffff?String.fromCodePoint(number):' ';}).replace(/&(quot|apos|amp|lt|gt|nbsp);/gi,(_,name)=>({quot:'"',apos:"'",amp:'&',lt:'<',gt:'>',nbsp:' '}[name.toLowerCase()])).replace(/\s+/g,' ').trim();
}
function abortable(promise,signal){
  return new Promise((resolve,reject)=>{const abort=()=>reject(new Error('READ_ABORTED'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}
async function readPublic(value,signal,redirects=0){
  const normalized=publicURL(value);if(!normalized)throw new Error('UNSAFE_URL');
  const url=new URL(normalized);
  const addresses=await abortable(lookup(url.hostname,{family:4,all:true}),signal);
  if(!addresses.length||addresses.some(row=>!publicIPv4(row.address)))throw new Error('UNSAFE_ADDRESS');
  const address=addresses[0].address;
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{signal,headers:{'User-Agent':'DemandDiscoveryLocal/0.2 (public evidence verification)','Accept':'text/html,application/json,text/plain','Accept-Encoding':'identity'},lookup:(_host,options,callback)=>{if(options.all)callback(null,[{address,family:4}]);else callback(null,address,4);}},res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();if(redirects>=2){resolve({status:res.statusCode,text:''});return;}readPublic(new URL(res.headers.location,url).toString(),signal,redirects+1).then(resolve,reject);return;}
      if(res.statusCode!==200){res.resume();resolve({status:res.statusCode,text:''});return;}
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>1200000){req.destroy(new Error('BODY_LIMIT'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve({status:200,text:htmlText(Buffer.concat(chunks).toString('utf8'))}));res.on('error',reject);
    });
    req.setTimeout(7000,()=>req.destroy(new Error('READ_TIMEOUT')));req.on('error',reject);
  });
}
export async function verifySource(source,options={}){
  const base={...source,verification:source.opened_in_trace&&source.access==='page_excerpt'?'tool_read_excerpt':'search_snippet'};
  try{
    const deadline=AbortSignal.timeout(10000);const signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline;
    const result=await readPublic(source.url,signal);
    const matched=result.status===200&&quoteInText(source.quote,result.text);
    return {...base,verification:matched?'local_quote_checked':base.verification,local_read:{status:result.status===200?(matched?'quote_checked':'quote_not_matched'):'unavailable',http_status:result.status,at:new Date().toISOString()},verification_note:matched?'本地取得的页面文本中核对到这段短引文。':result.status===200?'本地已读取页面，但未逐字匹配该引文；保留为 AI 联网摘录。':`本地页面读取返回 ${result.status}；未绕过限制。`};
  }catch{
    return {...base,local_read:{status:'unavailable',http_status:null,at:new Date().toISOString()},verification_note:'本地页面未成功读取；引文保留为 AI 联网摘录，尚未独立逐字核验。'};
  }
}
