// 축복 (Boons) — the per-run build system.
//
// Slot rules mirror the genre convention: 기본공격/특수공격/주문/대시 each hold exactly
// one boon, so picking one closes a door. 가호 (passive) boons stack freely. Every boon
// can be re-offered at a higher rarity as an upgrade, which keeps late rooms meaningful
// once the four action slots are full.

import { RARITY, RARITY_ORDER, GODS } from './art.js';
import { clamp } from './core.js';

export const SLOTS = {
  attack:  { key: 'attack',  name: '기본 공격', short: '공격' },
  special: { key: 'special', name: '특수 공격', short: '특수' },
  cast:    { key: 'cast',    name: '주문',     short: '주문' },
  dash:    { key: 'dash',    name: '대시',     short: '대시' },
  passive: { key: 'passive', name: '가호',     short: '가호' },
};

const pct = (v) => `${Math.round(v * 100)}%`;
const num = (v) => `${Math.round(v)}`;
const one = (v) => (Math.round(v * 10) / 10).toString();

/** Status types applied by boons; the combat code reads these keys directly. */
export const STATUS = {
  soaked: { key: 'soaked', name: '젖음',  color: '#3fb0ff', maxStacks: 5, duration: 6 },
  burn:   { key: 'burn',   name: '화상',  color: '#ff6a2c', maxStacks: 8, duration: 4 },
  chill:  { key: 'chill',  name: '한기',  color: '#b98cff', maxStacks: 6, duration: 5 },
  reso:   { key: 'reso',   name: '공명',  color: '#3fe59d', maxStacks: 6, duration: 7 },
  frozen: { key: 'frozen', name: '결빙',  color: '#dcefff', maxStacks: 1, duration: 1.6 },
  mark:   { key: 'mark',   name: '표식',  color: '#ffd34a', maxStacks: 1, duration: 6 },
};

export function baseMods() {
  return {
    dmgMult: 1,
    atkMult: 1, spMult: 1, castMult: 1, dashMult: 1,
    critChance: 0.05, critMult: 2.0,
    moveMult: 1, atkSpeed: 1,
    dashCdMult: 1, dashIFrameMult: 1, dashCharges: 1,
    maxHpBonus: 0,
    castAmmo: 0, castPierce: 0, castSplit: 0, castExplode: 0, castHoming: 0,
    onAttack: null, onSpecial: null, onCast: null, onDash: null,
    dashBlast: 0, dashTrail: 0, dashSlow: 0, dashCritWindow: 0, dashCritBonus: 0, dashContact: 0,
    specialExplode: 0, specialPull: 0, specialRadius: 1,
    chainCount: 0, chainRatio: 0,
    statusDmgMult: 1,
    frozenBonus: 0, shatter: 0,
    goldMult: 1, shardMult: 1,
    healOnKill: 0, healOnSoakedKill: 0,
    deathDefiance: 0,
    knockback: 1,
    goldDmgScale: 0,
    resoBurst: 0,
    thorns: 0,
    rarityLuck: 0,
  };
}

/**
 * @typedef {Object} BoonDef
 * @property {string} id
 * @property {keyof GODS} god
 * @property {keyof SLOTS} slot
 * @property {(b:Object)=>Object} vals   scaled numbers for a rarity multiplier
 * @property {(v:Object)=>string} desc
 * @property {(m:Object, v:Object)=>void} apply
 */

export const BOONS = [
  // ------------------------------------------------------------- 넵투나 / 조류
  {
    id: 'neptuna_attack', god: 'neptuna', slot: 'attack', name: '조수의 일격',
    flavor: '삼지창이 지나간 자리마다 바닷물이 스며든다.',
    vals: (m) => ({ dmg: 0.20 * m, stacks: 1 + Math.floor(m - 0.9) }),
    desc: (v) => `기본 공격 피해 +${pct(v.dmg)}, 적중 시 <젖음> ${v.stacks}중첩 부여`,
    apply: (mo, v) => { mo.atkMult += v.dmg; mo.onAttack = { type: 'soaked', stacks: v.stacks }; },
  },
  {
    id: 'neptuna_special', god: 'neptuna', slot: 'special', name: '소용돌이',
    flavor: '중심으로 끌려 들어가는 것들에게 자비는 없다.',
    vals: (m) => ({ dmg: 0.25 * m, pull: 260 * m }),
    desc: (v) => `특수 공격 피해 +${pct(v.dmg)}, 적을 중심으로 강하게 끌어당김`,
    apply: (mo, v) => { mo.spMult += v.dmg; mo.specialPull += v.pull; mo.onSpecial = { type: 'soaked', stacks: 2 }; },
  },
  {
    id: 'neptuna_cast', god: 'neptuna', slot: 'cast', name: '격류탄',
    flavor: '한 줄기 해류가 대열을 관통한다.',
    vals: (m) => ({ dmg: 0.30 * m, pierce: 2 + Math.floor(m) }),
    desc: (v) => `주문 피해 +${pct(v.dmg)}, ${num(v.pierce)}회 관통 + 강한 넉백`,
    apply: (mo, v) => { mo.castMult += v.dmg; mo.castPierce += v.pierce; mo.knockback += 0.6; mo.onCast = { type: 'soaked', stacks: 2 }; },
  },
  {
    id: 'neptuna_dash', god: 'neptuna', slot: 'dash', name: '조류 도약',
    flavor: '착지는 언제나 파도와 함께.',
    vals: (m) => ({ dmg: 26 * m, radius: 96 + 14 * m }),
    desc: (v) => `대시가 끝날 때 물기둥이 터져 ${num(v.dmg)} 피해 (반경 ${num(v.radius)})`,
    apply: (mo, v) => { mo.dashBlast = Math.max(mo.dashBlast, v.dmg); mo.dashBlastR = v.radius; mo.onDash = { type: 'soaked', stacks: 2 }; },
  },
  {
    id: 'neptuna_passive', god: 'neptuna', slot: 'passive', name: '밀물의 축복',
    flavor: '조류는 결코 지치지 않는다.',
    vals: (m) => ({ ms: 0.10 * m, heal: 3 * m }),
    desc: (v) => `이동 속도 +${pct(v.ms)}, <젖음> 상태의 적 처치 시 체력 ${num(v.heal)} 회복`,
    apply: (mo, v) => { mo.moveMult += v.ms; mo.healOnSoakedKill += v.heal; },
  },

  // -------------------------------------------------------------- 볼카르 / 열수
  {
    id: 'volkar_attack', god: 'volkar', slot: 'attack', name: '열수 강타',
    flavor: '심해에도 불은 있다. 더 뜨겁고, 더 조용하게.',
    vals: (m) => ({ stacks: 1 + Math.floor(m - 0.9), dmg: 0.12 * m }),
    desc: (v) => `기본 공격 피해 +${pct(v.dmg)}, 적중 시 <화상> ${v.stacks}중첩 부여`,
    apply: (mo, v) => { mo.atkMult += v.dmg; mo.onAttack = { type: 'burn', stacks: v.stacks }; },
  },
  {
    id: 'volkar_special', god: 'volkar', slot: 'special', name: '분출',
    flavor: '땅이 갈라지고, 그 아래 것이 올라온다.',
    vals: (m) => ({ dmg: 0.40 * m, r: 0.25 * m }),
    desc: (v) => `특수 공격 피해 +${pct(v.dmg)}, 범위 +${pct(v.r)}, 폭발 발생`,
    apply: (mo, v) => { mo.spMult += v.dmg; mo.specialRadius += v.r; mo.specialExplode += 34; mo.onSpecial = { type: 'burn', stacks: 2 }; },
  },
  {
    id: 'volkar_cast', god: 'volkar', slot: 'cast', name: '작열 파편',
    flavor: '부딪히는 순간이 곧 점화다.',
    vals: (m) => ({ dmg: 40 * m, r: 100 + 16 * m }),
    desc: (v) => `주문이 착탄 시 폭발해 ${num(v.dmg)} 피해 (반경 ${num(v.r)})`,
    apply: (mo, v) => { mo.castExplode = Math.max(mo.castExplode, v.dmg); mo.castExplodeR = v.r; mo.onCast = { type: 'burn', stacks: 2 }; },
  },
  {
    id: 'volkar_dash', god: 'volkar', slot: 'dash', name: '화염 항적',
    flavor: '지나간 길이 곧 함정이 된다.',
    vals: (m) => ({ dps: 30 * m, dur: 2.4 + 0.4 * m }),
    desc: (v) => `대시 경로에 ${one(v.dur)}초간 불길을 남김 (초당 ${num(v.dps)} 피해)`,
    apply: (mo, v) => { mo.dashTrail = Math.max(mo.dashTrail, v.dps); mo.dashTrailDur = v.dur; },
  },
  {
    id: 'volkar_passive', god: 'volkar', slot: 'passive', name: '대장장이의 인내',
    flavor: '두드릴수록 단단해진다.',
    vals: (m) => ({ burn: 0.5 * m, hp: 12 * m }),
    desc: (v) => `<화상> 피해 +${pct(v.burn)}, 최대 체력 +${num(v.hp)}`,
    apply: (mo, v) => { mo.burnMult = (mo.burnMult || 1) + v.burn; mo.maxHpBonus += v.hp; },
  },

  // ------------------------------------------------------------- 글라시아 / 한류
  {
    id: 'glacia_attack', god: 'glacia', slot: 'attack', name: '서리 칼날',
    flavor: '느려진 것은 이미 반쯤 죽은 것이다.',
    vals: (m) => ({ stacks: 1 + Math.floor(m - 0.9), dmg: 0.15 * m }),
    desc: (v) => `기본 공격 피해 +${pct(v.dmg)}, 적중 시 <한기> ${v.stacks}중첩 부여`,
    apply: (mo, v) => { mo.atkMult += v.dmg; mo.onAttack = { type: 'chill', stacks: v.stacks }; },
  },
  {
    id: 'glacia_special', god: 'glacia', slot: 'special', name: '절대영도',
    flavor: '심장까지 얼어붙는 데는 한순간이면 충분하다.',
    vals: (m) => ({ dmg: 0.20 * m, dur: 1.0 + 0.35 * m }),
    desc: (v) => `특수 공격 피해 +${pct(v.dmg)}, 적중한 적을 ${one(v.dur)}초 결빙`,
    apply: (mo, v) => { mo.spMult += v.dmg; mo.specialFreeze = v.dur; mo.onSpecial = { type: 'chill', stacks: 3 }; },
  },
  {
    id: 'glacia_cast', god: 'glacia', slot: 'cast', name: '빙결탄',
    flavor: '한 발이면 한기가 뼈까지 닿는다.',
    vals: (m) => ({ dmg: 0.25 * m, stacks: 2 + Math.floor(m) }),
    desc: (v) => `주문 피해 +${pct(v.dmg)}, <한기> ${num(v.stacks)}중첩 부여`,
    apply: (mo, v) => { mo.castMult += v.dmg; mo.onCast = { type: 'chill', stacks: v.stacks }; },
  },
  {
    id: 'glacia_dash', god: 'glacia', slot: 'dash', name: '서리 잔상',
    flavor: '남겨진 그림자가 대신 붙잡는다.',
    vals: (m) => ({ slow: 0.35 * m, r: 130 + 18 * m }),
    desc: (v) => `대시 시 반경 ${num(v.r)} 내 적에게 <한기> 부여 + ${pct(clamp(v.slow, 0, 0.7))} 감속`,
    apply: (mo, v) => { mo.dashSlow = Math.max(mo.dashSlow, clamp(v.slow, 0, 0.7)); mo.dashSlowR = v.r; mo.onDash = { type: 'chill', stacks: 2 }; },
  },
  {
    id: 'glacia_passive', god: 'glacia', slot: 'passive', name: '결빙 파쇄',
    flavor: '얼음은 부서지기 위해 존재한다.',
    vals: (m) => ({ bonus: 0.6 * m, shatter: 50 * m }),
    desc: (v) => `결빙된 적에게 피해 +${pct(v.bonus)}, 결빙 중 처치 시 ${num(v.shatter)} 광역 파편 폭발`,
    apply: (mo, v) => { mo.frozenBonus += v.bonus; mo.shatter += v.shatter; },
  },

  // --------------------------------------------------------------- 에코스 / 음파
  {
    id: 'echos_attack', god: 'echos', slot: 'attack', name: '반향 타격',
    flavor: '한 번의 소리가 열 번 되돌아온다.',
    vals: (m) => ({ chain: 1 + Math.floor(m * 0.9), ratio: 0.45 * m }),
    desc: (v) => `기본 공격이 근처 적 ${num(v.chain)}명에게 ${pct(v.ratio)} 피해로 연쇄`,
    apply: (mo, v) => { mo.chainCount += v.chain; mo.chainRatio = Math.max(mo.chainRatio, v.ratio); mo.onAttack = { type: 'reso', stacks: 1 }; },
  },
  {
    id: 'echos_special', god: 'echos', slot: 'special', name: '공명 폭발',
    flavor: '쌓인 진동은 언젠가 터진다.',
    vals: (m) => ({ stacks: 2 + Math.floor(m), burst: 55 * m }),
    desc: (v) => `특수 공격이 <공명> ${num(v.stacks)}중첩 부여, 만중첩 시 ${num(v.burst)} 광역 폭발`,
    apply: (mo, v) => { mo.onSpecial = { type: 'reso', stacks: v.stacks }; mo.resoBurst = Math.max(mo.resoBurst, v.burst); },
  },
  {
    id: 'echos_cast', god: 'echos', slot: 'cast', name: '메아리 화살',
    flavor: '쏜 것은 하나인데 셋이 도착한다.',
    vals: (m) => ({ split: 1 + Math.floor(m), homing: 2.2 * m }),
    desc: (v) => `주문이 ${num(v.split)}발 추가 발사되고 약하게 유도됨`,
    apply: (mo, v) => { mo.castSplit += v.split; mo.castHoming += v.homing; mo.onCast = { type: 'reso', stacks: 1 }; },
  },
  {
    id: 'echos_dash', god: 'echos', slot: 'dash', name: '음속 잔영',
    flavor: '소리보다 빠르면 아무도 반응하지 못한다.',
    vals: (m) => ({ crit: 0.30 * m, dur: 1.4 + 0.3 * m }),
    desc: (v) => `대시 후 ${one(v.dur)}초간 치명타 확률 +${pct(v.crit)}`,
    apply: (mo, v) => { mo.dashCritWindow = Math.max(mo.dashCritWindow, v.dur); mo.dashCritBonus = Math.max(mo.dashCritBonus, v.crit); },
  },
  {
    id: 'echos_passive', god: 'echos', slot: 'passive', name: '예언자의 귀',
    flavor: '다음 심장 박동이 어디서 멈출지 들린다.',
    vals: (m) => ({ crit: 0.10 * m, cd: 0.35 * m }),
    desc: (v) => `치명타 확률 +${pct(v.crit)}, 치명타 피해 +${pct(v.cd)}`,
    apply: (mo, v) => { mo.critChance += v.crit; mo.critMult += v.cd; },
  },

  // ------------------------------------------------- 왕관 / 전설 (후반부 해금)
  {
    id: 'crown_greed', god: 'crown', slot: 'passive', name: '왕관의 탐욕',
    flavor: '가라앉은 왕은 금을 놓지 못했다.',
    minBoons: 3,
    vals: (m) => ({ gold: 0.45 * m, scale: 0.02 * m }),
    desc: (v) => `금화 획득 +${pct(v.gold)}, 보유 금화 100당 피해 +${pct(v.scale)}`,
    apply: (mo, v) => { mo.goldMult += v.gold; mo.goldDmgScale += v.scale; },
  },
  {
    id: 'crown_defiance', god: 'crown', slot: 'passive', name: '불복의 맹세',
    flavor: '아직 죽을 때가 아니라고, 왕관이 말한다.',
    minBoons: 3,
    vals: (m) => ({ n: Math.max(1, Math.round(m * 0.8)) }),
    desc: (v) => `치명적인 피해를 ${num(v.n)}회 무효화하고 체력 40 회복 (방마다 재충전)`,
    apply: (mo, v) => { mo.deathDefiance += v.n; },
  },
  {
    id: 'crown_hunger', god: 'crown', slot: 'passive', name: '심연의 허기',
    flavor: '먹어치울수록 단단해진다.',
    minBoons: 3,
    vals: (m) => ({ heal: 2.5 * m }),
    desc: (v) => `적 처치 시 체력 ${num(v.heal)} 회복`,
    apply: (mo, v) => { mo.healOnKill += v.heal; },
  },
  {
    id: 'crown_tempo', god: 'crown', slot: 'passive', name: '조류의 박자',
    flavor: '바다에는 바다의 박자가 있다.',
    minBoons: 3,
    vals: (m) => ({ spd: 0.16 * m, cd: 0.20 * m }),
    desc: (v) => `공격 속도 +${pct(v.spd)}, 대시 재사용 대기 -${pct(v.cd)}`,
    apply: (mo, v) => { mo.atkSpeed += v.spd; mo.dashCdMult *= 1 - clamp(v.cd, 0, 0.6); },
  },
  {
    id: 'crown_veil', god: 'crown', slot: 'passive', name: '왕관의 장막',
    flavor: '보이지 않는 자를 벨 수는 없다.',
    minBoons: 3,
    vals: (m) => ({ iframe: 0.5 * m, dmg: 12 * m }),
    desc: (v) => `대시 무적 시간 +${pct(v.iframe)}, 무적 중 접촉한 적에게 ${num(v.dmg)} 피해`,
    apply: (mo, v) => { mo.dashIFrameMult += v.iframe; mo.dashContact += v.dmg; },
  },
  {
    id: 'crown_echo', god: 'crown', slot: 'passive', name: '왕관의 메아리',
    flavor: '상처는 사라지지 않고 되풀이된다.',
    minBoons: 3,
    vals: (m) => ({ st: 0.4 * m }),
    desc: (v) => `모든 상태 이상 피해 +${pct(v.st)}`,
    apply: (mo, v) => { mo.statusDmgMult += v.st; },
  },
  {
    id: 'crown_thorns', god: 'crown', slot: 'passive', name: '가시 왕관',
    flavor: '쓰는 자를 먼저 찌른다.',
    minBoons: 3,
    vals: (m) => ({ th: 26 * m }),
    desc: (v) => `피격 시 주변 적에게 ${num(v.th)} 광역 반사 피해`,
    apply: (mo, v) => { mo.thorns += v.th; },
  },
];

export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));

// ------------------------------------------------------------------- runtime

export class Build {
  constructor(metaMods = {}) {
    this.owned = Object.create(null);      // id -> { def, rarity }
    this.slots = Object.create(null);      // slot -> boon id
    this.metaMods = metaMods;
    this.mods = baseMods();
    this.recompute();
  }

  get list() { return Object.values(this.owned); }
  get count() { return Object.keys(this.owned).length; }

  has(id) { return !!this.owned[id]; }
  rarityOf(id) { return this.owned[id] ? this.owned[id].rarity : null; }

  add(def, rarityKey) {
    const prev = this.owned[def.id];
    // Never downgrade — re-offers at lower rarity are silently kept at the best tier.
    if (prev && RARITY_ORDER.indexOf(rarityKey) <= RARITY_ORDER.indexOf(prev.rarity)) {
      rarityKey = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(prev.rarity) + 1)];
    }
    this.owned[def.id] = { def, rarity: rarityKey };
    if (def.slot !== 'passive') this.slots[def.slot] = def.id;
    this.recompute();
    return this.owned[def.id];
  }

  recompute() {
    const m = baseMods();
    // Meta (permanent, cross-run) upgrades apply before boons so boon percentages
    // multiply the already-improved baseline.
    for (const [k, v] of Object.entries(this.metaMods)) {
      if (typeof v !== 'number') continue;
      if (k in m) m[k] += v;
    }
    for (const { def, rarity } of Object.values(this.owned)) {
      const mult = RARITY[rarity].mult;
      def.apply(m, def.vals(mult));
    }
    m.critChance = clamp(m.critChance, 0, 0.95);
    m.moveMult = clamp(m.moveMult, 0.5, 2.4);
    this.mods = m;
    return m;
  }

  /** Serialisable snapshot for the run-summary screen. */
  summary() {
    return this.list.map(({ def, rarity }) => ({
      id: def.id, name: def.name, god: def.god, slot: def.slot, rarity,
    }));
  }
}

/**
 * Build the three-card offer for a boon room.
 * `luck` shifts rarity odds upward (meta upgrade + biome depth).
 */
export function rollBoonOffer(build, rand, { count = 3, luck = 0, god = null, forceRarity = null } = {}) {
  const pool = BOONS.filter((def) => {
    if (def.minBoons && build.count < def.minBoons) return false;
    if (god && def.god !== god) return false;
    const owned = build.owned[def.id];
    if (owned) return owned.rarity !== 'legendary';
    if (def.slot !== 'passive' && build.slots[def.slot]) return false;
    return true;
  });

  if (pool.length === 0) return [];

  // Prefer variety: at most one card per god unless the pool is too small.
  const shuffled = rand.shuffle(pool);
  const picked = [];
  const usedGods = new Set();
  for (const def of shuffled) {
    if (picked.length >= count) break;
    if (usedGods.has(def.god) && pool.length > count * 2) continue;
    picked.push(def);
    usedGods.add(def.god);
  }
  for (const def of shuffled) {
    if (picked.length >= count) break;
    if (!picked.includes(def)) picked.push(def);
  }

  return picked.map((def) => {
    const rarity = forceRarity || rollRarity(rand, luck, build.rarityOf(def.id));
    const mult = RARITY[rarity].mult;
    return {
      def, rarity,
      isUpgrade: !!build.owned[def.id],
      values: def.vals(mult),
      text: def.desc(def.vals(mult)),
      godInfo: GODS[def.god],
    };
  });
}

export function rollRarity(rand, luck = 0, minRarity = null) {
  const entries = RARITY_ORDER.map((k, i) => ({
    key: k,
    // Luck pushes weight toward the tail without ever zeroing out common.
    w: RARITY[k].w * (1 + luck * i * 1.5),
  }));
  let key = rand.weighted(entries).key;
  if (minRarity) {
    const floor = RARITY_ORDER.indexOf(minRarity) + 1;
    if (RARITY_ORDER.indexOf(key) < floor) key = RARITY_ORDER[Math.min(floor, RARITY_ORDER.length - 1)];
  }
  return key;
}
