"""Measure final AAC music integrity against the preserved user song.

Run only after real assembly completed. This is NOT model-native raw QA and does
not verify lyrics or mouth movement. Missing/changed inputs refuse before writing
any verification report. No network, models, generation calls or source mutations.
"""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'music/source-jing-feng-shuang.mp3'
TIMELINE = ROOT / 'work/timeline.json'
ASSEMBLY_REPORT = ROOT / 'work/final-report.json'
IMPORT_REPORT = ROOT / 'music/source-import.json'
OUTPUT = ROOT / 'work/final-audio-verification.json'
KNOWN_SOURCE_SHA = '91f5993a91f49e455fe9c60f60cc799692a96a40afa78c6b80e0f35831dbe8c8'
SR = 48000
FFMPEG = os.environ.get('FFMPEG_PATH', 'ffmpeg')
FFPROBE = os.environ.get('FFPROBE_PATH', 'ffprobe')


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    require(path.is_file(), f'缺少真实输入：{path.relative_to(ROOT)}；未创建核验报告。')
    return json.loads(path.read_text(encoding='utf-8'))


def local_path(value, directory=None):
    require(isinstance(value, str) and value.strip(), '记录缺少有效素材路径。')
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT.resolve()), '只核验002实验内的真实文件。')
    if directory:
        require(path.is_relative_to((ROOT / directory).resolve()), f'素材必须位于{directory}目录。')
    require(path.is_file() and path.stat().st_size > 0, f'真实素材不存在或为空：{value}。')
    return path


def probe(path):
    return json.loads(subprocess.check_output([FFPROBE, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], encoding='utf-8'))


def decode(path):
    result = subprocess.run([FFMPEG, '-v', 'error', '-xerror', '-i', str(path), '-map', '0:a:0', '-vn', '-ac', '2', '-ar', str(SR), '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    require(result.returncode == 0 and result.stdout, f'完整浮点解码失败：{path.name}；未生成成功报告。')
    require(len(result.stdout) % 8 == 0, '立体声浮点解码字节数不完整。')
    samples = np.frombuffer(result.stdout, dtype='<f4').reshape(-1, 2)
    require(np.isfinite(samples).all(), '音频存在非有限浮点采样。')
    return samples


def db(value):
    return float(20 * np.log10(value)) if value > 0 else None


def fit(x, y):
    """One scalar gain and one scalar DC offset; no filtering/warping to improve scores."""
    a, b = x.reshape(-1).astype(np.float64), y.reshape(-1).astype(np.float64)
    ma, mb = float(np.mean(a)), float(np.mean(b))
    ac, bc = a - ma, b - mb
    aa, bb = float(np.dot(ac, ac)), float(np.dot(bc, bc))
    if aa <= 1e-12 or bb <= 1e-12:
        return {'correlation': None, 'gain_linear': None, 'gain_db': None, 'reason': '声音变化不足'}
    gain = float(np.dot(ac, bc) / aa)
    offset = mb - gain * ma
    residual = b - (gain * a + offset)
    signal_energy = float(np.dot(gain * ac, gain * ac))
    residual_energy = float(np.dot(residual, residual))
    return {'correlation': float(np.dot(ac, bc) / math.sqrt(aa * bb)), 'gain_linear': gain,
            'gain_db': db(gain) if gain > 0 else None, 'dc_offset': offset,
            'rms_ratio_db': db(math.sqrt(float(np.mean(b * b)) / float(np.mean(a * a)))) if np.mean(a * a) > 0 else None,
            'residual_snr_db': float(10 * np.log10(signal_energy / residual_energy)) if residual_energy > 0 and signal_energy > 0 else None,
            'residual_rms': float(math.sqrt(float(np.mean(residual * residual)))),
            'reference_rms_dbfs': db(math.sqrt(float(np.mean(a * a)))),
            'final_rms_dbfs': db(math.sqrt(float(np.mean(b * b))))}


def find_lag(source_mono, final_mono, source_start, length, expected_lag, search_radius):
    """Normalized direct waveform cross-correlation at an 8 kHz analysis rate."""
    start = max(0, int(source_start))
    length = min(int(length), len(source_mono) - start)
    low = max(-start, int(expected_lag - search_radius))
    high = min(len(final_mono) - start - length, int(expected_lag + search_radius))
    if length < 800 or high < low:
        return None
    x = source_mono[start:start + length].astype(np.float64)
    x -= np.mean(x)
    y = final_mono[start + low:start + high + length].astype(np.float64)
    x_energy = float(np.dot(x, x))
    if x_energy <= 1e-12:
        return None
    dots = signal.correlate(y, x, mode='valid', method='fft')
    cumulative = np.r_[0.0, np.cumsum(y)]
    cumulative2 = np.r_[0.0, np.cumsum(y * y)]
    sums = cumulative[length:] - cumulative[:-length]
    energy = cumulative2[length:] - cumulative2[:-length] - sums * sums / length
    valid = energy > 1e-12
    scores = np.full(dots.shape, -np.inf)
    scores[valid] = dots[valid] / np.sqrt(energy[valid] * x_energy)
    if not np.isfinite(scores).any():
        return None
    i = int(np.argmax(scores))
    return {'lag_samples_8k': low + i, 'correlation_8k': float(scores[i]),
            'at_search_boundary': i in (0, len(scores) - 1), 'search_range_samples_8k': [low, high]}


def aligned(source, final, lag):
    si, fi = max(0, -lag), max(0, lag)
    count = min(len(source) - si, len(final) - fi)
    require(count > SR, '对齐后没有足够的共同音频。')
    return source[si:si + count], final[fi:fi + count], si, fi, count


def main():
    require(len(sys.argv) == 1, '此核验使用固定真实输入，不接受替代或模拟文件参数。')
    t, report, imported = read_json(TIMELINE), read_json(ASSEMBLY_REPORT), read_json(IMPORT_REPORT)
    require(t.get('experiment_id') == '002-moon-and-earth' and t.get('status') == 'confirmed', '仅接受status=confirmed的002时间轴。')
    require(report.get('experiment_id') == '002-moon-and-earth' and report.get('status') == 'completed' and report.get('output_created') is True,
            '尚无completed的真实成片报告；拒绝假跑。')
    final = local_path(report.get('output'), 'final')
    require(final.suffix.lower() == '.mp4' and '.rendering.' not in final.name, '仅核验正式完成的MP4。')
    source = local_path('music/source-jing-feng-shuang.mp3', 'music')
    source_sha, final_sha, timeline_sha, report_sha = sha(source), sha(final), sha(TIMELINE), sha(ASSEMBLY_REPORT)
    require(source_sha == KNOWN_SOURCE_SHA == imported.get('sha256'), '用户原曲SHA与导入记录不一致。')
    require(report.get('sha256') == final_sha, '成片SHA与completed报告不一致。')
    inputs = report.get('inputs') or {}
    require(inputs.get('timeline', {}).get('sha256') == timeline_sha, 'completed报告对应的confirmed时间轴已变化。')
    require(inputs.get('audio', {}).get('sha256') == source_sha and sha(local_path(t.get('audio', {}).get('path'))) == source_sha,
            '合成报告/时间轴使用的统一音轨不是已登记的用户原MP3。')
    source_files = report.get('source_files') or []
    require(len(source_files) >= 2, '真实新原片不足两条；拒绝核验部分/模拟成片。')
    checked_clips = []
    for entry in source_files:
        raw = local_path(entry.get('path'), 'clips')
        require(raw.suffix.lower() == '.mp4' and sha(raw) == entry.get('sha256'), '真实下载原片缺失或与合成报告SHA不符。')
        checked_clips.append({'path': str(raw.relative_to(ROOT)).replace('\\', '/'), 'sha256': entry['sha256']})
    require(len({x['sha256'] for x in checked_clips}) >= 2, '至少需要两个不同的真实原片。')
    original_path = Path(imported.get('original_local_path', ''))
    original_check = {'present': original_path.is_file(), 'matches_import': None}
    if original_path.is_file():
        original_check['matches_import'] = sha(original_path) == source_sha
        require(original_check['matches_import'], '用户Downloads原文件与导入副本SHA不同，需人工核对版本。')

    final_probe, source_probe = probe(final), probe(source)
    native = [s for s in final_probe.get('streams', []) if s.get('codec_type') == 'audio']
    require(len(native) == 1 and native[0].get('codec_name') == 'aac', '最终成片应有唯一的原生AAC音乐流。')
    reference, rendered = decode(source), decode(final)
    reference_mono = signal.resample_poly(np.mean(reference.astype(np.float64), axis=1), 1, 6)
    final_mono = signal.resample_poly(np.mean(rendered.astype(np.float64), axis=1), 1, 6)
    # The middle 80% reduces codec-edge/padding influence while finding one constant delay.
    crop_start, crop_length = int(len(reference_mono) * .1), int(len(reference_mono) * .8)
    coarse = find_lag(reference_mono, final_mono, crop_start, crop_length, 0, 2000)
    require(coarse is not None, '无法测量有意义的对齐偏移，未生成成功报告。')
    coarse48 = coarse['lag_samples_8k'] * 6
    centers = np.linspace(2.0, len(reference) / SR - 2.0, 11)
    energies = [(float(np.mean(reference[max(0, round((c - 1.5) * SR)):min(len(reference), round((c + 1.5) * SR))].astype(np.float64) ** 2)), c) for c in centers]
    refine_center = max(energies)[1]
    rs, rn = round((refine_center - 1.5) * SR), 3 * SR
    refined = []
    for lag in range(coarse48 - 6, coarse48 + 7):
        if rs + lag < 0 or rs + lag + rn > len(rendered):
            continue
        metrics = fit(reference[rs:rs + rn], rendered[rs + lag:rs + lag + rn])
        if metrics['correlation'] is not None:
            refined.append((metrics['correlation'], lag))
    require(refined, '没有可用的全采样率偏移测量。')
    lag = max(refined)[1]
    x, y, si, fi, count = aligned(reference, rendered, lag)
    overall = fit(x, y)
    local = []
    for center in centers:
        start8 = round((center - 1.5) * 8000)
        found = find_lag(reference_mono, final_mono, start8, 24000, round(lag / 6), 2000)
        if found is None:
            local.append({'reference_center_s': float(center), 'measurable': False})
            continue
        local_lag = found['lag_samples_8k'] * 6
        a, b = round((center - 1.5) * SR), round((center + 1.5) * SR)
        if a + local_lag < 0 or b + local_lag > len(rendered):
            continue
        metrics = fit(reference[a:b], rendered[a + local_lag:b + local_lag])
        local.append({'reference_center_s': float(center), 'reference_window_s': [a / SR, b / SR], 'measurable': True,
                      'local_lag_s': local_lag / SR, **found, **metrics})
    reliable = [w for w in local if w.get('measurable') and (w.get('correlation') or -1) >= .8 and (w.get('reference_rms_dbfs') or -100) >= -50 and not w.get('at_search_boundary')]
    drift = {'reliable_window_count': len(reliable), 'lag_slope_seconds_per_second': None, 'estimated_audio_speed_ratio': None}
    if len(reliable) >= 3:
        slope, intercept = np.polyfit([w['reference_center_s'] for w in reliable], [w['local_lag_s'] for w in reliable], 1)
        drift.update(lag_slope_seconds_per_second=float(slope), estimated_audio_speed_ratio=float(1 / (1 + slope)),
                     predicted_end_to_end_lag_change_s=float(slope * len(reference) / SR), intercept_s=float(intercept))
    fps = float(t.get('fps', 25))
    declared_gain = float(t.get('audio', {}).get('gain_db', 0))
    final_peak = float(np.max(np.abs(rendered)))
    clipping_count = int(np.sum(np.abs(rendered) >= 1.0))
    duration_delta = (len(rendered) - len(reference)) / SR
    expected_padding = float(t['duration']) - len(reference) / SR
    advisory = []
    if overall.get('gain_db') is None or abs(overall['gain_db'] - (-1.5)) > .3:
        advisory.append('实测恒定增益与目标-1.5dB相差超过0.3dB，需审听/核对合成参数。')
    if abs(declared_gain - (-1.5)) > .001:
        advisory.append('confirmed时间轴声明的增益不是目标-1.5dB。')
    if (overall.get('correlation') or 0) < .95:
        advisory.append('整段波形相关低于0.95；AAC损失、错位或内容变化均可能影响，需审听定位。')
    if overall.get('residual_snr_db') is None or overall['residual_snr_db'] < 15:
        advisory.append('AAC相对标量拟合的残差SNR低于15dB，需审听，不能直接认定裁切或变速。')
    if abs(duration_delta - expected_padding) > max(.05, 2 * 1024 / SR):
        advisory.append('解码样本差超出声明补尾与常见AAC帧余量，需核对是否裁切。')
    if si > round(.02 * SR) or len(reference) - si - count > round(.02 * SR):
        advisory.append('对齐后源曲首/尾未覆盖超过20ms；需要检查编码边界或裁切。')
    if drift.get('predicted_end_to_end_lag_change_s') is not None and abs(drift['predicted_end_to_end_lag_change_s']) > .01:
        advisory.append('可靠窗口的偏移随时间漂移超过10ms，需检查变速/采样率及错峰匹配。')
    if any(w.get('at_search_boundary') for w in local):
        advisory.append('部分局部对齐落在搜索边界，变速估计可能不完整。')
    if clipping_count:
        advisory.append('最终AAC浮点解码存在绝对值>=1的样本，需检查播放削波风险。')
    # Refuse races: hashes must still match the exact completed assembly that was measured.
    require(sha(source) == source_sha and sha(final) == final_sha and sha(TIMELINE) == timeline_sha and sha(ASSEMBLY_REPORT) == report_sha,
            '测量时输入文件发生变化；未写报告。')
    result = {
        'schema_version': 1, 'experiment_id': '002-moon-and-earth', 'status': 'measured_needs_review',
        'purpose': '最终成片音乐完整性核验；不是生成模型原片native音轨QA，不验证嘴形或唱词。',
        'measured_at': datetime.now(timezone.utc).isoformat(), 'paid_calls': 0, 'sources_modified': False,
        'source': {'path': 'music/source-jing-feng-shuang.mp3', 'sha256': source_sha, 'user_original_byte_check': original_check, 'probe': source_probe},
        'final': {'path': str(final.relative_to(ROOT)).replace('\\', '/'), 'sha256': final_sha, 'probe': final_probe},
        'preconditions': {'timeline_status': 'confirmed', 'timeline_sha256': timeline_sha, 'assembly_status': 'completed', 'assembly_report_sha256': report_sha,
                          'final_hash_matches_report': True, 'source_hash_matches_user_import': True, 'real_raw_clips': checked_clips},
        'decode': {'method': 'ffmpeg full 0:a:0 decode to 48000 Hz stereo f32le; no limiter, time stretch or gain applied during verification',
                   'sample_rate': SR, 'channels': 2, 'source_frames': len(reference), 'final_frames': len(rendered),
                   'source_channel_samples': int(reference.size), 'final_channel_samples': int(rendered.size),
                   'source_duration_s': len(reference) / SR, 'final_duration_s': len(rendered) / SR,
                   'sample_frame_delta': len(rendered) - len(reference), 'duration_delta_s': duration_delta,
                   'timeline_duration_s': t['duration'], 'expected_append_silence_s': expected_padding,
                   'declared_audio_alignment': inputs.get('audio', {}).get('alignment'), 'full_decode_completed': True, 'all_samples_finite': True},
        'alignment': {'method': '8kHz waveform normalized cross-correlation, then 48kHz +/-6-frame refinement on energetic 3s window',
                      'coarse': coarse, 'refined_lag_sample_frames_48k': lag, 'refined_lag_seconds': lag / SR,
                      'lag_meaning': 'positive = final decoded audio occurs later than reference',
                      'reference_start_frame': si, 'final_start_frame': fi, 'compared_frames': count,
                      'uncovered_source_start_frames': si, 'uncovered_source_end_frames': len(reference) - si - count,
                      'final_extra_tail_frames': len(rendered) - fi - count, 'refinement_window_center_s': float(refine_center)},
        'overall_music_comparison': {**overall, 'expected_gain_db': -1.5, 'timeline_declared_gain_db': declared_gain,
                                     'measured_gain_delta_to_expected_db': overall['gain_db'] + 1.5 if overall.get('gain_db') is not None else None},
        'local_windows': local, 'timing_drift': drift,
        'final_float_level': {'sample_peak_linear': final_peak, 'sample_peak_dbfs': db(final_peak), 'samples_abs_ge_1': clipping_count,
                              'sample_peak_is_not_oversampled_true_peak': True},
        'advisories': advisory, 'automatic_integrity_pass': None, 'manual_music_review': 'required', 'lip_sync_verified': None,
        'interpretation': '只报告实测和宽松复核提示；AAC为有损编码，残差不要求逐样本镜像。样本覆盖、声明补尾、全局与局部对齐共同帮助识别裁切或变速。',
        'limitations': ['编码延迟、MP4 edit list和AAC帧余量可能影响解码样本数与首尾覆盖；边界静音无法靠相关性单独证明完整。',
                        '最小二乘增益和波形相关不等于音乐听感验收；残差包含AAC损失与潜在处理差异。',
                        '局部拍点/旋律重复可能造成错峰，速度比仅在可靠窗口足够时提供候选。',
                        '此报告检查最终统一原曲，不应替换work/video-qa.json原片模型native音轨结果，更不能证明嘴形准确。']}
    temporary = OUTPUT.with_name(OUTPUT.name + f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    temporary.replace(OUTPUT)
    print(json.dumps({'status': result['status'], 'report': str(OUTPUT.relative_to(ROOT)), 'lag_s': lag / SR,
                      'gain_db': overall.get('gain_db'), 'correlation': overall.get('correlation'), 'residual_snr_db': overall.get('residual_snr_db'),
                      'source_frames': len(reference), 'final_frames': len(rendered), 'advisories': advisory}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f'最终音乐核验未执行或未完成：{exc}', file=sys.stderr)
        raise SystemExit(2)
