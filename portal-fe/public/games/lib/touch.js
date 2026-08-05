/**
 * 게임 공통 가상 터치패드 — 터치 기기에서만 나타난다.
 * 실제 KeyboardEvent(keydown/keyup, code 포함)를 합성하므로 게임 입력 코드는 수정이 필요 없다.
 *
 * 사용: <script src="../lib/touch.js" data-actions="KeyZ:⚔,ShiftLeft:🌀"></script>
 *   data-actions  우측 액션 버튼 목록 "code:라벨" 콤마 구분 (생략 시 D-패드만)
 *   data-nodpad   "1" 이면 D-패드 생략 (액션 버튼만)
 */
(function () {
  'use strict';
  if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return;

  var ds = (document.currentScript && document.currentScript.dataset) || {};
  var actions = (ds.actions || '').split(',').filter(Boolean).map(function (s) {
    var i = s.indexOf(':');
    return { code: s.slice(0, i), label: s.slice(i + 1) };
  });

  var KEY_OF = {
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    ShiftLeft: 'Shift', Space: ' ', Escape: 'Escape', Enter: 'Enter',
  };
  function keyFor(code) {
    if (KEY_OF[code]) return KEY_OF[code];
    if (code.indexOf('Key') === 0) return code.slice(3).toLowerCase();
    if (code.indexOf('Digit') === 0) return code.slice(5);
    return code;
  }
  function fire(type, code) {
    window.dispatchEvent(new KeyboardEvent(type, { key: keyFor(code), code: code, bubbles: true }));
  }

  var css = document.createElement('style');
  css.textContent =
    '.vt-pad{position:fixed;z-index:999;bottom:14px;user-select:none;-webkit-user-select:none;touch-action:none;opacity:.82}' +
    '.vt-pad button{width:58px;height:58px;border-radius:14px;border:1px solid rgba(255,255,255,.25);' +
    'background:rgba(20,24,38,.72);color:#fff;font-size:22px;font-weight:bold;font-family:monospace;' +
    'touch-action:none;-webkit-tap-highlight-color:transparent}' +
    '.vt-pad button:active{background:rgba(120,140,220,.8)}' +
    '#vt-dpad{left:12px;display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(3,58px);gap:4px}' +
    '#vt-acts{right:12px;display:flex;flex-direction:column-reverse;gap:10px;align-items:flex-end}' +
    '#vt-acts button{width:64px;height:64px;border-radius:50%;font-size:17px}';
  document.head.appendChild(css);

  function bind(btn, code) {
    var down = function (ev) { ev.preventDefault(); fire('keydown', code); };
    var up = function (ev) { ev.preventDefault(); fire('keyup', code); };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
    btn.addEventListener('touchcancel', up, { passive: false });
    btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  function build() {
    if (ds.nodpad !== '1') {
      var pad = document.createElement('div');
      pad.className = 'vt-pad'; pad.id = 'vt-dpad';
      // 3x3 그리드 — 십자 위치에만 버튼
      var cells = [null, 'ArrowUp', null, 'ArrowLeft', null, 'ArrowRight', null, 'ArrowDown', null];
      var glyph = { ArrowUp: '▲', ArrowDown: '▼', ArrowLeft: '◀', ArrowRight: '▶' };
      cells.forEach(function (code) {
        var el;
        if (code) { el = document.createElement('button'); el.textContent = glyph[code]; bind(el, code); }
        else { el = document.createElement('span'); }
        pad.appendChild(el);
      });
      document.body.appendChild(pad);
    }
    if (actions.length) {
      var acts = document.createElement('div');
      acts.className = 'vt-pad'; acts.id = 'vt-acts';
      actions.forEach(function (a) {
        var el = document.createElement('button');
        el.textContent = a.label; bind(el, a.code);
        acts.appendChild(el);
      });
      document.body.appendChild(acts);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
