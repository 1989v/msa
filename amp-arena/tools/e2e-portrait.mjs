// 세로 모바일(390×844 CSS px, 터치 에뮬레이션) 실측: 뿌리(#app)가 90° 돌아 가로 게임이 되는지를 값으로 본다.
// ① #app.rotated 가 붙고 뿌리 크기가 844×390 ② 캔버스 버퍼도 844×390 ③ 화면에서 손가락을 「아래」로 끌면(세로 화면 기준)
//    돌아간 게임에서는 「오른쪽」이 되어 스틱 x 가 + 로 읽힌다 ④ 왼쪽 스틱 영역은 게임 좌표 기준(화면 위쪽 45%) ⑤ 콘솔 오류 0.
// 사용: node tools/e2e-portrait.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const checks = {};
const W = 390, H = 844;
// 입력은 카메라 기준 월드 벡터(mx, mz)다 — 카메라 yaw 로 스틱 (x=오른쪽, y=앞) 을 되돌린다 (input.ts sample 의 역변환)
const STICK = `(() => { const inp = window.__amp.lastInput; if (!inp) return 'null'; const yaw = window.__amp.camera().yaw; const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
  return JSON.stringify({ x: +(rx * inp.mx + rz * inp.mz).toFixed(2), y: +(fx * inp.mx + fz * inp.mz).toFixed(2) }); })()`;
try {
  await page.open(pageUrl('/'), { width: W, height: H, mobile: true, touch: true });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const env = JSON.parse(await page.eval(`JSON.stringify({ touchPoints: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches, inner: [innerWidth, innerHeight] })`));
  console.log(`env ${JSON.stringify(env)}`);
  const title = JSON.parse(await page.eval(`(() => { const a = document.getElementById('app'); const r = a.getBoundingClientRect(); return JSON.stringify({ rotated: a.classList.contains('rotated'), style: [a.style.width, a.style.height], box: [Math.round(r.width), Math.round(r.height)], client: [a.clientWidth, a.clientHeight] }); })()`));
  console.log(`title screen root ${JSON.stringify(title)}`);
  // 회전한 뿌리: 논리 크기 844×390, 화면 위 바운딩 박스는 390×844 (돌아가 있으니)
  checks.rootRotated = title.rotated && title.client[0] === H && title.client[1] === W && title.box[0] === W && title.box[1] === H;
  await page.shot(`${out}/e2e-portrait-title.png`);
  await page.type('.nick', '세로');
  await page.eval(`document.querySelector('.bots').value = '2'`);
  const tap = await page.tapElement('.practice'); // 실제 탭 (돌아간 뿌리 안에서 스크롤 → 화면 좌표)
  console.log(`tapped .practice at ${JSON.stringify(tap)}`);
  await page.waitFor(`document.querySelector('.match canvas') && document.querySelector('.touchpad') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.sleep(500);
  const canvas = JSON.parse(await page.eval(`(() => { const c = document.querySelector('.match canvas'); const r = c.getBoundingClientRect(); return JSON.stringify({ buf: [c.width, c.height], css: [c.clientWidth, c.clientHeight], box: [Math.round(r.width), Math.round(r.height)], buttons: document.querySelectorAll('.touchpad .tbtn').length }); })()`));
  console.log(`match canvas ${JSON.stringify(canvas)}`);
  checks.canvasLandscape = canvas.buf[0] === H && canvas.buf[1] === W && canvas.css[0] === H && canvas.css[1] === W;
  checks.sixButtons = canvas.buttons === 6;
  // 스틱: 화면 좌표 (x=100, y=150) 은 게임 좌표 (150, 290) → 왼쪽 45%(< 380) 안 = 스틱 시작. 화면 아래로 60px 끌면 게임에서는 오른쪽 60px
  await page.touchStart([{ x: 100, y: 150, id: 1 }]);
  await page.sleep(80);
  await page.touchMove([{ x: 100, y: 210, id: 1 }]);
  await page.sleep(250);
  const stick = JSON.parse(await page.eval(`(() => { const s = document.querySelector('.touchpad .stick'); const on = s.classList.contains('on'); const v = JSON.parse(${STICK}); return JSON.stringify({ on, left: s.style.left, top: s.style.top, x: v.x, y: v.y }); })()`));
  console.log(`stick after drag screen-down 60px: ${JSON.stringify(stick)} (기대: on, left 90px top 230px, x ≈ +1, y ≈ 0)`);
  checks.stickOnLeftArea = stick.on && stick.left === '90px' && stick.top === '230px';
  checks.stickAxisRotated = stick.x > 0.9 && Math.abs(stick.y) < 0.15;
  await page.shot(`${out}/e2e-portrait-match.png`);
  await page.touchEnd();
  await page.sleep(150);
  // 화면 오른쪽으로 끌면(세로 화면 기준) 돌아간 게임에서는 「위」= 앞으로 (y +). (기기를 왼쪽으로 눕혀 들면 화면 오른쪽 = 손가락 위)
  await page.touchStart([{ x: 200, y: 200, id: 1 }]);
  await page.sleep(80);
  await page.touchMove([{ x: 260, y: 200, id: 1 }]);
  await page.sleep(250);
  const stick2 = JSON.parse(await page.eval(STICK));
  console.log(`stick after drag screen-right 60px: ${JSON.stringify(stick2)} (기대: x ≈ 0, y ≈ +1)`);
  checks.stickForward = stick2.y > 0.9 && Math.abs(stick2.x) < 0.15;
  await page.touchEnd();
  // 버튼: 게임 좌표 오른쪽 아래의 약공 버튼 중심을 화면 좌표로 되돌려 터치 → 버튼이 켜진다 (화면 x = W − 게임 y, 화면 y = 게임 x)
  const btn = JSON.parse(await page.eval(`(() => { const b = document.querySelector('.touchpad .tbtn.atk'); const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
  await page.touchStart([{ x: btn.x, y: btn.y, id: 2 }]);
  await page.sleep(120);
  const pressed = await page.eval(`document.querySelector('.touchpad .tbtn.atk').classList.contains('on')`);
  await page.touchEnd();
  console.log(`attack button at screen ${JSON.stringify(btn)} pressed ${pressed}`);
  checks.buttonPress = pressed === true;
  console.log(`checks ${JSON.stringify(checks)}`);
  console.log(`errors: ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/e2e-portrait-fail.png`); } catch {}
  process.exitCode = 1;
} finally {
  await page.close();
}
