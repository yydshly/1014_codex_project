"""Export our saved Blender geometry to a compressed, self-contained web GLB.

The source .blend is opened read-only and never saved. Evaluated bevel geometry
is retained; objects are batched by collection/material to reduce draw calls.
Procedural Cycles shaders become approximate glTF PBR materials. The web viewer
rebuilds lighting and pool reflections, rather than projecting a reference image.
"""
import hashlib
import json
import math
import time
from collections import defaultdict
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts/moonwater.blend"
OUTPUT = ROOT / "artifacts/moonwater-web.glb"
START = time.perf_counter()
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
originals = list(bpy.context.scene.objects)
source_meshes = [o for o in originals if o.type == "MESH"]
depsgraph = bpy.context.evaluated_depsgraph_get()


def material_for_web(original):
    result = bpy.data.materials.new("Web | " + original.name)
    result.use_nodes = True
    target = result.node_tree.nodes.get("Principled BSDF")
    source = original.node_tree.nodes.get("Principled BSDF") if original.use_nodes else None
    if source:
        for name in ("Base Color", "Metallic", "Roughness", "IOR", "Emission Color", "Emission Strength", "Coat Weight"):
            target.inputs[name].default_value = source.inputs[name].default_value
        for name in ("Base Color", "Emission Color"):
            socket = source.inputs[name]
            if socket.is_linked and socket.links[0].from_node.type == "VALTORGB":
                ramp = socket.links[0].from_node.color_ramp
                first, last = ramp.elements[0].color, ramp.elements[-1].color
                target.inputs[name].default_value = tuple(first[i] * .35 + last[i] * .65 for i in range(4))
        if source.inputs["Roughness"].is_linked:
            target.inputs["Roughness"].default_value = .38 if "Wet" in original.name else .7
    else:
        target.inputs["Base Color"].default_value = original.diffuse_color
    result.use_backface_culling = not any(s in original.name.lower() for s in ("leaf", "bloom", "foliage"))
    return result


materials = {}
buckets = defaultdict(list)
omitted = []
vertices = triangles = 0
for index, obj in enumerate(source_meshes):
    if obj.name == "Distant valley atmosphere":
        omitted.append(obj.name)
        continue
    group = obj.users_collection[0].name if obj.users_collection else "Scene"
    key = (group, tuple(m.name for m in obj.data.materials))
    evaluated = obj.evaluated_get(depsgraph)
    geometry = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    geometry.transform(obj.matrix_world)
    assert all(math.isfinite(n) for vertex in geometry.vertices for n in vertex.co), obj.name
    geometry.calc_loop_triangles()
    vertices += len(geometry.vertices)
    triangles += len(geometry.loop_triangles)
    geometry.materials.clear()
    for original in obj.data.materials:
        if original.name not in materials:
            materials[original.name] = material_for_web(original)
        geometry.materials.append(materials[original.name])
    batch = bpy.data.objects.new("WEB | " + obj.name, geometry)
    bpy.context.scene.collection.objects.link(batch)
    buckets[key].append(batch)
    if index % 200 == 0:
        print("CONVERT", index, "/", len(source_meshes), flush=True)

# Originals are removed from this in-memory export scene only.
for obj in originals:
    bpy.data.objects.remove(obj, do_unlink=True)
for (group, material_names), objects in buckets.items():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    batch = bpy.context.object
    batch.name = group + " | " + " + ".join(material_names)
    batch["source_object_count"] = len(objects)
    batch["source_collection"] = group

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format="GLB", use_selection=True,
    export_yup=True, export_apply=False, export_materials="EXPORT",
    export_normals=True, export_cameras=False, export_lights=False,
    export_extras=True, export_animations=False,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,
    export_draco_normal_quantization=10,
)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
report = {
    "source": "artifacts/moonwater.blend",
    "source_sha256": source_hash,
    "output": "artifacts/moonwater-web.glb",
    "output_sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    "output_bytes": OUTPUT.stat().st_size,
    "blender": bpy.app.version_string,
    "source_mesh_objects": len(source_meshes),
    "batched_nodes": len(buckets),
    "evaluated_vertices": vertices,
    "evaluated_triangles": triangles,
    "materials": len(materials),
    "omitted": omitted,
    "geometry_decimation": False,
    "reference_image_used": False,
    "compression": "KHR_draco_mesh_compression, position 16-bit, normals 10-bit",
    "material_conversion": "Approximate PBR colors; Cycles procedural nodes and volume haze not transferred",
    "source_unchanged": True,
    "export_seconds": round(time.perf_counter() - START, 2),
}
(ROOT / "assets/web-export.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("WEB EXPORT", json.dumps(report), flush=True)
