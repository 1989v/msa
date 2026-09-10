// 맵·스타일 화면 확인: 타이틀(스타일 피커) + 옥상·얼음 호수 연습 매치 스크린샷 (오토파일럿), 콘솔 오류 0.
// 사용: node tools/e2e-maps.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:8787', out = '.'] = process.argv.slice(2);
let errors = 0;
for (const [map, style, secs] of [['rooftop', 'heavy', 9000], ['icelake', 'speedster', 9000]]) {
  const p = new Page(port);
  try {
    await p.open(base + '/?autopilot=1', { width: 1280, height: 720 });
    await p.waitFor(`document.querySelector('.practice')`);
    if (map === 'rooftop') await p.shot(`${out}/maps-title.png`);
    await p.type('.nick', '루키');
    await p.click(`.stylebtn[data-style="${style}"]`);
    await p.eval(`document.querySelector('.map').value = '${map}'; document.querySelector('.bots').value = '5'; document.querySelector('.secs').value = '120'`);
    await p.click('.practice');
    await p.waitFor(`document.querySelector('.match canvas') && window.__amp`);
    await p.front();
    await p.sleep(secs);
    await p.shot(`${out}/maps-${map}.png`);
    const st = await p.eval(`(() => { const w = window.__amp.source.world; return JSON.stringify({ map: w.map.id, me: { style: w.players[0].style, hp: w.players[0].hp, dmg: w.players[0].dmgDealt, kos: w.players[0].kos }, styles: w.players.filter(Boolean).map(q => q.style).join(',') }); })()`);
    console.log(`${map}: ${st} errors: ${p.errors.length}`);
    for (const e of p.errors.slice(0, 4)) console.log('  !', e.slice(0, 240));
    errors += p.errors.length;
  } catch (e) {
    console.error(`${map} FAIL: ${e.message}`);
    errors++;
  } finally {
    await p.close();
  }
}
process.exitCode = errors ? 1 : 0;
