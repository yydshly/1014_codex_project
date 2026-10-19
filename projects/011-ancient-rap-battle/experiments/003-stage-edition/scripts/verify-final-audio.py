"""Verify final stage AAC against original song -1.5dB + approved ambience 0dB.

No rendering/replacing audio, no model/network calls, no writes to experiment 002.
This checks final soundtrack integrity, not model-native raw QA or mouth motion.
"""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,math,os,runpy,sys
import numpy as np
from scipy import signal

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT.parent/'002-moon-and-earth'
OUT=ROOT/'work/final-audio-verification.json'
SR=48000
SONG_SHA='91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8'
AMBIENCE_SHA='ed21ce561ee376f8912e96328d208f084dd22530dff424c8e46305049d5d0d09'
BASE_FINAL_SHA='88c112607640aeaa960a4682aca4a533781d58b82e658af4ad2777fa1848871e'
# Reuse read-only numerical helpers without importing/compiling into 002/__pycache__.
sys.dont_write_bytecode=True
HELPER=BASE/'scripts/verify-final-audio.py'
h=runpy.run_path(str(HELPER),run_name='readonly_audio_helpers')
sha,decode,probe,fit,find_lag,aligned,require,db=[h[k]for k in ['sha','decode','probe','fit','find_lag','aligned','require','db']]

def read(path):
 require(path.is_file(),f'真实输入尚未完成：{path.name}；不写核验报告。')
 return json.loads(path.read_text(encoding='utf-8'))
def inside(value,scope):
 require(isinstance(value,str)and bool(value),'缺少素材路径。')
 p=(ROOT/value).resolve();require(p.is_relative_to(scope.resolve())and p.is_file(),'素材越界或不存在。');return p
def subset(a,start,end):return a[round(start*SR):round(end*SR)]
def level(a):
 peak=float(np.max(np.abs(a)))
 return {'float_sample_peak_linear':peak,'float_sample_peak_dbfs':db(peak),'samples_abs_ge_1':int(np.sum(np.abs(a)>=1)),'all_samples_finite':bool(np.isfinite(a).all()),'oversampled_true_peak_measured':False}
def atomic_json(path,value):
 tmp=path.with_name(path.name+f'.{os.getpid()}.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8');tmp.replace(path)

def main():
 require(len(sys.argv)==1,'使用固定真实输入，不接受模拟文件参数。')
 report_path=ROOT/'work/final-report.json';timeline_path=ROOT/'work/timeline.json';manifest_path=ROOT/'work/stage-manifest.json'
 r,t,m=read(report_path),read(timeline_path),read(manifest_path)
 require(r.get('status')=='completed'and r.get('output_created')is True and r.get('experiment_id')=='003-stage-edition','舞台最终成片尚未completed。')
 require(t.get('status')=='confirmed'and t.get('experiment_id')=='003-stage-edition','舞台时间轴尚未confirmed。')
 final=inside(r.get('output'),ROOT/'final');song=inside(t.get('audio',{}).get('path'),BASE/'music')
 report_sha,timeline_sha,manifest_sha=sha(report_path),sha(timeline_path),sha(manifest_path)
 require(sha(final)==r.get('sha256')and sha(song)==SONG_SHA,'成片或原曲SHA不匹配。')
 require(r.get('inputs',{}).get('timeline',{}).get('sha256')==timeline_sha,'最终成片对应的时间轴已改变。')
 require(r.get('audio',{}).get('sha256')==SONG_SHA and r.get('audio',{}).get('gain_db')==-1.5,'合成报告的原歌来源/增益不符。')
 spec=m.get('stage_ambience',{});used=r.get('stage_ambience',{})
 require(spec.get('enabled')is True and spec.get('approved')is True and used.get('enabled')is True and used.get('approved')is True,'氛围未获准或报告未确认实际使用。')
 require(spec.get('gain_db')==0 and used.get('gain_db')==0,'本次预期为候选氛围0dB。')
 ambience=inside(spec.get('path'),ROOT/'music');require(sha(ambience)==AMBIENCE_SHA==used.get('sha256')==spec.get('sha256'),'候选氛围SHA不一致。')
 ambience_report_path=ROOT/'work/stage-ambience-report.json';ambience_report=read(ambience_report_path)
 require(ambience_report.get('output',{}).get('sha256')==AMBIENCE_SHA,'合成声来源记录不符。')
 base_report=read(BASE/'work/final-report.json');base_final=inside('../002-moon-and-earth/'+base_report.get('output',''),BASE/'final')
 require(base_report.get('status')=='completed'and sha(base_final)==BASE_FINAL_SHA==base_report.get('sha256'),'002比较成片已改变。')
 original_hashes={str(p):sha(p)for p in [song,BASE/'work/final-report.json',base_final,BASE/'music/source-import.json']}
 p=probe(final);streams=[s for s in p.get('streams',[])if s.get('codec_type')=='audio']
 require(len(streams)==1 and streams[0].get('codec_name')=='aac','舞台成片应含唯一原生最终AAC流。')
 source,room,actual,base_audio=decode(song),decode(ambience),decode(final),decode(base_final)
 expected_frames=round(63.28*SR)
 require(len(room)==expected_frames and len(source)<=expected_frames,'原曲/声效长度不符63.28s时间轴。')
 expected=np.zeros((expected_frames,2),np.float64)
 expected[:len(source)]=source.astype(np.float64)*10**(-1.5/20)
 expected+=room.astype(np.float64)
 protected=[[18.2,37.6],[51.2,56.4]]
 protected_room=[{'start':a,'end':b,**level(subset(room,a,b))}for a,b in protected]
 require(all(x['float_sample_peak_linear']==0 for x in protected_room),'候选掌声意外侵入主歌。')
 ref8=signal.resample_poly(np.mean(expected,axis=1),1,6);act8=signal.resample_poly(np.mean(actual.astype(np.float64),axis=1),1,6)
 coarse=find_lag(ref8,act8,int(len(ref8)*.1),int(len(ref8)*.8),0,2000);require(coarse is not None,'无法测量最终混音偏移。')
 coarse48=coarse['lag_samples_8k']*6
 rs=round(29*SR);rn=3*SR
 refinements=[]
 for lag in range(coarse48-6,coarse48+7):
  if 0<=rs+lag and rs+lag+rn<=len(actual):
   c=fit(expected[rs:rs+rn],actual[rs+lag:rs+lag+rn])['correlation']
   if c is not None:refinements.append((c,lag))
 require(refinements,'无法精修延迟。');lag=max(refinements)[1]
 x,y,si,fi,count=aligned(expected,actual,lag);overall=fit(x,y)
 windows=[]
 for center in np.linspace(2,61.28,11):
  found=find_lag(ref8,act8,round((center-1.5)*8000),24000,round(lag/6),2000)
  if not found:windows.append({'center_s':float(center),'measurable':False});continue
  ll=found['lag_samples_8k']*6;a,b=round((center-1.5)*SR),round((center+1.5)*SR)
  if a+ll<0 or b+ll>len(actual):continue
  windows.append({'center_s':float(center),'measurable':True,'local_lag_s':ll/SR,**found,**fit(expected[a:b],actual[a+ll:b+ll])})
 reliable=[w for w in windows if w.get('measurable')and(w.get('correlation')or 0)>.8 and(w.get('reference_rms_dbfs')or -100)>-50 and not w.get('at_search_boundary')]
 drift={'reliable_windows':len(reliable),'estimated_audio_speed_ratio':None,'predicted_end_to_end_lag_change_s':None}
 if len(reliable)>=3:
  slope,intercept=np.polyfit([w['center_s']for w in reliable],[w['local_lag_s']for w in reliable],1)
  drift.update(lag_slope_seconds_per_second=float(slope),estimated_audio_speed_ratio=float(1/(1+slope)),predicted_end_to_end_lag_change_s=float(slope*63.28))
 vocals=[]
 for start,end in protected:
  a,b=round(start*SR),round(end*SR)
  require(a+lag>=0 and b+lag<=len(actual)and b<=len(base_audio),'主歌边界超出真实成片。')
  vocals.append({'start':start,'end':end,'ambience_peak_is_zero':True,'comparison':'003最终AAC vs 002最终AAC，同一原歌同一时刻',**fit(base_audio[a:b],actual[a+lag:b+lag])})
 added=[]
 for start,end in [[38.5,47.0],[60.9,63.28]]:
  a,b=round(start*SR),round(end*SR)
  delta=actual[a+lag:b+lag].astype(np.float64)-base_audio[a:b].astype(np.float64)
  added.append({'start':start,'end':end,'comparison':'003 AAC减002 AAC相对独立氛围候选，源曲此段近数字零；仅用于确认新增声效实际存在',**fit(room[a:b],delta)})
 notes=[]
 if lag!=0:notes.append('对齐偏移不是0，需核对编码延迟和时间映射。')
 if(overall.get('correlation')or 0)<.95:notes.append('相对预期完整混音相关性低于0.95，需审听。')
 if overall.get('gain_db')is None or abs(overall['gain_db'])>.3:notes.append('相对已含-1.5dB歌曲+0dB氛围的预期混音，额外增益偏离0dB超过0.3dB。')
 if any((v.get('correlation')or 0)<.99 for v in vocals):notes.append('部分主歌与002的相关性低于0.99，需检查有无新增声音侵入。')
 actual_level=level(actual)
 if actual_level['samples_abs_ge_1']:notes.append('最终浮点AAC有>=1采样，需检查播放削波。')
 require(all(sha(Path(k))==v for k,v in original_hashes.items()),'核验期间002输入变化；不写报告。')
 require(sha(final)==r['sha256']and sha(ambience)==AMBIENCE_SHA and sha(report_path)==report_sha and sha(timeline_path)==timeline_sha and sha(manifest_path)==manifest_sha,'003输入在核验期间变化。')
 now=datetime.now(timezone.utc).isoformat()
 result={'schema_version':1,'experiment_id':'003-stage-edition','status':'measured_needs_review','measured_at':now,
 'purpose':'最终AAC相对原歌-1.5dB+获准合成现场效果0dB的完整性核验；不是原片模型native QA或音素口型证明。',
 'sources':{'song':{'path':'../002-moon-and-earth/music/source-jing-feng-shuang.mp3','sha256':SONG_SHA,'gain_db':-1.5,'decoded_frames_48k':len(source)},'stage_ambience':{'path':spec['path'],'sha256':AMBIENCE_SHA,'gain_db':0,'decoded_frames_48k':len(room),'is_real_recording':False},'base_002_final':{'path':'../002-moon-and-earth/'+base_report['output'],'sha256':BASE_FINAL_SHA}},
 'final':{'path':r['output'],'sha256':r['sha256'],'probe':p},'preconditions':{'completed_report_sha256':report_sha,'confirmed_timeline_sha256':timeline_sha,'approved_manifest_sha256':manifest_sha,'numerical_helper_sha256':sha(HELPER),'source_hashes_verified':True,'no_writes_to_002':True},
 'expected_mix':{'formula':'pad(original song decoded48k*10**(-1.5/20),63.28s)+stage ambience WAV decoded48k*1.0','normalize':False,'limiter':False,'frames':expected_frames,'duration_s':63.28,'level':level(expected)},
 'decode':{'sample_rate':SR,'channels':2,'format':'f32le','expected_frames':len(expected),'actual_frames':len(actual),'actual_duration_s':len(actual)/SR,'full_decode_completed':True,'all_samples_finite':bool(np.isfinite(actual).all())},
 'alignment':{'coarse_8k':coarse,'lag_frames_48k':lag,'lag_s':lag/SR,'reference_start_frame':si,'actual_start_frame':fi,'compared_frames':count,'uncovered_expected_start_frames':si,'uncovered_expected_end_frames':len(expected)-si-count,'uncovered_original_song_start_frames':min(si,len(source)),'uncovered_original_song_end_frames':max(0,len(source)-si-count),'actual_extra_tail_frames':len(actual)-fi-count},
 'overall_relative_to_expected_mix':overall,'local_windows':windows,'timing_drift':drift,'protected_vocal_ambience_levels':protected_room,'protected_vocal_comparison_to_002':vocals,'ambience_presence_in_quiet_song_regions':added,'final_float_level':actual_level,
 'advisories':notes,'automatic_pass':None,'manual_audio_review':'required','lip_sync_verified':None,'paid_calls':0,'audio_replaced_or_modified_by_verifier':False,
 'limitations':['新增掌声是获准独立合成声源；比较对象必须是两声源预期混音，不能把它当作原歌曲漂移或换音。','AAC有损编码产生残差，相关性和增益不要求逐样本镜像。','主歌与002对比只验证相同音乐段，没有验证嘴形。','极低电平或静音窗口可能不能估计可靠偏移。']}
 atomic_json(OUT,result)
 # Preserve the original candidate report before recording actual render use.
 snapshot=ROOT/'work/stage-ambience-candidate-report-v1.json'
 if not snapshot.exists():snapshot.write_bytes(ambience_report_path.read_bytes())
 usage={'final_path':r['output'],'final_sha256':r['sha256'],'final_report':'work/final-report.json','final_report_sha256':report_sha,'gain_db':0,'verified_at':now,'audio_verification':'work/final-audio-verification.json'}
 ambience_report.update(status='used_in_final',used_in_final=True,candidate_record={'path':'work/stage-ambience-candidate-report-v1.json','sha256':sha(snapshot),'initial_status':'candidate_not_approved'})
 references=ambience_report.setdefault('render_references',[])
 if not any(x.get('final_sha256')==r['sha256']for x in references):references.append(usage)
 atomic_json(ambience_report_path,ambience_report)
 print(json.dumps({'status':result['status'],'final_sha256':r['sha256'],'lag_s':lag/SR,'overall':overall,'float_level':actual_level,'vocal_comparison':vocals,'ambience_presence':added,'advisories':notes,'report':'work/final-audio-verification.json'},ensure_ascii=False,indent=2))

if __name__=='__main__':
 try:main()
 except(Exception)as error:
  print(f'舞台最终音乐核验未执行或未完成：{error}',file=sys.stderr);raise SystemExit(2)
