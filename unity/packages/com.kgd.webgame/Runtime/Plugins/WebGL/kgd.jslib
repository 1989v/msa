// 플랫폼 공용 JS 전역(GameTouch · GameHud · GameKeys · GameRank/PlatformAdapter)을 감싸는 얇은 층.
// 여기에는 로직을 넣지 않는다 — 규칙의 집은 portal-fe/public/games/lib/ 이고 이 파일은 통로다.
// 전역이 없을 때(로컬 단독 실행·스텁)에도 조용히 기본값을 돌려줘야 한다.
mergeInto(LibraryManager.library, {

  // 가상패드 액션 슬롯 → 웹 key code 매핑을 등록한다. 콤마 구분 최대 5개.
  KgdSetActions: function (codesPtr) {
    var s = UTF8ToString(codesPtr);
    Module.kgdActions = s ? s.split(',') : [];
  },

  // 한 프레임에 필요한 값을 한 번에 읽는다 (JS↔WASM 경계를 프레임당 1회로 묶는다).
  // out[0..11] = axisX, axisY, axisMag, padH, landscape, coarse, hudExpanded, actionMask, keyLayout,
  //              chromeTop(우상단에 플랫폼 셸이 예약한 띠 높이, CSS px), safeTop,
  //              lang(0=ko, 1=en)
  KgdPoll: function (outPtr) {
    var i = outPtr >> 2;
    var H = HEAPF32;
    var ax = 0, ay = 0, am = 0, mask = 0;

    var GT = typeof GameTouch !== 'undefined' ? GameTouch : null;
    if (GT) {
      var a = GT.axis();
      ax = a.x; ay = a.y; am = a.mag;
      var held = GT.pressed();
      var codes = Module.kgdActions || [];
      for (var n = 0; n < codes.length && n < 5; n++) {
        if (held.indexOf(codes[n]) >= 0) mask |= (1 << n);
      }
      if (held.indexOf('Escape') >= 0) mask |= 32;
    }

    var padH = 0;
    var cs = getComputedStyle(document.documentElement).getPropertyValue('--vt-pad-h');
    if (cs) padH = parseFloat(cs) || 0;

    var vv = window.visualViewport;
    var vh = Math.min(window.innerHeight || 0, vv ? vv.height : Infinity);
    var vw = window.innerWidth || 0;

    var coarse = 0;
    try { coarse = window.matchMedia('(pointer: coarse)').matches ? 1 : 0; } catch (e) {}

    var hud = 1;
    if (typeof GameHud !== 'undefined' && GameHud.expanded) hud = GameHud.expanded() ? 1 : 0;

    var layout = (typeof GameKeys !== 'undefined' && GameKeys.layout === 'left') ? 1 : 0;

    // 언어. 규칙과 저장 키는 lib/i18n.js 와 같은 것을 쓴다 — 포털에서 한 번 바꾸면 게임도 따라온다.
    // i18n.js 를 이 템플릿에 싣지는 않는다: 그 파일이 붙이는 DOM 토글은 전환할 때 페이지를 다시
    // 읽어서, 유니티 게임에서는 빌드 전체를 다시 세우는 값이 든다. 게임 안 토글이 그 일을 대신하고
    // 같은 키에 쓴다. 값은 한 번만 읽는다 — 게임이 스스로 바꾼 뒤에는 게임 쪽 상태가 원본이다.
    if (Module.kgdLang === undefined) {
      var lg = '';
      if (typeof GameI18n !== 'undefined' && GameI18n.lang) lg = GameI18n.lang;
      else { try { lg = localStorage.getItem('game_lang') || ''; } catch (e) {} }
      if (lg !== 'ko' && lg !== 'en') lg = /^ko/i.test(navigator.language || '') ? 'ko' : 'en';
      Module.kgdLang = lg === 'en' ? 1 : 0;
    }

    // 우상단은 플랫폼 셸(portal-fe)의 닫기·전체화면 칩 자리다. 게임이 거기에 버튼을 두면
    // 셸 칩이 위에 떠서 **눌리지 않는다** — 궁수 키우기의 강화창 닫기가 그랬다.
    // 얼마나 비워야 하는지를 여기서 알려 준다. 레이아웃을 재는 일이라 크기가 바뀔 때만 다시 잰다.
    if (Module.kgdChromeW !== vw || Module.kgdChromeH !== vh) {
      Module.kgdChromeW = vw; Module.kgdChromeH = vh;
      var chips = 46;   // 칩 위 여백 6 + 칩 34 + 아래 여유 6
      var safe = 0;
      try {
        var probe = Module.kgdInsetProbe;
        if (!probe) {
          probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;top:0;left:0;width:0;pointer-events:none;' +
            'visibility:hidden;height:env(safe-area-inset-top,0px)';
          document.body.appendChild(probe);
          Module.kgdInsetProbe = probe;
        }
        safe = probe.offsetHeight || 0;
        if (typeof GameChrome !== 'undefined' && typeof GameChrome.top === 'number') {
          // 셸이 알려 주는 값에는 안전영역이 이미 더해져 있다 — 칩 몫만 도로 뺀다
          chips = Math.max(0, GameChrome.top - safe);
        }
      } catch (e) { /* 잴 수 없으면 기본값 */ }
      Module.kgdChromeTop = chips + safe;
      Module.kgdSafeTop = safe;
    }

    H[i] = ax; H[i + 1] = ay; H[i + 2] = am;
    H[i + 3] = padH; H[i + 4] = vw > vh ? 1 : 0; H[i + 5] = coarse;
    H[i + 6] = hud; H[i + 7] = mask; H[i + 8] = layout;
    H[i + 9] = Module.kgdChromeTop || 46;
    // 기기가 가리는 만큼만. 셸 칩은 **우상단 모서리**라 왼쪽·가운데 UI 는 이 값만 피하면 된다.
    H[i + 10] = Module.kgdSafeTop || 0;
    H[i + 11] = Module.kgdLang;
  },

  // 런 종료 — 점수는 정수, detail 은 문자열(객체를 넣으면 랭킹에 [object Object] 가 뜬다).
  KgdSubmitScore: function (score, detailPtr, boardPtr) {
    if (typeof PlatformAdapter === 'undefined' || !PlatformAdapter.runEnd) return;
    var board = UTF8ToString(boardPtr);
    PlatformAdapter.runEnd({
      score: score,
      detail: UTF8ToString(detailPtr),
      board: board ? board : null
    });
  },

  // 세이브는 반드시 localStorage 다 — PlayerPrefs 는 IndexedDB 라 platform.js 의
  // setItem 가로채기에 안 걸리고, 그러면 서버 동기화가 조용히 사라진다.
  KgdSaveSet: function (keyPtr, valPtr) {
    try { localStorage.setItem(UTF8ToString(keyPtr), UTF8ToString(valPtr)); } catch (e) {}
  },

  // 두 번 호출한다: 먼저 (key, 0, 0) 으로 필요한 바이트 수를 받고, 버퍼를 잡아 다시 부른다.
  // 문자열 포인터를 돌려주면 해제 책임이 갈려 새기 쉬우므로 쓰지 않는다.
  KgdSaveGet: function (keyPtr, bufPtr, bufLen) {
    var v = '';
    try { v = localStorage.getItem(UTF8ToString(keyPtr)) || ''; } catch (e) {}
    var need = lengthBytesUTF8(v) + 1;
    if (bufPtr && bufLen >= need) stringToUTF8(v, bufPtr, bufLen);
    return need;
  },

  // 게임 안에서 전체 화면 메뉴를 열었다는 신호. lib/touch.js 는 보이는 .panel 이 있으면
  // 가상패드를 치우는데, Unity 캔버스 안의 패널은 DOM 에 없어 그 규약이 닿지 않는다 —
  // 템플릿에 숨겨 둔 빈 .panel 을 대신 여닫아 같은 약속을 지킨다.
  KgdSetMenuOpen: function (open) {
    var el = document.getElementById('kgd-menu');
    if (!el) return;
    if (open) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  },

  // 첫 프레임이 실제로 그려졌다는 신호 — 템플릿의 로딩 오버레이가 이걸 보고 사라진다.
  KgdReady: function () {
    if (typeof window.kgdOnReady === 'function') window.kgdOnReady();
  }
});
