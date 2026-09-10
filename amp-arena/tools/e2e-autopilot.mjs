// 내 캐릭터의 공격이 실제로 들어가는지: (1) 키 → 입력 매핑 확인, (2) 오토파일럿(봇 AI 가 내 캐릭터 조종)으로 60초 뒤 준 데미지·KO 확인.
// 사용: node tools/e2e-autopilot.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:8787', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s ${m}`);
try {
  // (1) 키보드 → 입력
  await page.open(base + '/', { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`);
  await page.type('.nick', '루키');
  await page.eval(`document.querySelector('.bots').value = '3'; document.querySelector('.secs').value = '120'`);
  await page.click('.practice');
  await page.waitFor(`window.__amp && document.querySelector('.match canvas')`);
  await page.sleep(3500);
  await page.keyDown('ArrowUp', 'ArrowUp'); await page.keyDown('KeyZ', 'z'); await page.sleep(120);
  const inp = await page.eval(`JSON.stringify(window.__amp.lastInput)`);
  await page.keyUp('KeyZ', 'z'); await page.keyUp('ArrowUp', 'ArrowUp');
  const parsed = JSON.parse(inp);
  const keyOk = Math.hypot(parsed.mx, parsed.mz) > 0.9 && (parsed.btn & 1) === 1;
  log(`key path: input ${inp} → ${keyOk ? 'OK (이동 벡터 + 공격 비트)' : 'FAIL'}`);
  await page.sleep(300);
  const st = await page.eval(`(() => { const p = window.__amp.source.world.players[0]; return JSON.stringify({ state: p.state, move: p.move, hp: p.hp }); })()`);
  log(`after Z: ${st}`);
  await page.close();

  // (2) 오토파일럿 60초
  const p2 = new Page(port);
  await p2.open(base + '/?autopilot=1', { width: 1280, height: 720 });
  await p2.waitFor(`document.querySelector('.practice')`);
  await p2.type('.nick', '루키');
  await p2.eval(`document.querySelector('.bots').value = '3'; document.querySelector('.secs').value = '120'`);
  await p2.click('.practice');
  await p2.waitFor(`window.__amp && window.__amp.autopilot === true`);
  log('autopilot match started');
  await p2.sleep(63000);
  const stats = await p2.eval(`(() => { const w = window.__amp.source.world; const me = w.players[0]; return JSON.stringify({ tick: w.tick, me: { hp: me.hp, kos: me.kos, deaths: me.deaths, dmgDealt: me.dmgDealt }, bots: w.players.filter((p, i) => p && i > 0).map(p => ({ n: p.name, hp: p.hp, kos: p.kos, dmg: p.dmgDealt })) }); })()`);
  log(`after 60s: ${stats}`);
  await p2.shot(`${out}/autopilot-60s.png`);
  const s = JSON.parse(stats);
  const ok = keyOk && s.me.dmgDealt > 0;
  console.log(`errors: ${page.errors.length + p2.errors.length} · verdict: ${ok ? 'PASS — 내 캐릭터의 공격이 들어간다' : 'FAIL'}`);
  process.exitCode = ok && page.errors.length + p2.errors.length === 0 ? 0 : 1;
  await p2.close();
} catch (e) {
  console.error('E2E FAIL:', e.message);
  process.exitCode = 1;
  await page.close();
}
