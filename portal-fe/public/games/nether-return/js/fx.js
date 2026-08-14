/**
 * 황천 회귀 — 표현 계층: 파티클 · 흔들림 · 히트스톱 · 데미지 숫자 · 광원 · 사운드.
 *
 * 파티클/광원은 월드 캔버스(640×360)에, 데미지 숫자·자막은 메인 캔버스(1280×720)에 그린다 —
 * 숫자를 월드 해상도로 그리면 2배 확대에서 뭉개진다.
 * 사운드는 WebAudio 신스 — 외부 파일 0. 첫 입력 제스처에서 컨텍스트를 연다(자동재생 정책).
 */
(function () {
  'use strict';

  /* ── 파티클 (월드 좌표) ── */
  var parts = [];
  function burst(x, y, color, n, spd, life, grav) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, s = (0.3 + Math.random() * 0.7) * spd;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.2,
        life: (0.4 + Math.random() * 0.6) * (life || 0.5), max: life || 0.5,
        c: color, sz: 1 + Math.random() * 2, g: grav == null ? 220 : grav });
    }
  }
  /** 위로 떠오르는 잿불 — 계층 분위기용 상시 파티클 */
  function ember(x, y, color) {
    parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 14,
      life: 2 + Math.random() * 2, max: 4, c: color, sz: 1, g: -4, glow: true });
  }

  /* ── 데미지 숫자 / 자막 — 아레나 좌표로 받고, 그릴 때 카메라·배율로 변환 ── */
  var floats = [];
  var view = { x: 0, y: 0, s: 2 };
  function setView(camX, camY, scale) { view.x = camX; view.y = camY; view.s = scale; }
  function num(x, y, text, color, big) {
    floats.push({ x: x + (Math.random() - 0.5) * 7, y: y - 4, t: String(text),
      c: color || '#fff', life: 0.7, max: 0.7, vy: -24, big: big });
  }

  /* ── 흔들림 / 히트스톱 / 플래시 ── */
  var shakeAmt = 0, stopT = 0, flashA = 0, flashC = '#fff';
  function shake(n) { shakeAmt = Math.min(9, shakeAmt + n); }
  function hitstop(t) { stopT = Math.max(stopT, t); }
  function flash(c, a) { flashC = c; flashA = Math.max(flashA, a); }

  function update(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (var j = floats.length - 1; j >= 0; j--) {
      var f = floats[j];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(j, 1); continue; }
      f.y += f.vy * dt; f.vy *= 0.92;
    }
    shakeAmt = Math.max(0, shakeAmt - dt * 26);
    flashA = Math.max(0, flashA - dt * 3.2);
  }

  /** 히트스톱 소비 — 남은 시간이 있으면 게임 업데이트를 건너뛴다 */
  function consumeStop(dt) {
    if (stopT <= 0) return false;
    stopT -= dt;
    return true;
  }

  function drawWorld(g) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], a = Math.max(0, p.life / p.max);
      g.globalAlpha = a * (p.glow ? 0.8 : 1);
      g.fillStyle = p.c;
      g.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
    }
    g.globalAlpha = 1;
  }

  function drawUI(g) {
    g.textAlign = 'center';
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i];
      var sx = (f.x - view.x) * view.s, sy = (f.y - view.y) * view.s;
      g.globalAlpha = Math.min(1, f.life / f.max * 1.6);
      g.font = (f.big ? 'bold 30px' : 'bold 19px') + ' neodgm, monospace';
      g.fillStyle = '#0008';
      g.fillText(f.t, sx + 2, sy + 2);
      g.fillStyle = f.c;
      g.fillText(f.t, sx, sy);
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }

  /* ── 광원 — 어둠 레이어에 destination-out 으로 구멍을 낸다 ── */
  var darkCv = null, darkG = null;
  function drawLights(worldG, w, h, mood, lights) {
    if (!darkCv) {
      darkCv = document.createElement('canvas'); darkCv.width = w; darkCv.height = h;
      darkG = darkCv.getContext('2d');
    }
    darkG.clearRect(0, 0, w, h);
    darkG.fillStyle = mood;
    darkG.fillRect(0, 0, w, h);
    darkG.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < lights.length; i++) {
      var L = lights[i];
      var grd = darkG.createRadialGradient(L.x, L.y, 4, L.x, L.y, L.r);
      grd.addColorStop(0, 'rgba(0,0,0,' + (L.a || 0.9) + ')');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      darkG.fillStyle = grd;
      darkG.beginPath(); darkG.arc(L.x, L.y, L.r, 0, 7); darkG.fill();
    }
    darkG.globalCompositeOperation = 'source-over';
    worldG.drawImage(darkCv, 0, 0);
    // 광원 자체의 색 번짐 (은은하게)
    worldG.save();
    worldG.globalCompositeOperation = 'lighter';
    for (var j = 0; j < lights.length; j++) {
      var l = lights[j];
      if (!l.c) continue;
      var gg = worldG.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r * 0.7);
      gg.addColorStop(0, l.c);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      worldG.globalAlpha = 0.14;
      worldG.fillStyle = gg;
      worldG.beginPath(); worldG.arc(l.x, l.y, l.r, 0, 7); worldG.fill();
    }
    worldG.restore();
  }

  /* ── 사운드 — 초소형 신스 ── */
  var AC = null, master = null, muted = localStorage.getItem('nr_mute') === '1';
  function audio() {
    if (AC) return AC;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.22;
      master.connect(AC.destination);
    } catch (_) { /* 오디오 미지원 — 무음 진행 */ }
    return AC;
  }
  function tone(type, f0, f1, dur, vol, delay) {
    if (!AC || muted) return;
    var t = AC.currentTime + (delay || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!AC || muted) return;
    var n = AC.sampleRate * dur, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = AC.createBufferSource(); s.buffer = buf;
    var g = AC.createGain(); g.gain.value = vol;
    var f = AC.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 900;
    s.connect(f); f.connect(g); g.connect(master);
    s.start();
  }
  var SFX = {
    swing:  function () { noise(0.08, 0.5, 2400); tone('sawtooth', 500, 180, 0.07, 0.12); },
    hit:    function () { tone('square', 210, 60, 0.08, 0.3); noise(0.05, 0.4, 1800); },
    crit:   function () { tone('square', 320, 60, 0.12, 0.34); noise(0.09, 0.5, 1400); },
    hurt:   function () { tone('square', 130, 40, 0.22, 0.4); noise(0.15, 0.35); },
    dash:   function () { noise(0.1, 0.42, 3000); tone('sine', 700, 220, 0.09, 0.1); },
    coin:   function () { tone('triangle', 900, 900, 0.05, 0.18); tone('triangle', 1350, 1350, 0.07, 0.16, 0.05); },
    boon:   function () { tone('sine', 420, 420, 0.1, 0.2); tone('sine', 560, 560, 0.1, 0.2, 0.09); tone('sine', 840, 840, 0.16, 0.22, 0.18); },
    door:   function () { tone('square', 90, 45, 0.3, 0.3); noise(0.2, 0.25); },
    clear:  function () { tone('sine', 520, 520, 0.09, 0.2); tone('sine', 780, 780, 0.12, 0.2, 0.08); },
    death:  function () { tone('sawtooth', 300, 40, 0.9, 0.3); noise(0.6, 0.3); },
    boss:   function () { tone('sawtooth', 70, 34, 1.0, 0.4); noise(0.8, 0.35); },
    cast:   function () { tone('sine', 880, 240, 0.16, 0.2); },
    heal:   function () { tone('sine', 440, 660, 0.2, 0.2); tone('sine', 660, 990, 0.2, 0.18, 0.1); },
    tele:   function () { tone('square', 60, 60, 0.09, 0.14); },
    execute:function () { tone('sawtooth', 800, 60, 0.3, 0.36); noise(0.25, 0.45, 600); },
  };
  function sfx(name) { if (SFX[name]) SFX[name](); }
  function setMute(m) {
    muted = m;
    localStorage.setItem('nr_mute', m ? '1' : '0');
    if (drone) drone.gain.gain.value = m ? 0 : 0.05;
  }

  /* ── 배경 드론 — 계층마다 근음이 내려간다 (음악 대체, 아주 은은하게) ── */
  var drone = null;
  function music(tier) {
    if (!AC || drone && drone.tier === tier) return;
    if (drone) { try { drone.o1.stop(); drone.o2.stop(); } catch (_) {} }
    var base = [55, 49, 41.2][tier] || 55;               // A1 → G1 → E1
    var o1 = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.value = base; o2.frequency.value = base * 1.5 + 0.7;   // 살짝 어긋난 5도 — 불안감
    g.gain.value = muted ? 0 : 0.05;
    o1.connect(g); o2.connect(g); g.connect(master);
    o1.start(); o2.start();
    drone = { o1: o1, o2: o2, gain: g, tier: tier };
  }
  function musicStop() {
    if (drone) { try { drone.o1.stop(); drone.o2.stop(); } catch (_) {} drone = null; }
  }

  window.FX = {
    burst: burst, ember: ember, num: num, setView: setView,
    shake: shake, hitstop: hitstop, flash: flash,
    update: update, consumeStop: consumeStop, drawWorld: drawWorld, drawUI: drawUI,
    drawLights: drawLights,
    audio: audio, sfx: sfx, music: music, musicStop: musicStop,
    setMute: setMute, isMuted: function () { return muted; },
    shakeAmt: function () { return shakeAmt; },
    flashState: function () { return { a: flashA, c: flashC }; },
    reset: function () { parts.length = 0; floats.length = 0; shakeAmt = 0; stopT = 0; flashA = 0; },
  };
})();
