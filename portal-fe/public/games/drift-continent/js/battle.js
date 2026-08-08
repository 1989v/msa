'use strict';
(function () {
/**
 * 표류 대륙 — 전투: 플레이어 액션 / 적 AI / 판정 / 파티클.
 *
 * 성능 규칙
 *  - 적·투사체·파티클·데미지 팝업은 전부 고정 크기 오브젝트 풀 (런타임 할당 0)
 *  - 화면 밖 1.4 화면 바깥의 적은 AI 를 돌리지 않는다 (컬링)
 *  - 청크가 언로드되면 그 청크 소속 적은 즉시 반환된다
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
    phase: 1, summoned: 0, unique: false };
});
var shots = new Pool(220, function () {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, foe: false, r: 6, pierce: 0, hitIds: null, kind: 'bolt', spin: 0 };
});
var parts = new Pool(320, function () {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, c: '#fff' };
});
var pops = new Pool(64, function () {
  return { x: 0, y: 0, vy: 0, life: 0, txt: '', c: '#fff', big: false };
});

/* ══════════════════════════ 파생 스탯 ══════════════════════════ */
function mods(p) {
  var t = p.tree || {};
  return {
    comboDmg: t.blade1 ? 0.20 : 0,
    exec: t.blade2 ? 0.40 : 0,
    shock: !!t.blade3,
    tideDmg: t.tide1 ? 0.30 : 0,
    tidePierce: t.tide1 ? 2 : 0,
    killHeal: t.tide2 ? 3 : 0,
    whirlR: t.tide3 ? 0.40 : 0,
    whirlDmg: t.tide3 ? 0.25 : 0,
    dr: t.grit1 ? 0.12 : 0,
    dashCd: t.grit2 ? 0.75 : 1,
    iframe: t.grit2 ? 0.06 : 0,
    guardian: !!t.grit3,
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
  return {
    maxHp: 40 + p.vit * 8 + g.hp,
    maxMp: 20 + p.wil * 5 + g.mp,
    atk: 5 + p.str * 2 + g.atk,
    def: p.vit * 0.5 + g.def,
    crit: 0.03 + p.agi * 0.007 + g.crit,
    spd: 140 + p.agi * 2.5,
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

/* ══════════════════════════ 적 스폰 / 반환 ══════════════════════════ */
function spawnEnemy(type, x, y, chunkKey, id, unique) {
  var d = DC.ENEMIES[type]; if (!d) return null;
  var e = enemies.take(); if (!e) return null;
  e.t = type; e.d = d; e.x = x; e.y = y; e.vx = e.vy = 0;
  e.max = d.hp; e.hp = d.hp; e.r = d.r; e.chunk = chunkKey || ''; e.id = id || '';
  e.st = 0; e.tm = 0; e.cd = Math.random() * 1.2; e.cd2 = 1.5; e.touch = 0;
  e.hurt = 0; e.kb = 0; e.kbx = 0; e.kby = 0; e.fx = 0; e.fy = 1;
  e.phase = 1; e.summoned = 0; e.unique = !!unique;
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

/* ══════════════════════════ 플레이어 ══════════════════════════ */
function attach(p) {
  p.atkT = 0; p.atkStage = 0; p.comboT = 0; p.dashT = 0; p.dashCd = 0;
  p.inv = p.inv || 0; p.iframe = 0; p.hitT = 0; p.guardCd = 0;
  p.cdWhirl = 0; p.cdTide = 0; p.shake = 0; p.r = 13;
  if (!p.fx && !p.fy) { p.fx = 0; p.fy = 1; }
}

function damageEnemy(e, raw, kbx, kby, src) {
  var p = S.p, m = mods(p), st = stats(p);
  var dmg = raw;
  if (m.exec && e.hp / e.max < 0.3) dmg *= 1 + m.exec;
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
function hurtPlayer(raw, sx, sy, ignoreIframe) {
  var p = S.p;
  if (p.hp <= 0) return;
  if (!ignoreIframe && (p.iframe > 0 || p.dashT > 0)) return;
  var st = stats(p), m = mods(p);
  var dmg = Math.max(1, Math.round((raw - st.def) * (1 - m.dr)));
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
  s.life = 2.4; s.kind = kind || 'bolt'; s.pierce = pierce || 0; s.r = kind === 'spear' ? 10 : 6;
  s.spin = 0;
  if (!s.hitIds) s.hitIds = [];
  s.hitIds.length = 0;
  return s;
}

/* ══════════════════════════ 플레이어 갱신 ══════════════════════════ */
var COMBO = [
  { wind: 0.07, act: 0.12, rec: 0.15, mult: 1.00, range: 46, arc: -0.15 },
  { wind: 0.06, act: 0.12, rec: 0.16, mult: 1.05, range: 48, arc: -0.20 },
  { wind: 0.12, act: 0.16, rec: 0.26, mult: 1.70, range: 62, arc: -0.55 },
];

function updatePlayer(dt, IN, time) {
  var p = S.p, st = stats(p), m = mods(p);

  p.iframe = Math.max(0, p.iframe - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.guardCd = Math.max(0, p.guardCd - dt);
  p.cdWhirl = Math.max(0, p.cdWhirl - dt);
  p.cdTide = Math.max(0, p.cdTide - dt);
  p.comboT = Math.max(0, p.comboT - dt);
  p.shake = Math.max(0, p.shake - dt * 22);
  if (p.kb > 0) { p.kb -= dt; W.move(p, p.kbx * dt, p.kby * dt); }

  var ax = IN.ax, ay = IN.ay;
  var len = Math.hypot(ax, ay);
  if (len > 0.01) { ax /= len; ay /= len; p.fx = ax; p.fy = ay; }

  /* 회피 대시 — 구르는 동안 무적 */
  if (IN.dashEdge && p.dashCd <= 0 && p.dashT <= 0) {
    p.dashT = 0.2;
    p.dashCd = 0.75 * m.dashCd;
    p.iframe = Math.max(p.iframe, 0.2 + m.iframe);
    p.dvx = (len > 0.01 ? ax : p.fx) * 520;
    p.dvy = (len > 0.01 ? ay : p.fy) * 520;
    burst(p.x, p.y, 8, '#7dd3fc', 120, 3);
    if (hooks.onAct) hooks.onAct('dash');
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    W.move(p, p.dvx * dt, p.dvy * dt);
    if (Math.random() < 0.6) burst(p.x, p.y, 1, 'rgba(125,211,252,.7)', 30, 2);
  } else if (p.atkT <= 0 && len > 0.01) {
    W.move(p, ax * st.spd * dt, ay * st.spd * dt);
  } else if (p.atkT > 0 && len > 0.01) {
    W.move(p, ax * st.spd * 0.22 * dt, ay * st.spd * 0.22 * dt);   // 공격 중 미세 이동
  }

  /* 3연타 콤보 */
  if (IN.attackEdge && p.dashT <= 0) {
    if (p.atkT <= 0) {
      p.atkStage = (p.comboT > 0 ? p.atkStage % 3 : 0) + 1;
      var c = COMBO[p.atkStage - 1];
      p.atkT = c.wind + c.act + c.rec;
      p.atkHit = false;
      if (hooks.onAct) hooks.onAct('attack');
    }
  }
  if (p.atkT > 0) {
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
  }

  /* 스킬 — 회오리 / 파도 창 */
  var cdMul = 1 - Math.min(0.5, st.cdr);
  if (IN.s1Edge && p.cdWhirl <= 0 && p.dashT <= 0) {
    var sk = DC.SKILLS.whirl;
    if (p.mp >= sk.mp) {
      p.mp -= sk.mp; p.cdWhirl = sk.cd * cdMul;
      var rad = sk.radius * (1 + m.whirlR);
      sweep(p.x, p.y, 1, 0, rad, -1.1, st.atk * sk.mult * (1 + m.whirlDmg), 'break');
      for (var w = 0; w < 22; w++) {
        var aa = (w / 22) * 6.2832;
        var pt = parts.take();
        if (pt) {
          pt.x = p.x; pt.y = p.y; pt.vx = Math.cos(aa) * rad * 2.6; pt.vy = Math.sin(aa) * rad * 2.6;
          pt.life = pt.max = 0.32; pt.c = '#7dd3fc'; pt.size = 4;
        }
      }
      p.whirlFx = 0.3; p.whirlR = rad;
      if (hooks.onAct) hooks.onAct('skill');
    } else if (hooks.onNoMp) hooks.onNoMp();
  }
  if (IN.s2Edge && p.cdTide <= 0 && p.dashT <= 0) {
    var sk2 = DC.SKILLS.tide;
    if (p.mp >= sk2.mp) {
      p.mp -= sk2.mp; p.cdTide = sk2.cd * cdMul;
      fire(p.x + p.fx * 14, p.y + p.fy * 14, p.fx * sk2.speed, p.fy * sk2.speed,
        st.atk * sk2.mult * (1 + m.tideDmg), false, 'spear', sk2.pierce + m.tidePierce);
      if (hooks.onAct) hooks.onAct('skill');
    } else if (hooks.onNoMp) hooks.onNoMp();
  }
  if (p.whirlFx > 0) p.whirlFx -= dt;

  /* 의지 자연 회복 */
  var stm = stats(p);
  p.mp = Math.min(stm.maxMp, p.mp + dt * 1.6);
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

function contact(e, dist, mult) {
  var p = S.p;
  if (dist < e.r + p.r + 2 && e.touch <= 0) {
    e.touch = 0.85;
    hurtPlayer(e.d.atk * (mult || 1), e.x, e.y);
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
  enemies.each(function (e) {
    e.hurt = Math.max(0, e.hurt - dt);
    e.touch = Math.max(0, e.touch - dt);
    if (e.kb > 0) { e.kb -= dt; W.move(e, e.kbx * dt, e.kby * dt); }

    var dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
    if (dist > CULL) return;
    if (p.hp <= 0) return;

    var spd = e.d.spd;
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
        contact(e, dist, 1);
        break;

      /* 늑대 — 붙었다가 예비동작 후 돌진 */
      case 'lunger':
        e.cd -= dt;
        if (e.st === 0) {
          if (dist < 340 && W.clearLine(e.x, e.y, p.x, p.y)) {
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
        contact(e, dist, e.st === 2 ? 1.35 : 0.6);
        break;

      /* 사수 — 거리를 유지하며 화살을 쏜다 */
      case 'kiter':
        e.cd -= dt;
        if (dist < 175) towards(e, -dx, -dy, dist, spd, dt);
        else if (dist > 280 && dist < 480) towards(e, dx, dy, dist, spd * 0.8, dt);
        else if (dist >= 480) wander(e, spd, dt);
        if (dist < 400 && e.cd <= 0 && W.clearLine(e.x, e.y, p.x, p.y)) {
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
            if (dist < 74) hurtPlayer(e.d.atk * 1.2, e.x, e.y);
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
        contact(e, dist, 0.9);
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
            if (dist < 120) {
              var lb = dist || 1;
              if ((dx / lb) * e.fx + (dy / lb) * e.fy > -0.3) hurtPlayer(e.d.atk * 1.3, e.x, e.y);
            }
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
              var aq = Math.atan2(dy, dx) + (wsp - 1) * 0.5;
              var sh = fire(e.x, e.y, Math.cos(aq) * 130, Math.sin(aq) * 130, e.d.atk * 0.7, true, 'wisp', 0);
              if (sh) sh.life = 4.5;
            }
          }
        }
        contact(e, dist, 0.8);
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
        if (p.iframe <= 0 && p.dashT <= 0) hurtPlayer(s.dmg, s.x, s.y);
        s.on = false;
        burst(s.x, s.y, 5, '#ef4444', 110, 2);
      }
      return;
    }
    enemies.each(function (e) {
      if (!s.on) return;
      if (s.hitIds.indexOf(e) >= 0) return;
      if (Math.hypot(e.x - s.x, e.y - s.y) > s.r + e.r) return;
      s.hitIds.push(e);
      var l = Math.hypot(s.vx, s.vy) || 1;
      damageEnemy(e, s.dmg, (s.vx / l) * 150, (s.vy / l) * 150, s.kind === 'spear' ? 'break' : 'normal');
      if (s.pierce > 0) s.pierce--;
      else { s.on = false; burst(s.x, s.y, 5, '#7dd3fc', 110, 2); }
    });
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
  g.save();
  if (p.iframe > 0 && Math.floor(time * 20) % 2 === 0) g.globalAlpha = 0.45;

  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(x, y + 12, 12, 5, 0, 0, 6.2832); g.fill();

  /* 회오리 이펙트 */
  if (p.whirlFx > 0) {
    g.strokeStyle = 'rgba(125,211,252,' + (p.whirlFx * 2.4).toFixed(2) + ')';
    g.lineWidth = 4;
    g.beginPath(); g.arc(x, y, (p.whirlR || 78) * (1.1 - p.whirlFx), 0, 6.2832); g.stroke();
  }

  /* 검 궤적 */
  if (p.atkT > 0) {
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

  /* 몸통 */
  g.fillStyle = '#0f1a2e'; g.fillRect(x - 8, y - 6, 16, 16);
  g.fillStyle = '#0ea5e9'; g.fillRect(x - 8, y - 6, 16, 5);
  g.fillStyle = '#e7d5b0'; g.fillRect(x - 6, y - 16, 12, 11);
  g.fillStyle = '#1a2238'; g.fillRect(x - 7, y - 18, 14, 5);
  g.fillStyle = '#0c1424';
  g.fillRect(x - 4 + p.fx * 2, y - 12, 3, 3);
  g.fillRect(x + 1 + p.fx * 2, y - 12, 3, 3);
  g.fillStyle = '#9fb2cc';
  g.fillRect(x - 2 + p.fx * 13, y - 2 + p.fy * 13, 5, 5);
  g.restore();
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

  shots.each(function (s) {
    var x = s.x - cam.x, y = s.y - cam.y;
    if (x < -20 || y < -20 || x > VIEW_W + 20 || y > VIEW_H + 20) return;
    if (s.kind === 'arrow') {
      g.strokeStyle = '#fde68a'; g.lineWidth = 2;
      var l = Math.hypot(s.vx, s.vy) || 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - (s.vx / l) * 12, y - (s.vy / l) * 12); g.stroke();
    } else if (s.kind === 'spear') {
      g.save(); g.translate(x, y); g.rotate(Math.atan2(s.vy, s.vx));
      g.fillStyle = 'rgba(125,211,252,.9)'; g.fillRect(-14, -4, 28, 8);
      g.fillStyle = 'rgba(226,246,255,.95)'; g.fillRect(6, -2, 10, 4);
      g.restore();
    } else if (s.kind === 'shock') {
      g.fillStyle = 'rgba(234,179,8,.8)';
      g.fillRect(x - 4, y - 4, 8, 8);
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
  bind: function (state) { S = state; },
  attach: attach,
  stats: stats,
  mods: mods,
  gearOf: gearOf,
  spawnChunk: spawnChunk,
  despawnChunk: despawnChunk,
  spawnEnemy: spawnEnemy,
  hurtPlayer: hurtPlayer,
  damageEnemy: damageEnemy,
  burst: burst,
  popup: popup,
  clearAll: function () { enemies.clear(); shots.clear(); parts.clear(); pops.clear(); },
  liveCount: function () { return enemies.count(); },
  fxCount: function () { return parts.count() + shots.count() + pops.count(); },
  boss: function () {
    var b = null;
    enemies.each(function (e) { if (e.d.boss) b = e; });
    return b;
  },
  nearest: function (x, y, maxD) {
    var best = null, bd = maxD || 1e9;
    enemies.each(function (e) {
      var d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  },
  update: function (dt, IN, time) {
    updatePlayer(dt, IN, time);
    updateEnemies(dt, time);
    updateShots(dt);
    updateFx(dt);
  },
  draw: draw,
};
})();
