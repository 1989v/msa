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

  function lang() {
    return (window.GameI18n && GameI18n.lang) || 'ko';
  }

  function tx(v) {
    if (v == null) return '';
    return typeof v === 'string' ? v : (v[lang()] || v.ko || v.en || '');
  }

  function state() {
    var m = cfg && cfg.load ? cfg.load() : null;
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
    if (cfg.save) cfg.save();
    render();
    return n;
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
    if (cfg.save) cfg.save();
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
    var note = document.createElement('div');
    note.className = 'gm-note';
    note.textContent = lang() === 'ko'
      ? '출정마다 쌓인다. 져도 남는다 — 다음 판이 더 강해진다.'
      : 'Earned every run and kept after a loss — the next run starts stronger.';
    box.append(head, listEl, note);
    host.appendChild(box);
    render();
  }

  function init(config) {
    cfg = config;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { mount(); });
    } else {
      mount();
    }
  }

  window.GameMeta = {
    init: init, mount: mount, render: render,
    level: level, mul: mul, award: award, isUpgraded: isUpgraded,
  };
})();
