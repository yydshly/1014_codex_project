// Each profile is authored as a coherent situation. IDs stay stable for saved visits.
export const POST_CHOICES = {
  scenery: { label: '写一点路上看见的风景', line: '今天看见了海，等我回来讲给你听。', reply: '“对，可以从眼前的事说起。”他在角落补画了一条小鱼。', later: '“后来又看见一片海。我把那条小鱼画在了第二张明信片上。”' },
  home: { label: '直接告诉家里：有点想家', line: '有点想家，但我想再走走。', reply: '“原来，这两件事可以一起写。”他把划去的字重新写清楚。', later: '“后来给家里打了电话。想家也没有关系，我还在慢慢往前走。”' },
  listen: { label: '先不替他写，听他说一会儿', line: '我到了，别担心。', reply: '你听他讲完路上的小事。他自己写下最后一句，肩膀松了一点。', later: '“谢谢那天陪我坐了一会儿。我后来终于能把自己的话写下来。”' },
};
export const BELL_CHOICES = {
  old: { label: '留下有一点走调的旧铃', reply: '“它陪我开店很久了。”她擦了擦旧铃，装回木鸟胸前。', later: '“旧声音一响，我还是会想起刚开店的早晨。谢谢你陪我听。”' },
  new: { label: '换上清亮的新铃', reply: '“那就让它从今天，学一个新声音。”她把旧铃收进抽屉。', later: '“最近开门时，我都会先让它唱一声。新声音也慢慢变熟悉了。”' },
};

export const POST_STORIES = [
  { id:'departure', label:'第一次离乡', name:'小屿', person:'刚到海边的年轻旅人', pronoun:'他', coat:'#658179', hair:'#4b4c43', style:'short', motif:'sea',
    description:'小屿第一次离乡，想给家里报个平安，却迟迟没写下最后一句。', cue:'里面有人翻着一张海边明信片，迟迟没有落笔。', opening:'“刚到这里，想报个平安。最后一句，你会怎么写？”', draft:'我到了。这里能看见海。……', choices:POST_CHOICES,
    farewell:'“写出来好像没有那么难了。”邮戳落下，他收好背包，向你挥了挥手。' },
  { id:'homecoming', label:'终于要回家', name:'阿岚', person:'在外工作四年的厨师', pronoun:'她', coat:'#a1765b', hair:'#444640', style:'bun', motif:'hills',
    description:'阿岚结束了外地的工作，买好了回家的车票。她想提前写给奶奶，又怕把重逢说得太隆重。', cue:'门里的人把一张车票夹进信纸，又拿了出来。', opening:'“四年没回去，奶奶总问我吃得好不好。这次，我想回去给她做一顿饭。”', draft:'奶奶，下周我就到家了。……',
    choices:{
      meal:{label:'就从想做给她的那顿饭写起',line:'下周回家，换我给你做一顿饭。',reply:'“她一定会问我，会不会做那道汤。”阿岚笑了，把菜名写在角落。',later:'“奶奶还是先把汤煮好了。我们最后一起做了第二道菜。”'},
      honest:{label:'告诉她，久别重逢也会有点紧张',line:'很想见你，也有一点紧张。到家以后慢慢说。',reply:'“不用假装四年都没有过去。”她把原先那句客套话划掉了。',later:'“见面时我们先抱了一下，后来坐到天黑。真的可以慢慢说。”'},
      listen:{label:'听她说说奶奶最常问的那句话',line:'我有好好吃饭。这次回来，陪你一起吃。',reply:'你听阿岚讲奶奶每次电话里的第一句话。她自己接上了信的结尾。',later:'“回家后的第一顿饭，她还是先问我吃饱没有。我说，这次你看着我吃。”'},
    },farewell:'“那我就不用在信里把所有话说完了。”阿岚把信投进邮袋，轻轻拍了拍车票。' },
  { id:'apology', label:'一句迟到的对不起', name:'小满', person:'抱着旧相机的学生', pronoun:'他', coat:'#8f655e', hair:'#383e3b', style:'short', motif:'camera',
    description:'小满不小心弄坏了姐姐借他的旧相机。他带着修理单来写信，怕道歉听起来像在找借口。', cue:'门后有金属搭扣的轻响，一台旧相机放在柜台上。', opening:'“修理店说还能修好。可是‘不是故意的’这几个字，我已经写了三遍。”', draft:'姐姐，相机的事……',
    choices:{
      own:{label:'先承认弄坏了，再说准备怎么补救',line:'相机是我弄坏的，对不起。我会把修好的它亲手还给你。',reply:'他把“但是”两个字擦掉，把修理单小心夹进了信里。',later:'“姐姐说比起相机，她更想听我自己说。取回来那天，我们一起试拍了一卷。”'},
      memory:{label:'说说为什么知道这台相机很重要',line:'我知道你用它拍过很多重要的日子，所以更该认真说对不起。',reply:'“她还用它拍过我上学第一天。”他终于不再只盯着修理单。',later:'“姐姐拿出那张上学的照片给我看。修好的相机又拍了一张现在的我们。”'},
      listen:{label:'陪他把事情经过说清楚',line:'我想当面把事情告诉你，不再躲着这件事了。',reply:'说完经过，他自己折好了信纸：“这封信先寄，回去再好好说。”',later:'“我后来没有再躲她。那天聊得比想象中久，也比想象中轻松。”'},
    },farewell:'信放进邮袋后，小满把相机抱得稳了一点：“回去还得亲口说一遍。”' },
  { id:'thanks', label:'很多年后的谢谢', name:'周老师', person:'即将退休的教师', pronoun:'她', coat:'#7c7b9a', hair:'#c4c0aa', style:'glasses', motif:'lamp',
    description:'周老师想写给曾为她留过夜灯的老门卫。那件小事过去很多年，她怕对方已经不记得了。', cue:'里面的人反复念着一个旧称呼，语气有些郑重。', opening:'“刚来教书那年，我总备课到很晚。陈伯每天都替我留着门口那盏灯。”', draft:'陈伯，有件事一直想谢谢您。……',
    choices:{
      detail:{label:'把那盏灯和当时的情景写下来',line:'很多年前，您替我留的那盏灯，让我第一次觉得这里也是家。',reply:'她补上了那年冬天的校门和热水杯：“原来细节还记得这么清楚。”',later:'“陈伯回信说，他记得那个总抱着一摞本子的年轻老师。那只热水杯还在。”'},
      simple:{label:'不必解释太多，一句谢谢就好',line:'这声谢谢来晚了，但我一直记着您。',reply:'“对，想说的话并不长。”她取下眼镜，重新读了一遍这句话。',later:'“回信只有一行：听见你这么说，我也很高兴。我把它放进了退休纪念册。”'},
      invite:{label:'问问能不能找一天再坐一会儿',line:'如果您方便，我想带壶茶，听您再讲讲那时的校园。',reply:'她在信末留了可联系的方式，没有把拜访日期先替对方决定。',later:'“我们后来约在老校门口喝了茶。他讲的校园故事，比我记得的还多。”'},
    },farewell:'周老师看着落下的邮戳：“有些话晚一点说，也还是可以说。”' },
  { id:'reconnect', label:'想再见的老朋友', name:'阿禾', person:'抱着花束的花店店主', pronoun:'她', coat:'#ae8f59', hair:'#3f4940', style:'long', motif:'flower',
    description:'阿禾想给很久没联系的朋友写信。她有很多近况想讲，又不想让一句“好久不见”变成催促。', cue:'花纸在门后沙沙作响，有人轻声试读“好久不见”。', opening:'“以前我们总约在桥边看花。后来各自忙起来，我竟不知道该从哪件事说起。”', draft:'好久不见，店里的花又开了。……',
    choices:{
      small:{label:'先分享一件今天发生的小事',line:'今天有人挑走了你喜欢的那种花，我忽然很想告诉你。',reply:'“不用先把这些年补齐。”她在卡片上画了一朵很小的花。',later:'“朋友回了一张窗台的照片：她也养着那种花。我们从这一件小事又聊起来。”'},
      invite:{label:'发出邀请，也给对方留出余地',line:'哪天你有空，我们再去桥边走走。不着急回信。',reply:'她把“这个周末一定”轻轻划掉：“等我们都方便的时候。”',later:'“后来终于约到一个都空着的下午。桥边的花换了一茬，我们还是有话聊。”'},
      honest:{label:'直接说：其实一直惦记着你',line:'很久没联系，惦记却一直在。想告诉你这一点。',reply:'阿禾把花纸放到一边：“这句话，好像不用再绕个弯。”',later:'“回信第一句是‘我也是’。原来我们都等过一个重新开口的机会。”'},
    },farewell:'阿禾把卡片交给柜台：“这次，就让问候慢慢走过去。”' },
  { id:'beginning', label:'一个新的开始', name:'林姨', person:'退休后开始学画的人', pronoun:'她', coat:'#647e9d', hair:'#aaa995', style:'glasses', motif:'palette',
    description:'林姨给老同事们写告别卡。她刚报了画画课，想让他们知道自己不是消失了，只是换一种日常。', cue:'门里有铅笔擦过纸面的声音，一张小画还没有画完。', opening:'“写‘再见’好像太远，写‘常联系’又太轻。下周我要去上第一节画画课了。”', draft:'以后不用早起赶同一班车了。……',
    choices:{
      future:{label:'写下接下来想试的那件事',line:'下周开始学画，等我画得像样一点，就寄一张给你们。',reply:'“也不用等到像样吧？”她笑着在旁边画了一个有些歪的苹果。',later:'“第一张苹果并不圆，同事们却把它贴在了休息室。我开始期待下一节课。”'},
      gratitude:{label:'把一起度过的普通日子记下来',line:'谢谢那些一起赶车、喝茶、把难事做完的日子。',reply:'她一边写，一边想起茶水间那只总也配不齐盖子的杯子。',later:'“大家回寄了一只带盖的新杯子，说画画的时候也要喝茶。”'},
      visit:{label:'留一个具体又轻松的再见面方式',line:'哪天午后有空，来我的小画桌旁坐坐，茶一直有。',reply:'“这回不用挑工作日的午休了。”她把家附近的街角画进了卡片。',later:'“我们后来真的围着小画桌喝了茶。话题从工作，慢慢变成了各自想试的新事。”'},
    },farewell:'林姨把卡片寄出，又在空白处试了一笔颜色：“好了，明天去买画纸。”' },
];

export const REPAIR_STORIES = [
  {id:'keepsake',label:'熟悉的旧声音',description:'店主修好了自己的木鸟，却拿不定主意，该为它装回哪一枚铃。',opening:'“一枚陪了我很多年，一枚刚做出来。你愿意帮我听听吗？”',heard:'“旧铃是开店那年装的。新的也很好，我只是还没习惯。”她把两枚铃都推近了一点。',choices:BELL_CHOICES,ending:'木鸟留在店里。下次回访，可以听听她后来的话。'},
  {id:'first-school',label:'送给外孙的木鸟',description:'店主准备把木鸟送给明天第一次上学的外孙，想为他挑一个愿意每天听见的声音。',opening:'“他把书包收了三遍。我想让这只小鸟陪他起床，声音该熟悉一点，还是精神一点？”',heard:'“旧铃是他小时候在店里常听的，新铃像他最近爱哼的歌。两种都能陪他。”',
    choices:{old:{label:'用他从小熟悉的旧铃',reply:'她把旧铃系紧：“换个地方，也能带着一点熟悉的声音。”',later:'“他把木鸟放在书包旁边，说每天出门前，要先让老朋友唱一声。”'},new:{label:'给他一个清亮的新声音',reply:'“那就和新书包一起出发。”她给新铃绑了一条亮色的线。',later:'“第一天放学，他先教木鸟‘唱’自己学会的歌。新声音很快就成了日常。”'}},ending:'她把木鸟装进纸盒，又在盒角画了一只小书包。回访可以听听第一天的后来。'},
  {id:'classroom',label:'音乐教室里的小鸟',description:'附近的音乐老师请店主修一只木鸟，好让孩子们分辨不同的声音。店主想先挑一种作为它的第一声。',opening:'“孩子们明天会给它编一段歌。你觉得，先让他们听见哪种声音？”',heard:'“旧铃低一点，新铃亮一点。老师说，不用挑更好的，只要让他们愿意仔细听。”',
    choices:{old:{label:'先听低低的旧铃',reply:'她装好旧铃，试着跟了一声：“低的声音，也有自己的位置。”',later:'“孩子们替它配了一段慢慢的低音，另一只新鸟唱高声，正好一问一答。”'},new:{label:'先听明亮的新铃',reply:'她把新铃放进木鸟胸前：“也许第一声，就能让小朋友抬起头。”',later:'“孩子们用它的亮铃做开头，又找来很多低低的声音。歌比一只鸟能唱的长多了。”'}},ending:'木鸟明天会被送到音乐教室。回来时，可以听店主讲孩子们编的那段歌。'},
];

export const VARIATIONS = {
  postoffice:POST_STORIES, repair:REPAIR_STORIES,
  seaside:[
    {id:'boat',label:'雨里的船灯',eventName:'一盏经过的船灯',description:'檐外落着细雨。海雾很厚，远处偶尔有船经过。',eventText:'海雾里，有一盏灯。它只是经过，并没有要你做什么。',colors:['#627c83','#d7b9a0'],rain:true},
    {id:'birds',label:'雨歇后的归鸟',eventName:'一群掠过海面的鸟',description:'雨刚停，檐水还在滴。天色变亮了一点，海面很空。',eventText:'几只鸟贴着海面掠过去，拐了个弯，消失在岸线后面。',colors:['#8daaa3','#e2d6b4'],rain:false},
    {id:'sunbreak',label:'云缝里的一点光',eventName:'云缝照亮的一片海',description:'细雨快停了，厚云后面藏着一点暖色。屋檐还在滴水。',eventText:'云裂开一道缝。一片海水忽然亮起来，又随着波纹轻轻晃动。',colors:['#6b8292','#c3ad99'],rain:true},
  ],
  rooftop:[
    {id:'wind',label:'等一阵风',eventName:'风铃与纸签一起摆动',eventText:'风终于经过了。风铃和纸签，一起轻轻动起来。',colors:['#9aaf9b','#dec49a']},
    {id:'plane',label:'落下的纸飞机',eventName:'一架落在天台的纸飞机',eventText:'一架纸飞机越过矮墙，打了个小旋，落在你旁边。',paper:'“如果你捡到它，就替我看看今天的云吧。”背面画着一片歪歪的云。',colors:['#8da9b0','#dbcfb2']},
    {id:'windows',label:'对楼的灯',eventName:'对楼一扇扇亮起的窗',eventText:'天慢慢暗下来，对楼的窗一扇接一扇亮了。有人也结束了今天的忙碌。',colors:['#5b7283','#b9ac9c']},
  ],
  greenhouse:[
    {id:'west',label:'从西侧来的光',start:{x:0,y:3},direction:[1,0],mirrors:[{x:1,y:3},{x:1,y:1}],target:{x:4,y:1},slashes:[true,true]},
    {id:'east',label:'从东侧来的光',start:{x:4,y:3},direction:[-1,0],mirrors:[{x:3,y:3},{x:3,y:1}],target:{x:0,y:1},slashes:[false,false]},
    {id:'long-path',label:'绕过温室的长光路',start:{x:0,y:4},direction:[1,0],mirrors:[{x:2,y:4},{x:2,y:1}],target:{x:4,y:1},slashes:[true,true]},
    {id:'low-window',label:'低窗下的花',start:{x:4,y:0},direction:[-1,0],mirrors:[{x:2,y:0},{x:2,y:3}],target:{x:0,y:3},slashes:[true,true]},
    {id:'north-east',label:'屋顶的光与东边的花',start:{x:1,y:0},direction:[0,1],mirrors:[{x:1,y:2},{x:3,y:2}],target:{x:3,y:4},slashes:[false,false]},
    {id:'north-west',label:'屋顶的光与西边的花',start:{x:3,y:0},direction:[0,1],mirrors:[{x:3,y:2},{x:1,y:2}],target:{x:1,y:4},slashes:[true,true]},
  ],
  observatory:[
    {id:'night',label:'深夜的星图',colors:['#122d3b','#557a7b']},
    {id:'dawn',label:'黎明前的星图',colors:['#383f64','#a7a995']},
    {id:'dusk',label:'入夜时的星图',colors:['#4c5069','#b19687']},
  ],
};
export function variation(visit) {
  const pool=VARIATIONS[visit.id];
  return pool.find(v=>v.id===visit.variationId)??pool[visit.id==='greenhouse'&&visit.state?.flipped?1:0];
}
export const postStory = visit => variation(visit);
export const postChoices = visit => postStory(visit).choices;
export const bellChoices = visit => variation(visit).choices;
export function greenhouseLayout(state) {return VARIATIONS.greenhouse.find(v=>v.id===state.layoutId)??VARIATIONS.greenhouse[state.flipped?1:0];}
const QUIET_ARRIVAL = {boat:'黄昏细雨',birds:'雨歇海风',sunbreak:'云下的细雨',wind:'风里的纸签',plane:'晴空下的天台',windows:'暮色里的天台'};
export function visibleVariationLabel(visit) {
  const profile=variation(visit);
  return ['seaside','rooftop'].includes(visit.id)&&!visit.state.eventSeen ? QUIET_ARRIVAL[profile.id] : profile.label;
}
