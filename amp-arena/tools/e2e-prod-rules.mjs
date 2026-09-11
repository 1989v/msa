// 운영 번들의 규칙 실측: 연습(팀 데스매치)을 띄우고 브라우저 안 시뮬(window.__amp.source.world)에 상자·점프대·아군을 놓아
// ① 상자를 통과하지 못하고 앞면에서 멈추는지 ② 점프대를 밟으면 튕겨 오르는지 ③ 팀전에서 아군이 맞는지 를 수치로 찍는다.
// 연습은 브라우저가 시뮬을 직접 돌리므로(온라인은 방장 워커가 같은 코드) 운영 번들의 규칙을 그대로 잰다.
// 사용: node tools/e2e-prod-rules.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
const ME = `window.__amp.source.world.players[window.__amp.source.myId]`;
try {
  await page.open(url, { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', '규칙실측');
  await page.eval(`document.querySelector('.mode').value = 'team_dm'; document.querySelector('.bots').value = '3'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.sleep(300);
  const teams = await page.eval(`window.__amp.source.world.teams`);
  checks.teamMode = teams === true;

  // ① 상자: 카메라 앞 2.5m 에 상자를 놓고 앞으로 걷는다 → 상자 앞면(0.5 + 몸 반지름 0.4)에서 멈춰야 한다
  const setupCrate = `(() => { const w = window.__amp.source.world; const me = ${ME}; const yaw = window.__amp.camera().yaw; const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const c = w.items.find((i) => i.kind === 'crate' && i.heldBy < 0 && !i.airborne); if (!c) return 'no crate';
    me.pos.x = 0; me.pos.z = 0; me.pos.y = 0; me.vel.x = me.vel.z = 0; c.x = fx * 2.5; c.z = fz * 2.5; c.y = 0; window.__crate = c.id; return JSON.stringify({ cx: c.x, cz: c.z }); })()`;
  const crateInfo = await page.eval(setupCrate);
  await page.keyDown('ArrowUp', 'ArrowUp');
  let minD = 99, moved = 0;
  for (let i = 0; i < 20; i++) {
    await page.sleep(80);
    const r = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME}; const c = w.items.find((i) => i.id === window.__crate); return JSON.stringify({ d: c ? Math.hypot(c.x - me.pos.x, c.z - me.pos.z) : -1, x: me.pos.x, z: me.pos.z, y: me.pos.y }); })()`));
    if (r.d >= 0) minD = Math.min(minD, r.d);
    moved = Math.max(moved, Math.hypot(r.x, r.z));
  }
  await page.keyUp('ArrowUp', 'ArrowUp');
  checks.crateBlocks = minD >= 0.85 && minD <= 1.15 && moved > 1.0;
  console.log(`crate: placed ${crateInfo} · closest distance while walking into it ${minD.toFixed(2)}m (기대 0.9 = 상자 반 0.5 + 몸 0.4) · walked ${moved.toFixed(2)}m`);

  // ② 점프대: 카메라 앞 2m 로 옮겨 놓고 밟는다 → 2m 이상 튀어오른다
  await page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME}; const yaw = window.__amp.camera().yaw; const fx = Math.sin(yaw), fz = Math.cos(yaw);
    me.pos.x = 5; me.pos.z = -5; me.pos.y = 0; me.vel.x = me.vel.z = 0; const pad = w.map.pads[0]; pad.x = me.pos.x + fx * 2.0; pad.z = me.pos.z + fz * 2.0; pad.y = 0; window.__pad = { x: pad.x, z: pad.z, power: pad.power }; return true; })()`);
  await page.keyDown('ArrowUp', 'ArrowUp');
  let peak = 0;
  for (let i = 0; i < 24; i++) {
    await page.sleep(70);
    const y = await page.eval(`${ME}.pos.y`);
    peak = Math.max(peak, y);
  }
  await page.keyUp('ArrowUp', 'ArrowUp');
  const padInfo = await page.eval(`JSON.stringify(window.__pad)`);
  checks.padLaunches = peak > 2.0;
  console.log(`pad: ${padInfo} · peak height while walking over it ${peak.toFixed(2)}m (기대 > 2.0)`);

  // ③ 팀전 아군 피격: 같은 팀 봇을 기절시켜 앞 1.5m 에 세우고 잽 → HP 가 준다
  //    (1.0m 이면 Z 가 잡기(범위 1.3m)가 되어 held 로 들어간다 — 그것도 아군 잡기가 되는 증거지만 여기선 타격을 잰다)
  const ff = await page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME};
    const mate = w.players.find((p) => p && p.id !== me.id && p.team === me.team); if (!mate) return JSON.stringify({ error: 'no teammate' });
    me.pos.x = -6; me.pos.z = 6; me.pos.y = 0; me.vel.x = me.vel.z = 0; me.yaw = 0; me.state = 'idle'; me.t = 0; me.move = null; me.comboIdx = 0;
    mate.state = 'stun'; mate.t = 0; mate.pos.x = me.pos.x; mate.pos.z = me.pos.z + 1.5; mate.pos.y = 0; mate.vel.x = mate.vel.z = 0; mate.invuln = 0; mate.hp = mate.maxHp; mate.lastHitBy = -1;
    window.__mate = mate.id; return JSON.stringify({ mate: mate.name, team: mate.team, myTeam: me.team, hp: mate.hp }); })()`);
  await page.sleep(60);
  await page.tap('KeyZ', 'z', 50);
  await page.sleep(400);
  const after = JSON.parse(await page.eval(`(() => { const w = window.__amp.source.world; const me = ${ME}; const m = w.players[window.__mate]; return JSON.stringify({ hp: m.hp, max: m.maxHp, state: m.state, team: m.team, hitBy: m.lastHitBy, myDmg: me.dmgDealt }); })()`));
  checks.friendlyFire = after.hp < after.max && after.hitBy === 0;
  console.log(`friendly fire: before ${ff} → after jab hp ${after.hp}/${after.max} state ${after.state} lastHitBy ${after.hitBy} myDmgDealt ${after.myDmg} (기대: hp 가 줄고 lastHitBy 가 나)`);

  // ④ 강공(X): 파이터의 강공 사슬 첫 타는 돌려차기, 이어 누르면 헤이메이커
  await page.eval(`(() => { const me = ${ME}; me.pos.x = 4; me.pos.z = 4; me.pos.y = 0; me.vel.x = me.vel.z = 0; me.state = 'idle'; me.t = 0; me.move = null; me.comboIdx = 0; me.chain = 0; return true; })()`);
  await page.sleep(60);
  const moves = new Set();
  for (let i = 0; i < 16; i++) { await page.tap('KeyX', 'x', 30); await page.sleep(60); const mv = await page.eval(`${ME}.move`); if (mv) moves.add(mv); }
  const heavySeen = [...moves];
  checks.heavyChain = heavySeen.includes('roundhouse') && heavySeen.includes('haymaker');
  console.log(`heavy chain (X 연타): moves seen ${JSON.stringify(heavySeen)} (기대: roundhouse, haymaker)`);

  await page.shot(`${out}/prod-rules.png`);
  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)}`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/prod-rules-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
