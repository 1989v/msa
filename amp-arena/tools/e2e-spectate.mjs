// 관전 E2E (코드 방): A 가 방을 만들고 B 는 「관전」을 켜고 코드로 들어온다. A 가 시작하면
// B 는 명단에 없고(내 캐릭터 없음) 카메라가 남을 따라가며 Tab 으로 대상을 바꾼다. A 의 명단에는 B 가 없고 봇이 채운다.
// 사용: node tools/e2e-spectate.mjs <cdpPort> <baseUrl> <outDir>   (vite dev, /ws/games 를 8790 으로 프록시)
import { spawn } from 'node:child_process';
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const RELAY_PORT = 8790;
const relay = spawn(process.execPath, [new URL('./dev-relay.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: String(RELAY_PORT), LOBBY_MS: '30000' }, stdio: ['ignore', 'pipe', 'inherit'] });
relay.stdout.on('data', (d) => process.stdout.write(`  [relay] ${d}`));
await new Promise((r) => setTimeout(r, 400));
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const A = new Page(port), B = new Page(port);
const checks = {};
const VIEW = `JSON.stringify({ spectator: window.__amp?.source?.spectator === true, myId: window.__amp?.source?.myId, hasMe: !!window.__amp?.source?.world?.players?.[window.__amp?.source?.myId], follow: window.__amp?.spectating?.(), roster: window.__amp?.source?.roster?.map((r) => r.id), prompt: document.querySelector('.hud .prompt')?.textContent ?? '', info: window.__amp?.source?.info, cam: window.__amp?.camera?.() })`;
try {
  await A.open(pageUrl('/'), { width: 1280, height: 720 });
  await B.open(pageUrl('/'), { width: 1280, height: 720 });
  for (const [p, name] of [[A, '알파'], [B, '관전자']]) {
    await p.waitFor(`document.querySelector('.practice')`);
    await p.type('.nick', name);
    await p.click('.go-lobby');
    await p.waitFor(`document.querySelector('.quick')`);
  }
  await A.click('.create');
  await A.waitFor(`document.querySelector('.room .slots') && document.querySelector('.code')`);
  const code = await A.eval(`document.querySelector('.code').textContent.trim()`);
  await B.eval(`(() => { const c = document.querySelector('.spectate'); c.checked = true; c.dispatchEvent(new Event('change')); return c.checked; })()`);
  await B.type('.code-in', code);
  await B.click('.join-code');
  await B.waitFor(`document.querySelector('.room .slots')`);
  await A.waitFor(`[...document.querySelectorAll('.slot:not(.empty)')].length === 2 && document.body.textContent.includes('관전')`, { timeout: 8000 });
  checks.roomShowsSpectator = true;
  await A.shot(`${out}/e2e-spectate-room.png`);
  await A.click('.start');
  for (const p of [A, B]) await p.waitFor(`document.querySelector('.match canvas') && window.__amp`, { timeout: 15000 });
  await A.sleep(4000);
  await A.hold('ArrowUp', 'ArrowUp', 1200);
  await B.front(); await B.sleep(700);
  const b1 = JSON.parse(await B.eval(VIEW));
  const a1 = JSON.parse(await A.eval(VIEW));
  console.log(`A ${JSON.stringify(a1)}`);
  console.log(`B ${JSON.stringify(b1)}`);
  checks.bIsSpectator = b1.spectator && !b1.hasMe && !b1.roster.includes(b1.myId) && String(b1.prompt).includes('관전');
  checks.aRosterExcludesB = !a1.roster.includes(b1.myId) && a1.roster.length === 7 && !a1.spectator && a1.hasMe;
  // 카메라가 따라가는 대상 위치와 카메라 위치의 수평 거리 = CAM_DIST 근처 (3.4~5.9)
  const followPos = JSON.parse(await B.eval(`(() => { const id = window.__amp.spectating(); const p = window.__amp.source.renderPlayers(performance.now()).find((r) => r.id === id); return JSON.stringify(p ? { id, x: p.x, z: p.z } : null); })()`));
  const dxz = followPos ? Math.hypot(b1.cam.x - followPos.x, b1.cam.z - followPos.z) : -1;
  console.log(`B follows ${JSON.stringify(followPos)} · camera horizontal distance ${dxz.toFixed(2)}`);
  checks.cameraFollows = dxz > 3.0 && dxz < 6.5;
  await B.shot(`${out}/e2e-spectate-B.png`);
  await B.tap('Tab', 'Tab', 40);
  await B.sleep(300);
  const b2 = JSON.parse(await B.eval(VIEW));
  console.log(`B after Tab: follow ${b1.follow} → ${b2.follow}`);
  checks.tabSwitches = b2.follow !== b1.follow && a1.roster.includes(b2.follow);
  console.log(`checks ${JSON.stringify(checks)}`);
  console.log(`errors A: ${A.errors.length} · B: ${B.errors.length}`);
  for (const e of [...A.errors, ...B.errors].slice(0, 6)) console.log('  !', e.slice(0, 300));
  process.exitCode = A.errors.length + B.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of [...A.logs.slice(-6), ...B.logs.slice(-6)]) console.log('  ', l.slice(0, 200));
  try { await A.shot(`${out}/e2e-spectate-fail-A.png`); await B.shot(`${out}/e2e-spectate-fail-B.png`); } catch {}
  process.exitCode = 1;
} finally {
  await A.close(); await B.close();
  relay.kill();
}
