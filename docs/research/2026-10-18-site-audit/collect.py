"""Read-only public HTTP evidence; does not render or automate a browser."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).parent / 'evidence'
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.text = []; self.links = []; self.meta = []; self.title = False; self.titles = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'): self.skip += 1
        if tag == 'title': self.title = True
        if tag == 'a': self.links.append(a.get('href', ''))
        if tag == 'meta': self.meta.append(a)
        if tag == 'link' and a.get('rel') in ('canonical', 'alternate'): self.meta.append(a)
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip - 1)
        if tag == 'title': self.title = False
    def handle_data(self, data):
        if self.title: self.titles.append(data)
        if not self.skip and data.strip(): self.text.append(data.strip())

URLS = ['https://1989v.com/', 'https://1989v.com/tech', 'https://1989v.com/portfolio',
        'https://1989v.com/shop', 'https://1989v.com/search?q=Kafka',
        'https://1989v.com/audit-nonexistent-20261018',
        'https://game.1989v.com/', 'https://place.1989v.com/', 'https://place.1989v.com/en',
        'https://blog.1989v.com/', 'https://deal.1989v.com/', 'https://rank.1989v.com/',
        'https://1989v.com/robots.txt', 'https://1989v.com/sitemap.xml',
        'https://game.1989v.com/robots.txt', 'https://place.1989v.com/robots.txt',
        'https://1989v.com/api/v1/display/services']
def fetch(url):
    name = re.sub(r'[^a-zA-Z0-9]+', '_', url.removeprefix('https://')).strip('_')
    out = ROOT / (name + '.body')
    result = subprocess.run(['curl', '-sS', '-L', '--max-time', '25', '-o', str(out), '-w', '%{http_code}\t%{url_effective}\t%{content_type}\t%{time_total}', url], capture_output=True, text=True)
    body = out.read_text(errors='replace') if out.exists() else ''
    p = Page(); p.feed(body)
    row = {'url':url, 'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'curl':result.stdout, 'error':result.stderr, 'file':out.name, 'sha256':hashlib.sha256(body.encode()).hexdigest(), 'title':p.titles, 'meta':p.meta, 'links':p.links, 'text':'\n'.join(p.text), 'bytes':len(body.encode())}
    return row
if __name__ == '__main__':
    ROOT.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: rows = list(pool.map(fetch, URLS))
    (ROOT / 'http-audit.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    for r in rows:
        print(json.dumps({k:r[k] for k in ('url','curl','title','text','links')}, ensure_ascii=False)[:6500])
