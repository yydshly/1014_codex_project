"""Verify the public Pages artifact; write evidence only after all checks pass."""
import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--site", default="https://yydshly.github.io/1014_codex_project/")
parser.add_argument("--commit", required=True)
parser.add_argument("--run-url", required=True)
options = parser.parse_args()
site = options.site.rstrip("/") + "/"
base = site + "007-autumn-courtyard-blender/"

def fetch(url, method="GET", headers=None):
    with urlopen(Request(url, method=method, headers=headers or {}), timeout=45) as response:
        result = {"url":url,"status":response.status,"content_type":response.headers.get_content_type()}
        if response.headers.get("Content-Range"):
            result["content_range"] = response.headers["Content-Range"]
        return result, response.read()

print("Checking published resources, model and anchors...", flush=True)
asset_check = subprocess.run([sys.executable, str(ROOT/"scripts/check_web.py"), "--url", base],
                             check=True, capture_output=True, text=True)
checks = json.loads(asset_check.stdout)
catalog = json.loads(fetch(site+"projects.json")[1])
ids = [item["id"] for item in catalog["projects"]]
assert all(item in ids for item in ("006","007","014")), ids
published = next(item for item in catalog["projects"] if item["id"] == "007")
local = json.loads((ROOT.parents[1]/"projects.json").read_text(encoding="utf-8"))
expected = next(item for item in local["projects"] if item["id"] == "007")
assert published["summary"] == expected["summary"]
entrances = json.loads(fetch(site+"entries.json")[1])["projects"]["007"]
assert len(entrances) == 3
pages = []
for path in ("research.html","overview.html","index.html"):
    result, data = fetch(base+path)
    assert result["status"] == 200 and result["content_type"] == "text/html"
    if path == "research.html":
        content = data.decode("utf-8")
        for phrase in ("源库能力","实现原理","价值与意义","可扩展方向","本次实证与边界"):
            assert phrase in content, phrase
    pages.append(result)
integrity = []
print("Verifying PNG, SVG and editable scene downloads...", flush=True)
for remote, source in (
    ("assets/atlas-overview.png","web/assets/atlas-overview.png"),
    ("assets/atlas-overview.svg","web/assets/atlas-overview.svg"),
    ("downloads/moonwater.blend","original-scene/artifacts/moonwater.blend"),
):
    result, data = fetch(base+remote)
    result["sha256"] = hashlib.sha256(data).hexdigest()
    result["bytes"] = len(data)
    assert result["status"] == 200
    assert result["sha256"] == hashlib.sha256((ROOT/source).read_bytes()).hexdigest()
    integrity.append(result)
manifest = json.loads((ROOT/"web/vendor/manifest.json").read_text(encoding="utf-8"))
def check_vendor(path):
    result, _ = fetch(base+"vendor/"+path, "HEAD")
    assert result["status"] == 200
with ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(check_vendor, manifest["files"]))
video, fragment = fetch(base+"assets/demo.mp4", headers={"Range":"bytes=0-63"})
assert video["status"] == 206 and video["content_type"] == "video/mp4" and len(fragment) == 64
preserved = []
for path in ("006-random-doors/research.html","014-cyber-xiaoya-study/"):
    result, _ = fetch(site+path,"HEAD")
    assert result["status"] == 200
    preserved.append(result)
report = {
    "verified_at":datetime.now(timezone.utc).isoformat(),
    "deployed_commit":options.commit,"workflow_run":options.run_url,
    "site":site,"research_url":base+"research.html",
    "overview_url":base+"overview.html","scene_url":base+"#scene",
    "summary":published["summary"],"published_project_ids":ids,
    "asset_and_anchor_checks":checks,"pages":pages,"download_integrity":integrity,
    "vendor_resources_accessible":len(manifest["files"]),"video_range":video,
    "existing_pages_preserved":preserved,
    "scope":"Public research and existing 3D artifact; no online model generation service.",
}
(ROOT/"deployment.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"verified":True,"pages":len(pages),"resources":checks["local_resources_verified"],
                  "model_sha256_verified":checks["http_model_verified"],"vendor":len(manifest["files"]),
                  "download_integrity":len(integrity),"report":str(ROOT/"deployment.json")},ensure_ascii=False))
