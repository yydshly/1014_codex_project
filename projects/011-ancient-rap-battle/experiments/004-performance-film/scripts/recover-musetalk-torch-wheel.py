"""Recover the officialTorchwheel's already-expandedmembers, fetch onlymissingtail.

Everypayload is checked against originalwheelRECORD(SHA256+size). The resulting
localZIP is explicitly a repackedwheel, not falselyclaimed originalarchiveSHA.
Only the positivelyidentified004UVtemp extraction and ourDtaskcache are touched.
"""
from pathlib import Path
from datetime import datetime, timezone
import base64,csv,hashlib,io,json,os,shutil,struct,subprocess,threading,time,urllib.request,zipfile,zlib
import concurrent.futures

ROOT=Path(__file__).resolve().parent.parent
CACHE=Path('D:/codex/home/task-cache/ancient-rap-battle-004/torch-cu118-recovery')
SEED=CACHE/'verified-members'
UV_CACHE=Path('C:/Users/yun68/AppData/Local/Temp/.tmpmyDZFa')
WHEEL_NAME='torch-2.0.1+cu118-cp310-cp310-win_amd64.whl'
URL='https://download.pytorch.org/whl/cu118/torch-2.0.1%2Bcu118-cp310-cp310-win_amd64.whl'
SIZE=2619146901
ETAG='"5044447ab39fdbb9dfd6a872f0641d00"'
SOURCE_TAIL=CACHE/'official-sparse-tail.whl.partial'
LOCAL_WHEEL=CACHE/WHEEL_NAME
REPORT=ROOT/'work/musetalk-torch-wheel-recovery.json'
lock=threading.Lock()
CACHE.mkdir(parents=True,exist_ok=True);SEED.mkdir(exist_ok=True)
assert CACHE.resolve().is_relative_to(Path('D:/codex/home/task-cache/ancient-rap-battle-004').resolve())

def sha(path):
 h=hashlib.sha256()
 with path.open('rb')as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
 return h.hexdigest()

def remote(a,b):
 with urllib.request.urlopen(urllib.request.Request(URL,headers={'Range':f'bytes={a}-{b}','If-Range':ETAG}),timeout=60)as r:
  assert r.status==206 and r.headers.get('Content-Range')==f'bytes {a}-{b}/{SIZE}' and r.headers.get('ETag')==ETAG
  out=r.read();assert len(out)==b-a+1;return out

tail=remote(SIZE-65536,SIZE-1);i=tail.rfind(b'PK\x05\x06');e=struct.unpack_from('<IHHHHIIH',tail,i)
directory=remote(e[6],e[6]+e[5]-1);items={};i=0
while i<len(directory):
 v=struct.unpack_from('<I6H3I5H2I',directory,i);assert v[0]==0x02014b50
 n,x,c=v[10:13];name=directory[i+46:i+46+n].decode();assert not Path(name).is_absolute()and'..'not in Path(name).parts
 compressed,uncompressed,local_offset=v[8],v[9],v[16]
 extra=directory[i+46+n:i+46+n+x];j=0
 while j+4<=len(extra):
  kind,length=struct.unpack_from('<HH',extra,j);data=extra[j+4:j+4+length];j+=4+length
  if kind==1:
   k=0
   if uncompressed==0xffffffff:uncompressed=struct.unpack_from('<Q',data,k)[0];k+=8
   if compressed==0xffffffff:compressed=struct.unpack_from('<Q',data,k)[0];k+=8
   if local_offset==0xffffffff:local_offset=struct.unpack_from('<Q',data,k)[0]
 items[name]={'compressed':compressed,'size':uncompressed,'crc':v[7],'method':v[4],'offset':local_offset};i+=46+n+x+c
assert len(items)==e[4]

def small_member(name):
 v=items[name];header=remote(v['offset'],v['offset']+29);h=struct.unpack('<I5H3I2H',header);assert h[0]==0x04034b50
 start=v['offset']+30+h[-2]+h[-1];assert v['compressed']<4*1024*1024
 raw=remote(start,start+v['compressed']-1)if v['compressed']else b''
 data=zlib.decompress(raw,-15)if v['method']==8 else raw
 assert len(data)==v['size']and zlib.crc32(data)&0xffffffff==v['crc'];return data

record_name=next(n for n in items if n.endswith('.dist-info/RECORD'))
record_data=small_member(record_name)
hashes={}
for name,hashspec,n in csv.reader(io.StringIO(record_data.decode())):
 if hashspec:
  algorithm,encoded=hashspec.split('=',1);assert algorithm=='sha256';hashes[name]=(base64.urlsafe_b64decode(encoded+'='*((-len(encoded))%4)).hex(),int(n))
report={'schema_version':1,'status':'seeding_verified_existing_members','created_at':datetime.now(timezone.utc).isoformat(),
        'official_source_url':URL,'official_etag':ETAG,'upstream_archive_bytes':SIZE,
        'upstream_archive_sha256_verified':False,'local_archive_is_repacked':True,
        'original_RECORD_sha256':hashlib.sha256(record_data).hexdigest(),'original_member_count':len(items),
        'expected_uncompressed_bytes':sum(v['size']for v in items.values()),'source_own_uv_cache':str(UV_CACHE),
        'seeded_files':0,'seeded_bytes':0,'downloaded_tail_bytes':0,'paid_calls':0,'audio_uploaded':False}
def save():REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save();print(json.dumps({'stage':'verify_and_preserve_existing_official_members'}),flush=True)
seeded=set()
for name,v in items.items():
 dst=SEED/name
 if name==record_name:
  dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(record_data);seeded.add(name);continue
 if v['size']==0:
  dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(b'');seeded.add(name);continue
 expected=hashes.get(name);assert expected and expected[1]==v['size'],name
 if dst.is_file()and dst.stat().st_size==expected[1]and sha(dst)==expected[0]:seeded.add(name);continue
 for folder in UV_CACHE.glob('.tmp*'):
  src=folder/name
  try:
   if src.is_file()and src.stat().st_size==expected[1]and sha(src)==expected[0]:
    dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
    assert sha(dst)==expected[0];seeded.add(name);break
  except FileNotFoundError:continue
report.update(seeded_files=len(seeded),seeded_bytes=sum(items[n]['size']for n in seeded));save()
print(json.dumps({'verified_seed_files':len(seeded),'verified_seed_bytes':report['seeded_bytes']}),flush=True)
installed=ROOT/'local-tools/venv-musetalk/Lib/site-packages/torch/__init__.py'
if installed.is_file():
 report.update(status='original_installer_completed_no_recovery_needed');save();raise SystemExit(0)
# Stop onlyourpositivelyidentified installer, after preserving allusablecontent.
subprocess.run(['powershell','-NoProfile','-Command',"$p=Get-CimInstance Win32_Process -Filter \"ProcessId=48152 AND Name='uv.exe' AND CommandLine LIKE '%venv-musetalk%'\";if($p){Stop-Process -Id 48152 -Force}"],check=True,capture_output=True)
missing=[n for n in items if n not in seeded]
assert missing
start=min(items[n]['offset']for n in missing)
state_path=CACHE/'tail-range-state.json'
if state_path.exists():
 state=json.loads(state_path.read_text());assert state['etag']==ETAG and state['start']==start
else:
 span=(SIZE-start+3)//4
 state={'etag':ETAG,'start':start,'ranges':[{'start':start+j*span,'end':min(SIZE,start+(j+1)*span),'received':0}for j in range(4)if start+j*span<SIZE]}
 with SOURCE_TAIL.open('wb')as f:f.truncate(SIZE)
report.update(status='downloading_only_missing_member_tail_four_ranges',missing_members=len(missing),tail_start=start,tail_expected_bytes=SIZE-start);save()

def save_state():
 temp=state_path.with_suffix('.tmp');temp.write_text(json.dumps(state));os.replace(temp,state_path)
 report['downloaded_tail_bytes']=sum(x['received']for x in state['ranges']);save()

def fetch_range(part):
 for attempt in range(3):
  a=part['start']+part['received'];b=part['end']-1
  if a>b:return
  try:
   with urllib.request.urlopen(urllib.request.Request(URL,headers={'Range':f'bytes={a}-{b}','If-Range':ETAG}),timeout=60)as r:
    assert r.status==206 and r.headers.get('Content-Range')==f'bytes {a}-{b}/{SIZE}'and r.headers.get('ETag')==ETAG
    position=a;saved=a
    with SOURCE_TAIL.open('r+b',buffering=0)as f:
     f.seek(a)
     for block in iter(lambda:r.read(1024*1024),b''):
      assert position+len(block)<=b+1;f.write(block);position+=len(block)
      if position-saved>=16*1024*1024:
       os.fsync(f.fileno())
       with lock:part['received']=position-part['start'];save_state()
       saved=position
     os.fsync(f.fileno())
    with lock:part['received']=position-part['start'];save_state()
    if position!=b+1:raise OSError('IncompleteHTTPRange')
    return
  except(OSError,TimeoutError):
   if attempt==2:raise
   time.sleep(2)

print(json.dumps({'stage':report['status'],'tail_bytes':SIZE-start,'preserved_uncompressed_bytes':report['seeded_bytes']}),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
 for f in concurrent.futures.as_completed([pool.submit(fetch_range,p)for p in state['ranges']]):
  f.result();print(json.dumps({'range_finished':True,'downloaded_tail_bytes':report['downloaded_tail_bytes']}),flush=True)
assert report['downloaded_tail_bytes']==SIZE-start
report['status']='repacking_and_verifying_all_original_member_hashes';save()
temporary=LOCAL_WHEEL.with_suffix('.whl.partial')
with zipfile.ZipFile(SOURCE_TAIL)as source,zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_STORED,allowZip64=True)as result:
 for name,v in items.items():
  h=hashlib.sha256();count=0;crc=0
  stream=(SEED/name).open('rb')if name in seeded else source.open(name)
  with stream as reader,result.open(name,'w',force_zip64=True)as writer:
   for data in iter(lambda:reader.read(1024*1024),b''):
    writer.write(data);h.update(data);crc=zlib.crc32(data,crc);count+=len(data)
  assert count==v['size']and crc&0xffffffff==v['crc'],name
  if name in hashes:assert h.hexdigest()==hashes[name][0],name
temporary.replace(LOCAL_WHEEL)
report.update(status='local_repacked_wheel_ready_all_original_members_sha_verified',local_wheel_path=str(LOCAL_WHEEL),
              local_wheel_bytes=LOCAL_WHEEL.stat().st_size,local_wheel_sha256=sha(LOCAL_WHEEL),
              original_payload_members_unchanged=True,original_record_sha256_verified=True,
              finished_at=datetime.now(timezone.utc).isoformat())
save();print(json.dumps({'status':report['status'],'wheel':str(LOCAL_WHEEL),'sha256':report['local_wheel_sha256']}),flush=True)
