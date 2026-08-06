'use strict';
(function () {
/**
 * 표류 대륙 — 월드: 타일 / 청크 스트리밍 / 충돌 / 렌더.
 *
 * 스트리밍 구조 (P3 절차 생성 확장의 토대)
 *  - 월드는 region(지역) 단위, region 은 cols×rows 개의 chunk 격자
 *  - chunk 는 CS×CS 타일. 플레이어 주변 반경 1 청크만 메모리에 둔다
 *  - chunk 생성은 (region, cx, cy) 결정적 시드 기반이라 언로드→재로드해도 지형이 같다
 *    (열린 상자·처치한 유니크 등 변화는 state.flags 에 남아 재생성 때 반영)
 *  - 생성 직후 청크 전체를 오프스크린 캔버스에 한 번 굽고, 매 프레임은 blit 만 한다
 */
var DC = window.DC || (window.DC = {});

var TILE = 32;
var CS = 32;                       // 청크당 타일 수
var CPX = CS * TILE;               // 청크 픽셀 크기

var T = {
  GRASS: 0, SAND: 1, WATER: 2, TREE: 3, ROCK: 4, WOOD: 5, WALL: 6,
  STONE: 7, PATH: 8, SPIKE: 9, MOSS: 10, RUBBLE: 11, VOID: 12, CARPET: 13, GATE: 14,
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

/* ══════════════════════════ 지역 정의 ══════════════════════════ */

/* 표류 대륙 지상 — 4×3 청크. 격자 좌표별 바이옴 */
var ZONE_GRID = [
  ['harbor', 'coast', 'marsh', 'cape'],
  ['forest', 'vale', 'ruins', 'cliff'],
  ['slope', 'moss', 'pier', 'wreck'],
];

/* 바이옴 테이블 — base 바닥, obst 장애물 밀도, enemies [종류,마리수] */
var BIOME = {
  harbor: { base: T.SAND, safe: true, obst: 0, enemies: [] },
  coast: { base: T.SAND, obst: 0.05, obstTile: T.ROCK, water: 0.10, enemies: [['slime', 6]] },
  marsh: { base: T.GRASS, obst: 0.04, obstTile: T.TREE, water: 0.17, enemies: [['slime', 5], ['archer', 2]] },
  cape: { base: T.ROCK, obst: 0.05, obstTile: T.RUBBLE, enemies: [['shield', 3], ['archer', 3]] },
  forest: { base: T.GRASS, obst: 0.17, obstTile: T.TREE, enemies: [['slime', 4], ['wolf', 3]], herbs: 3 },
  vale: { base: T.GRASS, obst: 0.09, obstTile: T.ROCK, enemies: [['wolf', 7]] },
  ruins: { base: T.GRASS, obst: 0.12, obstTile: T.RUBBLE, enemies: [['archer', 4], ['shield', 2]] },
  cliff: { base: T.ROCK, obst: 0.05, obstTile: T.ROCK, voidGap: 0.13, enemies: [['archer', 3], ['wolf', 2]] },
  slope: { base: T.GRASS, obst: 0.10, obstTile: T.ROCK, enemies: [['slime', 5]], herbs: 5 },
  moss: { base: T.MOSS, obst: 0.13, obstTile: T.TREE, enemies: [['slime', 4], ['wolf', 2]], herbs: 2 },
  pier: { base: T.WOOD, obst: 0.03, obstTile: T.RUBBLE, water: 0.27, enemies: [['archer', 3], ['slime', 3]] },
  wreck: { base: T.SAND, obst: 0.10, obstTile: T.RUBBLE, enemies: [['shield', 2], ['wolf', 3]] },
};

/* 던전 층 정의 — 방 12개 (F1 5 · F2 4 · F3 3) */
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
      /* 지상 복귀 지점은 등대 곶 청크(cx=3) 안이라 청크 오프셋을 더해야 한다 */
      { kind: 'portal', tx: 16, ty: 28, to: 'drift', px: 3 * 1024 + 16 * 32 + 16, py: 14 * 32 + 16, up: true },
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
      { kind: 'chest', tx: 12, ty: 6, id: 'c_f2_sword', loot: ['beacon_steel'] },
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
  drift: { id: 'drift', cols: 4, rows: 3, kind: 'field' },
  f1: { id: 'f1', cols: 1, rows: 1, kind: 'dungeon', floor: 'f1' },
  f2: { id: 'f2', cols: 1, rows: 1, kind: 'dungeon', floor: 'f2' },
  f3: { id: 'f3', cols: 1, rows: 1, kind: 'dungeon', floor: 'f3' },
};

/* ══════════════════════════ 청크 생성 ══════════════════════════ */

function blankChunk(region, cx, cy) {
  return {
    cx: cx, cy: cy, key: region.id + ':' + cx + ',' + cy,
    ox: cx * CPX, oy: cy * CPX,
    tiles: new Uint8Array(CS * CS),
    objs: [], spawns: [], zone: 'harbor', canvas: null,
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

/* 지상 청크 — 바이옴 노이즈 + 십자 도로(청크 경계 연결 보장) */
function genField(region, cx, cy, ch) {
  var zone = ZONE_GRID[cy][cx];
  var b = BIOME[zone];
  ch.zone = zone;
  var rnd = rngOf(hashStr(region.id + zone) ^ (cx * 73856093) ^ (cy * 19349663));

  setRect(ch, 0, 0, CS, CS, b.base);

  var i, j, t;
  for (j = 0; j < CS; j++) {
    for (i = 0; i < CS; i++) {
      var onRoad = (i >= 15 && i <= 17) || (j >= 15 && j <= 17);
      if (onRoad) { ch.tiles[j * CS + i] = T.PATH; continue; }
      var r = rnd();
      if (b.water && r < b.water) { ch.tiles[j * CS + i] = T.WATER; continue; }
      r = rnd();
      if (b.voidGap && r < b.voidGap) { ch.tiles[j * CS + i] = T.VOID; continue; }
      r = rnd();
      if (b.obst && r < b.obst) { ch.tiles[j * CS + i] = b.obstTile || T.ROCK; continue; }
      r = rnd();
      if (r < 0.06) ch.tiles[j * CS + i] = b.base === T.GRASS ? T.MOSS : T.STONE;
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

  /* 적 스폰 — 도로/마을에서 떨어진 지점 */
  if (!b.safe) {
    (b.enemies || []).forEach(function (pair, pi) {
      for (var k = 0; k < pair[1]; k++) {
        for (var tries = 0; tries < 24; tries++) {
          var sx = 2 + Math.floor(rnd() * (CS - 4)), sy = 2 + Math.floor(rnd() * (CS - 4));
          if (SOLID[ch.tiles[sy * CS + sx]]) continue;
          if (Math.abs(sx - 16) < 4 && Math.abs(sy - 16) < 4) continue;
          ch.spawns.push({ t: pair[0], tx: sx, ty: sy, id: 's_' + ch.key + '_' + pi + '_' + k });
          break;
        }
      }
    });
  }
}

/* 표착항 — 손으로 배치한 거점 마을 */
function genHarbor(ch) {
  setRect(ch, 10, 10, 13, 13, T.WOOD);          // 중앙 광장
  setRect(ch, 15, 0, 3, CS, T.PATH);
  setRect(ch, 0, 15, CS, 3, T.PATH);

  function building(x, y, w, h, doorX, doorY) {
    setRect(ch, x, y, w, h, T.WALL);
    setRect(ch, x + 1, y + 1, w - 2, h - 2, T.CARPET);
    ch.tiles[doorY * CS + doorX] = T.WOOD;
  }
  building(4, 5, 7, 6, 7, 10);      // 여관
  building(20, 5, 7, 6, 23, 10);    // 대장간
  building(3, 20, 6, 5, 6, 20);     // 약초 노점
  building(21, 20, 7, 6, 24, 20);   // 촌장 집

  ch.objs.push({ kind: 'npc', npc: 'innkeeper', tx: 7, ty: 12 });
  ch.objs.push({ kind: 'npc', npc: 'smith', tx: 23, ty: 12 });
  ch.objs.push({ kind: 'npc', npc: 'herbalist', tx: 6, ty: 19 });
  ch.objs.push({ kind: 'npc', npc: 'chief', tx: 24, ty: 19 });
  ch.objs.push({ kind: 'npc', npc: 'elder', tx: 12, ty: 24 });
  ch.objs.push({ kind: 'well', tx: 13, ty: 13 });
  ch.objs.push({ kind: 'chest', tx: 26, ty: 27, id: 'c_harbor', loot: ['potion', 'gold:30'] });
}

/* 등대 곶 — 던전 입구 */
function genCape(ch) {
  setRect(ch, 11, 3, 11, 11, T.STONE);
  setRect(ch, 12, 4, 9, 9, T.WALL);
  setRect(ch, 14, 6, 5, 5, T.CARPET);
  setRect(ch, 15, 13, 3, 3, T.STONE);
  ch.tiles[13 * CS + 16] = T.STONE;
  ch.objs.push({ kind: 'lighthouse', tx: 16, ty: 8 });
  ch.objs.push({ kind: 'portal', tx: 16, ty: 12, to: 'f1', px: 16 * 32 + 16, py: 27 * 32 + 16, down: true, gateQuest: 'main_light' });
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

function chunkKey(cx, cy) { return cur.id + ':' + cx + ',' + cy; }

/** 저장된 진행 상태를 새로 생성된 청크에 반영 (열린 상자 · 열린 문 · 처치한 유니크) */
function applyState(ch) {
  if (!S) return;
  var flags = S.flags || {};
  for (var i = ch.objs.length - 1; i >= 0; i--) {
    var o = ch.objs[i];
    if (o.kind === 'chest' && flags['chest_' + o.id]) o.opened = true;
    if (o.kind === 'gate' && flags['gate_' + o.id]) {
      o.open = true;
      setRect(ch, o.tx - 1, o.ty, 3, 1, T.STONE);
    }
  }
  ch.spawns = ch.spawns.filter(function (s) { return !(s.unique && flags['slain_' + s.id]); });
}

function loadChunk(cx, cy) {
  var key = chunkKey(cx, cy);
  if (loaded[key]) return loaded[key];
  var ch = blankChunk(cur, cx, cy);
  if (cur.kind === 'dungeon') genFloor(cur, ch); else genField(cur, cx, cy, ch);
  applyState(ch);
  paintChunk(ch);
  loaded[key] = ch;
  pendingLoad.push(ch);
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
  ZONE_GRID: ZONE_GRID, REGIONS: REGIONS, FLOORS: FLOORS,

  bind: function (state) { S = state; },
  region: function () { return cur; },
  regionId: function () { return cur.id; },
  isDungeon: function () { return cur.kind === 'dungeon'; },
  width: function () { return cur.cols * CPX; },
  height: function () { return cur.rows * CPX; },

  /** 지역 전환 — 로드된 청크를 모두 비우고 새 지역의 주변 청크를 채운다 */
  enter: function (regionId, px, py) {
    var r = REGIONS[regionId];
    if (!r) return false;
    Object.keys(loaded).forEach(unloadChunk);
    cur = r;
    this.stream(px, py);
    return true;
  },

  /** 플레이어 주변 반경 1 청크만 유지 */
  stream: function (px, py) {
    var pcx = Math.floor(px / CPX), pcy = Math.floor(py / CPX);
    var want = {};
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var cx = pcx + dx, cy = pcy + dy;
        if (cx < 0 || cy < 0 || cx >= cur.cols || cy >= cur.rows) continue;
        want[chunkKey(cx, cy)] = 1;
        loadChunk(cx, cy);
      }
    }
    Object.keys(loaded).forEach(function (k) { if (!want[k]) unloadChunk(k); });
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

  /** 가시 청크의 오브젝트를 모두 순회 */
  objects: function () {
    var out = [];
    for (var k in loaded) {
      if (!Object.prototype.hasOwnProperty.call(loaded, k)) continue;
      var ch = loaded[k];
      for (var i = 0; i < ch.objs.length; i++) {
        var o = ch.objs[i];
        o.x = ch.ox + o.tx * TILE + TILE / 2;
        o.y = ch.oy + o.ty * TILE + TILE / 2;
        o.chunk = k;
        out.push(o);
      }
    }
    return out;
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
    var ch = loaded[chunkKey(Math.floor(x / CPX), Math.floor(y / CPX))];
    return ch ? ch.zone : cur.floor || 'harbor';
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
};

DC.World = W;
DC.T = T;
})();
