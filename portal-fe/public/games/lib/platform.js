/**
 * 클린룸 게임 → 플랫폼 통합 어댑터.
 *
 * 마지노선 체제(클린룸 서브세션이 게임을 만들고, 메인 세션이 플랫폼에 얹는다)의 접착층.
 * 게임 코드는 거의 건드리지 않는다 — 런 종료 지점에 `PlatformAdapter.runEnd({score, detail})`
 * 한 줄만 심으면 되고, 나머지(서버 세이브 동기화·랭킹 UI)는 이 파일이 바깥에서 두른다.
 *
 * 서버 세이브: 게임의 localStorage 키를 가로채(setItem 패치) 디바운스 PUT.
 * 첫 방문 기기에서 로컬이 비어 있으면 서버본을 심고 1회 리로드(sessionStorage 가드) —
 * 게임 부트 흐름을 기다리게 하는 것보다 안전하다.
 *
 * 랭킹: lib/rank.js 위임. 게임 화면을 침범하지 않도록 우하단 🏆 플로팅 버튼 + 오버레이.
 *
 * 사용 (index.html, 게임 스크립트보다 먼저):
 *   <script src="../lib/rank.js"></script>
 *   <script src="../lib/platform.js"></script>
 *   <script>PlatformAdapter.init({ slug: 'abyssal-crown', saveKeys: ['abyssal-crown.save.v1'] });</script>
 */
(function () {
  'use strict';

  var cfg = null, saveVersion = 0, saveCode = null, saveT = null;

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
    return fetch('/api/v1/games/' + cfg.slug + path, { method: o.method || 'GET', headers: h, body: o.body })
      .then(function (r) {
        return r.json().then(function (b) {
          if (!r.ok || !b || b.success === false) throw new Error((b && b.error && b.error.code) || r.status);
          return b.data;
        });
      });
  }

  /* ── 서버 세이브 ── */
  function collect() {
    var out = {};
    cfg.saveKeys.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    });
    return out;
  }
  function push() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      api('/save', { method: 'PUT', body: JSON.stringify({ data: collect(), version: saveVersion, code: saveCode }) })
        .then(function (s) {
          saveVersion = s.version;
          if (s.code) { saveCode = s.code; localStorage.setItem(cfg.slug + '.pa.code', s.code); }
        })
        .catch(function () { /* 로컬은 이미 저장돼 있다 */ });
    }, 600);
  }
  function hookStorage() {
    var orig = localStorage.setItem.bind(localStorage);
    try {
      localStorage.setItem = function (k, v) {
        orig(k, v);
        if (cfg.saveKeys.indexOf(k) >= 0) push();
      };
    } catch (_) { /* 패치 실패 시 서버 세이브만 포기 */ }
  }
  function pull() {
    saveCode = localStorage.getItem(cfg.slug + '.pa.code');
    if (!token() && !saveCode) return;                     // 식별 수단이 없으면 조용히 로컬 전용
    var q = (!token() && saveCode) ? '?code=' + encodeURIComponent(saveCode) : '';
    api('/save' + q).then(function (s) {
      saveVersion = s.version;
      if (s.code) { saveCode = s.code; localStorage.setItem(cfg.slug + '.pa.code', s.code); }
      if (!s.data) return;
      // 이 기기가 백지일 때만 서버본을 심는다 — 진행 중인 로컬을 덮지 않는다
      var localEmpty = cfg.saveKeys.every(function (k) { return localStorage.getItem(k) == null; });
      if (localEmpty && !sessionStorage.getItem('pa_seeded')) {
        Object.keys(s.data).forEach(function (k) {
          if (cfg.saveKeys.indexOf(k) >= 0) localStorage.setItem(k, s.data[k]);
        });
        sessionStorage.setItem('pa_seeded', '1');
        location.reload();
      }
    }).catch(function () { /* 서버 없음/미등록 — 로컬 전용으로 진행 */ });
  }

  /* ── 랭킹 오버레이 ── */
  var overlay = null;
  function buildUI() {
    if (!window.GameRank) return;
    var btn = document.createElement('button');
    btn.textContent = '🏆';
    btn.setAttribute('aria-label', 'ranking');
    btn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99990;width:44px;height:44px;' +
      'border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,14,24,.8);' +
      'font-size:20px;cursor:pointer;color:#fff';
    btn.onclick = function () { overlay.hidden = !overlay.hidden; if (!overlay.hidden) renderBoard(); };
    document.body.appendChild(btn);

    overlay = document.createElement('div');
    overlay.hidden = true;
    overlay.style.cssText = 'position:fixed;right:14px;bottom:66px;z-index:99991;width:290px;max-height:70vh;' +
      'overflow-y:auto;background:rgba(8,10,18,.96);border:1px solid rgba(255,255,255,.2);border-radius:12px;' +
      'padding:12px;color:#e8e8f0;font:12px inherit;text-align:left';
    var title = document.createElement('b');
    title.textContent = '🏆 ' + (cfg.title || cfg.slug);
    var nickRow = document.createElement('div');
    nickRow.style.cssText = 'display:flex;gap:6px;margin:8px 0';
    var input = document.createElement('input');
    input.placeholder = '닉네임 (2~16자)';
    input.maxLength = 16;
    input.value = GameRank.nickname() || '';
    input.style.cssText = 'flex:1;min-width:0;padding:6px 8px;border-radius:6px;font-family:inherit;' +
      'border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:inherit';
    var save = document.createElement('button');
    save.textContent = '저장';
    save.style.cssText = 'padding:6px 10px;border-radius:6px;border:0;cursor:pointer;font-family:inherit';
    save.onclick = function () {
      GameRank.setNickname(input.value);
      save.textContent = '✅';
      setTimeout(function () { save.textContent = '저장'; }, 1200);
      renderBoard();
    };
    nickRow.append(input, save);
    var board = document.createElement('div');
    board.id = 'pa-board';
    overlay.append(title, nickRow, board);
    document.body.appendChild(overlay);
  }
  function renderBoard() {
    var el = overlay && overlay.querySelector('#pa-board');
    if (el && window.GameRank) GameRank.panel(cfg.slug, el, 'BASE');
  }

  /* ── 공개 API ── */
  function runEnd(r) {
    if (!cfg || !window.GameRank || !r || !(r.score > 0)) return;
    GameRank.submit(cfg.slug, Math.round(r.score), String(r.detail || ''));
  }

  function init(config) {
    cfg = config;
    cfg.saveKeys = cfg.saveKeys || [];
    hookStorage();
    pull();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
    else buildUI();
  }

  window.PlatformAdapter = { init: init, runEnd: runEnd };
})();
