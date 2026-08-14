// 타격 연출: 파티클, 임팩트 스파크, 데미지 팝업, 히트스톱, 화면 흔들림, 플래시.

import { rand, randInt, rgba, VW, VH } from './core.js';

export const FX = {
  parts: [], pops: [], sparks: [], rings: [],
  shakeT: 0, shakeMag: 0, shakeX: 0, shakeY: 0,
  hitstop: 0, flashA: 0, flashCol: '#ffffff', zoom: 0, zoomX: 0, zoomY: 0,
};

export function fxReset() {
  FX.parts.length = 0; FX.pops.length = 0; FX.sparks.length = 0; FX.rings.length = 0;
  FX.shakeT = 0; FX.hitstop = 0; FX.flashA = 0; FX.zoom = 0;
}

export function shake(mag, t = 10) {
  if (mag > FX.shakeMag || FX.shakeT < 4) { FX.shakeMag = Math.max(FX.shakeMag, mag); FX.shakeT = Math.max(FX.shakeT, t); }
}
export function hitstop(f) { FX.hitstop = Math.max(FX.hitstop, f); }
export function flash(a = 0.8, col = '#ffffff') { FX.flashA = Math.max(FX.flashA, a); FX.flashCol = col; }

export function popup(x, y, text, kind = 'dmg') {
  FX.pops.push({ x, y, vy: -1.5, life: 44, text, kind, t: 0 });
}

const SPARK_STYLE = {
  light: { n: 5, r: 8, col: '#fff6c8', col2: '#ffb43c', life: 9, ring: 0 },
  mid: { n: 7, r: 13, col: '#ffffff', col2: '#ff9a2e', life: 12, ring: 10 },
  heavy: { n: 9, r: 19, col: '#ffffff', col2: '#ff6a2c', life: 15, ring: 20 },
  burst: { n: 13, r: 27, col: '#ffffff', col2: '#ff3c5a', life: 20, ring: 34 },
  block: { n: 6, r: 11, col: '#cfe8ff', col2: '#3f8fd8', life: 10, ring: 12 },
  ki: { n: 8, r: 15, col: '#e6f4ff', col2: '#3fa0ff', life: 13, ring: 16 },
};

export function spark(x, y, kind = 'light') {
  const s = SPARK_STYLE[kind] || SPARK_STYLE.light;
  FX.sparks.push({ x, y, t: 0, life: s.life, s, rot: rand(0, 6.28) });
  if (s.ring) FX.rings.push({ x, y, t: 0, life: 14, r0: 3, r1: s.ring, col: s.col2 });
  for (let i = 0; i < s.n; i++) {
    const a = rand(0, 6.28), sp = rand(1.2, 4.2);
    FX.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, g: 0.14,
      life: randInt(10, 22), t: 0, r: rand(1, 2.4), col: i % 2 ? s.col : s.col2, kind: 'spark',
    });
  }
}

export function dust(x, y, n = 5, col = '#c9bda8') {
  for (let i = 0; i < n; i++) {
    const a = rand(-3.14, 0);
    FX.parts.push({
      x: x + rand(-4, 4), y, vx: Math.cos(a) * rand(0.4, 1.6), vy: Math.sin(a) * rand(0.2, 0.9),
      g: 0.02, life: randInt(14, 26), t: 0, r: rand(1.4, 3.2), col, kind: 'dust',
    });
  }
}

export function debris(x, y, n = 8, col = '#8a7a62') {
  for (let i = 0; i < n; i++) {
    const a = rand(-2.9, -0.25);
    FX.parts.push({
      x, y, vx: Math.cos(a) * rand(1, 3.4), vy: Math.sin(a) * rand(1.4, 3.6), g: 0.2,
      life: randInt(22, 40), t: 0, r: rand(1.2, 3), col, kind: 'debris', rot: rand(0, 6.28), vr: rand(-0.3, 0.3),
    });
  }
}

export function embers(x, y, n = 4, col = '#ff8a2c') {
  for (let i = 0; i < n; i++) {
    FX.parts.push({
      x: x + rand(-8, 8), y, vx: rand(-0.3, 0.3), vy: rand(-1.4, -0.4), g: -0.008,
      life: randInt(30, 70), t: 0, r: rand(0.8, 1.8), col, kind: 'ember',
    });
  }
}

export function trail(x, y, col = '#6fd0ff', r = 3) {
  FX.parts.push({ x, y, vx: rand(-0.2, 0.2), vy: rand(-0.3, 0.1), g: 0, life: 12, t: 0, r, col, kind: 'glow' });
}

export function updateFx() {
  if (FX.hitstop > 0) { FX.hitstop--; return; }
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.t++;
    p.x += p.vx; p.y += p.vy; p.vy += p.g;
    if (p.kind === 'debris') p.rot += p.vr;
    if (p.kind === 'dust') { p.vx *= 0.94; p.vy *= 0.94; }
    if (p.t >= p.life) FX.parts.splice(i, 1);
  }
  for (let i = FX.pops.length - 1; i >= 0; i--) {
    const p = FX.pops[i];
    p.t++; p.y += p.vy; p.vy *= 0.9;
    if (p.t >= p.life) FX.pops.splice(i, 1);
  }
  for (let i = FX.sparks.length - 1; i >= 0; i--) {
    const s = FX.sparks[i]; s.t++;
    if (s.t >= s.life) FX.sparks.splice(i, 1);
  }
  for (let i = FX.rings.length - 1; i >= 0; i--) {
    const r = FX.rings[i]; r.t++;
    if (r.t >= r.life) FX.rings.splice(i, 1);
  }
  if (FX.shakeT > 0) {
    FX.shakeT--;
    const m = FX.shakeMag * (FX.shakeT / 12);
    FX.shakeX = rand(-m, m); FX.shakeY = rand(-m, m) * 0.6;
    if (FX.shakeT === 0) { FX.shakeMag = 0; FX.shakeX = FX.shakeY = 0; }
  }
  if (FX.flashA > 0) FX.flashA = Math.max(0, FX.flashA - 0.075);
  if (FX.zoom > 0) FX.zoom = Math.max(0, FX.zoom - 0.012);
}

export function drawParticles(ctx, cam) {
  for (const p of FX.parts) {
    const a = 1 - p.t / p.life;
    const x = p.x - cam, y = p.y;
    if (p.kind === 'spark') {
      ctx.fillStyle = rgba(p.col, a);
      ctx.fillRect(x - p.r / 2, y - p.r / 2, p.r, p.r);
      ctx.fillStyle = rgba(p.col, a * 0.4);
      ctx.fillRect(x - p.vx, y - p.vy, p.r * 0.8, p.r * 0.8);
    } else if (p.kind === 'debris') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
      ctx.fillStyle = rgba(p.col, a);
      ctx.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4);
      ctx.restore();
    } else if (p.kind === 'ember' || p.kind === 'glow') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(p.col, a * 0.9);
      ctx.beginPath(); ctx.arc(x, y, p.r * (p.kind === 'glow' ? 1.6 * a + 0.6 : 1), 0, 6.284); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = rgba(p.col, a * 0.7);
      ctx.beginPath(); ctx.arc(x, y, p.r * (1 + p.t * 0.04), 0, 6.284); ctx.fill();
    }
  }
  for (const r of FX.rings) {
    const u = r.t / r.life;
    ctx.strokeStyle = rgba(r.col, (1 - u) * 0.9);
    ctx.lineWidth = Math.max(1, 3 * (1 - u));
    ctx.beginPath(); ctx.arc(r.x - cam, r.y, r.r0 + (r.r1 - r.r0) * u, 0, 6.284); ctx.stroke();
  }
  for (const s of FX.sparks) {
    const u = s.t / s.life;
    const R = s.s.r * (0.5 + u * 1.1);
    const x = s.x - cam, y = s.y;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(s.s.col2, 1 - u);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = s.rot + (i * Math.PI) / 4;
      const rr = i % 2 ? R * 0.36 : R;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.9;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(s.s.col, (1 - u) * 0.95);
    ctx.beginPath(); ctx.arc(x, y, R * 0.34, 0, 6.284); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

const POP_COL = {
  dmg: ['#fff2c4', '#e07a2c'], big: ['#ffffff', '#e03c3c'],
  heal: ['#d8ffd0', '#3aa84a'], meter: ['#d6f0ff', '#2f7fd8'],
  score: ['#ffe9a8', '#b8862c'], secret: ['#ffd6ff', '#a24ae0'],
};

export function drawPopups(ctx, cam, scale, font) {
  for (const p of FX.pops) {
    const u = p.t / p.life;
    const a = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    const [fg, bg] = POP_COL[p.kind] || POP_COL.dmg;
    const size = (p.kind === 'big' || p.kind === 'secret' ? 15 : 12) * scale;
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'center';
    const x = (p.x - cam) * scale, y = p.y * scale;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#160f18';
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) ctx.fillText(p.text, x + dx, y + dy);
    ctx.fillStyle = bg; ctx.fillText(p.text, x, y + 1);
    ctx.fillStyle = fg; ctx.fillText(p.text, x, y);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

export function drawFlash(ctx, w, h) {
  if (FX.flashA <= 0) return;
  ctx.fillStyle = rgba(FX.flashCol, Math.min(1, FX.flashA));
  ctx.fillRect(0, 0, w, h);
}
