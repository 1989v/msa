// 전체화면 실측: 카탈로그 상세(IFRAME)에서 「플레이」→ 게임의 「연습」을 **CDP 의 실제 마우스 클릭**(신뢰된 제스처)으로 눌러
// 문서가 전체화면으로 올라가는지, 매치 안 토글 버튼으로 해제·재진입이 되는지 본다. el.click() 은 제스처가 아니라 안 된다.
// 사용: node tools/e2e-prod-fullscreen.mjs <cdpPort> <detailUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
const FRAME = `document.querySelector('iframe.game-stage-frame')`;
/** 요소의 화면 좌표(중심). inFrame 이면 IFRAME 안 요소 — IFRAME 의 위치를 더한다 */
/** 요소를 보이게 스크롤한 뒤(IFRAME 은 무대가 560px 이라 타이틀 폼의 버튼이 아래로 잘린다) 중심 좌표를 잰다 */
const center = async (selector, inFrame) => {
  await page.eval(`(() => { const f = ${FRAME}; const doc = ${inFrame ? `f.contentDocument` : 'document'};
    if (f) f.scrollIntoView({ block: 'center' }); const el = doc.querySelector(${JSON.stringify(selector)}); if (el) el.scrollIntoView({ block: 'center' }); return true; })()`);
  await page.sleep(300);
  return JSON.parse(await page.eval(`(() => {
    const f = ${FRAME}; const doc = ${inFrame ? `f.contentDocument` : 'document'};
    const el = doc.querySelector(${JSON.stringify(selector)}); if (!el) return 'null';
    const r = el.getBoundingClientRect(); const o = ${inFrame ? 'f.getBoundingClientRect()' : '{ left: 0, top: 0 }'};
    return JSON.stringify({ x: o.left + r.left + r.width / 2, y: o.top + r.top + r.height / 2, w: r.width, h: r.height, frameTop: o.top, innerTop: r.top }); })()`));
};
const trustedClick = async (x, y) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const FS = `JSON.stringify({ top: document.fullscreenElement ? document.fullscreenElement.tagName : null, frame: (() => { const f = ${FRAME}; return f && f.contentDocument.fullscreenElement ? f.contentDocument.fullscreenElement.tagName : null; })(), frameSize: (() => { const f = ${FRAME}; return f ? [f.contentWindow.innerWidth, f.contentWindow.innerHeight] : null; })(), viewport: [window.innerWidth, window.innerHeight] })`;
try {
  await page.open(url, { width: 1280, height: 900 });
  await page.waitFor(`document.querySelector('.game-play-btn')`, { timeout: 20000 });
  const play = await center('.game-play-btn', false);
  await trustedClick(play.x, play.y);
  await page.waitFor(`(() => { const f = ${FRAME}; try { return !!f && !!f.contentDocument.querySelector('.practice'); } catch { return false; } })()`, { timeout: 30000 });
  await page.eval(`(() => { const d = ${FRAME}.contentDocument; const n = d.querySelector('.nick'); n.value = '전체화면'; n.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const before = JSON.parse(await page.eval(FS));
  console.log(`before: ${JSON.stringify(before)}`);
  // 「연습 · 봇과 대전」을 실제 클릭 — 이 제스처 안에서 enterFullscreen() 이 불린다
  const practice = await center('.practice', true);
  console.log(`practice button at ${JSON.stringify(practice)}`);
  await trustedClick(practice.x, practice.y);
  await page.sleep(1500);
  const after = JSON.parse(await page.eval(FS));
  const inner = await page.eval(`(() => { const d = ${FRAME}.contentDocument; return JSON.stringify({ toast: d.querySelector('.toast')?.textContent ?? null, match: !!d.querySelector('.match'), amp: !!${FRAME}.contentWindow.__amp }); })()`);
  console.log(`after practice click: ${JSON.stringify(after)} inner ${inner}`);
  checks.enteredOnStart = after.top === 'IFRAME' && after.frame === 'HTML' && after.frameSize[0] === after.viewport[0] && after.frameSize[1] === after.viewport[1];
  await page.waitFor(`(() => { const f = ${FRAME}; return !!f.contentDocument.querySelector('.match canvas'); })()`, { timeout: 20000 });
  await page.shot(`${out}/prod-fullscreen.png`);
  // 매치 안 토글 버튼: 해제 → 다시 진입
  const btn = await center('.fsbtn', true);
  console.log(`toggle button: ${JSON.stringify(btn)}`);
  await trustedClick(btn.x, btn.y);
  await page.sleep(800);
  const off = JSON.parse(await page.eval(FS));
  console.log(`after toggle (exit): ${JSON.stringify(off)}`);
  checks.toggleExits = off.top === null && off.frame === null && off.frameSize[0] < off.viewport[0];
  const btn2 = await center('.fsbtn', true);
  await trustedClick(btn2.x, btn2.y);
  await page.sleep(800);
  const on = JSON.parse(await page.eval(FS));
  console.log(`after toggle (re-enter): ${JSON.stringify(on)}`);
  checks.toggleReenters = on.top === 'IFRAME' && on.frame === 'HTML';
  const label = await page.eval(`${FRAME}.contentDocument.querySelector('.fsbtn').textContent`);
  console.log(`button label now: ${label}`);
  console.log(`checks ${JSON.stringify(checks)}`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/prod-fullscreen-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
