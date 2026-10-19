"""MV edit candidate from the existing user song only; no models/new sound/music."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,subprocess
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT.parent/'002-moon-and-earth/music/source-jing-feng-shuang.mp3'
WAV=ROOT/'music/editorial-song-v4.wav';MP3=ROOT/'music/editorial-song-v4.mp3'
REPORT=ROOT/'work/audio-edit-plan.json'
SR=48000;GAIN_DB=-1.5;CROSSFADE_FRAMES=1920
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source_hash=sha(SOURCE)
assert source_hash=='91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8'
data=subprocess.check_output(['ffmpeg','-v','error','-xerror','-i',str(SOURCE),'-map','0:a:0','-ar',str(SR),'-ac','2','-f','f32le','pipe:1'])
song=np.frombuffer(data,dtype='<f4').reshape(-1,2).astype(np.float64)
segments=[
 {'id':'intro-and-four-lines','source_in':11.88,'source_out':38.40,'target_in':0.0,'target_out':26.52,'reason':'从有实际起音的约11.89秒段落进入，保留约6.3秒开场和四句全部主唱，直到原曲衰减进入静默。'},
 {'id':'music-return-and-reprise','source_in':47.08,'source_out':56.60,'target_in':26.48,'target_out':36.00,'reason':'从数字静音末端进入约47.11秒声音重入，保留B02完整重唱及其尾音。'},
 {'id':'final-resolution','source_in':58.92,'source_out':61.20,'target_in':35.96,'target_out':38.24,'reason':'省略重唱后的一个器乐过渡，提前接入约58.96秒起音与最终音乐收束，只留短静音余位。'}]
pieces=[]
for s in segments:
 a,b=round(s['source_in']*SR),round(s['source_out']*SR)
 s.update(source_in_frame=a,source_out_frame=b,target_in_frame=round(s['target_in']*SR),target_out_frame=round(s['target_out']*SR),source_to_target_offset_s=round(s['target_in']-s['source_in'],6),speed=1.0,pitch_shift=0)
 pieces.append(song[a:b].copy())
out=pieces[0]
crossfades=[]
for i,piece in enumerate(pieces[1:],1):
 ramp=np.linspace(0,1,CROSSFADE_FRAMES,endpoint=True)[:,None]
 cross=out[-CROSSFADE_FRAMES:]*(1-ramp)+piece[:CROSSFADE_FRAMES]*ramp
 start=len(out)-CROSSFADE_FRAMES
 crossfades.append({'target_start_s':start/SR,'target_end_s':len(out)/SR,'duration_s':CROSSFADE_FRAMES/SR,
 'method':'linear equal-gain crossfade; outgoing+incoming weights=1','outgoing_source_range_s':[(segments[i-1]['source_out_frame']-CROSSFADE_FRAMES)/SR,segments[i-1]['source_out']],
 'incoming_source_range_s':[segments[i]['source_in'],(segments[i]['source_in_frame']+CROSSFADE_FRAMES)/SR],
 'touches_known_vocal_window':False})
 out=np.concatenate([out[:-CROSSFADE_FRAMES],cross,piece[CROSSFADE_FRAMES:]],axis=0)
out*=10**(GAIN_DB/20)
# Edge ramps are outside all vocal windows; final ramp is already in source silence.
fadein=round(.006*SR);fadeout=round(.08*SR)
out[:fadein]*=np.linspace(0,1,fadein)[:,None];out[-fadeout:]*=np.linspace(1,0,fadeout)[:,None]
assert len(out)==1835520
WAV.parent.mkdir(parents=True,exist_ok=True);REPORT.parent.mkdir(parents=True,exist_ok=True)
sf.write(str(WAV),out,SR,subtype='PCM_24')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(WAV),'-c:a','libmp3lame','-b:a','192k',str(MP3)],check=True)
decoded,_=sf.read(str(WAV),always_2d=True)
mp3_bytes=subprocess.check_output(['ffmpeg','-v','error','-i',str(MP3),'-ac','2','-ar',str(SR),'-f','f32le','pipe:1'])
mp3_decoded=np.frombuffer(mp3_bytes,dtype='<f4').reshape(-1,2)
def levels(a):
 peak=float(np.max(np.abs(a)));rms=float(np.sqrt(np.mean(a*a)))
 return {'float_sample_peak':peak,'float_sample_peak_dbfs':float(20*np.log10(peak))if peak else None,'rms_dbfs':float(20*np.log10(rms))if rms else None,'samples_abs_ge_1':int(np.sum(np.abs(a)>=1)),'all_samples_finite':bool(np.isfinite(a).all()),'oversampled_true_peak_measured':False}
known=[('A01','李白','酒杯一举，银河都来捧场',18.68,22.68,0),('A02','李白','你的工整，装不下我的月光',23.70,27.44,0),('B01','杜甫','月光再亮，也得照见风霜',28.30,32.18,0),('B02','杜甫','我把人间，写成压轴的回响',33.10,36.76,0),('B02-reprise','杜甫','我把人间，写成压轴的回响',51.60,55.60,1)]
lines=[]
for id,actor,text,a,b,index in known:
 s=segments[index];offset=s['target_in']-s['source_in'];ta,tb=round(a+offset,6),round(b+offset,6)
 source_samples=song[round(a*SR):round(b*SR)]*10**(GAIN_DB/20)
 output_samples=decoded[round(ta*SR):round(tb*SR)]
 assert source_samples.shape==output_samples.shape
 difference=float(np.max(np.abs(source_samples-output_samples)))
 assert difference<=1.3e-7
 lines.append({'id':id,'actor':actor,'text':text,'source_heard_candidate':[a,b],'target_heard_candidate':[ta,tb],
 'segment_id':s['id'],'no_time_stretch':True,'no_cut_inside_known_vocal_window':True,'max_absolute_difference_to_source_after_declared_gain':difference,
 'wording_source':'用户确认的四句；时间沿用既有ASR/声学候选，未重新跑模型。','manual_audition_required':True})
for a in [decoded,mp3_decoded]:assert np.isfinite(a).all()and np.max(np.abs(a))<1
assert sha(SOURCE)==source_hash
result={'schema_version':1,'experiment_id':'004-performance-film','status':'listening_candidate_not_approved','created_at':datetime.now(timezone.utc).isoformat(),
 'title':'敬风霜 · MV音乐剪辑候选','source':{'path':'../002-moon-and-earth/music/source-jing-feng-shuang.mp3','sha256':source_hash,'provider_claim':'用户称由Gemini生成，未独立核验模型','decoded_sample_rate':SR,'decoded_frames':len(song),'decoded_duration_s':len(song)/SR,'original_unchanged':True},
 'output':{'wav':{'path':'music/editorial-song-v4.wav','bytes':WAV.stat().st_size,'sha256':sha(WAV),'sample_rate':SR,'channels':2,'encoding':'PCM_24','decoded_frames':len(decoded),'decoded_duration_s':len(decoded)/SR},
 'mp3':{'path':'music/editorial-song-v4.mp3','bytes':MP3.stat().st_size,'sha256':sha(MP3),'sample_rate':SR,'channels':2,'bitrate':192000,'decoded_frames':len(mp3_decoded),'decoded_duration_s':len(mp3_decoded)/SR}},
 'edit':{'original_song_unedited':False,'description':'这是原曲音乐剪辑版，非原歌全曲未经剪辑；保留四主句与末句重唱。','duration_s':len(decoded)/SR,'target_video_fps':25,'target_video_frames':956,'intro_until_actor_handoff_s':6.32,'intro_until_first_known_voice_s':6.80,'tail_after_last_known_voice_s':3.24,
 'gain_db':GAIN_DB,'gain_reason':'保留整数PCM余量；只做恒定幅度缩放，无压缩器/归一化/新增伴奏。','new_melody':False,'stage_ambience_added':False,'new_sound_sources':False,'model_calls':0,'network_calls':0,'paid_calls':0,'time_stretch':False,'pitch_shift':False,'edge_fade_in_s':.006,'edge_fade_out_s':.08},
 'segments':segments,'crossfades':crossfades,'removed_source_ranges':[{'start':0,'end':11.88,'reason':'压缩开场，保留原有起音进入与约6.8秒可闻前奏'},{'start':38.4,'end':47.08,'reason':'移除约8.68秒近数字静音，不把它当器乐持续段'},{'start':56.60,'end':58.92,'reason':'省略无已知歌唱的一段器乐过渡，接入最终收束'},{'start':61.20,'end':len(song)/SR,'reason':'移除歌曲结束后大部分数字静音'}],
 'lyric_occurrences':lines,'echo_candidate':{'text_status':'第一句尾词重复候选，不擅自新增文字','source':[22.62,23.76],'target':[10.74,11.88],'preserved':True},
 'level_checks':{'wav':levels(decoded),'mp3':levels(mp3_decoded)},'source_files_001_002_003_modified':False,
 'limitations':['歌词位置是既有候选区间，保留完整窗口与前后余量不等于逐字人工确认。','两处短线性交叉淡化仅连接器乐/近静音，没有在已知歌唱区间交叉混唱。','先试听衔接和收束再确认音乐定稿，当前没有生成视频或更新网页。','电平检查为浮点采样峰值，不是过采样真峰值。']}
REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps({'status':result['status'],'duration_s':len(decoded)/SR,'output':result['output'],'segments':segments,'lyric_targets':[{'id':x['id'],'target':x['target_heard_candidate']}for x in lines],'levels':result['level_checks'],'original_unchanged':True},ensure_ascii=False,indent=2))
