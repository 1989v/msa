// 운영 공중 공격 실측: 약공은 점프 궤적을 유지하고 강공은 급강하하는지를 **실제 키 입력**으로 판정한다.
// 흔들리는 변수 둘은 없앤다 — ① 봇을 멀리 치워 간섭(피격·launched)을 막고 ② 점프 타이밍 대신 공중 상태를 직접 만든다.
//    (키는 폴링이라 짧은 탭이 느린 헤드리스 프레임 사이로 빠진다 — 150ms 이상 누른다)
// 사용: node tools/e2e-prod-air.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
// **판별자는 수평 속도다** — vy 는 기다린 시간만큼 중력이 깎아 급강하와 구분되지 않는다(18 m/s²).
// 급강하는 앞으로 6 m/s 를 주고, 공중 약공은 속도를 아예 건드리지 않는다 — 이건 시간과 무관하다.
const S = `JSON.stringify({ state: ${ME}.state, move: ${ME}.move, y: +${ME}.pos.y.toFixed(2), vy: +${ME}.vel.y.toFixed(2), vxz: +Math.hypot(${ME}.vel.x, ${ME}.vel.z).toFixed(2), grounded: ${ME}.grounded })`;
/** 봇을 치우고 나를 공중에 올려 둔다 (상승 중) */
const airborne = () => page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME};
  for (const p of w.players) if (p && p.id !== me.id) { p.pos.x = 40; p.pos.z = 40; p.state = 'idle'; p.t = 0; }
  me.pos.x = 0; me.pos.z = 0; me.pos.y = 8; me.vel.x = me.vel.z = 0; me.vel.y = 3; me.grounded = false; // 높이 8 — 무브가 끝나기 전에 착지하지 않게
  me.state = 'fall'; me.t = 0; me.move = null; me.invuln = 60; return true; })()`);
try {
  await page.open(url, { width: 900, height: 760 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', '공중실측');
  await page.eval(`document.querySelector('.bots').value = '1'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });

  // ① 공중 약공 — 궤적 유지 (아래로 꺾이지 않는다)
  await airborne();
  await page.sleep(200);
  const before = JSON.parse(await page.eval(S));
  await page.hold('KeyZ', 'z', 160);
  await page.sleep(60);
  const light = JSON.parse(await page.eval(S));
  console.log(`공중 약공: ${JSON.stringify(before)} → ${JSON.stringify(light)}`);
  checks.lightKeepsArc = light.state === 'jumpAttack' && light.move === 'airAttack' && light.vxz < 1 && !light.grounded; // 앞으로 밀지 않는다 = 궤적 유지
  await page.shot(`${out}/prod-air-light.png`);

  // ② 공중 강공 — 급강하 (아래앞으로 꽂힌다)
  await airborne();
  await page.sleep(200);
  await page.hold('KeyX', 'x', 160);
  await page.sleep(60);
  const heavy = JSON.parse(await page.eval(S));
  console.log(`공중 강공: ${JSON.stringify(heavy)}`);
  checks.heavyDives = heavy.state === 'jumpAttack' && heavy.move === 'divekick' && heavy.vy <= -3 && heavy.vxz > 5;
  await page.shot(`${out}/prod-air-heavy.png`);

  // ③ 약공이 끝나면 낙하로 — 공중에서 다시 점프할 수 없다
  await airborne();
  await page.sleep(200);
  await page.hold('KeyZ', 'z', 160);
  await page.sleep(420); // 무브 종료(20틱 ≈ 333ms) 직후 — 더 기다리면 착지해서 fall 을 못 본다
  const after = JSON.parse(await page.eval(S));
  console.log(`약공 종료 뒤: ${JSON.stringify(after)}`);
  checks.endsToFall = !after.grounded && after.state === 'fall' && after.move === null;

  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/prod-air-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
