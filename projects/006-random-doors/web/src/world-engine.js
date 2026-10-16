// Randomness selects a compatible world at the threshold. Actions use stable rules.
export const WORLD_STORAGE = 'random-doors:identity-worlds:v1';
export const WORLD_IDS = ['museum', 'train', 'genesis'];
export const WORLDS = {
  museum: { title: '无人的第七展厅', label: '隐身 · 潜入任务', cue: '门后有脚步声，却没有你的倒影。', roles: ['hush', 'shade'], color: '#9cd8d1' },
  train: { title: '开往凌晨的列车', label: '附身 · 身份视角', cue: '一张车票，从门缝里滑了出来。', roles: ['cat', 'conductor', 'passenger'], color: '#e5b77b' },
  genesis: { title: '尚未写完的宇宙', label: '创世 · 改写规则', cue: '有人在另一边，等你决定第一条法则。', roles: ['god', 'weaver', 'keeper'], color: '#b6b3f2' },
};
export const ROLES = {
  hush: { name: '无声借影者', ability: '静步', detail: '身体不可见。启用静步后，下一步不会发出声音。', limit: '普通行走仍有脚步声；水洼会暴露轮廓。静步可用两次。', symbol: '◌' },
  shade: { name: '影隙行者', ability: '影跃', detail: '身体不可见。启用影跃后，下一步跨过两格，中途不留下脚步。', limit: '落点的水洼仍会显形。影跃可用两次；中间有展柜时无法穿越。', symbol: '◇' },
  cat: { name: '一只夜行的猫', ability: '嗅闻行李', detail: '可以钻进行李车，闻出失物主人的气味。', limit: '你读不懂名册。先去行李车，再找带有相同气味的人。', symbol: '♧' },
  conductor: { name: '新来的列车长', ability: '查阅名册', detail: '你的钥匙能打开驾驶室，查看失物登记。', limit: '乘客只认车票。先到驾驶室查册，再决定把失物还给谁。', symbol: '⌘' },
  passenger: { name: '失忆的旅客', ability: '听见往事', detail: '休息车的一面旧镜子，可以让你听见失物留下的记忆。', limit: '你没有钥匙，也听不懂动物；只能从记忆和乘客的话里辨认。', symbol: '◎' },
  god: { name: '初生的创世主', ability: '改写一条法则', detail: '你可以选择重力、时间或生命，观察它们如何改变世界。', limit: '同一时刻只保留一条改动。改写另一条，会撤回上一条。', symbol: '✶' },
  weaver: { name: '重力编织者', ability: '编织重力', detail: '让重力变轻、加重或倒转，重新连接浮岛。', limit: '你只能修改重力。时间与生命不受你的直接控制。', symbol: '⋈' },
  keeper: { name: '时间保管者', ability: '拨动时间', detail: '让时间流动、停住或倒流，观察河流的方向。', limit: '你只能修改时间。重力与生命仍遵循原来的法则。', symbol: '◷' },
};
export const PEOPLE = [
  { id: 'keeper', name: '灯塔看守人', emblem: '灯塔', scent: '海盐', memory: '海浪声和一束旋转的光', color: '#a4d8d5' },
  { id: 'child', name: '抱着鲸鱼的孩子', emblem: '鲸鱼', scent: '橘子糖', memory: '剥开的橘子与蓝色玩偶', color: '#dfb48b' },
  { id: 'gardener', name: '夜班园丁', emblem: '叶片', scent: '湿土', memory: '温室里刚浇过水的叶子', color: '#a5c794' },
];
export const LAWS = {
  gravity: { name: '重力', values: [{ id: 'light', label: '轻盈', hint: '浮岛靠近，石桥重新连通' }, { id: 'heavy', label: '沉重', hint: '岛屿下沉，桥面逐渐断开' }, { id: 'reverse', label: '倒转', hint: '树木向上漂离，居民失去落脚处' }] },
  time: { name: '时间', values: [{ id: 'flow', label: '流动', hint: '河流顺坡流向远海' }, { id: 'pause', label: '停住', hint: '河流与居民一起静止' }, { id: 'reverse', label: '倒流', hint: '水流逆坡，回到高处的村庄' }] },
  life: { name: '生命', values: [{ id: 'sleep', label: '休眠', hint: '种子保持沉睡' }, { id: 'symbiosis', label: '共生', hint: '树根传水，村庄与森林一起生长' }, { id: 'wild', label: '蔓生', hint: '植物吞没屋舍，居民暂时撤离' }] },
};
const MUSEUM_TASKS = [
  { item: '失窃的月亮', phrase: '取回失窃的月亮', action: '取回月亮', verb: '取回', ending: '你把月亮带回了夜空。展台上留下一个圆形的空缺。' },
  { item: '会做梦的钟', phrase: '唤醒会做梦的钟', action: '唤醒时钟', verb: '唤醒', ending: '时钟重新开始做梦。整个展厅第一次有了滴答声。' },
  { item: '无名者的画像', phrase: '给无名者的画像归还名字', action: '归还名字', verb: '为它归还名字', ending: '画里的人终于有了名字。你离开时，他向空无一人的门口点了点头。' },
];
const OBJECTS = ['蓝色信封', '铜制风铃', '没有日期的车票'];
const GOALS = {
  gravity: { text: '让断开的浮岛重新连通，让居民走过石桥。', success: 'light', result: '石桥接上了。居民第一次走到了另一座岛。' },
  time: { text: '让河水逆坡，重新抵达山上的干涸村庄。', success: 'reverse', result: '河水回到了山上，村庄的水车重新转动。' },
  life: { text: '让森林送水给村庄，同时保住居民的屋舍。', success: 'symbiosis', result: '树根替村庄送来了水，人们在树荫下重新点灯。' },
};
export const MUSEUM_BLOCKS = [[2,1],[2,2],[5,3],[5,4],[4,2]];
const PATROL = [[3,1],[4,1],[5,1],[6,1],[6,2],[6,3],[6,2],[6,1],[5,1],[4,1]];
const EXIT = [0,5];
const positive = n => Math.abs(Math.trunc(n)) >>> 0;
export function seeded(seed) { let n=positive(seed); return () => { n=(n+0x6d2b79f5)>>>0; let t=Math.imul(n^(n>>>15),1|n); t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296; }; }
function shuffled(items,rng) { const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out; }
function choose(items,rng) { return items[Math.floor(rng()*items.length)]; }
export function configFor(v) {
  const rng=seeded(v.seed);
  if(v.world==='museum')return { task:MUSEUM_TASKS[Math.floor(rng()*3)], target:choose([[7,1],[7,4],[4,0]],rng), weather:choose(['rain','dust'],rng), wet:choose([[[3,4],[4,4],[7,2]],[[1,3],[6,4],[7,3]]],rng), offset:Math.floor(rng()*PATROL.length) };
  if(v.world==='train')return { item:choose(OBJECTS,rng), owner:Math.floor(rng()*PEOPLE.length), order:shuffled([0,1,2],rng), sky:choose(['meteor','aurora','moon'],rng) };
  const axis=v.role==='keeper'?'time':v.role==='weaver'?'gravity':choose(['gravity','time','life'],rng);
  return { axis, goal:GOALS[axis], sky:choose(['violet','blue','amber'],rng) };
}
export function initialState(world) {
  if(world==='museum')return {x:0,y:5,turn:0,alert:0,charges:2,armed:false,obtained:false,done:false,bumps:0,log:['你看不见自己的身体。点击相邻地砖，或用方向键移动。']};
  if(world==='train')return {car:1,clue:false,claimed:false,talked:[],selected:null,done:false,log:['列车不会催你。可以先问问眼前的人，再使用你的身份能力。']};
  return {axis:null,value:null,epoch:0,observed:false,done:false,log:['世界正等待第一条改动。选择法则后，推进一刻，看看居民如何回应。']};
}
export function createVisit(world,seed,role,uid='visit') {
  if(!WORLD_IDS.includes(world)||!WORLDS[world].roles.includes(role))throw new Error('Incompatible world and identity');
  return {uid,world,seed:positive(seed),role,state:initialState(world)};
}
const tell = (s,line) => {s.log=[line,...s.log].slice(0,6);};
const same = (a,b) => a[0]===b[0]&&a[1]===b[1];
const blocked = (x,y) => x<0||x>8||y<0||y>5||MUSEUM_BLOCKS.some(p=>same(p,[x,y]));
export function guardAt(v,turn=v.state.turn) {const c=configFor(v);return PATROL[(turn+c.offset)%PATROL.length];}
export function availableAxes(v) {return v.role==='keeper'?['time']:v.role==='weaver'?['gravity']:['gravity','time','life'];}
export function genesisOutcome(v) {
  const {axis,value}=v.state;
  if(!axis)return {connected:false,water:false,forest:false,safe:true,population:12,line:'浮岛分离，村庄缺水，森林仍在沉睡。'};
  const key=`${axis}:${value}`;
  const outcomes={
    'gravity:light':{connected:true,water:false,forest:false,safe:true,population:12,line:'浮岛慢慢靠近。居民跨过了重新相接的石桥。'},
    'gravity:heavy':{connected:false,water:false,forest:false,safe:true,population:12,line:'岛屿下沉。居民守住了房屋，却无法跨过断桥。'},
    'gravity:reverse':{connected:false,water:false,forest:true,safe:false,population:6,line:'树木向天穹漂去。六位居民移往避难岛。'},
    'time:flow':{connected:false,water:false,forest:false,safe:true,population:12,line:'水继续向远海流去。山上的村庄仍然干涸。'},
    'time:pause':{connected:false,water:false,forest:false,safe:true,population:12,line:'河流停在半空。居民安然无恙，也无法继续生活。'},
    'time:reverse':{connected:false,water:true,forest:false,safe:true,population:12,line:'水逆坡流回山上。水车转动，窗内重新亮起灯。'},
    'life:sleep':{connected:false,water:false,forest:false,safe:true,population:12,line:'种子继续沉睡。村庄和森林都没有改变。'},
    'life:symbiosis':{connected:true,water:true,forest:true,safe:true,population:12,line:'树根沿石缝送水，绕过房屋。村庄与森林一起苏醒。'},
    'life:wild':{connected:true,water:true,forest:true,safe:false,population:4,line:'森林迅速蔓生，覆盖八间屋舍。居民暂时撤离。'},
  };
  return outcomes[key]??outcomes['life:sleep'];
}
export function missionComplete(v) {
  const c=configFor(v),s=v.state;
  if(v.world==='genesis')return s.observed&&s.axis===c.axis&&s.value===c.goal.success;
  return s.done;
}
export function reduceVisit(visit,action) {
  const v=structuredClone(visit),s=v.state,c=configFor(v);
  if(s.done)return v;
  if(v.world==='museum') {
    if(action.type==='ability'){
      if(!s.charges){tell(s,'能力已经用完。仍可绕开守卫，或原地等待。');return v;}
      s.armed=!s.armed;tell(s,s.armed?`${ROLES[v.role].ability}已准备好，下一次移动生效。`:'你收起了能力。');return v;
    }
    if(action.type==='interact'){
      if(s.obtained&&same([s.x,s.y],EXIT)){s.done=true;tell(s,c.task.ending);return v;}
      if(Math.abs(s.x-c.target[0])+Math.abs(s.y-c.target[1])<=1&&!s.obtained){s.obtained=true;tell(s,`已完成：${c.task.phrase}。回到左下角的门，带着这次改变离开。`);return v;}
      tell(s,s.obtained?'回到左下角的门，再离开展厅。':'先靠近发光的目标展台，相邻一格即可触碰。');return v;
    }
    if(!['move','wait'].includes(action.type))return v;
    let noise=0,used=false;
    if(action.type==='move'){
      const dx=Number(action.dx),dy=Number(action.dy);
      if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)+Math.abs(dy)!==1)return v;
      const distance=s.armed&&v.role==='shade'?2:1;
      for(let i=1;i<=distance;i++)if(blocked(s.x+dx*i,s.y+dy*i)){tell(s,'前方是展柜或墙。换个方向，能力不会被消耗。');return v;}
      s.x+=dx*distance;s.y+=dy*distance;used=s.armed;
      noise=used?0:1;if(used){s.charges--;s.armed=false;}
      if(c.weather==='rain'&&c.wet.some(p=>same(p,[s.x,s.y])))noise=3;
    }
    s.turn++;
    const [gx,gy]=guardAt(v),dist=Math.abs(s.x-gx)+Math.abs(s.y-gy);
    if(noise&&dist<=(noise===3?3:1)){
      s.alert=Math.min(3,s.alert+1);
      tell(s,noise===3?'水洼勾出了你的轮廓。守卫抬起了灯。':'脚步声离守卫太近。守卫正在寻找声音的来源。');
    }else{
      s.alert=Math.max(0,s.alert-1);tell(s,action.type==='wait'?'你屏住呼吸。守卫按既定路线继续巡逻。':used?`${ROLES[v.role].ability}生效。你安静地穿过了这段距离。`:'你移动了一步。留意守卫下一步的位置。');
    }
    if(s.alert===3){s.x=EXIT[0];s.y=EXIT[1];s.alert=0;s.bumps++;tell(s,'守卫的灯追上了你的轮廓。门把你接回入口；已完成的触碰和剩余能力仍然保留。');}
    return v;
  }
  if(v.world==='train'){
    if(action.type==='car'&&Number.isInteger(action.car)&&action.car>=0&&action.car<=3){s.car=action.car;tell(s,`你到了${['驾驶室','休息车','观景车','行李车'][s.car]}。`);return v;}
    if(action.type==='inspect'){
      const needed={cat:3,conductor:0,passenger:1}[v.role];
      if(s.car!==needed){tell(s,`你的身份线索在${['驾驶室','休息车','观景车','行李车'][needed]}。可以点击车厢切换。`);return v;}
      s.clue=true;s.claimed=true;
      const p=PEOPLE[c.owner];
      tell(s,v.role==='cat'?`失物上有${p.scent}的气味。你的鼻子记住了它。`:v.role==='conductor'?`登记册写着：“${c.item}属于佩戴${p.emblem}徽记的乘客。”`: `旧镜子里响起${p.memory}。你想起了这件失物的主人。`);return v;
    }
    if(action.type==='talk'&&PEOPLE.some(p=>p.id===action.person)){
      const index=PEOPLE.findIndex(p=>p.id===action.person),car=c.order.indexOf(index)+1;
      if(s.car!==car){tell(s,'先走到这位乘客所在的车厢。');return v;}
      if(!s.talked.includes(action.person))s.talked.push(action.person);s.selected=action.person;
      const p=PEOPLE[index];tell(s,v.role==='cat'?`${p.name}弯下身摸摸你。你闻到了${p.scent}的味道。`:`${p.name}：“我带着${p.emblem}徽记，正赶往下一站。”`);return v;
    }
    if(action.type==='deliver'){
      if(!s.clue){tell(s,'先用身份能力找到失物与线索，再决定交给谁。');return v;}
      if(!s.selected||!s.talked.includes(s.selected)||c.order.indexOf(PEOPLE.findIndex(p=>p.id===s.selected))+1!==s.car){tell(s,'先与当前车厢的乘客交谈。');return v;}
      if(s.selected!==PEOPLE[c.owner].id){tell(s,`${PEOPLE.find(p=>p.id===s.selected).name}摇摇头：“这不是我的。还有人比我更需要它。”失物仍在你这里。`);return v;}
      s.done=true;tell(s,`${PEOPLE[c.owner].name}接过${c.item}。${v.role==='cat'?'“原来是你找到了它。”他为你留了一盏窗边的灯。':'“谢谢你记得它属于谁。”下一站的灯亮了。'}`);return v;
    }
    return v;
  }
  if(action.type==='law'&&availableAxes(v).includes(action.axis)&&LAWS[action.axis].values.some(x=>x.id===action.value)){
    s.axis=action.axis;s.value=action.value;s.observed=false;
    tell(s,`你改写了${LAWS[s.axis].name}：${LAWS[s.axis].values.find(x=>x.id===s.value).label}。推进一刻，让世界回应。`);return v;
  }
  if(action.type==='advance'){
    if(!s.axis){tell(s,'先选择一条法则。');return v;}
    s.epoch++;s.observed=true;tell(s,genesisOutcome(v).line);return v;
  }
  if(action.type==='seal'){
    if(!s.observed){tell(s,'先推进一刻，观察这条法则带来的后果。');return v;}
    s.done=true;tell(s,missionComplete(v)?c.goal.result:'你把这次法则留给了世界。愿望尚未达成，居民仍在适应你的选择。');return v;
  }
  return v;
}
export function memoryOf(v) {
  if(v.world==='museum')return v.state.done?configFor(v).task.ending:`你曾隐身走过 ${v.state.turn} 步，${v.state.obtained?'已改变展台，尚未离开':'还在寻找目标展台'}。`;
  if(v.world==='train')return v.state.done?`以${ROLES[v.role].name}的身份，把${configFor(v).item}交还给${PEOPLE[configFor(v).owner].name}。`:`你是${ROLES[v.role].name}，${v.state.clue?'已发现失物主人的线索':'仍在寻找属于这个身份的线索'}。`;
  return v.state.axis?`${LAWS[v.state.axis].name}被改为“${LAWS[v.state.axis].values.find(x=>x.id===v.state.value)?.label}”。${v.state.observed?genesisOutcome(v).line:'世界尚未回应。'}`:'你见过一个等待法则的宇宙。';
}
function validVisit(raw){
  if(!raw||!WORLD_IDS.includes(raw.world)||!WORLDS[raw.world].roles.includes(raw.role)||!Number.isInteger(raw.seed)||typeof raw.uid!=='string')return null;
  const v=createVisit(raw.world,raw.seed,raw.role,raw.uid.slice(0,70)),s=raw.state;
  if(!s||typeof s!=='object')return v;
  const num=(key,min,max)=>Number.isInteger(s[key])&&s[key]>=min&&s[key]<=max;
  if(raw.world==='museum'){
    if(num('x',0,8)&&num('y',0,5)&&!blocked(s.x,s.y)){v.state.x=s.x;v.state.y=s.y;}
    for(const [key,min,max]of[['turn',0,100000],['alert',0,2],['charges',0,2],['bumps',0,10000]])if(num(key,min,max))v.state[key]=s[key];
    for(const key of ['armed','obtained','done'])v.state[key]=s[key]===true;
  }else if(raw.world==='train'){
    if(num('car',0,3))v.state.car=s.car;
    v.state.talked=Array.isArray(s.talked)?[...new Set(s.talked.filter(id=>PEOPLE.some(p=>p.id===id)))]:[];
    v.state.selected=PEOPLE.some(p=>p.id===s.selected)?s.selected:null;
    for(const key of ['clue','claimed','done'])v.state[key]=s[key]===true;
  }else{
    if(availableAxes(v).includes(s.axis)&&LAWS[s.axis].values.some(x=>x.id===s.value)){v.state.axis=s.axis;v.state.value=s.value;}
    if(num('epoch',0,100000))v.state.epoch=s.epoch;
    v.state.observed=!!v.state.axis&&s.observed===true;v.state.done=v.state.observed&&s.done===true;
  }
  if(Array.isArray(s.log))v.state.log=s.log.filter(x=>typeof x==='string').slice(0,6).map(x=>x.slice(0,500));
  return v;
}
export function restoreWorlds(raw){
  try{
    const d=typeof raw==='string'?JSON.parse(raw):raw;if(d?.version!==1||!Array.isArray(d.visits))return null;
    const visits=d.visits.slice(-40).map(validVisit).filter(Boolean);
    const pending=validVisit(d.pending);const current=visits.some(v=>v.uid===d.current)?d.current:null;
    return {version:1,visits,pending,current,phase:d.phase==='inside'&&current?'inside':'door',bag:Array.isArray(d.bag)?[...new Set(d.bag.filter(w=>WORLD_IDS.includes(w)))]:[],lastWorld:WORLD_IDS.includes(d.lastWorld)?d.lastWorld:null,roles:{},serial:Number.isInteger(d.serial)?Math.max(d.serial,visits.length):visits.length};
  }catch{return null;}
}
export class WorldJourney {
  constructor(saved=null,rng=Math.random){this.rng=rng;this.data=restoreWorlds(saved)??{version:1,visits:[],pending:null,current:null,phase:'door',bag:[],lastWorld:null,roles:{},serial:0};if(!this.data.pending&&this.data.phase==='door')this.prepare();}
  get current(){return this.data.visits.find(v=>v.uid===this.data.current)??null;}
  prepare(world=null,{sameSeed=null}={}){
    const d=this.data;
    if(!WORLD_IDS.includes(world)){
      if(!d.bag.length){d.bag=shuffled(WORLD_IDS,this.rng);if(d.bag.at(-1)===d.lastWorld)[d.bag[0],d.bag[d.bag.length-1]]=[d.bag.at(-1),d.bag[0]];}
      if(d.bag.at(-1)===d.lastWorld){
        if(d.bag.length===1)d.bag=shuffled(WORLD_IDS.filter(id=>id!==d.lastWorld),this.rng);
        else [d.bag[0],d.bag[d.bag.length-1]]=[d.bag.at(-1),d.bag[0]];
      }
      world=d.bag.pop();
    }
    let roles=d.roles[world];const previous=[...d.visits].reverse().find(v=>v.world===world)?.role;
    if(!roles?.length)roles=shuffled(WORLDS[world].roles,this.rng);
    if(roles.at(-1)===previous&&roles.length>1)[roles[0],roles[roles.length-1]]=[roles.at(-1),roles[0]];
    // A repeated world must actually offer a different identity, even across restore.
    if(roles.at(-1)===previous&&roles.length===1)roles=shuffled(WORLDS[world].roles.filter(r=>r!==previous),this.rng);
    const role=roles.pop();d.roles[world]=roles;d.serial++;
    d.pending=createVisit(world,sameSeed??Math.floor(this.rng()*0xffffffff),role,`world-${d.serial}-${Math.floor(this.rng()*0xffffff).toString(36)}`);d.phase='door';return d.pending;
  }
  enter(){const d=this.data;if(!d.pending)return this.current;d.visits.push(d.pending);d.visits=d.visits.slice(-40);d.current=d.pending.uid;d.lastWorld=d.pending.world;d.pending=null;d.phase='inside';return this.current;}
  act(action){const v=this.current;if(!v||this.data.phase!=='inside')return;const next=reduceVisit(v,action);this.data.visits[this.data.visits.findIndex(x=>x.uid===v.uid)]=next;}
  revisit(uid){if(this.data.visits.some(v=>v.uid===uid)){this.data.current=uid;this.data.phase='inside';return true;}return false;}
  repeatIdentity(){const v=this.current;if(!v)return;this.prepare(v.world,{sameSeed:v.seed});return this.enter();}
  serialize(){return JSON.stringify(this.data);}
}
