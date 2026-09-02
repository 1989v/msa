// 게임 릴레이(/ws/games/{slug}) WebSocket 통로. 여기에는 로직을 넣지 않는다 —
// 프로토콜은 서버(GameRelayRegistry)와 C#(게임)이 알고, 이 파일은 브라우저 소켓을
// C# 에서 열고/보내고/받게만 한다. 수신은 큐에 쌓아 프레임마다 C# 이 꺼내 간다.
mergeInto(LibraryManager.library, {

  KgdRelayOpen: function (slugPtr) {
    var slug = UTF8ToString(slugPtr);
    try {
      if (Module.kgdWs) { try { Module.kgdWs.close(); } catch (e) {} }
      Module.kgdWsQueue = [];
      Module.kgdWsState = 0; // 0 연결 중 · 1 열림 · 2 닫힘
      var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      var ws = new WebSocket(proto + location.host + '/ws/games/' + slug);
      Module.kgdWs = ws;
      ws.onopen = function () { Module.kgdWsState = 1; };
      ws.onclose = function () { Module.kgdWsState = 2; };
      ws.onerror = function () { Module.kgdWsState = 2; };
      ws.onmessage = function (ev) {
        // 큐 상한 — 탭이 백그라운드로 가서 프레임이 멎어도 무한히 쌓이지 않게.
        // 가장 오래된 것을 버린다: 스냅샷은 최신만 뜻이 있다.
        var q = Module.kgdWsQueue;
        if (typeof ev.data === 'string') {
          if (q.length >= 256) q.shift();
          q.push(ev.data);
        }
      };
    } catch (e) { Module.kgdWsState = 2; }
  },

  KgdRelayState: function () {
    return Module.kgdWsState === undefined ? 2 : Module.kgdWsState;
  },

  KgdRelaySend: function (msgPtr) {
    try {
      if (Module.kgdWs && Module.kgdWsState === 1) Module.kgdWs.send(UTF8ToString(msgPtr));
    } catch (e) {}
  },

  // 큐 맨 앞 메시지를 꺼낸다. 버퍼가 모자라면 필요한 크기를 돌려주고 꺼내지 않는다
  // (KgdSaveGet 과 같은 2회 호출 규약). 큐가 비면 0.
  KgdRelayNext: function (bufPtr, bufLen) {
    var q = Module.kgdWsQueue;
    if (!q || q.length === 0) return 0;
    var s = q[0];
    var need = lengthBytesUTF8(s) + 1;
    if (!bufPtr || bufLen < need) return need;
    q.shift();
    stringToUTF8(s, bufPtr, bufLen);
    return need;
  },

  KgdRelayClose: function () {
    try { if (Module.kgdWs) Module.kgdWs.close(); } catch (e) {}
    Module.kgdWsState = 2;
  }
});
