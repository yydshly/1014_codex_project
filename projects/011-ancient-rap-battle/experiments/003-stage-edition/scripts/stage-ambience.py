"""Original sparse synthetic applause/room candidate. No model, samples or network."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json
import numpy as np
import soundfile as sf
from scipy import signal

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT.parent/'002-moon-and-earth/music/source-jing-feng-shuang.mp3'
OUT=ROOT/'music/stage-ambience-candidate-v1.wav'
REPORT=ROOT/'work/stage-ambience-report.json'
SR=48000;DURATION=63.28;SEED=2026101503
source_sha=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert source_sha=='91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8'
rng=np.random.default_rng(SEED)
samples=np.zeros((round(DURATION*SR),2),dtype=np.float64)
bandpass=signal.butter(3,[190,4200],btype='bandpass',fs=SR,output='sos')
distant_lowpass=signal.butter(2,2500,btype='lowpass',fs=SR,output='sos')
groups=[
 {'id':'opening-first-reveal','start':.55,'span':1.1,'count':6,'gain':.24,'meaning':'稀疏开场掌声，较轻，不能当真实观众录音'},
 {'id':'opening-character-one','start':5.65,'span':.65,'count':3,'gain':.18,'meaning':'角色亮相时少量掌声'},
 {'id':'opening-character-two','start':10.15,'span':.95,'count':4,'gain':.21,'meaning':'第二角色亮相时克制回应'},
 {'id':'opening-hush','start':15.75,'span':1.0,'count':4,'gain':.15,'meaning':'开唱前收势，18.2前完全落下'},
 {'id':'silent-break-acknowledgement','start':38.58,'span':1.0,'count':5,'gain':.17,'meaning':'停拍刚开始少量掌声，随后留白'},
 {'id':'silent-break-single-response','start':42.0,'span':.35,'count':2,'gain':.095,'meaning':'安静舞台中的零星回应，不填满整个静默段'},
 {'id':'closing-applause','start':60.9,'span':1.5,'count':20,'gain':.52,'meaning':'歌曲已结束后的小规模合成掌声，随片尾淡出'}]
events=[]

def add(at,data,gain,pan):
 i=round(at*SR)
 if i<0 or i>=len(samples):return
 count=min(len(data),len(samples)-i)
 left=np.cos((pan+1)*np.pi/4);right=np.sin((pan+1)*np.pi/4)
 samples[i:i+count,0]+=data[:count]*gain*left
 samples[i:i+count,1]+=data[:count]*gain*right

for group in groups:
 times=np.sort(group['start']+rng.uniform(0,group['span'],group['count']))
 for at in times:
  length=rng.uniform(.11,.17);t=np.arange(round(length*SR))/SR
  dry=np.zeros(len(t))
  # Several small palm contacts, rather than one snare-like transient.
  for offset,level in [(0,1),(.011,.48),(.026,.21)]:
   begin=round(offset*SR);q=t[:len(t)-begin]
   burst=rng.standard_normal(len(q))*(1-np.exp(-q*6500))*np.exp(-q*rng.uniform(70,100))
   dry[begin:]+=burst*level
  dry=signal.sosfilt(bandpass,dry)
  dry+=(np.sin(2*np.pi*rng.uniform(760,1050)*t)+.4*np.sin(2*np.pi*1300*t))*np.exp(-t*100)*.025
  peak=np.max(np.abs(dry));dry/=max(peak,1e-12)
  gain=group['gain']*rng.uniform(.65,1.05);pan=float(rng.uniform(-.8,.8))
  add(float(at),dry,gain,pan)
  reflected=signal.sosfilt(distant_lowpass,dry)
  # Finite room reflections only; there is no continuous noise bed.
  for j,delay in enumerate([.023,.047,.079,.121,.187,.281,.413,.612,.87]):
   level=.23*np.exp(-delay*3.6)*rng.uniform(.75,1.05)
   add(float(at+delay),reflected,gain*level,float(np.clip(-pan+(j%2-.5)*.4,-.95,.95)))
  events.append({'group':group['id'],'time_s':round(float(at),6),'pan':pan,'relative_dry_gain':gain})

# Absolute silence through the lead singing ranges; ambience never alters the song.
protection=np.ones(len(samples))
for start,end in [(18.2,37.6),(51.2,56.4)]:
 a,b=round(start*SR),round(end*SR);fade=round(.12*SR)
 protection[max(0,a-fade):a]*=np.linspace(1,0,min(fade,a),endpoint=False)
 protection[a:b]=0
 protection[b:min(len(samples),b+fade)]*=np.linspace(0,1,min(fade,len(samples)-b),endpoint=False)
samples*=protection[:,None]
intro_fade=np.clip(np.arange(len(samples))/SR/.12,0,1)
ending_fade=np.clip((DURATION-np.arange(len(samples))/SR)/.75,0,1)
samples*=(intro_fade*ending_fade)[:,None]
peak_before=float(np.max(np.abs(samples)))
master_gain=10**(-22/20)/max(peak_before,1e-12)
samples*=master_gain
OUT.parent.mkdir(parents=True,exist_ok=True);REPORT.parent.mkdir(parents=True,exist_ok=True)
sf.write(str(OUT),samples,SR,subtype='PCM_24')
decoded,sr=sf.read(str(OUT),always_2d=True)
peak=float(np.max(np.abs(decoded)))
def levels(start,end):
 part=decoded[round(start*SR):round(end*SR)]
 p=float(np.max(np.abs(part)));r=float(np.sqrt(np.mean(part**2)))
 return {'start':start,'end':end,'peak_dbfs':float(20*np.log10(p))if p else None,'rms_dbfs':float(20*np.log10(r))if r else None,'nonzero_sample_fraction':float(np.mean(np.abs(part)>1e-7))}
report={'schema_version':1,'experiment_id':'003-stage-edition','status':'candidate_not_approved','used_in_final':False,
 'created_at':datetime.now(timezone.utc).isoformat(),'kind':'原创程序合成现场效果，非真实观众/场地录音',
 'output':{'path':str(OUT.relative_to(ROOT)).replace('\\','/'),'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'duration_s':len(decoded)/SR,'sample_frames':len(decoded),'sample_rate':SR,'channels':2,'encoding':'PCM_24'},
 'method':{'seed':SEED,'instruments_or_sounds':['有限短噪声脉冲合成的掌声','短时空间反射衰减'],'external_samples':False,'downloaded_assets':False,'network_calls':0,'model_calls':0,'paid_calls':0,'continuous_noise_bed':False,'new_melody':False,'bandpass_hz':[190,4200],'room_reflection_lowpass_hz':2500,'maximum_reflection_delay_s':.87,'output_peak_target_dbfs':-22,'master_scalar':master_gain,'events_locked_to_music_beats':False},
 'groups':groups,'events':events,'protected_vocal_ranges':[[18.2,37.6],[51.2,56.4]],
 'level_check':{'all_samples_finite':bool(np.isfinite(decoded).all()),'float_sample_peak_linear':peak,'float_sample_peak_dbfs':float(20*np.log10(peak)),'samples_abs_ge_1':int(np.sum(np.abs(decoded)>=1)),'sample_peak_is_not_oversampled_true_peak':True,'segments':[levels(0,18.2),levels(18.2,37.6),levels(38.4,47.1),levels(51.2,56.4),levels(60.76,63.28)]},
 'recommended_mix':{'input_name':'stage_ambience','enabled_by_default':False,'candidate_gain_db':0,'quieter_alternative_gain_db':-3,'original_song_gain_db':-1.5,'original_song_remains_continuous':True,'instruction':'先审听再决定启用；此文件已做低音量分段编排，可从0dB相加开始试听，若抢戏降至-3dB或禁用，不以新增旋律填静音。'},
 'source_song':{'path':'../002-moon-and-earth/music/source-jing-feng-shuang.mp3','sha256':source_sha,'unchanged_after_generation':hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_sha},
 'limitations':['合成声效没有真实观众的行为或空间证据，不能称为现场实录。','掌声只提供克制的现场感候选，不掩盖主歌、不替换原曲，也不使静音区产生原本没有的音乐节拍。','当前仅输出候选；最终是否混入、采用何种音量由审听和最终合成记录决定。']}
assert len(decoded)==3037440 and np.isfinite(decoded).all() and np.max(np.abs(decoded))<1
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps({'status':report['status'],'output':report['output'],'peak_dbfs':report['level_check']['float_sample_peak_dbfs'],'clipped_samples':report['level_check']['samples_abs_ge_1'],'segment_levels':report['level_check']['segments'],'recommended_gain_db':0,'source_unchanged':report['source_song']['unchanged_after_generation']},ensure_ascii=False,indent=2))
