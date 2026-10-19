"""Fetch the minimum pinned official MuseTalk1.5 inference data, never all-song inference.

Use official Hub endpoints, original face-parser author's public Drive link,
and model authors' published URLs. No credentials, API audio upload, or payment.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / 'local-tools/musetalk'
MODELS = TOOL / 'models'
REPORT = ROOT / 'work/musetalk-models.json'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


# repo,revision,source filename,target relative totool,bytes,hash,license
hub_files = [
    ('TMElyralab/MuseTalk', '2bcb936e2fddb4d86db4c62fd45b387d0c061571', 'musetalkV15/musetalk.json', 'models/musetalkV15/musetalk.json', 748, None, 'MIT'),
    ('TMElyralab/MuseTalk', '2bcb936e2fddb4d86db4c62fd45b387d0c061571', 'musetalkV15/unet.pth', 'models/musetalkV15/unet.pth', 3400074924, '7ebf6c98c181e20838e4c0054e96e944ac60d5d692cc01db42839fe11b787007', 'MIT;officialREADMEpermitsallpurposes'),
    ('stabilityai/sd-vae-ft-mse', '31f26fdeee1355a5c34592e401dd41e45d25a493', 'config.json', 'models/sd-vae/config.json', 547, None, 'MIT'),
    ('stabilityai/sd-vae-ft-mse', '31f26fdeee1355a5c34592e401dd41e45d25a493', 'diffusion_pytorch_model.bin', 'models/sd-vae/diffusion_pytorch_model.bin', 334707217, '1b4889b6b1d4ce7ae320a02dedaeff1780ad77d415ea0d744b476155c6377ddc', 'MIT'),
    ('openai/whisper-tiny', '169d4a4341b33bc18d8881c4b69c2e104e1cc0af', 'config.json', 'models/whisper/config.json', 1983, None, 'HFcardApache-2.0;originalWhisperMIT'),
    ('openai/whisper-tiny', '169d4a4341b33bc18d8881c4b69c2e104e1cc0af', 'preprocessor_config.json', 'models/whisper/preprocessor_config.json', 184990, None, 'HFcardApache-2.0;originalWhisperMIT'),
    ('openai/whisper-tiny', '169d4a4341b33bc18d8881c4b69c2e104e1cc0af', 'pytorch_model.bin', 'models/whisper/pytorch_model.bin', 151095027, '9607f98a2b22d9e229ae43c52ecea79dcede9e0c5cfae67e8da6eda86d8aac1d', 'HFcardApache-2.0;originalWhisperMIT'),
    ('yzd-v/DWPose', '1a7144101628d69ee7a3768d1ee3a094070dc388', 'dw-ll_ucoco_384.pth', 'models/dwpose/dw-ll_ucoco_384.pth', 406878486, '0d9408b13cd863c4e95a149dd31232f88f2a12aa6cf8964ed74d7d97748c7a07', 'Apache-2.0')]
direct_files = [
    ('https://drive.usercontent.google.com/download?id=154JgKpzCPW82qINcVieuPH3fZ2e0P812&export=download&confirm=t',
     'models/face-parse-bisent/79999_iter.pth', 53289463, '468e13ca13a9b43cc0881a9f99083a430e9c0a38abd935431d1c28ee94b26567',
     'MIT_original_author_repository', 'https://github.com/zllrunning/face-parsing.PyTorch#training'),
    ('https://download.pytorch.org/models/resnet18-5c106cde.pth',
     'models/face-parse-bisent/resnet18-5c106cde.pth', 46827520, '5c106cde386e87d4033832f2996f5493238eda96ccf559d1d62760c4de0613f8',
     'torchvisionBSD-3-Clause', 'officialMuseTalkface_parsing/resnet.py'),
    ('https://www.adrianbulat.com/downloads/python-fan/s3fd-619a316812.pth',
     'musetalk/utils/face_detection/detection/sfd/s3fd.pth', 89843225, '619a31681264d3f7f7fc7a16a42cbbe8b23f31a256f75a366e5a1bcd59b33543',
     'face-alignmentBSD-3-Clause_upstreamdependency', 'officialMuseTalksfd_detector.py')]

if REPORT.exists():
    previous = json.loads(REPORT.read_text(encoding='utf-8'))
    if previous.get('status') == 'downloading' and 'download_method' not in previous:
        snapshot = REPORT.with_name('musetalk-models-xet-attempt.json')
        if not snapshot.exists():
            previous.update(status='interrupted_to_reduce_memory',
                            interruption_reason='ParallelHF_Xetprocessstopped;observedprivatecommit1.493GB;switchedtosequentialstreamingHTTP.')
            snapshot.write_text(json.dumps(previous, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
report = {'schema_version': 1, 'status': 'downloading', 'started_at': datetime.now(timezone.utc).isoformat(),
          'tool_repo': 'https://github.com/TMElyralab/MuseTalk',
          'tool_commit': '0a89dec45a0192b824e3cf4daf96c239440c5ed8',
          'models_scope': '1.5normalinferenceonly_no1.0_noSyncNettrainingweights',
          'audio_uploaded': False, 'credentials_read': False, 'paid_calls': 0,
          'full_song_inference_started': False,
          'download_method': 'sequential_stdlib_HTTPS_1MiBbuffers_noXet_reconstruction_streaming4MiBhash',
          'prior_interrupted_attempt': 'work/musetalk-models-xet-attempt.json', 'files': [], 'errors': []}


def save():
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def validate(path, expected_size, expected_hash):
    if not path.is_file() or path.stat().st_size != expected_size:
        return False
    return expected_hash is None or digest(path) == expected_hash


def stream(url, target, size, expected):
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + '.http-partial')
    assert partial.resolve().is_relative_to(TOOL.resolve())
    for attempt in range(1, 4):
        start = partial.stat().st_size if partial.exists() else 0
        assert start <= size
        if start == size:
            break
        request = urllib.request.Request(url, headers={'Range': f'bytes={start}-', 'User-Agent': 'MuseTalk-local-preparation'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                if start and (response.status != 206 or not response.headers.get('Content-Range', '').startswith(f'bytes {start}-')):
                    raise ValueError('Serverdidnotacknowledgecontiguousresume;leavingpartialforreview')
                if not start and response.status not in (200, 206):
                    raise ValueError(f'UnexpectedHTTPstatus{response.status}')
                count = start
                next_progress = count + 256 * 1024 * 1024
                with partial.open('ab' if start else 'wb') as f:
                    for block in iter(lambda: response.read(1024 * 1024), b''):
                        count += len(block)
                        if count > size:
                            raise ValueError(f'Unexpectedlargeresponsefor{target.name}')
                        f.write(block)
                        if count >= next_progress:
                            print(json.dumps({'streaming': target.name, 'contiguous_bytes': count, 'expected_bytes': size}), flush=True)
                            next_progress = count + 256 * 1024 * 1024
            if count != size:
                raise OSError(f'TruncatedHTTPbody{count}/{size}')
            break
        except (OSError, TimeoutError) as e:
            if attempt == 3:
                raise
            print(json.dumps({'stream_resume': target.name, 'attempt': attempt, 'type': type(e).__name__}), flush=True)
            time.sleep(2)
    if not validate(partial, size, expected):
        raise ValueError(f'Officialsourcebytes/hashinvalidfor{target.name};noHTMLasweights')
    os.replace(partial, target)


def fetch_hub(item):
    repo, revision, name, relative, size, expected, license = item
    target = TOOL / relative
    cached = validate(target, size, expected)
    if not cached:
        print(json.dumps({'download_start': relative, 'bytes': size}), flush=True)
        stream(f'https://huggingface.co/{repo}/resolve/{revision}/{name}?download=true', target, size, expected)
    assert validate(target, size, expected), relative
    return {'path': relative, 'bytes': target.stat().st_size, 'sha256': digest(target),
            'expected_sha256': expected, 'source_url': f'https://huggingface.co/{repo}/resolve/{revision}/{name}',
            'repo': repo, 'revision': revision, 'license_evidence': license, 'already_present': cached}


def fetch_direct(item):
    url, relative, size, expected, license, evidence = item
    target = TOOL / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    cached = validate(target, size, expected)
    if not cached:
        print(json.dumps({'download_start': relative, 'bytes': size}), flush=True)
        stream(url, target, size, expected)
    return {'path': relative, 'bytes': target.stat().st_size, 'sha256': digest(target),
            'expected_sha256': expected, 'source_url': url, 'license_evidence': license,
            'source_evidence': evidence, 'already_present': cached}


save()
jobs = [(fetch_hub, x) for x in hub_files] + [(fetch_direct, x) for x in direct_files]
for f, item in jobs:
        try:
            record = f(item)
            report['files'].append(record)
            save()
            print(json.dumps({'download_ready': record['path'], 'bytes': record['bytes'], 'sha256': record['sha256']}), flush=True)
        except Exception as e:
            report['errors'].append({'type': type(e).__name__, 'message': str(e)[:500]})
            save()
            print(json.dumps({'download_error': type(e).__name__, 'message': str(e)[:500]}), flush=True)
report.update(status='ready_all_hashes_checked' if not report['errors'] else 'incomplete_errors_recorded',
              finished_at=datetime.now(timezone.utc).isoformat(),
              total_verified_bytes=sum(x['bytes'] for x in report['files']))
save()
print(json.dumps({'status': report['status'], 'files': len(report['files']), 'total_bytes': report['total_verified_bytes']}), flush=True)
if report['errors']:
    raise SystemExit(1)
