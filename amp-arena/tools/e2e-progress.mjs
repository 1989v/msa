// 진행 E2E: 타이틀의 레벨·골드 줄 → 스탯 분배 모달(+ 두 번) → 상점(상의 구매·입기) → 연습 시작 시 시뮬의 스탯·명단 스킨에 반영
// → 판을 끝내면 결과 줄에 +XP·골드 → 타이틀로 돌아오면 줄이 갱신되고 localStorage 에 남는다.
// 사용: node tools/e2e-progress.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const checks = {};
const ROW = `document.querySelector('.progress-row')?.textContent ?? ''`;
try {
  await page.open(pageUrl('/'), { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.eval(`localStorage.removeItem('amp.progress.v1'); true`);
  await page.send('Page.reload', {});
  await page.sleep(300);
  await page.waitFor(`document.querySelector('.progress-row')`, { timeout: 20000 });
  const row0 = await page.eval(ROW);
  console.log(`fresh row: ${row0.replace(/\s+/g, ' ').trim()}`);
  checks.freshLv1 = row0.includes('Lv 1') && row0.includes('0 골드');
  // Lv4 (720 XP) · 골드 500 을 심고 새로고침
  await page.eval(`localStorage.setItem('amp.progress.v1', JSON.stringify({ v: 1, xp: 720, gold: 500, matches: 3, kos: 4, wins: 1, alloc: {}, owned: [], skin: { shirt: -1, hair: -1, band: -1 }, updated: 1 })); true`);
  await page.send('Page.reload', {});
  await page.sleep(300);
  await page.waitFor(`(document.querySelector('.progress-row')?.textContent ?? '').includes('Lv 4')`, { timeout: 20000 });
  const row1 = await page.eval(ROW);
  console.log(`seeded row: ${row1.replace(/\s+/g, ' ').trim()}`);
  checks.seededLv4 = row1.includes('Lv 4') && row1.includes('500 골드') && row1.includes('스탯 분배') && row1.includes('3');
  // 스탯 분배: 체력 +2
  await page.click('.stats-btn');
  await page.waitFor(`document.querySelector('.modal .stats-table')`);
  await page.click('tr[data-stat="hp"] .plus');
  await page.sleep(80);
  await page.click('tr[data-stat="hp"] .plus');
  await page.sleep(80);
  const hpRow = await page.eval(`document.querySelector('tr[data-stat="hp"]').textContent.replace(/\\s+/g, ' ')`);
  const freeText = await page.eval(`document.querySelector('.modal .stats-body').textContent`);
  console.log(`stats modal hp row: ${hpRow} · free: ${(freeText.match(/남은 포인트\\s*(\\d+)/) ?? [])[1]}`);
  checks.allocated = hpRow.includes('+2') && /남은 포인트\s*1\b/.test(freeText);
  await page.shot(`${out}/e2e-progress-stats.png`);
  await page.click('.modal .close');
  // 상점: 상의 8 (150 골드) 구매 → 입는 중
  await page.click('.shop-btn');
  await page.waitFor(`document.querySelector('.modal .swatches')`);
  await page.click('.swatch[data-kind="shirt"][data-idx="8"]');
  await page.sleep(150);
  const shopState = JSON.parse(await page.eval(`JSON.stringify({ on: document.querySelector('.swatch[data-kind="shirt"][data-idx="8"]').classList.contains('on'), gold: (document.querySelector('.modal .chip.amp')?.textContent ?? '') })`));
  console.log(`shop after buying shirt:8 → ${JSON.stringify(shopState)}`);
  checks.bought = shopState.on && shopState.gold.includes('350');
  await page.shot(`${out}/e2e-progress-shop.png`);
  await page.click('.modal .close');
  const saved = JSON.parse(await page.eval(`localStorage.getItem('amp.progress.v1')`));
  checks.persisted = saved.alloc.hp === 2 && saved.gold === 350 && saved.owned.includes('shirt:8') && saved.skin.shirt === 8;
  // 연습 시작: 시뮬 스탯·명단 스킨
  await page.type('.nick', '진행실측');
  await page.eval(`document.querySelector('.bots').value = '3'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  const sim = JSON.parse(await page.eval(`(() => { const s = window.__amp.source; const me = s.world.players[s.myId]; return JSON.stringify({ hp: me.stats.hp, maxHp: me.maxHp, atk: me.stats.atk, skin: s.roster[0].skin, bot: s.world.players[1].stats.hp }); })()`));
  console.log(`in match: ${JSON.stringify(sim)}`);
  checks.simStats = sim.hp === 5 && sim.maxHp === 120 && sim.atk === 3 && sim.skin && sim.skin.shirt === 8 && sim.bot >= 2 && sim.bot <= 5; // 봇은 직업 기본치 그대로(배분 없음)
  await page.shot(`${out}/e2e-progress-match.png`);
  // 판을 끝낸다 → 결과 줄
  await page.eval(`(() => { const w = window.__amp.source.world; const me = w.players[window.__amp.source.myId]; me.kos = 1; me.dmgDealt = 50; w.timeLeft = 120; return true; })()`);
  await page.waitFor(`document.querySelector('.result')`, { timeout: 15000 });
  await page.waitFor(`(document.querySelector('.result .note')?.textContent ?? '').includes('XP')`, { timeout: 8000 });
  const note = await page.eval(`document.querySelector('.result .note').textContent`);
  console.log(`result note: "${note}"`);
  checks.rewardNote = /\+\d+ XP · \+\d+ 골드/.test(note);
  await page.shot(`${out}/e2e-progress-result.png`);
  // 타이틀로 → 줄 갱신
  await page.eval(`[...document.querySelectorAll('.result .btns button')].find((b) => b.textContent.includes('타이틀로')).click()`);
  await page.waitFor(`document.querySelector('.progress-row')`, { timeout: 10000 });
  const row2 = await page.eval(ROW);
  const after = JSON.parse(await page.eval(`localStorage.getItem('amp.progress.v1')`));
  console.log(`after match row: ${row2.replace(/\s+/g, ' ').trim()} · saved xp ${after.xp} gold ${after.gold} matches ${after.matches}`);
  checks.rowUpdated = after.xp > 720 && after.gold > 350 && after.matches === 4 && row2.includes(`${after.gold} 골드`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/e2e-progress-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
