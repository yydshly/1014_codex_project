import { traceLight } from './encounters.js';
import { variation, visibleVariationLabel } from './variations.js';

const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Node tests and the Vite base-path build use the same asset names.
export const artUrl = name => `${import.meta.env?.BASE_URL ?? './'}art/${name}.webp`;
const loaded = new Map();
export function warmScene(visit) {
  const names = [visit.id, ...(visit.id === 'postoffice' ? [`person-${variation(visit).id}`] : [])];
  return Promise.all(names.map(name => {
    if (!loaded.has(name)) {
      const img = new Image(); img.src = artUrl(name);
      loaded.set(name, img.decode().catch(() => {}));
    }
    return loaded.get(name);
  }));
}

const star = (x,y,r=8,fill='#ffe6aa') => `<path d="M${x} ${y-r}l${r*.3} ${r*.7} ${r*.7} ${r*.3}-${r*.7} ${r*.3}-${r*.3} ${r*.7}-${r*.3}-${r*.7}-${r*.7}-${r*.3} ${r*.7}-${r*.3}Z" fill="${fill}"/>`;
const svg = (label,content,cls='event-layer') => `<svg class="${cls}" viewBox="0 0 900 550" role="${cls.includes('puzzle')?'group':'img'}" aria-label="${safe(label)}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
const glow = `<defs><radialGradient id="light-halo"><stop stop-color="#ffe2a0" stop-opacity=".8"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient><filter id="beam-glow"><feGaussianBlur stdDeviation="5"/></filter><linearGradient id="brass"><stop stop-color="#775536"/><stop offset=".5" stop-color="#e6ca91"/><stop offset="1" stop-color="#8e6c40"/></linearGradient></defs>`;
const hotspot = (action,label,x,y,extra='') => `<button class="world-hotspot ${extra}" data-action="${action}" style="--x:${x}%;--y:${y}%"><span class="hotspot-point" aria-hidden="true"></span><span>${label}</span></button>`;
const motes = () => `<div class="world-motes" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="left:${7+i*6.8}%;top:${20+(i*19)%60}%;animation-delay:-${i*.8}s"></i>`).join('')}</div>`;

function sea(visit,profile,age) {
  const s=visit.state;
  const rain = profile.rain ? `<div class="world-rain" aria-hidden="true">${Array.from({length:50},(_,i)=>`<i style="left:${8+(i*31)%86}%;top:${10+(i*17)%75}%;--speed:${.6+(i%5)*.12}s;animation-delay:-${i*.13}s"></i>`).join('')}</div>` : '';
  const boat=s.eventSeen&&profile.id==='boat' ? svg('海雾里经过的船灯',`${glow}<g class="distant-boat" style="animation-delay:-${age}s"><g transform="translate(450 276) scale(.55) translate(-450 -276)"><ellipse cx="450" cy="276" rx="28" ry="23" fill="url(#light-halo)"/><path d="M425 278h53l-9 7h-33z" fill="#162c36"/><path d="M442 265h13v13h-13z" fill="#ffdf9a"/><path d="M448 254v11" stroke="#182b35" stroke-width="2"/><path d="M441 292h15m-18 6h21m-17 7h12" stroke="#e7bb75" stroke-width="2" opacity=".65"/></g></g>`) : '';
  const birds=s.eventSeen&&profile.id==='birds' ? svg('掠过海面的归鸟',`<g class="sea-birds" style="animation-delay:-${age}s" stroke="#182c38" stroke-width="1.7" fill="none">${[0,1,2,3,4].map(i=>`<path d="M${320+i*23} ${239+(i%2)*12}q5-7 10 0 5-7 10 0"/>`).join('')}</g>`) : '';
  return `${rain}${boat}${birds}${s.eventSeen&&profile.id==='sunbreak'?`<div class="sun-shaft" style="animation-delay:-${age}s" aria-hidden="true"></div>`:''}
    ${s.catching?`<div class="catching-hand"><img src="${artUrl('rain-hand')}" alt="伸出掌心接住檐水"><span class="palm-ripple" aria-hidden="true"></span></div>`:''}
    ${hotspot('sit',s.seated?'起身':'坐一会儿',18,68,'bench-hotspot')}${hotspot('catch',s.catching?'收回手':'接住檐水',76,73)}
    <div class="world-caption"><span class="live-dot"></span>${s.seated?'你坐下了。海还是慢慢的。':profile.rain?'细雨落在屋檐上':'雨停了，檐水还在滴'}</div>`;
}

function roof(visit,profile,age) {
  const s=visit.state;
  const plane=s.eventSeen&&profile.id==='plane' ? svg('一架落在天台的纸飞机',`<g class="paper-plane" style="animation-delay:-${age}s"><path d="M584 411l76-27-31 47-10-17z" fill="#e9e2cb" stroke="#bcb8a9"/><path d="M584 411l35 3 41-30-31 47-10-17" fill="none" stroke="#9ca4a1" stroke-width="1"/></g>`) : '';
  return `${plane}${s.hung?`<div class="user-paper ${s.eventSeen||s.touched?'paper-sway':''}"><span>${safe(s.note||'留白，也很好。')}</span></div>`:''}
    ${hotspot('chime','轻碰风铃',90,24,s.touched?'chime-touched':'')}
    ${s.eventSeen&&profile.id==='plane'&&!s.eventRead?hotspot('read-plane','打开纸飞机',70,77):''}
    ${s.eventSeen&&profile.id==='windows'?`<div class="window-warmth" style="animation-delay:-${age}s" aria-hidden="true"></div>`:''}
    <div class="world-caption"><span class="live-dot"></span>${s.hung?'你留的纸签，正和风一起。':'把今天暂时放在风里。'}</div>`;
}

function post(visit,profile) {
  const s=visit.state,content=s.choice?profile.choices[s.choice].line:profile.draft;
  return `${!s.followup?`<figure class="visitor-portrait"><img src="${artUrl(`person-${profile.id}`)}" alt="这次在邮局遇见的${profile.name}"><figcaption>${profile.name}<span>${profile.person}</span></figcaption></figure>`:''}
    <div class="letter-on-counter ${s.delivered?'letter-delivered':''}"><p class="letter-overline">${s.followup?'来自后来的回信':s.delivered?'盖好邮戳的明信片':'还没寄出的明信片'}</p><p>${safe(s.followup?`那天，谢谢你。—— ${profile.name}`:content)}</p>${s.delivered?'<span class="postal-stamp">已寄出</span>':''}</div>
    <div class="world-caption"><span class="live-dot"></span>${s.followup?'人已经离开，那天的回应还在。':s.delivered?'一封信，已经在路上。':'最后一盏柜台灯还亮着。'}</div>`;
}

const gridPoint = p => [180+p.x*125,78+p.y*95];
function greenhouse(s) {
  const light=traceLight(s),[tx,ty]=gridPoint(light.target),lines=light.path.map(p=>gridPoint(p).join(',')).join(' ');
  return svg('可操作的光路台：点击 A、B 镜子把光送到花上',`${glow}<rect x="123" y="25" width="654" height="496" rx="28" fill="#10262a" fill-opacity=".87" stroke="url(#brass)" stroke-width="3"/><rect x="137" y="39" width="626" height="468" rx="19" fill="none" stroke="#d3ba7d" stroke-opacity=".22"/>
    <g stroke="#d5d7b5" stroke-opacity=".13">${[0,1,2,3,4].map(i=>`<path d="M180 ${78+i*95}h500M${180+i*125} 78v380"/>`).join('')}</g>
    <polyline points="${lines}" fill="none" stroke="#ffdc89" stroke-width="12" opacity=".6" filter="url(#beam-glow)"/><polyline points="${lines}" fill="none" stroke="#fff0b9" stroke-width="3" stroke-linejoin="round"/>
    ${light.mirrors.map((mirror,i)=>{const[x,y]=gridPoint(mirror),slash=light.slashes[i];return `<g ${!s.solved?`class="art-control" data-action="mirror-${i?'b':'a'}" role="button" tabindex="0" aria-label="转动镜子 ${i?'B':'A'}"`:''}><circle cx="${x}" cy="${y}" r="39" fill="#192e32" stroke="url(#brass)" stroke-width="3"/><circle cx="${x}" cy="${y}" r="29" fill="#8db8b2" fill-opacity=".5" stroke="#d5e7da" stroke-opacity=".5"/><path d="M${x-21} ${y+(slash?21:-21)}l42 ${slash?-42:42}" stroke="#effff5" stroke-width="5" stroke-linecap="round"/><text x="${x}" y="${y+58}" text-anchor="middle" font-size="15" font-family="serif" fill="#efdcaf">${i?'B':'A'}</text></g>`}).join('')}
    <circle cx="${gridPoint(light.start)[0]}" cy="${gridPoint(light.start)[1]}" r="26" fill="url(#light-halo)"/><circle cx="${gridPoint(light.start)[0]}" cy="${gridPoint(light.start)[1]}" r="9" fill="#fff0b5"/>
    <g transform="translate(${tx} ${ty})"><circle r="36" fill="#254439" stroke="#d7c794" stroke-dasharray="3 5"/><path d="M-18 15h36l-6 30h-24z" fill="#b58d61"/><path d="M0 17V-15" stroke="#a1bd77" stroke-width="3"/><path d="M0 8q-32-35-30-4Q-15 17 0 8m0 0q32-35 30-4Q15 17 0 8" fill="#8dac66"/>${s.solved?`<g class="flower-bloom">${[0,60,120,180,240,300].map(angle=>`<ellipse cx="0" cy="-32" rx="8" ry="13" fill="#efd1b2" transform="rotate(${angle} 0 -21)"/>`).join('')}<circle cy="-21" r="6" fill="#ffd991"/></g>`:''}</g>`, 'puzzle-layer greenhouse-instrument');
}

export function ringPoint(index,position) {
  const radius=[160,115,70][index],angle=position*Math.PI/2-Math.PI/2;
  return [450+Math.cos(angle)*radius,256+Math.sin(angle)*radius];
}
function observatory(s) {
  const points=s.rings.map((p,i)=>ringPoint(i,p));
  return svg('可操作的星图仪：点击外、中、内星环，让亮星与空星重合',`${glow}<circle cx="450" cy="256" r="200" fill="#091d2c" fill-opacity=".92" stroke="url(#brass)" stroke-width="6"/><circle cx="450" cy="256" r="187" fill="none" stroke="#c8b98e" stroke-opacity=".35"/>
    <g stroke="#d7c391" stroke-opacity=".6">${Array.from({length:48},(_,i)=>{const a=i*Math.PI/24;return `<path d="M${450+Math.sin(a)*181} ${256+Math.cos(a)*181}l${Math.sin(a)*(i%4?4:9)} ${Math.cos(a)*(i%4?4:9)}"/>`}).join('')}</g>
    ${[160,115,70].map((r,i)=>`<g ${!s.solved?`data-action="ring-${i}" class="art-control" role="button" tabindex="0" aria-label="转动${['外','中','内'][i]}环"`:''}><circle cx="450" cy="256" r="${r}" fill="none" stroke="#c7b17f" stroke-opacity=".09" stroke-width="28"/><circle cx="450" cy="256" r="${r}" fill="none" stroke="#b2a47c" stroke-width="1.5"/><g transform="translate(${ringPoint(i,s.targets[i]).join(' ')})"><path d="M0-12 4-4 12 0 4 4 0 12-4 4-12 0-4-4Z" fill="#10232e" stroke="#e6dcc0" stroke-width="2"/></g><circle cx="${points[i][0]}" cy="${points[i][1]}" r="20" fill="url(#light-halo)"/>${star(...points[i],10)}<text x="${450-r+12}" y="278" font-size="12" fill="#c0b38e">${['外','中','内'][i]}</text></g>`).join('')}
    ${s.solved?`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#f4d69a" stroke-width="2" class="constellation"/><circle cx="450" cy="256" r="35" fill="url(#light-halo)"/>`:star(450,256,5,'#c0b99c')}`, 'puzzle-layer star-instrument')+(s.solved?'<div class="shooting-star" aria-hidden="true"></div>':'');
}

export function illustration(visit) {
  const s=visit.state,p=variation(visit),age=Math.max(0,visit.elapsed-visit.eventAt);
  const content=visit.id==='seaside'?sea(visit,p,age):visit.id==='rooftop'?roof(visit,p,age):visit.id==='postoffice'?post(visit,p):visit.id==='repair'?`${s.wound?'<div class="bird-song" aria-hidden="true"><i></i><i></i><i></i></div>':''}${hotspot(s.wound?'replay-bell':s.choice?'wind':'listen',s.wound?'再听一声':s.choice?'转动发条':'听听木鸟的来历',38,69)}<div class="world-caption"><span class="live-dot"></span>${s.wound?'有些声音，会慢慢变成熟悉。':'坏掉的东西，也值得被温柔对待。'}</div>`:visit.id==='greenhouse'?greenhouse(s):observatory(s);
  return `<div class="world-art world-${visit.id} variant-${p.id} ${s.seated?'is-seated':''} ${s.eventSeen?'event-seen':''}"><img class="world-backdrop" src="${artUrl(visit.id)}" alt="${safe(visibleVariationLabel(visit))} · ${safe(p.description??'门后的世界')}" fetchpriority="high" draggable="false"><div class="world-vignette" aria-hidden="true"></div>${content}${motes()}</div>`;
}
