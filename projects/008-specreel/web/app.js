const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const commit='0d3aa13241b3714f32f93fdc705100150e6c42af';
const upstream=path=>`https://github.com/specreel/specreel/blob/${commit}/${path}`;
const flows={
  '01-reddit-evidence':{title:'看真实问题、原话和已有办法',description:'查看两条已保存的 Reddit 问题 → 读原话与已有办法 → 展开并收起来源条件。',steps:11,checks:6},
  '02-search-plan':{title:'从观察对象到下一轮采集指令',description:'改任务词 → 切换渠道 → 填写条件 → 生成并检查采集指令。',steps:21,checks:8},
  '03-source-filter':{title:'筛选历史线索并查看来源详情',description:'打开来源详情 → 按 Reddit 与 CSV 筛选 → 核对已有历史线索。',steps:15,checks:7}
};
let currentFlow='02-search-plan';
function selectFlow(slug){
  currentFlow=slug;
  const flow=flows[slug],video=$('#result-video');
  video.pause();video.src=`./zh/${slug}/demo.mp4`;
  if(slug==='02-search-plan')video.poster='./assets/chinese-title.png';else video.removeAttribute('poster');
  video.load();
  $('#result-title').textContent=flow.title;
  $('#result-description').textContent=flow.description;
  $('#result-steps').textContent=flow.steps;
  $('#result-checks').textContent=flow.checks;
  $('#result-duration').textContent='读取时长…';
  $('#result-download').href=`./zh/${slug}/demo.mp4`;
  $('#result-player-link').href=`./zh/${slug}/demo.html`;
  $('#result-player').dataset.src=`./zh/${slug}/demo.html`;
  if($('#player-disclosure').open)$('#result-player').src=$('#result-player').dataset.src;
  $$('[data-flow]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.flow===slug)));
}
$('#result-video').addEventListener('loadedmetadata',()=>{
  const duration=$('#result-video').duration;
  if(Number.isFinite(duration))$('#result-duration').textContent=duration.toFixed(2)+' 秒';
});
$$('[data-flow]').forEach(b=>b.addEventListener('click',()=>selectFlow(b.dataset.flow)));
$('#player-disclosure').addEventListener('toggle',()=>{
  if($('#player-disclosure').open)$('#result-player').src=$('#result-player').dataset.src;
});

const chains={
  script:[
    ['目标与条件','先选一条有意义的流程。','确定要展示什么、输入哪些数据，以及什么结果算完成。本轮目标是展示004已有页面的使用过程；没有新增模型搜索。','README.md'],
    ['操作脚本','把操作与检查表达成可执行步骤。','本轮独立编写 Playwright 脚本，使用点击、填写、切换和 expect 检查。脚本可以重复执行，首次仍需要选流程并确认控件与结果。','docs/agents-and-mcp.md'],
    ['浏览器执行','工具实际打开网页，自动操作。','Playwright 启动独立的无头 Chromium，按脚本访问004并执行动作。录制期间开启 screenshots、snapshots 与 sources，不需要人逐个点击页面。','integrations/README.md'],
    ['trace.zip','画面帧与动作日志在同一份记录里。','保存动作类型、参数、时间、错误与检查，以及浏览器画面帧和快照。Specreel可离线读取已有记录；这一渲染过程不必再启动浏览器。','specreel.py#L21'],
    ['Specreel 加工','从记录挑选画面，生成步骤与说明。','解析事件，合并动作，按时间匹配结果画面与片段，生成规则字幕、点击标记、步骤和检查信息。默认核心处理无需模型；AI改写与配音是选项。','specreel.py#L1363'],
    ['回放与视频','把同一份操作交付成不同格式。','HTML与JavaScript展示保存画面和步骤。MP4由Pillow生成字幕及片头片尾，再经FFmpeg编码；固定版本也有GIF、合集和发布功能。我们已实测HTML和MP4。','specreel.py#L1265']
  ],
  agent:[
    ['目标与授权','用户提出目标，并明确权限与成功标准。','例如为自己的网页制作一条“提交表单并检查结果”的演示。用户要明确目标、可用环境与账号权限；这一说明是组合使用场景，不是本次已执行的Agent任务。','docs/agents-and-mcp.md'],
    ['Agent + 模型','可规划、写脚本、选择工具。','上游有MCP与Agent技能入口。可选nlflow使用页面DOM上下文生成Playwright代码，并支持验证、失败修复和目标检查。这些有源码，但我们没有实测完整闭环。','specreel.py#L3806'],
    ['工具控制浏览器','由工具完成真正的执行。','外部Agent可通过Shell或相应工具运行Playwright脚本，启动或连接浏览器。模型不会自行加载浏览器；也不限定使用聊天软件内置浏览器。环境、登录或验证码可能需要额外处理。','integrations/README.md'],
    ['执行与记录','有明确流程后，可以自动跑完。','Playwright执行点击、填写和预先定义的检查，输出trace.zip。MCP包装并不独自完成所有浏览器步骤，Agent需要把执行工具、CLI与记录环节串好。','specreel_mcp.py'],
    ['生成与导出','Specreel加工真实记录。','调用渲染与导出，生成步骤回放、视频或演示合集。AI改写说明、TTS等可选能力可能涉及外部模型；核心渲染可以不使用模型。','specreel.py#L1363'],
    ['检查与分享','检查范围和实际目的分别确认。','自动检查证明预设条件是否成立；清晰度、分享范围与业务目标仍需确认。上游有发布/CI入口，但本轮未验证完整Agent自主发布或持续更新可靠性。','examples/github-workflows/specreel.yml']
  ]
};
let currentMode='script';
function nodeDetail(index){
  const [label,title,body,path]=chains[currentMode][index];
  const panel=$('#node-detail');panel.replaceChildren();
  const heading=document.createElement('h3'),paragraph=document.createElement('p'),link=document.createElement('a');
  heading.textContent=title;paragraph.textContent=body;link.textContent='固定版本依据：'+path+' ↗';link.href=upstream(path);link.target='_blank';link.rel='noreferrer';
  panel.append(heading,paragraph,link);
  $$('#pipeline button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
}
function selectMode(mode){
  currentMode=mode;
  $$('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));
  const pipeline=$('#pipeline');pipeline.replaceChildren();
  chains[mode].forEach((node,index)=>{
    const button=document.createElement('button'),number=document.createElement('span'),name=document.createElement('b');
    number.textContent=String(index+1).padStart(2,'0');name.textContent=node[0];button.append(number,name);button.addEventListener('click',()=>nodeDetail(index));pipeline.append(button);
  });nodeDetail(0);
}
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
selectMode('script');

const scenarios=[
  ['指导演示','教别人完成一个具体操作。','例如“上传文件→选择设置→生成结果”。把关键路径整理成能暂停、逐步看的材料，让首次使用者知道从哪里开始、完成后应该看到什么。','适合重复讲解的网页流程；我们未验证学习效率提升。'],
  ['操作备忘','把一次成功过程留给未来的自己。','保留执行步骤、当时画面、结果和版本信息。下次忘记某个配置或操作时，先看回放，再决定照着手动做还是重跑脚本。旁边还需补上原因、背景与经验。','适合稳定且会复用的流程；不是完整的思考记录或业务备份。'],
  ['客户培训','让客户按步骤了解产品怎么用。','可以为注册、导入资料、创建任务、查看结果等路径准备演示合集。脚本和测试数据稳定后，可在版本更新时重新生成；实际培训成效仍需客户反馈。','候选使用场景，尚未做客户培训对照。'],
  ['产品介绍','用真实运行过程解释能力。','把“产品能做什么”落到一条可观看的操作路径。可对外提供MP4或网页回放，分享前仍需判断内容、节奏和结果说明是否合适。','适合操作逻辑；连续动画、三维氛围通常录屏更直接。'],
  ['迭代与检查','让一条流程同时服务检查与展示。','已有自动化测试时，可以复用记录生成材料。更新后再跑；若所选检查失败就处理问题。画面和业务变化仍可能维护脚本，更新标记不等于覆盖一切改动。','需要已有或值得维护的自动化流程。'],
  ['团队交接','给同事一份能复查的过程。','把步骤、结果、限制和文字说明放在项目记录中，减少只靠口头说明。操作回放提供过程证据，权限移交、业务判断与后续责任需要另外说明。','候选协作方式，不代表完整知识库或任务管理产品。']
];
function selectScenario(index){
  const [,title,body,note]=scenarios[index];
  const panel=$('#scenario-detail');panel.replaceChildren();
  const h=document.createElement('h3'),p=document.createElement('p'),small=document.createElement('p');h.textContent=title;p.textContent=body;small.textContent=note;small.style.fontSize='11px';panel.append(h,p,small);
  $$('#scenario-tabs button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===index)));
}
scenarios.forEach((s,i)=>{const b=document.createElement('button');b.setAttribute('role','tab');b.textContent=s[0];b.addEventListener('click',()=>selectScenario(i));$('#scenario-tabs').append(b);});selectScenario(0);

const sources=[
  ['定位、格式与输出','README.md','从Playwright trace生成回放、合集、MP4与GIF；可选模型、发布与CI。'],
  ['核心解析与视频生成','specreel.py','load_events、build_steps、attach_frames、render_steps、build_mp4等函数。'],
  ['Agent与MCP说明','docs/agents-and-mcp.md','外部Agent组织发现、脚本、执行、生成与发布的接法。'],
  ['MCP包装实现','specreel_mcp.py','六个工具包装；浏览器执行和完整模型工作流需其他工具衔接。'],
  ['集成入口','integrations/README.md','CLI、MCP与Agent技能接入；Playwright浏览器属于独立依赖。'],
  ['Agent技能原文','integrations/claude-code/specreel/SKILL.md','固定版本的技能流程，用于理解自动编排的职责与要求。'],
  ['持续更新模板','examples/github-workflows/specreel.yml','自动构建与发布的示例；本项目未实测上游CI工作流。'],
  ['上游许可证','LICENSE','CLI为AGPL-3.0-or-later；本页附固定引擎与许可，Cloud未运行。']
];
sources.forEach(([title,path,description])=>{const item=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');a.textContent=title+' ↗';a.href=upstream(path);a.target='_blank';a.rel='noreferrer';p.textContent=description;item.append(a,p);$('#source-list').append(item);});

// The controls navigate saved local explanations; no remote automation is invoked.
$$('[role="tablist"]').forEach(list=>list.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...list.querySelectorAll('[role="tab"]')],index=tabs.indexOf(document.activeElement);if(index<0)return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();tabs[next].click();
}));
