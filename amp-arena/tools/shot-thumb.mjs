// 카탈로그 썸네일용 장면: 연습(콜로세움, 봇 7)을 띄우고 난전이 벌어질 때 1280×720 으로 찍는다. 320×180 축소는 sips 가 한다.
// 사용: node tools/shot-thumb.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
try {
  await page.open(pageUrl('/?autopilot=1'), { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.type('.nick', '아레나');
  await page.eval(`document.querySelector('.map').value = 'colosseum'; document.querySelector('.bots').value = '7'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  // 봇들을 내 주변으로 모아 난전이 화면에 들어오게 한다
  await page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME}; me.pos.x = 0; me.pos.z = -2; me.pos.y = 0; let k = 0;
    for (const p of w.players) { if (!p || p.id === me.id) continue; const a = (k++ / 7) * Math.PI * 2; p.pos.x = Math.cos(a) * 3.2; p.pos.z = Math.sin(a) * 3.2 + 1; p.pos.y = 0; p.vel.x = p.vel.z = 0; } return true; })()`);
  await page.sleep(1800);
  // HUD 는 썸네일에서 뺀다 — 화면이 작아지면 글자가 뭉개진다
  await page.eval(`document.querySelectorAll('.hud, .touchpad, .fsbtn').forEach((e) => { e.style.visibility = 'hidden'; }); true`);
  await page.sleep(120);
  await page.shot(`${out}/thumb-1280.png`);
  await page.sleep(500);
  await page.shot(`${out}/thumb-1280-b.png`);
  console.log(`thumb shots saved · errors ${page.errors.length}`);
  process.exitCode = page.errors.length ? 1 : 0;
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await page.close(); }
