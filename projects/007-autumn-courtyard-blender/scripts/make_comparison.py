"""Make a local, attributed comparison sheet from a supplied reference image.

The author reference is intentionally not bundled with the research repository.
Pass a path outside this repository as --output when using the original media.
Requires Pillow; the Blender generation scripts do not require it.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--reference",type=Path,required=True)
parser.add_argument("--render",type=Path,default=root/"assets"/"render.png")
parser.add_argument("--output",type=Path,required=True)
a=parser.parse_args()
width,height=1200,675
canvas=Image.new("RGB",(width*2+48,height+143),"#f5f2ed")
draw=ImageDraw.Draw(canvas)
fontfile="C:/Windows/Fonts/msyh.ttc"
font=ImageFont.truetype(fontfile,25)
small=ImageFont.truetype(fontfile,19)
draw.text((20,15),"原帖参考 · Shikhar / @xikhar",fill="#352a25",font=font)
draw.text((width+44,15),"本次实验 · 原创 Blender 脚本渲染",fill="#352a25",font=font)
for image_path,x in ((a.reference,16),(a.render,width+32)):
    image=ImageOps.contain(Image.open(image_path).convert("RGB"),(width,height))
    canvas.paste(image,(x,62))
draw.text((20,height+82),"参考来源：x.com/xikhar/status/2110143242591510835 · 原媒体权利归原作者，许可证待确认",fill="#6a5c55",font=small)
draw.text((20,height+113),"右图为实际 Cycles 渲染；几何、树叶、材质、光照均由脚本生成，未把参考图投射到场景。",fill="#6a5c55",font=small)
a.output.parent.mkdir(parents=True,exist_ok=True)
canvas.save(a.output)
print(a.output)
