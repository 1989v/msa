// 운영 세로 모바일 실측: 카탈로그 상세(390×844, 터치 에뮬레이션)에서 「플레이」를 실제 탭으로 누르면 몰입 IFRAME 이 뜨고,
// 그 안의 게임 뿌리(#app)가 90° 돌아(844×390) 가로로 진행되는지, 「연습」을 탭하면 매치 캔버스가 844×390 인지 본다.
// (헤드리스에는 방향 잠금이 없어 뷰포트가 세로로 남는다 — iOS 사파리와 같은 경로)
// 사용: node tools/e2e-prod-portrait.mjs <cdpPort> <detailUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
const W = 390, H = 844;
const FRAME = `document.querySelector('iframe.game-stage-frame')`;
const tapAt = async (x, y) => { await page.touchStart([{ x, y, id: 1 }]); await page.sleep(60); await page.touchEnd(); };
const centerOf = async (selector, inFrame) => JSON.parse(await page.eval(`(() => {
  const f = ${FRAME}; const doc = ${inFrame ? 'f.contentDocument' : 'document'};
  const el = doc.querySelector(${JSON.stringify(selector)}); if (!el) return 'null';
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); const o = ${inFrame ? 'f.getBoundingClientRect()' : '{ left: 0, top: 0 }'};
  return JSON.stringify({ x: o.left + r.left + r.width / 2, y: o.top + r.top + r.height / 2, w: r.width, h: r.height }); })()`));
try {
  await page.open(url, { width: W, height: H, mobile: true, touch: true });
  await page.waitFor(`document.querySelector('.game-play-btn')`, { timeout: 20000 });
  await page.sleep(400);
  const play = await centerOf('.game-play-btn', false);
  await page.sleep(300);
  await tapAt(play.x, play.y);
  await page.waitFor(`(() => { const f = ${FRAME}; try { return !!f && !!f.contentDocument.querySelector('.practice'); } catch { return false; } })()`, { timeout: 30000 });
  await page.sleep(600);
  const stage = JSON.parse(await page.eval(`(() => { const f = ${FRAME}; const r = f.getBoundingClientRect(); const a = f.contentDocument.getElementById('app');
    return JSON.stringify({ immersive: !!document.querySelector('.game-stage.is-immersive'), frame: [Math.round(r.width), Math.round(r.height)], inner: [f.contentWindow.innerWidth, f.contentWindow.innerHeight], rotated: a.classList.contains('rotated'), app: [a.clientWidth, a.clientHeight] }); })()`));
  console.log(`after Play tap: ${JSON.stringify(stage)}`);
  checks.immersivePortraitFrame = stage.immersive && stage.inner[1] > stage.inner[0];
  checks.rootRotated = stage.rotated && stage.app[0] === stage.inner[1] && stage.app[1] === stage.inner[0];
  await page.shot(`${out}/prod-portrait-title.png`);
  // 닉네임을 넣고 「연습」을 실제 탭 — 전체화면 요청 + 매치 시작
  await page.eval(`(() => { const d = ${FRAME}.contentDocument; const n = d.querySelector('.nick'); n.value = '세로실측'; n.dispatchEvent(new Event('input', { bubbles: true })); d.querySelector('.bots').value = '2'; return true; })()`);
  const practice = await centerOf('.practice', true);
  await page.sleep(300);
  await tapAt(practice.x, practice.y);
  await page.waitFor(`(() => { const f = ${FRAME}; try { const d = f.contentDocument; return !!d.querySelector('.match canvas') && !!f.contentWindow.__amp && f.contentWindow.__amp.source.world.phase === 'play'; } catch { return false; } })()`, { timeout: 30000 });
  await page.sleep(500);
  const match = JSON.parse(await page.eval(`(() => { const f = ${FRAME}; const d = f.contentDocument; const c = d.querySelector('.match canvas'); const a = d.getElementById('app');
    return JSON.stringify({ fullscreenTop: document.fullscreenElement ? document.fullscreenElement.tagName : null, fullscreenFrame: d.fullscreenElement ? d.fullscreenElement.tagName : null, inner: [f.contentWindow.innerWidth, f.contentWindow.innerHeight], rotated: a.classList.contains('rotated'), canvas: [c.width, c.height], css: [c.clientWidth, c.clientHeight], buttons: d.querySelectorAll('.touchpad .tbtn').length }); })()`));
  console.log(`after 연습 tap: ${JSON.stringify(match)}`);
  checks.matchLandscapeCanvas = match.rotated && match.canvas[0] === match.inner[1] && match.canvas[1] === match.inner[0] && match.buttons === 6;
  await page.shot(`${out}/prod-portrait-match.png`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/prod-portrait-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
