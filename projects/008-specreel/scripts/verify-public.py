"""Compare the published static research page with the local Pages artifact."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen
import json
import subprocess

project = Path(__file__).resolve().parents[1]
repo = project.parents[1]
local = project / 'web/dist'
base = 'https://yydshly.github.io/1014_codex_project/'
prefix = '008-specreel/'
manifest = json.loads((local / 'asset-manifest.json').read_text(encoding='utf-8'))
text_types = {'.html', '.css', '.js', '.json', '.md', '.py', '.txt'}

def request(route, headers=None):
    with urlopen(Request(base + route, headers={'User-Agent': 'Specreel-Research-Verification', **(headers or {})}), timeout=45) as response:
        return response.status, response.read(), dict(response.headers)

def verify_asset(item):
    route = prefix + item['path']
    status, body, _ = request(route)
    expected = (local / item['path']).read_bytes()
    matches = body == expected
    if not matches and Path(item['path']).suffix in text_types:
        matches = body.replace(b'\r\n', b'\n') == expected.replace(b'\r\n', b'\n')
    assert status == 200 and matches, route
    result = {'path': item['path'], 'status': status, 'bytes': len(body), 'sha256': sha256(body).hexdigest(), 'contentMatches': True}
    if item['path'].endswith('.mp4'):
        ranges = []
        for start, end in [(0, 1023), (len(body)-1024, len(body)-1)]:
            code, chunk, headers = request(route, {'Range': f'bytes={start}-{end}'})
            assert code == 206 and chunk == body[start:end+1], route
            ranges.append({'range': f'bytes={start}-{end}', 'status': code, 'contentRange': headers.get('Content-Range')})
        result['ranges'] = ranges
    return result

with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(verify_asset, manifest['files']))

_, catalog_body, _ = request('projects.json')
_, entries_body, _ = request('entries.json')
catalog = json.loads(catalog_body)
entries = json.loads(entries_body)
assert [item['id'] for item in catalog['projects']] == [f'{i:03d}' for i in range(1,16)]
expected_pages = json.loads((repo/'web/pages.json').read_text(encoding='utf-8'))['projects']
assert entries['publishedProjects'] == expected_pages
assert '008' in entries['projects']
existing = []
for name in expected_pages:
    code, _, _ = request(name+'/')
    assert code == 200, name
    existing.append({'project': name, 'status': code})

report = {
    'status': 'published-and-verified',
    'verifiedAt': datetime.now(timezone.utc).isoformat(),
    'commit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),
    'url': base+prefix+'#synthesis',
    'researchProjects': 15,
    'publishedApplications': len(expected_pages),
    'assetChecks': results,
    'applicationEntrypoints': existing,
    'scope': 'Actual HTTP content comparison, all six MP4 first/last byte ranges, complete catalog and published application entrypoints. Browser visual and interaction checks are recorded separately in deployment.json. No Agent or model workflow executed.'
}
(project/'artifacts/public-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(results),'mp4Ranges':12,'applications':len(existing),'researchProjects':15,'status':report['status']}))
