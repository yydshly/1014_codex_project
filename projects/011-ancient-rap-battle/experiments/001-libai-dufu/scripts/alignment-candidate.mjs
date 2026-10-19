/** 只生成A02画面时轴修正候选，回填原参考音频；原QA仍false，不用于假验收。 */
import{readFileSync,writeFileSync,existsSync,mkdirSync,renameSync}from'node:fs';
import{resolve,dirname,join}from'node:path';
import{fileURLToPath}from'node:url';
import{execFileSync,spawnSync}from'node:child_process';
import{createHash}from'node:crypto';
import{retimeFor,appendRetimeGraph}from'./retime.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),work=join(root,'work'),finalDir=join(root,'final');
mkdirSync(finalDir,{recursive:true});
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg',ffprobe=process.env.FFPROBE_PATH||'ffprobe';
const raw=join(root,'clips','A02_t1.mp4'),reference=join(work,'audio','A02.mp3'),config=join(work,'retimes.json');
for(const p of[raw,reference,config])if(!existsSync(p))throw new Error(`缺少A02候选输入：${p}`);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),probe=p=>JSON.parse(execFileSync(ffprobe,['-v','error','-show_format','-show_streams','-of','json',p],{encoding:'utf8'}));
const rawHash=hash(raw),referenceHash=hash(reference),rawProbe=probe(raw),source=rawProbe.streams.find(s=>s.codec_type==='video'),duration=Number(source.duration);
const retime=retimeFor(JSON.parse(readFileSync(config,'utf8')),'A02',duration,4.8,0);
if(!retime)throw new Error('A02没有启用retime。');
const banner=join(work,'A02-alignment-label.png'),caption=join(work,'overlays','caption-A02.png');
const py=String.raw`
import sys
from PIL import Image,ImageDraw,ImageFont
im=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(im)
f=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
d.rounded_rectangle((25,18,1255,104),16,fill=(7,11,17,225))
d.text((46,28),'A02 · 时轴修正候选',font=f(27),fill='#F1C985')
d.text((46,68),'声学分组启发式 · 非逐词 / 非口型证明 · 原片音轨 QA 仍失败',font=f(20),fill=(245,244,242,255))
im.save(sys.argv[1])
`;
const label=spawnSync(process.env.PYTHON_PATH||'python',['-X','utf8','-c',py,banner],{encoding:'utf8'});
if(label.status!==0)throw new Error(label.stderr);
if(!existsSync(caption))throw new Error('缺少A02字幕PNG，请先运行assemble.mjs --prepare。');
const target=join(finalDir,'A02-alignment-candidate.mp4'),rendering=join(finalDir,'A02-alignment-candidate.rendering.mp4');
const graph=[],size='scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1';
appendRetimeGraph(graph,'0:v','adjusted',retime,{size,prefix:'a02',duration:4.8});
const line=JSON.parse(readFileSync(join(work,'lines.json'),'utf8')).lines.find(l=>l.id==='A02');
const localStart=Number((line.heard_start-line.start).toFixed(3)),localEnd=Number((line.heard_end-line.start+0.15).toFixed(3));
graph.push('[adjusted][2:v]overlay=0:0:format=auto[banner]');
graph.push(`[banner][3:v]overlay=0:0:enable='gte(t,${localStart})*lt(t,${localEnd})':format=auto[out]`);
graph.push('[1:a]asetpts=PTS-STARTPTS,apad=whole_dur=4.8,atrim=duration=4.8[audio]');
execFileSync(ffmpeg,['-hide_banner','-loglevel','warning','-y','-i',raw,'-i',reference,'-loop','1','-framerate','1','-i',banner,'-loop','1','-framerate','1','-i',caption,
 '-filter_complex_threads','2','-filter_complex',graph.join(';'),'-map','[out]','-map','[audio]','-t','4.8','-r','25','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',rendering],{stdio:['ignore','pipe','pipe'],maxBuffer:5_000_000});
const result=probe(rendering),v=result.streams.find(s=>s.codec_type==='video'),a=result.streams.find(s=>s.codec_type==='audio');
const checks={dimensions:v.width===1280&&v.height===720,fps:v.avg_frame_rate==='25/1',frames:Number(v.nb_frames)===120,video_duration:Math.abs(Number(v.duration)-4.8)<0.001,container_duration:Math.abs(Number(result.format.duration)-4.8)<0.01,
 raw_unchanged:hash(raw)===rawHash,reference_unchanged:hash(reference)===referenceHash,audio_codec:a.codec_name==='aac'};
const passed=Object.values(checks).every(Boolean);if(passed)renameSync(rendering,target);
const report={status:passed?'candidate_created':'candidate_validation_failed',output:passed?target:rendering,sha256:hash(passed?target:rendering),method:retime.method,reason:retime.reason,
 raw_source:{path:raw,sha256:rawHash,source_duration:duration,source_in:0,source_out:retime.control_points.at(-1)[0],modified:false},
 reference_audio:{path:reference,sha256:referenceHash,modified:false,replaces_generated_audio:true},retime,parameters:{width:1280,height:720,fps:25,frames:Number(v.nb_frames),duration:Number(result.format.duration),video_codec:v.codec_name,audio_codec:a.codec_name},
 original_audio_screening_passed:false,sync_passed:false,checks,limitations:['声学活动分组只提供启发式画面变速控制点，不代表逐词或逐音素口型准确。','候选回填原参考音频，只供带声观看；不能拿回填后的音轨相关度替代原片QA。','原始A02视频与参考音频字节均保持不变，原片音轨筛查失败状态保留。']};
writeFileSync(join(work,'A02-alignment-report.json'),JSON.stringify(report,null,2)+'\n');
if(!passed)throw new Error('A02候选参数检查失败。');
console.log(JSON.stringify({status:report.status,output:target,duration:report.parameters.duration,fps:25,frames:report.parameters.frames,raw_unchanged:checks.raw_unchanged,sync_passed:false},null,2));
