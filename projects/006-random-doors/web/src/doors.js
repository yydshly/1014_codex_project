import './doors.css';
import { Journey, restoreJourney, STORAGE_KEY, KINDS, KIND_NAMES, encounterById, memoryLine } from './encounters.js';
import { illustration, interaction, escape } from './encounter-views.js';
import { variation, visibleVariationLabel } from './variations.js';
import { artUrl, warmScene } from './scene-art.js';

const $ = id => document.getElementById(id);
const storageKey = STORAGE_KEY + (import.meta.env.DEV && new URL(location.href).searchParams.get('review') === '1' ? ':review' : '');
let initial = null;
try { initial = restoreJourney(localStorage.getItem(storageKey)); } catch { /* Storage can be unavailable. */ }
const journey = new Journey(initial);
let busy = false, lastTime = performance.now(), savedAt = 0, soundContext;
const journal = $('journal');

function persist() {
  try { localStorage.setItem(storageKey, journey.serialize()); $('storage-warning').hidden = true; }
  catch { $('storage-warning').hidden = false; }
}
function announce(text) { $('announcement').textContent = text; }

function renderDoor() {
  const pending = encounterById(journey.data.pending.id), profile=variation(journey.data.pending);
  const same=journey.data.doorScene;
  warmScene(journey.data.pending);
  return `<section class="door-waiting" aria-labelledby="door-title">
    <img class="threshold-art" src="${artUrl('threshold')}" alt="夜色中的草地上，一扇木门透出暖光" fetchpriority="high"><div class="threshold-shade" aria-hidden="true"></div><div class="threshold-motes" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>
    <div class="door-intro"><p class="small-label eyebrow">A LITTLE UNKNOWN / 偶遇练习</p><h1 id="door-title" tabindex="-1">${same?'熟悉的地方，<br>新的遇见':'把下一刻，<br>交给偶然'}<span>。</span></h1><p class="door-description">${same?`仍是${pending.title}。<br>这一次，另一段生活正在等你。`:'有的门后是一阵风，有的是一个人。<br>不用想好去哪儿，先推开看看。'}</p><div class="door-preference">${same?'<span class="scope-label">同一个地方，也有不一样的事</span><button class="inline-button" data-action="unpin">换个地方 ↗</button>':`<label class="scope-label" for="scope">今天的心情</label><select id="scope">${Object.entries(KINDS).map(([key,label])=>`<option value="${key}" ${journey.data.scope===key?'selected':''}>${label}</option>`).join('')}</select>`}</div><button id="open-door" class="unknown-door">推开这扇门 <span aria-hidden="true">↗</span></button><p class="door-cue"><span class="listening-dot" aria-hidden="true"></span>${profile.cue??pending.cue}</p></div>
    <button class="portal-target" data-open-door aria-label="推开画面里的木门"></button>
    <div class="door-bottom"><p class="door-footnote">${same?'同一扇门，不同的心事。':'不预订目的地，只收集不期而遇。'}<br><span>每一次遇见，都有自己的后来。</span></p>${journey.data.visits.length ? `<p class="last-encounter">刚才的经历还在。<button class="inline-button" data-action="last-visit">回去看看 ↗</button></p>` : '<p class="door-edition">THE UNEXPECTED / 001</p>'}</div>
  </section>`;
}

function renderInside() {
  const visit=journey.current, meta=encounterById(visit.id), index=journey.data.visits.findIndex(v=>v.uid===visit.uid)+1;
  const s=visit.state, profile=variation(visit);
  let description=profile.description??meta.description, invitation=meta.invitation;
  if(visit.id==='rooftop')description='楼顶晾着几张纸签，风铃挂在它们旁边。云正在经过。';
  if(visit.id==='postoffice'){
    if(s.followup)description=`${profile.name}已经离开。柜台灯下，留着一张给那天的你的卡片。`;
    else if(s.delivered)description=`最后一盏柜台灯还亮着，${profile.name}的明信片已经盖上邮戳。`;
    else if(s.choice)description=`${profile.name}的明信片上，有了你们刚才写下的句子。`;
    if(!s.delivered)invitation='这次的心事会留在这里。下一扇门，或许是另一个人的片刻生活。';
  }
  if(visit.id==='repair'){
    if(s.choice)description=`店主为木鸟装好了${s.choice==='old'?'旧':'新'}铃。你们挑的声音会留在这段经历里。`;
    if(!s.wound)invitation='你可以陪她再想一会儿，也可以去看看下一扇门。';
  }
  if(visit.id==='greenhouse'){
    if(s.solved)description='温室浮在云上。你接通的光还在，植物已经展开叶片。';
    else invitation='离开时，镜子会停在你调过的位置。回来可以接着试。';
  }
  if(visit.id==='observatory'&&!s.solved)invitation='可以带着这个未解的小问题离开，回来时接着试。';
  return `<section class="encounter" data-encounter="${visit.id}" data-variation="${visit.variationId}" data-kind="${meta.kind}" data-solved="${!!visit.state.solved}" aria-labelledby="encounter-title">
    <div class="encounter-heading"><p class="small-label">${visit.returns ? '回到第' : '第'} ${String(index).padStart(2,'0')} 次遇见 <span>/</span> ${KIND_NAMES[meta.kind]} · ${visibleVariationLabel(visit)}</p><h1 id="encounter-title" tabindex="-1">${meta.title}</h1><p>${description}</p></div>
    <div class="encounter-stage"><div id="scene-art" class="scene-art">${illustration(visit)}</div><div id="encounter-panel" class="encounter-panel"><div class="panel-marker" aria-hidden="true">${meta.kind==='quiet'?'此刻，慢一点':meta.kind==='story'?'一段生活，与你交会':'试试看，世界会回应你'}</div>${interaction(visit)}</div></div>
    <footer class="encounter-exit"><div><button class="save-button" data-action="bookmark" aria-pressed="${visit.bookmarked}"><span aria-hidden="true">${visit.bookmarked?'✦':'＋'}</span> ${visit.bookmarked?'这次遇见已留住':'特别留住这次遇见'}</button><p>${visit.bookmarked?'在手记里，给这段经历留下一个小记号。':'离开也不会丢失进度，可以从手记回来。'}</p><button class="inline-button repeat-encounter" data-action="repeat">${visit.id==='postoffice'?'邮局里，再遇见一个人':'同一场景，再遇见一次'} ↗</button></div><div class="next-door"><button id="next-door" data-action="next">走向下一扇门 <span aria-hidden="true">↗</span></button><p>${invitation}</p></div></footer>
  </section>`;
}

function render(focusTitle = false) {
  const active = document.activeElement;
  const focusedAction = active?.getAttribute('data-action'), focusedValue = active?.getAttribute('data-value');
  const draft = $('paper-note')?.value;
  const focusedNote = active?.id === 'paper-note';
  const selection = focusedNote ? [active.selectionStart, active.selectionEnd] : null;
  $('app').dataset.phase = journey.data.phase;
  $('journey').innerHTML = journey.data.phase === 'door' ? renderDoor() : renderInside();
  $('journal-count').textContent = journey.data.visits.length;
  if (draft !== undefined && $('paper-note')) $('paper-note').value = draft;
  if (focusTitle) $(journey.data.phase==='door'?'door-title':'encounter-title').focus({preventScroll:true});
  else if (focusedNote && $('paper-note')) { $('paper-note').focus({preventScroll:true}); $('paper-note').setSelectionRange(...selection); }
  else if (focusedAction) {
    const match=[...$('journey').querySelectorAll('[data-action]')].find(el=>el.getAttribute('data-action')===focusedAction&&el.getAttribute('data-value')===focusedValue);
    if(match&&!match.disabled)match.focus({preventScroll:true});
  }
}

function renderJournal() {
  const visits=[...journey.data.visits].reverse();
  $('journal-list').innerHTML=visits.length ? `<ol>${visits.map((visit,i)=>`<li><div class="journal-thumbnail"><img src="${artUrl(visit.id==='postoffice'?`person-${variation(visit).id}`:visit.id)}" alt="" loading="lazy"><span class="journal-number">${String(visits.length-i).padStart(2,'0')}</span></div><div><p class="small-label">${KIND_NAMES[encounterById(visit.id).kind]} · ${visibleVariationLabel(visit)} ${visit.bookmarked?'· 特别留住':''}</p><h3>${encounterById(visit.id).title}</h3><p>${escape(memoryLine(visit))}</p><button class="inline-button" data-revisit="${escape(visit.uid)}">回到这次遇见 <span aria-hidden="true">↗</span></button></div></li>`).join('')}</ol>` : '<div class="empty-journal"><p>还没有去过的地方。</p><p>先开一扇门，手记就从那里开始。</p></div>';
}

async function passDoor(open, repeat=false) {
  if (busy) return;
  busy=true; $('journey').inert=true;
  const transition=$('door-transition'); transition.classList.add('visible');
  $('app').classList.add(open?'entering-world':'leaving-world');
  try {
    await Promise.all([new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?80:750)),open?warmScene(journey.data.pending):Promise.resolve()]);
    if (open) journey.open(); else if(repeat) journey.sameScene(); else journey.next();
    persist(); $('journey').inert=false; render(true); window.scrollTo({top:0,behavior:'instant'});
    transition.classList.remove('visible');
    announce(open?`这次，你来到${encounterById(journey.current.id).title}，遇见${variation(journey.current).name??visibleVariationLabel(journey.current)}。`:'你来到下一扇门前。');
  } finally { busy=false; $('journey').inert=false;$('app').classList.remove('entering-world','leaving-world'); }
}

function playBell(which='old') {
  try {
    const Context=window.AudioContext||window.webkitAudioContext;
    soundContext??=new Context(); soundContext.resume().catch(()=>{});
    const t=soundContext.currentTime;
    (which==='new'?[784,1046,1174]:[523,659,587]).forEach((frequency,i)=>{
      const oscillator=soundContext.createOscillator(),gain=soundContext.createGain();
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,t+i*.17);gain.gain.linearRampToValueAtTime(.045,t+i*.17+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+i*.17+.65);
      oscillator.connect(gain).connect(soundContext.destination);oscillator.start(t+i*.17);oscillator.stop(t+i*.17+.7);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
  } catch { announce('铃声暂时无法播放，木鸟的动作与文字反馈仍可继续。'); }
}

function act(action,value='') {
  if (busy) return;
  if(action==='next') { passDoor(false); return; }
  if(action==='repeat') { passDoor(false,true); return; }
  if(action==='unpin') { journey.randomDoor();persist();render(true);return; }
  if(action==='last-visit') { const visit=journey.data.visits.find(v=>v.uid===journey.data.lastVisitUid)??journey.data.visits.at(-1); if(visit){journey.revisit(visit.uid);persist();render(true);announce(`回到${variation(visit).name??visibleVariationLabel(visit)}的这次遇见。`);} return; }
  if(action==='replay-bell') { playBell(journey.current.state.choice);$('scene-art').innerHTML=illustration(journey.current);return; }
  if(!journey.act(action,value))return;
  if(action==='wind')playBell(journey.current.state.choice);
  if(action==='chime')playBell('new');
  persist();render();
  announce(action==='bookmark'?(journey.current.bookmarked?'已特别留住这次遇见。':'已收起特别记号，经历仍保留在手记里。'):memoryLine(journey.current));
}

$('journey').addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');
  if(target&&!target.disabled)act(target.dataset.action,target.dataset.value);
  if(event.target.closest('#open-door,[data-open-door]'))passDoor(true);
});
$('journey').addEventListener('keydown',event=>{
  const target=event.target.closest('svg [data-action]');
  if(target&&['Enter',' '].includes(event.key)){event.preventDefault();act(target.dataset.action);}
});
$('journey').addEventListener('change',event=>{if(event.target.id==='scope'){journey.setScope(event.target.value);persist();render();$('scope').focus();}});
$('journey').addEventListener('submit',event=>{if(event.target.id==='note-form'){event.preventDefault();act('hang',$('paper-note').value);}});
$('journal-toggle').addEventListener('click',()=>{renderJournal();journal.showModal();$('journal-toggle').setAttribute('aria-expanded','true');});
function closeJournal(){journal.close();$('journal-toggle').setAttribute('aria-expanded','false');}
$('journal-close').addEventListener('click',closeJournal);
journal.addEventListener('close',()=>{$('journal-toggle').setAttribute('aria-expanded','false');});
journal.addEventListener('click',event=>{
  const target=event.target.closest('[data-revisit]');
  if(target){journey.revisit(target.dataset.revisit);closeJournal();persist();render(true);window.scrollTo({top:0,behavior:'instant'});announce(`回到${variation(journey.current).name??visibleVariationLabel(journey.current)}的这次遇见。`);}
  else if(event.target===journal&&event.clientX>0){const r=journal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeJournal();}
});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden)persist();});
window.addEventListener('pagehide',persist);
setInterval(()=>{
  const now=performance.now(),dt=(now-lastTime)/1000;lastTime=now;
  if(!document.hidden&&!busy&&journey.tick(Math.min(dt,1))){persist();render();announce(variation(journey.current).eventText);}
  if(now-savedAt>5000){savedAt=now;persist();}
},250);
render();persist();
