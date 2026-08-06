'use strict';
(function () {
/**
 * 표류 대륙 — UI: HUD / 대화 / 가방 / 기술의 나무 / 일지 / 상점 / 여관 / 배너.
 *
 * 패널은 전부 DOM 이다. 캔버스는 월드·전투만 그린다.
 * 상태 변경은 하지 않고 DC.Game(코어)의 API 를 호출한다 — UI 는 읽기 + 입력 전달만.
 */
var DC = window.DC || (window.DC = {});

function $(id) { return document.getElementById(id); }
function TR(k) { return (window.GameI18n ? window.GameI18n.t(k) : k); }
function txt(o) { return DC.tx(o); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var S = null;      // 게임 상태
var G = null;      // DC.Game (코어 API)
var open = null;   // 현재 열린 패널 id
var dlgNpc = null, dlgNode = null;
var hintT = 0, bannerT = 0;
var shownHints = {};

var PANELS = ['panelInv', 'panelTree', 'panelQuest', 'panelShop', 'panelInn', 'panelPause', 'dlg'];

/* ══════════════════════════ HUD ══════════════════════════ */
function hud() {
  if (!S || !S.p) return;
  var p = S.p, st = DC.Battle.stats(p);
  var hpEl = $('hpFill'); if (hpEl) hpEl.style.width = Math.max(0, (p.hp / st.maxHp) * 100) + '%';
  var mpEl = $('mpFill'); if (mpEl) mpEl.style.width = Math.max(0, (p.mp / st.maxMp) * 100) + '%';
  var xpEl = $('xpFill');
  if (xpEl) xpEl.style.width = Math.min(100, (p.xp / DC.xpNeed(p.lv)) * 100) + '%';
  set('hpTxt', Math.ceil(p.hp) + ' / ' + Math.round(st.maxHp));
  set('mpTxt', Math.ceil(p.mp) + ' / ' + Math.round(st.maxMp));
  set('lvTxt', TR('hudLv') + ' ' + p.lv);
  set('goldTxt', '🪙 ' + p.gold);
  set('zoneTxt', txt(DC.ZONES[S.zone] || DC.ZONES.harbor));
  set('spBadge', p.sp > 0 ? '★' + p.sp : '');

  var q = trackedQuest();
  set('questTrack', q ? '📜 ' + txt(DC.QUESTS[q].n) + ' — ' + progressText(q) : '');

  var cw = $('cdWhirl'), ct = $('cdTide');
  if (cw) cw.style.setProperty('--f', p.cdWhirl > 0 ? (p.cdWhirl / (DC.SKILLS.whirl.cd)) : 0);
  if (cw) cw.classList.toggle('cool', p.cdWhirl > 0);
  if (ct) ct.classList.toggle('cool', p.cdTide > 0);
  var dEl = $('cdDash');
  if (dEl) dEl.classList.toggle('cool', p.dashCd > 0);
}

function set(id, v) { var el = $(id); if (el && el.textContent !== v) el.textContent = v; }

function trackedQuest() {
  var order = DC.QUEST_ORDER, i;
  for (i = 0; i < order.length; i++) {
    var q = S.quests[order[i]];
    if (q && q.state === 2) return order[i];
  }
  for (i = 0; i < order.length; i++) {
    var q2 = S.quests[order[i]];
    if (q2 && q2.state === 1) return order[i];
  }
  return null;
}

function progressText(id) {
  var def = DC.QUESTS[id], q = S.quests[id];
  if (q.state === 2) return TR('qReady');
  if (q.state === 3) return TR('qDone');
  if (def.goal.type === 'kill') return (q.prog || 0) + ' / ' + def.goal.count;
  if (def.goal.type === 'collect') return G.countItem(def.goal.item) + ' / ' + def.goal.count;
  return TR('qActive');
}

/** 보스 체력 바 */
function bossBar() {
  var b = DC.Battle.boss(), el = $('bossBar');
  if (!el) return;
  if (!b) { el.hidden = true; return; }
  el.hidden = false;
  set('bossName', txt(DC.ENEMIES.keeper.n) + (b.phase === 2 ? ' · II' : ' · I'));
  var f = $('bossFill');
  if (f) { f.style.width = Math.max(0, (b.hp / b.max) * 100) + '%'; f.style.background = b.phase === 2 ? '#ef4444' : '#eab308'; }
}

/* ══════════════════════════ 힌트 · 배너 ══════════════════════════ */
function hint(text, secs) {
  var el = $('hint'); if (!el) return;
  el.textContent = text;
  el.classList.add('on');
  hintT = secs || 2.6;
}
/** 상황이 처음 발생했을 때만 노출 — 튜토리얼 화면 없이 조작을 가르친다 */
function hintOnce(key, text) {
  if (shownHints[key]) return;
  shownHints[key] = 1;
  hint(text, 3.4);
}
function banner(text, secs) {
  var el = $('banner'); if (!el) return;
  el.textContent = text;
  el.classList.add('on');
  bannerT = secs || 2.0;
}
function tickFx(dt) {
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) { var h = $('hint'); if (h) h.classList.remove('on'); } }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) { var b = $('banner'); if (b) b.classList.remove('on'); } }
}

/* ══════════════════════════ 패널 열고 닫기 ══════════════════════════ */
function closeAll() {
  PANELS.forEach(function (id) { var el = $(id); if (el) el.hidden = true; });
  open = null;
  dlgNpc = null; dlgNode = null;
}
function show(id) {
  closeAll();
  var el = $(id); if (!el) return;
  el.hidden = false;
  open = id;
}
function isOpen() { return open !== null; }

/* ══════════════════════════ 대화 ══════════════════════════ */
function openDialog(npcId) {
  var npc = DC.NPCS[npcId]; if (!npc) return;
  dlgNpc = npc;
  gotoNode(npc.root(S));
}
function gotoNode(nodeId) {
  if (!dlgNpc || !nodeId) { closeAll(); return; }
  var node = dlgNpc.nodes[nodeId];
  if (!node) { closeAll(); return; }
  dlgNode = node;
  show('dlg');
  set('dlgIcon', dlgNpc.icon);
  var nameEl = $('dlgName');
  if (nameEl) { nameEl.textContent = txt(dlgNpc.n); nameEl.style.color = dlgNpc.color; }
  set('dlgText', txt(node.t));
  var box = $('dlgChoices'); if (!box) return;
  box.innerHTML = '';
  (node.c || []).forEach(function (ch, i) {
    var b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = '<b>' + (i + 1) + '</b> ' + esc(txt(ch.t));
    b.onclick = function () { pickChoice(ch); };
    box.appendChild(b);
  });
}
function pickChoice(ch) {
  var next = ch.to || null;
  if (ch.act) {
    var a = ch.act, i = a.indexOf(':');
    var cmd = i < 0 ? a : a.slice(0, i), arg = i < 0 ? null : a.slice(i + 1);
    if (cmd === 'accept') G.acceptQuest(arg);
    else if (cmd === 'turnin') G.turnInQuest(arg);
    else if (cmd === 'shop') { openShop(arg); return; }
    else if (cmd === 'inn') { openInn(); return; }
    else if (cmd === 'end') { closeAll(); return; }
  }
  if (next) gotoNode(next); else closeAll();
}
function dialogKey(n) {
  if (open !== 'dlg' || !dlgNode) return false;
  var list = dlgNode.c || [];
  if (n >= 1 && n <= list.length) { pickChoice(list[n - 1]); return true; }
  return false;
}

/* ══════════════════════════ 가방 · 장비 ══════════════════════════ */
function openInv() { show('panelInv'); renderInv(); }

function renderInv() {
  var p = S.p, st = DC.Battle.stats(p);

  var eq = $('equipList');
  if (eq) {
    eq.innerHTML = ['weapon', 'armor', 'trinket'].map(function (slot) {
      var it = DC.ITEMS[p.equip[slot]];
      var label = TR(slot === 'weapon' ? 'slotWeapon' : slot === 'armor' ? 'slotArmor' : 'slotTrinket');
      return '<div class="eqRow"><span class="eqSlot">' + label + '</span>' +
        '<span class="eqName">' + (it ? it.icon + ' ' + esc(txt(it.n)) : TR('slotEmpty')) + '</span></div>';
    }).join('');
  }

  var sl = $('statList');
  if (sl) {
    sl.innerHTML =
      row(TR('stStr'), p.str) + row(TR('stAgi'), p.agi) + row(TR('stVit'), p.vit) + row(TR('stWil'), p.wil) +
      '<div class="sep"></div>' +
      row(TR('stAtk'), Math.round(st.atk)) + row(TR('stDef'), Math.round(st.def)) +
      row(TR('stCrit'), Math.round(st.crit * 100) + '%') + row(TR('stSpd'), Math.round(st.spd));
  }

  var grid = $('invGrid'); if (!grid) return;
  grid.innerHTML = '';
  for (var i = 0; i < 20; i++) {
    var cell = document.createElement('div');
    cell.className = 'slot';
    var s = p.bag[i];
    if (s) {
      var it = DC.ITEMS[s.id];
      cell.innerHTML = '<span class="ic">' + it.icon + '</span>' + (s.n > 1 ? '<span class="qty">' + s.n + '</span>' : '');
      cell.title = txt(it.n);
      cell.className += ' has';
      (function (idx) { cell.onclick = function () { selectSlot(idx); }; })(i);
    }
    grid.appendChild(cell);
  }
  renderSlotDetail();
}
function row(k, v) { return '<div class="stRow"><span>' + k + '</span><b>' + v + '</b></div>'; }

var selSlot = -1;
function selectSlot(i) { selSlot = i; renderInv(); }

function renderSlotDetail() {
  var d = $('invDetail'); if (!d) return;
  var s = S.p.bag[selSlot];
  if (!s) { d.innerHTML = '<span class="dim">' + TR('invEmpty') + '</span>'; return; }
  var it = DC.ITEMS[s.id];
  var acts = '';
  if (it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'trinket') {
    acts += '<button data-act="equip">' + TR('equipBtn') + '</button>';
  } else if (it.slot === 'use') {
    acts += '<button data-act="use">' + TR('useBtn') + '</button>';
  }
  if (it.price > 0 && !it.quest) {
    acts += '<button class="ghost" data-act="sell">' + TR('sellBtn') + ' 🪙' + Math.max(1, Math.floor(it.price * 0.4)) + '</button>';
  }
  d.innerHTML = '<div class="dName">' + it.icon + ' ' + esc(txt(it.n)) + '</div>' +
    '<div class="dDesc">' + esc(txt(it.d)) + '</div><div class="dActs">' + acts + '</div>';
  var btns = d.querySelectorAll('button');
  for (var i = 0; i < btns.length; i++) {
    (function (b) {
      b.onclick = function () {
        var a = b.getAttribute('data-act');
        if (a === 'equip') G.equip(selSlot);
        else if (a === 'use') G.useItem(selSlot);
        else if (a === 'sell') G.sell(selSlot);
        renderInv();
        hud();
      };
    })(btns[i]);
  }
}

/* ══════════════════════════ 기술의 나무 ══════════════════════════ */
function openTree() { show('panelTree'); renderTree(); }

function renderTree() {
  var p = S.p;
  set('spTxt', p.sp > 0 ? DC.sub(TR('spLeft'), { n: p.sp }) : TR('spNone'));
  var grid = $('treeGrid'); if (!grid) return;
  grid.innerHTML = '';
  for (var line = 0; line < 3; line++) {
    var col = document.createElement('div');
    col.className = 'treeCol';
    col.innerHTML = '<div class="treeHead">' + ['⚔️', '🌊', '🧱'][line] + ' ' +
      ['검로 / Blade', '조류 / Tide', '강인 / Grit'][line] + '</div>';
    for (var tier = 0; tier < 3; tier++) {
      var node = findNode(line, tier);
      col.appendChild(nodeEl(node, p));
    }
    grid.appendChild(col);
  }
}
function findNode(line, tier) {
  for (var i = 0; i < DC.TREE.length; i++) {
    if (DC.TREE[i].line === line && DC.TREE[i].tier === tier) return DC.TREE[i];
  }
  return null;
}
function nodeEl(node, p) {
  var el = document.createElement('button');
  var owned = !!p.tree[node.id];
  var prev = node.tier > 0 ? findNode(node.line, node.tier - 1) : null;
  var prevOk = !prev || !!p.tree[prev.id];
  var lvOk = p.lv >= node.reqLv;
  var can = !owned && prevOk && lvOk && p.sp > 0;
  el.className = 'tnode' + (owned ? ' owned' : '') + (can ? ' can' : '');
  var note = owned ? TR('learned') : (!lvOk ? DC.sub(TR('reqLv'), { n: node.reqLv }) : (!prevOk ? TR('reqPrev') : ''));
  el.innerHTML = '<span class="tIcon">' + node.icon + '</span>' +
    '<span class="tName">' + esc(txt(node.n)) + '</span>' +
    '<span class="tDesc">' + esc(txt(node.d)) + '</span>' +
    (note ? '<span class="tNote">' + note + '</span>' : '');
  el.disabled = !can;
  el.onclick = function () { if (G.learn(node.id)) { renderTree(); hud(); } };
  return el;
}

/* ══════════════════════════ 일지 ══════════════════════════ */
function openQuests() { show('panelQuest'); renderQuests(); }

function renderQuests() {
  var list = $('questList'); if (!list) return;
  var html = '', any = false;
  DC.QUEST_ORDER.forEach(function (id) {
    var q = S.quests[id];
    if (!q || q.state === 0) return;
    any = true;
    var def = DC.QUESTS[id];
    var badge = q.state === 3 ? TR('qDone') : q.state === 2 ? TR('qReady') : TR('qActive');
    var cls = q.state === 3 ? 'done' : q.state === 2 ? 'ready' : '';
    html += '<div class="qRow ' + cls + '">' +
      '<div class="qTop"><b>' + (def.kind === 'main' ? '★ ' : '· ') + esc(txt(def.n)) + '</b>' +
      '<span class="qBadge">' + badge + '</span></div>' +
      '<div class="qDesc">' + esc(txt(def.d)) + '</div>' +
      '<div class="qProg">' + progressText(id) + '</div></div>';
  });
  list.innerHTML = any ? html : '<span class="dim">' + TR('qNone') + '</span>';
}

/* ══════════════════════════ 상점 ══════════════════════════ */
var curShop = null;
function openShop(id) {
  curShop = id;
  show('panelShop');
  renderShop();
}
function renderShop() {
  set('shopGold', '🪙 ' + S.p.gold);
  var list = $('shopList'); if (!list) return;
  var ids = DC.SHOPS[curShop] || [];
  list.innerHTML = '';
  if (!ids.length) { list.innerHTML = '<span class="dim">' + TR('shopEmpty') + '</span>'; return; }
  ids.forEach(function (iid) {
    var it = DC.ITEMS[iid];
    var r = document.createElement('div');
    r.className = 'shopRow';
    r.innerHTML = '<span class="sIcon">' + it.icon + '</span>' +
      '<span class="sBody"><b>' + esc(txt(it.n)) + '</b><i>' + esc(txt(it.d)) + '</i></span>' +
      '<span class="sPrice">🪙' + it.price + '</span>';
    var b = document.createElement('button');
    b.textContent = TR('buyBtn');
    b.disabled = S.p.gold < it.price;
    b.onclick = function () { G.buy(iid); renderShop(); hud(); };
    r.appendChild(b);
    list.appendChild(r);
  });
}

/* ══════════════════════════ 여관 ══════════════════════════ */
function openInn() {
  show('panelInn');
  var free = DC.qs(S, 'main_keeper') === 3;
  var b = $('innRestBtn');
  if (b) {
    b.textContent = free ? TR('freeRestBtn') : TR('restBtn');
    b.disabled = !free && S.p.gold < 30;
  }
}

/* ══════════════════════════ 일시정지 ══════════════════════════ */
function openPause() { show('panelPause'); }

/* ══════════════════════════ 모듈 ══════════════════════════ */
DC.UI = {
  init: function (state, api) {
    S = state; G = api;
    var innB = $('innRestBtn');
    if (innB) innB.onclick = function () { G.rest(); };
    PANELS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var close = el.querySelector('[data-close]');
      if (close) close.onclick = function () { closeAll(); G.resume(); };
    });
    var pr = $('pauseResume'); if (pr) pr.onclick = function () { closeAll(); G.resume(); };
    var ps = $('pauseSave'); if (ps) ps.onclick = function () { G.saveNow(true); };
    var pe = $('pauseExport'); if (pe) pe.onclick = function () { G.exportFile(); };
    var pq = $('pauseQuit'); if (pq) pq.onclick = function () { G.toMenu(); };
  },
  bind: function (state) { S = state; shownHints = {}; },
  hud: hud, bossBar: bossBar, tickFx: tickFx,
  hint: hint, hintOnce: hintOnce, banner: banner,
  closeAll: closeAll, isOpen: isOpen, openPanel: function () { return open; },
  openDialog: openDialog, openShop: openShop, openInv: openInv,
  openTree: openTree, openQuests: openQuests, openInn: openInn, openPause: openPause,
  dialogKey: dialogKey,
  refresh: function () {
    if (open === 'panelInv') renderInv();
    else if (open === 'panelTree') renderTree();
    else if (open === 'panelQuest') renderQuests();
    else if (open === 'panelShop') renderShop();
    hud();
  },
};
})();
