'use strict';
(function () {
/**
 * 표류 대륙 — 전투: 직업별 플레이어 액션 / 동료 / 적 AI / 판정 / 파티클.
 *
 * 성능 규칙
 *  - 적·투사체·장판·파티클·데미지 팝업은 전부 고정 크기 오브젝트 풀 (런타임 할당 0)
 *  - 화면 밖 1.4 화면 바깥의 적은 AI 를 돌리지 않는다 (컬링)
 *  - 청크가 언로드되면 그 청크 소속 적은 즉시 반환된다
 *  - 동료는 최대 2기(고용 용병 + 소환 그림자) 고정 슬롯 — 배열 할당이 없다
 */
var DC = window.DC || (window.DC = {});

var W = null;      // DC.World
var S = null;      // 게임 상태
var hooks = {};    // core 가 꽂는 콜백

var VIEW_W = 960, VIEW_H = 540;

/* ══════════════════════════ 오브젝트 풀 ══════════════════════════ */
function Pool(cap, factory) {
  this.items = new Array(cap);
  for (var i = 0; i < cap; i++) { this.items[i] = factory(); this.items[i].on = false; }
  this.cur = 0;
}
Pool.prototype.take = function () {
  var n = this.items.length;
  for (var k = 0; k < n; k++) {
    this.cur = (this.cur + 1) % n;
    if (!this.items[this.cur].on) { this.items[this.cur].on = true; return this.items[this.cur]; }
  }
  return null;
};
Pool.prototype.each = function (fn) {
  for (var i = 0; i < this.items.length; i++) if (this.items[i].on) fn(this.items[i], i);
};
Pool.prototype.clear = function () { for (var i = 0; i < this.items.length; i++) this.items[i].on = false; };
Pool.prototype.count = function () { var c = 0; for (var i = 0; i < this.items.length; i++) if (this.items[i].on) c++; return c; };

var enemies = new Pool(120, function () {
  return { x: 0, y: 0, vx: 0, vy: 0, hp: 0, max: 0, t: '', d: null, r: 12, chunk: '', id: '',
    st: 0, tm: 0, cd: 0, cd2: 0, touch: 0, hurt: 0, kb: 0, kbx: 0, kby: 0, fx: 1, fy: 0,
    phase: 1, summoned: 0, unique: false, slow: 0, taunt: 0 };
});
var shots = new Pool(240, function () {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, foe: false, r: 6, pierce: 0, hitIds: null,
    kind: 'bolt', spin: 0, slow: 0, burst: 0 };
});
var parts = new Pool(340, function () {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, c: '#fff' };
});
var pops = new Pool(64, function () {
  return { x: 0, y: 0, vy: 0, life: 0, txt: '', c: '#fff', big: false };
});
/* 장판 — 잔불 / 덫 / 소용돌이. 주기적으로 범위 판정만 돈다 */
var fields = new Pool(18, function () {
  return { x: 0, y: 0, r: 0, life: 0, tick: 0, every: 0.5, dmg: 0, slow: 0, kind: '', c: '#fff' };
});

/* ══════════════════════════ 파생 스탯 ══════════════════════════ */
function mods(p) {
  var t = p.tree || {};
  var a = DC.advOf(p);
  var b = (a && a.bonus) || {};
  return {
    /* 기사 */
    comboDmg: t.blade1 ? 0.20 : 0,
    exec: t.blade2 ? 0.40 : 0,
    shock: !!t.blade3,
    bulwarkDmg: t.tide1 ? 0.35 : 0,
    bulwarkDr: t.tide1 ? 0.10 : 0,
    killHeal: t.tide2 ? 3 : 0,
    whirlR: t.tide3 ? 0.40 : 0,
    whirlDmg: t.tide3 ? 0.25 : 0,
    dr: (t.grit1 ? 0.12 : 0) + (b.dr || 0),
    dashCd: (t.grit2 ? 0.75 : 1) * (t.swf2 ? 0.70 : 1),
    iframe: (t.grit2 ? 0.06 : 0) + (t.swf2 ? 0.05 : 0),
    guardian: !!t.grit3,
    /* 궁수 */
    shotDmg: t.aim1 ? 0.25 : 0,
    shotPierce: t.aim3 ? 1 : 0,
    volleyExtra: t.vol1 ? 1 : 0,
    rate: (t.vol1 ? 0.20 : 0) + (b.rate || 0),
    pinDmg: t.vol2 ? 0.40 : 0,
    twin: !!t.vol3,
    moveBonus: (t.swf1 ? 0.12 : 0) + (b.spd || 0),
    afterimage: !!t.swf3,
    /* 마법사 */
    emberDmg: t.emb1 ? 0.30 : 0,
    emberBurn: !!t.emb2,
    emberR: t.emb3 ? 0.40 : 0,
    frostPierce: t.frs1 ? 2 : 0,
    frostSlow: t.frs1 ? 0.8 : 0,
    vsSlow: t.frs2 ? 0.25 : 0,
    frostBurst: !!t.frs3,
    regen: (t.man1 ? 1.2 : 0) + (b.regen || 0),
    mpCost: t.man2 ? 0.80 : 1,
    freeCast: !!t.man3,
    /* 전직 보너스 */
    area: b.area || 0,
    range: b.range || 0,
    critAdd: b.crit || 0,
    atkMul: b.atk || 0,
    hpMul: b.maxHp || 0,
    mpMul: b.maxMp || 0,
    defMul: b.def || 0,
    canSummon: !!b.summon,
  };
}

function gearOf(p) {
  var g = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, cdr: 0 };
  ['weapon', 'armor', 'trinket'].forEach(function (slot) {
    var it = DC.ITEMS[p.equip[slot]];
    if (!it) return;
    g.atk += it.atk || 0; g.def += it.def || 0; g.hp += it.hp || 0;
    g.mp += it.mp || 0; g.crit += it.crit || 0; g.cdr += it.cdr || 0;
  });
  return g;
}

/** 표시·계산용 최종 스탯 */
function stats(p) {
  var g = gearOf(p), m = mods(p);
  var cls = DC.classOf(p);
  var spdK = cls === 'ranger' ? 1.12 : (cls === 'mage' ? 0.96 : 1);
  var curse = (p.curse > 0) ? 0.85 : 1;
  return {
    maxHp: Math.round((40 + p.vit * 8 + g.hp) * (1 + m.hpMul) * curse),
    maxMp: Math.round((20 + p.wil * 5 + g.mp) * (1 + m.mpMul)),
    atk: (5 + p.str * 2 + g.atk) * (1 + m.atkMul) * (1 + (p.buffAtk || 0)),
    def: (p.vit * 0.5 + g.def + (cls === 'knight' ? 2 : 0)) * (1 + m.defMul),
    crit: 0.03 + p.agi * 0.007 + g.crit + m.critAdd + (cls === 'ranger' ? 0.04 : 0) + (p.critT > 0 ? 0.25 : 0),
    spd: (140 + p.agi * 2.5) * spdK * (1 + m.moveBonus) * (1 + (p.buffSpd || 0)),
    cdr: g.cdr,
    dr: m.dr,
    gearAtk: g.atk, gearDef: g.def,
  };
}

/* ══════════════════════════ 이펙트 헬퍼 ══════════════════════════ */
function burst(x, y, n, color, spd, size) {
  for (var i = 0; i < n; i++) {
    var p = parts.take(); if (!p) return;
    var a = Math.random() * 6.2832, v = spd * (0.35 + Math.random() * 0.9);
    p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
    p.life = p.max = 0.25 + Math.random() * 0.35; p.c = color; p.size = size || 3;
  }
}
function popup(x, y, txt, color, big) {
  var p = pops.take(); if (!p) return;
  p.x = x + (Math.random() * 16 - 8); p.y = y - 12; p.vy = -46;
  p.life = 0.75; p.txt = txt; p.c = color; p.big = !!big;
}
function field(kind, x, y, r, life, dmg, slow, every, color) {
  var f = fields.take(); if (!f) return null;
  f.kind = kind; f.x = x; f.y = y; f.r = r; f.life = life;
  f.dmg = dmg; f.slow = slow || 0; f.every = every || 0.5; f.tick = 0; f.c = color || '#eab308';
  return f;
}

/* ══════════════════════════ 적 스폰 / 반환 ══════════════════════════ */
function spawnEnemy(type, x, y, chunkKey, id, unique) {
  var d = DC.ENEMIES[type]; if (!d) return null;
  var e = enemies.take(); if (!e) return null;
  e.t = type; e.d = d; e.x = x; e.y = y; e.vx = e.vy = 0;
  e.max = d.hp; e.hp = d.hp; e.r = d.r; e.chunk = chunkKey || ''; e.id = id || '';
  e.st = 0; e.tm = 0; e.cd = Math.random() * 1.2; e.cd2 = 1.5; e.touch = 0;
  e.hurt = 0; e.kb = 0; e.kbx = 0; e.kby = 0; e.fx = 0; e.fy = 1;
  e.phase = 1; e.summoned = 0; e.unique = !!unique; e.slow = 0; e.taunt = 0;
  e.hx = x; e.hy = y;             // 정예·보스가 되돌아갈 자리
  return e;
}

/* 표착항에서 먼 청크일수록 적이 강해진다 — 티어별 능력치 정의를 만들어 캐시한다 */
var TIER_MUL = [1, 1, 1.25, 1.6, 2.05, 2.6];
var tierDefs = {};

function defFor(type, tier) {
  var base = DC.ENEMIES[type];
  var mul = TIER_MUL[tier] || 1;
  if (!base || mul === 1) return base;
  var k = type + '@' + tier;
  if (tierDefs[k]) return tierDefs[k];
  var d = {};
  for (var p in base) if (Object.prototype.hasOwnProperty.call(base, p)) d[p] = base[p];
  d.hp = Math.round(base.hp * mul);
  d.atk = Math.round(base.atk * (1 + (mul - 1) * 0.7));
  d.def = Math.round(base.def * (1 + (mul - 1) * 0.6));
  d.xp = Math.round(base.xp * (1 + (mul - 1) * 0.8));
  d.gold = Math.round(base.gold * (1 + (mul - 1) * 0.8));
  d.tier = tier;
  tierDefs[k] = d;
  return d;
}

function spawnChunk(ch) {
  for (var i = 0; i < ch.spawns.length; i++) {
    var s = ch.spawns[i];
    var e = spawnEnemy(s.t, ch.ox + s.tx * W.TILE + 16, ch.oy + s.ty * W.TILE + 16, ch.key, s.id, s.unique);
    if (e && s.tier > 1) {
      e.d = defFor(s.t, s.tier);
      e.max = e.d.hp; e.hp = e.d.hp;
    }
  }
}

function despawnChunk(key) {
  enemies.each(function (e) { if (e.chunk === key) e.on = false; });
}

/* ══════════════════════════ 동료 ══════════════════════════
 * 슬롯 2개 고정 — 0 고용 용병(세이브에 남는다) · 1 소환 그림자(임시).
 * 쓰러져도 사라지지 않는다: downT 를 세다가 스스로 일어나고,
 * 마을 치유소·대기소에서 금화로 즉시 소생시킬 수도 있다.
 * ────────────────────────────────────────────────────────────────── */
function newAlly() {
  return { on: false, id: '', lv: 1, x: 0, y: 0, fx: 0, fy: 1, hp: 0, max: 0,
    cd: 0, healCd: 0, downT: 0, temp: false, life: 0, hurt: 0, st: null, r: 11 };
}
var allies = [newAlly(), newAlly()];

/** 세이브의 S.p.merc 를 실제 동료 슬롯에 반영 */
function syncMerc() {
  var a = allies[0];
  var m = S && S.p && S.p.merc;
  if (!m || !DC.MERCS[m.id]) { a.on = false; return; }
  var st = DC.mercStat(m.id, m.lv);
  a.on = true; a.id = m.id; a.lv = m.lv; a.temp = false; a.st = st; a.max = st.hp;
  a.hp = (m.hp != null) ? Math.min(m.hp, st.hp) : st.hp;
  a.downT = m.down || 0;
  if (a.hp <= 0 && a.downT <= 0) { a.hp = st.hp; }
  a.x = S.p.x - 26; a.y = S.p.y + 18;
  a.cd = 0; a.healCd = 0; a.hurt = 0; a.r = 11;
}
/** 동료 상태를 세이브로 되돌린다 (숫자 3개만 — 매 프레임 호출해도 싸다) */
function pushMerc() {
  var a = allies[0], m = S && S.p && S.p.merc;
  if (!m || !a.on) return;
  m.hp = Math.round(a.hp); m.down = Math.round(a.downT * 10) / 10; m.lv = a.lv;
}

function summonShade(dur, atk) {
  var a = allies[1];
  a.on = true; a.id = 'shade'; a.temp = true; a.life = dur; a.lv = 1;
  a.st = { hp: 60, atk: atk, spd: 178, range: 300, rate: 1.0, heal: 0, healCd: 0 };
  a.max = 60; a.hp = 60; a.downT = 0; a.cd = 0; a.hurt = 0; a.r = 11;
  a.x = S.p.x - 20; a.y = S.p.y - 20;
  burst(a.x, a.y, 16, '#a78bfa', 170, 3);
}

function allyDef(a) {
  return a.temp
    ? { icon: '👻', color: '#a78bfa', role: 'ranged', n: { ko: '그림자', en: 'Shade' } }
    : DC.MERCS[a.id];
}

function hurtAlly(a, raw, sx, sy) {
  if (!a.on || a.downT > 0) return;
  var dmg = Math.max(1, Math.round(raw * (allyDef(a).role === 'tank' ? 0.62 : 0.9)));
  a.hp -= dmg; a.hurt = 0.14;
  popup(a.x, a.y - 20, '-' + dmg, '#fca5a5');
  if (sx != null) burst(a.x, a.y, 4, '#ef4444', 110, 2);
  if (a.hp <= 0) {
    a.hp = 0;
    burst(a.x, a.y, 18, allyDef(a).color, 180, 4);
    if (a.temp) { a.on = false; return; }
    a.downT = DC.MERC_DOWN;
    if (hooks.onMercDown) hooks.onMercDown(a.id, a.downT);
  }
}

function updateAllies(dt) {
  var p = S.p;
  for (var i = 0; i < allies.length; i++) {
    var a = allies[i];
    if (!a.on) continue;
    if (a.temp) {
      a.life -= dt;
      if (a.life <= 0) { a.on = false; burst(a.x, a.y, 12, '#a78bfa', 140, 3); continue; }
    }
    a.hurt = Math.max(0, a.hurt - dt);
    if (a.downT > 0) {
      a.downT -= dt;
      if (a.downT <= 0) {
        a.downT = 0; a.hp = a.max;
        a.x = p.x - 24; a.y = p.y + 16;
        burst(a.x, a.y, 14, allyDef(a).color, 150, 3);
        if (hooks.onMercUp) hooks.onMercUp(a.id);
      }
      continue;
    }
    stepAlly(a, dt);
  }
  pushMerc();
}

function stepAlly(a, dt) {
  var p = S.p, def = allyDef(a), st = a.st;
  var role = def.role;
  a.cd -= dt; a.healCd -= dt;

  var tgt = nearestTo(a.x, a.y, role === 'ranged' ? st.range + 90 : 300);
  var pdx = p.x - a.x, pdy = p.y - a.y, pd = Math.hypot(pdx, pdy);

  /* 플레이어와 너무 벌어지면 무조건 따라붙는다 (길 잃음 방지) */
  if (pd > 420) { a.x = p.x - 24; a.y = p.y + 16; return; }

  var mvx = 0, mvy = 0;
  if (role === 'tank' && tgt) {
    var td = Math.hypot(tgt.x - a.x, tgt.y - a.y);
    if (td > st.range * 0.8) { mvx = (tgt.x - a.x) / td; mvy = (tgt.y - a.y) / td; }
    tgt.taunt = 1.2;                                  // 시선을 끈다
    if (td < st.range && a.cd <= 0) {
      a.cd = st.rate;
      a.fx = (tgt.x - a.x) / (td || 1); a.fy = (tgt.y - a.y) / (td || 1);
      allySweep(a, st.atk * 1.15);
    }
  } else if (role === 'ranged' && tgt) {
    var td2 = Math.hypot(tgt.x - a.x, tgt.y - a.y);
    if (pd > 150) { mvx = pdx / (pd || 1); mvy = pdy / (pd || 1); }
    else if (td2 < 110) { mvx = -(tgt.x - a.x) / (td2 || 1); mvy = -(tgt.y - a.y) / (td2 || 1); }
    if (td2 < st.range && a.cd <= 0 && W.clearLine(a.x, a.y, tgt.x, tgt.y)) {
      a.cd = st.rate;
      var l = td2 || 1;
      a.fx = (tgt.x - a.x) / l; a.fy = (tgt.y - a.y) / l;
      var s = fire(a.x + a.fx * 12, a.y + a.fy * 12, a.fx * 400, a.fy * 400, st.atk, false, 'ally', 0);
      if (s) s.r = 6;
    }
  } else {
    /* 회복형 · 대상 없음 — 플레이어 곁을 지킨다 */
    if (pd > 70) { mvx = pdx / (pd || 1); mvy = pdy / (pd || 1); }
    if (role === 'healer' && a.healCd <= 0) {
      var pst = stats(p);
      if (p.hp < pst.maxHp) {
        a.healCd = st.healCd || 4.5;
        p.hp = Math.min(pst.maxHp, p.hp + st.heal);
        popup(p.x, p.y - 26, '+' + st.heal, '#22c55e');
        burst(p.x, p.y, 6, '#eab308', 90, 2);
      } else {
        a.healCd = 0.6;                      // 멀쩡할 땐 자주 들여다보지 않는다
      }
    }
    if (role === 'healer' && tgt && a.cd <= 0) {
      var td3 = Math.hypot(tgt.x - a.x, tgt.y - a.y);
      if (td3 < st.range) {
        a.cd = st.rate;
        a.fx = (tgt.x - a.x) / (td3 || 1); a.fy = (tgt.y - a.y) / (td3 || 1);
        allySweep(a, st.atk);
      }
    }
  }

  if (mvx || mvy) {
    var ml = Math.hypot(mvx, mvy) || 1;
    W.move(a, (mvx / ml) * st.spd * dt, (mvy / ml) * st.spd * dt);
    a.fx = mvx / ml; a.fy = mvy / ml;
  }
}

function allySweep(a, dmg) {
  var hit = 0;
  enemies.each(function (e) {
    var dx = e.x - a.x, dy = e.y - a.y, l = Math.hypot(dx, dy);
    if (l > 52 + e.r) return;
    if (l > 1 && (dx / l) * a.fx + (dy / l) * a.fy < -0.25) return;
    damageEnemy(e, dmg, (dx / (l || 1)) * 140, (dy / (l || 1)) * 140, 'ally');
    hit++;
  });
  burst(a.x + a.fx * 20, a.y + a.fy * 20, 4, allyDef(a).color, 110, 2);
  return hit;
}

function nearestTo(x, y, maxD) {
  var best = null, bd = maxD || 1e9;
  enemies.each(function (e) {
    var d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  });
  return best;
}

/* ══════════════════════════ 플레이어 ══════════════════════════ */
function attach(p) {
  p.atkT = 0; p.atkStage = 0; p.comboT = 0; p.dashT = 0; p.dashCd = 0;
  p.inv = p.inv || 0; p.iframe = 0; p.hitT = 0; p.guardCd = 0;
  p.cd1 = 0; p.cd2 = 0; p.cd3 = 0; p.shake = 0; p.r = 13;
  p.guardT = 0; p.guardDr = 0; p.sancT = 0; p.sancHeal = 0; p.sancDr = 0;
  p.buffT = 0; p.buffAtk = 0; p.buffSpd = 0; p.buffDr = 0;
  p.critT = 0; p.chargeT = 0; p.chargeDmg = 0;
  p.curse = p.curse || 0;
  if (!p.fx && !p.fy) { p.fx = 0; p.fy = 1; }
  syncMerc();
}

function damageEnemy(e, raw, kbx, kby, src) {
  var p = S.p, m = mods(p), st = stats(p);
  var dmg = raw;
  if (m.exec && e.hp / e.max < 0.3) dmg *= 1 + m.exec;
  if (m.vsSlow && e.slow > 0) dmg *= 1 + m.vsSlow;
  /* 방패병은 정면 피해를 크게 줄인다 — 등 뒤를 노리거나 마무리 타격으로 뚫어야 한다 */
  if (e.t === 'shield' && src !== 'break') {
    var dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
    if ((dx / l) * e.fx + (dy / l) * e.fy > 0.35) {
      dmg *= 0.15;
      popup(e.x, e.y - e.r, 'GUARD', '#7dd3fc');
      burst(e.x + e.fx * 14, e.y + e.fy * 14, 5, '#7dd3fc', 90, 2);
    }
  }
  var crit = Math.random() < st.crit;
  if (crit) dmg *= 1.7;
  dmg = Math.max(1, Math.round(dmg * (0.92 + Math.random() * 0.16) - e.d.def));
  e.hp -= dmg;
  e.hurt = 0.14;
  e.kb = 0.16; e.kbx = kbx || 0; e.kby = kby || 0;
  popup(e.x, e.y - e.r - 4, String(dmg), crit ? '#eab308' : '#ffffff', crit);
  burst(e.x, e.y, crit ? 8 : 4, e.d.body, 130, 3);
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}

function killEnemy(e) {
  e.on = false;
  burst(e.x, e.y, 16, e.d.body, 190, 4);
  var p = S.p, m = mods(p);
  if (m.killHeal) {
    var st = stats(p);
    p.hp = Math.min(st.maxHp, p.hp + m.killHeal);
  }
  if (e.unique && e.id && S.flags) S.flags['slain_' + e.id] = true;
  if (hooks.onKill) hooks.onKill(e);
}

/** 외부(월드 함정 등)에서도 쓰는 피격 처리 */
function hurtPlayer(raw, sx, sy, ignoreIframe, chill) {
  var p = S.p;
  if (p.hp <= 0) return;
  if (!ignoreIframe && (p.iframe > 0 || p.dashT > 0)) return;
  var st = stats(p), m = mods(p);
  var mit = m.dr + (p.guardT > 0 ? p.guardDr : 0) + (p.sancT > 0 ? p.sancDr : 0) + (p.buffT > 0 ? p.buffDr : 0);
  if (mit > 0.85) mit = 0.85;
  var dmg = Math.max(1, Math.round((raw - st.def) * (1 - mit)));
  if (p.hp - dmg <= 0 && m.guardian && p.guardCd <= 0) {
    p.hp = 1; p.guardCd = 60; p.iframe = 1.4;
    popup(p.x, p.y - 22, '불굴', '#eab308', true);
    burst(p.x, p.y, 22, '#eab308', 210, 4);
    return;
  }
  p.hp -= dmg;
  p.iframe = 0.62 + m.iframe;
  p.shake = Math.min(9, 4 + dmg * 0.14);
  popup(p.x, p.y - 20, '-' + dmg, '#ef4444', dmg > 20);
  burst(p.x, p.y, 6, '#ef4444', 130, 3);
  if (chill && !(p.curse > 0)) {
    p.curse = 30;
    if (hooks.onCurse) hooks.onCurse();
  } else if (chill) p.curse = Math.max(p.curse, 30);
  if (sx != null) {
    var dx = p.x - sx, dy = p.y - sy, l = Math.hypot(dx, dy) || 1;
    p.kbx = (dx / l) * 190; p.kby = (dy / l) * 190; p.kb = 0.14;
  }
  if (p.hp <= 0) { p.hp = 0; if (hooks.onDeath) hooks.onDeath(); }
}

/** 부채꼴 판정 — 근접 공격 공용 */
function sweep(x, y, fx, fy, range, arcCos, dmg, src) {
  var hit = 0;
  enemies.each(function (e) {
    var dx = e.x - x, dy = e.y - y, l = Math.hypot(dx, dy);
    if (l > range + e.r) return;
    if (l > 1 && (dx / l) * fx + (dy / l) * fy < arcCos) return;
    damageEnemy(e, dmg, (dx / (l || 1)) * 210, (dy / (l || 1)) * 210, src);
    hit++;
  });
  return hit;
}

function fire(x, y, vx, vy, dmg, foe, kind, pierce) {
  var s = shots.take(); if (!s) return null;
  s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.dmg = dmg; s.foe = !!foe;
  s.life = 2.4; s.kind = kind || 'bolt'; s.pierce = pierce || 0;
  s.r = (kind === 'spear' || kind === 'lance') ? 10 : 6;
  s.spin = 0; s.slow = 0; s.burst = 0;
  if (!s.hitIds) s.hitIds = [];
  s.hitIds.length = 0;
  return s;
}

/* ══════════════════════════ 조준 ══════════════════════════ */
/** 원거리 기본 공격은 가까운 적을 자동 조준한다. 없으면 보고 있는 방향 */
function aim(p, range) {
  var t = nearestTo(p.x, p.y, range);
  if (!t) return { x: p.fx, y: p.fy, t: null };
  var dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l, t: t };
}

/* ══════════════════════════ 플레이어 갱신 ══════════════════════════ */
var COMBO = [
  { wind: 0.07, act: 0.12, rec: 0.15, mult: 1.00, range: 46, arc: -0.15 },
  { wind: 0.06, act: 0.12, rec: 0.16, mult: 1.05, range: 48, arc: -0.20 },
  { wind: 0.12, act: 0.16, rec: 0.26, mult: 1.70, range: 62, arc: -0.55 },
];

function basicMelee(p, st, m) {
  if (p.atkT <= 0) {
    p.atkStage = (p.comboT > 0 ? p.atkStage % 3 : 0) + 1;
    var c = COMBO[p.atkStage - 1];
    p.atkT = c.wind + c.act + c.rec;
    p.atkHit = false;
    if (hooks.onAct) hooks.onAct('attack');
  }
}

function basicBow(p, st, m) {
  if (p.atkT > 0) return;
  p.atkT = 0.40 / (1 + m.rate);
  var a = aim(p, 460 * (1 + m.range));
  p.fx = a.x; p.fy = a.y;
  var dmg = st.atk * 1.0 * (1 + m.shotDmg);
  fire(p.x + a.x * 14, p.y + a.y * 14, a.x * 520, a.y * 520, dmg, false, 'arrowP', m.shotPierce);
  burst(p.x + a.x * 14, p.y + a.y * 14, 2, '#fde68a', 60, 2);
  if (hooks.onAct) hooks.onAct('attack');
}

function basicStaff(p, st, m) {
  if (p.atkT > 0) return;
  var cost = m.freeCast ? 0 : 3;
  if (p.mp < cost) { if (hooks.onNoMp) hooks.onNoMp(); p.atkT = 0.25; return; }
  p.mp -= cost;
  p.atkT = 0.46 / (1 + m.rate);
  var a = aim(p, 400 * (1 + m.range));
  p.fx = a.x; p.fy = a.y;
  var dmg = st.atk * 1.15 * (m.freeCast ? 0.85 : 1);
  var s = fire(p.x + a.x * 14, p.y + a.y * 14, a.x * 430, a.y * 430, dmg, false, 'ember', 0);
  if (s) s.burst = 26;
  if (hooks.onAct) hooks.onAct('attack');
}

/** 직업 기본 공격 */
function basicAttack(p, st, m) {
  var style = DC.classDef(p).atk;
  if (style === 'bow') basicBow(p, st, m);
  else if (style === 'staff') basicStaff(p, st, m);
  else basicMelee(p, st, m);
}

/* ── 액티브 스킬 ─────────────────────────────────────────────── */
function castSkill(p, id, st, m, cdMul) {
  var sk = DC.SKILLS[id];
  if (!sk) return 0;
  var cost = Math.round(sk.mp * m.mpCost);
  if (p.mp < cost) { if (hooks.onNoMp) hooks.onNoMp(); return -1; }
  p.mp -= cost;
  var i, a, ang;

  switch (sk.kind) {
    case 'sweep': {
      var rad = sk.radius * (1 + m.whirlR + m.area);
      sweep(p.x, p.y, 1, 0, rad, -1.1, st.atk * sk.mult * (1 + m.whirlDmg), 'break');
      for (i = 0; i < 22; i++) {
        a = (i / 22) * 6.2832;
        var pt = parts.take();
        if (pt) {
          pt.x = p.x; pt.y = p.y; pt.vx = Math.cos(a) * rad * 2.6; pt.vy = Math.sin(a) * rad * 2.6;
          pt.life = pt.max = 0.32; pt.c = '#7dd3fc'; pt.size = 4;
        }
      }
      p.whirlFx = 0.3; p.whirlR = rad;
      break;
    }
    case 'charge': {
      p.chargeT = 0.24;
      p.chargeDmg = st.atk * sk.mult * (1 + m.bulwarkDmg);
      p.dvx = p.fx * sk.dash; p.dvy = p.fy * sk.dash;
      p.guardT = sk.guard; p.guardDr = sk.dr + m.bulwarkDr;
      p.iframe = Math.max(p.iframe, 0.14);
      burst(p.x, p.y, 10, '#7dd3fc', 150, 3);
      break;
    }
    case 'fan': {
      var n = sk.shots + m.volleyExtra;
      var base = Math.atan2(p.fy, p.fx);
      var waves = m.twin ? 2 : 1;
      for (var w = 0; w < waves; w++) {
        for (i = 0; i < n; i++) {
          ang = base + ((i - (n - 1) / 2) * (sk.spread / Math.max(1, n - 1)) * 2) + (w ? 0.09 : 0);
          fire(p.x + Math.cos(ang) * 12, p.y + Math.sin(ang) * 12,
            Math.cos(ang) * sk.speed, Math.sin(ang) * sk.speed,
            st.atk * sk.mult * (1 + m.shotDmg), false, 'arrowP', m.shotPierce);
        }
      }
      break;
    }
    case 'shot': {
      var at = aim(p, 520 * (1 + m.range));
      p.fx = at.x; p.fy = at.y;
      var isFrost = (id === 'frostlance');
      var dmg = st.atk * sk.mult * (1 + (isFrost ? 0 : m.pinDmg) + m.shotDmg);
      var s = fire(p.x + at.x * 16, p.y + at.y * 16, at.x * sk.speed, at.y * sk.speed,
        dmg, false, isFrost ? 'lance' : 'spear', (sk.pierce || 0) + (isFrost ? m.frostPierce : 0));
      if (s) {
        if (isFrost) { s.slow = sk.slow + m.frostSlow; s.burst = m.frostBurst ? 46 : 0; }
        s.life = 3.0;
      }
      break;
    }
    case 'blast': {
      var bx = p.x + p.fx * 74, by = p.y + p.fy * 74;
      var br = sk.radius * (1 + m.emberR + m.area);
      sweep(bx, by, 1, 0, br, -1.1, st.atk * sk.mult * (1 + m.emberDmg), 'break');
      burst(bx, by, 26, '#f97316', 230, 4);
      if (m.emberBurn) field('burn', bx, by, br * 0.8, 3.2, st.atk * 0.30, 0, 0.5, '#f97316');
      break;
    }
    case 'aura': {
      p.sancT = sk.dur; p.sancDr = sk.dr; p.sancHeal = st.maxHp * sk.heal / sk.dur;
      burst(p.x, p.y, 26, '#fde68a', 180, 4);
      break;
    }
    case 'buff': {
      p.buffT = sk.dur; p.buffAtk = sk.atk; p.buffSpd = sk.spd; p.buffDr = sk.dr;
      burst(p.x, p.y, 24, '#ef4444', 200, 4);
      break;
    }
    case 'traps': {
      for (i = 0; i < sk.count; i++) {
        a = (i / sk.count) * 6.2832 + Math.random() * 0.4;
        var d = 60 + Math.random() * 90;
        field('snare', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 40, sk.dur,
          st.atk * sk.mult * 0.5, 1.6, 0.6, '#a3e635');
      }
      break;
    }
    case 'storm': {
      field('storm', p.x + p.fx * 40, p.y + p.fy * 40, sk.radius * (1 + m.area),
        sk.ticks * 0.45, st.atk * sk.mult * 0.55, 0.5, 0.45, '#0ea5e9');
      burst(p.x + p.fx * 40, p.y + p.fy * 40, 30, '#7dd3fc', 240, 4);
      break;
    }
    case 'summon': {
      summonShade(sk.dur, st.atk * 0.55);
      break;
    }
    default: break;
  }
  if (hooks.onAct) hooks.onAct('skill');
  return sk.cd * cdMul;
}

function skillIds(p) {
  var cd = DC.classDef(p), a = DC.advOf(p);
  return [cd.s1, cd.s2, a ? a.skill : null];
}

function updatePlayer(dt, IN, time) {
  var p = S.p, st = stats(p), m = mods(p);

  p.iframe = Math.max(0, p.iframe - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.guardCd = Math.max(0, p.guardCd - dt);
  p.cd1 = Math.max(0, p.cd1 - dt);
  p.cd2 = Math.max(0, p.cd2 - dt);
  p.cd3 = Math.max(0, p.cd3 - dt);
  p.comboT = Math.max(0, p.comboT - dt);
  p.critT = Math.max(0, p.critT - dt);
  p.guardT = Math.max(0, p.guardT - dt);
  p.buffT = Math.max(0, p.buffT - dt);
  if (p.buffT <= 0) { p.buffAtk = 0; p.buffSpd = 0; p.buffDr = 0; }
  if (p.sancT > 0) {
    p.sancT -= dt;
    p.hp = Math.min(st.maxHp, p.hp + p.sancHeal * dt);
    if (Math.random() < dt * 8) burst(p.x, p.y - 6, 1, '#fde68a', 40, 3);
    if (p.sancT <= 0) { p.sancDr = 0; p.sancHeal = 0; }
  }
  if (p.curse > 0) {
    p.curse -= dt;
    if (p.curse <= 0) { p.curse = 0; if (hooks.onCurseEnd) hooks.onCurseEnd(); }
  }
  p.shake = Math.max(0, p.shake - dt * 22);
  if (p.kb > 0) { p.kb -= dt; W.move(p, p.kbx * dt, p.kby * dt); }

  var ax = IN.ax, ay = IN.ay;
  var len = Math.hypot(ax, ay);
  if (len > 0.01) { ax /= len; ay /= len; p.fx = ax; p.fy = ay; }

  /* 회피 대시 — 구르는 동안 무적 */
  if (IN.dashEdge && p.dashCd <= 0 && p.dashT <= 0 && p.chargeT <= 0) {
    p.dashT = 0.2;
    p.dashCd = 0.75 * m.dashCd;
    p.iframe = Math.max(p.iframe, 0.2 + m.iframe);
    p.dvx = (len > 0.01 ? ax : p.fx) * 520;
    p.dvy = (len > 0.01 ? ay : p.fy) * 520;
    if (m.afterimage) p.critT = 1.5;
    burst(p.x, p.y, 8, '#7dd3fc', 120, 3);
    if (hooks.onAct) hooks.onAct('dash');
  }

  /* 방벽 돌진 — 밀고 들어가며 닿는 것을 친다 */
  if (p.chargeT > 0) {
    p.chargeT -= dt;
    W.move(p, p.dvx * dt, p.dvy * dt);
    sweep(p.x + p.fx * 14, p.y + p.fy * 14, p.fx, p.fy, 44, -0.2, p.chargeDmg * dt * 4.2, 'break');
    if (Math.random() < 0.7) burst(p.x, p.y, 1, 'rgba(125,211,252,.8)', 40, 3);
  } else if (p.dashT > 0) {
    p.dashT -= dt;
    W.move(p, p.dvx * dt, p.dvy * dt);
    if (Math.random() < 0.6) burst(p.x, p.y, 1, 'rgba(125,211,252,.7)', 30, 2);
  } else if (p.atkT <= 0 && len > 0.01) {
    W.move(p, ax * st.spd * dt, ay * st.spd * dt);
  } else if (p.atkT > 0 && len > 0.01) {
    var slowK = DC.classDef(p).atk === 'melee' ? 0.22 : 0.66;   // 원거리는 쏘면서도 움직인다
    W.move(p, ax * st.spd * slowK * dt, ay * st.spd * slowK * dt);
  }

  /* 기본 공격 */
  if (IN.attackEdge && p.dashT <= 0 && p.chargeT <= 0) basicAttack(p, st, m);

  /* 근접 3연타 판정 */
  if (p.atkT > 0 && DC.classDef(p).atk === 'melee' && p.atkStage > 0) {
    var cc = COMBO[p.atkStage - 1];
    var elapsed = (cc.wind + cc.act + cc.rec) - p.atkT;
    if (!p.atkHit && elapsed >= cc.wind) {
      p.atkHit = true;
      var dmg = st.atk * cc.mult * (1 + m.comboDmg);
      var src = p.atkStage === 3 ? 'break' : 'normal';
      sweep(p.x + p.fx * 12, p.y + p.fy * 12, p.fx, p.fy, cc.range, cc.arc, dmg, src);
      if (p.atkStage === 3 && m.shock) {
        for (var i = 0; i < 5; i++) {
          var a = Math.atan2(p.fy, p.fx) + (i - 2) * 0.19;
          fire(p.x + p.fx * 16, p.y + p.fy * 16, Math.cos(a) * 380, Math.sin(a) * 380, st.atk * 0.7, false, 'shock', 1);
        }
      }
    }
    p.atkT -= dt;
    if (p.atkT <= 0) p.comboT = 0.34;
  } else if (p.atkT > 0) {
    p.atkT -= dt;
  }

  /* 액티브 기술 — Q / E / R */
  var cdMul = 1 - Math.min(0.5, st.cdr);
  var ids = skillIds(p);
  if (IN.s1Edge && p.cd1 <= 0 && p.dashT <= 0 && ids[0]) {
    var c1 = castSkill(p, ids[0], st, m, cdMul);
    if (c1 > 0) p.cd1 = c1;
  }
  if (IN.s2Edge && p.cd2 <= 0 && p.dashT <= 0 && ids[1]) {
    var c2 = castSkill(p, ids[1], st, m, cdMul);
    if (c2 > 0) p.cd2 = c2;
  }
  if (IN.s3Edge && p.cd3 <= 0 && p.dashT <= 0 && ids[2]) {
    var c3 = castSkill(p, ids[2], st, m, cdMul);
    if (c3 > 0) p.cd3 = c3;
  }
  if (p.whirlFx > 0) p.whirlFx -= dt;

  /* 의지 자연 회복 */
  var stm = stats(p);
  var regen = 1.6 * (1 + m.regen) * (DC.classOf(p) === 'mage' ? 2.0 : 1);
  p.mp = Math.min(stm.maxMp, p.mp + dt * regen);
  p.hp = Math.min(stm.maxHp, p.hp);

  /* 가시 함정 */
  if (W.tileAt(p.x, p.y) === W.T.SPIKE && W.spikeOn(p.x, p.y, time) && p.dashT <= 0) {
    hurtPlayer(12, null, null, false);
  }
}

/* ══════════════════════════ 적 AI ══════════════════════════ */
var CULL = 820;   // 이 거리 밖의 적은 갱신하지 않는다 (보스·유니크 제외)

function towards(e, dx, dy, dist, spd, dt) {
  var l = dist || 1;
  W.move(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.fx = dx / l; e.fy = dy / l;
}

function wander(e, spd, dt) {
  e.tm -= dt;
  if (e.tm <= 0) { e.tm = 1.2 + Math.random() * 1.6; var a = Math.random() * 6.2832; e.vx = Math.cos(a); e.vy = Math.sin(a); }
  W.move(e, e.vx * spd * 0.45 * dt, e.vy * spd * 0.45 * dt);
}

/** 접촉 피해 — 탱커 동료가 곁에 있으면 그쪽이 먼저 맞는다 */
function contact(e, dist, mult) {
  var p = S.p;
  if (e.touch > 0) return;
  var a = allies[0];
  if (a.on && a.downT <= 0 && allyDef(a).role === 'tank') {
    var ad = Math.hypot(a.x - e.x, a.y - e.y);
    if (ad < e.r + a.r + 2 && ad <= dist + 8) {
      e.touch = 0.85;
      hurtAlly(a, e.d.atk * (mult || 1), e.x, e.y);
      return;
    }
  }
  if (dist < e.r + p.r + 2) {
    e.touch = 0.85;
    hurtPlayer(e.d.atk * (mult || 1), e.x, e.y, false, e.d.chill);
  }
}

function teleportNear(e, tx, ty) {
  for (var i = 0; i < 20; i++) {
    var a = Math.random() * 6.2832, d = 110 + Math.random() * 90;
    var nx = tx + Math.cos(a) * d, ny = ty + Math.sin(a) * d;
    if (W.solidAt(nx, ny)) continue;
    burst(e.x, e.y, 12, e.d.body, 150, 3);
    e.x = nx; e.y = ny;
    burst(e.x, e.y, 12, e.d.body, 150, 3);
    return;
  }
}

function updateEnemies(dt, time) {
  var p = S.p;
  var tank = allies[0].on && allies[0].downT <= 0 && allyDef(allies[0]).role === 'tank' ? allies[0] : null;
  enemies.each(function (e) {
    e.hurt = Math.max(0, e.hurt - dt);
    e.touch = Math.max(0, e.touch - dt);
    e.taunt = Math.max(0, e.taunt - dt);
    if (e.slow > 0) e.slow -= dt;
    if (e.kb > 0) { e.kb -= dt; W.move(e, e.kbx * dt, e.kby * dt); }

    /* 탱커가 시선을 끄는 동안은 그쪽을 목표로 삼는다 */
    var tx = (e.taunt > 0 && tank) ? tank.x : p.x;
    var ty = (e.taunt > 0 && tank) ? tank.y : p.y;
    var dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
    var pdist = Math.hypot(p.x - e.x, p.y - e.y);
    if (pdist > CULL) return;
    if (p.hp <= 0) return;

    var spd = e.d.spd * (e.slow > 0 ? 0.45 : 1);
    /* 정예·보스는 시야가 끊기면(문이 닫혔거나 방을 벗어나면) 제자리로 돌아가며 회복한다 */
    if (e.d.boss || e.d.elite) {
      if (!W.clearLine(e.x, e.y, p.x, p.y)) {
        var hdx = e.hx - e.x, hdy = e.hy - e.y, hd = Math.hypot(hdx, hdy);
        if (hd > 10) towards(e, hdx, hdy, hd, spd * 0.85, dt);
        else e.hp = Math.min(e.max, e.hp + e.max * 0.08 * dt);
        return;
      }
    }
    switch (e.d.ai) {
      /* 슬라임 — 짧게 도약해 다가온다 */
      case 'hopper':
        e.cd -= dt;
        if (e.st === 0) {
          if (e.cd <= 0) {
            e.st = 1; e.tm = 0.3; e.cd = 1.05 + Math.random() * 0.5;
            var l0 = dist || 1;
            if (dist < 380) { e.vx = (dx / l0) * spd * 3.1; e.vy = (dy / l0) * spd * 3.1; }
            else { var a0 = Math.random() * 6.2832; e.vx = Math.cos(a0) * spd; e.vy = Math.sin(a0) * spd; }
            e.fx = e.vx; e.fy = e.vy;
          }
        } else {
          e.tm -= dt;
          W.move(e, e.vx * dt, e.vy * dt);
          if (e.tm <= 0) e.st = 0;
        }
        contact(e, pdist, 1);
        break;

      /* 늑대 — 붙었다가 예비동작 후 돌진 */
      case 'lunger':
        e.cd -= dt;
        if (e.st === 0) {
          if (dist < 340 && W.clearLine(e.x, e.y, tx, ty)) {
            if (dist > 46) towards(e, dx, dy, dist, spd, dt);
            if (dist < 165 && e.cd <= 0) { e.st = 1; e.tm = 0.4; }
          } else wander(e, spd, dt);
        } else if (e.st === 1) {
          e.tm -= dt;
          if (e.tm <= 0) {
            e.st = 2; e.tm = 0.32;
            var l1 = dist || 1; e.vx = (dx / l1) * 440; e.vy = (dy / l1) * 440;
            burst(e.x, e.y, 5, '#cbd5e1', 90, 2);
          }
        } else {
          e.tm -= dt;
          W.move(e, e.vx * dt, e.vy * dt);
          if (e.tm <= 0) { e.st = 0; e.cd = 1.6; }
        }
        contact(e, pdist, e.st === 2 ? 1.35 : 0.6);
        break;

      /* 사수 — 거리를 유지하며 화살을 쏜다 */
      case 'kiter':
        e.cd -= dt;
        if (dist < 175) towards(e, -dx, -dy, dist, spd, dt);
        else if (dist > 280 && dist < 480) towards(e, dx, dy, dist, spd * 0.8, dt);
        else if (dist >= 480) wander(e, spd, dt);
        if (dist < 400 && e.cd <= 0 && W.clearLine(e.x, e.y, tx, ty)) {
          e.cd = 1.75;
          var la = dist || 1;
          fire(e.x + (dx / la) * 14, e.y + (dy / la) * 14, (dx / la) * 300, (dy / la) * 300, e.d.atk, true, 'arrow', 0);
          e.fx = dx / la; e.fy = dy / la;
        }
        break;

      /* 방패병 — 정면은 막고 방패로 밀친다 */
      case 'bulwark':
        e.cd -= dt;
        if (e.st === 0) {
          if (dist < 420) {
            e.fx = dx / (dist || 1); e.fy = dy / (dist || 1);
            if (dist > 44) W.move(e, e.fx * spd * dt, e.fy * spd * dt);
            else if (e.cd <= 0) { e.st = 1; e.tm = 0.45; e.cd = 2.1; }
          } else wander(e, spd, dt);
        } else {
          e.tm -= dt;
          if (e.tm <= 0) {
            e.st = 0;
            if (pdist < 74) hurtPlayer(e.d.atk * 1.2, e.x, e.y);
            else if (tank && Math.hypot(tank.x - e.x, tank.y - e.y) < 74) hurtAlly(tank, e.d.atk * 1.2, e.x, e.y);
            burst(e.x + e.fx * 20, e.y + e.fy * 20, 8, '#0ea5e9', 160, 3);
          }
        }
        break;

      /* 파수병 망령 — 순간이동 + 3연발 + 소환 */
      case 'wraith':
        e.cd -= dt; e.cd2 -= dt;
        if (e.hp < e.max * 0.6 && e.summoned < 1) {
          e.summoned = 1;
          for (var s1 = 0; s1 < 2; s1++) spawnEnemy('slime', e.x + (s1 ? 40 : -40), e.y + 30, e.chunk);
        }
        if (e.hp < e.max * 0.3 && e.summoned < 2) {
          e.summoned = 2;
          for (var s2 = 0; s2 < 2; s2++) spawnEnemy('slime', e.x + (s2 ? 46 : -46), e.y - 30, e.chunk);
        }
        if (e.cd2 <= 0) { e.cd2 = 4.2; teleportNear(e, p.x, p.y); }
        if (dist > 150) towards(e, dx, dy, dist, spd * 0.6, dt);
        if (e.cd <= 0 && dist < 460) {
          e.cd = 2.0;
          var base = Math.atan2(dy, dx);
          for (var k1 = -1; k1 <= 1; k1++) {
            var ang = base + k1 * 0.26;
            fire(e.x, e.y, Math.cos(ang) * 260, Math.sin(ang) * 260, e.d.atk, true, 'orb', 0);
          }
        }
        contact(e, pdist, 0.9);
        break;

      /* 등대지기 망령 — 2페이즈 보스 */
      case 'keeper':
        if (e.phase === 1 && e.hp < e.max * 0.5) {
          e.phase = 2; e.cd = 0.8; e.cd2 = 1.2;
          burst(e.x, e.y, 40, '#ef4444', 260, 5);
          for (var a2 = 0; a2 < 2; a2++) spawnEnemy('archer', e.x + (a2 ? 90 : -90), e.y + 60, e.chunk);
          if (hooks.onBossPhase) hooks.onBossPhase(e);
        }
        var bs = spd * (e.phase === 2 ? 1.35 : 1);
        e.cd -= dt; e.cd2 -= dt;
        if (e.st === 0) {
          if (dist > 74) towards(e, dx, dy, dist, bs, dt);
          else { e.fx = dx / (dist || 1); e.fy = dy / (dist || 1); }
          if (dist < 130 && e.cd <= 0) { e.st = 1; e.tm = 0.48; e.cd = e.phase === 2 ? 1.9 : 2.8; }
        } else if (e.st === 1) {
          e.tm -= dt;
          if (e.tm <= 0) {
            e.st = 2; e.tm = 0.22;
            if (pdist < 120) {
              var lb = pdist || 1;
              if (((p.x - e.x) / lb) * e.fx + ((p.y - e.y) / lb) * e.fy > -0.3) {
                hurtPlayer(e.d.atk * 1.3, e.x, e.y, false, true);
              }
            }
            if (tank && Math.hypot(tank.x - e.x, tank.y - e.y) < 120) hurtAlly(tank, e.d.atk * 1.1, e.x, e.y);
            for (var sw = 0; sw < 14; sw++) {
              var aw = Math.atan2(e.fy, e.fx) + (sw - 7) * 0.16;
              burst(e.x + Math.cos(aw) * 70, e.y + Math.sin(aw) * 70, 1, '#ef4444', 60, 4);
            }
          }
        } else { e.tm -= dt; if (e.tm <= 0) e.st = 0; }

        if (e.cd2 <= 0) {
          e.cd2 = e.phase === 2 ? 3.4 : 5.0;
          var n = e.phase === 2 ? 14 : 9;
          for (var r1 = 0; r1 < n; r1++) {
            var ar = (r1 / n) * 6.2832 + time * 0.4;
            fire(e.x, e.y, Math.cos(ar) * 190, Math.sin(ar) * 190, e.d.atk * 0.8, true, 'orb', 0);
          }
          if (e.phase === 2) {
            for (var wsp = 0; wsp < 3; wsp++) {
              var aq = Math.atan2(p.y - e.y, p.x - e.x) + (wsp - 1) * 0.5;
              var sh = fire(e.x, e.y, Math.cos(aq) * 130, Math.sin(aq) * 130, e.d.atk * 0.7, true, 'wisp', 0);
              if (sh) sh.life = 4.5;
            }
          }
        }
        contact(e, pdist, 0.8);
        break;
      default: break;
    }
  });
}

/* ══════════════════════════ 투사체 ══════════════════════════ */
function updateShots(dt) {
  var p = S.p;
  shots.each(function (s) {
    s.life -= dt;
    if (s.life <= 0) { s.on = false; return; }
    if (s.kind === 'wisp') {
      var hx = p.x - s.x, hy = p.y - s.y, hl = Math.hypot(hx, hy) || 1;
      s.vx += (hx / hl) * 210 * dt; s.vy += (hy / hl) * 210 * dt;
      var sp = Math.hypot(s.vx, s.vy);
      if (sp > 240) { s.vx = s.vx / sp * 240; s.vy = s.vy / sp * 240; }
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.spin += dt * 12;
    if (W.solidAt(s.x, s.y)) { s.on = false; burst(s.x, s.y, 4, s.foe ? '#ef4444' : '#7dd3fc', 90, 2); return; }

    if (s.foe) {
      var d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < s.r + p.r) {
        if (p.iframe <= 0 && p.dashT <= 0) hurtPlayer(s.dmg, s.x, s.y, false, s.chill);
        s.on = false;
        burst(s.x, s.y, 5, '#ef4444', 110, 2);
        return;
      }
      for (var ai = 0; ai < allies.length; ai++) {
        var al = allies[ai];
        if (!al.on || al.downT > 0) continue;
        if (Math.hypot(al.x - s.x, al.y - s.y) < s.r + al.r) {
          hurtAlly(al, s.dmg, s.x, s.y);
          s.on = false;
          return;
        }
      }
      return;
    }
    enemies.each(function (e) {
      if (!s.on) return;
      if (s.hitIds.indexOf(e) >= 0) return;
      if (Math.hypot(e.x - s.x, e.y - s.y) > s.r + e.r) return;
      s.hitIds.push(e);
      var l = Math.hypot(s.vx, s.vy) || 1;
      var src = (s.kind === 'spear' || s.kind === 'lance') ? 'break' : 'normal';
      damageEnemy(e, s.dmg, (s.vx / l) * 150, (s.vy / l) * 150, src);
      if (s.slow > 0) e.slow = Math.max(e.slow, s.slow);
      if (s.burst > 0) {
        burst(s.x, s.y, 10, s.kind === 'lance' ? '#7dd3fc' : '#f97316', 160, 3);
        sweep(s.x, s.y, 1, 0, s.burst, -1.1, s.dmg * 0.45, 'normal');
      }
      if (s.pierce > 0) s.pierce--;
      else { s.on = false; burst(s.x, s.y, 5, '#7dd3fc', 110, 2); }
    });
  });
}

/* ══════════════════════════ 장판 ══════════════════════════ */
function updateFields(dt) {
  fields.each(function (f) {
    f.life -= dt;
    if (f.life <= 0) { f.on = false; return; }
    f.tick -= dt;
    if (f.tick > 0) return;
    f.tick = f.every;
    enemies.each(function (e) {
      if (Math.hypot(e.x - f.x, e.y - f.y) > f.r + e.r) return;
      damageEnemy(e, f.dmg, 0, 0, 'normal');
      if (f.slow > 0) e.slow = Math.max(e.slow, f.slow);
    });
    burst(f.x + (Math.random() - 0.5) * f.r, f.y + (Math.random() - 0.5) * f.r, 2, f.c, 60, 3);
  });
}

function updateFx(dt) {
  parts.each(function (q) {
    q.life -= dt;
    if (q.life <= 0) { q.on = false; return; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.90; q.vy *= 0.90;
  });
  pops.each(function (q) {
    q.life -= dt;
    if (q.life <= 0) { q.on = false; return; }
    q.y += q.vy * dt; q.vy += 120 * dt;
  });
}

/* ══════════════════════════ 렌더 ══════════════════════════ */
function drawPlayer(g, p, cam, time) {
  var x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
  var cd = DC.classDef(p);
  g.save();
  if (p.iframe > 0 && Math.floor(time * 20) % 2 === 0) g.globalAlpha = 0.45;

  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(x, y + 12, 12, 5, 0, 0, 6.2832); g.fill();

  /* 성역 · 광란 · 방벽 */
  if (p.sancT > 0) {
    g.strokeStyle = 'rgba(253,230,138,.55)'; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 30 + Math.sin(time * 4) * 3, 0, 6.2832); g.stroke();
  }
  if (p.guardT > 0) {
    g.strokeStyle = 'rgba(125,211,252,.7)'; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 22, 0, 6.2832); g.stroke();
  }
  if (p.buffT > 0) {
    g.fillStyle = 'rgba(239,68,68,.18)';
    g.beginPath(); g.arc(x, y, 24, 0, 6.2832); g.fill();
  }

  /* 회오리 이펙트 */
  if (p.whirlFx > 0) {
    g.strokeStyle = 'rgba(125,211,252,' + (p.whirlFx * 2.4).toFixed(2) + ')';
    g.lineWidth = 4;
    g.beginPath(); g.arc(x, y, (p.whirlR || 78) * (1.1 - p.whirlFx), 0, 6.2832); g.stroke();
  }

  /* 근접 검 궤적 */
  if (p.atkT > 0 && cd.atk === 'melee' && p.atkStage > 0) {
    var cc = COMBO[p.atkStage - 1];
    var tot = cc.wind + cc.act + cc.rec, el = tot - p.atkT;
    if (el >= cc.wind && el <= cc.wind + cc.act) {
      var f = (el - cc.wind) / cc.act;
      var base = Math.atan2(p.fy, p.fx);
      var half = Math.acos(Math.max(-1, Math.min(1, cc.arc)));
      g.strokeStyle = p.atkStage === 3 ? 'rgba(234,179,8,.85)' : 'rgba(226,240,255,.8)';
      g.lineWidth = p.atkStage === 3 ? 7 : 4;
      g.beginPath();
      g.arc(x, y, cc.range, base - half + f * half * 2 * 0.55, base - half + half * 2 * (0.35 + f * 0.65));
      g.stroke();
    }
  }

  /* 몸통 — 직업 색 */
  g.fillStyle = '#0f1a2e'; g.fillRect(x - 8, y - 6, 16, 16);
  g.fillStyle = cd.color; g.fillRect(x - 8, y - 6, 16, 5);
  g.fillStyle = '#e7d5b0'; g.fillRect(x - 6, y - 16, 12, 11);
  g.fillStyle = '#1a2238'; g.fillRect(x - 7, y - 18, 14, 5);
  g.fillStyle = '#0c1424';
  g.fillRect(x - 4 + p.fx * 2, y - 12, 3, 3);
  g.fillRect(x + 1 + p.fx * 2, y - 12, 3, 3);
  /* 손에 든 것 */
  g.fillStyle = cd.atk === 'staff' ? '#c4b5fd' : (cd.atk === 'bow' ? '#a3e635' : '#9fb2cc');
  g.fillRect(x - 2 + p.fx * 13, y - 2 + p.fy * 13, 5, 5);
  if (p.curse > 0) {
    g.fillStyle = 'rgba(167,139,250,.35)';
    g.beginPath(); g.arc(x, y - 4, 15, 0, 6.2832); g.fill();
  }
  g.restore();
}

function drawAlly(g, a, cam, time) {
  var x = Math.round(a.x - cam.x), y = Math.round(a.y - cam.y);
  var def = allyDef(a);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(x, y + 11, 10, 4, 0, 0, 6.2832); g.fill();

  if (a.downT > 0) {
    g.globalAlpha = 0.5;
    g.fillStyle = def.color;
    g.fillRect(x - 11, y + 2, 22, 7);
    g.globalAlpha = 1;
    g.font = "10px 'Courier New',monospace"; g.textAlign = 'center';
    g.fillStyle = '#94a3b8';
    g.fillText(Math.ceil(a.downT) + 's', x, y - 6);
    g.textAlign = 'left';
    return;
  }
  if (a.temp) g.globalAlpha = 0.72;
  g.fillStyle = a.hurt > 0 ? '#ffffff' : def.color;
  g.fillRect(x - 7, y - 5, 14, 15);
  g.fillStyle = '#e7d5b0'; g.fillRect(x - 5, y - 14, 10, 10);
  g.fillStyle = '#0c1424';
  g.fillRect(x - 3 + a.fx * 2, y - 11, 2, 2);
  g.fillRect(x + 1 + a.fx * 2, y - 11, 2, 2);
  g.fillStyle = def.color;
  g.fillRect(x - 1 + a.fx * 11, y - 1 + a.fy * 11, 4, 4);
  g.globalAlpha = 1;

  if (a.hp < a.max) {
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 13, y - 20, 26, 3);
    g.fillStyle = def.color; g.fillRect(x - 13, y - 20, 26 * Math.max(0, a.hp / a.max), 3);
  }
}

function drawEnemy(g, e, cam, time) {
  var x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
  var r = e.r;
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(x, y + r * 0.8, r * 0.85, r * 0.36, 0, 0, 6.2832); g.fill();

  var flash = e.hurt > 0;
  var body = flash ? '#ffffff' : e.d.body;

  switch (e.t) {
    case 'slime':
      var wob = Math.sin(time * 6 + x) * 2 + (e.st === 1 ? -3 : 0);
      g.fillStyle = body; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(x, y + 2, r + 1, r - 2 + wob * 0.4, 0, 0, 6.2832); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = e.d.dark; g.fillRect(x - 6, y - 2, 3, 3); g.fillRect(x + 3, y - 2, 3, 3);
      break;
    case 'wolf':
      g.fillStyle = e.st === 1 ? '#fca5a5' : body;
      g.fillRect(x - r, y - 5, r * 2, 11);
      g.fillRect(x + (e.fx >= 0 ? r - 4 : -r - 3), y - 9, 8, 8);
      g.fillStyle = e.d.dark;
      g.fillRect(x - r + 2, y + 5, 3, 5); g.fillRect(x + r - 5, y + 5, 3, 5);
      g.fillStyle = '#ef4444';
      g.fillRect(x + (e.fx >= 0 ? r - 1 : -r + 1), y - 7, 2, 2);
      break;
    case 'archer':
      g.fillStyle = body; g.fillRect(x - 6, y - 6, 12, 14);
      g.fillStyle = '#e7d5b0'; g.fillRect(x - 5, y - 14, 10, 9);
      g.strokeStyle = e.d.dark; g.lineWidth = 2;
      g.beginPath(); g.arc(x + e.fx * 11, y + e.fy * 11, 8, 0, 6.2832); g.stroke();
      break;
    case 'shield':
      g.fillStyle = body; g.fillRect(x - 8, y - 7, 16, 16);
      g.fillStyle = '#e7d5b0'; g.fillRect(x - 5, y - 15, 10, 9);
      g.fillStyle = e.st === 1 ? '#fde68a' : '#cbd5e1';
      g.fillRect(x + e.fx * 14 - 6, y + e.fy * 14 - 9, 12, 18);
      g.fillStyle = e.d.dark; g.fillRect(x + e.fx * 14 - 3, y + e.fy * 14 - 4, 6, 8);
      break;
    case 'wraith':
    case 'keeper':
      var big = e.t === 'keeper';
      g.globalAlpha = 0.85;
      g.fillStyle = e.phase === 2 ? '#ef4444' : body;
      g.beginPath();
      g.moveTo(x, y - r - (big ? 10 : 4));
      g.lineTo(x + r, y + r * 0.7);
      g.lineTo(x - r, y + r * 0.7);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#0c1424';
      g.beginPath(); g.arc(x, y - r * 0.25, r * 0.55, 0, 6.2832); g.fill();
      g.fillStyle = e.st === 1 ? '#fde68a' : '#ef4444';
      g.fillRect(x - 6, y - r * 0.35, 4, 4); g.fillRect(x + 2, y - r * 0.35, 4, 4);
      if (big) {
        g.fillStyle = 'rgba(234,179,8,.75)';
        g.beginPath(); g.arc(x + r * 0.9, y, 6 + Math.sin(time * 4) * 1.5, 0, 6.2832); g.fill();
      }
      break;
    default:
      g.fillStyle = body;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  g.globalAlpha = 1;

  if (e.slow > 0) {
    g.strokeStyle = 'rgba(125,211,252,.7)'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, r + 4, 0, 6.2832); g.stroke();
  }

  /* 정예·보스 체력 바 */
  if (e.d.elite || e.d.boss) {
    var w = e.d.boss ? 74 : 48;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2, y - r - 16, w, 5);
    g.fillStyle = e.phase === 2 ? '#ef4444' : '#eab308';
    g.fillRect(x - w / 2, y - r - 16, w * Math.max(0, e.hp / e.max), 5);
  } else if (e.hp < e.max) {
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 15, y - r - 10, 30, 3);
    g.fillStyle = '#22c55e'; g.fillRect(x - 15, y - r - 10, 30 * (e.hp / e.max), 3);
  }
}

function draw(g, cam, time) {
  var p = S.p;

  /* 장판 먼저 (바닥) */
  fields.each(function (f) {
    var x = f.x - cam.x, y = f.y - cam.y;
    if (x < -160 || y < -160 || x > VIEW_W + 160 || y > VIEW_H + 160) return;
    g.globalAlpha = 0.18 + 0.08 * Math.sin(time * 6);
    g.fillStyle = f.c;
    g.beginPath(); g.arc(x, y, f.r, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = f.c; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, f.r, 0, 6.2832); g.stroke();
  });

  var actors = [];
  enemies.each(function (e) {
    if (e.x < cam.x - 60 || e.x > cam.x + VIEW_W + 60 || e.y < cam.y - 80 || e.y > cam.y + VIEW_H + 80) return;
    actors.push(e);
  });
  actors.sort(function (a, b) { return a.y - b.y; });

  var drawn = false;
  for (var i = 0; i < actors.length; i++) {
    if (!drawn && actors[i].y > p.y) { drawPlayer(g, p, cam, time); drawn = true; }
    drawEnemy(g, actors[i], cam, time);
  }
  if (!drawn) drawPlayer(g, p, cam, time);

  for (var ai = 0; ai < allies.length; ai++) if (allies[ai].on) drawAlly(g, allies[ai], cam, time);

  shots.each(function (s) {
    var x = s.x - cam.x, y = s.y - cam.y;
    if (x < -20 || y < -20 || x > VIEW_W + 20 || y > VIEW_H + 20) return;
    if (s.kind === 'arrow' || s.kind === 'arrowP' || s.kind === 'ally') {
      g.strokeStyle = s.foe ? '#fde68a' : (s.kind === 'ally' ? '#bef264' : '#fef3c7');
      g.lineWidth = 2;
      var l = Math.hypot(s.vx, s.vy) || 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - (s.vx / l) * 12, y - (s.vy / l) * 12); g.stroke();
    } else if (s.kind === 'spear' || s.kind === 'lance') {
      g.save(); g.translate(x, y); g.rotate(Math.atan2(s.vy, s.vx));
      g.fillStyle = s.kind === 'lance' ? 'rgba(147,197,253,.9)' : 'rgba(125,211,252,.9)';
      g.fillRect(-14, -4, 28, 8);
      g.fillStyle = 'rgba(226,246,255,.95)'; g.fillRect(6, -2, 10, 4);
      g.restore();
    } else if (s.kind === 'shock') {
      g.fillStyle = 'rgba(234,179,8,.8)';
      g.fillRect(x - 4, y - 4, 8, 8);
    } else if (s.kind === 'ember') {
      g.fillStyle = 'rgba(249,115,22,.35)';
      g.beginPath(); g.arc(x, y, 10, 0, 6.2832); g.fill();
      g.fillStyle = '#fdba74';
      g.beginPath(); g.arc(x, y, 5, 0, 6.2832); g.fill();
    } else if (s.kind === 'wisp') {
      g.fillStyle = 'rgba(239,68,68,.35)';
      g.beginPath(); g.arc(x, y, 11, 0, 6.2832); g.fill();
      g.fillStyle = '#fca5a5';
      g.beginPath(); g.arc(x, y, 5, 0, 6.2832); g.fill();
    } else {
      g.fillStyle = s.foe ? '#ef4444' : '#7dd3fc';
      g.beginPath(); g.arc(x, y, s.r, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.arc(x - 1, y - 1, s.r * 0.4, 0, 6.2832); g.fill();
    }
  });

  parts.each(function (q) {
    var a = Math.max(0, q.life / q.max);
    g.globalAlpha = a;
    g.fillStyle = q.c;
    g.fillRect(q.x - cam.x - q.size / 2, q.y - cam.y - q.size / 2, q.size, q.size);
  });
  g.globalAlpha = 1;

  pops.each(function (q) {
    g.globalAlpha = Math.min(1, q.life * 2);
    g.font = 'bold ' + (q.big ? 19 : 14) + "px 'Courier New',monospace";
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,.75)';
    g.fillText(q.txt, q.x - cam.x + 1, q.y - cam.y + 1);
    g.fillStyle = q.c;
    g.fillText(q.txt, q.x - cam.x, q.y - cam.y);
  });
  g.globalAlpha = 1;
  g.textAlign = 'left';
}

/* ══════════════════════════ 모듈 ══════════════════════════ */
DC.Battle = {
  init: function (world, state, h) { W = world; S = state; hooks = h || {}; },
  bind: function (state) { S = state; syncMerc(); },
  attach: attach,
  stats: stats,
  mods: mods,
  gearOf: gearOf,
  skillIds: skillIds,
  spawnChunk: spawnChunk,
  despawnChunk: despawnChunk,
  spawnEnemy: spawnEnemy,
  hurtPlayer: hurtPlayer,
  damageEnemy: damageEnemy,
  burst: burst,
  popup: popup,
  clearAll: function () {
    enemies.clear(); shots.clear(); parts.clear(); pops.clear(); fields.clear();
    allies[1].on = false;
  },
  liveCount: function () { return enemies.count(); },
  fxCount: function () { return parts.count() + shots.count() + pops.count() + fields.count(); },

  /* 동료 */
  syncMerc: syncMerc,
  ally: function (i) { return allies[i || 0]; },
  mercAlive: function () { return allies[0].on && allies[0].downT <= 0; },
  /** 마을에서 즉시 소생 */
  reviveMerc: function () {
    var a = allies[0];
    if (!a.on) return false;
    a.downT = 0; a.hp = a.max;
    if (S && S.p && S.p.merc) { S.p.merc.down = 0; S.p.merc.hp = a.max; }
    return true;
  },
  healMerc: function () {
    var a = allies[0];
    if (!a.on) return;
    a.hp = a.max; a.downT = 0;
    if (S && S.p && S.p.merc) { S.p.merc.down = 0; S.p.merc.hp = a.max; }
  },

  boss: function () {
    var b = null;
    enemies.each(function (e) { if (e.d.boss) b = e; });
    return b;
  },
  nearest: function (x, y, maxD) { return nearestTo(x, y, maxD); },
  update: function (dt, IN, time) {
    updatePlayer(dt, IN, time);
    updateEnemies(dt, time);
    updateAllies(dt);
    updateShots(dt);
    updateFields(dt);
    updateFx(dt);
  },
  draw: draw,
};
})();
