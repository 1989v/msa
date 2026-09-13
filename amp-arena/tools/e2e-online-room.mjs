// 온라인 세 기능 실측 (2026-09-13 소감): ① 준비/준비해제 ② 남이 만든 방을 목록에서 골라 입장 ③ 방장이 빈 슬롯을 눌러 봇
// 탭 둘을 띄워 A 가 공개 방을 만들고, B 는 코드 없이 목록에서 눌러 들어간다.
// 사용: node tools/e2e-online-room.mjs <cdpPort> <baseUrl> <outDir>   (개발 릴레이는 스스로 띄운다)
import { spawn } from 'node:child_process';
import { Page } from './cdp-page.mjs';
const relay = spawn(process.execPath, [new URL('./dev-relay.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: '8790', LOBBY_MS: '30000' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => relay.kill());
await new Promise((r) => setTimeout(r, 700));
const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
const A = new Page(port), B = new Page(port);
const checks = {};
const enter = async (p, nick) => {
  await p.open(base + '/', { width: 1280, height: 900 });
  await p.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await p.type('.nick', nick);
  await p.click('.go-lobby');
  await p.waitFor(`document.querySelector('.roomlist')`, { timeout: 20000 });
};
try {
  await enter(A, '방장');
  await A.click('.create');
  await A.waitFor(`document.querySelector('.slots')`, { timeout: 20000 });
  const code = await A.eval(`document.querySelector('.chip.code')?.textContent ?? ''`);
  console.log(`A 가 공개 방 개설 · 코드 ${code}`);

  // ② B 는 코드를 안 치고 목록에서 고른다
  await enter(B, '참가자');
  await B.sleep(600);
  await B.eval(`document.querySelector('.refresh-rooms').click()`);
  await B.sleep(1200);
  const rows = await B.eval(`JSON.stringify([...document.querySelectorAll('.roomrow')].map((b) => b.dataset.code))`);
  console.log(`B 가 본 공개 방 목록 ${rows}`);
  checks.roomListed = JSON.parse(rows).includes(code);
  await B.eval(`document.querySelector('.roomrow')?.click()`);
  await B.waitFor(`document.querySelector('.slots')`, { timeout: 20000 });
  await A.sleep(900);
  const seats = await A.eval(`document.querySelectorAll('.slot:not(.empty)').length`);
  console.log(`목록으로 입장한 뒤 A 화면의 사람 슬롯 ${seats}`);
  checks.joinedFromList = Number(seats) === 2;

  // ① B 가 준비 → A 화면에 준비 완료
  const readyLabel = await B.eval(`document.querySelector('.readybtn')?.textContent ?? '없음'`);
  await B.eval(`document.querySelector('.readybtn').click()`);
  await B.sleep(900);
  const onA = await A.eval(`document.body.innerText.includes('준비 완료')`);
  const after = await B.eval(`document.querySelector('.readybtn')?.textContent ?? ''`);
  console.log(`준비 버튼 「${readyLabel}」 → 누른 뒤 「${after}」 · A 화면에 준비 완료 ${onA}`);
  checks.readyToggle = readyLabel.includes('준비') && after.includes('해제') && String(onA) === 'true'; // eval 은 불리언을 그대로 준다 — 문자열과 === 로 비교하지 않는다
  await B.eval(`document.querySelector('.readybtn').click()`);
  await B.sleep(700);
  const onA2 = await A.eval(`document.body.innerText.includes('준비 완료')`);
  checks.unreadyToggle = String(onA2) === 'false';
  console.log(`준비 해제 뒤 A 화면에 준비 완료 ${onA2}`);

  // ③ 방장이 빈 자리 설정을 「비워 둠」으로 바꾸고 슬롯 둘을 눌러 봇으로
  await A.eval(`(() => { const s = document.querySelector('.rbots'); s.value = '0'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await A.sleep(600);
  const pickable = await A.eval(`document.querySelectorAll('.slot.empty.pick').length`);
  await A.eval(`(() => { const c = document.querySelectorAll('.slot.empty.pick'); c[0].click(); return true; })()`);
  await A.sleep(500);
  await A.eval(`(() => { const c = document.querySelectorAll('.slot.empty.pick'); const b = [...c].find((x) => !x.classList.contains('bot')); b.click(); return true; })()`);
  await A.sleep(500);
  const bots = await A.eval(`document.querySelectorAll('.slot.empty.bot').length`);
  const startLabel = await A.eval(`document.querySelector('.start')?.textContent ?? ''`);
  console.log(`고를 수 있는 빈 슬롯 ${pickable} · 봇으로 바꾼 슬롯 ${bots} · 시작 버튼 「${startLabel.trim()}」`);
  checks.slotBots = Number(bots) === 2 && startLabel.includes('봇 2');

  console.log(`checks ${JSON.stringify(checks)} · errors A ${A.errors.length} · B ${B.errors.length}`);
  for (const e of [...A.errors, ...B.errors].slice(0, 4)) console.log('  !', e.slice(0, 200));
  await A.shot(`${out}/online3-host.png`);
  process.exitCode = A.errors.length === 0 && B.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('FAIL', e.message, JSON.stringify(checks));
  process.exitCode = 1;
} finally { await A.close(); await B.close(); relay.kill(); }
