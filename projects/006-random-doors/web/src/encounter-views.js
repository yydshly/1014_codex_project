import { traceLight, directionName } from './encounters.js';
import { variation, postChoices, bellChoices } from './variations.js';
export { illustration, ringPoint } from './scene-art.js';

export const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const button = (action, label, value = '', extra = '') => `<button class="encounter-action" data-action="${action}" data-value="${value}" ${extra}>${label}</button>`;
const quote = text => `<p class="spoken">${text}</p>`;
const after = text => `<p class="afterword">${text}</p>`;

export function interaction(visit) {
  const s = visit.state, profile=variation(visit);
  if (visit.id === 'seaside') return `${quote(s.eventSeen ? profile.eventText : s.catching ? '雨落在掌心里，又轻轻散开。' : '你可以坐下，也可以接一会儿檐水。远处的海会自己发生一点变化。')}
    <div class="action-row">${button('sit',s.seated?'站起来看看':'坐一会儿','',`aria-pressed="${s.seated}"`)}${button('catch',s.catching?'收回手':'伸手接雨','',`aria-pressed="${s.catching}"`)}</div>${after(s.eventSeen ? `这次，你看见了${profile.eventName}。想继续坐着也可以。` : '如果愿意，停留十几秒。小变化会自然到来。')}`;
  if (visit.id === 'rooftop') return `${quote(s.eventSeen ? profile.eventText : s.touched ? '你碰了一下风铃。声音散开以后，天台又安静下来。' : '没人规定空白的纸签上，一定要写点什么。')}
    ${!s.hung ? `<form id="note-form"><label for="paper-note">留一句给路过的人，也可以空着</label><input id="paper-note" name="note" maxlength="24" autocomplete="off" placeholder="例如：今天先到这里"><button class="encounter-action" type="submit">把纸签系上去</button></form>` : `<p class="kept-line">${s.note ? `你留下了「${escape(s.note)}」` : '你留下了一张空白纸签。'}</p>`}
    <div class="action-row">${button('chime','轻碰风铃')}${s.eventSeen&&profile.id==='plane'&&!s.eventRead?button('read-plane','打开落下的纸飞机'):''}</div>${s.eventRead?`<p class="kept-line">${profile.paper}</p>`:''}${after('离开后，纸签和你发现的事会留在这次遇见里。')}`;
  if (visit.id === 'postoffice') {
    const choices=postChoices(visit), person=`<p class="small-label person-line">${profile.name} / ${profile.person}</p>`;
    if (s.followup) return `${person}<p class="small-label">再次回来 · 柜台上多了一张卡片</p>${quote(choices[s.choice].later)}<p class="kept-line">你当时陪${profile.pronoun}写下：${choices[s.choice].line}</p>${after(`${profile.name}已经往前走了，那天的回应还在。`)}`;
    if (s.delivered) return `${person}${quote(profile.farewell)}<p class="kept-line">${choices[s.choice].line}</p>${after(`下次回到这次遇见，可以看看${profile.name}后来写了什么。`)}`;
    if (s.choice) return `${person}${quote(choices[s.choice].reply)}<p class="kept-line">${choices[s.choice].line}</p>${button('deliver',`替${profile.pronoun}投进邮袋`)}${after('也可以先离开。卡片会留在已经写好的这一句。')}`;
    return `${person}${quote(profile.opening)}<div class="choices">${Object.entries(choices).map(([key,c])=>button('post-choice',c.label,key)).join('')}</div>${after('你可以回应，也可以先离开。这里没有标准答案。')}`;
  }
  if (visit.id === 'repair') {
    const choices=bellChoices(visit);
    if (s.followup) return `<p class="small-label">再次回来 · 店主讲起那只木鸟</p>${quote(choices[s.choice].later)}${button('replay-bell','再听一声')}${after('你当时选的声音，还在这段经历里。')}`;
    if (s.wound) return `${quote(s.choice==='old'?'木鸟张开翅膀。有一点沙哑的铃声，在店里慢慢响起来。':'木鸟张开翅膀。清亮的新铃，让店主也跟着轻轻哼了一声。')}${after(profile.ending)}`;
    if (s.choice) return `${quote(choices[s.choice].reply)}${button('wind','轻轻转动发条')}`;
    return `${quote(s.heard?profile.heard:profile.opening)}<div class="choices">${!s.heard?button('listen','先听听这只木鸟的来历'):''}${Object.entries(choices).map(([key,c])=>button('bell-choice',c.label,key)).join('')}</div>`;
  }
  if (visit.id === 'greenhouse') {
    const light=traceLight(s);
    const hint=s.hints===1 ? (light.hit<1?'顺着光看：先让 A 把光送到 B。':'光已经到达 B，接下来让它转向植物。') : s.hints>1 ? `把镜子 ${s.mirrors[0]===0?'A':'B'} 转动一次，看看光的去向。` : '';
    return `${quote(s.solved?'光终于落在叶片上。你让一朵花慢慢展开了。':'让光落到植物上。每次转镜，光都会马上改变方向。')}<div class="action-row">${button('mirror-a','转动镜子 A','',s.solved?'disabled':'')}${button('mirror-b','转动镜子 B','',s.solved?'disabled':'')}</div>${!s.solved?button('hint',s.hints?'再给一点提示':'给一点提示'):''}${hint&&!s.solved?`<p class="hint">${hint}</p>`:''}${after(s.solved?'花和接通的光路会留在手记里。':'可以点击画面里的镜子。没有步数限制，也可以随时离开。')}`;
  }
  return `${quote(s.solved?'三颗星连成了今夜的星图。窗外，正有一颗流星划过。':'亮星与空星重合时，那一圈就对齐了。点击星环，每次顺时针转四分之一圈。')}<div class="ring-controls">${['外','中','内'].map((name,i)=>button(`ring-${i}`,`<span>转动${name}环</span><small>${s.rings[i]===s.targets[i]?'亮星已归位':`亮星在${directionName(s.rings[i])} · 空星在${directionName(s.targets[i])}`}</small>`,'',s.solved?'disabled':'')).join('')}</div>${!s.solved?button('hint','给一点提示'):''}${s.hints&&!s.solved?`<p class="hint">${s.hints>1?`先看${['外','中','内'][s.rings.findIndex((v,i)=>v!==s.targets[i])]}环：继续顺时针转，直到亮星落进空星。`:'每个圆环只管自己的星。先对齐一圈，再看下一圈。'}</p>`:''}${after(s.solved?'星图保留着你的调整。可以继续看一会儿，也可以再开一扇门。':'亮星是实心的，目标是空心的。不靠颜色也能辨认。')}`;
}
