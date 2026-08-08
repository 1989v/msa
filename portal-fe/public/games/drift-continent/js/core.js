'use strict';
(function () {
/**
 * 표류 대륙 — 코어: 루프 / 입력 / 카메라 / 세이브 / 진행(퀘스트·성장·상호작용).
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
var SAVE_V = 2;            // 2 — 시드 기반 대륙 (seed / seen 추가, 지상 좌표계 이동)

function newState() {
  var start = W.spawnPoint();
  var st = {
    v: SAVE_V,
    seed: W.newSeed(),
    p: {
      lv: 1, xp: 0, sp: 0, str: 4, agi: 4, vit: 4, wil: 4,
      hp: 72, mp: 40, gold: 20,
      bag: [{ id: 'potion', n: 2 }],
      equip: { weapon: 'rusty_dagger', armor: 'quilt_coat', trinket: null },
      tree: {},
      x: start.x, y: start.y, fx: 0, fy: 1,
    },
    region: 'drift', zone: 'harbor',
    quests: {}, flags: {}, kills: 0, deepest: 0, visited: { harbor: 1 }, seen: {},
    play: 0, savedAt: 0,
  };
  DC.QUEST_ORDER.forEach(function (id) { st.quests[id] = { state: 0, prog: 0 }; });
  return st;
}

/**
 * 저장본이 구버전이어도 빠진 필드를 메워 부팅되게 한다.
 * v1(4×3 고정 격자) 세이브는 시드가 없으므로 기본 대륙을 쓰고,
 * 지상 좌표는 표착항 앵커 기준으로 평행이동해 옛 위치를 그대로 이어간다.
 */
function normalize(st) {
  var base = newState();
  if (!st || !st.p) return base;
  ['region', 'zone', 'kills', 'deepest', 'play'].forEach(function (k) {
    if (st[k] === undefined) st[k] = base[k];
  });
  st.flags = st.flags || {};
  st.visited = st.visited || {};
  st.seen = st.seen || {};
  st.quests = st.quests || {};
  DC.QUEST_ORDER.forEach(function (id) { if (!st.quests[id]) st.quests[id] = { state: 0, prog: 0 }; });
  st.p.bag = st.p.bag || [];
  st.p.tree = st.p.tree || {};
  st.p.equip = st.p.equip || base.p.equip;

  if (!st.seed) st.seed = W.DEFAULT_SEED;
  if (!st.v || st.v < SAVE_V) {
    if (st.region === 'drift') {
      st.p.x = (st.p.x || 0) + W.HCX * W.CPX;
      st.p.y = (st.p.y || 0) + W.HCY * W.CPX;
    }
    st.v = SAVE_V;
  }
  if (st.region === 'drift') {
    st.p.x = Math.max(24, Math.min(W.WCOLS * W.CPX - 24, st.p.x));
    st.p.y = Math.max(24, Math.min(W.WROWS * W.CPX - 24, st.p.y));
  }
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
function giveItem(id, n) {
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
function gainXp(n) {
  var p = S.p;
  p.xp += n;
  var leveled = false;
  while (p.lv < DC.MAX_LEVEL && p.xp >= DC.xpNeed(p.lv)) {
    p.xp -= DC.xpNeed(p.lv);
    p.lv++; p.sp++;
    p.vit++;
    if (p.lv % 3 === 0) p.wil++; else if (p.lv % 3 === 1) p.str++; else p.agi++;
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
  var node = null, i;
  for (i = 0; i < DC.TREE.length; i++) if (DC.TREE[i].id === id) node = DC.TREE[i];
  if (!node || p.lv < node.reqLv) return false;
  if (node.tier > 0) {
    var prev = null;
    for (i = 0; i < DC.TREE.length; i++) {
      if (DC.TREE[i].line === node.line && DC.TREE[i].tier === node.tier - 1) prev = DC.TREE[i];
    }
    if (!prev || !p.tree[prev.id]) return false;
  }
  p.tree[id] = 1; p.sp--;
  B.popup(p.x, p.y - 26, DC.tx(node.n), '#22c55e', true);
  saveNow(false);
  return true;
}

/* ══════════════════════════ 퀘스트 ══════════════════════════ */
function acceptQuest(id) {
  var q = S.quests[id];
  if (!q || q.state !== 0) return;
  q.state = 1; q.prog = 0;
  DC.UI.hint(fmt('hintQuestNew', { n: DC.tx(DC.QUESTS[id].n) }), 3.2);
  saveNow(false);
}

function turnInQuest(id) {
  var q = S.quests[id], def = DC.QUESTS[id];
  if (!q || q.state !== 2) return;
  if (def.goal.type === 'collect') removeItem(def.goal.item, def.goal.count);
  q.state = 3;
  S.p.gold += def.reward.gold || 0;
  (def.reward.items || []).forEach(function (it) { addItem(it, 1); });
  gainXp(def.reward.xp || 0);
  DC.UI.hint(fmt('hintQuestDone', { n: DC.tx(def.n) }), 3.2);
  DC.UI.banner('✅ ' + DC.tx(def.n), 1.8);
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
    else if (goal.type === 'kill') ok = (q.prog || 0) >= goal.count;
    else if (goal.type === 'collect') ok = countItem(goal.item) >= goal.count;
    if (ok) {
      q.state = 2;
      DC.UI.hint('📜 ' + DC.tx(DC.QUESTS[id].n) + ' — ' + TR('qReady'), 3.0);
    }
  });
}

function questsDone() {
  var n = 0;
  DC.QUEST_ORDER.forEach(function (id) { if (S.quests[id].state === 3) n++; });
  return n;
}

/* ══════════════════════════ 점수 ══════════════════════════ */
function score() {
  var visited = Object.keys(S.visited).length;
  return Math.round(
    S.p.lv * 60 + questsDone() * 220 + S.kills * 4 +
    S.deepest * 150 + visited * 40 + (S.flags.boss_down ? 600 : 0)
  );
}
function scoreDetail() {
  return 'Lv' + S.p.lv + ' · Q' + questsDone() + ' · K' + S.kills;
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
  DC.UI.closeAll();
  ['menu', 'endPanel'].forEach(function (id) { var el = $(id); if (el) el.hidden = true; });
  var h = $('hud'); if (h) h.hidden = false;
  snapCam();
  DC.UI.hud();
  DC.UI.hintOnce('move', TR('hintMove'));
}

function newGame() { beginWith(newState()); }

function toMenu() {
  running = false; paused = false;
  DC.UI.closeAll();
  var h = $('hud'); if (h) h.hidden = true;
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
    fmt('resultLine', { lv: S.p.lv, q: questsDone(), k: S.kills, s: score() }));
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
  S.p.hp = st.maxHp; S.p.mp = st.maxMp;
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
  var free = DC.qs(S, 'main_keeper') === 3;
  if (!free) {
    if (S.p.gold < 30) { DC.UI.hint(TR('goldShort')); return; }
    S.p.gold -= 30;
  }
  var st = B.stats(S.p);
  S.p.hp = st.maxHp; S.p.mp = st.maxMp;
  DC.UI.closeAll();
  paused = false;
  DC.UI.banner('🛏️ ' + TR('restDone'), 2.0);
  submitScore();
  saveNow(true);
}

function buy(id) {
  var it = DC.ITEMS[id];
  if (!it || S.p.gold < it.price) { DC.UI.hint(TR('goldShort')); return false; }
  if (!addItem(id, 1)) { DC.UI.hint(TR('invFull')); return false; }
  S.p.gold -= it.price;
  DC.UI.hint(TR('bought') + ' — ' + it.icon + ' ' + DC.tx(it.n));
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
  var st = B.stats(S.p);
  if (it.heal) { S.p.hp = Math.min(st.maxHp, S.p.hp + it.heal); B.popup(S.p.x, S.p.y - 26, '+' + it.heal, '#22c55e'); }
  if (it.mana) { S.p.mp = Math.min(st.maxMp, S.p.mp + it.mana); B.popup(S.p.x, S.p.y - 26, '+' + it.mana, '#7dd3fc'); }
  s.n--; if (s.n <= 0) S.p.bag.splice(slot, 1);
  return true;
}

/** 단축키(1/2)로 회복약 즉시 사용 */
function quickUse(kind) {
  var want = kind === 'hp' ? ['potion_hi', 'potion'] : ['elixir'];
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
  if (to === 'f1') S.flags.entered_lighthouse = true;
  if (FLOOR_NO[to]) S.deepest = Math.max(S.deepest, FLOOR_NO[to]);
  DC.UI.banner(fmt('zoneEnter', { n: DC.tx(DC.ZONES[S.zone] || {}) }), 2.0);
  snapCam();
  saveNow(false);
}

/* ══════════════════════════ 상호작용 ══════════════════════════ */
function labelFor(o) {
  if (o.kind === 'npc') return DC.tx(DC.NPCS[o.npc].n);
  if (o.kind === 'chest') return o.opened ? null : TR('hintChest');
  if (o.kind === 'herb') return TR('hintHerb');
  if (o.kind === 'statue') return o.used ? null : TR('hintStatue');
  if (o.kind === 'spring') return TR('hintSpring');
  if (o.kind === 'gate') return o.open ? null : TR('hintLocked');
  if (o.kind === 'portal') return o.up ? (o.to === 'drift' ? TR('hintExit') : TR('hintStairsUp')) : TR('hintStairsDown');
  return null;
}

function findNear() {
  var objs = W.objects(), best = null, bd = 46;
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
  if (o.kind === 'npc') { paused = true; DC.UI.openDialog(o.npc); return; }
  if (o.kind === 'chest') {
    o.opened = true;
    S.flags['chest_' + o.id] = true;
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
var IN = { ax: 0, ay: 0, attackEdge: false, dashEdge: false, s1Edge: false, s2Edge: false };

var PANEL_KEYS = { KeyI: 'openInv', KeyT: 'openTree', KeyL: 'openQuests' };

window.addEventListener('keydown', function (ev) {
  var c = ev.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(c) >= 0) ev.preventDefault();
  if (!keys[c]) edge[c] = true;
  keys[c] = true;

  if (!running) return;

  if (DC.UI.isOpen()) {
    if (c === 'Escape' || c === 'KeyI' || c === 'KeyT' || c === 'KeyL') { DC.UI.closeAll(); paused = false; return; }
    var n = c.indexOf('Digit') === 0 ? parseInt(c.slice(5), 10) : 0;
    if (n && DC.UI.dialogKey(n)) return;
    return;
  }

  if (c === 'Escape') { paused = true; DC.UI.openPause(); return; }
  if (PANEL_KEYS[c]) { paused = true; DC.UI[PANEL_KEYS[c]](); return; }
  if (c === 'KeyF') { interact(); return; }
  if (c === 'Digit1') { quickUse('hp'); return; }
  if (c === 'Digit2') { quickUse('mp'); return; }
}, false);

window.addEventListener('keyup', function (ev) { keys[ev.code] = false; }, false);
window.addEventListener('blur', function () {
  Object.keys(keys).forEach(function (k) { keys[k] = false; });
}, false);

function readInput() {
  var ax = 0, ay = 0;
  if (keys.KeyA || keys.ArrowLeft) ax -= 1;
  if (keys.KeyD || keys.ArrowRight) ax += 1;
  if (keys.KeyW || keys.ArrowUp) ay -= 1;
  if (keys.KeyS || keys.ArrowDown) ay += 1;
  IN.ax = ax; IN.ay = ay;
  IN.attackEdge = !!(edge.Space || edge.KeyJ);
  IN.dashEdge = !!(edge.ShiftLeft || edge.ShiftRight || edge.KeyK);
  IN.s1Edge = !!edge.KeyQ;
  IN.s2Edge = !!edge.KeyE;
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

function step(dt) {
  var p = S.p;
  time += dt; S.play += dt;
  B.update(dt, readInput(), time);
  for (var k in edge) if (Object.prototype.hasOwnProperty.call(edge, k)) edge[k] = false;

  W.stream(p.x, p.y);
  W.takeLoaded().forEach(B.spawnChunk);
  W.takeUnloaded().forEach(B.despawnChunk);
  refreshObjs();
  nearObj = findNear();

  var z = W.zoneKey(p.x, p.y);
  if (z && z !== S.zone) {
    S.zone = z; S.visited[z] = 1;
    DC.UI.banner(fmt('zoneEnter', { n: DC.tx(DC.ZONES[z] || {}) }), 1.6);
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
  W.drawMinimap(g, VW - 140, 12, 128, p.x, p.y);
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
    if (q.state === 1 && def.goal.type === 'kill' && def.goal.enemy === e.t) q.prog = (q.prog || 0) + 1;
  });
  gainXp(e.d.xp);
  if (e.d.boss) {
    S.flags.boss_down = true;
    var mk = S.quests.main_keeper;
    if (mk.state === 1) mk.state = 2;
    turnInQuest('main_keeper');
    DC.UI.banner('🔥 ' + TR('clearTitle'), 3);
    setTimeout(clearGame, 1800);
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
  resume: function () { paused = false; },
  state: function () { return S; },
  setState: function (st) { beginWith(normalize(st)); },
  storeKind: function () { return Store.kind; },
  step: function (dt) { if (running && !paused) step(dt); },
  nearObj: function () { return nearObj; },
  keys: keys,
  isRunning: function () { return running; },
};

B.init(W, null, { onKill: onKill, onDeath: onDeath, onBossPhase: onBossPhase,
  onNoMp: function () { DC.UI.hintOnce('nomp', TR('hintNoMp')); } });
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
  requestAnimationFrame(frame);
})();
})();
