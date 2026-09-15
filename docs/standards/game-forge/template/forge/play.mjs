#!/usr/bin/env node
// 수동 검증 드라이버 — 게이트 밖에서 "지금 이 장면이 어떻게 보이나 / 이 입력을 넣으면 어떻게 되나" 를 잰다.
// 크롬을 켜고 → 재고 → 끄고 결과를 파일·stdout 으로 남긴다. 스크린샷은 Read 로 본다.
//
//   node forge/play.mjs shot  [--viewport 390x844] [--stage S3] [--out verifications/s3.png]
//   node forge/play.mjs keys  "ArrowRight:30,KeyZ:6,.:20,KeyX:4" [--stage S1] [--every 15] [--out verifications/seq]
//        code:n = 그 키를 n 스텝 누름, .:n = n 스텝 대기. --every k 면 k 스텝마다 스크린샷
//   node forge/play.mjs touch "stick:right:30,attack:6,.:20" [--viewport 390x844]
//        stick:방향:n, dpad/버튼은 action:n
//   node forge/play.mjs fps   [--sec 6] [--viewport 844x390] [--hold ArrowRight]
//   node forge/play.mjs eval  "window.__forge.state().enemies.length"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, Page, serveDir, sleep } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [vw, vh] = arg('--viewport', '1280x720').split('x').map(Number);
const mobile = vw < 1000 || vh < 500;
const stage = arg('--stage', null);
const seed = Number(arg('--seed', 20260915));
const out = arg('--out', null);

if (!cmd || !['shot', 'keys', 'touch', 'fps', 'eval'].includes(cmd)) { console.error('사용법은 파일 머리 주석'); process.exit(2); }

const { url, server } = await serveDir(ROOT);
const chrome = await launchChrome({ width: vw, height: vh });
const page = await Page.open(chrome.browser, { width: vw, height: vh, mobile, dpr: mobile ? 2 : 1 });
const result = { viewport: `${vw}x${vh}`, shots: [] };
const shot = async (name) => { const f = path.resolve(ROOT, name); await page.screenshot(f); result.shots.push(path.relative(ROOT, f)); };
try {
  await page.navigate(url + 'index.html');
  if (!(await page.waitForForge())) throw new Error('window.__forge 가 뜨지 않았다');
  if (cmd !== 'eval') { await page.forge('reset', seed); if (stage) await page.forge('warp', stage); else await page.forge('begin'); await page.forge('pause'); await page.forge('step', 5); }

  if (cmd === 'shot') { await page.forge('step', 30); await shot(out || `verifications/shot-${stage || 'S1'}-${vw}x${vh}.png`); }

  if (cmd === 'keys' || cmd === 'touch') {
    const seq = (argv[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
    const every = Number(arg('--every', 0)); const prefix = out || `verifications/${cmd}-seq`;
    const controls = await page.forge('controls'); const tc = controls.touch || {};
    let stepCount = 0, shotIdx = 0;
    const stepN = async (n) => { for (let i = 0; i < n; i++) { await page.forge('step', 1); stepCount++; if (every && stepCount % every === 0) await shot(`${prefix}-${String(shotIdx++).padStart(2, '0')}.png`); } };
    for (const item of seq) {
      const parts = item.split(':'); const n = Number(parts[parts.length - 1]) || 1;
      if (parts[0] === '.') { await stepN(n); continue; }
      if (cmd === 'keys') { await page.keyDown(parts[0]); await stepN(n); await page.keyUp(parts[0]); continue; }
      if (parts[0] === 'stick' && tc.stick) {
        const dir = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[parts[1]] || [1, 0];
        await page.touchStart([{ x: tc.stick.x, y: tc.stick.y }]); await page.touchMove([{ x: tc.stick.x + dir[0] * tc.stick.r * 0.8, y: tc.stick.y + dir[1] * tc.stick.r * 0.8 }]);
        await stepN(n); await page.touchEnd(); continue;
      }
      const z = [...(tc.buttons || []), ...(tc.dpad || [])].find((b) => b.action === parts[0]);
      if (!z) throw new Error(`터치 조작에 없는 action: ${parts[0]}`);
      await page.touchStart([{ x: z.x, y: z.y }]); await stepN(n); await page.touchEnd();
    }
    await shot(`${prefix}-end.png`);
    result.state = await page.forge('state');
    result.probe = await page.forge('probe');
  }

  if (cmd === 'fps') {
    const sec = Number(arg('--sec', 6)); const hold = arg('--hold', null);
    await page.forge('resume'); if (hold) await page.keyDown(hold);
    await sleep(300); // 재개 직후 첫 프레임의 워밍업 히치는 게임의 성능이 아니다
    await page.frameRecord(true); await sleep(sec * 1000); await page.frameRecord(false);
    if (hold) await page.keyUp(hold);
    result.fps = await page.frameStats(); result.audio = await page.audioStats();
    await page.forge('pause'); await shot(out || `verifications/fps-${vw}x${vh}.png`);
  }

  if (cmd === 'eval') result.value = await page.eval(argv[1]);
} catch (e) {
  result.error = e.message;
} finally {
  result.consoleErrors = page.consoleErrors;
  await page.close(); await chrome.close(); server.close(); // 측정 끝 = 브라우저 끝
}
console.log(JSON.stringify(result, null, 2));
process.exit(result.error ? 1 : 0);
