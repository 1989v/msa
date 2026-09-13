// 방 규칙이 온라인 판에서 실제로 강제되는지 (2026-09-13 소감). 탭 둘 — 방장이 규칙을 걸고 게스트가 그 판에 들어간다.
// 게스트는 일부러 대검·스탯을 골라 두고, 방장이 맨손전·스탯 없음·노템전으로 시작한다.
// 사용: node tools/e2e-room-rules.mjs <cdpPort> <baseUrl> <outDir>   (개발 릴레이는 스스로 띄운다)
import { spawn } from 'node:child_process';
import { Page } from './cdp-page.mjs';
const relay = spawn(process.execPath, [new URL('./dev-relay.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: '8790', LOBBY_MS: '30000' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => relay.kill());
await new Promise((r) => setTimeout(r, 700));

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
// 운영을 재려면 base 에 https://game.1989v.com/games/arena/index.html 을 준다 (릴레이는 그쪽 것을 쓴다)
const A = new Page(port), B = new Page(port);
const checks = {};
const enter = async (p, nick) => {
  await p.open(base.endsWith('.html') ? base : base + '/', { width: 1280, height: 900 });
  await p.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  await p.type('.nick', nick);
  await p.click('.go-lobby');
  await p.waitFor(`document.querySelector('.roomlist')`, { timeout: 20000 });
};
const rule = (p, cls, v) => p.eval(`(() => { const s = document.querySelector('${cls}'); s.value = '${v}'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
try {
  await enter(A, '방장');
  await A.click('.create');
  await A.waitFor(`document.querySelector('.slots')`, { timeout: 20000 });
  const code = await A.eval(`document.querySelector('.chip.code')?.textContent ?? ''`);

  // 게스트는 일부러 「센 것」을 고른다 — 스피드스타 + 대거, 스탯도 올려 둔다
  await enter(B, '참가자');
  await B.eval(`document.querySelector('.code-in').value = '${code}'`);
  await B.eval(`document.querySelector('.join-code').click()`);
  await B.waitFor(`document.querySelector('.slots')`, { timeout: 20000 });
  await B.eval(`(() => { document.querySelector('.stylebtn[data-style="speedster"]').click(); return true; })()`);
  await B.sleep(200);
  await B.eval(`(() => { document.querySelector('.acc[data-acc="dagger"]').click(); return true; })()`);
  await B.eval(`(() => { const raw = JSON.parse(localStorage.getItem('amp.progress') ?? '{}'); return true; })()`);
  await B.sleep(400);
  const guestPick = await B.eval(`document.querySelector('.acc.on')?.dataset.acc ?? ''`);
  console.log(`게스트가 고른 악세서리 ${guestPick}`);

  // 방장이 규칙을 건다: 노템전 · 맨손전 · 스탯 없음
  for (const [cls, v] of [['.ritems', '0'], ['.raccs', '0'], ['.rstats', '0']]) { await rule(A, cls, v); await A.sleep(200); }
  await B.click('.readybtn');
  await B.sleep(600);
  await A.click('.start');
  for (const p of [A, B]) await p.waitFor(`document.querySelector('.match canvas') && window.__amp`, { timeout: 20000 });
  await A.sleep(1500);

  const world = JSON.parse(await A.eval(`(() => { const w = window.__amp.source.world;
    const ppl = w.players.filter(Boolean).map((p) => ({ id: p.id, acc: p.acc, maxHp: p.maxHp, bot: p.bot }));
    return JSON.stringify({ items: w.items.length, ppl }); })()`));
  console.log(`판 안: 아이템 ${world.items} · ${JSON.stringify(world.ppl.slice(0, 4))}`);
  checks.noItems = world.items === 0;
  checks.allBarehanded = world.ppl.every((p) => p.acc === 'none');
  // 스탯 없음 → 같은 직업이면 체력이 같다. 스탯이 살아 있으면 올린 사람만 높다.
  const byStyle = {};
  for (const p of world.ppl) (byStyle[p.maxHp] ??= []).push(p.id);
  checks.statsOff = await A.eval(`(() => { const w = window.__amp.source.world; const me = w.players[0];
    return me.stats && me.stats.hp === 3 && me.stats.atk === 3; })()`) === true;
  console.log(`checks ${JSON.stringify(checks)} · errors A ${A.errors.length} · B ${B.errors.length}`);
  for (const e of [...A.errors, ...B.errors].slice(0, 4)) console.log('  !', e.slice(0, 200));
  await A.shot(`${out}/room-rules.png`);
  process.exitCode = A.errors.length === 0 && B.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('FAIL', e.message, JSON.stringify(checks));
  process.exitCode = 1;
} finally { await A.close(); await B.close(); relay.kill(); }
