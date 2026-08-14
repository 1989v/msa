// Game feel layer: hitstop, trauma-based screen shake, particles, damage numbers,
// ground decals and shockwave rings. Everything here is purely cosmetic — the
// simulation never reads from it.

import { TAU, clamp, lerp, sat, rng, noise1, easeOutCubic, easeOutQuint, Pool } from './core.js';

// ------------------------------------------------------------------ hitstop

let hitstop = 0;
let hitstopScale = 1;

/** Freeze the sim for `s` seconds. Repeated calls take the longest, never stack. */
export function addHitstop(s) {
  hitstop = Math.max(hitstop, s);
}
export function getHitstop() { return hitstop; }
export function tickHitstop(dt) {
  if (hitstop > 0) {
    hitstop = Math.max(0, hitstop - dt);
    return true;
  }
  return false;
}
export function setHitstopScale(v) { hitstopScale = v; }
export function scaledHitstop(s) { addHitstop(s * hitstopScale); }

// ------------------------------------------------------------------- shake

const shake = { trauma: 0, t: 0, x: 0, y: 0, rot: 0, seed: rng.range(0, 1000) };

export function addShake(amount) {
  shake.trauma = clamp(shake.trauma + amount, 0, 1);
}

export function updateShake(dt) {
  shake.t += dt;
  shake.trauma = Math.max(0, shake.trauma - dt * 1.5);
  const s = shake.trauma * shake.trauma;
  const f = shake.t * 26 + shake.seed;
  shake.x = noise1(f) * 26 * s;
  shake.y = noise1(f + 137.7) * 26 * s;
  shake.rot = noise1(f + 411.3) * 0.022 * s;
}
export function getShake() { return shake; }

// -------------------------------------------------------------- screen tint

const flashes = [];
/** Full-screen colour wash; used for phase transitions, damage, boss deaths. */
export function screenFlash(color, strength = 0.4, life = 0.25) {
  flashes.push({ color, strength, life, t: 0 });
}
function updateFlashes(dt) {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.t += dt;
    if (f.t >= f.life) flashes.splice(i, 1);
  }
}
export function drawFlashes(ctx, w, h) {
  for (const f of flashes) {
    const a = (1 - f.t / f.life) * f.strength;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalAlpha = 1;
}

// --------------------------------------------------------------- vignette fx

let chroma = 0;
export function addChroma(v) { chroma = Math.min(1, chroma + v); }
export function updateChroma(dt) { chroma = Math.max(0, chroma - dt * 2.2); }
export function getChroma() { return chroma; }

// --------------------------------------------------------------- particles

const particles = [];
const pPool = new Pool(
  () => ({}),
  (p) => {
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 1; p.t = 0;
    p.r0 = 3; p.r1 = 0; p.color = '#fff'; p.color2 = null;
    p.drag = 3; p.grav = 0; p.kind = 'dot'; p.rot = 0; p.spin = 0;
    p.glow = false; p.z = 0; p.vz = 0; p.stretch = 0; p.alpha = 1;
  }
);

export const PARTICLE_CAP = 900;

export function emit(opts) {
  if (particles.length >= PARTICLE_CAP) return null;
  const p = pPool.get();
  Object.assign(p, opts);
  particles.push(p);
  return p;
}

export function burst(x, y, count, opts = {}) {
  const {
    speed = [60, 220], life = [0.25, 0.6], r0 = [2, 5], r1 = 0,
    color = '#fff', color2 = null, spread = TAU, dir = 0, kind = 'dot',
    drag = 4, grav = 0, glow = false, stretch = 0, z = 0, vz = [0, 0],
  } = opts;
  const n = Math.min(count, PARTICLE_CAP - particles.length);
  for (let i = 0; i < n; i++) {
    const a = dir + rng.range(-spread / 2, spread / 2);
    const sp = rng.range(speed[0], speed[1]);
    emit({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rng.range(life[0], life[1]), t: 0,
      r0: rng.range(r0[0], r0[1]), r1,
      color: Array.isArray(color) ? rng.pick(color) : color,
      color2, drag, grav, kind, glow, stretch,
      rot: rng.angle(), spin: rng.range(-8, 8),
      z, vz: rng.range(vz[0], vz[1]), alpha: 1,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.life) {
      particles.splice(i, 1);
      pPool.put(p);
      continue;
    }
    const d = Math.exp(-p.drag * dt);
    p.vx *= d; p.vy *= d;
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vz || p.z) {
      p.vz -= 620 * dt;
      p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.35; }
    }
    p.rot += p.spin * dt;
  }
}

export function drawParticles(ctx, glowPass) {
  ctx.save();
  for (const p of particles) {
    if (!!p.glow !== glowPass) continue;
    const u = p.t / p.life;
    const r = lerp(p.r0, p.r1, easeOutCubic(u));
    if (r <= 0.15) continue;
    const a = p.alpha * (1 - u * u);
    ctx.globalAlpha = a;
    const col = p.color2 ? mixHex(p.color, p.color2, u) : p.color;
    const py = p.y - p.z;
    if (p.kind === 'dot') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, py, r, 0, TAU);
      ctx.fill();
    } else if (p.kind === 'spark') {
      const sp = Math.hypot(p.vx, p.vy);
      const len = clamp(sp * 0.035 + p.stretch, r, 42);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.strokeStyle = col;
      ctx.lineWidth = r;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, py);
      ctx.lineTo(p.x - Math.cos(ang) * len, py - Math.sin(ang) * len);
      ctx.stroke();
    } else if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, py);
      ctx.rotate(p.rot);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.7);
      ctx.lineTo(r * 0.72, 0);
      ctx.lineTo(0, r * 1.7);
      ctx.lineTo(-r * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, r * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, py, r * 3, 0, TAU);
      ctx.stroke();
    } else if (p.kind === 'smoke') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, py, r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function particleCount() { return particles.length; }

// ---------------------------------------------------------- damage numbers

const dmgNums = [];

export function damageNumber(x, y, value, opts = {}) {
  const { crit = false, color = null, heal = false, tiny = false } = opts;
  // Merge rapid ticks on the same spot so DoT does not spam the screen.
  for (const d of dmgNums) {
    if (d.t < 0.16 && !d.crit && !crit && Math.abs(d.x - x) < 26 && Math.abs(d.y0 - y) < 26 && d.heal === heal) {
      d.value += value;
      d.t = 0;
      d.pop = 1;
      return;
    }
  }
  dmgNums.push({
    x: x + rng.range(-8, 8), y0: y, value, t: 0,
    life: crit ? 1.05 : 0.78, crit, heal, tiny,
    color: color || (heal ? '#7bf5a8' : crit ? '#ffd34a' : '#ffffff'),
    vx: rng.range(-26, 26), pop: 1,
  });
  if (dmgNums.length > 46) dmgNums.shift();
}

function updateDamageNumbers(dt) {
  for (let i = dmgNums.length - 1; i >= 0; i--) {
    const d = dmgNums[i];
    d.t += dt;
    d.pop = Math.max(0, d.pop - dt * 5);
    if (d.t >= d.life) dmgNums.splice(i, 1);
  }
}

export function drawDamageNumbers(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of dmgNums) {
    const u = d.t / d.life;
    const rise = easeOutQuint(Math.min(1, u * 1.6)) * (d.crit ? 62 : 44);
    const a = u < 0.72 ? 1 : 1 - (u - 0.72) / 0.28;
    const base = d.tiny ? 16 : d.crit ? 33 : 22;
    const scale = 1 + d.pop * (d.crit ? 0.6 : 0.32);
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(d.x + d.vx * u, d.y0 - rise);
    ctx.scale(scale, scale);
    ctx.font = `${d.crit ? '' : ''}${base}px Galmuri11Bold, Galmuri11, monospace`;
    const txt = (d.heal ? '+' : '') + Math.round(d.value);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(4,8,14,0.92)';
    ctx.lineJoin = 'round';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = d.color;
    ctx.fillText(txt, 0, 0);
    if (d.crit) {
      ctx.font = '14px Galmuri11Bold, Galmuri11, monospace';
      ctx.strokeText('치명', 0, -24);
      ctx.fillStyle = '#ffe89a';
      ctx.fillText('치명', 0, -24);
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ floating text

const floaters = [];
export function floatText(x, y, text, opts = {}) {
  floaters.push({
    x, y, text, t: 0,
    life: opts.life || 1.4,
    color: opts.color || '#cfe6ff',
    size: opts.size || 22,
    rise: opts.rise ?? 46,
  });
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].t += dt;
    if (floaters[i].t >= floaters[i].life) floaters.splice(i, 1);
  }
}
export function drawFloaters(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floaters) {
    const u = f.t / f.life;
    const a = u < 0.15 ? u / 0.15 : u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    ctx.globalAlpha = a;
    ctx.font = `${f.size}px Galmuri11Bold, Galmuri11, monospace`;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,8,14,0.9)';
    const y = f.y - easeOutCubic(u) * f.rise;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// -------------------------------------------------------------- shockwaves

const waves = [];
/** Expanding ring — impact feedback, boss slams, dash trails. */
export function shockwave(x, y, opts = {}) {
  waves.push({
    x, y, t: 0,
    life: opts.life || 0.45,
    r0: opts.r0 ?? 6,
    r1: opts.r1 ?? 120,
    color: opts.color || 'rgba(190,235,255,0.85)',
    width: opts.width ?? 5,
    fill: opts.fill || null,
    ease: opts.ease || easeOutQuint,
    squash: opts.squash ?? 1,
  });
  if (waves.length > 60) waves.shift();
}
function updateWaves(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    waves[i].t += dt;
    if (waves[i].t >= waves[i].life) waves.splice(i, 1);
  }
}
export function drawShockwaves(ctx) {
  ctx.save();
  for (const w of waves) {
    const u = w.t / w.life;
    const r = lerp(w.r0, w.r1, w.ease(u));
    const a = 1 - u;
    ctx.globalAlpha = a * a;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.scale(1, w.squash);
    if (w.fill) {
      ctx.fillStyle = w.fill;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = w.color;
    ctx.lineWidth = Math.max(0.6, w.width * (1 - u * 0.7));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ decals

const decals = [];
/** Long-lived ground marks (blood/ichor pools, scorch, frost) drawn under entities. */
export function decal(x, y, r, color, life = 12) {
  decals.push({ x, y, r, color, t: 0, life, rot: rng.angle(), sq: rng.range(0.5, 0.72) });
  if (decals.length > 90) decals.shift();
}
function updateDecals(dt) {
  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i].t += dt;
    if (decals[i].t >= decals[i].life) decals.splice(i, 1);
  }
}
export function drawDecals(ctx) {
  ctx.save();
  for (const d of decals) {
    const u = d.t / d.life;
    const grow = Math.min(1, d.t * 6);
    ctx.globalAlpha = (1 - u * u) * 0.34;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(1, d.sq);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, 0, d.r * grow, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function clearFx() {
  particles.length = 0;
  dmgNums.length = 0;
  waves.length = 0;
  decals.length = 0;
  floaters.length = 0;
  flashes.length = 0;
  shake.trauma = 0;
  hitstop = 0;
  chroma = 0;
}
/** Room transitions keep decals out but let live particles settle. */
export function clearDecals() { decals.length = 0; }

export function updateFx(dt) {
  updateShake(dt);
  updateParticles(dt);
  updateDamageNumbers(dt);
  updateWaves(dt);
  updateDecals(dt);
  updateFloaters(dt);
  updateFlashes(dt);
  updateChroma(dt);
}

// ------------------------------------------------------------------ helpers

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = Math.round(lerp(A.r, B.r, sat(t)));
  const g = Math.round(lerp(A.g, B.g, sat(t)));
  const bl = Math.round(lerp(A.b, B.b, sat(t)));
  return `rgb(${r},${g},${bl})`;
}
export function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => clamp(Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// --------------------------------------------------------- composite presets

/** The standard "something took damage" package. */
export function impactFx(x, y, dir, opts = {}) {
  const {
    color = '#eaf6ff', color2 = '#4fd1ff', count = 10, power = 1, crit = false,
  } = opts;
  burst(x, y, count, {
    speed: [120 * power, 340 * power], life: [0.14, 0.34],
    r0: [1.6, 3.6], r1: 0, color, color2, kind: 'spark',
    spread: 1.5, dir, drag: 7, glow: true,
  });
  shockwave(x, y, {
    r0: 4, r1: crit ? 76 : 44, life: crit ? 0.35 : 0.24,
    color: `rgba(255,255,255,${crit ? 0.9 : 0.6})`, width: crit ? 5 : 3,
  });
}

export function bloodFx(x, y, dir, color = '#3ad8c6') {
  burst(x, y, 7, {
    speed: [40, 180], life: [0.4, 0.9], r0: [2, 5], r1: 0.5,
    color, kind: 'dot', spread: 2.2, dir, drag: 3.4, grav: 240, glow: false,
  });
  // Only some hits stain the floor — every hit leaving a pool smears the arena
  // into a solid streak over a long fight and competes with the telegraphs.
  if (rng.next() < 0.35) decal(x, y + 6, rng.range(7, 13), color, 9);
}

export function deathFx(x, y, color, size = 1) {
  burst(x, y, Math.round(20 * size), {
    speed: [80, 320], life: [0.4, 1.0], r0: [2.5, 6 * size], r1: 0,
    color, color2: '#0a1522', kind: 'shard', spread: TAU, drag: 2.6, grav: 180,
  });
  burst(x, y, Math.round(14 * size), {
    speed: [30, 130], life: [0.6, 1.3], r0: [8 * size, 18 * size], r1: 0,
    color: 'rgba(30,60,80,0.5)', kind: 'smoke', spread: TAU, drag: 1.8,
  });
  shockwave(x, y, { r0: 8, r1: 90 * size, life: 0.45, color: rgba('#ffffff', 0.5), width: 4 });
  decal(x, y + 4, 20 * size, color, 16);
}
