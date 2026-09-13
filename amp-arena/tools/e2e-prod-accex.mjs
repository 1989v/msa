// 운영 번들에서 악세서리가 직업 전용인지 실측한다.
// 화면(대기실 선택지)과 규칙(시뮬의 allowedAccessory·줍기) 둘 다 본다 — 한쪽만 맞으면 화면과 권위가 갈린 것이다.
// 사용: node tools/e2e-prod-accex.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
// 직업당 전용 셋 (2026-09-13). 순서까지 본다 — 대기실은 [맨손, …전용] 순으로 그린다.
const WANT = {
  fighter: ['rocket', 'knuckle', 'chain'],
  grappler: ['shield', 'claw', 'anchor'],
  speedster: ['pistols', 'dagger', 'chakram'],
  heavy: ['greatsword', 'hammer', 'cannon'],
  martial: ['spear', 'staff', 'nunchaku'],
};
const ALL = Object.values(WANT).flat();
try {
  await page.open(url, { width: 1000, height: 900 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);

  // ① 대기실: 직업을 누르면 선택지가 [맨손, 전용 하나] 로 바뀐다
  const seen = {};
  for (const st of Object.keys(WANT)) {
    await page.eval(`(() => { document.querySelector('.stylebtn[data-style="${st}"]').click(); return true; })()`);
    await page.sleep(120);
    seen[st] = JSON.parse(await page.eval(`JSON.stringify([...document.querySelectorAll('.acc:not(.stylebtn)')].map((b) => b.dataset.acc))`));
  }
  console.log(`대기실 선택지 ${JSON.stringify(seen)}`);
  checks.lobbyShowsOwnOnly = Object.entries(WANT).every(([st, accs]) => seen[st].join(',') === ['none', ...accs].join(','));

  // ② 규칙: 판을 띄워 시뮬에 직접 물어본다 (권위가 쓰는 바로 그 함수의 산출물)
  await page.type('.nick', '전용실측');
  await page.eval(`document.querySelector('.bots').value = '3'`);
  await page.click('.practice');
  await page.waitFor(`window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  const rule = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world; const me = w.players[window.__amp.source.myId];
    const styles = ${JSON.stringify(Object.keys(WANT))}, accs = ${JSON.stringify(ALL)};
    const out = {};
    for (const st of styles) {
      me.style = st;
      out[st] = accs.filter((a) => { // 그 직업이 실제로 주울 수 있는 것만 남는다
        const it = { kind: 'acc', acc: a, heldBy: -1, airborne: false, hp: 1, x: me.pos.x, y: me.pos.y, z: me.pos.z, id: 9990 };
        w.items = [it]; me.acc = 'none'; me.holding = -1;
        return w.tryPickup(me);
      });
      me.acc = 'none';
    }
    w.items = [];
    return JSON.stringify(out); })()`));
  console.log(`시뮬이 실제로 줍는 것 ${JSON.stringify(rule)}`);
  checks.pickupRespectsStyle = Object.entries(WANT).every(([st, accs]) => rule[st].slice().sort().join(',') === accs.slice().sort().join(','));

  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  try { await page.shot(`${out}/prod-accex-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
