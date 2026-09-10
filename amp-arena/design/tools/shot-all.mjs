// canvas.json 의 아트보드를 전부 찍는다. 사용: node shot-all.mjs <port> <canvasDir> <outDir> [name...]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { shoot } from './cdp.mjs';

const [port, canvasDir, outDir, ...only] = process.argv.slice(2);
if (!port || !canvasDir || !outDir) {
  console.error('usage: node shot-all.mjs <port> <canvasDir> <outDir> [artboardName...]');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(resolve(canvasDir, 'canvas.json'), 'utf8'));
for (const ab of manifest.artboards) {
  const name = ab.file.replace(/\.dc\.html$/, '');
  if (only.length && !only.includes(name)) continue;
  const url = pathToFileURL(resolve(canvasDir, ab.file)).href;
  const out = resolve(outDir, `${name}.png`);
  const r = await shoot({ port, url, out, width: ab.w, height: ab.h });
  const overflow = r.info.w > ab.w || r.info.h > ab.h ? ` OVERFLOW content ${r.info.w}x${r.info.h} > frame ${ab.w}x${ab.h}` : '';
  console.log(`${name}: ${ab.w}x${ab.h}${overflow} ${r.errors.length ? 'errors: ' + r.errors.join(' | ') : ''}`);
}
