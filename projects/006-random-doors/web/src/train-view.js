import {TRAIN_PROFILES,TRAIN_PEOPLE,trainScene,trainPlaceName,trainRoutes,trainActions,peopleHere,trainClue,trainBody} from './train-engine.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=id=>`./art/train-v09/${id}.webp`;
const cache=new Map();
export function warmTrain(v){
  if(v?.world!=='train')return Promise.resolve();
  const id=trainScene(v);if(cache.has(id))return cache.get(id);
  const image=new Image();image.src=asset(id);const promise=image.decode().catch(()=>{});cache.set(id,promise);return promise;
}
function actionButton(a,hotspot=false,position=null){
  const id=`train-${hotspot?'spot':'action'}-${a.id}`,route=a.route?`data-route="${a.route}"`:'';
  return `<button id="${id}" class="${hotspot?'train-hotspot':`train-do ${a.kind??''}`}" data-action="train" data-train-action="${a.route?'travel':a.type??a.id}" ${route} ${a.person?`data-person="${a.person}"`:''} ${a.target?`data-target="${a.target}"`:''} ${position?`style="--x:${position[0]}%;--y:${position[1]}%"`:''}><span class="${hotspot?'hotspot-ring':'action-mark'}" aria-hidden="true">${hotspot?'':a.route?'↗':a.kind==='sense'?'◌':a.kind==='primary'?'✦':'·'}</span><span>${esc(a.label)}</span></button>`;
}
function placedInteractions(v,c){
  const s=v.state,actions=trainActions(v,c),routes=trainRoutes(v),marks=[];
  if(v.role==='cat'){
    if(s.place==='aisle')marks.push({a:{...routes.find(r=>r.id==='duck'),route:'duck'},p:[22,54]});
    if(s.place==='underseat')marks.push({a:{...routes.find(r=>r.id==='crawl'),route:'crawl'},p:[73,43]});
    if(s.place==='luggage')marks.push({a:actions.find(a=>a.id===(s.clue&&!s.claimed?'take':'sniff')),p:[53,65]});
  }else if(v.role==='conductor'){
    if(s.place==='aisle'&&s.car===1)marks.push({a:{...routes.find(r=>r.id==='cab'),route:'cab'},p:[54,43]});
    if(s.place==='cab'){
      marks.push({a:actions.find(a=>a.id==='inspect'),p:[28,68]});
      if(s.delivered)marks.push({a:actions.find(a=>a.id==='doors'),p:[75,65]});
    }
  }else marks.push({a:actions.find(a=>a.id==='remember'),p:s.place==='seat'?[47,63]:[55,39]});
  const people=peopleHere(v,c);
  people.forEach((person,index)=>marks.push({a:{id:`person-${person.id}`,type:v.role==='conductor'?'ticket':'talk',person:person.id,label:v.role==='cat'?`靠近${person.name}`:v.role==='conductor'?`查验${person.name}的车票`:`听${person.name}说话`},p:index===0?[24,v.role==='cat'?65:53]:[77,v.role==='cat'?60:51]}));
  return marks.filter(m=>m.a?.label).map(m=>actionButton(m.a,true,m.p)).join('');
}
function sensoryLayer(v){
  const s=v.state;
  if(v.role==='cat'&&s.sense)return `<div class="scent-path ${s.clue?'recognised':''}" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i style="--i:${i}"></i>`).join('')}<span>${s.clue?'记住这缕气味':'气味钻进了椅子下面'}</span></div>`;
  if(v.role==='passenger'&&s.memoryStep)return `<div class="remembered-light" aria-hidden="true"><i></i><span>${s.memoryStep===1?'有人曾把一件东西，托付给你。':'原来那段往事，一直跟着你。'}</span></div>`;
  if(v.role==='conductor'&&s.place==='cab')return `<div class="cab-signals" aria-label="车门状态"><i class="${s.doorsClosed?'closed':''}"></i>${s.doorsClosed?'车门已锁闭':'等待发车确认'}</div>`;
  return '';
}
export function renderTrain(v,c,n,{sound=false}={}){
  const s=v.state,p=TRAIN_PROFILES[v.role],scene=trainScene(v),clue=trainClue(v,c),routes=trainRoutes(v),actions=trainActions(v,c);
  const selected=peopleHere(v,c).find(person=>person.id===s.selected),owner=TRAIN_PEOPLE[c.owner];
  return `<section class="night-train" data-world="train" data-identity="${v.role}" data-place="${s.place}" data-complete="${s.done}" data-awake="${s.awake}" aria-labelledby="world-title">
    <div class="train-stage ${s.lightOn?'':'reading-lights-off'} ${s.done?'arrived':''}" data-train-scene="${scene}">
      <img class="train-photo" src="${asset(scene)}" alt="${esc(trainBody(v))}，眼前是${trainPlaceName(v)}" fetchpriority="high" width="1536" height="1024">
      <div class="train-photo-shade" aria-hidden="true"></div><div class="train-window-shimmer" aria-hidden="true"></div>
      ${s.awake?sensoryLayer(v):''}
      <div class="train-topline"><div><p class="train-overline">第 ${String(n).padStart(2,'0')} 次开门 / 开往凌晨的列车</p><h1 id="world-title" tabindex="-1">${s.awake?trainPlaceName(v):p.short}</h1><p class="train-perception">${esc(p.sense)}</p></div><div class="train-role"><span>${esc(p.name)}</span><button id="train-sound" data-action="train-sound" aria-pressed="${sound}" aria-label="${sound?'关闭':'开启'}列车环境声">${sound?'◖ 声音开':'◌ 声音关'}</button><button id="train-switch" data-action="identity">换个身份 ↻</button></div></div>
      ${s.awake&&!s.done?`<div class="train-purpose"><span>这次，试着</span><p>${esc(p.task)}</p></div><div class="train-world-interactions" aria-label="触碰眼前的人与物">${placedInteractions(v,c)}</div>`:''}
      ${!s.awake?`<div class="train-awakening"><p class="train-overline">你正在成为，另一个人</p><h2>${p.name}</h2><p>${esc(p.intro)}</p><button class="train-wake" id="train-awake" data-action="train" data-train-action="awake">${p.awakening}<span>↗</span></button><span class="wake-note">从这个身体里，重新看一遍世界。</span></div>`:''}
      ${s.awake&&!s.done?`<div class="train-bottom"><div class="train-story" role="status" aria-live="polite"><p class="train-overline">${v.role==='cat'?'胡须与鼻尖告诉你':v.role==='conductor'?'这趟列车回应你':'一段生活正被想起'}</p><p>${esc(s.log[0]??p.sense)}</p>${selected&&s.claimed&&s.clue?`<button id="train-give" data-action="train" data-train-action="deliver">${v.role==='cat'?`把${esc(c.item)}轻轻放在他脚边`:`把${esc(c.item)}交还给${selected.name}`} <span>↗</span></button>`:''}</div><div class="train-controls"><div class="train-move" aria-label="从这里可以去">${routes.map(r=>actionButton({...r,route:r.id})).join('')}</div><div class="train-hands" aria-label="这个身体能做的事">${actions.filter(a=>a.kind!=='detail').map(a=>actionButton(a)).join('')}</div><details class="train-small-actions"><summary>再留意一下身边</summary><div>${actions.filter(a=>a.kind==='detail').map(a=>actionButton(a)).join('')}<p>${clue?esc(clue):esc(trainBody(v))}${s.claimed?` · ${v.role==='cat'?'正叼着':'带着'}${esc(c.item)}`:''}</p></div></details></div></div>`:''}
      ${s.done?`<div class="train-completion" role="status"><p class="train-overline">${s.legacyComplete?'保留的 0.8 列车经历':'这一回，你用这个身份留下了一点什么'}</p><h2>${s.legacyComplete?'那次归还，仍然被记得。':v.role==='cat'?'有人为你低下了身。':v.role==='conductor'?'最后一盏确认灯亮了。':'你想起了要去见的人。'}</h2><p>${esc(s.log[0])}</p><span>${esc(c.item)} · ${owner.name}</span><button id="train-next-identity" data-action="identity">留在这班车，换一个身份 <span>↗</span></button></div>`:''}
    </div>
    <footer class="train-afterword"><p>${s.done?'你刚才的经历，会留在身份见闻里。':`${clue?esc(clue):'把注意力交给眼前的人、物和声音。'}${s.claimed?` · ${v.role==='cat'?'嘴边':'身边'}有${esc(c.item)}`:''}`}</p><div><button id="same-world" data-action="identity">同一列车，随机换个身份 ↻</button><button id="next-world" data-action="next">离开列车，走向下一扇门 ↗</button></div></footer>
  </section>`;
}
