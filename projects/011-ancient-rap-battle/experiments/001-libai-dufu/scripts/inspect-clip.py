"""只读原片/参考音频：抽帧及固定阈值活动区间，非ASR/非口型评分。"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
ID=sys.argv[1]
if ID not in ("A01","A02","B01","B02"):raise ValueError("镜头ID无效")
WORK=ROOT/"work";VIDEO=ROOT/"clips"/f"{ID}_t1.mp4";AUDIO=WORK/"audio"/f"{ID}.mp3"
folder=WORK/f"review-{ID}";folder.mkdir(parents=True,exist_ok=True)
FFMPEG=os.environ.get("FFMPEG_PATH","ffmpeg");FFPROBE=os.environ.get("FFPROBE_PATH","ffprobe")
def hash(p):return hashlib.sha256(p.read_bytes()).hexdigest()
probe=json.loads(subprocess.check_output([FFPROBE,"-v","error","-show_format","-show_streams","-of","json",str(VIDEO)],text=True,encoding="utf-8"))
video=next(s for s in probe["streams"] if s["codec_type"]=="video")
audio=next(s for s in probe["streams"] if s["codec_type"]=="audio")
w,h=480,275;sheet=Image.new("RGB",(w*5,(h+34)*2),(12,16,23));d=ImageDraw.Draw(sheet);font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",20)
for i in range(10):
 t=i*.5;path=folder/f"frame-{i:02d}.jpg"
 subprocess.run([FFMPEG,"-hide_banner","-loglevel","error","-y","-ss",str(t),"-i",str(VIDEO),"-frames:v","1","-q:v","2",str(path)],check=True)
 im=Image.open(path).convert("RGB").resize((w,h),Image.Resampling.LANCZOS);x=(i%5)*w;y=(i//5)*(h+34);sheet.paste(im,(x,y));d.text((x+12,y+h+4),f"{ID} / {t:.1f} s",font=font,fill=(238,239,243))
sheet.save(WORK/f"{ID}-review.jpg",quality=94)
def decode(p):return np.frombuffer(subprocess.check_output([FFMPEG,"-v","error","-i",str(p),"-vn","-ac","1","-ar","8000","-f","f32le","pipe:1"]),dtype="<f4").astype(np.float64)
def activity(p):
 samples=decode(p);n=len(samples)//80;rms=np.sqrt(np.mean(samples[:n*80].reshape(-1,80)**2,axis=1));groups={}
 for db in (-38,-35,-30):
  active=rms>=10**(db/20);edges=np.diff(np.r_[False,active,False].astype(int));starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0];merged=[]
  for start,end in zip(starts,ends):
   if merged and start-merged[-1][1]<=12:merged[-1][1]=int(end)
   else:merged.append([int(start),int(end)])
  groups[str(db)]=[{"start":round(s/100,3),"end":round(e/100,3),"duration":round((e-s)/100,3)}for s,e in merged if e-s>=8]
 tail=samples[round(3.8*8000):round(4.8*8000)];level=lambda x:float(20*np.log10(np.sqrt(np.mean(x*x))+1e-12))
 return{"path":str(p),"sha256":hash(p),"decoded_duration":len(samples)/8000,"activity_groups_by_threshold_dbfs":groups,"tail_3_8_to_4_8_rms_dbfs":level(tail),"rms_dbfs":level(samples)}
report={"id":ID,"status":"activity_and_frames_ready_requires_manual_interpretation","source":str(VIDEO),"sha256":hash(VIDEO),"size_bytes":int(probe["format"]["size"]),"container_duration":float(probe["format"]["duration"]),"video":{"width":video["width"],"height":video["height"],"fps":video["avg_frame_rate"],"duration":float(video["duration"]),"frames":int(video["nb_frames"]),"codec":video["codec_name"]},"audio":{"codec":audio["codec_name"],"sample_rate":int(audio["sample_rate"]),"channels":audio["channels"],"duration":float(audio["duration"])},"contact_sheet":f"work/{ID}-review.jpg","sample_times":[i*.5 for i in range(10)],"activity_method":{"sample_rate":8000,"window_seconds":.01,"maximum_merged_gap_seconds":.12,"minimum_group_seconds":.08,"thresholds_dbfs":[-38,-35,-30],"is_asr":False},"reference":activity(AUDIO),"generated":activity(VIDEO),"audio_modified":False,"automatic_retime_added":False,"limitations":["活动组为固定阈值能量分组，不能当作词级时间。","每0.5秒抽帧不能证明口型同步。"]}
(WORK/f"{ID}-diagnostic.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"id":ID,"video":report["video"],"reference_groups":report["reference"]["activity_groups_by_threshold_dbfs"]["-38"],"generated_groups":report["generated"]["activity_groups_by_threshold_dbfs"]["-38"],"contact_sheet":report["contact_sheet"]},ensure_ascii=False,indent=2))
