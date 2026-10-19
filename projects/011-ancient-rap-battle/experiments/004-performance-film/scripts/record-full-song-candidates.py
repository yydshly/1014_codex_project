"""Record explicit, uncertain lyric timing and natural driver suggestions; no ASR call."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json
ROOT=Path(__file__).resolve().parent.parent
WORK=ROOT/'work'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
reference=ROOT/'docs/full-song-lyrics.txt'
texts=[s.strip()for s in reference.read_text(encoding='utf-8').splitlines()if s.strip()and not s.strip().startswith('[')]
assert len(texts)==22
defs=[
 ('VA01','李白','verse-a',9.84,14.12,'short-window-supported','我欠一身月色他过长暗的墙'),
 ('VA02','李白','verse-a',15.08,18.64,'short-window-supported','绣意藏着轻风凶口住这荒谅'),
 ('VA03','李白','verse-a',19.64,23.24,'phonetic-approximation','十一块成就帮夜搜尝到了'),
 ('VA04','李白','verse-a',24.28,27.98,'phonetic-approximation','今天见你孤天让天地听我唱'),
 ('VB01','杜甫','verse-b',28.9,32.60,'short-window-supported-start-uncertain','我从唱着走来听出万戏的梦'),
 ('VB02','杜甫','verse-b',None,None,'reference_unconfirmed_possibly_omitted','无可靠独立时间窗；不能将参考第二句塞进第一句与第三句之间。'),
 ('VB03','杜甫','verse-b',33.34,37.88,'short-window-supported','有人阳望星花有人守着轮到'),
 ('VB04','杜甫','verse-b',38.20,42.26,'phonetic-approximation','我让我明的电战道太创意啊'),
 ('C1A01','李白','chorus-1',42.26,45.06,'short-window-supported','就被一只银河那来捧场'),
 ('C1A02','李白','chorus-1',46.98,49.76,'short-window-supported','你的光成长不下我的月光'),
 ('C1B01','杜甫','chorus-1',49.74,52.10,'phonetic-approximation','原本在暗夜的招春风霜'),
 ('C1B02','杜甫','chorus-1',52.10,54.46,'phonetic-approximation','花花人最新情怀孤独灰烧'),
 ('BRA01','李白','bridge',54.46,56.82,'short-window-supported','你把天降浪活碰在手掌'),
 ('BRB01','杜甫','bridge',56.82,59.34,'short-window-supported','你让天天明月落在街上'),
 ('BRA02','李白','bridge',59.34,61.88,'phonetic-approximation','找一杯新圆帕'),
 ('BRB02','杜甫','bridge',62.08,65.06,'possible-repeat-or-word-change-needs-listening','无提示两处均像“这一杯敬远方”的同音串，是否实际唱成“这一笔敬担当”待核。'),
 ('C2A01','李白','chorus-2',65.60,68.60,'short-window-supported','就被一只英文的来捧场'),
 ('C2A02','李白','chorus-2',70.56,73.32,'short-window-supported','你的共争装扫下我的月光'),
 ('C2B01','杜甫','chorus-2',73.34,75.68,'phonetic-approximation','月光再燃夜的照片风霜'),
 ('C2B02','杜甫','chorus-2',75.68,79.10,'end-uncertain-phonetic-approximation','破坏了这些青外魂的灰少'),
 ('DUO01','合唱','closing',None,None,'reference_unconfirmed_possibly_omitted','未找到“敬月光也敬风霜”的可靠独立时间窗。'),
 ('DUO02','合唱','closing',80.30,85.86,'long-note-end-supported-start-uncertain','让许人坚听结回一下')]
lines=[]
for text,(id,actor,section,start,end,status,evidence)in zip(texts,defs):
 lines.append({'id':id,'actor_reference':actor,'section':section,'text_from_user_confirmed_reference':text,
  'heard_start_candidate':start,'heard_end_candidate':end,'timing_status':status,'raw_asr_evidence_or_uncertainty':evidence,'lyrics_from_asr_not_substituted':True,'manual_review_required':True,
  'caption_allowed_without_further_review':id not in {'VB02','DUO01','BRB02'}})
source=ROOT/'music/source-ya-zhou-ren-jian.mp3';source_hash=sha(source)
groups=[
 {'id':'OPEN','song_in':0,'song_out':9,'request_video_seconds':10,'actors':[],'kind':'instrumental-transition','reference_path':'music/full-song-drivers/OPEN-9s.wav','lines':[]},
 {'id':'A1','song_in':9.4,'song_out':19.4,'request_video_seconds':10,'actors':['李白'],'kind':'single-performance','reference_path':'music/full-song-drivers/A1-first-two-10s.wav','lines':['VA01','VA02']},
 {'id':'A2','song_in':19,'song_out':29,'request_video_seconds':10,'actors':['李白'],'kind':'single-performance','lines':['VA03','VA04']},
 {'id':'B','song_in':28.5,'song_out':42.7,'request_video_seconds':15,'actors':['杜甫'],'kind':'single-performance-with-next-role-context','lines':['VB01','VB02','VB03','VB04'],'note':'VB02未定位；驱动仍保留整个原段，不删除疑似漏唱内容。最后约0.5秒可能已有下段李白起声，杜甫镜头实际用至约42.2，重叠由下一机位承接。'},
 {'id':'CH1','song_in':42,'song_out':54.7,'request_video_seconds':15,'actors':['李白','杜甫'],'kind':'two-role-alternating-performance','lines':['C1A01','C1A02','C1B01','C1B02'],'note':'自然短句轮替较快，优先双人参考，不能把全段强制交给同一角色对口。'},
 {'id':'BR','song_in':54.1,'song_out':65.6,'request_video_seconds':15,'actors':['李白','杜甫'],'kind':'two-role-alternating-performance','lines':['BRA01','BRB01','BRA02','BRB02'],'note':'桥段最后短句文本疑点需带声核对，不把参考词硬写成实际已唱。'},
 {'id':'CH2','song_in':65.2,'song_out':79.8,'request_video_seconds':15,'actors':['李白','杜甫'],'kind':'two-role-alternating-performance','lines':['C2A01','C2A02','C2B01','C2B02']},
 {'id':'CLOSE','song_in':79.4,'song_out':86.4,'request_video_seconds':10,'actors':['李白','杜甫'],'kind':'duet-closing','lines':['DUO01','DUO02'],'note':'DUO01未定位，不虚构额外一句或字幕时间。'}]
early=read(WORK/'early-driver-preview.json')
for g in groups:
 g.update(status='driver_group_suggestion_not_submitted',pad_lead_seconds=0,pad_tail_seconds=0,source_song_sha256=source_hash,
          source_audio_seconds=round(g['song_out']-g['song_in'],6),video_request_extra_seconds=round(g['request_video_seconds']-(g['song_out']-g['song_in']),6),reference_gain_db=-1.5,
          mapping_formula='source picture local time = final song time - song_in + pad_lead_seconds + picture_advance; picture_advance defaults0',
          generation_extra_tail_note='请求视频比驱动长时，新增尾段不代表原曲延长；最终仍按原曲统一配回。')
 if g.get('reference_path'):
  record=next(x for x in early['drivers']if x['path']==g['reference_path']);g['reference_sha256']=record['sha256']
located=[x for x in lines if x['heard_start_candidate']is not None]
covered=all(any(g['song_in']<=x['heard_start_candidate']and g['song_out']>=x['heard_end_candidate']for g in groups)for x in located)
assert covered and sum(x['request_video_seconds']for x in groups)==100
candidate={'schema_version':1,'experiment_id':'004-performance-film','status':'candidate_pending_audio_review_not_confirmed','created_at':datetime.now(timezone.utc).isoformat(),
 'source_song':{'path':'music/source-ya-zhou-ren-jian.mp3','sha256':source_hash,'full_song_preserved':True},
 'reference':{'path':'docs/full-song-lyrics.txt','sha256':sha(reference),'user_confirmed':True,'line_count':len(texts),'confirmation_scope':'用户确认采用这份完整歌词；实际音频是否每字每句遵循仍按证据保留疑点。'},
 'caption_policy':{'text_source':'user_confirmed_reference','timing_status':'candidate','reference_unconfirmed_possibly_omitted':['VB02','DUO01'],'text_disputed_pending_listening':['BRB02'],'omit_unconfirmed_lines':True,'no_asr_homophone_replacement':True,'note':'已定位候选可供人工核对和分镜；未定位或文本疑点不自动写入成片字幕。'},
 'asr_evidence_paths':['work/new-song-asr-base-unprompted.json','work/new-song-asr-window-unprompted-initial.json','work/new-song-asr-targeted-unprompted.json','work/new-song-asr-window-hinted.json'],
 'lyric_occurrences':lines,'additional_vocal_candidates':[{'kind':'first-chorus-tail-repeat','source_range':[45.06,46.98],'text_reference':'酒杯一举…捧场附近重复/回声候选，不能只靠ASR定具体新增文字'},{'kind':'final-chorus-tail-repeat','source_range':[68.6,70.56],'text_reference':'同上尾词/重唱候选'}],
 'uncertain_reference_lines':['VB02','DUO01','BRB02'],'driver_groups':groups,'all_located_lyric_windows_covered_by_groups':covered,
 'first_pass_plan':{'video_requests':8,'requested_generated_seconds':100,'reference_credits_per_second_768p':15,'reference_credits':1500,'actual_ui_price_must_be_checked_by_root':True,'new_calls_made_by_this_analysis':0},
 'optional_later_transition':{'id':'OUTRO','song_in':86.2,'song_out':94.61552083333333,'request_video_seconds':10,'kind':'instrumental-ending','note':'全曲尾奏另计；按参考价再150钻、总仍在2400上限内，是否提交由root决定。'},
 'constraints':['整首94.6155秒原曲保留，不使用旧38.24秒剪辑。','没有为缺少可靠ASR匹配的参考句捏造时间；null不是已确认漏唱。','字幕正文由用户确认，ASR同音错字不直接替换正文；实际改词疑点需听核。','100秒为请求源视频容量，不是音乐被拉长到100秒，不自动填满视频模型多余尾段。','角色标签来自参考歌词，不证明原歌声线可完全分离或模型能逐字对口。']}
save(WORK/'lyrics-timing-candidate.json',candidate)
analysis=read(WORK/'new-song-analysis.json')
duration=analysis['decoded']['at_48k_duration_s']
sections=[('instrumental-opening',0,9.4),('verse-a',9.4,28.5),('verse-b',28.5,42.2),('chorus-1',42.2,54.3),('bridge',54.3,65.6),('chorus-2',65.6,79.6),('duet-closing',79.6,86.2),('instrumental-ending',86.2,duration)]
analysis.update(status='analysis_complete_with_explicit_lyric_uncertainties',reference_user_confirmed=True,lyric_timing_report='work/lyrics-timing-candidate.json',lyric_timing_status=candidate['status'],
 section_candidates=[{'id':id,'start':a,'end':b,'status':'music_and_lyric_based_candidate_not_musical_ground_truth'}for id,a,b in sections],
 recommended_production_audio={'path':'music/source-ya-zhou-ren-jian.mp3','gain_db':-1.5,'why':'原48k浮点峰值+0.0593dBFS，恒定-1.5dB留PCM/AAC余量；不压缩、不改速。','predicted_source_sample_peak_dbfs_after_gain':analysis['float_levels']['48k_stereo']['sample_peak_dbfs']-1.5,
 'video_duration_25fps_s':94.64,'expected_end_silence_padding_s':94.64-duration,'song_trimmed':False},
 early_drivers_report='work/early-driver-preview.json',uncertain_reference_lines=candidate['uncertain_reference_lines'])
save(WORK/'new-song-analysis.json',analysis)
print(json.dumps({'status':candidate['status'],'lyric_lines':len(lines),'unlocated':[x['id']for x in lines if x['heard_start_candidate']is None],'groups':len(groups),'source_video_seconds':100,'all_located_windows_covered':covered,'duration':duration},ensure_ascii=False,indent=2))
