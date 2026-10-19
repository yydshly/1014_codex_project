"""Export exact H3 reference WAVs; no model/API call, no timing or pitch changes."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,subprocess
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parent.parent
PLAN=ROOT/'work/audio-edit-plan.json'
SOURCE=ROOT.parent/'002-moon-and-earth/music/source-jing-feng-shuang.mp3'
EDIT=ROOT/'music/editorial-song-v4.wav'
OUT=ROOT/'music/drivers'
SR=48000;GAIN_DB=-1.5
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
plan=json.loads(PLAN.read_text(encoding='utf-8'))
assert plan['status']=='approved-for-production'
source_sha=sha(SOURCE);edit_sha=sha(EDIT)
assert source_sha==plan['source']['sha256']=='91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8'
assert edit_sha==plan['output']['wav']['sha256']=='0c8580e73d360b26165aa1efef253d225f69d15e7fc02829f206dc78120939ec'
pcm=subprocess.check_output(['ffmpeg','-v','error','-xerror','-i',str(SOURCE),'-map','0:a:0','-ar',str(SR),'-ac','2','-f','f32le','pipe:1'])
source=np.frombuffer(pcm,dtype='<f4').reshape(-1,2).astype(np.float64)
edited,edit_sr=sf.read(str(EDIT),always_2d=True);assert edit_sr==SR
defs=[
 {'id':'A-performance-10s','source_in':18.2,'source_out':28.2,'duration_s':10,'actor':'李白','target_in':6.32,'target_out':16.32,
  'intended_use':'同一驱动可供两个不同新机位分别生成，不将两机位当同一原片裁切。',
  'lyrics':[{'id':'A01','text':'酒杯一举，银河都来捧场','driver_heard_candidate':[.48,4.48],'target_heard_candidate':[6.8,10.8],'echo_candidate':[4.42,5.56]},{'id':'A02','text':'你的工整，装不下我的月光','driver_heard_candidate':[5.5,9.24],'target_heard_candidate':[11.82,15.56]}]},
 {'id':'B-performance-10s','source_in':27.6,'source_out':37.6,'duration_s':10,'actor':'杜甫','target_in':15.72,'target_out':25.72,
  'intended_use':'同一驱动可供两个不同新机位分别生成；保留B01起字前上下文。',
  'lyrics':[{'id':'B01','text':'月光再亮，也得照见风霜','driver_heard_candidate':[.7,4.58],'target_heard_candidate':[16.42,20.3]},{'id':'B02','text':'我把人间，写成压轴的回响','driver_heard_candidate':[5.5,9.16],'target_heard_candidate':[21.22,24.88]}]},
 {'id':'R-performance-5s','source_in':51.2,'source_out':56.2,'duration_s':5,'actor':'杜甫','target_in':30.6,'target_out':35.6,
  'intended_use':'末句重唱的独立新镜头驱动；不同于002/003复用旧末句画面。',
  'lyrics':[{'id':'B02-reprise','text':'我把人间，写成压轴的回响','driver_heard_candidate':[.4,4.4],'target_heard_candidate':[31.,35.]}]}
]
OUT.mkdir(parents=True,exist_ok=True)
records=[]
def write_driver(d,data):
 path=OUT/(d['id']+'.wav');sf.write(str(path),data,SR,subtype='PCM_24')
 decoded,sr=sf.read(str(path),always_2d=True);peak=float(np.max(np.abs(decoded)))
 assert sr==SR and len(decoded)==round(d['duration_s']*SR) and np.isfinite(decoded).all()and peak<1
 d.update(path=str(path.relative_to(ROOT)).replace('\\','/'),sha256=sha(path),bytes=path.stat().st_size,sample_rate=SR,channels=2,encoding='PCM_24',sample_frames=len(decoded),decoded_duration_s=len(decoded)/SR,
          source_song_sha256=source_sha,formal_music_sha256=edit_sha,time_stretch=False,pitch_shift=False,contains_original_accompaniment=True,is_clean_vocal_stem=False,
          level={'float_sample_peak_dbfs':float(20*np.log10(peak))if peak else None,'samples_abs_ge_1':int(np.sum(np.abs(decoded)>=1)),'all_samples_finite':True})
 records.append(d)
for d in defs:
 a,b=round(d['source_in']*SR),round(d['source_out']*SR)
 samples=source[a:b]*10**(GAIN_DB/20)
 d.update(status='ready_for_new_video_reference',source_kind='preserved original full mix excerpt',gain_db=GAIN_DB,formal_target_mapping={'start':d['target_in'],'end':d['target_out'],'offset_from_driver_zero_s':d['target_in'],'note':'完整驱动覆盖的正式剪辑区间；导演可从中选取对应机位，交接处不拼接原片音轨。'})
 write_driver(d,samples)
intro={'id':'intro-5s','duration_s':5,'actor':None,'status':'optional_transition_reference_candidate','source_kind':'approved editorial song excerpt','editorial_source_in':0,'editorial_source_out':5,
       'source_in':11.88,'source_out':16.88,'target_in':0,'target_out':5,'gain_db_already_applied_in_formal_song':-1.5,'additional_gain_db':0,
       'intended_use':'可选过场驱动；正式音乐0–5秒器乐，不包含已知主唱；未决定是否提交。','lyrics':[],'formal_target_mapping':{'start':0,'end':5,'offset_from_driver_zero_s':0,'note':'直接取正式音乐，不重复施加-1.5dB。'}}
write_driver(intro,edited[:5*SR])
assert sha(SOURCE)==source_sha and sha(EDIT)==edit_sha
result={'schema_version':1,'experiment_id':'004-performance-film','status':'drivers_ready_no_video_calls','created_at':datetime.now(timezone.utc).isoformat(),
 'formal_music_status':'approved-for-production','audio_edit_plan':'work/audio-edit-plan.json','audio_edit_plan_sha256':sha(PLAN),
 'source_song':{'path':'../002-moon-and-earth/music/source-jing-feng-shuang.mp3','sha256':source_sha,'unchanged':True},'formal_music':{'path':'music/editorial-song-v4.wav','sha256':edit_sha,'duration_s':38.24,'already_gain_adjusted_db':-1.5,'unchanged':True},
 'drivers':records,'new_generation_calls':0,'asr_calls':0,'network_calls':0,
 'notes':['所有表演驱动来自原曲真实对应段，保留伴奏，只作恒定-1.5dB缩放，不变速或移调。','已知歌词窗口完整位于驱动内，未用ASR识别错字修改正文。','A/B参考有0.6秒重叠，最终以正式音乐统一配回，不重放重叠音轨。','R驱动覆盖正式30.6–35.6秒，末字约35.0秒结束；后续画面收束可接器乐段，不能假称驱动延伸到35.8秒。','intro只取已正式音轨0–5秒，不重复施加增益；它是可选候选，不表示已付费生成。','正式音乐已经-1.5dB；成片再次配回时应使用0dB额外增益。','驱动文件不证明生成后歌词、声线或嘴形准确，返回原片仍需检查。']}
save(OUT/'manifest.json',result)
print(json.dumps({'status':result['status'],'manifest':'music/drivers/manifest.json','drivers':[{'id':d['id'],'path':d['path'],'duration_s':d['duration_s'],'sha256':d['sha256'],'source':[d['source_in'],d['source_out']],'target':[d['target_in'],d['target_out']],'level':d['level']}for d in records]},ensure_ascii=False,indent=2))
