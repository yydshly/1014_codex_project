export const DIRECTIONS = [
  {id:'all',name:'全部 AI',description:'浏览当前来源中的全部内容',terms:[]},
  {id:'coding',name:'AI 编程',description:'编程助手、代码生成与开发流程',terms:['coding','code','copilot','developer','编程','代码']},
  {id:'agents',name:'智能体',description:'Agent、工具调用与自动化执行',terms:['agent','agents','agentic','智能体','自动化']},
  {id:'multimodal',name:'多模态',description:'图像、视频、音频与多模态模型',terms:['multimodal','image','video','audio','vision','多模态','图像','视频']},
  {id:'models',name:'模型研究',description:'模型、训练、推理与评测',terms:['model','models','llm','training','inference','benchmark','模型','训练','推理']},
  {id:'tools',name:'产品与工具',description:'工作流、工具、SDK 与实际应用',terms:['tool','tools','sdk','workflow','app','application','工具','产品']},
];
export const GOALS = [{id:'all',name:'综合探索'},{id:'news',name:'看 AI 新闻'},{id:'product',name:'找产品线索'},{id:'repo',name:'找开源项目'}];
export const splitKeywords = value => [...new Set(String(value || '').split(/[,，\n]/).map(v=>v.trim()).filter(Boolean))].slice(0,30);
export function matchesTerm(text, term) {
  const value = String(text || '').toLocaleLowerCase();
  const word = String(term || '').trim().toLocaleLowerCase();
  if (!word) return false;
  if (/^[a-z0-9][a-z0-9 +.#/-]*$/i.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(value);
  }
  return value.includes(word);
}
export function canonicalUrl(value) {
  try { const url=new URL(value); url.hash=''; for(const key of [...url.searchParams.keys()]) if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key)) url.searchParams.delete(key); url.searchParams.sort(); return url.href.replace(/\/$/,''); } catch { return String(value); }
}
export function mergeItems(items) {
  const found=new Map();
  for(const item of items) {
    const key=canonicalUrl(item.url);
    if(!found.has(key)) found.set(key,{...item,sourceIds:[item.sourceId],sourceNames:[item.sourceName]});
    else { const merged=found.get(key); if(!merged.sourceIds.includes(item.sourceId)){merged.sourceIds.push(item.sourceId);merged.sourceNames.push(item.sourceName);} }
  }
  return [...found.values()];
}
export const itemDate = item => item.kind==='repo' ? item.repo?.pushedAt || item.updatedAt || item.publishedAt : item.publishedAt;
export function evaluateItem(item, filters={}, now=Date.now()) {
  const meaningfulTopics=(item.topics||[]).filter(topic=>!['ai-news','ai-products'].includes(topic));
  const text=[item.title,item.summary,item.repo?.fullName,...meaningfulTopics].filter(Boolean).join(' ');
  const reasons=[];
  if(filters.enabledSources && !(item.sourceIds||[item.sourceId]).some(id=>filters.enabledSources.includes(id))) return {pass:false,reason:'来源已停用'};
  if(filters.hiddenIds?.includes(item.id)) return {pass:false,reason:'已暂时隐藏'};
  const excludes=splitKeywords(filters.exclude).filter(term=>matchesTerm(text,term));
  if(excludes.length) return {pass:false,reason:'排除词：'+excludes.join('、')};
  if(filters.goal && filters.goal!=='all' && item.kind!==filters.goal) return {pass:false,reason:'内容类型不符'};
  const direction=DIRECTIONS.find(d=>d.id===filters.direction)||DIRECTIONS[0];
  const directionHits=direction.terms.filter(term=>matchesTerm(text,term));
  if(direction.terms.length && !directionHits.length) return {pass:false,reason:'方向词未命中'};
  const includes=splitKeywords(filters.include);
  const hits=includes.filter(term=>matchesTerm(text,term));
  if(includes.length && (filters.mode==='all' ? hits.length!==includes.length : !hits.length)) return {pass:false,reason:'包含词未满足'};
  const query=String(filters.query||'').trim().split(/\s+/).filter(Boolean);
  if(query.some(term=>!matchesTerm(text,term))) return {pass:false,reason:'搜索词未满足'};
  const days=Number(filters.days);
  if(days>0) { const date=Date.parse(itemDate(item)); if(!Number.isFinite(date)||date>now+86400000||now-date>days*86400000) return {pass:false,reason:'不在时间范围'}; }
  if(directionHits.length) reasons.push('方向命中 '+directionHits.slice(0,3).join(' / '));
  if(hits.length) reasons.push('包含 '+hits.join(' / '));
  if(query.length) reasons.push('搜索 '+query.join(' / '));
  if(filters.goal && filters.goal!=='all') reasons.push(GOALS.find(g=>g.id===filters.goal)?.name||filters.goal);
  return {pass:true,score:directionHits.length*2+hits.length*4+query.length*3,reasons:reasons.length?reasons:['来自已启用的 AI 信息来源']};
}
export function selectItems(items,filters={},now=Date.now()) {
  return mergeItems(items).map(item=>({...item,match:evaluateItem(item,filters,now)})).filter(item=>item.match.pass).sort((a,b)=> {
    if(filters.sort!=='newest' && b.match.score!==a.match.score) return b.match.score-a.match.score;
    return (Date.parse(itemDate(b))||0)-(Date.parse(itemDate(a))||0);
  });
}
