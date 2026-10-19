"""Prepare a five-second, audio-first H3 request without submitting or uploading.

Uses Python's standard library and the existing ffmpeg installation only.
No credentials, model downloads, account requests or billable calls are made.
Reference: https://platform.minimax.io/docs/api-reference/video-generation-v2-create
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "work/audio-driven-repair"
SONG = ROOT / "music/source-ya-zhou-ren-jian.mp3"
SONG_SHA = "cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0"
REFS = [
    (ROOT / "refs/R02-LIBAI.png", "a256de20e8960a30fde923c15684ae13491dcc3b59357c3888f83e0695c4f871"),
    (ROOT / "refs/R04-STAGE.png", "e2ee6d16ca14fbc1cdd805771c977e56e1374ae1b91aad7615b5247695b1da4a"),
]


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def data_url(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    if sha(SONG) != SONG_SHA:
        raise ValueError("The song is not the user-approved original.")
    for image, expected in REFS:
        if sha(image) != expected:
            raise ValueError(f"Locked character/stage reference changed: {image.name}")
    OUT.mkdir(parents=True, exist_ok=True)
    driver = OUT / "VA01-original-song-9.4-to-14.4.wav"
    subprocess.run([
        "ffmpeg", "-v", "error", "-i", str(SONG), "-ss", "9.4", "-t", "5",
        "-map", "0:a:0", "-vn", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le",
        "-y", str(driver),
    ], check=True, capture_output=True)
    with wave.open(str(driver), "rb") as wav:
        audio = {"frames": wav.getnframes(), "sample_rate": wav.getframerate(),
                 "channels": wav.getnchannels(), "sample_width": wav.getsampwidth()}
    if audio != {"frames": 240000, "sample_rate": 48000, "channels": 2, "sample_width": 2}:
        raise ValueError("The pilot must contain exactly five seconds of original audio.")
    prompt = (
        "五秒单一连续镜头。参考第一张人物图片中的李白身份、五官、金色发冠、象牙白与青绿色长袍，"
        "舞台环境遵循第二张参考图片。正面胸部以上中近景，稳定机位，嘴部全程清晰可见，"
        "麦克风在嘴侧下方，避免遮挡嘴部。李白演唱随附唯一参考音频中的已有歌词："
        "“我携一身月色，踏过长安的墙”。以输入音频为时间基准，开口、闭口、停顿、拖音与"
        "音节时序一致，前后空隙自然闭嘴与呼吸。保留参考音频的歌词、旋律、速度和声音时序。"
        "人物的细微表情跟随原曲；固定单人机位，先验证演唱对应。"
    )
    prompt_path = OUT / "VA01-prompt.txt"
    prompt_path.write_text(prompt + "\n", encoding="utf-8")
    content = [{"type": "text", "text": prompt}]
    content.extend({"type": "image_url", "image_url": {"url": data_url(p, "image/png")},
                    "role": "reference_image"} for p, _ in REFS)
    content.append({"type": "audio_url", "audio_url": {"url": data_url(driver, "audio/wav")},
                    "role": "reference_audio"})
    request = {"model": "MiniMax-H3", "content": content, "resolution": "768P",
               "duration": 5, "ratio": "16:9"}
    request_path = OUT / "VA01-h3-request-offline.json"
    save(request_path, request)
    assert request_path.stat().st_size < 64 * 1024 * 1024
    assert sum(c["type"] == "audio_url" and c.get("role") == "reference_audio" for c in content) == 1
    for c in content:
        if c["type"] == "image_url":
            assert c["image_url"]["url"].startswith("data:image/png;base64,")
        if c["type"] == "audio_url":
            encoded = c["audio_url"]["url"].split(",", 1)[1]
            assert hashlib.sha256(base64.b64decode(encoded)).hexdigest() == sha(driver)
    manifest = {
        "schema_version": 1,
        "prepared_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "prepared-offline-not-submitted",
        "purpose": "Validate original-song singing correspondence before any full-song repair.",
        "provider_candidate": "MiniMax official pay-as-you-go H3",
        "official_api_reference": "https://platform.minimax.io/docs/api-reference/video-generation-v2-create",
        "official_capability_example": "https://www.minimax.io/blog/minimax-h3",
        "song_sha256": SONG_SHA,
        "song_in": 9.4, "song_out": 14.4,
        "lyrics": "我携一身月色，踏过长安的墙",
        "audio": {"path": driver.relative_to(ROOT).as_posix(), "sha256": sha(driver), **audio,
                  "duration": 5, "gain_db": 0, "contains_original_instrumental": True,
                  "isolated_vocals_claimed": False},
        "references": [{"path": p.relative_to(ROOT).as_posix(), "sha256": digest} for p, digest in REFS],
        "request": {"path": request_path.relative_to(ROOT).as_posix(), "sha256": sha(request_path),
                    "bytes": request_path.stat().st_size, "typed_audio_present": True,
                    "images": 2, "audio_inputs": 1},
        "acceptance_required": ["Original lyric and timing preserved, without re-singing or changed tempo.",
                                "Visible mouth opening, closures, pauses and held notes follow the same original clip.",
                                "Character identity and unobstructed mouth retained in normal-speed audiovisual review."],
        "pipeline_ready_for_batch": False,
        "remote_route_tested": False,
        "singing_lip_sync_passed": False,
        "api_configuration_confirmed": False,
        "separate_provider_spend_authorized": False,
        "chatart_diamond_authorization_transferable": False,
        "network_calls": 0, "uploads": 0, "billable_calls": 0, "local_models_downloaded": 0,
    }
    save(OUT / "pilot-plan.json", manifest)
    print(json.dumps({"status": manifest["status"], "duration": 5, "images": 2,
                      "typed_audio_inputs": 1, "billable_calls": 0,
                      "remote_singing_test_passed": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
