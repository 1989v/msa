// WebAudio 자체 신스: 효과음 + 스텝 시퀀서 BGM. 외부 오디오 파일 없음.

let ac = null, master = null, sfxBus = null, musBus = null, comp = null;
let muted = false;
let noiseBuf = null;

export function initAudio() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.18;
  master = ac.createGain(); master.gain.value = 0.85;
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9;
  musBus = ac.createGain(); musBus.gain.value = 0.42;
  sfxBus.connect(comp); musBus.connect(comp); comp.connect(master); master.connect(ac.destination);

  const len = ac.sampleRate * 1.2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ac;
}
export function resumeAudio() { if (ac && ac.state === 'suspended') ac.resume(); }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ac.currentTime, 0.02);
  return muted;
}
export const isMuted = () => muted;

const now = () => ac.currentTime;

function tone(freq, dur, type = 'square', gain = 0.3, freqEnd = null, bus = null, detune = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  const t = now();
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, f0, f1, gain = 0.3, q = 1, type = 'bandpass') {
  if (!ac) return;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const bp = ac.createBiquadFilter(); bp.type = type; bp.Q.value = q;
  const g = ac.createGain();
  const t = now();
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp); bp.connect(g); g.connect(sfxBus);
  s.start(t); s.stop(t + dur + 0.02);
}

const SFX = {
  punch: () => { noise(0.07, 1600, 500, 0.32, 1.2); tone(220, 0.06, 'square', 0.12, 90); },
  punch2: () => { noise(0.08, 1900, 450, 0.34, 1.2); tone(260, 0.07, 'square', 0.13, 90); },
  kick: () => { noise(0.11, 900, 260, 0.36, 1.6); tone(150, 0.1, 'triangle', 0.2, 60); },
  heavy: () => { noise(0.16, 700, 140, 0.44, 1.4); tone(110, 0.16, 'square', 0.24, 44); },
  metal: () => { tone(1750, 0.12, 'square', 0.16, 900); tone(2380, 0.1, 'square', 0.1, 1400); noise(0.1, 3200, 900, 0.2, 3); },
  blade: () => { noise(0.1, 5200, 1400, 0.22, 4); tone(2400, 0.08, 'sawtooth', 0.08, 3600); },
  blade2: () => { noise(0.22, 6000, 700, 0.3, 5); tone(1600, 0.2, 'sawtooth', 0.12, 260); },
  throw: () => { noise(0.2, 500, 120, 0.4, 1.2); tone(90, 0.22, 'square', 0.24, 40); },
  whoosh: () => noise(0.16, 1400, 320, 0.2, 2),
  charge: () => { tone(300, 0.26, 'sine', 0.16, 900); tone(452, 0.26, 'sine', 0.09, 1350); },
  rise: () => { tone(200, 0.3, 'sawtooth', 0.2, 1200); noise(0.24, 800, 2600, 0.16, 2); },
  spin: () => { noise(0.3, 900, 2200, 0.18, 3); tone(420, 0.28, 'square', 0.1, 900); },
  palm: () => { tone(140, 0.34, 'sawtooth', 0.3, 40); noise(0.3, 1800, 200, 0.4, 1.1); },
  burst: () => { tone(180, 0.4, 'sawtooth', 0.3, 50); noise(0.4, 2600, 160, 0.42, 0.9); },
  fire: () => { noise(0.42, 900, 200, 0.34, 0.9, 'lowpass'); tone(120, 0.3, 'sawtooth', 0.14, 60); },
  ice: () => { tone(1800, 0.24, 'triangle', 0.14, 3200); noise(0.2, 4200, 1800, 0.14, 6); },
  quake: () => { tone(70, 0.5, 'sine', 0.42, 28); noise(0.44, 400, 80, 0.34, 0.8, 'lowpass'); },
  superflash: () => {
    tone(300, 0.5, 'sawtooth', 0.22, 1500); tone(452, 0.5, 'sawtooth', 0.14, 2200);
    noise(0.5, 600, 4000, 0.2, 1.4);
  },
  superflash2: () => {
    tone(160, 0.9, 'sawtooth', 0.28, 1800); tone(240, 0.9, 'square', 0.16, 2600);
    noise(0.85, 300, 5200, 0.24, 1.1);
  },
  block: () => { noise(0.09, 2600, 1100, 0.24, 3); tone(520, 0.07, 'square', 0.1, 380); },
  hit: () => { noise(0.09, 1100, 300, 0.28, 1.4); tone(180, 0.08, 'triangle', 0.14, 70); },
  hitHeavy: () => { noise(0.18, 800, 160, 0.38, 1.2); tone(120, 0.2, 'triangle', 0.2, 46); },
  land: () => { noise(0.12, 400, 110, 0.22, 1, 'lowpass'); },
  jump: () => tone(320, 0.13, 'square', 0.13, 720),
  step: () => noise(0.05, 700, 240, 0.09, 1.4),
  pickup: () => { tone(880, 0.08, 'square', 0.16); setTimeout(() => tone(1320, 0.12, 'square', 0.16), 70); },
  coin: () => { tone(1180, 0.06, 'square', 0.14); setTimeout(() => tone(1560, 0.1, 'square', 0.12), 60); },
  break: () => { noise(0.24, 2600, 320, 0.34, 1.1); tone(160, 0.16, 'square', 0.14, 60); },
  unlock: () => {
    [0, 4, 7, 12].forEach((n, i) => setTimeout(() => tone(440 * Math.pow(2, n / 12), 0.3, 'triangle', 0.2), i * 90));
  },
  go: () => { tone(660, 0.1, 'square', 0.2); setTimeout(() => tone(990, 0.18, 'square', 0.2), 100); },
  ko: () => {
    tone(160, 0.9, 'sawtooth', 0.3, 40); noise(0.7, 1400, 120, 0.3, 1);
    setTimeout(() => { tone(110, 1.2, 'square', 0.22, 30); }, 180);
  },
  menu: () => tone(620, 0.05, 'square', 0.12),
  select: () => { tone(740, 0.06, 'square', 0.16); setTimeout(() => tone(1100, 0.12, 'square', 0.14), 55); },
  dead: () => { tone(220, 0.8, 'sawtooth', 0.22, 60); },
  boss: () => { tone(90, 1.1, 'sawtooth', 0.3, 45); noise(1.0, 800, 100, 0.22, 0.9); },
};

export function sfx(name) {
  if (!ac || muted) return;
  const f = SFX[name];
  if (f) { try { f(); } catch (e) { /* 오디오 실패는 게임을 막지 않는다 */ } }
}

// ───────── BGM ─────────
// 음이름: 반음 인덱스. 0 = A2(110Hz) 기준.
const hz = (n) => 110 * Math.pow(2, n / 12);

const TRACKS = {
  title: {
    bpm: 104, bars: 4,
    bass: [0, -1, 0, -1, 7, -1, 5, -1, 3, -1, 3, -1, 5, -1, 7, -1],
    lead: [24, -1, 27, 31, -1, 29, 27, -1, 24, -1, 22, -1, 19, -1, -1, -1],
    drum: 'k...s...k..k s...',
    key: 0, wave: 'square', leadWave: 'triangle',
  },
  harbor: {
    bpm: 148, bars: 4,
    bass: [0, 0, 12, 0, 7, 0, 10, 0, 3, 3, 15, 3, 10, 3, 8, 7],
    lead: [24, -1, 22, 24, 27, -1, 24, -1, 22, -1, 19, 22, 24, -1, -1, -1],
    drum: 'k.h.s.h.k.hks.h.',
    key: 0, wave: 'sawtooth', leadWave: 'square',
  },
  foundry: {
    bpm: 132, bars: 4,
    bass: [0, 0, 0, 6, 0, 0, 6, 0, 5, 5, 5, 11, 5, 3, 1, 0],
    lead: [12, 15, 18, -1, 17, -1, 15, 12, -1, 15, 11, -1, 12, -1, -1, -1],
    drum: 'k..ks.h.k..ks.hh',
    key: 0, wave: 'sawtooth', leadWave: 'sawtooth',
  },
  shrine: {
    bpm: 118, bars: 4,
    bass: [0, -1, -1, 0, 7, -1, -1, 7, 5, -1, -1, 5, 10, -1, 3, -1],
    lead: [24, -1, 26, -1, 29, -1, 31, -1, 34, -1, 31, -1, 29, 26, 24, -1],
    drum: 'k...h...k..h.s..',
    key: 0, wave: 'triangle', leadWave: 'square',
  },
  boss: {
    bpm: 164, bars: 4,
    bass: [0, 0, 11, 0, 0, 11, 0, 1, 0, 0, 11, 0, 6, 6, 5, 5],
    lead: [12, 13, 12, 8, -1, 12, 11, -1, 12, 13, 12, 8, 6, -1, 5, -1],
    drum: 'khhksh hkhhksh h'.replace(/ /g, '.'),
    key: 0, wave: 'sawtooth', leadWave: 'sawtooth',
  },
  abyss: {
    bpm: 152, bars: 4,
    bass: [0, 6, 0, 6, 1, 7, 1, 7, 3, 9, 3, 9, 2, 8, 1, 0],
    lead: [24, 30, 25, -1, 24, -1, 23, -1, 25, 31, 26, -1, 25, -1, 24, -1],
    drum: 'khhkshhkkhhksh.h',
    key: 0, wave: 'sawtooth', leadWave: 'square',
  },
  victory: {
    bpm: 128, bars: 2,
    bass: [0, -1, 7, -1, 12, -1, 7, -1, 5, -1, 10, -1, 12, -1, -1, -1],
    lead: [24, 28, 31, 36, -1, 34, 31, 28, 26, 31, 34, 38, -1, -1, -1, -1],
    drum: 'k.h.s.h.k.h.s...',
    key: 0, wave: 'triangle', leadWave: 'square',
  },
};

let bgm = null;
let timer = null;

function scheduleStep(tr, step, t) {
  const i = step % 16;
  // 베이스
  const b = tr.bass[i];
  if (b >= 0) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 780; f.Q.value = 3;
    o.type = tr.wave; o.frequency.value = hz(b + tr.key - 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(f); f.connect(g); g.connect(musBus);
    o.start(t); o.stop(t + 0.2);
  }
  // 리드
  const l = tr.lead[i];
  if (l >= 0) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = tr.leadWave; o.frequency.value = hz(l + tr.key);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(musBus);
    o.start(t); o.stop(t + 0.25);
    const o2 = ac.createOscillator(), g2 = ac.createGain();
    o2.type = 'triangle'; o2.frequency.value = hz(l + tr.key + 12); o2.detune.value = 6;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o2.connect(g2); g2.connect(musBus);
    o2.start(t); o2.stop(t + 0.2);
  }
  // 드럼
  const d = tr.drum[i];
  if (d === 'k') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.16);
  } else if (d === 's' || d === 'h') {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = 'highpass';
    bp.frequency.value = d === 's' ? 1400 : 6200;
    const g = ac.createGain();
    const amp = d === 's' ? 0.3 : 0.1, dur = d === 's' ? 0.13 : 0.04;
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(musBus);
    s.start(t); s.stop(t + dur + 0.02);
  }
}

export function playBgm(name) {
  if (!ac || !TRACKS[name]) return;
  if (bgm && bgm.name === name) return;
  stopBgm();
  const tr = TRACKS[name];
  bgm = { name, tr, step: 0, next: ac.currentTime + 0.06, spb: 60 / tr.bpm / 4 };
  timer = setInterval(() => {
    if (!bgm) return;
    const horizon = ac.currentTime + 0.22;
    while (bgm.next < horizon) {
      try { scheduleStep(bgm.tr, bgm.step, bgm.next); } catch (e) { /* noop */ }
      bgm.step++;
      bgm.next += bgm.spb;
    }
  }, 55);
}
export function stopBgm() {
  if (timer) clearInterval(timer);
  timer = null; bgm = null;
}
export const currentBgm = () => (bgm ? bgm.name : null);
