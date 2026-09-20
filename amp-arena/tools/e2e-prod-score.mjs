// 운영 순위표 실측: 카탈로그의 진짜 API 가 헤드리스 제출을 **기록하지 않는지** 본다 (ADR-0084 개정 2026-09-20).
// 연습 판을 띄워 KO·데미지를 적고 2초 남기고 끝낸 뒤 ① 게임이 보낸 `POST /scores` 의 응답이 `excluded=true` 인지
// ② `GET /api/v1/games/arena/leaderboard?board=practice` 에 그 닉네임이 **없는지**. 서버는 HeadlessChrome UA 를 자동화로
// 보고 받되 쓰지 않는다 — 운영 DB 에 시험 기록이 남지 않아야 통과다. UA 를 사람 것으로 씌우면 행이 남으므로 씌우지 않는다.
// 응답은 `.practice` 클릭 전에 window.fetch 를 감싸 잡는다 — 게임의 실제 제출 경로를 그대로 지난다(스크립트가 따로 제출하지 않는다).
// 닉네임은 매번 다르게 만들어(시각 기반) 남의 기록과 섞이지 않는다.
// 결과 화면 문구는 번들에 따라 다르다: 재게시 전 번들은 「연습 순위표 0위 · N점 (최고 기록 유지)」, 그 뒤는 「… 순위표에 오르지 않습니다」.
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
  await page.eval(`(() => { const orig = window.fetch; window.__scoreResp = null; window.fetch = async (input, init) => { const r = await orig(input, init); const u = typeof input === 'string' ? input : input.url; if (u.includes('/api/v1/games/arena/scores') && init && init.method === 'POST') { try { window.__scoreResp = await r.clone().json(); } catch (e) { window.__scoreResp = { parseError: String(e) }; } } return r; }; return true; })()`);
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
  checks.noteScore = note.includes(`${expectScore}점`);
  await page.waitFor(`window.__scoreResp !== null`, { timeout: 10000 });
  const scoreResp = JSON.parse(await page.eval(`JSON.stringify(window.__scoreResp)`));
  console.log(`score response: ${JSON.stringify(scoreResp)}`);
  checks.excluded = !!scoreResp && scoreResp.success === true && scoreResp.data?.excluded === true && scoreResp.data?.applied === false;
  const board = await page.eval(`fetch('/api/v1/games/arena/leaderboard?board=practice&limit=50').then((r) => r.json()).then((b) => JSON.stringify(b))`, true);
  const parsed = JSON.parse(board);
  const entries = parsed.data ?? [];
  const mineRow = entries.find((e) => e.nickname === nick);
  console.log(`leaderboard practice: success=${parsed.success} · ${entries.length} rows · mine ${JSON.stringify(mineRow ?? null)}`);
  // 보드 요청이 실패하면 빈 배열이라 「없다」가 공짜로 참이 된다 — success 를 같이 본다
  checks.notOnLeaderboard = parsed.success === true && !mineRow;
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
