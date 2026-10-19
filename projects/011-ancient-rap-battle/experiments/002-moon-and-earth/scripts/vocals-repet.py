"""Approximate foreground candidate, never a clean vocal stem or final soundtrack.

Adapted from Brian McFee's ISC-licensed librosa vocal-separation example:
https://librosa.org/doc/0.11.0/auto_examples/plot_vocal_separation.html
The local changes preserve full decoded duration, use native-rate mono audio,
retain the original phase, and record every processing parameter and file hash.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import time

import librosa
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "music" / "source-jing-feng-shuang.mp3"
OUTPUT = ROOT / "work" / "vocals-repet-candidate.wav"
REPORT = ROOT / "work" / "vocals-repet-report.json"
NOTES = ROOT / "work" / "VOCALS-REPET.md"
EXAMPLE = "https://librosa.org/doc/0.11.0/auto_examples/plot_vocal_separation.html"
NN_DOC = "https://librosa.org/doc/0.11.0/generated/librosa.decompose.nn_filter.html"


def sha(filename: Path) -> str:
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def db(value: float) -> float:
    return round(float(20 * np.log10(max(value, 1e-12))), 4)


def main() -> None:
    started = time.monotonic()
    SOURCE_HASH = sha(SOURCE)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(SOURCE)
    ], text=True, encoding="utf-8"))
    stream = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    sample_rate, channels = int(stream["sample_rate"]), int(stream["channels"])
    # Decode the entire native-rate stream from time zero. No trimming, stretching,
    # VAD, silence removal, timestamps from ASR, or reference lyric hints are used.
    pcm = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(SOURCE), "-map", "0:a:0",
        "-f", "f32le", "-acodec", "pcm_f32le", "-ar", str(sample_rate), "pipe:1"
    ])
    samples = np.frombuffer(pcm, dtype="<f4").reshape(-1, channels)
    mono = samples.mean(axis=1, dtype=np.float32)
    n_samples = len(mono)
    duration = n_samples / sample_rate
    print(json.dumps({"stage": "decoded", "samples": n_samples, "duration": duration, "sample_rate": sample_rate}), flush=True)

    # The official example uses n_fft=2048/hop=512 at 22050Hz. Doubling both at
    # the native 44100Hz rate retains the same analysis time/frequency resolution.
    n_fft, hop_length = 4096, 1024
    spectrum = librosa.stft(mono, n_fft=n_fft, hop_length=hop_length, center=True)
    magnitude = np.abs(spectrum)
    width = int(librosa.time_to_frames(2, sr=sample_rate, hop_length=hop_length))
    print(json.dumps({"stage": "nn_filter", "spectrogram_shape": list(magnitude.shape), "exclude_nearby_frames": width}), flush=True)
    repeated = librosa.decompose.nn_filter(
        magnitude, aggregate=np.median, metric="cosine", width=width
    )
    repeated = np.minimum(magnitude, repeated)
    # A lower foreground margin than the example's 10 is deliberate: this is a
    # conservative ASR candidate, retaining more overlap rather than claiming an
    # isolated voice. It can still remove consonants and retain solo instruments.
    margin_v, power = 3.0, 2.0
    foreground_mask = librosa.util.softmask(
        magnitude - repeated, margin_v * repeated, power=power
    )
    foreground = librosa.istft(
        foreground_mask * spectrum, hop_length=hop_length, center=True, length=n_samples
    ).astype(np.float32)
    assert foreground.shape == mono.shape and np.isfinite(foreground).all()

    # One scalar gain makes a quiet candidate usable for listening and ASR.
    # It does not change the timing or claim recovery of the original stem.
    peak_before_gain = float(np.max(np.abs(foreground)))
    gain = min(8.0, (10 ** (-1 / 20)) / max(peak_before_gain, 1e-12))
    foreground *= gain
    sf.write(str(OUTPUT), foreground, sample_rate, subtype="PCM_24")
    output_info = sf.info(OUTPUT)
    assert output_info.frames == n_samples and output_info.samplerate == sample_rate
    assert sha(SOURCE) == SOURCE_HASH, "Original song must remain unchanged."
    report = {
        "schema_version": 1,
        "status": "candidate_completed",
        "kind": "伴奏抑制后的近似人声候选；不是干净真分轨",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input": {"path": "music/source-jing-feng-shuang.mp3", "sha256": SOURCE_HASH,
                  "bytes": SOURCE.stat().st_size, "sample_rate": sample_rate, "channels": channels,
                  "decoded_samples": n_samples, "decoded_duration_seconds": duration,
                  "container_duration_seconds": float(probe["format"]["duration"])},
        "output": {"path": "work/vocals-repet-candidate.wav", "sha256": sha(OUTPUT),
                   "bytes": OUTPUT.stat().st_size, "sample_rate": sample_rate, "channels": 1,
                   "samples": output_info.frames, "duration_seconds": output_info.duration,
                   "encoding": "PCM_24"},
        "method": {"name": "REPET-SIM-inspired nearest-neighbour median + soft foreground mask",
                   "reference_example": EXAMPLE, "reference_api": NN_DOC,
                   "example_author": "Brian McFee", "example_code_license": "ISC",
                   "n_fft": n_fft, "hop_length": hop_length, "center": True,
                   "neighbour_metric": "cosine", "aggregation": "numpy.median",
                   "exclude_nearby_seconds": 2.0, "exclude_nearby_frames": width,
                   "foreground_margin": margin_v, "official_example_foreground_margin": 10,
                   "mask_power": power, "original_phase_preserved": True,
                   "mono_conversion": "arithmetic mean of decoded stereo channels",
                   "scalar_output_gain": gain, "gain_db": db(gain),
                   "resampled": False, "time_stretched": False, "trimmed": False},
        "timing": {"offset_seconds": 0, "input_output_sample_delta": output_info.frames - n_samples,
                   "full_decoded_timeline_preserved": True,
                   "no_asr_or_lyric_alignment_performed": True},
        "level_check": {"input_peak_dbfs": db(float(np.max(np.abs(mono)))),
                        "output_peak_dbfs": db(float(np.max(np.abs(foreground)))),
                        "input_rms_dbfs": db(float(np.sqrt(np.mean(mono.astype(np.float64) ** 2)))),
                        "output_rms_dbfs": db(float(np.sqrt(np.mean(foreground.astype(np.float64) ** 2)))),
                        "all_samples_finite": True, "clipped_samples": int(np.count_nonzero(np.abs(foreground) >= 1))},
        "runtime": {k: importlib.metadata.version(k) for k in ["librosa", "numpy", "scipy", "soundfile"]},
        "original_song_unchanged": True, "paid_calls": 0, "new_models_downloaded": False,
        "external_uploads": False, "elapsed_seconds": round(time.monotonic() - started, 3),
        "limitations": [
            "仅按重复程度估计前景，可能保留鼓点、独奏和混响，也可能移除重复的人声或损伤辅音。",
            "librosa官方将此例标为历史方法，不推荐作为有竞争力的人声分离方案。",
            "不作为干净人声分轨、歌词确认、唱词时间或口型准确度证明；需与原mix及其他候选比较。",
            "原始歌曲未改动；本文件仅用于辅助ASR或人工审听，视频参考是否采用须另行检查。"
        ]
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    NOTES.write_text(
        "# 近似人声候选：REPET-SIM\n\n"
        "本文件仅用于辅助识别或审听，不是干净真分轨，不能据此确认歌词时间或精准口型。原歌曲没有修改。\n\n"
        f"- 输入：`music/source-jing-feng-shuang.mp3`，SHA-256 `{SOURCE_HASH}`。\n"
        f"- 输出：`work/vocals-repet-candidate.wav`，{sample_rate} Hz、单声道24位PCM，{duration:.9f}秒。\n"
        f"- 输出SHA-256：`{report['output']['sha256']}`。\n"
        "- 原始立体声取均值，按最近邻频谱的中位数估计重复伴奏，用软掩码保留较不重复的前景，再用原相位重建。\n"
        f"- STFT {n_fft}/{hop_length}，最近邻排除2秒以内相邻帧，余弦距离、前景margin={margin_v:g}、power={power:g}。\n"
        f"- 与官方示例margin=10相比，本候选采用margin=3保留更多重叠声音；输出仅作标量增益{gain:.6f}，不变速、不剪静音、不移动时间。\n"
        f"- 输入/输出均为{n_samples}个样本，偏移0秒；容器标示秒数与解码样本时长的微小差异保留在报告中。\n\n"
        "可能损伤字音、保留乐器或混响，是否改善ASR需另行比较。没有安装torch/Demucs、没有下载新模型、没有付费请求或外部上传。\n\n"
        f"方法来源：[librosa 0.11.0官方示例]({EXAMPLE})、[nn_filter API]({NN_DOC})。示例作者Brian McFee，代码许可ISC；官方说明其属于历史方法，不是当前推荐的人声分离质量基准。\n\n"
        "复现：在实验目录运行 `python scripts/vocals-repet.py`；详细参数、样本数、散列及运行库版本见 `work/vocals-repet-report.json`。\n",
        encoding="utf-8"
    )
    print(json.dumps({"stage": "completed", "output": str(OUTPUT), "sha256": report["output"]["sha256"], "duration": duration, "elapsed_seconds": report["elapsed_seconds"]}), flush=True)


if __name__ == "__main__":
    main()
