// source: docs/standards/unity-game-pipeline.md
// 헤드리스 크롬(소프트웨어 WebGL) + CDP 로 유니티 게임을 켜서 잰다 — 전송량·첫 프레임·fps·가상패드 CSS px·
// 콘솔 오류 + 낙하 중/착지 후 스크린샷. start → 측정 → stop 이 한 프로세스 안이다. 크롬은 끝나면 SIGKILL.
//   node scripts/unity-measure/serve.mjs portal-fe/public 8123 &   (nginx 와 같은 규칙으로 Build/*.gz 를 낸다)
//   node scripts/unity-measure/cdp.mjs "http://127.0.0.1:8123/games/<slug>/index.html#autoplay" <out-dir> portrait|landscape|desktop
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const out = process.argv[3];
const mode = process.argv[4] || 'portrait';
const [W, H] = mode === 'portrait' ? [390, 844] : mode === 'desktop' ? [1280, 720] : [844, 390];
const mobile = mode !== 'desktop';
const port = 9300 + Math.floor(Math.random() * 300);
const profile = path.join(out, `chrome-${mode}`);
fs.mkdirSync(profile, { recursive: true });

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
  `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kill = () => { try { chrome.kill('SIGKILL'); } catch {} };
process.on('exit', kill);

async function main() {
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) events.push(d);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression, awaitPromise = false) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })).result?.result?.value;

  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: mobile ? 2 : 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  const consoleLines = [];
  const origOnMessage = ws.onmessage;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning'))
      consoleLines.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    if (d.method === 'Runtime.exceptionThrown') consoleLines.push('exception: ' + (d.params.exceptionDetails.text || '').slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') consoleLines.push('log: ' + d.params.entry.text.slice(0, 300));
    origOnMessage(m);
  };

  const t0 = Date.now();
  await send('Page.navigate', { url });

  // 유니티가 준비 신호(PlatformAdapter.runStart 또는 unityInstance)를 낼 때까지
  let ready = null, firstFrame = null;
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const st = await evalJs(`(function(){ var c=document.querySelector('canvas'); return JSON.stringify({ inst: !!window.unityInstance, cw: c?c.width:0, ch: c?c.height:0, ready: !!(window.__kgdReady) }); })()`);
    const s = JSON.parse(st || '{}');
    if (s.inst && ready == null) ready = Date.now() - t0;
    if (s.cw > 0 && s.inst && firstFrame == null) {
      // 첫 프레임 = 캔버스가 실제로 그려진 뒤. rAF 한 번 기다린다
      await evalJs(`new Promise(r=>requestAnimationFrame(()=>r(1)))`, true);
      firstFrame = Date.now() - t0;
      break;
    }
  }

  // 전송량 — 와이어 크기(응답 헤더 Content-Length) 합
  let wire = 0, decoded = 0; const files = [];
  for (const e of events) {
    if (e.method === 'Network.responseReceived') {
      const r = e.params.response; const len = Number(r.headers['Content-Length'] || r.headers['content-length'] || 0);
      wire += len; files.push({ url: r.url.split('/').pop(), len });
    }
    if (e.method === 'Network.loadingFinished') decoded += e.params.encodedDataLength || 0;
  }

  // 낙하 중 한 장(상공 — 산 전체가 보여야 한다), 착지 직후, 판이 선 뒤
  const shotAt = async (name, ms) => { await sleep(ms); const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `shot-${mode}-${name}.png`), Buffer.from(s.result.data, 'base64')); };
  await shotAt('t1', 1200);
  await shotAt('t4', 2800);
  await shotAt('t12', 8000);
  await sleep(18000);

  // 프레임 시간 — 8초 동안 rAF 간격
  const frames = await evalJs(`new Promise(r=>{var t=[],p=performance.now();function f(n){t.push(n-p);p=n;if(t.length<480&&n-t0<8000)requestAnimationFrame(f);else r(JSON.stringify(t));}var t0=performance.now();requestAnimationFrame(f);})`, true);
  const dts = JSON.parse(frames).slice(5).sort((a, b) => a - b);
  const median = dts[Math.floor(dts.length / 2)];
  const p90 = dts[Math.floor(dts.length * 0.9)];

  const heap = await evalJs(`(function(){try{return window.unityInstance.Module.HEAP8.length}catch(e){return -1}})()`);
  const pad = await evalJs(`(function(){var out=[];document.querySelectorAll('[class*=vt-],[class*=touch],button').forEach(function(el){var r=el.getBoundingClientRect();if(r.width>0)out.push({c:el.className.toString().slice(0,30),w:Math.round(r.width),h:Math.round(r.height)});});return JSON.stringify(out.slice(0,40));})()`);
  const canvas = await evalJs(`(function(){var c=document.querySelector('canvas');var r=c.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height,cw:c.width,ch:c.height});})()`);
  const errors = JSON.stringify(consoleLines.slice(0, 20));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(out, `shot-${mode}.png`), Buffer.from(shot.result.data, 'base64'));

  const report = { mode, viewport: [W, H], readyMs: ready, firstFrameMs: firstFrame, wireBytes: wire, decodedBytes: decoded,
    frameMedianMs: median, frameP90Ms: p90, fpsMedian: median ? 1000 / median : null, samples: dts.length,
    wasmHeap: heap, canvas: JSON.parse(canvas || '{}'), pad: JSON.parse(pad || '[]'), errors: JSON.parse(errors || '[]'),
    files: files.filter((f) => f.len > 50000) };
  fs.writeFileSync(path.join(out, `report-${mode}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  ws.close();
}

main().catch((e) => { console.error(e); }).finally(() => { kill(); setTimeout(() => process.exit(0), 300); });
