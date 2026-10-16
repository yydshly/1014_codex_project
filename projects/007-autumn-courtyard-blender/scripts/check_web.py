"""Check model integrity/topology, vendored dependencies and optional HTTP delivery."""
import argparse
import base64
import hashlib
import json
import struct
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT / "original-scene/assets/web-export.json").read_text(encoding="utf-8"))
model_path = ROOT / "web/dist/assets/moonwater-web.glb"
binary = model_path.read_bytes()
assert binary[:4] == b"glTF"
version, length, json_length, json_type = struct.unpack_from("<IIII", binary, 4)
assert version == 2 and length == len(binary) and json_type == 0x4E4F534A
gltf = json.loads(binary[20:20 + json_length])
assert not gltf.get("images") and all(not buffer.get("uri") for buffer in gltf["buffers"])
assert len(gltf["nodes"]) == report["batched_nodes"]
source_objects = sum(node.get("extras", {}).get("source_object_count", 0) for node in gltf["nodes"])
assert source_objects + len(report["omitted"]) == report["source_mesh_objects"]
triangle_count = sum(gltf["accessors"][primitive["indices"]]["count"] // 3 for mesh in gltf["meshes"] for primitive in mesh["primitives"])
assert triangle_count == report["evaluated_triangles"]
assert "KHR_draco_mesh_compression" in gltf["extensionsRequired"]
assert hashlib.sha256(binary).hexdigest() == report["output_sha256"]
assert hashlib.sha256((ROOT / "original-scene/artifacts/moonwater.blend").read_bytes()).hexdigest() == report["source_sha256"]
manifest = json.loads((ROOT / "web/vendor/manifest.json").read_text(encoding="utf-8"))
for relative, digest in manifest["files"].items():
    assert hashlib.sha256((ROOT / "web/vendor" / relative).read_bytes()).hexdigest() == digest, relative
    assert hashlib.sha256((ROOT / "web/dist/vendor" / relative).read_bytes()).hexdigest() == digest, relative

class DocumentLinks(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = set()
        self.links = []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attributes):
        for name, value in attributes:
            if name == "id":
                assert value not in self.ids, "Duplicate HTML id: " + value
                self.ids.add(value)
            if name in ("href", "src", "data-zoom") and value:
                self.links.append(value)

dist = ROOT / "web/dist"
documents = {name: DocumentLinks(dist / name) for name in ("index.html", "research.html", "overview.html")}
resources = set(documents)
poster_manifest = json.loads((dist / "assets/atlas-overview-provenance.json").read_text(encoding="utf-8"))
poster_png = (dist / "assets/atlas-overview.png").read_bytes()
assert hashlib.sha256(poster_png).hexdigest() == poster_manifest["png_sha256"]
assert list(struct.unpack_from(">II", poster_png, 16)) == poster_manifest["png_size"]
embedded_images = ET.parse(dist / "assets/atlas-overview.svg").findall("{http://www.w3.org/2000/svg}image")
assert len(embedded_images) == len(poster_manifest["evidence_images"]) == 3
for node, evidence_image in zip(embedded_images, poster_manifest["evidence_images"]):
    embedded_bytes = base64.b64decode(node.attrib["href"].split(",", 1)[1])
    assert hashlib.sha256(embedded_bytes).hexdigest() == evidence_image["sha256"]
    assert embedded_bytes == (ROOT / evidence_image["source"]).read_bytes()
for name, document in documents.items():
    for link in document.links:
        parts = urlsplit(link)
        if parts.scheme or parts.netloc:
            continue
        relative = unquote(parts.path) or name
        target = dist / relative
        assert target.is_file(), (name, link)
        resources.add(relative)
        if parts.fragment and relative in documents:
            assert unquote(parts.fragment) in documents[relative].ids, (name, link)
parser = argparse.ArgumentParser()
parser.add_argument("--url", help="Base URL ending at this numbered project")
options = parser.parse_args()
if options.url:
    from urllib.request import Request
    def check_resource(relative):
        with urlopen(Request(options.url.rstrip("/") + "/" + relative, method="HEAD"), timeout=20) as response:
            assert response.status == 200, relative
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(check_resource, sorted(resources)))
    with urlopen(options.url.rstrip("/") + "/assets/moonwater-web.glb", timeout=20) as response:
        assert response.status == 200
        assert hashlib.sha256(response.read()).hexdigest() == report["output_sha256"]
print(json.dumps({"nodes":len(gltf["nodes"]), "triangles":triangle_count,
                  "source_objects_preserved":source_objects, "model_bytes":len(binary),
                  "external_images":0, "source_unchanged":True,
                  "dependencies_verified":len(manifest["files"]), "local_resources_verified":len(resources),
                  "overview_size":poster_manifest["png_size"], "unmodified_evidence_images":len(embedded_images),
                  "html_anchors_verified":True, "http_model_verified":bool(options.url)}, ensure_ascii=False))
