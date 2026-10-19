"""Export exact source-mapped, unpadded local drivers for the intact new song.

No external generation, no lyric synthesis, no retiming, no original overwrite.
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
OUT = ROOT / 'music/full-song-drivers'
SOURCE = ROOT / 'music/source-ya-zhou-ren-jian.mp3'
SR = 48000
GAIN_DB = -1.5
GAIN = 10 ** (GAIN_DB / 20)
EXPECTED_SOURCE_SHA = 'cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def peak_db(x):
    p = float(np.max(np.abs(x)))
    return 20 * math.log10(p) if p else None


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


assert sha(SOURCE) == EXPECTED_SOURCE_SHA
decoded = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(SOURCE),
                          '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', str(SR), '-ac', '2', '-'],
                         capture_output=True, check=True)
song = np.frombuffer(decoded.stdout, dtype='<f4').reshape(-1, 2)
assert song.shape == (4541545, 2) and np.all(np.isfinite(song))
duration = len(song) / SR
OUT.mkdir(parents=True, exist_ok=True)

# Old OPEN9 and A1 are preserved byte for byte; all other names are new exports.
definitions = [
    ('OPEN-9s-history', 'OPEN-9s.wav', 0, 9, 10, [], 'historical_opening_reference',
     '保留早期9秒驱动历史；当前OPEN建议改用OPEN-10s.wav，不删除旧文件。'),
    ('OPEN', 'OPEN-10s.wav', 0, 10, 10, [], 'stage_opening_reference_with_vocal_context',
     '9.84秒后可能进入李白首句；成片开场画面只用到原曲9.4秒，不能称整段纯器乐。'),
    ('A1', 'A1-first-two-10s.wav', 9.4, 19.4, 10, ['李白'], 'single_role_performance',
     '李白主歌前两句；保留原导出字节。'),
    ('A2', 'A2-10s.wav', 19, 29, 10, ['李白'], 'single_role_performance_with_next_role_context',
     '李白主歌后两句，尾部可能带入下一角色起声上下文；取景时按实际角色切换。'),
    ('B', 'B-14p2s.wav', 28.5, 42.7, 15, ['杜甫'], 'single_role_performance_with_next_role_context',
     '杜甫主歌完整原段；参考第二句未可靠定位，不补词。42.26秒后可能进入李白副歌上下文。'),
    ('CH1', 'CH1-12p7s.wav', 42, 54.7, 13, ['李白', '杜甫'], 'two_role_alternating_chorus',
     '第一副歌角色交替；两端保留相邻唱段上下文，不强制单人整段对口。'),
    ('BR', 'BR-11p5s.wav', 54.1, 65.6, 12, ['李白', '杜甫'], 'two_role_alternating_bridge',
     '桥段交替；“这一笔敬担当”文本仍有争议，不补录或改原音。'),
    ('CH2', 'CH2-14p6s.wav', 65.2, 79.8, 15, ['李白', '杜甫'], 'two_role_alternating_final_chorus',
     '最终副歌，保留真实尾词重复与过渡。'),
    ('CLOSE', 'CLOSE-7s.wav', 79.4, 86.4, 7, ['李白', '杜甫'], 'duet_closing',
     '收束唱段；“敬月光也敬风霜”未可靠定位，不强行补参考词。'),
    ('END', 'END-full-tail.wav', 85.6, duration, 10, [], 'ending_transition_with_last_vocal_tail',
     '85.6秒处可能仍有最后长音/混响，保留至实际解码末样本，不冒称整段纯器乐，不裁原曲尾部。')]
existing = {
    'OPEN-9s.wav': '6a27fcde723d1ca1547f034c97bffc46d170ea2c4b3385c75f0406f8a0cbe9b8',
    'A1-first-two-10s.wav': 'dca00ffc16e7e488a9477e2b85c0b3942fe446015a792aeb8e3a0ca8373bfd86'}
records = []
for id, name, start, end, request, actors, kind, note in definitions:
    a, b = round(start * SR), min(round(end * SR), len(song))
    expected = song[a:b].astype(np.float64) * GAIN
    assert np.all(np.isfinite(expected)) and float(np.max(np.abs(expected))) < 1
    path = OUT / name
    preserved = path.exists()
    if name in existing:
        assert preserved and sha(path) == existing[name], f'Preserve early file: {path}'
    if not preserved:
        sf.write(str(path), expected, SR, subtype='PCM_24', format='WAV')
    actual, sr = sf.read(str(path), dtype='float64', always_2d=True)
    info = sf.info(str(path))
    assert sr == SR and actual.shape == expected.shape and info.subtype == 'PCM_24'
    quantization_error = float(np.max(np.abs(actual - expected)))
    # Existing files used the same gain through float32, allow its rounding plus24-bit quantization.
    assert quantization_error <= 2.5e-7, (id, quantization_error)
    assert np.all(np.isfinite(actual)) and np.count_nonzero(np.abs(actual) >= 1) == 0
    if name in existing:
        assert sha(path) == existing[name]
    record = {'id': id, 'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path),
              'bytes': path.stat().st_size, 'song_in': a / SR, 'song_out': b / SR,
              'source_in_sample_frame': a, 'source_out_sample_frame_exclusive': b,
              'source_song_sha256': EXPECTED_SOURCE_SHA,
              'source_audio_duration_seconds': (b - a) / SR, 'sample_frames': b - a,
              'sample_rate': SR, 'channels': 2, 'format': 'WAV', 'subtype': 'PCM_24',
              'gain_db': GAIN_DB, 'pad_lead_seconds': 0, 'pad_tail_seconds': 0,
              'time_stretched': False, 'samples_padded': 0, 'lyrics_synthesized_or_changed': False,
              'pre_pcm_float_peak_dbfs': peak_db(expected), 'float_peak_dbfs': peak_db(actual),
              'float_peak_linear': float(np.max(np.abs(actual))),
              'samples_abs_ge_1': int(np.count_nonzero(np.abs(actual) >= 1)),
              'all_samples_finite': bool(np.all(np.isfinite(actual))),
              'max_abs_error_to_expected_gain': quantization_error,
              'request_video_seconds_suggestion': request,
              'suggested_model_extra_tail_seconds': request - (b - a) / SR,
              'actors_from_reference_not_separated_stems': actors,
              'purpose': kind, 'usage_note': note, 'preserved_preexisting_bytes': preserved,
              'current_driver_plan': id != 'OPEN-9s-history',
              'video_submitted_by_this_export': False}
    if id == 'OPEN':
        record['opening_picture_song_range_limit'] = [0, 9.4]
    records.append(record)
    print(json.dumps({'id': id, 'path': str(path), 'seconds': record['source_audio_duration_seconds'],
                      'sha256': record['sha256'], 'peak_dbfs': record['float_peak_dbfs']}, ensure_ascii=False), flush=True)

current = [r for r in records if r['current_driver_plan']]
core = [r for r in current if r['id'] != 'END']
manifest = {'schema_version': 1, 'experiment_id': '004-performance-film',
            'status': 'local_drivers_ready_no_generation_submission',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'source_song': {'path': SOURCE.relative_to(ROOT).as_posix(), 'sha256': EXPECTED_SOURCE_SHA,
                            'bytes': SOURCE.stat().st_size, 'full_48k_decode_frames': len(song),
                            'full_48k_decode_duration_seconds': duration, 'full_song_preserved': True},
            'source_to_target_mapping': 'Full song remains intact: final song time equals source song time. Driver local time = final song time - song_in + pad_lead_seconds + picture_advance_seconds(default0).',
            'final_mix_policy': {'input': 'music/source-ya-zhou-ren-jian.mp3', 'gain_db': GAIN_DB,
                                 'driver_wavs_are_not_final_mix_inputs': True, 'no_double_gain': True,
                                 'trimmed_or_retimed': False},
            'drivers': records,
            'planning_only': {'current_groups': len(current),
                              'requested_video_seconds_including_END': sum(r['request_video_seconds_suggestion'] for r in current),
                              'core_groups_excluding_END': len(core),
                              'requested_video_seconds_core_excluding_END': sum(r['request_video_seconds_suggestion'] for r in core),
                              'reference_credits_per_second_768p': 15,
                              'reference_credits_core_excluding_END': 15 * sum(r['request_video_seconds_suggestion'] for r in core),
                              'reference_credits_including_END': 15 * sum(r['request_video_seconds_suggestion'] for r in current),
                              'price_must_be_verified_in_UI': True, 'actual_spend_recorded_here': False},
            'lyric_uncertainties': {'no_automatic_caption_line_ids': ['VB02', 'DUO01', 'BRB02'],
                                    'review': 'work/lyric-recheck-small.json',
                                    'timing_candidates_unchanged': True, 'reference_lyrics_not_inserted_into_audio': True},
            'external_calls_for_export': 0,
            'constraints': ['All WAVs preserve their actual length; no padding to requested video duration.',
                            'Requested model tail is spare picture only and does not extend the final original song.',
                            'Role labels are reference roles, not separated voice tracks or proof of lip sync.',
                            'OPEN9 is history; OPEN10 includes possible first-vocal onset and opening picture ends at9.4.',
                            'END retains possible final vocal tail and complete decoded original ending.']}
assert sha(SOURCE) == EXPECTED_SOURCE_SHA
save(OUT / 'manifest.json', manifest)
print(json.dumps({'manifest': str(OUT / 'manifest.json'), 'files': len(records), 'current_groups': len(current),
                  'core_requested_seconds': manifest['planning_only']['requested_video_seconds_core_excluding_END'],
                  'all_requested_seconds': manifest['planning_only']['requested_video_seconds_including_END']}, ensure_ascii=False))
