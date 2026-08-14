// 영묘 (Sanctum) — permanent progression that survives death, persisted to localStorage.
// Every field is validated on load so a corrupt or older save degrades to defaults
// instead of throwing during boot.

const KEY = 'abyssal-crown.save.v1';

export const META_UPGRADES = [
  {
    id: 'heart', name: '심연의 심장', glyph: 'heart', max: 5,
    cost: (l) => [4, 8, 14, 22, 34][l],
    desc: (l) => `최대 체력 +${12 * (l + 1)}`,
    apply: (m, l) => { m.maxHpBonus += 12 * l; },
  },
  {
    id: 'trident', name: '삼지창 연마', glyph: 'shard', max: 5,
    cost: (l) => [5, 10, 17, 27, 40][l],
    desc: (l) => `모든 피해 +${6 * (l + 1)}%`,
    apply: (m, l) => { m.dmgMult += 0.06 * l; },
  },
  {
    id: 'current', name: '조류의 발', glyph: 'wave', max: 4,
    cost: (l) => [4, 9, 16, 26][l],
    desc: (l) => `이동 속도 +${4 * (l + 1)}%`,
    apply: (m, l) => { m.moveMult += 0.04 * l; },
  },
  {
    id: 'twindash', name: '이중 조류', glyph: 'ripple', max: 2,
    cost: (l) => [12, 30][l],
    desc: (l) => (l === 0 ? '대시 충전 +1 (연속 2회)' : '대시 충전 +2 (연속 3회)'),
    apply: (m, l) => { m.dashCharges += l; },
  },
  {
    id: 'favor', name: '심연의 총애', glyph: 'crown', max: 3,
    cost: (l) => [10, 22, 40][l],
    desc: (l) => `축복 희귀도 상승 +${l + 1}단계`,
    apply: (m, l) => { m.rarityLuck += 0.3 * l; },
  },
  {
    id: 'oath', name: '귀환의 맹세', glyph: 'skull', max: 2,
    cost: (l) => [16, 44][l],
    desc: (l) => `치명적 피해를 ${l + 1}회 버팀`,
    apply: (m, l) => { m.deathDefiance += l; },
  },
  {
    id: 'magnet', name: '파편 자석', glyph: 'coin', max: 4,
    cost: (l) => [6, 12, 20, 32][l],
    desc: (l) => `심연 결정 획득 +${20 * (l + 1)}%`,
    apply: (m, l) => { m.shardMult += 0.2 * l; },
  },
  {
    id: 'sigil', name: '주문 각인', glyph: 'crystal', max: 3,
    cost: (l) => [8, 18, 32][l],
    desc: (l) => `주문 탄약 +${l + 1}, 주문 피해 +${8 * (l + 1)}%`,
    apply: (m, l) => { m.castAmmo += l; m.castMult += 0.08 * l; },
  },
  {
    id: 'senses', name: '예리한 감각', glyph: 'ripple', max: 4,
    cost: (l) => [7, 14, 24, 38][l],
    desc: (l) => `치명타 확률 +${3 * (l + 1)}%`,
    apply: (m, l) => { m.critChance += 0.03 * l; },
  },
  {
    id: 'pact', name: '심연의 계약', glyph: 'anvil', max: 3,
    cost: (l) => [6, 14, 26][l],
    desc: (l) => `금화 획득 +${15 * (l + 1)}%, 시작 금화 +${25 * (l + 1)}`,
    apply: (m, l) => { m.goldMult += 0.15 * l; m.startGold = (m.startGold || 0) + 25 * l; },
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(META_UPGRADES.map((u) => [u.id, u]));

function defaultSave() {
  return {
    v: 1,
    shards: 0,
    upgrades: {},
    stats: {
      runs: 0, wins: 0, kills: 0, deaths: 0,
      bestBiome: 0, bestRoom: 0, bossKills: {}, fastestWin: 0,
      totalShards: 0, boonsTaken: 0,
    },
    settings: { sfx: 0.75, music: 0.5 },
    flags: { seenIntro: false, seenSanctum: false },
  };
}

let save = defaultSave();
let storageOk = true;

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      save = mergeSave(defaultSave(), parsed);
    } else {
      save = defaultSave();
    }
  } catch (e) {
    // Private-mode / quota / corrupt JSON: run with an in-memory save instead of dying.
    storageOk = false;
    save = defaultSave();
  }
  return save;
}

function mergeSave(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  out.shards = Number.isFinite(patch.shards) ? Math.max(0, patch.shards) : 0;
  out.upgrades = {};
  if (patch.upgrades && typeof patch.upgrades === 'object') {
    for (const u of META_UPGRADES) {
      const lv = patch.upgrades[u.id];
      if (Number.isFinite(lv)) out.upgrades[u.id] = Math.max(0, Math.min(u.max, Math.floor(lv)));
    }
  }
  out.stats = { ...base.stats, ...(patch.stats || {}) };
  if (!out.stats.bossKills || typeof out.stats.bossKills !== 'object') out.stats.bossKills = {};
  out.settings = { ...base.settings, ...(patch.settings || {}) };
  out.flags = { ...base.flags, ...(patch.flags || {}) };
  return out;
}

export function persist() {
  if (!storageOk) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {
    storageOk = false;
  }
}

export function getSave() { return save; }
export function storageAvailable() { return storageOk; }

export function levelOf(id) { return save.upgrades[id] || 0; }

export function upgradeCost(id) {
  const u = UPGRADE_BY_ID[id];
  const lv = levelOf(id);
  if (!u || lv >= u.max) return null;
  return u.cost(lv);
}

export function canAfford(id) {
  const c = upgradeCost(id);
  return c !== null && save.shards >= c;
}

export function buyUpgrade(id) {
  const c = upgradeCost(id);
  if (c === null || save.shards < c) return false;
  save.shards -= c;
  save.upgrades[id] = levelOf(id) + 1;
  persist();
  return true;
}

/** Refund everything for free — encourages experimenting with builds. */
export function respec() {
  let refund = 0;
  for (const u of META_UPGRADES) {
    const lv = levelOf(u.id);
    for (let i = 0; i < lv; i++) refund += u.cost(i);
  }
  if (refund <= 0) return 0;
  save.shards += refund;
  save.upgrades = {};
  persist();
  return refund;
}

export function addShards(n) {
  const amt = Math.max(0, Math.floor(n));
  save.shards += amt;
  save.stats.totalShards += amt;
  persist();
  return amt;
}

/** Flattened modifier bag consumed by `Build` at run start. */
export function metaMods() {
  const m = {
    maxHpBonus: 0, dmgMult: 0, moveMult: 0, dashCharges: 0,
    rarityLuck: 0, deathDefiance: 0, shardMult: 0, castAmmo: 0,
    castMult: 0, critChance: 0, goldMult: 0, startGold: 0,
  };
  for (const u of META_UPGRADES) {
    const lv = levelOf(u.id);
    if (lv > 0) u.apply(m, lv);
  }
  return m;
}

export function recordRunStart() {
  save.stats.runs++;
  persist();
}

export function recordRunEnd({ won, biomeIndex, roomIndex, kills, shards, boons, timeSec }) {
  const s = save.stats;
  if (won) {
    s.wins++;
    if (!s.fastestWin || timeSec < s.fastestWin) s.fastestWin = timeSec;
  } else {
    s.deaths++;
  }
  s.kills += kills || 0;
  s.boonsTaken += boons || 0;
  if (biomeIndex > s.bestBiome || (biomeIndex === s.bestBiome && roomIndex > s.bestRoom)) {
    s.bestBiome = biomeIndex;
    s.bestRoom = roomIndex;
  }
  persist();
}

export function recordBossKill(id) {
  save.stats.bossKills[id] = (save.stats.bossKills[id] || 0) + 1;
  persist();
}

export function setFlag(k, v = true) { save.flags[k] = v; persist(); }
export function getFlag(k) { return !!save.flags[k]; }

export function setSetting(k, v) { save.settings[k] = v; persist(); }
export function getSettings() { return save.settings; }

export function wipeSave() {
  save = defaultSave();
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing to clean up */ }
}
