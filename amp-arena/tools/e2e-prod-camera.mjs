// 카메라·타격 포즈 실측: 연습 매치를 띄워 ① 카메라가 캐릭터 위 8.2m·뒤 6.6m 에 있는지 ② 캐릭터가 방향을 바꿔 움직여도
// 카메라 요가 그대로인지 ③ E 키로만 도는지 ④ 잽 때 팔이 곧게(어깨 ≈ 76°, 팔꿈치 ≈ 0°) 뻗고 몸이 앞으로 나가는지(reach) 를 수치로 찍는다.
// 사용: node tools/e2e-prod-camera.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const CAM = `(() => { const a = window.__amp; const c = a.camera(); const p = a.source.world.players[a.source.myId]; return JSON.stringify({ yaw: +c.yaw.toFixed(3), dy: +(c.y - p.pos.y).toFixed(2), dxz: +Math.hypot(c.x - p.pos.x, c.z - p.pos.z).toFixed(2), charYaw: +p.yaw.toFixed(3), state: p.state }); })()`;
const POSE = `JSON.stringify(window.__amp.pose(window.__amp.source.myId))`;
const checks = {};
try {
  await page.open(url, { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', '실측');
  await page.eval(`document.querySelector('.bots').value = '3'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.camera`, { timeout: 20000 });
  await page.waitFor(`window.__amp.source.world.phase === 'play'`, { timeout: 15000 });
  await page.sleep(600);
  // ① 카메라 오프셋
  const c0 = JSON.parse(await page.eval(CAM));
  // 높이는 항상 7.0 (2차 소감으로 8.2 → 7.0). 수평 거리는 5.6 이지만 벽 근처(스폰 지점)에서는 벽 반지름 클램프로 줄어든다 — 3.4 아래로는 안 간다
  checks.lookDown = c0.dy > 6.6 && c0.dy < 7.4 && c0.dxz > 3.4 && c0.dxz < 5.9;
  console.log(`camera at rest: ${JSON.stringify(c0)}  (기대: dy≈7.0, dxz≈5.6 또는 벽 클램프로 그 이하)`);
  // ② 캐릭터가 왼쪽·오른쪽·아래로 움직여 방향을 바꿔도 카메라 요는 그대로
  const yaws = [c0.yaw];
  for (const [code, key] of [['ArrowLeft', 'ArrowLeft'], ['ArrowDown', 'ArrowDown'], ['ArrowRight', 'ArrowRight']]) {
    await page.hold(code, key, 700);
    await page.sleep(150);
    const c = JSON.parse(await page.eval(CAM));
    yaws.push(c.yaw);
    console.log(`after ${code}: camYaw ${c.yaw} charYaw ${c.charYaw}`);
  }
  const yawDrift = Math.max(...yaws) - Math.min(...yaws);
  checks.fixedYawWhileMoving = yawDrift < 0.01;
  console.log(`camYaw drift while moving/turning: ${yawDrift.toFixed(4)} rad (기대: 0)`);
  // ③ E 를 0.8초 누르면 요가 돈다 (1.7 rad/s)
  const before = JSON.parse(await page.eval(CAM)).yaw;
  await page.hold('KeyE', 'e', 800);
  await page.sleep(100);
  const after = JSON.parse(await page.eval(CAM)).yaw;
  const turned = Math.abs(after - before);
  checks.manualTurn = turned > 0.6 && turned < 2.2;
  console.log(`E held 0.8s: camYaw ${before} → ${after} (Δ ${turned.toFixed(2)} rad, 기대 ≈1.36)`);
  // ④ 잽: 타격 구간의 포즈를 여러 번 샘플해 최대 어깨각·reach 를 본다
  let best = { nearArm: [0, 0], reach: 0, lean: 0 };
  await page.keyDown('KeyZ', 'z');
  for (let i = 0; i < 14; i++) {
    await page.sleep(16);
    const p = JSON.parse(await page.eval(POSE));
    if (p && p.nearArm[0] > best.nearArm[0]) best = p;
  }
  await page.keyUp('KeyZ', 'z');
  checks.jabExtends = best.nearArm[0] > 60 && Math.abs(best.nearArm[1]) < 15 && best.reach > 0.1;
  console.log(`jab peak pose: shoulder ${best.nearArm[0].toFixed(1)}° elbow ${best.nearArm[1].toFixed(1)}° reach ${best.reach.toFixed(2)}m lean ${best.lean.toFixed(1)}°  (기대: 어깨≈76 팔꿈치≈0 reach≈0.16)`);
  await page.shot(`${out}/prod-camera.png`);
  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)}`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/prod-camera-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
