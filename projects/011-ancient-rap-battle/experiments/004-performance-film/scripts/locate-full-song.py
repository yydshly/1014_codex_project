"""Independent short-window cached base ASR; never rewrite raw text as reference."""
from pathlib import Path
import json,hashlib,time,argparse
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'music/source-ya-zhou-ren-jian.mp3'
MODEL=ROOT.parent/'002-moon-and-earth/work/model-cache/faster-whisper-base'
parser=argparse.ArgumentParser();parser.add_argument('--hint-reference',action='store_true');parser.add_argument('--windows',default='0:15,12:27,24:39,36:51,48:63,60:75,72:87,84:94.62');parser.add_argument('--label',default='');args=parser.parse_args()
windows=[tuple(float(x)for x in p.split(':'))for p in args.windows.split(',')]
suffix=('-'+args.label)if args.label else''
out=ROOT/'work'/(('new-song-asr-window-hinted'if args.hint_reference else'new-song-asr-window-unprompted')+suffix+'.json')
settings=dict(language='zh',task='transcribe',beam_size=5,temperature=0.0,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,repetition_penalty=1.15,no_repeat_ngram_size=7)
if args.hint_reference:
 raw=(ROOT/'docs/full-song-lyrics.txt').read_text(encoding='utf-8')
 settings['initial_prompt']='\n'.join(x.strip()for x in raw.splitlines()if x.strip()and not x.strip().startswith('['))
report={'schema_version':1,'status':'running','source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'lyrics_hint':args.hint_reference,'settings':settings,'model':'Systran/faster-whisper-base','model_revision':'ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66','new_models_downloaded':False,'paid_calls':0,'network_calls':0,'windows':[]}
def save():out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save();audio=decode_audio(str(SOURCE),sampling_rate=16000);model=WhisperModel(str(MODEL),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
for start,end in windows:
 parts=[];ts=time.monotonic();segments,info=model.transcribe(audio[round(start*16000):round(end*16000)],**settings)
 for s in segments:
  parts.append({'start':start+s.start,'end':start+s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob,'words':[{'start':start+w.start,'end':start+w.end,'word':w.word,'probability':w.probability}for w in(s.words or [])]})
 item={'window':[start,end],'segments':parts,'elapsed_s':round(time.monotonic()-ts,3)};report['windows'].append(item);save();print(json.dumps(item,ensure_ascii=False),flush=True)
report['status']='completed';save()
