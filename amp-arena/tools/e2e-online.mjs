// 온라인 E2E: 탭 2개 — A 가 방을 만들고 B 가 들어와 준비, A 가 시작(봇 채움) → 둘 다 매치 진입 → 입력 → 스크린샷.
// 사용: node tools/e2e-online.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const A = new Page(port), B = new Page(port);
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
try {
  await A.open(base + '/', { width: 1280, height: 720 });
  await B.open(base + '/', { width: 1280, height: 720 });
  for (const [p, name] of [[A, '알파'], [B, '브라보']]) {
    await p.waitFor(`document.querySelector('.practice')`);
    await p.type('.nick', name);
    await p.click('.go-lobby');
    await p.waitFor(`document.querySelector('.create')`);
  }
  log('both in lobby');
  await A.click('.create');
  await A.eval(`document.querySelector('.rmode').value = 'team_dm'`);
  await A.click('.rgo');
  await A.waitFor(`document.querySelector('.room .slots')`);
  await A.shot(`${out}/e2e-room-host.png`);
  log('room created');
  await B.click('.refresh');
  await B.waitFor(`document.querySelector('.room-row[data-id]')`);
  await B.shot(`${out}/e2e-lobby.png`);
  await B.click('.room-row[data-id]');
  await B.waitFor(`document.querySelector('.room .ready')`);
  await B.click('.acc[data-acc="rocket"]');
  await B.sleep(200);
  await B.click('.ready');
  await A.waitFor(`document.querySelector('.start') && document.querySelector('.start').textContent.includes('2/2')`);
  await A.shot(`${out}/e2e-room-ready.png`);
  await A.click('.start');
  for (const p of [A, B]) await p.waitFor(`document.querySelector('.match canvas')`, { timeout: 15000 });
  log('match started on both tabs');
  await A.sleep(3500);
  // 둘 다 움직이고 때린다
  await Promise.all([A.hold('ArrowUp', 'ArrowUp', 1500), B.hold('ArrowUp', 'ArrowUp', 1500)]);
  for (let i = 0; i < 5; i++) { await A.tap('KeyZ', 'z', 50); await B.tap('KeyZ', 'z', 50); await A.sleep(150); }
  await A.tap('KeyV', 'v', 50);
  await A.sleep(1500);
  await A.shot(`${out}/e2e-online-A.png`);
  await B.shot(`${out}/e2e-online-B.png`);
  const info = await A.eval(`JSON.stringify({ timer: document.querySelector('.hud .timer .t')?.textContent, rtt: document.querySelector('.hud .netinfo')?.textContent, roster: document.querySelectorAll('.hud .roster .r').length - 1, plates: [...document.querySelectorAll('.hud .nameplate')].filter(e => e.style.display !== 'none').length })`);
  log(`A hud ${info}`);
  await A.sleep(4000);
  await A.shot(`${out}/e2e-online-A2.png`);
  console.log(`errors A: ${A.errors.length} · B: ${B.errors.length}`);
  for (const e of [...A.errors, ...B.errors].slice(0, 10)) console.log('  !', e.slice(0, 300));
  process.exitCode = A.errors.length + B.errors.length ? 1 : 0;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  for (const err of [...A.errors, ...B.errors].slice(0, 10)) console.log('  !', err.slice(0, 300));
  for (const l of [...A.logs.slice(-6), ...B.logs.slice(-6)]) console.log('  ', l.slice(0, 200));
  try { await A.shot(`${out}/e2e-online-fail-A.png`); await B.shot(`${out}/e2e-online-fail-B.png`); } catch {}
  process.exitCode = 1;
} finally {
  await A.close(); await B.close();
}
