"""Locate known song phrases in short independent windows; candidate times only."""
from pathlib import Path
import argparse,hashlib,json,time
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'music'/'source-jing-feng-shuang.mp3'
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=SOURCE);parser.add_argument('--label',default='mix');args=parser.parse_args()
MODEL=ROOT/'work'/'model-cache'/'faster-whisper-base'
OUT=ROOT/'work'/'source-analysis'/f'phrase-windows-{args.label}.json'
windows=[('A01',17,23.9),('A02',23.7,28.1),('B01',27.5,33.0),('B02',32.5,37.4),('B02-repeat-candidate',50.5,57.0),('late-tail-check',56.5,63.26)]
pcm=decode_audio(str(args.input),sampling_rate=16000)
model=WhisperModel(str(MODEL),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
settings=dict(language='zh',task='transcribe',beam_size=5,temperature=0.0,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,repetition_penalty=1.15,no_repeat_ngram_size=7)
run={'schema_version':1,'status':'running','source':str(args.input),'sha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),'model':'Systran/faster-whisper-base','model_revision':'ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66','settings':settings,'lyrics_hint':False,'paid_calls':0,'kind':'短窗辅助定位，非confirmed timeline；重复抑制仅防解码循环，窗口间互相独立','windows':[]}
def save():OUT.write_text(json.dumps(run,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save()
for id,start,end in windows:
    t=time.monotonic();segments,info=model.transcribe(pcm[round(start*16000):round(end*16000)],**settings)
    out=[]
    for s in segments:
      out.append({'start':start+s.start,'end':start+s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob,'compression_ratio':s.compression_ratio,'words':[{'start':start+w.start,'end':start+w.end,'word':w.word,'probability':w.probability}for w in(s.words or [])]})
    item={'id':id,'window':[start,end],'segments':out,'elapsed_s':round(time.monotonic()-t,3)};run['windows'].append(item);save();print(json.dumps(item,ensure_ascii=False),flush=True)
run['status']='completed';save()
