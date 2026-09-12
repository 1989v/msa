// 엠블럼이 캐릭터에 보이는지 눈으로: 굵은 그림을 진행에 심고 연습을 띄워 내 캐릭터를 카메라 앞으로 옮겨 크게 찍는다.
import { Page } from './cdp-page.mjs';
const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
// 하트 모양 굵은 엠블럼 (빨강 3) — 12×12
const rows = ['000000000000','000000000000','000330033000','003333333300','003333333300','003333333300','000333333000','000033330000','000003300000','000000000000','000000000000','000000000000'];
const grid = rows.join('');
try {
  await page.open(pageUrl('/'), { width: 900, height: 900 });
  await page.waitFor(`document.querySelector('.progress-row')`, { timeout: 20000 });
  await page.eval(`localStorage.setItem('amp.progress.v1', JSON.stringify({ v:1, xp:0, gold:0, matches:0, kos:0, wins:0, alloc:{}, owned:[], skin:{shirt:-1,hair:-1,band:-1}, emblem:'${grid}', updated:1 })); true`);
  await page.send('Page.reload', {}); await page.sleep(300);
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.type('.nick', '엠블럼');
  await page.eval(`document.querySelector('.bots').value = '1'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  // 카메라 요를 재서 캐릭터가 카메라를 마주 보게 돌린다(앞 엠블럼이 보이게), 중앙으로
  await page.eval(`(() => { const me = ${ME}; const yaw = window.__amp.camera().yaw; me.pos.x = 0; me.pos.z = 0; me.pos.y = 0; me.vel.x = me.vel.z = 0; me.yaw = yaw; me.state='idle'; me.t=0; return true; })()`);
  await page.sleep(600);
  await page.shot(`${out}/emblem-front.png`);
  await page.eval(`(() => { const me = ${ME}; me.yaw = window.__amp.camera().yaw + Math.PI; return true; })()`);
  await page.sleep(500);
  await page.shot(`${out}/emblem-back.png`);
  console.log(`emblem shots · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length ? 1 : 0;
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await page.close(); }
