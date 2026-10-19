"""Resume only official pinnedUNet in four non-overlapping low-RAM HTTP ranges.

Uses one preallocatedpartial, exact206/Content-Range/ETag checks, and finalSHA.
No Xet reconstruction, in-memoryfile, or second concatenatedcopy.
"""
from pathlib import Path
from datetime import datetime, timezone
import concurrent.futures
import hashlib
import json
import math
import os
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / 'local-tools/musetalk/models/musetalkV15/unet.pth'
PARTIAL = FILE.with_suffix('.pth.http-partial')
STATE = FILE.with_suffix('.pth.range-state.json')
REPORT = ROOT / 'work/musetalk-range-download.json'
URL = 'https://huggingface.co/TMElyralab/MuseTalk/resolve/2bcb936e2fddb4d86db4c62fd45b387d0c061571/musetalkV15/unet.pth?download=true'
SIZE = 3400074924
SHA = '7ebf6c98c181e20838e4c0054e96e944ac60d5d692cc01db42839fe11b787007'
lock = threading.Lock()


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


if FILE.exists():
    assert FILE.stat().st_size == SIZE and digest(FILE) == SHA
    print('official_core_already_complete_and_sha_valid')
    raise SystemExit(0)
assert PARTIAL.resolve().is_relative_to((ROOT / 'local-tools').resolve())
req = urllib.request.Request(URL, headers={'Range': 'bytes=0-0', 'User-Agent': 'MuseTalk-local-range-preparation'})
with urllib.request.urlopen(req, timeout=40) as response:
    assert response.status == 206 and response.headers.get('Content-Range') == f'bytes 0-0/{SIZE}'
    etag = response.headers.get('ETag')
    assert etag and len(response.read()) == 1
if STATE.exists():
    state = json.loads(STATE.read_text(encoding='utf-8'))
    assert state['url'] == URL and state['etag'] == etag and state['expected_sha256'] == SHA
    assert PARTIAL.stat().st_size == SIZE
else:
    prefix = PARTIAL.stat().st_size if PARTIAL.exists() else 0
    assert 0 <= prefix < SIZE
    span = math.ceil((SIZE - prefix) / 4)
    state = {'schema_version': 1, 'status': 'downloading', 'url': URL, 'etag': etag,
             'expected_bytes': SIZE, 'expected_sha256': SHA, 'verified_final_sha256': None,
             'prior_contiguous_prefix_bytes': prefix, 'created_at': datetime.now(timezone.utc).isoformat(),
             'method': 'four_nonoverlapping_HTTPS_range_streams_1MiBbuffers_onepreallocatedfile',
             'ranges': [{'index': i, 'start': prefix + i * span, 'end_exclusive': min(SIZE, prefix + (i + 1) * span),
                         'received_bytes': 0} for i in range(4) if prefix + i * span < SIZE]}
    with PARTIAL.open('r+b' if PARTIAL.exists() else 'w+b') as f:
        f.truncate(SIZE)


def save_locked():
    state['received_total_bytes'] = state['prior_contiguous_prefix_bytes'] + sum(x['received_bytes'] for x in state['ranges'])
    for path in [STATE, REPORT]:
        temp = path.with_suffix(path.suffix + '.tmp')
        temp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        os.replace(temp, path)


def fetch(item):
    for attempt in range(3):
        with lock:
            start = item['start'] + item['received_bytes']
        end = item['end_exclusive'] - 1
        if start > end:
            return
        request = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end}',
                                                       'If-Range': etag, 'User-Agent': 'MuseTalk-local-range-preparation'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                assert response.status == 206
                assert response.headers.get('Content-Range') == f'bytes {start}-{end}/{SIZE}'
                assert response.headers.get('ETag') == etag
                if response.headers.get('Content-Length') is not None:
                    assert int(response.headers['Content-Length']) == end - start + 1
                position = start
                saved = start
                with PARTIAL.open('r+b', buffering=0) as f:
                    f.seek(start)
                    for block in iter(lambda: response.read(1024 * 1024), b''):
                        assert position + len(block) <= end + 1
                        f.write(block)
                        position += len(block)
                        if position - saved >= 16 * 1024 * 1024:
                            os.fsync(f.fileno())
                            with lock:
                                item['received_bytes'] = position - item['start']
                                save_locked()
                            saved = position
                    os.fsync(f.fileno())
                with lock:
                    item['received_bytes'] = position - item['start']
                    save_locked()
                if position != end + 1:
                    raise OSError(f'Range{item["index"]}truncated')
                return
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2)
    raise RuntimeError('Unreachablefailedrange')


started = time.monotonic()
state['status'] = 'downloading'
save_locked()
print(json.dumps({'status': 'four_low_memory_ranges_started', 'prior_contiguous_bytes': state['prior_contiguous_prefix_bytes'], 'total': SIZE}), flush=True)
try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(fetch, item) for item in state['ranges']]
        for future in concurrent.futures.as_completed(futures):
            future.result()
            with lock:
                print(json.dumps({'range_finished': True, 'received_total_bytes': state['received_total_bytes'], 'total': SIZE}), flush=True)
    assert state['received_total_bytes'] == SIZE
    actual = digest(PARTIAL)
    assert actual == SHA
    os.replace(PARTIAL, FILE)
    state.update(status='completed_and_sha_verified', verified_final_sha256=actual,
                 elapsed_seconds=round(time.monotonic() - started, 3), finished_at=datetime.now(timezone.utc).isoformat())
    save_locked()
    print(json.dumps({'status': state['status'], 'bytes': SIZE, 'sha256': actual}), flush=True)
except Exception as e:
    state.update(status='failed_partial_retained', error_type=type(e).__name__, error_message=str(e)[:500])
    save_locked()
    raise
