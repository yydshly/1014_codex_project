"""Build the agreed11+2-clip manual-upload audio package from the untouched MP3.

48k stereo PCM16 WAV +256k MP3; no network, retiming, padding, or lyric synthesis.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import math
import subprocess
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / 'handoff-source'
OUT = PACKAGE / 'audio'
SOURCE = ROOT / 'music/source-ya-zhou-ren-jian.mp3'
SOURCE_SHA = 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0'
SR = 48000
GAIN_DB = -1.5
GAIN = 10 ** (GAIN_DB / 20)


def run(args):
    return subprocess.run(args, capture_output=True, check=True).stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def decode(path):
    return np.frombuffer(run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path),
                              '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', str(SR), '-ac', '2', '-']),
                         dtype='<f4').reshape(-1, 2)


def levels(data):
    peak = float(np.max(np.abs(data)))
    return {'float_peak_linear': peak, 'float_peak_dbfs': 20 * math.log10(peak) if peak else None,
            'samples_abs_ge_1': int(np.count_nonzero(np.abs(data) >= 1)),
            'all_samples_finite': bool(np.all(np.isfinite(data)))}


assert sha(SOURCE) == SOURCE_SHA
song = decode(SOURCE)
assert song.shape == (4541545, 2)
duration = len(song) / SR
OUT.mkdir(parents=True, exist_ok=True)

# Slots agreed with director; source times remain sample based, picture slots25fps.
plan = [
    # id,filename,start,end,request,discrete_fallback,slot_in,slot_out,purpose,notes
    ('OPEN', '01_OPEN', 0, 10, 10, 10, 0, 9.4, '舞台开场',
     '9.84秒后可能已起李白首句，成片开场仅取0–9.4；上传10秒含后续上下文，不声称全段纯器乐。'),
    ('A1', '02_A1_LIBAI', 9.4, 19.4, 10, 10, 9.4, 19, '李白主歌前两句',
     '从用户原曲提取完整混音；明亮男声的角色标签来自参考，不是分轨。'),
    ('A2', '03_A2_LIBAI', 19, 29, 10, 10, 19, 28.52, '李白主歌后两句',
     '尾部可能带下个角色起声，上下文余量不作为李白继续演唱的证据。'),
    ('B', '04_B_DUFU', 28.5, 42.7, 15, 15, 28.52, 42.2, '杜甫主歌',
     '参考第二句未可靠定位，保留原声不补词；尾部可能已有李白副歌起声。'),
    ('CH1-A', '05_CH1_A_LIBAI', 42, 49.9, 8, 10, 42.2, 49.76, '第一副歌李白段',
     '含首行尾词重复候选；角色交界约49.74，尾部少量邻角上下文；实际画面只取建议窗。'),
    ('CH1-B', '06_CH1_B_DUFU', 49.4, 54.7, 6, 10, 49.76, 54.4, '第一副歌杜甫段',
     '前端保留李白末尾上下文以免截杜甫首字，取用窗在角色交界后。'),
    ('BR', '07_BRIDGE_DUO_WIDE', 54.1, 65.6, 12, 15, 54.4, 65.6, '双人中远景桥段',
     '短句交替采用双人中远景自然演出，不强制两个嘴逐字同步；末短句文本有争议，不补词。'),
    ('CH2-A', '08_CH2_A_LIBAI', 65.2, 73.5, 9, 10, 65.6, 73.36, '最终副歌李白段',
     '含尾词重复候选；角色交界约73.34，后端少量邻角上下文，不以此认定音素级边界。'),
    ('CH2-B', '09_CH2_B_DUFU', 73, 79.8, 7, 10, 73.36, 79.6, '最终副歌杜甫段',
     '首端留上一句尾音上下文；不拉伸或强制补满视频请求时长。'),
    ('CLOSE', '10_CLOSE_DUO', 79.4, 86.4, 7, 10, 79.6, 86.2, '双人收束长音',
     '“敬月光也敬风霜”未可靠定位，不凭参考补唱/补字幕；末句长音和混响按实际声画处理。'),
    ('END', '11_END', 85.6, duration, 10, 10, 86.2, 94.64, '完整收尾过场',
     '驱动从85.6起可能含末句尾音；完整保留至原曲末样本。成片最后24.48ms只补尾静音以对齐25fps，驱动本身不补。'),
    ('X1-CROWD', '12_X1_CROWD', 3, 8, 5, 5, 4, 6, '可选观众补镜',
     '只以原曲混音作节奏/氛围参考，最终可插入开场4–6秒；不是分离伴奏，不加新音符，不改原曲。'),
    ('X2-DETAIL', '13_X2_DETAIL', 87.5, 92.5, 5, 5, 88, 90, '可选舞台细节补镜',
     '只以原曲完整混音和自然衰减作参考，最终可插入88–90秒；不称分离伴奏或全程有拍点，末端近静音不造拍。')]
lyric = json.loads((ROOT / 'work/lyrics-timing-candidate.json').read_text(encoding='utf-8'))
line_map = {x['id']: x for x in lyric['lyric_occurrences']}
ids = {'OPEN': [], 'A1': ['VA01', 'VA02'], 'A2': ['VA03', 'VA04'],
       'B': ['VB01', 'VB02', 'VB03', 'VB04'], 'CH1-A': ['C1A01', 'C1A02'],
       'CH1-B': ['C1B01', 'C1B02'], 'BR': ['BRA01', 'BRB01', 'BRA02', 'BRB02'],
       'CH2-A': ['C2A01', 'C2A02'], 'CH2-B': ['C2B01', 'C2B02'],
       'CLOSE': ['DUO01', 'DUO02'], 'END': [], 'X1-CROWD': [], 'X2-DETAIL': []}
records = []
last_slot = 0
for id, old_name, start, end, request, fallback, slot_in, slot_out, purpose, note in plan:
    optional = id.startswith('X')
    if not optional:
        assert abs(slot_in - last_slot) < 1e-8
    assert abs(slot_in * 25 - round(slot_in * 25)) < 1e-7
    assert abs(slot_out * 25 - round(slot_out * 25)) < 1e-7
    if not optional:
        last_slot = slot_out
    a, b = round(start * SR), min(round(end * SR), len(song))
    expected = song[a:b].astype(np.float64) * GAIN
    number = len(records) + 1
    name = f'{number:02d}-{id}'
    wav = OUT / (name + '.wav')
    mp3 = OUT / (name + '.mp3')
    # Early provisional filenames were never published; retain their bytes under final agreed names.
    for extension in ['.wav', '.mp3']:
        previous, target = OUT / (old_name + extension), OUT / (name + extension)
        if previous.exists() and previous != target:
            assert previous.resolve().parent == OUT.resolve() == target.resolve().parent
            if target.exists():
                raise FileExistsError(f'Review duplicate provisional/final files: {previous}, {target}')
            previous.rename(target)
    # Keep unexpected existing outputs reviewable, instead of silently replacing.
    if not wav.exists():
        sf.write(str(wav), expected, SR, subtype='PCM_16', format='WAV')
    actual, sr = sf.read(str(wav), dtype='float64', always_2d=True)
    info = sf.info(str(wav))
    assert sr == SR and actual.shape == expected.shape and info.subtype == 'PCM_16'
    error = float(np.max(np.abs(actual - expected)))
    assert error <= 1 / 32768 + 1e-9
    assert np.all(np.isfinite(actual)) and np.count_nonzero(np.abs(actual) >= 1) == 0
    if not mp3.exists():
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-i', str(wav),
             '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', '256k', '-ar', str(SR), '-ac', '2',
             '-map_metadata', '-1', '-write_xing', '1', str(mp3)])
    mp3_samples = decode(mp3)
    assert mp3_samples.shape == actual.shape, (id, mp3_samples.shape, actual.shape)
    assert np.all(np.isfinite(mp3_samples))
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(mp3)]))
    assert float(probe['streams'][0]['sample_rate']) == SR and probe['streams'][0]['channels'] == 2
    common = {'sample_rate': SR, 'channels': 2, 'sample_frames': b - a,
              'decoded_duration_seconds': (b - a) / SR}
    wav_record = dict(common, path=wav.relative_to(PACKAGE).as_posix(), sha256=sha(wav),
                      bytes=wav.stat().st_size, format='WAV', subtype='PCM_16', **levels(actual),
                      max_abs_quantization_error_to_source_gain=error)
    mp3_record = dict(common, path=mp3.relative_to(PACKAGE).as_posix(), sha256=sha(mp3),
                      bytes=mp3.stat().st_size, format='MP3', bitrate_bps=256000,
                      container_duration_seconds=float(probe['format']['duration']),
                      gapless_metadata=True, **levels(mp3_samples),
                      encoding_source='corresponding_PCM16_WAV_already_at_minus1p5dB_no_additional_gain')
    heard = []
    for line_id in ids[id]:
        line = line_map[line_id]
        heard.append({'line_id': line_id, 'text_from_user_reference': line['text_from_user_confirmed_reference'],
                      'song_start_candidate': line['heard_start_candidate'], 'song_end_candidate': line['heard_end_candidate'],
                      'driver_start_candidate': None if line['heard_start_candidate'] is None else round(line['heard_start_candidate'] - start, 6),
                      'driver_end_candidate': None if line['heard_end_candidate'] is None else round(line['heard_end_candidate'] - start, 6),
                      'candidate_only': True, 'no_automatic_caption': line_id in {'VB02', 'DUO01', 'BRB02'}})
    record = {'id': id, 'number': number, 'title': purpose, 'purpose': purpose, 'optional': optional,
              'wav': wav_record['path'], 'mp3': mp3_record['path'],
              'sha256_wav': wav_record['sha256'], 'sha256_mp3': mp3_record['sha256'],
              'bytes_wav': wav_record['bytes'], 'bytes_mp3': mp3_record['bytes'],
              'sample_frames': b - a, 'sample_rate': SR, 'channels': 2,
              'wav_metadata': wav_record, 'mp3_metadata': mp3_record,
              'song_in': a / SR, 'song_out': b / SR, 'source_song_sha256': SOURCE_SHA,
              'source_in_sample_frame': a, 'source_out_sample_frame_exclusive': b,
              'driver_duration_seconds': (b - a) / SR, 'gain_db': GAIN_DB,
              'pad_lead_seconds': 0, 'pad_tail_seconds': 0, 'time_stretched': False,
              'request_seconds': request, 'request_video_seconds_suggestion': request,
              'request_video_seconds_fixed_5_10_15_fallback': fallback,
              'suggested_model_extra_tail_seconds': round(request - (b - a) / SR, 9),
              'use_song_in': slot_in, 'use_song_out': slot_out,
              'edit_slot_song_start': slot_in, 'edit_slot_song_end': slot_out,
              'picture_take_local_start': round(slot_in - start, 9),
              'picture_take_local_end': round(slot_out - start, 9),
              'actual_music_content_end_within_slot': min(slot_out, duration),
              'picture_take_status': 'director_agreed_suggestion_pending_generated_video_review',
              'optional_insertion_replaces_picture_only': optional,
              'heard_lyric_candidates': heard, 'usage_note': note,
              'uploaded_or_submitted_by_this_export': False}
    assert record['picture_take_local_start'] >= 0
    assert record['picture_take_local_end'] <= request + 1e-8
    records.append(record)
    print(json.dumps({'id': id, 'wav': wav_record['path'], 'mp3': mp3_record['path'],
                      'duration': record['driver_duration_seconds'], 'wav_sha256': wav_record['sha256'],
                      'mp3_sha256': mp3_record['sha256'], 'wav_peak_dbfs': wav_record['float_peak_dbfs'],
                      'mp3_peak_dbfs': mp3_record['float_peak_dbfs']}, ensure_ascii=False), flush=True)

assert last_slot == 94.64
assert sha(SOURCE) == SOURCE_SHA
required = [r for r in records if not r['optional']]
optional_records = [r for r in records if r['optional']]
manifest = {'schema_version': 1, 'experiment_id': '004-performance-film',
            'status': 'ready_for_manual_upload_no_generation_calls',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'authoritative_for_this_handoff_audio': True,
            'previous_PCM24_driver_manifest_is_history_for_handoff': 'music/full-song-drivers/manifest.json',
            'source_song': {'original_user_filename': '压轴人间.mp3', 'project_path': 'music/source-ya-zhou-ren-jian.mp3',
                            'sha256': SOURCE_SHA, 'bytes': SOURCE.stat().st_size,
                            'full_decode_at_48k_sample_frames': len(song), 'full_decode_duration_seconds': duration,
                            'source_bytes_unchanged': True, 'song_trimmed': False, 'song_time_stretched': False},
            'audio_format': {'preferred_upload': '48kHz_stereo_PCM16_WAV', 'backup_upload': '48kHz_stereo_256kbps_MP3',
                             'gain_db_from_original': GAIN_DB, 'gain_is_applied_once': True,
                             'padding_or_generated_audio_added_to_drivers': False,
                             'mp3_may_have_container_encoder_padding_but_decodes_to_same_sample_frame_count': True,
                             'wav_is_canonical_for_timing_and_raw_QA': True},
            'full_song_edit': {'status': 'director_agreed_suggested_slots_pending_actual_video_review',
                               'duration_25fps_seconds': 94.64, 'video_frames_at_25fps': 2366,
                               'original_song_preserved_to_last_sample': True,
                               'final_end_silence_padding_seconds_only': 94.64 - duration,
                               'no_other_music_cuts_or_retiming': True,
                               'slot_boundaries': [0, 9.4, 19, 28.52, 42.2, 49.76, 54.4, 65.6, 73.36, 79.6, 86.2, 94.64],
                               'source_to_final_song_time': 'identity; final music uses intact originalMP3 at-1.5dB, not concatenated drivers',
                               'picture_local_time_formula': 'final_song_time - song_in + pad_lead_seconds + picture_advance_seconds(default0)'},
            'segments': records,
            'generation_planning_only': {'video_requests': len(records),
                                         'required_video_requests': len(required), 'optional_video_requests': len(optional_records),
                                         'required_generated_seconds': sum(r['request_seconds'] for r in required),
                                         'optional_generated_seconds': sum(r['request_seconds'] for r in optional_records),
                                         'requested_generated_seconds': sum(r['request_video_seconds_suggestion'] for r in records),
                                         'fixed_5_10_15_fallback_requested_seconds': sum(r['request_video_seconds_fixed_5_10_15_fallback'] for r in records),
                                         'reference_credits_per_second_768p': 15,
                                         'reference_credits_total': 15 * sum(r['request_video_seconds_suggestion'] for r in records),
                                         'reference_credits_required': 15 * sum(r['request_seconds'] for r in required),
                                         'reference_credits_optional': 15 * sum(r['request_seconds'] for r in optional_records),
                                         'reference_credits_if_END_and_optional_held_for_later': 15 * sum(r['request_seconds'] for r in required if r['id'] != 'END'),
                                         'reference_credits_fixed_5_10_15_fallback_total': 15 * sum(r['request_video_seconds_fixed_5_10_15_fallback'] for r in records),
                                         'prices_must_be_checked_in_actual_UI': True,
                                         'no_actual_spending_claim': True},
            'lyrics_policy': {'user_reference': 'docs/full-song-lyrics.txt',
                              'three_disputed_reference_line_ids_not_auto_captioned': ['VB02', 'DUO01', 'BRB02'],
                              'review': 'work/lyric-recheck-small.json',
                              'no_inserted_or_corrected_singing': True, 'timing_candidate_file_unchanged': True,
                              'do_not_claim_word_perfect_recognition_or_lip_sync': True},
            'external_calls': 0, 'paid_calls': 0,
            'export_method': {'full_source_decode': 'ffmpeg 48k stereo float32',
                              'gain': 'numpy float64 fixed-1.5dB',
                              'wav': 'libsndfile PCM_16 quantization without padding or retiming',
                              'mp3': 'libmp3lame256k from correspondingWAV, no second gain'},
            'all_driver_WAVs_no_samples_abs_ge_1': all(r['wav_metadata']['samples_abs_ge_1'] == 0 for r in records),
            'all_driver_MP3s_no_samples_abs_ge_1': all(r['mp3_metadata']['samples_abs_ge_1'] == 0 for r in records)}
save(PACKAGE / 'audio-manifest.json', manifest)
print(json.dumps({'manifest': str(PACKAGE / 'audio-manifest.json'), 'requests': len(records),
                  'suggested_seconds': manifest['generation_planning_only']['requested_generated_seconds'],
                  'fallback_seconds': manifest['generation_planning_only']['fixed_5_10_15_fallback_requested_seconds'],
                  'audio_files': 2 * len(records), 'source_unchanged': True}, ensure_ascii=False))
