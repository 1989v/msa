#!/usr/bin/env python3
"""Real nginx HTTP contract; no browser or UI automation. Requires Docker."""
import http.client
import pathlib
import subprocess
import tempfile
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def main():
    run('docker', 'info', '--format', '{{.ServerVersion}}')
    name = 'seo-alias-' + uuid.uuid4().hex[:10]
    with tempfile.TemporaryDirectory(prefix='seo-alias-') as work:
        work = pathlib.Path(work)
        html = work / 'html'
        (html / 'games/test').mkdir(parents=True)
        (html / 'assets').mkdir()
        (html / 'index.html').write_text('SPA-SHELL')
        (html / 'games/test/index.html').write_text('GAME-FRAME')
        (html / 'games/test/game.js').write_text('GAME-ASSET')
        (html / 'assets/app.js').write_text('APP-ASSET')
        config = work / 'default.conf.template'
        config.write_text((ROOT / 'nginx.conf').read_text())
        try:
            run('docker', 'run', '-d', '--name', name, '-p', '127.0.0.1::80',
                '-e', 'NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1',
                '-e', 'NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS',
                '-v', f'{config}:/etc/nginx/templates/default.conf.template:ro',
                '-v', f'{html}:/usr/share/nginx/html:ro', 'nginx:1.27-alpine')
            port = int(run('docker', 'port', name, '80/tcp').rsplit(':', 1)[1])

            def fetch(host, path):
                conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
                conn.request('GET', path, headers={'Host': host})
                response = conn.getresponse()
                result = response.status, dict(response.getheaders()), response.read().decode()
                conn.close()
                return result

            for _ in range(50):
                try:
                    fetch('localhost', '/')
                    break
                except (ConnectionError, http.client.HTTPException):
                    time.sleep(.2)
            print(run('docker', 'exec', name, 'nginx', '-t'))
            count = 0

            def redirect(host, path, target):
                nonlocal count
                status, headers, _ = fetch(host, path)
                assert (status, headers.get('Location')) == (301, target), (host, path, status, headers)
                count += 1

            query = '?utm_source=a%2Fb&x=1&x=2&empty='
            for path in ['/en', '/en/']:
                redirect('1989v.com', path + query, 'https://game.1989v.com/en' + query)
            for host in ['1989v.com', 'place.1989v.com']:
                for prefix, canonical in [('', ''), ('/en', '/en')]:
                    redirect(host, prefix + '/place' + query, 'https://place.1989v.com' + (canonical or '/') + query)
                    for tail in ['/attractions/123', '/attractions/123/market', '/regions/11', '/regions/11110']:
                        redirect(host, prefix + '/place' + tail + query, 'https://place.1989v.com' + canonical + tail + query)
            for prefix in ['', '/en']:
                for tail in ['/attractions/123', '/attractions/123/market', '/regions/11', '/regions/11110/parking']:
                    redirect('1989v.com', prefix + tail + query, 'https://place.1989v.com' + prefix + tail + query)
                for tail in ['/games/test', '/games/genre/puzzle', '/draw']:
                    redirect('1989v.com', prefix + tail + query, 'https://game.1989v.com' + prefix + tail + query)
                for host in ['1989v.com', 'game.1989v.com']:
                    for slash in ['', '/']:
                        redirect(host, prefix + '/games' + slash + query, 'https://game.1989v.com' + (prefix or '/') + query)
            for tail in ['/guides', '/guides/seoul']:
                redirect('1989v.com', tail + query, 'https://place.1989v.com' + tail + query)

            # Local, preview and other service hosts keep their current routes.
            for host in ['localhost', '127.0.0.1', 'preview.example.com', 'blog.1989v.com', 'resume.1989v.com']:
                for path in ['/games', '/games/test', '/place', '/place/attractions/123']:
                    status, headers, _ = fetch(host, path)
                    assert status != 301 and 'Location' not in headers, (host, path, status, headers)
                    count += 1
            for host in ['1989v.com', 'game.1989v.com']:
                for path, text in [('/games/test/index.html', 'GAME-FRAME'), ('/games/test/game.js', 'GAME-ASSET'), ('/assets/app.js', 'APP-ASSET')]:
                    status, headers, body = fetch(host, path)
                    assert status == 200 and body == text and 'Location' not in headers, (host, path, status)
                    if path.endswith('index.html'):
                        assert headers.get('X-Robots-Tag') == 'noindex, follow'
                    count += 1
            for host in ['game.1989v.com', 'localhost', 'resume.1989v.com']:
                for path in ['/party', '/en/party/room', '/party?invite=a']:
                    status, headers, _ = fetch(host, path)
                    assert status == 200 and 'noindex' in headers.get('X-Robots-Tag', '') and 'Location' not in headers
                    if host == 'resume.1989v.com':
                        assert headers.get('X-Robots-Tag') == 'noindex, nofollow'
                    count += 1
            for path in ['/?r=', '/?%72=abc', '/?x=1&r=abc&r=def']:
                status, headers, _ = fetch('game.1989v.com', path)
                assert status == 200 and headers.get('X-Robots-Tag') == 'noindex, follow'
                count += 1
            # The same original request keeps its private policy when a host
            # prerender exists, and when try_files falls back to index.html.
            host_pages = html / 'prerender/_hosts'
            host_pages.mkdir(parents=True)
            (host_pages / 'game.1989v.com.html').write_text('GAME-HUB')
            status, headers, body = fetch('game.1989v.com', '/?r=abc')
            assert status == 200 and body == 'GAME-HUB' and headers.get('X-Robots-Tag') == 'noindex, follow'
            count += 1
            for host, path in [('game.1989v.com', '/'), ('game.1989v.com', '/en?r=abc'),
                               ('game.1989v.com', '/draw?r=abc'), ('place.1989v.com', '/en'),
                               ('1989v.com', '/')]:
                status, headers, _ = fetch(host, path)
                assert status == 200 and not headers.get('X-Robots-Tag') and 'Location' not in headers
                count += 1
            for path in ['/tour', '/en/tour', '/place/attractions/not-an-id', '/games/test/unknown']:
                status, headers, _ = fetch('1989v.com', path)
                assert status != 301 and 'Location' not in headers
                count += 1
            print(f'PASSED: {count} nginx HTTP public alias/private/asset/host checks')
        finally:
            subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, check=False)


if __name__ == '__main__':
    main()
