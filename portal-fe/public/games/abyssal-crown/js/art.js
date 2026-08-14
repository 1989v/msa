// Procedural art. Nothing here loads an image file: floors, caustics, vignettes and
// creature silhouettes are all generated into offscreen canvases at boot and then
// blitted, so the whole game ships as text plus one licensed font.

import { TAU, clamp, lerp, rng, Rng, sat, noise1 } from './core.js';
import { rgba, shade, mixHex } from './fx.js';

export const PAL = {
  void0: '#03060c',
  void1: '#060d18',
  deep: '#0a1626',
  ink: '#04080f',

  cyan: '#57e2d6',
  cyanDim: '#2b9a94',
  ice: '#bfe9ff',
  gold: '#f5c542',
  goldDim: '#9c7a1c',
  blood: '#ff4d5e',
  danger: '#ff5a4d',
  telegraph: '#ff9a3c',

  hp: '#ff5470',
  hpBack: '#3a0f1c',
  armor: '#8fd6ff',
  mana: '#7ba8ff',

  text: '#e8f3ff',
  textDim: '#8ba6c0',
};

/** God identity colours — used for boons, projectiles, status VFX, UI accents. */
export const GODS = {
  neptuna: { name: '넵투나', title: '조류의 여신', color: '#3fb0ff', color2: '#a5dcff', glyph: 'wave' },
  volkar:  { name: '볼카르', title: '열수구의 대장장이', color: '#ff6a2c', color2: '#ffcf7a', glyph: 'flame' },
  glacia:  { name: '글라시아', title: '극야의 한류', color: '#b98cff', color2: '#e5d4ff', glyph: 'crystal' },
  echos:   { name: '에코스', title: '음파의 예언자', color: '#3fe59d', color2: '#c3ffe4', glyph: 'ripple' },
  crown:   { name: '심연의 왕관', title: '잊힌 권능', color: '#f5c542', color2: '#fff2c0', glyph: 'crown' },
};

export const RARITY = {
  common:    { key: 'common',    name: '일반', color: '#93a9bf', mult: 1.00, w: 100 },
  rare:      { key: 'rare',      name: '희귀', color: '#58c8ff', mult: 1.45, w: 42 },
  epic:      { key: 'epic',      name: '서사', color: '#c07cff', mult: 1.95, w: 15 },
  legendary: { key: 'legendary', name: '전설', color: '#ffd34a', mult: 2.60, w: 4 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export const BIOME_THEME = {
  necropolis: {
    name: '산호 묘지',
    subtitle: '가라앉은 자들의 정원',
    fog: '#0b1f2c',
    floor: '#16323f',
    floor2: '#1d4050',
    grout: '#0a1a24',
    accent: '#ff8fb0',
    accent2: '#57e2d6',
    light: '#59d6e8',
    ambient: 'rgba(30,120,140,0.10)',
  },
  bastion: {
    name: '침몰 성채',
    subtitle: '녹슨 방벽의 심장',
    fog: '#111a2b',
    floor: '#22293a',
    floor2: '#2b3348',
    grout: '#0d1220',
    accent: '#c9a04a',
    accent2: '#7fb2ff',
    light: '#7ba8ff',
    ambient: 'rgba(60,90,150,0.10)',
  },
  throne: {
    name: '심연 옥좌',
    subtitle: '왕관이 잠든 자리',
    fog: '#160e26',
    floor: '#221733',
    floor2: '#2d1f44',
    grout: '#0d0716',
    accent: '#f5c542',
    accent2: '#c58cff',
    light: '#b06bff',
    ambient: 'rgba(120,60,170,0.12)',
  },
  sanctum: {
    name: '침묵의 영묘',
    subtitle: '되돌아오는 자의 방',
    fog: '#0a1420',
    floor: '#182a3a',
    floor2: '#1f3547',
    grout: '#0a1520',
    accent: '#f5c542',
    accent2: '#57e2d6',
    light: '#57e2d6',
    ambient: 'rgba(40,110,140,0.10)',
  },
};

// ------------------------------------------------------------ canvas helpers

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function withCtx(w, h, fn) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  fn(g, c);
  return c;
}

// ------------------------------------------------------------------ textures

const floorCache = new Map();

/** A 256×256 seamless-ish floor tile per biome, drawn once and then repeated. */
export function floorTile(biomeKey) {
  if (floorCache.has(biomeKey)) return floorCache.get(biomeKey);
  const th = BIOME_THEME[biomeKey] || BIOME_THEME.necropolis;
  const S = 256;
  const r = new Rng(hashStr(biomeKey));

  const tile = withCtx(S, S, (g) => {
    g.fillStyle = th.floor;
    g.fillRect(0, 0, S, S);

    // Base mottling.
    for (let i = 0; i < 260; i++) {
      const x = r.range(0, S), y = r.range(0, S), rad = r.range(6, 42);
      g.globalAlpha = r.range(0.02, 0.08);
      g.fillStyle = r.bool() ? th.floor2 : th.grout;
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;

    // Slab grid with a per-biome pattern.
    const cell = biomeKey === 'bastion' ? 64 : 85.33;
    g.strokeStyle = rgba(th.grout, 0.9);
    g.lineWidth = 3;
    for (let x = 0; x <= S; x += cell) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke();
    }
    for (let y = 0; y <= S; y += cell) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
    }
    // Bevel highlight on the top-left of each slab.
    g.strokeStyle = rgba(th.floor2, 0.55);
    g.lineWidth = 2;
    for (let x = 0; x <= S; x += cell) {
      for (let y = 0; y <= S; y += cell) {
        g.beginPath();
        g.moveTo(x + 3, y + cell - 3); g.lineTo(x + 3, y + 3); g.lineTo(x + cell - 3, y + 3);
        g.stroke();
      }
    }

    // Biome-specific detail.
    if (biomeKey === 'necropolis') {
      // Small coral sprigs read as growth on stone; long random walks read as
      // scratches and fight with the combat telegraphs.
      for (let i = 0; i < 22; i++) {
        const x = r.range(0, S), y = r.range(0, S);
        const sc = r.range(0.55, 1.15);
        g.globalAlpha = r.range(0.07, 0.15);
        g.strokeStyle = th.accent;
        g.lineWidth = 2.4 * sc;
        g.lineCap = 'round';
        const base = r.angle();
        for (let b = -1; b <= 1; b++) {
          const a = base + b * 0.5;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(
            x + Math.cos(a) * 7 * sc, y + Math.sin(a) * 7 * sc,
            x + Math.cos(a + b * 0.3) * 15 * sc, y + Math.sin(a + b * 0.3) * 15 * sc
          );
          g.stroke();
        }
      }
      for (let i = 0; i < 34; i++) {
        g.globalAlpha = r.range(0.04, 0.11);
        g.fillStyle = '#d9e8ef';
        g.beginPath(); g.arc(r.range(0, S), r.range(0, S), r.range(1, 2.6), 0, TAU); g.fill();
      }
    } else if (biomeKey === 'bastion') {
      for (let i = 0; i < 18; i++) {
        const x = r.range(0, S), y = r.range(0, S), w = r.range(14, 40), h = r.range(8, 20);
        g.globalAlpha = r.range(0.06, 0.16);
        g.fillStyle = '#7a4a2a';
        g.beginPath(); g.ellipse(x, y, w / 2, h / 2, r.angle(), 0, TAU); g.fill();
      }
      g.globalAlpha = 0.2;
      g.strokeStyle = th.accent;
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = r.range(0, S);
        g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + r.range(-6, 6)); g.stroke();
      }
    } else if (biomeKey === 'throne') {
      // Gold filigree veins running through obsidian.
      g.globalAlpha = 0.13;
      g.strokeStyle = th.accent;
      g.lineWidth = 1.8;
      for (let i = 0; i < 12; i++) {
        const x = r.range(0, S), y = r.range(0, S);
        g.beginPath();
        g.moveTo(x, y);
        let px = x, py = y, a = r.angle();
        for (let s = 0; s < 4; s++) {
          a += r.range(-0.4, 0.4);
          const nx = px + Math.cos(a) * 16, ny = py + Math.sin(a) * 16;
          g.quadraticCurveTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8, nx, ny);
          px = nx; py = ny;
        }
        g.stroke();
      }
    } else {
      g.globalAlpha = 0.14;
      g.strokeStyle = th.accent;
      g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        g.beginPath(); g.arc(r.range(0, S), r.range(0, S), r.range(10, 30), 0, TAU); g.stroke();
      }
    }
    g.globalAlpha = 1;

    // Fine grain to break up flat areas.
    const img = g.getImageData(0, 0, S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r.next() - 0.5) * 14;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    g.putImageData(img, 0, 0);
  });

  floorCache.set(biomeKey, tile);
  return tile;
}

let causticFrames = null;
const CAUSTIC_W = 256, CAUSTIC_H = 144, CAUSTIC_N = 12;

/** Animated underwater light — 12 baked frames of an interference pattern. */
export function causticFrame(i) {
  if (!causticFrames) {
    causticFrames = [];
    for (let f = 0; f < CAUSTIC_N; f++) {
      const phase = (f / CAUSTIC_N) * TAU;
      const c = makeCanvas(CAUSTIC_W, CAUSTIC_H);
      const g = c.getContext('2d');
      const img = g.createImageData(CAUSTIC_W, CAUSTIC_H);
      const d = img.data;
      for (let y = 0; y < CAUSTIC_H; y++) {
        for (let x = 0; x < CAUSTIC_W; x++) {
          const u = x / CAUSTIC_W * TAU, v = y / CAUSTIC_H * TAU;
          let s = 0;
          s += Math.sin(u * 3 + phase);
          s += Math.sin(v * 4 - phase * 1.3);
          s += Math.sin((u + v) * 2.5 + phase * 0.7);
          s += Math.sin((u - v) * 3.5 - phase * 0.9);
          s /= 4;
          let a = Math.pow(sat(s * 0.5 + 0.5), 6.5);
          const idx = (y * CAUSTIC_W + x) * 4;
          d[idx] = 180; d[idx + 1] = 240; d[idx + 2] = 255;
          d[idx + 3] = a * 190;
        }
      }
      g.putImageData(img, 0, 0);
      causticFrames.push(c);
    }
  }
  return causticFrames[((i % CAUSTIC_N) + CAUSTIC_N) % CAUSTIC_N];
}

const vignetteCache = new Map();
export function vignette(w, h, strength = 0.85, color = '#02050a') {
  const key = `${w}x${h}:${strength}:${color}`;
  if (vignetteCache.has(key)) return vignetteCache.get(key);
  const c = withCtx(w, h, (g) => {
    const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    grd.addColorStop(0, rgba(color, 0));
    grd.addColorStop(0.55, rgba(color, strength * 0.24));
    grd.addColorStop(1, rgba(color, strength));
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  vignetteCache.set(key, c);
  return c;
}

let noiseTex = null;
export function grainTexture() {
  if (noiseTex) return noiseTex;
  const S = 180;
  noiseTex = withCtx(S, S, (g) => {
    const img = g.createImageData(S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 20;
    }
    g.putImageData(img, 0, 0);
  });
  return noiseTex;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --------------------------------------------------------------- draw helpers

/**
 * Soft elliptical ground shadow. A radial gradient stands in for a blur —
 * `ctx.filter` costs a full-surface readback per call, and every actor draws one.
 */
export function drawShadow(ctx, x, y, rx, ry, alpha = 0.42) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.25, 0, 0, rx * 1.25);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.62, `rgba(0,0,0,${alpha * 0.72})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 1.25, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Rounded polygon path builder — the base shape language for every creature. */
export function blobPath(ctx, pts, close = true) {
  if (pts.length < 3) return;
  ctx.beginPath();
  const n = pts.length;
  let prev = pts[n - 1];
  ctx.moveTo((prev[0] + pts[0][0]) / 2, (prev[1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  if (close) ctx.closePath();
}

/** Irregular organic blob — deterministic per `seed`, wobbling with `t`. */
export function organicBlob(ctx, cx, cy, r, seed, t = 0, lobes = 9, wob = 0.22) {
  const pts = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * TAU;
    const n = noise1(seed + i * 3.17 + t) * wob + 1;
    pts.push([cx + Math.cos(a) * r * n, cy + Math.sin(a) * r * n]);
  }
  blobPath(ctx, pts);
}

/** Fill + rim-light + dark outline: the shared look for every creature body. */
export function shapeStyle(ctx, cx, cy, r, base, opts = {}) {
  const {
    lightDir = -Math.PI / 2.4, rim = 0.55, outline = '#04080f', outlineW = 3.2, glow = null,
  } = opts;
  const lx = cx + Math.cos(lightDir) * r * 0.55;
  const ly = cy + Math.sin(lightDir) * r * 0.55;
  const grd = ctx.createRadialGradient(lx, ly, r * 0.05, cx, cy, r * 1.25);
  grd.addColorStop(0, shade(base, 0.35 * rim));
  grd.addColorStop(0.45, base);
  grd.addColorStop(1, shade(base, -0.5));
  ctx.fillStyle = grd;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  if (outlineW > 0) {
    ctx.lineWidth = outlineW;
    ctx.strokeStyle = outline;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function glowDot(ctx, x, y, r, color, intensity = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, 0.95 * intensity));
  g.addColorStop(0.35, rgba(color, 0.5 * intensity));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Tapered limb / tentacle drawn as a quadratic ribbon. */
export function limb(ctx, x0, y0, x1, y1, bend, w0, w1, color, outline = '#04080f') {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = mx + nx * bend, cy = my + ny * bend;

  const steps = 10;
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
    const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
    const tx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
    const ty = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
    const tl = Math.hypot(tx, ty) || 1;
    const w = lerp(w0, w1, t) / 2;
    left.push([px - ty / tl * w, py + tx / tl * w]);
    right.push([px + ty / tl * w, py - tx / tl * w]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
}

/** Star / spike burst polygon (crystals, coral, crowns). */
export function starPath(ctx, cx, cy, points, rOuter, rInner, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i / (points * 2)) * TAU;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * God sigils, drawn into a 40×40 unit box centred at the origin.
 * `lw` is in screen pixels — it is divided back out of the glyph scale so a
 * 20px chip and a 130px title emblem keep the same line weight feel.
 */
export function drawGlyph(ctx, glyph, x, y, size, color, lw = 2.6) {
  const k = size / 20;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw / k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (glyph) {
    case 'wave':
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const px = -14 + t * 28;
          const py = -6 + r * 7 + Math.sin(t * TAU) * 3.4;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.bezierCurveTo(9, -6, 11, 4, 0, 14);
      ctx.bezierCurveTo(-11, 4, -9, -6, 0, -15);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.bezierCurveTo(5, 0, 5, 6, 0, 10);
      ctx.bezierCurveTo(-5, 6, -5, 0, 0, -5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'crystal':
      ctx.beginPath();
      ctx.moveTo(0, -15); ctx.lineTo(9, -3); ctx.lineTo(5, 14);
      ctx.lineTo(-5, 14); ctx.lineTo(-9, -3); ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(9, -3); ctx.stroke();
      break;
    case 'ripple':
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 4.6, -Math.PI * 0.78, Math.PI * 0.78);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(-2, 0, 2.2, 0, TAU); ctx.fill();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-14, 8); ctx.lineTo(-11, -8); ctx.lineTo(-5, 1);
      ctx.lineTo(0, -13); ctx.lineTo(5, 1); ctx.lineTo(11, -8);
      ctx.lineTo(14, 8); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-14, 10); ctx.lineTo(14, 10);
      ctx.stroke();
      break;
    case 'skull':
      ctx.beginPath(); ctx.arc(0, -3, 10, Math.PI, 0); ctx.lineTo(9, 5);
      ctx.lineTo(4, 5); ctx.lineTo(4, 11); ctx.lineTo(-4, 11);
      ctx.lineTo(-4, 5); ctx.lineTo(-9, 5); ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-4.5, -2, 2.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(4.5, -2, 2.6, 0, TAU); ctx.fill();
      break;
    case 'coin':
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.stroke();
      break;
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.bezierCurveTo(-16, 0, -11, -13, 0, -5);
      ctx.bezierCurveTo(11, -13, 16, 0, 0, 12);
      ctx.closePath();
      ctx.fill();
      break;
    case 'shard':
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(8, 0); ctx.lineTo(0, 14); ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(4, 0); ctx.lineTo(0, 8); ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'anvil':
      ctx.beginPath();
      ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.lineTo(7, 1);
      ctx.lineTo(4, 1); ctx.lineTo(6, 10); ctx.lineTo(-6, 10);
      ctx.lineTo(-4, 1); ctx.lineTo(-8, 1); ctx.closePath();
      ctx.stroke();
      break;
    case 'door':
      ctx.beginPath();
      ctx.moveTo(-10, 13); ctx.lineTo(-10, -6);
      ctx.arc(0, -6, 10, Math.PI, 0);
      ctx.lineTo(10, 13); ctx.closePath();
      ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

/** Telegraph fill colour ramp: cool warning -> hot imminent. */
export function telegraphColor(progress, base = '#ff9a3c') {
  return mixHex('#ffe9a8', base, sat(progress));
}
