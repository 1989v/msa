// 모바일 한 화면 게이트 (2026-09-13 소감 「드래그 안 해도 되게」).
// 세로 폰을 orient.ts 가 844×390 으로 돌린 뒤 **타이틀·로비·대기실이 스크롤 없이** 들어오는지 잰다.
// 고치기 전 타이틀은 826px 로 436px 가 잘렸다. 개발 릴레이는 스스로 띄운다.
// 사용: node tools/e2e-mobile-fit.mjs <cdpPort> <baseUrl> <outDir>
import { spawn } from 'node:child_process';
import { Page } from './cdp-page.mjs';
const relay = spawn(process.execPath, [new URL('./dev-relay.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: '8790', LOBBY_MS: '30000' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => relay.kill());
await new Promise((r) => setTimeout(r, 700));
const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const M = (tag) => `(() => { const s = document.querySelector('.screen'); if (!s) return JSON.stringify({ tag: '${tag}', none: true });
  return JSON.stringify({ tag: '${tag}', box: [s.clientWidth, s.clientHeight], content: [s.scrollWidth, s.scrollHeight],
    overY: Math.max(0, s.scrollHeight - s.clientHeight), overX: Math.max(0, s.scrollWidth - s.clientWidth) }); })()`;
try {
  await page.open(base + '/', { width: 390, height: 844, mobile: true, touch: true });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await page.sleep(400);
  const seen = [];
  const step = async (tag) => { const r = JSON.parse(await page.eval(M(tag))); seen.push(r); console.log(JSON.stringify(r)); return r; };
  await step('타이틀');
  await page.eval(`(() => { const n = document.querySelector('.nick'); n.value = '모바일'; n.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.go-lobby').click(); return true; })()`);
  await page.waitFor(`document.querySelector('.roomlist')`, { timeout: 20000 });
  await page.sleep(1200);
  await step('로비');
  await page.shot(`${out}/mob-lobby.png`);
  await page.eval(`document.querySelector('.create').click()`);
  await page.waitFor(`document.querySelector('.slots')`, { timeout: 20000 });
  await page.sleep(800);
  await step('대기실');
  await page.shot(`${out}/mob-room.png`);
  const over = seen.filter((r) => r.overY > 0 || r.overX > 0);
  console.log(`넘치는 화면 ${over.length === 0 ? '없음' : JSON.stringify(over)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  process.exitCode = over.length === 0 && page.errors.length === 0 ? 0 : 1;
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await page.close(); relay.kill(); }
