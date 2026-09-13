// 협동 시나리오 실측 (2026-09-13 소감): 사람은 한 편, 봇 물결이 점점 세게 온다.
// 연습(봇과 대전)에서 협동을 골라 시작하고, 봇을 눕혀 물결이 넘어가는지 본다.
// 사용: node tools/e2e-coop.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';
const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
try {
  await page.open(base + '/', { width: 1100, height: 760 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.type('.nick', '협동');
  await page.eval(`(() => { const m = document.querySelector('.mode'); m.value = 'coop'; m.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.bots').value = '3'; return true; })()`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.sleep(600);

  const teams = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world;
    const ppl = w.players.filter(Boolean).map((p) => ({ id: p.id, bot: p.bot, team: p.team, lives: p.lives }));
    return JSON.stringify({ wave: w.wave, chip: document.querySelector('.mode')?.textContent ?? '', ppl }); })()`));
  console.log(`시작: 물결 ${teams.wave} · 칩 「${teams.chip}」 · ${JSON.stringify(teams.ppl)}`);
  checks.humansRed = teams.ppl.filter((p) => !p.bot).every((p) => p.team === 0);
  checks.botsBlue = teams.ppl.filter((p) => p.bot).every((p) => p.team === 1);
  checks.botsOneLife = teams.ppl.filter((p) => p.bot).every((p) => p.lives === 1);
  checks.chipShowsWave = teams.chip.includes('물결 1');

  // 봇을 전부 눕힌다 → 다음 물결
  const hpBefore = await page.eval(`(() => { const w = window.__amp.source.world; return w.players.find((p) => p && p.bot).maxHp; })()`);
  await page.eval(`(() => { const w = window.__amp.source.world;
    for (const p of w.players) if (p && p.bot) { p.hp = 1; w.kill(p, 'hit', null); } return true; })()`);
  await page.sleep(1800);
  const after = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world; const b = w.players.find((p) => p && p.bot);
    return JSON.stringify({ wave: w.wave, phase: w.phase, botHp: b.hp, botMax: b.maxHp, alive: b.alive, chip: document.querySelector('.mode')?.textContent ?? '' }); })()`));
  console.log(`봇 전멸 뒤: ${JSON.stringify(after)} (직전 봇 최대 체력 ${hpBefore})`);
  checks.waveAdvanced = after.wave === 2 && after.phase === 'play';
  checks.botsStronger = after.botMax > Number(hpBefore) && after.alive === true && after.botHp === after.botMax;
  checks.chipUpdated = after.chip.includes('물결 2');
  await page.shot(`${out}/coop.png`);

  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 4)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) { console.error('FAIL', e.message, JSON.stringify(checks)); process.exitCode = 1; } finally { await page.close(); }
