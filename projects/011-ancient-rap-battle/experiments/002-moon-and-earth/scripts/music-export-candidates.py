"""Export conservatively bounded full-mix reference blocks. No generation calls."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'music/source-jing-feng-shuang.mp3'
OUT=ROOT/'music/candidates';OUT.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels','-of','json',str(p)],text=True,encoding='utf-8'))
def decoded_duration(p):
    b=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-ar','44100','-ac','2','-f','f32le','pipe:1'])
    return len(b)/8/44100
source_hash=sha(SOURCE)
blocks=[{'id':'A-main','actor':'李白','source_in':18.2,'source_out':28.2,'lines':[{'id':'A01','text':'酒杯一举，银河都来捧场','heard_candidate':[.48,4.48],'echo_candidate':[4.42,5.56]},{'id':'A02','text':'你的工整，装不下我的月光','heard_candidate':[5.5,9.24]}]},
        {'id':'B-main','actor':'杜甫','source_in':27.6,'source_out':37.6,'lines':[{'id':'B01','text':'月光再亮，也得照见风霜','heard_candidate':[.7,4.58]},{'id':'B02','text':'我把人间，写成压轴的回响','heard_candidate':[5.5,9.16]}]}]
for block in blocks:
    block.update(duration_s=10,source_path='music/source-jing-feng-shuang.mp3',source_sha256=source_hash,source_kind='原始完整混音的时间截取，包含伴奏；不是分离人声',status='candidate_ready_for_review',amplitude_gain_db=-1.0,time_stretch=False,resample=False)
    # Original MP3 decodes slightly above 0 dBFS; a constant -1 dB scalar prevents integer WAV clipping.
    for ext,codec in [('wav',['-c:a','pcm_s24le']),('mp3',['-c:a','libmp3lame','-b:a','192k'])]:
        path=OUT/f'{block["id"]}-mix-candidate.{ext}'
        af=f'atrim=start={block["source_in"]}:end={block["source_out"]},asetpts=PTS-STARTPTS,volume=-1dB'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(SOURCE),'-af',af,'-ar','44100','-ac','2',*codec,str(path)],check=True)
        duration=decoded_duration(path)
        if abs(duration-10)>1/44100:raise RuntimeError('reference_block_duration_mismatch')
        block[ext]={'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':sha(path),'bytes':path.stat().st_size,'decoded_duration_s':duration,'probe':probe(path)}
report={'schema_version':1,'status':'candidate_timeline_not_final_confirmed','source_sha256':source_hash,'source_unchanged':sha(SOURCE)==source_hash,'paid_generation_calls':0,'blocks':blocks,
        'actor_slots_candidate':[{'actor':'李白','start':18.2,'end':28.0},{'actor':'杜甫','start':28.0,'end':37.6},{'actor':'杜甫','start':51.6,'end':55.6,'kind':'第四句重唱候选，拟复用同句表演，不能声称新增独立镜头'}],
        'boundary_notes':['A块完整保留A01主句和尾词式回声候选；A02终点短窗一致约27.44秒。','B块从27.6秒开始，比A02主句终点晚约0.16秒，短窗未识别到A02新字音；仍可能含人声混响尾音。','B01首字时间被ASR向前拉长；采用保守0.7秒相对候选起点，不将其当精确音素边界。','B块截取与A块重叠0.6秒，仅作为视频模型独立参考；最终统一使用完整原曲，不能把两个block音轨直接拼接。','WAV和MP3均仅常量降低1dB以容纳原MP3解码峰值，不改变速度、音高或声线；原文件仍完整保留。'],
        'limitations':['ASR只辅助定位；字幕正文来自用户确认的四句。','词尾回声和51.6–55.6整句重唱仍需带声复核，不能由tiny长窗循环推定重复次数。','REPET候选不是干净分轨，本次导出采用原mix保留字音。','此文件不是最终confirmed timeline，生成表演后还需画面与原音轨核对。']}
(ROOT/'music/video-audio-candidates.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':report['status'],'source_unchanged':report['source_unchanged'],'blocks':[{k:b[k]for k in ['id','source_in','source_out','wav','mp3']}for b in blocks]},ensure_ascii=False,indent=2))
