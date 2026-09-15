// 헤드리스 크롬 + CDP 클라이언트. 의존성 0 (Node 22 내장 WebSocket · http · child_process).
// 크롬은 이 프로세스가 켜고 이 프로세스가 끈다 — 측정이 끝난 뒤 브라우저가 남아
// 소프트웨어 GL 을 계속 돌리는 사고를 구조적으로 막는다.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_CANDIDATES = [
  process.env.FORGE_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

// KeyboardEvent.code → { key, vk }. 게임이 controls() 에 code 를 적으면 여기서 실제 키 이벤트로 바꾼다.
export function keyInfo(code) {
  if (/^Key[A-Z]$/.test(code)) { const c = code[3]; return { key: c.toLowerCase(), vk: c.charCodeAt(0) }; }
  if (/^Digit[0-9]$/.test(code)) { const d = code[5]; return { key: d, vk: d.charCodeAt(0) }; }
  const table = {
    ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
    Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9], Backspace: ['Backspace', 8],
    ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17], ControlRight: ['Control', 17],
    AltLeft: ['Alt', 18], AltRight: ['Alt', 18], Comma: [',', 188], Period: ['.', 190], Slash: ['/', 191],
    Semicolon: [';', 186], Quote: ["'", 222], BracketLeft: ['[', 219], BracketRight: [']', 221], Minus: ['-', 189], Equal: ['=', 187],
  };
  const t = table[code];
  if (!t) throw new Error(`알 수 없는 KeyboardEvent.code: ${code}`);
  return { key: t[0], vk: t[1] };
}

// 포트는 게임 폴더 경로에서 결정한다 — 같은 폴더는 항상 같은 포트, 다른 폴더는 다른 포트.
// 매번 임의 포트를 쓰면 실행 50번에 포트 100개가 열렸다 닫혀 포트 감시 UI(cmux 등)에 전부 남는다(2026-09-16 실측).
export function portFor(base, span, key) { let h = 2166136261; for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return base + (h % span); }
function canListen(port) { return new Promise((res) => { const s = http.createServer(); s.once('error', () => res(false)); s.listen(port, '127.0.0.1', () => s.close(() => res(true))); }); }
export async function freePort(start, span) { for (let p = start; p < start + span; p++) if (await canListen(p)) return p; throw new Error(`빈 포트 없음: ${start}~${start + span}`); }

export async function serveDir(dir) {
  const port = await freePort(portFor(8600, 300, dir), 20);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (urlPath === '/favicon.ico' && !fs.existsSync(path.join(dir, 'favicon.ico'))) { res.writeHead(204); return res.end(); } // 브라우저 자동 요청 — 게임 에러가 아니다
      let file = path.join(dir, urlPath);
      if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found: ' + urlPath); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port, url: `http://127.0.0.1:${port}/` }));
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve(b)); }).on('error', reject);
  });
}

export async function launchChrome({ width = 1280, height = 720, key = process.cwd() } = {}) {
  const bin = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!bin) throw new Error('크롬을 찾지 못했다. FORGE_CHROME=<경로> 로 지정');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-chrome-'));
  const port = await freePort(portFor(9300, 600, key), 20); // CDP 포트도 폴더에서 결정
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--hide-scrollbars', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', // WebAudio 가 제스처 없이도 start() 되게 — 소리 계수용
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', // WebGL 게임도 렌더되게
    `--window-size=${width},${height}`, 'about:blank',
  ];
  const proc = spawn(bin, args, { stdio: 'ignore' });
  const kill = () => { try { proc.kill('SIGKILL'); } catch {} try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {} };
  process.on('exit', kill);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { kill(); process.exit(130); });

  let version;
  for (let i = 0; i < 100; i++) {
    try { version = JSON.parse(await httpGet(`http://127.0.0.1:${port}/json/version`)); break; } catch { await sleep(100); }
  }
  if (!version) { kill(); throw new Error('크롬 CDP 포트가 열리지 않았다'); }
  const browser = await CDP.connect(version.webSocketDebuggerUrl);
  return { proc, port, browser, close: async () => { try { await browser.close(); } catch {} kill(); } };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CDP {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new CDP(ws);
  }
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${msg.error.data || ''})`)) : resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  on(fn) { this.listeners.push(fn); }
  async close() { this.ws.close(); }
}

// 한 페이지(탭)에 대한 도구 모음. 콘솔 에러·페이지 예외·프레임 시각·오디오 start 계수를 처음부터 잡는다.
export class Page {
  static async open(browser, { width = 1280, height = 720, mobile = false, dpr = 1 } = {}) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(browser, sessionId, targetId);
    browser.on((msg) => { if (msg.sessionId === sessionId) page.onEvent(msg); });
    for (const d of ['Page', 'Runtime', 'Log', 'Network']) await page.send(`${d}.enable`);
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT_SOURCE });
    await page.setViewport({ width, height, mobile, dpr });
    return page;
  }
  constructor(browser, sessionId, targetId) {
    this.browser = browser; this.sessionId = sessionId; this.targetId = targetId;
    this.consoleErrors = []; this.consoleAll = []; this.loaded = null;
  }
  onEvent(msg) {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      this.consoleErrors.push(`[exception] ${d.text} ${d.exception?.description || ''}`.trim());
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      this.consoleAll.push(`[${msg.params.type}] ${text}`);
      if (msg.params.type === 'error') this.consoleErrors.push(`[console.error] ${text}`);
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      if (e.level === 'error') this.consoleErrors.push(`[${e.source}] ${e.text} ${e.url || ''}`.trim());
    } else if (msg.method === 'Page.loadEventFired') {
      this.loaded?.();
    }
  }
  send(method, params) { return this.browser.send(method, params, this.sessionId); }

  async setViewport({ width, height, mobile = false, dpr = 1 }) {
    this.viewport = { width, height, mobile, dpr };
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: dpr, mobile,
      screenOrientation: { type: width >= height ? 'landscapePrimary' : 'portraitPrimary', angle: width >= height ? 90 : 0 },
    });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 });
    if (mobile) await this.send('Emulation.setEmitTouchEventsForMouse', { enabled: false });
  }

  async navigate(url, { timeoutMs = 15000 } = {}) {
    const loaded = new Promise((res) => (this.loaded = res));
    await this.send('Page.navigate', { url });
    await Promise.race([loaded, sleep(timeoutMs).then(() => { throw new Error('load 타임아웃: ' + url); })]);
  }

  // 페이지 안에서 식을 평가해 값을 돌려받는다. 함수 본문(문자열)이면 async 로 감싼다.
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('페이지 평가 실패: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n  식: ' + expression.slice(0, 200));
    return r.result.value;
  }
  // __forge 호출 — 없거나 메서드가 없으면 명확한 에러
  forge(method, ...args) {
    return this.eval(`(async()=>{ if(!window.__forge) throw new Error('window.__forge 없음'); if(typeof window.__forge[${JSON.stringify(method)}]!=='function') throw new Error('__forge.${method} 없음'); return await window.__forge[${JSON.stringify(method)}](...${JSON.stringify(args)}); })()`);
  }
  async waitForForge({ timeoutMs = 10000 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await this.eval('!!(window.__forge && typeof window.__forge.state==="function")')) return true;
      await sleep(100);
    }
    return false;
  }

  async screenshot(file, { clip } = {}) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', clip: clip ? { ...clip, scale: 1 } : undefined });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64')); // base64 는 여기서 끝난다 — 대화로 흘리지 않는다
    return file;
  }

  // 게임 캔버스의 32×18 축소본(RGBA 배열). 화면끼리 "다른가" 판정용. WebGL 은 preserveDrawingBuffer 필요.
  thumb() {
    return this.eval(`(()=>{ const c=window.__forge?.canvas?.()||document.querySelector('canvas'); if(!c) return null;
      const o=document.createElement('canvas'); o.width=32; o.height=18; const g=o.getContext('2d'); g.drawImage(c,0,0,32,18);
      return Array.from(g.getImageData(0,0,32,18).data); })()`);
  }

  async keyDown(code) { const { key, vk } = keyInfo(code); await this.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); }
  async keyUp(code) { const { key, vk } = keyInfo(code); await this.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); }
  async touchStart(points) { await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) }); }
  async touchMove(points) { await this.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) }); }
  async touchEnd() { await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  async tap(x, y, holdMs = 60) { await this.touchStart([{ x, y }]); await sleep(holdMs); await this.touchEnd(); }

  // 프레임 시각 기록 on/off — 계측기는 게임이 아니라 드라이버가 심는다
  async frameRecord(on) { await this.eval(`(window.__forgeFrames.rec=${on ? 'true' : 'false'}, ${on ? 'window.__forgeFrames.t.length=0' : '0'})`); }
  async frameStats() {
    const t = await this.eval('window.__forgeFrames.t.slice()');
    const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
    if (d.length < 10) return { frames: t.length, avgFps: 0, low1Fps: 0, maxFrameMs: 0 };
    const sorted = [...d].sort((a, b) => a - b);
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    return { frames: t.length, avgFps: +(1000 / mean).toFixed(1), low1Fps: +(1000 / p99).toFixed(1), maxFrameMs: +sorted[sorted.length - 1].toFixed(1) };
  }
  audioStats() { return this.eval('({starts: window.__forgeAudio.starts, mediaPlays: window.__forgeAudio.mediaPlays, contexts: window.__forgeAudio.contexts})'); }
  async close() { try { await this.browser.send('Target.closeTarget', { targetId: this.targetId }); } catch {} }
}

// 페이지 스크립트보다 먼저 심는 계측기. 게임이 무엇을 주장하든 이 숫자는 드라이버가 센다.
const INSTRUMENT_SOURCE = `
(() => {
  window.__forgeFrames = { rec: false, t: [] };
  (function loop(ts) { if (window.__forgeFrames.rec) window.__forgeFrames.t.push(ts); requestAnimationFrame(loop); })(performance.now());
  window.__forgeAudio = { starts: 0, mediaPlays: 0, contexts: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { const Orig = AC; window.AudioContext = function(...a) { window.__forgeAudio.contexts++; return new Orig(...a); }; window.AudioContext.prototype = Orig.prototype; }
  if (window.AudioScheduledSourceNode) { const s = AudioScheduledSourceNode.prototype.start; AudioScheduledSourceNode.prototype.start = function(...a) { window.__forgeAudio.starts++; return s.apply(this, a); }; }
  if (window.HTMLMediaElement) { const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function(...a) { window.__forgeAudio.mediaPlays++; return p.apply(this, a); }; }
})();`;
