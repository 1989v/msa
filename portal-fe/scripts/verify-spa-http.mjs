import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { extractRoutes, nginxRouteMap, NOT_FOUND_HTML } from './spa-routes.mjs';
const root = resolve(import.meta.dirname, '..');
const fixture = await mkdtemp(resolve(tmpdir(), 'site-audit-nginx-'));
const container = `site-audit-http-${process.pid}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
let started = false;
try {
  await mkdir(resolve(fixture, 'seo'), { recursive: true });
  await mkdir(resolve(fixture, 'games/fixture'), { recursive: true });
  await mkdir(resolve(fixture, 'assets'), { recursive: true });
  await writeFile(resolve(fixture, 'index.html'), '<main>SPA route fallback</main>');
  await writeFile(resolve(fixture, '404.html'), NOT_FOUND_HTML);
  await writeFile(resolve(fixture, 'games/fixture/index.html'), '<main>raw game frame</main>');
  await writeFile(resolve(fixture, 'assets/fixture.js'), 'console.log("static asset")');
  await writeFile(resolve(fixture, 'seo/spa-routes.conf'), nginxRouteMap(extractRoutes(await readFile(resolve(root, 'src/App.tsx'), 'utf8'))));
  await writeFile(resolve(fixture, 'nginx.conf'), (await readFile(resolve(root, 'nginx.conf'), 'utf8')).replaceAll('${NGINX_LOCAL_RESOLVERS}', '127.0.0.11'));
  docker('run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::80', '-v', `${fixture}:/usr/share/nginx/html:ro`, '-v', `${resolve(fixture, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`, 'nginx:1.27-alpine');
  started = true;
  const port = docker('port', container, '80/tcp').split(':').at(-1);
  const checks = [
    ['/audit-nonexistent-20261018', '1989v.com', 404],
    ['/unknown/path/', 'place.1989v.com', 404],
    ['/not-found.html', '1989v.com', 404],
    ['/shop/products/123?ref=test', '1989v.com', 200],
    ['/shop/products/123/', '1989v.com', 200],
    ['/SHOP/orders', '1989v.com', 200],
    ['/AUDIT-UNKNOWN', '1989v.com', 404],
    ['/en/attractions/13686', 'place.1989v.com', 200],
    ['/en/regions/11740', 'place.1989v.com', 200],
    ['/posts/example', 'blog.1989v.com', 200],
    ['/posts/example', '1989v.com', 404],
    ['/d/private', 'resume.1989v.com', 200],
    ['/d/private', '1989v.com', 404],
    ['/party/ABCD', 'game.1989v.com', 200],
    ['/games/fixture/index.html', 'game.1989v.com', 200],
    ['/assets/fixture.js', 'game.1989v.com', 200],
    ['/en/', 'game.1989v.com', 200],
    ['/oauth/callback?code=test', '1989v.com', 200],
  ];
  for (const [path, host, status] of checks) {
    const response = await new Promise((done, fail) => {
      const request = httpRequest(`http://127.0.0.1:${port}${path}`, { headers: { host } }, (message) => {
        let body = '';
        message.setEncoding('utf8');
        message.on('data', (chunk) => { body += chunk; });
        message.on('end', () => done({ status: message.statusCode, headers: message.headers, body }));
      });
      request.on('error', fail);
      request.end();
    });
    assert.equal(response.status, status, `${host}${path}`);
    if (status === 404) {
      assert.match(response.headers['x-robots-tag'] ?? '', /noindex/);
      assert.match(response.body, /홈으로 \/ Home/);
    }
  }
  console.log(`nginx HTTP: ${checks.length} checks passed (404/noindex, deep links, hosts, query, trailing slash, raw frame, static asset)`);
} finally {
  if (started) docker('rm', '-f', container);
  await rm(fixture, { recursive: true, force: true });
}
