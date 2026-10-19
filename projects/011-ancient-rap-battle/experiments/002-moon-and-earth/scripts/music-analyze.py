"""Read-only analysis of user supplied music; local ASR, no paid calls, no remote code."""
from __future__ import annotations
from pathlib import Path
import hashlib
import importlib.metadata
import json
import subprocess
import time
import argparse

ROOT=Path(__file__).resolve().parent.parent
MUSIC=ROOT/'music'
WORK=ROOT/'work'/'source-analysis'
WORK.mkdir(parents=True,exist_ok=True)
SOURCE=MUSIC/'source-jing-feng-shuang.mp3'
TINY=ROOT.parent/'001-libai-dufu'/'work'/'model-cache'/'faster-whisper-tiny'
EXPECTED=['酒杯一举，银河都来捧场','你的工整，装不下我的月光','月光再亮，也得照见风霜','我把人间，写成压轴的回响']
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--model-dir',type=Path,default=TINY);parser.add_argument('--model-name',default='tiny');parser.add_argument('--hint-lyrics',action='store_true');parser.add_argument('--chunk-seconds',type=float,default=0);parser.add_argument('--range-start',type=float,default=0);parser.add_argument('--range-end',type=float,default=0);parser.add_argument('--input',type=Path,default=SOURCE);parser.add_argument('--prevent-repetition',action='store_true');args=parser.parse_args()
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(SOURCE)],text=True,encoding='utf-8'))
    source_hash=sha(SOURCE)
    save(MUSIC/'source-import.json',{'schema_version':1,'status':'imported_awaiting_alignment','source_kind':'用户提供音乐文件','provider_claim':'用户称Gemini生成，未独立核实生成平台或模型','user_confirmed_lyrics':EXPECTED,'lyrics_confirmation':'用户确认仍是前面四句，具体唱法/重复和时间以音轨分析为准','original_filename':'敬风霜.mp3','original_local_path':'C:/Users/yun68/Downloads/敬风霜.mp3','preserved_copy':'music/source-jing-feng-shuang.mp3','bytes':SOURCE.stat().st_size,'sha256':source_hash,'probe':probe,'paid_generation_calls_for_import':0,'audio_modified':False})
    from faster_whisper import WhisperModel
    settings=dict(language='zh',task='transcribe',beam_size=5,temperature=0.0,word_timestamps=True,vad_filter=False,condition_on_previous_text=False)
    if args.prevent_repetition:settings.update(repetition_penalty=1.15,no_repeat_ngram_size=7)
    if args.hint_lyrics:settings['initial_prompt']='\n'.join(EXPECTED)
    run={'schema_version':1,'status':'running','kind':'ASR候选，不是歌词确认或精确强制对齐','model':{'name':args.model_name,'local_dir':str(args.model_dir),'data_files_sha256':{p.name:sha(p) for p in args.model_dir.iterdir() if p.is_file()},'remote_code_executed':False},'runtime':{'faster_whisper':importlib.metadata.version('faster-whisper'),'device':'cpu','compute_type':'int8','cpu_threads':4},'settings':settings,'lyrics_were_provided_as_hint':args.hint_lyrics,'source_sha256':source_hash,'paid_calls':0,'limitations':['歌曲人声和伴奏重叠可能导致漏词/错字/幻觉，时间戳可能偏移','已知歌词由用户确认；ASR结果单独保留，不据识别错字修改正文','内部概率不是识别准确率；不能证明逐音素口型同步'],'segments':[]}
    run.update(chunk_seconds=args.chunk_seconds,input_path=str(args.input),input_sha256=sha(args.input),range_start=args.range_start,range_end=args.range_end or None)
    suffix=(f'-range{args.range_start:g}-{args.range_end:g}' if args.range_end else '')+('-filtered' if args.input!=SOURCE else '')+('-norepeat' if args.prevent_repetition else '')
    out=WORK/f'asr-{args.model_name}{"-hinted" if args.hint_lyrics else "-unprompted"}{f"-chunks{args.chunk_seconds:g}" if args.chunk_seconds else ""}{suffix}.json';save(out,run)
    model=WhisperModel(str(args.model_dir),device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
    started=time.monotonic()
    if args.chunk_seconds or args.range_end:
        from faster_whisper.audio import decode_audio
        import numpy as np
        pcm=decode_audio(str(args.input),sampling_rate=16000)
        duration=len(pcm)/16000
        if args.range_end:chunks=[(args.range_start,pcm[round(args.range_start*16000):round(args.range_end*16000)])]
        else:chunks=[(x,pcm[round(x*16000):round(min(duration,x+args.chunk_seconds)*16000)]) for x in np.arange(0,duration,args.chunk_seconds)]
    else:chunks=[(0,str(args.input))];duration=float(probe['format']['duration'])
    for offset,chunk in chunks:
      segments,info=model.transcribe(chunk,**settings)
      for s in segments:
        item={'start':offset+s.start,'end':offset+s.end,'text':s.text,'avg_logprob':s.avg_logprob,'no_speech_prob':s.no_speech_prob,'compression_ratio':s.compression_ratio,'chunk_start':offset,'words':[{'start':offset+w.start,'end':offset+w.end,'word':w.word,'probability':w.probability} for w in (s.words or [])]}
        run['segments'].append(item);save(out,run);print(json.dumps({k:item[k] for k in ['start','end','text','avg_logprob','no_speech_prob']},ensure_ascii=False),flush=True)
    run.update(status='completed',elapsed_s=round(time.monotonic()-started,3),duration_s=duration,text=''.join(s['text'] for s in run['segments']),source_unchanged=sha(SOURCE)==source_hash);save(out,run)
    print(json.dumps({'status':'completed','path':str(out),'elapsed_s':run['elapsed_s']},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
