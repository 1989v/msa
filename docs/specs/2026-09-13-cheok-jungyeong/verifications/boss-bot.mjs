// 층주 공략 대조 — 정답봇 vs 오답봇 (프리셋 8-b): 패턴 인스턴스당 피해로 잰다. 합격 = 정답봇 피해가 오답봇의 40% 이하 (감소율 60%+)
const [port, from = '1', to = '3'] = process.argv.slice(2);
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
// 봇: 합성 KeyboardEvent 로 조작한다 (게임은 window 의 keydown/keyup 을 읽는다)
await ev(`window.__bot = (function(){
  const down = {}; const kd = c => { if (!down[c]) { down[c] = 1; window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c })); } }; const ku = c => { if (down[c]) { delete down[c]; window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c })); } };
  const tap = (c, ms) => { window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c })), ms || 60); };
  const jump = () => tap('KeyX', 420);
  const release = () => Object.keys(down).forEach(ku);
  const ANS = { slam: 'back', sweep: 'jump', leap: 'side', roar: 'attack', reach: 'jump', throwc: 'side', burst: 'away', rise: 'side', bite: 'back', spray: 'close', dash: 'jump', bolt: 'side', freeze: 'jumpLate', mirror: 'away' };
  let mode = 'answer', jumped = false, lastKey = '';
  function step() {
    const b = dev.boss(); if (!b || b.dead) { release(); return; }
    const h = dev.state().hero, dx = b.x - h.x, adx = Math.abs(dx), toward = dx > 0 ? 'ArrowRight' : 'ArrowLeft', away = dx > 0 ? 'ArrowLeft' : 'ArrowRight';
    const pat = b.pattern, st = b.st, want = pat ? ANS[pat] : null;
    let act = want; if (mode === 'wrong' && want) act = { back: 'close', jump: 'stay', side: 'stay', attack: 'idle', away: 'close', close: 'away', jumpLate: 'stay' }[want];
    const key = st + ':' + pat; if (key !== lastKey) { jumped = false; lastKey = key; }
    release();
    if (!pat || st === 'idle' || st === 'walk' || st === 'stun') { // 기본: 붙어서 벤다
      if (adx > 30) kd(toward); else if (Math.random() < 0.5) tap('KeyC');
      return;
    }
    if (act === 'back') { kd(away); kd('KeyZ'); if (st === 'tele' && b.st_t > b.teleT - 0.2 && !jumped) { jumped = true; jump(); } }
    else if (act === 'jump') { if (((st === 'tele' && b.st_t > b.teleT - 0.2) || st === 'act') && (!jumped || h.ground)) { jumped = true; if (h.ground) jump(); } }
    else if (act === 'jumpLate') { if (st === 'tele' && b.st_t > b.teleT - 0.15 && !jumped) { jumped = true; jump(); } }
    else if (act === 'side') { const mx = b.markX ?? b.x; let dir = h.x < mx ? 'ArrowLeft' : h.x > mx ? 'ArrowRight' : away; if (h.x < 40) dir = 'ArrowRight'; if (h.x > 440) dir = 'ArrowLeft'; kd(dir); kd('KeyZ'); }
    else if (act === 'away') { kd(away); kd('KeyZ'); }
    else if (act === 'close') { if (adx > 26) kd(toward); }
    else if (act === 'attack') { if (adx > 30) kd(toward); else tap('KeyC'); }
    else if (act === 'stay') { /* 제자리 */ }
    else if (act === 'idle') { /* 아무것도 */ }
  }
  let timer = null; return { start(m) { mode = m; if (timer) clearInterval(timer); timer = setInterval(step, 50); }, stop() { if (timer) clearInterval(timer); timer = null; release(); } };
})(); 'ok'`);
for (let n = +from; n <= +to; n++) {
  if (n > 1) { await ev(`dev.floor(${n}); 'ok'`); await sleep(300); }
  const res = {};
  for (const mode of ['answer', 'wrong']) {
    await ev(`dev.arena(); 'ok'`); await sleep(2700);
    await ev(`dev.god = false; dev.noSummon = true; dev.state().hero.hp = 8; dev.state().hero.hpMax = 8; window.__dmg = 0; window.__inst = 0; window.__lastPat = null; __bot.start('${mode}'); 'ok'`);
    const r = await ev(`(async()=>{const h0=dev.state().hero;h0.hitCount=0;let lastCount=0;const per={};const src={};let inst=0,lastPat='';const st=performance.now();while(performance.now()-st<75000){await new Promise(r=>setTimeout(r,50));const b=dev.boss();if(!b)break;const h=dev.state().hero;if((h.hitCount||0)>lastCount){lastCount=h.hitCount;const s=h.lastHitSrc||'unknown';src[s]=(src[s]||0)+1;if(s!=='contact'&&s!=='unknown'){per[s]=per[s]||{i:0,h:0};per[s].h++;}} if(h.hp<4)h.hp=8; if(b.st==='tele'&&b.pattern&&b.st_t<0.06&&lastPat!==b.pattern+'@'+Math.round(performance.now()/300)){inst++;per[b.pattern]=per[b.pattern]||{i:0,h:0};per[b.pattern].i++;lastPat=b.pattern+'@'+Math.round(performance.now()/300);} if(b.hp<b.hpMax*0.55)b.hp=b.hpMax*0.9;}
      let pat=0;Object.keys(per).forEach(k=>pat+=per[k].h);return JSON.stringify({inst,patHits:pat,src,per})})()`);
    await ev(`__bot.stop(); dev.god = true; 'ok'`);
    res[mode] = JSON.parse(r);
    // 방 나가기: 층 다시 로드
    await ev(`dev.floor(${n}); 'ok'`); await sleep(300);
  }
  const a = res.answer, w = res.wrong, ratio = w.patHits ? (a.patHits / a.inst) / (w.patHits / w.inst) : 0;
  console.log(`boss ${n}: answer ${a.patHits} hits / ${a.inst} inst = ${(a.patHits / a.inst).toFixed(2)} | wrong ${w.patHits} / ${w.inst} = ${(w.patHits / w.inst).toFixed(2)} | ratio ${ratio.toFixed(2)} (${ratio <= 0.4 ? 'PASS' : 'FAIL'})`);
  console.log('  answer per', JSON.stringify(a.per), 'src', JSON.stringify(a.src), '\n  wrong  per', JSON.stringify(w.per), 'src', JSON.stringify(w.src));
}
console.log('exceptions', errs.slice(0, 3));
ws.close();
