"""Verify public Pages responses against the built archive without browser automation."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import urllib.request

PROJECT = Path(__file__).resolve().parents[1]
BASE = 'https://yydshly.github.io/1014_codex_project/'
NAME = '010-evidence-research-lab/'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main(args):
    stamp = datetime.now(timezone.utc).isoformat()
    files = ['index.html', 'assets/understanding-map.png', 'assets/understanding-map.svg',
             'sources.json', 'understanding-map.json']
    targets = [(NAME + name, PROJECT / 'web/dist' / name) for name in files]
    targets += [('projects/' + NAME + 'assets/understanding-map.png', PROJECT / 'assets/understanding-map.png')]
    targets += [(name, None) for name in ['index.html', 'projects.json', 'entries.json',
                '004-jasonzhu-ai/research.html', '006-random-doors/research.html',
                '007-autumn-courtyard-blender/research.html', '014-cyber-xiaoya-study/']]

    def fetch(target):
        name, local = target
        request = urllib.request.Request(BASE + name + '?verify=' + args.source_commit[:12],
                                         headers={'User-Agent': '010-research-publication-check/1.0', 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read()
            assert response.status == 200, name
            content_type = response.headers.get('Content-Type', '')
        if local:
            assert body == local.read_bytes(), f'Public bytes differ: {name}'
        return name, body, {'url': BASE + name, 'status': 200, 'bytes': len(body),
                            'sha256': digest(body), 'content_type': content_type,
                            'matches_local_artifact': local is not None}

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, targets))
    bodies = {name: body for name, body, _ in results}
    html = bodies[NAME + 'index.html'].decode('utf-8')
    archive = json.loads(re.search(r'<script id="archive-data" type="application/json">([\s\S]*?)</script>', html)[1])
    assert archive['site_mode'] == 'public'
    for item in archive['researchSummary']:
        assert item['title'] in html and item['text'] in html
    assert not re.search(r'href="https?://(?:127\.0\.0\.1|localhost)', html)
    assert '<style>' in html and '.research-summary' in html and "$('#view-overview')" in html
    assert not re.search(r'<(?:script|link|img)[^>]+(?:src|href)=["\']https?:', html, re.I)
    ids = re.findall(r'\bid="([^"]+)"', html)
    assert len(ids) == len(set(ids))
    assert all(anchor in ids for anchor in re.findall(r'href="#([^"]+)"', html))
    catalog = json.loads(bodies['projects.json'])
    assert {p['id'] for p in catalog['projects']} == {'004', '006', '007', '010', '014'}
    item = next(p for p in catalog['projects'] if p['id'] == '010')
    assert item['preview'] == 'assets/understanding-map.png'
    assert item['summary'] == next(p for p in json.loads((PROJECT.parents[1] / 'projects.json').read_text(encoding='utf-8'))['projects'] if p['id'] == '010')['summary']
    entries = json.loads(bodies['entries.json'])['projects']['010']
    assert all(entry['path'].split('#')[-1] in ids for entry in entries)
    guide = digest(bodies[NAME + 'assets/understanding-map.png'])
    assert guide == archive['overview']['png_sha256']
    report = {'project': NAME.rstrip('/'), 'verified_at': stamp, 'source_commit': args.source_commit,
              'workflow_url': args.workflow_url, 'method': 'actual_public_http_and_local_artifact_comparison',
              'browser_visual_or_click_verification': 'not_performed_due_to_browser_policy',
              'guide_sha256': guide, 'html_sha256': digest(bodies[NAME + 'index.html']),
              'summary_sections': [s['title'] for s in archive['researchSummary']],
              'anchors_checked': len(ids), 'preserved_projects': ['004', '006', '007', '014'],
              'checks': [row for _, _, row in results]}
    record = Path(args.record)
    record.parent.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'verified_urls': len(results), 'anchors': len(ids), 'guide_sha256': guide,
                      'html_sha256': report['html_sha256'], 'record': str(record)}, ensure_ascii=True))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--workflow-url', required=True)
    parser.add_argument('--record', required=True)
    main(parser.parse_args())
