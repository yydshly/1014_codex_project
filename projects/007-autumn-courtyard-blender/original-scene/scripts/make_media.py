"""Assemble an attributed comparison and a video from actual Blender frames."""
import json
import shutil
import subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"assets"
font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",24)
small=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",18)
concept=Image.open(ASSETS/"concept.png").convert("RGB")
render=Image.open(ASSETS/"render.png").convert("RGB")
comparison=Image.new("RGB",(2448,795),"#f2f1ed");draw=ImageDraw.Draw(comparison)
draw.text((20,15),"01 · 本次自行生成的原创参考图",font=font,fill="#263345")
draw.text((1240,15),"02 · 按参考图编写脚本后的实际 Blender 渲染",font=font,fill="#263345")
comparison.paste(ImageOps.fit(concept,(1200,675)),(16,58))
comparison.paste(ImageOps.fit(render,(1200,675)),(1232,58))
draw.text((20,753),"内置 Image Gen 创作参考图 → 视觉分析 → Blender Python 建模 → Cycles 渲染。参考图没有作为贴图或背景参与三维渲染。",font=small,fill="#5a6473")
comparison.save(ASSETS/"comparison.jpg",quality=93)

def video_frame(image,label):
    frame=ImageOps.fit(image,(960,540)).convert("RGB")
    d=ImageDraw.Draw(frame,"RGBA");d.rectangle((0,0,960,46),fill=(9,17,30,210))
    d.text((16,8),label,font=font,fill=(245,245,245,255))
    return frame

out=ROOT/".cache/video";out.mkdir(parents=True,exist_ok=True)
index=0
reference=video_frame(concept,"01  原创参考图 · 本次由 Image Gen 生成")
for _ in range(24):
    reference.save(out/("frame-%03d.png"%index));index+=1
for frame_path in sorted((ROOT/".cache/orbit").glob("frame-*.png")):
    frame=video_frame(Image.open(frame_path),"02  Blender 实际三维渲染 · 镜头环绕")
    frame.save(out/("frame-%03d.png"%index));index+=1
final=video_frame(render,"03  最终主视角 · 可编辑的三维场景")
for _ in range(12):
    final.save(out/("frame-%03d.png"%index));index+=1
ffmpeg=shutil.which("ffmpeg")
if not ffmpeg:raise RuntimeError("ffmpeg must be available on PATH")
subprocess.run([ffmpeg,"-hide_banner","-loglevel","error","-y","-framerate","12","-i",str(out/"frame-%03d.png"),"-t",str(index/12),"-c:v","libx264","-crf","19","-pix_fmt","yuv420p","-r","24","-movflags","+faststart",str(ASSETS/"demo.mp4")],check=True)
ffprobe=shutil.which("ffprobe") or str(Path(ffmpeg).with_name("ffprobe"+Path(ffmpeg).suffix))
probe=json.loads(subprocess.check_output([ffprobe,"-v","error","-show_entries","format=duration:stream=width,height,nb_frames,r_frame_rate","-of","json",str(ASSETS/"demo.mp4")]))
duration=float(probe["format"]["duration"])
assert abs(duration-index/12)<.06, "Encoded video duration differs from the frame sequence"
(ASSETS/"media-info.json").write_text(json.dumps({"video":"demo.mp4","duration_seconds":duration,"source_frames":index,"resolution":[960,540],"encoded_fps":24,"encoded_frames":int(probe["streams"][0]["nb_frames"]),"duration_verified":True,"motion_is_camera_orbit":True,"water_and_flowers_are_static":True,"comparison":"comparison.jpg"},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("MEDIA",ASSETS/"comparison.jpg",ASSETS/"demo.mp4")
