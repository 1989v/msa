// 온라인 E2E (빠른 대전 · 승계): 개발 릴레이(로비 3초)를 띄우고 탭 3개가 빠른 대전으로 한 방에 모인다 (A 가 방장).
// ① 방장 탭이 뒤로 가 있어도(rAF 정지) 권위 워커가 돌아 게스트의 스냅샷 틱이 오른다
// ② 방장 A 가 나가면 B 가 이어받고(epoch 1) C 의 판이 계속된다 ③ 2분 판을 끝까지 → 결과 → 로비 복귀. 릴레이 상한 위반 0.
// 사용: node tools/e2e-online-full.mjs <cdpPort> <baseUrl> <outDir>
import { spawn } from 'node:child_process';
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const RELAY_PORT = 8790;
const relay = spawn(process.execPath, [new URL('./dev-relay.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(RELAY_PORT), LOBBY_MS: '3000' }, stdio: ['ignore', 'pipe', 'inherit'] });
relay.stdout.on('data', (d) => process.stdout.write(`  [relay] ${d}`));
await new Promise((r) => setTimeout(r, 400));
const stats = async () => (await fetch(`http://127.0.0.1:${RELAY_PORT}/stats`)).json();
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s ${m}`);
const A = new Page(port), B = new Page(port), C = new Page(port);
const tabs = [['A', A], ['B', B], ['C', C]];
const OBSERVER = `(() => { window.__resultSeen = false; new MutationObserver(() => { if (document.querySelector('.result')) window.__resultSeen = true; }).observe(document.body, { childList: true, subtree: true }); return true; })()`;
const NET = `JSON.stringify({ info: window.__amp?.source?.info, epoch: window.__amp?.source?.epoch, host: window.__amp?.source?.hostSeat, tick: window.__amp?.source?.lastAuth?.snap?.tick, wtick: window.__amp?.source?.world?.tick, myId: window.__amp?.source?.myId, phase: window.__amp?.source?.world?.phase, timer: document.querySelector('.hud .timer .t')?.textContent, vis: document.visibilityState, result: !!document.querySelector('.result'), seen: window.__resultSeen, ended: !!window.__amp?.source?.ended })`;
const net = async (p) => JSON.parse(await p.eval(NET));
const checks = {};
try {
  for (const [n, p] of tabs) {
    await p.open(base + '/?autopilot=1', { width: 1280, height: 720 });
    await p.waitFor(`document.querySelector('.practice')`);
    await p.type('.nick', `탭${n}`);
    await p.click('.go-lobby');
    await p.waitFor(`document.querySelector('.quick')`);
  }
  await A.eval(`document.querySelector('.rsec').value = '120'; document.querySelector('.rsec').dispatchEvent(new Event('change'))`);
  for (const [, p] of tabs) { await p.click('.quick'); await p.sleep(150); }
  for (const [, p] of tabs) await p.waitFor(`document.querySelector('.room .slots')`);
  await A.waitFor(`[...document.querySelectorAll('.slot:not(.empty)')].length === 3`);
  await A.shot(`${out}/onlinefull-room.png`);
  log('3 tabs in one quick room; waiting for relay lobby close (3s)');
  for (const [, p] of tabs) { await p.waitFor(`document.querySelector('.match canvas') && window.__amp`, { timeout: 20000 }); await p.eval(OBSERVER); }
  log('match started on all tabs');
  const na0 = await net(A);
  checks.aIsHost = String(na0.info).includes('방장');
  // 8초 플레이 (탭을 번갈아 앞으로)
  for (let i = 0; i < 4; i++) { for (const [, p] of tabs) { await p.front(); await p.sleep(700); } }
  // ① 방장 탭을 뒤로 둔 채 2초 — C 만 앞. B 의 권위 스냅샷 틱이 올라야 한다
  await C.front();
  const b1 = await net(B); await C.sleep(2000); const b2 = await net(B);
  checks.hostHiddenStillTicks = b2.tick - b1.tick >= 90; // 2초면 120틱, 여유 두고 90
  log(`hidden-host check: B tick ${b1.tick} → ${b2.tick} (A hidden, vis=${(await net(A)).vis})`);
  // ② 방장 A 이탈 → B 승계 (좌석 순)
  await A.close();
  log('host A closed');
  await B.waitFor(`window.__amp?.source?.info && window.__amp.source.info.includes('방장')`, { timeout: 8000 });
  await C.waitFor(`window.__amp?.source?.epoch === 1`, { timeout: 8000 });
  const nb = await net(B), nc = await net(C);
  checks.bBecameHost = String(nb.info).includes('방장') && nb.epoch === 1;
  checks.cFollowsB = nc.host === nb.myId && nc.epoch === 1;
  log(`after takeover: B ${JSON.stringify(nb)}`);
  log(`after takeover: C ${JSON.stringify(nc)}`);
  await C.front();
  const c1 = await net(C); await C.sleep(2000); const c2 = await net(C);
  checks.cKeepsPlaying = c2.tick - c1.tick >= 90 && c2.phase !== 'ended';
  log(`C tick ${c1.tick} → ${c2.tick} after takeover`);
  await B.front(); await B.sleep(500); await B.shot(`${out}/onlinefull-B-host.png`);
  await C.front(); await C.sleep(500); await C.shot(`${out}/onlinefull-C.png`);
  // ③ 끝까지 (2분 판, 시작 후 ~15초 경과)
  const start = Date.now();
  let turn = 0;
  while (Date.now() - start < 140000) {
    await (turn++ % 2 === 0 ? B : C).front();
    await B.sleep(2500);
    const pb = await net(B), pc = await net(C);
    if ((Date.now() - start) % 30000 < 2600) log(`B ${pb.timer} tick ${pb.tick} · C ${pc.timer} tick ${pc.tick}`);
    if (pb.seen && pc.seen) break;
  }
  const eb = await net(B), ec = await net(C);
  checks.resultOnBoth = eb.seen && ec.seen;
  log(`result seen B ${eb.seen} C ${ec.seen}`);
  await B.front(); await B.sleep(400); await B.shot(`${out}/onlinefull-result-B.png`);
  await B.click('.result .btn.primary');
  await C.click('.result .btn.primary');
  await B.waitFor(`document.querySelector('.quick')`, { timeout: 10000 });
  await C.waitFor(`document.querySelector('.quick')`, { timeout: 10000 });
  checks.backToLobby = true;
  const st = await stats();
  checks.relayCaps = st.maxChars <= 4096 && st.maxPerSec <= 40 && Object.keys(st.closes).length === 0;
  log(`relay stats: maxChars ${st.maxChars} · maxPerSec ${st.maxPerSec} · closes ${JSON.stringify(st.closes)} · messages ${st.messages}`);
  log(`checks ${JSON.stringify(checks)}`);
  let errs = 0;
  for (const [n, p] of tabs) {
    console.log(`errors ${n}: ${p.errors.length}`);
    errs += p.errors.length;
    for (const e of p.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
    for (const l of p.logs.filter((x) => x.includes('[net]') || x.includes('[host]') || x.includes('[match]') || x.includes('[relay]'))) console.log('  ', n, l.slice(0, 200));
  }
  process.exitCode = errs === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const [n, p] of tabs) { console.log(`errors ${n}: ${p.errors.length}`); for (const err of p.errors.slice(0, 5)) console.log('  !', err.slice(0, 300)); for (const l of p.logs.slice(-6)) console.log('  ', n, l.slice(0, 200)); }
  try { await B.shot(`${out}/onlinefull-fail-B.png`); await C.shot(`${out}/onlinefull-fail-C.png`); } catch {}
  process.exitCode = 1;
} finally {
  for (const [, p] of tabs) { try { await p.close(); } catch {} }
  relay.kill();
}
