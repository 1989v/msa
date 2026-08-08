'use strict';
(function () {
/**
 * 표류 대륙 — 코어: 루프 / 입력 / 카메라 / 세이브 / 진행(챕터·성장·상호작용) / 오프닝.
 *
 * 세이브는 IndexedDB 자동저장(30초 + 주요 이벤트) + 여관 수동 저장 + 파일 내보내기/가져오기.
 * 이어하기 코드(서버 세이브)는 64KB 상한이라 이 게임에는 쓰지 않는다.
 */
var DC = window.DC || (window.DC = {});

window.GameI18n.init(DC.STR);
var TR = window.GameI18n.t;

var W = DC.World, B = DC.Battle;
var cv = document.getElementById('cv');
var g = cv.getContext('2d');
var VW = cv.width, VH = cv.height;

var S = null;              // 게임 상태
var running = false;       // 월드가 굴러가는 중
var paused = false;        // 패널 때문에 멈춘 상태
var time = 0;              // 누적 게임 시간(초)
var autoT = 0;             // 자동저장 타이머
var cam = { x: 0, y: 0 };
var nearObj = null;        // F 로 상호작용 가능한 오브젝트

/* 미니맵 위치 — 렌더와 탭 판정이 같은 값을 쓴다 */
var MM = { size: 128, pad: 12 };
function mmRect() {
  return { x: VW - 140 - 4, y: MM.pad - 4, w: MM.size + 8, h: MM.size + 22 };
}

function $(id) { return document.getElementById(id); }
function fmt(key, vars) { return DC.sub(TR(key), vars); }

/* ══════════════════════════ 세이브 백엔드 ══════════════════════════ */
/* 브라우저는 IndexedDB, 헤드리스(스모크 테스트)는 메모리 — 같은 인터페이스 */
var Store = (function () {
  var DBN = 'drift-continent', SN = 'slots';
  var mem = {};
  var hasIdb = (typeof indexedDB !== 'undefined' && indexedDB);

  function withDb(fn) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DBN, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(SN)) req.result.createObjectStore(SN);
      };
      req.onsuccess = function () { fn(req.result, resolve, reject); };
      req.onerror = function () { reject(req.error); };
    });
  }

  return {
    kind: hasIdb ? 'idb' : 'memory',
    put: function (key, val) {
      if (!hasIdb) { mem[key] = JSON.stringify(val); return Promise.resolve(true); }
      return withDb(function (db, resolve, reject) {
        var tx = db.transaction(SN, 'readwrite');
        tx.objectStore(SN).put(JSON.stringify(val), key);
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    },
    get: function (key) {
      if (!hasIdb) return Promise.resolve(mem[key] ? JSON.parse(mem[key]) : null);
      return withDb(function (db, resolve) {
        var tx = db.transaction(SN, 'readonly');
        var r = tx.objectStore(SN).get(key);
        r.onsuccess = function () {
          db.close();
          try { resolve(r.result ? JSON.parse(r.result) : null); } catch (e) { resolve(null); }
        };
        r.onerror = function () { db.close(); resolve(null); };
      });
    },
  };
})();

/* ══════════════════════════ 상태 ══════════════════════════ */
/* 2 — 시드 기반 대륙 · 3 — 직업/전직/동료/메인 챕터/카운터 · 4 — 웨이포인트 */
var SAVE_V = 4;

function clone(o) {
  var c = {};
  for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
  return c;
}

function newState(cls) {
  cls = DC.CLASSES[cls] ? cls : DC.DEFAULT_CLASS;
  var cd = DC.CLASSES[cls];
  var start = W.spawnPoint();
  var st = {
    v: SAVE_V,
    seed: W.newSeed(),
    p: {
      cls: cls, adv: null,
      lv: 1, xp: 0, sp: 0,
      str: cd.stats.str, agi: cd.stats.agi, vit: cd.stats.vit, wil: cd.stats.wil,
      hp: 1, mp: 1, gold: 20, curse: 0,
      bag: cd.bag.map(clone),
      equip: clone(cd.equip),
      tree: {}, merc: null,
      x: start.x, y: start.y, fx: 0, fy: 1,
    },
    region: 'drift', zone: 'harbor',
    quests: {}, flags: {},
    /* 새긴 웨이포인트 — 표착항만 처음부터 열려 있다 */
    wp: { home: 1 },
    counters: { maxTier: 1, delves: 0, statues: 0, waypoints: 1 },
    kills: 0, deepest: 0, visited: { harbor: 1 }, seen: {},
    play: 0, savedAt: 0,
  };
  DC.QUEST_ORDER.forEach(function (id) { st.quests[id] = { state: 0, prog: 0, done: 0, base: 0 }; });
  var sts = B.stats(st.p);
  st.p.hp = sts.maxHp; st.p.mp = sts.maxMp;
  return st;
}

/**
 * 저장본이 구버전이어도 빠진 필드를 메워 부팅되게 한다.
 *  v1 (4×3 고정 격자) — 시드가 없으므로 기본 대륙을 쓰고 지상 좌표를 표착항 기준으로 평행이동
 *  v2 (시드 대륙, 직업 없음) — 기사로 폴백. 옛 메인 퀘스트 2종을 챕터 3·4 로 이관하고,
 *     이미 마을을 벗어난 진행이므로 오프닝(챕터 1·2)은 완료 처리해 다시 재생되지 않게 한다.
 */
function normalize(st) {
  var base = newState(st && st.p && st.p.cls);
  if (!st || !st.p) return base;

  ['region', 'zone', 'kills', 'deepest', 'play'].forEach(function (k) {
    if (st[k] === undefined) st[k] = base[k];
  });
  st.flags = st.flags || {};
  st.visited = st.visited || {};
  st.seen = st.seen || {};
  st.quests = st.quests || {};

  /* 플레이어 — 직업 계열 필드 폴백 */
  var p = st.p;
  p.cls = DC.CLASSES[p.cls] ? p.cls : DC.DEFAULT_CLASS;
  if (!p.adv || !(DC.ADVANCES[p.adv] && DC.ADVANCES[p.adv].from === p.cls)) p.adv = null;
  if (!p.merc || !DC.MERCS[p.merc.id]) p.merc = null;
  if (p.merc) {
    p.merc.lv = Math.max(1, Math.min(DC.MERC_MAXLV, p.merc.lv || 1));
    if (typeof p.merc.hp !== 'number') p.merc.hp = DC.mercStat(p.merc.id, p.merc.lv).hp;
    p.merc.down = p.merc.down || 0;
  }
  p.curse = p.curse || 0;
  p.bag = p.bag || [];
  p.tree = p.tree || {};
  p.equip = p.equip || clone(DC.CLASSES[p.cls].equip);
  ['str', 'agi', 'vit', 'wil'].forEach(function (k) {
    if (typeof p[k] !== 'number') p[k] = DC.CLASSES[p.cls].stats[k];
  });

  /* 웨이포인트 — v3 이하 세이브는 표착항만 활성인 상태로 시작한다.
     이미 등대에 들어간 세이브라면 곶 비석은 스토리로 열린 것으로 본다 */
  if (!st.wp || typeof st.wp !== 'object') st.wp = { home: 1 };
  st.wp.home = 1;
  if (st.flags.entered_lighthouse) st.wp.cape = 1;

  /* 카운터 */
  st.counters = st.counters || {};
  ['maxTier', 'delves', 'statues'].forEach(function (k) {
    if (typeof st.counters[k] !== 'number') st.counters[k] = base.counters[k];
  });
  st.counters.waypoints = Object.keys(st.wp).length;

  var oldSave = !st.v || st.v < 3;

  /* 옛 메인 퀘스트 2종 → 챕터 3 · 4 로 이관 */
  if (st.quests.main_light && !st.quests.m3_signal) st.quests.m3_signal = st.quests.main_light;
  if (st.quests.main_keeper && !st.quests.m4_keeper) st.quests.m4_keeper = st.quests.main_keeper;
  delete st.quests.main_light;
  delete st.quests.main_keeper;

  DC.QUEST_ORDER.forEach(function (id) {
    var q = st.quests[id];
    if (!q) { st.quests[id] = { state: 0, prog: 0, done: 0, base: 0 }; return; }
    if (typeof q.state !== 'number') q.state = 0;
    if (typeof q.prog !== 'number') q.prog = 0;
    if (typeof q.done !== 'number') q.done = 0;
    if (typeof q.base !== 'number') q.base = 0;
  });

  if (oldSave) {
    /* 이미 마을 밖으로 나간 세이브다 — 오프닝은 끝난 것으로 본다 */
    st.flags.tutorial_done = true;
    st.flags.intro_seen = true;
    st.flags.tut_started = true;
    st.quests.m1_awake.state = 3;
    st.quests.m2_fence.state = 3;
    if (st.flags.entered_lighthouse && st.quests.m3_signal.state === 0) st.quests.m3_signal.state = 3;
    if (st.flags.boss_down) {
      st.quests.m3_signal.state = 3;
      st.quests.m4_keeper.state = Math.max(st.quests.m4_keeper.state, 2);
    }
  }

  if (!st.seed) st.seed = W.DEFAULT_SEED;
  if (!st.v || st.v < 2) {
    if (st.region === 'drift') {
      st.p.x = (st.p.x || 0) + W.HCX * W.CPX;
      st.p.y = (st.p.y || 0) + W.HCY * W.CPX;
    }
  }
  st.v = SAVE_V;

  if (st.region === 'drift') {
    st.p.x = Math.max(24, Math.min(W.WCOLS * W.CPX - 24, st.p.x));
    st.p.y = Math.max(24, Math.min(W.WROWS * W.CPX - 24, st.p.y));
  }
  var sts = B.stats(st.p);
  if (typeof st.p.hp !== 'number' || st.p.hp <= 0) st.p.hp = sts.maxHp;
  if (typeof st.p.mp !== 'number') st.p.mp = sts.maxMp;
  st.p.hp = Math.min(st.p.hp, sts.maxHp);
  st.p.mp = Math.min(st.p.mp, sts.maxMp);
  return st;
}

/* ══════════════════════════ 가방 ══════════════════════════ */
function countItem(id) {
  var n = 0;
  for (var i = 0; i < S.p.bag.length; i++) if (S.p.bag[i] && S.p.bag[i].id === id) n += S.p.bag[i].n;
  return n;
}
function addItem(id, n) {
  var it = DC.ITEMS[id]; if (!it) return false;
  n = n || 1;
  var cap = it.stack || 1, i;
  if (cap > 1) {
    for (i = 0; i < S.p.bag.length; i++) {
      var s = S.p.bag[i];
      if (s && s.id === id && s.n < cap) {
        var room = Math.min(cap - s.n, n);
        s.n += room; n -= room;
        if (n <= 0) return true;
      }
    }
  }
  while (n > 0) {
    if (S.p.bag.length >= 20) return false;
    var take = Math.min(cap, n);
    S.p.bag.push({ id: id, n: take });
    n -= take;
  }
  return true;
}
function removeItem(id, n) {
  n = n || 1;
  for (var i = S.p.bag.length - 1; i >= 0 && n > 0; i--) {
    var s = S.p.bag[i];
    if (!s || s.id !== id) continue;
    var take = Math.min(s.n, n);
    s.n -= take; n -= take;
    if (s.n <= 0) S.p.bag.splice(i, 1);
  }
  return n === 0;
}
/** 보상 토큰 해석 — "gold:120" 은 금화, "cls:beacon" 은 직업별 등대 무기 */
function resolveItem(id) {
  if (id === 'cls:beacon') return DC.classDef(S.p).beacon;
  return id;
}
function giveItem(id, n) {
  id = resolveItem(id);
  if (id.indexOf('gold:') === 0) {
    S.p.gold += parseInt(id.slice(5), 10);
    DC.UI.hint(fmt('hintGot', { n: '🪙' + id.slice(5) }));
    return true;
  }
  if (!addItem(id, n)) { DC.UI.hint(TR('hintFullBag')); return false; }
  DC.UI.hint(fmt('hintGot', { n: DC.ITEMS[id].icon + ' ' + DC.tx(DC.ITEMS[id].n) + (n > 1 ? ' ×' + n : '') }));
  return true;
}

/* ══════════════════════════ 성장 ══════════════════════════ */
/** 레벨업 시 오를 능력치 — 직업(그리고 전직) 성장표를 순환한다 */
function growStat(lv) {
  var a = DC.advOf(S.p);
  var table = (a && a.grow) || DC.classDef(S.p).grow;
  return table[(lv - 2) % table.length];
}

function gainXp(n) {
  var p = S.p;
  p.xp += n;
  var leveled = false;
  while (p.lv < DC.MAX_LEVEL && p.xp >= DC.xpNeed(p.lv)) {
    p.xp -= DC.xpNeed(p.lv);
    p.lv++; p.sp++;
    p[growStat(p.lv)]++;
    if (p.lv % 2 === 0) p.vit++;
    leveled = true;
  }
  if (leveled) {
    var st = B.stats(p);
    p.hp = Math.min(st.maxHp, p.hp + 25);
    p.mp = st.maxMp;
    B.burst(p.x, p.y, 26, '#eab308', 200, 4);
    B.popup(p.x, p.y - 30, 'LEVEL UP', '#eab308', true);
    DC.UI.banner('⬆ Lv ' + p.lv, 1.6);
    DC.UI.hintOnce('lvup', fmt('hintLevel', { n: p.lv }));
    saveNow(false);
  }
}

function learn(id) {
  var p = S.p;
  if (p.sp <= 0 || p.tree[id]) return false;
  var node = DC.treeNode(id);
  if (!node || node.cls !== DC.classOf(p) || p.lv < node.reqLv) return false;
  if (node.tier > 0) {
    var list = DC.treeOf(p), prev = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].line === node.line && list[i].tier === node.tier - 1) prev = list[i];
    }
    if (!prev || !p.tree[prev.id]) return false;
  }
  p.tree[id] = 1; p.sp--;
  B.popup(p.x, p.y - 26, DC.tx(node.n), '#22c55e', true);
  saveNow(false);
  return true;
}

/* ══════════════════════════ 전직 ══════════════════════════ */
function canAdvance() {
  return !S.p.adv && S.p.lv >= DC.ADV_LEVEL && DC.qs(S, DC.ADV_QUEST) === 3;
}
function advance(id) {
  var a = DC.ADVANCES[id];
  if (!a || a.from !== DC.classOf(S.p) || !canAdvance()) return false;
  S.p.adv = id;
  S.p.cd3 = 0;
  var st = B.stats(S.p);
  S.p.hp = st.maxHp; S.p.mp = st.maxMp;
  B.burst(S.p.x, S.p.y, 40, a.color, 250, 5);
  DC.UI.banner(a.icon + ' ' + DC.tx(a.n), 2.6);
  DC.UI.hint(fmt('advTaken', { n: DC.tx(a.n) }), 3.4);
  DC.UI.hintOnce('skillR', TR('hintSkillR'));
  saveNow(false);
  return true;
}

/* ══════════════════════════ 동료 ══════════════════════════ */
function hireMerc(id) {
  var d = DC.MERCS[id];
  if (!d) return false;
  if (S.p.merc) { DC.UI.hint(TR('mercBusy')); return false; }
  if (S.p.gold < d.cost) { DC.UI.hint(TR('goldShort')); return false; }
  S.p.gold -= d.cost;
  S.p.merc = { id: id, lv: 1, hp: DC.mercStat(id, 1).hp, down: 0 };
  B.syncMerc();
  DC.UI.hint(fmt('mercHired', { n: DC.tx(d.n) }), 3);
  saveNow(false);
  return true;
}
function trainMerc() {
  var m = S.p.merc; if (!m) return false;
  if (m.lv >= DC.MERC_MAXLV) { DC.UI.hint(TR('mercMax')); return false; }
  var cost = DC.mercUpCost(m.lv);
  if (S.p.gold < cost) { DC.UI.hint(TR('goldShort')); return false; }
  S.p.gold -= cost;
  m.lv++;
  m.hp = DC.mercStat(m.id, m.lv).hp;
  B.syncMerc();
  DC.UI.hint(fmt('mercUpDone', { n: DC.tx(DC.MERCS[m.id].n) }));
  saveNow(false);
  return true;
}
function reviveMerc() {
  var m = S.p.merc; if (!m) return false;
  if (S.p.gold < DC.MERC_REVIVE_COST) { DC.UI.hint(TR('goldShort')); return false; }
  S.p.gold -= DC.MERC_REVIVE_COST;
  B.reviveMerc();
  DC.UI.hint(fmt('mercBack', { n: DC.tx(DC.MERCS[m.id].n) }));
  saveNow(false);
  return true;
}
function dismissMerc() {
  var m = S.p.merc; if (!m) return false;
  DC.UI.hint(fmt('mercLeft', { n: DC.tx(DC.MERCS[m.id].n) }));
  S.p.merc = null;
  B.syncMerc();
  saveNow(false);
  return true;
}

/* ══════════════════════════ 치유사 ══════════════════════════ */
function healFee() {
  if (DC.qs(S, 'm4_keeper') === 3) return 0;
  return S.p.gold < 10 ? 0 : 10;
}
/** 대화 한 번으로 체력·의지 전회복 + 한기 해제 + 동료 회복 */
function healAt() {
  var fee = healFee();
  if (fee > 0) S.p.gold -= fee;
  var st = B.stats(S.p);
  var had = S.p.curse > 0;
  S.p.curse = 0;
  st = B.stats(S.p);
  S.p.hp = st.maxHp; S.p.mp = st.maxMp;
  B.healMerc();
  B.burst(S.p.x, S.p.y, 22, '#22c55e', 170, 3);
  DC.UI.hint(had ? TR('healClean') : TR('healDone'), 2.6);
  tutMark('town');
  saveNow(false);
  return true;
}

/* ══════════════════════════ 퀘스트 ══════════════════════════ */
function acceptQuest(id) {
  var q = S.quests[id], def = DC.QUESTS[id];
  if (!q || !def || q.state !== 0) return;
  q.state = 1; q.prog = 0;
  if (def.goal.type === 'counter' && def.goal.rel) q.base = S.counters[def.goal.key] || 0;
  var pre = def.kind === 'main' ? fmt('chapterNew', { n: def.ch, t: DC.tx(def.n) }) : DC.tx(def.n);
  DC.UI.hint(fmt('hintQuestNew', { n: pre }), 3.2);
  if (def.kind === 'main') DC.UI.banner('★ ' + fmt('chapterNew', { n: def.ch, t: DC.tx(def.n) }), 2.4);
  checkQuests();
  saveNow(false);
}

function turnInQuest(id) {
  var q = S.quests[id], def = DC.QUESTS[id];
  if (!q || !def || q.state !== 2) return;
  if (def.goal.type === 'collect') removeItem(def.goal.item, def.goal.count);

  S.p.gold += def.reward.gold || 0;
  (def.reward.items || []).forEach(function (it) { addItem(resolveItem(it), 1); });
  gainXp(def.reward.xp || 0);

  if (def.kind === 'repeat') {
    /* 상시 의뢰 — 다시 받을 수 있게 되돌린다 */
    q.state = 0; q.prog = 0; q.done = (q.done || 0) + 1;
    q.base = S.counters[def.goal.key] || 0;
    DC.UI.hint(fmt('hintQuestDone', { n: DC.tx(def.n) }), 3.0);
  } else {
    q.state = 3;
    DC.UI.hint(fmt('hintQuestDone', { n: DC.tx(def.n) }), 3.2);
    if (def.kind === 'main') {
      DC.UI.banner(fmt('chapterEnd', { n: def.ch, t: DC.tx(def.n) }), 2.8);
      B.burst(S.p.x, S.p.y, 30, '#eab308', 210, 4);
      if (def.outro) setTimeout(function () { DC.UI.hint(DC.tx(def.outro), 4.0); }, 900);
      if (id === DC.MAIN_ORDER[DC.MAIN_ORDER.length - 1]) {
        setTimeout(clearGame, 2400);
      }
    } else {
      DC.UI.banner('✅ ' + DC.tx(def.n), 1.8);
    }
  }
  submitScore();
  saveNow(false);
}

/** 목표 달성 여부를 매 프레임 값싸게 확인 */
function checkQuests() {
  DC.QUEST_ORDER.forEach(function (id) {
    var q = S.quests[id];
    if (!q || q.state !== 1) return;
    var goal = DC.QUESTS[id].goal, ok = false;
    if (goal.type === 'flag') ok = !!S.flags[goal.flag];
    else if (goal.type === 'kill' || goal.type === 'killAny') ok = (q.prog || 0) >= goal.count;
    else if (goal.type === 'collect') ok = countItem(goal.item) >= goal.count;
    else if (goal.type === 'tier') ok = (S.counters.maxTier || 1) >= goal.tier;
    else if (goal.type === 'counter') {
      var cur = S.counters[goal.key] || 0;
      ok = (goal.rel ? cur - (q.base || 0) : cur) >= goal.count;
    }
    if (ok) {
      q.state = 2;
      DC.UI.hint('📜 ' + DC.tx(DC.QUESTS[id].n) + ' — ' + TR('qReady'), 3.0);
    }
  });
}

function questsDone() {
  var n = 0;
  DC.QUEST_ORDER.forEach(function (id) {
    var q = S.quests[id];
    if (!q) return;
    if (q.state === 3) n++;
    n += q.done || 0;
  });
  return n;
}

/* ══════════════════════════ 오프닝 · 튜토리얼 ══════════════════════════
 * 장로가 플레이어에게 걸어와 대화를 열고, 그 대화가 1챕터의 시작점이 된다.
 * 튜토리얼은 모달이 아니다 — 게임은 계속 굴러가고, 각 단계는 플레이어가
 * 실제로 그 조작을 해내야 다음으로 넘어간다.
 * ────────────────────────────────────────────────────────────────── */
var intro = null;          // { phase: 'approach'|'return', obj, home }
var tut = null;            // { i, moved }

function findHarborNpc(id) {
  var objs = W.objects();
  for (var i = 0; i < objs.length; i++) {
    if (objs[i].kind === 'npc' && objs[i].npc === id) return objs[i];
  }
  return null;
}

function maybeStartIntro() {
  if (S.flags.intro_seen || S.flags.tutorial_done) return;
  var obj = findHarborNpc('elder');
  if (!obj) return;
  S.flags.intro_seen = true;
  obj.ax = obj.x; obj.ay = obj.y;
  intro = { phase: 'approach', obj: obj, home: { x: obj.x, y: obj.y } };
  DC.UI.step(TR('tutStart'));
}

function stepIntro(dt) {
  if (!intro) return;
  var o = intro.obj, p = S.p;
  if (intro.phase === 'approach') {
    var dx = p.x - o.ax, dy = p.y - o.ay, d = Math.hypot(dx, dy);
    /* 플레이어가 마을을 벗어나면 쫓아가지 않는다 — 자리로 돌아가고 대화는 F 로 시작한다 */
    if (d > 620 || !W.isField() || W.zoneKey(p.x, p.y) !== 'harbor') {
      intro.phase = 'return';
      return;
    }
    if (d > 40) {
      var v = Math.min(150, 90 + d * 0.25) * dt;
      o.ax += (dx / d) * v; o.ay += (dy / d) * v;
      return;
    }
    intro.phase = 'return';
    paused = true;
    if (!DC.UI.openDialog('elder')) paused = false;
    return;
  }
  /* 대화 뒤 자기 자리로 돌아간다 */
  var hx = intro.home.x - o.ax, hy = intro.home.y - o.ay, hd = Math.hypot(hx, hy);
  if (hd < 6) { o.ax = null; o.ay = null; intro = null; return; }
  var vv = 110 * dt;
  o.ax += (hx / hd) * Math.min(vv, hd);
  o.ay += (hy / hd) * Math.min(vv, hd);
}

function startTutorial() {
  S.flags.tut_started = true;
  acceptQuest('m1_awake');
  tut = { i: 0, moved: 0 };
  showTutStep();
  saveNow(false);
}
function skipTutorial() {
  S.flags.tut_started = true;
  acceptQuest('m1_awake');
  tut = null;
  S.flags.tutorial_done = true;
  DC.UI.step('');
  DC.UI.hint(TR('tutSkipped'), 2.4);
  checkQuests();
  saveNow(false);
}
function showTutStep() {
  if (!tut) { DC.UI.step(''); return; }
  var s = DC.TUTORIAL[tut.i];
  if (!s) { DC.UI.step(''); return; }
  DC.UI.step(TR(s.hint));
  DC.UI.hint(TR(s.hint), 3.0);
}
/** 튜토리얼 단계 완료 신호 — 지금 요구하는 단계와 같을 때만 넘어간다 */
function tutMark(id) {
  if (!tut) return;
  var s = DC.TUTORIAL[tut.i];
  if (!s || s.id !== id) return;
  tut.i++;
  B.burst(S.p.x, S.p.y, 10, '#22c55e', 130, 3);
  if (tut.i >= DC.TUTORIAL.length) {
    tut = null;
    S.flags.tutorial_done = true;
    DC.UI.step(TR('tutDone'));
    DC.UI.banner('✔ ' + TR('tutDone'), 2.4);
    checkQuests();
    saveNow(false);
    return;
  }
  showTutStep();
}

function tutTick(dt) {
  if (!tut) return;
  var s = DC.TUTORIAL[tut.i];
  if (!s) return;
  if (s.id === 'move') {
    var sp = Math.hypot(S.p.x - (tut.lx == null ? S.p.x : tut.lx), S.p.y - (tut.ly == null ? S.p.y : tut.ly));
    tut.moved += sp;
    tut.lx = S.p.x; tut.ly = S.p.y;
    if (tut.moved > 130) tutMark('move');
  }
}

/* ══════════════════════════ 점수 ══════════════════════════ */
function score() {
  var visited = Object.keys(S.visited).length;
  return Math.round(
    S.p.lv * 60 + DC.chaptersDone(S) * 320 + questsDone() * 90 + S.kills * 4 +
    S.deepest * 150 + visited * 40 + (S.counters.maxTier || 1) * 120 +
    (S.flags.boss_down ? 600 : 0)
  );
}
function scoreDetail() {
  return 'Lv' + S.p.lv + ' · C' + DC.chaptersDone(S) + ' · K' + S.kills;
}
var lastSubmit = 0;
function submitScore() {
  if (!window.GameRank) return;
  var s = score();
  if (s <= lastSubmit) return;
  lastSubmit = s;
  GameRank.submit('drift-continent', s, scoreDetail());
}

/* ══════════════════════════ 저장 / 불러오기 ══════════════════════════ */
function saveNow(manual) {
  if (!S) return Promise.resolve(false);
  S.savedAt = Date.now();
  autoT = 0;
  return Store.put('auto', S).then(function () {
    if (manual) { DC.UI.hint(TR('hintSave')); submitScore(); }
    return true;
  }).catch(function () { return false; });
}

function loadGame() {
  return Store.get('auto').then(function (data) {
    if (!data) { DC.UI.hint(TR('noSave')); return false; }
    beginWith(normalize(data));
    DC.UI.banner(TR('loadedSave'), 1.8);
    return true;
  });
}

function exportFile() {
  if (!S) return;
  try {
    var blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'drift-continent-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    DC.UI.hint(TR('exported'));
  } catch (e) { DC.UI.hint(TR('importFail')); }
}

function importFile(file) {
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var data = JSON.parse(fr.result);
      if (!data || !data.p) throw new Error('bad save');
      beginWith(normalize(data));
      saveNow(false);
      DC.UI.banner(TR('imported'), 1.8);
    } catch (e) { DC.UI.hint(TR('importFail'), 3); }
  };
  fr.readAsText(file);
}

/* ══════════════════════════ 시작 / 종료 ══════════════════════════ */
function beginWith(state) {
  S = state;
  W.bind(S); B.bind(S); DC.UI.bind(S);
  B.clearAll();
  B.attach(S.p);
  W.enter(S.region, S.p.x, S.p.y);
  W.takeLoaded().forEach(B.spawnChunk);
  W.takeUnloaded();
  S.zone = W.zoneKey(S.p.x, S.p.y);
  lastSubmit = 0;
  running = true; paused = false;
  intro = null; tut = null;
  DC.UI.closeAll();
  DC.UI.step('');
  ['menu', 'endPanel'].forEach(function (id) { var el = $(id); if (el) el.hidden = true; });
  var h = $('hud'); if (h) h.hidden = false;
  var sk = $('skills'); if (sk) sk.hidden = false;
  snapCam();
  refreshObjs();
  DC.UI.hud();
  DC.UI.hintOnce('move', TR('hintMove'));
  maybeStartIntro();
}

function newGame(cls) { beginWith(newState(cls || (DC.UI.selectedClass && DC.UI.selectedClass()))); }

function toMenu() {
  running = false; paused = false;
  DC.UI.closeAll();
  DC.UI.step('');
  var h = $('hud'); if (h) h.hidden = true;
  var sk = $('skills'); if (sk) sk.hidden = true;
  var e = $('endPanel'); if (e) e.hidden = true;
  var m = $('menu'); if (m) m.hidden = false;
  var bb = $('bossBar'); if (bb) bb.hidden = true;
}

function endPanel(titleKey, descKey) {
  running = false;
  DC.UI.closeAll();
  var p = $('endPanel'); if (!p) return;
  p.hidden = false;
  set('endTitle', TR(titleKey));
  set('endDesc', TR(descKey) + '\n' +
    fmt('resultLine', {
      lv: S.p.lv, c: DC.chaptersDone(S), ct: DC.MAIN_COUNT,
      q: questsDone(), k: S.kills, s: score(),
    }));
  var again = $('againBtn');
  if (again) again.textContent = TR('againBtn');
}
function set(id, v) { var el = $(id); if (el) el.textContent = v; }

function onDeath() {
  submitScore();
  S.p.gold = Math.floor(S.p.gold / 2);
  saveNow(false);
  endPanel('deathTitle', 'deathDesc');
}

function respawn() {
  var st = B.stats(S.p);
  var inn = W.innPoint();
  S.p.hp = st.maxHp; S.p.mp = st.maxMp; S.p.curse = 0;
  S.region = 'drift'; S.p.x = inn.x; S.p.y = inn.y;
  B.clearAll(); B.attach(S.p);
  W.enter('drift', S.p.x, S.p.y);
  W.takeLoaded().forEach(B.spawnChunk); W.takeUnloaded();
  S.zone = 'harbor';
  running = true; paused = false;
  var e = $('endPanel'); if (e) e.hidden = true;
  var h = $('hud'); if (h) h.hidden = false;
  snapCam(); DC.UI.hud();
}

function clearGame() {
  submitScore();
  saveNow(false);
  endPanel('clearTitle', 'clearDesc');
}

/* ══════════════════════════ 여관 · 상거래 ══════════════════════════ */
function rest() {
  var free = DC.qs(S, 'm4_keeper') === 3;
  if (!free) {
    if (S.p.gold < 30) { DC.UI.hint(TR('goldShort')); return; }
    S.p.gold -= 30;
  }
  S.p.curse = 0;
  var st = B.stats(S.p);
  S.p.hp = st.maxHp; S.p.mp = st.maxMp;
  B.healMerc();
  DC.UI.closeAll();
  paused = false;
  DC.UI.banner('🛏️ ' + TR('restDone'), 2.0);
  tutMark('town');
  submitScore();
  saveNow(true);
}

function buy(id) {
  var it = DC.ITEMS[id];
  if (!it || S.p.gold < it.price) { DC.UI.hint(TR('goldShort')); return false; }
  if (it.cls && it.cls !== DC.classOf(S.p)) { DC.UI.hint(TR('wrongClass')); return false; }
  if (!addItem(id, 1)) { DC.UI.hint(TR('invFull')); return false; }
  S.p.gold -= it.price;
  DC.UI.hint(TR('bought') + ' — ' + it.icon + ' ' + DC.tx(it.n));
  tutMark('town');
  saveNow(false);
  return true;
}

function sell(slot) {
  var s = S.p.bag[slot]; if (!s) return false;
  var it = DC.ITEMS[s.id];
  if (!it || it.quest || it.price <= 0) return false;
  S.p.gold += Math.max(1, Math.floor(it.price * 0.4));
  s.n--; if (s.n <= 0) S.p.bag.splice(slot, 1);
  DC.UI.hint(TR('sold'));
  return true;
}

function equip(slot) {
  var s = S.p.bag[slot]; if (!s) return false;
  var it = DC.ITEMS[s.id];
  if (!it || (it.slot !== 'weapon' && it.slot !== 'armor' && it.slot !== 'trinket')) return false;
  if (it.cls && it.cls !== DC.classOf(S.p)) { DC.UI.hint(TR('wrongClass')); return false; }
  var old = S.p.equip[it.slot];
  S.p.equip[it.slot] = s.id;
  S.p.bag.splice(slot, 1);
  if (old) addItem(old, 1);
  DC.UI.hint(TR('equipped') + ' — ' + it.icon + ' ' + DC.tx(it.n));
  var st = B.stats(S.p);
  S.p.hp = Math.min(S.p.hp, st.maxHp);
  saveNow(false);
  return true;
}

function useItem(slot) {
  var s = S.p.bag[slot]; if (!s) return false;
  var it = DC.ITEMS[s.id];
  if (!it || it.slot !== 'use') return false;
  /* 귀환 부적 — 이동에 실패하면 소모하지 않는다 */
  if (it.warpHome) {
    if (!warpHome()) return false;
    s.n--; if (s.n <= 0) S.p.bag.splice(slot, 1);
    return true;
  }
  var st = B.stats(S.p);
  if (it.cleanse && S.p.curse > 0) {
    S.p.curse = 0;
    DC.UI.hint(TR('healClean'), 2.2);
    st = B.stats(S.p);
  }
  if (it.heal) { S.p.hp = Math.min(st.maxHp, S.p.hp + it.heal); B.popup(S.p.x, S.p.y - 26, '+' + it.heal, '#22c55e'); }
  if (it.mana) { S.p.mp = Math.min(st.maxMp, S.p.mp + it.mana); B.popup(S.p.x, S.p.y - 26, '+' + it.mana, '#7dd3fc'); }
  s.n--; if (s.n <= 0) S.p.bag.splice(slot, 1);
  return true;
}

/** 단축키(1/2)로 회복약 즉시 사용 */
function quickUse(kind) {
  var want = kind === 'hp' ? ['potion_hi', 'potion', 'salve'] : ['elixir'];
  for (var w = 0; w < want.length; w++) {
    for (var i = 0; i < S.p.bag.length; i++) {
      if (S.p.bag[i].id === want[w]) { useItem(i); return; }
    }
  }
}

/* ══════════════════════════ 지역 이동 ══════════════════════════ */
var FLOOR_NO = { f1: 1, f2: 2, f3: 3 };

function enterRegion(to, px, py) {
  B.clearAll();
  S.region = to; S.p.x = px; S.p.y = py;
  W.enter(to, px, py);
  W.takeLoaded().forEach(B.spawnChunk);
  W.takeUnloaded();
  B.attach(S.p);
  S.zone = W.zoneKey(px, py);
  S.visited[S.zone] = 1;
  if (to === 'f1') {
    S.flags.entered_lighthouse = true;
    openWaypoint('cape', true);    // 3장 진행으로 곶 비석이 열린다
  }
  if (FLOOR_NO[to]) S.deepest = Math.max(S.deepest, FLOOR_NO[to]);
  DC.UI.banner(fmt('zoneEnter', { n: DC.tx(DC.ZONES[S.zone] || {}) }), 2.0);
  snapCam();
  saveNow(false);
}

/* ══════════════════════════ 웨이포인트 ══════════════════════════
 * 비용·제약 (탐험을 지우지 않으려는 최소 장치)
 *  1. 출발은 비석 앞에서만 — 아무 데서나 튀지 못하니 "처음 가는 길"은 늘 두 발로 간다
 *  2. 적이 가까이 있으면 불가 — 전투 도주 악용 차단 (귀환 부적도 같은 규칙을 탄다)
 *  3. 금화 소액, 거리 비례 — 여관 숙박(30) 언저리라 부담은 아니되 공짜도 아니다
 * 쿨다운은 넣지 않았다. 1·2 로 이미 남용 경로가 막혀 있어 HUD 만 복잡해진다.
 * ────────────────────────────────────────────────────────────────── */
var WARP_SAFE_R = 200;             // 이 반경 안에 적이 있으면 떠날 수 없다
var WARP_BASE = 6, WARP_PER_CHUNK = 2;

function wpName(wid) { return DC.wpName(W.waypointOf(wid)); }

/**
 * 새 비석 등록 — 발견 연출 + 소액 경험치. 이미 있으면 false.
 * noBanner 는 스토리로 저절로 열리는 경우용 — 지역 진입 배너를 덮지 않게 한다.
 */
function openWaypoint(wid, noBanner) {
  if (!S.wp) S.wp = { home: 1 };
  if (S.wp[wid]) return false;
  var w = W.waypointOf(wid);
  if (!w) return false;
  S.wp[wid] = 1;
  S.counters.waypoints = Object.keys(S.wp).length;
  var name = DC.wpName(w);
  if (!noBanner) {
    B.burst(S.p.x, S.p.y, 24, '#38bdf8', 200, 4);
    DC.UI.banner('🚩 ' + name, 2.4);
  }
  DC.UI.hint(fmt('wpFound', { n: name, c: S.counters.waypoints }), 3.4);
  gainXp(20 * (w.tier || 1));
  submitScore();
  saveNow(false);
  return true;
}

/** 지금 서 있는 비석의 id (없으면 null) — 출발 가능 여부의 근거 */
function atWaypoint() {
  for (var i = 0; i < objsCache.length; i++) {
    var o = objsCache[i];
    if (o.kind !== 'waypoint' || !(S.wp && S.wp[o.wid])) continue;
    if (Math.hypot(o.x - S.p.x, o.y - S.p.y) < 56) return o.wid;
  }
  return null;
}

/** 이동을 막는 사유 키 (없으면 null) */
function warpBlock(needStone) {
  if (B.boss()) return 'warpFoe';
  if (B.nearest(S.p.x, S.p.y, WARP_SAFE_R)) return 'warpFoe';
  if (needStone && !atWaypoint()) return 'warpNeedStone';
  return null;
}

/** 뱃삯 — 현재 청크에서 목적지까지의 체비셰프 청크 거리에 비례 */
function warpCost(wid) {
  var w = W.waypointOf(wid);
  if (!w) return 0;
  return WARP_BASE + WARP_PER_CHUNK * warpDist(wid);
}
function warpDist(wid) {
  var w = W.waypointOf(wid);
  if (!w) return 0;
  var pcx = Math.floor(S.p.x / W.CPX), pcy = Math.floor(S.p.y / W.CPX);
  if (!W.isField()) { pcx = W.HCX; pcy = W.HCY; }
  return Math.max(Math.abs(w.cx - pcx), Math.abs(w.cy - pcy));
}

/** 활성 비석 목록 — 현재 위치 기준 거리순 */
function waypointList() {
  var out = [];
  Object.keys(S.wp || {}).forEach(function (wid) {
    var w = W.waypointOf(wid);
    if (!w) return;
    out.push({
      wid: wid, cx: w.cx, cy: w.cy, tier: w.tier,
      name: DC.wpName(w), dist: warpDist(wid), cost: warpCost(wid),
      here: W.isField() && atWaypoint() === wid,
    });
  });
  out.sort(function (a, b) { return a.dist - b.dist; });
  return out;
}

/** 비석 → 비석 이동. free 는 귀환 부적처럼 뱃삯 없이 움직이는 경로 */
function warpTo(wid, free) {
  if (!S.wp || !S.wp[wid]) return false;
  var reason = warpBlock(!free);
  if (reason) { DC.UI.hint(TR(reason), 2.8); return false; }
  var px = W.waypointPx(wid);
  if (!px) return false;
  var cost = free ? 0 : warpCost(wid);
  if (S.p.gold < cost) { DC.UI.hint(TR('warpPoor'), 2.6); return false; }
  S.p.gold -= cost;
  B.burst(S.p.x, S.p.y, 28, '#38bdf8', 220, 4);
  DC.UI.closeAll();
  paused = false;
  enterRegion('drift', px.x, px.y);
  B.burst(px.x, px.y, 22, '#7dd3fc', 190, 3);
  DC.UI.banner('🚩 ' + wpName(wid), 2.2);
  DC.UI.hint(fmt('warpDone', { n: wpName(wid) }), 2.6);
  return true;
}

/** 귀환 부적 — 어디서든(던전 안에서도) 표착항으로. 적 근처 제약은 동일하다 */
function warpHome() {
  var reason = warpBlock(false);
  if (reason) { DC.UI.hint(TR(reason), 2.8); return false; }
  if (!warpTo('home', true)) return false;
  DC.UI.hint(TR('charmHome'), 2.6);
  return true;
}

/* ══════════════════════════ 상호작용 ══════════════════════════ */
function labelFor(o) {
  if (o.kind === 'npc') return DC.tx(DC.NPCS[o.npc].n);
  if (o.kind === 'chest') return o.opened ? null : TR('hintChest');
  if (o.kind === 'herb') return TR('hintHerb');
  if (o.kind === 'statue') return o.used ? null : TR('hintStatue');
  if (o.kind === 'spring') return TR('hintSpring');
  if (o.kind === 'bonfire') return TR('hintBonfire');
  if (o.kind === 'board') return TR('hintBoard');
  if (o.kind === 'waypoint') {
    return (S.wp && S.wp[o.wid]) ? TR('hintWaypointUse') : TR('hintWaypointNew');
  }
  if (o.kind === 'gate') return o.open ? null : TR('hintLocked');
  if (o.kind === 'portal') return o.up ? (o.to === 'drift' ? TR('hintExit') : TR('hintStairsUp')) : TR('hintStairsDown');
  return null;
}

function findNear() {
  var objs = objsCache, best = null, bd = 46;
  for (var i = 0; i < objs.length; i++) {
    var o = objs[i];
    if (!labelFor(o)) continue;
    var d = Math.hypot(o.x - S.p.x, o.y - S.p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function interact() {
  var o = nearObj;
  if (!o) return;
  tutMark('interact');
  if (o.kind === 'npc') { paused = true; if (!DC.UI.openDialog(o.npc)) paused = false; return; }
  if (o.kind === 'board') { paused = true; DC.UI.openBoard(); return; }
  if (o.kind === 'bonfire') {
    var stb = B.stats(S.p);
    S.p.hp = stb.maxHp; S.p.mp = stb.maxMp;
    B.burst(o.x, o.y - 6, 20, '#f97316', 160, 3);
    DC.UI.hint(TR('hintBonfireOn'), 2.6);
    saveNow(true);
    return;
  }
  if (o.kind === 'chest') {
    o.opened = true;
    S.flags['chest_' + o.id] = true;
    if (String(o.id).indexOf('md_') === 0) S.counters.delves = (S.counters.delves || 0) + 1;
    (o.loot || []).forEach(function (l) { giveItem(l, 1); });
    B.burst(o.x, o.y, 14, '#eab308', 150, 3);
    saveNow(false);
    return;
  }
  if (o.kind === 'herb') {
    if (giveItem('herb', 1)) W.removeObj(o);
    return;
  }
  /* 석상 — 대륙 깊숙이 갈수록 큰 경험치를 한 번만 준다 */
  if (o.kind === 'statue') {
    if (o.used) return;
    o.used = true;
    S.flags['statue_' + o.id] = true;
    S.counters.statues = (S.counters.statues || 0) + 1;
    gainXp(60 * (o.tier || 1));
    B.burst(o.x, o.y, 20, '#a78bfa', 170, 3);
    DC.UI.hint(TR('hintStatueRead'), 3);
    saveNow(false);
    return;
  }
  /* 맑은 샘 — 원정 중 보급점. 소모되지 않는다 */
  if (o.kind === 'spring') {
    var stt = B.stats(S.p);
    S.p.hp = stt.maxHp; S.p.mp = stt.maxMp;
    B.burst(o.x, o.y, 18, '#7dd3fc', 150, 3);
    DC.UI.hint(TR('hintSpringDrink'), 2.4);
    return;
  }
  /* 웨이포인트 — 처음이면 새기고, 이미 새겼으면 길 목록을 연다 */
  if (o.kind === 'waypoint') {
    if (!(S.wp && S.wp[o.wid])) { o.lit = true; openWaypoint(o.wid); return; }
    paused = true;
    DC.UI.openWarp();
    return;
  }
  if (o.kind === 'gate') {
    if (countItem(o.need)) {
      removeItem(o.need, 1);
      W.openGate(o);
      DC.UI.hint(TR('hintUnlocked'));
      B.burst(o.x, o.y, 16, '#eab308', 160, 3);
      saveNow(false);
    } else DC.UI.hint(TR('hintLocked'));
    return;
  }
  if (o.kind === 'portal') {
    if (o.gateQuest && DC.qs(S, o.gateQuest) === 0) { DC.UI.hint(TR('hintNeedQuest'), 3); return; }
    enterRegion(o.to, o.px, o.py);
  }
}

/* ══════════════════════════ 입력 ══════════════════════════ */
var keys = {}, edge = {};
var IN = { ax: 0, ay: 0, attackEdge: false, dashEdge: false, s1Edge: false, s2Edge: false, s3Edge: false };

var PANEL_KEYS = { KeyI: 'openInv', KeyT: 'openTree', KeyL: 'openQuests', KeyM: 'openMap' };
var CLOSE_KEYS = { Escape: 1, KeyI: 1, KeyT: 1, KeyL: 1, KeyM: 1 };

window.addEventListener('keydown', function (ev) {
  var c = ev.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(c) >= 0) ev.preventDefault();
  if (!keys[c]) edge[c] = true;
  keys[c] = true;

  if (!running) return;

  if (DC.UI.isOpen()) {
    if (DC.UI.openPanel() === 'panelMap') {
      if (c === 'Equal' || c === 'NumpadAdd') { DC.UI.mapZoom(-1); return; }
      if (c === 'Minus' || c === 'NumpadSubtract') { DC.UI.mapZoom(1); return; }
    }
    if (CLOSE_KEYS[c]) { DC.UI.closeAll(); paused = false; return; }
    var n = c.indexOf('Digit') === 0 ? parseInt(c.slice(5), 10) : 0;
    if (n && DC.UI.dialogKey(n)) return;
    return;
  }

  if (c === 'Escape') { paused = true; DC.UI.openPause(); return; }
  if (PANEL_KEYS[c]) {
    paused = true;
    DC.UI[PANEL_KEYS[c]]();
    if (c === 'KeyI') tutMark('bag');
    if (c === 'KeyT') tutMark('tree');
    return;
  }
  if (c === 'KeyF') { interact(); return; }
  if (c === 'Digit1') { quickUse('hp'); return; }
  if (c === 'Digit2') { quickUse('mp'); return; }
}, false);

window.addEventListener('keyup', function (ev) { keys[ev.code] = false; }, false);
window.addEventListener('blur', function () {
  Object.keys(keys).forEach(function (k) { keys[k] = false; });
}, false);

/* 미니맵을 두드리면 확대 지도가 열린다 (모바일 진입점) */
if (cv && cv.addEventListener) {
  cv.addEventListener('pointerdown', function (ev) {
    if (!running || DC.UI.isOpen() || W.isDungeon()) return;
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var x = (ev.clientX - r.left) * (VW / r.width);
    var y = (ev.clientY - r.top) * (VH / r.height);
    var m = mmRect();
    if (x < m.x || y < m.y || x > m.x + m.w || y > m.y + m.h) return;
    ev.preventDefault();
    paused = true;
    DC.UI.openMap();
  }, false);
}

function readInput() {
  var ax = 0, ay = 0;
  if (keys.KeyA || keys.ArrowLeft) ax -= 1;
  if (keys.KeyD || keys.ArrowRight) ax += 1;
  if (keys.KeyW || keys.ArrowUp) ay -= 1;
  if (keys.KeyS || keys.ArrowDown) ay += 1;
  /* 모바일 아날로그 스틱이 있으면 그 값을 우선한다 */
  if (window.GameTouch) {
    var a = GameTouch.axis();
    if (a && a.mag > 0) { ax = a.x; ay = a.y; }
  }
  IN.ax = ax; IN.ay = ay;
  IN.attackEdge = !!(edge.Space || edge.KeyJ);
  IN.dashEdge = !!(edge.ShiftLeft || edge.ShiftRight || edge.KeyK);
  IN.s1Edge = !!edge.KeyQ;
  IN.s2Edge = !!edge.KeyE;
  IN.s3Edge = !!edge.KeyR;
  return IN;
}

/* ══════════════════════════ 카메라 ══════════════════════════ */
function camTarget() {
  var wx = W.width(), wy = W.height();
  var tx = S.p.x - VW / 2, ty = S.p.y - VH / 2;
  tx = wx <= VW ? (wx - VW) / 2 : Math.max(0, Math.min(wx - VW, tx));
  ty = wy <= VH ? (wy - VH) / 2 : Math.max(0, Math.min(wy - VH, ty));
  return { x: tx, y: ty };
}
function snapCam() { var t = camTarget(); cam.x = t.x; cam.y = t.y; }
function moveCam(dt) {
  var t = camTarget(), k = Math.min(1, dt * 11);
  cam.x += (t.x - cam.x) * k;
  cam.y += (t.y - cam.y) * k;
}

/* ══════════════════════════ 오브젝트 렌더 ══════════════════════════ */
var objsCache = [];
function refreshObjs() { objsCache = W.objects(); }

function drawObjects(c) {
  for (var i = 0; i < objsCache.length; i++) {
    var o = objsCache[i];
    var x = Math.round(o.x - c.x), y = Math.round(o.y - c.y);
    if (x < -40 || y < -60 || x > VW + 40 || y > VH + 60) continue;
    switch (o.kind) {
      case 'npc':
        var npc = DC.NPCS[o.npc];
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(x, y + 12, 12, 5, 0, 0, 6.2832); g.fill();
        g.fillStyle = npc.color; g.fillRect(x - 8, y - 6, 16, 17);
        g.fillStyle = '#e7d5b0'; g.fillRect(x - 6, y - 16, 12, 11);
        g.font = "15px 'Courier New',monospace"; g.textAlign = 'center';
        g.fillText(npc.icon, x, y - 18);
        if (o === nearObj) {
          g.font = "bold 11px 'Courier New',monospace";
          g.fillStyle = 'rgba(0,0,0,.65)';
          var nm = DC.tx(npc.n);
          g.fillRect(x - 48, y - 44, 96, 15);
          g.fillStyle = npc.color;
          g.fillText(nm, x, y - 33);
        }
        g.textAlign = 'left';
        break;
      case 'bonfire':
        var fl = 1 + Math.sin(time * 7 + x) * 0.12;
        g.fillStyle = 'rgba(249,115,22,.13)';
        g.beginPath(); g.arc(x, y, 74 * fl, 0, 6.2832); g.fill();
        g.fillStyle = 'rgba(249,115,22,.20)';
        g.beginPath(); g.arc(x, y, 40 * fl, 0, 6.2832); g.fill();
        g.fillStyle = '#3b2c1e';
        g.fillRect(x - 14, y + 4, 28, 6);
        g.fillRect(x - 10, y - 2, 20, 5);
        g.fillStyle = '#f97316';
        g.beginPath();
        g.moveTo(x, y - 24 * fl); g.lineTo(x + 10, y + 4); g.lineTo(x - 10, y + 4);
        g.closePath(); g.fill();
        g.fillStyle = '#fde68a';
        g.beginPath();
        g.moveTo(x, y - 13 * fl); g.lineTo(x + 5, y + 4); g.lineTo(x - 5, y + 4);
        g.closePath(); g.fill();
        break;
      case 'board':
        g.fillStyle = '#3b2c1e'; g.fillRect(x - 3, y + 2, 6, 12);
        g.fillStyle = '#6b4f1d'; g.fillRect(x - 16, y - 18, 32, 22);
        g.fillStyle = '#d6c9a8'; g.fillRect(x - 13, y - 15, 12, 8);
        g.fillRect(x + 2, y - 15, 11, 7);
        g.fillRect(x - 13, y - 5, 9, 6);
        g.fillStyle = '#0c1424'; g.fillRect(x - 11, y - 13, 8, 1); g.fillRect(x + 4, y - 13, 7, 1);
        break;
      case 'chest':
        g.fillStyle = o.opened ? '#3a3524' : '#6b4f1d';
        g.fillRect(x - 11, y - 7, 22, 15);
        g.fillStyle = o.opened ? '#232b40' : '#eab308';
        g.fillRect(x - 11, y - (o.opened ? 15 : 11), 22, 6);
        g.fillStyle = '#0c1424'; g.fillRect(x - 2, y - 3, 4, 5);
        break;
      case 'herb':
        g.fillStyle = '#166534';
        g.beginPath(); g.arc(x, y + 2, 9, 0, 6.2832); g.fill();
        g.fillStyle = '#22c55e';
        g.beginPath(); g.arc(x - 4, y - 2, 5, 0, 6.2832); g.fill();
        g.beginPath(); g.arc(x + 5, y, 4, 0, 6.2832); g.fill();
        g.fillStyle = '#a3e635'; g.fillRect(x - 1, y - 9, 2, 6);
        break;
      case 'portal':
        g.fillStyle = 'rgba(14,165,233,.18)'; g.fillRect(x - 16, y - 16, 32, 32);
        g.strokeStyle = '#0ea5e9'; g.lineWidth = 2; g.strokeRect(x - 15, y - 15, 30, 30);
        g.fillStyle = '#7dd3fc'; g.font = "bold 17px 'Courier New',monospace"; g.textAlign = 'center';
        g.fillText(o.up ? '▲' : '▼', x, y + 6);
        g.textAlign = 'left';
        break;
      case 'gate':
        if (!o.open) {
          g.fillStyle = '#eab308'; g.font = "14px 'Courier New',monospace"; g.textAlign = 'center';
          g.fillText('🔒', x, y + 5); g.textAlign = 'left';
        }
        break;
      case 'well':
        g.fillStyle = '#2b3347'; g.beginPath(); g.arc(x, y, 15, 0, 6.2832); g.fill();
        g.fillStyle = '#0b2a44'; g.beginPath(); g.arc(x, y, 10, 0, 6.2832); g.fill();
        break;
      case 'statue':
        g.fillStyle = '#39415c'; g.fillRect(x - 11, y + 4, 22, 7);
        g.fillStyle = o.used ? '#4b5573' : '#8b7fd4';
        g.fillRect(x - 7, y - 16, 14, 20);
        g.fillStyle = o.used ? '#39415c' : '#c4b5fd';
        g.beginPath(); g.arc(x, y - 19, 6, 0, 6.2832); g.fill();
        break;
      case 'spring':
        g.fillStyle = 'rgba(125,211,252,.16)';
        g.beginPath(); g.arc(x, y, 22, 0, 6.2832); g.fill();
        g.fillStyle = '#0b2a44'; g.beginPath(); g.arc(x, y, 13, 0, 6.2832); g.fill();
        g.fillStyle = 'rgba(125,211,252,.5)';
        g.beginPath(); g.arc(x, y - 2, 6, 0, 6.2832); g.fill();
        break;
      /* 웨이포인트 비석 — 새기면 위쪽 룬에 불이 들어온다 */
      case 'waypoint':
        var lit = !!(S.wp && S.wp[o.wid]);
        if (lit) {
          var pulse = 1 + Math.sin(time * 2.4 + x * 0.05) * 0.10;
          g.fillStyle = 'rgba(56,189,248,.13)';
          g.beginPath(); g.arc(x, y - 4, 34 * pulse, 0, 6.2832); g.fill();
        }
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(x, y + 13, 13, 5, 0, 0, 6.2832); g.fill();
        g.fillStyle = '#39415c';
        g.fillRect(x - 12, y + 6, 24, 7);
        g.fillStyle = lit ? '#5b7ba8' : '#3d4560';
        g.beginPath();
        g.moveTo(x - 7, y + 7); g.lineTo(x - 5, y - 20); g.lineTo(x + 5, y - 20); g.lineTo(x + 7, y + 7);
        g.closePath(); g.fill();
        g.fillStyle = lit ? '#7dd3fc' : '#2b3347';
        g.beginPath();
        g.moveTo(x, y - 15); g.lineTo(x + 5, y - 8); g.lineTo(x, y - 1); g.lineTo(x - 5, y - 8);
        g.closePath(); g.fill();
        if (lit) {
          g.fillStyle = '#e0f2fe';
          g.beginPath(); g.arc(x, y - 8, 2.2, 0, 6.2832); g.fill();
        }
        break;
      case 'lighthouse':
        g.fillStyle = 'rgba(234,179,8,' + (S.flags.boss_down ? 0.5 : 0.10) + ')';
        g.beginPath(); g.arc(x, y, 42, 0, 6.2832); g.fill();
        g.fillStyle = S.flags.boss_down ? '#fde68a' : '#3a4258';
        g.beginPath(); g.arc(x, y, 13, 0, 6.2832); g.fill();
        break;
      default: break;
    }
  }
}

var vignette = null;
function drawVignette() {
  if (!vignette) {
    try {
      vignette = g.createRadialGradient(VW / 2, VH / 2, 90, VW / 2, VH / 2, VW * 0.62);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.82)');
    } catch (e) { vignette = 'rgba(0,0,0,0)'; }
  }
  g.fillStyle = vignette;
  g.fillRect(0, 0, VW, VH);
}

/* ══════════════════════════ 프레임 ══════════════════════════ */
var hudTick = 0;

/** 화톳불 곁은 안전지대 — 서서히 회복된다 */
function bonfireAura(dt) {
  if (!W.isField()) return;
  var p = S.p, near = false;
  for (var i = 0; i < objsCache.length; i++) {
    var o = objsCache[i];
    if (o.kind !== 'bonfire') continue;
    if (Math.hypot(o.x - p.x, o.y - p.y) < 150) { near = true; break; }
  }
  if (!near) return;
  var st = B.stats(p);
  p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.09 * dt);
  p.mp = Math.min(st.maxMp, p.mp + st.maxMp * 0.09 * dt);
  if (p.curse > 0) p.curse = Math.max(0, p.curse - dt * 3);
  DC.UI.hintOnce('bonfire', TR('hintBonfireOn'));
}

function step(dt) {
  var p = S.p;
  time += dt; S.play += dt;
  B.update(dt, readInput(), time);
  for (var k in edge) if (Object.prototype.hasOwnProperty.call(edge, k)) edge[k] = false;

  W.stream(p.x, p.y);
  W.takeLoaded().forEach(B.spawnChunk);
  W.takeUnloaded().forEach(B.despawnChunk);
  refreshObjs();
  stepIntro(dt);
  nearObj = findNear();
  bonfireAura(dt);
  tutTick(dt);

  var z = W.zoneKey(p.x, p.y);
  if (z && z !== S.zone) {
    S.zone = z; S.visited[z] = 1;
    DC.UI.banner(fmt('zoneEnter', { n: DC.tx(DC.ZONES[z] || {}) }), 1.6);
  }
  if (W.isField()) {
    var tier = W.tierAtPx(p.x, p.y);
    if (tier > (S.counters.maxTier || 1)) S.counters.maxTier = tier;
  }

  checkQuests();
  teachHints();

  autoT += dt;
  if (autoT >= 30) saveNow(false);

  moveCam(dt);
  if (++hudTick % 3 === 0) { DC.UI.hud(); DC.UI.bossBar(); }
  showPrompt();
}

/** 상황이 처음 발생할 때만 짧게 조작을 알려준다 (튜토리얼 화면 없음) */
function teachHints() {
  var p = S.p, st = B.stats(p);
  var near = B.nearest(p.x, p.y, 240);
  if (near) DC.UI.hintOnce('atk', TR('hintAttack'));
  if (near && near.t === 'shield') DC.UI.hintOnce('shield', TR('hintShield'));
  if (p.hp < st.maxHp) DC.UI.hintOnce('dash', TR('hintDash'));
  if (p.lv >= 2) DC.UI.hintOnce('skill', TR('hintSkill'));
  if (nearObj && nearObj.kind === 'npc') DC.UI.hintOnce('talk', TR('hintTalk'));
  if (W.isField() && p.lv >= 3) DC.UI.hintOnce('map', TR('hintMap'));
}

function showPrompt() {
  var el = $('prompt'); if (!el) return;
  var label = nearObj ? labelFor(nearObj) : null;
  if (!label) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = '<b>F</b> ' + label;
}

function render() {
  g.fillStyle = '#0c1424';
  g.fillRect(0, 0, VW, VH);
  if (!S) return;
  var p = S.p;
  var sh = p.shake || 0;
  var c = { x: cam.x + (sh ? (Math.random() - 0.5) * sh : 0), y: cam.y + (sh ? (Math.random() - 0.5) * sh : 0) };
  W.draw(g, c, VW, VH);
  W.drawSpikes(g, c, VW, VH, time);
  drawObjects(c);
  B.draw(g, c, time);
  if (W.isDungeon()) drawVignette();
  /* 대륙이 넓어 길을 잃기 쉽다 — 지상에선 항상 간이 지도 + 표착항 나침반을 띄운다 */
  W.drawMinimap(g, VW - 140, MM.pad, MM.size, p.x, p.y);
}

var last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  DC.UI.tickFx(dt);
  if (!running) return;
  if (!paused && !DC.UI.isOpen()) step(dt);
  render();
}

/* ══════════════════════════ 전투 훅 ══════════════════════════ */
function onKill(e) {
  S.kills++;
  S.p.gold += e.d.gold;
  DC.QUEST_ORDER.forEach(function (id) {
    var q = S.quests[id], def = DC.QUESTS[id];
    if (!q || q.state !== 1) return;
    if (def.goal.type === 'kill' && def.goal.enemy === e.t) q.prog = (q.prog || 0) + 1;
    else if (def.goal.type === 'killAny') q.prog = (q.prog || 0) + 1;
  });
  gainXp(e.d.xp);
  tutMark('kill');
  if (e.d.boss) {
    S.flags.boss_down = true;
    DC.UI.banner('🔥 ' + DC.tx({ ko: '등롱에 불이 붙었다', en: 'The lantern catches' }), 3);
    checkQuests();
    saveNow(false);
  }
}

function onBossPhase() {
  DC.UI.banner(TR('phase2'), 2.4);
}

/* ══════════════════════════ 부팅 ══════════════════════════ */
DC.Game = {
  countItem: countItem, addItem: addItem, removeItem: removeItem,
  equip: equip, useItem: useItem, sell: sell, buy: buy, learn: learn,
  acceptQuest: acceptQuest, turnInQuest: turnInQuest, rest: rest,
  saveNow: saveNow, loadGame: loadGame, exportFile: exportFile, importFile: importFile,
  toMenu: toMenu, newGame: newGame, respawn: respawn, interact: interact,
  enterRegion: enterRegion, gainXp: gainXp, score: score,
  waypointList: waypointList, warpTo: warpTo, warpCost: warpCost, warpDist: warpDist,
  warpBlock: warpBlock, atWaypoint: atWaypoint, openWaypoint: openWaypoint,
  wpName: wpName,
  startAs: function (cls) { newGame(cls); },
  healAt: healAt, healFee: healFee,
  hireMerc: hireMerc, trainMerc: trainMerc, reviveMerc: reviveMerc, dismissMerc: dismissMerc,
  advance: advance, canAdvance: canAdvance,
  startTutorial: startTutorial, skipTutorial: skipTutorial,
  tutorialStep: function () { return tut ? DC.TUTORIAL[tut.i] : null; },
  introActive: function () { return !!intro; },
  resume: function () { paused = false; },
  state: function () { return S; },
  setState: function (st) { beginWith(normalize(st)); },
  storeKind: function () { return Store.kind; },
  step: function (dt) { if (running && !paused) step(dt); },
  nearObj: function () { return nearObj; },
  keys: keys,
  isRunning: function () { return running; },
};

B.init(W, null, {
  onKill: onKill, onDeath: onDeath, onBossPhase: onBossPhase,
  onNoMp: function () { DC.UI.hintOnce('nomp', TR('hintNoMp')); },
  onAct: function (kind) { if (kind === 'attack') tutMark('attack'); else if (kind === 'dash') tutMark('dash'); },
  onCurse: function () { DC.UI.hint(TR('curseOn'), 3); },
  onMercDown: function (id, secs) {
    DC.UI.hint(fmt('mercDown', { n: DC.tx(DC.MERCS[id].n), s: Math.ceil(secs) }), 3);
  },
  onMercUp: function (id) { DC.UI.hint(fmt('mercBack', { n: DC.tx(DC.MERCS[id].n) }), 2.4); },
});
DC.UI.init(null, DC.Game);

(function boot() {
  var contBtn = $('contBtn');
  if (contBtn) {
    contBtn.disabled = true;
    Store.get('auto').then(function (d) { contBtn.disabled = !d; });
  }
  var b;
  b = $('startBtn'); if (b) b.onclick = function () { newGame(); };
  if (contBtn) contBtn.onclick = function () { loadGame(); };
  b = $('importBtn'); if (b) b.onclick = function () { var f = $('importFile'); if (f) f.click(); };
  b = $('importFile');
  if (b) {
    b.onchange = function (ev) {
      if (ev.target.files && ev.target.files[0]) importFile(ev.target.files[0]);
      ev.target.value = '';
    };
  }
  b = $('backBtn'); if (b) b.onclick = function () { toMenu(); };
  b = $('againBtn'); if (b) b.onclick = function () { respawn(); };
  if (DC.UI.renderClasses) DC.UI.renderClasses();
  requestAnimationFrame(frame);
})();
})();
