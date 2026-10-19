/**
 * 节奏预演：使用参考静态图运镜，明确尚未生成口型。
 * 独立于真实视频组装器，不读取/写入clips，不改变锁定音频。
 * node scripts/preview.mjs
 */
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),work=join(root,'work');
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg',ffprobe=process.env.FFPROBE_PATH||'ffprobe';
const overlayDir=join(work,'preview-overlays'),finalDir=join(root,'final');
mkdirSync(overlayDir,{recursive:true});mkdirSync(finalDir,{recursive:true});
const output=join(finalDir,'libai-dufu-rhythm-preview-v1.mp4'),rendering=join(finalDir,'libai-dufu-rhythm-preview-v1.rendering.mp4');
const mix=join(work,'music_final.wav'),linePath=join(work,'lines.json'),gridPath=join(work,'grid.json');
const sources=[{id:'stage',path:join(root,'refs','poets-stage-v1.png')},{id:'libai',path:join(root,'refs','libai-v1.png')},{id:'dufu',path:join(root,'refs','dufu-v1.png')}];
for(const p of [mix,linePath,gridPath,...sources.map(s=>s.path)])if(!existsSync(p))throw new Error(`缺少预演素材：${p}`);
const lines=JSON.parse(readFileSync(linePath,'utf8')).lines,grid=JSON.parse(readFileSync(gridPath,'utf8'));
const total=grid.total_duration,intro=grid.intro_duration,slot=4.8;
if(total!==24||lines.length!==4)throw new Error('预演要求4句、总时长24秒。');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const lockedAudioHash=sha(mix);
const overlays=[
 {id:'preview-label',kind:'label',text:'节奏预演 · 静态图运镜',sub:'尚未生成口型',start:0,end:24},
 {id:'preview-intro',kind:'title',text:'李白 × 杜甫 · 节奏预演',sub:'静态图运镜 / 尚未生成口型',start:0,end:intro},
 {id:'preview-outro',kind:'title',text:'四句节奏，先听一回合。',sub:'静态图运镜 / 尚未生成口型',start:21.6,end:24},
 {id:'preview-libai',kind:'name',text:'李白',sub:'自由月光 / ROUND 01',start:2.4,end:12,color:'#F1C985'},
 {id:'preview-dufu',kind:'name',text:'杜甫',sub:'人间风霜 / ROUND 02',start:12,end:21.6,color:'#9DDCE7'},
 ...lines.map(l=>({id:`preview-caption-${l.id}`,kind:'caption',text:l.text,start:l.heard_start,end:Math.min(l.end,l.heard_end+0.15),color:l.actor==='李白'?'#F1C985':'#9DDCE7'}))
].map(o=>({...o,path:join(overlayDir,`${o.id}.png`)}));
const py=String.raw`
import sys,os,json
from PIL import Image,ImageDraw,ImageFont
items=json.load(sys.stdin)
fp=os.environ.get('CJK_FONT_PATH','C:/Windows/Fonts/msyh.ttc')
if not os.path.isfile(fp): raise RuntimeError('缺少中文字体，请设置CJK_FONT_PATH。')
def font(n): return ImageFont.truetype(fp,n)
def center(d,text,y,size,fill):
 f=font(size); b=d.textbbox((0,0),text,font=f)
 d.text(((1280-b[2]+b[0])/2,y),text,font=f,fill=fill,stroke_width=1,stroke_fill=(0,0,0,160))
for o in items:
 im=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(im)
 if o['kind']=='label':
  d.rounded_rectangle((855,20,1256,103),14,fill=(7,11,17,226),outline=(241,201,133,170),width=1)
  d.text((876,31),o['text'],font=font(24),fill='#F1C985')
  d.text((876,67),o['sub'],font=font(20),fill=(249,246,239,255))
 elif o['kind']=='title':
  d.rounded_rectangle((170,518,1110,685),24,fill=(7,11,17,225),outline=(241,201,133,120),width=1)
  center(d,o['text'],539,40,'#F1C985')
  center(d,o['sub'],606,28,(249,246,239,255))
 elif o['kind']=='name':
  d.rounded_rectangle((30,26,335,108),15,fill=(8,11,18,190))
  d.text((48,35),o['text'],font=font(30),fill=o['color'])
  d.text((48,78),o['sub'],font=font(15),fill=(226,229,235,255))
 elif o['kind']=='caption':
  d.rounded_rectangle((170,622,1110,694),16,fill=(7,11,17,220))
  center(d,o['text'],636,34,(250,248,244,255))
  d.rounded_rectangle((194,646,201,673),3,fill=o['color'])
 im.save(o['path'])
`;
const drawing=spawnSync(process.env.PYTHON_PATH||'python',['-X','utf8','-c',py],{input:JSON.stringify(overlays),encoding:'utf8',maxBuffer:2_000_000});
if(drawing.status!==0)throw new Error(`预演中文包装失败：${drawing.stderr}`);
const ffArgs=['-hide_banner','-loglevel','warning','-y'];
for(const s of sources)ffArgs.push('-i',s.path);
ffArgs.push('-i',mix);
for(const o of overlays)ffArgs.push('-loop','1','-framerate','1','-i',o.path);
// 每段先生成25fps，使2.4/4.8秒均落在完整帧边界；统一拼接后输出24fps。
const graph=[
 '[0:v]scale=2560:1440,setsar=1,split=2[stage0][stage1]',
 '[1:v]scale=2560:1440,setsar=1,split=2[li0][li1]',
 '[2:v]scale=2560:1440,setsar=1,split=2[du0][du1]',
 "[stage0]zoompan=z='1.005+0.00025*on':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=60:s=1280x720:fps=25,setpts=PTS-STARTPTS[v0]",
 "[li0]zoompan=z='1.02+0.0005*on':x='(iw-iw/zoom)*(0.45+0.10*on/119)':y='(ih-ih/zoom)*0.40':d=120:s=1280x720:fps=25,setpts=PTS-STARTPTS[v1]",
 "[li1]zoompan=z='1.085-0.00035*on':x='(iw-iw/zoom)*(0.56-0.10*on/119)':y='(ih-ih/zoom)*0.40':d=120:s=1280x720:fps=25,setpts=PTS-STARTPTS[v2]",
 "[du0]zoompan=z='1.02+0.0005*on':x='(iw-iw/zoom)*(0.55-0.10*on/119)':y='(ih-ih/zoom)*0.40':d=120:s=1280x720:fps=25,setpts=PTS-STARTPTS[v3]",
 "[du1]zoompan=z='1.06+0.0002*on':x='(iw-iw/zoom)*(0.44+0.10*on/119)':y='(ih-ih/zoom)*0.40':d=120:s=1280x720:fps=25,setpts=PTS-STARTPTS[v4]",
 "[stage1]zoompan=z='1.03-0.0002*on':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=60:s=1280x720:fps=25,setpts=PTS-STARTPTS[v5]",
 '[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0,fps=24,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=24,format=yuv420p[base]'
];
overlays.forEach((o,i)=>graph.push(`[${i===0?'base':`ov${i-1}`}][${4+i}:v]overlay=0:0:enable='gte(t,${o.start})*lt(t,${o.end})':format=auto[${i===overlays.length-1?'out':`ov${i}`}]`));
ffArgs.push('-filter_complex_threads','2','-filter_complex',graph.join(';'),'-map','[out]','-map','3:a:0','-t','24','-r','24','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',rendering);
const started=Date.now();
try{execFileSync(ffmpeg,ffArgs,{stdio:['ignore','pipe','pipe'],maxBuffer:5_000_000});}
catch(error){writeFileSync(join(work,'preview-report.json'),JSON.stringify({status:'render_failed',method:'静态图运镜节奏预演，尚未生成口型',error:String(error.stderr||error.message)},null,2)+'\n');throw new Error('预演渲染失败，诊断已保存。');}
const result=JSON.parse(execFileSync(ffprobe,['-v','error','-show_format','-show_streams','-of','json',rendering],{encoding:'utf8'}));
const video=result.streams.find(s=>s.codec_type==='video'),audio=result.streams.find(s=>s.codec_type==='audio'),duration=Number(result.format.duration);
const checks={dimensions:video?.width===1280&&video?.height===720,fps:video?.avg_frame_rate==='24/1',frames:Number(video?.nb_frames)===576,duration:Math.abs(duration-24)<0.05,
 video_codec:video?.codec_name==='h264',audio_codec:audio?.codec_name==='aac',audio_unchanged:sha(mix)===lockedAudioHash};
const passed=Object.values(checks).every(Boolean);
if(passed)renameSync(rendering,output);
const report={status:passed?'completed':'validation_failed',output:passed?output:rendering,sha256:sha(passed?output:rendering),duration,video_frames:Number(video.nb_frames),
 method:'参考静态图轻微推近/平移＋4.8秒切镜＋已生成真实双人TTS和原创节拍；尚未生成口型',is_lipsync_video:false,is_static_image_camera_preview:true,
 parameters:{width:1280,height:720,fps:24,video_codec:'h264',audio_codec:'aac',audio_bitrate:192000,audio_sample_rate:48000,crf:20},
 sources:sources.map(s=>({...s,sha256:sha(s.path)})),audio:{path:mix,sha256:lockedAudioHash,modified:false},elapsed_ms:Date.now()-started,
 slots:lines.map(l=>({id:l.id,actor:l.actor,start:l.start,end:l.end,source:l.actor_id==='libai'?sources[1].path:sources[2].path,method:'静态参考图轻微运镜'})),
 label:{text:'节奏预演 · 静态图运镜 / 尚未生成口型',start:0,end:24},subtitles:lines.map(l=>({id:l.id,start:l.heard_start,end:Math.min(l.end,l.heard_end+0.15),text:l.text})),
 checks,limitations:['此视频没有口部运动或音画口型同步。','人声为节奏化TTS，不是Suno或歌曲模型生成的演唱。','不能据此评价H3口型、人物动作和视频生成质量。']};
writeFileSync(join(work,'preview-report.json'),JSON.stringify(report,null,2)+'\n');
if(!passed)throw new Error('预演参数验证失败，查看preview-report.json。');
for(const [name,at]of[['preview-intro',1.2],['preview-libai',3.6],['preview-dufu',13.2]])execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss',String(at),'-i',output,'-frames:v','1','-q:v','2',join(finalDir,`${name}.jpg`)],{stdio:['ignore','pipe','pipe']});
console.log(JSON.stringify({status:'completed',output,duration,video_frames:Number(video.nb_frames),checks,sha256:report.sha256},null,2));
