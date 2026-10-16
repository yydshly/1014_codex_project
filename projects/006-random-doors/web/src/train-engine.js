export const TRAIN_PEOPLE = [
  {id:'keeper',name:'灯塔看守人',emblem:'灯塔',scent:'海盐',memory:'海浪声和一束旋转的光',color:'#a4d8d5'},
  {id:'child',name:'抱着鲸鱼的孩子',emblem:'鲸鱼',scent:'橘子糖',memory:'剥开的橘子与蓝色玩偶',color:'#dfb48b'},
  {id:'gardener',name:'夜班园丁',emblem:'叶片',scent:'湿土',memory:'温室里刚浇过水的叶子',color:'#a5c794'},
];
export const TRAIN_PROFILES = {
  cat:{name:'一只夜行的猫',short:'猫的眼睛',sense:'气味比文字清楚，座椅比你高。',intro:'你想开口，却只发出一声轻轻的咕噜。地板忽然离鼻尖这么近，人的鞋尖从你头顶经过。',awakening:'动一动爪子',body:'贴着地板，四足行走',start:'aisle',places:['aisle','underseat','luggage'],task:'顺着气味找到失物，叼回主人身边。',ending:'他低下身，把手停在你面前。你把鼻尖轻轻靠了上去。'},
  conductor:{name:'新来的列车长',short:'列车长的眼睛',sense:'钥匙在你手里，乘客在等你。',intro:'你站在摇晃的过道里。袖口多了两道金线，掌心握着一串钥匙。有人抬起头，叫你列车长。',awakening:'握紧钥匙',body:'站在过道里，制服袖口擦过扶手',start:'aisle',places:['aisle','cab'],task:'核对失物与车票，归还后确认车门，送大家继续前行。',ending:'车门锁闭，信号灯由红转绿。你轻鸣一声汽笛，列车带着这些人的心事继续向前。'},
  passenger:{name:'失忆的旅客',short:'旅客的眼睛',sense:'你有一个座位，和一段想不起的往事。',intro:'你坐在一扇湿漉漉的窗边。手里攥着一张车票，指尖残留着一枚旧挂坠的温度。你想不起自己要去见谁。',awakening:'抬头看向窗外',body:'坐在窗边，车票仍在掌心',start:'seat',places:['seat','window'],task:'从旧物与窗中倒影拼回记忆，把保管的东西还给对的人。',ending:'你终于想起，自己并不是没有来处。窗里的倒影向你笑了笑，下一站的名字忽然有了意义。'},
};
export function initialTrainState(role='cat'){
  return {interior:2,legacyComplete:false,car:1,place:TRAIN_PROFILES[role]?.start??'aisle',returnCar:1,awake:false,clue:false,claimed:false,talked:[],selected:null,done:false,sense:false,ticketed:[],cabUnlocked:false,doorsClosed:false,announced:false,delivered:false,memoryStep:0,lightOn:true,looked:false,log:[TRAIN_PROFILES[role]?.intro??'车轮声从脚下经过。']};
}
export function personCar(config,index){return config.order.indexOf(index)<2?1:2;}
export function peopleHere(v,c){
  if(!['aisle','seat','window'].includes(v.state.place))return [];
  return TRAIN_PEOPLE.filter((_,i)=>personCar(c,i)===v.state.car);
}
export function trainPlaceName(v){return ({aisle:v.state.car===1?'休息车 · 过道':'观景车 · 过道',underseat:'座椅下面',luggage:'行李夹层',cab:'驾驶室',seat:'靠窗的座位',window:'观景车 · 窗边'})[v.state.place];}
export function trainBody(v){
  if(v.role==='cat')return v.state.place==='aisle'?'贴着地板，前爪就在眼前':'伏在椅下，前爪贴近地板';
  if(v.role==='conductor')return v.state.place==='cab'?'站在驾驶台前，制服袖口与操纵杆在手边':'站在过道里，钥匙握在掌心';
  return v.state.place==='window'?'站在观景窗前，双手扶住栏杆':'坐在窗边，车票仍在掌心';
}
export function trainScene(v){
  if(v.role==='cat')return v.state.place==='aisle'?'cat-aisle':v.state.claimed||v.state.delivered?'cat-nook-empty':'cat-nook';
  if(v.role==='conductor')return v.state.place==='cab'?'conductor-cab':'conductor-aisle';
  return v.state.place==='window'?'passenger-window':'passenger-seat';
}
function tell(s,line){s.log=[line,...s.log].slice(0,6);}
function go(v,place,car,line){v.state.place=place;v.state.car=car;v.state.selected=null;tell(v.state,line);}
export function trainRoutes(v){
  const s=v.state;
  if(!s.awake||s.done)return [];
  if(v.role==='cat'){
    if(s.place==='luggage')return [{id:'back',label:'沿窄缝爬回座椅下',place:'underseat',car:s.returnCar}];
    if(s.place==='underseat')return [{id:'crawl',label:'钻进行李夹层',place:'luggage',car:3},{id:'out',label:'探出头，回到过道',place:'aisle',car:s.car}];
    return [{id:'duck',label:'伏低身子，钻进座椅下',place:'underseat',car:s.car},{id:'walk',label:s.car===1?'从门缝溜进观景车':'沿过道溜回休息车',place:'aisle',car:s.car===1?2:1}];
  }
  if(v.role==='conductor'){
    if(s.place==='cab')return [{id:'out',label:'转身，回到乘客身边',place:'aisle',car:1}];
    return [...(s.car===1?[{id:'cab',label:s.cabUnlocked?'推开值班门':'用钥匙打开驾驶室',place:'cab',car:0}]:[]),{id:'walk',label:s.car===1?'走向观景车巡查':'回休息车巡查',place:'aisle',car:s.car===1?2:1}];
  }
  return [{id:'walk',label:s.place==='seat'?'离开座位，走到观景窗边':'回到自己的靠窗座位',place:s.place==='seat'?'window':'seat',car:s.place==='seat'?2:1}];
}
export function trainClue(v,c){
  if(!v.state.clue)return null;
  const p=TRAIN_PEOPLE[c.owner];
  return v.role==='cat'?`你记住了${p.scent}的气味。` : v.role==='conductor'?`登记册：主人佩戴${p.emblem}徽记。`:`记忆里有${p.memory}。`;
}
export function trainActions(v,c){
  const s=v.state;
  if(!s.awake||s.done)return [];
  const actions=[];
  if(v.role==='cat'){
    actions.push({id:'sniff',label:s.place==='luggage'?'凑近箱子，嗅一嗅':'闭上眼，闻一闻',kind:'sense'});
    if(s.place==='luggage'&&!s.claimed)actions.push({id:'take',label:'用爪子勾出失物，轻轻叼住',kind:'object'});
  }else if(v.role==='conductor'){
    if(s.place==='cab'){
      actions.push({id:'inspect',label:'翻开值班台上的失物登记',kind:'sense'});
      if(!s.claimed&&!s.delivered)actions.push({id:'take',label:`拿起值班台上的${c.item}`,kind:'object'});
      actions.push({id:'announce',label:'按住话筒，广播寻物',kind:'detail'});
      if(s.delivered){actions.push({id:'doors',label:s.doorsClosed?'重新打开车门':'拨动手柄，确认车门锁闭',kind:'object'});actions.push({id:'depart',label:'确认信号，轻鸣汽笛发车',kind:'primary'});}
    }else actions.push({id:'light',label:s.lightOn?'熄灭近处的阅读灯':'替乘客打开阅读灯',kind:'detail'});
  }else{
    actions.push({id:'remember',label:s.place==='seat'?'触碰桌上的旧挂坠':'看向玻璃里的自己',kind:'sense'});
    if(s.place==='seat'&&!s.claimed&&!s.delivered)actions.push({id:'take',label:'打开座位旁的旧包',kind:'object'});
  }
  if(v.role==='cat'&&s.place==='aisle')actions.push({id:'blocked',label:'抬头看看紧闭的员工门',kind:'detail',target:'cab'});
  if(v.role==='passenger'&&s.place==='window')actions.push({id:'blocked',label:'试着推开员工门',kind:'detail',target:'cab'});
  return actions;
}
export function reduceTrain(v,a,c){
  const s=v.state,p=TRAIN_PROFILES[v.role];
  if(s.done)return v;
  if(a.type==='awake'){s.awake=true;tell(s,p.sense);return v;}
  if(!s.awake)return v;
  if(a.type==='travel'){
    const route=trainRoutes(v).find(r=>r.id===a.route);
    if(!route){tell(s,v.role==='cat'?'门把手远在头顶。你能走的是座椅下那条窄路。':v.role==='passenger'?'这扇门需要员工钥匙。你摸了摸口袋，只有车票。':'你的肩膀进不去座椅下那条窄缝。');return v;}
    if(route.id==='cab')s.cabUnlocked=true;
    if(route.id==='crawl')s.returnCar=s.car;
    go(v,route.place,route.car,v.role==='cat'?(route.place==='luggage'?'胡须擦过箱子的边角。人的脚步留在另一边，这里只容得下你。':route.place==='underseat'?'你收起爪子伏低，椅脚像一片小小的森林。':'你从低处探出头。鞋尖与衣角重新出现在眼前。'):v.role==='conductor'?(route.place==='cab'?'钥匙转过半圈。门后的仪表与整条铁轨，都在等你。':'你把钥匙收回掌心。乘客看向制服上的徽章。'):route.place==='window'?'你扶着椅背站起，走到观景窗前。玻璃里浮起一张既熟悉又陌生的脸。':'你重新坐下。旧挂坠与车票还在等你。');return v;
  }
  // Old generic car shortcuts cannot bypass role-specific physical routes.
  if(a.type==='car'){
    const route=trainRoutes(v).find(r=>r.car===a.car);
    if(route)return reduceTrain(v,{type:'travel',route:route.id},c);
    tell(s,'这里没有直达的路。看看眼前可以穿过的门或缝隙。');return v;
  }
  if(a.type==='blocked'){
    tell(s,v.role==='cat'?'你伸长身子，爪尖仍碰不到门把手。座椅下面传来一点熟悉的气味。':v.role==='passenger'?'黄铜门把纹丝不动。里面传来钥匙轻响，你只是这趟列车的一位旅客。':'你俯下身，肩膀被椅脚挡住。这里需要一副更小的身体。');return v;
  }
  if(a.type==='sniff'&&v.role==='cat'){
    s.sense=true;
    if(s.place==='luggage'){s.clue=true;tell(s,`${c.item}上有${TRAIN_PEOPLE[c.owner].scent}的气味。你的鼻子比任何名册都可靠。`);}
    else tell(s,'铁、旧皮革、人的雨衣……有一缕不同的气味，绕过椅脚，通向行李夹层。');return v;
  }
  if(a.type==='inspect'&&v.role==='conductor'){
    if(s.place!=='cab'){tell(s,'登记册在上锁的驾驶室里。钥匙就在你手中。');return v;}
    s.clue=true;tell(s,`你压住晃动的纸页。登记写着：“${c.item}，主人佩戴${TRAIN_PEOPLE[c.owner].emblem}徽记。”回到车厢，核对那个人的车票。`);return v;
  }
  if(a.type==='remember'&&v.role==='passenger'){
    if(s.place==='seat'){s.memoryStep=Math.max(1,s.memoryStep);tell(s,`挂坠贴住指腹。一小段往事浮上来：有人把${c.item}交给你，请你在下一站前替他保管。去窗边，也许能想起那个人。`);}
    else if(s.memoryStep<1)tell(s,'玻璃里只有你的轮廓。你觉得，座位上那枚旧挂坠也许能唤回什么。');
    else{s.memoryStep=2;s.clue=true;tell(s,`倒影与窗外的光重叠。你终于想起${TRAIN_PEOPLE[c.owner].memory}，和那个人把东西交给你时的眼神。`);}return v;
  }
  if(a.type==='take'){
    const reachable=v.role==='cat'?s.place==='luggage':v.role==='conductor'?s.place==='cab':s.place==='seat';
    if(!reachable){tell(s,'东西不在伸手可及的地方。先走到它旁边。');return v;}
    if(v.role==='cat'&&!s.clue){tell(s,'先凑近闻闻。你要记住它属于谁。');return v;}
    s.claimed=true;tell(s,v.role==='cat'?`爪尖勾住${c.item}，你轻轻叼起它。接下来只能用鼻尖与爪子告诉那个人。`:v.role==='conductor'?`你收好${c.item}。乘客把东西交给列车，你要亲手交回。`:`旧包里果然有${c.item}。原来你一直替别人守着一个约定。`);return v;
  }
  if(a.type==='announce'&&v.role==='conductor'&&s.place==='cab'){s.announced=true;tell(s,'“有乘客遗失了东西，请留在座位上，我们会前来核对。”你的声音第一次从整列车的扬声器里响起。');return v;}
  if(a.type==='light'&&v.role==='conductor'&&s.place==='aisle'){s.lightOn=!s.lightOn;tell(s,s.lightOn?'你替这排乘客打开了阅读灯。有人向你轻轻点头。':'阅读灯暗下来。窗外的夜色更清楚了，乘客的声音也低了一点。');return v;}
  if(a.type==='talk'||a.type==='ticket'){
    const person=peopleHere(v,c).find(person=>person.id===a.person);
    if(!person){tell(s,'那个人不在你眼前。先沿车厢走过去。');return v;}
    s.selected=person.id;if(!s.talked.includes(person.id))s.talked.push(person.id);
    if(v.role==='cat')tell(s,`${person.name}的鞋边有${person.scent}的味道。你轻轻蹭了一下，他低下头：“怎么了，小家伙？”`);
    else if(v.role==='conductor'){if(!s.ticketed.includes(person.id))s.ticketed.push(person.id);tell(s,`${person.name}递来车票。你用拇指扶住票角，看见了${person.emblem}徽记。“列车长，是我的东西有消息了吗？”`);}
    else tell(s,`${person.name}往旁边让了让：“你也睡不着吗？”你坐近一点，听他谈起${person.memory}。`);
    return v;
  }
  if(a.type==='deliver'){
    if(!s.claimed||!s.clue){tell(s,!s.claimed?'先把失物带在身边。':'你还没想起它属于谁。再留意一下这个身份能发现的线索。');return v;}
    const person=peopleHere(v,c).find(person=>person.id===s.selected);
    if(!person){tell(s,'先靠近眼前的一位乘客，再把东西递过去。');return v;}
    if(person.id!==TRAIN_PEOPLE[c.owner].id){tell(s,v.role==='cat'?`${person.name}摸摸你的耳朵，却没有拿走东西。气味还没有对上。`:`${person.name}摇头：“谢谢，但这不是我的。”东西还留在你手里。`);return v;}
    if(v.role==='conductor'&&!s.ticketed.includes(person.id)){tell(s,'先查验他的车票，核对登记册。');return v;}
    s.delivered=true;s.claimed=false;
    if(v.role==='conductor')tell(s,`${person.name}接过${c.item}：“辛苦了，列车长。”你还有一件事：回驾驶室，确认车门，送大家继续前行。`);
    else{s.done=true;tell(s,`${person.name}接回${c.item}。${p.ending}`);}return v;
  }
  if(a.type==='doors'&&v.role==='conductor'&&s.place==='cab'){s.doorsClosed=!s.doorsClosed;tell(s,s.doorsClosed?'你拨下黄铜手柄。门锁轻响，仪表上的绿色确认灯亮了。':'你抬起手柄，车门解锁，确认灯重新变为琥珀色。');return v;}
  if(a.type==='depart'&&v.role==='conductor'&&s.place==='cab'){
    if(!s.delivered||!s.doorsClosed){tell(s,!s.delivered?'还有一件失物没有交回。你暂时放下了汽笛手柄。':'你扫了一眼仪表：车门还没有锁闭。');return v;}
    s.done=true;tell(s,p.ending);return v;
  }
  return v;
}
export function restoreTrainState(raw,role){
  const s=initialTrainState(role),r=raw??{},validPerson=id=>TRAIN_PEOPLE.some(p=>p.id===id);
  const places=TRAIN_PROFILES[role].places;
  if(places.includes(r.place))s.place=r.place;
  if(role==='cat')s.car=s.place==='luggage'?3:[1,2].includes(r.car)?r.car:1;
  else if(role==='conductor')s.car=s.place==='cab'?0:[1,2].includes(r.car)?r.car:1;
  else{s.car=s.place==='window'?2:1;}
  s.returnCar=[1,2].includes(r.returnCar)?r.returnCar:1;
  for(const k of ['clue','claimed','done','sense','cabUnlocked','doorsClosed','announced','delivered','looked'])s[k]=r[k]===true;
  s.lightOn=r.lightOn!==false;
  s.awake=r.awake===true||r.clue===true||r.done===true;
  s.memoryStep=[0,1,2].includes(r.memoryStep)?r.memoryStep:r.clue&&role==='passenger'?2:0;
  for(const k of ['talked','ticketed'])s[k]=Array.isArray(r[k])?[...new Set(r[k].filter(validPerson))]:[];
  s.selected=validPerson(r.selected)?r.selected:null;
  s.legacyComplete=r.legacyComplete===true||(r.interior!==2&&r.done===true);
  if(r.interior!==2){s.awake=!!(r.clue||r.done||r.talked?.length);if(r.done)s.delivered=true;if(r.clue&&role==='conductor')s.ticketed=[...s.talked];}
  if(s.place==='cab')s.cabUnlocked=true;
  if(Array.isArray(r.log))s.log=r.log.filter(t=>typeof t==='string').slice(0,6).map(t=>t.slice(0,500));
  return s;
}
