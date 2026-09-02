// portal-fe/public 을 정적으로 낸다 — nginx 와 같은 규칙: Build/*.gz 는 Content-Encoding: gzip.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const port = Number(process.argv[3] || 8123);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.data': 'application/octet-stream', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  let ext = path.extname(file);
  const headers = { 'Cache-Control': 'no-store' };
  if (ext === '.gz') {
    headers['Content-Encoding'] = 'gzip';
    ext = path.extname(file.slice(0, -3));
  }
  headers['Content-Type'] = mime[ext] || 'application/octet-stream';
  headers['Content-Length'] = fs.statSync(file).size;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on ${port}`));
