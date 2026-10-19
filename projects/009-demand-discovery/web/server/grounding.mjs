const shorten=(value,length=1000)=>String(value??'').slice(0,length);
export function normalizeDecision(value){
  const text=String(value||'');
  if(/搁置|暂缓|停止|不建议|不开发/.test(text))return '暂时搁置';
  if(/不足|未知|缺乏/.test(text))return '证据不足';
  if(/核实|收窄/.test(text))return '优先核实';
  if(/继续/.test(text))return '继续调查';
  return '证据不足';
}
export function reconcileDecisions(candidates,decisions){
  return candidates.map(candidate=>{const final=(decisions||[]).find(row=>row.candidate_id===candidate.id);if(!final)return candidate;return {...candidate,decision:normalizeDecision(final.decision),reason:shorten(final.reason||candidate.reason,800),next_question:shorten(final.next_step||candidate.next_question,700)};});
}
export function publicURL(value){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))return null;
    const host=url.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||host.startsWith('['))return null;
    url.hash='';url.hostname=host;
    for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid|gclid|ref$)/i.test(key))url.searchParams.delete(key);
    url.pathname=url.pathname.replace(/\/+$/,'')||'/';
    return url.toString();
  }catch{return null;}
}
export function actionFromEvent(event,phase){
  const item=event?.item;
  if(!item||item.type!=='web_search'||event.type!=='item.completed')return null;
  const action=item.action||{};
  const rawURLs=[action.url,...(Array.isArray(action.urls)?action.urls:[]),...(Array.isArray(action.refs)?action.refs:[])];
  const urls=[...new Set(rawURLs.map(value=>publicURL(typeof value==='string'?value:value?.url)).filter(Boolean))];
  const queryValues=Array.isArray(action.queries)&&action.queries.length?action.queries:[action.query||item.query];
  const queries=queryValues.filter(value=>typeof value==='string'&&value.trim()&&!value.startsWith('http'));
  return {id:shorten(item.id,100),phase,type:action.type||'search',queries:[...new Set(queries)].map(value=>shorten(value,400)),urls,status:item.status||'completed',at:new Date().toISOString()};
}
export function parseJSON(text){
  const cleaned=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const parsed=JSON.parse(cleaned);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('INVALID_RESULT');return parsed;
}
export function normalizeSources(rows,actions,phase){
  const opened=new Set(actions.filter(action=>['open_page','open'].includes(action.type)).flatMap(action=>action.urls));
  const seen=new Set();const sources=[];
  for(const raw of (Array.isArray(rows)?rows:[]).slice(0,24)){
    const url=publicURL(raw.url);if(!url||seen.has(url))continue;seen.add(url);
    const quote=String(raw.quote||'').trim();
    const boundedQuote=new URL(url).hostname.endsWith('reddit.com')?shorten(quote,500):quote.split(/\s+/).slice(0,24).join(' ').slice(0,250);
    const source={url,title:shorten(raw.title,240),kind:shorten(raw.kind,60),claim:shorten(raw.claim,1000),quote:boundedQuote,location:shorten(raw.location,160),access:raw.access==='page_excerpt'?'page_excerpt':'search_snippet',date_basis:shorten(raw.date_basis,180),phase,opened_in_trace:opened.has(url),verification:'model_excerpt',collected_at:new Date().toISOString()};
    if(!source.title||!source.claim)continue;
    if(!source.opened_in_trace)source.access='search_snippet';
    sources.push(source);
  }
  return sources;
}
export function mergeSources(oldRows,newRows){
  const rows=new Map(oldRows.map(row=>[row.url,row]));
  for(const row of newRows){const previous=rows.get(row.url);rows.set(row.url,previous?.opened_in_trace&&!row.opened_in_trace?previous:{...previous,...row});}
  return [...rows.values()];
}
export function normalizePeople(rows,sources){
  const available=new Set(sources.map(source=>source.url));const seen=new Set();const people=[];
  for(const raw of Array.isArray(rows)?rows:[]){
    const id=shorten(raw.id,80);if(!id||seen.has(id))continue;
    const source_urls=[...new Set((raw.source_urls||[]).map(publicURL).filter(url=>available.has(url)))];
    if(!source_urls.length)continue;seen.add(id);
    people.push({id,label:shorten(raw.label,180),task:shorten(raw.task,600),context:shorten(raw.context,600),why:shorten(raw.why,800),source_urls,next_question:shorten(raw.next_question,600)});
  }return people.slice(0,6);
}
export function normalizeCandidates(rows,sources,people){
  const available=new Set(sources.map(source=>source.url));const audiences=new Set(people.map(person=>person.id));const seen=new Set();const result=[];
  for(const raw of Array.isArray(rows)?rows:[]){
    const id=shorten(raw.id,80);if(!id||seen.has(id)||!audiences.has(raw.audience_id))continue;
    const evidence_urls=[...new Set((raw.evidence_urls||[]).map(publicURL).filter(url=>available.has(url)))];
    if(!evidence_urls.length)continue;seen.add(id);
    result.push({id,audience_id:raw.audience_id,audience:shorten(raw.audience,180),problem:shorten(raw.problem,240),context:shorten(raw.context,600),obstacle:shorten(raw.obstacle,800),impact:shorten(raw.impact,800),evidence_urls,existing_solutions:(Array.isArray(raw.existing_solutions)?raw.existing_solutions:[]).slice(0,6).map(row=>({name:shorten(row.name,120),description:shorten(row.description,700),url:publicURL(row.url)||null})),unknowns:(Array.isArray(raw.unknowns)?raw.unknowns:[]).slice(0,8).map(row=>shorten(row,500)),next_question:shorten(raw.next_question,700),decision:normalizeDecision(raw.decision),reason:shorten(raw.reason,800)});
  }return result.slice(0,6);
}
export const normalizeText=text=>String(text).normalize('NFKC').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
export function quoteInText(quote,text){const needle=normalizeText(quote);return needle.length>=12&&normalizeText(text).includes(needle);}
