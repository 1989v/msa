// CDP 드라이버: node drive.mjs <port> <url> <script.json> — 실제 Input.dispatchKeyEvent 로 키를 보낸다
import { writeFileSync, readFileSync } from 'node:fs';
const [port, url, scriptPath] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(scriptPath, 'utf8'));
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push({ t: m.params.type, s: m.params.args.map(a => a.value ?? a.description).join(' ') });
  if (m.method === 'Runtime.exceptionThrown') logs.push({ t: 'exception', s: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
  if (m.method === 'Log.entryAdded') logs.push({ t: m.params.entry.level, s: m.params.entry.text + ' ' + (m.params.entry.url || '') }); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Escape: 27, Enter: 13, Space: 32, Backspace: 8 };
const keyOf = code => code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : code;
const vk = code => VK[code] ?? (code.startsWith('Key') ? code.charCodeAt(3) : 0);
const down = async code => send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyOf(code), windowsVirtualKeyCode: vk(code) });
const up = async code => send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyOf(code), windowsVirtualKeyCode: vk(code) });
const out = {};
for (const st of steps) {
  if (st.emulate) { await send('Emulation.setDeviceMetricsOverride', { width: st.emulate[0], height: st.emulate[1], deviceScaleFactor: st.emulate[2] || 1, mobile: !!st.emulate[3] }); if (st.emulate[3]) { await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }); } }
  if (st.goto) { await send('Page.navigate', { url: st.goto }); await sleep(st.wait || 1500); }
  if (st.key) { await down(st.key); await sleep(st.ms || 60); await up(st.key); await sleep(st.after || 40); }
  if (st.hold) { for (const c of st.hold) await down(c); await sleep(st.ms || 300); for (const c of st.hold) await up(c); await sleep(st.after || 40); }
  if (st.tap) { const r = await send('Runtime.evaluate', { expression: `(()=>{const el=document.querySelector(${JSON.stringify(st.tap)});if(!el)return null;const b=el.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`, returnByValue: true }); const p = r.result?.result?.value; if (p) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else out['tap:' + st.tap] = 'missing'; await sleep(st.after || 200); }
  if (st.click) { const r = await send('Runtime.evaluate', { expression: `(()=>{const el=document.querySelector(${JSON.stringify(st.click)});if(!el)return null;const b=el.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`, returnByValue: true }); const p = r.result?.result?.value; if (p) { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p[0], y: p[1], button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0], y: p[1], button: 'left', clickCount: 1 }); } else out['click:' + st.click] = 'missing'; await sleep(st.after || 200); }
  if (st.eval) { const r = await send('Runtime.evaluate', { expression: st.eval, returnByValue: true, awaitPromise: true }); out[st.name || st.eval.slice(0, 40)] = r.result?.result?.value ?? r.result?.exceptionDetails?.text; }
  if (st.sleep) await sleep(st.sleep);
  if (st.shot) { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(st.shot, Buffer.from(s.result.data, 'base64')); }
}
out.__logs = logs;
console.log(JSON.stringify(out, null, 1));
ws.close();
