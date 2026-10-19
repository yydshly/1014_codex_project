/**
 * 真实4镜头到齐后组装24秒小样，不以静图替代主段。
 * node scripts/assemble.mjs --prepare  # 只绘制透明包装图，不生成视频
 * node scripts/assemble.mjs            # 缺输入时退出；齐备时生成成片
 * node scripts/assemble.mjs --wait      # 最多等待15分钟，齐备后生成
 * shifts.json: {"A01":0.2,"A02":0,"B01":-0.1,"B02":0}
 * 正值多裁源片开头，负值在源片前定格第一帧；片尾不足以末帧补齐并记录。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { retimeFor, appendRetimeGraph } from './retime.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2), ffmpeg=process.env.FFMPEG_PATH||'ffmpeg', ffprobe=process.env.FFPROBE_PATH||'ffprobe';
const work=join(root,'work'), overlayDir=join(work,'overlays'), finalDir=join(root,'final');
mkdirSync(overlayDir,{recursive:true}); mkdirSync(finalDir,{recursive:true});
const linesFile=join(work,'lines.json'), gridFile=join(work,'grid.json'), poster=join(root,'refs','poets-stage-v1.png');
const mix=join(work,'music_final.wav'), target=join(finalDir,'libai-dufu-sample-v1.mp4');
const rendering=join(finalDir,'libai-dufu-sample-v1.rendering.mp4');
const reportPath=join(work,'assembly-report.json');
const requiredBase=[linesFile,gridFile,poster,mix];
const missingBase=requiredBase.filter(p=>!existsSync(p));
if(missingBase.length) throw new Error(`缺少组装基础输入：${missingBase.map(p=>p.replace(root+'/','')).join('、')}`);
const timeline=JSON.parse(readFileSync(linesFile,'utf8')), grid=JSON.parse(readFileSync(gridFile,'utf8'));
const lines=timeline.lines, total=grid.total_duration, intro=grid.intro_duration, slot=grid.beat_duration*grid.beats_per_bar*grid.slot_bars;
if(lines.length!==4 || total!==24 || Math.abs(slot-4.8)>0.001) throw new Error('本组装脚本只接受4句、每句4.8秒、总24秒的时间轴。');

// 透明图层独立绘制，参考图本体不做写入。
const overlays=[
  {id:'badge',kind:'badge',text:'AI 生成 · 娱乐演绎',start:0,end:total},
  {id:'intro',kind:'title',text:'李白 × 杜甫',sub:'四句交锋小样 · 100 BPM',start:0,end:intro},
  {id:'outro',kind:'title',text:'四句已交锋，下一回合见。',sub:'原创歌词 · 合成声音 · AI 画面',start:total-grid.outro_duration,end:total},
  {id:'name-libai',kind:'name',text:'李白',sub:'自由月光 / ROUND 01',start:lines[0].start,end:lines[1].end,color:'#F1C985'},
  {id:'name-dufu',kind:'name',text:'杜甫',sub:'人间风霜 / ROUND 02',start:lines[2].start,end:lines[3].end,color:'#9DDCE7'},
  ...lines.map(l=>({id:`caption-${l.id}`,kind:'caption',text:l.text,start:l.heard_start,end:Math.min(l.end,l.heard_end+0.15),color:l.actor==='李白'?'#F1C985':'#9DDCE7'})),
].map(o=>({...o,path:join(overlayDir,`${o.id}.png`)}));
const python=String.raw`
import sys,json,os
from PIL import Image,ImageDraw,ImageFont
data=json.load(sys.stdin)
font_path=os.environ.get('CJK_FONT_PATH','C:/Windows/Fonts/msyh.ttc')
if not os.path.isfile(font_path):
    raise RuntimeError('缺少中文字体；请用CJK_FONT_PATH指向可用字体。')
def font(n): return ImageFont.truetype(font_path,n)
def centered(draw,text,y,f,fill):
    box=draw.textbbox((0,0),text,font=f)
    draw.text(((1280-(box[2]-box[0]))/2,y),text,font=f,fill=fill,stroke_width=1,stroke_fill=(0,0,0,160))
for item in data:
    img=Image.new('RGBA',(1280,720),(0,0,0,0)); d=ImageDraw.Draw(img)
    color=item.get('color','#F1C985')
    if item['kind']=='badge':
        d.rounded_rectangle((1045,24,1254,63),12,fill=(8,11,18,180))
        d.text((1060,31),item['text'],font=font(18),fill=(234,237,242,255))
    elif item['kind']=='title':
        d.rounded_rectangle((215,523,1065,680),24,fill=(7,11,17,211),outline=(241,201,133,100),width=1)
        centered(d,item['text'],540,font(42),'#F1C985')
        centered(d,item['sub'],607,font(25),(241,242,246,255))
    elif item['kind']=='name':
        d.rounded_rectangle((30,26,335,108),15,fill=(8,11,18,190))
        d.text((48,35),item['text'],font=font(30),fill=color)
        d.text((48,78),item['sub'],font=font(15),fill=(226,229,235,255))
    elif item['kind']=='caption':
        d.rounded_rectangle((170,622,1110,694),16,fill=(7,11,17,220))
        centered(d,item['text'],636,font(34),(250,248,244,255))
        d.rounded_rectangle((194,646,201,673),3,fill=color)
    img.save(item['path'])
`;
const render=spawnSync(process.env.PYTHON_PATH||'python',['-X','utf8','-c',python],{input:JSON.stringify(overlays),encoding:'utf8',maxBuffer:2_000_000});
if(render.status!==0) throw new Error(`字幕图层绘制失败：${render.stderr}`);
if(args.includes('--prepare')) {
  console.log(JSON.stringify({status:'overlays_ready',count:overlays.length,directory:overlayDir},null,2)); process.exit(0);
}

const videos=lines.map(l=>({id:l.id,path:join(root,'clips',`${l.id}_t1.mp4`),line:l}));
const waitUntil=Date.now()+15*60*1000;
let missing=videos.filter(v=>!existsSync(v.path));
if(missing.length&&args.includes('--wait')) {
  console.log(`等待4条真实视频文件；当前缺少：${missing.map(v=>v.id).join('、')}。`);
  while(missing.length&&Date.now()<waitUntil){ await new Promise(r=>setTimeout(r,3000)); missing=videos.filter(v=>!existsSync(v.path)); }
}
if(missing.length) {
  writeFileSync(reportPath,JSON.stringify({status:'awaiting_real_inputs',missing:missing.map(v=>({id:v.id,path:v.path})),output_created:false},null,2)+'\n');
  console.error(`真实视频未齐备，没有生成成片：${missing.map(v=>v.id).join('、')}。`); process.exit(2);
}
const probe=path=>JSON.parse(execFileSync(ffprobe,['-v','error','-show_format','-show_streams','-of','json',path],{encoding:'utf8'}));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const shiftFile=join(work,'shifts.json');
const shiftDoc=existsSync(shiftFile)?JSON.parse(readFileSync(shiftFile,'utf8')):{};
const retimeFile=join(work,'retimes.json');
const retimeDoc=existsSync(retimeFile)?JSON.parse(readFileSync(retimeFile,'utf8')):{};
function advanceFor(id){
  const array=Array.isArray(shiftDoc)?shiftDoc:Array.isArray(shiftDoc.clips)?shiftDoc.clips:Array.isArray(shiftDoc.shifts)?shiftDoc.shifts:null;
  const value=array?.find(x=>x.id===id)??shiftDoc[id]??shiftDoc.shifts?.[id]??shiftDoc.clips?.[id]??0;
  const number=Number(typeof value==='object'?(value.advance_seconds??value.shift_seconds??value.shift??value.advance_s??value.offset_seconds??0):value);
  if(!Number.isFinite(number)||Math.abs(number)>5) throw new Error(`${id} 的偏移需为正负5秒以内的有限秒数。`);
  return number;
}
const shots=videos.map(v=>{
  const info=probe(v.path), stream=info.streams.find(s=>s.codec_type==='video');
  const sourceDuration=Number(stream?.duration??info.format?.duration);
  if(!stream||!Number.isFinite(sourceDuration)||sourceDuration<=0) throw new Error(`${v.id} 缺少有效视频流。`);
  const advance=advanceFor(v.id), inPoint=Math.max(0,advance), startHold=Math.max(0,-advance);
  const retime=retimeFor(retimeDoc,v.id,sourceDuration,slot,advance);
  if(retime)return {id:v.id,path:v.path,sha256:hash(v.path),source_duration:sourceDuration,requested_advance_seconds:0,source_in:0,source_out:retime.control_points.at(-1)[0],
    start_frame_hold_seconds:0,end_frame_hold_seconds:0,slot_start:v.line.start,slot_end:v.line.end,slot_duration:slot,retime,
    source_stream:{width:stream.width,height:stream.height,fps:stream.avg_frame_rate}};
  if(inPoint>=sourceDuration) throw new Error(`${v.id} 偏移裁掉了全部源画面。`);
  const available=sourceDuration-inPoint, used=Math.min(available,Math.max(0,slot-startHold)), endHold=Math.max(0,slot-startHold-used);
  return {id:v.id,path:v.path,sha256:hash(v.path),source_duration:sourceDuration,requested_advance_seconds:advance,source_in:inPoint,source_out:inPoint+used,
    start_frame_hold_seconds:startHold,end_frame_hold_seconds:Number(endHold.toFixed(6)),slot_start:v.line.start,slot_end:v.line.end,slot_duration:slot,source_stream:{width:stream.width,height:stream.height,fps:stream.avg_frame_rate}};
});
const ffArgs=['-hide_banner','-loglevel','warning','-y','-loop','1','-framerate','25','-i',poster];
for(const s of shots){ if(s.source_in>0) ffArgs.push('-ss',String(s.source_in)); ffArgs.push('-i',s.path); }
ffArgs.push('-i',mix);
for(const o of overlays) ffArgs.push('-loop','1','-framerate','1','-i',o.path);
const size='scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1';
const graph=[`[0:v]${size},split=2[still0][still1]`,`[still0]trim=duration=${intro},setpts=PTS-STARTPTS,fps=25[intro]`,
  `[still1]trim=duration=${grid.outro_duration},setpts=PTS-STARTPTS,fps=25[outro]`];
shots.forEach((s,i)=>{
  if(s.retime)appendRetimeGraph(graph,`${i+1}:v`,`c${i}`,s.retime,{size,prefix:`rt${i}`,duration:slot});
  else graph.push(`[${i+1}:v]setpts=PTS-STARTPTS,${size},fps=25,tpad=start_mode=clone:start_duration=${s.start_frame_hold_seconds}:stop_mode=clone:stop_duration=${slot},trim=duration=${slot},setpts=PTS-STARTPTS[c${i}]`);
});
graph.push(`[intro]${shots.map((_,i)=>`[c${i}]`).join('')}[outro]concat=n=6:v=1:a=0,fps=24,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=${total},format=yuv420p[base]`);
overlays.forEach((o,i)=>{
  const input=i===0?'base':`ov${i-1}`, output=i===overlays.length-1?'out':`ov${i}`;
  graph.push(`[${input}][${6+i}:v]overlay=0:0:enable='gte(t,${o.start})*lt(t,${o.end})':format=auto[${output}]`);
});
ffArgs.push('-filter_complex_threads','2','-filter_complex',graph.join(';'),'-map','[out]','-map','5:a:0','-t',String(total),'-r','24','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',rendering);
const started=Date.now();
try { execFileSync(ffmpeg,ffArgs,{stdio:['ignore','pipe','pipe'],maxBuffer:5_000_000}); }
catch(error){ writeFileSync(reportPath,JSON.stringify({status:'render_failed',elapsed_ms:Date.now()-started,error:String(error.stderr||error.message),shots},null,2)+'\n');throw new Error('FFmpeg组装失败，诊断已写入assembly-report.json。'); }
const result=probe(rendering), video=result.streams.find(s=>s.codec_type==='video'), audio=result.streams.find(s=>s.codec_type==='audio');
const measured=Number(result.format.duration), passed=video.width===1280&&video.height===720&&video.avg_frame_rate==='24/1'&&Math.abs(measured-total)<0.05&&audio?.codec_name==='aac';
if(passed) renameSync(rendering,target);
const report={status:passed?'completed':'validation_failed',output:passed?target:rendering,sha256:hash(passed?target:rendering),parameters:{width:1280,height:720,fps:24,video_codec:'h264',audio_codec:'aac',audio_bitrate:192000,audio_sample_rate:48000,crf:20},
  total_duration:measured,expected_duration:total,video_frames:Number(video.nb_frames),elapsed_ms:Date.now()-started,poster:{path:poster,sha256:hash(poster)},audio:{path:mix,sha256:hash(mix),source_clip_audio_used:false},
  shift_source:existsSync(shiftFile)?shiftFile:null,shift_meaning:'正值多裁源片开头，负值在源前定格；不足以末帧补齐',retime_source:existsSync(retimeFile)?retimeFile:null,shots,
  subtitles:lines.map(l=>({id:l.id,start:l.heard_start,end:Math.min(l.end,l.heard_end+0.15),text:l.text})),
  checks:{dimensions:video.width===1280&&video.height===720,fps:video.avg_frame_rate==='24/1',duration:Math.abs(measured-total)<0.05,audio_codec:audio?.codec_name==='aac'},limitations:['源片是否说对歌词、角色一致性与口型自然度需人工看片确认。','偏移或retime只移动画面，统一配音和节拍时间轴保持固定。','启用retime的片段只按声学活动分组启发式修节奏，非逐词ASR/非口型证明；原片音轨QA失败不会被回填参考音频改成通过。']};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
if(!passed) throw new Error('成片参数检查未通过，请查看assembly-report.json。');
console.log(JSON.stringify({status:'completed',output:target,total_duration:measured,video_frames:report.video_frames,holds:shots.map(s=>({id:s.id,start:s.start_frame_hold_seconds,end:s.end_frame_hold_seconds}))},null,2));
