"""Generate the original SVG and PNG overview from the same scene and text source.

Development helper: Python + Pillow. Normal webpage builds use the saved assets.
No website, screenshot, third-party image, model call or browser is involved.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1600, 1540


def build(font_path: Path, bold_path: Path) -> None:
    model = json.loads((ROOT / 'data/understanding-map.json').read_text(encoding='utf-8'))
    fingerprint = hashlib.sha256(json.dumps(model, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    image = Image.new('RGB', (WIDTH, HEIGHT), '#f7f7f0')
    draw = ImageDraw.Draw(image)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="overview-title overview-desc" data-source-sha256="{fingerprint}">',
        f'<title id="overview-title">{html.escape(model["title"])}</title>',
        f'<desc id="overview-desc">{html.escape(model["conclusion"] + model["boundary"] + model["figure_note"])}</desc>',
        '<rect width="1600" height="1540" fill="#f7f7f0"/>',
    ]
    fonts = {}
    ink, muted, green, border = '#253d32', '#536c5d', '#245e49', '#ccd8c4'

    def font(size, bold=False):
        key = (size, bold)
        if key not in fonts:
            fonts[key] = ImageFont.truetype(str(bold_path if bold else font_path), size)
        return fonts[key]

    def rect(x, y, w, h, fill, stroke=border, radius=14):
        draw.rounded_rectangle((x, y, x + w, y + h), radius, fill, stroke, 2)
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')

    def text(x, y, value, size=26, color=ink, bold=False, max_width=None):
        item_font = font(size, bold)
        measured = draw.textlength(value, font=item_font)
        if max_width is not None and measured > max_width:
            raise ValueError(f'Text exceeds its slot: {value} ({measured} > {max_width})')
        draw.text((x, y), value, font=item_font, fill=color, anchor='lt')
        ascent = item_font.getmetrics()[0]
        top = item_font.getbbox(value, anchor='ls')[1]
        baseline = y - top
        parts.append(f'<text x="{x}" y="{baseline}" font-family="Microsoft YaHei,Noto Sans SC,sans-serif" font-size="{size}" font-weight="{600 if bold else 400}" fill="{color}">{html.escape(value)}</text>')

    def line(points, color='#8fa382', width=3, arrow=False):
        draw.line(points, fill=color, width=width, joint='curve')
        parts.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"/>')
        if arrow:
            x, y = points[-1]
            px, py = points[-2]
            direction = math.atan2(y-py, x-px)
            tip = [(x, y), (x - 11 * math.cos(direction) + 6 * math.sin(direction), y - 11 * math.sin(direction) - 6 * math.cos(direction)), (x - 11 * math.cos(direction) - 6 * math.sin(direction), y - 11 * math.sin(direction) + 6 * math.cos(direction))]
            draw.polygon(tip, fill=color)
            parts.append(f'<polygon points="{" ".join(f"{x:.2f},{y:.2f}" for x,y in tip)}" fill="{color}"/>')

    text(64, 48, model['title'], 46, bold=True, max_width=1450)
    text(66, 117, model['subtitle'], 25, muted, max_width=1450)
    rect(64, 180, 744, 222, '#fffef9')
    rect(832, 180, 704, 222, '#edf2e3')
    for box, x, width in [(model['source'], 90, 690), (model['trial'], 858, 650)]:
        text(x, 204, box['title'], 30, green, True, width)
        for i, value in enumerate(box['lines']):
            text(x, 260 + i * 37, value, 25, ink, max_width=width)
        for i, value in enumerate(box['notes']):
            text(x, 338 + i * 30, value, 22, muted, max_width=width)

    line([(800, 407), (800, 434)], arrow=True)
    for i, question in enumerate(model['questions']):
        x = 64 + i * 499
        rect(x, 447, 474, 153, '#f0f3e9')
        text(x+25, 470, question['title'], 29, green, True, 424)
        for j, value in enumerate(question['lines']):
            text(x+25, 519+j*33, value, 24, muted, max_width=424)

    line([(800, 605), (800, 626)], arrow=True)
    rect(64, 640, 1472, 144, '#fffef9')
    text(93, 662, model['essence']['title'], 29, green, True, 1410)
    text(93, 707, model['essence']['formula'], 30, ink, True, 1410)
    text(93, 751, model['essence']['note'], 22, muted, max_width=1410)

    line([(800, 789), (800, 812)], arrow=True)
    rect(64, 826, 1472, 169, green, green)
    text(94, 851, model['core']['title'], 36, '#fffef9', True, 1410)
    for i, value in enumerate(model['core']['lines']):
        text(95, 913+i*37, value, 25, '#edf2e3', max_width=1410)

    text(65, 1033, model['pipeline_title'], 29, green, True)
    for i, step in enumerate(model['pipeline']):
        x = 64 + i * 249
        rect(x, 1086, 227, 103, '#fffef9')
        text(x+18, 1103, step['title'], 28, ink, True, 191)
        text(x+18, 1150, step['note'], 19, muted, max_width=191)
        if i < 5:
            line([(x+230, 1137), (x+245, 1137)], arrow=True)
    line([(1422, 1196), (1422, 1234), (427, 1234), (427, 1196)], arrow=True)
    rect(611, 1211, 671, 45, '#f7f7f0', '#f7f7f0', 0)
    text(626, 1219, model['feedback'], 23, green, max_width=635)

    for i, extension in enumerate(model['extensions']):
        x = 64 + i * 499
        rect(x, 1290, 474, 150, '#edf2e3')
        text(x+25, 1311, extension['title'], 28, green, True, 424)
        for j, value in enumerate(extension['lines']):
            text(x+25, 1360+j*33, value, 23, muted, max_width=424)
    text(65, 1476, f'010 · 理解总览 · {model["updated_at"]}  |  研究判断，不是效果证明；详细依据与限制见网页。', 20, muted, max_width=1470)
    parts.append('</svg>')
    assets = ROOT / 'assets'
    assets.mkdir(exist_ok=True)
    (assets / 'understanding-map.svg').write_text('\n'.join(parts)+'\n', encoding='utf-8')
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text('source_sha256', fingerprint)
    metadata.add_text('Description', 'Original project 010 understanding overview; not a product screenshot or validation result.')
    image.save(assets / 'understanding-map.png', pnginfo=metadata, optimize=True)
    print(f'Overview created: {WIDTH}x{HEIGHT}; source SHA256 {fingerprint}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--font', type=Path, default=Path('C:/Windows/Fonts/msyh.ttc'))
    parser.add_argument('--bold-font', type=Path, default=Path('C:/Windows/Fonts/msyhbd.ttc'))
    args = parser.parse_args()
    build(args.font, args.bold_font)
