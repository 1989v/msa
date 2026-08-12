/**
 * 게임 공통 모바일 조작·레이아웃 엔진 — 터치 기기(pointer: coarse)에서만 동작한다.
 *
 * 좌하단 원형 아날로그 조이스틱(한 손가락 360°)과 우하단 액션 버튼을 띄우고
 * 실제 KeyboardEvent(keydown/keyup, code 포함)를 합성한다. 대각선은 인접한 두 방향키를
 * 동시에 눌린 상태로 유지하므로(북동 = ArrowUp + ArrowRight) 키 입력을 읽는 기존 게임은
 * 코드 수정 없이 그대로 동작한다.
 *
 * 좁은 터치 화면에서는 레이아웃도 함께 잡는다 — 게임 화면을 상단으로 붙이고 하단에 조작
 * 영역(--vt-pad-h)을 확보한 뒤, 캔버스를 남은 영역에 비율 유지로 최대 크기로 맞춘다.
 * 이때 인라인 style.width/height 만 쓰고 canvas.width/height 속성(게임 내부 좌표계)은
 * 절대 건드리지 않는다.
 * 가로모드는 화면이 짧아 여백을 뺄 수 없으므로 --vt-pad-h 를 0 으로 두고, 캔버스를 높이 기준으로
 * 맞춘 뒤 조이스틱·액션을 좌우 하단 코너에 반투명 오버레이로 얹는다.
 * 전체화면 API 는 쓰지 않는다 (iframe 안에서 게임마다 동작이 달라진다).
 *
 * 사용:
 *   <script src="../lib/touch.js" data-actions="KeyZ:⚔,ShiftLeft:🌀"></script>
 *
 * 옵션 (script 태그 data-*):
 *   data-actions   우측 액션 버튼 "code:라벨" 콤마 구분 (생략 시 조이스틱만)
 *   data-nodpad    "1" 이면 조이스틱 생략 (= data-stick="off". 기존 옵션 그대로 유지)
 *   data-dirkeys   "wasd" 면 KeyW/KeyA/KeyS/KeyD 합성. 기본은 Arrow* (자동 감지하지 않는다)
 *   data-stick     "floating"(기본) | "fixed" | "off"
 *                  floating: 좌하단 조작 영역 아무 곳이나 짚으면 그 지점에 베이스가 생긴다
 *                  fixed:    베이스가 좌하단 고정 위치에 항상 떠 있다
 *   data-fit       "0" 이면 레이아웃 개입(상단 정렬·하단 여백·캔버스 맞춤)을 끈다
 *
 * 전역 API — window.GameTouch (터치 기기가 아니어도 no-op 스텁이 항상 존재한다):
 *   axis()        {x, y, mag, dir8, codes}
 *                 x/y 는 -1..1 (화면 좌표계 — y 는 아래쪽이 +), 데드존 안에서는 전부 0.
 *                 mag 는 데드존 밖 구간을 0..1 로 재정규화한 값.
 *                 dir8 은 8방향 대표 code (대각선은 수직 성분), 중립이면 null.
 *                 codes 는 실제로 눌려 있는 방향 code 배열 (대각선이면 2개).
 *   pressed()     패드가 지금 누르고 있는 전체 code 배열 (방향 + 액션)
 *   setVisible(b) 패드 전체 표시/숨김
 *   refit()       레이아웃 재계산 (게임이 캔버스 크기를 바꾼 뒤 호출)
 *   on(evt, fn) / off(evt, fn)
 *                 'press'(code) · 'release'(code) · 'axis'(axis 객체) · 'layout'({padH, landscape, canvas})
 *
 * 아날로그 입력을 쓰고 싶은 게임은 키 이벤트를 그대로 두고 매 프레임 axis() 를 덧대면 된다.
 * 전역 오염은 window.GameTouch 하나, 외부 의존 없음.
 */
(function () {
  'use strict';

  var W = window, D = document;
  var ds = (D.currentScript && D.currentScript.dataset) || {};

  /* ────────── 옵션 파싱 ────────── */
  var actions = String(ds.actions || '').split(',').filter(Boolean).map(function (s) {
    var i = s.indexOf(':');
    return i < 0 ? { code: s, label: s } : { code: s.slice(0, i), label: s.slice(i + 1) };
  });
  var stickMode = ds.stick || (ds.nodpad === '1' ? 'off' : 'floating');
  if (stickMode !== 'fixed' && stickMode !== 'off') stickMode = 'floating';
  var DIRKEY = ds.dirkeys === 'wasd'
    ? { u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD' }
    : { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' };
  var fitOpt = ds.fit !== '0';

  /* ────────── 이벤트 버스 ────────── */
  var listeners = {};
  function on(evt, fn) {
    if (typeof fn !== 'function') return;
    (listeners[evt] || (listeners[evt] = [])).push(fn);
  }
  function off(evt, fn) {
    var a = listeners[evt];
    if (!a) return;
    var i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  function emit(evt, arg) {
    var a = listeners[evt];
    if (!a) return;
    for (var i = 0; i < a.length; i++) { try { a[i](arg); } catch (e) { /* 리스너 예외는 삼킨다 */ } }
  }

  /* ────────── 터치 기기가 아니면 no-op 스텁만 남기고 종료 ────────── */
  var GT = {
    enabled: false,
    axis: function () { return { x: 0, y: 0, mag: 0, dir8: null, codes: [] }; },
    pressed: function () { return []; },
    setVisible: function () {},
    refit: function () {},
    on: on,
    off: off,
  };
  W.GameTouch = GT;
  if (!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches)) return;
  GT.enabled = true;

  /* ────────── 상수 ────────── */
  var BASE_R = 64;        // 조이스틱 베이스 반경
  var KNOB_R = 29;        // 노브 반경
  var DEAD = 0.18;        // 데드존 (베이스 반경 대비)
  var HYST = 8;           // 섹터 히스테리시스 (deg)
  var SECTOR_CODES = [    // 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, 7=SE
    ['r'], ['u', 'r'], ['u'], ['u', 'l'], ['l'], ['d', 'l'], ['d'], ['d', 'r'],
  ];

  /* ────────── 키 합성 ────────── */
  var KEY_OF = {
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: ' ', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab',
  };
  function keyFor(code) {
    if (KEY_OF[code]) return KEY_OF[code];
    if (code.indexOf('Key') === 0) return code.slice(3).toLowerCase();
    if (code.indexOf('Digit') === 0) return code.slice(5);
    return code;
  }
  function fire(type, code) {
    W.dispatchEvent(new KeyboardEvent(type, { key: keyFor(code), code: code, bubbles: true }));
  }

  var held = {};        // code -> true (패드가 누르고 있는 전체 키)
  var dirHeld = [];     // 방향키만 따로 — 방향 전환 시 diff 대상

  function press(code) {
    if (held[code]) return;
    held[code] = true;
    fire('keydown', code);
    emit('press', code);
  }
  function release(code) {
    if (!held[code]) return;
    delete held[code];
    fire('keyup', code);
    emit('release', code);
  }
  /** 이전 방향키는 keyup, 새 방향키는 keydown — 중복 발사도 누락도 없게 diff 적용 */
  function setDir(codes) {
    var i;
    for (i = 0; i < dirHeld.length; i++) if (codes.indexOf(dirHeld[i]) < 0) release(dirHeld[i]);
    for (i = 0; i < codes.length; i++) press(codes[i]);
    dirHeld = codes.slice();
  }
  function releaseAll() {
    setDir([]);
    var codes = keysOf(held);
    for (var i = 0; i < codes.length; i++) release(codes[i]);
  }
  function keysOf(o) {
    var out = [];
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out.push(k);
    return out;
  }

  /* ────────── CSS 주입 ────────── */
  var style = D.createElement('style');
  style.id = 'vt-style';
  style.textContent = [
    ':root{--vt-pad-h:0px}',
    '#vt-root{position:fixed;left:0;top:0;right:0;bottom:0;z-index:9990;pointer-events:none;',
    'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;',
    'opacity:.94;transition:opacity .15s}',
    '#vt-root[hidden]{display:none}',
    '#vt-root *{box-sizing:border-box}',
    'body.vt-land #vt-root{opacity:.6}',
    '#vt-probe{position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;',
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}',
    '#vt-zone{position:absolute;left:0;bottom:0;pointer-events:auto;touch-action:none}',
    '#vt-zone[hidden],#vt-base[hidden],#vt-acts[hidden]{display:none}',
    '#vt-base{position:absolute;width:' + (BASE_R * 2) + 'px;height:' + (BASE_R * 2) + 'px;',
    'margin:' + -BASE_R + 'px 0 0 ' + -BASE_R + 'px;border-radius:50%;pointer-events:none;',
    'border:2px solid rgba(255,255,255,.22);background:rgba(16,20,34,.5);',
    'box-shadow:inset 0 0 22px rgba(120,150,220,.14);opacity:0;transition:opacity .12s}',
    '#vt-base.on{opacity:1}',
    '#vt-knob{position:absolute;left:50%;top:50%;width:' + (KNOB_R * 2) + 'px;height:' + (KNOB_R * 2) + 'px;',
    'margin:' + -KNOB_R + 'px 0 0 ' + -KNOB_R + 'px;border-radius:50%;',
    'background:rgba(150,172,224,.55);border:2px solid rgba(255,255,255,.42);',
    'box-shadow:0 2px 10px rgba(0,0,0,.45)}',
    '#vt-acts{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none}',
    '#vt-acts button{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;',
    'border:1px solid rgba(255,255,255,.25);background:rgba(20,24,38,.74);color:#fff;',
    'font-size:19px;font-weight:bold;font-family:monospace;line-height:1;padding:0;',
    '-webkit-tap-highlight-color:transparent;transition:transform .06s,background .06s}',
    '#vt-acts button.on{background:rgba(120,140,220,.85);transform:scale(.92)}',
    /* 레이아웃 엔진 — 본문을 뷰포트에 못 박는다.
       호스트가 iframe 을 뷰포트 크기로 고정해 주므로 안에서 세로로 자랄 이유가 없고,
       자라면 그 자체가 버그다(스크롤되는 게임 화면 / 끝없이 늘어나는 바깥 영역).
       min-height:100vh 를 쓰는 게임이 많아 명시적으로 덮어쓴다. */
    'body.vt-fit{height:100dvh;min-height:0!important;max-height:100dvh;',
    'overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;',
    /* 남는 세로를 위아래로 나눠 게임을 화면 가운데에 둔다. 넘치는 게임(메뉴가 곧 본문인
       흐름 배치 2종)에서는 center 가 내용 위쪽을 스크롤로도 닿지 않는 곳에 밀어내므로
       safe 로 시작 정렬로 되돌린다 — 미지원 브라우저는 앞줄이 남는다. */
    'justify-content:center!important;justify-content:safe center!important;',
    'padding-bottom:calc(var(--vt-pad-h) + env(safe-area-inset-bottom))!important}',
    /* 메뉴·결과 패널은 게임 래퍼 안에 inset:0 으로 까는 관용구다(47/52 게임 공통).
       fit 이 캔버스를 폭에 맞춰 줄이면 래퍼도 같이 줄고, overflow:hidden 이면 패널 내용이
       잘려 버튼이 화면 밖으로 사라진다 — 모바일에서 "화면이 잘린다"의 실제 원인.
       뷰포트 기준으로 띄워 래퍼 클리핑을 벗어나고, 넘치면 스크롤시킨다.
       justify-content 를 flex-start 로 되돌리는 게 핵심 — center 인 채로 넘치면
       위쪽 내용이 스크롤로도 닿지 않는다. */
    'body.vt-fit .panel:not([hidden]),body.vt-fit>#menu:not([hidden]){position:fixed;inset:0;',
    'max-height:100dvh;overflow-y:auto;overscroll-behavior:contain;',
    'justify-content:flex-start!important;',
    'padding-top:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom))}',
  ].join('');
  (D.head || D.documentElement).appendChild(style);

  /* ────────── DOM ────────── */
  var root, zone, base, knob, actWrap, probe;
  var actEls = [];

  function build() {
    root = D.createElement('div');
    root.id = 'vt-root';

    probe = D.createElement('div');
    probe.id = 'vt-probe';
    root.appendChild(probe);

    if (stickMode !== 'off') {
      zone = D.createElement('div');
      zone.id = 'vt-zone';
      base = D.createElement('div');
      base.id = 'vt-base';
      knob = D.createElement('div');
      knob.id = 'vt-knob';
      base.appendChild(knob);
      root.appendChild(zone);
      root.appendChild(base);
      zone.addEventListener('pointerdown', onStickDown, { passive: false });
    }

    if (actions.length) {
      actWrap = D.createElement('div');
      actWrap.id = 'vt-acts';
      actions.forEach(function (a) {
        var b = D.createElement('button');
        b.type = 'button';
        b.textContent = a.label;
        b.setAttribute('aria-label', a.code);
        bindAction(b, a.code);
        actWrap.appendChild(b);
        actEls.push(b);
      });
      root.appendChild(actWrap);
    }

    root.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    D.body.appendChild(root);

    // pointermove 는 스틱을 끄는 동안에만 non-passive 로 붙인다 (평소 스크롤 최적화를 막지 않게)
    W.addEventListener('pointerup', onUp, { passive: true });
    W.addEventListener('pointercancel', onUp, { passive: true });
    W.addEventListener('blur', releaseAll);
    W.addEventListener('resize', scheduleLayout);
    W.addEventListener('orientationchange', scheduleLayout);
    if (W.visualViewport) {
      W.visualViewport.addEventListener('resize', scheduleLayout);
      W.visualViewport.addEventListener('scroll', scheduleLayout);
    }

    watchPanels();
    layout();
    syncPanels();
  }

  /* ────────── 액션 버튼 ────────── */
  function bindAction(btn, code) {
    btn.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (btnPtr[ev.pointerId]) return;
      btnPtr[ev.pointerId] = { code: code, el: btn };
      btn.classList.add('on');
      press(code);
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* 무시 */ } }
      capture(btn, ev.pointerId);
    }, { passive: false });
  }

  /* ────────── 포인터 상태 ────────── */
  var stick = { id: null, cx: 0, cy: 0, px: 0, py: 0, sector: -1, x: 0, y: 0, mag: 0 };
  var btnPtr = {};       // pointerId -> {code, el}
  var moveQueued = false;

  function capture(el, id) {
    if (el.setPointerCapture) { try { el.setPointerCapture(id); } catch (e) { /* 무시 */ } }
  }

  function onStickDown(ev) {
    ev.preventDefault();
    if (stick.id !== null) return;
    stick.id = ev.pointerId;
    var v = viewport();
    if (stickMode === 'fixed') {
      stick.cx = fixedCx;
      stick.cy = fixedCy;
    } else {
      stick.cx = clamp(ev.clientX, safe.l + BASE_R + 2, v.w - safe.r - BASE_R - 2);
      stick.cy = clamp(ev.clientY, BASE_R + 2, v.h - safe.b - BASE_R - 2);
    }
    stick.px = ev.clientX;
    stick.py = ev.clientY;
    stick.sector = -1;
    base.style.left = stick.cx + 'px';
    base.style.top = stick.cy + 'px';
    base.classList.add('on');
    capture(zone, ev.pointerId);
    W.addEventListener('pointermove', onMove, { passive: false });
    processStick();
  }

  function stopStick() {
    W.removeEventListener('pointermove', onMove, { passive: false });
    stick.id = null;
    stick.sector = -1;
    stick.x = stick.y = stick.mag = 0;
    setDir([]);
    if (knob) knob.style.transform = 'translate(0px,0px)';
  }

  function onMove(ev) {
    if (ev.pointerId !== stick.id) return;
    ev.preventDefault();          // 스틱 드래그 중에만 스크롤/제스처를 막는다
    stick.px = ev.clientX;
    stick.py = ev.clientY;
    if (moveQueued) return;
    moveQueued = true;
    raf(function () { moveQueued = false; if (stick.id !== null) processStick(); });
  }

  function onUp(ev) {
    if (ev.pointerId === stick.id) {
      stopStick();
      if (stickMode !== 'fixed') base.classList.remove('on');
      emit('axis', GT.axis());
    }
    var b = btnPtr[ev.pointerId];
    if (b) {
      delete btnPtr[ev.pointerId];
      b.el.classList.remove('on');
      release(b.code);
    }
  }

  /** 노브 위치 → 8방향 키 집합 + 아날로그 값. 데드존/히스테리시스 적용. */
  function processStick() {
    var dx = stick.px - stick.cx, dy = stick.py - stick.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var kd = Math.min(dist, BASE_R);
    var ux = dist > 0 ? dx / dist : 0, uy = dist > 0 ? dy / dist : 0;
    knob.style.transform = 'translate(' + (ux * kd).toFixed(1) + 'px,' + (uy * kd).toFixed(1) + 'px)';

    var deadPx = BASE_R * DEAD;
    if (dist <= deadPx) {
      stick.sector = -1;
      stick.x = stick.y = stick.mag = 0;
      setDir([]);
      emit('axis', GT.axis());
      return;
    }
    var mag = Math.min(1, (dist - deadPx) / (BASE_R - deadPx));
    stick.x = ux * mag;
    stick.y = uy * mag;
    stick.mag = mag;

    var ang = Math.atan2(-dy, dx) * 180 / Math.PI;      // 0=동, 90=북 (수학 좌표계)
    stick.sector = sectorOf(ang, stick.sector);
    var parts = SECTOR_CODES[stick.sector];
    var codes = [];
    for (var i = 0; i < parts.length; i++) codes.push(DIRKEY[parts[i]]);
    setDir(codes);
    emit('axis', GT.axis());
  }

  /** 이전 섹터를 22.5°+HYST 까지 유지해 경계에서 8방향이 떨리지 않게 한다 */
  function sectorOf(ang, prev) {
    if (prev >= 0 && Math.abs(angDiff(ang, prev * 45)) <= 22.5 + HYST) return prev;
    return ((Math.round(ang / 45) % 8) + 8) % 8;
  }
  function angDiff(a, b) {
    var d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  /* ────────── 레이아웃 엔진 ────────── */
  var safe = { t: 0, r: 0, b: 0, l: 0 };
  var fixedCx = 0, fixedCy = 0;
  var layoutQueued = false;

  function px(v) { var n = parseFloat(v); return n > 0 ? n : 0; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function raf(fn) { return (W.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(fn); }

  function viewport() {
    var vv = W.visualViewport;
    return {
      w: (vv && vv.width) || W.innerWidth || 360,
      h: (vv && vv.height) || W.innerHeight || 640,
    };
  }

  function measureSafe() {
    if (!probe || !W.getComputedStyle) return;
    var cs = W.getComputedStyle(probe);
    safe.t = px(cs.paddingTop); safe.r = px(cs.paddingRight);
    safe.b = px(cs.paddingBottom); safe.l = px(cs.paddingLeft);
  }

  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    raf(function () { layoutQueued = false; layout(); });
  }

  function layout() {
    var v = viewport();
    measureSafe();
    var land = v.w > v.h;
    // 좁은 터치 화면에서만 레이아웃에 개입한다 (태블릿 가로/데스크톱 터치는 원본 유지)
    var narrow = Math.min(v.w, v.h) <= 860;
    var fitOn = fitOpt && narrow;
    // **비울 게 없으면 비우지 않는다** — 조이스틱도 액션도 없는(레이아웃만 쓰는) 게임에서
    // 화면 아래를 빈 채로 남겨 게임이 작아지고 아래가 텅 비어 보였다.
    var hasControls = stickMode !== 'off' || actEls.length > 0;
    var band = (fitOn && !land && hasControls);

    D.body.classList.add('vt-touch');
    D.body.classList.toggle('vt-fit', fitOn);
    D.body.classList.toggle('vt-land', land);

    // 세로: 하단에 조작 밴드를 비우고 캔버스는 **남는 영역 가운데**에 둔다.
    //
    // 상단에 붙이면 390 폭에서 16:9 캔버스가 217px 뿐이라 조작부까지 400px 가 죽는다
    // ("컨트롤러가 게임 화면과 너무 멀다"). 그렇다고 조작부를 위로 올리면 엄지가 안 닿는다 —
    // 조작부는 화면 아래에 있어야 한다. 그래서 **캔버스 쪽을 내려** 남는 여백을 위아래로
    // 나눈다. 거리는 절반이 되고 캔버스는 여전히 화면 위쪽(중심이 화면의 1/3 지점)에 있다.
    // 이 비율의 근본 해법은 가로모드다 — 그쪽은 캔버스가 화면을 채우고 조작부가 위에 얹힌다.
    var padH = band ? Math.round(clamp(v.h * 0.28, BASE_R * 2 + 28, 300)) : 0;
    D.documentElement.style.setProperty('--vt-pad-h', padH + 'px');

    var cvFit = fitOn ? fitCanvas(v.h - padH, v) : null;

    var reach = placeActions(v, land);   // 액션 버튼이 우측에서 차지하는 폭

    // 조이스틱 조작 영역 — 세로는 밴드 전체, 가로는 좌하단 코너. 액션 영역과는 겹치지 않는다.
    if (zone) {
      // 가로에서는 캔버스 위에 얹히므로 좌하단 코너만큼만 잡는다
      var zwMax = land ? Math.min(v.w * 0.34, 300) : Math.min(v.w * 0.52, 340);
      var zw = Math.round(Math.min(zwMax, Math.max(120, v.w - reach - 10)));
      var zh = padH || Math.round(Math.min(v.h * 0.62, 210));
      zone.style.width = zw + 'px';
      zone.style.height = zh + 'px';
      fixedCx = safe.l + 20 + BASE_R;
      fixedCy = v.h - safe.b - 18 - BASE_R;
      if (stickMode === 'fixed' && stick.id === null) {
        base.style.left = fixedCx + 'px';
        base.style.top = fixedCy + 'px';
        base.classList.add('on');
      }
    }

    emit('layout', { padH: padH, landscape: land, canvas: cvFit });
  }

  /** 액션 버튼 배치. 반환값은 우측에서 버튼이 차지하는 폭(조이스틱 영역과 겹치지 않게 쓰인다). */
  function placeActions(v, land) {
    var n = actEls.length;
    if (!n) return 0;
    var insetR = 14 + safe.r;
    var insetB = (land ? 14 : 18) + safe.b;
    var i, el;
    if (n <= 3) {
      // 3개 이하는 기존 배치 유지 — 우하단 세로 스택 (지름 62 / 간격 12)
      for (i = 0; i < n; i++) applyBtn(actEls[i], 62, insetR, insetB + i * 74);
      return insetR + 62;
    }
    // 4개 이상은 우하단 코너를 축으로 부채꼴
    var size = 60, gap = 8;
    var A0 = 8 * Math.PI / 180, A1 = 86 * Math.PI / 180, span = A1 - A0;
    var r = Math.max(size + 26, (n - 1) * (size + gap) / span);
    r = Math.min(r, v.w * 0.46, v.h * 0.44);
    var reach = insetR + size;
    for (i = 0; i < n; i++) {
      var a = A0 + span * (i / (n - 1));
      var right = insetR + Math.round(r * Math.cos(a));
      applyBtn(actEls[i], size, right, insetB + Math.round(r * Math.sin(a)));
      if (right + size > reach) reach = right + size;
    }
    return reach;
  }
  function applyBtn(el, size, right, bottom) {
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.right = right + 'px';
    el.style.bottom = bottom + 'px';
  }

  /**
   * 게임 캔버스를 가용 영역에 비율 유지로 맞춘다. canvas.width/height 속성은 건드리지 않는다.
   * maxStageH 는 캔버스+주변 크롬이 세로로 쓸 수 있는 상한.
   */
  function fitCanvas(maxStageH, v) {
    var cv = D.getElementById('cv');
    if (!cv || cv.tagName !== 'CANVAS') cv = D.querySelector('canvas');
    if (!cv) return null;
    var cw = cv.width, ch = cv.height;
    if (!(cw > 0 && ch > 0)) return null;

    // 캔버스 위(HUD·제목)와 아래(컨테이너 테두리·조작 바·안내문)에 이미 쓰인 세로 공간을 뺀다.
    // 셋 다 캔버스 높이와 무관하므로 맞춤 결과가 다음 계산을 흔들지 않는다.
    var stage = stageOf(cv);
    var cvBox = cv.getBoundingClientRect();
    var stageBox = stage.getBoundingClientRect();
    var top = cvBox.top > 0 ? cvBox.top : 0;
    var frame = stageBox.bottom - cvBox.bottom;
    if (!(frame > 0)) frame = 0;
    var below = belowHeight(stage);
    // 캔버스가 자기 테두리를 갖는 경우(snake 는 1px) style.width 에 테두리가 더해져
    // 뷰포트를 넘는다. box-sizing 을 바꾸면 그림이 눌리므로 가용 폭에서 미리 뺀다.
    var edge = chromeOf(cv, stage);
    var availW = v.w - safe.l - safe.r - edge.x;
    var availH = maxStageH - safe.b - top - frame - below - edge.y;
    if (availW < 80 || availH < 80) return null;

    var s = Math.min(availW / cw, availH / ch);
    var w = Math.max(1, Math.floor(cw * s)), h = Math.max(1, Math.floor(ch * s));
    apply(cv, w, h);

    // 캔버스가 x=0 에서 시작한다는 보장이 없다 — body 패딩으로 밀리거나(stone-sage)
    // 옆 패널과 같은 행에 놓이기도 한다(snake). 배치 규칙을 게임마다 모델링하는 대신
    // **한 번 재보고 넘친 만큼 줄인다**. 재귀가 아니라 1회 보정이라 진동하지 않는다.
    var box = cv.getBoundingClientRect();
    var over = Math.max(0, box.right - (v.w - safe.r), -box.left + safe.l);
    if (over > 0 && w > over) {
      var s2 = (w - over) / w;
      w = Math.max(1, Math.floor(w * s2));
      h = Math.max(1, Math.floor(h * s2));
      apply(cv, w, h);
    }
    return { w: w, h: h, top: top, below: frame + below, availW: availW, availH: availH };
  }

  function apply(cv, w, h) {
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    cv.style.maxWidth = 'none';
    cv.style.maxHeight = 'none';
    cv.style.marginLeft = 'auto';
    cv.style.marginRight = 'auto';
  }

  /**
   * 캔버스를 폭에 맞출 때 실제로 못 쓰는 가로 크기.
   *
   * 캔버스 자신의 테두리(snake 1px)뿐 아니라 **감싼 래퍼의 테두리**(#wrap 4px 관용구)까지
   * 더해져야 한다 — 캔버스를 뷰포트 폭 그대로 잡으면 래퍼가 그만큼 밖으로 삐져나간다.
   * 세로는 cvBox.top 과 frame 이 이미 위아래 크롬을 담고 있어 캔버스 자신만 보면 된다.
   */
  function chromeOf(cv, stage) {
    if (!W.getComputedStyle) return { x: 0, y: 0 };
    var x = 0, y = 0;
    for (var n = cv; n; n = n.parentElement) {
      var cs = W.getComputedStyle(n);
      var bx = px(cs.borderLeftWidth) + px(cs.borderRightWidth) + px(cs.paddingLeft) + px(cs.paddingRight);
      if (n === cv) {
        // 우리가 style.width 를 지정하는 유일한 요소 — border-box 면 그 값에 이미 포함된다
        if (cs.boxSizing !== 'border-box') {
          x += bx;
          y = px(cs.borderTopWidth) + px(cs.borderBottomWidth) + px(cs.paddingTop) + px(cs.paddingBottom);
        }
      } else {
        // 래퍼는 폭이 auto 라 내용에 맞춰 줄어든다 — box-sizing 과 무관하게 바깥으로 더해진다
        x += bx;
      }
      if (n === stage || n === D.body) break;
    }
    return { x: x, y: y };
  }

  /** body 직속 조상(= 게임 화면 컨테이너)까지 올라간다 */
  function stageOf(el) {
    var n = el;
    while (n.parentElement && n.parentElement !== D.body) n = n.parentElement;
    return n;
  }

  /** 캔버스 컨테이너 아래에 남은 흐름 요소들(조작 바·안내문 등)의 높이 */
  function belowHeight(stage) {
    var total = 0;
    for (var n = stage.nextElementSibling; n; n = n.nextElementSibling) {
      if (n.id && n.id.indexOf('vt-') === 0) continue;
      if (n.hasAttribute('hidden') || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      if (W.getComputedStyle) {
        var pos = W.getComputedStyle(n).position;
        if (pos === 'fixed' || pos === 'absolute') continue;
      }
      total += n.offsetHeight || 0;
    }
    return total;
  }

  /* ────────── 전체화면 패널이 열리면 조작부를 비켜준다 ────────── */
  var syncQueued = false;
  var padHidden = false;

  // 게임마다 패널을 숨기는 방식이 다르다 — [hidden] 속성 / .hidden 클래스 / 인라인 display
  function panelOpen() {
    var ps = D.querySelectorAll('.panel');
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.hasAttribute('hidden')) continue;
      if (W.getComputedStyle && W.getComputedStyle(p).display === 'none') continue;
      return true;
    }
    return false;
  }

  /**
   * 메뉴·결과 패널이 열려 있는 동안에는 조작부 전체를 치운다.
   * 예전에는 조이스틱만 숨겨서 액션 버튼이 메뉴 위에 그대로 떠 있었다 — 시작 버튼과 겹쳐
   * 보이고 눌러도 아무 일이 없다.
   */
  function syncPanels() {
    var hide = panelOpen();
    if (hide === padHidden) return;
    padHidden = hide;
    if (hide) stopStick();
    if (zone) {
      toggleHidden(zone, hide);
      toggleHidden(base, hide);
      if (hide) base.classList.remove('on');
      else if (stickMode === 'fixed') base.classList.add('on');
    }
    if (actWrap) {
      toggleHidden(actWrap, hide);
      if (hide) for (var i = 0; i < actEls.length; i++) {
        actEls[i].classList.remove('on');
        release(actEls[i].getAttribute('aria-label'));
      }
    }
  }
  function toggleHidden(el, hide) {
    if (hide) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    raf(function () { syncQueued = false; syncPanels(); });
  }

  /** 패널 자체만 감시한다 — HUD 텍스트 갱신 같은 매 프레임 변화에 반응하지 않도록 */
  var panelObs = null;
  function observePanels() {
    var ps = D.querySelectorAll('.panel');
    for (var i = 0; i < ps.length; i++) {
      panelObs.observe(ps[i], { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    }
  }
  function watchPanels() {
    if (!W.MutationObserver) return;
    panelObs = new W.MutationObserver(scheduleSync);
    observePanels();
    // 패널이 나중에 추가되는 경우 대비 (body 직속 childList 만)
    new W.MutationObserver(function () { observePanels(); scheduleSync(); })
      .observe(D.body, { childList: true });
  }

  /* ────────── 공개 API ────────── */
  GT.axis = function () {
    var codes = dirHeld.slice();
    return {
      x: stick.x, y: stick.y, mag: stick.mag,
      dir8: codes.length ? codes[0] : null,
      codes: codes,
    };
  };
  GT.pressed = function () { return keysOf(held); };
  GT.setVisible = function (v) {
    if (!root) return;
    if (v) root.removeAttribute('hidden');
    else { releaseAll(); root.setAttribute('hidden', ''); }
  };
  GT.refit = function () { layout(); };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', build);
  else build();
})();
