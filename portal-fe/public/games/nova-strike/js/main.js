// NOVA STRIKE — main: 부트, 정수 배율 스케일링, 고정스텝 루프
// 함정 방어: 120Hz 에서 고정스텝 0회 렌더 프레임에 입력 엣지를 비우지 않는다
// (Input.beginStep 은 고정스텝 안에서만 호출)
'use strict';
(function () {
  const gameCanvas = document.getElementById('game');
  const uiCanvas = document.getElementById('ui');
  const g = gameCanvas.getContext('2d');
  const ug = uiCanvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  let scale = 2, dpr = 1, uiScale = 2;

  function resize() {
    const availW = window.innerWidth - 16;
    const availH = window.innerHeight - 16;
    scale = Math.max(1, Math.floor(Math.min(availW / NS.VW, availH / NS.VH)));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    gameCanvas.style.width = NS.VW * scale + 'px';
    gameCanvas.style.height = NS.VH * scale + 'px';
    uiCanvas.width = Math.round(NS.VW * scale * dpr);
    uiCanvas.height = Math.round(NS.VH * scale * dpr);
    uiCanvas.style.width = NS.VW * scale + 'px';
    uiCanvas.style.height = NS.VH * scale + 'px';
    uiScale = scale * dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  NS.perf = { fps: 0, frames: 0, lastT: 0 };

  const STEP = 1000 / 60;
  let acc = 0, last = performance.now();

  function frame(now) {
    // FPS 측정 (1초 롤링)
    NS.perf.frames++;
    if (now - NS.perf.lastT >= 1000) {
      NS.perf.fps = NS.perf.frames;
      NS.perf.frames = 0;
      NS.perf.lastT = now;
    }
    const dt = Math.min(120, now - last);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      NS.Input.beginStep();
      NS.Game.step();
      acc -= STEP;
      steps++;
    }
    if (steps === 4) acc = 0; // 스파이럴 방지

    // 렌더
    g.fillStyle = '#05060f';
    g.fillRect(0, 0, NS.VW, NS.VH);
    NS.Game.drawWorld(g);
    NS.UI.drawPixel(g);
    NS.UI.drawOverlay(ug, uiScale);

    requestAnimationFrame(frame);
  }

  NS.Game.boot();
  requestAnimationFrame(frame);
})();
