// 옥상 기계실 확인: 연습(옥상)을 띄우고 내 캐릭터를 방 앞·방 안으로 옮겨 스크린샷 — 벽·지붕이 안에서 비치는지 눈으로 본다.
// 사용: node tools/shot-rooftop.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
try {
  await page.open(pageUrl('/'), { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.type('.nick', '옥상');
  await page.eval(`document.querySelector('.map').value = 'rooftop'; document.querySelector('.bots').value = '3'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.eval(`(() => { const me = ${ME}; me.pos.x = -2; me.pos.z = 5; me.pos.y = 0; me.vel.x = me.vel.z = 0; return true; })()`);
  await page.sleep(700);
  await page.shot(`${out}/rooftop-outside.png`);
  await page.eval(`(() => { const me = ${ME}; me.pos.x = -10; me.pos.z = 5; me.pos.y = 0; me.vel.x = me.vel.z = 0; return true; })()`);
  await page.sleep(900);
  await page.shot(`${out}/rooftop-inside.png`);
  const info = await page.eval(`JSON.stringify({ x: ${ME}.pos.x, z: ${ME}.pos.z, rooms: window.__amp.source.world.map.rooms.length, crates: window.__amp.source.world.items.filter((i) => i.kind === 'crate').length })`);
  console.log(`rooftop ${info} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length ? 1 : 0;
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await page.close(); }
