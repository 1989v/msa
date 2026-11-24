#!/usr/bin/env python3
"""Verify actual nginx prompt entry HTML, host boundaries and robots headers. Requires Docker; no UI."""
import http.client
import pathlib
import subprocess
import tempfile
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def main():
    run('docker', 'info', '--format', '{{.ServerVersion}}')
    name = 'peer-prompts-' + uuid.uuid4().hex[:10]
    with tempfile.TemporaryDirectory(prefix='peer-prompts-nginx-') as work:
        work = pathlib.Path(work)
        html = work / 'html'
        (html / 'seo').mkdir(parents=True)
        (html / 'index.html').write_text('SPA-SHELL')
        (html / '404.html').write_text('NOT-FOUND')
        intro = html / 'prerender/_hosts/rank.1989v.com/prompts.html'
        intro.parent.mkdir(parents=True)
        intro.write_text('PEER-PROMPTS-INTRO')
        route_map = run('node', '--input-type=module', '-e',
                        "import{readFileSync}from'node:fs';import{extractRoutes,nginxRouteMap}from'./scripts/spa-routes.mjs';"
                        "process.stdout.write(nginxRouteMap(extractRoutes(readFileSync('src/App.tsx','utf8'))));")
        (html / 'seo/spa-routes.conf').write_text(route_map)
        config = work / 'default.conf.template'
        config.write_text((ROOT / 'nginx.conf').read_text())
        try:
            run('docker', 'run', '-d', '--name', name, '-p', '127.0.0.1::80',
                '-e', 'NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1', '-e', 'NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS',
                '-v', f'{config}:/etc/nginx/templates/default.conf.template:ro',
                '-v', f'{html}:/usr/share/nginx/html:ro', 'nginx:1.27-alpine')
            port = int(run('docker', 'port', name, '80/tcp').rsplit(':', 1)[1])

            def fetch(host, path):
                connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
                connection.request('GET', path, headers={'Host': host})
                response = connection.getresponse()
                result = response.status, dict(response.getheaders()), response.read().decode()
                connection.close()
                return result

            for _ in range(50):
                try:
                    fetch('rank.1989v.com', '/prompts')
                    break
                except (ConnectionError, http.client.HTTPException):
                    time.sleep(.2)
            print(run('docker', 'exec', name, 'nginx', '-t'))
            count = 0
            for query in ['', '?domain=SOFTWARE']:
                status, headers, body = fetch('rank.1989v.com', '/prompts' + query)
                assert status == 200 and body == 'PEER-PROMPTS-INTRO', (status, body)
                assert bool(headers.get('X-Robots-Tag')) == bool(query), headers
                status, headers, _ = fetch('rank.1989v.com', '/prompts/' + query)
                assert status == 308 and headers['Location'] == '/prompts' + query, headers
                count += 2
            for host in ['rank.1989v.com', 'localhost', '127.0.0.1']:
                for path in ['/prompts/new', '/prompts/new/', '/prompts/1', '/prompts/123?source=share']:
                    status, headers, body = fetch(host, path)
                    assert status == 200 and body == 'SPA-SHELL', (host, path, status, body)
                    assert headers.get('X-Robots-Tag') == 'noindex, follow', headers
                    assert headers.get('Cache-Control') == 'private, no-store', headers
                    count += 1
            for host in ['1989v.com', 'blog.1989v.com', 'game.1989v.com', 'place.1989v.com', 'resume.1989v.com', 'ads.1989v.com', 'preview.example.com']:
                for path in ['/prompts', '/prompts/', '/prompts/new', '/prompts/7']:
                    status, headers, body = fetch(host, path)
                    assert status == 404 and body == 'NOT-FOUND', (host, path, status, body)
                    assert 'noindex' in headers.get('X-Robots-Tag', ''), headers
                    count += 1
            for path in ['/prompts/nope', '/prompts/0', '/prompts/-1', '/prompts/1/reviews', '/Prompts', '/PROMPTS/new']:
                status, _, body = fetch('rank.1989v.com', path)
                assert status == 404 and body == 'NOT-FOUND', (path, status, body)
                count += 1
            print(f'PASSED: {count} nginx peer prompt HTTP entry/host/robots checks')
        finally:
            subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, check=False)


if __name__ == '__main__':
    main()
