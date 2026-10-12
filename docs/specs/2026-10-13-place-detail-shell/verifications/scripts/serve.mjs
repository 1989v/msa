// 로컬 측정용 서버 — portal-fe dist 를 SPA 로 내고 /api 는 운영 place 호스트로 넘긴다.
// 계측 수집(/api/v1/events)은 운영 원장에 들어가지 않게 여기서 202 로 끝낸다.
// 사용: node serve.mjs <dist 경로> <포트>  → http://place.localhost:<포트>/ 로 연다(호스트 첫 마디가 place 라 place 셸이 뜬다)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [dist, port] = [process.argv[2], Number(process.argv[3] ?? 4317)];
const UPSTREAM = 'https://place.1989v.com';
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/v1/events')) { res.writeHead(202).end(); return; }
  if (url.pathname.startsWith('/api/')) {
    try {
      const r = await fetch(UPSTREAM + url.pathname + url.search, { headers: { accept: 'application/json', 'user-agent': req.headers['user-agent'] ?? '' } });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json' }).end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.writeHead(502).end(String(e)); }
    return;
  }
  const file = normalize(join(dist, url.pathname));
  const ext = extname(file);
  if (ext && file.startsWith(dist)) {
    try { res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream' }).end(await readFile(file)); return; } catch { /* 폴백 */ }
  }
  res.writeHead(200, { 'content-type': TYPES['.html'] }).end(await readFile(join(dist, 'index.html')));
}).listen(port, '127.0.0.1', () => console.log(`serve ${dist} :${port}`));
