// 연습 모드 E2E: 타이틀 → 연습 시작 → 이동·공격·점프 입력 → 스크린샷 · 콘솔 오류 0 확인.
// 사용: node tools/e2e-practice.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
try {
  await page.open(base + '/', { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`);
  await page.shot(`${out}/e2e-title.png`);
  await page.type('.nick', '루키');
  await page.eval(`document.querySelector('.bots').value = '5'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && document.querySelector('.hud .timer .t')`);
  log('match started');
  await page.sleep(3400); // 카운트다운
  await page.shot(`${out}/e2e-countdown-end.png`);
  // 앞으로 걷기 → 대시(더블탭) → 공격 연타 → 점프 → 가드
  await page.hold('ArrowUp', 'ArrowUp', 900);
  await page.tap('ArrowUp', 'ArrowUp', 60); await page.sleep(80); await page.keyDown('ArrowUp', 'ArrowUp'); await page.sleep(1200); await page.keyUp('ArrowUp', 'ArrowUp');
  await page.shot(`${out}/e2e-run.png`);
  for (let i = 0; i < 4; i++) { await page.tap('KeyZ', 'z', 50); await page.sleep(120); }
  await page.shot(`${out}/e2e-attack.png`);
  await page.tap('KeyX', 'x', 50); await page.sleep(350);
  await page.shot(`${out}/e2e-jump.png`);
  await page.hold('KeyC', 'c', 800);
  await page.tap('KeyV', 'v', 50); await page.sleep(400);
  await page.shot(`${out}/e2e-special.png`);
  // 몇 초 더 두고 봇들이 싸우는 장면
  await page.hold('ArrowLeft', 'ArrowLeft', 600);
  await page.sleep(2500);
  await page.shot(`${out}/e2e-brawl.png`);
  const hud = await page.eval(`JSON.stringify({ timer: document.querySelector('.hud .timer .t')?.textContent, hp: document.querySelector('.hud .hp-text')?.textContent, roster: document.querySelectorAll('.hud .roster .r').length - 1, plates: [...document.querySelectorAll('.hud .nameplate')].filter(e => e.style.display !== 'none').length, feed: document.querySelector('.hud .feed')?.textContent?.slice(0, 80) })`);
  log(`hud ${hud}`);
  const fps = await page.eval(`new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r((n / ((performance.now() - t) / 1000)).toFixed(1)); }; requestAnimationFrame(f); })`, true);
  log(`fps ${fps} (헤드리스 소프트웨어 GL, 참고값)`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 10)) console.log('  !', e.slice(0, 300));
  for (const l of page.logs.filter((l) => l.includes('[match]') || l.includes('[net]'))) console.log('  ', l);
  process.exitCode = page.errors.length ? 1 : 0;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  for (const err of page.errors.slice(0, 10)) console.log('  !', err.slice(0, 300));
  for (const l of page.logs.slice(-10)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/e2e-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
