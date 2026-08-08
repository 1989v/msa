'use strict';
(function () {
/**
 * 표류 대륙 — 월드: 시드 기반 절차 대륙 / 청크 스트리밍 / 충돌 / 렌더.
 *
 * 대륙 구조
 *  - 지상(drift)은 WCOLS×WROWS 청크. 격자를 메모리에 들지 않고 biomeAt(cx,cy) 로 그때그때 계산한다
 *  - 바이옴은 월드 시드 + 값 노이즈(고도·습도 2축, 위도 기반 기온으로 변종 선택)로 결정
 *  - 표착항/등대 곶은 고정 앵커라 시드가 바뀌어도 자리가 흔들리지 않는다
 *  - 표착항에서 멀어질수록 티어(1~5)가 올라가 적 밀도·종류·능력치가 스케일한다
 *
 * 스트리밍
 *  - 플레이어 주변 3×3 청크만 메모리에 둔다 (상한 9)
 *  - 청크 생성은 (지역, cx, cy, 시드) 결정적이라 언로드→재로드해도 지형이 같다
 *    (열린 상자·처치한 유니크 등 변화는 state.flags 에 남아 재생성 때 반영)
 *  - 생성 직후 청크 전체를 오프스크린 캔버스에 한 번 굽고, 매 프레임은 blit 만 한다
 *  - 한 프레임에 새로 굽는 청크 수를 제한해 이동 중 프레임 끊김을 막는다 (지역 진입은 예외)
 */
var DC = window.DC || (window.DC = {});

var TILE = 32;
var CS = 32;                       // 청크당 타일 수
var CPX = CS * TILE;               // 청크 픽셀 크기

/* 지상 대륙 크기 — 32×32 청크 = 1024×1024 타일 = 32768×32768 px */
var WCOLS = 32, WROWS = 32;

/* 고정 앵커 — 표착항(시작 거점)과 등대 곶(던전 입구) */
var HCX = 16, HCY = 16;            // 표착항 청크
var CAPE_CX = 19, CAPE_CY = 16;    // 등대 곶 청크

var DEFAULT_SEED = 0x1989BEEF;     // 시드 없는 옛 세이브가 쓰는 기본 대륙

var T = {
  GRASS: 0, SAND: 1, WATER: 2, TREE: 3, ROCK: 4, WOOD: 5, WALL: 6,
  STONE: 7, PATH: 8, SPIKE: 9, MOSS: 10, RUBBLE: 11, VOID: 12, CARPET: 13, GATE: 14,
  SNOW: 15, DUNE: 16, ASH: 17,
};
var SOLID = {};
SOLID[T.WATER] = 1; SOLID[T.TREE] = 1; SOLID[T.ROCK] = 1; SOLID[T.WALL] = 1;
SOLID[T.VOID] = 1; SOLID[T.RUBBLE] = 1; SOLID[T.GATE] = 1;

var COLOR = {};
COLOR[T.GRASS] = '#1c3a29'; COLOR[T.SAND] = '#3a3524'; COLOR[T.WATER] = '#0b2a44';
COLOR[T.TREE] = '#14301f'; COLOR[T.ROCK] = '#2b3347'; COLOR[T.WOOD] = '#3b2c1e';
COLOR[T.WALL] = '#1a2238'; COLOR[T.STONE] = '#232b40'; COLOR[T.PATH] = '#4a4131';
COLOR[T.SPIKE] = '#232b40'; COLOR[T.MOSS] = '#1a3626'; COLOR[T.RUBBLE] = '#2a2f42';
COLOR[T.VOID] = '#070c16'; COLOR[T.CARPET] = '#3a2038'; COLOR[T.GATE] = '#4a3a22';
COLOR[T.SNOW] = '#3d4a5c'; COLOR[T.DUNE] = '#4a4028'; COLOR[T.ASH] = '#2a2626';

/* ── 결정적 난수 (mulberry32) ── */
function rngOf(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ══════════════════════════ 값 노이즈 ══════════════════════════ */
/* 외부 의존 없이 격자 해시 + smoothstep 보간. 같은 (x,y,seed) 면 항상 같은 값 */

function hash2(x, y, s) {
  var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + (s | 0)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }

/** 값 노이즈 — 0..1 */
function vnoise(x, y, s) {
  var xi = Math.floor(x), yi = Math.floor(y);
  var u = smooth(x - xi), v = smooth(y - yi);
  var a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  var c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  var top = a + (b - a) * u, bot = c + (d - c) * u;
  return top + (bot - top) * v;
}

/** 옥타브를 겹친 fBm — 큰 덩어리 위에 잔결을 얹는다 */
function fbm(x, y, s, oct) {
  var amp = 1, freq = 1, sum = 0, norm = 0;
  for (var i = 0; i < oct; i++) {
    sum += vnoise(x * freq, y * freq, (s + i * 7919) | 0) * amp;
    norm += amp;
    amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
/** 노이즈는 0.5 근처로 몰리므로 대비를 넓혀 밴드가 골고루 나오게 한다 */
function stretch(v, k) { return clamp01((v - 0.5) * k + 0.5); }

/* ══════════════════════════ 바이옴 ══════════════════════════ */

/* 바이옴 테이블 — base 바닥, obst 장애물 밀도, enemies [종류,마리수], map 미니맵 색 */
var BIOME = {
  harbor: { base: T.SAND, safe: true, obst: 0, enemies: [], map: '#eab308' },
  coast: { base: T.SAND, obst: 0.05, obstTile: T.ROCK, water: 0.10, enemies: [['slime', 6]], map: '#7a6b45' },
  marsh: { base: T.GRASS, obst: 0.04, obstTile: T.TREE, water: 0.17, enemies: [['slime', 5], ['archer', 2]], map: '#2f5a3e' },
  cape: { base: T.ROCK, obst: 0.05, obstTile: T.RUBBLE, enemies: [['shield', 3], ['archer', 3]], map: '#8892a8' },
  forest: { base: T.GRASS, obst: 0.17, obstTile: T.TREE, enemies: [['slime', 4], ['wolf', 3]], herbs: 3, map: '#1f6b39' },
  vale: { base: T.GRASS, obst: 0.09, obstTile: T.ROCK, enemies: [['wolf', 7]], map: '#3f8f53' },
  ruins: { base: T.GRASS, obst: 0.12, obstTile: T.RUBBLE, enemies: [['archer', 4], ['shield', 2]], map: '#6b6a58' },
  cliff: { base: T.ROCK, obst: 0.05, obstTile: T.ROCK, voidGap: 0.13, enemies: [['archer', 3], ['wolf', 2]], map: '#4a536e' },
  slope: { base: T.GRASS, obst: 0.10, obstTile: T.ROCK, enemies: [['slime', 5]], herbs: 5, map: '#4f8a4a' },
  moss: { base: T.MOSS, obst: 0.13, obstTile: T.TREE, enemies: [['slime', 4], ['wolf', 2]], herbs: 2, map: '#2a7a55' },
  pier: { base: T.WOOD, obst: 0.03, obstTile: T.RUBBLE, water: 0.27, enemies: [['archer', 3], ['slime', 3]], map: '#5b4a33' },
  wreck: { base: T.SAND, obst: 0.10, obstTile: T.RUBBLE, enemies: [['shield', 2], ['wolf', 3]], map: '#8a7550' },

  /* 대륙 확장으로 추가된 원거리 바이옴 */
  shoal: { base: T.SAND, obst: 0.03, obstTile: T.ROCK, water: 0.52, enemies: [['slime', 4]], map: '#123a56' },
  tundra: { base: T.SNOW, obst: 0.10, obstTile: T.TREE, enemies: [['wolf', 5], ['archer', 2]], herbs: 2, map: '#8fa8bf' },
  desert: { base: T.DUNE, obst: 0.06, obstTile: T.ROCK, enemies: [['archer', 4], ['slime', 3]], map: '#c9a44c' },
  ash: { base: T.ASH, obst: 0.12, obstTile: T.RUBBLE, voidGap: 0.05, enemies: [['shield', 3], ['archer', 3]], map: '#6b5a5a' },
  peak: { base: T.ROCK, obst: 0.14, obstTile: T.ROCK, voidGap: 0.10, enemies: [['wolf', 4], ['shield', 3]], map: '#9aa6c0' },
};

/* 표착항 코앞은 늘 순한 지형 */
var STARTER = ['coast', 'forest', 'slope', 'moss', 'vale', 'marsh'];
/* 저티어에서 나오면 곤란한 험지 → 순한 대체 바이옴 */
var SOFTEN = { ash: 'ruins', peak: 'slope', desert: 'coast', tundra: 'vale', cliff: 'slope' };

var wseed = DEFAULT_SEED;          // 현재 월드 시드
var biomeMemo = {};                // "cx,cy" → 바이옴 (청크 수가 유한해 상한이 있다)

function setSeed(s) {
  var n = (s >>> 0) || DEFAULT_SEED;
  if (n === wseed) return;
  wseed = n;
  biomeMemo = {};
}

/**
 * 고도 — fBm 에 해안 마스크를 곱한다.
 * 마스크는 체비셰프·유클리드 혼합 반경이라 사각 대륙의 모서리도 낭비 없이 쓰면서
 * 바깥 테두리는 얕은 여울로 가라앉는다.
 */
function elevAt(cx, cy) {
  var e = stretch(fbm(cx * 0.16, cy * 0.16, wseed | 0, 3), 2.4);
  var dx = (cx - HCX) / (WCOLS * 0.5), dy = (cy - HCY) / (WROWS * 0.5);
  var r = Math.max(Math.abs(dx), Math.abs(dy)) * 0.72 + Math.sqrt(dx * dx + dy * dy) * 0.28;
  return e * clamp01((1.04 - r) / 0.11);
}
/** 습도 — 고도와 독립된 두 번째 노이즈 축 */
function moistAt(cx, cy) {
  return stretch(fbm(cx * 0.13 + 37.5, cy * 0.13 - 19.25, (wseed ^ 0x9E3779B9) | 0, 2), 1.6);
}
/** 기온 — 위도(남쪽이 덥다) + 노이즈 − 고도 보정. 바이옴 변종 선택에만 쓴다 */
function tempAt(cx, cy, e) {
  var lat = cy / (WROWS - 1);
  var n = stretch(fbm(cx * 0.075 - 11.5, cy * 0.075 + 23.5, (wseed ^ 0x27D4EB2F) | 0, 2), 1.8);
  return clamp01(lat * 0.58 + n * 0.42 + 0.06 - e * 0.18);
}

/** 고도·습도 밴드 + 기온 변종으로 바이옴을 고른다 */
function classify(e, m, t) {
  if (e < 0.16) return 'shoal';
  if (e < 0.34) {                                     // 해안대
    if (m > 0.66) return 'pier';
    if (t > 0.72) return 'wreck';
    return 'coast';
  }
  if (e < 0.54) {                                     // 저지대
    if (m > 0.72) return 'marsh';
    if (m > 0.48) return t < 0.26 ? 'tundra' : 'forest';
    if (t > 0.70) return 'desert';
    if (t < 0.26) return 'tundra';
    return m > 0.32 ? 'vale' : 'ruins';
  }
  if (e < 0.72) {                                     // 고지대
    if (m > 0.70) return 'moss';
    if (m > 0.44) return t < 0.28 ? 'tundra' : 'forest';
    if (t > 0.68) return 'ash';
    return 'slope';
  }
  if (t > 0.70) return 'ash';                         // 산악
  if (m > 0.55) return 'peak';
  return 'cliff';
}

function inWorld(cx, cy) { return cx >= 0 && cy >= 0 && cx < WCOLS && cy < WROWS; }

/** 표착항으로부터의 체비셰프 거리 → 난이도 티어 1~5 */
function tierAt(cx, cy) {
  var d = Math.max(Math.abs(cx - HCX), Math.abs(cy - HCY));
  if (d <= 2) return 1;
  if (d <= 5) return 2;
  if (d <= 9) return 3;
  if (d <= 13) return 4;
  return 5;
}

/** 청크 좌표 + 월드 시드만으로 바이옴을 정한다 (전체 격자를 메모리에 들지 않는다) */
function biomeAt(cx, cy) {
  if (!inWorld(cx, cy)) return 'shoal';
  if (cx === HCX && cy === HCY) return 'harbor';
  if (cx === CAPE_CX && cy === CAPE_CY) return 'cape';
  var key = cx + ',' + cy;
  var hit = biomeMemo[key];
  if (hit) return hit;

  var b;
  var tier = tierAt(cx, cy);
  if (tier === 1) {
    b = STARTER[Math.floor(hash2(cx, cy, (wseed ^ 0x51ED2701) | 0) * STARTER.length) % STARTER.length];
  } else {
    var e = elevAt(cx, cy);
    b = classify(e, moistAt(cx, cy), tempAt(cx, cy, e));
    if (tier <= 2 && SOFTEN[b]) b = SOFTEN[b];
  }
  biomeMemo[key] = b;
  return b;
}

/* ══════════════════════════ 랜드마크 ══════════════════════════ */
/* 좌표 해시만으로 재현된다. 획득 여부는 state.flags 에 남아 중복 보상이 없다 */

var LM_W = [
  ['camp', 0.28], ['wreckage', 0.18], ['delve', 0.18],
  ['statue', 0.14], ['spring', 0.12], ['merchant', 0.10],
];
var LM_RATE = 0.14;                 // 청크당 랜드마크 확률

function landmarkAt(cx, cy) {
  if (!inWorld(cx, cy)) return null;
  if (cx === HCX && cy === HCY) return null;
  if (cx === CAPE_CX && cy === CAPE_CY) return null;
  if (biomeAt(cx, cy) === 'shoal') return null;
  var h = hash2(cx, cy, (wseed ^ 0x4C4D5A17) | 0);
  if (h >= LM_RATE) return null;

  var r = h / LM_RATE, acc = 0, kind = LM_W[0][0];
  for (var i = 0; i < LM_W.length; i++) {
    acc += LM_W[i][1];
    if (r < acc) { kind = LM_W[i][0]; break; }
  }
  var tx = 4 + Math.floor(hash2(cx + 811, cy - 337, wseed | 0) * (CS - 8));
  var ty = 4 + Math.floor(hash2(cx - 271, cy + 613, wseed | 0) * (CS - 8));
  if (tx >= 12 && tx <= 20) tx = tx < 16 ? 9 : 23;     // 십자 도로를 덮지 않게 비킨다
  if (ty >= 12 && ty <= 20) ty = ty < 16 ? 9 : 23;
  return { kind: kind, tx: tx, ty: ty, cx: cx, cy: cy, tier: tierAt(cx, cy) };
}

/** 티어가 오를수록 값어치가 커지는 보물 — 멀리 갈 이유 */
function lootFor(tier, rich) {
  var l = [];
  if (tier <= 1) l = ['potion', 'gold:30'];
  else if (tier === 2) l = ['potion', 'potion', 'gold:70'];
  else if (tier === 3) l = ['potion_hi', 'elixir', 'gold:130'];
  else if (tier === 4) l = ['potion_hi', 'potion_hi', 'elixir', 'gold:220'];
  else l = ['potion_hi', 'potion_hi', 'elixir', 'elixir', 'gold:340'];
  if (rich && tier >= 4) l.push(tier >= 5 ? 'wraith_sigil' : 'castaway_charm');
  return l;
}

/* ══════════════════════════ 던전 층 정의 ══════════════════════════ */
/* 등대 던전은 손제작 유지 — 방 12개 (F1 5 · F2 4 · F3 3) */

var CAPE_RX = CAPE_CX * CPX + 16 * TILE + 16;   // 등대 곶 복귀 지점(월드 픽셀)
var CAPE_RY = CAPE_CY * CPX + 14 * TILE + 16;

var FLOORS = {
  f1: {
    zone: 'f1',
    rooms: [
      { x: 13, y: 23, w: 7, h: 7, tag: 'entry' },
      { x: 8, y: 15, w: 16, h: 7, tag: 'hall' },
      { x: 3, y: 16, w: 5, h: 5, tag: 'store' },
      { x: 24, y: 15, w: 6, h: 6, tag: 'watch' },
      { x: 12, y: 5, w: 8, h: 8, tag: 'stair' },
    ],
    halls: [
      { x: 16, y: 21, w: 1, h: 3 }, { x: 8, y: 18, w: 1, h: 1 },
      { x: 16, y: 12, w: 1, h: 4 },
    ],
    objs: [
      /* 지상 복귀 지점은 등대 곶 청크라 청크 오프셋을 더해야 한다 */
      { kind: 'portal', tx: 16, ty: 28, to: 'drift', px: CAPE_RX, py: CAPE_RY, up: true },
      { kind: 'chest', tx: 5, ty: 18, id: 'c_f1_key', loot: ['key_rust', 'potion'] },
      { kind: 'chest', tx: 27, ty: 18, id: 'c_f1_gold', loot: ['gold:60', 'potion'] },
      { kind: 'gate', tx: 16, ty: 14, id: 'g_f1', need: 'key_rust' },
      { kind: 'portal', tx: 16, ty: 7, to: 'f2', px: 16 * 32 + 16, py: 27 * 32 + 16, down: true },
    ],
    spikes: [{ x: 10, y: 17, w: 5, h: 3 }],
    spawns: [
      { t: 'slime', tx: 16, ty: 26 }, { t: 'slime', tx: 12, ty: 18 }, { t: 'slime', tx: 20, ty: 19 },
      { t: 'archer', tx: 21, ty: 17 }, { t: 'shield', tx: 26, ty: 18 }, { t: 'shield', tx: 28, ty: 19 },
      { t: 'wolf', tx: 15, ty: 9 }, { t: 'wolf', tx: 18, ty: 10 }, { t: 'archer', tx: 16, ty: 6 },
    ],
  },
  f2: {
    zone: 'f2',
    rooms: [
      { x: 13, y: 24, w: 7, h: 6, tag: 'landing' },
      { x: 5, y: 15, w: 16, h: 7, tag: 'oil' },
      { x: 22, y: 10, w: 8, h: 13, tag: 'gallery' },
      { x: 10, y: 4, w: 11, h: 9, tag: 'vault' },
    ],
    halls: [
      { x: 16, y: 22, w: 1, h: 2 }, { x: 21, y: 18, w: 1, h: 1 },
      { x: 15, y: 13, w: 1, h: 2 }, { x: 21, y: 11, w: 1, h: 1 },
    ],
    objs: [
      { kind: 'portal', tx: 16, ty: 28, to: 'f1', px: 16 * 32 + 16, py: 7 * 32 + 48, up: true },
      { kind: 'chest', tx: 12, ty: 6, id: 'c_f2_sword', loot: ['cls:beacon'] },
      { kind: 'chest', tx: 27, ty: 21, id: 'c_f2_pot', loot: ['potion_hi', 'potion_hi', 'gold:80'] },
      { kind: 'portal', tx: 19, ty: 6, to: 'f3', px: 16 * 32 + 16, py: 27 * 32 + 16, down: true },
    ],
    spikes: [{ x: 7, y: 17, w: 12, h: 2 }],
    spawns: [
      { t: 'slime', tx: 16, ty: 26 }, { t: 'shield', tx: 9, ty: 19 }, { t: 'archer', tx: 18, ty: 17 },
      { t: 'archer', tx: 25, ty: 13 }, { t: 'archer', tx: 27, ty: 18 }, { t: 'wolf', tx: 24, ty: 20 },
      { t: 'shield', tx: 26, ty: 16 },
      { t: 'wraith', tx: 15, ty: 8, id: 'e_f2_wraith', unique: true },
    ],
  },
  f3: {
    zone: 'f3',
    rooms: [
      { x: 13, y: 24, w: 7, h: 6, tag: 'landing' },
      { x: 6, y: 14, w: 10, h: 9, tag: 'belfry' },
      { x: 9, y: 3, w: 16, h: 10, tag: 'boss' },
    ],
    halls: [
      { x: 16, y: 22, w: 1, h: 2 }, { x: 16, y: 17, w: 1, h: 1 },
    ],
    objs: [
      { kind: 'portal', tx: 16, ty: 28, to: 'f2', px: 19 * 32 + 16, py: 6 * 32 + 48, up: true },
      { kind: 'chest', tx: 8, ty: 16, id: 'c_f3_plate', loot: ['warden_plate', 'key_lantern'] },
      { kind: 'chest', tx: 14, ty: 21, id: 'c_f3_pot', loot: ['potion_hi', 'elixir', 'gold:120'] },
      { kind: 'gate', tx: 16, ty: 13, id: 'g_f3', need: 'key_lantern' },
    ],
    spikes: [{ x: 11, y: 19, w: 4, h: 2 }],
    spawns: [
      { t: 'shield', tx: 16, ty: 26 }, { t: 'archer', tx: 9, ty: 17 }, { t: 'wolf', tx: 12, ty: 20 },
      { t: 'archer', tx: 13, ty: 16 },
      { t: 'keeper', tx: 16, ty: 8, id: 'e_f3_boss', unique: true },
    ],
  },
};

var REGIONS = {
  drift: { id: 'drift', cols: WCOLS, rows: WROWS, kind: 'field' },
  f1: { id: 'f1', cols: 1, rows: 1, kind: 'dungeon', floor: 'f1' },
  f2: { id: 'f2', cols: 1, rows: 1, kind: 'dungeon', floor: 'f2' },
  f3: { id: 'f3', cols: 1, rows: 1, kind: 'dungeon', floor: 'f3' },
};

/* 미니 던전은 랜드마크마다 하나씩 — 지역 객체를 그때 만들어 쓴다 */
var miniCache = {};
function regionOf(id) {
  if (REGIONS[id]) return REGIONS[id];
  if (typeof id !== 'string' || id.indexOf('md:') !== 0) return null;
  if (miniCache[id]) return miniCache[id];
  var p = id.slice(3).split(',');
  var cx = parseInt(p[0], 10), cy = parseInt(p[1], 10);
  if (isNaN(cx) || isNaN(cy)) return null;
  miniCache[id] = { id: id, cols: 1, rows: 1, kind: 'mini', mcx: cx, mcy: cy };
  return miniCache[id];
}

/* ══════════════════════════ 청크 생성 ══════════════════════════ */

function blankChunk(region, cx, cy) {
  return {
    cx: cx, cy: cy, key: region.id + ':' + cx + ',' + cy,
    ox: cx * CPX, oy: cy * CPX,
    tiles: new Uint8Array(CS * CS),
    objs: [], spawns: [], zone: 'harbor', tier: 1, canvas: null,
  };
}

function setRect(ch, x, y, w, h, tile) {
  for (var j = y; j < y + h; j++) {
    if (j < 0 || j >= CS) continue;
    for (var i = x; i < x + w; i++) {
      if (i < 0 || i >= CS) continue;
      ch.tiles[j * CS + i] = tile;
    }
  }
}

/* 티어별 적 마릿수 배율 / 능력치 배율(배틀 쪽에서 참조) */
var TIER_COUNT = [1, 1, 1.15, 1.35, 1.55, 1.75];

/* 지상 청크 — 바이옴 노이즈 + 십자 도로(청크 경계 연결 보장) */
function genField(region, cx, cy, ch) {
  var zone = biomeAt(cx, cy);
  var b = BIOME[zone];
  var tier = tierAt(cx, cy);
  ch.zone = zone; ch.tier = tier;
  var rnd = rngOf(hashStr(region.id + zone) ^ (cx * 73856093) ^ (cy * 19349663) ^ wseed);
  var sW = (wseed ^ 0x2545F491) | 0, sO = (wseed ^ 0x7FEB352D) | 0;

  setRect(ch, 0, 0, CS, CS, b.base);

  var i, j;
  for (j = 0; j < CS; j++) {
    for (i = 0; i < CS; i++) {
      if ((i >= 15 && i <= 17) || (j >= 15 && j <= 17)) {
        ch.tiles[j * CS + i] = zone === 'shoal' ? T.WOOD : T.PATH;
        continue;
      }
      var wx = cx * CS + i, wy = cy * CS + j;
      /* 노이즈로 확률을 국소 변조 — 평균 밀도는 유지하면서 덩어리로 뭉친다 */
      var nw = 2.2 - 2.4 * vnoise(wx * 0.11, wy * 0.11, sW);
      var no = 2.2 - 2.4 * vnoise(wx * 0.17, wy * 0.17, sO);
      if (nw < 0) nw = 0; if (no < 0) no = 0;
      if (b.water && rnd() < b.water * nw) { ch.tiles[j * CS + i] = T.WATER; continue; }
      if (b.voidGap && rnd() < b.voidGap * no) { ch.tiles[j * CS + i] = T.VOID; continue; }
      if (b.obst && rnd() < b.obst * no) { ch.tiles[j * CS + i] = b.obstTile || T.ROCK; continue; }
      if (rnd() < 0.06) ch.tiles[j * CS + i] = b.base === T.GRASS ? T.MOSS : T.STONE;
    }
  }

  if (zone === 'harbor') genHarbor(ch);
  if (zone === 'cape') genCape(ch);

  /* 약초 덤불 */
  var hn = b.herbs || 0;
  for (i = 0; i < hn; i++) {
    var hx = 2 + Math.floor(rnd() * (CS - 4)), hy = 2 + Math.floor(rnd() * (CS - 4));
    if (SOLID[ch.tiles[hy * CS + hx]]) ch.tiles[hy * CS + hx] = b.base;
    ch.objs.push({ kind: 'herb', tx: hx, ty: hy, id: 'h_' + ch.key + '_' + i });
  }

  genLandmark(ch, cx, cy, rnd);

  /* 적 스폰 — 도로/마을에서 떨어진 지점. 티어만큼 수·종류·능력치가 오른다 */
  if (!b.safe) {
    var list = (b.enemies || []).slice();
    if (tier >= 3) list.push(['shield', 2]);
    if (tier >= 4) list.push(['archer', 2]);
    if (tier >= 5 && rnd() < 0.22) list.push(['wraith', 1]);
    var mul = TIER_COUNT[tier] || 1, total = 0;
    list.forEach(function (pair, pi) {
      var n = pair[0] === 'wraith' ? pair[1] : Math.round(pair[1] * mul);
      for (var k = 0; k < n && total < 20; k++) {
        for (var tries = 0; tries < 24; tries++) {
          var sx = 2 + Math.floor(rnd() * (CS - 4)), sy = 2 + Math.floor(rnd() * (CS - 4));
          if (SOLID[ch.tiles[sy * CS + sx]]) continue;
          if (Math.abs(sx - 16) < 4 && Math.abs(sy - 16) < 4) continue;
          ch.spawns.push({
            t: pair[0], tx: sx, ty: sy, tier: tier,
            id: 's_' + ch.key + '_' + pi + '_' + k,
          });
          total++;
          break;
        }
      }
    });
  }
}

/* 랜드마크 — 청크 해시로 결정되는 소규모 명소 */
function genLandmark(ch, cx, cy, rnd) {
  var lm = landmarkAt(cx, cy);
  if (!lm) return;
  var x = lm.tx, y = lm.ty, tier = lm.tier, id = cx + '_' + cy;

  function floorRect(w, h, tile) {
    setRect(ch, x - (w >> 1), y - (h >> 1), w, h, tile);
  }

  if (lm.kind === 'camp') {
    floorRect(7, 7, T.SAND);
    setRect(ch, x - 3, y - 3, 7, 1, T.RUBBLE);
    setRect(ch, x - 3, y + 3, 7, 1, T.RUBBLE);
    ch.tiles[y * CS + x] = T.WOOD;
    ch.objs.push({ kind: 'chest', tx: x, ty: y, id: 'lm_' + id, loot: lootFor(tier, false) });
    ch.objs.push({ kind: 'herb', tx: x - 2, ty: y + 2, id: 'lh_' + id + '_a' });
    ch.objs.push({ kind: 'herb', tx: x + 2, ty: y - 2, id: 'lh_' + id + '_b' });
  } else if (lm.kind === 'wreckage') {
    floorRect(9, 5, T.WOOD);
    setRect(ch, x - 4, y - 2, 1, 5, T.RUBBLE);
    setRect(ch, x + 4, y - 2, 1, 5, T.RUBBLE);
    ch.tiles[y * CS + x] = T.WOOD;
    ch.objs.push({ kind: 'chest', tx: x, ty: y, id: 'lm_' + id, loot: lootFor(tier, true) });
  } else if (lm.kind === 'statue') {
    floorRect(5, 5, T.STONE);
    ch.tiles[y * CS + x] = T.STONE;
    ch.objs.push({ kind: 'statue', tx: x, ty: y, id: 'lm_' + id, tier: tier });
  } else if (lm.kind === 'spring') {
    floorRect(7, 7, T.MOSS);
    setRect(ch, x - 1, y - 1, 3, 3, T.WATER);
    ch.tiles[y * CS + x] = T.MOSS;
    ch.objs.push({ kind: 'spring', tx: x, ty: y });
  } else if (lm.kind === 'merchant') {
    floorRect(5, 5, T.WOOD);
    ch.objs.push({ kind: 'npc', npc: 'wanderer', tx: x, ty: y });
  } else if (lm.kind === 'delve') {
    floorRect(7, 7, T.STONE);
    setRect(ch, x - 2, y - 3, 5, 2, T.WALL);
    ch.tiles[y * CS + x] = T.STONE;
    ch.objs.push({
      kind: 'portal', tx: x, ty: y, to: 'md:' + cx + ',' + cy,
      px: 16 * TILE + 16, py: 27 * TILE + 16, down: true,
    });
  }
  /* 랜드마크 주변은 조금 더 위험하다 */
  if (tier >= 2 && rnd() < 0.6) {
    ch.spawns.push({
      t: tier >= 4 ? 'shield' : 'wolf', tx: x + 3, ty: y + 3, tier: tier,
      id: 'lg_' + ch.key,
    });
  }
}

/* ══════════════════════════ 표착항 ══════════════════════════
 * 손으로 배치한 거점 마을. 야영지 구조로 공간이 읽히게 짰다.
 *
 *   · 울타리(WALL)가 마을을 감싸고 동서남북 4곳만 열려 있다
 *   · 십자 도로가 그 문을 통과해 청크 밖으로 이어진다 (이웃 청크와 연결 보장)
 *   · 가운데 돌 광장, 광장 한복판에 화톳불 — 곁에 있으면 체력·의지가 서서히 찬다
 *   · 각 일꾼이 자기 자리를 갖는다: 여관 / 대장간 / 촌장 집 / 약초 노점 /
 *     치유소 / 용병 대기소, 그리고 광장에 의뢰 게시판과 갈림길 무녀
 *   · 건물 문에서 도로까지 판자길(PATH)이 이어져 동선이 눈에 보인다
 * ────────────────────────────────────────────────────────────────── */
var HARBOR_NPCS = [
  { npc: 'innkeeper', tx: 5, ty: 9 },     // 여관 앞
  { npc: 'chief', tx: 12, ty: 9 },        // 촌장 집 앞
  { npc: 'herbalist', tx: 20, ty: 9 },    // 약초 노점 앞
  { npc: 'smith', tx: 26, ty: 9 },        // 대장간 앞
  { npc: 'healer', tx: 5, ty: 23 },       // 치유소 앞
  { npc: 'captain', tx: 26, ty: 23 },     // 용병 대기소 앞
  { npc: 'steward', tx: 13, ty: 13 },     // 의뢰 게시판 옆
  { npc: 'oracle', tx: 20, ty: 20 },      // 광장 남동
  { npc: 'elder', tx: 18, ty: 13 },       // 화톳불 곁 (오프닝에서 걸어온다)
];

function genHarbor(ch) {
  var i;

  /* 울타리 — 청크 안쪽 테두리, 십자 도로 자리만 비운다 */
  for (i = 1; i <= 30; i++) {
    var gap = (i >= 15 && i <= 17);
    if (!gap) {
      ch.tiles[1 * CS + i] = T.WALL;
      ch.tiles[30 * CS + i] = T.WALL;
      ch.tiles[i * CS + 1] = T.WALL;
      ch.tiles[i * CS + 30] = T.WALL;
    }
  }

  /* 십자 도로 — 청크를 관통해 이웃과 이어진다 */
  setRect(ch, 15, 0, 3, CS, T.PATH);
  setRect(ch, 0, 15, CS, 3, T.PATH);

  /* 중앙 광장 (모서리를 깎아 팔각으로) */
  setRect(ch, 9, 9, 14, 14, T.STONE);
  setRect(ch, 9, 9, 2, 2, T.SAND); setRect(ch, 21, 9, 2, 2, T.SAND);
  setRect(ch, 9, 21, 2, 2, T.SAND); setRect(ch, 21, 21, 2, 2, T.SAND);

  /* 화톳불 자리 — 흙바닥 원 */
  setRect(ch, 14, 14, 5, 5, T.PATH);

  function building(x, y, w, h, doorX, doorY) {
    setRect(ch, x, y, w, h, T.WALL);
    setRect(ch, x + 1, y + 1, w - 2, h - 2, T.CARPET);
    ch.tiles[doorY * CS + doorX] = T.WOOD;
  }
  /** 문에서 광장·도로까지 이어지는 판자길 */
  function walk(x, y0, y1) { setRect(ch, x, y0, 1, y1 - y0 + 1, T.PATH); }

  building(2, 2, 7, 6, 5, 7);        // 여관 (북서)
  building(10, 2, 5, 6, 12, 7);      // 촌장 집 (북중)
  building(18, 2, 5, 6, 20, 7);      // 약초 노점 (북중동)
  building(23, 2, 7, 6, 26, 7);      // 대장간 (북동)
  building(2, 24, 7, 6, 5, 24);      // 치유소 (남서)
  building(23, 24, 7, 6, 26, 24);    // 용병 대기소 (남동)

  walk(5, 8, 14); walk(12, 8, 8); walk(20, 8, 8); walk(26, 8, 14);
  walk(5, 18, 23); walk(26, 18, 23);

  /* 오브젝트 — 각자 자리에 */
  ch.objs.push({ kind: 'bonfire', tx: 16, ty: 16 });
  ch.objs.push({ kind: 'board', tx: 12, ty: 12, id: 'harbor_board' });
  ch.objs.push({ kind: 'well', tx: 11, ty: 19 });
  for (i = 0; i < HARBOR_NPCS.length; i++) {
    ch.objs.push({ kind: 'npc', npc: HARBOR_NPCS[i].npc, tx: HARBOR_NPCS[i].tx, ty: HARBOR_NPCS[i].ty });
  }
  ch.objs.push({ kind: 'chest', tx: 27, ty: 20, id: 'c_harbor', loot: ['potion', 'gold:30'] });
}

/* 등대 곶 — 던전 입구 */
function genCape(ch) {
  setRect(ch, 11, 3, 11, 11, T.STONE);
  setRect(ch, 12, 4, 9, 9, T.WALL);
  setRect(ch, 14, 6, 5, 5, T.CARPET);
  setRect(ch, 15, 13, 3, 3, T.STONE);
  ch.tiles[13 * CS + 16] = T.STONE;
  ch.objs.push({ kind: 'lighthouse', tx: 16, ty: 8 });
  ch.objs.push({ kind: 'portal', tx: 16, ty: 12, to: 'f1', px: 16 * 32 + 16, py: 27 * 32 + 16, down: true, gateQuest: 'm3_signal' });
}

/* 던전 층 — 방 + 복도 카빙 */
function genFloor(region, ch) {
  var F = FLOORS[region.floor];
  ch.zone = F.zone;
  setRect(ch, 0, 0, CS, CS, T.VOID);

  var rnd = rngOf(hashStr(region.id + '#rooms'));
  F.rooms.forEach(function (r) {
    setRect(ch, r.x - 1, r.y - 1, r.w + 2, r.h + 2, T.WALL);
  });
  F.halls.forEach(function (h) {
    setRect(ch, h.x - 1, h.y - 1, h.w + 2, h.h + 2, T.WALL);
  });
  F.rooms.forEach(function (r) { setRect(ch, r.x, r.y, r.w, r.h, T.STONE); });
  F.halls.forEach(function (h) { setRect(ch, h.x, h.y, h.w, h.h, T.STONE); });

  /* 방 사이를 잇는 세로/가로 통로 (방 태그 순서대로 연결) */
  var link = [[0, 1], [1, 2], [1, 3], [1, 4]];
  if (region.floor === 'f2') link = [[0, 1], [1, 2], [2, 3]];
  if (region.floor === 'f3') link = [[0, 1], [1, 2]];
  link.forEach(function (pair) {
    var a = F.rooms[pair[0]], b = F.rooms[pair[1]];
    if (!a || !b) return;
    var ax = a.x + (a.w >> 1), ay = a.y + (a.h >> 1);
    var bx = b.x + (b.w >> 1), by = b.y + (b.h >> 1);
    carve(ch, ax, ay, bx, ay);
    carve(ch, bx, ay, bx, by);
  });

  /* 바닥 얼룩 */
  for (var j = 0; j < CS; j++) {
    for (var i = 0; i < CS; i++) {
      if (ch.tiles[j * CS + i] === T.STONE && rnd() < 0.05) ch.tiles[j * CS + i] = T.MOSS;
    }
  }
  (F.spikes || []).forEach(function (s) {
    for (var y = s.y; y < s.y + s.h; y++) {
      for (var x = s.x; x < s.x + s.w; x++) {
        if (ch.tiles[y * CS + x] === T.STONE || ch.tiles[y * CS + x] === T.MOSS) ch.tiles[y * CS + x] = T.SPIKE;
      }
    }
  });

  F.objs.forEach(function (o) {
    var c = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
    if (c.kind === 'gate') { setRect(ch, c.tx - 1, c.ty, 3, 1, T.GATE); }
    ch.objs.push(c);
  });
  F.spawns.forEach(function (s) { ch.spawns.push(s); });
}

/* 미니 던전 — 랜드마크 좌표 시드로 방 4~6개를 파낸다 */
var MINI_ENTRY = { x: 12, y: 24, w: 8, h: 6 };
var MINI_POOL = [
  ['slime', 'slime', 'wolf'], ['slime', 'wolf', 'archer'],
  ['wolf', 'archer', 'shield'], ['archer', 'shield', 'wolf'], ['shield', 'archer', 'wraith'],
];

function genMini(region, ch) {
  var cx = region.mcx, cy = region.mcy;
  var tier = tierAt(cx, cy);
  ch.zone = 'delve'; ch.tier = tier;
  setRect(ch, 0, 0, CS, CS, T.VOID);

  var rnd = rngOf(hashStr('md#' + cx + ',' + cy) ^ wseed);
  var rooms = [MINI_ENTRY], i, k;
  var want = 3 + Math.floor(rnd() * 3);
  for (i = 0; i < want; i++) {
    for (var tries = 0; tries < 40; tries++) {
      var w = 5 + Math.floor(rnd() * 7), h = 5 + Math.floor(rnd() * 6);
      var x = 2 + Math.floor(rnd() * (CS - 4 - w)), y = 2 + Math.floor(rnd() * (CS - 4 - h));
      var ok = true;
      for (k = 0; k < rooms.length; k++) {
        var r = rooms[k];
        if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
      }
      if (ok) { rooms.push({ x: x, y: y, w: w, h: h }); break; }
    }
  }
  rooms.forEach(function (r) { setRect(ch, r.x - 1, r.y - 1, r.w + 2, r.h + 2, T.WALL); });
  rooms.forEach(function (r) { setRect(ch, r.x, r.y, r.w, r.h, T.STONE); });
  for (i = 1; i < rooms.length; i++) {
    var a = rooms[i - 1], b = rooms[i];
    var ax = a.x + (a.w >> 1), ay = a.y + (a.h >> 1);
    var bx = b.x + (b.w >> 1), by = b.y + (b.h >> 1);
    carve(ch, ax, ay, bx, ay);
    carve(ch, bx, ay, bx, by);
  }
  for (var j = 0; j < CS; j++) {
    for (i = 0; i < CS; i++) {
      if (ch.tiles[j * CS + i] === T.STONE && rnd() < 0.06) ch.tiles[j * CS + i] = T.MOSS;
    }
  }

  var lm = landmarkAt(cx, cy);
  ch.objs.push({
    kind: 'portal', tx: 16, ty: 27, to: 'drift', up: true,
    px: cx * CPX + (lm ? lm.tx : 16) * TILE + 16,
    py: cy * CPX + ((lm ? lm.ty : 16) + 2) * TILE + 16,
  });

  var last = rooms[rooms.length - 1];
  ch.objs.push({
    kind: 'chest', tx: last.x + (last.w >> 1), ty: last.y + (last.h >> 1),
    id: 'md_' + cx + '_' + cy, loot: lootFor(tier, true),
  });

  var pool = MINI_POOL[Math.min(4, tier - 1)];
  for (i = 1; i < rooms.length; i++) {
    var rr = rooms[i], n = 2 + Math.floor(rnd() * 3);
    for (k = 0; k < n; k++) {
      var sx = rr.x + Math.floor(rnd() * rr.w), sy = rr.y + Math.floor(rnd() * rr.h);
      var t = pool[Math.floor(rnd() * pool.length)];
      if (t === 'wraith' && rnd() > 0.25) t = 'shield';
      ch.spawns.push({ t: t, tx: sx, ty: sy, tier: tier, id: 'ms_' + ch.key + '_' + i + '_' + k });
    }
  }
}

/* ══════════════════════════ 청크 페인팅 ══════════════════════════ */

function makeCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas');
  if (!c || !c.getContext) return null;
  c.width = w; c.height = h;
  return c.getContext('2d') ? c : null;
}

function paintChunk(ch) {
  var cv = makeCanvas(CPX, CPX);
  ch.canvas = cv;
  if (!cv) return;
  var g = cv.getContext('2d');
  var rnd = rngOf(hashStr(ch.key + '#paint'));
  for (var j = 0; j < CS; j++) {
    for (var i = 0; i < CS; i++) {
      paintTile(g, ch.tiles[j * CS + i], i * TILE, j * TILE, rnd);
    }
  }
}

function paintTile(g, t, x, y, rnd) {
  g.fillStyle = COLOR[t] || '#101828';
  g.fillRect(x, y, TILE, TILE);
  var k;
  switch (t) {
    case T.GRASS:
    case T.MOSS:
      g.fillStyle = t === T.MOSS ? 'rgba(74,222,128,.14)' : 'rgba(34,197,94,.10)';
      for (k = 0; k < 4; k++) g.fillRect(x + (rnd() * 28) | 0, y + (rnd() * 28) | 0, 3, 2);
      break;
    case T.SAND:
      g.fillStyle = 'rgba(234,179,8,.10)';
      for (k = 0; k < 5; k++) g.fillRect(x + (rnd() * 30) | 0, y + (rnd() * 30) | 0, 2, 2);
      break;
    case T.SNOW:
      g.fillStyle = 'rgba(226,240,255,.16)';
      for (k = 0; k < 5; k++) g.fillRect(x + (rnd() * 29) | 0, y + (rnd() * 29) | 0, 3, 2);
      g.fillStyle = 'rgba(148,187,224,.10)'; g.fillRect(x, y + 24, TILE, 5);
      break;
    case T.DUNE:
      g.fillStyle = 'rgba(234,179,8,.09)';
      g.fillRect(x + 2, y + 8, 26, 3); g.fillRect(x + 6, y + 20, 22, 3);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x + 2, y + 11, 26, 2);
      break;
    case T.ASH:
      g.fillStyle = 'rgba(0,0,0,.32)';
      for (k = 0; k < 5; k++) g.fillRect(x + (rnd() * 27) | 0, y + (rnd() * 27) | 0, 4, 3);
      if (rnd() < 0.22) { g.fillStyle = 'rgba(239,68,68,.16)'; g.fillRect(x + 12, y + 13, 5, 4); }
      break;
    case T.PATH:
      g.fillStyle = 'rgba(0,0,0,.18)';
      for (k = 0; k < 3; k++) g.fillRect(x + (rnd() * 28) | 0, y + (rnd() * 28) | 0, 4, 3);
      break;
    case T.WATER:
      g.fillStyle = 'rgba(14,165,233,.22)';
      g.fillRect(x + 3, y + 8 + ((rnd() * 8) | 0), 26, 2);
      g.fillStyle = 'rgba(125,211,252,.16)';
      g.fillRect(x + 8, y + 20 + ((rnd() * 6) | 0), 16, 2);
      break;
    case T.TREE:
      g.fillStyle = '#0f2418'; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = '#2f6b3d';
      g.beginPath(); g.arc(x + 16, y + 15, 13, 0, 6.2832); g.fill();
      g.fillStyle = '#1f4a2b';
      g.beginPath(); g.arc(x + 12, y + 12, 8, 0, 6.2832); g.fill();
      g.fillStyle = '#3b2c1e'; g.fillRect(x + 14, y + 24, 4, 7);
      break;
    case T.ROCK:
      g.fillStyle = '#3a445e';
      g.beginPath(); g.moveTo(x + 5, y + 27); g.lineTo(x + 11, y + 7); g.lineTo(x + 24, y + 10);
      g.lineTo(x + 28, y + 27); g.closePath(); g.fill();
      g.fillStyle = '#4d5878'; g.fillRect(x + 12, y + 12, 7, 5);
      break;
    case T.RUBBLE:
      g.fillStyle = '#3a4258';
      for (k = 0; k < 5; k++) g.fillRect(x + (rnd() * 24) | 0, y + (rnd() * 24) | 0, 6, 5);
      break;
    case T.WOOD:
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(x, y + 10, TILE, 2); g.fillRect(x, y + 22, TILE, 2);
      g.fillStyle = 'rgba(234,179,8,.06)'; g.fillRect(x + 1, y + 1, TILE - 2, 8);
      break;
    case T.WALL:
      g.fillStyle = '#252f4b';
      g.fillRect(x + 1, y + 1, 14, 14); g.fillRect(x + 17, y + 1, 14, 14);
      g.fillRect(x + 1, y + 17, 14, 14); g.fillRect(x + 17, y + 17, 14, 14);
      break;
    case T.STONE:
      g.fillStyle = 'rgba(255,255,255,.03)';
      g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      if (rnd() < 0.2) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 6, y + 8, 12, 3); }
      break;
    case T.SPIKE:
      g.fillStyle = '#1b2237'; g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      g.fillStyle = '#5b6786';
      for (k = 0; k < 3; k++) {
        g.beginPath(); g.moveTo(x + 6 + k * 9, y + 24); g.lineTo(x + 10 + k * 9, y + 9);
        g.lineTo(x + 14 + k * 9, y + 24); g.closePath(); g.fill();
      }
      break;
    case T.CARPET:
      g.fillStyle = 'rgba(239,68,68,.10)'; g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      break;
    case T.GATE:
      g.fillStyle = '#5c4620'; g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      g.fillStyle = '#8a6a2c'; g.fillRect(x + 3, y + 6, TILE - 6, 4); g.fillRect(x + 3, y + 20, TILE - 6, 4);
      g.fillStyle = '#eab308'; g.fillRect(x + 14, y + 13, 5, 6);
      break;
    case T.VOID:
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, y, TILE, TILE);
      break;
    default: break;
  }
}

function carve(ch, x0, y0, x1, y1) {
  var dx = x1 === x0 ? 0 : (x1 > x0 ? 1 : -1);
  var dy = y1 === y0 ? 0 : (y1 > y0 ? 1 : -1);
  var x = x0, y = y0, guard = 0;
  while (guard++ < 200) {
    for (var oy = -1; oy <= 1; oy++) {
      for (var ox = -1; ox <= 1; ox++) {
        var tx = x + ox, ty = y + oy;
        if (tx < 0 || ty < 0 || tx >= CS || ty >= CS) continue;
        var cur = ch.tiles[ty * CS + tx];
        if (ox === 0 && oy === 0) ch.tiles[ty * CS + tx] = T.STONE;
        else if (cur === T.VOID) ch.tiles[ty * CS + tx] = T.WALL;
      }
    }
    if (x === x1 && y === y1) break;
    if (x !== x1) x += dx; else if (y !== y1) y += dy;
  }
}

/* ══════════════════════════ 런타임 (스트리밍 / 충돌 / 렌더) ══════════════════════════ */

var S = null;                 // 게임 상태 (flags 참조용)
var cur = REGIONS.drift;      // 현재 지역
var loaded = {};              // key → chunk
var pendingLoad = [];         // 이번 프레임에 새로 로드된 청크 (battle 이 스폰을 가져간다)
var pendingUnload = [];       // 언로드된 청크 key
/**
 * 스트리밍 중 한 프레임에 새로 굽는 청크 수 상한.
 * 청크 경계를 넘으면 새로 필요한 3개는 전부 플레이어에게서 1청크 이상 떨어져 있다
 * (직전 3×3 이 이미 새 8방향을 덮고 있다) — 그래서 나눠 구워도 벽에 막히지 않는다.
 */
var LOAD_BUDGET = 2;
/* 플레이어가 선 청크부터 바깥으로 — 예산이 모자라면 뒤쪽이 다음 프레임으로 밀린다 */
var RING = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function chunkKey(cx, cy) { return cur.id + ':' + cx + ',' + cy; }

/** 저장된 진행 상태를 새로 생성된 청크에 반영 (열린 상자 · 열린 문 · 처치한 유니크 · 쓴 랜드마크) */
function applyState(ch) {
  if (!S) return;
  var flags = S.flags || {};
  for (var i = ch.objs.length - 1; i >= 0; i--) {
    var o = ch.objs[i];
    if (o.kind === 'chest' && flags['chest_' + o.id]) o.opened = true;
    if (o.kind === 'statue' && flags['statue_' + o.id]) o.used = true;
    if (o.kind === 'gate' && flags['gate_' + o.id]) {
      o.open = true;
      setRect(ch, o.tx - 1, o.ty, 3, 1, T.STONE);
    }
  }
  ch.spawns = ch.spawns.filter(function (s) { return !(s.unique && flags['slain_' + s.id]); });
}

/** 캐시·페인트 없이 청크 지형만 만든다 (생성 비용 측정 · 내부 로드 공용) */
function buildChunk(cx, cy, region) {
  var r = region || cur;
  var ch = blankChunk(r, cx, cy);
  if (r.kind === 'dungeon') genFloor(r, ch);
  else if (r.kind === 'mini') genMini(r, ch);
  else genField(r, cx, cy, ch);
  return ch;
}

function loadChunk(cx, cy) {
  var key = chunkKey(cx, cy);
  if (loaded[key]) return loaded[key];
  var ch = buildChunk(cx, cy, cur);
  applyState(ch);
  paintChunk(ch);
  loaded[key] = ch;
  pendingLoad.push(ch);
  if (S && cur.kind === 'field') {
    if (!S.seen) S.seen = {};
    S.seen[cx + ',' + cy] = 1;
  }
  return ch;
}

function unloadChunk(key) {
  var ch = loaded[key];
  if (!ch) return;
  ch.canvas = null;
  ch.tiles = null;
  delete loaded[key];
  pendingUnload.push(key);
}

var W = {
  TILE: TILE, CS: CS, CPX: CPX, T: T, SOLID: SOLID,
  WCOLS: WCOLS, WROWS: WROWS, HCX: HCX, HCY: HCY, BIOME: BIOME,
  DEFAULT_SEED: DEFAULT_SEED,
  REGIONS: REGIONS, FLOORS: FLOORS, MAX_LOADED: 9,
  loadBudget: function () { return LOAD_BUDGET; },

  bind: function (state) {
    S = state;
    setSeed(state && state.seed);
  },
  setSeed: setSeed,
  seed: function () { return wseed; },
  newSeed: function () {
    return ((Math.random() * 0xFFFFFFFF) >>> 0) || DEFAULT_SEED;
  },

  biomeAt: biomeAt,
  tierAt: tierAt,
  landmarkAt: landmarkAt,
  buildChunk: buildChunk,

  /** 표착항 앞 광장 — 새 여정의 시작 좌표 */
  spawnPoint: function () {
    return { x: HCX * CPX + 16 * TILE + 16, y: HCY * CPX + 22 * TILE + 16 };
  },
  /** 부활 지점 — 여관 문 앞 판자길 */
  innPoint: function () {
    return { x: HCX * CPX + 5 * TILE + 16, y: HCY * CPX + 10 * TILE + 16 };
  },
  /** 화톳불 — 표착항 광장 한복판 */
  bonfirePx: function () {
    return { x: HCX * CPX + 16 * TILE + 16, y: HCY * CPX + 16 * TILE + 16 };
  },
  capePx: function () {
    return { x: CAPE_CX * CPX + CPX / 2, y: CAPE_CY * CPX + CPX / 2 };
  },
  CAPE_CX: CAPE_CX, CAPE_CY: CAPE_CY,
  harborPx: function () {
    return { x: HCX * CPX + CPX / 2, y: HCY * CPX + CPX / 2 };
  },

  region: function () { return cur; },
  regionId: function () { return cur.id; },
  isDungeon: function () { return cur.kind !== 'field'; },
  isField: function () { return cur.kind === 'field'; },
  width: function () { return cur.cols * CPX; },
  height: function () { return cur.rows * CPX; },

  /** 지역 전환 — 로드된 청크를 모두 비우고 새 지역의 주변 청크를 채운다 */
  enter: function (regionId, px, py) {
    var r = regionOf(regionId);
    if (!r) return false;
    Object.keys(loaded).forEach(unloadChunk);
    cur = r;
    this.stream(px, py, true);
    return true;
  },

  /**
   * 플레이어 주변 반경 1 청크(3×3)만 유지.
   * force 가 아니면 한 번에 굽는 청크를 LOAD_BUDGET 개로 제한한다 —
   * 플레이어가 선 청크는 항상 먼저 굽고, 나머지는 다음 프레임으로 밀린다.
   */
  stream: function (px, py, force) {
    var pcx = Math.floor(px / CPX), pcy = Math.floor(py / CPX);
    var want = {}, budget = force ? RING.length : LOAD_BUDGET;
    for (var i = 0; i < RING.length; i++) {
      var cx = pcx + RING[i][0], cy = pcy + RING[i][1];
      if (cx < 0 || cy < 0 || cx >= cur.cols || cy >= cur.rows) continue;
      var k = chunkKey(cx, cy);
      want[k] = 1;
      if (loaded[k] || budget <= 0) continue;
      budget--;
      loadChunk(cx, cy);
    }
    Object.keys(loaded).forEach(function (key) { if (!want[key]) unloadChunk(key); });
  },

  /** 이번 프레임에 새로 로드된 청크 목록을 가져가고 비운다 */
  takeLoaded: function () { var a = pendingLoad; pendingLoad = []; return a; },
  takeUnloaded: function () { var a = pendingUnload; pendingUnload = []; return a; },
  loadedKeys: function () { return Object.keys(loaded); },
  chunkAtPx: function (x, y) { return loaded[chunkKey(Math.floor(x / CPX), Math.floor(y / CPX))] || null; },

  tileAt: function (x, y) {
    if (x < 0 || y < 0 || x >= cur.cols * CPX || y >= cur.rows * CPX) return T.WALL;
    var ch = loaded[chunkKey(Math.floor(x / CPX), Math.floor(y / CPX))];
    if (!ch || !ch.tiles) return T.WALL;
    var i = Math.floor((x - ch.ox) / TILE), j = Math.floor((y - ch.oy) / TILE);
    return ch.tiles[j * CS + i];
  },

  solidAt: function (x, y) { return !!SOLID[this.tileAt(x, y)]; },

  /** 반지름 r 원을 축 분리 방식으로 이동 (벽에 미끄러진다) */
  move: function (e, dx, dy) {
    var r = e.r || 12, hit = false;
    if (dx) {
      var nx = e.x + dx, sx = nx + (dx > 0 ? r : -r);
      if (this.solidAt(sx, e.y - r * 0.6) || this.solidAt(sx, e.y + r * 0.6)) hit = true;
      else e.x = nx;
    }
    if (dy) {
      var ny = e.y + dy, sy = ny + (dy > 0 ? r : -r);
      if (this.solidAt(e.x - r * 0.6, sy) || this.solidAt(e.x + r * 0.6, sy)) hit = true;
      else e.y = ny;
    }
    e.x = Math.max(r, Math.min(cur.cols * CPX - r, e.x));
    e.y = Math.max(r, Math.min(cur.rows * CPX - r, e.y));
    return hit;
  },

  /** 가시선 — 적 AI 가 벽 너머로 달려들지 않게 한다 */
  clearLine: function (x0, y0, x1, y1) {
    var d = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(d / 20);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  },

  /**
   * 가시 청크의 오브젝트를 모두 순회.
   * ax/ay 가 있으면 타일 자리 대신 그 절대 좌표를 쓴다 — 오프닝에서 장로가
   * 플레이어 쪽으로 걸어오는 것처럼 오브젝트를 움직여야 할 때 사용한다.
   */
  objects: function () {
    var out = [];
    for (var k in loaded) {
      if (!Object.prototype.hasOwnProperty.call(loaded, k)) continue;
      var ch = loaded[k];
      for (var i = 0; i < ch.objs.length; i++) {
        var o = ch.objs[i];
        if (o.ax != null) { o.x = o.ax; o.y = o.ay; }
        else {
          o.x = ch.ox + o.tx * TILE + TILE / 2;
          o.y = ch.oy + o.ty * TILE + TILE / 2;
        }
        o.chunk = k;
        out.push(o);
      }
    }
    return out;
  },

  /** 홈 좌표(타일 자리)의 절대 픽셀 — 걸어간 오브젝트를 되돌릴 때 쓴다 */
  homePx: function (obj) {
    var ch = loaded[obj.chunk];
    if (!ch) return { x: obj.x, y: obj.y };
    return { x: ch.ox + obj.tx * TILE + TILE / 2, y: ch.oy + obj.ty * TILE + TILE / 2 };
  },

  /** 채집물처럼 소모되는 오브젝트 제거 (청크 재로드 시 다시 생성된다) */
  removeObj: function (obj) {
    var ch = loaded[obj.chunk];
    if (!ch) return;
    var i = ch.objs.indexOf(obj);
    if (i >= 0) ch.objs.splice(i, 1);
  },

  /** 잠긴 문 열기 — 타일을 뚫고 플래그를 남긴다 */
  openGate: function (obj) {
    var ch = loaded[obj.chunk];
    if (!ch) return;
    obj.open = true;
    setRect(ch, obj.tx - 1, obj.ty, 3, 1, T.STONE);
    if (S) S.flags['gate_' + obj.id] = true;
    paintChunk(ch);
  },

  zoneKey: function (x, y) {
    if (cur.kind === 'field') return biomeAt(Math.floor(x / CPX), Math.floor(y / CPX));
    if (cur.kind === 'mini') return 'delve';
    return cur.floor || 'harbor';
  },

  /** 현재 위치의 난이도 티어 */
  tierAtPx: function (x, y) {
    if (cur.kind === 'mini') return tierAt(cur.mcx, cur.mcy);
    if (cur.kind !== 'field') return 3;
    return tierAt(Math.floor(x / CPX), Math.floor(y / CPX));
  },

  /** 가시 스파이크는 2.6초 주기로 1초간 튀어나온다 (타일별 위상차) */
  spikeOn: function (x, y, time) {
    var i = Math.floor(x / TILE), j = Math.floor(y / TILE);
    var phase = ((i * 7 + j * 3) % 5) * 0.22;
    return ((time + phase) % 2.6) < 1.0;
  },

  /** 타일 레이어 blit — 카메라에 걸치는 청크만 */
  draw: function (g, cam, vw, vh) {
    for (var k in loaded) {
      if (!Object.prototype.hasOwnProperty.call(loaded, k)) continue;
      var ch = loaded[k];
      if (!ch.canvas) continue;
      if (ch.ox > cam.x + vw || ch.ox + CPX < cam.x || ch.oy > cam.y + vh || ch.oy + CPX < cam.y) continue;
      g.drawImage(ch.canvas, Math.round(ch.ox - cam.x), Math.round(ch.oy - cam.y));
    }
  },

  /** 스파이크 활성 표시 — 타일 위에 덧그린다 */
  drawSpikes: function (g, cam, vw, vh, time) {
    var x0 = Math.floor(cam.x / TILE), y0 = Math.floor(cam.y / TILE);
    var x1 = Math.ceil((cam.x + vw) / TILE), y1 = Math.ceil((cam.y + vh) / TILE);
    for (var j = y0; j <= y1; j++) {
      for (var i = x0; i <= x1; i++) {
        if (this.tileAt(i * TILE + 1, j * TILE + 1) !== T.SPIKE) continue;
        var on = this.spikeOn(i * TILE, j * TILE, time);
        g.fillStyle = on ? 'rgba(239,68,68,.55)' : 'rgba(239,68,68,.10)';
        g.fillRect(i * TILE - cam.x + 3, j * TILE - cam.y + 3, TILE - 6, TILE - 6);
      }
    }
  },

  /**
   * 미니맵 — 방문한 청크만 색이 들어오는 간이 지도 + 표착항 나침반.
   * 대륙이 넓어 길을 잃기 쉬우므로 지상에서 항상 띄운다.
   */
  drawMinimap: function (g, ox, oy, size, px, py) {
    if (cur.kind !== 'field') return;
    var span = 15, cell = size / span, half = (span - 1) / 2;
    var pcx = Math.floor(px / CPX), pcy = Math.floor(py / CPX);
    var seen = (S && S.seen) || {};

    g.fillStyle = 'rgba(8,11,17,.72)';
    g.fillRect(ox - 3, oy - 3, size + 6, size + 20);
    g.strokeStyle = '#2c3550'; g.lineWidth = 1;
    g.strokeRect(ox - 3.5, oy - 3.5, size + 7, size + 21);

    for (var j = 0; j < span; j++) {
      for (var i = 0; i < span; i++) {
        var cx = pcx - half + i, cy = pcy - half + j;
        var x = ox + i * cell, y = oy + j * cell;
        if (!inWorld(cx, cy)) { g.fillStyle = '#070c16'; g.fillRect(x, y, cell, cell); continue; }
        if (!seen[cx + ',' + cy]) { g.fillStyle = '#131a2b'; g.fillRect(x, y, cell, cell); continue; }
        g.fillStyle = (BIOME[biomeAt(cx, cy)] || BIOME.coast).map;
        g.fillRect(x, y, cell, cell);
        var lm = landmarkAt(cx, cy);
        if (lm) {
          g.fillStyle = lm.kind === 'delve' ? '#a855f7' : '#f8fafc';
          g.fillRect(x + cell * 0.38, y + cell * 0.38, cell * 0.26, cell * 0.26);
        }
      }
    }

    /* 현재 청크 강조 */
    g.strokeStyle = 'rgba(226,240,255,.55)'; g.lineWidth = 1;
    g.strokeRect(ox + half * cell + 0.5, oy + half * cell + 0.5, cell - 1, cell - 1);

    /* 플레이어 — 청크 칸이 아니라 청크 안의 실제 위치까지 반영한다 */
    var inx = (px - pcx * CPX) / CPX, iny = (py - pcy * CPX) / CPX;
    var mx = ox + (half + inx) * cell, my = oy + (half + iny) * cell;
    g.fillStyle = '#0c1424';
    g.beginPath(); g.arc(mx, my, Math.max(2.6, cell * 0.24), 0, 6.2832); g.fill();
    g.fillStyle = '#e6ecf2';
    g.beginPath(); g.arc(mx, my, Math.max(1.6, cell * 0.16), 0, 6.2832); g.fill();

    /* 표착항 — 창 안이면 점, 밖이면 가장자리 화살표 */
    var hx = ox + (HCX - pcx + half) * cell + cell / 2;
    var hy = oy + (HCY - pcy + half) * cell + cell / 2;
    g.fillStyle = '#eab308';
    if (HCX >= pcx - half && HCX <= pcx + half && HCY >= pcy - half && HCY <= pcy + half) {
      g.beginPath(); g.arc(hx, hy, Math.max(2, cell * 0.3), 0, 6.2832); g.fill();
    } else {
      var h = this.harborPx();
      var a = Math.atan2(h.y - py, h.x - px);
      var cxp = ox + size / 2, cyp = oy + size / 2, rad = size / 2 - 4;
      g.beginPath();
      g.moveTo(cxp + Math.cos(a) * rad, cyp + Math.sin(a) * rad);
      g.lineTo(cxp + Math.cos(a + 2.5) * (rad - 7), cyp + Math.sin(a + 2.5) * (rad - 7));
      g.lineTo(cxp + Math.cos(a - 2.5) * (rad - 7), cyp + Math.sin(a - 2.5) * (rad - 7));
      g.closePath(); g.fill();
    }

    /* 표착항까지 거리(타일) + 현재 티어 */
    var hp = this.harborPx();
    var dist = Math.round(Math.hypot(hp.x - px, hp.y - py) / TILE);
    g.font = "bold 10px 'Courier New',monospace";
    g.textAlign = 'left';
    g.fillStyle = '#eab308';
    g.fillText('⌂ ' + dist, ox, oy + size + 12);
    g.fillStyle = '#7dd3fc';
    g.textAlign = 'right';
    g.fillText('T' + tierAt(pcx, pcy), ox + size, oy + size + 12);
    g.textAlign = 'left';
  },

  /** 확대 지도가 쓰는 배율 단계 — 청크 span */
  MAP_SPANS: [15, 29, 41],

  /**
   * 확대 지도 — 별도 캔버스에 전체 대륙을 크게 그린다.
   * span 이 대륙보다 넓으면 세계 전체를 가운데 정렬해 담는다.
   * goal 은 이번 챕터 목표 표시({cx,cy} 또는 {tier:n}) — 없으면 생략.
   */
  drawWorldMap: function (g, w, h, px, py, span, goal) {
    var size = Math.min(w, h);
    var ox = (w - size) / 2, oy = (h - size) / 2;
    var cell = size / span;
    var pcx = Math.floor(px / CPX), pcy = Math.floor(py / CPX);
    var seen = (S && S.seen) || {};

    /* 창의 좌상단 청크 — 세계가 창보다 작으면 가운데 정렬, 크면 플레이어 추적 */
    var c0x, c0y;
    if (span >= WCOLS) c0x = Math.floor((WCOLS - span) / 2);
    else c0x = Math.max(0, Math.min(WCOLS - span, pcx - ((span - 1) >> 1)));
    if (span >= WROWS) c0y = Math.floor((WROWS - span) / 2);
    else c0y = Math.max(0, Math.min(WROWS - span, pcy - ((span - 1) >> 1)));

    g.fillStyle = '#080c16';
    g.fillRect(0, 0, w, h);

    var i, j, cx, cy, x, y;
    for (j = 0; j < span; j++) {
      for (i = 0; i < span; i++) {
        cx = c0x + i; cy = c0y + j;
        x = ox + i * cell; y = oy + j * cell;
        if (!inWorld(cx, cy)) { g.fillStyle = '#05080f'; g.fillRect(x, y, cell + 0.5, cell + 0.5); continue; }
        if (!seen[cx + ',' + cy]) { g.fillStyle = '#121a2a'; g.fillRect(x, y, cell + 0.5, cell + 0.5); continue; }
        g.fillStyle = (BIOME[biomeAt(cx, cy)] || BIOME.coast).map;
        g.fillRect(x, y, cell + 0.5, cell + 0.5);
        var lm = landmarkAt(cx, cy);
        if (lm) {
          g.fillStyle = lm.kind === 'delve' ? '#c084fc' : 'rgba(248,250,252,.85)';
          var s = Math.max(2, cell * 0.24);
          g.fillRect(x + (cell - s) / 2, y + (cell - s) / 2, s, s);
        }
      }
    }

    /* 티어 경계 — 목표가 "얼마나 멀리" 인 챕터에서 길잡이가 된다 */
    g.strokeStyle = 'rgba(148,163,184,.20)'; g.lineWidth = 1;
    [2, 5, 9, 13].forEach(function (d) {
      var rx = ox + (HCX - d - c0x) * cell, ry = oy + (HCY - d - c0y) * cell;
      g.strokeRect(rx, ry, (d * 2 + 1) * cell, (d * 2 + 1) * cell);
    });

    function markAt(mcx, mcy, color, glyph, ring) {
      if (mcx < c0x || mcy < c0y || mcx >= c0x + span || mcy >= c0y + span) return;
      var gx = ox + (mcx - c0x + 0.5) * cell, gy = oy + (mcy - c0y + 0.5) * cell;
      if (ring) {
        g.strokeStyle = color; g.lineWidth = 2;
        g.beginPath(); g.arc(gx, gy, Math.max(5, cell * 0.6), 0, 6.2832); g.stroke();
      }
      g.fillStyle = color;
      g.font = 'bold ' + Math.max(9, Math.min(15, cell * 0.8)) + "px 'Courier New',monospace";
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(glyph, gx, gy);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }

    /* 목표 표시 */
    if (goal && goal.tier) {
      var d2 = [0, 2, 5, 9, 13][Math.min(4, goal.tier - 1)] + 1;
      g.strokeStyle = 'rgba(34,197,94,.75)'; g.lineWidth = 2;
      g.strokeRect(ox + (HCX - d2 - c0x) * cell, oy + (HCY - d2 - c0y) * cell,
        (d2 * 2 + 1) * cell, (d2 * 2 + 1) * cell);
    }
    if (goal && goal.cx != null) markAt(goal.cx, goal.cy, '#22c55e', '◎', true);

    markAt(HCX, HCY, '#eab308', '⌂', true);
    markAt(CAPE_CX, CAPE_CY, '#7dd3fc', '☗', true);

    /* 현재 청크 + 청크 안 실제 위치 */
    var pxi = ox + (pcx - c0x) * cell, pyi = oy + (pcy - c0y) * cell;
    g.strokeStyle = 'rgba(226,240,255,.8)'; g.lineWidth = 2;
    g.strokeRect(pxi, pyi, cell, cell);
    var mx = ox + (pcx - c0x + (px - pcx * CPX) / CPX) * cell;
    var my = oy + (pcy - c0y + (py - pcy * CPX) / CPX) * cell;
    g.fillStyle = '#0c1424';
    g.beginPath(); g.arc(mx, my, Math.max(4, cell * 0.3), 0, 6.2832); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(mx, my, Math.max(2.4, cell * 0.19), 0, 6.2832); g.fill();

    g.strokeStyle = '#2c3550'; g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, size - 1, size - 1);
  },
};

DC.World = W;
DC.T = T;
})();
