"""Download pinned official CTranslate2 data; run local short-window ASR.

Does not upload audio, execute remote Python, or rewrite prior/base evidence.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'work'
MODEL = WORK / 'model-cache/faster-whisper-small'
REPO = 'Systran/faster-whisper-small'
REVISION = '536b0662742c02347bc0e980a01041f333bce120'
FILES = ['README.md', 'config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt']
SOURCE = ROOT / 'music/source-ya-zhou-ren-jian.mp3'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def download():
    MODEL.mkdir(parents=True, exist_ok=True)
    manifest_path = WORK / 'small-model-provenance.json'
    url = f'https://huggingface.co/api/models/{REPO}/revision/{REVISION}?blobs=true'
    with urllib.request.urlopen(url, timeout=45) as response:
        metadata = json.load(response)
    assert metadata['sha'] == REVISION
    metadata_files = {item['rfilename']: item for item in metadata['siblings']}
    manifest = {'schema_version': 1, 'status': 'downloading', 'model': REPO,
                'revision': REVISION, 'official_model_card': f'https://huggingface.co/{REPO}/blob/{REVISION}/README.md',
                'source_metadata_api': url, 'license': metadata.get('cardData', {}).get('license'),
                'started_at': datetime.now(timezone.utc).isoformat(),
                'local_directory': str(MODEL), 'remote_python_executed': False,
                'trust_remote_code': False, 'audio_uploaded': False,
                'paid_calls': 0, 'files': []}
    save(manifest_path, manifest)
    for name in FILES:
        target = MODEL / name
        meta = metadata_files[name]
        expected_size = meta.get('size')
        expected_hash = meta.get('lfs', {}).get('sha256')
        file_url = f'https://huggingface.co/{REPO}/resolve/{REVISION}/{name}'
        existing_valid = target.is_file() and (expected_size is None or target.stat().st_size == expected_size)
        if existing_valid and expected_hash:
            existing_valid = sha(target) == expected_hash
        if not existing_valid:
            print(json.dumps({'downloading': name, 'expected_bytes': expected_size}), flush=True)
            partial = target.with_suffix(target.suffix + '.partial')
            total = 0
            last_progress = 0
            with urllib.request.urlopen(file_url, timeout=60) as response, partial.open('wb') as f:
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    f.write(block)
                    total += len(block)
                    if total - last_progress >= 32 * 1024 * 1024:
                        print(json.dumps({'file': name, 'bytes_received': total}), flush=True)
                        last_progress = total
            if expected_size is not None:
                assert total == expected_size, (name, total, expected_size)
            digest = sha(partial)
            if expected_hash:
                assert digest == expected_hash, (name, digest, expected_hash)
            os.replace(partial, target)
        manifest['files'].append({'name': name, 'source_url': file_url, 'bytes': target.stat().st_size,
                                  'sha256': sha(target), 'hub_lfs_sha256': expected_hash,
                                  'already_cached': existing_valid})
        save(manifest_path, manifest)
    manifest.update(status='downloaded_and_hash_checked', completed_at=datetime.now(timezone.utc).isoformat(),
                    total_bytes=sum(x['bytes'] for x in manifest['files']))
    save(manifest_path, manifest)
    print(json.dumps({'model_download': manifest['status'], 'total_bytes': manifest['total_bytes']}), flush=True)


def transcribe(hint, window_spec, label):
    # Tokenizer, vocabulary, and weights are already local. Disable Hub network.
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    settings = dict(language='zh', task='transcribe', beam_size=5, temperature=0.0,
                    word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                    repetition_penalty=1.15, no_repeat_ngram_size=7)
    if hint:
        raw = (ROOT / 'docs/full-song-lyrics.txt').read_text(encoding='utf-8')
        settings['initial_prompt'] = '\n'.join(x.strip() for x in raw.splitlines()
                                               if x.strip() and not x.strip().startswith('['))
    windows = [tuple(float(x) for x in p.split(':')) for p in window_spec.split(',')]
    suffix = ('-' + label) if label else ''
    out = WORK / (('new-song-asr-small-hinted' if hint else 'new-song-asr-small-unprompted') + suffix + '.json')
    if out.exists():
        raise FileExistsError(f'Keep prior evidence; choose a new --label: {out}')
    report = {'schema_version': 1, 'status': 'running', 'model': REPO, 'model_revision': REVISION,
              'model_provenance': 'work/small-model-provenance.json', 'source_sha256': sha(SOURCE),
              'lyrics_hint': hint, 'settings': settings, 'runtime': {'device': 'cpu', 'compute_type': 'int8', 'cpu_threads': 4},
              'audio_uploaded': False, 'remote_python_executed': False, 'paid_calls': 0,
              'inference_network_calls': 0, 'created_at': datetime.now(timezone.utc).isoformat(), 'windows': []}
    save(out, report)
    audio = decode_audio(str(SOURCE), sampling_rate=16000)
    model = WhisperModel(str(MODEL), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
    for start, end in windows:
        assert 0 <= start < end <= len(audio) / 16000 + .001
        started = time.monotonic()
        parts = []
        segments, info = model.transcribe(audio[round(start * 16000):round(end * 16000)], **settings)
        for s in segments:
            parts.append({'start': start + s.start, 'end': start + s.end, 'text': s.text,
                          'avg_logprob': s.avg_logprob, 'no_speech_prob': s.no_speech_prob,
                          'words': [{'start': start + w.start, 'end': start + w.end, 'word': w.word,
                                     'probability': w.probability} for w in (s.words or [])]})
        item = {'window': [start, end], 'segments': parts, 'elapsed_s': round(time.monotonic() - started, 3)}
        report['windows'].append(item)
        save(out, report)
        print(json.dumps(item, ensure_ascii=False), flush=True)
    report.update(status='completed', completed_at=datetime.now(timezone.utc).isoformat())
    save(out, report)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download-only', action='store_true')
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--hint-reference', action='store_true')
    parser.add_argument('--windows', default='28:43,79:87,62:65.6')
    parser.add_argument('--label', default='')
    args = parser.parse_args()
    if args.download or args.download_only:
        download()
    if not args.download_only:
        transcribe(args.hint_reference, args.windows, args.label)
