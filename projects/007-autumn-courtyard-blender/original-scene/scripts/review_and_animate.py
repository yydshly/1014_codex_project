"""Read the saved scene, verify dependencies, render an overview and orbit.

The scene is not rebuilt here. Concept pixels never enter Blender materials.
Run Blender -b artifacts/moonwater.blend --python this_file.py
"""
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_moonwater import configure

s=bpy.context.scene
assert Path(bpy.data.filepath).name=="moonwater.blend","Open the saved moonwater.blend"
report={"saved_scene":"artifacts/moonwater.blend","blender":bpy.app.version_string,
        "external_image_dependencies":[i.filepath for i in bpy.data.images if i.source=="FILE"],
        "camera_background_images":len(s.camera.data.background_images),
        "reference_sha256_matches":s.get("generated_reference_sha256")==hashlib.sha256((ROOT/"assets/concept.png").read_bytes()).hexdigest(),
        "objects":len(s.objects),"non_finite_meshes":[],"inverted_closed_stone_blocks":[]}
for obj in s.objects:
    if obj.type!="MESH":continue
    if any(not math.isfinite(c) for v in obj.data.vertices for c in v.co):report["non_finite_meshes"].append(obj.name)
    if len(obj.data.vertices)==8 and len(obj.data.polygons)==6:
        volume=0
        center=sum((v.co for v in obj.data.vertices),Vector())/8
        for poly in obj.data.polygons:
            # Local coordinates avoid cancellation on millimetre-thin stems
            # whose vertices are many metres from the world origin.
            points=[obj.data.vertices[i].co-center for i in poly.vertices]
            for k in range(1,len(points)-1):volume+=points[0].dot(points[k].cross(points[k+1]))/6
        if volume<=0:report["inverted_closed_stone_blocks"].append(obj.name)
report["checks_passed"]=not report["external_image_dependencies"] and not report["non_finite_meshes"] and not report["inverted_closed_stone_blocks"] and report["reference_sha256_matches"] and not report["camera_background_images"]
assert report["checks_passed"],json.dumps(report)
report["backend"],report["devices"]=configure("final")
c=s.camera
hero_location=c.location.copy();hero_rotation=c.rotation_euler.copy()
c.location=(24,-23,21);c.rotation_euler=(Vector((0,5,2))-c.location).to_track_quat("-Z","Y").to_euler()
c.data.lens=33;s.render.resolution_x=1280;s.render.resolution_y=900;s.cycles.samples=64
s.render.filepath=str(ROOT/"assets/overview.png")
t=time.perf_counter();bpy.ops.render.render(write_still=True)
report["overview_render_seconds"]=round(time.perf_counter()-t,2)
frames=ROOT/".cache/orbit";frames.mkdir(parents=True,exist_ok=True)
s.render.resolution_x=960;s.render.resolution_y=540;s.cycles.samples=24;s.cycles.adaptive_threshold=.085
c.data.lens=34
target=Vector((.8,8.2,1.5));pivot=Vector((0,7,hero_location.z));relative=hero_location-pivot
started=time.perf_counter()
for i in range(24):
    angle=-.085+.17*i/23
    c.location=pivot+Matrix.Rotation(angle,3,"Z")@relative
    c.rotation_euler=(target-c.location).to_track_quat("-Z","Y").to_euler()
    s.render.filepath=str(frames/("frame-%03d.png"%i))
    bpy.ops.render.render(write_still=True)
    print("ORBIT_FRAME",i,flush=True)
report["orbit_frames"]=24;report["orbit_seconds"]=round(time.perf_counter()-started,2)
report["orbit_resolution"]=[960,540];report["orbit_samples_max"]=24
(ROOT/"assets/scene-checks.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("REVIEW",json.dumps(report),flush=True)
