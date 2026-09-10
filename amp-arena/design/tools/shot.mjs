// 사용: node shot.mjs <port> <fileUrl> <out.png> [width] [height]
import { shoot } from './cdp.mjs';

const [port, url, out, w = '1280', h = '720'] = process.argv.slice(2);
if (!port || !url || !out) {
  console.error('usage: node shot.mjs <port> <fileUrl> <out.png> [w] [h]');
  process.exit(2);
}
const r = await shoot({ port, url, out, width: Number(w), height: Number(h) });
console.log(r.out, JSON.stringify(r.info), r.errors.length ? `errors: ${r.errors.join(' | ')}` : 'errors: 0');
