import './worlds.css';
import './train.css';
import {renderTrain,warmTrain} from './train-view.js';
import {TrainSound} from './train-audio.js';
import {WorldJourney,WORLD_STORAGE,WORLDS,WORLD_IDS,ROLES,PEOPLE,LAWS,configFor,availableAxes,missionComplete,memoryOf} from './world-engine.js';
import {museumArt,genesisArt} from './world-art.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey=WORLD_STORAGE+(import.meta.env.DEV&&new URL(location.href).searchParams.get('review')==='1'?':review':'');
let raw=null;try{raw=localStorage.getItem(storageKey);}catch{/* Browser storage is optional. */}
const journey=new WorldJourney(raw);let crossing=false;const trainSound=new TrainSound();
const requestedWorld=new URL(location.href).searchParams.get('world');
if(WORLD_IDS.includes(requestedWorld)&&((journey.data.phase==='door'&&journey.data.pending?.world!==requestedWorld)||(journey.data.phase==='inside'&&journey.current?.world!==requestedWorld)))journey.prepare(requestedWorld);
function save(){try{localStorage.setItem(storageKey,journey.serialize());$('world-storage-warning').hidden=true;}catch{$('world-storage-warning').hidden=false;}}
const button=(id,label,action,extra='',disabled=false)=>`<button id="${id}" data-action="${action}" ${extra} ${disabled?'disabled':''}>${label}</button>`;
function gate(){
  const count=journey.data.visits.length;
  return `<section class="threshold" aria-labelledby="world-title"><img class="threshold-background" src="./art/threshold.webp" alt="夜空下一扇透光的门" fetchpriority="high"><div class="threshold-veil"></div><div class="gate-copy"><p class="eyebrow">THE OTHER SIDE OF YOU / 另一种可能</p><h1 id="world-title" tabindex="-1">借一个身份，<br>去另一种世界<span>。</span></h1><p class="gate-intro">也许你看不见自己的身体，<br>也许你是一只猫，也许整个宇宙正等你醒来。</p><button class="open-world" id="enter-world" data-action="enter">推开未知的门 <span>↗</span></button><p class="door-whisper"><span></span>${esc(WORLDS[journey.data.pending.world].cue)}</p><p class="gate-note">世界、身份、任务与局部条件在门前确定。<br>进去后，你的行动会得到有规则的回应。</p></div><div class="gate-bottom"><p>${count?`已借过 ${count} 次身份。过去的世界，还在见闻里。`:'不必事先决定，你想成为谁。'}<br><span>每次约 2—5 分钟 · 可随时离开</span></p><details class="world-picker"><summary>想先试一个特定世界？</summary><div>${WORLD_IDS.map(w=>button(`choose-${w}`,`${WORLDS[w].label} ↗`,'choose',`data-world="${w}"`)).join('')}</div><p>只指定世界；身份与任务继续随机。</p></details></div></section><section class="experiment-note"><p>三套规则世界 · 八种身份 · 每个世界内继续变化</p><p>原创机制原型 / 有限内容与规则组合，浏览器内运行。<a href="./research.html#identity" target="_top">了解这次探索 ↗</a></p></section>`;
}
function museumPanel(v){
  const c=configFor(v),s=v.state,near=Math.abs(s.x-c.target[0])+Math.abs(s.y-c.target[1])<=1,atExit=s.x===0&&s.y===5;
  return `<div class="progress-line"><span class="${s.obtained?'checked':''}">01 ${esc(c.task.phrase)}</span><span class="${s.done?'checked':''}">02 回到门口</span></div><div class="museum-status"><span>能力 <b>${s.charges}/2</b></span><span>警戒 <b>${'●'.repeat(s.alert)}${'○'.repeat(3-s.alert)}</b></span><span>${c.weather==='rain'?'漏雨 · 水洼显形':'干燥 · 留意脚步声'}</span></div><div class="dpad" aria-label="移动控制">${button('move-up','↑','move','data-dx="0" data-dy="-1" aria-label="向上移动"',s.done)}${button('move-left','←','move','data-dx="-1" data-dy="0" aria-label="向左移动"',s.done)}${button('wait','停一拍','wait','',s.done)}${button('move-right','→','move','data-dx="1" data-dy="0" aria-label="向右移动"',s.done)}${button('move-down','↓','move','data-dx="0" data-dy="1" aria-label="向下移动"',s.done)}</div><div class="action-row">${button('ability',`${s.armed?'收起':`准备${ROLES[v.role].ability}`}${s.armed?' · 已就绪':''}`,'ability',`aria-pressed="${s.armed}"`,s.done||!s.charges)}${button('museum-interact',s.obtained?'从门口离开':c.task.action,'interact','class="primary"',s.done||(s.obtained?!atExit:!near))}</div><p class="control-note">点击相邻地砖 / 方向键 / WASD。守卫每回合移动；等待可降低警戒。${v.role==='shade'?'影跃准备后会跨两格。':''}</p>`;
}
function genesisPanel(v){
  const s=v.state,c=configFor(v);
  return `<div class="law-options">${availableAxes(v).map(axis=>`<fieldset ${s.done?'disabled':''}><legend>${LAWS[axis].name}</legend><div>${LAWS[axis].values.map(value=>button(`law-${axis}-${value.id}`,value.label,'law',`data-axis="${axis}" data-value="${value.id}" aria-pressed="${s.axis===axis&&s.value===value.id}" title="${value.hint}"`)).join('')}</div></fieldset>`).join('')}</div><p class="law-preview">${s.axis?`${LAWS[s.axis].name} · ${LAWS[s.axis].values.find(x=>x.id===s.value).hint}`:'先选一条规则，之后可以撤回、比较，直到你愿意留下它。'}</p><div class="action-row">${button('advance','推进一刻，看世界回应','advance','class="primary"',s.done||!s.axis)}${button('seal',missionComplete(v)?'留下这条法则 ✓':'留下这次尝试','seal','',s.done||!s.observed)}</div><p class="control-note">${v.role==='god'?'同一时刻只改变一条法则，切换法则会撤回上一条。':'这个身份只能修改自己掌管的法则。'}每次改动后需推进一刻，才会产生后果。</p>`;
}
function inside(){
  const v=journey.current,s=v.state,c=configFor(v),world=WORLDS[v.world],role=ROLES[v.role],success=missionComplete(v);
  const goal=v.world==='museum'?`${c.task.phrase}，再从门口离开。`:v.world==='train'?`找到${c.item}，辨认主人，把它交还。`:c.goal.text;
  const n=journey.data.visits.findIndex(x=>x.uid===v.uid)+1;
  if(v.world==='train')return renderTrain(v,c,n,{sound:trainSound.enabled});
  return `<section class="world-visit" data-world="${v.world}" data-identity="${v.role}" data-complete="${s.done}" style="--accent:${world.color}" aria-labelledby="world-title"><div class="world-masthead"><div><p class="eyebrow">第 ${String(n).padStart(2,'0')} 次开门 / ${world.label}</p><h1 id="world-title" tabindex="-1">${world.title}<span>。</span></h1></div><p>这一次，你是<br><strong>${role.name}</strong></p></div><div class="world-layout"><div class="scene-column"><div class="scene-frame">${v.world==='museum'?museumArt(v):genesisArt(v)}</div><div class="scene-caption"><span>${v.world==='museum'?'看不见你，也能听见你。':v.world==='train'?'同一班列车，有不止一种看法。':'你改下的一行，成为他们的一生。'}</span><span>${v.world==='museum'?`行动 ${s.turn}`:v.world==='train'?['驾驶室','休息车','观景车','行李车'][s.car]:`第 ${s.epoch} 刻`}</span></div><div class="world-response" role="status" aria-live="polite"><span>世界回应</span><p>${esc(s.log[0]??'世界在等你行动。')}</p></div></div><aside class="identity-panel" aria-label="身份能力与任务"><div class="identity-card"><span class="identity-symbol" aria-hidden="true">${role.symbol}</span><div><p class="eyebrow">YOUR BORROWED IDENTITY</p><h2>${role.name}</h2><p>${role.detail}</p></div></div><details class="identity-limits"><summary>这个身份的限制</summary><p>${role.limit}</p></details><div class="mission"><p class="eyebrow">这一次的小目标</p><h3>${goal}</h3></div>${v.world==='museum'?museumPanel(v):genesisPanel(v)}</aside></div>${s.done?`<div class="ending ${success?'success':''}"><span>${success?'✧ 这一次，你改变了一点什么。':'◌ 这次尝试，也成为世界的一部分。'}</span><p>${esc(memoryOf(v))}</p></div>`:''}<footer class="world-exit"><div><button id="same-world" data-action="identity">同一世界，换个身份 ↻</button><p>保留同一组世界条件，比较能力与视角。</p></div><div><button class="next-world" id="next-world" data-action="next">走向下一扇未知的门 <span>↗</span></button><p>当前进度自动留在身份见闻里。</p></div></footer></section>`;
}
function render(focusTitle=false){
  const active=document.activeElement?.id;
  $('world-app').dataset.phase=journey.data.phase;
  const train=journey.data.phase==='inside'&&journey.current?.world==='train';
  $('world-app').dataset.world=train?'train':'';
  if(!train)trainSound.stop();else trainSound.setPerspective(journey.current.role,journey.current.state.place);
  warmTrain(journey.data.phase==='inside'?journey.current:journey.data.pending);
  $('universe').innerHTML=journey.data.phase==='inside'?inside():gate();
  $('atlas-count').textContent=journey.data.visits.length;
  if(focusTitle){window.scrollTo({top:0,behavior:'instant'});$('world-title')?.focus({preventScroll:true});}else if(active)$(active)?.focus({preventScroll:true});
  save();
}
async function transition(fn){if(crossing)return;crossing=true;$('crossing').classList.add('active');await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?0:380));fn();await warmTrain(journey.current);render(true);$('crossing').classList.remove('active');crossing=false;}
async function act(action){
  const train=journey.current?.world==='train';
  if(train&&['travel','take'].includes(action.type)){crossing=true;document.querySelector('.train-stage')?.classList.add('walking');}
  journey.act(action);
  if(train&&['travel','take'].includes(action.type)){save();await warmTrain(journey.current);}
  render(train&&['travel','awake'].includes(action.type));crossing=false;
}
function atlas(){
  $('atlas-list').innerHTML=journey.data.visits.length?[...journey.data.visits].reverse().map((v,i)=>`<button class="atlas-record" data-action="revisit" data-uid="${esc(v.uid)}"><span class="atlas-icon" style="color:${WORLDS[v.world].color}">${ROLES[v.role].symbol}</span><span><small>${String(journey.data.visits.length-i).padStart(2,'0')} / ${WORLDS[v.world].title} · ${v.state.done?'已留下结果':'可以继续'}</small><strong>${ROLES[v.role].name}</strong><em>${esc(memoryOf(v))}</em></span><span>↗</span></button>`).join(''):'<p class="atlas-empty">还没有借过的身份。第一扇门正在等你。</p>';
  $('atlas').showModal();$('close-atlas').focus();
}
$('open-atlas').addEventListener('click',atlas);$('close-atlas').addEventListener('click',()=>$('atlas').close());
document.addEventListener('click',e=>{
  if(crossing)return;
  const tile=e.target.closest('[data-tile]');
  if(tile&&journey.current?.world==='museum'){
    const [x,y]=tile.dataset.tile.split(',').map(Number),s=journey.current.state,dx=x-s.x,dy=y-s.y;
    if((dx===0||dy===0)&&Math.abs(dx)+Math.abs(dy)===(s.armed&&journey.current.role==='shade'?2:1))act({type:'move',dx:Math.sign(dx),dy:Math.sign(dy)});
    else $('world-announcement').textContent='请点击相邻地砖。影跃准备后可以跨两格。';return;
  }
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;
  const type=b.dataset.action;
  if(type==='train-sound'){trainSound.toggle().then(()=>render());return;}
  if(type==='train'){act({type:b.dataset.trainAction,route:b.dataset.route,person:b.dataset.person,target:b.dataset.target});return;}
  if(type==='enter'){transition(()=>journey.enter());return;}
  if(type==='choose'){transition(()=>{journey.prepare(b.dataset.world);journey.enter();});return;}
  if(type==='next'){journey.prepare();render(true);return;}
  if(type==='identity'){transition(()=>journey.repeatIdentity());return;}
  if(type==='revisit'){$('atlas').close();journey.revisit(b.dataset.uid);render(true);return;}
  if(type==='move'){act({type,dx:Number(b.dataset.dx),dy:Number(b.dataset.dy)});return;}
  if(type==='car'){act({type,car:Number(b.dataset.car)});return;}
  act({type,axis:b.dataset.axis,value:b.dataset.value,person:b.dataset.person});
});
document.addEventListener('keydown',e=>{
  if(crossing||$('atlas').open||journey.data.phase!=='inside'||journey.current?.world!=='museum'||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,select,textarea,summary'))return;
  const key=e.key.toLowerCase(),moves={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
  if(moves[key]){e.preventDefault();act({type:'move',dx:moves[key][0],dy:moves[key][1]});}
});
render();

document.addEventListener('visibilitychange',()=>{if(document.hidden){trainSound.stop();const b=$('train-sound');if(b){b.setAttribute('aria-pressed','false');b.textContent='◌ 声音关';}}});
window.addEventListener('pagehide',()=>trainSound.stop());
let lookFrame=0;document.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||lookFrame||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const stage=e.target.closest('.train-stage');if(!stage)return;lookFrame=requestAnimationFrame(()=>{const r=stage.getBoundingClientRect();stage.style.setProperty('--look-x',String((e.clientX-r.left-r.width/2)/r.width*8));stage.style.setProperty('--look-y',String((e.clientY-r.top-r.height/2)/r.height*5));lookFrame=0;});});
