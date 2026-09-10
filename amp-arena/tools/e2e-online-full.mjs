// 온라인 2탭 2분 매치를 끝까지: 결과 화면 감지(MutationObserver) → 대기실 복귀. 두 탭의 콘솔 오류를 전부 찍는다.
// 사용: node tools/e2e-online-full.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:8787', out = '.'] = process.argv.slice(2);
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s ${m}`);
const A = new Page(port), B = new Page(port);
const OBSERVER = `(() => { window.__resultSeen = false; new MutationObserver(() => { if (document.querySelector('.result')) window.__resultSeen = true; }).observe(document.body, { childList: true, subtree: true }); return true; })()`;
const HUD = `JSON.stringify({ t: document.querySelector('.hud .timer .t')?.textContent, hp: document.querySelector('.hud .hp-text')?.textContent, tick: window.__amp?.source?.world?.tick, phase: window.__amp?.source?.world?.phase, me: (() => { const w = window.__amp?.source?.world; const p = w && w.players[window.__amp.source.myId]; return p ? { hp: p.hp, kos: p.kos, dmg: p.dmgDealt, st: p.state } : null; })(), vis: document.visibilityState, result: !!document.querySelector('.result'), seen: window.__resultSeen })`;
try {
  await A.open(base + '/?autopilot=1', { width: 1280, height: 720 });
  await B.open(base + '/?autopilot=1', { width: 1280, height: 720 });
  for (const [p, name] of [[A, '알파'], [B, '브라보']]) {
    await p.waitFor(`document.querySelector('.practice')`);
    await p.type('.nick', name);
    await p.click('.go-lobby');
    await p.waitFor(`document.querySelector('.create')`);
  }
  await A.click('.create');
  await A.eval(`document.querySelector('.rmode').value = 'team_dm'; document.querySelector('.rsec').value = '120'`);
  await A.click('.rgo');
  await A.waitFor(`document.querySelector('.room .slots')`);
  await B.click('.refresh');
  await B.waitFor(`document.querySelector('.room-row[data-id]')`);
  await B.click('.room-row[data-id]');
  await B.waitFor(`document.querySelector('.room .ready')`);
  await B.click('.acc[data-acc="spear"]');
  await B.click('.ready');
  await A.waitFor(`document.querySelector('.start') && document.querySelector('.start').textContent.includes('2/2')`);
  await A.click('.start');
  for (const p of [A, B]) { await p.waitFor(`document.querySelector('.match canvas') && window.__amp`, { timeout: 15000 }); await p.eval(OBSERVER); }
  log('match started on both tabs (autopilot on both, 2 humans + 6 bots, 2min)');
  const start = Date.now();
  let seenA = false, seenB = false, turn = 0;
  while (Date.now() - start < 170000) {
    // 헤드리스는 앞에 있는 탭만 rAF 가 돈다 — 2.5초씩 번갈아 앞으로 가져와 둘 다 플레이하게 한다
    await (turn++ % 2 === 0 ? A : B).front();
    await A.sleep(2500);
    await (turn % 2 === 0 ? A : B).front();
    await A.sleep(2500);
    const ha = await A.eval(HUD), hb = await B.eval(HUD);
    const pa = JSON.parse(ha), pb = JSON.parse(hb);
    if (pa.seen) seenA = true; if (pb.seen) seenB = true;
    if ((Date.now() - start) % 30000 < 5500 || pa.seen) log(`A ${ha}`);
    if (pa.seen || pb.seen) { log(`B ${hb}`); break; }
  }
  await A.shot(`${out}/onlinefull-A.png`); await B.shot(`${out}/onlinefull-B.png`);
  log(`result seen A ${seenA} B ${seenB}`);
  // 대기실 복귀 (서버가 10초 뒤 wait 로 전환)
  await A.waitFor(`document.querySelector('.room .slots')`, { timeout: 25000 });
  await B.waitFor(`document.querySelector('.room .slots')`, { timeout: 25000 });
  log('both back in room');
  await A.shot(`${out}/onlinefull-room.png`);
  for (const [n, p] of [['A', A], ['B', B]]) {
    console.log(`errors ${n}: ${p.errors.length}`);
    for (const e of p.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
    for (const l of p.logs.filter((x) => x.includes('[net]') || x.includes('[match]'))) console.log('  ', n, l);
  }
  process.exitCode = seenA && seenB && A.errors.length + B.errors.length === 0 ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  for (const [n, p] of [['A', A], ['B', B]]) { console.log(`errors ${n}: ${p.errors.length}`); for (const err of p.errors.slice(0, 5)) console.log('  !', err.slice(0, 300)); }
  try { await A.shot(`${out}/onlinefull-fail-A.png`); await B.shot(`${out}/onlinefull-fail-B.png`); } catch {}
  process.exitCode = 1;
} finally {
  await A.close(); await B.close();
}
