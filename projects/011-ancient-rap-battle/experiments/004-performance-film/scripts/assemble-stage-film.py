"""Render the explicitly requested ordinary-video stage montage, without lip-sync models.

Uses only standard Python, Pillow/numpy already installed, and system ffmpeg/ffprobe.
All paths in the input/output manifest are relative to experiment 004.
Nothing here submits remote jobs, downloads models, updates billing, or replaces the
older precise-lip-sync assembler. A real, reviewed source manifest is required.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "work/stage-film-20261016"
SONG_SHA = "cfd1b761118e601384589fbaed54b8d6260093f031d59570bab24b277e3899b0"
FPS = 25
TOTAL_FRAMES = 2366
SAMPLE_RATE = 48000
SONG_FRAMES = 4541545
TARGET_AUDIO_FRAMES = 4542720

# Every source interval is used once, at its native speed. Cuts follow the song's
# section/phrase candidates. Exact singing visemes are deliberately not claimed.
EDIT = [
    (0, 3.2, "OPEN", 0, "月下舞台揭幕"),
    (3.2, 5.6, "CROWD2", 0, "看台预热"),
    (5.6, 9.4, "OPEN", 3.2, "双人登场"),
    (9.4, 14.4, "SINGING", 0, "李白首句"),
    (14.4, 19, "LIBAI1", 1.8, "李白主歌中景，取抬麦之后"),
    (19, 21.6, "LIBAI2", 0, "李白衣袖与转身细节"),
    (21.6, 24.2, "CROWD1", 0, "观众回应"),
    (24.2, 26, "LIBAI2", 2.6, "青绿衣带与舞台步伐", "S07B"),
    (26, 28.52, "LIBAI1", 6.4, "李白抬手收句"),
    (28.52, 33.32, "DUFU1", 0, "杜甫接唱"),
    (33.32, 37.92, "DUFU2", 0, "杜甫另一机位"),
    (37.92, 42.24, "DUFU1", 4.8, "杜甫主歌收束"),
    (42.24, 46.96, "DUET", 0, "副歌双人互动"),
    (46.96, 49.76, "LIBAI2", 4.4, "衣摆与靴步的副歌细节"),
    (49.76, 54.32, "DUFU2", 4.6, "杜甫副歌回应"),
    (54.32, 56.84, "OPEN", 7, "桥段双人相和"),
    (56.84, 59.32, "DUET", 4.72, "桥段二人对望"),
    (59.32, 61.92, "CROWD2", 7.36, "木看台观众回应"),
    (61.92, 64.64, "DUET", 7.2, "桥段相和"),
    (64.64, 68.6, "WIDE", 0, "最终副歌舞台展开"),
    (68.6, 70.56, "CROWD2", 2.4, "高层看台呼应"),
    (70.56, 73.32, "WIDE", 3.96, "双人舞台高潮"),
    (73.32, 76.4, "CROWD1", 2.6, "观众合拍欢呼"),
    (76.4, 79.6, "WIDE", 6.72, "副歌大舞台收势"),
    (79.6, 82.6, "CROWD2", 4.36, "全场倾听终句"),
    (82.6, 89.2, "FINALE", 0, "双人终句后鞠躬谢幕"),
    (89.2, 91.6, "CROWD1", 5.68, "尾奏观众掌声画面"),
    (91.6, 94.64, "FINALE", 6.6, "舞台拉远落幕"),
]


def run(args, *, binary=False):
    p = subprocess.run([str(x) for x in args], capture_output=True)
    if p.returncode:
        raise RuntimeError(f"{args[0]} failed ({p.returncode}): {p.stderr.decode('utf-8', 'replace')[-5000:]}")
    return p.stdout if binary else p.stdout.decode("utf-8-sig", "replace")


def local(value):
    p = (ROOT / value).resolve()
    if not p.is_relative_to(ROOT) or p == ROOT:
        raise ValueError(f"Path outside experiment 004: {value}")
    return p


def rel(p):
    return Path(p).relative_to(ROOT).as_posix()


def sha(p):
    h = hashlib.sha256()
    with Path(p).open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def read_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8-sig"))


def write_json(p, value):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def probe(p, count=True):
    args = ["ffprobe", "-v", "error"]
    if count:
        args += ["-count_frames"]
    return json.loads(run(args + ["-show_streams", "-show_format", "-of", "json", p]))


def video_info(p):
    data = probe(p)
    v = next(s for s in data["streams"] if s["codec_type"] == "video")
    fps_num, fps_den = map(int, v["avg_frame_rate"].split("/"))
    fps = fps_num / fps_den
    frames = int(v.get("nb_read_frames", v.get("nb_frames", 0)))
    duration = float(v.get("duration", data["format"]["duration"]))
    return {"path": rel(p), "sha256": sha(p), "bytes": p.stat().st_size,
            "width": v["width"], "height": v["height"], "fps": fps,
            "frames": frames, "duration": duration,
            "container_duration": float(data["format"]["duration"])}


def make_review(source_id, source_path):
    """All-frame decode + nine real frames, not a numeric identity/lip verdict."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont

    p = local(source_path)
    info = video_info(p)
    if info["frames"] < 100 or abs(info["frames"] / info["fps"] - info["duration"]) > .1:
        raise ValueError(f"Incomplete or inconsistent video stream: {source_id}")
    out = WORK / "reviews" / source_id
    out.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 18)
    sheet = Image.new("RGB", (3 * 384, 3 * 242), "#11151d")
    draw = ImageDraw.Draw(sheet)
    for index in range(9):
        t = 0.08 + max(0, info["duration"] - 0.2) * index / 8
        frame = out / f"frame-{index + 1:02d}.jpg"
        run(["ffmpeg", "-v", "error", "-ss", f"{t:.6f}", "-i", p,
             "-frames:v", "1", "-vf", "scale=384:216:force_original_aspect_ratio=decrease,pad=384:216:(ow-iw)/2:(oh-ih)/2", "-q:v", "2", "-y", frame])
        image = Image.open(frame).convert("RGB")
        x, y = index % 3 * 384, index // 3 * 242
        sheet.paste(image, (x, y))
        draw.text((x + 8, y + 218), f"{source_id}  {t:.2f}s", font=font, fill="#e9edf2")
    contact = out / "contact-sheet.jpg"
    sheet.save(contact, quality=93)
    # A cheap grayscale full-stream measure only flags suspiciously static input.
    # Camera motion also contributes, so it never establishes actor/hand motion.
    raw = run(["ffmpeg", "-v", "error", "-i", p, "-an", "-vf", "scale=160:90,format=gray", "-f", "rawvideo", "pipe:1"], binary=True)
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 90, 160).astype(np.float32)
    diff = np.abs(frames[1:] - frames[:-1]).mean(axis=(1, 2))
    record = {**info, "all_frames_decoded": int(frames.shape[0]),
              "consecutive_frame_mean_abs_difference": {"median": float(np.median(diff)), "mean": float(diff.mean()), "min": float(diff.min()), "max": float(diff.max())},
              "metric_limit": "含相机移动/光雾变化，仅辅助检查，不证明人物一致、动作质量或歌曲口型。",
              "contact_sheet": rel(contact), "review": {"accepted_for_final": None, "identity_preserved": None, "motion_reviewed": None},
              "precise_lip_sync_evaluated": False}
    write_json(out / "review.json", record)
    return record


def final_contacts(final, shots):
    """Editorial review evidence: one real midpoint per shot plus cut neighbours."""
    from PIL import Image, ImageDraw, ImageFont
    directory = WORK / "final-review"
    directory.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)
    pages = []
    for offset in range(0, len(shots), 9):
        page = Image.new("RGB", (1152, 726), "#10141c")
        draw = ImageDraw.Draw(page)
        for position, shot in enumerate(shots[offset:offset + 9]):
            t = (shot["slot_start"] + shot["slot_end"]) / 2
            frame = directory / f"{shot['id']}-midpoint.jpg"
            run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", final, "-frames:v", "1",
                 "-vf", "scale=384:216", "-q:v", "2", "-y", frame])
            x, y = position % 3 * 384, position // 3 * 242
            page.paste(Image.open(frame).convert("RGB"), (x, y))
            draw.text((x + 5, y + 218), f"{shot['id']} {t:.2f}s {shot['source_id']}", font=font, fill="#e9edf2")
        target = directory / f"storyboard-{offset // 9 + 1:02d}.jpg"
        page.save(target, quality=94)
        pages.append(rel(target))
    cut_pages = []
    boundaries = shots[1:]
    for offset in range(0, len(boundaries), 8):
        page = Image.new("RGB", (1152, 760), "#10141c")
        draw = ImageDraw.Draw(page)
        for position, shot in enumerate(boundaries[offset:offset + 8]):
            frame_index = shot["start_frame"]
            x, y = position % 2 * 576, position // 2 * 190
            for side, index in enumerate([frame_index - 1, frame_index]):
                frame = directory / f"cut-{frame_index:04d}-{side}.jpg"
                run(["ffmpeg", "-v", "error", "-ss", f"{index / FPS:.6f}", "-i", final, "-vf", "scale=288:162",
                     "-frames:v", "1", "-q:v", "2", "-y", frame])
                page.paste(Image.open(frame).convert("RGB"), (x + side * 288, y))
            draw.text((x + 5, y + 164), f"{shot['slot_start']:.2f}s → {shot['source_id']}", font=font, fill="#e9edf2")
        target = directory / f"cuts-{offset // 8 + 1:02d}.jpg"
        page.save(target, quality=94)
        cut_pages.append(rel(target))
    return {"storyboard_pages": pages, "cut_neighbour_pages": cut_pages,
            "scope": "真实成片各镜头中点及全部切口前后帧；需另做全片原速审看，静帧不是口型或连续动作验收。"}


def make_timeline():
    shots = []
    original_index = 0
    for row in EDIT:
        start, end, source, source_in, intent = row[:5]
        if len(row) == 6:
            shot_id = row[5]
        else:
            original_index += 1
            shot_id = f"S{original_index:02d}"
        first, last = round(start * FPS), round(end * FPS)
        assert abs(start * FPS - first) < 1e-6 and abs(end * FPS - last) < 1e-6
        shots.append({"id": shot_id, "source_id": source,
                      "slot_start": start, "slot_end": end, "start_frame": first,
                      "end_frame_exclusive": last, "frames": last - first,
                      "source_in": source_in, "source_out": round(source_in + end - start, 6),
                      "speed": 1, "intent": intent, "transition": "straight-cut"})
    assert shots[0]["start_frame"] == 0 and shots[-1]["end_frame_exclusive"] == TOTAL_FRAMES
    for previous, current in zip(shots, shots[1:]):
        assert previous["end_frame_exclusive"] == current["start_frame"]
    for source in {s["source_id"] for s in shots}:
        clips = sorted((s["source_in"], s["source_out"]) for s in shots if s["source_id"] == source)
        assert all(a[1] <= b[0] + 1e-6 for a, b in zip(clips, clips[1:])), f"Repeated source range {source}"
    return shots


def caption_events():
    candidate = read_json(ROOT / "work/lyrics-timing-candidate.json")
    accepted, omitted = [], []
    for line in candidate["lyric_occurrences"]:
        if not line["caption_allowed_without_further_review"]:
            omitted.append({"id": line["id"], "text": line["text_from_user_confirmed_reference"], "reason": line["timing_status"]})
            continue
        accepted.append({"id": line["id"], "text": line["text_from_user_confirmed_reference"],
                         "start": line["heard_start_candidate"], "end": line["heard_end_candidate"],
                         "actor_reference": line["actor_reference"], "timing_status": line["timing_status"]})
    return accepted, omitted


def ass_time(value):
    value = int(round(value * 100))
    return f"{value // 360000}:{value // 6000 % 60:02d}:{value // 100 % 60:02d}.{value % 100:02d}"


def write_ass(events, output):
    lines = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1280", "PlayResY: 720", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
             "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
             "Style: Lyrics,Microsoft YaHei,31,&H00F3F1E8,&H00F3F1E8,&H00201D18,&H80000000,0,0,0,0,100,100,1,0,1,2,1,2,55,55,36,1",
             "Style: Title,Microsoft YaHei,55,&H00B4D4EC,&H00B4D4EC,&H00201D18,&H80000000,0,0,0,0,100,100,8,0,1,1.6,1,1,70,70,85,1",
             "Style: Credit,Microsoft YaHei,20,&H00CEDBE5,&H00CEDBE5,&H00201D18,&H80000000,0,0,0,0,100,100,3,0,1,1.2,1,1,75,75,55,1", "",
             "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
             r"Dialogue: 1,0:00:00.60,0:00:03.10,Title,,0,0,0,,{\fad(400,350)}压轴人间",
             r"Dialogue: 1,0:00:00.90,0:00:03.10,Credit,,0,0,0,,{\fad(400,350)}李白 × 杜甫 · 月下舞台"]
    for event in events:
        text = event["text"].replace("{", "").replace("}", "").replace("\n", " ")
        lines.append(f"Dialogue: 2,{ass_time(event['start'])},{ass_time(event['end'])},Lyrics,,0,0,0,,{{\\fad(80,120)}}{text}")
    output.write_text("\n".join(lines) + "\n", encoding="utf-8-sig")


def write_srt(events, output):
    def stamp(value):
        millis = round(value * 1000)
        return f"{millis // 3600000:02d}:{millis // 60000 % 60:02d}:{millis // 1000 % 60:02d},{millis % 1000:03d}"
    blocks = [f"{i + 1}\n{stamp(item['start'])} --> {stamp(item['end'])}\n{item['text']}\n" for i, item in enumerate(events)]
    output.write_text("\n".join(blocks), encoding="utf-8-sig")


def merged_source_records(manifest):
    records = manifest.get("sources", [])
    if isinstance(records, dict):
        records = [{"id": k, **v} for k, v in records.items()]
    sources = {v["id"]: dict(v) for v in records}
    for key, source in sources.items():
        review_file = WORK / "reviews" / key / "root-review.json"
        if review_file.is_file():
            review = read_json(review_file)
            if review.get("source_id") == key and review.get("source_sha256") == source.get("sha256"):
                source["review"] = {**source.get("review", {}), **review}
                source["review_evidence"] = {"path": rel(review_file), "sha256": sha(review_file)}
    return sources


def checked_sources(manifest, shots):
    sources = merged_source_records(manifest)
    ledger = read_json(ROOT / "work/chatart-tasks.json")
    for source_id in {s["source_id"] for s in shots}:
        if source_id not in sources:
            raise ValueError(f"Missing real source {source_id}")
        source = sources[source_id]
        p = local(source["path"])
        if p.suffix.lower() != ".mp4" or not p.is_file():
            raise ValueError(f"Source is not a real local mp4: {p}")
        expected = source.get("sha256")
        if not expected or sha(p) != expected:
            raise ValueError(f"Missing or mismatched SHA256 for {source_id}")
        if not source.get("task_id"):
            raise ValueError(f"Missing remote generation task id for {source_id}")
        matching = [task for task in ledger.get("tasks", []) if str(task.get("provider_task_id")) == str(source["task_id"])]
        if len(matching) != 1:
            raise ValueError(f"Remote task cannot be uniquely traced in actual ledger: {source_id}")
        actual_task = matching[0]
        if actual_task.get("submitted") is not True or actual_task.get("output_sha256") != expected:
            raise ValueError(f"Ledger does not confirm this downloaded real video: {source_id}")
        if local(actual_task.get("clip", "")) != p:
            raise ValueError(f"Ledger video path mismatch: {source_id}")
        if actual_task.get("size_bytes") and actual_task["size_bytes"] != p.stat().st_size:
            raise ValueError(f"Ledger byte count mismatch: {source_id}")
        review = source.get("review", {})
        if not all(review.get(k) is True for k in ("accepted_for_final", "identity_preserved", "motion_reviewed")):
            raise ValueError(f"Real visual identity/motion review pending: {source_id}")
        info = video_info(p)
        if info["width"] < 1200 or info["height"] < 700 or info["fps"] < 20 or info["frames"] < 100:
            raise ValueError(f"Insufficient real frames/resolution: {source_id}")
        if abs(info["frames"] / info["fps"] - info["duration"]) > .1:
            raise ValueError(f"Incomplete source stream: {source_id}")
        required = max(s["source_out"] for s in shots if s["source_id"] == source_id)
        if required > info["duration"] + 1e-5:
            raise ValueError(f"Source range exceeds real video: {source_id} requires {required}, has {info['duration']}")
        source.update(info)
        source["source_kind"] = "remote-ordinary-generated-video"
        source["source_experiment"] = "004-performance-film"
        source["ledger_local_id"] = actual_task["id"]
        source["ledger_status_at_render"] = actual_task["status"]
        source["native_audio_used_in_final"] = False
    return sources


def audio_reference(song):
    import numpy as np
    raw = run(["ffmpeg", "-v", "error", "-i", song, "-map", "0:a:0", "-af", "volume=-1.5dB", "-ar", "48000", "-ac", "2", "-f", "f32le", "pipe:1"], binary=True)
    reference = np.frombuffer(raw, dtype="<f4").reshape(-1, 2).copy()
    if len(reference) != SONG_FRAMES:
        raise ValueError(f"Unexpected source decode length {len(reference)}")
    padded = np.zeros((TARGET_AUDIO_FRAMES, 2), dtype=np.float32)
    padded[:len(reference)] = reference
    return padded, {"source_sample_frames_48k": len(reference), "output_sample_frames_48k": TARGET_AUDIO_FRAMES,
                    "tail_silence_samples": TARGET_AUDIO_FRAMES - len(reference),
                    "tail_silence_seconds": (TARGET_AUDIO_FRAMES - len(reference)) / SAMPLE_RATE,
                    "gain_db": -1.5, "gain_applications": 1, "trim_start": 0, "trim_end": 0,
                    "speed": 1, "full_song_preserved": True,
                    "adjusted_source_sample_peak_dbfs": float(20 * np.log10(np.abs(reference).max())),
                    "adjusted_source_samples_abs_ge_1": int((np.abs(reference) >= 1).sum())}


def verify_audio(output, reference):
    import numpy as np
    raw = run(["ffmpeg", "-v", "error", "-i", output, "-map", "0:a:0", "-ar", "48000", "-ac", "2", "-f", "f32le", "pipe:1"], binary=True)
    decoded = np.frombuffer(raw, dtype="<f4").reshape(-1, 2)
    if len(decoded) < SONG_FRAMES:
        raise ValueError("Output has lost source song samples")
    compared = min(len(reference), len(decoded))
    x, y = reference[:compared], decoded[:compared]
    corr = float(np.corrcoef(x.ravel(), y.ravel())[0, 1])
    gain = float(np.sum(x.astype(np.float64) * y) / np.sum(x.astype(np.float64) ** 2))
    snr = float(10 * np.log10(np.sum(x.astype(np.float64) ** 2) / np.sum((y - x).astype(np.float64) ** 2)))
    windows = []
    for start in range(0, 90, 10):
        stop = min(start + 10, SONG_FRAMES / SAMPLE_RATE)
        a, b = int(start * SAMPLE_RATE), int(stop * SAMPLE_RATE)
        windows.append({"start": start, "end": stop, "correlation": float(np.corrcoef(x[a:b].ravel(), y[a:b].ravel())[0, 1])})
    if corr < .99 or abs(20 * math.log10(abs(gain))) > .15:
        raise ValueError(f"Full-song audio comparison failed: correlation={corr}, gain={gain}")
    return {"status": "passed-full-song-audio-content-check", "decoded_aac_frames": len(decoded),
            "compared_frames": compared, "zero_offset_waveform_correlation": corr,
            "best_fit_gain_relative_to_once_adjusted_source_db": 20 * math.log10(abs(gain)),
            "aac_roundtrip_snr_db": snr, "window_correlations": windows,
            "aac_decoded_sample_peak_dbfs": float(20 * np.log10(np.abs(decoded).max())),
            "aac_decoded_samples_abs_ge_1": int((np.abs(decoded) >= 1).sum()),
            "limitation": "AAC有损编码会改变采样；此核验只证明配乐完整/无额外偏移或重复衰减，不证明嘴型。"}


def prepare(manifest_path):
    WORK.mkdir(parents=True, exist_ok=True)
    shots = make_timeline()
    events, omitted = caption_events()
    timeline = {"schema_version": 1, "experiment_id": "004-performance-film", "mode": "visual-stage-montage",
                "lip_sync_requirement": "natural-not-precise", "precise_lip_sync_claim": False,
                "duration": TOTAL_FRAMES / FPS, "fps": FPS, "frames": TOTAL_FRAMES,
                "size": {"width": 1280, "height": 720}, "shots": shots,
                "caption_policy": {"text_source": "user-confirmed-full-song-lyrics", "timings": "existing-short-window-candidates-editorial-placement",
                                   "events": events, "omitted_uncertain_lines": omitted,
                                   "uncertain_words_not_fabricated": True, "word_precise_timing_claim": False},
                "edit_policy": {"only_real_generated_video": True, "source_speed": 1,
                                "repeated_source_time_ranges": False, "still_image_motion": False,
                                "use_mv_feature": False, "local_lipsync_model": False}}
    write_json(WORK / "stage-timeline.json", timeline)
    write_ass(events, WORK / "stage-captions.ass")
    write_srt(events, WORK / "stage-captions.srt")
    manifest = read_json(manifest_path)
    sources = checked_sources(manifest, shots)
    song = ROOT / "music/source-ya-zhou-ren-jian.mp3"
    if sha(song) != SONG_SHA:
        raise ValueError("Source song SHA mismatch")
    reference, audio = audio_reference(song)
    return timeline, sources, song, reference, audio


def encode_piece(shot, sources):
    """Reuse only a SHA-fixed segment with identical shot and encoding settings."""
    pieces = WORK / "segments"
    pieces.mkdir(parents=True, exist_ok=True)
    source = local(sources[shot["source_id"]]["path"])
    out = pieces / f"{shot['id']}.mp4"
    sidecar = out.with_suffix(".json")
    contract = {"version": 1, "shot": shot, "source_sha256": sources[shot["source_id"]]["sha256"],
                "scale": "1280x720-center-crop", "fps": 25, "encoder": "libx264-fast-crf18-yuv420p"}
    if out.is_file() and sidecar.is_file():
        cached = read_json(sidecar)
        if cached.get("contract") == contract and cached.get("output", {}).get("sha256") == sha(out):
            print(f"Reused SHA-verified {shot['id']} {shot['source_id']}", flush=True)
            return out
    run(["ffmpeg", "-v", "error", "-threads", "2", "-ss", f"{shot['source_in']:.6f}", "-i", source,
         "-map", "0:v:0", "-an", "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=25,format=yuv420p",
         "-frames:v", shot["frames"], "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-threads", "2",
         "-video_track_timescale", "12800", "-y", out])
    actual = video_info(out)
    if actual["frames"] != shot["frames"]:
        raise ValueError(f"Wrong shot frame count {shot['id']}: {actual['frames']}")
    write_json(sidecar, {"contract": contract, "output": actual})
    print(f"Encoded {shot['id']} {shot['source_id']} {shot['frames']} frames", flush=True)
    return out


def preencode(manifest_path):
    manifest = read_json(manifest_path)
    merged = merged_source_records(manifest)
    accepted_ids = {s["id"] for s in merged.values() if all(s.get("review", {}).get(k) is True for k in ("accepted_for_final", "identity_preserved", "motion_reviewed"))}
    shots = [s for s in make_timeline() if s["source_id"] in accepted_ids]
    sources = checked_sources(manifest, shots)
    for shot in shots:
        encode_piece(shot, sources)
    return {"status": "only-accepted-real-source-segments-preencoded", "segments": len(shots), "source_ids": sorted(accepted_ids), "final_film_created": False}


def render(manifest_path):
    timeline, sources, song, reference, audio = prepare(manifest_path)
    segments = []
    for shot in timeline["shots"]:
        # Encoding serially with 2 threads keeps the UI and remote job collection responsive.
        out = encode_piece(shot, sources)
        segments.append(out)
    concat = WORK / "concat.txt"
    concat.write_text("\n".join("file '" + p.as_posix().replace("'", "'\\''") + "'" for p in segments) + "\n", encoding="utf-8")
    silent = WORK / "stage-picture-only.mp4"
    run(["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", concat, "-map", "0:v:0", "-c:v", "copy", "-an", "-y", silent])
    target_dir = WORK / "final"
    target_dir.mkdir(parents=True, exist_ok=True)
    final = target_dir / "压轴人间-完整舞台版.mp4"
    # Filter source is kept relative to the process working directory, avoiding
    # platform-specific ffmpeg drive-colon escaping in subtitles= arguments.
    subtitle_relative = (WORK / "stage-captions.ass").relative_to(ROOT).as_posix()
    subtitle_filter = f"subtitles=filename='{subtitle_relative}',fade=t=in:st=0:d=0.35,fade=t=out:st=94.04:d=0.6"
    print("Encoding the complete 94.64-second stage film with the intact original song...", flush=True)
    args = ["ffmpeg", "-v", "error", "-threads", "2", "-i", silent, "-i", song,
            "-filter_complex", f"[0:v]{subtitle_filter}[v];[1:a]volume=-1.5dB,aresample=48000,apad=whole_len={TARGET_AUDIO_FRAMES},atrim=end_sample={TARGET_AUDIO_FRAMES}[a]",
            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-threads", "2",
            "-pix_fmt", "yuv420p", "-r", "25", "-frames:v", str(TOTAL_FRAMES),
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart",
            "-metadata", "title=压轴人间 · 完整舞台版", "-metadata", "comment=Ordinary remote video generation, edited to the complete user-supplied song. Precise lip sync is not claimed.", "-y", final]
    p = subprocess.run(args, cwd=ROOT, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode("utf-8", "replace")[-5000:])
    info = video_info(final)
    assert info["frames"] == TOTAL_FRAMES and abs(info["duration"] - 94.64) < .001
    assert info["width"] == 1280 and info["height"] == 720 and info["fps"] == FPS
    # Decode all streams through ffmpeg once; malformed packets or codec errors fail.
    run(["ffmpeg", "-v", "error", "-xerror", "-threads", "2", "-i", final, "-f", "null", "-"])
    audio["output_verification"] = verify_audio(final, reference)
    poster = target_dir / "压轴人间-舞台版封面.jpg"
    run(["ffmpeg", "-v", "error", "-ss", "71.6", "-i", final, "-frames:v", "1", "-q:v", "2", "-y", poster])
    for shot in timeline["shots"]:
        shot["source_sha256"] = sources[shot["source_id"]]["sha256"]
        shot["source_task_id"] = sources[shot["source_id"]]["task_id"]
    ledger = ROOT / "work/chatart-tasks.json"
    ledger_bytes = ledger.read_bytes()
    ledger_snapshot = WORK / "budget-ledger-at-render.json"
    ledger_snapshot.write_bytes(ledger_bytes)
    report = {"schema_version": 1, "experiment_id": "004-performance-film", "status": "rendered-awaiting-final-full-speed-visual-review",
              "title": "压轴人间 · 完整舞台版", "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
              "mode": "visual-stage-montage", "lip_sync_requirement": "natural-not-precise", "precise_lip_sync_claim": False,
              "ordinary_video_only": True, "mv_feature_used": False, "local_lipsync_model_used": False,
              "edit_summary": {"real_remote_sources": len(sources), "new_remote_sources": len(sources) - 2,
                               "reused_pilot_sources": ["OPEN", "SINGING"], "shots": len(timeline["shots"]),
                               "source_speed": 1, "repeated_source_time_ranges": False, "still_image_motion": False,
                               "audience_picture_seconds": round(sum(s["slot_end"] - s["slot_start"] for s in timeline["shots"] if s["source_id"].startswith("CROWD")), 4)},
              "output": info, "poster": {"path": rel(poster), "sha256": sha(poster), "bytes": poster.stat().st_size},
              "source_manifest": {"path": rel(manifest_path), "sha256": sha(manifest_path)},
              "timeline": {"path": rel(WORK / "stage-timeline.json"), "sha256": sha(WORK / "stage-timeline.json")},
              "audio": {"path": rel(song), "sha256": SONG_SHA, "kind": "user-supplied-song", "provider": "用户提供，具体生成平台与模型未独立核验", **audio},
              "sources": list(sources.values()), "shots": timeline["shots"], "caption_policy": timeline["caption_policy"],
              "budget_ledger": {"path": rel(ledger), "sha256_at_render": hashlib.sha256(ledger_bytes).hexdigest(),
                                "snapshot_path": rel(ledger_snapshot), "snapshot_sha256": sha(ledger_snapshot), "accounting_owner": "root"},
              "verification": {"all_video_audio_frames_decoded_without_errors": True, "frame_count": TOTAL_FRAMES,
                               "full_speed_visual_review": None, "identity_review_source_scope": "each real raw source", "cut_review": None},
              "limitations": ["这是按原曲剪辑的舞台效果版，不声称逐字逐拍精准口型。", "字幕正文来自用户确认歌词，时间为已有短窗候选；三条未定位/改词疑点没有强行写入。", "源片自生声音全部静音，最终只使用完整用户原曲。"]}
    write_json(WORK / "stage-film-report.json", report)
    report["review_evidence"] = final_contacts(final, timeline["shots"])
    write_json(WORK / "stage-film-report.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="work/stage-film-20261016/source-files.json")
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--review-id")
    parser.add_argument("--review-path")
    parser.add_argument("--final-contacts", action="store_true")
    parser.add_argument("--preencode", action="store_true")
    args = parser.parse_args()
    if args.review_id:
        if not args.review_path:
            parser.error("--review-path required")
        print(json.dumps(make_review(args.review_id, args.review_path), ensure_ascii=False, indent=2))
    elif args.preencode:
        print(json.dumps(preencode(local(args.manifest)), ensure_ascii=False, indent=2))
    elif args.final_contacts:
        report = read_json(WORK / "stage-film-report.json")
        report["review_evidence"] = final_contacts(local(report["output"]["path"]), report["shots"])
        write_json(WORK / "stage-film-report.json", report)
        print(json.dumps(report["review_evidence"], ensure_ascii=False, indent=2))
    elif args.render:
        result = render(local(args.manifest))
        print(json.dumps({"status": result["status"], "output": result["output"]}, ensure_ascii=False, indent=2))
    elif args.prepare:
        timeline, sources, _, _, audio = prepare(local(args.manifest))
        print(json.dumps({"status": "inputs-verified", "shots": len(timeline["shots"]), "sources": len(sources), "audio": audio}, ensure_ascii=False, indent=2))
    else:
        WORK.mkdir(parents=True, exist_ok=True)
        shots = make_timeline()
        write_json(WORK / "proposed-stage-edit.json", {"status": "proposed-waiting-real-remote-sources", "mode": "visual-stage-montage", "duration": 94.64, "fps": FPS, "shots": shots})
        print(f"Prepared {len(shots)} nonrepeating real-video edit slots; rendering requires reviewed real sources.")


if __name__ == "__main__":
    main()
