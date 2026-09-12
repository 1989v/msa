// 드럼통·방 확인: 연습(콜로세움 → 스카이독)을 띄우고 내 캐릭터를 문루 앞·안, 컨테이너 앞으로 옮겨 스크린샷 — 드럼통이 그려지고 방이 비치는지 눈으로 본다.
// 마지막에 드럼통을 잽으로 터뜨려 explode 이벤트·피해·연쇄가 브라우저 번들에서도 도는지 값으로 확인한다.
// 사용: node tools/shot-barrel.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
let page = new Page(port);
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
const checks = {};
async function practice(map, nick) {
  await page.open(pageUrl('/'), { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.type('.nick', nick);
  await page.eval(`document.querySelector('.map').value = ${JSON.stringify(map)}; document.querySelector('.bots').value = '2'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
}
const teleport = (x, z, y = 0) => page.eval(`(() => { const me = ${ME}; me.pos.x = ${x}; me.pos.z = ${z}; me.pos.y = ${y}; me.vel.x = me.vel.z = 0; me.state = 'idle'; me.t = 0; return true; })()`);
try {
  await practice('colosseum', '드럼통');
  const counts = JSON.parse(await page.eval(`JSON.stringify({ barrels: window.__amp.source.world.items.filter((i) => i.kind === 'barrel').length, rooms: window.__amp.source.world.map.rooms.length, meshes: [...document.querySelectorAll('canvas')].length })`));
  console.log(`colosseum ${JSON.stringify(counts)}`);
  checks.colosseumHasBarrelsAndRooms = counts.barrels === 2 && counts.rooms === 2;
  await teleport(11, 6); await page.sleep(700);
  await page.shot(`${out}/barrel-colosseum-door.png`);
  await teleport(15, 4.8); await page.sleep(900);
  await page.shot(`${out}/barrel-colosseum-inside.png`);
  // 드럼통을 잽으로 터뜨린다: 방 안 (15, 6) 의 드럼통 앞 1.2m 에서 Z 연타
  await page.eval(`(() => { const me = ${ME}; me.yaw = 0; return true; })()`);
  const hpBefore = await page.eval(`${ME}.hp`);
  let exploded = false;
  for (let i = 0; i < 40 && !exploded; i++) {
    await page.tap('KeyZ', 'z', 40);
    await page.sleep(140);
    exploded = await page.eval(`window.__amp.source.world.items.every((i) => !(i.kind === 'barrel' && Math.hypot(i.x - 15, i.z - 6) < 0.5))`);
  }
  await page.sleep(300);
  const after = JSON.parse(await page.eval(`JSON.stringify({ hp: ${ME}.hp, barrels: window.__amp.source.world.items.filter((i) => i.kind === 'barrel').length, state: ${ME}.state })`));
  console.log(`after punching the barrel: exploded ${exploded} · my hp ${hpBefore} → ${after.hp} (기대 −25) · barrels left ${after.barrels} · state ${after.state}`);
  checks.barrelExplodesAndHurts = exploded && after.hp === hpBefore - 25 && after.barrels === 1;
  await page.shot(`${out}/barrel-colosseum-exploded.png`);
  await page.close();

  page = new Page(port);
  await practice('skydock', '컨테이너');
  const sk = JSON.parse(await page.eval(`JSON.stringify({ barrels: window.__amp.source.world.items.filter((i) => i.kind === 'barrel').length, rooms: window.__amp.source.world.map.rooms.length })`));
  console.log(`skydock ${JSON.stringify(sk)}`);
  checks.skydockHasBarrelsAndRoom = sk.barrels === 3 && sk.rooms === 1;
  await teleport(0, -1.5); await page.sleep(700);
  await page.shot(`${out}/barrel-skydock-container.png`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) { console.error('FAIL', e.message, JSON.stringify(checks)); process.exitCode = 1; } finally { await page.close(); }
