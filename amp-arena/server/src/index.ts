// AMP ARENA 서버 — HTTP(정적 클라 배포본) + WebSocket(/ws).
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Lobby } from './lobby.ts';
import { Session } from './session.ts';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../../client/dist');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (!existsSync(DIST)) { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('AMP ARENA server. 클라이언트 빌드(client/dist)가 없습니다 — 개발 중에는 vite 를 쓰세요.'); return; }
  const url = new URL(req.url ?? '/', 'http://x');
  let file = normalize(join(DIST, url.pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' });
  res.end(readFileSync(file));
});

const lobby = new Lobby();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  const s = new Session(ws, lobby);
  lobby.add(s);
});

server.listen(PORT, HOST, () => {
  console.log(`AMP ARENA server on http://${HOST}:${PORT} (ws: /ws) · client dist ${existsSync(DIST) ? 'found' : 'missing'}`);
});
