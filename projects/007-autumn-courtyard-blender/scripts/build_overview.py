"""Compose an editable Chinese research infographic with unchanged evidence images.

This is a code-native diagram, not a generated scene or a retouched screenshot.
Pillow measures text only. The SVG embeds each original image's exact bytes.
"""
import base64
import hashlib
import json
from html import escape
from pathlib import Path

from PIL import ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web/assets"
OUT.mkdir(parents=True, exist_ok=True)
W, M, GAP = 3000, 100, 32
INNER = W - 2 * M
FONT = Path("C:/Windows/Fonts/msyh.ttc")
BOLD = Path("C:/Windows/Fonts/msyhbd.ttc")
COL = {"paper":"#f4f3ee", "ink":"#20313d", "body":"#4a5d65", "muted":"#718074",
       "sage":"#5b7351", "sagebg":"#e5ecdd", "line":"#cbd4c5", "white":"#fcfcf8",
       "navy":"#142637", "light":"#eaf0e6", "warm":"#f0eadc", "gold":"#8b744c"}
parts = []
texts = []
images = []
fonts = {}


def font(size, bold=False):
    key = (size, bold)
    if key not in fonts:
        fonts[key] = ImageFont.truetype(str(BOLD if bold else FONT), size)
    return fonts[key]


def wrapped(content, width, size, bold=False):
    lines = []
    for paragraph in content.split("\n"):
        line = ""
        for char in paragraph:
            if line and font(size, bold).getlength(line + char) > width:
                lines.append(line.rstrip())
                line = char
            else:
                line += char
        lines.append(line.rstrip())
    return lines


def rect(x, y, width, height, fill, stroke=None, radius=0):
    stroke_attr = f' stroke="{stroke}" stroke-width="2"' if stroke else ""
    parts.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" fill="{fill}"{stroke_attr}/>')


def line(x1, y1, x2, y2, color=None, width=2):
    parts.append(f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="{color or COL["line"]}" stroke-width="{width}"/>')


def text(x, y, content, size=32, width=INNER, color=None, bold=False, leading=1.55):
    lines = wrapped(content, width, size, bold)
    lh = size * leading
    texts.append(content)
    for index, item in enumerate(lines):
        parts.append(f'<text x="{x}" y="{y + size + index * lh:.2f}" font-family="Microsoft YaHei" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color or COL["body"]}">{escape(item)}</text>')
    return y + lh * len(lines)


def heading(y, number, title, note=""):
    line(M, y, W-M, y)
    rect(M, y+25, 66, 58, COL["sage"])
    text(M+12, y+28, number, size=29, width=60, color="#ffffff", bold=True)
    text(M+92, y+23, title, size=44, width=INNER-92, color=COL["ink"], bold=True, leading=1.3)
    bottom = y+105
    if note:
        bottom = text(M, bottom-2, note, size=28, color=COL["muted"], width=INNER)+22
    return bottom


def cards(y, entries, columns=3, fills=None, title_size=38, body_size=31, min_height=0):
    width = (INNER-GAP*(columns-1))/columns
    bottom = y
    for row_start in range(0, len(entries), columns):
        row = entries[row_start:row_start+columns]
        heights=[]
        for title, body, tag in row:
            title_h=len(wrapped(title,width-68,title_size,True))*title_size*1.45
            body_h=len(wrapped(body,width-68,body_size))*body_size*1.58
            tag_h=len(wrapped(tag,width-68,25))*25*1.5 if tag else 0
            heights.append(max(min_height, 32+title_h+20+body_h+(20+tag_h if tag else 0)+30))
        height = max(heights)
        for j, (title, body, tag) in enumerate(row):
            index=row_start+j
            x=M+j*(width+GAP)
            fill=fills[index] if fills else COL["white"]
            rect(x,bottom,width,height,fill,COL["line"])
            yy=text(x+34,bottom+29,title,size=title_size,width=width-68,color=COL["sage"],bold=True,leading=1.45)+20
            yy=text(x+34,yy,body,size=body_size,width=width-68,leading=1.58)
            if tag:
                text(x+34,yy+20,tag,size=25,width=width-68,color=COL["muted"],leading=1.5)
        bottom+=height+GAP
    return bottom-GAP


def evidence_image(path, x, y, width, height):
    raw=path.read_bytes()
    mime="image/png" if path.suffix==".png" else "image/jpeg"
    data=base64.b64encode(raw).decode()
    parts.append(f'<image x="{x}" y="{y}" width="{width}" height="{height}" preserveAspectRatio="xMidYMid meet" href="data:{mime};base64,{data}"/>')
    images.append({"source":str(path.relative_to(ROOT)).replace("\\","/"),"sha256":hashlib.sha256(raw).hexdigest(),"modified":False})


# Header and central thesis.
text(M,60,"007 / ATLAS RESEARCH",size=30,color=COL["sage"],bold=True)
text(1990,60,"中文研究总览 · 2026.10.16",size=28,width=910,color=COL["muted"])
text(M,130,"Atlas：把模型能力变成可交付资产",size=105,width=INNER,color=COL["ink"],bold=True,leading=1.25)
y=text(M,285,"能力 · 原理 · 实际效果 · 价值与意义 · 应用 · 局限 · 可扩展方向",size=37,color=COL["body"])+45
rect(M,y,INNER,190,COL["sagebg"])
text(M+40,y+28,"技术核心：模型理解视觉目标、编写代码并调用工具。",size=43,width=INNER-80,color=COL["sage"],bold=True)
text(M+40,y+105,"库的作用：把需求规格、生成路径、清理验证与引擎接入组织成可重复的流程。",size=35,width=INNER-80,color=COL["body"])
y+=240

# 1. Full library scope, distinct from what we tested.
y=heading(y,"01","这个库能做什么？","上游固定版本公开说明的能力版图；以下不是本实验的逐项实测结果。")
y=cards(y,[
    ("2D 视觉资产", "场景背景、全景与视差层\n透明精灵、逐帧动画与动画表\n地形瓦片、过渡与自动拼接\n界面套件、图标与状态\n角色多图一致性与外观变体", "background2d / sprite / animation2d\ntileset / ui-icon / character-consistency"),
    ("3D 模型与材质", "角色、道具、环境件与模块资产\nPBR 材质与贴图流程\n可选三维生成器、DCC 脚本或程序几何\n关注尺寸、轴向、轴心、拓扑与 UV\n目标交付包含可接入引擎的 GLB", "model3d-gen / pbr-texture-gen\n质量要求是规范目标，需要实际验收"),
    ("引擎接入与交付纪律", "通用规格、验证、反馈与缺陷报告\nThree.js 加载、布光、阴影与压缩\n自定义材质、着色与截图验收\n图像接口与抠像处理可作为回退\n按任务选择可用模型与工具", "asset-core / threejs-pipeline / shaders\n图像后端适配与 greenscreen 回退"),
], min_height=470)
y=text(M,y+22,"定位：本次核对的是可移植的代理技能说明与辅助工具，不将其等同于自有三维生成模型。",size=29,color=COL["muted"])+55

# 2. Shared workflow plus interchangeable generation routes.
y=heading(y,"02","原理：把生成能力组织成可检查的工作流")
steps=[("需求规格","主题 / 尺寸 / 风格\n目标设备与预算"),("选择路线","模型 / 工具 / 脚本\n按资产类型选择"),("生成与构建","建立几何与材质\n得到可保存的资产"),("清理与验证","尺度 / 轴心 / 表面\n检查后定向修改"),("引擎接入","压缩 / 布光 / 展示\n在实际场景中验收")]
stepw=(INNER-4*46)/5
for i,(title,body) in enumerate(steps):
    x=M+i*(stepw+46)
    rect(x,y,stepw,185,COL["navy"])
    text(x+26,y+22,title,size=36,width=stepw-52,color=COL["light"],bold=True)
    text(x+26,y+85,body,size=28,width=stepw-52,color="#becacb",leading=1.55)
    if i<4:
        parts.append(f'<path d="M{x+stepw+8} {y+93} h28 m-10 -10 l10 10 -10 10" stroke="{COL["sage"]}" stroke-width="4" fill="none"/>')
y=text(M,y+207,"反馈循环：发现失败 → 定位问题 → 修改方案或代码 → 再次检查。技能规范不能替代模型能力和实际执行。",size=30,color=COL["sage"])+28
y=cards(y,[
    ("路径 A｜专用三维生成器","文字或图片输入 → 三维输出\n之后仍需清理、检查与接入。","本次月门水庭未调用"),
    ("路径 B｜Blender / DCC 脚本","模型看图 → 编写 Python → 执行\n适合表达结构、尺寸和可修改规则。","本次独立验证的主要路线"),
    ("路径 C｜程序几何","参数与规则 → 批量构建网格\n可用于形体、植被、地形和模块。","本次在 Blender 脚本内使用；未单独对照"),
],fills=[COL["white"],COL["sagebg"],COL["white"]],title_size=35,body_size=30)
y+=55

# 3. Unaltered experimental evidence and precise numerical scope.
y=heading(y,"03","我们的实证｜月门水庭","本次独立制作；未安装并完整执行 Atlas 技能包，也不等于取得或复现原视频工程。")
image_entries=[("原创参考图",ROOT/"original-scene/assets/concept.png","先生成新的视觉目标，未输入作者图片。"),("Blender 实际渲染",ROOT/"original-scene/assets/render.png","模型编写建模脚本，Cycles 计算最终画面。"),("网页真实 3D 实拍",ROOT/"web/screenshots/interactive-hero.jpg","从同一工程导出几何，浏览器中自由查看。")]
imagew=(INNER-GAP*2)/3
for i,(title,path,caption) in enumerate(image_entries):
    x=M+i*(imagew+GAP)
    rect(x,y,imagew,660,COL["white"],COL["line"])
    text(x+28,y+18,title,size=36,width=imagew-56,color=COL["sage"],bold=True)
    rect(x+18,y+88,imagew-36,480,COL["navy"])
    evidence_image(path,x+18,y+88,imagew-36,480)
    text(x+28,y+586,caption,size=29,width=imagew-56,leading=1.5)
y+=691
y=text(M,y,"原创图 → 视觉理解与代码 → Blender 场景 → 导出 GLB → 网页交互",size=40,color=COL["ink"],bold=True)+12
y=text(M,y,"未调用专用图生 3D；未做多视图重建；参考图未作为三维贴图、相机背景或投影参与成像。",size=29,color=COL["muted"])+25
metrics=[("1,052","原工程物体","含灯光与相机"),("1,038","导出实体网格","省略 1 个雾容器"),("31","合并节点","按集合与材质合并"),("499,936","导出三角形","含实际倒角"),("3.62 MB","网页 GLB","压缩下载体积"),("24","离线环绕源帧","另有网页自由相机"),("0","GLB 图像","未嵌入参考图")]
mw=(INNER-6*22)/7
for i,(value,label,note) in enumerate(metrics):
    x=M+i*(mw+22)
    rect(x,y,mw,170,COL["sagebg"])
    text(x+20,y+15,value,size=42,width=mw-40,color=COL["sage"],bold=True)
    text(x+20,y+82,label,size=27,width=mw-40,color=COL["body"])
    text(x+20,y+127,note,size=21,width=mw-40,color=COL["muted"])
y=text(M,y+192,"工程可保存重开；网页支持旋转、缩放、平移、机位、线框和全屏。统计口径不同；未做几何减面，也未证明低端设备帧率。",size=28,color=COL["muted"])+55

# 4. Distinguish demonstrated capability, engineering method, and business value.
y=heading(y,"04","价值与意义：能力、流程、产品，分别判断")
y=cards(y,[
    ("能力层｜本次已验证","模型把视觉意图转成可执行代码。\n得到可编辑、可换机位、可再渲染、可导出的三维结构。","技术核心：模型理解、编程和使用工具"),
    ("流程层｜有工程意义","明确规格、选工具、检查输出、修正失败，再接入实际环境。\n目标是让能力更容易重复和交付。","未做带 / 不带 Atlas 的增益对照"),
    ("产品层｜仍需验证","能否更快、更省，或改善用户体验，要在同一任务与质量标准下比较。\n一次成功场景不能证明商业收益。","完整时间、成本、失败率与用户收益待测"),
],fills=[COL["sagebg"],COL["white"],COL["warm"]],title_size=35,body_size=31)
y+=24
rect(M,y,INNER,124,COL["navy"])
text(M+34,y+25,"当需求包含新机位、结构变化或交互，三维更值得投入；只需一张静态成图时，直接图像生成可能流程更短。",size=34,width=INNER-68,color=COL["light"],leading=1.55)
y+=174

# 5. Beyond games, task-specific benefit and required follow-through.
y=heading(y,"05","应用意义｜游戏是一种用途，三维也可以承载其他任务","以下为可探索方向，本次没有完成这些完整产品；当前交付主要是场景制作与相机查看。")
y=cards(y,[
    ("镜头预演与内容制作","复用场景比较机位、光照和镜头路径。\n还需镜头验收与稳定的输出流程。",""),
    ("空间与展陈原型","比较布局、动线与观察角度。\n还需真实尺度、约束与场所核对。",""),
    ("产品与方案展示","转动物体、观察部件与配置。\n还需准确数据、材质与配置规则。",""),
    ("虚拟展览与教学","让空间组织内容，解释组成与遮挡。\n还需标注、导览、交互与效果验证。",""),
    ("工作空间与任务界面","把物体和位置关联到资料、任务与状态。\n还需业务数据、反馈和效率证明。",""),
    ("游戏关卡与互动原型","试验氛围、空间路线与模块资产。\n还需碰撞、导航、动画和引擎验收。",""),
],title_size=34,body_size=30)
y+=55

# 6. Concrete limits and checks.
y=heading(y,"06","能力边界｜哪些已经看到，哪些仍未证明")
y=cards(y,[
    ("已有证据","工程保存后可重开，并从其他机位渲染。\n有主视角、侧视与真实三维相机环绕。\n网页可实际旋转、缩放、平移与看线框。\n导出前后原工程哈希一致。\n记录了 GLB 来源、数量、依赖与下载哈希。","这些证明流程可执行、资产可查看。"),
    ("现有限制与未知","原视频完整制作链路与工程未取得。\n本次为单图近似构建，尺寸与背面有估计。\n自然树形、雕刻、材质等仍较简化。\n无流体、风场、角色绑定、碰撞与导航。\n无完整成本优势、相似度或低端帧率证明。","不据此声称准确重建、工程精度或量产可用。"),
],columns=2,fills=[COL["sagebg"],COL["warm"]],title_size=38,body_size=31)
y+=24
rect(M,y,INNER,145,COL["white"],COL["line"])
text(M+34,y+23,"单图通常不能唯一确定背面结构；模型生成的多角度图片也可能互相矛盾。真实多视图、尺度与相机关系可以增加约束，但仍需要覆盖度与质量检查。本次未测试多视图重建。",size=31,width=INNER-68,leading=1.6)
y+=195

# 7. Expansion with measurable questions.
y=heading(y,"07","可扩展方向｜用新的证据，验证新的价值")
y=cards(y,[
    ("可控编辑与参数化","明确场景参数、约束和撤销机制。\n验证：改门、移动树、改桥时，目标实现且其他结构不被破坏。",""),
    ("生成路径与模型适配","替换生成器，探索一致的多视图输入。\n验证：在相同输入、预算与质量标准下比较结果与失败率。",""),
    ("资产质量与实时工程","进一步处理 UV、材质烘焙、LOD、实例化、绑定和动画。\n验证：压缩或优化后外观与运行语义保持一致。",""),
    ("目标设备与性能预算","测加载时间、帧时间、内存、阴影与反射成本。\n验证：在代表性机位和真实目标设备上稳定运行。",""),
    ("有目的的功能接入","加入点击说明、状态、资料或业务任务。\n验证：三维能否帮助理解、选择或完成操作。",""),
    ("流程评测与可重复性","保存输入、版本、失败案例和完整成本。\n验证：成功率、修改次数、效率与用户收益。",""),
],columns=2,title_size=35,body_size=30)
y+=50

# Conclusion, precise provenance, and source registration.
line(M,y,W-M,y,COL["sage"],4)
y=text(M,y+30,"模型能力提供可能性；工作流形成交付；具体任务决定价值。",size=48,color=COL["ink"],bold=True)+24
y=text(M,y,"来源：github.com/xikhar/atlas · 固定版本 b283a80dcb6db9068ba368fedfca783f5164ba06 · MIT",size=26,color=COL["muted"])+8
y=text(M,y,"核对：README / asset-core / model3d-gen / threejs-pipeline；实验与资产记录：本仓库 007 · 月门水庭。",size=26,color=COL["muted"])+8
y=text(M,y,"原帖为研究起点，完整制作链路仍待确认。实验完成于 2026-10-15；本图汇总于 2026-10-16。效果图嵌入原始字节，未作生成式改绘。",size=25,color=COL["muted"])+60
H=int(y)
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
<title id="title">Atlas 能力、原理、价值与月门水庭实证总览</title>
<desc id="desc">七部分中文信息图，包含库的能力版图、工作流、三张原始效果图、实证统计、价值判断、应用、边界与扩展方向。</desc>
<rect width="{W}" height="{H}" fill="{COL['paper']}"/>
{''.join(parts)}
</svg>'''
(OUT/"atlas-overview.svg").write_text(svg,encoding="utf-8",newline="\n")
(OUT/"atlas-overview-provenance.json").write_text(json.dumps({
    "date":"2026-10-16", "type":"code-native infographic", "size":[W,H],
    "image_generation_used_for_summary":False, "evidence_images":images,
    "sources":[
        "https://github.com/xikhar/atlas/tree/b283a80dcb6db9068ba368fedfca783f5164ba06",
        "original-scene/assets/render-stats.json", "original-scene/assets/scene-checks.json",
        "original-scene/assets/web-export.json", "web/research.html"
    ],"svg":"web/assets/atlas-overview.svg", "png":"web/assets/atlas-overview.png",
    "text_content":texts
},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"svg":str(OUT/"atlas-overview.svg"),"size":[W,H],"text_blocks":len(texts),"unchanged_evidence_images":len(images)},ensure_ascii=False))
