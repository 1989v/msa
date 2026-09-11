// 카탈로그 상세(game.1989v.com/games/arena)가 IFRAME 으로 게임을 띄우는지 본다 — 같은 오리진이라 프레임 안 DOM 까지 확인한다.
// 사용: node tools/e2e-catalog.mjs <cdpPort> <detailUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena', out = '.'] = process.argv.slice(2);
const page = new Page(port);
try {
  await page.open(url, { width: 1280, height: 900 });
  // 상세 페이지는 「플레이」 버튼을 눌러야 IFRAME 을 붙인다 (자동 재생 방지 게이트)
  await page.waitFor(`document.querySelector('.game-play-btn')`, { timeout: 20000 });
  await page.click('.game-play-btn');
  await page.waitFor(`document.querySelector('iframe.game-stage-frame')`, { timeout: 20000 });
  const src = await page.eval(`document.querySelector('iframe.game-stage-frame').getAttribute('src')`);
  await page.waitFor(`(() => { const f = document.querySelector('iframe.game-stage-frame'); try { return !!f.contentDocument?.querySelector('.practice'); } catch { return false; } })()`, { timeout: 30000 });
  const info = await page.eval(`JSON.stringify({ title: document.querySelector('h1')?.textContent?.trim(), src: document.querySelector('iframe.game-stage-frame').getAttribute('src'), allow: document.querySelector('iframe.game-stage-frame').getAttribute('allow'), frameTitle: document.querySelector('iframe.game-stage-frame').contentDocument.title, frameButtons: document.querySelector('iframe.game-stage-frame').contentDocument.querySelectorAll('.btn').length })`);
  await page.eval(`document.querySelector('iframe.game-stage-frame').scrollIntoView({ block: 'center' }); true`);
  await page.sleep(800);
  await page.shot(`${out}/catalog-detail.png`);
  console.log(`catalog ${info}`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && src.includes('/games/arena/index.html') ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/catalog-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
