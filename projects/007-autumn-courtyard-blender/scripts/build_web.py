"""Build the static research page, packaging media and reproducible downloads.

Pillow is used only to compress web preview images; no imagery is regenerated.
Run from any directory with Python 3.10+ and Pillow.
"""
import json
import hashlib
import shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"web"
SCENE=ROOT/"original-scene"
DIST=SOURCE/"dist"
for folder in (DIST,DIST/"assets",DIST/"downloads"):
    folder.mkdir(parents=True,exist_ok=True)
for name in ("index.html","styles.css","app.js","favicon.svg","viewer.js","viewer.css","research.html","research.css","research.js","overview.html","overview.css"):
    shutil.copy2(SOURCE/name,DIST/name)
for name in ("atlas-overview.png","atlas-overview.svg","atlas-overview-provenance.json"):
    shutil.copy2(SOURCE/"assets"/name,DIST/"assets"/name)
with Image.open(SOURCE/"assets/atlas-overview.png") as image:
    image.thumbnail((2000,4501),Image.Resampling.LANCZOS)
    image.convert("RGB").save(DIST/"assets/atlas-overview-preview.webp","WEBP",quality=90,method=6)
shutil.copytree(SOURCE/"vendor",DIST/"vendor",dirs_exist_ok=True)
for name in ("concept","render","overview"):
    with Image.open(SCENE/"assets"/(name+".png")) as image:
        image.convert("RGB").save(DIST/"assets"/(name+".webp"),"WEBP",quality=88,method=6)
for name,source in (("iteration-01","01-preview"),("iteration-02","02-composition")):
    with Image.open(SCENE/"assets/iterations"/(source+".png")) as image:
        image.convert("RGB").save(DIST/"assets"/(name+".webp"),"WEBP",quality=88,method=6)
shutil.copy2(SCENE/"assets/demo.mp4",DIST/"assets/demo.mp4")
web_export=json.loads((SCENE/"assets/web-export.json").read_text(encoding="utf-8"))
web_model=SCENE/"artifacts/moonwater-web.glb"
assert hashlib.sha256(web_model.read_bytes()).hexdigest()==web_export["output_sha256"]
assert hashlib.sha256((SCENE/"artifacts/moonwater.blend").read_bytes()).hexdigest()==web_export["source_sha256"]
shutil.copy2(web_model,DIST/"assets/moonwater-web.glb")
shutil.copy2(SCENE/"assets/web-export.json",DIST/"assets/web-export.json")
files={
    "moonwater.blend":"artifacts/moonwater.blend",
    "build_moonwater.py":"scripts/build_moonwater.py",
    "geometry.py":"scripts/geometry.py",
    "image-prompt.txt":"image-prompt.txt",
    "RESEARCH.md":"RESEARCH.md",
    "README.md":"README.md",
    "render-stats.json":"assets/render-stats.json",
    "scene-checks.json":"assets/scene-checks.json",
    "concept.png":"assets/concept.png",
    "render.png":"assets/render.png",
    "provenance.json":"provenance.json",
    "media-info.json":"assets/media-info.json",
    "review_and_animate.py":"scripts/review_and_animate.py",
    "export_web.py":"scripts/export_web.py",
}
for name,relative in files.items():
    shutil.copy2(SCENE/relative,DIST/"downloads"/name)
shutil.copy2(ROOT/"RESEARCH.md",DIST/"downloads/HISTORICAL_RESEARCH.md")
shutil.copy2(ROOT/"web/README.md",DIST/"downloads/WEB_README.md")
shutil.copy2(ROOT/"scripts/check_web.py",DIST/"downloads/check_web.py")
evidence={name:json.loads((SCENE/"assets"/filename).read_text(encoding="utf-8")) for name,filename in
          (("render","render-stats.json"),("checks","scene-checks.json"),("media","media-info.json"))}
evidence["web"]=web_export
assert evidence["checks"]["checks_passed"]
assert evidence["media"]["duration_verified"] and evidence["media"]["duration_seconds"]==5
(DIST/"evidence.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Built:",DIST)
print("Files:",sum(p.is_file() for p in DIST.rglob("*")))
