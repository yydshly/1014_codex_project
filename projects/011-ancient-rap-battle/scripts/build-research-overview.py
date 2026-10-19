"""Build a factual, editable overview poster from existing reports and real frames.

No model, network or paid-generation calls. Run from any directory with Pillow.
"""
from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
EP = ROOT / "experiments/004-performance-film"
REPAIR = EP / "work/audio-driven-repair"
WORK = EP / "work/research-overview-20261019"
ASSETS = ROOT / "assets"
REPORT = REPAIR / "full-reedit/reedit-film-report.json"
PUBLIC = ROOT / "web/public/data/004-repaired-film.json"
NAME = "ancient-rap-battle-research-overview"
W, H = 3600, 6120
M, GAP = 120, 54
CW = W - M * 2
PAPER, WHITE = "#f5f3ec", "#fffefa"
INK, MUTED, LINE = "#24322e", "#596b64", "#d7ded4"
GREEN, TEAL, GOLD, RED = "#315c4d", "#54847d", "#b18847", "#ad5947"
SOFT, AMBER = "#e9eee5", "#f3ead9"
FONTS = {False: "C:/Windows/Fonts/msyh.ttc", True: "C:/Windows/Fonts/msyhbd.ttc"}
font_cache = {}
canvas = Image.new("RGB", (W, H), PAPER)
draw = ImageDraw.Draw(canvas)
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       '<title>古人说唱：源库效果、我们的探索与最终舞台版</title>',
       '<desc>基于固定上游版本与本地真实制作报告的信息总览。所有效果画面均为既有原图或真实成片截帧。</desc>']
text_records, source_images = [], []


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size, bold=False):
    key = (size, bold)
    if key not in font_cache:
        font_cache[key] = ImageFont.truetype(FONTS[bold], size)
    return font_cache[key]


def rect(x, y, w, h, fill, radius=0, outline=None):
    draw.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=fill, outline=outline, width=2)
    attrs = f'fill="{fill}"' + (f' stroke="{outline}" stroke-width="2"' if outline else "")
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" {attrs}/>')


def line(x1, y1, x2, y2, fill=LINE, width=2):
    draw.line((x1, y1, x2, y2), fill=fill, width=width)
    svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{fill}" stroke-width="{width}"/>')


def text(x, y, value, size=36, fill=INK, bold=False):
    f = font(size, bold)
    width = draw.textlength(value, font=f)
    assert 0 <= x and x + width <= W - 30, (value, x, width)
    assert 0 <= y and y + size * 1.4 <= H, (value, y)
    draw.text((x, y), value, font=f, fill=fill, anchor="lt")
    # Matching top anchoring in the native editable SVG.
    svg.append(f'<text x="{x}" y="{y}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{fill}" dominant-baseline="text-before-edge">{escape(value)}</text>')
    text_records.append({"text": value, "x": x, "y": y, "width": round(width, 2), "size": size})


def wrap(value, size, width, bold=False):
    rows = []
    for paragraph in value.split("\n"):
        current = []
        for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9_./+\-]*|[^\s]|\s+", paragraph):
            if not current and token.isspace():
                continue
            if current and draw.textlength("".join(current) + token, font=font(size, bold)) > width:
                # Keep Latin names intact and avoid a closing mark alone at line start.
                if token in "，。；：？！、）】》」』％%" and len(current) > 1:
                    previous = current.pop()
                    rows.append("".join(current).rstrip())
                    current = [previous, token]
                else:
                    rows.append("".join(current).rstrip())
                    current = [] if token.isspace() else [token]
            else:
                current.append(token)
        rows.append("".join(current).rstrip())
    return rows


def para(x, y, value, width, size=36, fill=MUTED, bold=False, leading=None, bottom=None):
    leading = leading or int(size * 1.48)
    rows = wrap(value, size, width, bold)
    end = y + len(rows) * leading
    assert bottom is None or end <= bottom, (value, end, bottom)
    for row in rows:
        text(x, y, row, size, fill, bold)
        y += leading
    return end


def section(y, number, title, note=""):
    rect(M, y + 5, 63, 54, GREEN, 10)
    text(M + 10, y + 10, number, 31, WHITE, True)
    text(M + 88, y, title, 54, INK, True)
    if note:
        text(M + 88, y + 74, note, 31, MUTED)


def photo(path, x, y, w, h, role, time=None):
    original = Image.open(path).convert("RGB")
    assert abs(original.width / original.height - w / h) < .02
    canvas.paste(original.resize((int(w), int(h)), Image.Resampling.LANCZOS), (int(x), int(y)))
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    svg.append(f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" xlink:href="data:{mime};base64,{data}"/>')
    source_images.append({"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path), "role": role,
                          "source_time_seconds": time, "placement": [x, y, w, h],
                          "treatment": "proportional resize only; no generated replacement or face editing"})


def extract(movie, seconds, name):
    target = WORK / "frames" / f"{name}.jpg"
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(seconds), "-i", str(movie),
                    "-frames:v", "1", "-q:v", "2", "-y", str(target)], check=True)
    return target


def build():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    movie = EP / report["output"]["path"]
    assert sha(movie) == report["output"]["sha256"] == "97a08f79cdeba756fb35280652445343be25219b2cc1ded532e3c62e3ccad4a6"
    assert report["output"]["duration"] == 94.64 and report["edit_summary"]["shots"] == 22
    assert public["quality"]["full_film_user_accepted"] is False
    budget = public["budget"]
    assert budget["exposure"] == 2375 and budget["production_reported_credits"] == 615
    rect(0, 0, W, H, PAPER)
    rect(M, 78, 11, 45, RED, 3)
    text(M + 32, 82, "研物 / 011     项目研究与制作复盘", 31, GREEN, True)
    text(W - 1075, 82, "制作 2026.10.15–16  ·  汇总 2026.10.19", 29, MUTED)
    text(M, 167, "古人说唱：从源库到我们的舞台版", 100, INK, True)
    para(M, 306, "以音乐为时间基准，用人物参考稳定形象，把短镜头生成、审片与整曲合成组织成可追溯的制作流程。", CW, 39, bottom=390)

    # 1. Real visual evidence, carefully separated by authorship.
    card_w = (CW - GAP) // 2
    cards_y, card_h = 432, 1190
    upstream = ROOT / "web/public/media/frame-2.jpg"
    ours = extract(movie, 90.62, "final-duet-90.62")
    for x, title, chip, image_path, role, timestamp in [
        (M, "源库效果｜周瑜 × 诸葛亮", "上游作者：硅基废话 · 非本项目生成", upstream, "upstream original example image; attribution preserved", None),
        (M + card_w + GAP, "本次成果｜李白 × 杜甫 · 压轴人间", "我们的真实成片截帧 · 整片待用户验收", ours, "our actual repaired film duet frame", 90.62),
    ]:
        rect(x, cards_y, card_w, card_h, WHITE, 24, LINE)
        text(x + 28, cards_y + 29, title, 43, INK, True)
        text(x + 28, cards_y + 94, chip, 29, GREEN)
        pw = card_w - 56
        photo(image_path, x + 28, cards_y + 150, pw, round(pw * 9 / 16), role, timestamp)
    x = M + 28
    para(x, 1500, "分享文件实测 102.13秒 / 960×540 / 24fps\n34句；默认35素材 / 180秒；视频费约$16（作者历史记录）", card_w - 56, 31, bottom=1610)
    x = M + card_w + GAP + 28
    para(x, 1500, "新修复版 94.64秒 / 1280×720 / 25fps / 22镜\n保留完整用户原曲；普通远端视频生成与本地剪辑。", card_w - 56, 31, bottom=1610)

    section(1690, "01", "源库提供的能力：一套创作编排与素材流水线", "Claude Code Skill＋模板＋Python脚本；音乐、图像、视频由相应外部服务生成。")
    steps = [
        ("内容与歌曲", "Claude写词、用户确认；用户在Suno生成并选歌。"),
        ("歌曲时间轴", "脚本分离人声、定位歌词与节拍，形成逐句起止。"),
        ("参考与分镜", "Midjourney定妆；角色、动作、景别、提示词与剪辑表。"),
        ("H3逐句生成", "参考图＋单句人声＋镜头提示，提交远端生成任务。"),
        ("筛查与选片", "比较音轨、记录候选与偏移；用户听看嘴部与人物。"),
        ("合成与包装", "FFmpeg拼接；字幕、名字卡、封面与发布文案。"),
    ]
    sw = 520
    for i, (title, body) in enumerate(steps):
        x = M + i * 568
        rect(x, 1840, sw, 250, SOFT, 18)
        text(x + 22, 1863, f"{i + 1:02d}  {title}", 35, GREEN, True)
        para(x + 22, 1925, body, sw - 44, 32, bottom=2080)
        if i < 5:
            text(x + sw + 13, 1931, "→", 33, GOLD)
    rect(M, 2121, CW, 82, WHITE, 14)
    text(M + 26, 2142, "交接文件：内容设定 episode.json  →  逐句时间与素材 clips  →  选片 / 偏移 picks、shifts  →  剪辑表 edl", 33, MUTED)

    section(2270, "02", "我们的探索：先证明闭环，再纠正真正影响效果的输入", "全过程保留阶段结果与失败结论；没有把旧视觉样片改名当作修复版。")
    history = [
        ("01  四句基线｜24秒", "MiniMax TTS＋代码节拍＋真实视频。", "先跑通上传、生成、回片、质检、合成；不把TTS加节拍称为音乐模型歌曲。", "验证的是最小制作闭环", False),
        ("02  敬风霜｜63.28秒", "用户完整音乐＋新GPT人物参考。", "两段人物原片组成五次演唱，取用24.6秒；其余38.68秒为明确标注的图像运镜。", "完整歌曲已成立，场景仍需丰富", False),
        ("03  舞台扩展｜63.28秒", "新增4张场景图、17段舞台运镜。", "沿用原人物视频，新增视频生成0次。加强全景、观众、鼓阵与灯光，仍有图像运镜。", "把舞台氛围与人物表演分开设计", False),
        ("04  旧压轴人间｜94.64秒", "新增9条只带图片与提示的视频。", "后期配回原曲，嘴部未随原歌演唱；用户拒收。舞台与观众可复用，演唱需要另做。", "找到症结：音频必须进入生成输入", True),
        ("05  5秒试片｜用户确认", "H3全能模式明确“两图＋音频1”。", "提交原歌9.4–14.4秒与锁定人物/舞台图。用户反馈“口型已可用”，仅确认这条试片。", "先确认同一段原曲的基础可用性", False),
        ("06  原曲修复｜94.64秒", "试片后新增5条演唱＋1条舞台。", "六条原片全部回传并逐帧检查；演唱按对应原歌位置剪入，最终22镜并接入网页。", "重做演唱，保留可复用动态素材", False),
    ]
    hw = 1084
    for i, (title, sub, body, lesson, rejected) in enumerate(history):
        x = M + (i % 3) * (hw + GAP)
        y = 2420 + (i // 3) * 346
        rect(x, y, hw, 318, "#faeee7" if rejected else WHITE, 20, LINE)
        text(x + 25, y + 23, title, 37, RED if rejected else GREEN, True)
        text(x + 25, y + 83, sub, 32, INK)
        para(x + 25, y + 135, body, hw - 50, 32, bottom=y + 247)
        text(x + 25, y + 267, lesson, 30, RED if rejected else GREEN, True)
    rect(M, 3130, CW, 154, SOFT, 18)
    text(M + 28, 3153, "接入与调度的纠偏", 34, GREEN, True)
    para(M + 28, 3208, "早期API权限不足、网页登录与余额连接不稳 → 分开确认视频权限与授权。网页提交明确音频输入，官方Skill按同一任务ID续查；超时不直接重投。本次修复不下载或运行本地口型模型。", CW - 56, 33, bottom=3280)

    section(3350, "03", "最终呈现：完整歌曲＋演唱＋舞台＋观众", "下列四张均为同一新修复成片的真实画面；静帧展示视觉效果，口型和连续动作须播放视频判断。")
    metrics = [("94.64", "秒 / 完整歌曲"), ("1280×720", "最终输出尺寸"), ("25", "fps / 2366帧"), ("22", "个剪辑镜头"), ("40.96", "秒 / 对应演唱"), ("20.08", "秒 / 观众画面")]
    for i, (number, label) in enumerate(metrics):
        x = M + i * 568
        text(x, 3501, number, 60 if i == 1 else 70, GREEN, True)
        text(x, 3590, label, 30, MUTED)
    parts = [(40.96, GREEN, "演唱"), (20.08, TEAL, "观众"), (17.44, GOLD, "开场 / 收尾"), (12.72, "#8f9980", "衣纹 / 裁切"), (3.44, "#b8c6b2", "舞台")]
    assert abs(sum(p[0] for p in parts) - 94.64) < .000001
    x = M
    for seconds, color, _ in parts:
        width = CW * seconds / 94.64
        rect(round(x), 3665, round(width), 30, color)
        x += width
    for i, (seconds, color, label) in enumerate(parts):
        x = M + i * 676
        rect(x, 3730, 20, 20, color, 3)
        text(x + 33, 3718, f"{label} {seconds:.2f}秒", 28, MUTED)
    gw = (CW - 3 * 32) // 4
    frames = [(69.10, "李白演唱", "libai"), (35.32, "杜甫演唱", "dufu"), (61.32, "同场舞台", "stage"), (58.26, "观众反打", "audience")]
    for i, (t, label, slug) in enumerate(frames):
        x = M + i * (gw + 32)
        pic = extract(movie, t, f"final-{slug}-{t:.2f}")
        photo(pic, x, 3798, gw, round(gw * 9 / 16), f"our actual final movie: {label}", t)
        text(x, 4281, f"{label}  ·  {t:.2f}s", 31, GREEN, True)

    section(4390, "04", "我们的价值：把一次出片，变成可复用的方法和证据", "已经形成素材、输入、调度和剪辑的记录链；质量稳定性、量产效率与商业回报仍需更多项目验证。")
    values = [
        ("可复用的角色与镜头资产", "6张GPT人物 / 场景参考、完整音乐与切片、导演提示词、分镜和合成程序，组成下一次制作的起点。舞台与观众保留，问题演唱可以局部替换。"),
        ("可追溯的执行与费用", "每条保留任务ID、原片、输入音频、歌曲时段、文件SHA和预算。把连接异常、任务等待与质量失败分开记录，减少重复付费与无依据重做。"),
        ("可验证的质量边界", "把文件完成、原曲内容保留、画面可用与用户口型验收分别记录。先用小样验证再扩展，留下失败原因，让后续迭代有明确目标。"),
    ]
    for i, (title, body) in enumerate(values):
        x = M + i * (hw + GAP)
        rect(x, 4543, hw, 365, WHITE, 20, LINE)
        text(x + 25, 4571, f"0{i + 1}", 34, GOLD, True)
        text(x + 25, 4629, title, 37, GREEN, True)
        para(x + 25, 4701, body, hw - 50, 34, bottom=4890)

    section(4968, "05", "预算与验收：数字可核对，结论有范围")
    bw = card_w
    for x in [M, M + bw + GAP]:
        rect(x, 5074, bw, 730, WHITE, 20, LINE)
    x = M + 30
    text(x, 5108, "004累计预算 / ChatArt钻石", 36, GREEN, True)
    text(x, 5180, "2375 / 2400", 83, INK, True)
    text(x, 5290, "预算占用（含预留）/ 授权上限", 32, MUTED)
    for i, (n, label) in enumerate([("2265", "累计已提交"), ("110", "未确认预留"), ("25", "剩余额度")]):
        xx = x + i * 515
        text(xx, 5362, n, 59, GREEN, True)
        text(xx, 5443, label, 31, MUTED)
    para(x, 5521, "试片后的6条任务，官方费用回报合计615钻，已包含在累计2265钻中。110钻为图片50＋舞台尝试60的保守预留。独立账单未核验，不把承诺或预留称为已核实实支。", bw - 60, 33, bottom=5730)
    text(x, 5747, "002 / 003历史费用不重复计入004。", 30, MUTED)
    x = M + bw + GAP + 30
    text(x, 5108, "已证实与仍待确认", 36, GREEN, True)
    text(x, 5180, "已完成", 33, GREEN, True)
    para(x, 5234, "六条新源全帧审看；2366帧全解码；原曲完整原速。\n22镜中点与21组切口检查；5秒试片由用户试听确认可用。", bw - 60, 33, bottom=5410)
    text(x, 5421, "仍有边界", 33, RED, True)
    para(x, 5475, "新整片尚未记录用户验收；代理未声称主观听音或逐音素检查通过。字幕有3条未确认内容省略；3处衣纹为旧视频1.78倍裁切。网页模型标签的后台实现未独立核验。", bw - 60, 33, bottom=5730)
    text(x, 5747, "本版已导出并在本地网页展示，未发布公网。", 30, MUTED)

    line(M, 5854, W - M, 5854)
    text(M, 5890, "画面归属：左上为上游作者作品（原字幕与水印保留）；其余为我们的实际修复成片截帧。没有新增模型生成或付费请求。", 28, MUTED)
    text(M, 5944, "上游：github.com/10291124jcjc-dotcom/ancient-rap-battle  ·  固定提交 e5e40fa3612777133a141c8448122dd0fd45e4cc  ·  代码 MIT", 27, MUTED)
    text(M, 5997, "依据：RESEARCH.md、实验001–004报告、004任务账本、pilot-acceptance.json、reedit-film-report.json；来源与截帧时间另存清单。", 27, MUTED)
    svg.append("</svg>")
    ASSETS.mkdir(parents=True, exist_ok=True)
    target = ASSETS / f"{NAME}.png"
    canvas.save(target, optimize=True, dpi=(200, 200))
    vector = ASSETS / f"{NAME}.svg"
    vector.write_text("\n".join(svg), encoding="utf-8")
    preview = ASSETS / f"{NAME}-preview.jpg"
    canvas.resize((1440, round(H * 1440 / W)), Image.Resampling.LANCZOS).save(preview, quality=90)
    manifest = {"date": "2026-10-19", "title": "古人说唱：从源库到我们的舞台版", "size": [W, H],
                "render_method": "Deterministic native SVG/text layout with Pillow PNG; existing real images only.",
                "source_commit": "e5e40fa3612777133a141c8448122dd0fd45e4cc",
                "upstream_url": "https://github.com/10291124jcjc-dotcom/ancient-rap-battle/tree/e5e40fa3612777133a141c8448122dd0fd45e4cc",
                "upstream_image_url": "https://github.com/10291124jcjc-dotcom/ancient-rap-battle/blob/e5e40fa3612777133a141c8448122dd0fd45e4cc/assets/frame-2.jpg",
                "upstream_license": "MIT (code); original example attribution retained; media rights chain not independently audited.",
                "final_movie": {"path": movie.relative_to(ROOT).as_posix(), "sha256": sha(movie)},
                "data_evidence": [{"path": p.relative_to(ROOT).as_posix(), "sha256": sha(p)} for p in [REPORT, PUBLIC, ROOT / "RESEARCH.md"]],
                "images": source_images, "text_layout": text_records,
                "new_generation_calls": 0, "new_credits": 0,
                "full_film_user_accepted": False,
                "outputs": [{"path": p.relative_to(ROOT).as_posix(), "sha256": sha(p), "bytes": p.stat().st_size} for p in [target, vector, preview]]}
    (ASSETS / f"{NAME}-sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"outputs": manifest["outputs"], "text_lines": len(text_records), "real_images": len(source_images), "size": [W, H]}, ensure_ascii=False))


if __name__ == "__main__":
    build()
