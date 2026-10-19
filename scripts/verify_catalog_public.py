"""Verify the complete research catalog separately from published applications."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen
import json

root = Path(__file__).resolve().parents[1]
base = 'https://yydshly.github.io/1014_codex_project/'
catalog = json.loads((root / 'projects.json').read_text(encoding='utf-8'))
manifest = json.loads((root / 'web/pages.json').read_text(encoding='utf-8'))
checks = {'': None, 'projects.json': None, 'entries.json': None, 'records.json': None}
for item in catalog['projects']:
    directory = 'projects/' + item['id'] + '-' + item['slug'] + '/'
    for record in ['README.md', 'RESEARCH.md', 'assets/README.md', 'web/README.md', item['preview']]:
        if record:
            checks[directory + record] = root / directory / record
entries = json.loads((root / '_site/entries.json').read_text(encoding='utf-8'))
for group in entries['projects'].values():
    for entry in group:
        checks[entry['path'].split('#')[0].split('?')[0]] = None

def fetch(item):
    route, expected = item
    with urlopen(Request(base + route, headers={'User-Agent': 'Research-Catalog-Verification'}), timeout=45) as response:
        body = response.read()
        assert response.status == 200, route
    result = {'url': base + route, 'status': 200, 'bytes': len(body), 'sha256': sha256(body).hexdigest()}
    if expected:
        source = expected.read_bytes()
        assert body == source or (expected.suffix == '.md' and body.replace(b'\r\n', b'\n') == source.replace(b'\r\n', b'\n')), route
        result['contentMatches'] = True
    return route, result, body

with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(fetch, checks.items()))
responses = {route: body for route, _, body in results}
public_catalog = json.loads(responses['projects.json'])
public_entries = json.loads(responses['entries.json'])
public_records = json.loads(responses['records.json'])
ids = [item['id'] for item in public_catalog['projects']]
assert ids == sorted(item['id'] for item in catalog['projects'])
assert ids == [f'{number:03d}' for number in range(1, len(ids) + 1)]
assert public_entries['mode'] == 'static'
assert public_entries['publishedProjects'] == manifest['projects']
assert set(public_entries['projects']) == {name[:3] for name in manifest['projects']}
assert set(public_records['projects']) == set(ids)
for item in catalog['projects']:
    readme = (root / 'projects' / (item['id'] + '-' + item['slug']) / 'README.md').read_text(encoding='utf-8')
    assert public_records['projects'][item['id']].replace('\r\n', '\n') == readme.replace('\r\n', '\n')
report_path = root / 'docs/catalog-verification.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
report['status'] = 'published-and-verified'
report['public'] = {
    'verifiedAt': datetime.now(timezone.utc).isoformat(),
    'url': base,
    'researchProjects': len(ids),
    'publishedApplications': len(manifest['projects']),
    'recordsOnly': len(ids) - len(manifest['projects']),
    'ids': ids,
    'resourcesChecked': len(results),
    'checks': [result for _, result, _ in results],
    'scope': 'Actual HTTP content checks; application runtimes and unpublished local engineering were not deployed or re-tested.'
}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: report['public'][key] for key in ['researchProjects', 'publishedApplications', 'recordsOnly', 'resourcesChecked']}))
