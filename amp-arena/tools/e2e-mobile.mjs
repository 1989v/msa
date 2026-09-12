// 모바일 가로 (844×390 CSS px) + 터치 조작 강제(?touch=1): 레이아웃 스크린샷 · 콘솔 오류 0.
// 사용: node tools/e2e-mobile.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:8787', out = '.'] = process.argv.slice(2);
const page = new Page(port);
try {
  await page.open(base + '/?touch=1', { width: 844, height: 390, mobile: true, touch: true });
  await page.waitFor(`document.querySelector('.practice')`);
  await page.shot(`${out}/e2e-mobile-title.png`);
  await page.type('.nick', '모바일');
  await page.eval(`document.querySelector('.bots').value = '3'`);
  const tap = await page.tapElement('.practice'); // 실제 탭 — 버튼에 손이 닿아야 한다 (2026-09-12: 넘친 타이틀이 스크롤이 안 돼 못 닿던 결함)
  console.log(`tapped .practice at ${JSON.stringify(tap)}`);
  await page.waitFor(`document.querySelector('.match canvas') && document.querySelector('.touchpad')`);
  await page.sleep(3600);
  await page.hold('ArrowUp', 'ArrowUp', 800);
  await page.tap('KeyZ', 'z', 50);
  await page.sleep(400);
  await page.shot(`${out}/e2e-mobile-match.png`);
  const info = await page.eval(`JSON.stringify({ buttons: document.querySelectorAll('.touchpad .tbtn').length, hudPlate: !!document.querySelector('.hud .plate'), w: innerWidth, h: innerHeight })`);
  console.log('mobile', info, `errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length ? 1 : 0;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  try { await page.shot(`${out}/e2e-mobile-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
