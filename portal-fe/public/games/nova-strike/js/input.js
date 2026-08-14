// NOVA STRIKE — input: 양손 배치(방향키+ZXC / WASD+JKL), 엣지 보존
// 함정 방어: 120Hz 디스플레이에서 고정스텝 0회 도는 렌더 프레임에 엣지를 비우지 않는다.
// keydown 은 pending 에 쌓고, 고정스텝 시작 시에만 justPressed 로 옮긴다.
'use strict';
(function () {
  const MAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyZ: 'jump', KeyK: 'jump',
    KeyX: 'shoot', KeyJ: 'shoot',
    KeyC: 'dash', KeyL: 'dash',
    KeyQ: 'wprev', KeyU: 'wprev',
    KeyE: 'wnext', KeyO: 'wnext',
    Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4',
    Enter: 'start', Escape: 'back', Space: 'jump',
  };

  const held = Object.create(null);       // 액션 → 누르고 있는 물리키 수
  const pending = new Set();              // 다음 고정스텝에 전달할 신규 press
  const pendingRelease = new Set();
  let just = new Set();                   // 이번 고정스텝의 justPressed
  let justRel = new Set();
  let anyKeyCallback = null;              // 오디오 활성화 등 1회성 훅

  window.addEventListener('keydown', (e) => {
    const act = MAP[e.code];
    if (act) e.preventDefault();
    if (anyKeyCallback) { const cb = anyKeyCallback; anyKeyCallback = null; cb(); }
    if (!act || e.repeat) return;
    held[act] = (held[act] || 0) + 1;
    pending.add(act);
  });
  window.addEventListener('keyup', (e) => {
    const act = MAP[e.code];
    if (!act) return;
    held[act] = Math.max(0, (held[act] || 0) - 1);
    pendingRelease.add(act);
  });
  window.addEventListener('blur', () => {
    for (const k in held) held[k] = 0;
  });

  NS.Input = {
    // 고정스텝 시작 시 1회 호출 — pending 을 이번 스텝의 justPressed 로 소비
    beginStep() {
      just = new Set(pending); pending.clear();
      justRel = new Set(pendingRelease); pendingRelease.clear();
    },
    down: (act) => (held[act] || 0) > 0,
    pressed: (act) => just.has(act),
    released: (act) => justRel.has(act),
    axisX() { return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0); },
    onFirstKey(cb) { anyKeyCallback = cb; },
  };
})();
