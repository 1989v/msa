// 연습 2분 매치를 끝까지 (오토파일럿): 결과 화면 → 순위표 → 다시 하기. 온라인 2탭은 e2e-online-full.mjs.
// 사용: node tools/e2e-fullmatch.mjs <port> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:8787', out = '.'] = process.argv.slice(2);
const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s ${m}`);
const A = new Page(port);
try {
  await A.open(base + '/?autopilot=1', { width: 1280, height: 720 });
  await A.waitFor(`document.querySelector('.practice')`);
  await A.type('.nick', '루키');
  await A.eval(`document.querySelector('.bots').value = '3'; document.querySelector('.secs').value = '120'`);
  await A.click('.practice');
  await A.waitFor(`document.querySelector('.match canvas') && window.__amp`);
  await A.front();
  log('practice match started (autopilot, bots 3, 2min)');
  const start = Date.now();
  let seen = false;
  while (Date.now() - start < 150000) {
    await A.sleep(5000);
    const s = JSON.parse(await A.eval(`JSON.stringify({ t: document.querySelector('.hud .timer .t')?.textContent, me: (() => { const p = window.__amp.source.world.players[0]; return { hp: p.hp, kos: p.kos, dmg: p.dmgDealt }; })(), result: !!document.querySelector('.result') })`));
    if ((Date.now() - start) % 30000 < 5500) log(`practice ${JSON.stringify(s)}`);
    if (s.result) { seen = true; log(`result ${JSON.stringify(s)}`); break; }
  }
  await A.shot(`${out}/full-practice-result.png`);
  const table = await A.eval(`JSON.stringify([...document.querySelectorAll('.result tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()).join(' | ')))`);
  log(`ranking ${table}`);
  await A.click('.result .btn.primary');
  await A.waitFor(`document.querySelector('.match canvas') && !document.querySelector('.result')`, { timeout: 8000 });
  await A.sleep(1500);
  log(`again started, timer ${await A.eval(`document.querySelector('.hud .timer .t')?.textContent`)}`);
  for (const l of A.logs.filter((x) => x.includes('[match]'))) console.log('  ', l);
  console.log(`errors: ${A.errors.length}`);
  for (const e of A.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = seen && A.errors.length === 0 ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message);
  try { await A.shot(`${out}/full-fail-A.png`); } catch {}
  process.exitCode = 1;
} finally {
  await A.close();
}
