/**
 * 다회차 강화(로그라이트 메타 진행) 공용 엔진.
 *
 * 런 기반 게임은 지면 아무것도 남지 않아 재도전 동기가 약하다. 출정마다 화폐를 주고
 * 그걸로 **출정 사이에만 남는** 강화를 사게 해 "죽어도 전진"을 만든다.
 * iron-vanguard 에서 먼저 만든 뒤 같은 필요가 여럿이 되어 여기로 뽑았다.
 *
 * 게임은 **업그레이드 표만 선언**한다:
 *
 *   GameMeta.init({
 *     slug: 'dawn-ward',
 *     currency: { ko: '유물', en: 'relics', icon: '🔮' },
 *     upgrades: [
 *       { key:'hp',  max:5, cost:function(l){return 3+l*2}, label:{ko:'체력 단련',en:'Vitality'} },
 *       { key:'dmg', max:5, cost:function(l){return 4+l*2}, label:{ko:'무기고',  en:'Armory'} },
 *     ],
 *     // 세이브는 게임이 이미 쓰던 그릇에 얹는다 — 그릇을 새로 만들지 않는다.
 *     load: function () { return meta; },     // { medals, up } 을 품은 객체
 *     save: function () { persistMeta(); },
 *   });
 *
 *   GameMeta.level('hp')        // 현재 단계
 *   GameMeta.award(점수)         // 런 종료 시 화폐 적립 (적립량을 돌려준다)
 *   GameMeta.isUpgraded()       // 하나라도 샀는가 — 랭킹 트랙 판정에 쓰인다(lib/rank.js)
 *   GameMeta.mount(부모)         // 강화 상점 UI 부착 (생략 시 #menu 하단)
 *
 * 랭킹: 강화를 산 순간부터 제출 트랙이 MODDED 로 바뀐다. 무강화 기록과 섞이지 않는다.
 */
(function () {
  'use strict';

  var cfg = null;
  var listEl = null;
  var curEl = null;
  var codeEl = null;

  /* ── 내장 저장소 ──────────────────────────────────────────────────────────
   * 게임이 이미 세이브를 갖고 있으면(load/save 콜백) 그 그릇에 얹는다.
   * 없으면 엔진이 직접 맡는다 — 서버 세이브 + 이어하기 코드 + localStorage 폴백.
   * 게임마다 같은 40줄을 심지 않기 위해서고, 덤으로 세이브가 없던 게임에도
   * 이어하기 코드가 생긴다. 본문은 서버에서 암호화돼 적재된다(SaveCipher).
   */
  var own = { data: null, version: 0, code: null, keyLocal: '', keyCode: '' };

  function token() { return localStorage.getItem('portal_access_token'); }

  function deviceId() {
    var id = localStorage.getItem('kgd_device_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('kgd_device_id', id); }
    return id;
  }

  function api(path, opts) {
    var o = opts || {};
    var h = { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() };
    if (token()) h.Authorization = 'Bearer ' + token();
    return fetch('/api/v1/games/' + cfg.slug + path, {
      method: o.method || 'GET', headers: h, body: o.body,
    }).then(function (r) {
      return r.json().then(function (b) {
        if (!r.ok || !b || !b.success) throw new Error((b && b.error && b.error.code) || 'FAIL');
        return b.data;
      });
    });
  }

  function fmtCode(c) { return c ? c.replace(/(.{4})(?=.)/g, '$1-') : ''; }

  function showCode() {
    if (codeEl) codeEl.textContent = own.code ? '🔑 ' + fmtCode(own.code) : '';
  }

  function ownLoad(codeOverride) {
    var code = codeOverride || own.code;
    var q = (!token() && code) ? '?code=' + encodeURIComponent(code) : '';
    var p = (token() || code) ? api('/save' + q) : Promise.reject(new Error('NO_ID'));
    return p.then(function (s) {
      own.version = s.version;
      if (s.code) { own.code = s.code; localStorage.setItem(own.keyCode, s.code); }
      if (s.data) own.data = s.data;
      showCode();
      return true;
    }).catch(function () {
      try { own.data = JSON.parse(localStorage.getItem(own.keyLocal)) || own.data; } catch (_) {}
      showCode();
      return false;
    });
  }

  function ownSave() {
    localStorage.setItem(own.keyLocal, JSON.stringify(own.data));
    return api('/save', {
      method: 'PUT',
      body: JSON.stringify({ data: own.data, version: own.version, code: own.code }),
    }).then(function (s) {
      own.version = s.version;
      if (s.code && s.code !== own.code) { own.code = s.code; localStorage.setItem(own.keyCode, s.code); }
      showCode();
    }).catch(function () { /* 로컬에는 남았다 — 다음 저장에서 다시 맞춘다 */ });
  }

  function lang() {
    return (window.GameI18n && GameI18n.lang) || 'ko';
  }

  function tx(v) {
    if (v == null) return '';
    return typeof v === 'string' ? v : (v[lang()] || v.ko || v.en || '');
  }

  function state() {
    var m = cfg ? (cfg.load ? cfg.load() : own.data) : null;
    if (!m) return null;
    if (typeof m.medals !== 'number') m.medals = 0;
    if (!m.up || typeof m.up !== 'object') m.up = {};
    return m;
  }

  function level(key) {
    var m = state();
    return (m && m.up && m.up[key]) || 0;
  }

  /** 하나라도 샀는지 — 랭킹 트랙(BASE/MODDED) 판정의 유일한 기준 */
  function isUpgraded() {
    if (!cfg) return false;
    return cfg.upgrades.some(function (u) { return level(u.key) > 0; });
  }

  /** 배수형 강화의 흔한 형태를 짧게 쓰기 위한 헬퍼 — 1 + 단계 × 폭 */
  function mul(key, per) {
    return 1 + level(key) * per;
  }

  /** 런 종료 시 화폐 적립. 적립량을 돌려주므로 결과 화면에 그대로 쓸 수 있다. */
  function award(amount) {
    var m = state();
    var n = Math.max(0, Math.floor(amount || 0));
    if (!m || n <= 0) return 0;
    m.medals += n;
    persist();
    render();
    return n;
  }

  function persist() {
    if (cfg.save) cfg.save(); else ownSave();
  }

  function costOf(u, lv) {
    return typeof u.cost === 'function' ? u.cost(lv) : u.cost;
  }

  function buy(u) {
    var m = state();
    if (!m) return false;
    var lv = level(u.key);
    if (lv >= u.max) return false;
    var cost = costOf(u, lv);
    if (m.medals < cost) return false;
    m.medals -= cost;
    m.up[u.key] = lv + 1;
    persist();
    render();
    return true;
  }

  function render() {
    if (!listEl || !cfg) return;
    var m = state();
    var medals = m ? m.medals : 0;
    if (curEl) curEl.textContent = (cfg.currency.icon || '🎖') + ' ' + medals;
    listEl.innerHTML = '';
    cfg.upgrades.forEach(function (u) {
      var lv = level(u.key), maxed = lv >= u.max, cost = costOf(u, lv);
      var row = document.createElement('div');
      row.className = 'gm-row';
      var name = document.createElement('span');
      name.className = 'gm-name';
      name.textContent = tx(u.label);
      var lvTxt = document.createElement('span');
      lvTxt.className = 'gm-lv';
      lvTxt.textContent = lv + '/' + u.max;
      var btn = document.createElement('button');
      btn.className = 'gm-buy';
      btn.textContent = maxed ? (lang() === 'ko' ? '최대' : 'MAX')
        : cost + ' ' + tx(cfg.currency);
      btn.disabled = maxed || medals < cost;
      btn.onclick = function () { buy(u); };
      row.append(name, lvTxt, btn);
      listEl.appendChild(row);
    });
  }

  var STYLE = [
    '#gameMeta{width:100%;margin:6px 0 2px;padding:8px 10px;border:1px solid rgba(148,163,184,.28);',
    'border-radius:8px;background:rgba(0,0,0,.22);text-align:left}',
    '#gameMeta .gm-head{display:flex;justify-content:space-between;align-items:center;',
    'font-size:12px;margin-bottom:6px}',
    '#gameMeta .gm-cur{font-variant-numeric:tabular-nums}',
    '#gameMeta .gm-row{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px}',
    '#gameMeta .gm-name{flex:1}',
    '#gameMeta .gm-lv{font-variant-numeric:tabular-nums;opacity:.75}',
    '#gameMeta .gm-buy{min-height:32px;padding:4px 9px;font-size:11px;border-radius:6px;border:0;',
    'cursor:pointer;font-family:inherit;background:rgba(255,255,255,.14);color:inherit;min-width:66px}',
    '#gameMeta .gm-buy:disabled{opacity:.4;cursor:default}',
    '#gameMeta .gm-note{font-size:11px;opacity:.65;margin-top:6px}',
    '#gameMeta .gm-code{margin-top:7px;padding-top:7px;border-top:1px solid rgba(148,163,184,.18)}',
    '#gameMeta .gm-code-val{display:block;font-size:11px;letter-spacing:2px;opacity:.8;min-height:14px}',
    '#gameMeta .gm-code-row{display:flex;gap:6px;margin-top:4px}',
    '#gameMeta .gm-code-row input{flex:1;min-width:0;min-height:32px;padding:5px 9px;font-size:11px;',
    'border-radius:6px;border:1px solid rgba(148,163,184,.3);background:rgba(0,0,0,.25);color:inherit;',
    'font-family:inherit;text-align:center;letter-spacing:1px}',
  ].join('');

  function mount(parent) {
    var host = parent || document.getElementById('menu');
    if (!host || !cfg || document.getElementById('gameMeta')) return;

    var style = document.createElement('style');
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);

    var box = document.createElement('div');
    box.id = 'gameMeta';
    var head = document.createElement('div');
    head.className = 'gm-head';
    var title = document.createElement('b');
    title.textContent = tx(cfg.title) || (lang() === 'ko' ? '🏰 강화' : '🏰 Upgrades');
    curEl = document.createElement('span');
    curEl.className = 'gm-cur';
    head.append(title, curEl);
    listEl = document.createElement('div');
    // 엔진이 저장을 맡는 게임에는 이어하기 줄도 함께 준다 — 강화가 기기에 갇히지 않게.
    var codeRow = null;
    if (!cfg.load) {
      codeRow = document.createElement('div');
      codeRow.className = 'gm-code';
      codeEl = document.createElement('span');
      codeEl.className = 'gm-code-val';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = lang() === 'ko' ? '이어하기 코드' : 'Continue code';
      input.maxLength = 18;
      var load = document.createElement('button');
      load.className = 'gm-buy';
      load.textContent = lang() === 'ko' ? '불러오기' : 'Load';
      load.onclick = function () {
        load.disabled = true;
        loadByCode(input.value).then(function (ok) {
          load.textContent = ok ? (lang() === 'ko' ? '✅ 완료' : '✅ Done')
            : (lang() === 'ko' ? '실패' : 'Failed');
          setTimeout(function () {
            load.textContent = lang() === 'ko' ? '불러오기' : 'Load';
            load.disabled = false;
          }, 1400);
        });
      };
      var row = document.createElement('div');
      row.className = 'gm-code-row';
      row.append(input, load);
      codeRow.append(codeEl, row);
    }

    var note = document.createElement('div');
    note.className = 'gm-note';
    note.textContent = lang() === 'ko'
      ? '출정마다 쌓인다. 져도 남는다 — 다음 판이 더 강해진다.'
      : 'Earned every run and kept after a loss — the next run starts stronger.';
    box.append(head, listEl);
    if (codeRow) box.appendChild(codeRow);
    box.appendChild(note);
    host.appendChild(box);
    render();
  }

  function init(config) {
    cfg = config;
    var ready = Promise.resolve();
    if (!cfg.load) {
      own.keyLocal = cfg.slug + '_meta';
      own.keyCode = cfg.slug + '_code';
      own.code = localStorage.getItem(own.keyCode);
      own.data = { medals: 0, up: {} };
      ready = ownLoad();
    }
    function go() { mount(); ready.then(render); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  }

  /** 이어하기 코드로 다른 기기의 진행도를 가져온다 (엔진이 저장을 맡는 경우) */
  function loadByCode(raw) {
    if (cfg.load) return Promise.resolve(false);
    var code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 8) return Promise.resolve(false);
    return ownLoad(code).then(function (ok) { render(); return ok; });
  }

  window.GameMeta = {
    init: init, mount: mount, render: render, loadByCode: loadByCode,
    level: level, mul: mul, award: award, isUpgraded: isUpgraded,
    code: function () { return cfg && !cfg.load ? own.code : null; },
  };
})();
