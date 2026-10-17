// 시장 바탕만 렌더한다. 로컬 실행은 --upload 를 명시하지 않으면 외부에 쓰지 않는다.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

export const WIDTH = 1536, HEIGHT = 1152;
export const STYLE_VERSION = 'openfreemap-positron-fiord-maplibre-4.7.1-z18-v1';
const API = 'https://place.1989v.com/api/v1/place/markets';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const execute = promisify(execFile);

export function centerOf(detail) {
  const polygon = detail.boundary?.polygon;
  const valid = point => Array.isArray(point) && point.length === 2 &&
    point.every(value => typeof value === 'number' && Number.isFinite(value)) &&
    Math.abs(point[0]) <= 85.0511287798066 && Math.abs(point[1]) <= 180;
  if (polygon != null) {
    if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(valid)) throw new Error('Invalid boundary polygon');
    const vertices = [...polygon];
    if (vertices[0][0] === vertices.at(-1)[0] && vertices[0][1] === vertices.at(-1)[1]) vertices.pop();
    if (vertices.length < 3) throw new Error('Boundary needs three vertices');
    return [0, 1].map(axis => vertices.reduce((sum, vertex) => sum + vertex[axis], 0) / vertices.length);
  }
  const point = [detail.market?.latitude, detail.market?.longitude];
  if (!valid(point)) throw new Error('Invalid market latitude/longitude');
  return point;
}

export async function retry(operation) {
  for (let attempt = 1; ; attempt++) {
    try { return await operation(attempt); }
    catch (error) { if (attempt === 3) throw error; await sleep(500 * attempt); }
  }
}

export function manifest(theme, requested, succeeded, failed) {
  return { renderedAt: new Date().toISOString(), styleVersion: STYLE_VERSION, theme,
    requestedContentIds: requested, contentIds: succeeded, failed };
}
export function exceedsThreshold(index) { return index.failed.length / index.requestedContentIds.length > 0.05; }

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`API HTTP ${response.status}`);
  const body = await response.json();
  if (body.success !== true || body.data == null) throw new Error('Invalid API envelope');
  return body.data;
}

export function parseArgs(args) {
  const options = { theme: 'both', out: './out', upload: false, merge: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--upload') options.upload = true;
    else if (arg === '--merge-index') options.merge = true;
    else if (['--only', '--theme', '--out'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['light', 'dark', 'both'].includes(options.theme)) throw new Error('Theme must be light, dark or both');
  if (options.only !== undefined) {
    options.ids = [...new Set(options.only.trim().split(/[\s,]+/).filter(Boolean))];
    if (!options.ids.length || !options.ids.every(id => /^\d+$/.test(id))) throw new Error('--only requires numeric content IDs');
  }
  return options;
}

function uploadBase() {
  const value = process.env.MARKET_BASEMAP_PAR;
  try { const url = new URL(value); if (url.protocol === 'https:' && url.pathname.endsWith('/o/') && !url.search && !url.hash) return value; } catch {}
  throw new Error('MARKET_BASEMAP_PAR must be a full HTTPS PAR URL ending /o/');
}
async function upload(base, key, file, contentType) {
  // curl 의 stderr/실행 인수를 오류에 담지 않는다: PAR 는 비밀이다.
  try {
    await execute('curl', ['-fsS', '--connect-timeout', '20', '--max-time', '120', '-X', 'PUT', '-H',
      `Content-Type: ${contentType}`, '--data-binary', `@${file}`, `${base}${key}`], { timeout: 125000 });
  } catch { throw new Error(`Object upload failed: ${key}`); }
}

async function findChrome() {
  const candidates = process.env.CHROME_BIN ? [process.env.CHROME_BIN] : [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ...(process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir, 'google-chrome')),
  ];
  for (const candidate of candidates) { try { await access(candidate, constants.X_OK); return candidate; } catch {} }
  throw new Error('Chrome not found. Install Google Chrome or set CHROME_BIN to its executable.');
}

function html(center, theme) {
  const style = `https://tiles.openfreemap.org/styles/${theme === 'light' ? 'positron' : 'fiord'}`;
  return `<!doctype html><meta charset="utf-8"><style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden}.maplibregl-control-container{display:none!important}</style><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"><div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script><script>
window.statusResult={ready:false,error:null};
window.onerror=()=>{window.statusResult.error='Page script failed'};
try {
 const map=new maplibregl.Map({container:'map',style:${JSON.stringify(style)},center:${JSON.stringify([center[1], center[0]])},zoom:18,bearing:0,pitch:0,interactive:false,attributionControl:false,fadeDuration:0,preserveDrawingBuffer:true});
 map.on('error',()=>{window.statusResult.error='Map style, glyph or tile failed'});
 map.on('idle',()=>{if(map.isStyleLoaded()&&map.areTilesLoaded())requestAnimationFrame(()=>requestAnimationFrame(()=>{window.statusResult.ready=true}));});
} catch(e){window.statusResult.error='Map initialization failed'}
</script>`;
}

async function createBrowser(chromePath) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'market-basemaps-'));
  const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'], { stdio: 'ignore', detached: true });
  let spawnError;
  chrome.on('error', error => { spawnError = error; });
  let socket;
  const cleanup = async () => {
    socket?.terminate();
    if (chrome.exitCode === null && chrome.signalCode === null) {
      const exited = new Promise(resolve => chrome.once('exit', resolve));
      try { process.kill(-chrome.pid, 'SIGKILL'); } catch { chrome.kill('SIGKILL'); }
      await Promise.race([exited, sleep(3000)]);
    }
    await rm(profile, { recursive: true, force: true });
  };
  try {
    let port;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (spawnError || chrome.exitCode !== null || chrome.signalCode !== null) {
        throw new Error(`Chrome failed to start (${spawnError ? 'spawn error' : chrome.signalCode || `exit ${chrome.exitCode}`})`);
      }
      try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await sleep(100); }
    }
    if (!port) throw new Error('Chrome debugging startup timed out');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) })).json();
    const page = targets.find(target => target.type === 'page');
    if (!page) throw new Error('Chrome has no render page');
    socket = new WebSocket(page.webSocketDebuggerUrl, { handshakeTimeout: 5000 });
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    let id = 0;
    const pending = new Map();
    socket.on('error', () => {});
    socket.on('close', () => { for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Chrome disconnected')); } pending.clear(); });
    socket.on('message', message => {
      const response = JSON.parse(message.toString());
      const entry = pending.get(response.id);
      if (!entry) return;
      clearTimeout(entry.timer); pending.delete(response.id);
      if (response.error) entry.reject(new Error(`CDP ${response.error.message}`)); else entry.resolve(response.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    return { send, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

async function screenshot(browser, url, file) {
  await browser.send('Page.navigate', { url });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const result = await browser.send('Runtime.evaluate', { expression: '({url:location.href,state:window.statusResult})', returnByValue: true });
    const value = result.result?.value;
    const state = value?.url === url ? value.state : null;
    if (state?.error) throw new Error(state.error);
    if (state?.ready) {
      const { data } = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const png = Buffer.from(data, 'base64');
      if (png.readUInt32BE(16) !== WIDTH || png.readUInt32BE(20) !== HEIGHT) throw new Error('Unexpected PNG dimensions');
      await writeFile(file, png);
      return;
    }
    await sleep(250);
  }
  throw new Error('Map idle/tiles timed out (90s)');
}

export async function mergeIndexes(directory, theme) {
  const themes = theme === 'both' ? ['light', 'dark'] : [theme];
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/^index-(light|dark)\.json$/.test(entry.name)) files.push(file);
    }
  }
  await walk(directory);
  const indexes = [];
  for (const selected of themes) {
    const matches = files.filter(file => path.basename(file) === `index-${selected}.json`);
    if (matches.length !== 1) throw new Error(`Expected one ${selected} manifest, found ${matches.length}`);
    const index = JSON.parse(await readFile(matches[0], 'utf8'));
    if (index.theme !== selected || index.styleVersion !== STYLE_VERSION || !index.requestedContentIds?.length) throw new Error('Invalid theme manifest');
    indexes.push(index);
  }
  const requested = [...new Set(indexes.flatMap(index => index.requestedContentIds))];
  const successful = requested.filter(id => indexes.every(index => index.contentIds.includes(id)));
  return { ...manifest(theme, requested, successful, indexes.flatMap(index => index.failed.map(failure => ({ ...failure, theme: index.theme })))), themes: Object.fromEntries(indexes.map(index => [index.theme, index])) };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const base = options.upload ? uploadBase() : null;
  await mkdir(options.out, { recursive: true });
  if (options.merge) {
    const index = await mergeIndexes(options.out, options.theme);
    const file = path.join(options.out, 'index.json');
    await writeFile(file, JSON.stringify(index, null, 2));
    if (base) await upload(base, 'markets/index.json', file, 'application/json');
    console.log(`Aggregate: requested ${index.requestedContentIds.length}, complete ${index.contentIds.length}, failed theme renders ${index.failed.length}`);
    return Object.values(index.themes).some(exceedsThreshold) ? 1 : 0;
  }
  const chromePath = await findChrome();
  const ids = options.ids || await retry(() => fetchJson(`${API}/content-ids`));
  if (!Array.isArray(ids) || !ids.length || !ids.every(id => /^\d+$/.test(String(id)))) throw new Error('Market content IDs must be a nonempty numeric array');
  const requested = [...new Set(ids.map(String))];
  const themes = options.theme === 'both' ? ['light', 'dark'] : [options.theme];
  let pageHtml = '';
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(pageHtml);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const cleanup = async () => { if (browser) { await browser.cleanup(); browser = null; } await new Promise(resolve => server.close(resolve)); };
  const interrupted = () => { cleanup().finally(() => process.exit(130)); };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  let failedThreshold = false;
  try {
    for (const theme of themes) {
      const succeeded = [], failed = [];
      for (const id of requested) {
        try {
          await retry(async () => {
            const center = centerOf(await fetchJson(`${API}/${id}?lang=ko`));
            pageHtml = html(center, theme);
            const directory = path.join(options.out, 'markets', id);
            await mkdir(directory, { recursive: true });
            const file = path.join(directory, `z18-${theme}.png`);
            try {
              browser ||= await createBrowser(chromePath);
              await screenshot(browser, `http://127.0.0.1:${server.address().port}/?market=${id}&theme=${theme}&t=${Date.now()}`, file);
            } catch (error) { if (browser) await browser.cleanup(); browser = null; throw error; }
            if (base) await upload(base, `markets/${id}/z18-${theme}.png`, file, 'image/png');
          });
          succeeded.push(id); console.log(`${theme} ${id}: OK`);
        } catch (error) { failed.push({ contentId: id, error: error.message }); console.error(`${theme} ${id}: ${error.message}`); }
      }
      const index = manifest(theme, requested, succeeded, failed);
      await writeFile(path.join(options.out, `index-${theme}.json`), JSON.stringify(index, null, 2));
      console.log(`${theme}: requested ${requested.length}, success ${succeeded.length}, failed ${failed.length}`);
      failedThreshold ||= exceedsThreshold(index);
    }
    // CI 는 per-theme artifact 를 합친 마지막 잡에서만 index.json 을 업로드한다.
    const index = await mergeIndexes(options.out, options.theme);
    const file = path.join(options.out, 'index.json');
    await writeFile(file, JSON.stringify(index, null, 2));
    return failedThreshold ? 1 : 0;
  } finally {
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
    await cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
