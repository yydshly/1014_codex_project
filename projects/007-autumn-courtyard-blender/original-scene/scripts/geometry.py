"""Geometry helpers reused from our own first experiment; no upstream code."""
import math
import bpy
from mathutils import Vector, Matrix
COLLECTIONS = {}

def rgb(value):
    h = value.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)

def collection(name):
    if name not in COLLECTIONS:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
        COLLECTIONS[name] = c
    return COLLECTIONS[name]

def move(obj, group):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection(group).objects.link(obj)
    return obj

def material(name, color, roughness=.8):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgb(color)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = rgb(color)
    bs.inputs["Roughness"].default_value = roughness
    return m

def mesh(name, verts, faces, mat, group, indices=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection(group).objects.link(obj)
    for m in mat if isinstance(mat, list) else [mat]:
        data.materials.append(m)
    if indices:
        for poly, index in zip(data.polygons, indices):
            poly.material_index = index
    return obj

def bevel(obj, width=.04, segments=2):
    modifier = obj.modifiers.new("Soft worn stone edges", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    return obj

def box(name, center, size, mat, group="02 Architecture", edge=.035):
    x, y, z = center
    a, b, c = [v / 2 for v in size]
    v = [(x + i * a, y + j * b, z + k * c) for i, j, k in
         ((-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1))]
    f = [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    o = mesh(name, v, [tuple(reversed(face)) for face in f], mat, group)
    return bevel(o, edge) if edge else o

def tube(name, points, radii, mat, group="04 Trees", sides=9, ribs=0):
    verts, faces = [], []
    for i, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(0, i - 1)])
        if tangent.length < .0001:
            tangent = Vector((0,0,1))
        tangent.normalize()
        axis = tangent.cross(Vector((0,1,0))).normalized()
        other = tangent.cross(axis).normalized()
        for k in range(sides):
            a = k * math.tau / sides
            r = radii[i] * (1 + ribs * math.sin(k * 2.8 + i * .24))
            verts.append(tuple(p + r * (axis * math.cos(a) + other * math.sin(a))))
    for i in range(len(points) - 1):
        for k in range(sides):
            a = i * sides + k
            b = i * sides + (k + 1) % sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))), tuple((len(points)-1)*sides+k for k in range(sides))]
    obj = mesh(name, verts, faces, mat, group)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj

def arch(name, x, y, spring, radius, thickness, depth, mat, group="02 Architecture", segments=21, orientation="x"):
    # Independent voussoirs preserve the small construction joints around an arch.
    for k in range(segments):
        a, b = math.pi * k / segments + .006, math.pi * (k + 1) / segments - .006
        v = []
        for d in (-depth/2, depth/2):
            for r, t in ((radius,a),(radius,b),(radius+thickness,b),(radius+thickness,a)):
                u, h = math.cos(t)*r, spring+math.sin(t)*r
                v.append((x+u,y+d,h) if orientation=="x" else (x+d,y+u,h))
        o = mesh(name+" voussoir %02d" % k, v, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat, group)
        bevel(o, .028, 2)
