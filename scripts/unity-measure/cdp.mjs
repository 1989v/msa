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
// 9700 대 — cdp-chrome.sh 가 쓰는 9400 대와 겹치지 않게. 겹치면 **남의 크롬에 붙어 남의 게임을 잰다**
// (2026-09-13 실측: 깊은 밤을 재는데 캡처에 전란 성문이 찍혔다)
const port = 9700 + Math.floor(Math.random() * 200);
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
  // 붙은 페이지가 내가 연 페이지인지 본다 — 포트가 겹쳐 남의 크롬에 붙으면 남의 게임을 재게 된다
  await sleep(300);
  const here = await evalJs('location.href');
  if (!here || !here.startsWith(url.split('#')[0])) throw new Error(`다른 페이지에 붙었다: ${here} (원한 것 ${url})`);

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
  // KGD_TAP="0.35,0.52@600" — 캔버스 안 비율 좌표를 터치한다(유니티 UI 버튼 같은 것). 그때마다 한 장 찍는다
  for (const spec of String(process.env.KGD_TAP || '').split(',').filter(Boolean).map((s, i, a) => (i % 2 === 0 ? [s, a[i + 1]] : null)).filter(Boolean)) {
    const fx = Number(spec[0]); const [fyRaw, wait] = String(spec[1]).split('@');
    const rect = JSON.parse(await evalJs(`(function(){var c=document.querySelector('canvas');var r=c.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()`));
    const x = rect.x + fx * rect.w, y = rect.y + Number(fyRaw) * rect.h;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(60);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await shotAt('tap-' + fx + '-' + fyRaw, Number(wait || 500));
  }
  // KGD_PRESS="KeyA@1500,KeyS@600" — 터치 버튼(data-vt-code)을 차례로 누르고 그때마다 한 장 찍는다.
  // 키보드는 캔버스에 안 들어가므로 버튼 자리를 터치로 누른다
  for (const spec of String(process.env.KGD_PRESS || '').split(',').filter(Boolean)) {
    const [code, wait] = spec.split('@');
    const rect = await evalJs(`(function(){var b=document.querySelector('[data-vt-code="${code}"]');if(!b)return '';var r=b.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`);
    if (!rect) { console.error('button not found: ' + code); continue; }
    const c = JSON.parse(rect);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
    await sleep(60);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await shotAt('press-' + code, Number(wait || 500));
  }
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
