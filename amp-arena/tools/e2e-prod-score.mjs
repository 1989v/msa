// 운영 순위표 실측: 카탈로그의 진짜 API 로 연습 판 결과가 올라가는지 본다.
// 연습 판을 띄워 KO·데미지를 적고 2초 남기고 끝낸 뒤 ① 결과 화면 아래 줄에 「연습 순위표 N위」 ② `GET /api/v1/games/arena/leaderboard?board=practice` 에 그 닉네임이 있는지.
// 닉네임은 매번 다르게 만들어(시각 기반) 남의 기록과 섞이지 않는다. 운영 DB 에 시험 기록이 한 줄 남는다.
// 사용: node tools/e2e-prod-score.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
const nick = `실측${String(Date.now()).slice(-6)}`;
try {
  await page.open(url, { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', nick);
  await page.eval(`document.querySelector('.bots').value = '3'; document.querySelector('.mode').value = 'ffa_dm'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.eval(`(() => { const w = window.__amp.source.world; const me = w.players[window.__amp.source.myId]; me.kos = 1; me.dmgDealt = 77; w.timeLeft = 120; return true; })()`);
  await page.waitFor(`document.querySelector('.result')`, { timeout: 15000 });
  await page.waitFor(`(document.querySelector('.result .note')?.textContent ?? '').length > 0`, { timeout: 10000 });
  const note = await page.eval(`document.querySelector('.result .note').textContent`);
  const mine = JSON.parse(await page.eval(`JSON.stringify(window.__amp.source.ended.ranking.find((r) => r.id === window.__amp.source.myId))`));
  const expectScore = mine.kos * 100 + mine.dmg + (mine.win ? 50 : 0);
  console.log(`nick ${nick} · my entry ${JSON.stringify(mine)} · expected score ${expectScore}`);
  console.log(`result note: "${note}"`);
  checks.noteRank = /^연습 순위표 \d+위 · \d+점/.test(note) && note.includes(`${expectScore}점`);
  const board = await page.eval(`fetch('/api/v1/games/arena/leaderboard?board=practice&limit=50').then((r) => r.json()).then((b) => JSON.stringify(b))`, true);
  const parsed = JSON.parse(board);
  const entries = parsed.data ?? [];
  const mineRow = entries.find((e) => e.nickname === nick);
  console.log(`leaderboard practice: ${entries.length} rows · mine ${JSON.stringify(mineRow ?? null)}`);
  checks.onLeaderboard = !!mineRow && mineRow.score === expectScore;
  await page.shot(`${out}/prod-score.png`);
  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/prod-score-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
