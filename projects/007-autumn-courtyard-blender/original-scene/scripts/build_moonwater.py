"""Build an editable 3D scene after inspecting our own image-generated concept.

The concept is kept as evidence, never used as an image plane or material.
Blender 4.5 LTS; no third-party add-ons or external meshes/textures required.
"""
import argparse
import hashlib
import json
import math
import random
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from geometry import rgb,collection,move,material,mesh,bevel,box,tube,arch

ROOT=Path(__file__).resolve().parents[1]
R=random.Random(151026)
COUNT={"blossoms":0,"leaves":0,"petals":0,"lanterns":0}
START=time.perf_counter()


def parameters():
    p=argparse.ArgumentParser()
    p.add_argument("--quality",choices=("preview","final"),default="preview")
    p.add_argument("--view",choices=("hero","overview"),default="hero")
    return p.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])


def stone(name,light,dark,wet=False):
    m=material(name,light,.36 if wet else .7)
    n,l=m.node_tree.nodes,m.node_tree.links
    bs=n.get("Principled BSDF")
    coords=n.new("ShaderNodeTexCoord")
    noise=n.new("ShaderNodeTexNoise");noise.inputs["Scale"].default_value=2.6
    noise.inputs["Detail"].default_value=4;noise.inputs["Roughness"].default_value=.7
    l.new(coords.outputs["Object"],noise.inputs["Vector"])
    ramp=n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position=.17;ramp.color_ramp.elements[0].color=rgb(dark)
    ramp.color_ramp.elements[1].position=.74;ramp.color_ramp.elements[1].color=rgb(light)
    l.new(noise.outputs["Fac"],ramp.inputs[0]);l.new(ramp.outputs[0],bs.inputs["Base Color"])
    rough=n.new("ShaderNodeMapRange");rough.inputs["To Min"].default_value=.2 if wet else .52
    rough.inputs["To Max"].default_value=.48 if wet else .85
    l.new(noise.outputs["Fac"],rough.inputs[0]);l.new(rough.outputs[0],bs.inputs["Roughness"])
    fine=n.new("ShaderNodeTexNoise");fine.inputs["Scale"].default_value=65
    fine.inputs["Detail"].default_value=3
    l.new(coords.outputs["Object"],fine.inputs["Vector"])
    bump=n.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.24
    bump.inputs["Distance"].default_value=.035
    l.new(fine.outputs["Fac"],bump.inputs["Height"]);l.new(bump.outputs["Normal"],bs.inputs["Normal"])
    return m


def emission(name,color,power):
    m=material(name,color,.4)
    bs=m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Emission Color"].default_value=rgb(color)
    bs.inputs["Emission Strength"].default_value=power
    return m


def materials():
    d={"stone":stone("Pale ivory limestone","e8dfcb","8c8986"),
       "trim":stone("Warm carved edges","eee5cf","aaa18e"),
       "wet":stone("Wet terrace limestone","d9cfb6","777773",True),
       "joint":material("Paving joints","3b434d"),
       "rock":stone("Lakeside weathered boulders","8e9299","343d4a"),
       "bark":stone("Deep twisted bark","514133","1d222c"),
       "soil":material("Damp soil","242c29"),
       "green":material("Dark wisteria leaf","23483c"),
       "green2":material("Sage wisteria leaf","455d3c"),
       "gold":material("Aged brushed brass","ae7d31",.28),
       "darkbronze":material("Dark bronze lantern frame","403726",.36),
       "light":emission("Amber lantern cores","ffd49a",5),
       "moon":emission("Distant crescent emission","e3e8f5",2.2)}
    for key in ("gold","darkbronze"):
        d[key].node_tree.nodes.get("Principled BSDF").inputs["Metallic"].default_value=.85
    d["flowers"]=[material("Wisteria bloom %d"%i,c,.62) for i,c in enumerate(("9163b8","b894cf","d0b4e1","74538f","ad8bc2"))]
    for m in d["flowers"]:
        bs=m.node_tree.nodes.get("Principled BSDF");bs.inputs["Subsurface Weight"].default_value=.08
    orb=emission("Textured amber armillary orb","ffbd56",.85)
    n,l=orb.node_tree.nodes,orb.node_tree.links
    noise=n.new("ShaderNodeTexNoise");noise.inputs["Scale"].default_value=4.3;noise.inputs["Detail"].default_value=4
    ramp=n.new("ShaderNodeValToRGB");ramp.color_ramp.elements[0].color=rgb("b94d10")
    ramp.color_ramp.elements[1].color=rgb("ffcc72")
    l.new(noise.outputs["Fac"],ramp.inputs[0]);l.new(ramp.outputs[0],n.get("Principled BSDF").inputs["Emission Color"])
    d["orb"]=orb
    water=material("Deep turquoise reflective water","0d4045",.12)
    bs=water.node_tree.nodes.get("Principled BSDF")
    bs.inputs["IOR"].default_value=1.333
    bs.inputs["Transmission Weight"].default_value=.35
    bs.inputs["Coat Weight"].default_value=.35
    n,l=water.node_tree.nodes,water.node_tree.links
    coord=n.new("ShaderNodeTexCoord")
    noise=n.new("ShaderNodeTexNoise");noise.inputs["Scale"].default_value=7;noise.inputs["Detail"].default_value=3
    l.new(coord.outputs["Object"],noise.inputs["Vector"])
    bump=n.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.23;bump.inputs["Distance"].default_value=.055
    l.new(noise.outputs["Fac"],bump.inputs["Height"]);l.new(bump.outputs["Normal"],bs.inputs["Normal"])
    d["water"]=water
    # Stretch noise along the trunk axis to make bark fissures, not stone pores.
    bark=d["bark"];n,l=bark.node_tree.nodes,bark.node_tree.links
    tex=n.new("ShaderNodeTexCoord");stretch=n.new("ShaderNodeVectorMath");stretch.operation="MULTIPLY"
    stretch.inputs[1].default_value=(2.8,2.8,.18);l.new(tex.outputs["Object"],stretch.inputs[0])
    grain=n.new("ShaderNodeTexNoise");grain.inputs["Scale"].default_value=6
    grain.inputs["Detail"].default_value=5;grain.inputs["Roughness"].default_value=.8
    l.new(stretch.outputs[0],grain.inputs["Vector"])
    color=n.new("ShaderNodeValToRGB");color.color_ramp.elements[0].position=.25;color.color_ramp.elements[0].color=rgb("171e22")
    color.color_ramp.elements[1].position=.7;color.color_ramp.elements[1].color=rgb("635246")
    l.new(grain.outputs["Fac"],color.inputs[0]);l.new(color.outputs[0],n.get("Principled BSDF").inputs["Base Color"])
    bump=n.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.62;bump.inputs["Distance"].default_value=.12
    l.new(grain.outputs["Fac"],bump.inputs["Height"]);l.new(bump.outputs[0],n.get("Principled BSDF").inputs["Normal"])
    return d


def cylinder(name,point,radius,depth,mat,group="03 Observatory",vertices=64,edge=.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=point)
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(mat);move(obj,group)
    if edge:bevel(obj,edge,2)
    return obj


def sphere(name,point,radius,mat,group="03 Observatory",scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=radius,location=point)
    obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.data.materials.append(mat);move(obj,group)
    for p in obj.data.polygons:p.use_smooth=True
    return obj


def ring_band(name,center,radius,width,thickness,angles,mat,segments=128,group="03 Observatory"):
    rot=Matrix.Rotation(angles[2],3,"Z")@Matrix.Rotation(angles[1],3,"Y")@Matrix.Rotation(angles[0],3,"X")
    v,f=[],[]
    for i in range(segments):
        a=i*math.tau/segments
        for rr,yy in ((radius-width/2,-thickness/2),(radius+width/2,-thickness/2),(radius+width/2,thickness/2),(radius-width/2,thickness/2)):
            v.append(tuple(Vector(center)+rot@Vector((rr*math.cos(a),yy,rr*math.sin(a)))))
    for i in range(segments):
        for j in range(4):
            f.append((i*4+j,i*4+(j+1)%4,((i+1)%segments)*4+(j+1)%4,((i+1)%segments)*4+j))
    obj=mesh(name,v,f,mat,group)
    # Construction ordering is clockwise around the band section.
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
    bevel(obj,.008,2)
    return obj


def point_light(name,point,energy,color,radius=.3):
    bpy.ops.object.light_add(type="POINT",location=point)
    o=bpy.context.object;o.name=name;move(o,"08 Lighting")
    o.data.energy=energy;o.data.color=color;o.data.shadow_soft_size=radius
    return o


def area_light(name,point,target,energy,color,size):
    bpy.ops.object.light_add(type="AREA",location=point)
    o=bpy.context.object;o.name=name;move(o,"08 Lighting")
    o.data.energy=energy;o.data.color=color;o.data.shape="DISK";o.data.size=size
    o.rotation_euler=(Vector(target)-o.location).to_track_quat("-Z","Y").to_euler()
    return o


def paving_strip(name,x0,x1,y0,y1,z,d):
    vs,fs=[],[]
    row=0;y=y0
    while y<y1-.1:
        h=min(1.18,y1-y)
        x=x0
        while x<x1-.1:
            w=min(1.2,x1-x);a=len(vs)
            xx=x+.018;yy=y+.018;zz=z+R.uniform(-.008,.008)
            pts=[(xx,yy),(xx+w-.035,yy),(xx+w-.035,yy+h-.035),(xx,yy+h-.035)]
            vs += [(px,py,zz-.12) for px,py in pts]+[(px,py,zz) for px,py in pts]
            fs += [tuple(a+k for k in face) for face in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))]
            x+=w
        y+=h;row+=1
    bevel(mesh(name,vs,fs,d["wet"],"01 Pool and terraces"),.012,1)


def pool_and_terraces(d):
    group="01 Pool and terraces"
    box("Courtyard raft",(0,2,-.65),(36,33,.7),d["joint"],group,.02)
    box("Pool floor",(0,1.5,-.42),(21,23,.15),d["rock"],group,.02)
    # Five independently paved areas: no opaque plane under the pool surface.
    for name,x0,x1,y0,y1 in (("Near paving",-17,17,-13,-9.5),("Far paving",-17,17,12.5,17),
                             ("Left bank",-17,-10.5,-9.5,12.5),("Right bank",10.5,17,-9.5,12.5)):
        paving_strip(name,x0,x1,y0,y1,.1,d)
    for x in (-10.5,10.5):
        box("Pool long inner lining",(x,1.5,-.18),(.22,22,.55),d["stone"],group)
        for y in [-9.5+i*1.05 for i in range(22)]:
            box("Long bank coping",(x,y,.12),(.5,1.025,.22),d["trim"],group,.025)
    for y in (-9.5,12.5):
        for x in [-10.5+i*1.05 for i in range(21)]:
            box("End bank coping",(x,y,.12),(1.025,.5,.22),d["trim"],group,.025)
    # Subdivided, gently moving-looking surface with real geometric relief.
    v,f=[],[];nx,ny=135,145
    for j in range(ny+1):
        y=-9.45+j*21.9/ny
        for i in range(nx+1):
            x=-10.25+i*20.5/nx
            z=-.055+.009*math.sin(x*3.5+y*2.8)+.005*math.sin(x*8-y*4.3)
            v.append((x,y,z))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;f.append((a,a+1,a+nx+2,a+nx+1))
    o=mesh("Reflecting pool rippled surface",v,f,d["water"],group)
    for p in o.data.polygons:p.use_smooth=True
    cylinder("Circular island stone drum",(0,1.1,.18),2.85,.52,d["stone"],group,128,.04)
    cylinder("Circular island cap",(0,1.1,.46),2.93,.14,d["wet"],group,128,.035)
    ring_band("Island concentric carved inlay",(0,1.1,.538),2.42,.025,.015,(math.pi/2,0,0),d["gold"],160,group)
    paving_strip("Approach footbridge",-.92,.92,-10.7,-1.45,.47,d)
    box("Footbridge solid support",(0,-6,.24),(1.86,9.7,.4),d["stone"],group,.025)
    # Separate paving surface intentionally sits on top of the bridge support.
    for i in range(3):
        box("Moon gate broad stair",(5.4,11.3+i*.63,.13+i*.15),(10.5-i*.25,1.2,.26+i*.3),d["stone"],group,.035)
    for x in (-9,-4,10):
        box("Rear low balustrade",(x,14.1,.58),(3.8,.5,.98),d["stone"],group,.04)
        box("Rear low wall coping",(x,14.1,1.11),(4,.65,.16),d["trim"],group,.035)


def moon_gate(d):
    group="02 Moon gate and arcade"
    cx,cy,cz=5.4,13.2,4.35
    inner,outer=3.28,4.03
    for k in range(56):
        a=k*math.tau/56+.003;b=(k+1)*math.tau/56-.003
        v=[]
        for y in (cy-.55,cy+.55):
            for r,t in ((inner,a),(inner,b),(outer,b),(outer,a)):
                v.append((cx+r*math.cos(t),y,cz+r*math.sin(t)))
        o=mesh("Moon gate voussoir %02d"%k,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],d["stone"],group)
        bevel(o,.022,2)
    for r,w in ((3.29,.09),(3.96,.08)):
        ring_band("Fine concentric carved gate edge",(cx,cy-.58,cz),r,w,.07,(0,0,0),d["trim"],192,group)
    # Three arches in a diagonal arcade. All components have genuine thickness.
    origin=Vector((11.2,19.7,0));rot=Matrix.Rotation(math.radians(-31),4,"Z")
    before=set(bpy.data.objects)
    for k in range(4):
        x=k*3.55
        for i in range(8):
            box("Arcade pier course",(x,0,.5+i*.83),(.95,1.2,.805),d["stone"],group,.028)
        box("Arcade pier base",(x,0,.22),(1.3,1.5,.44),d["trim"],group,.035)
        box("Arcade spring molding",(x,0,4.37),(1.15,1.4,.23),d["trim"],group,.035)
        if k<3:
            arch("Three opening arcade",x+1.775,0,4.2,1.31,.44,1.18,d["stone"],group,23)
            # Solid strip follows each arch outer contour up to its lintel.
            for j in range(21):
                xx=x+.48+(j+.5)*2.59/21
                lower=4.2+math.sqrt(max(0,1.75**2-(xx-x-1.775)**2))
                upper=6.75
                box("Masonry above curved arcade",(xx,0,(upper+lower)/2),(2.59/21+.015,1.18,upper-lower),d["stone"],group,.008)
    for z,w,h in ((6.73,1.35,.2),(6.95,1.55,.24),(7.13,1.7,.12)):
        box("Continuous arcade cornice",(5.32,0,z),(12.0,w,h),d["trim"],group,.025)
    for o in set(bpy.data.objects)-before:
        o.matrix_world=Matrix.Translation(origin)@rot@o.matrix_world


def observatory(d):
    group="03 Observatory"
    cylinder("Armillary stone mounting",(0,1.1,.6),.8,.18,d["stone"],group)
    cylinder("Brass armillary foot",(0,1.1,.76),.64,.15,d["gold"],group)
    cylinder("Brass turned stem",(0,1.1,1.12),.13,.65,d["gold"],group,32)
    cylinder("Brass stem collar",(0,1.1,1.35),.26,.13,d["gold"],group,40)
    center=(0,1.1,2.65)
    rings=((1.22,.11,.055,(.1,.2,-.28)),(1.19,.10,.055,(1.03,-.22,.5)),(1.23,.12,.06,(-.6,.35,.18)))
    for i,(radius,width,thick,angles) in enumerate(rings):
        ring_band("Armillary structural band %d"%i,center,radius,width,thick,angles,d["gold"])
    ring_band("Armillary broad ecliptic band",center,1.27,.18,.04,(.9,.0,-.3),d["gold"])
    sphere("Warm amber central orb",center,.52,d["orb"])
    tube("Polar axle",[(0,1.1,1.35),(0,1.1,3.98)],[.035,.035],d["gold"],group,10)
    for z in (1.39,3.93):sphere("Armillary axle finial",(0,1.1,z),.085,d["gold"])
    # Fine graduation studs provide small-scale highlights on the outer band.
    stud_rotation=Matrix.Rotation(-.28,3,"Z")@Matrix.Rotation(.2,3,"Y")@Matrix.Rotation(.1,3,"X")
    for i in range(72):
        a=i*math.tau/72
        p=Vector(center)+stud_rotation@Vector((1.233*math.cos(a),-.042,1.233*math.sin(a)))
        sphere("Brass degree marker",p,.018,d["gold"],scale=(.6,.5,1.4))
    point_light("Orb warm local glow",(0,.4,2.65),50,(1,.5,.13),.6)


def lantern(name,x,y,z,scale,d,plinth=True):
    g="04 Lanterns and warm light"
    if plinth:
        box(name+" limestone plinth",(x,y,z+.42*scale),(.94*scale,.94*scale,.84*scale),d["stone"],g,.035)
        box(name+" plinth cap",(x,y,z+.88*scale),(1.08*scale,1.08*scale,.12*scale),d["wet"],g,.025)
        z+=.95*scale
    cylinder(name+" bronze foot",(x,y,z+.07*scale),.37*scale,.14*scale,d["darkbronze"],g,8)
    for dx in (-.27,.27):
        for dy in (-.27,.27):
            tube(name+" corner frame",[(x+dx*scale,y+dy*scale,z+.12*scale),(x+dx*scale,y+dy*scale,z+.92*scale)],[.026*scale]*2,d["gold"],g,6)
    for side in (-1,1):
        for zz in (.17,.85):
            tube(name+" horizontal bronze rail",[(x-.27*scale,y+side*.27*scale,z+zz*scale),(x+.27*scale,y+side*.27*scale,z+zz*scale)],[.022*scale]*2,d["gold"],g,6)
        for dx in (-.16,.16):
            ring_band(name+" delicate bronze scroll",(x+dx*scale,y+side*.277*scale,z+.25*scale),.08*scale,.014*scale,.012*scale,(0,0,0),d["gold"],32,g)
    sphere(name+" amber core",(x,y,z+.51*scale),.14*scale,d["light"],g,scale=(.85,.85,1.7))
    # Pagoda roof: four upswept edges made from a closed polygonal mesh.
    v=[]
    for zz,r in ((z+.9*scale,.37*scale),(z+1.03*scale,.48*scale),(z+1.22*scale,.11*scale)):
        v += [(x+sx*r,y+sy*r,zz) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]
    f=[(0,3,2,1),(8,9,10,11)]
    for layer in range(2):
        for i in range(4):
            j=(i+1)%4;a=layer*4;f.append((a+i,a+j,a+4+j,a+4+i))
    bevel(mesh(name+" pitched bronze roof",v,f,d["darkbronze"],g),.018*scale,2)
    sphere(name+" roof finial",(x,y,z+1.29*scale),.07*scale,d["gold"],g)
    point_light(name+" warm light",(x,y,z+.52*scale),32*scale*scale,(1,.58,.22),.17*scale)
    COUNT["lanterns"]+=1


class Batch:
    def __init__(self,name,mats,group):
        self.name,self.mats,self.group=name,mats,group
        self.v,self.f,self.mi=[],[],[]

    def ellipsoid(self,center,scale,index):
        c=Vector(center);sx,sy,sz=scale;a=len(self.v)
        self.v += [tuple(c+Vector(v)) for v in ((sx,0,0),(0,sy,0),(-sx,0,0),(0,-sy,0),(0,0,sz),(0,0,-sz))]
        faces=((0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5))
        self.f += [tuple(a+i for i in f) for f in faces];self.mi += [index]*8

    def leaf(self,p,size,angle,index):
        a=len(self.v);c=Vector(p);rot=Matrix.Rotation(angle,3,"Z")
        pts=((0,-.6,0),(-.22,-.2,.04),(-.25,.24,.03),(0,.64,.0),(.25,.24,.03),(.22,-.2,.04),(0,0,.08))
        self.v += [tuple(c+rot@(Vector(t)*size)) for t in pts]
        for k in range(6):self.f.append((a+6,a+(k+1)%6,a+k));self.mi.append(index)

    def finish(self):
        return mesh(self.name,self.v,self.f,self.mats,self.group,self.mi)


def wisteria(d):
    g="05 Wisteria and vegetation"
    main=[(-11,2,.25),(-10.7,2.3,1.7),(-10.4,2.7,3.5),(-10.6,3.3,5),(-9.3,3.7,6.3),(-7.5,4.1,7.6),(-4.6,4.8,8.8),(-1.6,5.8,9.5),(1.1,6.5,10.0)]
    radii=[1.04,.92,.8,.73,.6,.47,.34,.2,.06]
    smooth_points=[];smooth_radii=[]
    for i in range(len(main)-1):
        p0,p1,p2,p3=[Vector(main[max(0,min(len(main)-1,j))]) for j in (i-1,i,i+1,i+2)]
        for j in range(7):
            t=j/7
            q=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
            smooth_points.append(q);smooth_radii.append(radii[i]*(1-t)+radii[i+1]*t)
    smooth_points.append(Vector(main[-1]));smooth_radii.append(radii[-1])
    tube("Wisteria leaning ancient trunk",smooth_points,smooth_radii,d["bark"],g,40,.09)
    for k in range(21):
        a=k*math.tau/21
        points=[tuple(Vector(p)+Vector((math.cos(a+i*.019)*r,math.sin(a+i*.019)*r,0))) for i,(p,r) in enumerate(zip(smooth_points,smooth_radii))]
        tube("Long twisting bark rib",points,[r*.03+.01 for r in smooth_radii],d["bark"],g,7,.08)
    for k in range(8):
        a=k*math.tau/8
        tube("Exposed wisteria root",[(-11+math.cos(a)*.35,2+math.sin(a)*.35,1.7),(-11+math.cos(a)*1.2,2+math.sin(a)*1.2,.4),(-11+math.cos(a)*3,2+math.sin(a)*2.3,.1)],[.38,.25,.02],d["bark"],g,10,.18)
    centers=[]
    for k in range(28):
        start=Vector(main[R.randrange(3,8)])
        tip=Vector((R.uniform(-14,1.6),R.uniform(2.8,11.0),R.uniform(8.2,12.2)))
        mid=start.lerp(tip,.52)+Vector((0,0,.45))
        tube("Wisteria spreading limb",[start,mid,tip],[R.uniform(.12,.27),.09,.012],d["bark"],g,9,.12)
        centers.append(tip)
    leaves=Batch("Wisteria fine green foliage",[d["green"],d["green2"]],g)
    for cc in centers:
        for _ in range(470):
            q=Vector((R.uniform(-1.7,1.7),R.uniform(-1.5,1.5),R.uniform(-.5,.8)))
            leaves.leaf(cc+q,R.uniform(.12,.24),R.random()*math.tau,R.randrange(2));COUNT["leaves"]+=1
    leaves.finish()
    blooms=Batch("Pendant lavender racemes",d["flowers"],g)
    for k in range(340):
        cc=R.choice(centers)+Vector((R.uniform(-1.4,1.4),R.uniform(-1.3,1.3),R.uniform(-.55,.1)))
        length=R.uniform(.6,2.5)
        end=cc+Vector((.12*math.sin(k),.08,-length))
        tube("Wisteria hanging blossom stem",[cc,end],[.009,.003],d["green"],g,4)
        for j in range(50):
            t=(j+.5)/50;a=j*2.399
            r=.19*(1-t)**.55
            point=cc+Vector((r*math.cos(a)+.12*t*math.sin(k),r*math.sin(a),-length*t))
            size=R.uniform(.042,.075)*(1-t*.4)
            blooms.ellipsoid(point,(size,size*.64,size*1.1),R.choices(range(5),(3,4,2,2,3))[0]);COUNT["blossoms"]+=1
    blooms.finish()
    # Climbing vines around the gate and arcade stay secondary to the big tree.
    vines=Batch("Gate and arcade climbing flowers",d["flowers"],g)
    greens=Batch("Gate vine leaves",[d["green"],d["green2"]],g)
    for k in range(26):
        x=9.15+R.uniform(-.4,.4) if k<15 else R.uniform(15,19)
        y=12.55 if k<15 else R.uniform(10,15)
        z=R.uniform(.3,2)
        points=[(x+math.sin(i*.4+k)*.25,y+math.cos(i*.5)*.07,z+i*.22) for i in range(R.randrange(14,30))]
        tube("Climbing vine stem",points,[.012]*len(points),d["bark"],g,4)
        for p in points:
            for _ in range(3):
                q=Vector(p)+Vector((R.uniform(-.2,.2),-.04,R.uniform(-.08,.08)))
                greens.leaf(q,.18,R.random()*math.tau,R.randrange(2))
                if R.random()<.4:vines.ellipsoid(q,(.07,.05,.09),R.randrange(5))
    vines.finish();greens.finish()
    for i,(x,y,z,sc) in enumerate(((-12,2,.4,2.3),(-14,4,.5,1.8),(-10,5,.3,1.4),(8.3,14,.6,1.1))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=1,location=(x,y,z))
        o=bpy.context.object;o.name="Weathered wisteria bank boulder"
        for v in o.data.vertices:v.co*=R.uniform(.86,1.15)
        o.scale=(sc,sc*.75,sc*.85);o.data.materials.append(d["rock"]);move(o,g)
    petals=Batch("Scattered lavender petals on water and paving",d["flowers"],g)
    for _ in range(2200):
        x,y=R.uniform(-16,16),R.uniform(-12,15)
        water=(-10<x<10 and -9.2<y<12.1)
        if water and abs(x)<.96 and y<-.8:z=.5
        elif water and x*x+(y-1.1)**2<2.9**2:z=.55
        else:z=-.025 if water else .12
        if water and R.random()<.45:continue
        petals.leaf((x,y,z),R.uniform(.05,.11),R.random()*math.tau,R.randrange(5));COUNT["petals"]+=1
    petals.finish()


def cypress(name,x,y,height,d):
    g="06 Distant landscape"
    tube(name+" trunk",[(x,y,0),(x,y,height)],[.12,.025],d["bark"],g,7)
    for k in range(7):
        t=k/7;r=height*.11*(1-t*.7)
        sphere(name+" dark crown",(x+math.sin(k)*r*.15,y,height*(.28+.62*t)),1,d["green"],g,(r,r*.78,height*.24*(1-t*.3)))


def landscape(d):
    g="06 Distant landscape"
    for layer in range(5):
        y=56+layer*19;v,f=[],[]
        base=R.uniform(1.5,3)
        heights=[]
        for i in range(81):
            x=-125+i*3.2
            h=base+abs(3*math.sin(x*.083+layer*2))+abs(2*math.sin(x*.17+.6))+R.uniform(-.5,.5)
            heights.append(h)
        for i,h in enumerate(heights):
            x=-125+i*3.2
            v += [(x,y,0),(x,y,h),(x,y+7,h*.85),(x,y+7,0)]
        for i in range(80):
            for k in range(4):f.append((i*4+k,i*4+(k+1)%4,(i+1)*4+(k+1)%4,(i+1)*4+k))
        f += [(3,2,1,0),tuple(80*4+k for k in range(4))]
        color=("40556e","4b637d","5a728c","677f99","7991aa")[layer]
        m=material("Atmospheric mountain layer %d"%layer,color)
        bs=m.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Emission Color"].default_value=rgb(color);bs.inputs["Emission Strength"].default_value=.35
        mesh("Sculpted distant ridge %d"%layer,v,[tuple(reversed(face)) for face in f],m,g)
    mesh("Distant lake",[(-150,18,-.48),(150,18,-.48),(150,180,-.48),(-150,180,-.48)],[(0,1,2,3)],d["water"],g)
    for i,(x,y,h) in enumerate(((-16,24,6),(-9,32,5),(-20,39,8),(14,30,9),(17,36,10),(22,31,9),(24,49,8),(30,57,8))):
        cypress("Lakeside cypress %d"%i,x,y,h,d)
    # A real crescent outline mesh at a distance, with no sky photograph.
    cx,cy,cz=28,86,19
    r=1.2;offset=-.23;v=[]
    outer=math.acos(offset/(2*r));inner=math.acos(-offset/(2*r))
    for i in range(51):
        a=-outer+i*2*outer/50
        v.append((cx+r*math.cos(a),cy,cz+r*math.sin(a)))
    for i in range(51):
        a=inner-i*2*inner/50
        v.append((cx+offset+r*math.cos(a),cy,cz+r*math.sin(a)))
    mesh("Thin distant crescent moon",v,[tuple(range(len(v)))],d["moon"],g)


def world_and_lights(d):
    world=bpy.data.worlds.new("Procedural blue dusk sky");world.use_nodes=True
    n,l=world.node_tree.nodes,world.node_tree.links
    bg=n.get("Background");bg.inputs[1].default_value=.45
    tc=n.new("ShaderNodeTexCoord");sep=n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Normal"],sep.inputs[0])
    remap=n.new("ShaderNodeMapRange");remap.inputs["From Min"].default_value=-.12;remap.inputs["From Max"].default_value=.85
    l.new(sep.outputs["Z"],remap.inputs[0])
    ramp=n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color=rgb("7190ae");ramp.color_ramp.elements[1].color=rgb("172b52")
    l.new(remap.outputs[0],ramp.inputs[0]);l.new(ramp.outputs[0],bg.inputs[0])
    bpy.context.scene.world=world
    area_light("Broad cool dusk key",(-6,-5,15),(0,5,0),1800,(.55,.7,1),15)
    area_light("Warm pool-side bounce",(0,-8,6),(0,3,2),220,(1,.73,.43),8)
    area_light("Moon gate warm grazing light",(5,10.6,.7),(5.4,13,4.2),380,(1,.59,.23),4)
    area_light("Tree amber grazing light",(-7,-1,1.5),(-10,4,5),650,(1,.64,.29),3)
    area_light("Arcade warm grazing light",(13,10,.8),(13,15,4),350,(1,.62,.3),4)
    haze=bpy.data.materials.new("Only distant valley haze");haze.use_nodes=True
    nn,ll=haze.node_tree.nodes,haze.node_tree.links
    nn.clear();out=nn.new("ShaderNodeOutputMaterial");vol=nn.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value=.008;vol.inputs["Color"].default_value=rgb("90a3c0")
    vol.inputs["Anisotropy"].default_value=.2;ll.new(vol.outputs[0],out.inputs["Volume"])
    o=box("Distant valley atmosphere",(0,105,25),(300,170,60),haze,"08 Lighting",0);o.display_type="WIRE"


def setup_camera(view):
    bpy.ops.object.camera_add(location=(.3,-22,4.7))
    c=bpy.context.object;c.name="Moonwater hero camera";move(c,"09 Cameras")
    target=Vector((.8,8.2,1.5))
    c.rotation_euler=(target-c.location).to_track_quat("-Z","Y").to_euler()
    c.data.lens=34;c.data.clip_end=500;c.data.dof.use_dof=False
    if view=="overview":
        c.location=(26,-24,22);c.data.lens=34
        c.rotation_euler=(Vector((0,6,2))-c.location).to_track_quat("-Z","Y").to_euler()
    bpy.context.scene.camera=c


def configure(quality):
    s=bpy.context.scene;s.render.engine="CYCLES"
    backend="CPU";names=[]
    prefs=bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX","CUDA"):
        try:
            prefs.compute_device_type=kind;prefs.get_devices()
            for d in prefs.devices:d.use=d.type==kind
            names=[d.name for d in prefs.devices if d.use]
            if names:s.cycles.device="GPU";backend=kind;break
        except Exception:pass
    final=quality=="final"
    s.cycles.samples=160 if final else 32;s.cycles.use_denoising=True
    s.cycles.adaptive_threshold=.025 if final else .08
    s.cycles.max_bounces=9;s.cycles.diffuse_bounces=3;s.cycles.glossy_bounces=5;s.cycles.transmission_bounces=5
    s.cycles.volume_bounces=1
    s.render.resolution_x=1672 if final else 1008;s.render.resolution_y=940 if final else 567
    s.render.resolution_percentage=100;s.render.image_settings.file_format="PNG";s.render.image_settings.color_mode="RGB"
    s.render.film_transparent=False;s.render.fps=24
    s.view_settings.view_transform="AgX";s.view_settings.look="AgX - Medium High Contrast";s.view_settings.exposure=.55
    s.render.image_settings.color_depth="8"
    bpy.context.preferences.filepaths.save_version=0
    return backend,names


def main():
    a=parameters();bpy.ops.wm.read_factory_settings(use_empty=True)
    d=materials()
    for label,fn in (("Pool and paving",pool_and_terraces),("Moon gate",moon_gate),("Brass observatory",observatory),("Wisteria",wisteria),("Landscape",landscape)):
        print("BUILD",label,flush=True);fn(d)
    for i,(x,y,z,sc) in enumerate(((-5.5,-9.9,.1,1.2),(5.5,-9.9,.1,1.2),(-10,6,.1,.62),(10,8,.1,.62),(-12,2,.1,.7),(13,13,.1,.65))):
        lantern("Courtyard lantern %d"%i,x,y,z,sc,d)
    world_and_lights(d);setup_camera(a.view);device,names=configure(a.quality)
    s=bpy.context.scene;s["creation_method"]="Our own image-gen concept -> visual interpretation -> original Blender Python geometry"
    s["generated_reference_sha256"]=hashlib.sha256((ROOT/"assets/concept.png").read_bytes()).hexdigest()
    s["asset_counts_json"]=json.dumps(COUNT)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_perspective="CAMERA";area.spaces.active.clip_end=500
                area.spaces.active.shading.color_type="MATERIAL"
    stem=("render" if a.quality=="final" else "preview")+("-overview" if a.view=="overview" else "")
    s.render.filepath=str(ROOT/"assets"/(stem+".png"))
    if a.view=="hero":
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"artifacts/moonwater.blend"),compress=True)
    stats={"blender":bpy.app.version_string,"seed":151026,"device":device,"devices":names,"quality":a.quality,"view":a.view,
           "resolution":[s.render.resolution_x,s.render.resolution_y],"samples_max":s.cycles.samples,
           "objects":len(s.objects),"mesh_vertices":sum(len(o.data.vertices) for o in s.objects if o.type=="MESH"),
           "mesh_polygons":sum(len(o.data.polygons) for o in s.objects if o.type=="MESH"),"counts":COUNT,
           "concept_sha256":s["generated_reference_sha256"],"external_image_dependencies":[i.filepath for i in bpy.data.images if i.source=="FILE"],
           "reference_used_as_scene_image":False,"build_seconds":round(time.perf_counter()-START,2)}
    t=time.perf_counter();bpy.ops.render.render(write_still=True)
    stats["render_seconds"]=round(time.perf_counter()-t,2);stats["total_seconds"]=round(time.perf_counter()-START,2)
    (ROOT/"assets"/(stem+"-stats.json")).write_text(json.dumps(stats,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RESULT",json.dumps(stats),flush=True)


if __name__=="__main__":main()
