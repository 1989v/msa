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
  await mkdir(resolve(fixture, 'search-icons'), { recursive: true });
  for (const size of [192, 512]) await writeFile(resolve(fixture, `search-icons/search-${size}.png`), await readFile(resolve(root, `public/search-icons/search-${size}.png`)));
  await writeFile(resolve(fixture, 'search.webmanifest'), await readFile(resolve(root, 'public/search.webmanifest')));
  await writeFile(resolve(fixture, 'index.html'), '<main>SPA route fallback</main>');
  await writeFile(resolve(fixture, '404.html'), NOT_FOUND_HTML);
  await writeFile(resolve(fixture, 'games/fixture/index.html'), '<main>raw game frame</main>');
  await writeFile(resolve(fixture, 'assets/fixture.js'), 'console.log("static asset")');
  await writeFile(resolve(fixture, 'seo/spa-routes.conf'), nginxRouteMap(extractRoutes(await readFile(resolve(root, 'src/App.tsx'), 'utf8'))));
  await writeFile(resolve(fixture, 'nginx.conf'), (await readFile(resolve(root, 'nginx.conf'), 'utf8')).replaceAll('${NGINX_LOCAL_RESOLVERS}', '127.0.0.11'));
  docker('run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::80', '-v', `${fixture}:/usr/share/nginx/html:ro`, '-v', `${resolve(fixture, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`, 'nginx:1.27-alpine');
  started = true;
  const port = docker('port', container, '80/tcp').split(':').at(-1);
  const get = (path, host = '1989v.com') => new Promise((done, fail) => {
    const request = httpRequest(`http://127.0.0.1:${port}${path}`, { headers: { host } }, message => {
      const chunks = [];
      message.on('data', chunk => chunks.push(chunk));
      message.on('end', () => done({ status: message.statusCode, headers: message.headers, bytes: Buffer.concat(chunks), body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', fail); request.end();
  });
  const encodedName = '검색'.padEnd(16, ' ').split('').map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const safe = await get(`/app.webmanifest?start=/cafe/%EC%BB%A4%ED%94%BC&name=${encodedName}`);
  assert.equal(safe.status, 200);
  assert.match(safe.headers['content-type'], /application\/manifest\+json/);
  assert.equal(safe.headers['cache-control'], 'no-store');
  assert.equal(JSON.parse(safe.body).name.trim(), '검색');
  assert.equal(JSON.parse(safe.body).start_url, '/cafe/%EC%BB%A4%ED%94%BC');
  assert.equal(JSON.parse(safe.body).id, '/cafe/%EC%BB%A4%ED%94%BC');
  assert.equal(JSON.parse(safe.body).scope, '/');
  assert.equal(JSON.parse((await get('/app.webmanifest?start=/cafe/drink/Cold%20Brew%28Large%29')).body).start_url, '/cafe/drink/Cold%20Brew%28Large%29');
  const injectionTitle = 'x"},"scope":"//e'.padEnd(16, ' ');
  const injectionName = injectionTitle.split('').map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const escaped = JSON.parse((await get(`/app.webmanifest?start=/cafe&name=${injectionName}`)).body);
  assert.equal(escaped.name, injectionTitle); assert.equal(escaped.scope, '/'); assert.equal(escaped.start_url, '/cafe');
  const invalid = ['https://evil.test', '//evil.test', '/%2F%2Fevil.test', '/%22', '/%5C', '/%0d%0aInjected', '/%ZZ', '/%FF', '/%ED%A0%80', '/%2522', '/%2E', '/x/../secret', '/../secret', '/d/private', '/shared/AbCd012345', '/party/ABCD', '/en/party/ABCD', '/resume/d/private', '/oauth/callback', '/' + 'x'.repeat(512), '/cafe?token=secret'];
  for (const path of invalid) {
    const result = await get(`/app.webmanifest?start=${path}&name=%22%0d%0aInjected`);
    assert.equal(result.status, 200, path);
    const manifest = JSON.parse(result.body);
    assert.equal(manifest.start_url, '/', path);
    assert.equal(manifest.name, '1989v');
    assert.equal(result.headers.injected, undefined);
  }
  assert.equal(JSON.parse((await get('/app.webmanifest?start=/cafe&token=secret')).body).start_url, '/cafe');
  assert.equal(JSON.parse((await get('/app.webmanifest', 'place.1989v.com')).body).name, '1989v 장소');
  assert.equal((await get('/app.webmanifest?start=/d/private', 'resume.1989v.com')).status, 404);
  const legacy = JSON.parse((await get('/search.webmanifest')).body);
  assert.equal(legacy.id, '/search'); assert.equal(legacy.start_url, '/search'); assert.equal(legacy.scope, '/search');
  for (const size of [192, 512]) {
    const icon = await get(`/search-icons/search-${size}.png`);
    assert.equal(icon.status, 200); assert.match(icon.headers['content-type'], /image\/png/);
    assert.equal(icon.bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(icon.bytes.readUInt32BE(16), size); assert.equal(icon.bytes.readUInt32BE(20), size);
  }
  console.log(`nginx PWA HTTP: Korean path/title, ${invalid.length} invalid/injection cases, privacy, hosts, legacy and PNG 192/512 passed`);
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
