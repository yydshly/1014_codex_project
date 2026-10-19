"""tiny离线转写A01/A02原片与原始参考音频；只下载模型数据，不运行远端代码。"""
from __future__ import annotations
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work"
MODEL = WORK / "model-cache" / "faster-whisper-tiny"
REPO = "Systran/faster-whisper-tiny"
REVISION = "d90ca5fe260221311c53c58e660288d3deb8d356"
FILES = {"config.json": 2249, "model.bin": 75538270, "tokenizer.json": 2203239, "vocabulary.txt": 459861}
OUT = WORK / "asr-review.json"

def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def save(value):
    OUT.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def prepare_model(allow_download: bool):
    MODEL.mkdir(parents=True, exist_ok=True)
    (WORK / "model-cache" / ".gitignore").write_text("*\n!.gitignore\n", encoding="utf-8")
    started = time.monotonic()
    manifests = []
    for name, expected in FILES.items():
        target = MODEL / name
        if not target.is_file() or target.stat().st_size != expected:
            if not allow_download:
                raise RuntimeError("model_not_cached_use_allow_download")
            # 单次请求，20秒网络超时，整个下载90秒预算；失败不重试。
            request = urllib.request.Request(f"https://huggingface.co/{REPO}/resolve/{REVISION}/{name}", headers={"User-Agent": "local-asr-review/1"})
            part = target.with_suffix(target.suffix + ".part")
            with urllib.request.urlopen(request, timeout=20) as response, part.open("wb") as output:
                while True:
                    if time.monotonic() - started > 90:
                        raise TimeoutError("model_download_budget_exceeded")
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    output.write(block)
            if part.stat().st_size != expected:
                raise RuntimeError("downloaded_model_size_mismatch")
            part.replace(target)
            print(f"模型数据已保存：{name} / {expected:,} bytes", flush=True)
        manifests.append({"file": name, "size_bytes": target.stat().st_size, "sha256": sha(target)})
    return manifests

def main():
    global OUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-download", action="store_true")
    parser.add_argument("--ids", nargs="+", choices=["A01", "A02", "B01", "B02"], default=["A01", "A02"])
    args = parser.parse_args()
    if args.ids != ["A01", "A02"]:
        OUT = WORK / ("-".join(args.ids) + "-asr-review.json")
    base = {"schema_version": 1, "method": "同一tiny模型无歌词提示独立转写原片与原始参考音频", "model": {"repo": REPO, "revision": REVISION,
        "source_url": f"https://huggingface.co/{REPO}/tree/{REVISION}", "license": "MIT", "remote_code_executed": False, "local_model_dir": str(MODEL)},
        "paid_calls": 0, "audio_modified": False, "limitations": ["tiny中文短句可能错字、漏字、幻觉或使用繁体，不能把ASR误差直接归因于生成服务改词。", "avg_logprob、no_speech_prob和word.probability是模型内部指标，不是经过校准的准确率。", "即使识别文字相同，也不能证明逐音素口型同步。", "未向模型提供预期歌词，不使用提示词纠正识别；只做原片和参考音频的同条件对照。"]}
    try:
        base["model"]["files"] = prepare_model(args.allow_download)
    except Exception as e:
        base.update(status="model_download_or_cache_failed", error={"type": type(e).__name__, "http_status": getattr(e, "code", None), "automatic_retries": 0})
        save(base)
        print(json.dumps({"status": base["status"], "error": base["error"]}, ensure_ascii=False), flush=True)
        return 2
    from faster_whisper import WhisperModel
    base["runtime"] = {"faster_whisper_version": importlib.metadata.version("faster-whisper"), "device": "cpu", "compute_type": "int8", "cpu_threads": 4}
    model = WhisperModel(str(MODEL), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    settings = dict(language="zh", task="transcribe", beam_size=5, temperature=0.0, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
    base["transcribe_settings"] = settings
    sources = [(f"{id}-reference", WORK / "audio" / "raw" / f"{id}.mp3", "原始参考TTS") for id in args.ids]
    sources += [(f"{id}-generated", ROOT / "clips" / f"{id}_t1.mp4", "生成原片自带音轨") for id in args.ids]
    base["results"] = []
    for id, path, kind in sources:
        before = sha(path)
        started = time.monotonic()
        segments, info = model.transcribe(str(path), **settings)
        output = []
        for s in segments:
            output.append({"start": s.start, "end": s.end, "text": s.text, "avg_logprob": s.avg_logprob, "no_speech_prob": s.no_speech_prob,
                "compression_ratio": s.compression_ratio, "words": [{"start": w.start, "end": w.end, "word": w.word, "probability": w.probability} for w in (s.words or [])]})
        result = {"id": id, "kind": kind, "path": str(path), "sha256": before, "unchanged_after_read": sha(path) == before, "elapsed_seconds": round(time.monotonic() - started, 3),
            "text": "".join(s["text"] for s in output).strip(), "language": info.language, "language_was_forced": True, "duration": info.duration, "segments": output}
        base["results"].append(result)
        base["status"] = "in_progress"
        save(base)
        print(json.dumps({"id": id, "text": result["text"], "segments": [{"avg_logprob": s["avg_logprob"], "no_speech_prob": s["no_speech_prob"]} for s in output], "elapsed_seconds": result["elapsed_seconds"]}, ensure_ascii=False), flush=True)
    base["status"] = "completed"
    save(base)
    print(f"ASR结果已保存：{OUT.relative_to(ROOT)}；不构成口型证明。", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
