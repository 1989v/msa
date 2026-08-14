// 스테이지 배경: 시드 기반 절차 생성 후 레이어 캔버스로 굽는다.
// 레이어는 가로로 타일링되며 각자 시차(parallax) 계수를 가진다.
//
// 세로 레이아웃
//   0 ─ 배경(하늘/원경/중경/근경) ─ HZ(162) : 여기까지가 벽면
//   FLOOR_TOP(158) ─ 바닥 레이어 ─ 270
//   GROUND_TOP(176) ~ GROUND_BOT(254) : 캐릭터가 실제로 걷는 벨트

import { makeCanvas, mulberry32, rgba, shade, VW, VH, GROUND_TOP, GROUND_BOT } from './core.js';

const TILE = 720;
export const HZ = 162;           // 배경 벽면 하단
const FLOOR_TOP = 158;
const FLOOR_H = VH - FLOOR_TOP;
const FT = GROUND_TOP - FLOOR_TOP;   // 바닥 캔버스 내부에서 벨트 상단까지

const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); };
const P = (ctx, pts, c) => {
  ctx.fillStyle = c; ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
};
const glow = (ctx, x, y, r, c, a = 0.5) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
};
const speckle = (ctx, x, y, w, h, col, n, rng, a = 0.14) => {
  ctx.fillStyle = rgba(col, a);
  for (let i = 0; i < n; i++) ctx.fillRect((x + rng() * w) | 0, (y + rng() * h) | 0, 1 + (rng() < 0.2 ? 1 : 0), 1);
};
function windows(ctx, x, y, w, h, rng, cols, cell = 7, lit = 0.4) {
  for (let wy = y + 3; wy < y + h - 4; wy += cell) {
    for (let wx = x + 3; wx < x + w - 4; wx += cell) {
      if (rng() < lit) R(ctx, wx, wy, cell - 4, cell - 4, cols[(rng() * cols.length) | 0]);
      else R(ctx, wx, wy, cell - 4, cell - 4, 'rgba(10,12,24,0.55)');
    }
  }
}

// ═══════════════ 항만 ═══════════════

function harborSky() {
  const { c, ctx } = makeCanvas(VW, VH);
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, '#080c1e'); g.addColorStop(0.4, '#182148');
  g.addColorStop(0.75, '#373c68'); g.addColorStop(1, '#5a5480');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, HZ);
  const rng = mulberry32(11);
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = rgba('#dfe6ff', 0.18 + rng() * 0.7);
    ctx.fillRect((rng() * VW) | 0, (rng() * 100) | 0, 1, 1);
  }
  glow(ctx, 372, 40, 60, '#e8e4ff', 0.3);
  ctx.fillStyle = '#efeaff'; ctx.beginPath(); ctx.arc(372, 40, 14, 0, 6.284); ctx.fill();
  ctx.fillStyle = '#d4cdea'; ctx.beginPath(); ctx.arc(377, 36, 3.2, 0, 6.284); ctx.fill();
  ctx.beginPath(); ctx.arc(366, 46, 2, 0, 6.284); ctx.fill();
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = rgba('#6a6a98', 0.16 + rng() * 0.14);
    ctx.beginPath(); ctx.ellipse(rng() * VW, 52 + rng() * 70, 70 + rng() * 140, 5 + rng() * 5, 0, 0, 6.284); ctx.fill();
  }
  return c;
}

function harborFar() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(23);
  const B = 156;
  const lit = ['#ffd88a', '#ffe9b0', '#8ad4ff', '#ff9c6a'];
  ctx.strokeStyle = '#0e1330'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 124);
  for (let i = 0; i <= TILE; i += 12) ctx.lineTo(i, 124 - Math.sin((i / TILE) * Math.PI * 2) * 12);
  ctx.stroke();
  for (const px of [120, 470]) { R(ctx, px, 86, 5, 60, '#0e1330'); R(ctx, px - 6, 90, 17, 3, '#0e1330'); }
  let x = -20;
  while (x < TILE + 20) {
    const w = 26 + rng() * 46, h = 36 + rng() * 76;
    const y = B - h;
    R(ctx, x, y, w, h, '#151b3a');
    R(ctx, x, y, w * 0.32, h, '#1c2346');
    windows(ctx, x, y, w, h, rng, lit, 8, 0.26);
    if (rng() < 0.3) { R(ctx, x + w * 0.4, y - 11, 2, 11, '#151b3a'); R(ctx, x + w * 0.4 - 1, y - 13, 4, 3, '#ff5a4a'); }
    x += w + rng() * 10;
  }
  R(ctx, 0, B, TILE, HZ - B, '#121938');
  return c;
}

function harborMid() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(37);
  const W = 118;                        // 수면 시작
  const g = ctx.createLinearGradient(0, W, 0, HZ);
  g.addColorStop(0, '#18274e'); g.addColorStop(1, '#2d3c6a');
  ctx.fillStyle = g; ctx.fillRect(0, W, TILE, HZ - W);
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = rgba(rng() < 0.3 ? '#ffd88a' : '#7fa6e8', 0.1 + rng() * 0.4);
    ctx.fillRect((rng() * TILE) | 0, (W + 2 + rng() * (HZ - W - 4)) | 0, 3 + rng() * 12, 1);
  }
  const crane = (bx) => {
    R(ctx, bx, 66, 4, 96, '#2b3550'); R(ctx, bx + 40, 66, 4, 96, '#2b3550');
    R(ctx, bx - 4, 60, 52, 8, '#39445f');
    R(ctx, bx - 36, 52, 100, 5, '#39445f');
    R(ctx, bx + 60, 52, 4, 24, '#2b3550');
    ctx.strokeStyle = '#4b5878'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + 20, 58); ctx.lineTo(bx + 20, 92); ctx.stroke();
    R(ctx, bx + 14, 92, 13, 9, '#5d4a30');
    glow(ctx, bx + 24, 54, 16, '#ffce6a', 0.35);
    R(ctx, bx + 22, 52, 3, 3, '#ffe1a0');
  };
  crane(70); crane(390); crane(600);
  const ship = (bx) => {
    P(ctx, [[bx, 128], [bx + 130, 128], [bx + 120, 152], [bx + 12, 152]], '#20273c');
    R(ctx, bx + 84, 106, 26, 22, '#2e3852');
    windows(ctx, bx + 86, 108, 22, 12, rng, ['#ffe0a0'], 6, 0.6);
    for (let i = 0; i < 5; i++) R(ctx, bx + 14 + i * 13, 115, 12, 13, i % 2 ? '#6a3f3a' : '#3f5a6a');
    R(ctx, bx + 100, 88, 2, 18, '#2e3852');
    R(ctx, bx + 99, 86, 4, 3, '#ff6a5a');
    ctx.fillStyle = rgba('#ffd88a', 0.16);
    ctx.fillRect(bx + 10, 152, 120, 8);
  };
  ship(200); ship(520);
  return c;
}

function harborNear(variant) {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(51 + variant * 7);
  const B = HZ;
  // 부두 뒷벽
  R(ctx, 0, B - 26, TILE, 26, '#2a2f42');
  R(ctx, 0, B - 26, TILE, 3, '#3f4660');
  for (let x = 0; x < TILE; x += 24) R(ctx, x, B - 23, 2, 23, '#232838');
  speckle(ctx, 0, B - 26, TILE, 26, '#0d1018', 260, rng, 0.3);

  const cols = ['#b8562f', '#2f6f8a', '#7a8f3a', '#8a3a4a', '#c08a2a', '#3a5f8a'];
  const container = (x, y, w, h, col) => {
    R(ctx, x, y, w, h, col);
    R(ctx, x, y, w, 2, shade(col, 1.3));
    R(ctx, x, y + h - 3, w, 3, shade(col, 0.6));
    for (let i = 3; i < w - 3; i += 5) R(ctx, x + i, y + 3, 2, h - 7, shade(col, 0.86));
    R(ctx, x + 2, y + 2, 1, h - 4, shade(col, 1.2));
    R(ctx, x + w * 0.5 - 7, y + h * 0.36, 14, 6, shade(col, 0.5));
    speckle(ctx, x, y, w, h, '#20161a', 26, rng, 0.2);
  };
  if (variant === 0) {
    for (let x = -20; x < TILE; x += 78 + rng() * 46) {
      const w = 54 + rng() * 26;
      container(x, B - 56, w, 30, cols[(rng() * 6) | 0]);
      if (rng() < 0.5) container(x + 4, B - 86, w - 8, 30, cols[(rng() * 6) | 0]);
    }
  } else if (variant === 1) {
    for (let x = -30; x < TILE; x += 96 + rng() * 40) {
      const stack = 2 + ((rng() * 2) | 0);
      for (let s = 0; s < stack; s++) container(x + s * 3, B - 26 - 30 * (s + 1), 62 - s * 5, 30, cols[(rng() * 6) | 0]);
    }
  } else {
    // 등대 광장
    R(ctx, 300, 28, 34, B - 54, '#d8d2c4');
    for (let i = 0; i < 6; i++) R(ctx, 300, 34 + i * 18, 34, 7, '#b8342c');
    P(ctx, [[296, 28], [338, 28], [330, 14], [304, 14]], '#8f9aa8');
    R(ctx, 306, -2, 22, 17, '#2a3242');
    glow(ctx, 317, 8, 44, '#ffe08a', 0.55);
    R(ctx, 308, 2, 18, 10, '#ffeeb8');
    P(ctx, [[326, 2], [430, -18], [430, 34], [326, 12]], rgba('#ffe08a', 0.1));
    for (let x = -20; x < TILE; x += 150) if (Math.abs(x - 300) > 90) container(x, B - 56, 58, 30, cols[(rng() * 6) | 0]);
  }
  // 가로등
  for (let x = 40; x < TILE; x += 190) {
    R(ctx, x, B - 78, 3, 78, '#20263a');
    R(ctx, x - 7, B - 82, 17, 5, '#2b3348');
    glow(ctx, x + 1, B - 76, 40, '#ffd88a', 0.3);
    R(ctx, x - 4, B - 78, 11, 3, '#ffe6ae');
  }
  return c;
}

function harborFloor(variant) {
  const { c, ctx } = makeCanvas(TILE, FLOOR_H);
  const rng = mulberry32(71 + variant * 3);
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_H);
  g.addColorStop(0, '#3f4054'); g.addColorStop(0.28, '#585868'); g.addColorStop(1, '#3a3a4a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TILE, FLOOR_H);
  R(ctx, 0, 0, TILE, 3, '#22222f');
  R(ctx, 0, 3, TILE, 2, '#6a6a80');
  for (let x = 0; x < TILE; x += 46) { ctx.fillStyle = 'rgba(24,24,34,0.4)'; ctx.fillRect(x, 5, 1, FLOOR_H); }
  for (let y = 14; y < FLOOR_H; y += 20) { ctx.fillStyle = 'rgba(24,24,34,0.28)'; ctx.fillRect(0, y, TILE, 1); }
  speckle(ctx, 0, 5, TILE, FLOOR_H, '#1a1a26', 900, rng, 0.22);
  speckle(ctx, 0, 5, TILE, FLOOR_H, '#8a8aa0', 380, rng, 0.14);
  for (let i = 0; i < 10; i++) {
    const x = rng() * TILE, y = FT + 8 + rng() * (FLOOR_H - FT - 18), w = 24 + rng() * 44;
    ctx.fillStyle = rgba('#7f9fd8', 0.2);
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, 4 + rng() * 3, 0, 0, 6.284); ctx.fill();
    ctx.fillStyle = rgba('#cfe0ff', 0.2); ctx.fillRect(x - w / 4, y - 1, w / 2, 1);
  }
  ctx.fillStyle = rgba('#d8b03a', 0.5);
  for (let x = 0; x < TILE; x += 16) ctx.fillRect(x, FT + 2, 9, 2);
  return c;
}

// ═══════════════ 용광로 ═══════════════

function foundrySky() {
  const { c, ctx } = makeCanvas(VW, VH);
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, '#140b0d'); g.addColorStop(0.45, '#2a1512');
  g.addColorStop(0.8, '#4a2216'); g.addColorStop(1, '#63301a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, HZ);
  glow(ctx, 240, HZ + 10, 200, '#ff7a2c', 0.3);
  ctx.strokeStyle = '#1a1012'; ctx.lineWidth = 2;
  for (let x = -20; x < VW + 20; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 26); ctx.lineTo(x + 60, 0); ctx.stroke();
  }
  R(ctx, 0, 24, VW, 5, '#1a1012');
  for (let i = 0; i < 5; i++) {
    const x = 40 + i * 100;
    R(ctx, x, 29, 2, 14, '#241618');
    R(ctx, x - 6, 43, 14, 6, '#3a2418');
    glow(ctx, x + 1, 48, 32, '#ffb44a', 0.35);
    R(ctx, x - 4, 46, 10, 3, '#ffd98a');
  }
  return c;
}

function foundryFar() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(103);
  R(ctx, 0, 34, TILE, HZ - 34, '#241417');
  speckle(ctx, 0, 34, TILE, HZ - 34, '#120a0c', 520, rng, 0.4);
  for (const bx of [110, 470]) {
    R(ctx, bx, 44, 96, HZ - 44, '#33191a');
    R(ctx, bx, 44, 96, 5, '#472220');
    R(ctx, bx + 18, 82, 60, 56, '#1a0d0e');
    const g2 = ctx.createLinearGradient(0, 82, 0, 138);
    g2.addColorStop(0, '#ffcf6a'); g2.addColorStop(0.5, '#ff7a1c'); g2.addColorStop(1, '#c62c10');
    ctx.fillStyle = g2; ctx.fillRect(bx + 22, 86, 52, 48);
    glow(ctx, bx + 48, 110, 74, '#ff8a2c', 0.5);
    for (let i = 0; i < 6; i++) R(ctx, bx + 6 + i * 15, 50, 10, 26, '#42201e');
    R(ctx, bx - 8, 40, 112, 6, '#3d1d1c');
  }
  R(ctx, 0, 68, TILE, 4, '#2c1a1a');
  for (let x = 0; x < TILE; x += 26) R(ctx, x, 72, 2, 10, '#2c1a1a');
  R(ctx, 0, 58, TILE, 2, '#3a2422');
  for (let x = 0; x < TILE; x += 9) R(ctx, x, 60, 1, 8, '#3a2422');
  return c;
}

function foundryMid() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(117);
  const pipe = (y, h, col) => {
    R(ctx, 0, y, TILE, h, col);
    R(ctx, 0, y, TILE, 2, shade(col, 1.35));
    R(ctx, 0, y + h - 3, TILE, 3, shade(col, 0.6));
    for (let x = 20; x < TILE; x += 96) { R(ctx, x, y - 2, 9, h + 4, shade(col, 0.82)); R(ctx, x, y - 2, 9, 2, shade(col, 1.2)); }
  };
  pipe(74, 16, '#5a4038'); pipe(100, 11, '#463a44');
  for (let x = 46; x < TILE; x += 128) {
    ctx.strokeStyle = '#6a5148'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, 82, 8, 0, 6.284); ctx.stroke();
    R(ctx, x - 1, 74, 2, 16, '#6a5148');
    R(ctx, x - 8, 74, 16, 2, '#6a5148');
  }
  for (let x = 90; x < TILE; x += 150) {
    ctx.fillStyle = '#2a1c1c'; ctx.beginPath(); ctx.arc(x, 120, 7, 0, 6.284); ctx.fill();
    ctx.fillStyle = '#d8c88a'; ctx.beginPath(); ctx.arc(x, 120, 5, 0, 6.284); ctx.fill();
    ctx.strokeStyle = '#a02c1c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x + 3, 116); ctx.stroke();
  }
  R(ctx, 0, 128, TILE, 12, '#3a2a26');
  R(ctx, 0, 128, TILE, 2, '#584038');
  for (let x = 0; x < TILE; x += 14) R(ctx, x, 131, 7, 6, '#2a1e1c');
  for (let x = 8; x < TILE; x += 40) { ctx.fillStyle = '#4a3630'; ctx.beginPath(); ctx.arc(x, 142, 5, 0, 6.284); ctx.fill(); }
  for (let x = 10; x < TILE; x += 190) {
    R(ctx, x, HZ - 34, 54, 34, '#3d2a26');
    R(ctx, x, HZ - 34, 54, 3, '#553a32');
    R(ctx, x + 6, HZ - 28, 16, 12, '#1c1210');
    R(ctx, x + 8, HZ - 26, 12, 8, rng() < 0.5 ? '#ff8a2c' : '#4ad86a');
    for (let i = 0; i < 3; i++) R(ctx, x + 28 + i * 8, HZ - 26, 5, 5, '#c8442a');
    R(ctx, x + 26, HZ - 14, 24, 8, '#2a1c18');
  }
  return c;
}

function foundryNear(variant) {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(131 + variant * 5);
  const B = HZ;
  R(ctx, 0, B - 24, TILE, 24, '#2e1e1c');
  R(ctx, 0, B - 24, TILE, 3, '#4a2e28');
  speckle(ctx, 0, B - 24, TILE, 24, '#120a0a', 300, rng, 0.35);
  ctx.save(); ctx.beginPath(); ctx.rect(0, B - 24, TILE, 7); ctx.clip();
  for (let x = -20; x < TILE + 20; x += 14) P(ctx, [[x, B - 17], [x + 7, B - 24], [x + 14, B - 24], [x + 7, B - 17]], '#c8a02a');
  ctx.restore();

  if (variant === 0) {
    for (let x = 20; x < TILE; x += 110) {
      R(ctx, x, B - 70, 30, 46, '#4a3028');
      R(ctx, x, B - 70, 30, 3, '#634034');
      R(ctx, x + 4, B - 64, 22, 16, '#1a0e0c');
      glow(ctx, x + 15, B - 56, 22, '#ff9a3c', 0.4);
      R(ctx, x + 6, B - 62, 18, 12, '#ff9a3c');
      R(ctx, x + 8, B - 44, 14, 20, '#38241e');
    }
  } else if (variant === 1) {
    R(ctx, 0, B - 40, TILE, 16, '#2a1512');
    const g2 = ctx.createLinearGradient(0, B - 38, 0, B - 26);
    g2.addColorStop(0, '#ffdf8a'); g2.addColorStop(0.5, '#ff8a1c'); g2.addColorStop(1, '#b8280c');
    ctx.fillStyle = g2; ctx.fillRect(0, B - 38, TILE, 12);
    glow(ctx, TILE / 2, B - 32, 240, '#ff7a2c', 0.35);
    for (let x = 0; x < TILE; x += 60) R(ctx, x, B - 42, 8, 20, '#3a201a');
  } else {
    R(ctx, 250, 28, 120, B - 52, '#3a201c');
    R(ctx, 244, 24, 132, 8, '#523028');
    P(ctx, [[262, 32], [358, 32], [346, B - 24], [274, B - 24]], '#1c0e0c');
    const g3 = ctx.createLinearGradient(0, 36, 0, B - 24);
    g3.addColorStop(0, '#fff0b0'); g3.addColorStop(0.4, '#ff9a2c'); g3.addColorStop(1, '#a8200c');
    ctx.fillStyle = g3; ctx.fillRect(266, 36, 88, B - 62);
    glow(ctx, 310, 90, 120, '#ff8a2c', 0.5);
    for (const bx of [60, 520]) {
      R(ctx, bx, B - 66, 40, 42, '#42261f'); R(ctx, bx, B - 66, 40, 3, '#5c342a');
      R(ctx, bx + 6, B - 58, 28, 18, '#180d0b');
    }
  }
  for (let x = 60; x < TILE; x += 240) {
    R(ctx, x, B - 74, 4, 50, '#241614');
    R(ctx, x - 8, B - 78, 20, 5, '#33201c');
    glow(ctx, x + 2, B - 72, 34, '#ffb45a', 0.3);
    R(ctx, x - 5, B - 74, 14, 3, '#ffd08a');
  }
  return c;
}

function foundryFloor(variant) {
  const { c, ctx } = makeCanvas(TILE, FLOOR_H);
  const rng = mulberry32(151 + variant);
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_H);
  g.addColorStop(0, '#42302a'); g.addColorStop(0.28, '#5a4034'); g.addColorStop(1, '#31221d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TILE, FLOOR_H);
  R(ctx, 0, 0, TILE, 3, '#1c1210');
  R(ctx, 0, 3, TILE, 2, '#7a5a44');
  for (let y = 10; y < FLOOR_H; y += 8) { ctx.fillStyle = 'rgba(20,12,10,0.42)'; ctx.fillRect(0, y, TILE, 2); }
  for (let x = 0; x < TILE; x += 30) { ctx.fillStyle = 'rgba(20,12,10,0.32)'; ctx.fillRect(x, 5, 2, FLOOR_H); }
  for (let x = 6; x < TILE; x += 30) for (let y = 12; y < FLOOR_H; y += 24) {
    ctx.fillStyle = 'rgba(150,116,82,0.3)'; ctx.fillRect(x, y, 2, 2);
  }
  speckle(ctx, 0, 5, TILE, FLOOR_H, '#180e0b', 800, rng, 0.24);
  speckle(ctx, 0, 5, TILE, FLOOR_H, '#ff9a4a', 160, rng, 0.1);
  if (variant === 1) {
    ctx.fillStyle = rgba('#ff7a2c', 0.13);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath(); ctx.ellipse(rng() * TILE, FT + 20 + rng() * 40, 26, 5, 0, 0, 6.284); ctx.fill();
    }
  }
  return c;
}

// ═══════════════ 설산 사원 ═══════════════

function shrineSky() {
  const { c, ctx } = makeCanvas(VW, VH);
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, '#213056'); g.addColorStop(0.4, '#4a5f88');
  g.addColorStop(0.75, '#8296b4'); g.addColorStop(1, '#c3cfdc');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, HZ);
  const rng = mulberry32(181);
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = rgba('#e6eef8', 0.1 + rng() * 0.12);
    ctx.beginPath(); ctx.ellipse(rng() * VW, 16 + rng() * 84, 50 + rng() * 90, 7 + rng() * 8, 0, 0, 6.284); ctx.fill();
  }
  glow(ctx, 110, 44, 68, '#ffe8c8', 0.22);
  return c;
}

function shrineFar() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(193);
  const range = (baseY, h, col, snow) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, baseY);
    let x = -10; const pts = [];
    while (x < TILE + 20) {
      const py = baseY - (0.35 + rng() * 0.65) * h;
      pts.push([x, py]); ctx.lineTo(x, py);
      x += 40 + rng() * 60;
    }
    ctx.lineTo(TILE + 20, baseY); ctx.closePath(); ctx.fill();
    for (const [px, py] of pts) P(ctx, [[px, py], [px + 13, py + 16], [px + 5, py + 14], [px, py + 18], [px - 6, py + 13], [px - 13, py + 16]], snow);
  };
  range(132, 92, '#3d4d70', 'rgba(232,240,250,0.9)');
  range(146, 60, '#4f6180', 'rgba(226,236,248,0.75)');
  R(ctx, 300, 88, 46, 44, '#5c4048');
  P(ctx, [[288, 90], [358, 90], [340, 72], [306, 72]], '#7a4a48');
  P(ctx, [[296, 74], [350, 74], [338, 60], [308, 60]], '#8a5450');
  R(ctx, 320, 46, 4, 16, '#5c4048');
  ctx.fillStyle = 'rgba(240,246,252,0.85)';
  ctx.fillRect(288, 88, 70, 3); ctx.fillRect(296, 72, 54, 3);
  R(ctx, 0, 146, TILE, HZ - 146, '#5a6b88');
  ctx.fillStyle = 'rgba(238,244,252,0.8)'; ctx.fillRect(0, 146, TILE, 4);
  return c;
}

function shrineMid() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(211);
  const B = HZ;
  const pine = (x, y, s) => {
    R(ctx, x - 2 * s, y - 20 * s, 4 * s, 20 * s, '#3d2e28');
    for (let i = 0; i < 4; i++) {
      const w = (26 - i * 5) * s, yy = y - 18 * s - i * 11 * s;
      P(ctx, [[x - w, yy], [x + w, yy], [x, yy - 20 * s]], i % 2 ? '#22402f' : '#2a4d38');
      P(ctx, [[x - w, yy], [x + w * 0.2, yy], [x - w * 0.2, yy - 13 * s]], 'rgba(236,244,252,0.75)');
    }
  };
  for (let x = 20; x < TILE; x += 96 + rng() * 40) pine(x, B - 8, 0.7 + rng() * 0.5);
  R(ctx, 380, B - 60, 150, 60, '#6b4a4e');
  for (let i = 0; i < 5; i++) R(ctx, 392 + i * 30, B - 52, 12, 52, '#9a3f3a');
  P(ctx, [[364, B - 58], [546, B - 58], [524, B - 82], [386, B - 82]], '#7a3f3c');
  P(ctx, [[362, B - 58], [548, B - 58], [526, B - 84], [384, B - 84]], 'rgba(240,246,252,0.9)');
  P(ctx, [[384, B - 82], [524, B - 82], [516, B - 90], [392, B - 90]], '#7a3f3c');
  R(ctx, 130, B - 66, 7, 66, '#a03a34'); R(ctx, 196, B - 66, 7, 66, '#a03a34');
  R(ctx, 118, B - 72, 96, 7, '#8f2f2c'); R(ctx, 124, B - 60, 84, 5, '#8f2f2c');
  ctx.fillStyle = 'rgba(240,246,252,0.85)'; ctx.fillRect(118, B - 74, 96, 3);
  return c;
}

function shrineNear(variant) {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(227 + variant * 9);
  const B = HZ;
  R(ctx, 0, B - 24, TILE, 24, '#63707f');
  R(ctx, 0, B - 24, TILE, 4, 'rgba(240,246,252,0.9)');
  for (let x = 0; x < TILE; x += 22) R(ctx, x, B - 20, 2, 20, '#55606e');
  speckle(ctx, 0, B - 20, TILE, 20, '#3c4550', 200, rng, 0.3);

  const lantern = (x) => {
    R(ctx, x - 9, B - 32, 18, 8, '#8a8f98');
    R(ctx, x - 5, B - 60, 10, 28, '#9aa0a8');
    R(ctx, x - 11, B - 72, 22, 13, '#7f858e');
    R(ctx, x - 6, B - 69, 12, 6, '#ffca6a');
    glow(ctx, x, B - 65, 32, '#ffb44a', 0.35);
    P(ctx, [[x - 15, B - 72], [x + 15, B - 72], [x + 9, B - 82], [x - 9, B - 82]], '#8f959e');
    P(ctx, [[x - 16, B - 72], [x + 16, B - 72], [x + 10, B - 84], [x - 10, B - 84]], 'rgba(240,246,252,0.9)');
    R(ctx, x - 11, B - 74, 22, 3, 'rgba(240,246,252,0.9)');
  };
  if (variant === 0) {
    for (let x = 60; x < TILE; x += 168) lantern(x);
    for (let x = 10; x < TILE; x += 84) {
      R(ctx, x, B - 34, 5, 26, '#7a3f3c');
      P(ctx, [[x - 6, B - 66], [x + 11, B - 66], [x + 8, B - 32], [x - 3, B - 32]], '#a03a34');
      R(ctx, x - 2, B - 60, 7, 22, 'rgba(255,240,220,0.8)');
    }
  } else if (variant === 1) {
    for (let i = 0; i < 10; i++) {
      R(ctx, i * 74, B - 4 - i * 3, 78, 8 + i * 3, '#6d798a');
      R(ctx, i * 74, B - 4 - i * 3, 78, 3, 'rgba(240,246,252,0.85)');
    }
    for (let x = 30; x < TILE; x += 210) lantern(x);
  } else {
    R(ctx, 288, 4, 10, 44, '#5a4a3e');
    R(ctx, 236, 0, 116, 8, '#6b5646');
    P(ctx, [[264, 48], [322, 48], [330, B - 12], [256, B - 12]], '#7a6a4a');
    P(ctx, [[264, 48], [292, 48], [286, B - 12], [256, B - 12]], '#8f7d58');
    R(ctx, 252, B - 14, 82, 8, '#5c4f3a');
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = '#5c4f3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(293, 64 + i * 14, 34, 0.35, 2.79); ctx.stroke(); }
    lantern(90); lantern(520); lantern(640);
  }
  return c;
}

function shrineFloor(variant) {
  const { c, ctx } = makeCanvas(TILE, FLOOR_H);
  const rng = mulberry32(241 + variant);
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_H);
  g.addColorStop(0, '#a3b3c8'); g.addColorStop(0.3, '#ccd9e8'); g.addColorStop(1, '#8fa0b6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TILE, FLOOR_H);
  R(ctx, 0, 0, TILE, 3, '#5f6d80');
  R(ctx, 0, 3, TILE, 3, '#f4f9ff');
  for (let y = 10; y < FLOOR_H; y += 22) {
    for (let x = (y % 44 === 0 ? 0 : -22); x < TILE; x += 44) {
      ctx.fillStyle = 'rgba(120,138,160,0.2)'; ctx.fillRect(x + 1, y + 1, 42, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.36)'; ctx.fillRect(x + 1, y + 1, 42, 2);
    }
  }
  speckle(ctx, 0, 6, TILE, FLOOR_H, '#ffffff', 700, rng, 0.5);
  speckle(ctx, 0, 6, TILE, FLOOR_H, '#8fa0b8', 260, rng, 0.14);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = rgba('#ffffff', 0.5);
    ctx.beginPath(); ctx.ellipse(rng() * TILE, 10 + rng() * (FLOOR_H - 12), 14 + rng() * 22, 3 + rng() * 3, 0, 0, 6.284); ctx.fill();
  }
  return c;
}

// ═══════════════ 심연 (히든) ═══════════════

function abyssSky() {
  const { c, ctx } = makeCanvas(VW, VH);
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, '#06040d'); g.addColorStop(0.5, '#150a26'); g.addColorStop(1, '#2a1140');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, HZ);
  const rng = mulberry32(307);
  for (let i = 0; i < 130; i++) {
    ctx.fillStyle = rgba(rng() < 0.4 ? '#c88aff' : '#e0d8ff', 0.15 + rng() * 0.7);
    ctx.fillRect((rng() * VW) | 0, (rng() * 150) | 0, 1, 1);
  }
  glow(ctx, 240, 100, 160, '#7a2ce0', 0.3);
  return c;
}
function abyssFar() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(311);
  for (let i = 0; i < 24; i++) {
    const x = rng() * TILE, y = 30 + rng() * 110, w = 20 + rng() * 60, h = 6 + rng() * 14;
    P(ctx, [[x, y], [x + w, y - 4], [x + w * 0.8, y + h], [x + w * 0.2, y + h + 3]], '#241436');
    ctx.fillStyle = rgba('#a24ae0', 0.3); ctx.fillRect(x + 2, y - 1, w - 6, 1);
  }
  R(ctx, 0, 150, TILE, HZ - 150, '#1a0e2a');
  return c;
}
function abyssMid() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const rng = mulberry32(313);
  for (let x = 20; x < TILE; x += 120) {
    const h = 56 + rng() * 60;
    P(ctx, [[x, HZ], [x + 26, HZ], [x + 20, HZ - h], [x + 6, HZ - h]], '#2c1a44');
    ctx.fillStyle = rgba('#a24ae0', 0.4); ctx.fillRect(x + 8, HZ - h + 4, 3, h - 10);
    glow(ctx, x + 13, HZ - h, 30, '#a24ae0', 0.3);
  }
  return c;
}
function abyssNear() {
  const { c, ctx } = makeCanvas(TILE, VH);
  const B = HZ;
  R(ctx, 0, B - 24, TILE, 24, '#1c1030');
  R(ctx, 0, B - 24, TILE, 3, '#3a2054');
  for (let x = 40; x < TILE; x += 160) {
    R(ctx, x, B - 78, 10, 54, '#2a1840');
    glow(ctx, x + 5, B - 74, 40, '#c04aff', 0.35);
    R(ctx, x + 2, B - 74, 6, 8, '#e0a8ff');
  }
  return c;
}
function abyssFloor() {
  const { c, ctx } = makeCanvas(TILE, FLOOR_H);
  const rng = mulberry32(331);
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_H);
  g.addColorStop(0, '#221534'); g.addColorStop(0.3, '#2e1c46'); g.addColorStop(1, '#160d24');
  ctx.fillStyle = g; ctx.fillRect(0, 0, TILE, FLOOR_H);
  R(ctx, 0, 0, TILE, 3, '#0c0616');
  R(ctx, 0, 3, TILE, 2, '#5a2f86');
  for (let i = 0; i < 44; i++) {
    const x = rng() * TILE, y = 8 + rng() * (FLOOR_H - 10);
    ctx.strokeStyle = rgba('#a24ae0', 0.16 + rng() * 0.2); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rng() * 44 - 22), y + (rng() * 12 - 6)); ctx.stroke();
  }
  speckle(ctx, 0, 6, TILE, FLOOR_H, '#000000', 500, rng, 0.3);
  return c;
}

// ═══════════════ 전경 (캐릭터보다 앞, 화면 하단만) ═══════════════
// 벨트 아래쪽을 물체로 막아 깊이감을 만들고 플레이 영역을 액자처럼 가둔다.

const FORE_H = 36;               // 전경 캔버스 높이 (화면 하단에 붙인다)
const FORE_Y = VH - FORE_H;      // 234 — 벨트 최하단(254)보다 아래에서 시작
const BAND = 20;                 // 이 아래는 완전히 막힌 영역 (화면 254~270)

function harborFore() {
  const { c, ctx } = makeCanvas(TILE, FORE_H);
  const rng = mulberry32(401);
  R(ctx, 0, BAND, TILE, FORE_H - BAND, '#23232f');
  R(ctx, 0, BAND, TILE, 2, '#3f3f52');
  speckle(ctx, 0, BAND + 2, TILE, FORE_H - BAND - 2, '#101018', 260, rng, 0.35);
  for (let x = 26; x < TILE; x += 176) {
    R(ctx, x - 9, BAND - 14, 18, 16, '#2f3442');
    R(ctx, x - 11, BAND - 18, 22, 5, '#3d4354');
    R(ctx, x - 9, BAND - 14, 5, 16, '#4a5165');
    R(ctx, x - 11, BAND - 18, 22, 2, '#59607a');
    ctx.strokeStyle = '#4a4436'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 10, BAND - 14);
    ctx.quadraticCurveTo(x + 88, BAND + 6, x + 165, BAND - 14);
    ctx.stroke();
    ctx.strokeStyle = '#6b634c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 10, BAND - 15);
    ctx.quadraticCurveTo(x + 88, BAND + 4, x + 165, BAND - 15);
    ctx.stroke();
  }
  return c;
}

function foundryFore() {
  const { c, ctx } = makeCanvas(TILE, FORE_H);
  const rng = mulberry32(403);
  R(ctx, 0, BAND - 8, TILE, FORE_H - BAND + 8, '#2a1c18');
  R(ctx, 0, BAND - 8, TILE, 4, '#6a4634');
  R(ctx, 0, BAND - 4, TILE, 3, '#472c22');
  R(ctx, 0, FORE_H - 7, TILE, 7, '#1a100d');
  for (let x = 30; x < TILE; x += 120) {
    R(ctx, x, BAND - 11, 14, FORE_H - BAND + 11, '#3d2820');
    R(ctx, x, BAND - 11, 14, 3, '#5c3a2c');
    ctx.fillStyle = '#775040';
    ctx.beginPath(); ctx.arc(x + 7, BAND + 2, 5, 0, 6.284); ctx.fill();
    ctx.fillStyle = '#2a1a14';
    ctx.beginPath(); ctx.arc(x + 7, BAND + 2, 2, 0, 6.284); ctx.fill();
  }
  speckle(ctx, 0, BAND - 8, TILE, FORE_H - BAND + 8, '#120a08', 240, rng, 0.4);
  return c;
}

function shrineFore() {
  const { c, ctx } = makeCanvas(TILE, FORE_H);
  const rng = mulberry32(407);
  for (let x = -20; x < TILE + 20; x += 62) {
    ctx.fillStyle = '#e8eef8';
    ctx.beginPath();
    ctx.ellipse(x, BAND + 2, 44, 11 + rng() * 5, 0, Math.PI, 0);
    ctx.fill();
  }
  R(ctx, 0, BAND, TILE, FORE_H - BAND, '#eaf0f8');
  ctx.fillStyle = 'rgba(150,170,196,0.35)';
  for (let i = 0; i < 70; i++) ctx.fillRect((rng() * TILE) | 0, (BAND - 2 + rng() * 18) | 0, 2 + rng() * 8, 1);
  R(ctx, 0, FORE_H - 6, TILE, 6, '#c2cede');
  return c;
}

function abyssFore() {
  const { c, ctx } = makeCanvas(TILE, FORE_H);
  const rng = mulberry32(409);
  R(ctx, 0, BAND, TILE, FORE_H - BAND, '#150c24');
  R(ctx, 0, BAND, TILE, 2, '#3a2054');
  for (let x = 10; x < TILE; x += 96) {
    const h = 12 + rng() * 20;
    P(ctx, [[x, BAND + 2], [x + 14, BAND + 2], [x + 9, BAND + 2 - h], [x + 3, BAND + 2 - h * 0.7]], '#241436');
    ctx.fillStyle = rgba('#a24ae0', 0.35);
    ctx.fillRect(x + 5, BAND - h * 0.6, 2, h * 0.6);
  }
  return c;
}

// ═══════════════ 테마 등록 ═══════════════

const THEMES = {
  harbor: {
    sky: harborSky, far: harborFar, mid: harborMid, near: harborNear, floor: harborFloor, fore: harborFore,
    par: [0.06, 0.18, 0.36, 0.62], ambient: 'rain', tint: 'rgba(30,40,90,0.14)', dust: '#9aa8c0',
  },
  foundry: {
    sky: foundrySky, far: foundryFar, mid: foundryMid, near: foundryNear, floor: foundryFloor, fore: foundryFore,
    par: [0.06, 0.2, 0.4, 0.66], ambient: 'ember', tint: 'rgba(90,30,10,0.16)', dust: '#c8a070',
  },
  shrine: {
    sky: shrineSky, far: shrineFar, mid: shrineMid, near: shrineNear, floor: shrineFloor, fore: shrineFore,
    par: [0.05, 0.16, 0.34, 0.6], ambient: 'snow', tint: 'rgba(120,150,200,0.12)', dust: '#ffffff',
  },
  abyss: {
    sky: abyssSky, far: abyssFar, mid: abyssMid, near: abyssNear, floor: abyssFloor, fore: abyssFore,
    par: [0.05, 0.2, 0.4, 0.66], ambient: 'void', tint: 'rgba(60,10,110,0.2)', dust: '#c88aff',
  },
};

const cache = new Map();

export function loadTheme(name) {
  if (cache.has(name)) return cache.get(name);
  const t = THEMES[name];
  const built = {
    ...t,
    skyC: t.sky(), farC: t.far(), midC: t.mid(), foreC: t.fore(),
    nearC: [0, 1, 2].map((v) => t.near(v)),
    floorC: [0, 1, 2].map((v) => t.floor(v)),
  };
  cache.set(name, built);
  return built;
}

/** 전경 레이어 — 캐릭터를 그린 뒤에 호출 */
export function drawForeground(ctx, theme, cam) {
  let ox = -((cam * 1.28) % TILE);
  if (ox > 0) ox -= TILE;
  ctx.drawImage(theme.foreC, ox | 0, FORE_Y);
  ctx.drawImage(theme.foreC, (ox + TILE) | 0, FORE_Y);
}

export function drawBackground(ctx, theme, cam, variant) {
  ctx.drawImage(theme.skyC, 0, 0);
  const layers = [theme.farC, theme.midC, theme.nearC[variant]];
  for (let i = 0; i < 3; i++) {
    const p = theme.par[i + 1];
    let ox = -((cam * p) % TILE);
    if (ox > 0) ox -= TILE;
    ctx.drawImage(layers[i], ox | 0, 0);
    ctx.drawImage(layers[i], (ox + TILE) | 0, 0);
  }
  let fx = -(cam % TILE);
  if (fx > 0) fx -= TILE;
  ctx.drawImage(theme.floorC[variant], fx | 0, FLOOR_TOP);
  ctx.drawImage(theme.floorC[variant], (fx + TILE) | 0, FLOOR_TOP);
}

export { TILE, FLOOR_TOP };
