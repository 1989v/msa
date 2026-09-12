// 순위표 제출 배선 실측 (프리뷰 `/games/arena/` 에서): 연습 판을 2초 남기고 끝내면 게임이
// `POST /api/v1/games/arena/scores` 를 부르는지, 몸체(nickname·score·board·detail)가 맞는지, 응답의 순위가 결과 화면 아래 줄에 뜨는지 본다.
// 요청은 CDP Fetch 로 가로채 가짜 응답을 준다 — 프리뷰에는 API 가 없다. 운영은 tools/e2e-prod-score.mjs 가 진짜 API 로 본다.
// 사용: node tools/e2e-score.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5181/games/arena', out = '.'] = process.argv.slice(2);
const url = base.endsWith('.html') ? base : base.replace(/\/?$/, '/');
const page = new Page(port);
const checks = {};
let captured = null;
try {
  await page.open(url, { width: 1280, height: 720 });
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/games/arena/scores', requestStage: 'Request' }] });
  page.events.set('Fetch.requestPaused', (p) => {
    captured = { method: p.request.method, url: p.request.url, headers: p.request.headers, body: p.request.postData ? JSON.parse(p.request.postData) : null };
    const body = Buffer.from(JSON.stringify({ success: true, data: { applied: true, rank: 3 } })).toString('base64');
    void page.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body });
  });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.eval(`document.cookie = 'portal_access_token=test-token; path=/'`);
  await page.type('.nick', '기록실측');
  await page.eval(`document.querySelector('.bots').value = '3'; document.querySelector('.mode').value = 'ffa_dm'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  // 점수가 0 이면 보내지 않으므로 KO 하나·데미지를 미리 적어 둔다 (판정은 시뮬 값이 원본이다)
  await page.eval(`(() => { const w = window.__amp.source.world; const me = w.players[window.__amp.source.myId]; me.kos = 2; me.dmgDealt = 130; w.timeLeft = 120; return true; })()`);
  await page.waitFor(`document.querySelector('.result')`, { timeout: 15000 });
  await page.sleep(800);
  const note = await page.eval(`document.querySelector('.result .note')?.textContent ?? ''`);
  const mine = JSON.parse(await page.eval(`JSON.stringify(window.__amp.source.ended.ranking.find((r) => r.id === window.__amp.source.myId))`));
  console.log(`captured request: ${JSON.stringify(captured)}`);
  console.log(`my rank entry: ${JSON.stringify(mine)} · note: "${note}"`);
  const expectScore = mine.kos * 100 + mine.dmg + (mine.win ? 50 : 0);
  checks.posted = !!captured && captured.method === 'POST' && captured.url.endsWith('/api/v1/games/arena/scores');
  checks.body = !!captured && captured.body.nickname === '기록실측' && captured.body.board === 'practice' && captured.body.score === expectScore && typeof captured.body.detail === 'string' && captured.body.detail.includes('KO');
  checks.bearer = !!captured && captured.headers.Authorization === 'Bearer test-token';
  checks.noteShown = note === `연습 순위표 3위 · ${expectScore}점 (새 기록)`;
  await page.shot(`${out}/e2e-score.png`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks), JSON.stringify(captured));
  try { await page.shot(`${out}/e2e-score-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
