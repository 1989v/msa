// 공중 공격을 눈으로: 점프 후 상승 중에 약공(궤적 유지)과 강공(급강하)을 각각 찍는다.
// 사용: node tools/shot-airattack.mjs <cdpPort> <baseUrl> <outDir>
// 주의: 입력은 폴링(rAF)이라 **짧은 탭은 느린 헤드리스 GL 에서 프레임 사이로 빠진다** — 키를 100ms 넘게 눌러야 확실히 잡힌다.
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
const S = `JSON.stringify({ state: ${ME}.state, move: ${ME}.move, y: +${ME}.pos.y.toFixed(2), vy: +${ME}.vel.y.toFixed(2), grounded: ${ME}.grounded })`;
try {
  await page.open(pageUrl('/'), { width: 900, height: 760 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.type('.nick', '공중');
  await page.eval(`document.querySelector('.bots').value = '1'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  // 상대를 앞에 세워 둔다 (맞는 그림)
  await page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME}; const yaw = window.__amp.camera().yaw;
    me.pos.x = 0; me.pos.z = 0; me.pos.y = 0; me.vel.x = me.vel.z = 0; me.yaw = yaw;
    const b = w.players.find((p) => p && p.id !== me.id); if (b) { b.pos.x = Math.sin(yaw) * 1.4; b.pos.z = Math.cos(yaw) * 1.4; b.pos.y = 0; b.state = 'idle'; b.t = 0; }
    return true; })()`);
  await page.sleep(400);
  for (const [name, key, code] of [['light', 'z', 'KeyZ'], ['heavy', 'x', 'KeyX']]) {
    // 착지 상태에서 다시 시작
    await page.eval(`(() => { const me = ${ME}; me.pos.y = 0; me.vel.y = 0; me.state = 'idle'; me.t = 0; me.move = null; return true; })()`);
    await page.sleep(200);
    await page.hold('Space', ' ', 150); // 짧은 탭은 느린 헤드리스에서 샘플 사이로 빠진다
    await page.sleep(120); // 상승 중
    const air = JSON.parse(await page.eval(S));
    await page.hold(code, key, 120);
    await page.sleep(60);   // 발동 직후 = 타격 포즈
    const hit = JSON.parse(await page.eval(S));
    await page.shot(`${out}/air-${name}.png`);
    console.log(`${name}: 점프 중 ${JSON.stringify(air)} → 공격 ${JSON.stringify(hit)}`);
  }
  console.log(`errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = page.errors.length ? 1 : 0;
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await page.close(); }
