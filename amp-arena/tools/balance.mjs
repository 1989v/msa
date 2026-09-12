// 밸런스 2차 — 봇 토너먼트. 사람 플레이 데이터가 없으니 봇 8명(직업·악세서리 무작위) 판을 여러 번 돌려
// 직업·악세서리별 KO·데미지·우승을 「든 수」로 나눠 읽는다 (봇 판 무기 승률은 값보다 든 사람 수와 봇 결함이 정한다 — 2026-09-03 교훈).
// 사용: node tools/balance.mjs [판 수=24] [초=120]
import { World, botInput, newBotMemory, randomLoadout, makeRng, MAP_IDS, STYLE_IDS, ACCESSORY_IDS, MAX_PLAYERS } from '../shared/src/index.ts';

const matches = Number(process.argv[2] ?? 24), seconds = Number(process.argv[3] ?? 120);
const agg = (ids) => Object.fromEntries(ids.map((id) => [id, { held: 0, kos: 0, deaths: 0, dmg: 0, wins: 0, top3: 0 }]));
const byStyle = agg(STYLE_IDS), byAcc = agg(ACCESSORY_IDS);
const t0 = performance.now();
let ticks = 0, drift = 0, counted = 0;
for (let m = 0; m < matches; m++) {
  const seed = 1000 + m * 7919;
  const mapId = MAP_IDS[m % MAP_IDS.length];
  const w = new World({ mapId, modeId: 'ffa_dm', seconds, seed });
  const rng = makeRng(seed ^ 0x5bd1e995);
  const mems = [], startAcc = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const { style, acc } = randomLoadout(rng);
    const p = w.addPlayer(i, `봇${i}`, 0, acc, true, style);
    startAcc[i] = p.acc; // **시작 장비로 집계한다** — KO 드랍(2026-09-12) 뒤로는 판 끝의 acc 가 「죽어서 잃은 결과」라 무기 성능이 아니다
    mems[i] = newBotMemory(w.rng);
  }
  let ranking = null;
  for (let t = 0; t < (seconds + 10) * 60 && !ranking; t++) {
    const inputs = [];
    for (let i = 0; i < MAX_PLAYERS; i++) inputs[i] = botInput(w, w.players[i], mems[i]);
    for (const e of w.step(inputs)) if (e.t === 'end') ranking = e.ranking;
    ticks++;
  }
  if (!ranking) { console.log(`match ${m} (${mapId}) did not end`); continue; }
  counted += ranking.length;
  for (const r of ranking) {
    const p = w.players[r.id];
    if (p.acc !== startAcc[r.id]) drift++;
    for (const a of [byStyle[p.style], byAcc[startAcc[r.id]]]) { a.held++; a.kos += r.kos; a.deaths += r.deaths; a.dmg += r.dmg; if (r.rank === 1) a.wins++; if (r.rank <= 3) a.top3++; }
  }
}
const table = (title, a) => {
  const rows = Object.entries(a).filter(([, v]) => v.held > 0).map(([id, v]) => ({ id, held: v.held, ko: v.kos / v.held, death: v.deaths / v.held, dmg: v.dmg / v.held, win: v.wins / v.held, top3: v.top3 / v.held }));
  const meanKo = rows.reduce((s, r) => s + r.ko, 0) / rows.length, meanDmg = rows.reduce((s, r) => s + r.dmg, 0) / rows.length;
  console.log(`\n${title} (판당 평균 · 든 수로 나눔)`);
  console.log('id           held   KO/판  KO비   데스/판  dmg/판  dmg비   우승률  top3');
  for (const r of rows.sort((x, y) => y.ko - x.ko)) console.log(`${r.id.padEnd(12)} ${String(r.held).padStart(4)}  ${r.ko.toFixed(2).padStart(5)}  ${(r.ko / meanKo).toFixed(2)}   ${r.death.toFixed(2).padStart(5)}   ${r.dmg.toFixed(0).padStart(5)}   ${(r.dmg / meanDmg).toFixed(2)}   ${(r.win * 100).toFixed(0).padStart(4)}%  ${(r.top3 * 100).toFixed(0).padStart(3)}%`);
  const flags = rows.filter((r) => r.ko / meanKo > 1.3 || r.ko / meanKo < 0.7);
  console.log(flags.length ? `  ⚠ KO 비 ±30% 밖: ${flags.map((r) => `${r.id} ${(r.ko / meanKo).toFixed(2)}`).join(', ')}` : '  KO 비 전부 ±30% 안');
};
table('직업', byStyle);
table('악세서리', byAcc);
console.log(`\n${matches}판 · ${seconds}초 · ${ticks} 틱 · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
console.log(`판 끝에 시작 장비와 달라진 사람 ${drift}/${counted} (${((drift / counted) * 100).toFixed(0)}%) — KO 드랍·줍기 때문. 집계는 시작 장비 기준이다`);
