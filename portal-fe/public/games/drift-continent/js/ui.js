'use strict';
(function () {
/**
 * 표류 대륙 — UI: HUD / 대화 / 직업 선택 / 가방 / 기술의 나무 / 일지 /
 * 의뢰 게시판 / 상점 / 여관 / 용병 대기소 / 갈림길(전직) / 확대 지도 / 배너.
 *
 * 패널은 전부 DOM 이다. 캔버스는 월드·전투와 확대 지도만 그린다.
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

var PANELS = ['panelInv', 'panelTree', 'panelQuest', 'panelShop', 'panelInn', 'panelPause',
  'panelBoard', 'panelMerc', 'panelAdv', 'panelMap', 'panelWarp', 'dlg'];

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
  set('clsTxt', classLabel(p));
  set('goldTxt', '🪙 ' + p.gold);
  set('zoneTxt', txt(DC.ZONES[S.zone] || DC.ZONES.harbor));
  set('spBadge', p.sp > 0 ? '★' + p.sp : '');
  set('curseTxt', p.curse > 0 ? '❄ ' + Math.ceil(p.curse) : '');

  var q = trackedQuest();
  set('questTrack', q ? questIcon(q) + ' ' + txt(DC.QUESTS[q].n) + ' — ' + progressText(q) : '');

  /* 동료 상태 */
  var a = DC.Battle.ally(0);
  var mb = $('mercBar');
  if (mb) {
    if (!a || !a.on) mb.hidden = true;
    else {
      mb.hidden = false;
      var d = DC.MERCS[a.id];
      set('mercIcon', d ? d.icon : '🎖');
      var f = $('mercFill');
      if (f) {
        f.style.width = Math.max(0, (a.hp / a.max) * 100) + '%';
        f.style.background = a.downT > 0 ? '#64748b' : d.color;
      }
      set('mercTxt', a.downT > 0 ? Math.ceil(a.downT) + 's' : '');
    }
  }

  /* 스킬 슬롯 — 직업/전직에 따라 아이콘이 바뀐다 */
  var ids = DC.Battle.skillIds(p);
  slot('cdS1', ids[0], p.cd1);
  slot('cdS2', ids[1], p.cd2);
  slot('cdS3', ids[2], p.cd3);
  var dEl = $('cdDash');
  if (dEl) dEl.classList.toggle('cool', p.dashCd > 0);
}

function slot(id, skillId, cd) {
  var el = $(id); if (!el) return;
  if (!skillId) { el.hidden = true; return; }
  el.hidden = false;
  var sk = DC.SKILLS[skillId];
  if (el.textContent !== sk.icon) el.textContent = sk.icon;
  el.classList.toggle('cool', cd > 0);
  el.title = txt(sk.n);
}

function set(id, v) { var el = $(id); if (el && el.textContent !== v) el.textContent = v; }

function classLabel(p) {
  var a = DC.advOf(p);
  if (a) return a.icon + ' ' + txt(a.n);
  var c = DC.classDef(p);
  return c.icon + ' ' + txt(c.n);
}

function questIcon(id) {
  var def = DC.QUESTS[id];
  if (!def) return '·';
  if (def.kind === 'main') return '★';
  if (def.kind === 'repeat') return '↻';
  return '·';
}

/** 추적할 의뢰 — 진행 중인 메인 챕터가 언제나 우선이다 */
function trackedQuest() {
  var ch = DC.curChapter(S);
  if (ch && DC.qs(S, ch.id) >= 1) return ch.id;
  var order = DC.QUEST_ORDER, i;
  for (i = 0; i < order.length; i++) {
    var q = S.quests[order[i]];
    if (q && q.state === 2) return order[i];
  }
  for (i = 0; i < order.length; i++) {
    var q2 = S.quests[order[i]];
    if (q2 && q2.state === 1) return order[i];
  }
  return ch ? ch.id : null;
}

function progressText(id) {
  var def = DC.QUESTS[id], q = S.quests[id];
  if (!def || !q) return '';
  if (q.state === 2) return TR('qReady');
  if (q.state === 3) return TR('qDone');
  if (q.state === 0) return TR('qOpen');
  var g = def.goal;
  if (g.type === 'kill' || g.type === 'killAny') return (q.prog || 0) + ' / ' + g.count;
  if (g.type === 'collect') return G.countItem(g.item) + ' / ' + g.count;
  if (g.type === 'counter') return relCount(q, g) + ' / ' + g.count;
  if (g.type === 'tier') return 'T' + ((S.counters && S.counters.maxTier) || 1) + ' / T' + g.tier;
  return TR('qActive');
}
/** rel:true 인 목표는 "수락 시점 이후" 증가분만 센다 (상시 의뢰용) */
function relCount(q, g) {
  var cur = (S.counters && S.counters[g.key]) || 0;
  return g.rel ? Math.max(0, cur - (q.base || 0)) : cur;
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
/** 튜토리얼 진행 표시 — 항상 떠 있는 한 줄 */
function step(text) {
  var el = $('stepBar'); if (!el) return;
  if (!text) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = text;
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
  var npc = DC.NPCS[npcId]; if (!npc) return false;
  dlgNpc = npc;
  return gotoNode(npc.root(S));
}
/**
 * show('dlg') 안의 closeAll() 이 dlgNpc/dlgNode 를 지우므로
 * NPC 참조는 지역 변수로 붙잡아 두고 패널을 연 뒤 다시 심는다.
 * (예전에는 show() 뒤에 dlgNpc.icon 을 읽어 대화가 열리자마자 예외로 끊겼다)
 */
function gotoNode(nodeId) {
  var npc = dlgNpc;
  if (!npc || !nodeId) { closeAll(); return false; }
  var node = npc.nodes[nodeId];
  if (!node) { closeAll(); return false; }

  show('dlg');
  dlgNpc = npc; dlgNode = node;

  set('dlgIcon', npc.icon);
  var nameEl = $('dlgName');
  if (nameEl) { nameEl.textContent = txt(npc.n); nameEl.style.color = npc.color; }
  set('dlgText', txt(node.t));

  var box = $('dlgChoices');
  if (box) {
    box.innerHTML = '';
    var list = node.c || [];
    if (!list.length) list = [{ t: { ko: TR('dlgClose'), en: TR('dlgClose') }, act: 'end' }];
    list.forEach(function (ch, i) {
      var b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = '<b>' + (i + 1) + '</b> ' + esc(txt(ch.t));
      b.onclick = function () { pickChoice(ch); };
      box.appendChild(b);
    });
  }
  return true;
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
    else if (cmd === 'board') { openBoard(); return; }
    else if (cmd === 'mercs') { openMerc(); return; }
    else if (cmd === 'advance') { openAdv(); return; }
    else if (cmd === 'heal') { G.healAt(); closeAll(); G.resume(); return; }
    else if (cmd === 'tutorial') { G.startTutorial(); closeAll(); G.resume(); return; }
    else if (cmd === 'tutskip') { G.skipTutorial(); closeAll(); G.resume(); return; }
    else if (cmd === 'end') { closeAll(); G.resume(); return; }
  }
  /* 보고 뒤 같은 NPC 가 다음 챕터를 바로 이어서 제안한다 */
  if (next === '__root' && dlgNpc) {
    if (!gotoNode(dlgNpc.root(S))) G.resume();
    return;
  }
  if (next) { if (!gotoNode(next)) G.resume(); }
  else { closeAll(); G.resume(); }
}

function dialogKey(n) {
  if (open !== 'dlg' || !dlgNode) return false;
  var list = dlgNode.c || [];
  if (n >= 1 && n <= list.length) { pickChoice(list[n - 1]); return true; }
  return false;
}

/* ══════════════════════════ 직업 선택 (시작 화면) ══════════════════════════
 * 별도 모달 대신 시작 화면에 얹는다 — "새 여정"을 누르면 지금 고른 직업으로 바로 출발하고,
 * 카드를 직접 누르면 그 직업으로 바로 시작한다.
 * ────────────────────────────────────────────────────────────────── */
var selCls = DC.DEFAULT_CLASS;

function renderClasses() {
  var box = $('classGrid'); if (!box) return;
  box.innerHTML = '';
  DC.CLASS_ORDER.forEach(function (id) {
    var c = DC.CLASSES[id];
    var card = document.createElement('button');
    card.className = 'clsCard' + (id === selCls ? ' sel' : '');
    card.style.borderColor = id === selCls ? c.color : '';
    var s1 = DC.SKILLS[c.s1], s2 = DC.SKILLS[c.s2];
    card.innerHTML =
      '<span class="clsIcon">' + c.icon + '</span>' +
      '<span class="clsName" style="color:' + c.color + '">' + esc(txt(c.n)) + '</span>' +
      '<span class="clsTip">' + esc(txt(c.tip)) + '</span>' +
      '<span class="clsDesc">' + esc(txt(c.d)) + '</span>' +
      '<span class="clsStats">' + TR('stStr') + ' ' + c.stats.str + ' · ' + TR('stAgi') + ' ' + c.stats.agi +
      ' · ' + TR('stVit') + ' ' + c.stats.vit + ' · ' + TR('stWil') + ' ' + c.stats.wil +
      ' · ♥ ' + c.hp + ' · ◆ ' + c.mp + '</span>' +
      '<span class="clsSkills">Q ' + s1.icon + ' ' + esc(txt(s1.n)) + ' · E ' + s2.icon + ' ' + esc(txt(s2.n)) + '</span>' +
      '<span class="clsGo">' + TR('classPick') + '</span>';
    card.onclick = function () {
      if (selCls !== id) { selCls = id; renderClasses(); return; }
      G.startAs(id);
    };
    box.appendChild(card);
  });
}

/* ══════════════════════════ 가방 · 장비 ══════════════════════════ */
function openInv() { show('panelInv'); renderInv(); }

function renderInv() {
  var p = S.p, st = DC.Battle.stats(p);

  var eq = $('equipList');
  if (eq) {
    eq.innerHTML = '<div class="eqRow"><span class="eqSlot">' + TR('clsLabel') + '</span>' +
      '<span class="eqName">' + esc(classLabel(p)) + '</span></div>' +
      ['weapon', 'armor', 'trinket'].map(function (slotId) {
        var it = DC.ITEMS[p.equip[slotId]];
        var label = TR(slotId === 'weapon' ? 'slotWeapon' : slotId === 'armor' ? 'slotArmor' : 'slotTrinket');
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
      row(TR('stCrit'), Math.round(st.crit * 100) + '%') + row(TR('stSpd'), Math.round(st.spd)) +
      (p.curse > 0 ? '<div class="stRow warn"><span>❄</span><b>' + TR('curseOn') + '</b></div>' : '');
  }

  var grid = $('invGrid'); if (!grid) return;
  grid.innerHTML = '';
  for (var i = 0; i < 20; i++) {
    var cell = document.createElement('div');
    cell.className = 'slot' + (i === selSlot ? ' sel' : '');
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
  var wrong = it.cls && it.cls !== DC.classOf(S.p);
  if (it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'trinket') {
    acts += wrong ? '<span class="dim">' + TR('wrongClass') + '</span>'
      : '<button data-act="equip">' + TR('equipBtn') + '</button>';
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
  set('treeCls', classLabel(p));
  var grid = $('treeGrid'); if (!grid) return;
  grid.innerHTML = '';
  var cls = DC.classOf(p);
  var lines = DC.TREE_LINES[cls];
  for (var line = 0; line < 3; line++) {
    var col = document.createElement('div');
    col.className = 'treeCol';
    col.innerHTML = '<div class="treeHead">' + lines[line][0] + ' ' + esc(txt(lines[line][1])) + '</div>';
    for (var tier = 0; tier < 3; tier++) {
      var node = findNode(cls, line, tier);
      if (node) col.appendChild(nodeEl(node, p));
    }
    grid.appendChild(col);
  }
}
function findNode(cls, line, tier) {
  var list = DC.TREES[cls] || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].line === line && list[i].tier === tier) return list[i];
  }
  return null;
}
function nodeEl(node, p) {
  var el = document.createElement('button');
  var cls = DC.classOf(p);
  var owned = !!p.tree[node.id];
  var prev = node.tier > 0 ? findNode(cls, node.line, node.tier - 1) : null;
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

function questRow(id, showState) {
  var def = DC.QUESTS[id], q = S.quests[id];
  if (!def || !q) return '';
  var badge = q.state === 3 ? TR('qDone') : q.state === 2 ? TR('qReady')
    : q.state === 1 ? TR('qActive') : TR('qOpen');
  var cls = q.state === 3 ? 'done' : q.state === 2 ? 'ready' : q.state === 1 ? 'active' : 'open';
  var head = def.kind === 'main'
    ? '<span class="qCh">' + DC.sub(TR('chapterOf'), { n: def.ch }) + '</span> '
    : '<span class="qKind">' + questIcon(id) + '</span> ';
  return '<div class="qRow ' + cls + ' ' + def.kind + '">' +
    '<div class="qTop">' + head + '<b>' + esc(txt(def.n)) + '</b>' +
    (showState !== false ? '<span class="qBadge">' + badge + '</span>' : '') + '</div>' +
    '<div class="qDesc">' + esc(txt(def.d)) + '</div>' +
    (def.area ? '<div class="qArea">' + DC.sub(TR('questTarget'), { n: esc(txt(def.area)) }) + '</div>' : '') +
    '<div class="qProg">' + progressText(id) + '</div></div>';
}

function renderQuests() {
  var list = $('questList'); if (!list) return;
  var html = '', any = false;

  var cur = DC.curChapter(S);
  html += '<div class="qGroup">' + TR('boardMain') + ' · ' +
    DC.chaptersDone(S) + ' / ' + DC.MAIN_COUNT + '</div>';
  DC.MAIN_ORDER.forEach(function (id) {
    var q = S.quests[id];
    if (!q) return;
    if (q.state === 0 && (!cur || cur.id !== id)) return;    // 아직 안 열린 챕터는 감춘다
    any = true;
    html += questRow(id);
  });

  var sideHtml = '';
  DC.SIDE_ORDER.forEach(function (id) {
    var q = S.quests[id];
    if (!q || q.state === 0) return;
    any = true;
    sideHtml += questRow(id);
  });
  if (sideHtml) html += '<div class="qGroup">' + TR('boardSide') + '</div>' + sideHtml;

  var repHtml = '';
  DC.REPEAT_ORDER.forEach(function (id) {
    var q = S.quests[id];
    if (!q || q.state === 0) return;
    any = true;
    repHtml += questRow(id);
  });
  if (repHtml) html += '<div class="qGroup">' + TR('boardRepeat') + '</div>' + repHtml;

  list.innerHTML = any ? html : '<span class="dim">' + TR('qNone') + '</span>';
}

/* ══════════════════════════ 의뢰 게시판 ══════════════════════════ */
function openBoard() { show('panelBoard'); renderBoard(); }

function renderBoard() {
  var box = $('boardList'); if (!box) return;
  box.innerHTML = '';
  var any = false;

  /* 본줄기 — 게시판에서는 진행 상황만 보여주고 담당 NPC 로 안내한다 */
  var cur = DC.curChapter(S);
  var head = document.createElement('div');
  head.className = 'qGroup';
  head.textContent = TR('boardMain') + ' · ' + DC.chaptersDone(S) + ' / ' + DC.MAIN_COUNT;
  box.appendChild(head);
  if (cur) {
    any = true;
    var mr = document.createElement('div');
    mr.innerHTML = questRow(cur.id);
    var giver = DC.NPCS[cur.giver];
    var note = document.createElement('div');
    note.className = 'bNote';
    note.textContent = DC.sub(TR('boardSeeNpc'), { n: giver ? txt(giver.n) : cur.giver });
    mr.firstChild.appendChild(note);
    box.appendChild(mr.firstChild);
  } else {
    box.appendChild(dim(TR('qDone')));
  }

  any = boardGroup(box, TR('boardSide'), DC.SIDE_ORDER) || any;
  any = boardGroup(box, TR('boardRepeat'), DC.REPEAT_ORDER) || any;
  if (!any) box.appendChild(dim(TR('boardNone')));
}

function dim(t) {
  var d = document.createElement('div');
  d.className = 'dim';
  d.textContent = t;
  return d;
}

function boardGroup(box, title, ids) {
  var rows = [], i;
  for (i = 0; i < ids.length; i++) {
    var id = ids[i], def = DC.QUESTS[id], q = S.quests[id];
    if (!def || !q || !def.board) continue;
    var row = document.createElement('div');
    row.innerHTML = questRow(id);
    var el = row.firstChild;
    if (def.kind === 'repeat') {
      var rn = document.createElement('div');
      rn.className = 'bNote';
      rn.textContent = DC.sub(TR('boardRepeatNote'), { n: q.done || 0 });
      el.appendChild(rn);
    }
    var acts = document.createElement('div');
    acts.className = 'bActs';
    if (q.state === 0) acts.appendChild(btn(TR('boardAccept'), id, 'accept'));
    else if (q.state === 2) acts.appendChild(btn(TR('boardTurnin'), id, 'turnin'));
    el.appendChild(acts);
    rows.push(el);
  }
  if (!rows.length) return false;
  var h = document.createElement('div');
  h.className = 'qGroup';
  h.textContent = title;
  box.appendChild(h);
  for (i = 0; i < rows.length; i++) box.appendChild(rows[i]);
  return true;
}

function btn(label, id, act) {
  var b = document.createElement('button');
  b.textContent = label;
  b.onclick = function () {
    if (act === 'accept') G.acceptQuest(id);
    else G.turnInQuest(id);
    renderBoard(); hud();
  };
  return b;
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
  var cls = DC.classOf(S.p);
  var ids = (DC.SHOPS[curShop] || []).filter(function (iid) {
    var it = DC.ITEMS[iid];
    return it && (!it.cls || it.cls === cls);
  });
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

/* ══════════════════════════ 용병 대기소 ══════════════════════════ */
function openMerc() { show('panelMerc'); renderMerc(); }

function renderMerc() {
  set('mercGold', '🪙 ' + S.p.gold);
  var list = $('mercList'); if (!list) return;
  list.innerHTML = '';
  var cur = S.p.merc, a = DC.Battle.ally(0);

  /* 현재 동료 */
  var head = document.createElement('div');
  head.className = 'qGroup';
  head.textContent = cur ? txt(DC.MERCS[cur.id].n) : TR('mercNone');
  list.appendChild(head);

  if (cur && a && a.on) {
    var d = DC.MERCS[cur.id];
    var box = document.createElement('div');
    box.className = 'mercCur';
    box.innerHTML = '<span class="mIcon">' + d.icon + '</span>' +
      '<span class="mBody"><b style="color:' + d.color + '">' + esc(txt(d.n)) + '</b>' +
      '<i>' + DC.sub(TR('mercLvTxt'), { n: cur.lv }) + ' · ' +
      DC.sub(TR('mercAlive'), { a: Math.ceil(a.hp), b: a.max }) + '</i></span>';
    var acts = document.createElement('div');
    acts.className = 'bActs';
    if (a.downT > 0) {
      var rv = document.createElement('button');
      rv.textContent = DC.sub(TR('mercRevive'), { g: DC.MERC_REVIVE_COST });
      rv.disabled = S.p.gold < DC.MERC_REVIVE_COST;
      rv.onclick = function () { G.reviveMerc(); renderMerc(); hud(); };
      acts.appendChild(rv);
    }
    var upCost = DC.mercUpCost(cur.lv);
    var up = document.createElement('button');
    up.textContent = cur.lv >= DC.MERC_MAXLV ? TR('mercMax') : DC.sub(TR('mercUp'), { g: upCost });
    up.disabled = cur.lv >= DC.MERC_MAXLV || S.p.gold < upCost;
    up.onclick = function () { G.trainMerc(); renderMerc(); hud(); };
    acts.appendChild(up);
    var ds = document.createElement('button');
    ds.className = 'ghost';
    ds.textContent = TR('mercDismiss');
    ds.onclick = function () { G.dismissMerc(); renderMerc(); hud(); };
    acts.appendChild(ds);
    box.appendChild(acts);
    list.appendChild(box);
  }

  /* 고용 가능한 사람들 */
  var h2 = document.createElement('div');
  h2.className = 'qGroup';
  h2.textContent = TR('mercTitle');
  list.appendChild(h2);

  DC.MERC_ORDER.forEach(function (id) {
    var d = DC.MERCS[id];
    var st = DC.mercStat(id, 1);
    var r = document.createElement('div');
    r.className = 'shopRow';
    r.innerHTML = '<span class="sIcon">' + d.icon + '</span>' +
      '<span class="sBody"><b style="color:' + d.color + '">' + esc(txt(d.n)) + '</b>' +
      '<i>' + esc(txt(d.d)) + '</i>' +
      '<i class="dim">HP ' + st.hp + ' · ATK ' + st.atk + '</i></span>' +
      '<span class="sPrice">🪙' + d.cost + '</span>';
    var b = document.createElement('button');
    b.textContent = DC.sub(TR('mercHire'), { g: d.cost });
    b.disabled = !!cur || S.p.gold < d.cost;
    b.onclick = function () { G.hireMerc(id); renderMerc(); hud(); };
    r.appendChild(b);
    list.appendChild(r);
  });
}

/* ══════════════════════════ 갈림길 (전직) ══════════════════════════ */
function openAdv() { show('panelAdv'); renderAdv(); }

function renderAdv() {
  var p = S.p;
  var box = $('advList'); if (!box) return;
  box.innerHTML = '';
  var cur = DC.advOf(p);
  var note = $('advNote');

  if (cur) {
    if (note) note.textContent = DC.sub(TR('advDone'), { n: txt(cur.n) });
    box.appendChild(dim(txt(cur.d)));
    return;
  }
  var qDef = DC.QUESTS[DC.ADV_QUEST];
  var ok = p.lv >= DC.ADV_LEVEL && DC.qs(S, DC.ADV_QUEST) === 3;
  if (note) {
    note.textContent = ok ? TR('advWarn')
      : DC.sub(TR('advNeed'), { lv: DC.ADV_LEVEL, q: txt(qDef.n) });
  }

  (DC.ADV_OF[DC.classOf(p)] || []).forEach(function (id) {
    var a = DC.ADVANCES[id], sk = DC.SKILLS[a.skill];
    var card = document.createElement('button');
    card.className = 'clsCard';
    card.style.borderColor = a.color;
    card.innerHTML =
      '<span class="clsIcon">' + a.icon + '</span>' +
      '<span class="clsName" style="color:' + a.color + '">' + esc(txt(a.n)) + '</span>' +
      '<span class="clsDesc">' + esc(txt(a.d)) + '</span>' +
      '<span class="clsSkills">R ' + sk.icon + ' ' + esc(txt(sk.n)) + ' — ' + esc(txt(sk.d)) + '</span>' +
      '<span class="clsGo">' + (ok ? TR('advPick') : TR('qLocked')) + '</span>';
    card.disabled = !ok;
    card.onclick = function () {
      if (G.advance(id)) { renderAdv(); hud(); }
    };
    box.appendChild(card);
  });
}

/* ══════════════════════════ 여관 ══════════════════════════ */
function openInn() {
  show('panelInn');
  var free = DC.qs(S, 'm4_keeper') === 3;
  var b = $('innRestBtn');
  if (b) {
    b.textContent = free ? TR('freeRestBtn') : TR('restBtn');
    b.disabled = !free && S.p.gold < 30;
  }
}

/* ══════════════════════════ 확대 지도 ══════════════════════════ */
var mapZoom = 1;

function openMap() {
  show('panelMap');
  drawMap();
}
function mapZoomBy(d) {
  var n = DC.World.MAP_SPANS.length;
  mapZoom = Math.max(0, Math.min(n - 1, mapZoom + d));
  drawMap();
}
/** 이번 챕터의 목표를 지도 위에 표시 */
function chapterMark() {
  var c = DC.curChapter(S);
  if (!c) return null;
  if (c.goal.type === 'tier') return { tier: c.goal.tier };
  if (c.id === 'm3_signal' || c.id === 'm4_keeper') {
    return { cx: DC.World.CAPE_CX, cy: DC.World.CAPE_CY };
  }
  if (c.id === 'm8_farshore') return { tier: 5 };
  if (c.id === 'm1_awake' || c.id === 'm2_fence') {
    return { cx: DC.World.HCX, cy: DC.World.HCY };
  }
  return null;
}
function drawMap() {
  var cv = $('mapCv'); if (!cv || !cv.getContext) return;
  var g = cv.getContext('2d'); if (!g) return;
  var span = DC.World.MAP_SPANS[mapZoom];
  DC.World.drawWorldMap(g, cv.width, cv.height, S.p.x, S.p.y, span, chapterMark());
  var c = DC.curChapter(S);
  set('mapInfo', (c ? '★ ' + txt(c.n) + ' — ' + txt(c.area) : '') +
    '  ·  ' + span + '×' + span);
  set('mapWpInfo', goalWaypoint(G.waypointList()));
  var lg = $('mapLegend');
  if (lg) {
    lg.innerHTML =
      '<span style="color:#ffffff">●</span> ' + TR('mapYou') +
      ' &nbsp; <span style="color:#eab308">⌂</span> ' + TR('mapHarbor') +
      ' &nbsp; <span style="color:#7dd3fc">☗</span> ' + TR('mapCape') +
      ' &nbsp; <span style="color:#38bdf8">◆</span> ' + TR('mapWp') +
      ' &nbsp; <span style="color:#2a4a63">◆</span> ' + TR('mapWpOff') +
      ' &nbsp; <span style="color:#c084fc">■</span> ' + TR('mapDelve') +
      ' &nbsp; <span style="color:#22c55e">◎</span> ' + TR('mapGoal') +
      ' &nbsp; <span style="color:#121a2a">■</span> ' + TR('mapUnseen');
  }
}

/* ══════════════════════════ 웨이포인트 ══════════════════════════
 * F(비석 앞)와 지도의 「이동」 버튼이 같은 패널을 연다.
 * 목록 자체는 어디서든 열람할 수 있고, 실제 출발만 비석 앞으로 제한된다 —
 * 다음 목적지를 지도 보며 고르는 동선을 막지 않으려는 절충.
 * ────────────────────────────────────────────────────────────────── */
function openWarp() { show('panelWarp'); renderWarp(); }

/** 이번 챕터 목표에 가장 가까운 활성 비석 — 재도전 동선을 짧게 만든다 */
function goalWaypoint(rows) {
  var m = chapterMark();
  if (!m || !rows.length) return '';
  var best = null, bd = Infinity;
  rows.forEach(function (r) {
    var d;
    if (m.cx != null) d = Math.max(Math.abs(r.cx - m.cx), Math.abs(r.cy - m.cy));
    else if (m.tier) { if (r.tier < m.tier) return; d = r.dist; }
    else return;
    if (d < bd) { bd = d; best = r; }
  });
  return best ? DC.sub(TR('warpGoalNote'), { n: best.name, d: bd }) : TR('warpGoalNone');
}

function renderWarp() {
  var rows = G.waypointList();
  var block = G.warpBlock(true);
  set('warpNote', DC.sub(TR('warpCount'), { n: rows.length }) + ' · ' + TR(block || 'warpReady'));
  set('warpGoal', goalWaypoint(rows));

  var list = $('warpList'); if (!list) return;
  list.innerHTML = '';
  if (!rows.length) { list.appendChild(dim(TR('warpNone'))); return; }
  rows.forEach(function (r) {
    var row = document.createElement('div');
    row.className = 'shopRow';
    row.innerHTML = '<span class="sIcon">🚩</span>' +
      '<span class="sBody"><b>' + esc(r.name) + '</b>' +
      '<i>(' + r.cx + ',' + r.cy + ') · T' + r.tier + '</i></span>' +
      '<span class="sPrice">' +
      (r.here ? TR('warpHere') : DC.sub(TR('warpDist'), { n: r.dist, g: r.cost })) + '</span>';
    var b = document.createElement('button');
    b.textContent = TR('warpGo');
    b.disabled = r.here || !!block || S.p.gold < r.cost;
    b.onclick = function () { if (!G.warpTo(r.wid)) { renderWarp(); hud(); } };
    row.appendChild(b);
    list.appendChild(row);
  });
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
    var zi = $('mapIn'); if (zi) zi.onclick = function () { mapZoomBy(1); };
    var zo = $('mapOut'); if (zo) zo.onclick = function () { mapZoomBy(-1); };
    var mw = $('mapWarp'); if (mw) mw.onclick = function () { openWarp(); };
  },
  bind: function (state) { S = state; shownHints = {}; },
  hud: hud, bossBar: bossBar, tickFx: tickFx,
  hint: hint, hintOnce: hintOnce, banner: banner, step: step,
  closeAll: closeAll, isOpen: isOpen, openPanel: function () { return open; },
  openDialog: openDialog, openShop: openShop, openInv: openInv,
  openTree: openTree, openQuests: openQuests, openInn: openInn, openPause: openPause,
  openBoard: openBoard, openMerc: openMerc, openAdv: openAdv, openMap: openMap,
  openWarp: openWarp,
  renderClasses: renderClasses,
  selectedClass: function () { return selCls; },
  mapZoom: mapZoomBy,
  dialogKey: dialogKey,
  refresh: function () {
    if (open === 'panelInv') renderInv();
    else if (open === 'panelTree') renderTree();
    else if (open === 'panelQuest') renderQuests();
    else if (open === 'panelShop') renderShop();
    else if (open === 'panelBoard') renderBoard();
    else if (open === 'panelMerc') renderMerc();
    else if (open === 'panelAdv') renderAdv();
    else if (open === 'panelMap') drawMap();
    else if (open === 'panelWarp') renderWarp();
    hud();
  },
};
})();
