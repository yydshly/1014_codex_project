"""Record bounded follow-up ASR findings; keep original transcription unchanged."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'work'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


paths = ['work/new-song-asr-small-unprompted.json', 'work/new-song-asr-small-hinted.json']
raw = [read(ROOT / p) for p in paths]
assert all(x['status'] == 'completed' for x in raw)
source = ROOT / 'music/source-ya-zhou-ren-jian.mp3'
source_hash = sha(source)
assert all(x['source_sha256'] == source_hash for x in raw)
provenance = read(WORK / 'small-model-provenance.json')
assert provenance['status'] == 'downloaded_and_hash_checked'
records = [{'path': path, 'sha256': sha(ROOT / path), 'lyrics_hint': data['lyrics_hint'],
            'windows': [{'source_window': w['window'], 'segments': [
                {'start': s['start'], 'end': s['end'], 'text': s['text'],
                 'avg_logprob': s['avg_logprob'], 'no_speech_prob': s['no_speech_prob']}
                for s in w['segments']]} for w in data['windows']]}
           for path, data in zip(paths, raw)]
findings = [
    {'line_id': 'VB02', 'reference_text': '鞋底沾着泥土，纸上落着风霜',
     'decision': 'reference_unconfirmed_possibly_omitted', 'caption_allowed': False,
     'source_window': [28, 43], 'heard_start_candidate': None, 'heard_end_candidate': None,
     'basis': '无提示small只给出杜甫参考第1、3、4句的对应音节段；提示版也未找到这句。与base一致。',
     'limit': '两个ASR都没识别到不能单独证明绝对漏唱；不硬塞时间窗。'},
    {'line_id': 'DUO01', 'reference_text': '敬月光，也敬风霜',
     'decision': 'reference_unconfirmed_possibly_omitted', 'caption_allowed': False,
     'source_window': [79, 87], 'heard_start_candidate': None, 'heard_end_candidate': None,
     'basis': '无提示small给出“让世人见听 皆回响”，支持下一参考行的音节轮廓；未找到本行。base也未找到。',
     'limit': '提示版把整窗硬套成副歌词并伴随极低概率和零长度词，不能采作新增唱词证据。'},
    {'line_id': 'BRB02', 'reference_text': '这一笔，敬担当',
     'decision': 'possible_actual_repetition_of_previous_line', 'caption_allowed': False,
     'source_window': [62, 65.6], 'potential_actual_text_not_confirmed': '这一杯，敬远方',
     'independent_small_phonetic_span': [62, 63.82],
     'basis': '无提示small识别“这一辈情远方”，远/方词概率约0.923/0.945；与base偏向前句同音串一致。',
     'limit': '这是重复/改唱候选，未声称通过人工听审确认。提示版后来强塞“这一笔敬”残片，不能替代无提示证据。'}]
review = {'schema_version': 1, 'experiment_id': '004-performance-film',
          'status': 'bounded_small_recheck_complete_uncertainties_retained',
          'created_at': datetime.now(timezone.utc).isoformat(),
          'source_song_sha256': source_hash, 'source_song_changed': False,
          'model_provenance': {'path': 'work/small-model-provenance.json',
                               'sha256': sha(WORK / 'small-model-provenance.json'),
                               'model': provenance['model'], 'revision': provenance['revision'],
                               'license': provenance['license'], 'total_bytes': provenance['total_bytes'],
                               'model_bin_bytes': next(x['bytes'] for x in provenance['files'] if x['name'] == 'model.bin')},
          'method': {'order': 'independent_unprompted_then_reference_prompted',
                     'device': 'cpu', 'compute_type': 'int8', 'local_files_only': True,
                     'no_new_audio_upload': True, 'paid_calls': 0, 'trust_remote_code': False,
                     'remote_python_executed': False, 'prior_base_evidence_overwritten': False},
          'raw_evidence': records, 'findings': findings,
          'timing_policy': '保留base候选，不把短窗第一个词被拉到窗首的时间当精确起唱；驱动仍用原mix。',
          'hint_contamination_examples': [
              {'window': [79, 87], 'text': 'MAND你把人间，写成压轴的回响',
               'problem': '无提示近似收束行，提示后却变副歌；很多词接近0概率或零长度，拒绝据此增加/改写字幕。'},
              {'window': [62, 65.6], 'text': '这一杯，敬远方 Naru这一笔，敬',
               'problem': '后半出现提示词残片和无关token，不能证明参考“担当”唱出。'}],
          'stereo_downmix_check': {'method': 'ffmpeg16k stereo float, globalLRcorrelation and mid/side energy per disputed window',
                                   'purpose': '排查整体立体声反相下混导致大段内容消失；不是人声分离或可懂度指标。',
                                   'windows': [
                                       {'window': [28, 43], 'left_right_correlation': .848626939993252,
                                        'mid_energy_vs_mean_channel_db': -.3416157263094005, 'side_to_mid_db': -10.870537110448296},
                                       {'window': [62, 65.6], 'left_right_correlation': .8087993903749315,
                                        'mid_energy_vs_mean_channel_db': -.4366626393670267, 'side_to_mid_db': -9.756222243655449},
                                       {'window': [79, 87], 'left_right_correlation': .7958936406076691,
                                        'mid_energy_vs_mean_channel_db': -.4674518910906428, 'side_to_mid_db': -9.444651739126805}],
                                   'result': '未发现全mix严重反相抵消；不能由此保证每个人声音素都清楚。'},
          'production_recommendation': 'VB02、DUO01不虚构字幕；BRB02先不显示“这一笔敬担当”，保留音乐和表演。其他已定位候选仍不等于逐字正确或精准口型。'}
save(WORK / 'lyric-recheck-small.json', review)

candidate = read(WORK / 'lyrics-timing-candidate.json')
for path in paths:
    if path not in candidate['asr_evidence_paths']:
        candidate['asr_evidence_paths'].append(path)
candidate['small_recheck'] = {'path': 'work/lyric-recheck-small.json', 'sha256': sha(WORK / 'lyric-recheck-small.json'),
                             'status': review['status'], 'no_timing_or_driver_audio_change': True}
for line in candidate['lyric_occurrences']:
    match = next((f for f in findings if f['line_id'] == line['id']), None)
    if match:
        line['small_recheck'] = {'decision': match['decision'], 'source_window': match['source_window'],
                                 'raw_evidence_paths': paths, 'no_forced_reference_alignment': True}
        line['caption_allowed_without_further_review'] = False
save(WORK / 'lyrics-timing-candidate.json', candidate)

analysis = read(WORK / 'new-song-analysis.json')
analysis['network_calls_initial_base_analysis'] = analysis.pop('network_calls', 0)
analysis['models_downloaded_initial_base_analysis'] = False
analysis['models_downloaded'] = True
analysis['follow_up_small_asr'] = {'path': 'work/lyric-recheck-small.json', 'status': review['status'],
                                   'model_provenance': 'work/small-model-provenance.json',
                                   'network_usage': '仅固定官方模型数据与官方来源查证；所有音频仍只在本机推理，推理禁用Hub网络。',
                                   'audio_uploaded': False, 'paid_calls': 0}
save(WORK / 'new-song-analysis.json', analysis)
print(json.dumps({'status': review['status'], 'source_sha256': source_hash, 'findings': [x['line_id'] for x in findings]}, ensure_ascii=False))
