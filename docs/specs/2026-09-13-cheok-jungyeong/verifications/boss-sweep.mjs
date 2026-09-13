// 층주 9 순회: 방 진입 → 12초 관찰(패턴·예외) → 처치 → 보상 → 다음 층
const [port] = process.argv.slice(2);
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) console.log('EVAL FAIL', r.result.exceptionDetails.text); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8100/gwiyahaeng/index.html' }); await sleep(2200);
await ev(`localStorage.clear(); 'ok'`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(300);
await ev(`dev.god = true; 'ok'`);
for (let n = 1; n <= 9; n++) {
  if (n > 1) await ev(`dev.floor(${n}); 'ok'`); await sleep(300);
  await ev(`dev.arena(); 'ok'`); await sleep(2600);
  const info = await ev(`(async()=>{const seen={};let hits=0;const st=performance.now();while(performance.now()-st<12000){await new Promise(r=>setTimeout(r,100));const b=dev.boss();if(!b)return 'noboss';if(b.pattern)seen[b.pattern]=(seen[b.pattern]||0)+1;if(b.st==='stun')seen.STUN=(seen.STUN||0)+1;const h=dev.state().hero;if(Math.abs(h.x-b.x)>34){dev.warp(b.x-28,320)}window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC',key:'c'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyC',key:'c'}));hits++}const b=dev.boss();return JSON.stringify({name:b.name,hp:b.hp,hpMax:b.hpMax,phase:b.phase,seen})})()`);
  await ev(`dev.boss().hp = 1; dev.warp(dev.boss().x-28,320); 'ok'`);
  for (let k = 0; k < 6; k++) { await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyC',key:'c'})); window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyC',key:'c'})); 'ok'`); await sleep(130); }
  await sleep(2300);
  const sc = await ev(`dev.state().scene`);
  console.log(n, info, 'after-kill scene:', sc, 'errors:', errs.length);
  if (sc === 'reward') { await ev(`document.getElementById('b-reward').click(); 'ok'`); await sleep(600); }
  else if (sc === 'ending') { console.log('ENDING reached'); break; }
  else { console.log('unexpected scene', sc); break; }
}
console.log('exceptions', errs.slice(0, 5));
ws.close();
