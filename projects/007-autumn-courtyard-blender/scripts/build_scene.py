"""Original, deterministic Blender reconstruction from a single visual reference.

Run with Blender 4.5 LTS. No external meshes, textures, image models, or add-ons.
The reference is Shikhar's public autumn-courtyard render, NOT an upstream scene.
"""
import argparse
import json
import math
import random
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


STARTED = time.perf_counter()
ROOT = Path(__file__).resolve().parents[1]
RNG = random.Random(211014)
COUNTS = {"tree_leaves": 0, "ground_leaves": 0, "drifting_leaves": 0}
COLLECTIONS = {}


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quality", choices=("preview", "final"), default="preview")
    parser.add_argument("--output", type=Path, default=ROOT / "assets")
    parser.add_argument("--device", choices=("auto", "cpu"), default="auto")
    parser.add_argument("--view", choices=("hero", "overview"), default="hero")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


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


def stone_material(name, color, shadow, scale=3):
    m = material(name, color)
    n, l = m.node_tree.nodes, m.node_tree.links
    p = n.get("Principled BSDF")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 3
    noise.inputs["Roughness"].default_value = .72
    tex = n.new("ShaderNodeTexCoord")
    l.new(tex.outputs["Object"], noise.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = .2
    ramp.color_ramp.elements[0].color = rgb(shadow)
    ramp.color_ramp.elements[1].position = .78
    ramp.color_ramp.elements[1].color = rgb(color)
    l.new(noise.outputs["Fac"], ramp.inputs[0])
    l.new(ramp.outputs["Color"], p.inputs["Base Color"])
    fine = n.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 48
    fine.inputs["Detail"].default_value = 2
    l.new(tex.outputs["Object"], fine.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .19
    bump.inputs["Distance"].default_value = .022
    l.new(fine.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


def setup_materials():
    mats = {}
    mats["stone"] = stone_material("Warm ivory limestone", "e2ddd1", "bdb9b0")
    mats["trim"] = stone_material("Pale cut edges", "eee6d8", "cbc4b7")
    mats["joint"] = material("Mortar and dark joints", "69616c")
    mats["distant"] = stone_material("Distant limestone", "c6c9d3", "a4aabd")
    mats["cliff"] = stone_material("Weathered retaining walls", "9fa2ab", "747989", 1.1)
    mats["paving"] = [stone_material("Paving %02d" % i, c, "99919a") for i, c in enumerate(
        ("cdc9c6", "d9d2c7", "c4c2c5", "e2d9ca", "bcbac0"))]
    mats["bark"] = stone_material("Wine brown ridged bark", "594237", "251c26", 5)
    mats["banner"] = material("Burgundy woven banners", "61162d", .92)
    mats["gold"] = material("Faded brass embroidery", "aa804a", .58)
    mats["grass"] = [material("Dry undergrowth %d" % i, c) for i, c in enumerate(("66613e", "888158", "573f42"))]
    mats["cloak"] = material("Charcoal traveler cloak", "24222e")
    mats["hood"] = material("Hood shadow", "110f19")
    mats["water"] = material("Soft white falling water", "dce9ef", .23)
    water = mats["water"].node_tree.nodes.get("Principled BSDF")
    water.inputs["Emission Color"].default_value = rgb("b6cfdf")
    water.inputs["Emission Strength"].default_value = .18
    mats["leaves"] = []
    for i, color in enumerate(("9d1323", "bb2020", "d63716", "ed5715", "f87e14", "8d1021", "cc3e1b", "e5a323")):
        m = material("Autumn maple %02d" % i, color, .72)
        n, l = m.node_tree.nodes, m.node_tree.links
        translucent = n.new("ShaderNodeBsdfTranslucent")
        translucent.inputs[0].default_value = rgb(color)
        mix = n.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = .18
        l.new(n.get("Principled BSDF").outputs[0], mix.inputs[1])
        l.new(translucent.outputs[0], mix.inputs[2])
        l.new(mix.outputs[0], n.get("Material Output").inputs["Surface"])
        mats["leaves"].append(m)
    return mats


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


def pillar(name, x, y, height, width, depth, mats, group="02 Architecture"):
    box(name+" foot", (x,y,.22), (width*1.5,depth*1.5,.44), mats["trim"], group, .06)
    box(name+" pedestal", (x,y,.65), (width*1.25,depth*1.25,.42), mats["stone"], group)
    box(name+" base molding", (x,y,.94), (width*1.39,depth*1.39,.17), mats["trim"], group)
    course = .88
    z = 1.04
    k = 0
    while z < height-.65:
        h = min(course, height-.65-z)
        if h < .04:
            break
        box(name+" course %02d" % k, (x,y,z+h/2), (width,depth,h-.027), mats["stone"], group, .026)
        z += h
        k += 1
    for i, (w,d,h) in enumerate(((1.08,1.08,.18),(1.26,1.26,.2),(1.43,1.4,.22))):
        box(name+" capital %d" % i, (x,y,height-.55+i*.2), (width*w,depth*d,h), mats["trim"], group)


def paving(mats):
    box("Deep courtyard foundation", (0,40,-.35), (180,180,.6), mats["joint"], "01 Courtyard", 0)
    groups = [([],[],[]) for _ in mats["paving"]]
    for row in range(48):
        y = -13 + row * 1.02
        for col in range(39):
            x = -20 + col * 1.05 + (.48 if row % 2 else 0)
            palette = RNG.randrange(len(groups))
            vs, fs, _ = groups[palette]
            index = len(vs)
            corners = [(x+RNG.uniform(-.035,.035), y+RNG.uniform(-.035,.035)),
                       (x+.99+RNG.uniform(-.035,.035),y+RNG.uniform(-.035,.035)),
                       (x+.99+RNG.uniform(-.035,.035),y+.97+RNG.uniform(-.035,.035)),
                       (x+RNG.uniform(-.035,.035),y+.97+RNG.uniform(-.035,.035))]
            z = RNG.uniform(-.016,.018)
            vs += [(a,b,z-.13) for a,b in corners] + [(a,b,z+.035) for a,b in corners]
            fs += [tuple(index+k for k in f) for f in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))]
    for i, (v,f,_) in enumerate(groups):
        bevel(mesh("Individual flagstones %d" % i,v,f,mats["paving"][i],"01 Courtyard"),.018,1)


def architecture(mats):
    # Tall foreground portal; far side appears behind the framing maple trunk.
    for x in (-9.8,.2):
        pillar("Monumental portal %.1f" % x,x,9.5,13.5,1.82,2.05,mats)
    arch("Monumental portal",-4.8,9.5,13.35,4.12,1.0,2.03,mats["stone"],segments=25)
    # Broad stair rises through the opening, not a flat painted backdrop.
    for i in range(30):
        y = 10.8 + i * .43
        h = (i+1)*.19
        box("Grand stair %02d" % i,(-5.1,y,h/2),(5.35,.46,h),mats["stone"],edge=.022)
        box("Stair nosing %02d" % i,(-5.1,y-.2,h+.015),(5.42,.07,.085),mats["trim"],edge=.018)
    for side in (-1,1):
        x = -5.1+side*2.98
        for i in range(10):
            y = 11.3+i*1.28
            z = .56+i*.57
            box("Stair cheek",(x,y,z/2+.3),(.6,1.27,z+.6),mats["stone"])
            box("Stair cheek coping",(x,y,z+.64),(.78,1.31,.2),mats["trim"])
    box("Upper stair landing",(-5.1,27.0,5.45),(5.6,8,.5),mats["stone"])
    for x in (-8.3,-1.9):
        pillar("Landing gallery pier",x,31.8,9.0,1.15,1.45,mats)
    arch("Landing gallery opening",-5.1,31.8,8.85,2.6,.48,1.45,mats["stone"],segments=19)
    # A crosswise arcade supports the descending terrace stair. Its broad
    # visible face, rather than an edge-on wall, establishes the middle depth.
    for k in range(5):
        x = 3.2+k*3.05
        top = 8.5-k*.7
        pillar("Promenade pier %02d" % k,x,19,top,1.0,1.4,mats)
        if k < 4:
            spring=top-2.1
            arch("Promenade arch %02d" % k,x+1.525,19,spring,1.06,.4,1.4,mats["stone"],segments=15)
            # Fill above the curved extrados without filling the arch opening.
            for j in range(15):
                xx=x+.15+j*2.75/15
                t=(xx-x)/3.05
                lower=spring+math.sqrt(max(0,1.46**2-(xx-x-1.525)**2))
                upper=top+.3-t*.7
                if upper>lower:
                    box("Arcade masonry above opening",(xx,19,(upper+lower)/2),(2.75/15+.02,1.4,upper-lower),mats["stone"],edge=.014)
    # Stepped parapet line catches the sunlight.
    for i in range(38):
        x=3.0+i*.34
        z=8.8-i*.078
        box("Promenade coping",(x,19,z),(.37,1.66,.23),mats["trim"])
        box("Elevated stair tread",(x,22,z-.32),(.37,5.7,.3),mats["stone"])
    # Near right pier, cropped by the camera, with deep layered plinths.
    pillar("Near right buttress",16.1,1.7,15.8,2.75,3.05,mats)
    box("Right cloister sidewall",(18.5,9,4.5),(2.5,16,9),mats["stone"])
    box("Right sidewall lower band",(17.15,9,3.2),(.35,16,.4),mats["trim"])
    box("Right sidewall upper band",(17.15,9,9.1),(.55,16,.5),mats["trim"])
    box("Left cloister retaining wall",(-18,31,5),(2.4,43,10),mats["stone"])
    for y in (12,21,30,39):
        pillar("Left cloister buttress",-16.6,y,10.5,1.3,1.6,mats)
    box("Left cloister continuous cornice",(-16.6,29,10.55),(1.7,41,.42),mats["trim"])
    # Small foreground rubble and planters.
    for x,y,r in ((-8,-.6,1.4),(-5.8,-1.4,1.05),(9,5,.9),(11,-1,.85),(3.4,9,.65)):
        box("Low dressed stone planter",(x,y,.38),(r*1.8,r*1.18,.75),mats["stone"],"01 Courtyard",.12)
        box("Planter soil",(x,y,.8),(r*1.65,r,.08),mats["joint"],"01 Courtyard",.03)
    for _ in range(23):
        x,y=RNG.uniform(-10,14),RNG.uniform(-3,18)
        if -6.5<x<.3 and y>10:
            continue
        o=box("Loose broken limestone",(x,y,.13),(RNG.uniform(.2,.65),RNG.uniform(.2,.6),RNG.uniform(.12,.4)),mats["stone"],"01 Courtyard",.06)
        # Vertices are in world coordinates; rotate about individual bounding center.
    for i,(x,y,sx,sy,sz) in enumerate(((-9,-.5,1.7,1.2,.66),(-7,-1.7,1.3,.9,.47),(12,-.3,.8,.65,.55),(13.3,1,1,.7,.6))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,sz*.45))
        o=bpy.context.object;o.name="Rounded fallen limestone %02d"%i
        for v in o.data.vertices:
            v.co*=1+RNG.uniform(-.09,.09)
            v.co.z=max(v.co.z,-.5)
        o.scale=(sx,sy,sz);o.data.materials.append(mats["stone"]);move(o,"01 Courtyard")
        bevel(o,.045,2)


def background(mats):
    group="03 Terraces and distant citadel"
    box("Great retaining cliff",(0,49,7),(62,8,15),mats["cliff"],group,.16)
    box("Terrace cornice",(0,43.8,15),(60,1.3,.7),mats["distant"],group)
    for x in range(-23,25,6):
        box("Rear arcade pier",(x,39,9),(1.35,1.7,7),mats["distant"],group)
        arch("Rear terrace arcade",x+3,39,11.5,2.3,.57,1.65,mats["distant"],group,17)
        box("Arcade upper entablature",(x+3,39,15),(6.05,1.95,.65),mats["distant"],group)
    box("Upper terrace",(0,53,19.2),(56,12,1.3),mats["distant"],group)
    for x in range(-24,25,3):
        box("Upper balustrade",(x,47,20.2),(2.8,.9,.9),mats["distant"],group)
        box("Upper balustrade coping",(x,47,20.75),(3.0,1.04,.2),mats["trim"],group)
    # Slender pale citadel towers and an open crown arch on the skyline.
    for x,y,z,h,w in ((-1,64,20,10,5),(-8,66,20,12,3.7),(7,68,20,13,3.7),(-14,70,20,9,2.6),(13,72,20,10,2.6)):
        box("Citadel tower",(x,y,z+h/2),(w,w*.8,h),mats["distant"],group,.09)
        box("Tower crown cornice",(x,y,z+h),(w*1.13,w,.4),mats["distant"],group)
        for dx in (-w*.44,w*.44):
            for dy in (-w*.32,w*.32):
                tube("Slender skyline pinnacle",[(x+dx,y+dy,z+h),(x+dx,y+dy,z+h+3.9)], [.22,.01],mats["distant"],group,6)
        for zz in (z+3,z+6,z+9):
            if zz<z+h:
                box("Tower inset window",(x,y-w*.41,zz),(w*.2,.025,1.3),mats["cliff"],group,.06)
    arch("Open crown of the citadel",-1,64,35.0,2.35,.35,2.6,mats["distant"],group,23)
    for x in (-3.55,1.55):
        box("Crown upright",(x,64,32.65),(.46,2.6,4.7),mats["distant"],group)
        tube("Crown flanking needle",[(x,64,35),(x,64,40.6)],[.19,.008],mats["distant"],group,7)
    for i in range(22):
        x=-16+i*1.42
        y=67+(i%3)*1.4
        base=27+3*math.sin(i*.75)
        h=RNG.uniform(3.2,6)
        box("Gothic flying buttress",(x,y,base-1),(.38,1.8,4.4),mats["distant"],group)
        tube("Gothic skyline spire",[(x,y,base),(x,y,base+h)],[.35,.008],mats["distant"],group,6)
    for x,y,top,bottom,width in ((-13,43,19.8,3,.75),(-2,43,19.8,8,.4),(10,43,19.8,2,1.05),(19,43,19.8,7,.55)):
        for k in range(7):
            xx=x+(k-3)*width/7
            points=[]
            for j in range(14):
                z=top+(bottom-top)*j/13
                points.append((xx+math.sin(j*.65+k)*.027,y-.22+math.sin(j*.8+k)*.03,z))
            tube("Waterfall silver stream",points,[width/18*(.65+RNG.random()*.4) for _ in points],mats["water"],group,5)


# A small lobed mesh is used for every leaf. Geometry is batched by tree, not
# thousands of separate Blender objects; no foliage texture is involved.
LEAF_OUTLINE=[(0,-.48),(-.14,-.22),(-.39,-.18),(-.28,.02),(-.55,.18),(-.25,.28),(-.23,.61),(0,.4),(.23,.61),(.25,.28),(.55,.18),(.28,.02),(.39,-.18),(.14,-.22)]


class Leaves:
    def __init__(self,name,group,mats):
        self.name,self.group,self.mats=name,group,mats
        self.v,self.f,self.mi=[],[],[]

    def add(self,point,size,rotation,color):
        base=len(self.v)
        center=Vector(point)
        self.v.append(tuple(center+rotation@Vector((0,0,size*.09))))
        for x,y in LEAF_OUTLINE:
            self.v.append(tuple(center+rotation@Vector((x*size,y*size,abs(x)*size*.12))))
        for k in range(len(LEAF_OUTLINE)):
            self.f.append((base,base+1+(k+1)%len(LEAF_OUTLINE),base+1+k))
            self.mi.append(color)

    def finish(self):
        return mesh(self.name,self.v,self.f,self.mats,"04 Trees" if self.group is None else self.group,self.mi)


def rotation(a,b,c):
    return Matrix.Rotation(a,3,"Z")@Matrix.Rotation(b,3,"Y")@Matrix.Rotation(c,3,"X")


def tree(name,origin,height,crown,hero,mats,palette=(0,1,2,3,5)):
    x,y,z=origin
    trunk=[]
    for i in range(13):
        t=i/12
        trunk.append((x+height*(.27 if hero else .15)*t+math.sin(t*5)*.18,y+height*.06*t,z+height*t))
    radius=height*(.079 if hero else .048)
    tube(name+" gnarled trunk",trunk,[radius*(1-i/13)**1.13+.04 for i in range(13)],mats["bark"],sides=22 if hero else 10,ribs=.15)
    if hero:
        for k in range(9):
            a=k*math.tau/9
            root=[(x+math.cos(a)*radius*.3,y+math.sin(a)*radius*.3,z+1.5),
                  (x+math.cos(a)*radius*1.25,y+math.sin(a)*radius*1.25,z+.35),
                  (x+math.cos(a)*radius*3.1,y+math.sin(a)*radius*3.1,z+.06)]
            tube(name+" exposed root",root,[.42,.32,.025],mats["bark"],sides=10,ribs=.1)
        for k in range(19):
            a=k*math.tau/19
            points=[]
            for i in range(11):
                t=i/12
                p=Vector(trunk[i]);r=radius*(1-i/13)**1.13+.04
                aa=a+.34*t+math.sin(t*5+k)*.06
                points.append(tuple(p+Vector((math.cos(aa)*r,math.sin(aa)*r,0))))
            tube(name+" twisted bark ridge",points,[radius*.063*(1-i/13)+.012 for i in range(11)],mats["bark"],sides=6)
    foliage=Leaves(name+" lobed maple canopy",None,mats["leaves"])
    branches=18 if hero else 9
    for k in range(branches):
        angle=RNG.uniform(0,math.tau)
        level=RNG.uniform(.57,.91)
        start=Vector(trunk[int(level*12)])
        length=crown*RNG.uniform(.55,1.05)
        tip=start+Vector((math.cos(angle)*length,math.sin(angle)*length,height*RNG.uniform(.05,.18)))
        mid=start.lerp(tip,.5)+Vector((0,0,height*.055))
        tube(name+" main branch",[start,mid,tip],[radius*.26,radius*.12,.025],mats["bark"],sides=8)
        for j in range(3 if hero else 2):
            cc=tip+Vector((RNG.uniform(-crown*.23,crown*.23),RNG.uniform(-crown*.23,crown*.23),RNG.uniform(-height*.04,height*.08)))
            tube(name+" twig",[mid,cc],[radius*.07,.01],mats["bark"],sides=5)
            number=650 if hero else 180
            for _ in range(number):
                # A filled ellipsoid gives connected, irregular canopy masses.
                while True:
                    q=Vector((RNG.uniform(-1,1),RNG.uniform(-1,1),RNG.uniform(-1,1)))
                    if q.length_squared<1:
                        break
                q=Vector((q.x*crown*.31,q.y*crown*.29,q.z*height*.12))
                p=cc+q
                size=RNG.uniform(.18,.34) if hero else RNG.uniform(.16,.27)
                foliage.add(p,size,rotation(RNG.random()*math.tau,RNG.uniform(-1,1),RNG.uniform(-1.3,1.3)),RNG.choice(palette))
                COUNTS["tree_leaves"]+=1
    foliage.finish()


def vegetation(mats):
    tree("Left framing maple",(-11.0,1.9,.05),18,7.2,True,mats)
    tree("Upper right flaming maple",(16,12,6),12,5.4,False,mats,(2,3,4,6))
    for i,(x,y,z,h) in enumerate(((-10,24,4,6),(-15,28,5,8),(4,29,7,4),(-7,42,17,4),(4,47,20,3.7),(13,47,20,4.2),(-16,49,20,4.1),(21,50,20,4))):
        tree("Terrace maple %02d"%i,(x,y,z),h,h*.53,False,mats,(1,2,3,4,6))
    # Ivy strands visibly attach to the front and inner faces of the right pier.
    ivy=Leaves("Cascading orange ivy","05 Ivy and ground cover",mats["leaves"])
    for side,x,y in ((0,14.69,.12),(1,14.68,3),(2,17.1,8),(3,-.7,8.43)):
        for strand in range(14 if side<3 else 7):
            if side==1:
                start=Vector((x,y+RNG.uniform(-.8,1),RNG.uniform(9,12.9)))
            else:
                start=Vector((x+RNG.uniform(-1.0,1.2),y,RNG.uniform(8,12.9)))
            points=[start+Vector((math.sin(k*.6+strand)*.12,math.cos(k*.7)*.04,-k*.24)) for k in range(RNG.randrange(12,32))]
            tube("Hanging ivy stem",points,[.013]*len(points),mats["bark"],"05 Ivy and ground cover",4)
            for p in points:
                for s in (-1,-.45,.45,1):
                    ivy.add(p+Vector((s*.19,-.06+RNG.random()*.03,RNG.uniform(-.09,.09))),RNG.uniform(.16,.29),rotation(RNG.uniform(-.8,.8),math.pi*.45,RNG.uniform(-.6,.6)),RNG.choice((1,2,3,4,6)))
    ivy.finish()
    ground=Leaves("Thousands of curled fallen maple leaves","05 Ivy and ground cover",mats["leaves"])
    for _ in range(39000):
        x,y=RNG.uniform(-19,18),RNG.uniform(-10,34)
        if -7.7<x<-2.5 and 10.8<y<23.7:
            step=int((y-10.8)/.43)
            z=max(0,(step+1)*.19)+.1
        else:
            z=.085+RNG.random()*.035
        # Slightly clearer center path, with denser piles at walls and roots.
        if -1<x<6 and -3<y<12 and RNG.random()<.4:
            continue
        ground.add((x,y,z),RNG.uniform(.10,.27),rotation(RNG.random()*math.tau,RNG.uniform(-.17,.17),RNG.uniform(-.2,.2)),RNG.choice((0,1,2,3,4,6,7)))
        COUNTS["ground_leaves"]+=1
    ground.finish()
    air=Leaves("Airborne leaves in the courtyard","06 Airborne leaves",mats["leaves"])
    for _ in range(115):
        p=(RNG.uniform(-12,12),RNG.uniform(0,35),RNG.uniform(.7,15))
        air.add(p,RNG.uniform(.1,.25),rotation(RNG.random()*math.tau,RNG.random()*math.pi,RNG.random()*math.pi),RNG.choice((1,2,3,4,6)))
        COUNTS["drifting_leaves"]+=1
    air.finish()
    # Dry grass at the edges, drawn as tapered three-dimensional blades.
    vs,fs,mi=[],[],[]
    for _ in range(1100):
        x,y=RNG.uniform(-14,16),RNG.uniform(-5,19)
        if -7<x<9 and y<12:
            continue
        for k in range(RNG.randrange(3,7)):
            a=RNG.random()*math.tau
            h=RNG.uniform(.12,.47)
            base=Vector((x+RNG.uniform(-.15,.15),y+RNG.uniform(-.15,.15),.08))
            side=Vector((math.cos(a)*.018,math.sin(a)*.018,0))
            tip=base+Vector((math.cos(a)*h*.35,math.sin(a)*h*.35,h))
            j=len(vs)
            vs += [tuple(base-side),tuple(base+side),tuple(tip)]
            fs.append((j,j+1,j+2)); mi.append(RNG.randrange(3))
    mesh("Dry grass tufts",vs,fs,mats["grass"],"05 Ivy and ground cover",mi)


def banner(name,center,width,length,mats):
    x,y,z=center
    verts,faces=[],[]
    rows,cols=22,8
    for i in range(rows+1):
        t=i/rows
        for j in range(cols+1):
            u=j/cols-.5
            bottom=length*(.95+abs(u)*.1)
            verts.append((x+u*width+math.sin(t*4)*.06,y+math.sin(u*8+t*2.5)*.07+t*t*.11,z-t*bottom))
    for i in range(rows):
        for j in range(cols):
            k=i*(cols+1)+j
            faces.append((k,k+1,k+cols+2,k+cols+1))
    mesh(name,verts,faces,mats["banner"],"07 Banners and traveler")
    tube("Banner hanger",[(x-width*.65,y,z+.1),(x+width*.65,y,z+.1)],[.035,.035],mats["gold"],"07 Banners and traveler",8)
    # Simple double line embroidered along the cloth edges.
    for s in (-1,1):
        points=[(x+s*width*.43+math.sin(t*4)*.06,y-.015+math.sin(s*.43*8+t*2.5)*.07+t*t*.11,z-t*length*.993) for t in [i/22 for i in range(23)]]
        tube("Banner edge embroidery",points,[.012]*len(points),mats["gold"],"07 Banners and traveler",4)


def traveler(mats):
    x,y=-5.0,5.0
    group="07 Banners and traveler"
    verts,faces=[],[]
    rings,sides=9,22
    for i in range(rings):
        t=i/(rings-1)
        z=1.5*(1-t)+.1
        r=.16+.32*t**.8
        for k in range(sides):
            a=k*math.tau/sides
            rr=r*(1+.12*math.sin(a*6+t*2))
            verts.append((x+math.cos(a)*rr+.18*t*t,y+math.sin(a)*rr-.15*t*t,z))
    for i in range(rings-1):
        for k in range(sides):
            a=i*sides+k;b=i*sides+(k+1)%sides
            faces.append((a,b,b+sides,a+sides))
    cloak=mesh("Small cloaked traveler",verts,faces,mats["cloak"],group)
    for p in cloak.data.polygons:p.use_smooth=True
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=.23,location=(x,y,1.59))
    hood=bpy.context.object;hood.name="Traveler hood";hood.scale=(.88,.91,1.12);hood.data.materials.append(mats["hood"]);move(hood,group)
    for s in (-1,1):
        tube("Traveler boots",[(x+s*.12,y,.09),(x+s*.12,y,.4)],[.085,.07],mats["hood"],group,8)
    tube("Fine gold cloak edge",[(x-.08,y-.19,1.45),(x+.02,y-.26,.9),(x+.18,y-.38,.15)],[.014,.012,.012],mats["gold"],group,5)


def atmosphere(mats):
    world=bpy.data.worlds.new("Cool blue autumn sky")
    world.use_nodes=True
    world.node_tree.nodes.get("Background").inputs[0].default_value=rgb("b6c8e3")
    world.node_tree.nodes.get("Background").inputs[1].default_value=.38
    bpy.context.scene.world=world
    bpy.ops.object.light_add(type="SUN",location=(-12,-8,25))
    sun=bpy.context.object;sun.name="Warm low autumn sun";move(sun,"08 Lighting and atmosphere")
    sun.rotation_euler=Vector((-.55,.38,-1)).to_track_quat("-Z","Y").to_euler()
    sun.data.energy=4.0;sun.data.angle=math.radians(4)
    sun.data.color=(1,.83,.67)
    bpy.ops.object.light_add(type="AREA",location=(-5,-10,17))
    fill=bpy.context.object;fill.name="Large cool sky fill";move(fill,"08 Lighting and atmosphere")
    fill.data.energy=1250;fill.data.shape="DISK";fill.data.size=18
    fill.data.color=(.68,.78,1)
    fill.rotation_euler=(Vector((0,12,4))-fill.location).to_track_quat("-Z","Y").to_euler()
    m=bpy.data.materials.new("Distance haze volume")
    m.use_nodes=True
    n,l=m.node_tree.nodes,m.node_tree.links
    n.clear();out=n.new("ShaderNodeOutputMaterial");vol=n.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value=.009
    vol.inputs["Color"].default_value=rgb("bdc9df")
    vol.inputs["Anisotropy"].default_value=.32
    l.new(vol.outputs["Volume"],out.inputs["Volume"])
    box("Atmospheric depth volume",(0,70,26),(110,90,55),m,"08 Lighting and atmosphere",0)


def camera(view):
    bpy.ops.object.camera_add(location=(12.3,-23.5,4.6))
    c=bpy.context.object;c.name="Hero camera - single reference composition";move(c,"09 Cameras")
    target=Vector((-.7,15.5,9.2))
    c.rotation_euler=(target-c.location).to_track_quat("-Z","Y").to_euler()
    c.data.lens=34
    c.data.clip_end=350
    c.data.dof.use_dof=True
    c.data.dof.focus_distance=(Vector((0,13,6))-c.location).length
    c.data.dof.aperture_fstop=9
    c.data.lens=34
    bpy.context.scene.camera=c
    if view=="overview":
        c.location=(34,-25,30)
        c.rotation_euler=(Vector((0,20,7))-c.location).to_track_quat("-Z","Y").to_euler()
        c.data.lens=31;c.data.dof.use_dof=False
    # A slow five-second dolly is editable in the saved scene; only one still
    # is rendered by this script, so no generated video is implied.
    c.keyframe_insert(data_path="location",frame=1)
    c.location+=Vector((-.55,.9,.12))
    c.keyframe_insert(data_path="location",frame=120)
    for fc in c.animation_data.action.fcurves:
        for key in fc.keyframe_points:key.interpolation="LINEAR"
    bpy.context.scene.frame_set(1)


def render_setup(options):
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    device="CPU"
    devices=[]
    if options.device!="cpu":
        prefs=bpy.context.preferences.addons["cycles"].preferences
        for backend in ("OPTIX","CUDA"):
            try:
                prefs.compute_device_type=backend
                prefs.get_devices()
                for d in prefs.devices:
                    d.use=d.type==backend
                devices=[d.name for d in prefs.devices if d.use]
                if devices:
                    scene.cycles.device="GPU";device=backend;break
            except Exception as e:
                print("GPU probe:",backend,str(e))
    final=options.quality=="final"
    scene.cycles.samples=128 if final else 24
    scene.cycles.use_denoising=True
    scene.cycles.adaptive_threshold=.025 if final else .08
    scene.cycles.max_bounces=7
    scene.cycles.diffuse_bounces=3
    scene.cycles.glossy_bounces=3
    scene.cycles.transparent_max_bounces=4
    scene.cycles.volume_bounces=1
    scene.render.resolution_x=1600 if final else 960
    scene.render.resolution_y=900 if final else 540
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGB"
    scene.render.film_transparent=False
    scene.render.fps=24
    scene.frame_start=1;scene.frame_end=120
    scene.view_settings.view_transform="AgX"
    scene.view_settings.look="AgX - Medium High Contrast"
    scene.view_settings.exposure=.15
    scene.render.image_settings.color_depth="8"
    scene.render.threads_mode="AUTO"
    bpy.context.preferences.filepaths.save_version=0
    return device,devices


def main():
    options=args();options.output.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats=setup_materials()
    for name,func in (("courtyard",paving),("architecture",architecture),("background",background),("vegetation",vegetation)):
        print("BUILD",name,flush=True);func(mats)
    banner("Main burgundy banner",(1.17,8.41,11.9),.7,4.8,mats)
    banner("Promenade banner",(6.8,18,7.5),.53,2.7,mats)
    traveler(mats);atmosphere(mats);camera(options.view)
    device,devices=render_setup(options)
    stem=("preview" if options.quality=="preview" else "render")+("-overview" if options.view=="overview" else "")
    scene=bpy.context.scene
    scene.render.filepath=str(options.output/(stem+".png"))
    scene["asset_counts_json"]=json.dumps(COUNTS)
    scene["reference_url"]="https://x.com/xikhar/status/2110143242591510835"
    scene["authoring_method"]="Original procedural Blender Python; no external assets or image-to-3D inference."
    # Keep the fog selectable in the outliner without an opaque solid-view cube.
    bpy.data.objects["Atmospheric depth volume"].display_type="WIRE"
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_perspective="CAMERA"
                area.spaces.active.clip_end=400
                area.spaces.active.shading.color_type="MATERIAL"
    if options.view=="hero":
        blend_dir=ROOT/"artifacts";blend_dir.mkdir(exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir/"autumn-courtyard.blend"),compress=True)
    stats={"blender":bpy.app.version_string,"seed":211014,"quality":options.quality,"view":options.view,
           "device":device,"devices":devices,"objects":len(scene.objects),"mesh_objects":sum(o.type=="MESH" for o in scene.objects),
           "mesh_vertices":sum(len(o.data.vertices) for o in scene.objects if o.type=="MESH"),
           "mesh_polygons":sum(len(o.data.polygons) for o in scene.objects if o.type=="MESH"),
           "counts":COUNTS,"resolution":[scene.render.resolution_x,scene.render.resolution_y],
           "samples_max":scene.cycles.samples,"build_seconds":round(time.perf_counter()-STARTED,2),
           "external_assets":[],"reference_rendered_as_background":False}
    print("SCENE_STATS",json.dumps(stats),flush=True)
    t=time.perf_counter();bpy.ops.render.render(write_still=True)
    stats["render_seconds"]=round(time.perf_counter()-t,2)
    stats["total_seconds"]=round(time.perf_counter()-STARTED,2)
    (options.output/(stem+"-stats.json")).write_text(json.dumps(stats,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("DONE",scene.render.filepath,flush=True)


if __name__=="__main__":
    main()
