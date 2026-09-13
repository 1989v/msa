// 운영 번들에서 협동 시나리오와 방 규칙이 도는지 (2026-09-13). 연습 모드는 브라우저가 시뮬을 직접 돌리므로
// 온라인 방장 워커와 같은 코드다 — 규칙·물결을 여기서 재면 배포본을 재는 것이다.
// 사용: node tools/e2e-prod-coop.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';
const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
try {
  await page.open(url, { width: 1100, height: 760 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', '협동운영');
  // 모드 목록에 협동이 있어야 고를 수 있다
  const modes = await page.eval(`JSON.stringify([...document.querySelectorAll('.mode option')].map((o) => o.value))`);
  console.log(`모드 목록 ${modes}`);
  checks.coopOffered = JSON.parse(modes).includes('coop');
  await page.eval(`(() => { const m = document.querySelector('.mode'); m.value = 'coop'; m.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.bots').value = '3'; return true; })()`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.sleep(700);

  const start = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world;
    const ppl = w.players.filter(Boolean).map((p) => ({ bot: p.bot, team: p.team, lives: p.lives }));
    return JSON.stringify({ wave: w.wave, chip: document.querySelector('.mode')?.textContent ?? '', ppl }); })()`));
  console.log(`시작: 물결 ${start.wave} · 칩 「${start.chip}」 · ${JSON.stringify(start.ppl)}`);
  checks.sidesPinned = start.ppl.filter((p) => !p.bot).every((p) => p.team === 0) && start.ppl.filter((p) => p.bot).every((p) => p.team === 1);
  checks.waveShown = start.chip.includes('물결 1');

  const before = Number(await page.eval(`window.__amp.source.world.players.find((p) => p && p.bot).maxHp`));
  await page.eval(`(() => { const w = window.__amp.source.world; for (const p of w.players) if (p && p.bot) { p.hp = 1; w.kill(p, 'hit', null); } return true; })()`);
  await page.sleep(1800);
  const after = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world; const b = w.players.find((p) => p && p.bot);
    return JSON.stringify({ wave: w.wave, phase: w.phase, max: b.maxHp, alive: b.alive }); })()`));
  console.log(`봇 전멸 뒤 ${JSON.stringify(after)} (직전 최대 체력 ${before})`);
  checks.waveAdvanced = after.wave === 2 && after.phase === 'play' && after.max > before && after.alive === true;

  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 4)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) { console.error('FAIL', e.message, JSON.stringify(checks)); process.exitCode = 1; } finally { await page.close(); }
