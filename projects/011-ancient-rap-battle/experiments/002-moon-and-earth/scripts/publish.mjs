/** Publish only a measured complete 002 film. No model calls or paid retries. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.resolve(root,'../../web/public');
const mode=process.argv[2];
assert(['--check','--publish'].includes(mode),'用法：node scripts/publish.mjs --check|--publish');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const [r,t,l,q,visual]=await Promise.all(['work/final-report.json','work/timeline.json','work/chatart-tasks.json','work/video-qa.json','work/visual-review.json'].map(read));
assert.equal(r.status,'completed'); assert.equal(t.status,'confirmed');
assert.equal(r.experiment_id,'002-moon-and-earth');
assert.equal(r.assembly.source_clips,2); assert.equal(r.assembly.unique_lyric_shots,4);
assert.equal(r.assembly.performance_occurrences,5);
assert(Object.values(r.checks).every(Boolean));
assert.equal(r.audio.alignment.original_audio_trimmed_seconds,0);
assert.equal(r.audio.alignment.original_audio_speed,1);
assert.equal(r.audio.source_clip_audio_used,false);
assert.equal(l.tasks.length,2); assert(l.tasks.every(s=>s.status==='downloaded'));
assert.equal(l.planned_credits,300); assert.equal(l.credit_cap,300);
const movie=await fs.readFile(path.join(root,r.output));
assert.equal(sha(movie),r.sha256); assert.equal(movie.length,r.size_bytes);
assert.equal(movie.toString('ascii',4,8),'ftyp');
const poster=await fs.readFile(path.join(root,t.poster));
assert.equal(sha(poster),r.inputs.poster.sha256);
const song=await fs.readFile(path.join(root,t.audio.path));
assert.equal(sha(song),l.source_song_sha256); assert.equal(sha(song),r.audio.sha256);
for(const task of l.tasks) {
 const bytes=await fs.readFile(path.join(root,task.clip));
 assert.equal(sha(bytes),task.output_sha256);
 assert.equal(q.clips[task.id].video_sha256,task.output_sha256);
 assert.equal(q.clips[task.id].audio_sha256,task.audio_sha256);
 assert.equal(q.clips[task.id].native_audio_only,true);
 assert.equal(q.clips[task.id].raw_download_hash_matched_ledger,true);
 assert.equal(visual.clips[task.id].video_sha256,task.output_sha256);
 assert.equal(visual.clips[task.id].accepted_for_demo,true);
 assert.equal(sha(await fs.readFile(path.join(root,task.audio))),task.audio_sha256);
 assert(r.source_files.some(s=>s.sha256===task.output_sha256));
}
const strip=value=>Array.isArray(value)?value.map(strip):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>k!=='absolute_path').map(([k,v])=>[k,strip(v)])):value;
const clips=t.lines.map(line=>{
 const task=l.tasks.find(s=>s.id===line.qa_id), raw=q.clips[line.qa_id];
 assert(task&&raw);
 const occurrences=t.visual_timeline.filter(s=>s.type==='performance'&&s.line_id===line.id).map(s=>{
  const shot=r.shots.find(x=>x.id===s.id); assert(shot);
  return {id:s.id,start:s.start,end:s.end,heard_start:s.heard_start,heard_end:s.heard_end,source_sha256:shot.sha256,
   source_in:shot.source_in,source_out:shot.source_out,...(shot.retime?{retime:shot.retime}:{}),same_lyric_reuse:s.id!==t.visual_timeline.find(x=>x.line_id===line.id)?.id};
 });
 const first=r.shots.find(s=>s.id===occurrences[0].id);
 return {id:line.id,actor:line.actor,text:line.text,start:line.start,end:line.end,heard_start:line.heard_start,heard_end:line.heard_end,
  status:'completed',video_generated:true,provider:'ChatArt',model_label:task.model_label,source_task_id:task.id,
  asset:{sha256:task.output_sha256,size_bytes:task.output_size_bytes},assembly:strip(first),occurrences,
  qa:{audio_match:raw.audio_match,correlation:raw.correlation,min_window_correlation:raw.min_window_correlation,
   thresholds:raw.thresholds,suggested_picture_advance_seconds:raw.suggested_picture_advance_seconds,
   video_sha256:raw.video_sha256,audio_sha256:raw.audio_sha256,checked_at:raw.checked_at,manual_lip_review:'required',
   scope:'下载原片原生混音与真实驱动混音的能量包络筛查；伴奏可能主导分数，不能证明口型或歌词准确。'}};
});
assert.equal(clips.reduce((n,c)=>n+c.occurrences.length,0),5);
const run={schema_version:1,title:t.title,status:'completed',generated_at:r.generated_at,
 provenance:{kind:'locally-produced',project_id:'011',experiment_id:'002-moon-and-earth'},
 production:{image_provider:'内置 ImageGen · 2位新人物、共同舞台与2张主题空镜，共5图',voice_provider:'用户提供歌曲内的原唱；未新增TTS或模仿真实人物声音',
  video_provider:'ChatArt 网页 · MiniMax H3 × 2；网页模型标签未独立验证',music_mode:'user-supplied-song',music_title:'敬风霜',
  music_provider:'用户提供《敬风霜》，用户说明由Gemini生成；具体模型未独立核验',bpm:102,bpm_is_estimate:true,total_duration:r.total_duration},
 video_service:{provider:'ChatArt',status:'completed',created_tasks:2,outputs_available:2,full_four_line_assembly:true},clips,
 cost:{provider:'ChatArt',video_credits_estimate:300,returned_clip_credits_estimate:300,video_credits_spent:null,credit_cap:300,invoice_verified:false,
  balance_before:l.credit_balance_before,balance_after:l.credit_balance_after_refresh??l.credit_balance_after,observed_balance_delta:l.observed_balance_delta,
  balance_delta_verified:l.balance_delta_verified,credit_observations:l.credit_observations,
  final_observed_balance:l.final_observed_balance,observed_final_balance_delta:l.observed_final_balance_delta,
  note:`两条10秒原片各标价150钻，共300，上限300，无付费重抽。${l.credit_note}`},
 assets:{video:{path:'media/own-libai-dufu-v1.mp4',size_bytes:r.size_bytes,sha256:r.sha256,width:r.parameters.width,height:r.parameters.height,fps:r.parameters.fps,video_codec:'h264',audio_codec:'aac'},
  poster:{path:'media/own-poets-v1.png',sha256:sha(poster)}},
 assembly:{...r.assembly,status:'completed',source_shots:4,source_hashes_verified:true,final_hash_verified:true,unified_audio:true,full_four_line_assembly:true,
  visual_summary:'两条10秒模型原片，剪成四句；末句同词复用一次，余下原创图像运镜。整首音乐保留，仅调整播放响度。'},
 source_files:strip(r.source_files),visual_timeline:strip(r.visual_timeline),audio:strip(r.audio),subtitles:r.subtitles,
 remote_generation:{provider:'ChatArt',status:'completed',submitted_clips:2,outputs_available:2,planned_credits:300,credit_cap:300,models:['MiniMax H3'],
  last_checked_at:l.last_checked_at,actual_credit_debit_verified:false,outputs:l.tasks.map(s=>({id:s.id,video_url:s.output_url,model:s.model_label,sha256:s.output_sha256}))},
 limitations:[...r.limitations,'歌词正文采用用户确认的四句；ASR只辅助定位，有同音误识别，字幕边界不是逐字强制对齐。',
  '末句重唱复用同句表演并调整画面时间，不算第三次视频生成；不宣称精准口型。',
  '歌曲出处为用户说明，Gemini具体模型与声音生成方式未独立核验；本轮未新增音乐或TTS调用。',
  '视频模型接收含伴奏的原唱混音，能量包络相关性可能受伴奏主导。',
  `两次任务页面标价共300钻；${l.credit_note}`]};
if(mode==='--publish') {
 const entries=[['media/own-libai-dufu-v1.mp4',movie],['media/own-poets-v1.png',poster],['data/own-sample-run.json',Buffer.from(JSON.stringify(run,null,2)+'\n')]];
 for(const [name,bytes]of entries){await fs.mkdir(path.dirname(path.join(web,name)),{recursive:true});await fs.writeFile(path.join(web,name+'.next'),bytes);}
 for(const [name]of entries)await fs.rename(path.join(web,name+'.next'),path.join(web,name));
 await fs.writeFile(path.join(root,'work/publish-report.json'),JSON.stringify({status:'published-local',at:new Date().toISOString(),video_sha256:r.sha256,source_song_sha256:l.source_song_sha256,public_files:entries.map(([p])=>p),deployed:false},null,2)+'\n');
}
console.log(JSON.stringify({status:mode==='--publish'?'published-local':'ready',duration:r.total_duration,source_clips:2,unique_lyrics:4,performance_occurrences:5,sha256:r.sha256,deployed:false},null,2));
