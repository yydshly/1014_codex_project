/** 003舞台重剪。无模型调用；不修改002。仅approved-for-render图像manifest可渲染。 */
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), source = path.resolve(root, '../002-moon-and-earth');
const work = path.join(root, 'work'), finalDir = path.join(root, 'final'), reportFile = path.join(work, 'final-report.json');
const output = path.join(finalDir, 'jing-feng-shuang-stage-v3.mp4'), temporary = path.join(finalDir, 'jing-feng-shuang-stage-v3.rendering.mp4');
const mode = process.argv[2] || '--check', ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg', ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
assert(process.argv.length <= 3 && ['--check', '--prepare', '--preview', '--render'].includes(mode), '用法：node scripts/assemble-stage.mjs [--check|--prepare|--preview|--render]');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(readFileSync(file));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const probe = file => JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
const save = async report => { await fs.mkdir(work, { recursive: true }); await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n'); };
const sourcePath = value => {
  const file = path.resolve(source, value), relative = path.relative(source, file);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), '002素材路径无效'); return file;
};
const ownPath = value => {
  const file = path.resolve(root, value), relative = path.relative(root, file);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), '003图像必须位于本实验目录内'); return file;
};
const fps = 25, width = 1280, height = 720, duration = 63.28, started = Date.now();
let shots = [], visualTimeline = [], provenance = {};

// 每个器乐切点取实测拍点附近的25fps帧；18.2/37.6/51.2/56.4是已选歌词镜头边界。
const stagePlan = [
  [0,2.52,'wide','high-wide'],[2.52,4.84,'duel','mid-left'],[4.84,7.2,'crowd','reverse'],[7.2,9.56,'detail','drum-close'],
  [9.56,11.88,'wide','floor-wide'],[11.88,14.24,'duel','mid-right'],[14.24,16.6,'crowd','reverse'],[16.6,18.2,'wide','high-wide'],
  [37.6,38.4,'wide','high-wide'],[38.4,41.2,'crowd','reverse'],[41.2,44.4,'duel','mid-left'],
  [44.4,47.12,'wide','floor-wide'],[47.12,49.56,'detail','drum-close'],[49.56,51.2,'wide','high-wide'],
  [56.4,58.96,'wide','high-wide'],[58.96,60.72,'duel','mid-right'],[60.72,63.28,'wide','high-wide'],
];

const pythonPackaging = String.raw`
import sys,json,os,math,random,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageFilter
c=json.load(sys.stdin); out=c['directory'];os.makedirs(out,exist_ok=True)
fontpath=os.environ.get('CJK_FONT_PATH','C:/Windows/Fonts/msyh.ttc')
def font(n):return ImageFont.truetype(fontpath,n)
def center(d,text,y,size,color):
 f=font(size);b=d.textbbox((0,0),text,font=f);d.text(((1280-b[2]+b[0])/2,y),text,font=f,fill=color,stroke_width=2,stroke_fill=(0,0,0,180))
for o in c['overlays']:
 im=Image.new('RGBA',(1280,720));d=ImageDraw.Draw(im)
 if o['kind']=='badge':d.text((1110,23),'AI 原创演绎',font=font(16),fill=(232,240,241,200),stroke_width=1,stroke_fill=(0,0,0,130))
 elif o['kind']=='art':d.text((28,685),'舞台场景为图像运镜',font=font(15),fill=(226,235,235,205),stroke_width=1,stroke_fill=(0,0,0,140))
 elif o['kind']=='intro':
  center(d,'敬 风 霜',104,78,'#F4D69A');center(d,'月 光 与 人 间',206,24,'#DBF3EF');center(d,'李 白  ×  杜 甫',247,21,'#E5E9ED')
 elif o['kind']=='outro':
  center(d,'敬月光 · 敬风霜',516,50,'#F4D69A');center(d,'李白 × 杜甫 · 原创人物演绎',583,20,'#E5E9ED')
 elif o['kind']=='name':
  d.rounded_rectangle((29,64,34,108),2,fill=o['color']);d.text((47,61),o['text'],font=font(27),fill=o['color'],stroke_width=1,stroke_fill=(0,0,0,180))
  d.text((47,97),o['sub'],font=font(13),fill=(225,235,236,210),stroke_width=1,stroke_fill=(0,0,0,120))
 else:
  f=font(37);b=d.textbbox((0,0),o['text'],font=f);tw=b[2]-b[0];x=(1280-tw)/2
  d.rounded_rectangle((x-19,620,x+tw+19,681),12,fill=(2,8,14,105));d.text((x,626),o['text'],font=f,fill=(249,248,240,255),stroke_width=2,stroke_fill=(0,0,0,210))
  d.rounded_rectangle((x+tw*.30,680,x+tw*.70,682),1,fill=o['color'])
 im.save(o['path'])
r=random.Random(20261015)
particles=[(r.choice([r.uniform(5,145),r.uniform(495,635)]),r.uniform(110,355),r.uniform(.5,1.7),r.uniform(.2,.8),r.uniform(0,6.28)) for _ in range(38)]
beats=c['beat_events'];ranges=c['art_ranges'];quiet_ranges=c['quiet_ranges']
def atmosphere(t):
 art=any(a<=t<b for a,b in ranges);quiet=any(a<=t<b for a,b in quiet_ranges);strength=(1 if art else .42)*(.58 if quiet else 1)
 pulse=0 if quiet else max((b['strength']*math.exp(-abs(t-b['time'])*13) for b in beats),default=0)
 im=Image.new('RGBA',(640,360));d=ImageDraw.Draw(im)
 # 光束仅在侧翼，人物口鼻所在中部保持清空；脉冲只有低幅度亮度变化。
 sway=math.sin(t*.45)*23
 d.polygon([(9+sway*.18,0),(27+sway*.18,0),(133+sway,326),(28+sway*.35,326)],fill=(66,195,208,int((12+8*pulse)*strength)))
 d.polygon([(615-sway*.18,0),(632-sway*.18,0),(613-sway*.35,326),(507-sway,326)],fill=(238,181,87,int((12+8*pulse)*strength)))
 im=im.filter(ImageFilter.GaussianBlur(5));fog=Image.new('RGBA',(640,360));fd=ImageDraw.Draw(fog)
 for j in range(4):
  x=-120+j*205+math.sin(t*.16+j)*45;fd.ellipse((x,323+j%2*4,x+330,385),fill=(104,163,171,int((8+j)*strength)))
 im=Image.alpha_composite(im,fog.filter(ImageFilter.GaussianBlur(12)));d=ImageDraw.Draw(im)
 for x,y,radius,speed,phase in particles:
  yy=345-((345-y+t*speed*8)%240);xx=x+math.sin(t*.35+phase)*7;a=int((45+45*(.5+.5*math.sin(t+phase)))*strength)
  d.ellipse((xx-radius,yy-radius,xx+radius,yy+radius),fill=(246,213,146,a))
 d.line((0,350,640,350),fill=(109,201,205,int((4+5*pulse)*strength)),width=1)
 return im
if c.get('preview_jobs'):
 thumbs=[]
 for job in c['preview_jobs']:
  t=job['time'];im=Image.open(job['base']).convert('RGBA');im=Image.alpha_composite(im,atmosphere(t).resize((1280,720),Image.Resampling.LANCZOS))
  for o in c['overlays']:
   if o['start']<=t<o['end']:im=Image.alpha_composite(im,Image.open(o['path']).convert('RGBA'))
  im.convert('RGB').save(job['output']);thumb=im.convert('RGB').resize((512,288),Image.Resampling.LANCZOS)
  tile=Image.new('RGB',(512,314),'#081018');tile.paste(thumb,(0,26));ImageDraw.Draw(tile).text((10,5),str(t)+' s',font=font(15),fill='#EDF0F1');thumbs.append(tile)
 contact=Image.new('RGB',(2048,314*math.ceil(len(thumbs)/4)),'#081018')
 for i,tile in enumerate(thumbs):contact.paste(tile,((i%4)*512,(i//4)*314))
 contact.save(c['preview_contact'],quality=92)
if not c['render_fx']:sys.exit(0)
cmd=[c['ffmpeg'],'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size','640x360','-framerate','25','-i','pipe:0','-an','-c:v','qtrle','-pix_fmt','argb',c['fx_path']]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for frame in range(c['frames']):p.stdin.write(atmosphere(frame/25).tobytes())
p.stdin.close()
if p.wait()!=0:raise RuntimeError('程序灯雾粒子图层编码失败')
`;

function retimeGraph(graph, input, outputLabel, shot, fit) {
  const points = shot.retime.control_points, count = points.length - 1, prefix = 'rt-' + shot.id;
  graph.push(`[${input}]setpts=PTS-STARTPTS,${fit},split=${count}${Array.from({length:count},(_,i)=>`[${prefix}s${i}]`).join('')}`);
  for(let i=0;i<count;i++){
    const a=points[i],b=points[i+1],length=Number((b[1]-a[1]).toFixed(6));
    graph.push(`[${prefix}s${i}]trim=start=${a[0]}:end=${b[0]},setpts=(PTS-STARTPTS)*${(b[1]-a[1])/(b[0]-a[0])},fps=100,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=${length},setpts=PTS-STARTPTS[${prefix}p${i}]`);
  }
  graph.push(`${Array.from({length:count},(_,i)=>`[${prefix}p${i}]`).join('')}concat=n=${count}:v=1:a=0[${outputLabel}]`);
}

try {
  const manifestPath = path.join(work,'stage-manifest.json');
  const [manifest, timeline, sourceReport, qa, visual, tempo, cues] = await Promise.all([
    readJson(manifestPath),readJson(path.join(source,'work/timeline.json')),readJson(path.join(source,'work/final-report.json')),
    readJson(path.join(source,'work/video-qa.json')),readJson(path.join(source,'work/visual-review.json')),readJson(path.join(source,'work/source-analysis/tempo-candidate.json')),readJson(path.join(work,'stage-music-cues.json')),
  ]);
  assert.equal(manifest.status,'approved-for-render','新图未由root确认，拒绝渲染'); assert.equal(timeline.status,'confirmed');assert.equal(sourceReport.status,'completed');
  assert.equal(sourceReport.sha256,'88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e','002基线已变化，需重新核对');
  const sceneKeys=['wide','duel','crowd','detail'];
  const assets=await Promise.all(sceneKeys.map(async id=>{
    const spec=manifest.images?.[id];assert(spec&&typeof spec.path==='string'&&/^[a-f0-9]{64}$/i.test(spec.sha256||''),`缺少${id}新图及SHA`);
    const file=ownPath(spec.path),bytes=await fs.readFile(file);assert.equal(sha(bytes),spec.sha256,`${id}新图SHA不符`);
    return {id,path:rel(file),absolute_path:file,sha256:spec.sha256,size_bytes:bytes.length,is_generated_video:false};
  }));
  assert.equal(new Set(assets.map(x=>x.sha256)).size,4,'需要四张独立的新舞台图');
  const music=sourcePath(timeline.audio.path);assert.equal(hash(music),sourceReport.audio.sha256);
  assert.equal(cues.source.sha256,sourceReport.audio.sha256);
  const quietRanges=[[38.36,47.11],[60.76,duration]];
  const beatEvents=cues.beat_candidates.filter(x=>!x.inside_near_silence&&x.relative_strength>.03).map(x=>({time:x.time_s,strength:x.relative_strength}));
  let ambience=null;
  if(manifest.stage_ambience?.enabled===true){
    assert.equal(manifest.stage_ambience.approved,true,'氛围声音尚未授权混入');
    const spec=manifest.stage_ambience,file=ownPath(spec.path);assert.equal(hash(file),spec.sha256,'氛围声音SHA不符');
    const gain=spec.gain_db??0;assert(Number.isFinite(gain)&&gain>=-30&&gain<=0,'氛围声增益只能-30至0dB');
    ambience={enabled:true,approved:true,path:rel(file),absolute_path:file,sha256:spec.sha256,gain_db:gain,start:0,end:duration,source:'local-synthesis',new_melody:false,kind:'稀疏掌声与空间声；独立合成非现场收音',
      protected_performance_ranges:[[18.2,37.6],[51.2,56.4]],note:'节目外低量合成掌声/空间声，非现场录音；主歌与重唱保护段无氛围叠音。'};
  }
  const audioAdditions=ambience?[{kind:'stage-ambience',path:ambience.path,sha256:ambience.sha256,start:0,end:duration,gain_db:ambience.gain_db,source:'local-synthesis',note:ambience.note}]:[];
  let mixPreflight=null;
  if(mode==='--render'){
    const args=['-hide_banner','-loglevel','error','-i',music];if(ambience)args.push('-i',ambience.absolute_path);
    const g=[`[0:a]volume=-1.5dB,apad=pad_dur=${sourceReport.audio.alignment.padding_seconds},asetpts=PTS-STARTPTS[${ambience?'song':'mix'}]`];
    if(ambience)g.push(`[1:a]volume=${ambience.gain_db}dB,asetpts=PTS-STARTPTS[room]`,'[song][room]amix=inputs=2:duration=longest:normalize=0,atrim=duration=63.28[mix]');
    args.push('-filter_complex',g.join(';'),'-map','[mix]','-t','63.28','-ar','48000','-ac','2','-f','f32le','pipe:1');
    const floats=execFileSync(ffmpeg,args,{maxBuffer:40_000_000});let peak=0,energy=0;
    for(let offset=0;offset<floats.length;offset+=4){const value=floats.readFloatLE(offset);assert(Number.isFinite(value),'混音含非有限样本');peak=Math.max(peak,Math.abs(value));energy+=value*value;}
    mixPreflight={method:'FFmpeg实际预期混音浮点解码',sample_rate:48000,channels:2,duration:floats.length/(48000*2*4),peak_linear:peak,peak_dbfs:20*Math.log10(Math.max(peak,1e-12)),rms_dbfs:10*Math.log10(energy/(floats.length/4)),float_samples_sha256:sha(floats),normalize:0,compression:false,original_song_gain_db:-1.5,additions:audioAdditions,passed:peak<1};
    if(ambience){const raw=execFileSync(ffmpeg,['-v','error','-i',ambience.absolute_path,'-ar','48000','-ac','2','-f','f32le','pipe:1'],{maxBuffer:40_000_000});let protectedPeak=0;
      for(const [start,end]of ambience.protected_performance_ranges)for(let frame=Math.round(start*48000);frame<Math.round(end*48000);frame++)for(let ch=0;ch<2;ch++)protectedPeak=Math.max(protectedPeak,Math.abs(raw.readFloatLE((frame*2+ch)*4)));
      assert.equal(protectedPeak,0,'氛围候选在主歌保护段含声音，停止混入');mixPreflight.ambience_protected_ranges_peak=protectedPeak;}
    await fs.writeFile(path.join(work,'mix-preflight.json'),JSON.stringify(mixPreflight,null,2)+'\n');assert(mixPreflight.passed,'完整混音浮点峰值触及0dBFS，已停止，不归一化或压缩原曲。');
  }
  const performances=timeline.visual_timeline.filter(x=>x.type==='performance');assert.equal(performances.length,5);
  shots=performances.map(item=>{
    const original=sourceReport.shots.find(x=>x.id===item.id),line=timeline.lines.find(x=>x.id===item.line_id);assert(original&&line);
    const file=sourcePath(original.path),entry=qa.clips[line.qa_id],review=visual.clips[line.qa_id];
    assert.equal(hash(file),original.sha256);assert.equal(entry.video_sha256,original.sha256);assert.equal(review.video_sha256,original.sha256);assert.equal(review.accepted_for_demo,true);
    return {...structuredClone(original),path:rel(file),absolute_path:file,type:'performance',occurrence_id:item.id,line_id:item.line_id,source_experiment:'002-moon-and-earth',
      framing:item.line_id.endsWith('02')?'slight-close':'medium',qa:{status:'recorded',source:'../002-moon-and-earth/work/video-qa.json',original_result:entry,lip_sync_passed:null}};
  });
  const art=stagePlan.map(([start,end,scene,view],i)=>{
    const asset=assets.find(x=>x.id===scene),nearest=tempo.beat_times_s.reduce((a,b)=>Math.abs(b-start)<Math.abs(a-start)?b:a);
    return {id:`stage-${String(i+1).padStart(2,'0')}`,type:'instrumental_art_motion',path:asset.path,absolute_path:asset.absolute_path,sha256:asset.sha256,scene_id:scene,camera_view:view,
      slot_start:start,slot_end:end,slot_duration:Number((end-start).toFixed(6)),is_generated_video:false,label:'舞台场景为图像运镜',
      cut_basis:[38.4,41.2,44.4].includes(start)?'实测静音段中的停拍舞台叙事，非真实鼓点':start===47.12?'原歌47.11秒附近声音重入':[0,37.6,56.4,60.72].includes(start)?'音乐段落/表演边界/尾声能量收束':'可听拍点附近的25fps编辑切点',nearest_measured_beat:nearest,beat_difference_seconds:Number((start-nearest).toFixed(5))};
  });
  visualTimeline=[...shots,...art].sort((a,b)=>a.slot_start-b.slot_start);
  let cursor=0;for(const shot of visualTimeline){assert(Math.abs(shot.slot_start-cursor)<1e-6,'舞台剪辑表有空洞或重叠');assert(Math.abs(shot.slot_start*25-Math.round(shot.slot_start*25))<1e-6);cursor=shot.slot_end;}assert.equal(cursor,duration);
  const performanceDuration=Number(shots.reduce((s,x)=>s+x.slot_duration,0).toFixed(6)),artDuration=Number(art.reduce((s,x)=>s+x.slot_duration,0).toFixed(6));assert.equal(performanceDuration,24.6);assert.equal(artDuration,38.68);
  const sourceFiles=sourceReport.source_files.map(x=>({...structuredClone(x),path:rel(sourcePath(x.path)),source_experiment:'002-moon-and-earth'}));
  provenance={manifest:{path:'work/stage-manifest.json',sha256:hash(manifestPath)},source_timeline:{path:'../002-moon-and-earth/work/timeline.json',sha256:hash(path.join(source,'work/timeline.json'))},
    source_report:{path:'../002-moon-and-earth/work/final-report.json',sha256:hash(path.join(source,'work/final-report.json'))},beat_analysis:{path:'../002-moon-and-earth/work/source-analysis/tempo-candidate.json',sha256:hash(path.join(source,'work/source-analysis/tempo-candidate.json'))},
    music_cues:{path:'work/stage-music-cues.json',sha256:hash(path.join(work,'stage-music-cues.json')),quiet_ranges:quietRanges,unconfirmed_interpolated_beats_not_used:true}};
  const chosenTimeline={...structuredClone(timeline),experiment_id:'003-stage-edition',title:'敬风霜 · 月夜舞台版',status:'confirmed',note:'沿用002真实演唱、歌词和原歌；003新舞台图与程序灯雾粒子重剪，非新增人物视频生成。',poster:assets[0].path,
    audio:{...timeline.audio,path:rel(music),gain_db:-1.5},visual_timeline:visualTimeline.map(x=>({id:x.id,type:x.type,start:x.slot_start,end:x.slot_end,...(x.type==='performance'?{line_id:x.line_id,occurrence_id:x.id,heard_start:performances.find(p=>p.id===x.id).heard_start,heard_end:performances.find(p=>p.id===x.id).heard_end,clip:x.path,source_in:x.source_in,...(x.retime?{retime:x.retime}:{})}:{image:x.path,scene_id:x.scene_id,camera_view:x.camera_view})})),provenance};
  if(mode==='--check'){await save({status:'inputs_ready',experiment_id:'003-stage-edition',output_created:false,source_files:sourceFiles,new_scene_assets:assets.map(({absolute_path,...x})=>x),visual_timeline:visualTimeline,provenance});console.log(JSON.stringify({status:'inputs_ready',source_clips:2,new_scene_assets:4,art_segments:art.length,performance_occurrences:5,duration},null,2));process.exit(0);}
  await fs.mkdir(work,{recursive:true});await fs.mkdir(finalDir,{recursive:true});await fs.mkdir(path.join(work,'overlays'),{recursive:true});
  const overlays=[{id:'badge',kind:'badge',start:0,end:duration},{id:'title',kind:'intro',start:.4,end:4.84},{id:'outro',kind:'outro',start:58.36,end:duration},
    ...art.map(x=>({id:`label-${x.id}`,kind:'art',start:x.slot_start,end:x.slot_end})),
    ...performances.flatMap(item=>{const line=timeline.lines.find(x=>x.id===item.line_id),color=line.actor==='李白'?'#F3CF83':'#A2DFE7';return[
      {id:`name-${item.id}`,kind:'name',text:line.actor,sub:line.actor==='李白'?'月光 / 自由':'人间 / 风霜',color,start:item.start,end:item.end},
      {id:`caption-${item.id}`,kind:'caption',text:line.text,color,start:item.heard_start,end:Math.min(item.end,item.heard_end+.15)}];}),
  ].map(x=>({...x,path:path.join(work,'overlays',x.id+'.png')}));
  const fxPath=path.join(work,'stage-atmosphere.mov');
  const previewJobs=[];
  if(mode==='--preview')for(const [i,time]of [1,3.6,5.8,8.6,20.2,30,42,48].entries()){
    const shot=visualTimeline.find(x=>x.slot_start<=time&&time<x.slot_end),base=path.join(work,`preview-base-${i}.png`),args=['-hide_banner','-loglevel','error','-y'];
    if(shot.type==='performance')args.push('-ss',String(shot.source_in+time-shot.slot_start));
    args.push('-i',shot.absolute_path,'-frames:v','1','-vf','scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1',base);execFileSync(ffmpeg,args,{stdio:['ignore','pipe','pipe']});
    previewJobs.push({time,base,output:path.join(work,`stage-preview-${i}.jpg`)});
  }
  const previewContact=path.join(work,'stage-fx-preview-contact.jpg');
  const packageResult=spawnSync(process.env.PYTHON_PATH||'python',['-X','utf8','-c',pythonPackaging],{input:JSON.stringify({directory:path.join(work,'overlays'),overlays,ffmpeg,fx_path:fxPath,render_fx:mode==='--render',frames:1582,beat_events:beatEvents,quiet_ranges:quietRanges,art_ranges:art.map(x=>[x.slot_start,x.slot_end]),preview_jobs:previewJobs,preview_contact:previewContact}),encoding:'utf8',maxBuffer:2_000_000});
  assert.equal(packageResult.status,0,packageResult.stderr||'字幕/灯雾粒子制作失败');
  if(mode==='--prepare'){console.log(JSON.stringify({status:'overlays_ready',count:overlays.length,output_created:false}));process.exit(0);}
  if(mode==='--preview'){
    await fs.writeFile(path.join(work,'preview-report.json'),JSON.stringify({status:'keyframe_fx_preview',experiment_id:'003-stage-edition',final_output_created:false,contact_sheet:rel(previewContact),frames:previewJobs.map(x=>({time:x.time,path:rel(x.output)})),limitations:['这是关键帧FX与字幕设计检查，未检查完整运动、转场或整片音轨。']},null,2)+'\n');
    console.log(JSON.stringify({status:'keyframe_fx_preview',frames:previewJobs.length,contact_sheet:previewContact,final_output_created:false},null,2));process.exit(0);
  }
  await fs.writeFile(path.join(work,'timeline.json'),JSON.stringify(chosenTimeline,null,2)+'\n');
  const ffArgs=['-hide_banner','-loglevel','warning','-y'];
  for(const item of visualTimeline){if(item.type==='performance'){if(item.source_in>0)ffArgs.push('-ss',String(item.source_in));}else ffArgs.push('-loop','1','-framerate','25');ffArgs.push('-i',item.absolute_path);}
  const audioIndex=visualTimeline.length,ambienceIndex=ambience?audioIndex+1:null,fxIndex=audioIndex+1+(ambience?1:0),overlayStart=fxIndex+1;
  ffArgs.push('-i',music);if(ambience)ffArgs.push('-i',ambience.absolute_path);ffArgs.push('-i',fxPath);for(const layer of overlays)ffArgs.push('-loop','1','-framerate','1','-i',layer.path);
  const fit='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1',graph=[`[${audioIndex}:a]volume=-1.5dB,apad=pad_dur=${sourceReport.audio.alignment.padding_seconds},asetpts=PTS-STARTPTS[${ambience?'song':'audio'}]`];
  if(ambience)graph.push(`[${ambienceIndex}:a]volume=${ambience.gain_db}dB,asetpts=PTS-STARTPTS[room]`,'[song][room]amix=inputs=2:duration=longest:normalize=0,atrim=duration=63.28[audio]');
  visualTimeline.forEach((item,i)=>{
    if(item.type==='performance'){
      const intermediate=`hero${i}`;
      if(item.retime)retimeGraph(graph,`${i}:v`,intermediate,item,fit);
      else graph.push(`[${i}:v]setpts=PTS-STARTPTS,${fit},fps=100,trim=duration=${item.slot_duration},setpts=PTS-STARTPTS[${intermediate}]`);
      const zoom=item.framing==='slight-close'?`1.045+0.018*min(on/${item.slot_duration*100},1)`:`1.005+0.02*min(on/${item.slot_duration*100},1)`;
      graph.push(`[${intermediate}]zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1280x720:fps=100,eq=saturation=1.03:contrast=1.015,trim=duration=${item.slot_duration},setpts=PTS-STARTPTS[c${i}]`);
    }else{
      const n=item.slot_duration*25,push=item.camera_view==='high-wide'||item.camera_view==='mid-left',z=push?`1.015+0.06*min(on/${n},1)`:`1.075-0.06*min(on/${n},1)`;
      const x=item.camera_view==='mid-right'?`(iw-iw/zoom)*(0.65-0.15*min(on/${n},1))`:`(iw-iw/zoom)*(0.35+0.15*min(on/${n},1))`;
      const y=item.camera_view==='floor-wide'?'(ih-ih/zoom)*0.8':'(ih-ih/zoom)*0.38';
      graph.push(`[${i}:v]${fit},zoompan=z='${z}':x='${x}':y='${y}':d=1:s=1280x720:fps=25,eq=saturation=1.06:contrast=1.035:brightness=-.008,fps=100,trim=duration=${item.slot_duration},setpts=PTS-STARTPTS[c${i}]`);
    }
  });
  graph.push(`${visualTimeline.map((_,i)=>`[c${i}]`).join('')}concat=n=${visualTimeline.length}:v=1:a=0,fps=25,tpad=stop_mode=clone:stop_duration=0.04,trim=duration=${duration},format=yuv420p[cut]`);
  graph.push(`[${fxIndex}:v]scale=1280:720,format=rgba[fx]`,`[cut][fx]overlay=0:0:format=auto[atmosphere]`);
  overlays.forEach((layer,i)=>graph.push(`[${i?'o'+(i-1):'atmosphere'}][${overlayStart+i}:v]overlay=0:0:enable='gte(t,${layer.start})*lt(t,${layer.end})':format=auto[${i===overlays.length-1?'out':'o'+i}]`));
  ffArgs.push('-filter_complex_threads','2','-filter_complex',graph.join(';'),'-map','[out]','-map','[audio]','-t',String(duration),'-r','25','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',temporary);
  try{execFileSync(ffmpeg,ffArgs,{stdio:['ignore','pipe','pipe'],maxBuffer:5_000_000});}catch(error){const log=String(error.stderr||error.message);await fs.writeFile(path.join(work,'render-error.txt'),log);throw new Error(log.split(/\r?\n/).filter(line=>line&&!line.startsWith('Failed to set value')).slice(0,4).join('\n'));}
  const info=probe(temporary),v=info.streams.find(x=>x.codec_type==='video'),a=info.streams.find(x=>x.codec_type==='audio');
  const checks={dimensions:v.width===1280&&v.height===720,fps:v.avg_frame_rate==='25/1',frame_count:Number(v.nb_frames)===1582,duration:Math.abs(Number(info.format.duration)-duration)<.045,audio_codec:a.codec_name==='aac',audio_format:a.sample_rate==='48000'&&a.channels===2,source_hashes_verified:shots.every(x=>hash(x.absolute_path)===x.sha256),four_unique_lyrics:new Set(shots.map(x=>x.line_id)).size===4};
  const passed=Object.values(checks).every(Boolean);if(passed)await fs.rename(temporary,output);const actual=passed?output:temporary;
  const report={schema_version:1,experiment_id:'003-stage-edition',title:chosenTimeline.title,status:passed?'completed':'validation_failed',generated_at:new Date().toISOString(),output:rel(actual),sha256:hash(actual),size_bytes:(await fs.stat(actual)).size,output_created:true,
    expected_duration:duration,total_duration:Number(info.format.duration),video_frames:Number(v.nb_frames),expected_video_frames:1582,is_static_image_camera_preview:false,
    parameters:{width,height,fps,video_codec:'h264',audio_codec:'aac',audio_sample_rate:48000,audio_channels:2,audio_bitrate:192000,crf:19},
    inputs:{timeline:{path:'work/timeline.json',sha256:hash(path.join(work,'timeline.json'))},poster:{path:assets[0].path,sha256:assets[0].sha256},audio:{...sourceReport.audio,path:rel(music),gain_db:-1.5,additions:audioAdditions}},
    provenance,new_scene_assets:assets.map(({absolute_path,...item})=>item),source_files:sourceFiles,shots,visual_timeline:visualTimeline,audio:{...sourceReport.audio,path:rel(music),gain_db:-1.5,source_clip_audio_used:false,additions:audioAdditions},preencode_mix_qa:mixPreflight,
    assembly:{status:'completed',source_clips:2,unique_lyric_shots:4,performance_occurrences:5,performance_duration:performanceDuration,instrumental_art_motion:{segments:art.length,duration:artDuration,is_model_performance:false},new_scene_images:4,stage_camera_views:new Set(art.map(x=>x.camera_view)).size,full_four_line_assembly:true,unified_audio:true,source_hashes_verified:true,final_hash_verified:true},
    stage_direction:{summary:'从全景建场，经双人对峙、观众反打与鼓灯细节连接真实演唱；停拍收灯，声音重入后推进灯阵，最后回到完整舞台。',changes:['四张同世界舞台图、六种景别与方向构图','约两到三秒换景，静音段改为低照度舞台张力','两侧灯束、地面薄雾与前景粒子建立空间层次','小底板双色歌词，保留嘴部与舞台主体'],new_video_generation_calls:0},
    stage_ambience:ambience?(({absolute_path,...x})=>x)(ambience):{enabled:false,note:'未混入氛围候选声音；只保留原曲。'},
    stage_effects:{kind:'procedural-compositing',path:rel(fxPath),sha256:hash(fxPath),beat_source:provenance.music_cues,ingredients:['两侧冷青/暖金低透明扫光','地面薄雾','边缘前景粒子','非静音段按音频起音强度作低幅亮度'],quiet_ranges:quietRanges,quiet_light_pulses:false,mouth_protection:'主唱中央口鼻区域不画灯束与粒子，表演段FX强度降低至42%；字幕在FX之上',generated_video:false},
    subtitles:sourceReport.subtitles,checks,elapsed_ms:Date.now()-started,limitations:['四句与人物表演复用002两条真实原片，没有新增视频模型调用。','新舞台图像运镜和程序灯雾粒子不代表视频模型生成的动态舞台；图像段底部单独标识。','原片人设和背景保持原样，仅轻微裁切与色彩衔接，未替换表演背景。','末句重唱仍复用同词画面并按既有控制点重定时，不宣称逐音素口型准确。','完整用户歌曲仅恒定-1.5dB，未裁切或变速；末尾不足一帧补静音，原文件保持不变。','原生音轨QA沿用002，含伴奏的相关性不是精准口型证明。']};
  await save(report);assert(passed,'舞台版输出参数核验失败');console.log(JSON.stringify({status:'completed',output,sha256:report.sha256,size_bytes:report.size_bytes,duration:report.total_duration,video_frames:report.video_frames},null,2));
}catch(error){await save({schema_version:1,experiment_id:'003-stage-edition',status:'blocked_or_failed',error:error.message,output_created:false,source_files:[],provenance});console.error(error.message);process.exitCode=2;}
