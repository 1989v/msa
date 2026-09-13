// 적 27종 행동 순회: 층마다 kind 하나씩 곁에 서서 2초 — 예외·피해·상태 변화를 본다
const [port] = process.argv.slice(2);
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description?.split('\n').slice(0, 2).join(' | ')); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) console.log('EVAL FAIL', r.result.exceptionDetails.text); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8100/gwiyahaeng/index.html' }); await sleep(2200);
await ev(`localStorage.clear(); 'ok'`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(300);
const seenKinds = {};
for (let n = 1; n <= 9; n++) {
  if (n > 1) { await ev(`dev.floor(${n}); 'ok'`); await sleep(400); }
  const kinds = JSON.parse(await ev(`JSON.stringify([...new Set(Levels.get(${n}).enemies.map(e=>e.t))])`));
  for (const k of kinds) {
    if (seenKinds[k]) continue;
    const r = await ev(`(async()=>{const en=Levels.get(${n}).enemies.find(e=>e.t==='${k}');dev.god=false;dev.state().hero.hp=8;dev.warp(en.x-36,en.y);const st=new Set();let dmg=0;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,100));const h=dev.state().hero;st.add(window.__lastSt||'');}return JSON.stringify({hp:dev.state().hero.hp})})()`);
    seenKinds[k] = r; console.log(n, k, r, 'err', errs.length);
  }
}
console.log('kinds tested', Object.keys(seenKinds).length);
console.log('exceptions', [...new Set(errs)].slice(0, 6));
ws.close();
