import './research.css';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages = [
  {image:'legacy-seaside.jpg',alt:'0.2 实时三维候车亭中接雨与船灯的实际截图',medium:'实时 3D / Three.js',title:'先让一次安静停留，可以被体验。',description:'从候车亭开始，完成三种天气、坐下、接雨和自然船灯。这个版本检验一个场景里的情绪与动作，保留了可运行的独立 3D 入口。',demo:'legacy',link:'试玩保留的 3D 候车亭 ↗'},
  {image:'loop-svg.jpg',alt:'0.3 连续开门原型中寄出明信片的实际截图',medium:'简化 SVG / 六个遭遇',title:'把重心放回每次开门的不同事情。',description:'安静、故事、挑战各两个遭遇，接入未知入口、连续随机和手记。此图为当时的实际页面；同类流程可在当前原型中继续体验。',demo:'current',link:'用当前原型体验连续开门 ↗'},
  {image:'variations-svg.jpg',alt:'0.4 邮局里遇见准备回家的厨师阿岚的实际截图',medium:'场景内内容池 / 稳定记录',title:'地点熟悉，遇见的人和心事仍然不同。',description:'邮局扩展为六组完整人物与心事、18 条回应及对应后续；自然事件和光路也有各自内容池。此图中的阿岚，和当前截图中的小满是不同遭遇。',demo:'current',link:'体验同一个邮局的新遇见 ↗'},
  {image:'current-postoffice.jpg',alt:'0.5 邮局中的小满、明信片与可操作回应的实际截图',medium:'原画 + 互动叠层',title:'让完整的偶遇，有足够好的承载。',description:'统一入口与六处环境，加入不同人物的肖像、接雨前景和图像手记。保留两层随机与回访规则；视觉更新本身不等于随机机制已经被验证。',demo:'current',link:'试玩当前原型 ↗'},
];
function selectStage(index) {
  const stage=stages[index]; if(!stage)return;
  document.querySelectorAll('[data-stage]').forEach(b=>{const selected=Number(b.dataset.stage)===index;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
  $('stage-panel').setAttribute('aria-labelledby',`stage-tab-${index}`);
  $('stage-image').src=`./research/${stage.image}`;$('stage-image').alt=stage.alt;
  $('stage-medium').textContent=stage.medium;$('stage-title').textContent=stage.title;$('stage-description').textContent=stage.description;
  $('stage-demo').dataset.demo=stage.demo;$('stage-demo').textContent=stage.link;
}

const routes = {
  quiet:{image:'./research/current-seaside.jpg',alt:'候车亭中伸手接雨、等待船灯的当前原型实际效果',places:'海边候车亭 / 风过的天台',kicker:'01 / 不必完成什么',title:'允许一个人，慢下来。',details:[
    ['随机在哪里','相容的天气与自然事件：雨中船灯、归鸟、云缝里的光；天台的风、纸飞机与对楼窗灯。'],
    ['进去后能做什么','坐下、伸手接雨、留下纸签、轻碰风铃，也可以只看和听。'],
    ['希望促成的情绪','分心 → 好奇 → 放松 → 余韵。这是设计预期，尚非测得的效果。'],
    ['什么值得再来','新的风景状态，或回到自己留下了一句话的地方。允许空手离开。']]},
  story:{image:'./research/current-postoffice.jpg',alt:'当前邮局中遇见小满，与他一起写明信片的实际效果',places:'打烊前的邮局 / 老街修补铺',kicker:'02 / 与一段生活交会',title:'让一句回应，有自己的后来。',details:[
    ['随机在哪里','抽取完整的处境：六位邮局来访者的不同心事，或修补铺的三种选铃理由。人物、草稿、回应与后续配套。'],
    ['进去后能做什么','倾听、回应一句话、帮助寄信，或挑一枚铃、转动木鸟发条。随时可以离开。'],
    ['希望促成的情绪','好奇 → 关心 → 参与 → 牵挂。这是设计预期，尚非测得的效果。'],
    ['什么值得再来','遇见另一段人生，或从手记回来，看到自己参与过的故事的对应回访卡片。']]},
  challenge:{image:'./art/greenhouse.webp',alt:'漂浮温室环境原画；互动光路与星环需进入原型体验',places:'漂浮温室 / 旧星图观测台 · 此图为环境原画',kicker:'03 / 看懂规则，也改变世界',title:'让理解，可以带去下一扇门。',details:[
    ['随机在哪里','温室有六条经过检查的可解光路；星环的目标和初始位置随种子变化。进入后规则与布局稳定。'],
    ['进去后能做什么','观察、转镜引导光线、转环对齐亮星，可以求助，也能保留未完成的进度。'],
    ['希望促成的情绪','好奇 → 困惑 → 理解 → 成就感。这是设计预期，尚非测得的效果。'],
    ['什么值得再来','运用刚学到的规则解决新的布局。熟悉的规则带来掌控感，变化的条件带来新问题。']]},
};
function selectRoute(key) {
  const route=routes[key];if(!route)return;
  document.querySelectorAll('[data-route]').forEach(b=>{const selected=b.dataset.route===key;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
  $('route-panel').setAttribute('aria-labelledby',`route-tab-${key}`);
  $('route-image').src=route.image;$('route-image').alt=route.alt;
  $('route-places').textContent=route.places;$('route-kicker').textContent=route.kicker;$('route-title').textContent=route.title;
  $('route-details').innerHTML=route.details.map(([term,definition])=>`<dt>${escape(term)}</dt><dd>${escape(definition)}</dd>`).join('');
}

const dialog=$('prototype-dialog');
const review=import.meta.env.DEV&&new URL(location.href).searchParams.get('review')==='1';
function openDemo(mode,opener) {
  $('source-video').pause();
  const legacy=mode==='legacy';
  const identity=mode.startsWith('worlds');
  const world=mode.split('-')[1];
  const href=identity?`./worlds.html?${world?`world=${world}&`:''}${review?'review=1':''}`:legacy?'./seaside.html':`./${review?'?review=1':''}`;
  $('prototype-title').textContent=identity?'随机世界与身份实验':legacy?'保留的 3D 海边候车亭':'连续随机开门';
  $('prototype-external').href=href;
  const iframe=document.createElement('iframe');iframe.title=identity?'可互动的随机世界与身份原型':legacy?'可互动的三维海边候车亭':'可互动的连续随机门原型';iframe.src=href;iframe.allow='fullscreen';
  $('prototype-frame-wrap').replaceChildren(iframe);
  dialog.showModal();$('close-prototype').focus();dialog.dataset.opener=opener.id||'';
}
function closeDemo(){dialog.close();}
$('close-prototype').addEventListener('click',closeDemo);
dialog.addEventListener('close',()=>{$('prototype-frame-wrap').replaceChildren();});
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDemo();});
document.addEventListener('click',event=>{
  const demo=event.target.closest('[data-demo]');if(demo){openDemo(demo.dataset.demo,demo);return;}
  const stage=event.target.closest('[data-stage]');if(stage){selectStage(Number(stage.dataset.stage));return;}
  const route=event.target.closest('[data-route]');if(route)selectRoute(route.dataset.route);
});
document.querySelectorAll('[role=tablist]').forEach(list=>list.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...list.querySelectorAll('[role=tab]')],current=tabs.indexOf(document.activeElement);if(current<0)return;
  event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[index].click();tabs[index].focus();
}));

const works=[
  {id:'002',name:'雨夜提灯小幽灵',type:'3D 互动场景',image:'ghost.jpg',description:'进入有雨滴碰撞与水面提灯的场景，拖动幽灵，观察世界怎样回应。',cue:'门缝里，有雨声和一点暖光。'},
  {id:'007',name:'月门水庭',type:'可旋转的三维空间',image:'courtyard.jpg',description:'进入由 Blender 场景接入网页的水庭，旋转、缩放、切换机位，观察空间结构。',cue:'门的另一边，水面映着一轮月门。'},
  {id:'008',name:'一次操作，成为一段演示',type:'视频 / 操作回放',image:'replay.png',description:'观看用真实页面操作生成的演示视频与交互回放，理解一件工具怎样工作。',cue:'有人把刚才做过的事，留成了一段可以回看的过程。'},
];
let bag=[],last=-1,round=0;const seen=[];
$('draw-work').addEventListener('click',()=>{
  if(!bag.length){bag=works.map((_,i)=>i);for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}if(bag.at(-1)===last)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];round++;}
  const index=bag.pop(),work=works[index];last=index;seen.push(work.name);
  $('portfolio-image').src=`./research/${work.image}`;$('portfolio-image').alt=`候选作品 ${work.id} ${work.name} 的实际运行截图`;
  $('portfolio-type').textContent=work.type;$('portfolio-title').textContent=work.name;$('portfolio-description').textContent=work.description;$('portfolio-cue').textContent=work.cue;
  $('portfolio-position').textContent=`第 ${round} 轮 / ${works.length-bag.length} · ${works.length}`;
  $('draw-work').innerHTML='再遇见一件候选作品 <span aria-hidden="true">↗</span>';
  $('portfolio-trail').textContent=`刚刚遇见：${seen.slice(-3).join(' → ')}。此处为候选抽取示意，尚未加载作品。`;
});
$('catalog-count').textContent=`/ ${works.length} 件`;
$('catalog-list').innerHTML=works.map(work=>`<article class="catalog-item"><span>${escape(work.id)}</span><div><h4>${escape(work.name)} · ${escape(work.type)}</h4><p>${escape(work.description)}</p></div></article>`).join('');

const sourceVideo=$('source-video');
$('toggle-source').addEventListener('click',()=>{
  if(sourceVideo.paused)sourceVideo.play().catch(()=>{$('video-error').hidden=false;});
  else sourceVideo.pause();
});
sourceVideo.addEventListener('play',()=>{$('toggle-source').textContent='暂停原作视频 Ⅱ';});
sourceVideo.addEventListener('pause',()=>{$('toggle-source').textContent='播放原作视频 ▷';});
sourceVideo.addEventListener('ended',()=>{$('toggle-source').textContent='重新播放原作视频 ▷';});
sourceVideo.addEventListener('error',()=>{$('video-error').hidden=false;});
sourceVideo.querySelector('source').addEventListener('error',()=>{$('video-error').hidden=false;});
sourceVideo.addEventListener('playing',()=>{$('video-error').hidden=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)sourceVideo.pause();});
const observer=new IntersectionObserver(entries=>{
  const visible=entries.filter(e=>e.isIntersecting);if(!visible.length)return;
  const id=visible.at(-1).target.id;
  document.querySelectorAll('.report-header nav a').forEach(a=>{if(a.hash===`#${id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
},{rootMargin:'-110px 0px -55% 0px',threshold:0});
document.querySelectorAll('main>section[id]').forEach(section=>observer.observe(section));
