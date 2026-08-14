// Every sound in the game is synthesised at runtime — no audio files ship with it.
// SFX are one-shot graphs; music is a lookahead-scheduled generative loop per biome.

import { clamp, rng } from './core.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let started = false;

const state = {
  sfxVolume: 0.75,
  musicVolume: 0.5,
  muted: false,
};

export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = 0.9;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 22;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;

  master.connect(comp);
  comp.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = state.sfxVolume;
  sfxBus.connect(master);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);

  // A shared 2s noise buffer covers every percussive / textural need.
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  return ctx;
}

export function resumeAudio() {
  if (!ctx) initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  started = true;
}

export function audioReady() { return !!ctx && started; }

export function setSfxVolume(v) {
  state.sfxVolume = clamp(v, 0, 1);
  if (sfxBus) sfxBus.gain.value = state.muted ? 0 : state.sfxVolume;
}
export function setMusicVolume(v) {
  state.musicVolume = clamp(v, 0, 1);
  if (musicBus) musicBus.gain.setTargetAtTime(state.muted ? 0 : state.musicVolume * music.duck, ctx.currentTime, 0.15);
}
export function getVolumes() { return { sfx: state.sfxVolume, music: state.musicVolume, muted: state.muted }; }
export function toggleMute() {
  state.muted = !state.muted;
  setSfxVolume(state.sfxVolume);
  setMusicVolume(state.musicVolume);
  return state.muted;
}

// ---------------------------------------------------------------- primitives

function now() { return ctx.currentTime; }

function env(node, t, a, d, peak = 1, sustain = 0, rel = 0) {
  const g = node.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  if (sustain > 0) {
    g.exponentialRampToValueAtTime(Math.max(peak * 0.6, 0.0002), t + a + d);
    g.setValueAtTime(Math.max(peak * 0.6, 0.0002), t + a + d + sustain);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + sustain + rel);
  } else {
    g.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
}

function tone({ type = 'sine', f0 = 440, f1 = null, t = 0, a = 0.004, d = 0.2, gain = 0.3, dest = null, detune = 0, curve = 'exp' }) {
  const o = ctx.createOscillator();
  o.type = type;
  if (detune) o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== null && f1 !== f0) {
    if (curve === 'lin') o.frequency.linearRampToValueAtTime(Math.max(f1, 1), t + a + d);
    else o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + a + d);
  }
  const g = ctx.createGain();
  env(g, t, a, d, gain);
  o.connect(g);
  g.connect(dest || sfxBus);
  o.start(t);
  o.stop(t + a + d + 0.05);
  return { o, g };
}

function noise({ t = 0, d = 0.2, gain = 0.3, type = 'bandpass', f0 = 1200, f1 = null, q = 1, dest = null, a = 0.002 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + d);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, a, d, gain);
  s.connect(f); f.connect(g); g.connect(dest || sfxBus);
  s.start(t);
  s.stop(t + d + 0.08);
  return { s, g, f };
}

// Cheap stereo placement so combat reads spatially.
function pan(x = 0) {
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (!p) return null;
  p.pan.value = clamp(x, -1, 1);
  p.connect(sfxBus);
  return p;
}

let lastPlay = Object.create(null);
/** Throttle identical SFX so a 12-hit frame does not turn into a wall of noise. */
function gate(name, ms) {
  const t = performance.now();
  if (lastPlay[name] && t - lastPlay[name] < ms) return false;
  lastPlay[name] = t;
  return true;
}

// ------------------------------------------------------------------- library

const SFX = {
  swing(p = 0, v = 1) {
    const t = now(), dest = pan(p) || sfxBus;
    noise({ t, d: 0.16, gain: 0.16 * v, type: 'bandpass', f0: 2600, f1: 700, q: 1.2, dest });
    tone({ type: 'triangle', f0: 380, f1: 150, t, a: 0.003, d: 0.11, gain: 0.07 * v, dest });
  },
  hit(p = 0, v = 1) {
    const t = now(), dest = pan(p) || sfxBus;
    noise({ t, d: 0.1, gain: 0.3 * v, type: 'lowpass', f0: 3000, f1: 500, q: 0.7, dest });
    tone({ type: 'square', f0: 200, f1: 60, t, a: 0.001, d: 0.09, gain: 0.16 * v, dest });
    tone({ type: 'sine', f0: 900, f1: 300, t, a: 0.001, d: 0.05, gain: 0.09 * v, dest });
  },
  crit(p = 0) {
    const t = now(), dest = pan(p) || sfxBus;
    noise({ t, d: 0.16, gain: 0.34, type: 'highpass', f0: 1800, f1: 4200, q: 0.8, dest });
    tone({ type: 'square', f0: 1400, f1: 380, t, a: 0.001, d: 0.14, gain: 0.14, dest });
    tone({ type: 'sine', f0: 2600, f1: 900, t: t + 0.02, a: 0.001, d: 0.1, gain: 0.09, dest });
  },
  dash() {
    const t = now();
    noise({ t, d: 0.24, gain: 0.2, type: 'bandpass', f0: 500, f1: 2800, q: 2.4 });
    tone({ type: 'sine', f0: 160, f1: 520, t, a: 0.01, d: 0.2, gain: 0.1, curve: 'exp' });
  },
  cast() {
    const t = now();
    tone({ type: 'sawtooth', f0: 220, f1: 880, t, a: 0.008, d: 0.22, gain: 0.1 });
    tone({ type: 'sine', f0: 660, f1: 1760, t, a: 0.005, d: 0.26, gain: 0.07 });
    noise({ t, d: 0.3, gain: 0.08, type: 'bandpass', f0: 900, f1: 3000, q: 3 });
  },
  special() {
    const t = now();
    tone({ type: 'sawtooth', f0: 120, f1: 42, t, a: 0.006, d: 0.4, gain: 0.16 });
    noise({ t, d: 0.38, gain: 0.22, type: 'lowpass', f0: 2200, f1: 260, q: 1 });
    tone({ type: 'triangle', f0: 520, f1: 130, t: t + 0.02, a: 0.004, d: 0.3, gain: 0.1 });
  },
  explode(v = 1) {
    const t = now();
    noise({ t, d: 0.55 * v, gain: 0.34, type: 'lowpass', f0: 1800, f1: 90, q: 0.6 });
    tone({ type: 'sine', f0: 150, f1: 32, t, a: 0.004, d: 0.5, gain: 0.24 });
    tone({ type: 'square', f0: 90, f1: 30, t, a: 0.002, d: 0.28, gain: 0.1 });
  },
  hurt() {
    const t = now();
    tone({ type: 'sawtooth', f0: 340, f1: 90, t, a: 0.002, d: 0.3, gain: 0.2 });
    noise({ t, d: 0.24, gain: 0.2, type: 'lowpass', f0: 1200, f1: 200, q: 0.8 });
  },
  die(p = 0) {
    const t = now(), dest = pan(p) || sfxBus;
    noise({ t, d: 0.42, gain: 0.24, type: 'lowpass', f0: 2400, f1: 160, q: 0.8, dest });
    tone({ type: 'triangle', f0: 420, f1: 70, t, a: 0.004, d: 0.4, gain: 0.13, dest });
  },
  enemyShoot(p = 0) {
    if (!gate('es', 40)) return;
    const t = now(), dest = pan(p) || sfxBus;
    tone({ type: 'square', f0: 700, f1: 260, t, a: 0.002, d: 0.13, gain: 0.06, dest });
    noise({ t, d: 0.1, gain: 0.05, type: 'highpass', f0: 1600, dest });
  },
  telegraph(p = 0) {
    if (!gate('tel', 90)) return;
    const t = now(), dest = pan(p) || sfxBus;
    tone({ type: 'sine', f0: 300, f1: 760, t, a: 0.05, d: 0.24, gain: 0.055, curve: 'lin', dest });
  },
  slam() {
    const t = now();
    tone({ type: 'sine', f0: 110, f1: 26, t, a: 0.004, d: 0.7, gain: 0.32 });
    noise({ t, d: 0.6, gain: 0.3, type: 'lowpass', f0: 1400, f1: 70, q: 0.7 });
  },
  laser() {
    const t = now();
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(240, t + 1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.08);
    g.gain.setValueAtTime(0.13, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
    o.connect(f); f.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 1.5);
  },
  pickup() {
    const t = now();
    tone({ type: 'triangle', f0: 880, f1: 880, t, a: 0.004, d: 0.09, gain: 0.1 });
    tone({ type: 'triangle', f0: 1320, f1: 1320, t: t + 0.06, a: 0.004, d: 0.12, gain: 0.09 });
  },
  coin() {
    const t = now();
    tone({ type: 'square', f0: 1180, f1: 1180, t, a: 0.002, d: 0.06, gain: 0.06 });
    tone({ type: 'square', f0: 1760, f1: 1760, t: t + 0.05, a: 0.002, d: 0.1, gain: 0.05 });
  },
  heal() {
    const t = now();
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ type: 'sine', f0: f, f1: f, t: t + i * 0.07, a: 0.01, d: 0.3, gain: 0.09 }));
  },
  uiMove() {
    if (!gate('uim', 45)) return;
    tone({ type: 'square', f0: 620, f1: 760, t: now(), a: 0.002, d: 0.05, gain: 0.045 });
  },
  uiSelect() {
    const t = now();
    tone({ type: 'square', f0: 520, f1: 1040, t, a: 0.003, d: 0.1, gain: 0.07 });
    tone({ type: 'sine', f0: 1560, f1: 1560, t: t + 0.05, a: 0.004, d: 0.14, gain: 0.05 });
  },
  uiBack() {
    tone({ type: 'square', f0: 480, f1: 240, t: now(), a: 0.003, d: 0.1, gain: 0.06 });
  },
  boon(color = 0) {
    const t = now();
    const base = [392, 440, 466, 523][color % 4];
    [1, 1.25, 1.5, 2].forEach((m, i) =>
      tone({ type: 'triangle', f0: base * m, f1: base * m, t: t + i * 0.09, a: 0.02, d: 0.55, gain: 0.11 }));
    noise({ t, d: 0.9, gain: 0.05, type: 'bandpass', f0: 2400, f1: 6000, q: 2 });
  },
  doorOpen() {
    const t = now();
    noise({ t, d: 0.8, gain: 0.14, type: 'lowpass', f0: 400, f1: 1600, q: 1 });
    tone({ type: 'sine', f0: 70, f1: 180, t, a: 0.1, d: 0.7, gain: 0.13, curve: 'lin' });
  },
  bossRoar() {
    const t = now();
    tone({ type: 'sawtooth', f0: 62, f1: 40, t, a: 0.12, d: 1.6, gain: 0.3 });
    tone({ type: 'square', f0: 93, f1: 58, t, a: 0.16, d: 1.5, gain: 0.14 });
    noise({ t, d: 1.7, gain: 0.2, type: 'lowpass', f0: 900, f1: 160, q: 0.8 });
  },
  phaseShift() {
    const t = now();
    tone({ type: 'sawtooth', f0: 900, f1: 60, t, a: 0.02, d: 1.1, gain: 0.2 });
    noise({ t, d: 1.2, gain: 0.2, type: 'bandpass', f0: 6000, f1: 300, q: 1.4 });
  },
  shield() {
    const t = now();
    tone({ type: 'square', f0: 1200, f1: 900, t, a: 0.002, d: 0.1, gain: 0.09 });
    noise({ t, d: 0.14, gain: 0.14, type: 'highpass', f0: 3000 });
  },
  freeze() {
    if (!gate('frz', 120)) return;
    const t = now();
    noise({ t, d: 0.4, gain: 0.1, type: 'highpass', f0: 4000, f1: 9000, q: 1 });
    tone({ type: 'sine', f0: 2400, f1: 1200, t, a: 0.01, d: 0.3, gain: 0.05 });
  },
  burn() {
    if (!gate('brn', 200)) return;
    noise({ t: now(), d: 0.3, gain: 0.05, type: 'bandpass', f0: 700, f1: 2000, q: 1.6 });
  },
  victory() {
    const t = now();
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, f1: f, t: t + i * 0.13, a: 0.02, d: 0.9, gain: 0.13 }));
  },
  defeat() {
    const t = now();
    [392, 349, 311, 233].forEach((f, i) =>
      tone({ type: 'sine', f0: f, f1: f * 0.98, t: t + i * 0.28, a: 0.05, d: 1.1, gain: 0.14 }));
  },
};

export function sfx(name, ...args) {
  if (!ctx || !started) return;
  const fn = SFX[name];
  if (fn) {
    try { fn(...args); } catch (_) { /* audio graph hiccups must never break a frame */ }
  }
}

// --------------------------------------------------------------------- music

// Minor / phrygian flavoured scales keep the whole soundtrack in one mood family.
const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrianish: [0, 1, 3, 5, 6, 8, 10],
};

const TRACKS = {
  menu:      { root: 45, scale: 'aeolian',    bpm: 74,  arp: 0.55, pad: 0.5,  drums: 0,    lead: 0.0, bassOct: -12 },
  necropolis:{ root: 45, scale: 'aeolian',    bpm: 96,  arp: 0.7,  pad: 0.42, drums: 0.5,  lead: 0.3, bassOct: -12 },
  bastion:   { root: 43, scale: 'phrygian',   bpm: 108, arp: 0.75, pad: 0.4,  drums: 0.72, lead: 0.4, bassOct: -12 },
  throne:    { root: 41, scale: 'locrianish', bpm: 120, arp: 0.8,  pad: 0.46, drums: 0.85, lead: 0.5, bassOct: -12 },
  boss:      { root: 41, scale: 'phrygian',   bpm: 132, arp: 0.9,  pad: 0.5,  drums: 1.0,  lead: 0.62, bassOct: -24 },
  sanctum:   { root: 48, scale: 'aeolian',    bpm: 66,  arp: 0.4,  pad: 0.62, drums: 0,    lead: 0.0, bassOct: -12 },
};

const music = {
  track: null,
  name: null,
  step: 0,
  nextTime: 0,
  timer: null,
  duck: 1,
  reverb: null,
  delay: null,
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function buildMusicFx() {
  if (music.reverb) return;
  // Feedback delay + a short noise-convolution stands in for a hall reverb.
  const dly = ctx.createDelay(1.5);
  dly.delayTime.value = 0.34;
  const fb = ctx.createGain(); fb.gain.value = 0.34;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  const wet = ctx.createGain(); wet.gain.value = 0.42;
  dly.connect(lp); lp.connect(fb); fb.connect(dly);
  dly.connect(wet); wet.connect(musicBus);
  music.delay = dly;

  const conv = ctx.createConvolver();
  const dur = 2.2, len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
  }
  conv.buffer = buf;
  const rvWet = ctx.createGain(); rvWet.gain.value = 0.5;
  conv.connect(rvWet); rvWet.connect(musicBus);
  music.reverb = conv;
}

function mNote({ type, midi, t, dur, gain, dest, det = 0, filter = null }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.detune.value = det;
  o.frequency.value = mtof(midi);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filter.f0, t);
    if (filter.f1) f.frequency.exponentialRampToValueAtTime(filter.f1, t + dur);
    f.Q.value = filter.q || 1;
    o.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  const a = Math.min(0.03, dur * 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g);
  g.connect(dest || musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
  return g;
}

function mDrum(kind, t, gain) {
  if (kind === 'kick') {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.3);
  } else if (kind === 'snare') {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f); f.connect(g); g.connect(musicBus);
    s.start(t); s.stop(t + 0.2);
  } else {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(f); f.connect(g); g.connect(musicBus);
    s.start(t); s.stop(t + 0.08);
  }
}

const CHORDS = [0, 5, 3, 6]; // scale-degree roots, one per 8-step bar

function scheduleStep(cfg, step, t) {
  const scale = SCALES[cfg.scale];
  const deg = (n) => {
    const oct = Math.floor(n / scale.length);
    return scale[((n % scale.length) + scale.length) % scale.length] + oct * 12;
  };
  const bar = Math.floor(step / 8) % CHORDS.length;
  const chordRoot = CHORDS[bar];

  // Bass — one long note per bar, plus an off-beat push.
  if (step % 8 === 0) {
    mNote({ type: 'sawtooth', midi: cfg.root + cfg.bassOct + deg(chordRoot), t, dur: 1.9,
      gain: 0.12, filter: { f0: 420, f1: 160, q: 4 } });
    mNote({ type: 'sine', midi: cfg.root + cfg.bassOct + deg(chordRoot), t, dur: 1.6, gain: 0.16 });
  }
  if (cfg.drums > 0 && step % 8 === 6) {
    mNote({ type: 'sawtooth', midi: cfg.root + cfg.bassOct + deg(chordRoot) + 12, t, dur: 0.22,
      gain: 0.07, filter: { f0: 900, f1: 300, q: 6 } });
  }

  // Pad — sustained triad, refreshed each bar.
  if (step % 8 === 0 && cfg.pad > 0) {
    [0, 2, 4].forEach((iv, i) => {
      mNote({ type: 'triangle', midi: cfg.root + deg(chordRoot + iv), t, dur: 2.4,
        gain: 0.035 * cfg.pad, det: (i - 1) * 6, dest: music.reverb });
      mNote({ type: 'sine', midi: cfg.root + deg(chordRoot + iv), t, dur: 2.2, gain: 0.028 * cfg.pad });
    });
  }

  // Arpeggio — the constant motion layer.
  if (cfg.arp > 0) {
    const pattern = [0, 2, 4, 2, 6, 4, 2, 0];
    const n = pattern[step % 8];
    mNote({ type: 'square', midi: cfg.root + 12 + deg(chordRoot + n), t, dur: 0.2,
      gain: 0.038 * cfg.arp, dest: music.delay, filter: { f0: 2600, f1: 900, q: 2 } });
  }

  // Lead — sparse, only in combat biomes.
  if (cfg.lead > 0 && step % 16 === 12) {
    const n = [4, 6, 7, 2][bar];
    mNote({ type: 'sawtooth', midi: cfg.root + 12 + deg(chordRoot + n), t, dur: 0.7,
      gain: 0.05 * cfg.lead, dest: music.reverb, filter: { f0: 1800, f1: 500, q: 5 } });
  }

  // Drums.
  if (cfg.drums > 0) {
    const g = cfg.drums;
    if (step % 8 === 0 || step % 8 === 5) mDrum('kick', t, 0.28 * g);
    if (step % 8 === 4) mDrum('snare', t, 0.24 * g);
    if (step % 2 === 1) mDrum('hat', t, 0.2 * g * (rng.bool(0.7) ? 1 : 0.4));
    if (g > 0.8 && step % 16 === 15) mDrum('snare', t, 0.16 * g);
  }
}

function tick() {
  if (!ctx || !music.track) return;
  const cfg = music.track;
  const stepDur = 60 / cfg.bpm / 2; // eighth notes
  const horizon = ctx.currentTime + 0.4;
  let guard = 0;
  while (music.nextTime < horizon && guard++ < 64) {
    try { scheduleStep(cfg, music.step, music.nextTime); } catch (_) { /* keep the clock alive */ }
    music.step++;
    music.nextTime += stepDur;
  }
}

export function playMusic(name) {
  if (!ctx || !started) { music.name = name; return; }
  if (music.name === name && music.timer) return;
  buildMusicFx();
  music.name = name;
  music.track = TRACKS[name] || TRACKS.menu;
  music.step = 0;
  music.nextTime = ctx.currentTime + 0.12;
  if (!music.timer) music.timer = setInterval(tick, 60);
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(state.muted ? 0 : state.musicVolume * music.duck, ctx.currentTime, 0.4);
  tick();
}

export function stopMusic() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
  if (music.timer) { clearInterval(music.timer); music.timer = null; }
  music.track = null;
  music.name = null;
}

/** Temporarily lower music (menus, boon pickup fanfare). */
export function duckMusic(amount = 0.35, seconds = 1.2) {
  if (!ctx || !musicBus) return;
  music.duck = amount;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(state.muted ? 0 : state.musicVolume * amount, t, 0.08);
  setTimeout(() => {
    music.duck = 1;
    if (ctx) musicBus.gain.setTargetAtTime(state.muted ? 0 : state.musicVolume, ctx.currentTime, 0.5);
  }, seconds * 1000);
}
