#!/usr/bin/env python3
"""Compare deployed 002 static bytes and retained project entrances with _site."""
import concurrent.futures
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[4]
PROJECT = ROOT / 'projects/002-rainy-ghost'
SITE = ROOT / '_site'
BASE = 'https://yydshly.github.io/1014_codex_project/'
NAME = '002-rainy-ghost/'
hash_bytes = lambda data: hashlib.sha256(data).hexdigest()

def fetch(relative):
    url = urljoin(BASE, relative)
    with urlopen(Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': '002-public-verification'}), timeout=45) as result:
        assert result.status == 200, (url, result.status)
        return result.read(), result.headers.get('Content-Type', '')

def verify_file(path):
    relative = path.relative_to(SITE).as_posix()
    data, content_type = fetch(relative)
    assert data == path.read_bytes(), f'公网字节不一致：{relative}'
    if path.suffix == '.jpg': assert 'image/jpeg' in content_type
    if path.suffix == '.css': assert 'text/css' in content_type
    if path.suffix == '.js': assert 'javascript' in content_type
    if path.suffix == '.html': assert 'text/html' in content_type
    return {'path': relative, 'status': 200, 'bytes': len(data), 'sha256': hash_bytes(data)}

files = sorted(path for path in (SITE / NAME).rglob('*') if path.is_file())
assert files, '请先构建完整 _site'
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    checked = list(pool.map(verify_file, files))

summary = (SITE / NAME / 'research.html').read_text(encoding='utf-8')
ids = re.findall(r'\bid="([^"]+)"', summary)
anchors = re.findall(r'href="#([^"]+)"', summary)
assert len(ids) == len(set(ids)) and all(anchor in ids for anchor in anchors)
for phrase in ['未取得原作者的场景源码', 'Three.js 0.186.1', '我们的扩展', '够用就停']:
    assert phrase in summary
catalog = json.loads(fetch('projects.json')[0])
entry = next(project for project in catalog['projects'] if project['id'] == '002')
assert entry['source_url'].endswith('/2110225806849122363')
assert entry['preview'] == 'assets/pet/farewell/desktop.jpg'
expected_entry = next(project for project in json.loads((ROOT / 'projects.json').read_text(encoding='utf-8'))['projects'] if project['id'] == '002')
assert entry['summary'] == expected_entry['summary']
image = fetch(f'projects/002-rainy-ghost/{entry["preview"]}')[0]
assert hash_bytes(image) == hash_bytes((PROJECT / entry['preview']).read_bytes())
entrances = json.loads(fetch('entries.json')[0])['projects']['002']
assert {item['path'] for item in entrances} == {
    '002-rainy-ghost/research.html#synthesis', '002-rainy-ghost/', '002-rainy-ghost/research.html#extensions'}
fetch('index.html')
manifest = json.loads((ROOT / 'web/pages.json').read_text(encoding='utf-8'))['projects']
retained = []
for name in manifest:
    if name == NAME.rstrip('/'): continue
    data, content_type = fetch(name + '/')
    assert b'<html' in data.lower() and 'text/html' in content_type
    retained.append(name)
report = {
    'verifiedAt': datetime.now(timezone.utc).isoformat(),
    'base': BASE, 'projectFiles': checked, 'projectStaticFileCount': len(checked),
    'summaryIds': len(ids), 'summaryAnchorLinks': len(anchors),
    'sourceAndOwnWorkSeparated': True, 'finalImageOriginalBytesMatch': True,
    'catalogAndEntrances': 'passed', 'demoUrl': entry['demo_url'],
    'retainedProjectEntrances': retained,
    'limits': ['HTTP与字节检查不替代WebGL、真实触屏、音频听感或长期性能验收'],
}
destination = PROJECT / 'public-verification.json'
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'result': 'passed', 'projectFiles': len(checked), 'retainedEntrances': len(retained), 'report': str(destination)}, ensure_ascii=False))
