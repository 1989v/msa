// 운영 반영 확인: 정적 페이지(index.html)를 직접 열어 연습 매치를 띄우고 스크린샷 + 번들 이름을 찍는다.
// 사용: node tools/e2e-prod-practice.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
try {
  await page.open(url, { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', '확인');
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp`, { timeout: 20000 });
  await page.sleep(4500); // 카운트다운 뒤 플레이 화면
  await page.keyDown('ArrowUp', 'ArrowUp'); await page.sleep(900); await page.keyUp('ArrowUp', 'ArrowUp');
  await page.tap('KeyZ', 'z', 50);
  await page.sleep(120);
  await page.shot(`${out}/prod-practice.png`);
  const info = await page.eval(`JSON.stringify({ tick: window.__amp.source.world.tick, phase: window.__amp.source.world.phase, me: (() => { const p = window.__amp.source.world.players[0]; return { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), state: p.state }; })() })`);
  console.log(`bundle ${bundle}`);
  console.log(`match ${info}`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  try { await page.shot(`${out}/prod-practice-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
