// 엠블럼 페인터 E2E: 타이틀 「그림」 모달에서 몇 칸 칠하기 → 진행에 144자 저장 → 연습 시작 시 명단(roster[0].emblem)에 반영 + 리그에 엠블럼 평면 생성.
// 사용: node tools/e2e-emblem.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const pageUrl = (suffix) => (base.endsWith('.html') ? base + suffix.replace(/^\//, '') : base + suffix);
const page = new Page(port);
const checks = {};
try {
  await page.open(pageUrl('/'), { width: 1280, height: 720 });
  await page.waitFor(`document.querySelector('.progress-row')`, { timeout: 20000 });
  await page.eval(`localStorage.removeItem('amp.progress.v1'); true`);
  await page.send('Page.reload', {}); await page.sleep(300);
  await page.waitFor(`document.querySelector('.emblem-btn')`, { timeout: 20000 });
  await page.click('.emblem-btn');
  await page.waitFor(`document.querySelector('.emblem-grid')`, { timeout: 5000 });
  // 색 3(빨강, 팔레트 인덱스 3) 고르고 격자 몇 칸 칠하기 — 셀은 data-i 순서
  await page.eval(`[...document.querySelectorAll('.emblem-palette .swatch')][3].click(); true`);
  for (const i of [66, 67, 77, 78]) await page.eval(`(() => { const c = document.querySelector('.emblem-grid [data-i="${i}"]'); const r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 11, clientY: r.top + 11, pointerId: 1 })); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })); return true; })()`);
  await page.sleep(150);
  const saved = JSON.parse(await page.eval(`localStorage.getItem('amp.progress.v1')`));
  const em = saved.emblem;
  console.log(`saved emblem: length ${em.length} · painted cells ${[...em].filter((c) => c !== '0').length} · [66,67,77,78]=${[66, 67, 77, 78].map((i) => em[i]).join('')}`);
  checks.painted = em.length === 144 && em[66] === '3' && em[67] === '3' && em[77] === '3' && em[78] === '3';
  await page.shot(`${out}/e2e-emblem-modal.png`);
  await page.click('.modal .close');
  // 연습 시작 → 명단·리그
  await page.type('.nick', '그림실측');
  await page.eval(`document.querySelector('.bots').value = '2'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });
  await page.sleep(400);
  const info = JSON.parse(await page.eval(`(() => { const s = window.__amp.source; const rig = window.__amp.__rig ? null : null; return JSON.stringify({ rosterEmblem: s.roster[0].emblem, cells: [...(s.roster[0].emblem || '')].filter((c) => c !== '0').length }); })()`));
  console.log(`in match: roster[0].emblem cells ${info.cells} · matches saved: ${info.rosterEmblem === em}`);
  checks.inRoster = info.rosterEmblem === em && info.cells === 4;
  await page.shot(`${out}/e2e-emblem-match.png`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  for (const l of page.logs.slice(-6)) console.log('  ', l.slice(0, 200));
  try { await page.shot(`${out}/e2e-emblem-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
