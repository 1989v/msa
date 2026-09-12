// 운영 번들의 봇이 스스로 떨어져 죽지 않는지 실측한다. 연습 모드는 브라우저가 시뮬을 직접 돌리므로
// (온라인은 방장 워커가 같은 코드) 운영에 올라간 규칙을 그대로 잰다.
//
// **자멸을 세는 방법**: `world.step` 을 감싸 KO 이벤트를 가로챈다 — 가해자가 없는(`a < 0`) 낙사가 자멸이다.
// 시뮬이 스스로 내놓는 이벤트라 검사가 만든 값이 아니다. 낭떠러지가 제일 심한 스카이독에서 잰다.
//   로컬 실측(같은 양): 고치기 전 자멸 82% → 고친 뒤 34%. 스카이독은 원래 밀어 떨어뜨리는 맵이라
//   가해자 있는 낙사가 절반을 넘는 것이 정상이고, 문턱 55% 는 그 둘 사이에 둔다.
// 사용: node tools/e2e-prod-bots.mjs <cdpPort> <pageUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, url = 'https://game.1989v.com/games/arena/index.html', out = '.'] = process.argv.slice(2);
const page = new Page(port);
const checks = {};
try {
  await page.open(url, { width: 1000, height: 720 });
  await page.waitFor(`document.querySelector('.practice')`, { timeout: 20000 });
  const bundle = await page.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
  await page.type('.nick', '봇실측');
  await page.eval(`document.querySelector('.map').value = 'skydock'; document.querySelector('.bots').value = '7'`);
  await page.click('.practice');
  await page.waitFor(`document.querySelector('.match canvas') && window.__amp && window.__amp.source.world.phase === 'play'`, { timeout: 25000 });

  // 시뮬의 KO 이벤트를 그대로 받아 센다
  await page.eval(`(() => { const w = window.__amp.source.world;
    window.__ko = { hit: 0, koFall: 0, self: 0 };
    const orig = w.step.bind(w);
    w.step = (inputs) => { const evs = orig(inputs);
      for (const e of evs) if (e.t === 'ko') window.__ko[e.a < 0 ? 'self' : (e.cause === 'fall' ? 'koFall' : 'hit')]++;
      return evs; };
    return true; })()`);

  // 이벤트 집계 옆에 **선수 기록 합**을 같이 읽는다 — 둘이 어긋나면 이벤트를 놓치고 있다는 뜻이다(계측기 자체 검사)
  const read = () => page.eval(`(() => { const w = window.__amp.source.world; let d = 0, below = 0;
    let moving = 0;
    for (const p of w.players) { if (!p) continue; d += p.deaths; if (p.bot && Math.hypot(p.vel.x, p.vel.z) > 0.5) moving++; }
    return JSON.stringify({ ...window.__ko, t: w.tick, phase: w.phase, playerDeaths: d, moving }); })()`);
  // 표본을 벌려면 판을 끝까지 돌린다(120초). 스카이독 90초는 사망이 1~10 으로 흔들려 비율이 뜻을 잃는다.
  let last = null, movingSamples = 0, samples = 0;
  for (let i = 0; i < 120; i++) {
    last = JSON.parse(await read());
    samples++; if (last.moving >= 3) movingSamples++;
    if (last.t >= 7100 || last.phase !== 'play') break;
    await page.sleep(2000);
  }
  const deaths = last.hit + last.koFall + last.self;
  const selfPct = deaths ? (last.self / deaths) * 100 : 0;
  console.log(`스카이독 ${last.t}틱 · 사망 ${deaths} — 타격사 ${last.hit} · 밀려서 낙사 ${last.koFall} · 자멸 ${last.self} (${selfPct.toFixed(0)}%)`);
  console.log(`  선수 기록 사망 합 ${last.playerDeaths} (이벤트 ${deaths} 와 같아야 한다) · 움직이는 봇 3 이상이던 표본 ${movingSamples}/${samples}`);
  checks.tallyMatchesPlayers = last.playerDeaths === deaths;
  // 한 판(120초)이면 스카이독 사망은 9~11 이라 비율이 거칠다 — 그래서 문턱을 82% 와 33% 사이에 넉넉히 둔다.
  // 사망 9·자멸 확률 0.33 이면 표준편차가 16%p 라, 60% 는 고친 쪽에서 1.7σ · 안 고친 쪽에서 1.4σ 떨어져 있다.
  checks.enoughSample = deaths >= 6;
  checks.botsDoNotSuicide = selfPct < 60; // 고치기 전 82% · 고친 뒤 33%
  // 절벽 회피가 봇을 얼려 버리면 그것도 결함이다 — 표본의 8할에서 봇 셋 이상이 움직이고 있어야 한다
  checks.botsKeepMoving = movingSamples >= samples * 0.8;
  await page.shot(`${out}/prod-bots-skydock.png`);

  console.log(`bundle ${bundle}`);
  console.log(`checks ${JSON.stringify(checks)} · errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('  !', e.slice(0, 300));
  process.exitCode = page.errors.length === 0 && Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('E2E FAIL:', e.message, JSON.stringify(checks));
  try { await page.shot(`${out}/prod-bots-fail.png`); } catch {}
  process.exitCode = 1;
} finally { await page.close(); }
