// NOVA STRIKE — audio: WebAudio 자체 신스 (외부 오디오 파일 없음)
// 첫 사용자 입력 후 AudioContext 활성화 (자동재생 정책)
'use strict';
(function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let noiseBuf = null;
  let bgm = { id: null, timer: 0, step: 0, nextTime: 0, song: null };

  const NOTE_RE = /^([A-G])(#?)(-?\d)$/;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const nn = (name) => { // 'E2' → midi
    const m = NOTE_RE.exec(name);
    return 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1]] + (m[2] ? 1 : 0);
  };
  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.42; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(master);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { ctx = null; return false; }
  }

  // ── 신스 프리미티브 ─────────────────────────────────────
  function tone(t0, f0, f1, dur, type, vol, dest, slideCurve) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) {
      if (slideCurve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      else o.frequency.linearRampToValueAtTime(f1, t0 + dur);
    }
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, vol, dest, hp, lp) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    let node = s;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(dest);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  // ── SFX 카탈로그 ────────────────────────────────────────
  const SFX = {
    shot: (t) => { tone(t, 880, 240, 0.09, 'square', 0.22, sfxGain, 'exp'); noise(t, 0.04, 0.08, sfxGain, 2000); },
    shot2: (t) => { tone(t, 520, 180, 0.16, 'square', 0.3, sfxGain, 'exp'); tone(t, 1040, 360, 0.12, 'sawtooth', 0.14, sfxGain, 'exp'); },
    shot3: (t) => { tone(t, 300, 90, 0.3, 'sawtooth', 0.36, sfxGain, 'exp'); tone(t, 1200, 200, 0.22, 'square', 0.2, sfxGain, 'exp'); noise(t, 0.18, 0.16, sfxGain, 900); },
    chargeTick: (t, p) => { tone(t, 600 + 700 * (p || 0), 900 + 900 * (p || 0), 0.05, 'square', 0.06 + 0.05 * (p || 0), sfxGain); },
    chargeFull: (t) => { tone(t, 880, 1320, 0.12, 'square', 0.14, sfxGain); tone(t + 0.06, 1320, 1760, 0.1, 'square', 0.12, sfxGain); },
    dash: (t) => { noise(t, 0.16, 0.2, sfxGain, 500, 4500); tone(t, 300, 700, 0.12, 'sawtooth', 0.08, sfxGain); },
    jump: (t) => { tone(t, 300, 620, 0.11, 'square', 0.13, sfxGain); },
    land: (t) => { noise(t, 0.07, 0.14, sfxGain, 0, 900); tone(t, 160, 80, 0.07, 'triangle', 0.2, sfxGain, 'exp'); },
    wall: (t) => { noise(t, 0.05, 0.09, sfxGain, 1200); },
    hit: (t) => { tone(t, 480, 160, 0.07, 'square', 0.2, sfxGain, 'exp'); noise(t, 0.05, 0.12, sfxGain, 1500); },
    clink: (t) => { tone(t, 1900, 1500, 0.06, 'square', 0.12, sfxGain); tone(t, 2800, 2400, 0.04, 'square', 0.07, sfxGain); },
    hurt: (t) => { tone(t, 400, 120, 0.24, 'sawtooth', 0.3, sfxGain, 'exp'); noise(t, 0.16, 0.2, sfxGain, 800); },
    explode: (t) => { noise(t, 0.42, 0.4, sfxGain, 0, 1800); tone(t, 220, 40, 0.4, 'sawtooth', 0.3, sfxGain, 'exp'); },
    bigExplode: (t) => {
      noise(t, 0.9, 0.5, sfxGain, 0, 1400); tone(t, 160, 30, 0.8, 'sawtooth', 0.4, sfxGain, 'exp');
      noise(t + 0.18, 0.6, 0.3, sfxGain, 0, 900); tone(t + 0.15, 120, 24, 0.7, 'square', 0.26, sfxGain, 'exp');
    },
    pickup: (t) => { tone(t, 880, 880, 0.06, 'square', 0.16, sfxGain); tone(t + 0.07, 1320, 1320, 0.1, 'square', 0.16, sfxGain); },
    chip: (t) => { tone(t, 1560, 2100, 0.05, 'square', 0.1, sfxGain); },
    heal: (t) => { for (let i = 0; i < 4; i++) tone(t + i * 0.05, 660 + i * 160, 660 + i * 160, 0.05, 'square', 0.12, sfxGain); },
    menuMove: (t) => { tone(t, 700, 900, 0.05, 'square', 0.1, sfxGain); },
    menuSel: (t) => { tone(t, 880, 880, 0.06, 'square', 0.14, sfxGain); tone(t + 0.06, 1760, 1760, 0.09, 'square', 0.12, sfxGain); },
    menuBack: (t) => { tone(t, 660, 440, 0.09, 'square', 0.1, sfxGain); },
    warning: (t) => { for (let i = 0; i < 3; i++) { tone(t + i * 0.24, 620, 620, 0.14, 'square', 0.2, sfxGain); tone(t + i * 0.24, 311, 311, 0.14, 'square', 0.16, sfxGain); } },
    doorOpen: (t) => { noise(t, 0.5, 0.16, sfxGain, 200, 1200); tone(t, 90, 180, 0.5, 'triangle', 0.2, sfxGain); },
    checkpoint: (t) => { tone(t, 660, 660, 0.08, 'square', 0.12, sfxGain); tone(t + 0.09, 990, 990, 0.14, 'square', 0.12, sfxGain); },
    freeze: (t) => { for (let i = 0; i < 5; i++) tone(t + i * 0.03, 2400 - i * 300, 2400 - i * 300, 0.04, 'square', 0.07, sfxGain); },
    thunder: (t) => { noise(t, 0.7, 0.4, sfxGain, 0, 2400); tone(t, 90, 40, 0.5, 'sawtooth', 0.24, sfxGain, 'exp'); },
    telegraph: (t) => { tone(t, 520, 520, 0.1, 'square', 0.12, sfxGain); tone(t, 260, 260, 0.1, 'square', 0.1, sfxGain); },
    bossHit: (t) => { tone(t, 320, 110, 0.09, 'square', 0.22, sfxGain, 'exp'); noise(t, 0.07, 0.14, sfxGain, 1000); },
    phase: (t) => { tone(t, 200, 800, 0.5, 'sawtooth', 0.2, sfxGain); noise(t, 0.4, 0.2, sfxGain, 400); },
    weaponGet: (t) => { const seq = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5']; seq.forEach((s, i) => tone(t + i * 0.09, freq(nn(s)), freq(nn(s)), 0.12, 'square', 0.14, sfxGain)); },
    oneUp: (t) => { ['E5', 'G5', 'C6'].forEach((s, i) => tone(t + i * 0.08, freq(nn(s)), freq(nn(s)), 0.1, 'square', 0.12, sfxGain)); },
    teleport: (t) => { tone(t, 1800, 200, 0.3, 'sawtooth', 0.14, sfxGain, 'exp'); },
    teleportIn: (t) => { tone(t, 200, 1800, 0.3, 'sawtooth', 0.14, sfxGain, 'exp'); },
  };

  // ── BGM 시퀀서 ─────────────────────────────────────────
  // 패턴: 16스텝 바의 배열. 각 스텝은 midi 번호 or 0(쉼) or [midi, lenSteps]
  const B = (arr, times) => { const out = []; for (let i = 0; i < times; i++) out.push(...arr); return out; };
  const N = nn;

  function makeSongs() {
    const songs = {};
    // 타이틀 — 결의의 Am (BPM 116)
    songs.title = {
      bpm: 116, swing: 0,
      bass: B([N('A1'), 0, N('A2'), 0, N('A1'), 0, N('A2'), 0, N('F1'), 0, N('F2'), 0, N('G1'), 0, N('G2'), 0], 2),
      lead: [
        [N('A3'), 4], 0, 0, 0, [N('C4'), 2], 0, [N('E4'), 4], 0, 0, 0, [N('D4'), 2], 0, [N('C4'), 2], 0, [N('B3'), 2], 0,
        [N('A3'), 4], 0, 0, 0, [N('E4'), 2], 0, [N('G4'), 6], 0, 0, 0, 0, 0, [N('E4'), 4], 0, 0, 0,
      ],
      arp: B([N('A4'), N('C5'), N('E5'), N('C5')], 4).concat(B([N('F4'), N('A4'), N('C5'), N('A4')], 2), B([N('G4'), N('B4'), N('D5'), N('B4')], 2)),
      drums: B(['K', 0, 'H', 0, 'S', 0, 'H', 0, 'K', 0, 'H', 'K', 'S', 0, 'H', 0], 2),
    };
    // 마그마 제련구역 — 드라이빙 E 프리지안 (BPM 152)
    songs.magma = {
      bpm: 152, swing: 0,
      bass: B([N('E2'), N('E2'), 0, N('E2'), 0, N('E2'), N('F2'), 0, N('E2'), N('E2'), 0, N('E2'), N('G2'), 0, N('F2'), 0], 2),
      lead: [
        [N('E4'), 2], 0, [N('G4'), 2], 0, [N('F4'), 2], 0, [N('E4'), 2], 0, [N('D4'), 2], 0, [N('E4'), 4], 0, 0, 0, 0, 0,
        [N('E4'), 2], 0, [N('G4'), 2], 0, [N('A4'), 2], 0, [N('B4'), 4], 0, 0, 0, [N('A4'), 2], 0, [N('G4'), 2], 0,
      ],
      arp: B([N('E5'), 0, N('B4'), 0], 8),
      drums: B(['K', 0, 'K', 0, 'S', 0, 0, 'K', 0, 'K', 'K', 0, 'S', 0, 'H', 'H'], 2),
    };
    // 빙결 연구동 — 서늘한 Dm 아르페지오 (BPM 128)
    songs.cryo = {
      bpm: 128, swing: 0,
      bass: B([N('D2'), 0, 0, N('D2'), 0, 0, N('D2'), 0, N('A1'), 0, 0, N('A1'), 0, 0, N('C2'), 0], 2),
      lead: [
        [N('D5'), 3], 0, 0, [N('A4'), 3], 0, 0, [N('F4'), 3], 0, 0, [N('A4'), 2], 0, [N('C5'), 4], 0, 0, 0, 0,
        [N('D5'), 3], 0, 0, [N('E5'), 3], 0, 0, [N('F5'), 4], 0, 0, 0, [N('E5'), 2], 0, [N('C5'), 2], 0, 0,
      ],
      arp: B([N('D4'), N('F4'), N('A4'), N('F4'), N('D4'), N('F4'), N('A4'), N('C5')], 4),
      drums: B(['K', 0, 'H', 'H', 'S', 0, 'H', 0, 'K', 0, 'H', 'H', 'S', 0, 'H', 'S'], 2),
    };
    // 폭풍 공중정원 — 질주하는 Am 싱코페이션 (BPM 142)
    songs.storm = {
      bpm: 142, swing: 0,
      bass: B([N('A1'), 0, N('A2'), N('A1'), 0, N('A2'), N('A1'), 0, N('G1'), 0, N('G2'), N('G1'), 0, N('G2'), N('G1'), 0], 2),
      lead: [
        [N('E5'), 2], 0, [N('C5'), 1], [N('D5'), 2], 0, [N('E5'), 3], 0, 0, [N('G5'), 4], 0, 0, 0, [N('E5'), 2], 0, [N('D5'), 2], 0,
        [N('C5'), 2], 0, [N('A4'), 1], [N('B4'), 2], 0, [N('C5'), 3], 0, 0, [N('D5'), 4], 0, 0, 0, [N('B4'), 4], 0, 0, 0,
      ],
      arp: B([N('A4'), N('E5'), N('C5'), N('E5')], 8),
      drums: B(['K', 0, 'H', 'K', 'S', 0, 'K', 'H', 0, 'K', 'H', 0, 'S', 0, 'H', 'H'], 2),
    };
    // 코어 스파이어 — 불길한 Cm (BPM 138)
    songs.core = {
      bpm: 138, swing: 0,
      bass: B([N('C2'), 0, N('C2'), 0, N('G1'), 0, N('C2'), 0, N('A1'), 0, N('A1'), 0, N('B1'), 0, N('B1'), 0], 2),
      lead: [
        [N('C4'), 4], 0, 0, 0, [N('D4'), 2], 0, [N('E4'), 4], 0, 0, 0, 0, 0, [N('D4'), 2], 0, [N('C4'), 2], 0,
        [N('G4'), 6], 0, 0, 0, 0, 0, [N('F4'), 2], 0, [N('E4'), 2], 0, [N('D4'), 4], 0, 0, 0, 0, 0,
      ],
      arp: B([N('C5'), N('G4'), N('E5'), N('G4')], 4).concat(B([N('B4'), N('G4'), N('D5'), N('G4')], 4)),
      drums: B(['K', 0, 0, 'K', 'S', 0, 'H', 0, 'K', 0, 'K', 0, 'S', 0, 'H', 'S'], 2),
    };
    // 보스전 — 몰아치는 (BPM 164)
    songs.boss = {
      bpm: 164, swing: 0,
      bass: B([N('D2'), N('D2'), N('D2'), 0, N('D2'), 0, N('F2'), 0, N('D2'), N('D2'), N('C2'), 0, N('D2'), 0, N('G2'), N('F2')], 2),
      lead: [
        [N('D5'), 1], [N('F5'), 1], [N('D5'), 1], [N('F5'), 1], [N('G5'), 2], 0, [N('F5'), 2], 0, [N('D5'), 2], 0, [N('C5'), 2], 0, [N('D5'), 4], 0, 0, 0,
        [N('A4'), 1], [N('C5'), 1], [N('A4'), 1], [N('C5'), 1], [N('D5'), 2], 0, [N('C5'), 2], 0, [N('A4'), 2], 0, [N('G4'), 2], 0, [N('A4'), 4], 0, 0, 0,
      ],
      arp: B([N('D5'), N('A4'), N('F5'), N('A4')], 8),
      drums: B(['K', 'K', 'H', 0, 'S', 0, 'K', 'K', 0, 'K', 'H', 'K', 'S', 0, 'S', 'S'], 2),
    };
    // 최종 보스 — (BPM 172)
    songs.finalBoss = {
      bpm: 172, swing: 0,
      bass: B([N('C2'), N('C2'), 0, N('C2'), N('C2'), 0, N('C2'), N('D2'), N('E2'), N('E2'), 0, N('E2'), N('D2'), 0, N('B1'), 0], 2),
      lead: [
        [N('C5'), 2], 0, [N('B4'), 2], 0, [N('C5'), 2], 0, [N('E5'), 4], 0, 0, 0, [N('D5'), 2], 0, [N('C5'), 2], 0, [N('B4'), 2], 0,
        [N('C5'), 2], 0, [N('E5'), 2], 0, [N('G5'), 4], 0, 0, 0, [N('F5'), 2], 0, [N('E5'), 2], 0, [N('D5'), 4], 0,
      ],
      arp: B([N('C5'), N('G4'), N('E5'), N('B4')], 8),
      drums: B(['K', 'K', 'S', 'K', 'K', 'S', 'K', 'K', 'S', 'K', 'K', 'S', 'K', 'S', 'S', 'S'], 2),
    };
    return songs;
  }
  let SONGS = null;

  function scheduleStep(song, stepIdx, t) {
    const stepDur = 60 / song.bpm / 4;
    const idx = stepIdx % song.bass.length;
    const get = (track) => track[idx % track.length];
    const b = get(song.bass);
    if (b) tone(t, freq(Array.isArray(b) ? b[0] : b), 0, stepDur * 0.9, 'triangle', 0.34, musicGain);
    const l = get(song.lead);
    if (l) {
      const [note, len] = Array.isArray(l) ? l : [l, 1];
      tone(t, freq(note), 0, stepDur * len * 0.92, 'square', 0.16, musicGain);
      tone(t + 0.012, freq(note) * 1.005, 0, stepDur * len * 0.9, 'square', 0.07, musicGain);
    }
    const a = get(song.arp);
    if (a) tone(t, freq(Array.isArray(a) ? a[0] : a) * 2, 0, stepDur * 0.5, 'square', 0.045, musicGain);
    const d = get(song.drums);
    if (d === 'K') { tone(t, 130, 40, 0.1, 'sine', 0.5, musicGain, 'exp'); }
    else if (d === 'S') { noise(t, 0.09, 0.22, musicGain, 900); tone(t, 220, 140, 0.06, 'triangle', 0.16, musicGain); }
    else if (d === 'H') { noise(t, 0.03, 0.1, musicGain, 6000); }
  }

  NS.Audio = {
    ready: false,
    muted: false,
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!SONGS) SONGS = makeSongs();
      this.ready = true;
    },
    sfx(name, p) {
      if (!this.ready || this.muted || !SFX[name]) return;
      SFX[name](ctx.currentTime, p);
    },
    playBgm(id) {
      if (!this.ready) { bgm.id = id; return; }
      if (bgm.id === id && bgm.timer) return;
      this.stopBgm();
      bgm.id = id;
      const song = SONGS[id];
      if (!song) return;
      bgm.song = song;
      bgm.step = 0;
      bgm.nextTime = ctx.currentTime + 0.08;
      bgm.timer = setInterval(() => {
        if (this.muted) return;
        const stepDur = 60 / song.bpm / 4;
        while (bgm.nextTime < ctx.currentTime + 0.14) {
          scheduleStep(song, bgm.step, bgm.nextTime);
          bgm.step++;
          bgm.nextTime += stepDur;
        }
      }, 40);
    },
    stopBgm() {
      if (bgm.timer) { clearInterval(bgm.timer); bgm.timer = 0; }
      bgm.id = null; bgm.song = null;
    },
    currentBgm() { return bgm.id; },
    jingle(kind) { // victory / gameover — BGM 정지 후 원샷
      this.stopBgm();
      if (!this.ready || this.muted) return;
      const t = ctx.currentTime + 0.05;
      if (kind === 'victory') {
        const seq = [['C4', 0], ['E4', 1], ['G4', 2], ['C5', 3], ['G4', 4.5], ['C5', 5.5]];
        seq.forEach(([s, st]) => tone(t + st * 0.13, freq(nn(s)), 0, 0.24, 'square', 0.18, sfxGain));
        tone(t + 0.9, freq(nn('E5')), 0, 0.55, 'square', 0.16, sfxGain);
      } else if (kind === 'gameover') {
        const seq = [['E4', 0], ['C4', 1.2], ['A3', 2.4], ['E3', 3.6]];
        seq.forEach(([s, st]) => tone(t + st * 0.16, freq(nn(s)), 0, 0.4, 'triangle', 0.22, sfxGain));
      }
    },
  };
})();
