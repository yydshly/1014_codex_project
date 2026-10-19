"""One fixed-revision download of model data only; no remote code or paid ASR."""
from pathlib import Path
import hashlib,json,time,urllib.request
ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'work'/'model-cache'
MODEL=CACHE/'faster-whisper-base'
REPO='Systran/faster-whisper-base'
REV='ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66'
FILES={'config.json':2309,'model.bin':145217532,'tokenizer.json':2203239,'vocabulary.txt':459861}
MODEL.mkdir(parents=True,exist_ok=True)
(CACHE/'.gitignore').write_text('*\n!.gitignore\n',encoding='utf-8')
manifest={'repo':REPO,'revision':REV,'source_url':f'https://huggingface.co/{REPO}/tree/{REV}','license':'MIT','remote_code_executed':False,'automatic_retries':0,'files':[]}
for name,size in FILES.items():
    target=MODEL/name
    if not target.exists():
        request=urllib.request.Request(f'https://huggingface.co/{REPO}/resolve/{REV}/{name}',headers={'User-Agent':'local-music-asr-review/1'})
        with urllib.request.urlopen(request,timeout=60) as response, target.with_suffix(target.suffix+'.part').open('wb') as output:
            while block:=response.read(1024*1024):output.write(block)
        target.with_suffix(target.suffix+'.part').replace(target)
    if target.stat().st_size!=size:raise RuntimeError('downloaded_size_mismatch')
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    if name=='model.bin' and digest!='d01c3014881c9c6f3133c182f3d2887eb6ca1c789a7538c5c007196857a0a6a9':raise RuntimeError('model_sha_mismatch')
    manifest['files'].append({'name':name,'bytes':size,'sha256':digest})
    print(json.dumps({'downloaded_or_cached':name,'bytes':size}),flush=True)
(ROOT/'work'/'source-analysis'/'base-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
