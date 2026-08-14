/**
 * 황천 회귀 — 본체: 전투 · AI · 보스 · 룸 진행 · 문장 · 저장 · HUD.
 *
 * 구조 (docs/specs/2026-08-13-nether-return-hades-like.md 가 설계 원본):
 *   뷰 384×216 을 정수 3배로 1152×648 캔버스에 블릿 — 기사가 화면에서 48×84px 로 큼직하다.
 *   방(아레나)은 뷰보다 크고 모양이 제각각이라 **카메라가 따라간다** — "맵이 하나" 를 없앤 축.
 *   HUD·데미지 숫자는 캔버스 해상도에 직접 그려 글자가 뭉개지지 않는다.
 *
 * 조작 철학: 마우스 조준 없음 — **바라보는 방향으로 벤다**. 대신 하데스처럼 조준 보정이
 * 강하게 붙는다(전방 원뿔 안 최근접 적 스냅). 패드/키보드/터치가 같은 감각을 공유한다.
 *
 * 타격감 불변식 (하나라도 빠지면 이 게임의 존재 이유가 없다):
 *   대시 무적 / 공격 러지 / 히트스톱 / 흔들림 / 텔레그래프 없는 적 공격 금지
 */
(function () {
  'use strict';

  /* ═══════════ 상수 ═══════════ */
  var CW = 1152, CH = 648;                                // 메인 캔버스
  // 2배 블릿(뷰 576×324) — 3배(384×216)보다 픽셀 밀도 2.25배. 캐릭터는 조금 작아지지만
  // "해상도가 조악하다"는 피드백이 우선이라 정밀도를 택했다. 정수 배율은 유지(픽셀 아트 왜곡 금지)
  var SCALE = 2, VW = CW / SCALE, VH = CH / SCALE;
  var TILE = 16;
  var AW = 512, AH = 288;                                 // 현재 아레나 크기 (방마다 다르다)
  var ARENA = { x0: 28, y0: 46, x1: 484, y1: 262 };
  var cam = { x: 0, y: 0 };

  var cv = document.getElementById('cv');
  var mg = cv.getContext('2d');
  var wc = document.createElement('canvas');
  wc.width = VW; wc.height = VH;
  var wg = wc.getContext('2d');
  wg.imageSmoothingEnabled = false;
  mg.imageSmoothingEnabled = false;

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  var TX = DATA.tx;
  function L(ko, en) { return DATA.lang() === 'ko' ? ko : en; }

  /* ═══════════ RNG — 상태를 저장/복원할 수 있는 mulberry32 ═══════════ */
  var rngA = 1;
  function srand(seed) { rngA = seed >>> 0; }
  function rnd() {
    rngA |= 0; rngA = (rngA + 0x6D2B79F5) | 0;
    var t = Math.imul(rngA ^ (rngA >>> 15), 1 | rngA);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick(arr) { return arr[(rnd() * arr.length) | 0]; }

  /* ═══════════ 세이브 그릇 — 서버 + 이어하기 코드 + localStorage ═══════════ */
  var API = '/api/v1/games/nether-return';
  var S = null;
  var saveVersion = 0, saveCode = localStorage.getItem('nr_code') || null;

  function defaults() {
    return {
      v: 2, medals: 0, up: {},
      runs: 0, clears: 0, best: 0,
      weapon: 'sword', weapons: { sword: 1 },
      proph: { kills: 0, rooms: 0, flags: {}, claimed: {} },
      run: null,
    };
  }
  function token() { return localStorage.getItem('portal_access_token'); }
  function deviceId() {
    var id = localStorage.getItem('kgd_device_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('kgd_device_id', id); }
    return id;
  }
  function api(path, opt) {
    var o = opt || {};
    var h = { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() };
    if (token()) h.Authorization = 'Bearer ' + token();
    return fetch(API + path, { method: o.method || 'GET', headers: h, body: o.body })
      .then(function (r) {
        return r.json().then(function (b) {
          if (!r.ok || !b || b.success === false) throw new Error((b && b.error && b.error.code) || r.status);
          return b.data;
        });
      });
  }
  function migrate(d) {
    var m = Object.assign(defaults(), d);
    if (!m.weapons) m.weapons = { sword: 1 };
    if (!m.weapon) m.weapon = 'sword';
    return m;
  }
  function loadSave(codeOverride) {
    var code = codeOverride || saveCode;
    var q = (!token() && code) ? '?code=' + encodeURIComponent(code) : '';
    var p2 = (token() || code) ? api('/save' + q) : Promise.reject(new Error('NO_ID'));
    return p2.then(function (s) {
      saveVersion = s.version;
      if (s.code) { saveCode = s.code; localStorage.setItem('nr_code', s.code); }
      if (s.data) S = migrate(s.data);
      $('saveStatus').textContent = L('☁ 서버 세이브 (v' + saveVersion + ')', '☁ Cloud save (v' + saveVersion + ')');
      return true;
    }).catch(function () {
      try { S = migrate(JSON.parse(localStorage.getItem('nr_save')) || {}); } catch (_) { S = defaults(); }
      $('saveStatus').textContent = L('브라우저 저장 — 저장하면 이어하기 코드가 발급된다', 'Browser save — a continue code is issued on save');
      return false;
    }).then(function (ok) { if (!S) S = defaults(); showCode(); return ok; });
  }
  var saveT = null;
  function persist() {
    localStorage.setItem('nr_save', JSON.stringify(S));
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      api('/save', { method: 'PUT', body: JSON.stringify({ data: S, version: saveVersion, code: saveCode }) })
        .then(function (s) {
          saveVersion = s.version;
          if (s.code && s.code !== saveCode) { saveCode = s.code; localStorage.setItem('nr_code', s.code); }
          showCode();
        }).catch(function () { /* 로컬에는 남았다 */ });
    }, 300);
  }
  function showCode() {
    $('codeShow').textContent = saveCode ? '🔑 ' + saveCode.replace(/(.{4})(?=.)/g, '$1-') : '';
  }

  /* ═══════════ 입력 — 키보드/패드/터치. 마우스는 카드·메뉴 클릭에만 쓴다 ═══════════ */
  var keys = {};
  var atkBuf = 0, castBuf = 0, dashBuf = 0;
  addEventListener('keydown', function (e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    FX.audio();
    // 양손 배치를 다 받는다 — 방향키(오른손 이동)+왼손 ZXC / WASD(왼손 이동)+오른손 JKL
    if (e.code === 'KeyZ' || e.code === 'KeyJ') atkBuf = 0.18;
    if (e.code === 'KeyX' || e.code === 'KeyK') castBuf = 0.18;
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'KeyC' || e.code === 'KeyL') dashBuf = 0.18;
    if (e.code === 'KeyM') { FX.setMute(!FX.isMuted()); }
    if (e.code === 'Escape') onEsc();
    if (state === 'pick') pickKey(e.code);
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });
  cv.addEventListener('mousedown', function (e) {
    FX.audio();
    if (state === 'pick') pickClick(e);
  });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'play') openPause();
  });

  function moveAxis() {
    var x = 0, y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (window.GameTouch && GameTouch.enabled) {
      var a = GameTouch.axis();
      if (a.mag > 0.15) { x = a.x; y = a.y; }
    }
    var m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x: x, y: y };
  }

  /* ═══════════ 런 상태 ═══════════ */
  var state = 'menu';
  var paused = false, pauseSel = 0;
  var R = null, p = null, st = null;
  var foes = [], shots = [], coins = [], zones = [], slashes = [];
  var room = null, floorCv = null;
  var timescale = 1, slowT = 0;
  var banner = null;
  var run$ = null;

  function weaponDef() {
    var key = (R && R.weapon) || S.weapon || 'sword';
    for (var i = 0; i < DATA.WEAPONS.length; i++) if (DATA.WEAPONS[i].key === key) return DATA.WEAPONS[i];
    return DATA.WEAPONS[0];
  }

  function newRun() {
    var seed = (Math.random() * 0xffffffff) >>> 0;
    R = {
      tier: 0, roomN: 0, gold: 40 * lvl('gold'), boons: [], forge: [],
      kills: 0, roomsCleared: 0, noHit: 0, time: 0,
      defyLeft: 0, seed: seed, rng: seed, weapon: S.weapon || 'sword',
      godsSeen: {}, forgeCount: 0, bossDown: {}, pending: null,
    };
    srand(seed);
    R.pending = { reward: 'boon', god: pick(Object.keys(DATA.GODS)) };
    api('/runs', { method: 'POST' }).then(function (r) { run$ = r; }).catch(function () { run$ = null; });
    S.runs += 1;
    st = null;
    p = null;
    buildStats();
    p.hp = st.maxHp;
    R.defyLeft = st.defy;
    nextRoom();
  }

  function resumeRun() {
    var r = S.run;
    if (!r) return;
    R = JSON.parse(JSON.stringify(r));
    rngA = R.rng >>> 0;
    st = null;
    p = null;
    buildStats();
    p.hp = clamp(R.hp, 1, st.maxHp);
    enterRoom();
  }

  /** 방 진입 직전 상태를 세이브에 눕힌다 — "끊었다 이어하기"의 실체 */
  function suspendToSave() {
    R.rng = rngA >>> 0;
    R.hp = p.hp;
    S.run = JSON.parse(JSON.stringify(R));
    persist();
  }

  function lvl(k) { return (S.up && S.up[k]) || 0; }

  /* ═══════════ 스탯 ═══════════ */
  var BOON_BY_KEY = {}, FORGE_BY_KEY = {};
  DATA.BOONS.forEach(function (b) { BOON_BY_KEY[b.key] = b; });
  DATA.FORGE.forEach(function (f) { FORGE_BY_KEY[f.key] = f; });

  function boonValue(b, rar) {
    if (b.legend) return 0;
    return Math.round(b.base * DATA.RARITY[rar].mul);
  }

  function buildStats() {
    var oldMax = st ? st.maxHp : 0;
    st = {
      dmgMul: 1 + lvl('dmg') * 0.06, dmgFlat: 0, atkSpd: 1, reach: 1,
      finisherMul: 1, finisherBlast: 0, burn: 0, vsBurn: 0,
      castDmgMul: 1, castFire: false, castCharges: 2,
      execute: 0, maxHp: 100 + lvl('hp') * 12, maxHpAdd: 0,
      healOnKill: 0, healOnClear: 0, healMul: 1, thorns: 0,
      defy: lvl('defy'), defyHeal: 0.5,
      dashCharges: 1 + lvl('dash'), dashDmg: 0, dashCd: 1, dashTempo: 0, dashIframe: 1,
      moveSpd: 1, armor: 0, knockMul: 1, wallSlam: 0, goldGain: 0,
      crit: 0, petrify: 0, hurtGuard: 0,
    };
    if (R) {
      R.boons.forEach(function (o) { BOON_BY_KEY[o.key].apply(st, boonValue(BOON_BY_KEY[o.key], o.rar)); });
      R.forge.forEach(function (k) { FORGE_BY_KEY[k].apply(st); });
    }
    st.maxHp += st.maxHpAdd;
    st.armor = Math.min(0.6, st.armor);
    // atkT/dashT 를 0 으로 명시 초기화 — undefined 는 `<= 0` 비교에서 false 라(NaN)
    // "대시를 한 번도 안 하면 홀드 연격이 안 나가는" 유령 버그를 만든다 (실측으로 잡음)
    if (!p) p = { x: AW / 2, y: AH - 60, r: 6, hp: 100, face: 1, faceDir: { x: 0, y: -1 },
      iframe: 0, hurtT: 0, guardT: 0, atkT: 0, dashT: 0 };
    if (oldMax && st.maxHp > oldMax) p.hp += st.maxHp - oldMax;
    p.hp = clamp(p.hp, 0, st.maxHp);
    p.dashMax = st.dashCharges;
    if (p.dash == null || p.dash > p.dashMax) p.dash = p.dashMax;
    p.castMax = st.castCharges;
    if (p.cast == null || p.cast > p.castMax) p.cast = p.castMax;
  }

  /* ═══════════ 방 생성 ═══════════ */
  function tierDef() { return DATA.TIERS[R.tier]; }

  function nextRoom() {
    R.roomN += 1;
    if (R.roomN > tierDef().rooms) {
      if (R.tier >= DATA.TIERS.length - 1) { victory(); return; }
      R.tier += 1;
      R.roomN = 0;
    }
    suspendToSave();
    enterRoom();
  }

  function setArena(aw, ah) {
    AW = aw; AH = ah;
    ARENA = { x0: 28, y0: 46, x1: AW - 28, y1: AH - 26 };
  }

  function enterRoom() {
    foes = []; shots = []; coins = []; zones = []; slashes = [];
    FX.reset();
    var t = tierDef();
    var isBoss = R.roomN === t.rooms;
    var isFount = R.roomN === 0;

    // 방 구조 — 보스는 넓은 결전장, 샘은 아늑한 소실, 나머지는 8종 구조 중 랜덤
    var lay = isBoss ? { aw: 640, ah: 360, cols: [], pits: [], crates: [], spikes: [] }
      : isFount ? { aw: 448, ah: 252, cols: [[6, 6], [21, 6]], pits: [], crates: [], spikes: [] }
      : DATA.LAYOUTS[(rnd() * DATA.LAYOUTS.length) | 0];
    setArena(lay.aw, lay.ah);

    room = {
      boss: isBoss, fountain: isFount, cleared: isFount,
      wave: 0, waves: [], doors: [], solids: [], spikes: [], crates: [],
      fountUsed: false, hitThisRoom: false, lay: lay, torches: [],
    };
    room.solids.push({ x: -40, y: -40, w: AW + 80, h: ARENA.y0 + 34 });
    room.solids.push({ x: -40, y: ARENA.y1 + 6, w: AW + 80, h: AH - ARENA.y1 + 40 });
    room.solids.push({ x: -40, y: -40, w: ARENA.x0 + 34, h: AH + 80 });
    room.solids.push({ x: ARENA.x1 + 6, y: -40, w: AW - ARENA.x1 + 40, h: AH + 80 });
    lay.pits.forEach(function (q) {
      room.solids.push({ x: q[0] * TILE, y: q[1] * TILE, w: q[2] * TILE, h: q[3] * TILE, pit: true });
    });
    lay.cols.forEach(function (c) {
      room.solids.push({ x: c[0] * TILE, y: c[1] * TILE, w: TILE, h: TILE, col: true });
    });
    lay.crates.forEach(function (c) {
      room.crates.push({ x: c[0] * TILE + 8, y: c[1] * TILE + 14, hp: 10, r: 7 });
    });
    lay.spikes.forEach(function (sp) {
      room.spikes.push({ x: sp[0] * TILE + 8, y: sp[1] * TILE + 8, ph: rnd() * 2.2 });
    });

    if (!isBoss && !isFount) {
      // 난이도: 초반 2웨이브, 3방부터 3웨이브
      var waveCount = R.roomN >= 3 ? 3 : 2;
      for (var wv = 0; wv < waveCount; wv++) room.waves.push(makeWave(wv));
    }
    if (isBoss) spawnBoss();
    if (isFount) {
      room.fount = { x: AW / 2, y: AH / 2 - 10 };
      rollDoorRewards();
      banner = { title: TX(t.name), sub: L('회복의 샘', 'Fountain of Rest'), t: 2.2 };
      FX.sfx('heal');
    } else {
      banner = { title: TX(t.name) + ' · ' + R.roomN + ' / ' + t.rooms,
        sub: isBoss ? TX(DATA.BOSSES[t.boss].name) : '', t: 1.6 };
    }
    for (var tx = 5; tx < AW / TILE - 3; tx += 6) room.torches.push({ x: tx * TILE + 8, y: ARENA.y0 - 8 });
    p.x = AW / 2; p.y = ARENA.y1 - 20;
    p.iframe = 0.6;
    cam.x = AW <= VW ? (AW - VW) / 2 : clamp(p.x - VW / 2, 0, AW - VW);
    cam.y = AH <= VH ? (AH - VH) / 2 : clamp(p.y - VH / 2, 0, AH - VH);
    prerenderFloor();
    FX.music(R.tier);
    if (isBoss) FX.sfx('boss');
    state = 'play';
    syncPanels(false);
  }

  function makeWave(wv) {
    var t = tierDef(), out = [];
    var n = 4 + ((rnd() * 3) | 0) + (R.roomN >= 4 ? 1 : 0) + (R.roomN >= 6 ? 1 : 0) + wv;
    for (var i = 0; i < n; i++) {
      var kind = pick(t.roster);
      var elite = rnd() < 0.1 + R.tier * 0.08 + R.roomN * 0.015;
      out.push({ kind: kind, elite: elite });
    }
    return out;
  }

  function spawnFoe(def, elite, x, y) {
    var d = DATA.ENEMIES[def];
    var hpMul = (1 + R.tier * 0.6 + R.roomN * 0.04) * (elite ? 1.9 : 1);
    foes.push({
      kind: def, spr: d.spr, x: x, y: y, r: d.r,
      hp: Math.round(d.hp * hpMul), maxHp: Math.round(d.hp * hpMul),
      spd: d.spd * (elite ? 1.15 : 1), dmg: Math.round(d.dmg * (1 + R.tier * 0.4) * (elite ? 1.3 : 1)),
      coin: d.coin * (elite ? 4 : 1), elite: elite,
      state: 'move', t: rnd() * 0.7 + 0.25,
      cd: d.atkCd * (1 - R.tier * 0.08), tele: d.tele * (1 - R.tier * 0.1),
      vx: 0, vy: 0, flash: 0, burnT: 0, burnD: 0, kx: 0, ky: 0, face: 1,
      def: d, stun: 0, anim: rnd() * 4, boss: false,
    });
  }

  function spawnWavePoints(list) {
    list.forEach(function (w) {
      var x, y, tries = 0;
      do {
        x = ARENA.x0 + 24 + rnd() * (ARENA.x1 - ARENA.x0 - 48);
        y = ARENA.y0 + 24 + rnd() * (ARENA.y1 - ARENA.y0 - 60);
        tries++;
      } while (tries < 24 && (dist2(x, y, p.x, p.y) < 100 * 100 || solidAt(x, y, 8)));
      spawnFoe(w.kind, w.elite, x, y);
      FX.burst(x, y, '#b48aff', 8, 60, 0.4, -30);
    });
    FX.sfx('tele');
  }

  function spawnBoss() {
    var t = tierDef(), b = DATA.BOSSES[t.boss];
    foes.push({
      kind: t.boss, spr: b.spr, x: AW / 2, y: AH / 2 - 40, r: b.r,
      hp: b.hp, maxHp: b.hp,
      spd: b.spd, dmg: 18 + R.tier * 5, coin: b.coin, elite: false, boss: true,
      state: 'move', t: 1.2, cd: 2.0, tele: 0.55, scale: b.scale,
      vx: 0, vy: 0, flash: 0, burnT: 0, burnD: 0, kx: 0, ky: 0, face: 1,
      def: b, stun: 0, anim: 0, phase: 1, pat: 0, summoned: false, name: TX(b.name),
    });
  }

  function makeDoors(rewards) {
    room.doors = [];
    var n = rewards.length;
    for (var i = 0; i < n; i++) {
      var x = n === 1 ? AW / 2 : AW / 2 + (i === 0 ? -80 : 80);
      var reward = rewards[i];
      var god = null;
      if (reward === 'boon') {
        var giftGods = Object.keys(DATA.GODS);
        god = giftGods[(rnd() * giftGods.length) | 0];
      }
      room.doors.push({ x: x, reward: reward, god: god });
    }
  }

  /** 문 = 다음 방을 제압하면 받을 보상의 예고 (하데스 시그니처) */
  function rollDoorRewards() {
    var t = tierDef();
    var next = R.roomN + 1;
    if (next > t.rooms) { makeDoors(['next']); return; }
    if (next === t.rooms) { makeDoors(['boss']); return; }
    var pool = ['boon', 'boon', 'boon', 'gold', 'gold'];
    if (R.forgeCount < 2) pool.push('forge');
    if (p.hp < st.maxHp * 0.5) pool.push('heal');
    var a = pick(pool), b = pick(pool), tries = 0;
    while (b === a && tries++ < 6) b = pick(pool);
    makeDoors(rnd() < 0.65 && a !== b ? [a, b] : [a]);
  }

  function grantReward() {
    var pd = R.pending;
    R.pending = null;
    if (!pd) return;
    if (pd.reward === 'boon') { openBoonPick(pd.god || pick(Object.keys(DATA.GODS))); return; }
    if (pd.reward === 'forge') { openForgePick(); return; }
    if (pd.reward === 'gold') {
      var val = 6 + R.tier * 3;
      for (var i = 0; i < 10; i++) {
        coins.push({ x: AW / 2 + (rnd() - 0.5) * 60, y: ARENA.y0 + 40, vx: (rnd() - 0.5) * 120, vy: -40 - rnd() * 60, t: 0, val: val });
      }
      FX.sfx('coin');
    }
    if (pd.reward === 'heal') { heal(Math.round(st.maxHp * 0.25)); FX.sfx('heal'); }
  }

  /* 바닥 프리렌더 — "맵이 단조롭다"를 잡는 층위: 길 → 얼룩 → 색조 → 벽·측벽 → AO → 소품 */
  function prerenderFloor() {
    floorCv = document.createElement('canvas');
    floorCv.width = AW; floorCv.height = AH;
    var g = floorCv.getContext('2d');
    g.imageSmoothingEnabled = false;
    var t = tierDef();
    g.fillStyle = '#050409';
    g.fillRect(0, 0, AW, AH);
    var tw = AW / TILE, th = AH / TILE;
    for (var ty = 2; ty < th; ty++) {
      for (var tx = 1; tx < tw - 1; tx++) {
        Atlas.draw(g, 'floor_' + (1 + ((rnd() * 8) | 0)), 0, tx * TILE + 8, ty * TILE + 16);
      }
    }
    // 통행로 — 아래 입구에서 문까지 어두운 길이 나 있다 (방에 방향성을 준다)
    var roadX = AW / 2 - TILE;
    g.fillStyle = 'rgba(0,0,0,.16)';
    g.fillRect(roadX, ARENA.y0, TILE * 2, ARENA.y1 - ARENA.y0 + 10);
    g.fillStyle = 'rgba(255,255,255,.03)';
    g.fillRect(roadX - 1, ARENA.y0, 1, ARENA.y1 - ARENA.y0 + 10);
    g.fillRect(roadX + TILE * 2, ARENA.y0, 1, ARENA.y1 - ARENA.y0 + 10);
    // 이끼/핏자국 얼룩 — 계층색 반투명 뭉치
    var stainC = R.tier === 0 ? 'rgba(90,70,140,.12)' : R.tier === 1 ? 'rgba(150,30,30,.13)' : 'rgba(40,130,140,.12)';
    for (var sN = 0; sN < 8 + tw / 4; sN++) {
      var sx2 = ARENA.x0 + rnd() * (ARENA.x1 - ARENA.x0);
      var sy2 = ARENA.y0 + rnd() * (ARENA.y1 - ARENA.y0);
      var sr = 10 + rnd() * 22;
      var sg = g.createRadialGradient(sx2, sy2, 2, sx2, sy2, sr);
      sg.addColorStop(0, stainC);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg;
      g.beginPath(); g.arc(sx2, sy2, sr, 0, 7); g.fill();
    }
    // 계층 색조 — multiply 는 타일 질감을 죽였다. overlay 로 색만 얹는다
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.6;
    g.fillStyle = t.floor;
    g.fillRect(0, 0, AW, AH);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // 윗벽 (얼굴 있는 벽)
    for (var x = 0; x < tw; x++) {
      Atlas.draw(g, 'wall_mid', 0, x * TILE + 8, ARENA.y0 - 2);
      Atlas.draw(g, 'wall_top_mid', 0, x * TILE + 8, ARENA.y0 - 14);
    }
    // 윗벽 변화 — 배너·구멍·벽기둥을 섞어 벽이 한 패턴으로 반복되지 않게
    var bannerSpr = R.tier === 2 ? 'wall_banner_blue' : 'wall_banner_red';
    for (var bx = 3; bx < tw - 2; bx += 4) {
      var kind = (rnd() * 4) | 0;
      if (kind === 0) Atlas.draw(g, bannerSpr, 0, bx * TILE + 8, ARENA.y0 - 2);
      else if (kind === 1) Atlas.draw(g, 'wall_hole_1', 0, bx * TILE + 8, ARENA.y0 - 2);
      else if (kind === 2) {
        Atlas.draw(g, 'wall_column_mid', 0, bx * TILE + 8, ARENA.y0 - 2);
        Atlas.draw(g, 'wall_column_top', 0, bx * TILE + 8, ARENA.y0 - 18);
      }
    }
    // 바깥 영역
    g.fillStyle = '#08060d';
    g.fillRect(0, ARENA.y1 + 10, AW, AH - ARENA.y1 - 10);
    g.fillRect(0, 0, ARENA.x0 - 10, AH);
    g.fillRect(ARENA.x1 + 10, 0, AW - ARENA.x1 - 10, AH);
    // 측벽 — 좌우 가장자리에 기둥 라인 (전에는 그냥 검은 띠였다)
    for (var wy = 3; wy < th - 1; wy += 3) {
      Atlas.draw(g, 'column_mid', 0, ARENA.x0 - 12, wy * TILE + 12);
      Atlas.draw(g, 'column_top', 0, ARENA.x0 - 12, wy * TILE - 4);
      Atlas.draw(g, 'column_mid', 0, ARENA.x1 + 12, wy * TILE + 12);
      Atlas.draw(g, 'column_top', 0, ARENA.x1 + 12, wy * TILE - 4);
    }
    // 아랫벽 윗면
    for (var x2 = 0; x2 < tw; x2++) Atlas.draw(g, 'wall_top_mid', 0, x2 * TILE + 8, ARENA.y1 + 24);
    // 구덩이 — 검은 심연 + 가장자리 명암
    room.lay.pits.forEach(function (q) {
      var px2 = q[0] * TILE, py2 = q[1] * TILE, pw = q[2] * TILE, ph = q[3] * TILE;
      g.fillStyle = '#030208';
      g.fillRect(px2, py2, pw, ph);
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.fillRect(px2, py2 + ph - 2, pw, 2);
      var pg = g.createLinearGradient(0, py2, 0, py2 + Math.min(12, ph));
      pg.addColorStop(0, 'rgba(0,0,0,.7)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg;
      g.fillRect(px2, py2, pw, Math.min(12, ph));
    });
    // 기둥 (아레나 내부)
    room.lay.cols.forEach(function (c) {
      Atlas.draw(g, 'column_mid', 0, c[0] * TILE + 8, c[1] * TILE + 16);
      Atlas.draw(g, 'column_top', 0, c[0] * TILE + 8, c[1] * TILE);
      // 기둥 발치 그림자
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.ellipse(c[0] * TILE + 8, c[1] * TILE + 17, 8, 3, 0, 0, 7); g.fill();
    });
    // 소품 — 해골·부서진 상자·빈 궤짝을 밀도 있게
    var deco = 5 + ((rnd() * 5) | 0) + ((tw / 8) | 0);
    for (var d = 0; d < deco; d++) {
      var dx = ARENA.x0 + 10 + rnd() * (ARENA.x1 - ARENA.x0 - 20);
      var dy = ARENA.y0 + 14 + rnd() * (ARENA.y1 - ARENA.y0 - 24);
      if (solidAt(dx, dy, 8)) continue;
      var dk = rnd();
      if (dk < 0.5) Atlas.draw(g, 'skull', 0, dx, dy, { alpha: 0.75 });
      else if (dk < 0.75) Atlas.draw(g, 'chest_empty_open_anim', 2, dx, dy, { alpha: 0.85 });
      else { Atlas.draw(g, 'crate', 0, dx, dy, { alpha: 0.8, scale: 0.8 }); }
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(dx, dy + 1, 6, 2, 0, 0, 7); g.fill();
    }
    // AO — 벽 밑 접지 음영 + 모서리 어둠. 평평하던 방에 깊이를 주는 제일 싼 방법
    var ao = g.createLinearGradient(0, ARENA.y0 - 2, 0, ARENA.y0 + 16);
    ao.addColorStop(0, 'rgba(0,0,0,.5)');
    ao.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ao;
    g.fillRect(ARENA.x0 - 8, ARENA.y0 - 2, ARENA.x1 - ARENA.x0 + 16, 18);
    var aoL = g.createLinearGradient(ARENA.x0 - 6, 0, ARENA.x0 + 14, 0);
    aoL.addColorStop(0, 'rgba(0,0,0,.4)');
    aoL.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = aoL;
    g.fillRect(ARENA.x0 - 6, ARENA.y0, 20, ARENA.y1 - ARENA.y0);
    var aoR = g.createLinearGradient(ARENA.x1 + 6, 0, ARENA.x1 - 14, 0);
    aoR.addColorStop(0, 'rgba(0,0,0,.4)');
    aoR.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = aoR;
    g.fillRect(ARENA.x1 - 14, ARENA.y0, 20, ARENA.y1 - ARENA.y0);
    var aoB = g.createLinearGradient(0, ARENA.y1 + 8, 0, ARENA.y1 - 10);
    aoB.addColorStop(0, 'rgba(0,0,0,.45)');
    aoB.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = aoB;
    g.fillRect(ARENA.x0 - 8, ARENA.y1 - 10, ARENA.x1 - ARENA.x0 + 16, 18);
    // 보스방 — 붉은 카펫 + 배너 열
    if (room.boss) {
      g.fillStyle = 'rgba(140,20,30,.2)';
      g.fillRect(AW / 2 - 24, ARENA.y0, 48, ARENA.y1 - ARENA.y0 + 10);
      g.fillStyle = 'rgba(255,220,150,.06)';
      g.fillRect(AW / 2 - 26, ARENA.y0, 2, ARENA.y1 - ARENA.y0 + 10);
      g.fillRect(AW / 2 + 24, ARENA.y0, 2, ARENA.y1 - ARENA.y0 + 10);
      Atlas.draw(g, 'wall_banner_red', 0, AW / 2 - 24, ARENA.y0 - 2);
      Atlas.draw(g, 'wall_banner_red', 0, AW / 2 + 24, ARENA.y0 - 2);
    }
  }

  /* ═══════════ 충돌 ═══════════ */
  function solidAt(x, y, r) {
    for (var i = 0; i < room.solids.length; i++) {
      var s = room.solids[i];
      if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return s;
    }
    return null;
  }
  function resolveCircle(e) {
    for (var i = 0; i < room.solids.length; i++) {
      var s = room.solids[i];
      var nx = clamp(e.x, s.x, s.x + s.w), ny = clamp(e.y, s.y, s.y + s.h);
      var dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
      if (d2 < e.r * e.r && d2 > 0) {
        var d = Math.sqrt(d2), push = (e.r - d) / d;
        e.x += dx * push; e.y += dy * push;
      } else if (d2 === 0) { e.y -= e.r; }
    }
    e.x = clamp(e.x, ARENA.x0 + 2, ARENA.x1 - 2);
    e.y = clamp(e.y, ARENA.y0 + 2, ARENA.y1 - 2);
  }

  /* ═══════════ 데미지 파이프라인 ═══════════ */
  function hurtFoe(e, raw, kx, ky, opts) {
    var o = opts || {};
    var dmg = raw;
    var isCrit = !o.noCrit && Math.random() < st.crit;
    if (isCrit) dmg *= 1.5;
    if (e.burnT > 0) dmg *= 1 + st.vsBurn;
    dmg = Math.round(dmg);
    e.hp -= dmg;
    e.flash = 0.09;
    var km = st.knockMul * (e.boss ? 0.15 : 1);
    e.kx += kx * km; e.ky += ky * km;
    FX.num(e.x, e.y - 14, dmg, isCrit ? '#ffd54a' : '#fff', isCrit);
    FX.burst(e.x, e.y - 6, isCrit ? '#ffd54a' : '#ffb4a0', isCrit ? 10 : 6, 90, 0.35);
    FX.sfx(isCrit ? 'crit' : 'hit');
    if (!o.soft) { FX.hitstop(0.04); FX.shake(isCrit ? 3 : 1.6); }
    if (st.burn > 0 && !o.noBurn) { e.burnT = 3; e.burnD = raw * st.burn / 3; }
    if (st.execute > 0 && !e.boss && e.hp > 0 && e.hp < e.maxHp * st.execute) {
      e.hp = 0;
      FX.num(e.x, e.y - 24, L('처형', 'EXECUTED'), '#ff5c4a', true);
      FX.sfx('execute');
    }
    if (e.hp <= 0) killFoe(e);
  }

  function killFoe(e) {
    e.dead = true;
    R.kills += 1; S.proph.kills += 1;
    FX.burst(e.x, e.y - 6, '#c8b4ff', 14, 110, 0.5);
    FX.shake(e.boss ? 8 : 2);
    if (st.healOnKill) heal(st.healOnKill);
    // 명전은 엔티티 수를 캡하고 가치를 나눠 싣는다 — 보스가 150개를 흩뿌리면 프레임이 죽는다
    var total = e.coin + ((rnd() * 2) | 0);
    var n = Math.min(12, total);
    var each = Math.max(1, Math.round(total / n));
    for (var i = 0; i < n; i++) {
      coins.push({ x: e.x, y: e.y - 4, vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 50, t: 0, val: each });
    }
    if (e.boss) onBossDown(e);
  }

  function heal(amount) {
    var n = Math.round(amount * st.healMul);
    if (n <= 0) return;
    p.hp = clamp(p.hp + n, 0, st.maxHp);
    FX.num(p.x, p.y - 20, '+' + n, '#5ce8a8');
  }

  function hurtPlayer(dmg, srcX, srcY) {
    if (p.iframe > 0 || state !== 'play') return;
    var mul = 1 - st.armor;
    if (p.guardT > 0) mul *= 1 - st.hurtGuard;
    var n = Math.max(1, Math.round(dmg * mul));
    p.hp -= n;
    p.iframe = 0.6;
    p.hurtT = 0.25;
    p.guardT = 3;
    room.hitThisRoom = true;
    R.noHit = 0;
    FX.num(p.x, p.y - 22, '-' + n, '#ff6a6a', true);
    FX.shake(5); FX.hitstop(0.05); FX.flash('#c02020', 0.28);
    FX.sfx('hurt');
    if (st.thorns > 0) {
      foes.forEach(function (e) {
        if (!e.dead && dist2(e.x, e.y, p.x, p.y) < 60 * 60) hurtFoe(e, st.thorns, 0, 0, { soft: true, noBurn: true });
      });
    }
    if (st.petrify > 0) {
      foes.forEach(function (e) {
        if (!e.dead && !e.boss && dist2(e.x, e.y, p.x, p.y) < 80 * 80) { e.stun = Math.max(e.stun, st.petrify); e.petrified = true; }
      });
    }
    if (p.hp <= 0) {
      if (R.defyLeft > 0) {
        R.defyLeft -= 1;
        p.hp = Math.round(st.maxHp * st.defyHeal);
        p.iframe = 2;
        FX.flash('#ffd54a', 0.5); FX.shake(8);
        FX.num(p.x, p.y - 30, L('환생', 'DEFIANCE'), '#ffd54a', true);
        FX.sfx('boon');
        foes.forEach(function (e) { if (!e.dead && !e.boss) { e.kx += (e.x - p.x) * 6; e.ky += (e.y - p.y) * 6; } });
      } else {
        death();
      }
    }
  }

  /* ═══════════ 플레이어 행동 — 바라보는 방향 + 하데스식 조준 보정 ═══════════ */
  function aimDir() {
    var f = p.faceDir || { x: p.face, y: 0 };
    var best = null, bd = 1e9;
    // 전방 원뿔(≈±70°) 안 최근접 적에게 스냅
    foes.forEach(function (e) {
      if (e.dead) return;
      var dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
      if (d > 150 * 150) return;
      var m = Math.sqrt(d) || 1;
      var dot = (dx / m) * f.x + (dy / m) * f.y;
      if (dot > 0.35 && d < bd) { bd = d; best = { x: dx / m, y: dy / m }; }
    });
    if (!best) {
      // 포옹 거리면 방향 무관 스냅 — 등 뒤에 붙은 적을 못 베는 답답함 방지
      var nd = 46 * 46;
      foes.forEach(function (e) {
        if (e.dead) return;
        var dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
        if (d < nd) { nd = d; var m = Math.sqrt(d) || 1; best = { x: dx / m, y: dy / m }; }
      });
    }
    return best || f;
  }

  function tryAttack() {
    if (p.atkT > 0 || p.dashT > 0) return;
    var wd = weaponDef();
    var a = aimDir();
    p.face = a.x < 0 ? -1 : 1;
    var stage = (p.combo || 0) % wd.combo.length;
    var step = wd.combo[stage];
    p.combo = stage + 1;
    p.comboReset = 1.0;
    var spd = st.atkSpd * (p.tempoT > 0 ? 1 + st.dashTempo : 1);
    p.atkT = step.t / spd;
    p.atkMax = p.atkT;
    p.atkStep = step;
    p.atkDir = a;
    p.lungeX = a.x * step.lunge;
    p.lungeY = a.y * step.lunge;
    p.swung = false;
    FX.sfx('swing');
  }

  function doSwing() {
    var step = p.atkStep;
    var reach = step.reach * st.reach;
    var arc = step.arc;
    var base = (step.dmg + st.dmgFlat) * st.dmgMul * (step.finisher ? st.finisherMul : 1);
    var dir = Math.atan2(p.atkDir.y, p.atkDir.x);
    slashes.push({ x: p.x, y: p.y - 6, dir: dir, arc: arc, r: reach, t: 0.12, max: 0.12, big: !!step.finisher });
    foes.forEach(function (e) {
      if (e.dead) return;
      var dx = e.x - p.x, dy = e.y - p.y - (e.boss ? 0 : 2);
      var d = Math.hypot(dx, dy);
      if (d > reach + e.r) return;
      var ang = Math.atan2(dy, dx);
      var diff = Math.abs(((ang - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > arc / 2) return;
      hurtFoe(e, base, dx / (d || 1) * 130, dy / (d || 1) * 130, {});
      if (step.finisher && st.finisherBlast > 0) {
        foes.forEach(function (o) {
          if (o.dead || o === e) return;
          if (dist2(o.x, o.y, e.x, e.y) < 48 * 48) hurtFoe(o, base * st.finisherBlast, 0, 0, { soft: true });
        });
        FX.burst(e.x, e.y - 6, '#ff8a4a', 16, 130, 0.4);
      }
    });
    room.crates.forEach(function (c) {
      if (c.dead) return;
      if (dist2(c.x, c.y, p.x + p.atkDir.x * reach * 0.6, p.y + p.atkDir.y * reach * 0.6) < (reach * 0.8) * (reach * 0.8)) {
        c.hp -= 10; FX.burst(c.x, c.y - 6, '#c8a058', 8, 80, 0.4);
        if (c.hp <= 0) { c.dead = true; crateDrop(c); }
      }
    });
  }

  function crateDrop(c) {
    FX.sfx('hit');
    if (rnd() < 0.25) coins.push({ x: c.x, y: c.y, vx: 0, vy: -40, t: 0, val: 3 });
    if (rnd() < 0.14) coins.push({ x: c.x, y: c.y, vx: 20, vy: -50, t: 0, val: 0, flask: true });
  }

  function tryDash() {
    if (p.dash <= 0 || p.dashT > 0) return;
    var m = moveAxis();
    var dx = m.x, dy = m.y;
    if (!dx && !dy) { dx = p.faceDir.x; dy = p.faceDir.y; }
    p.dash -= 1;
    p.dashT = 0.16;
    p.dashDX = dx; p.dashDY = dy;
    p.iframe = Math.max(p.iframe, 0.3 * st.dashIframe);
    p.tempoT = st.dashTempo > 0 ? 2 : 0;
    p.trail = [];
    FX.sfx('dash');
  }

  function tryCast() {
    if (p.cast <= 0) return;
    p.cast -= 1;
    p.castCd = 3.2;
    var d = aimDir();
    shots.push({ own: 'p', x: p.x + d.x * 10, y: p.y - 6 + d.y * 10, vx: d.x * 300, vy: d.y * 300,
      dmg: Math.round(24 * st.castDmgMul * st.dmgMul), r: 3, fire: st.castFire, life: 1.4 });
    FX.sfx('cast');
  }

  /* ═══════════ 적 AI ═══════════ */
  function foeAI(e, dt) {
    if (e.stun > 0) { e.stun -= dt; e.vx = e.vy = 0; if (e.stun <= 0) e.petrified = false; return; }
    e.anim += dt * 8;
    var dx = p.x - e.x, dy = p.y - e.y;
    var d = Math.hypot(dx, dy) || 1;
    var ux = dx / d, uy = dy / d;
    e.face = dx < 0 ? -1 : 1;

    if (e.boss) { bossAI(e, dt, d, ux, uy); return; }

    if (e.state === 'move') {
      e.t -= dt;
      var want = e.def.ranged ? 120 : 0;
      var toward = d > want ? 1 : (d < want - 30 ? -0.7 : 0);
      var sx = 0, sy = 0;
      foes.forEach(function (o) {
        if (o === e || o.dead) return;
        var ddx = e.x - o.x, ddy = e.y - o.y, dd = ddx * ddx + ddy * ddy;
        if (dd < 400 && dd > 0) { var m = Math.sqrt(dd); sx += ddx / m; sy += ddy / m; }
      });
      e.vx = (ux * toward + sx * 0.5) * e.spd;
      e.vy = (uy * toward + sy * 0.5) * e.spd;
      if (e.t <= 0 && d < (e.def.ranged ? 210 : 46) + (e.def.charger ? 120 : 0)) {
        e.state = 'tele'; e.t = e.tele;
        e.teleMax = e.tele;
        e.tx = p.x; e.ty = p.y;
        e.vx = e.vy = 0;
      }
    } else if (e.state === 'tele') {
      e.t -= dt;
      e.vx = e.vy = 0;
      if (e.t <= 0) { e.state = 'act'; foeAct(e, ux, uy, d); }
    } else if (e.state === 'act') {
      e.t -= dt;
      if (e.charging) {
        e.x += e.cvx * dt; e.y += e.cvy * dt;
        var s = solidAt(e.x, e.y, e.r + 1);
        if (s) { e.charging = false; e.stun = 0.8; FX.shake(3); FX.sfx('door'); e.state = 'move'; e.t = e.cd; }
        if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r + 2) * (e.r + p.r + 2)) {
          hurtPlayer(e.dmg, e.x, e.y);
          e.charging = false; e.state = 'move'; e.t = e.cd;
        }
        if (e.t <= 0) { e.charging = false; e.state = 'move'; e.t = e.cd; }
      } else if (e.lunging) {
        e.x += e.cvx * dt; e.y += e.cvy * dt;
        if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r + 3) * (e.r + p.r + 3)) {
          hurtPlayer(e.dmg, e.x, e.y);
          e.lunging = false; e.state = 'move'; e.t = e.cd;
        }
        if (e.t <= 0) { e.lunging = false; e.state = 'move'; e.t = e.cd; }
      } else {
        e.state = 'move'; e.t = e.cd;
      }
    }
  }

  function foeAct(e, ux, uy, d) {
    var def = e.def;
    if (def.charger) {
      var tx = e.tx - e.x, ty = e.ty - e.y, m = Math.hypot(tx, ty) || 1;
      e.charging = true; e.cvx = tx / m * 270; e.cvy = ty / m * 270; e.t = 0.9;
      FX.sfx('dash');
    } else if (def.ranged) {
      var n = def.spread || 1;
      for (var i = 0; i < n; i++) {
        var a = Math.atan2(e.ty - e.y, e.tx - e.x) + (i - (n - 1) / 2) * 0.3;
        shots.push({ own: 'e', x: e.x, y: e.y - 6, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
          dmg: e.dmg, r: 3, life: 2.4, fire: e.kind === 'chort' });
      }
      e.state = 'move'; e.t = e.cd;
      FX.sfx('cast');
    } else if (def.summoner) {
      var alive = foes.filter(function (o) { return !o.dead && !o.boss; }).length;
      if (alive < 9) {
        for (var s = 0; s < 2; s++) spawnFoe('imp', false, e.x + (rnd() - 0.5) * 40, e.y + (rnd() - 0.5) * 40);
        FX.sfx('tele');
      }
      e.state = 'move'; e.t = e.cd;
    } else if (def.blinker) {
      FX.burst(e.x, e.y - 6, '#c05cff', 10, 90, 0.4);
      var bx = p.x - ux * 30, by = p.y - uy * 30;
      if (!solidAt(bx, by, e.r)) { e.x = bx; e.y = by; }
      FX.sfx('tele');
      var tx2 = p.x - e.x, ty2 = p.y - e.y, m2 = Math.hypot(tx2, ty2) || 1;
      e.lunging = true; e.cvx = tx2 / m2 * 250; e.cvy = ty2 / m2 * 250; e.t = 0.28;
    } else {
      var tx3 = e.tx - e.x, ty3 = e.ty - e.y, m3 = Math.hypot(tx3, ty3) || 1;
      e.lunging = true; e.cvx = tx3 / m3 * 240; e.cvy = ty3 / m3 * 240; e.t = 0.32;
      FX.sfx('swing');
    }
  }

  /* ═══════════ 보스 AI ═══════════ */
  function bossAI(e, dt, d, ux, uy) {
    if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
      e.phase = 2;
      e.spd *= 1.25;
      FX.flash('#c02020', 0.35); FX.shake(7); FX.sfx('boss');
      FX.num(e.x, e.y - 40, L('격노', 'ENRAGED'), '#ff5c4a', true);
      if (!e.summoned) {
        e.summoned = true;
        var add = e.kind === 'ogre' ? 'imp' : e.kind === 'bigzomb' ? 'skelet' : 'wogol';
        for (var i = 0; i < 3; i++) spawnFoe(add, false, e.x + (i - 1) * 50, e.y);
      }
    }
    if (e.state === 'move') {
      e.t -= dt;
      e.vx = ux * e.spd; e.vy = uy * e.spd;
      if (e.t <= 0) {
        e.state = 'tele';
        e.vx = e.vy = 0;
        e.tx = p.x; e.ty = p.y;
        var pats = e.kind === 'ogre' ? ['slam', 'charge']
          : e.kind === 'bigzomb' ? ['cleave', 'ring', 'charge']
          : ['ring', 'charge', 'zone', 'spiral'];
        e.pat = pick(pats);
        e.t = e.pat === 'slam' || e.pat === 'cleave' ? 0.65 : 0.5;
        e.teleMax = e.t;
      }
    } else if (e.state === 'tele') {
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 'act'; e.t = 0.5;
        var k = e.pat;
        if (k === 'slam' || k === 'cleave') {
          FX.shake(7); FX.sfx('boss');
          FX.burst(e.x, e.y, '#ffb44a', 22, 150, 0.5);
          if (dist2(p.x, p.y, e.x, e.y) < 74 * 74) hurtPlayer(e.dmg + 6, e.x, e.y);
        } else if (k === 'ring') {
          var n = e.phase === 2 ? 16 : 10;
          for (var i2 = 0; i2 < n; i2++) {
            var a2 = i2 / n * Math.PI * 2;
            shots.push({ own: 'e', x: e.x, y: e.y - 8, vx: Math.cos(a2) * 150, vy: Math.sin(a2) * 150,
              dmg: e.dmg - 3, r: 3, life: 2.8, fire: true });
          }
          FX.sfx('cast');
        } else if (k === 'charge') {
          var cx = e.tx - e.x, cy = e.ty - e.y, cm = Math.hypot(cx, cy) || 1;
          e.charging = true; e.cvx = cx / cm * 320; e.cvy = cy / cm * 320; e.t = 1.0;
          FX.sfx('dash');
        } else if (k === 'zone') {
          for (var z = 0; z < 4; z++) {
            zones.push({ x: p.x + (rnd() - 0.5) * 130, y: p.y + (rnd() - 0.5) * 100, r: 30, dps: 16, life: 5, warm: 0.7 });
          }
          FX.sfx('cast');
        } else if (k === 'spiral') {
          e.spiralT = 2.4; e.spiralA = rnd() * 6.28;
        }
      }
    } else if (e.state === 'act') {
      e.t -= dt;
      if (e.charging) {
        e.x += e.cvx * dt; e.y += e.cvy * dt;
        var s2 = solidAt(e.x, e.y, e.r + 1);
        if (s2) { e.charging = false; e.stun = 0.9; FX.shake(6); FX.sfx('door'); }
        if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r + 3) * (e.r + p.r + 3)) {
          hurtPlayer(e.dmg + 4, e.x, e.y);
          e.charging = false;
        }
        if (e.t <= 0) e.charging = false;
      }
      if (e.spiralT > 0) {
        e.spiralT -= dt;
        e.spiralA += dt * 5.6;
        if (!e.spiralTick || e.spiralTick <= 0) {
          e.spiralTick = 0.08;
          shots.push({ own: 'e', x: e.x, y: e.y - 8, vx: Math.cos(e.spiralA) * 155, vy: Math.sin(e.spiralA) * 155,
            dmg: e.dmg - 4, r: 3, life: 2.6, fire: true });
        }
        e.spiralTick -= dt;
      }
      if (e.t <= 0 && !e.charging && !(e.spiralT > 0)) { e.state = 'move'; e.t = e.phase === 2 ? 0.8 : 1.3; }
    }
  }

  function onBossDown(e) {
    FX.sfx('clear');
    FX.flash('#ffd54a', 0.4);
    slowmo(0.7);
    if (e.kind === 'ogre') S.proph.flags.boss1 = 1;
    if (e.kind === 'bigzomb') S.proph.flags.boss2 = 1;
    R.bossDown[e.kind] = 1;
    banner = { title: TX(e.def.name) + ' ' + L('격파', 'DOWN'), sub: '', t: 2 };
  }

  /* ═══════════ 진행 · 승패 ═══════════ */
  function slowmo(t) { slowT = Math.max(slowT, t); }

  function roomCleared() {
    room.cleared = true;
    R.roomsCleared += 1; S.proph.rooms += 1;
    if (!room.hitThisRoom) {
      R.noHit += 1;
      if (R.noHit >= 5) S.proph.flags.noHit5 = 1;
    }
    if (st.healOnClear) heal(st.healOnClear);
    slowmo(0.35);
    FX.sfx('clear');
    banner = { title: L('제압', 'CLEARED'), sub: '', t: 1.1 };
    grantReward();
    if (room.boss) makeDoors(['next']);
    else rollDoorRewards();
    FX.sfx('door');
  }

  function death() {
    state = 'dead';
    S.run = null;
    FX.sfx('death');
    FX.musicStop();
    endRun(false);
  }

  function victory() {
    state = 'victory';
    S.run = null;
    S.clears += 1;
    FX.musicStop();
    FX.sfx('boon');
    endRun(true);
  }

  function endRun(win) {
    var score = R.roomsCleared * 120 + R.kills * 15 + Object.keys(R.bossDown).length * 800 + (win ? 6000 : 0);
    var earned = Math.round(R.gold * (1 + st.goldGain));
    S.medals += earned;
    if (score > S.best) S.best = score;
    if (R.boons.length >= 8) S.proph.flags.boons8 = 1;
    if (Object.keys(R.godsSeen).length >= 4) S.proph.flags.allGods = 1;
    if (run$) api('/runs/' + run$.runKey + '/consume', { method: 'POST', body: JSON.stringify({ outcome: win ? 'CLEAR' : 'DEATH' }) }).catch(function () {});
    persist();

    var mins = (R.time / 60) | 0, secs = (R.time % 60) | 0;
    var where = win ? L('완주', 'CLEAR')
      : (R.tier + 1) + L('계 ', 'F ') + Math.min(Math.max(1, R.roomN), tierDef().rooms) + L('방', 'R');
    var detail = where + L(' · 처치 ', ' · kills ') + R.kills;
    $('endTitle').textContent = win ? L('🌅 이승의 빛', '🌅 Light of the Living') : L('💀 그대는 스러졌다', '💀 You Have Fallen');
    $('endDesc').innerHTML =
      L('도달 ', 'Reached ') + '<b>' + where + '</b>' +
      ' · ' + L('처치 ', 'kills ') + R.kills + ' · ' + mins + ':' + (secs < 10 ? '0' : '') + secs +
      '<br>' + L('문장 ', 'boons ') + R.boons.length + L('개 · 점수 ', ' · score ') + score.toLocaleString() +
      '<br>🪙 <b>+' + earned + '</b> ' + L('명전 — 강화에 쓸 수 있다', 'coins for upgrades');
    GameRank.submit('nether-return', score, detail).then(function (r) {
      if (r && r.applied) $('endDesc').innerHTML += '<br>🏆 ' + L('랭킹 ', 'Rank #') + r.rank + L('위!', '!');
    });
    $('endPanel').hidden = false;
    if (window.GameMeta) GameMeta.render();
    refreshMenu();
  }

  /* ═══════════ 문장 선택 (카드 UI) ═══════════ */
  var pickState = null;

  function openBoonPick(god) {
    var owned = {};
    R.boons.forEach(function (b) { owned[b.key] = 1; });
    var pool = DATA.BOONS.filter(function (b) { return b.god === god && !owned[b.key] && !b.legend; });
    var legend = DATA.BOONS.filter(function (b) { return b.god === god && b.legend && !owned[b.key]; })[0];
    var godCount = R.boons.filter(function (b) { return BOON_BY_KEY[b.key].god === god; }).length;
    var cards = [];
    while (cards.length < 3 && pool.length) {
      var i = (rnd() * pool.length) | 0;
      var b = pool.splice(i, 1)[0];
      var roll = rnd();
      var rar = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2;
      cards.push({ boon: b, rar: rar });
    }
    if (legend && godCount >= 2 && rnd() < 0.22 && cards.length) {
      cards[0] = { boon: legend, rar: 3 };
    }
    if (!cards.length) { R.gold += 40; FX.num(p.x, p.y - 24, '+40 🪙', '#ffd54a'); return; }
    pickState = { kind: 'boon', god: god, cards: cards };
    state = 'pick';
    FX.sfx('boon');
  }

  function openForgePick() {
    var owned = {};
    R.forge.forEach(function (k) { owned[k] = 1; });
    var pool = DATA.FORGE.filter(function (f) { return !owned[f.key]; });
    var cards = [];
    while (cards.length < 3 && pool.length) {
      cards.push({ forge: pool.splice((rnd() * pool.length) | 0, 1)[0] });
    }
    if (!cards.length) { R.gold += 40; return; }
    pickState = { kind: 'forge', cards: cards };
    state = 'pick';
    FX.sfx('boon');
  }

  function applyPick(i) {
    var c = pickState.cards[i];
    if (!c) return;
    if (pickState.kind === 'boon') {
      R.boons.push({ key: c.boon.key, rar: c.rar });
      R.godsSeen[c.boon.god] = 1;
      if (c.rar === 3) S.proph.flags.legend = 1;
    } else {
      R.forge.push(c.forge.key);
      R.forgeCount += 1;
    }
    buildStats();
    pickState = null;
    state = 'play';
    FX.sfx('boon');
    FX.flash('#8a6aff', 0.2);
  }

  function cardRects() {
    var n = pickState.cards.length;
    var cw2 = 280, ch2 = 380, gap = 36;
    var total = n * cw2 + (n - 1) * gap;
    var x0 = (CW - total) / 2;
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: x0 + i * (cw2 + gap), y: 140, w: cw2, h: ch2 });
    return out;
  }
  function pickClick(e) {
    var r = cv.getBoundingClientRect();
    var mx = (e.clientX - r.left) * (CW / r.width), my = (e.clientY - r.top) * (CH / r.height);
    cardRects().forEach(function (rc, i) {
      if (mx > rc.x && mx < rc.x + rc.w && my > rc.y && my < rc.y + rc.h) applyPick(i);
    });
  }
  function pickKey(code) {
    if (code === 'Digit1') applyPick(0);
    if (code === 'Digit2') applyPick(1);
    if (code === 'Digit3') applyPick(2);
  }

  /* ═══════════ 일시정지 ═══════════ */
  function onEsc() {
    if (state === 'play') openPause();
    else if (paused) closePause();
  }
  function openPause() {
    if (state !== 'play') return;
    paused = true; pauseSel = 0;
  }
  function closePause() { paused = false; }
  cv.addEventListener('click', function (e) {
    if (!paused) return;
    var r = cv.getBoundingClientRect();
    var my = (e.clientY - r.top) * (CH / r.height);
    var i = Math.floor((my - (CH / 2 - 40)) / 58);
    if (i >= 0 && i < 3) pauseAction(i);
  });
  function pauseAction(i) {
    if (i === 0) closePause();
    if (i === 1) {
      suspendToSave();
      paused = false;
      toMenu();
    }
    if (i === 2) {
      paused = false;
      death();
    }
  }
  addEventListener('keydown', function (e) {
    if (!paused) return;
    if (e.code === 'ArrowUp') pauseSel = (pauseSel + 2) % 3;
    if (e.code === 'ArrowDown') pauseSel = (pauseSel + 1) % 3;
    if (e.code === 'Enter' || e.code === 'KeyZ') pauseAction(pauseSel);
  });

  function toMenu() {
    state = 'menu';
    FX.musicStop();
    syncPanels(true);
    refreshMenu();
  }

  /* ═══════════ 업데이트 ═══════════ */
  function update(dt) {
    R.time += dt;
    atkBuf -= dt; castBuf -= dt; dashBuf -= dt;

    p.iframe -= dt; p.hurtT -= dt; p.guardT -= dt; p.tempoT = (p.tempoT || 0) - dt;
    p.castCd = (p.castCd || 0) - dt;
    if (p.cast < p.castMax && p.castCd <= 0) { p.cast += 1; p.castCd = 3.2; }
    if (p.dash < p.dashMax) {
      p.dashRe = (p.dashRe || 0) - dt;
      if (p.dashRe <= 0) { p.dash += 1; p.dashRe = 0.9 * st.dashCd; }
    } else p.dashRe = 0.9 * st.dashCd;
    p.comboReset = (p.comboReset || 0) - dt;
    if (p.comboReset <= 0) p.combo = 0;

    if (p.dashT > 0) {
      p.dashT -= dt;
      var step = 130 / 0.16 * dt;
      p.x += p.dashDX * step; p.y += p.dashDY * step;
      if (!p.trail) p.trail = [];
      p.trail.push({ x: p.x, y: p.y, t: 0.25 });
      if (st.dashDmg > 0) {
        foes.forEach(function (e) {
          if (e.dead || e.dashHit) return;
          if (dist2(e.x, e.y, p.x, p.y) < (e.r + 8) * (e.r + 8)) {
            e.dashHit = true;
            hurtFoe(e, st.dashDmg * st.dmgMul, p.dashDX * 100, p.dashDY * 100, { soft: true });
          }
        });
      }
      if (p.dashT <= 0) FX.burst(p.x, p.y, '#8a92b0', 6, 50, 0.3);   // 착지 먼지
    } else if (p.atkT > 0) {
      p.atkT -= dt;
      var lz = Math.max(0, p.atkT / p.atkMax);
      p.x += (p.lungeX || 0) * dt * lz; p.y += (p.lungeY || 0) * dt * lz;
      if (!p.swung && p.atkT < p.atkMax * 0.7) { p.swung = true; doSwing(); }
    } else {
      var mv = moveAxis();
      var spd = 105 * st.moveSpd;
      p.x += mv.x * spd * dt; p.y += mv.y * spd * dt;
      if (mv.x || mv.y) {
        var mm = Math.hypot(mv.x, mv.y) || 1;
        p.faceDir = { x: mv.x / mm, y: mv.y / mm };
        if (mv.x) p.face = mv.x < 0 ? -1 : 1;
      }
      p.moving = !!(mv.x || mv.y);
    }
    if (p.trail) {
      p.trail.forEach(function (t) { t.t -= dt; });
      p.trail = p.trail.filter(function (t) { return t.t > 0; });
    }
    resolveCircle(p);
    foes.forEach(function (e) { if (!e.dead) e.dashHit = false; });

    if (atkBuf > 0 && state === 'play') { atkBuf = 0; tryAttack(); }
    if (dashBuf > 0) { dashBuf = 0; tryDash(); }
    if (castBuf > 0) { castBuf = 0; tryCast(); }
    // Z 홀드 연타 — undefined 안전하게 부정형으로 (`<= 0` 는 undefined 에서 false)
    if ((keys.KeyZ || keys.KeyJ) && !(p.atkT > 0) && !(p.dashT > 0)) tryAttack();

    foes.forEach(function (e) {
      if (e.dead) return;
      e.flash -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnAcc = (e.burnAcc || 0) + e.burnD * dt;
        if (e.burnAcc >= 1) {
          var bn = e.burnAcc | 0; e.burnAcc -= bn;
          e.hp -= bn;
          if (Math.random() < 0.3) FX.burst(e.x, e.y - 8, '#ff8a4a', 2, 40, 0.3, -60);
          if (e.hp <= 0 && !e.dead) killFoe(e);
        }
      }
      if (e.dead) return;
      foeAI(e, dt);
      e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
      e.kx *= Math.pow(0.0001, dt); e.ky *= Math.pow(0.0001, dt);
      if (st.wallSlam > 0 && (Math.abs(e.kx) > 90 || Math.abs(e.ky) > 90)) {
        var sw = solidAt(e.x, e.y, e.r + 1);
        if (sw && !e.slammed) {
          e.slammed = true;
          hurtFoe(e, st.wallSlam, 0, 0, { soft: true });
          FX.shake(2);
        }
      } else e.slammed = false;
      resolveCircle(e);
    });
    foes = foes.filter(function (e) { return !e.dead; });

    if (!room.cleared) {
      if (!foes.length) {
        if (room.wave < room.waves.length) {
          spawnWavePoints(room.waves[room.wave]);
          room.wave += 1;
        } else roomCleared();
      }
    }

    shots.forEach(function (s) {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      var hit = solidAt(s.x, s.y, 2);
      if (s.life <= 0 || (hit && !hit.pit)) { s.dead = true; FX.burst(s.x, s.y, s.fire ? '#ff8a4a' : '#c8d4ff', 4, 60, 0.25); return; }
      if (s.own === 'p') {
        foes.forEach(function (e) {
          if (e.dead || s.dead) return;
          if (dist2(e.x, e.y - 4, s.x, s.y) < (e.r + s.r) * (e.r + s.r)) {
            s.dead = true;
            hurtFoe(e, s.dmg, s.vx * 0.3, s.vy * 0.3, {});
            if (s.fire) { e.burnT = 3; e.burnD = s.dmg * 0.25 / 3; }
          }
        });
      } else if (dist2(p.x, p.y - 4, s.x, s.y) < (p.r + s.r + 1) * (p.r + s.r + 1)) {
        s.dead = true;
        hurtPlayer(s.dmg, s.x, s.y);
      }
    });
    shots = shots.filter(function (s) { return !s.dead; });

    zones.forEach(function (z) {
      z.life -= dt;
      if (z.warm > 0) { z.warm -= dt; return; }
      if (dist2(p.x, p.y, z.x, z.y) < z.r * z.r && p.iframe <= 0) hurtPlayer(z.dps * 0.4, z.x, z.y);
    });
    zones = zones.filter(function (z) { return z.life > 0; });

    room.spikes.forEach(function (sp) {
      sp.ph = (sp.ph + dt) % 2.2;
      var out = sp.ph > 1.5;
      if (out) {
        if (dist2(p.x, p.y, sp.x, sp.y) < 100 && p.iframe <= 0) hurtPlayer(12, sp.x, sp.y);
        foes.forEach(function (e) {
          if (!e.dead && !e.boss && dist2(e.x, e.y, sp.x, sp.y) < 100 && !e.spiked) { e.spiked = true; hurtFoe(e, 12, 0, 0, { soft: true, noCrit: true }); }
        });
      } else foes.forEach(function (e) { e.spiked = false; });
    });

    coins.forEach(function (c) {
      c.t += dt;
      c.vy += 300 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > ARENA.y1) { c.y = ARENA.y1; c.vy *= -0.4; c.vx *= 0.7; }
      var d2p = dist2(c.x, c.y, p.x, p.y);
      if (c.t > 0.4 && d2p < 46 * 46) {
        var m = Math.sqrt(d2p) || 1;
        c.vx += (p.x - c.x) / m * 900 * dt; c.vy += (p.y - c.y) / m * 900 * dt;
      }
      if (c.t > 0.3 && d2p < 12 * 12) {
        c.dead = true;
        if (c.flask) { heal(12); FX.sfx('heal'); }
        else {
          R.gold += Math.round(c.val * (1 + st.goldGain));
          FX.sfx('coin');
        }
      }
    });
    coins = coins.filter(function (c) { return !c.dead; });

    if (room.fountain && !room.fountUsed && dist2(p.x, p.y, room.fount.x, room.fount.y) < 28 * 28) {
      room.fountUsed = true;
      heal(Math.round(st.maxHp * 0.3));
      FX.sfx('heal');
      FX.burst(room.fount.x, room.fount.y - 10, '#5cc8ff', 18, 80, 0.7, -60);
    }

    if (room.cleared && room.doors.length) {
      room.doors.forEach(function (d) {
        if (Math.abs(p.x - d.x) < 20 && p.y < ARENA.y0 + 18) enterDoor(d);
      });
    }

    if (Math.random() < dt * 6) FX.ember(cam.x + Math.random() * VW, cam.y + VH - Math.random() * 50, tierDef().light);

    // 카메라 — 플레이어를 부드럽게 따른다. 뷰보다 작은 방은 가운데에 못 박는다
    var tx2 = AW <= VW ? (AW - VW) / 2 : clamp(p.x - VW / 2, 0, AW - VW);
    var ty2 = AH <= VH ? (AH - VH) / 2 : clamp(p.y - VH / 2 - 8, 0, AH - VH);
    cam.x += (tx2 - cam.x) * Math.min(1, dt * 7);
    cam.y += (ty2 - cam.y) * Math.min(1, dt * 7);
  }

  function enterDoor(d) {
    FX.sfx('door');
    R.pending = (d.reward === 'boss' || d.reward === 'next') ? null : { reward: d.reward, god: d.god };
    nextRoom();
  }

  /* ═══════════ 렌더 ═══════════ */
  var animT = 0;

  function drawWorld() {
    wg.fillStyle = '#030208';
    wg.fillRect(0, 0, VW, VH);
    var t = tierDef();
    var camX = Math.round(cam.x), camY = Math.round(cam.y);
    wg.save();
    wg.translate(-camX, -camY);

    if (floorCv) wg.drawImage(floorCv, 0, 0);

    room.spikes.forEach(function (sp) {
      var f = sp.ph > 1.5 ? 2 + (((sp.ph - 1.5) * 8) | 0) % 2 : (sp.ph > 1.2 ? 1 : 0);
      Atlas.draw(wg, 'floor_spikes_anim', f, sp.x, sp.y + 8);
    });

    zones.forEach(function (z) {
      wg.globalAlpha = z.warm > 0 ? 0.25 : 0.4 + 0.1 * Math.sin(animT * 10);
      wg.fillStyle = z.warm > 0 ? '#ff8a4a' : '#ff5c2a';
      wg.beginPath(); wg.arc(z.x, z.y, z.r, 0, 7); wg.fill();
      wg.globalAlpha = 1;
    });

    var doorY = ARENA.y0 - 2;
    room.doors.forEach(function (d) {
      Atlas.draw(wg, room.cleared ? 'doors_leaf_open' : 'doors_leaf_closed', 0, d.x, doorY);
      if (room.cleared) {
        var icon = d.reward === 'boon' ? DATA.GODS[d.god] : null;
        wg.save();
        wg.translate(d.x, doorY - 40 + Math.sin(animT * 3) * 2);
        if (icon) {
          wg.fillStyle = icon.color;
          drawSigil(wg, icon.sigil, 0, 0, 7);
        } else if (d.reward === 'gold') Atlas.draw(wg, 'coin_anim', (animT * 6) | 0, 0, 5);
        else if (d.reward === 'heal') Atlas.draw(wg, 'flask_big_red', 0, 0, 8);
        else if (d.reward === 'forge') Atlas.draw(wg, 'weapon_big_hammer', 0, 0, 12);
        else if (d.reward === 'boss') Atlas.draw(wg, 'skull', 0, 0, 8);
        else if (d.reward === 'next') { wg.fillStyle = '#ffd54a'; drawSigil(wg, 'bolt', 0, 0, 7); }
        wg.restore();
      }
    });

    room.crates.forEach(function (c) {
      if (!c.dead) Atlas.draw(wg, 'crate', 0, c.x, c.y + 8);
    });

    coins.forEach(function (c) {
      if (c.flask) Atlas.draw(wg, 'flask_red', 0, c.x, c.y + 6);
      else Atlas.draw(wg, 'coin_anim', ((animT * 8 + c.x) | 0), c.x, c.y + 4);
    });

    if (room.fountain) {
      Atlas.draw(wg, 'wall_fountain_top', 0, room.fount.x, room.fount.y - 16);
      Atlas.draw(wg, 'wall_fountain_mid_blue_anim', (animT * 5) | 0, room.fount.x, room.fount.y);
      Atlas.draw(wg, 'wall_fountain_basin_blue_anim', (animT * 5) | 0, room.fount.x, room.fount.y + 16);
    }

    room.torches.forEach(function (tc, i) {
      Atlas.draw(wg, R.tier === 2 ? 'wall_fountain_mid_blue_anim' : 'wall_fountain_mid_red_anim', ((animT * 6 + i) | 0), tc.x, tc.y + 8);
    });

    var ents = [];
    foes.forEach(function (e) { ents.push(e); });
    ents.push(p);
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) {
      wg.fillStyle = 'rgba(0,0,0,.4)';
      wg.beginPath();
      wg.ellipse(e.x, e.y + 1, e === p ? 7 : e.r + 2, 3, 0, 0, 7);
      wg.fill();
    });

    if (p.trail) {
      p.trail.forEach(function (tr) {
        wg.globalAlpha = tr.t * 1.6;
        Atlas.draw(wg, 'knight_m_run_anim', 0, tr.x, tr.y, { flip: p.face < 0 });
      });
      wg.globalAlpha = 1;
    }

    ents.forEach(function (e) {
      if (e === p) { drawPlayer(); return; }
      drawFoe(e);
    });

    shots.forEach(function (s) {
      wg.fillStyle = s.fire ? '#ff8a4a' : (s.own === 'p' ? '#b4c8ff' : '#e8d4ff');
      wg.beginPath(); wg.arc(s.x, s.y, s.r, 0, 7); wg.fill();
      wg.fillStyle = '#fff';
      wg.fillRect(s.x - 1, s.y - 1, 2, 2);
    });

    slashes.forEach(function (sl) {
      sl.t -= 1 / 60;
      var a = Math.max(0, sl.t / sl.max);
      // 채운 부채꼴 + 밝은 테두리 — 선 하나였을 때보다 훨씬 "베었다"는 느낌이 난다
      wg.globalAlpha = a * 0.35;
      wg.fillStyle = sl.big ? '#ffd54a' : '#e8f0ff';
      wg.beginPath();
      wg.moveTo(sl.x, sl.y);
      wg.arc(sl.x, sl.y, sl.r * (1.1 - a * 0.2), sl.dir - sl.arc / 2, sl.dir + sl.arc / 2);
      wg.closePath();
      wg.fill();
      wg.globalAlpha = a * 0.9;
      wg.strokeStyle = sl.big ? '#ffd54a' : '#fff';
      wg.lineWidth = sl.big ? 3 : 2;
      wg.beginPath();
      wg.arc(sl.x, sl.y, sl.r * (1.1 - a * 0.2), sl.dir - sl.arc / 2, sl.dir + sl.arc / 2);
      wg.stroke();
      wg.globalAlpha = 1;
    });
    slashes = slashes.filter(function (s) { return s.t > 0; });

    FX.drawWorld(wg);
    wg.restore();

    /* 광원 + 어둠 — 뷰 좌표로 변환해 얹는다 */
    var lights = [{ x: p.x, y: p.y - 6, r: 96, a: 0.9, c: null }];
    foes.forEach(function (e) { lights.push({ x: e.x, y: e.y - 6, r: e.boss ? 64 : 38, a: 0.55, c: null }); });
    room.torches.forEach(function (tc) {
      lights.push({ x: tc.x, y: tc.y, r: 46 + Math.sin(animT * 9 + tc.x) * 5, a: 0.8, c: t.light });
    });
    zones.forEach(function (z) { lights.push({ x: z.x, y: z.y, r: z.r + 14, a: 0.6, c: '#ff6a3a' }); });
    shots.forEach(function (s) { if (s.fire) lights.push({ x: s.x, y: s.y, r: 18, a: 0.7, c: '#ff8a4a' }); });
    if (room.fountain) lights.push({ x: room.fount.x, y: room.fount.y, r: 60, a: 0.9, c: '#5cc8ff' });
    room.doors.forEach(function (d) { if (room.cleared) lights.push({ x: d.x, y: doorY - 16, r: 40, a: 0.8, c: '#ffd54a' }); });
    var viewLights = lights.map(function (l) {
      return { x: l.x - camX, y: l.y - camY, r: l.r, a: l.a, c: l.c };
    });
    FX.drawLights(wg, VW, VH, t.mood, viewLights);
  }

  function drawPlayer() {
    var spr = p.hurtT > 0 ? 'knight_m_hit_anim' : (p.moving || p.dashT > 0 ? 'knight_m_run_anim' : 'knight_m_idle_anim');
    var blink = p.iframe > 0 && ((animT * 14) | 0) % 2 === 0;
    if (blink) wg.globalAlpha = 0.45;
    Atlas.draw(wg, spr, (animT * 10) | 0, p.x, p.y, { flip: p.face < 0 });
    wg.globalAlpha = 1;
    /* 휘두르는 무기 */
    if (p.atkT > 0 && p.atkDir) {
      var prog = 1 - p.atkT / p.atkMax;
      var dir = Math.atan2(p.atkDir.y, p.atkDir.x);
      var wd = weaponDef();
      var sw = wd.key === 'spear'
        ? dir                                             // 창은 찌른다 — 호를 그리지 않는다
        : dir - 1.2 + prog * 2.4;
      var ext = wd.key === 'spear' ? 8 + prog * 14 : 13;
      wg.save();
      wg.translate(p.x + Math.cos(sw) * ext, p.y - 8 + Math.sin(sw) * ext);
      wg.rotate(sw + Math.PI / 2);
      var f = Atlas.frames[wd.spr];
      Atlas.draw(wg, wd.spr, 0, 0, f.h / 2);
      wg.restore();
    }
  }

  function drawFoe(e) {
    var spr = e.spr + (e.state === 'move' && (Math.abs(e.vx) > 4 || Math.abs(e.vy) > 4) ? '_run_anim' : '_idle_anim');
    var opt = { flip: e.face < 0, scale: e.scale || 1 };
    if (e.flash > 0) opt.tint = '#ffffff';
    else if (e.petrified) opt.tint = '#8a9ab0';
    if (e.state === 'tele') {
      var prog = 1 - e.t / (e.teleMax || e.tele);
      wg.globalAlpha = 0.3 + prog * 0.35;
      wg.strokeStyle = '#ff5c4a';
      wg.lineWidth = 1.5;
      if (e.def.charger || (e.boss && e.pat === 'charge')) {
        var a = Math.atan2(e.ty - e.y, e.tx - e.x);
        wg.beginPath();
        wg.moveTo(e.x, e.y);
        wg.lineTo(e.x + Math.cos(a) * 150, e.y + Math.sin(a) * 150);
        wg.stroke();
      } else if (e.boss && (e.pat === 'slam' || e.pat === 'cleave')) {
        wg.beginPath(); wg.arc(e.x, e.y, 74 * prog, 0, 7); wg.stroke();
        wg.beginPath(); wg.arc(e.x, e.y, 74, 0, 7); wg.globalAlpha = 0.18; wg.stroke();
      } else {
        wg.beginPath(); wg.arc(e.tx, e.ty, 9 + prog * 5, 0, 7); wg.stroke();
      }
      wg.globalAlpha = 1;
      if (((animT * 12) | 0) % 2 === 0) opt.tint = '#ff5c4a';
    }
    if (e.elite) {
      wg.strokeStyle = '#c05cff';
      wg.globalAlpha = 0.5 + Math.sin(animT * 6) * 0.2;
      wg.beginPath(); wg.arc(e.x, e.y - 4, e.r + 5, 0, 7); wg.stroke();
      wg.globalAlpha = 1;
    }
    Atlas.draw(wg, spr, (e.anim + animT * 8) | 0, e.x, e.y + 4, opt);
    wg.globalAlpha = 1;
    if (e.burnT > 0 && Math.random() < 0.2) FX.burst(e.x, e.y - 10, '#ff8a4a', 1, 30, 0.3, -50);
    if (!e.boss && e.hp < e.maxHp) {
      var w = 16;
      wg.fillStyle = 'rgba(0,0,0,.6)';
      wg.fillRect(e.x - w / 2, e.y - e.r * 2 - 10, w, 2);
      wg.fillStyle = e.elite ? '#c05cff' : '#5ce8a8';
      wg.fillRect(e.x - w / 2, e.y - e.r * 2 - 10, w * Math.max(0, e.hp / e.maxHp), 2);
    }
  }

  function drawSigil(g, kind, x, y, s) {
    g.beginPath();
    if (kind === 'flame') {
      g.moveTo(x, y - s); g.quadraticCurveTo(x + s, y - s * 0.2, x, y + s);
      g.quadraticCurveTo(x - s, y - s * 0.2, x, y - s);
    } else if (kind === 'flower') {
      for (var i = 0; i < 5; i++) {
        var a = i / 5 * 6.2832;
        g.arc(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.42, 0, 7);
      }
    } else if (kind === 'bolt') {
      g.moveTo(x + s * 0.4, y - s); g.lineTo(x - s * 0.3, y + s * 0.15);
      g.lineTo(x + s * 0.1, y + s * 0.15); g.lineTo(x - s * 0.4, y + s);
      g.lineTo(x + s * 0.3, y - 0.15 * s); g.lineTo(x - s * 0.1, y - 0.15 * s);
    } else {
      g.moveTo(x - s, y + s * 0.7); g.lineTo(x - s * 0.2, y - s * 0.7);
      g.lineTo(x + s * 0.25, y + s * 0.1); g.lineTo(x + s * 0.6, y - s * 0.3);
      g.lineTo(x + s, y + s * 0.7);
    }
    g.closePath();
    g.fill();
  }

  /* ═══════════ HUD (1152×648) ═══════════ */
  function drawHUD() {
    var g = mg;
    g.textAlign = 'left';

    var bx = 40, by = CH - 66, bw = 330, bh = 24;
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    g.fillStyle = '#3a0d12';
    g.fillRect(bx, by, bw, bh);
    var hpr = clamp(p.hp / st.maxHp, 0, 1);
    var grd = g.createLinearGradient(bx, by, bx, by + bh);
    grd.addColorStop(0, hpr > 0.35 ? '#ff6a5a' : '#ff4a3a');
    grd.addColorStop(1, hpr > 0.35 ? '#c02a30' : '#901a20');
    g.fillStyle = grd;
    g.fillRect(bx, by, bw * hpr, bh);
    g.strokeStyle = 'rgba(255,255,255,.25)';
    g.strokeRect(bx, by, bw, bh);
    g.font = 'bold 19px neodgm, monospace';
    g.fillStyle = '#fff';
    g.fillText(Math.max(0, Math.ceil(p.hp)) + ' / ' + st.maxHp, bx + 10, by + 19);
    for (var d = 0; d < R.defyLeft; d++) {
      g.fillStyle = '#ffd54a';
      g.save();
      g.translate(bx + bw + 22 + d * 22, by + bh / 2);
      g.rotate(Math.PI / 4);
      g.fillRect(-6, -6, 12, 12);
      g.restore();
    }
    for (var i = 0; i < p.dashMax; i++) {
      g.fillStyle = i < p.dash ? '#5cb8ff' : 'rgba(92,184,255,.2)';
      g.beginPath();
      g.moveTo(bx + i * 24, by - 16); g.lineTo(bx + 13 + i * 24, by - 16);
      g.lineTo(bx + 18 + i * 24, by - 9); g.lineTo(bx + 5 + i * 24, by - 9);
      g.closePath(); g.fill();
    }
    for (var c = 0; c < p.castMax; c++) {
      g.fillStyle = c < p.cast ? '#c07cff' : 'rgba(192,124,255,.2)';
      g.save();
      g.translate(bx + 200 + c * 22, by - 13);
      g.rotate(Math.PI / 4);
      g.fillRect(-5, -5, 10, 10);
      g.restore();
    }

    g.font = 'bold 22px neodgm, monospace';
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillText(TX(tierDef().name) + (room.boss ? '' : ' · ' + Math.max(1, R.roomN) + ' / ' + tierDef().rooms), 38, 46);
    g.fillStyle = '#e8ddc8';
    g.fillText(TX(tierDef().name) + (room.boss ? '' : ' · ' + Math.max(1, R.roomN) + ' / ' + tierDef().rooms), 36, 44);

    g.textAlign = 'right';
    g.font = 'bold 22px neodgm, monospace';
    g.fillStyle = '#ffd54a';
    g.fillText('🪙 ' + R.gold, CW - 32, 46);
    g.textAlign = 'left';
    R.boons.forEach(function (b, i) {
      var bd = BOON_BY_KEY[b.key], gd = DATA.GODS[bd.god];
      var x = CW - 32 - 26 - i * 28, y = 66;
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(x - 12, y - 2, 24, 24);
      g.strokeStyle = DATA.RARITY[b.rar].color;
      g.strokeRect(x - 12, y - 2, 24, 24);
      g.fillStyle = gd.color;
      drawSigil(g, gd.sigil, x, y + 10, 7);
    });

    var bosses = foes.filter(function (e) { return e.boss; });
    if (bosses.length) {
      var e = bosses[0];
      var w2 = 520, x2 = (CW - w2) / 2, y2 = 38;
      g.font = 'bold 21px neodgm, monospace';
      g.textAlign = 'center';
      g.fillStyle = '#ffb4a0';
      g.fillText(e.name, CW / 2, y2 - 8);
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(x2 - 3, y2 - 3, w2 + 6, 19);
      g.fillStyle = '#4a1016';
      g.fillRect(x2, y2, w2, 13);
      g.fillStyle = e.phase === 2 ? '#ff3a2a' : '#c03050';
      g.fillRect(x2, y2, w2 * Math.max(0, e.hp / e.maxHp), 13);
      g.textAlign = 'left';
    }

    if (banner) {
      banner.t -= 1 / 60;
      if (banner.t <= 0) banner = null;
      else {
        var a = Math.min(1, banner.t * 2);
        g.globalAlpha = a;
        g.textAlign = 'center';
        g.font = 'bold 42px neodgm, monospace';
        g.fillStyle = 'rgba(0,0,0,.6)';
        g.fillText(banner.title, CW / 2 + 3, 213);
        g.fillStyle = '#ffd54a';
        g.fillText(banner.title, CW / 2, 210);
        if (banner.sub) {
          g.font = 'bold 25px neodgm, monospace';
          g.fillStyle = '#e8ddc8';
          g.fillText(banner.sub, CW / 2, 248);
        }
        g.globalAlpha = 1;
        g.textAlign = 'left';
      }
    }

    if (room.cleared && room.doors.length && state === 'play') {
      g.textAlign = 'center';
      g.font = '17px neodgm, monospace';
      g.fillStyle = 'rgba(232,221,200,.8)';
      var names = { boon: L('신격의 문장', 'Boon'), gold: L('명전', 'Coins'), heal: L('회복', 'Heal'),
        forge: L('단조', 'Forge'), boss: L('관문 — 보스', 'Gate — BOSS'), next: L('다음 계층', 'Next tier') };
      room.doors.forEach(function (d) {
        var sx = (d.x - cam.x) * SCALE, sy = (ARENA.y0 + 11 - cam.y) * SCALE;
        if (sx > 40 && sx < CW - 40) {
          g.fillText(d.reward === 'boon' ? TX(DATA.GODS[d.god].name) : names[d.reward] || '', sx, sy);
        }
      });
      g.textAlign = 'left';
    }

    if (p.hp < st.maxHp * 0.25) {
      var pulse = 0.2 + Math.sin(animT * 6) * 0.08;
      var vg = g.createRadialGradient(CW / 2, CH / 2, CH * 0.44, CW / 2, CH / 2, CH * 0.92);
      vg.addColorStop(0, 'rgba(120,0,0,0)');
      vg.addColorStop(1, 'rgba(160,10,10,' + pulse + ')');
      g.fillStyle = vg;
      g.fillRect(0, 0, CW, CH);
    }

    FX.drawUI(g);
  }

  function drawPick() {
    var g = mg;
    g.fillStyle = 'rgba(6,4,14,.78)';
    g.fillRect(0, 0, CW, CH);
    var god = pickState.kind === 'boon' ? DATA.GODS[pickState.god] : null;
    g.textAlign = 'center';
    g.font = 'bold 29px neodgm, monospace';
    g.fillStyle = god ? god.color : '#e8b45c';
    g.fillText(god ? TX(god.name) : L('단조 — 무기를 벼린다', 'Forge — hone your blade'), CW / 2, 88);
    g.font = '19px neodgm, monospace';
    g.fillStyle = '#c8bfa8';
    g.fillText(god ? TX(god.line) : L('하나를 고르면 이 탈주 동안 유지된다', 'Choose one for this escape'), CW / 2, 120);

    cardRects().forEach(function (rc, i) {
      var c = pickState.cards[i];
      if (!c) return;
      var rar = c.rar != null ? DATA.RARITY[c.rar] : null;
      var color = c.boon ? DATA.GODS[c.boon.god].color : '#e8b45c';
      g.fillStyle = '#14101f';
      g.fillRect(rc.x, rc.y, rc.w, rc.h);
      g.strokeStyle = rar ? rar.color : '#e8b45c';
      g.lineWidth = 3;
      g.strokeRect(rc.x, rc.y, rc.w, rc.h);
      g.lineWidth = 1;
      g.fillStyle = color;
      g.save();
      g.translate(rc.x + rc.w / 2, rc.y + 84);
      g.scale(3.6, 3.6);
      drawSigil(g, c.boon ? DATA.GODS[c.boon.god].sigil : 'mountain', 0, 0, 8);
      g.restore();
      g.font = 'bold 25px neodgm, monospace';
      g.fillStyle = '#f0e8d8';
      g.fillText(TX(c.boon ? c.boon.name : c.forge.name), rc.x + rc.w / 2, rc.y + 180);
      if (rar) {
        g.font = 'bold 17px neodgm, monospace';
        g.fillStyle = rar.color;
        g.fillText(TX(rar.name), rc.x + rc.w / 2, rc.y + 208);
      }
      g.font = '17px neodgm, monospace';
      g.fillStyle = '#b8b0a0';
      var desc = TX(c.boon ? c.boon.desc : c.forge.desc);
      if (c.boon && !c.boon.legend) desc = desc.replace('{v}', boonValue(c.boon, c.rar));
      desc = desc.replace('{d}', 14);
      wrapText(g, desc, rc.x + rc.w / 2, rc.y + 250, rc.w - 36, 25);
      g.font = '15px neodgm, monospace';
      g.fillStyle = '#6a6458';
      g.fillText('[' + (i + 1) + ']', rc.x + rc.w / 2, rc.y + rc.h - 18);
    });
    g.textAlign = 'left';
  }

  function wrapText(g, text, x, y, maxW, lh) {
    var words = text.split(' '), line = '', yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line + (line ? ' ' : '') + words[i];
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, yy);
        line = words[i];
        yy += lh;
      } else line = test;
    }
    g.fillText(line, x, yy);
  }

  function drawPause() {
    var g = mg;
    g.fillStyle = 'rgba(6,4,14,.7)';
    g.fillRect(0, 0, CW, CH);
    g.textAlign = 'center';
    g.font = 'bold 38px neodgm, monospace';
    g.fillStyle = '#e8ddc8';
    g.fillText(L('멈춤', 'PAUSED'), CW / 2, CH / 2 - 90);
    var items = [L('계속', 'Resume'), L('저장 후 나가기', 'Save & Exit'), L('탈주 포기', 'Abandon Run')];
    g.font = 'bold 25px neodgm, monospace';
    items.forEach(function (it, i) {
      g.fillStyle = i === pauseSel ? '#ffd54a' : '#9a9284';
      g.fillText((i === pauseSel ? '▶ ' : '') + it, CW / 2, CH / 2 - 20 + i * 58);
    });
    g.textAlign = 'left';
  }

  /* ═══════════ 메뉴/예언/스토리/무기고 (DOM) ═══════════ */
  function refreshMenu() {
    var line = null;
    DATA.STORY.forEach(function (s) { if (s.at(S)) line = s.t; });
    $('story').textContent = line ? TX(line) : '';
    var claims = [];
    DATA.PROPH.forEach(function (pr) {
      if (!S.proph.claimed[pr.id] && pr.check(S)) {
        S.proph.claimed[pr.id] = 1;
        S.medals += pr.reward;
        claims.push(pr);
      }
    });
    if (claims.length) {
      persist();
      if (window.GameMeta) GameMeta.render();
    }
    var wrap = $('prophList');
    wrap.innerHTML = '';
    DATA.PROPH.forEach(function (pr) {
      var done = !!S.proph.claimed[pr.id];
      var row = document.createElement('div');
      row.className = 'proph-row' + (done ? ' done' : '');
      row.innerHTML = '<span class="pr-check">' + (done ? '✅' : '◻') + '</span>' +
        '<span class="pr-name">' + TX(pr.name) + '</span>' +
        '<span class="pr-desc">' + TX(pr.desc) + '</span>' +
        '<span class="pr-reward">🪙' + pr.reward + '</span>';
      wrap.appendChild(row);
    });
    var doneN = DATA.PROPH.filter(function (pr) { return S.proph.claimed[pr.id]; }).length;
    $('prophSummary').textContent = L('📜 뱃사공의 예언 ', '📜 Prophecies ') + doneN + ' / ' + DATA.PROPH.length;

    /* 무기고 — 하데스식 무기 선택 + 명전 해금 */
    var wr = $('weaponRow');
    wr.innerHTML = '';
    DATA.WEAPONS.forEach(function (w) {
      var owned = !!S.weapons[w.key];
      var sel = (S.weapon || 'sword') === w.key;
      var b = document.createElement('button');
      b.className = 'wpn-btn' + (sel ? ' sel' : '') + (owned ? '' : ' locked');
      b.innerHTML = '<b>' + TX(w.name) + '</b><span>' +
        (owned ? TX(w.desc) : '🔒 ' + w.unlock + L(' 명전으로 해금', ' coins to unlock')) + '</span>';
      b.onclick = function () {
        FX.audio();
        if (owned) {
          S.weapon = w.key;
          persist();
          refreshMenu();
        } else if (S.medals >= w.unlock) {
          S.medals -= w.unlock;
          S.weapons[w.key] = 1;
          S.weapon = w.key;
          persist();
          if (window.GameMeta) GameMeta.render();
          refreshMenu();
          FX.sfx('boon');
        } else {
          b.classList.add('deny');
          setTimeout(function () { b.classList.remove('deny'); }, 400);
        }
      };
      wr.appendChild(b);
    });

    var hasRun = !!S.run;
    $('resumeBtn').hidden = !hasRun;
    if (hasRun) {
      $('resumeBtn').textContent = L('▶ 이어서 탈주 — ', '▶ Resume — ') + (S.run.tier + 1) + L('계 ', 'F ') + Math.max(1, S.run.roomN) + L('방', 'R');
    }
    $('startBtn').textContent = hasRun ? L('처음부터 다시 탈주', 'New escape (discard run)') : L('▶ 탈주 시작', '▶ Begin Escape');
  }

  function syncPanels(menuVisible) {
    $('menu').hidden = !menuVisible;
    $('endPanel').hidden = true;
  }

  /* ═══════════ 메인 루프 ═══════════ */
  var last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = Math.min(1 / 30, (ts - last) / 1000 || 0);
    last = ts;
    animT += dt;

    if (slowT > 0) { slowT -= dt; timescale = 0.3; } else timescale = 1;

    if (state === 'play' && !paused) {
      if (!FX.consumeStop(dt)) update(dt * timescale);
      FX.update(dt);
    } else if (state === 'pick' || paused) {
      FX.update(dt * 0.3);
    } else {
      FX.update(dt);
    }

    FX.setView(cam.x, cam.y, SCALE);

    mg.fillStyle = '#050409';
    mg.fillRect(0, 0, CW, CH);
    if (state === 'play' || state === 'pick' || paused || state === 'dead' || state === 'victory') {
      if (room) {
        drawWorld();
        var sh = FX.shakeAmt();
        var ox = sh ? (Math.random() - 0.5) * sh * 2 : 0;
        var oy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
        mg.drawImage(wc, 0, 0, VW, VH, ox, oy, CW, CH);
        if (state !== 'dead' && state !== 'victory') drawHUD();
      }
      if (state === 'pick' && pickState) drawPick();
      if (paused) drawPause();
    } else {
      FX.setView(0, 0, SCALE);
      if (Math.random() < dt * 8) FX.ember(Math.random() * VW, VH - 20 - Math.random() * 40, '#ff9a5c');
      wg.fillStyle = '#08060f';
      wg.fillRect(0, 0, VW, VH);
      wg.fillStyle = '#0d0a18';
      wg.fillRect(0, VH - 60, VW, 60);
      FX.drawWorld(wg);
      mg.drawImage(wc, 0, 0, VW, VH, 0, 0, CW, CH);
    }
    var fl = FX.flashState();
    if (fl.a > 0) {
      mg.globalAlpha = fl.a;
      mg.fillStyle = fl.c;
      mg.fillRect(0, 0, CW, CH);
      mg.globalAlpha = 1;
    }
  }

  /* ═══════════ 부트스트랩 ═══════════ */
  function boot() {
    Atlas.load(function () {
      try { document.fonts && document.fonts.load('20px neodgm'); } catch (_) {}
      loadSave().then(function () {
        GameMeta.init({
          slug: 'nether-return',
          title: { ko: '⚰ 망자의 안식처 — 영구 강화', en: '⚰ Sanctum — permanent upgrades' },
          currency: { ko: '명전', en: 'coins', icon: '🪙' },
          upgrades: DATA.META_UP,
          load: function () { return S; },
          save: function () { persist(); },
        });
        refreshMenu();
        requestAnimationFrame(frame);
      });
    });

    $('startBtn').onclick = function () {
      FX.audio();
      S.run = null;
      newRun();
    };
    $('resumeBtn').onclick = function () {
      FX.audio();
      resumeRun();
    };
    $('againBtn').onclick = function () {
      FX.audio();
      $('endPanel').hidden = true;
      newRun();
    };
    $('backBtn').onclick = function () {
      $('endPanel').hidden = true;
      toMenu();
    };
    $('codeLoadBtn').onclick = function () {
      var code = String($('codeInput').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 8) return;
      loadSave(code).then(function (ok) {
        $('codeLoadBtn').textContent = ok ? '✅' : L('실패', 'Failed');
        if (window.GameMeta) GameMeta.render();
        refreshMenu();
        setTimeout(function () { $('codeLoadBtn').textContent = L('🔑 코드로 불러오기', '🔑 Load by code'); }, 1400);
      });
    };
  }

  boot();

  /* 자동화 검증용 훅 — ?nrdebug 로 열었을 때만. 게임 로직에는 관여하지 않는다. */
  if (location.search.indexOf('nrdebug') >= 0) {
    window.__NR = {
      get R() { return R; }, get p() { return p; }, get st() { return st; },
      get foes() { return foes; }, get state() { return state; }, get room() { return room; },
      get cam() { return cam; }, get arena() { return { aw: AW, ah: AH }; },
      kill: function () { foes.slice().forEach(function (e) { e.hp = 0; killFoe(e); }); },
      goto: function (tier, roomN) { R.tier = tier; R.roomN = roomN; enterRoom(); },
      pick: function (i) { applyPick(i); },
      give: function (k, r) { R.boons.push({ key: k, rar: r || 0 }); buildStats(); },
      hurt: function (n) { p.iframe = 0; hurtPlayer(n, p.x, p.y - 30); },
    };
  }
})();
