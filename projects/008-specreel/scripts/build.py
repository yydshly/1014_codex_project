"""Render real traces through the pinned Specreel engine with a Chinese adapter.

The upstream snapshot remains unchanged. This adapter translates deterministic
captions/player controls and selects a CJK font for video export. It does not
generate AI narration or invent actions that are absent from the trace.
"""
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SHA = "0d3aa13241b3714f32f93fdc705100150e6c42af"
SOURCE = ROOT / "upstream" / f"specreel-{SHA}" / "specreel.py"
spec = importlib.util.spec_from_file_location("specreel_pinned", SOURCE)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
original_humanize = engine.humanize
original_font = engine._load_font

NAMES = {
    "#reddit-report-meta": "已保存帖子概览",
    ".reddit-card": "已保存的 Reddit 帖子",
    ".reddit-quote": "问题原话",
    ".reddit-next-step": "下一步核实动作",
    ".reddit-raw": "采集片段与来源条件",
    ".query-list": "生成的搜索词",
    "#source-dialog": "来源详情",
    "#dialog-title": "原始问题",
    "#dialog-channel": "来源编号",
    "#evidence-grid": "筛选结果",
}


def target(params):
    selector = params.get("selector", "")
    for expression in (r'name="([^"]*)"', r'internal:label="([^"]*)"', r'internal:text="([^"]*)"'):
        match = re.search(expression, selector)
        if match:
            return match.group(1).strip().replace("↗", "").replace("↓", "").strip()
    for selector_part, name in NAMES.items():
        if selector_part in selector:
            return name
    return "页面内容"


def humanize_zh(step):
    literal, kind = original_humanize(step)
    method, params = step["method"], step["params"]
    name = target(params)
    if method == "goto":
        return "打开 004 需求发现与采集页面", kind
    if method == "click":
        return f"点击「{name}」", kind
    if method == "fill":
        value = engine.display_value(params.get("value"), params.get("selector"), name)
        if len(value) > 35:
            value = value[:35] + "…"
        if "观察什么任务" in name:
            name = "观察任务"
        return f"填写「{name}」：{value}", kind
    if method == "screenshot":
        return "保存本轮页面结果", kind
    if method == "expect":
        expression = params.get("expression", "")
        expected = engine._expected_str(params)
        if expression.endswith("count"):
            return f"确认{name}有 {params.get('expectedNumber', '?')} 条", kind
        if expression.endswith("visible"):
            return f"确认「{name}」已显示", kind
        if expression.endswith("value"):
            return f"确认「{name}」的内容正确", kind
        if expression.endswith("attribute"):
            return f"确认「{name}」的展开状态", kind
        if expected:
            return f"确认{name}包含「{expected[:35]}」", kind
        return f"确认「{name}」符合本轮检查", kind
    return literal, kind


def cjk_font(bold, size):
    from PIL import ImageFont
    override = os.environ.get("SPECREEL_CJK_FONT")
    candidates = [override] if override else []
    candidates += [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
                   "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except (OSError, TypeError):
            continue
    return original_font(bold, size)


def translate_player(template):
    replacements = {
        'lang="en"': 'lang="zh-CN"',
        "__NACT__ actions · __NCHK__ checks · regenerated from trace": "__NACT__ 次操作 · __NCHK__ 项检查 · 来自实录",
        "__NACT__ actions · __NCHK__ checks": "__NACT__ 次操作 · __NCHK__ 项检查",
        "Demo · generated from a real test": "004 实际操作 · 分步骤回放",
        "▶ Play demo": "▶ 播放演示", "browse steps instead": "逐步查看",
        "‹ Prev": "‹ 上一步", "Next ›": "下一步 ›", ">Steps<": ">操作步骤<",
        "▶ Play": "▶ 播放", "❚❚ Pause": "❚❚ 暂停", "↺ Replay": "↺ 重播",
        "Flow verified": "本轮录制检查通过", "Generated from a passing test": "录制中的检查已通过",
        "This flow is currently failing": "本轮流程有未通过的检查", "A step failed on the last run": "本轮有步骤未通过",
        "Read steps aloud": "朗读步骤（由浏览器提供声音）",
        "🔊 Off": "🔊 朗读关闭", "Voice (your browser's built-in voices)": "浏览器声音",
        "CHECK": "检查", "NAVIGATE": "打开", "ACTION": "操作",
    }
    for before, after in replacements.items():
        template = template.replace(before, after)
    return re.sub(r'<link[^>]+href="https://fonts[^>]+>', '', template)


engine.humanize = humanize_zh
engine._load_font = cjk_font
engine.HTML_TEMPLATE = translate_player(engine.HTML_TEMPLATE)
engine.HTML_TEMPLATE = engine.HTML_TEMPLATE.replace("${s.failed?'failed':s.kind}", "${s.failed?'失败':({action:'操作',check:'检查',nav:'打开'}[s.kind]||s.kind)}")
engine.TTS_JS = engine.TTS_JS.replace("🔊 Off", "🔊 朗读关闭").replace("🔊 On", "🔊 朗读开启")
started = time.perf_counter()
trace_root = sys.argv[1] if len(sys.argv) > 1 else "captures/baseline"
output = sys.argv[2] if len(sys.argv) > 2 else "web/zh"
sys.argv = [str(SOURCE), trace_root, "-o", output, "--config", str(ROOT / "specreel.yml"), "--bundle", "--strict", "--mp4"]
try:
    engine.main()
except SystemExit as error:
    if error.code not in (None, 0):
        raise
provenance = {
    "upstream": "https://github.com/specreel/specreel",
    "commit": SHA, "upstream_version": "0.2.0", "license": "AGPL-3.0-or-later",
    "source_modified": False, "adapter": "scripts/build.py",
    "changes": ["Deterministic Chinese captions", "Chinese single-player controls", "CJK font for video export"],
    "ai_narration": False, "studio_voiceover": False,
    "elapsed_seconds": round(time.perf_counter() - started, 2),
}
Path(output, "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(provenance, ensure_ascii=False))
