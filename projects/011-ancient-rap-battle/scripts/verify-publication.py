"""Verify the deployed static site against existing local output; no model calls."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
import argparse
import json

P = Path(__file__).resolve().parents[1]
SITE = 'https://yydshly.github.io/1014_codex_project/'
NAME = '011-ancient-rap-battle/'


def request(url, method='GET', headers=None):
    return urlopen(Request(url, method=method, headers={'User-Agent': '011-publication-verification/1.0', **(headers or {})}), timeout=45)


def verify_file(item):
    url = SITE + NAME + item['path']
    # Every file is requested. Large historical media use HEAD plus actual ranges;
    # the final film is also streamed end-to-end for an independent SHA match.
    full = item['bytes'] <= 8_000_000 or item['path'] == 'media/repaired-film-004/ya-zhou-ren-jian-audio-driven.mp4'
    with request(url, 'GET' if full else 'HEAD') as r:
        assert r.status == 200, (url, r.status)
        result = {'path': item['path'], 'status': r.status, 'expected_bytes': item['bytes']}
        assert int(r.headers['Content-Length']) == item['bytes'], url
        if full:
            digest = sha256()
            total = 0
            while chunk := r.read(1024 * 1024):
                digest.update(chunk)
                total += len(chunk)
            assert total == item['bytes'] and digest.hexdigest() == item['sha256'], url
            result['sha256_matched'] = True
    if item['path'].endswith(('.mp4', '.mp3', '.wav')):
        local = P / 'web/dist' / item['path']
        for start, end in [(0, 31), (item['bytes']-32, item['bytes']-1)]:
            with request(url, headers={'Range': f'bytes={start}-{end}'}) as r:
                assert r.status == 206, (url, r.status)
                assert r.headers['Content-Range'] == f'bytes {start}-{end}/{item["bytes"]}', url
                with local.open('rb') as f:
                    f.seek(start)
                    assert r.read() == f.read(32), url
        result['first_last_ranges_matched'] = True
    return result


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.anchors = [], []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if d.get('id'):
            self.ids.append(d['id'])
        if tag == 'a' and d.get('href', '').startswith('#') and len(d['href']) > 1:
            self.anchors.append(d['href'][1:])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads((P / 'publication-static-manifest.json').read_text(encoding='utf-8'))
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(verify_file, manifest['files']))
    with request(SITE + NAME) as r:
        html = r.read().decode('utf-8')
    links = Links()
    links.feed(html)
    assert len(links.ids) == len(set(links.ids)), 'duplicate HTML IDs'
    assert not set(links.anchors) - set(links.ids), 'broken in-page anchors'
    for term in ['库的效果与能力', '我们的探索与成果', '核心机制与修正', '价值与思考', '可以扩展的方向']:
        assert term in html, term
    assert '127.0.0.1' not in html and 'localhost' not in html
    existing = []
    for name, path in [
        ('site-index', ''), ('004', '004-jasonzhu-ai/research.html'),
        ('006', '006-random-doors/research.html'), ('007', '007-autumn-courtyard-blender/research.html'),
        ('009', '009-demand-discovery/'), ('010', '010-evidence-research-lab/'), ('014', '014-cyber-xiaoya-study/'),
        ('011-index-guide', 'projects/011-ancient-rap-battle/assets/ancient-rap-battle-research-overview.png'),
    ]:
        with request(SITE + path) as r:
            assert r.status == 200
            row = {'name': name, 'url': SITE + path, 'status': r.status}
            if name == '011-index-guide':
                assert sha256(r.read()).hexdigest() == 'cbe55cde30b35917581c986454e7a86542ce4d3832711133cd421c2431a32990'
                row['original_guide_sha256_matched'] = True
            existing.append(row)
    with request(SITE + 'projects.json') as r:
        catalog = json.load(r)
    item = next(p for p in catalog['projects'] if p['id'] == '011')
    assert item['preview'] == 'assets/ancient-rap-battle-research-overview.png'
    assert '94.64' in item['summary']
    report = {
        'verified_at': datetime.now(timezone.utc).isoformat(), 'base_url': SITE + NAME,
        'static_files': len(results), 'files': results, 'existing_entries_and_guide': existing,
        'unique_html_ids': len(links.ids), 'valid_anchor_links': len(links.anchors),
        'catalog_guide_and_summary_verified': True,
        'checks': 'HTTP, exact bytes/SHA for small assets and final film, all media first/last ranges, anchors and preserved site entries',
        'limits': 'Does not constitute subjective audio or complete lip-sync acceptance; browser review recorded separately.',
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in {'files', 'existing_entries_and_guide'}}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
