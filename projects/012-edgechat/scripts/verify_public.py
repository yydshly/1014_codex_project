"""Verify the published research page against the built static artifacts."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
import json
import sys
import base64
import re

project = Path(__file__).resolve().parents[1]
repository = project.parents[1]
dist = project / 'web/dist'
base = 'https://yydshly.github.io/1014_codex_project/'
prefix = '012-edgechat/'
allow_svg_eol = '--allow-svg-eol' in sys.argv
manifest = json.loads((repository / 'web/pages.json').read_text(encoding='utf-8'))
files = sorted(p for p in dist.rglob('*') if p.is_file())
checks = [(prefix + p.relative_to(dist).as_posix(), p) for p in files]
checks += [(name + '/', None) for name in manifest['projects'] if name != '012-edgechat']
checks += [(p, None) for p in ['', 'projects.json', 'entries.json', 'projects/012-edgechat/assets/edgechat-summary.png']]

def canonical_text(data):
    data = data.replace(b'\r\n', b'\n')
    if allow_svg_eol:
        def normalize_svg(match):
            svg = base64.b64decode(match[1]).replace(b'\r\n', b'\n')
            return b'data:image/svg+xml;base64,' + base64.b64encode(svg)
        data = re.sub(rb'data:image/svg\+xml;base64,([A-Za-z0-9+/=]+)', normalize_svg, data)
    return data

def fetch(item):
    route, local = item
    with urlopen(Request(base + route, headers={'User-Agent': 'EdgeChat-Research-Public-Verification'}), timeout=45) as response:
        data = response.read()
        status = response.status
    record = {'url': base + route, 'status': status, 'bytes': len(data), 'sha256': sha256(data).hexdigest()}
    if status != 200:
        raise AssertionError(f'HTTP failure: {route}')
    if local:
        expected = local.read_bytes()
        exact = data == expected
        record['exactBytes'] = exact
        text = local.suffix in {'.html', '.css', '.js', '.md', '.json'} or (local.suffix == '.svg' and (allow_svg_eol or local.name != 'edgechat-summary.svg'))
        equivalent = text and canonical_text(data) == canonical_text(expected)
        if not exact and not equivalent:
            raise AssertionError(f'Content mismatch: {route}')
        record['contentMatchesBuild'] = True
    return route, record, data

with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(fetch, checks))
contents = {route: data for route, _, data in results}

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.anchors = []
        self.summary_cards = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if attrs.get('href', '').startswith('#'):
            self.anchors.append(attrs['href'][1:])

page = Page()
html = contents[prefix + 'index.html'].decode('utf-8')
page.feed(html)
assert len(page.ids) == len(set(page.ids))
assert all(anchor in page.ids for anchor in page.anchors)
assert 'id="synthesis"' in html and 'id="summary-overview"' in html
for label in ['源库效果', '底层原理', '引发的思考', '对我们的价值与意义', '可扩展产品', '当前取舍']:
    assert label in html
sources = json.loads(contents[prefix + 'research/upstream.json'])
assert len(sources['files']) == 18
assert sources['commit'] == '5a69f11ef0b2bdbdee611620af0f438c68d90f1e'
catalog = json.loads(contents['projects.json'])
catalog_names = [p['id'] + '-' + p['slug'] for p in catalog['projects']]
assert all(name in catalog_names for name in manifest['projects'])
assert catalog_names == sorted(catalog_names)
publication = json.loads(contents['entries.json'])
assert publication['mode'] == 'static' and publication['publishedProjects'] == manifest['projects']
assert contents['projects/012-edgechat/assets/edgechat-summary.png'] == (project / 'assets/edgechat-summary.png').read_bytes()
report = {
    'verifiedAt': datetime.now(timezone.utc).isoformat(),
    'base': base + prefix,
    'resourcesChecked': len(results),
    'staticFiles': len(files),
    'pageIds': len(page.ids),
    'pageAnchorLinks': len(page.anchors),
    'fixedSources': len(sources['files']),
    'publishedProjects': manifest['projects'],
    'svgOriginalBytesRequired': not allow_svg_eol,
    'checks': [record for _, record, _ in results],
    'limits': 'HTTP/content/structure verification only. Upstream chat backend, calls, bridges, costs and product demand were not tested.'
}
(project / 'public-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['resourcesChecked', 'staticFiles', 'pageIds', 'pageAnchorLinks', 'fixedSources', 'svgOriginalBytesRequired']}))
