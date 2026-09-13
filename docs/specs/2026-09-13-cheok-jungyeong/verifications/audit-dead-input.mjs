// 죽은 입력 감사: 씬 × 키 매트릭스. 판정 = 씬 전환 | 상태 변화 | 효과음 중 하나
const [port] = process.argv.slice(2);
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onclose = (e) => console.log('WS CLOSED', e.code, e.reason); ws.onerror = (e) => console.log('WS ERR');
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.error || r.result?.exceptionDetails) console.log('EVAL FAIL', x.slice(0,60), JSON.stringify(r.error || r.result.exceptionDetails.text)); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 960, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8100/gwiyahaeng/index.html' }); await sleep(2200);
await ev(`localStorage.clear(); window.__sfx=0; const _p=Sfx.play; Sfx.play=function(n){window.__sfx++; return _p.apply(this,arguments)}; 'ok'`);
const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Escape: 27, Enter: 13, Space: 32, Backspace: 8, Tab: 9, Digit1: 49 };
const keyOf = c => c.startsWith('Key') ? c.slice(3).toLowerCase() : c === 'Space' ? ' ' : c === 'Digit1' ? '1' : c;
const vk = c => VK[c] ?? (c.startsWith('Key') ? c.charCodeAt(3) : 0);
const snap = () => ev(`(()=>{const s=dev.state();const h=s.hero;return JSON.stringify({sc:s.scene,x:Math.round(h.x*10),y:Math.round(h.y*10),st:h.st,atk:h.atk,tal:h.tal,aim:!!h.aimUp,mute:Sfx.isMuted(),sfx:window.__sfx,rope:!!h.rope,vy:Math.round(h.vy)})})()`);
let midSnap = null; const press = async c => { await send('Input.dispatchKeyEvent', { type: 'keyDown', code: c, key: keyOf(c), windowsVirtualKeyCode: vk(c) }); await sleep(90); midSnap = await snap(); await send('Input.dispatchKeyEvent', { type: 'keyUp', code: c, key: keyOf(c), windowsVirtualKeyCode: vk(c) }); await sleep(120); };
const KEYS = ['ArrowUp','ArrowDown','KeyW','KeyS'];
const SCENES = ['play'];
const enter = async (sc) => { // 씬 진입 (실제 배선)
  if (sc === 'title') await ev(`dev.testScene('title')`);
  else if (sc === 'help') { await ev(`dev.testScene('title')`); await ev(`dev.testScene('help')`); }
  else if (sc === 'play') { await ev(`dev.testScene('title')`); await press('Enter'); await ev(`dev.warp(200,180); dev.state().hero.soul=0; 'ok'`); await sleep(300); }
  else if (sc === 'pause') { await ev(`dev.testScene('title')`); await press('Enter'); await sleep(200); await press('Escape'); }
  else { await ev(`dev.testScene('title')`); await press('Enter'); await sleep(200); await ev(`dev.testScene('${sc}')`); }
  await sleep(150);
};
const dead = [], rows = [];
for (const sc of SCENES) for (const k of KEYS) {
  await enter(sc); const before = await snap(); const b = JSON.parse(before);
  if (b.sc !== sc) { rows.push([sc, k, 'ENTER-FAIL ' + b.sc]); continue; }
  await press(k); const after = midSnap; const a = JSON.parse(after);
  const changed = a.sc !== b.sc || a.sfx !== b.sfx || a.x !== b.x || a.y !== b.y || a.st !== b.st || a.atk !== b.atk || a.tal !== b.tal || a.aim !== b.aim || a.mute !== b.mute || a.rope !== b.rope || a.vy !== b.vy;
  rows.push([sc, k, changed ? 'ok' : 'DEAD', a.sc !== b.sc ? 'scene→' + a.sc : a.sfx !== b.sfx ? 'sfx' : 'state']);
  if (!changed) dead.push(sc + ':' + k);
}
console.log('cells', rows.length, 'dead', dead.length, dead.join(' '));
console.log(rows.filter(r => r[2] !== 'ok').map(r => r.join(' ')).join('\n'));
console.log('errors', errs.length, errs.slice(0, 3).join('\n'));
ws.close();
