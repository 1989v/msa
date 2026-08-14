// 기술 데이터 (프레임/판정/커맨드). 판정 상자는 발밑 원점, x=전방 오프셋, y=지면 위 높이(양수).

import { DEPTH_HIT } from './core.js';

const mv = (o) => {
  const m = {
    anim: 'jab1', startup: 5, active: 3, recover: 10, peak: 2,
    dmg: 6, hitstun: 17, blockstun: 11, hitstop: 5, kb: 1.6, lift: 0, down: false,
    box: [30, 58, 32, 22], depth: DEPTH_HIT, meter: 4, cost: 0,
    sfx: 'punch', spark: 'light', chain: null, cancelFrom: 0, cancelTo: 0,
    invuln: null, impulse: [], proj: null, grab: false, hits: null,
    activeRange: null, superFx: false, unblockable: false, wall: false,
    ...o,
  };
  m.dur = m.startup + m.active + m.recover;
  if (!m.hits) m.hits = [{ at: m.startup, dur: m.active, dmg: m.dmg, box: m.box, kb: m.kb, lift: m.lift, down: m.down, hitstop: m.hitstop, hitstun: m.hitstun, blockstun: m.blockstun, spark: m.spark, wall: m.wall, unblockable: m.unblockable }];
  else m.hits = m.hits.map((h) => ({ dur: 2, dmg: m.dmg, box: m.box, kb: m.kb, lift: m.lift, down: false, hitstop: m.hitstop, hitstun: m.hitstun, blockstun: m.blockstun, spark: m.spark, wall: false, unblockable: false, ...h }));
  return m;
};

export const MOVES = {
  // ───── 주인공 기본기 ─────
  lp1: mv({
    anim: 'jab1', startup: 4, active: 3, recover: 7, peak: 2,
    dmg: 6, box: [30, 58, 30, 20], kb: 1.2, hitstop: 4,
    chain: 'lp2', cancelFrom: 4, cancelTo: 12, meter: 5, sfx: 'punch',
  }),
  lp2: mv({
    anim: 'jab2', startup: 4, active: 3, recover: 8, peak: 2,
    dmg: 7, box: [32, 55, 32, 22], kb: 1.4, hitstop: 5,
    chain: 'lp3', cancelFrom: 4, cancelTo: 13, meter: 5, sfx: 'punch2',
  }),
  lp3: mv({
    anim: 'jab3', startup: 7, active: 4, recover: 15, peak: 3,
    dmg: 13, box: [36, 46, 40, 30], kb: 4.6, hitstop: 8, down: true,
    cancelFrom: 7, cancelTo: 15, meter: 8, sfx: 'kick', spark: 'heavy',
    impulse: [{ f: 6, vx: 1.6 }],
  }),
  hp: mv({
    anim: 'heavy', startup: 9, active: 4, recover: 16, peak: 4,
    dmg: 17, box: [36, 52, 38, 28], kb: 5.4, hitstop: 10, down: true,
    cancelFrom: 9, cancelTo: 18, meter: 9, sfx: 'heavy', spark: 'heavy',
    impulse: [{ f: 8, vx: 1.4 }],
  }),
  dashAtk: mv({
    anim: 'jab2', startup: 5, active: 4, recover: 14, peak: 2,
    dmg: 14, box: [32, 50, 34, 34], kb: 4.4, hitstop: 8, down: true,
    meter: 8, sfx: 'heavy', spark: 'heavy', impulse: [{ f: 0, vx: 3.4 }],
  }),
  jumpAtk: mv({
    anim: 'jumpAtk', startup: 4, active: 10, recover: 6, peak: 2,
    dmg: 13, box: [30, 34, 36, 34], kb: 2.6, hitstop: 7,
    meter: 7, sfx: 'kick', spark: 'mid',
  }),
  burst: mv({ // 긴급 탈출기 — 체력을 대가로
    anim: 'launcher', startup: 3, active: 6, recover: 22, peak: 3,
    dmg: 14, box: [22, 46, 62, 66], kb: 6.5, lift: 3.4, hitstop: 9, down: true,
    invuln: [0, 12], meter: 0, sfx: 'burst', spark: 'burst', superFx: true,
  }),
  grabHit: mv({
    anim: 'knee', startup: 5, active: 3, recover: 8, peak: 1,
    dmg: 9, box: [24, 44, 26, 26], kb: 0, hitstop: 7, meter: 6, sfx: 'punch2', spark: 'mid',
  }),
  grabThrow: mv({
    anim: 'throwSwing', startup: 8, active: 4, recover: 18, peak: 3,
    dmg: 20, box: [30, 46, 34, 40], kb: 8, lift: 3, hitstop: 12, down: true,
    meter: 10, sfx: 'throw', spark: 'heavy',
  }),
  wpSwing: mv({
    anim: 'weaponSwing', startup: 7, active: 5, recover: 15, peak: 4,
    dmg: 22, box: [40, 50, 50, 34], kb: 5.2, hitstop: 10, down: true,
    meter: 8, sfx: 'metal', spark: 'heavy', impulse: [{ f: 6, vx: 1.2 }],
  }),
  wpThrow: mv({
    anim: 'throwItem', startup: 6, active: 2, recover: 12, peak: 2,
    dmg: 0, meter: 5, sfx: 'whoosh', proj: { at: 6, kind: 'weapon' },
  }),

  // ───── 주인공 필살기 ─────
  spShotL: mv({
    name: '파열탄', anim: 'spShot', startup: 11, active: 2, recover: 20, peak: 4,
    dmg: 0, meter: 6, sfx: 'charge', superFx: true,
    proj: { at: 11, kind: 'ki', speed: 3.6, dmg: 16, hitstun: 22, kb: 3.4, life: 150, r: 9 },
  }),
  spShotH: mv({
    name: '파열탄·강', anim: 'spShot', startup: 15, active: 2, recover: 24, peak: 4,
    dmg: 0, meter: 6, sfx: 'charge', superFx: true,
    proj: { at: 15, kind: 'ki', speed: 2.7, dmg: 24, hitstun: 26, kb: 4.6, life: 170, r: 13, big: true, down: true },
  }),
  spRise: mv({
    name: '승천각', anim: 'spRise', startup: 5, active: 14, recover: 26, peak: 3,
    dmg: 26, box: [22, 62, 36, 62], kb: 3.2, lift: 4.2, hitstop: 10, down: true,
    invuln: [0, 12], meter: 10, sfx: 'rise', spark: 'heavy', superFx: true,
    activeRange: [3, 5], impulse: [{ f: 5, vx: 1.9, vz: 5.4 }],
    hits: [
      { at: 5, dur: 4, dmg: 16, box: [22, 58, 34, 54], kb: 2, lift: 4.2, down: true, hitstop: 9, spark: 'heavy' },
      { at: 10, dur: 6, dmg: 12, box: [20, 76, 32, 50], kb: 3, lift: 2.2, down: true, hitstop: 7, spark: 'mid' },
    ],
  }),
  spSpin: mv({
    name: '선풍참', anim: 'spSpin', startup: 7, active: 22, recover: 20, peak: 3,
    dmg: 8, box: [26, 48, 40, 46], kb: 1.2, hitstop: 6, meter: 10,
    sfx: 'spin', spark: 'mid', superFx: true, activeRange: [1, 7],
    impulse: [{ f: 6, vx: 2.2 }, { f: 14, vx: 1.6 }, { f: 22, vx: 1.2 }],
    hits: [
      { at: 7, dur: 3, dmg: 9 }, { at: 13, dur: 3, dmg: 9 },
      { at: 19, dur: 3, dmg: 9 }, { at: 25, dur: 4, dmg: 14, kb: 5.2, down: true, hitstop: 10, spark: 'heavy' },
    ],
  }),
  spPalm: mv({
    name: '폭쇄장', anim: 'spPalm', startup: 13, active: 5, recover: 26, peak: 4,
    dmg: 32, box: [36, 52, 46, 40], kb: 9.5, hitstop: 14, down: true, wall: true,
    meter: 12, sfx: 'palm', spark: 'burst', superFx: true, impulse: [{ f: 12, vx: 2.6 }],
  }),

  // ───── 초필살기 ─────
  superFlurry: mv({
    name: '열화연무', anim: 'superMove', startup: 14, active: 40, recover: 26, peak: 6,
    dmg: 8, box: [32, 50, 42, 48], kb: 1, hitstop: 5, cost: 100,
    invuln: [0, 18], meter: 0, sfx: 'superflash', spark: 'mid', superFx: true, activeRange: [3, 9],
    impulse: [{ f: 14, vx: 3.2 }, { f: 24, vx: 1.2 }, { f: 34, vx: 1.0 }],
    hits: [
      { at: 15, dur: 3, dmg: 9 }, { at: 20, dur: 3, dmg: 9 }, { at: 25, dur: 3, dmg: 9 },
      { at: 30, dur: 3, dmg: 9 }, { at: 35, dur: 3, dmg: 9 }, { at: 40, dur: 3, dmg: 9 },
      { at: 46, dur: 6, dmg: 26, kb: 7, lift: 4.4, down: true, hitstop: 16, spark: 'burst' },
    ],
  }),
  superHidden: mv({
    name: '천붕패황권', anim: 'hiddenSuper', startup: 26, active: 10, recover: 34, peak: 5,
    dmg: 120, box: [30, 54, 70, 70], kb: 11, lift: 3, hitstop: 22, down: true, wall: true,
    invuln: [0, 32], cost: 300, meter: 0, sfx: 'superflash2', spark: 'burst', superFx: true,
    impulse: [{ f: 26, vx: 3.6 }],
  }),

  // ───── 잡졸 ─────
  e_jab: mv({
    anim: 'jab1', startup: 12, active: 3, recover: 16, peak: 2,
    dmg: 8, box: [28, 54, 28, 22], kb: 2, hitstop: 5, meter: 0, sfx: 'punch',
  }),
  e_heavy: mv({
    anim: 'heavy', startup: 20, active: 4, recover: 26, peak: 4,
    dmg: 14, box: [34, 50, 36, 28], kb: 4.6, hitstop: 8, down: true, meter: 0,
    sfx: 'heavy', spark: 'heavy',
  }),
  e_stab: mv({
    anim: 'jab1', startup: 8, active: 3, recover: 14, peak: 2,
    dmg: 10, box: [34, 52, 34, 20], kb: 2.4, hitstop: 6, meter: 0, sfx: 'metal', spark: 'mid',
  }),
  e_dash: mv({
    anim: 'jumpAtk', startup: 10, active: 6, recover: 20, peak: 2,
    dmg: 12, box: [28, 46, 34, 40], kb: 4, hitstop: 7, down: true, meter: 0,
    sfx: 'kick', spark: 'mid', impulse: [{ f: 10, vx: 3.6 }],
  }),
  e_bottle: mv({
    anim: 'throwItem', startup: 16, active: 2, recover: 20, peak: 2,
    dmg: 0, meter: 0, sfx: 'whoosh',
    proj: { at: 16, kind: 'bottle', speed: 2.6, dmg: 11, hitstun: 20, kb: 3, life: 200, r: 6, arc: true },
  }),
  e_grabHit: mv({
    anim: 'knee', startup: 8, active: 3, recover: 12, peak: 1,
    dmg: 7, box: [24, 44, 26, 26], kb: 0, hitstop: 6, meter: 0, sfx: 'punch2',
  }),
  e_throw: mv({
    anim: 'throwSwing', startup: 10, active: 4, recover: 24, peak: 3,
    dmg: 16, box: [30, 46, 34, 40], kb: 7, lift: 2.6, hitstop: 10, down: true,
    meter: 0, sfx: 'throw', spark: 'heavy',
  }),

  // ───── 보스: 철갑 마스트 ─────
  bh_swing: mv({
    anim: 'heavy', startup: 18, active: 5, recover: 24, peak: 4,
    dmg: 18, box: [40, 54, 44, 32], kb: 5.4, hitstop: 10, down: true, meter: 0,
    sfx: 'metal', spark: 'heavy',
  }),
  bh_charge: mv({
    anim: 'run', startup: 16, active: 22, recover: 26, peak: 2,
    dmg: 20, box: [26, 50, 40, 54], kb: 6.4, hitstop: 11, down: true, meter: 0,
    sfx: 'heavy', spark: 'heavy', impulse: [{ f: 16, vx: 4.6 }, { f: 24, vx: 1.2 }],
  }),
  bh_slam: mv({
    anim: 'launcher', startup: 24, active: 6, recover: 30, peak: 3,
    dmg: 22, box: [20, 26, 76, 34], kb: 6, lift: 3, hitstop: 13, down: true, meter: 0,
    sfx: 'quake', spark: 'burst', superFx: true, unblockable: false,
  }),

  // ───── 보스: 용광로 그롤 ─────
  bf_smash: mv({
    anim: 'launcher', startup: 26, active: 6, recover: 30, peak: 3,
    dmg: 26, box: [24, 24, 84, 38], kb: 6.6, lift: 3.4, hitstop: 14, down: true, meter: 0,
    sfx: 'quake', spark: 'burst', superFx: true,
  }),
  bf_fire: mv({
    anim: 'spShot', startup: 22, active: 4, recover: 28, peak: 4,
    dmg: 0, meter: 0, sfx: 'fire', superFx: true,
    proj: { at: 22, kind: 'fire', speed: 2.4, dmg: 15, hitstun: 22, kb: 3.4, life: 160, r: 11, spread: 3 },
  }),
  bf_charge: mv({
    anim: 'run', startup: 20, active: 26, recover: 30, peak: 2,
    dmg: 24, box: [26, 52, 44, 58], kb: 7, hitstop: 12, down: true, meter: 0,
    sfx: 'heavy', spark: 'heavy', impulse: [{ f: 20, vx: 4.2 }, { f: 30, vx: 1.4 }],
  }),
  bf_stomp: mv({
    anim: 'jab3', startup: 18, active: 5, recover: 26, peak: 3,
    dmg: 19, box: [34, 34, 44, 40], kb: 5, hitstop: 10, down: true, meter: 0,
    sfx: 'quake', spark: 'heavy',
  }),

  // ───── 보스: 설풍 검성 ─────
  bs_slash: mv({
    anim: 'jab2', startup: 10, active: 3, recover: 12, peak: 2,
    dmg: 13, box: [40, 52, 44, 26], kb: 2.6, hitstop: 7, meter: 0, sfx: 'blade', spark: 'mid',
  }),
  bs_iai: mv({
    anim: 'spSpin', startup: 22, active: 8, recover: 30, peak: 3,
    dmg: 26, box: [30, 48, 56, 44], kb: 6.6, hitstop: 14, down: true, meter: 0,
    sfx: 'blade2', spark: 'burst', superFx: true, impulse: [{ f: 22, vx: 6.2 }],
  }),
  bs_ice: mv({
    anim: 'spShot', startup: 18, active: 4, recover: 24, peak: 4,
    dmg: 0, meter: 0, sfx: 'ice', superFx: true,
    proj: { at: 18, kind: 'ice', speed: 3.2, dmg: 13, hitstun: 20, kb: 3, life: 150, r: 8, spread: 3, fan: true },
  }),
  bs_whirl: mv({
    anim: 'spSpin', startup: 12, active: 26, recover: 24, peak: 3,
    dmg: 8, box: [26, 50, 46, 50], kb: 1.2, hitstop: 6, meter: 0,
    sfx: 'spin', spark: 'mid', activeRange: [1, 7],
    impulse: [{ f: 12, vx: 2.4 }, { f: 22, vx: 2 }, { f: 30, vx: 1.6 }],
    hits: [{ at: 12, dur: 3, dmg: 8 }, { at: 18, dur: 3, dmg: 8 }, { at: 24, dur: 3, dmg: 8 },
      { at: 30, dur: 3, dmg: 8 }, { at: 35, dur: 4, dmg: 16, kb: 6, down: true, hitstop: 11, spark: 'heavy' }],
  }),
};

// ───── 커맨드 정의 ─────
// step: 허용 방향 배열, opt=true면 건너뛸 수 있음. 방향은 facing 기준으로 정규화된 값.
const F = 6, B = 4, DF = 3, DB = 1, DN = 2, UP = 8;

export const COMMANDS = [
  { id: 'superHidden', seq: [[DN], [DB, true], [B], [DN], [DB, true], [B]], btns: ['hp'], window: 40, hidden: true },
  { id: 'superFlurry', seq: [[DN], [DF, true], [F], [DN], [DF, true], [F]], btns: ['hp', 'lp'], window: 38 },
  { id: 'spPalm', seq: [[B], [DB, true], [DN], [DF, true], [F]], btns: ['hp'], window: 30 },
  // 앞으로 걷다가 파동 커맨드를 넣었을 때 승룡이 새지 않도록 창을 좁게 잡는다
  { id: 'spRise', seq: [[F], [DN], [DF, true], [F, true]], btns: ['hp', 'lp'], window: 16, skip: 1 },
  { id: 'spSpin', seq: [[DN], [DB, true], [B]], btns: ['hp', 'lp'], window: 22 },
  { id: 'spShot', seq: [[DN], [DF, true], [F]], btns: ['hp', 'lp'], window: 22 },
];

/** 커맨드 목록 화면에 쓰는 표기 */
export const COMMAND_LIST = [
  { g: '기본기', rows: [
    ['약 3연타 체인', 'J → J → J', ''],
    ['강공격 (다운)', 'K', ''],
    ['대시 공격', '→ → + J/K', ''],
    ['점프 공격', 'L 중 J/K', ''],
    ['가드', 'Space 유지', ''],
    ['잡기 → 무릎/던지기', 'U → J / K', ''],
    ['기폭장 (체력 소모)', 'J + K', ''],
  ] },
  { g: '필살기', rows: [
    ['파열탄', '↓ ↘ → + J/K', '기 게이지 상승 · 원거리'],
    ['승천각', '→ ↓ ↘ + J/K', '시전 초반 무적'],
    ['선풍참', '↓ ↙ ← + J/K', '전진 4다단'],
    ['폭쇄장', '← ↙ ↓ ↘ → + K', '벽 강타 · 최대 데미지'],
  ] },
  { g: '초필살기', rows: [
    ['열화연무', '↓↘→ ↓↘→ + J/K', '기 게이지 1칸'],
    ['천붕패황권', '↓↙← ↓↙← + K', '기 3칸 · 봉인 두루마리 필요'],
  ] },
  { g: '캔슬', rows: [
    ['기본기 → 필살기', '히트 중 커맨드', ''],
    ['필살기 → 초필살기', '히트 중 초필 커맨드', ''],
  ] },
];
