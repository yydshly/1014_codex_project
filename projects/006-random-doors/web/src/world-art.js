import { MUSEUM_BLOCKS, guardAt, genesisOutcome, configFor } from './world-engine.js';
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stars=(n=55)=>Array.from({length:n},(_,i)=>`<circle cx="${(i*137+33)%1000}" cy="${(i*71+17)%460}" r="${i%6===0?1.7:.8}" opacity="${.2+(i%5)/8}"/>`).join('');
export function museumArt(v){
  const c=configFor(v),s=v.state,g=guardAt(v),next=guardAt(v,s.turn+1);
  const tiles=Array.from({length:54},(_,i)=>{
    const x=i%9,y=Math.floor(i/9),point=[x,y],block=MUSEUM_BLOCKS.some(p=>same(p,point));
    const player=s.x===x&&s.y===y,target=same(point,c.target),exit=x===0&&y===5,guard=same(point,g),wet=c.weather==='rain'&&c.wet.some(p=>same(p,point));
    const adjacent=Math.abs(x-s.x)+Math.abs(y-s.y)===(s.armed&&v.role==='shade'?2:1)&&(x===s.x||y===s.y);
    const classes=['floor',block?'block':'',player?'player':'',target?'target':'',exit?'exit':'',guard?'guard':'',wet?'wet':'',same(point,next)?'next-patrol':'',adjacent&&!block?'reachable':''].filter(Boolean).join(' ');
    const label=block?'展柜':target?c.task.item:exit?'出口':guard?'守卫':wet?'水洼':'地砖';
    return `<button class="${classes}" id="tile-${x}-${y}" data-tile="${x},${y}" aria-label="${x+1} 列 ${y+1} 行，${label}${player?'，你在这里':''}" ${block||s.done?'disabled':''}>
      ${block?'<span class="display-case"><i></i></span>':''}${wet?'<span class="puddle" aria-hidden="true"></span>':''}
      ${target?`<span class="relic ${s.obtained?'changed':''}" aria-hidden="true">${s.obtained?'✧':'◈'}</span><span class="tile-word">${s.obtained?'已改变':'目标'}</span>`:''}
      ${exit?'<span class="exit-glyph" aria-hidden="true">⌑</span><span class="tile-word">门</span>':''}
      ${guard?'<span class="warden" aria-hidden="true"><i></i></span>':''}
      ${player?'<span class="invisible-person" aria-hidden="true"><i></i></span>':''}
    </button>`;
  }).join('');
  return `<div class="museum-room ${c.weather}" data-scene="museum"><div class="room-wall"><span>THE SEVENTH GALLERY</span><i></i><i></i><i></i></div><div class="museum-grid" aria-label="展厅地面，可点击相邻地砖移动">${tiles}</div><div class="map-legend"><span><i class="legend-dot mint"></i>你留下的轮廓</span><span><i class="legend-dot amber"></i>守卫</span><span>虚线格：守卫下一步</span></div></div>`;
}
function island(x,y,scale,kind,outcome){
  const green=outcome.forest?'#86bfa3':'#738d91',light=outcome.water?'#edce8b':'#7f878d';
  return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="5" rx="156" ry="40" fill="#091a2a" opacity=".18"/><path d="M-145 0L-92 95 -27 165 18 108 70 125 145 0Z" fill="#334553"/><path d="M-145 0L-27 165 -42 37 80 20Z" fill="#263b4b"/><ellipse rx="145" ry="38" fill="${green}"/><ellipse cy="-6" rx="130" ry="28" fill="#aec0af" opacity=".3"/>
  ${kind==='village'?`<g transform="translate(-48 -31)"><path d="M-27 1L0-26 27 1V36H-27Z" fill="#b3aca0"/><path d="M-32 1L0-29 32 1" fill="none" stroke="#4d5f6d" stroke-width="7"/><rect x="-7" y="13" width="14" height="23" fill="${light}"/></g><g transform="translate(31 -22) scale(.8)"><path d="M-27 1L0-26 27 1V36H-27Z" fill="#9aaca5"/><path d="M-32 1L0-29 32 1" fill="none" stroke="#4d5f6d" stroke-width="7"/><rect x="-7" y="13" width="14" height="23" fill="${light}"/></g>`:`<g transform="translate(0 ${outcome.forest?-18:0})"><path d="M-62 15V-90M0 10V-120M62 15V-72" stroke="#4f6a68" stroke-width="7"/><path d="M-100-30L-62-105 -24-30ZM-48-45L0-143 48-45ZM30-20L62-90 94-20Z" fill="${outcome.forest?'#78bca0':'#839e99'}"/></g>`}
  ${outcome.safe?'<g fill="#e6cc9d"><circle cx="-9" cy="8" r="5"/><path d="M-9 15v12" stroke="#e6cc9d" stroke-width="3"/><circle cx="73" cy="-2" r="4"/><path d="M73 4v11" stroke="#e6cc9d" stroke-width="3"/></g>':''}</g>`;
}
export function genesisArt(v){
  const s=v.state,outcome=s.observed?genesisOutcome(v):genesisOutcome({...v,state:{...s,axis:null}}),c=configFor(v);
  const together=outcome.connected,yshift=s.observed&&s.axis==='gravity'?(s.value==='heavy'?65:s.value==='reverse'?-55:0):0;
  return `<div class="genesis-world ${s.observed?`${s.axis}-${s.value}`:'unwritten'}" data-scene="genesis"><svg viewBox="0 0 1000 680" role="img" aria-label="${escape(outcome.line)}"><defs><radialGradient id="cosmic-sky"><stop stop-color="${c.sky==='amber'?'#50454c':c.sky==='blue'?'#2a5063':'#444364'}"/><stop offset="1" stop-color="#121d31"/></radialGradient><linearGradient id="river" x2="0" y2="1"><stop stop-color="#a2dcd6"/><stop offset="1" stop-color="#a2dcd6" stop-opacity="0"/></linearGradient></defs><rect width="1000" height="680" fill="url(#cosmic-sky)"/><g fill="#e9dcc1">${stars(80)}</g><circle cx="500" cy="280" r="211" fill="none" stroke="#9c9ac0" opacity=".17"/><circle cx="500" cy="280" r="235" fill="none" stroke="#9c9ac0" opacity=".08"/><ellipse cx="500" cy="390" rx="365" ry="100" fill="none" stroke="#bdc2c6" opacity=".09"/>
  ${outcome.connected?'<path d="M325 353Q495 300 650 352" fill="none" stroke="#9bac9a" stroke-width="15" stroke-dasharray="12 3"/>':''}
  ${outcome.water?'<path class="cosmic-river" d="M603 345Q510 325 405 350T350 560" stroke="url(#river)" fill="none" stroke-width="14"/>':'<path d="M667 350Q702 440 635 550" stroke="url(#river)" fill="none" stroke-width="6" opacity=".4"/>'}
  ${island(together?356:270,330+yshift,1.05,'village',outcome)}${island(together?655:755,360+yshift,.85,'forest',outcome)}
  <g transform="translate(510 160)" fill="none" stroke="#d2c5e7"><path d="M0-37L14-10 39 0 14 11 0 38-12 11-38 0-12-10Z" stroke-width="1.5"/><circle r="58" stroke-dasharray="2 9" opacity=".4"/></g><text x="500" y="617" text-anchor="middle" fill="#acb7c4" font-size="14" letter-spacing="6">${s.observed?`第 ${s.epoch} 刻 · 世界正在适应你`:'THE WORLD IS STILL UNWRITTEN'}</text></svg><div class="world-stats"><span><i></i>${outcome.connected?'浮岛已连通':'浮岛分离'}</span><span>${outcome.water?'村庄有水':'村庄缺水'}</span><span>${outcome.safe?'屋舍完好':'居民避难'}</span></div></div>`;
}
