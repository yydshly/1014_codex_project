"""Import/analyze the new complete user song. Local cached ASR only; no new models."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,subprocess,time
import numpy as np
import soundfile as sf
import librosa

ROOT=Path(__file__).resolve().parent.parent
USER=Path('C:/Users/yun68/Downloads/压轴人间.mp3')
SOURCE=ROOT/'music/source-ya-zhou-ren-jian.mp3'
WORK=ROOT/'work'
MODEL=ROOT.parent/'002-moon-and-earth/work/model-cache/faster-whisper-base'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def level(x):
 peak=float(np.max(np.abs(x)));rms=float(np.sqrt(np.mean(x*x)))
 return {'sample_peak_linear':peak,'sample_peak_dbfs':float(20*np.log10(peak))if peak else None,'rms_dbfs':float(20*np.log10(rms))if rms else None,'float_samples_abs_ge_1':int(np.sum(np.abs(x)>=1)),'all_samples_finite':bool(np.isfinite(x).all()),'oversampled_true_peak_measured':False}
source_hash=sha(USER)
SOURCE.parent.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
if SOURCE.exists():assert sha(SOURCE)==source_hash,'existing new-song source differs; refusing overwrite'
else:SOURCE.write_bytes(USER.read_bytes())
assert sha(SOURCE)==source_hash
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(SOURCE)],encoding='utf-8'))
stereo,sr=sf.read(str(SOURCE),always_2d=True)
pcm48=subprocess.check_output(['ffmpeg','-v','error','-xerror','-i',str(SOURCE),'-map','0:a:0','-ar','48000','-ac','2','-f','f32le','pipe:1'])
stereo48=np.frombuffer(pcm48,dtype='<f4').reshape(-1,2)
hop10=round(sr*.01);rms=np.array([np.sqrt(np.mean(stereo[i:i+hop10]**2))for i in range(0,len(stereo),hop10)])
def ranges(mask):
 d=np.diff(np.r_[False,mask,False].astype(int));starts=np.flatnonzero(d==1);ends=np.flatnonzero(d==-1)
 return [[round(a*hop10/sr,6),round(min(len(stereo)/sr,b*hop10/sr),6)]for a,b in zip(starts,ends)if(b-a)*hop10/sr>=.3]
quiet={str(db):ranges(rms<=10**(db/20))for db in [-50,-70,-100]};zero=ranges(rms<=1e-12)
y=librosa.resample(np.mean(stereo,axis=1),orig_sr=sr,target_sr=22050)
analysis_sr=22050;hop=256
onset=librosa.onset.onset_strength(y=y,sr=analysis_sr,hop_length=hop,aggregate=np.median)
tempo,beats=librosa.beat.beat_track(onset_envelope=onset,sr=analysis_sr,hop_length=hop,start_bpm=100,tightness=80,trim=False)
times=librosa.frames_to_time(beats,sr=analysis_sr,hop_length=hop)
slope,intercept=np.polyfit(np.arange(len(times)),times,1)
beat_records=[{'time_s':round(float(t),6),'inside_near_silence':any(a<=t<=b for a,b in quiet['-70'])}for t in times]
peaks=librosa.onset.onset_detect(onset_envelope=onset,sr=analysis_sr,hop_length=hop,backtrack=False,units='time')
energy=[{'start_s':float(i),'end_s':float(min(i+1,len(stereo)/sr)),'rms_dbfs':float(20*np.log10(max(np.sqrt(np.mean(stereo[round(i*sr):round(min(i+1,len(stereo)/sr)*sr)]**2)),1e-12)))}for i in range(int(np.ceil(len(stereo)/sr)))]
report={'schema_version':1,'experiment_id':'004-performance-film','status':'imported_signal_analysis_complete_asr_pending','created_at':datetime.now(timezone.utc).isoformat(),
 'source':{'original_local_path':str(USER),'original_filename':USER.name,'path':'music/source-ya-zhou-ren-jian.mp3','bytes':SOURCE.stat().st_size,'sha256':source_hash,'user_file_byte_identity':SOURCE.read_bytes()==USER.read_bytes(),'provider':'用户提供，生成平台与具体模型未独立核验','probe':probe},
 'preservation':{'full_song_required':True,'music_trimmed':False,'time_stretched':False,'gain_applied_to_source':False,'prior_38_24_edit_is_superseded':True},
 'decoded':{'native_sample_rate':sr,'native_channels':stereo.shape[1],'native_sample_frames':len(stereo),'native_duration_s':len(stereo)/sr,'at_48k_stereo_frames':len(stereo48),'at_48k_duration_s':len(stereo48)/48000},
 'float_levels':{'native':level(stereo),'48k_stereo':level(stereo48)},
 'quiet_analysis':{'method':'10ms stereo RMS; intervals at least0.3s,not mono phase cancellation','threshold_ranges_dbfs':quiet,'near_digital_zero_ranges_rms_le_1e_minus12':zero},
 'beat_estimate':{'method':'librosa beat_track; not musical ground truth','librosa':librosa.__version__,'analysis_sample_rate':analysis_sr,'hop':hop,'tempo_bin_bpm':float(np.asarray(tempo).item()),'beat_regression_bpm':float(60/slope),'beat_times':beat_records,'onset_times_s':[round(float(t),6)for t in peaks],'limitations':['拍点可能错相/半拍/倍拍，近静音中的拍点可能是内插，不作乐谱真值。','按实际演唱段落分组，不强制固定102BPM。']},
 'one_second_energy':energy,'asr':{'status':'pending','lyrics_hint':False,'model':'Systran/faster-whisper-base','new_model_downloads':0},'paid_calls':0,'network_calls':0,'models_downloaded':False,'older_experiments_modified':False}
save(WORK/'new-song-analysis.json',report)
print(json.dumps({'imported':True,'sha256':source_hash,'duration_s':len(stereo)/sr,'peak':report['float_levels'],'quiet':quiet,'tempo':report['beat_estimate']['beat_regression_bpm']},ensure_ascii=False),flush=True)

from faster_whisper import WhisperModel
settings=dict(language='zh',task='transcribe',beam_size=5,temperature=0.0,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,repetition_penalty=1.15,no_repeat_ngram_size=7)
asr={'schema_version':1,'status':'running','source_sha256':source_hash,'source_path':'music/source-ya-zhou-ren-jian.mp3','lyrics_hint':False,'settings':settings,'model':{'repo':'Systran/faster-whisper-base','revision':'ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66','cached_local_directory':str(MODEL),'new_model_downloads':0,'remote_code_executed':False},'paid_calls':0,'network_calls':0,'segments':[]}
asr_path=WORK/'new-song-asr-base-unprompted.json';save(asr_path,asr)
model=WhisperModel(str(MODEL),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
start=time.monotonic();segments,info=model.transcribe(str(SOURCE),**settings)
for s in segments:
 item={'start':s.start,'end':s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob,'compression_ratio':s.compression_ratio,'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability}for w in(s.words or [])]}
 asr['segments'].append(item);save(asr_path,asr);print(json.dumps({k:item[k]for k in ['start','end','text','avg_logprob','no_speech_prob']},ensure_ascii=False),flush=True)
asr.update(status='completed',duration_s=info.duration,elapsed_s=round(time.monotonic()-start,3),text=''.join(s['text']for s in asr['segments']),source_unchanged=sha(SOURCE)==source_hash)
save(asr_path,asr)
report.update(status='signal_and_unprompted_asr_complete_pending_lyric_comparison',asr={'status':'completed','path':'work/new-song-asr-base-unprompted.json','sha256':sha(asr_path),'lyrics_hint':False,'model':'Systran/faster-whisper-base','new_model_downloads':0})
save(WORK/'new-song-analysis.json',report)
print(json.dumps({'asr_complete':True,'elapsed_s':asr['elapsed_s'],'segments':len(asr['segments'])},ensure_ascii=False),flush=True)
