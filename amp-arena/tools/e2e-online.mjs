// 온라인 E2E (코드 방): 개발 릴레이를 띄우고 탭 2개 — A 가 방을 만들고 B 가 코드로 들어와 악세서리를 고르고, A 가 시작
// → 둘 다 매치 진입(A 방장 · B 게스트) → 입력 → HUD·릴레이 상한 확인 → 스크린샷.
// 사용: node tools/e2e-online.mjs <cdpPort> <baseUrl> <outDir>   (baseUrl 은 vite dev, /ws/games 를 8790 으로 프록시)
import { spawn } from 'node:child_process';
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const RELAY_PORT = 8790;
const relay = spawn(process.execPath, [new URL('./dev-relay.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(RELAY_PORT), LOBBY_MS: '30000' }, stdio: ['ignore', 'pipe', 'inherit'] });
relay.stdout.on('data', (d) => process.stdout.write(`  [relay] ${d}`));
await new Promise((r) => setTimeout(r, 400));
const stats = async () => (await fetch(`http://127.0.0.1:${RELAY_PORT}/stats`)).json();
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix); // 운영은 /games/arena/index.html 처럼 파일까지 준다
const A = new Page(port), B = new Page(port);
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
const NET = `JSON.stringify({ info: window.__amp?.source?.info, epoch: window.__amp?.source?.epoch, host: window.__amp?.source?.hostSeat, tick: window.__amp?.source?.lastAuth?.snap?.tick, myId: window.__amp?.source?.myId, timer: document.querySelector('.hud .timer .t')?.textContent, netinfo: document.querySelector('.hud .netinfo')?.textContent })`;
try {
  await A.open(pageUrl('/'), { width: 1280, height: 720 });
  await B.open(pageUrl('/'), { width: 1280, height: 720 });
  for (const [p, name] of [[A, '알파'], [B, '브라보']]) {
    await p.waitFor(`document.querySelector('.practice')`);
    await p.type('.nick', name);
    await p.click('.go-lobby');
    await p.waitFor(`document.querySelector('.quick')`);
  }
  log('both in online lobby');
  await A.eval(`document.querySelector('.rmode').value = 'team_dm'; document.querySelector('.rmode').dispatchEvent(new Event('change'))`);
  await A.click('.create');
  await A.waitFor(`document.querySelector('.room .slots') && document.querySelector('.code')`);
  const code = await A.eval(`document.querySelector('.code').textContent.trim()`);
  await A.shot(`${out}/e2e-room-host.png`);
  log(`room created · code ${code}`);
  await B.type('.code-in', code);
  await B.click('.join-code');
  await B.waitFor(`document.querySelector('.room .slots')`);
  await B.click('.acc[data-acc="rocket"]');
  await B.sleep(300);
  // 양쪽 대기실에 둘 다 보이고, B 의 선택이 A 화면에 반영됐는지
  await A.waitFor(`[...document.querySelectorAll('.slot:not(.empty)')].length === 2 && document.body.textContent.includes('부스터')`);
  await B.waitFor(`[...document.querySelectorAll('.slot:not(.empty)')].length === 2`);
  await A.shot(`${out}/e2e-room-ready.png`);
  await B.shot(`${out}/e2e-room-guest.png`);
  log('both see 2 seats');
  await A.click('.start');
  for (const p of [A, B]) await p.waitFor(`document.querySelector('.match canvas') && window.__amp`, { timeout: 15000 });
  log('match started on both tabs');
  await A.sleep(3500);
  await Promise.all([A.hold('ArrowUp', 'ArrowUp', 1500), B.hold('ArrowUp', 'ArrowUp', 1500)]);
  for (let i = 0; i < 5; i++) { await A.tap('KeyZ', 'z', 50); await B.tap('KeyZ', 'z', 50); await A.sleep(150); }
  await A.tap('KeyV', 'v', 50);
  await A.sleep(1500);
  await A.front(); await A.sleep(600); await A.shot(`${out}/e2e-online-A.png`);
  await B.front(); await B.sleep(600); await B.shot(`${out}/e2e-online-B.png`);
  const na = JSON.parse(await A.eval(NET)), nb = JSON.parse(await B.eval(NET));
  log(`A ${JSON.stringify(na)}`);
  log(`B ${JSON.stringify(nb)}`);
  const st = await stats();
  log(`relay stats: maxChars ${st.maxChars} · maxPerSec ${st.maxPerSec} · closes ${JSON.stringify(st.closes)} · messages ${st.messages}`);
  const checks = {
    hostIsA: String(na.info).includes('방장'), guestIsB: String(nb.info).includes('게스트'), sameHost: na.host === nb.host && nb.host === na.myId,
    snapshotsFlow: nb.tick > 60, relayCaps: st.maxChars <= 4096 && st.maxPerSec <= 40 && Object.keys(st.closes).length === 0,
  };
  log(`checks ${JSON.stringify(checks)}`);
  console.log(`errors A: ${A.errors.length} · B: ${B.errors.length}`);
  for (const e of [...A.errors, ...B.errors].slice(0, 10)) console.log('  !', e.slice(0, 300));
  process.exitCode = A.errors.length + B.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  for (const err of [...A.errors, ...B.errors].slice(0, 10)) console.log('  !', err.slice(0, 300));
  for (const l of [...A.logs.slice(-8), ...B.logs.slice(-8)]) console.log('  ', l.slice(0, 200));
  try { await A.shot(`${out}/e2e-online-fail-A.png`); await B.shot(`${out}/e2e-online-fail-B.png`); } catch {}
  process.exitCode = 1;
} finally {
  await A.close(); await B.close();
  relay.kill();
}
