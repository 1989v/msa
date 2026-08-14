// All 2D interface: HUD, card selection, boss bar, and the full-screen menus.
// Drawn in unscaled screen space (1280×720), after the shaken world pass.

import { TAU, clamp, lerp, easeOutCubic, easeOutBack, easeOutQuint, formatInt } from './core.js';
import { PAL, GODS, RARITY, BIOME_THEME, drawGlyph, glowDot, starPath, roundRect } from './art.js';
import { rgba, shade, mixHex } from './fx.js';
import { SLOTS } from './boons.js';
import { META_UPGRADES, levelOf, upgradeCost, getSave } from './meta.js';

export const W = 1280;
export const H = 720;

const F = {
  n: (s) => `${s}px Galmuri11, monospace`,
  b: (s) => `${s}px Galmuri11Bold, Galmuri11, monospace`,
  d: (s) => `${s}px Galmuri14, Galmuri11, monospace`,
  s: (s) => `${s}px Galmuri9, Galmuri11, monospace`,
};

export function text(ctx, str, x, y, o = {}) {
  const {
    size = 22, color = PAL.text, align = 'left', baseline = 'alphabetic',
    font = 'b', outline = 'rgba(3,7,13,0.92)', outlineW = 5, alpha = 1, maxWidth = null,
  } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = F[font](size);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (outline && outlineW > 0) {
    ctx.lineWidth = outlineW;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    maxWidth ? ctx.strokeText(str, x, y, maxWidth) : ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  maxWidth ? ctx.fillText(str, x, y, maxWidth) : ctx.fillText(str, x, y);
  ctx.restore();
}

export function measure(ctx, str, size = 22, font = 'b') {
  ctx.save();
  ctx.font = F[font](size);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Naive greedy wrap. Korean has no spaces in many phrases, so it falls back to chars. */
export function wrapText(ctx, str, maxW, size = 18, font = 'n') {
  ctx.save();
  ctx.font = F[font](size);
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width <= maxW) { cur = test; continue; }
    if (cur) lines.push(cur);
    if (ctx.measureText(word).width <= maxW) { cur = word; continue; }
    let chunk = '';
    for (const ch of word) {
      if (ctx.measureText(chunk + ch).width > maxW) { lines.push(chunk); chunk = ch; }
      else chunk += ch;
    }
    cur = chunk;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

export function panel(ctx, x, y, w, h, o = {}) {
  const {
    fill = 'rgba(7,13,24,0.9)', border = 'rgba(90,150,180,0.5)',
    borderW = 2, radius = 12, glow = null, shadow = true,
  } = o;
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 6;
  }
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = borderW + 5;
    ctx.globalAlpha = 0.24;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderW;
    ctx.stroke();
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, pct, o = {}) {
  const {
    back = 'rgba(48,10,20,0.85)', fill = PAL.hp, fill2 = null,
    border = 'rgba(0,0,0,0.8)', ghost = null, radius = 4, segments = 0,
  } = o;
  ctx.save();
  roundRect(ctx, x - 2, y - 2, w + 4, h + 4, radius + 2);
  ctx.fillStyle = border;
  ctx.fill();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = back;
  ctx.fill();
  if (ghost !== null && ghost > pct) {
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,220,220,0.34)';
    ctx.fillRect(x, y, w * ghost, h);
    ctx.restore();
  }
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, fill2 || shade(fill, 0.35));
  g.addColorStop(0.5, fill);
  g.addColorStop(1, shade(fill, -0.28));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * clamp(pct, 0, 1), h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x, y, w * clamp(pct, 0, 1), h * 0.34);
  if (segments > 0) {
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 2;
    for (let i = 1; i < segments; i++) {
      const sx = x + (w / segments) * i;
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------- HUD

const hudState = { hpGhost: 1, hpGhostT: 0 };

export function drawHud(ctx, game) {
  const world = game.world;
  const p = world.player;
  if (!p) return;
  const run = world.run;

  // ---- health
  const hpPct = clamp(p.hp / p.maxHp, 0, 1);
  if (hpPct < hudState.hpGhost) {
    hudState.hpGhostT = 0.5;
  } else {
    hudState.hpGhost = hpPct;
  }
  if (hudState.hpGhostT > 0) {
    hudState.hpGhostT -= game.dtReal;
    if (hudState.hpGhostT <= 0) hudState.hpGhost = lerp(hudState.hpGhost, hpPct, 0.35);
  }

  const hx = 30, hy = 30, hw = 392, hh = 30;
  panel(ctx, hx - 14, hy - 16, hw + 28, hh + 62, {
    fill: 'rgba(6,11,20,0.72)', border: 'rgba(70,120,150,0.35)', radius: 10,
  });
  bar(ctx, hx, hy, hw, hh, hpPct, {
    fill: hpPct < 0.3 ? '#ff3b52' : PAL.hp,
    back: 'rgba(52,10,22,0.9)',
    ghost: hudState.hpGhost,
    segments: Math.max(1, Math.round(p.maxHp / 50)),
  });
  text(ctx, `${Math.ceil(p.hp)}`, hx + 10, hy + hh / 2 + 1, { size: 22, baseline: 'middle', color: '#fff' });
  text(ctx, `/ ${Math.round(p.maxHp)}`, hx + 10 + measure(ctx, `${Math.ceil(p.hp)}`, 22) + 8, hy + hh / 2 + 2,
    { size: 14, baseline: 'middle', color: '#ffb9c4' });
  text(ctx, '레비아', hx + hw - 8, hy + hh / 2 + 1,
    { size: 16, baseline: 'middle', align: 'right', color: 'rgba(255,255,255,0.7)' });

  // Defiance pips
  if (p.defianceMax > 0) {
    for (let i = 0; i < p.defianceMax; i++) {
      const cx = hx + hw + 22 + i * 26;
      const on = i < p.defiance;
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.28;
      glowDot(ctx, cx, hy + hh / 2, on ? 16 : 8, '#ffd34a', on ? 0.7 : 0.2);
      drawGlyph(ctx, 'crown', cx, hy + hh / 2, 20, on ? '#ffd34a' : '#5a6472', 2.4);
      ctx.restore();
    }
  }

  // ---- ability row
  const ay = hy + hh + 12;
  drawAbility(ctx, hx, ay, '대시', 'SPC', p.dashStock, p.dashCharges,
    p.dashStock < p.dashCharges ? 1 - p.dashCdT / (0.46 * p.mods.dashCdMult) : 1, '#7fe9ff');
  drawAbility(ctx, hx + 132, ay, '특수', 'K', p.spCd <= 0 ? 1 : 0, 1,
    p.spCd <= 0 ? 1 : 1 - p.spCd / (1.0 * p.mods.dashCdMult), '#ffb44a');
  drawAbility(ctx, hx + 264, ay, '주문', 'L', p.castAmmo, p.castAmmoMax,
    p.castAmmo < p.castAmmoMax ? 1 - p.castReload / 2.4 : 1, '#8ce8ff');

  // ---- top-right: progress + currency
  const th = BIOME_THEME[world.room.biome];
  const rx = W - 30;
  text(ctx, th.name, rx, 42, { size: 26, align: 'right', color: th.accent2 });
  const roomLabel = world.room.type === 'boss'
    ? '수호자의 방'
    : `${world.roomIndex + 1} / ${world.biomePlan.rooms.length} 구역`;
  text(ctx, roomLabel, rx, 66, { size: 16, align: 'right', color: '#93aec5' });

  const cy2 = 96;
  drawGlyph(ctx, 'coin', rx - 96, cy2, 20, '#f5c542', 2.4);
  text(ctx, formatInt(run.gold), rx - 78, cy2 + 7, { size: 20, align: 'left', color: '#ffd870' });
  drawGlyph(ctx, 'shard', rx - 200, cy2, 20, '#8ce8ff', 2.4);
  text(ctx, formatInt(run.shards), rx - 182, cy2 + 7, { size: 20, align: 'left', color: '#a8f0ff' });

  // ---- boon rail
  drawBoonRail(ctx, world, p);

  // ---- enemies remaining
  if (world.room.type === 'combat' && !world.room.cleared) {
    const alive = world.enemies.filter((e) => !e.dead).length;
    const total = world.waveTotal || alive;
    if (total > 0) {
      const bx = W / 2 - 130, by = 24;
      panel(ctx, bx, by, 260, 32, { fill: 'rgba(6,11,20,0.72)', border: 'rgba(255,90,110,0.35)', radius: 8 });
      text(ctx, `잔존 적  ${alive}`, W / 2, by + 22, { size: 19, align: 'center', color: '#ffb0bc' });
      const wl = world.waves ? world.waves.length : 1;
      if (wl > 1) {
        for (let i = 0; i < wl; i++) {
          ctx.save();
          ctx.globalAlpha = i <= world.waveIndex ? 1 : 0.3;
          ctx.fillStyle = i < world.waveIndex ? '#5a6d80' : '#ff5470';
          ctx.beginPath(); ctx.arc(bx + 240 - (wl - 1 - i) * 12, by + 16, 4, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  if (world.boss && !world.boss.dead) drawBossBar(ctx, world.boss);

  // ---- interaction prompt
  if (world.prompt) {
    const t = world.prompt;
    const w = measure(ctx, t, 22) + 90;
    panel(ctx, W / 2 - w / 2, H - 118, w, 46, {
      fill: 'rgba(6,11,20,0.9)', border: 'rgba(140,232,255,0.6)', radius: 10,
    });
    drawKeycap(ctx, W / 2 - w / 2 + 16, H - 108, 'E', 28);
    text(ctx, t, W / 2 + 14, H - 88, { size: 21, align: 'center', color: '#d8ecff' });
  }

  if (game.hintT > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(game.hintT, 0, 1) * 0.85;
    text(ctx, game.hint, W / 2, H - 34, { size: 17, align: 'center', color: '#88a4bd' });
    ctx.restore();
  }
}

function drawAbility(ctx, x, y, label, key, stock, max, cd, color) {
  const w = 120, h = 40;
  panel(ctx, x, y, w, h, { fill: 'rgba(8,15,26,0.85)', border: 'rgba(70,120,150,0.4)', radius: 8, shadow: false });
  // Cooldown wipe
  if (cd < 1) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + w * cd, y, w * (1 - cd), h);
    ctx.restore();
  }
  const kw = drawKeycap(ctx, x + 7, y + 7, key, 26);
  text(ctx, label, x + 13 + kw, y + 26, { size: 17, color: stock > 0 ? color : '#5f6d7c' });
  if (max > 1) {
    for (let i = 0; i < max; i++) {
      const cx = x + w - 12 - (max - 1 - i) * 12;
      ctx.save();
      ctx.fillStyle = i < stock ? color : 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.arc(cx, y + h - 9, 4, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.fillStyle = stock > 0 ? color : 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.arc(x + w - 12, y + h - 9, 4.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

export function drawKeycap(ctx, x, y, key, size = 26) {
  const w = Math.max(size, measure(ctx, key, size * 0.62) + 14);
  ctx.save();
  roundRect(ctx, x, y, w, size, 5);
  ctx.fillStyle = 'rgba(220,238,255,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,20,32,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = F.b(Math.round(size * 0.62));
  ctx.fillStyle = '#0d1b2a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(key, x + w / 2, y + size / 2 + 1);
  ctx.restore();
  return w;
}

function drawBoonRail(ctx, world, p) {
  const list = p.build.list;
  if (!list.length) return;
  const x = 30, y0 = 172;
  const cell = 40;
  list.forEach((b, i) => {
    const y = y0 + i * (cell + 6);
    if (y > H - 120) return;
    const god = GODS[b.def.god];
    const rar = RARITY[b.rarity];
    panel(ctx, x, y, 250, cell, {
      fill: 'rgba(7,13,24,0.68)', border: rgba(rar.color, 0.55), radius: 7, shadow: false,
    });
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = god.color;
    roundRect(ctx, x, y, 250, cell, 7);
    ctx.fill();
    ctx.restore();
    drawGlyph(ctx, god.glyph, x + 22, y + cell / 2, 22, god.color, 2.4);
    text(ctx, b.def.name, x + 42, y + cell / 2 + 6, { size: 17, color: '#e0eefb' });
    text(ctx, SLOTS[b.def.slot].short, x + 242, y + cell / 2 + 5,
      { size: 13, align: 'right', color: rar.color });
  });
}

function drawBossBar(ctx, boss) {
  const w = 660, h = 22;
  const x = W / 2 - w / 2, y = 30;
  const pct = clamp(boss.hp / boss.maxHp, 0, 1);
  panel(ctx, x - 16, y - 26, w + 32, h + 54, {
    fill: 'rgba(6,11,20,0.82)', border: rgba(boss.tint, 0.5), radius: 10, glow: rgba(boss.tint, 0.6),
  });
  text(ctx, boss.title, W / 2, y - 4, { size: 24, align: 'center', color: boss.tint });
  text(ctx, boss.subtitle, W / 2 + measure(ctx, boss.title, 24) / 2 + 14, y - 5,
    { size: 14, align: 'left', color: '#8fa8bd' });
  bar(ctx, x, y + 8, w, h, pct, {
    fill: boss.phase >= 2 ? '#ff3b52' : boss.phase >= 1 ? '#ff7a3c' : '#ff5470',
    back: 'rgba(40,8,16,0.92)',
    segments: boss.phaseThresholds.length + 1,
  });
  // Phase markers
  for (const t of boss.phaseThresholds) {
    const mx = x + w * t;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,211,74,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, y + 5); ctx.lineTo(mx, y + h + 11); ctx.stroke();
    ctx.restore();
  }
  if (boss.phase > 0) {
    text(ctx, `${boss.phase + 1}단계`, x + w + 8, y + h / 2 + 13,
      { size: 15, align: 'left', color: '#ffd34a' });
  }
}

// ------------------------------------------------------------- boon cards

export function drawBoonSelect(ctx, cards, selected, t, opts = {}) {
  const { title = '축복을 선택하라', subtitle = '' } = opts;
  dimScreen(ctx, 0.78);

  const appear = easeOutCubic(clamp(t / 0.35, 0, 1));
  text(ctx, title, W / 2, 96 - (1 - appear) * 30, {
    size: 40, align: 'center', color: '#f5c542', font: 'd', alpha: appear,
  });
  if (subtitle) {
    text(ctx, subtitle, W / 2, 128 - (1 - appear) * 20, {
      size: 18, align: 'center', color: '#93aec5', alpha: appear,
    });
  }

  const cw = 300, ch = 396;
  const gap = 30;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = W / 2 - total / 2;

  cards.forEach((card, i) => {
    const sel = i === selected;
    const delay = i * 0.07;
    const a = easeOutBack(clamp((t - delay) / 0.4, 0, 1));
    const x = x0 + i * (cw + gap);
    const y = 168 + (1 - a) * 40;
    drawBoonCard(ctx, card, x, y, cw, ch, sel, t, a);
  });

  // Footer hint
  const hy = H - 44;
  const parts = [
    { k: '← →', t: '선택' },
    { k: 'J', t: '결정' },
  ];
  let px = W / 2 - 110;
  for (const p of parts) {
    const kw = drawKeycap(ctx, px, hy - 18, p.k, 26);
    text(ctx, p.t, px + kw + 8, hy + 1, { size: 17, color: '#9fb8cc' });
    px += kw + measure(ctx, p.t, 17) + 34;
  }
}

export function drawBoonCard(ctx, card, x, y, w, h, selected, t, appear = 1) {
  const god = card.godInfo || GODS[card.def.god];
  const rar = RARITY[card.rarity];
  const lift = selected ? 16 : 0;
  const scale = 0.94 + appear * 0.06 + (selected ? 0.04 : 0);

  ctx.save();
  // Unselected cards recede so the focused one is unmistakable even when the
  // rarity colour happens to be a muted grey.
  ctx.globalAlpha = clamp(appear, 0, 1) * (selected ? 1 : 0.66);
  ctx.translate(x + w / 2, y + h / 2 - lift);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);

  if (selected) {
    const pulse = 0.55 + Math.sin(t * 5) * 0.18;
    ctx.save();
    ctx.globalAlpha = pulse;
    roundRect(ctx, -9, -9, w + 18, h + 18, 22);
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Card body
  panel(ctx, 0, 0, w, h, {
    fill: 'rgba(9,16,28,0.97)',
    border: selected ? rar.color : rgba(rar.color, 0.45),
    borderW: selected ? 3.5 : 2,
    radius: 16,
    glow: selected ? rar.color : null,
  });

  // God wash
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 16);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(god.color, 0.30));
  g.addColorStop(0.42, rgba(god.color, 0.07));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Sigil watermark
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.translate(w / 2, 138);
  ctx.rotate(Math.sin(t * 0.6) * 0.05);
  drawGlyph(ctx, god.glyph, 0, 0, 190, god.color, 8);
  ctx.restore();
  ctx.restore();

  // Rarity ribbon
  ctx.save();
  roundRect(ctx, 0, 0, w, 6, 3);
  ctx.fillStyle = rar.color;
  ctx.fill();
  ctx.restore();

  // Sigil medallion
  const my = 96;
  glowDot(ctx, w / 2, my, 76, god.color, selected ? 0.6 : 0.35);
  ctx.save();
  ctx.translate(w / 2, my);
  ctx.rotate(t * 0.25);
  starPath(ctx, 0, 0, 8, 54, 40, 0);
  ctx.strokeStyle = rgba(god.color, 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  drawGlyph(ctx, god.glyph, w / 2, my, 60, god.color, 4);

  // God name
  text(ctx, `${god.name} · ${god.title}`, w / 2, my + 78,
    { size: 15, align: 'center', color: rgba(god.color, 0.95) });

  // Boon name
  text(ctx, card.def.name, w / 2, my + 116, { size: 28, align: 'center', color: '#f2f8ff', font: 'd' });

  // Slot + rarity chips
  const chipY = my + 134;
  const slotName = SLOTS[card.def.slot].name;
  chip(ctx, w / 2 - 4 - measure(ctx, slotName, 14) - 20, chipY, slotName, '#9fb8cc', 'rgba(120,160,190,0.5)');
  chip(ctx, w / 2 + 4, chipY, rar.name, rar.color, rgba(rar.color, 0.7));

  // Description
  const lines = wrapText(ctx, card.text, w - 44, 17, 'n');
  lines.forEach((ln, i) => {
    text(ctx, ln, w / 2, my + 186 + i * 25, { size: 17, align: 'center', color: '#cfe2f2', font: 'n' });
  });

  // Flavor
  if (card.def.flavor) {
    const fl = wrapText(ctx, card.def.flavor, w - 52, 14, 'n');
    fl.forEach((ln, i) => {
      text(ctx, ln, w / 2, h - 58 + i * 19, {
        size: 14, align: 'center', color: 'rgba(150,175,196,0.75)', font: 'n', outlineW: 3,
      });
    });
  }

  if (card.isUpgrade) {
    ctx.save();
    ctx.translate(w - 16, 30);
    ctx.rotate(0.12);
    panel(ctx, -74, -13, 74, 26, { fill: 'rgba(60,42,8,0.95)', border: '#ffd34a', radius: 6, shadow: false });
    text(ctx, '강화', -37, 6, { size: 16, align: 'center', color: '#ffd34a' });
    ctx.restore();
  }

  if (selected) {
    const bob = Math.sin(t * 5) * 3;
    text(ctx, '▼', w / 2, -22 + bob, { size: 20, align: 'center', color: '#f5c542' });
  }

  ctx.restore();
}

function chip(ctx, x, y, label, color, border) {
  const w = measure(ctx, label, 14) + 20;
  ctx.save();
  roundRect(ctx, x, y, w, 22, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  text(ctx, label, x + w / 2, y + 16, { size: 14, align: 'center', color, outlineW: 0 });
  return w;
}

export function dimScreen(ctx, alpha = 0.7, color = '#03060c') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ----------------------------------------------------------------- title

export function drawTitle(ctx, game, t) {
  const th = BIOME_THEME.throne;
  // Backdrop
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050a14');
  g.addColorStop(0.55, '#0a1424');
  g.addColorStop(1, '#04070f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Drifting light shafts
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * W + Math.sin(t * 0.2 + i) * 60;
    const gg = ctx.createLinearGradient(x, 0, x + 120, H);
    gg.addColorStop(0, 'rgba(70,150,190,0.10)');
    gg.addColorStop(1, 'rgba(70,150,190,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(x - 60, 0); ctx.lineTo(x + 60, 0);
    ctx.lineTo(x + 190, H); ctx.lineTo(x + 10, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Crown emblem
  ctx.save();
  ctx.translate(W / 2, 190 + Math.sin(t * 0.9) * 6);
  glowDot(ctx, 0, 0, 190, '#f5c542', 0.28);
  ctx.save();
  ctx.rotate(t * 0.12);
  starPath(ctx, 0, 0, 12, 124, 96, 0);
  ctx.strokeStyle = 'rgba(245,197,66,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  drawGlyph(ctx, 'crown', 0, 0, 132, '#f5c542', 9);
  ctx.restore();

  text(ctx, '심연의 왕관', W / 2, 330, { size: 70, align: 'center', color: '#f7e6b0', font: 'd', outlineW: 9 });
  text(ctx, 'ABYSSAL  CROWN', W / 2, 364, {
    size: 18, align: 'center', color: 'rgba(140,200,220,0.75)', outlineW: 4,
  });

  const items = game.titleItems;
  const sel = game.titleIndex;
  items.forEach((it, i) => {
    const y = 430 + i * 52;
    const active = i === sel;
    const w = 340;
    const x = W / 2 - w / 2;
    if (active) {
      panel(ctx, x, y - 24, w, 42, {
        fill: 'rgba(245,197,66,0.12)', border: 'rgba(245,197,66,0.8)', radius: 8, shadow: false,
      });
      const px = x - 22 + Math.sin(t * 6) * 3;
      text(ctx, '◆', px, y + 4, { size: 18, color: '#f5c542' });
    }
    ctx.save();
    ctx.globalAlpha = it.disabled ? 0.35 : 1;
    text(ctx, it.label, W / 2, y + 5, {
      size: 26, align: 'center', color: active ? '#ffe9a8' : '#9fb8cc',
    });
    ctx.restore();
  });

  const save = getSave();
  const st = save.stats;
  text(ctx, `도전 ${st.runs}회 · 정복 ${st.wins}회 · 최고 도달 ${biomeLabel(st.bestBiome, st.bestRoom)}`,
    W / 2, H - 56, { size: 15, align: 'center', color: '#6f8aa2' });
  text(ctx, '보유 심연 결정  ' + formatInt(save.shards), W / 2, H - 32,
    { size: 15, align: 'center', color: '#8ce8ff' });
}

function biomeLabel(b, r) {
  const names = ['산호 묘지', '침몰 성채', '심연 옥좌'];
  if (!names[b]) return '—';
  return `${names[b]} ${r + 1}구역`;
}

// --------------------------------------------------------------- controls

export function drawControls(ctx, t) {
  dimScreen(ctx, 0.88);
  panel(ctx, W / 2 - 380, 70, 760, 560, { fill: 'rgba(8,15,26,0.96)', border: 'rgba(90,150,180,0.5)', radius: 16 });
  text(ctx, '조작법', W / 2, 128, { size: 40, align: 'center', color: '#f5c542', font: 'd' });

  const rows = [
    ['W A S D  /  ↑←↓→', '이동 — 바라보는 방향이 곧 공격 방향'],
    ['J  또는  Z', '기본 공격 — 3연격, 마지막 타는 강타'],
    ['K  또는  X', '특수 공격 — 회전 베기 광역'],
    ['L  또는  C', '주문 — 원거리 작살 (탄약 자동 충전)'],
    ['SPACE / SHIFT', '대시 — 무적 프레임, 모든 후딜 취소'],
    ['E  또는  ENTER', '문 진입 · 상점 구매 · 결정'],
    ['ESC  또는  P', '일시정지'],
    ['M', '음소거 전환'],
  ];
  rows.forEach((r, i) => {
    const y = 190 + i * 48;
    panel(ctx, W / 2 - 340, y - 22, 680, 40, {
      fill: i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.055)',
      border: null, radius: 6, shadow: false,
    });
    text(ctx, r[0], W / 2 - 320, y + 6, { size: 19, color: '#8ce8ff' });
    text(ctx, r[1], W / 2 - 90, y + 6, { size: 17, color: '#cfe2f2', font: 'n' });
  });

  text(ctx, '적의 공격은 반드시 바닥에 예고가 먼저 그려진다. 예고가 가득 차기 전에 대시로 빠져나가라.',
    W / 2, 592, { size: 16, align: 'center', color: '#93aec5', font: 'n' });
  text(ctx, 'ESC 로 돌아가기', W / 2, H - 44, { size: 18, align: 'center', color: '#7d95ab' });
}

// ---------------------------------------------------------------- sanctum

export function drawSanctum(ctx, game, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#071019');
  g.addColorStop(1, '#04080f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.5;
  glowDot(ctx, W / 2, 120, 320, '#57e2d6', 0.16);
  ctx.restore();

  text(ctx, '침묵의 영묘', W / 2, 74, { size: 44, align: 'center', color: '#57e2d6', font: 'd' });
  text(ctx, '죽음은 되돌아오는 문일 뿐이다. 결정을 바쳐 다음 잠수를 준비하라.',
    W / 2, 104, { size: 16, align: 'center', color: '#8ba6c0', font: 'n' });

  const save = getSave();
  panel(ctx, W / 2 - 130, 118, 260, 40, {
    fill: 'rgba(10,24,36,0.9)', border: 'rgba(140,232,255,0.55)', radius: 10,
  });
  drawGlyph(ctx, 'shard', W / 2 - 92, 138, 24, '#8ce8ff', 2.6);
  text(ctx, formatInt(save.shards), W / 2 - 68, 146, { size: 24, align: 'left', color: '#a8f0ff' });
  text(ctx, '심연 결정', W / 2 + 106, 145, { size: 14, align: 'right', color: '#6f8aa2' });

  const cols = 5;
  const cw = 218, chh = 128, gap = 14;
  const totalW = cols * cw + (cols - 1) * gap;
  const x0 = W / 2 - totalW / 2;
  const y0 = 182;

  META_UPGRADES.forEach((u, i) => {
    const cx = x0 + (i % cols) * (cw + gap);
    const cy = y0 + Math.floor(i / cols) * (chh + gap);
    const lv = levelOf(u.id);
    const cost = upgradeCost(u.id);
    const maxed = lv >= u.max;
    const afford = cost !== null && save.shards >= cost;
    const sel = i === game.sanctumIndex;

    panel(ctx, cx, cy, cw, chh, {
      fill: sel ? 'rgba(18,40,56,0.97)' : 'rgba(9,18,28,0.92)',
      border: sel ? '#57e2d6' : maxed ? 'rgba(245,197,66,0.5)' : 'rgba(70,120,150,0.4)',
      borderW: sel ? 3 : 1.6, radius: 12, glow: sel ? '#57e2d6' : null,
    });

    drawGlyph(ctx, u.glyph, cx + 26, cy + 32, 24, maxed ? '#f5c542' : '#57e2d6', 2.6);
    text(ctx, u.name, cx + 46, cy + 40, { size: 19, color: maxed ? '#ffd870' : '#e0eefb' });

    // Level pips
    for (let k = 0; k < u.max; k++) {
      const px = cx + 16 + k * 14;
      ctx.save();
      ctx.fillStyle = k < lv ? '#57e2d6' : 'rgba(255,255,255,0.14)';
      roundRect(ctx, px, cy + 52, 10, 8, 2);
      ctx.fill();
      ctx.restore();
    }

    // Owned effect vs. what the next level buys — never show one number alone,
    // otherwise "+24" reads as the current bonus when it is really the target.
    if (lv > 0) {
      text(ctx, `현재  ${u.desc(lv - 1)}`, cx + 14, cy + 82,
        { size: 14, color: '#7d95ab', font: 'n', maxWidth: cw - 28 });
    }
    if (!maxed) {
      text(ctx, `${lv > 0 ? '다음  ' : ''}${u.desc(lv)}`, cx + 14, cy + (lv > 0 ? 102 : 88),
        { size: 15, color: '#a9f0e4', font: 'n', maxWidth: cw - 28 });
    }

    if (maxed) {
      text(ctx, '최대', cx + cw - 14, cy + 118, { size: 15, align: 'right', color: '#ffd870' });
    } else {
      drawGlyph(ctx, 'shard', cx + cw - 58, cy + 113, 15, afford ? '#8ce8ff' : '#6a7d8e', 2);
      text(ctx, `${cost}`, cx + cw - 14, cy + 119, {
        size: 18, align: 'right', color: afford ? '#a8f0ff' : '#ff8a9a',
      });
    }
  });

  // Career record fills the lower third and gives the meta screen a reason to exist
  // between runs.
  const st = save.stats;
  const ry = 470;
  panel(ctx, W / 2 - 400, ry, 800, 118, {
    fill: 'rgba(7,14,24,0.8)', border: 'rgba(70,120,150,0.35)', radius: 12,
  });
  text(ctx, '잠수 기록', W / 2, ry + 30, { size: 20, align: 'center', color: '#8ba6c0' });
  const recs = [
    ['도전', `${st.runs}`],
    ['정복', `${st.wins}`],
    ['총 처치', `${st.kills}`],
    ['최고 도달', biomeLabel(st.bestBiome, st.bestRoom)],
    ['수호자 격파', `${Object.values(st.bossKills || {}).reduce((a, b) => a + b, 0)}`],
  ];
  recs.forEach((r, i) => {
    const x = W / 2 - 400 + 80 + i * 160;
    text(ctx, r[0], x, ry + 62, { size: 14, align: 'center', color: '#6f8aa2' });
    text(ctx, r[1], x, ry + 96, { size: 24, align: 'center', color: '#cfe2f2', font: 'd' });
  });

  const fy = H - 46;
  let px = W / 2 - 250;
  const parts = [['↑↓←→', '이동'], ['E', '강화'], ['R', '전액 환급'], ['ESC', '뒤로']];
  for (const [k, l] of parts) {
    const kw = drawKeycap(ctx, px, fy - 18, k, 26);
    text(ctx, l, px + kw + 8, fy + 1, { size: 16, color: '#9fb8cc' });
    px += kw + measure(ctx, l, 16) + 30;
  }
}

// ------------------------------------------------------------ run summary

export function drawRunEnd(ctx, game, t, won) {
  dimScreen(ctx, 0.86, won ? '#0a0a18' : '#12040a');
  const appear = easeOutCubic(clamp(t / 0.6, 0, 1));
  const s = game.summary;

  ctx.save();
  ctx.globalAlpha = appear;

  const titleY = 108 - (1 - appear) * 30;
  if (won) {
    glowDot(ctx, W / 2, titleY - 10, 260, '#f5c542', 0.3);
    text(ctx, '왕관을 되찾았다', W / 2, titleY, { size: 56, align: 'center', color: '#f7e6b0', font: 'd' });
    text(ctx, '심연은 다시 잠들었다 — 그러나 오래가지는 않을 것이다.',
      W / 2, titleY + 36, { size: 17, align: 'center', color: '#b9cddd', font: 'n' });
  } else {
    text(ctx, '심연에 삼켜졌다', W / 2, titleY, { size: 56, align: 'center', color: '#ff6a7a', font: 'd' });
    text(ctx, `${s.place}에서 쓰러졌다`, W / 2, titleY + 36,
      { size: 17, align: 'center', color: '#c6a8b0', font: 'n' });
  }

  // Stat block
  const bx = W / 2 - 330, by = 186;
  panel(ctx, bx, by, 660, 128, { fill: 'rgba(8,15,26,0.94)', border: 'rgba(90,150,180,0.45)', radius: 14 });
  const stats = [
    ['처치', `${s.kills}`, '#ff8a9a'],
    ['획득 금화', formatInt(s.gold), '#ffd870'],
    ['축복', `${s.boons}`, '#f5c542'],
    ['소요 시간', s.time, '#a9c2d8'],
  ];
  stats.forEach((st, i) => {
    const x = bx + 40 + i * 155;
    text(ctx, st[0], x, by + 40, { size: 15, color: '#7d95ab' });
    text(ctx, st[1], x, by + 76, { size: 30, color: st[2], font: 'd' });
  });

  // Shard payout
  const sy = by + 148;
  panel(ctx, W / 2 - 200, sy, 400, 66, {
    fill: 'rgba(10,28,40,0.95)', border: 'rgba(140,232,255,0.6)', radius: 12, glow: '#8ce8ff',
  });
  drawGlyph(ctx, 'shard', W / 2 - 152, sy + 33, 28, '#8ce8ff', 3);
  const shown = Math.round(s.shards * easeOutCubic(clamp((t - 0.4) / 0.9, 0, 1)));
  text(ctx, `+ ${shown}`, W / 2 - 118, sy + 44, { size: 32, align: 'left', color: '#a8f0ff', font: 'd' });
  text(ctx, '심연 결정 획득', W / 2 + 168, sy + 42, { size: 15, align: 'right', color: '#7fa8bd' });

  // Boons carried
  if (s.boons > 0) {
    text(ctx, '이번 잠수의 축복', W / 2, sy + 108, { size: 18, align: 'center', color: '#8ba6c0' });
    const list = s.boonList.slice(0, 10);
    const iw = 138, gap = 8;
    list.forEach((b, i) => {
      const row = Math.floor(i / 5);
      const col = i % 5;
      const cnt = Math.min(list.length - row * 5, 5);
      const rowW = cnt * (iw + gap) - gap;
      const x = W / 2 - rowW / 2 + col * (iw + gap);
      const y = sy + 124 + row * 40;
      const god = GODS[b.god];
      const rar = RARITY[b.rarity];
      panel(ctx, x, y, iw, 32, {
        fill: rgba(god.color, 0.14), border: rgba(rar.color, 0.6), radius: 6, shadow: false,
      });
      drawGlyph(ctx, god.glyph, x + 16, y + 16, 16, god.color, 2);
      text(ctx, b.name, x + 30, y + 22, { size: 13, color: '#dbe9f6', maxWidth: iw - 38 });
    });
  }

  const hy = H - 44;
  const kw = drawKeycap(ctx, W / 2 - 92, hy - 20, 'J', 28);
  text(ctx, won ? '영묘로 돌아간다' : '영묘로 돌아간다', W / 2 - 92 + kw + 10, hy + 1,
    { size: 19, color: '#cfe2f2' });
  ctx.restore();
}

// ------------------------------------------------------------------ pause

export function drawPause(ctx, game, t) {
  dimScreen(ctx, 0.72);
  panel(ctx, W / 2 - 220, 160, 440, 400, {
    fill: 'rgba(8,15,26,0.97)', border: 'rgba(90,150,180,0.55)', radius: 16,
  });
  text(ctx, '일시정지', W / 2, 224, { size: 38, align: 'center', color: '#57e2d6', font: 'd' });

  const items = game.pauseItems;
  items.forEach((it, i) => {
    const y = 296 + i * 54;
    const active = i === game.pauseIndex;
    if (active) {
      panel(ctx, W / 2 - 170, y - 24, 340, 42, {
        fill: 'rgba(87,226,214,0.12)', border: 'rgba(87,226,214,0.75)', radius: 8, shadow: false,
      });
    }
    let label = it.label;
    if (it.value) label += `   ${it.value()}`;
    text(ctx, label, W / 2, y + 5, {
      size: 23, align: 'center', color: active ? '#c8fff8' : '#9fb8cc',
    });
  });
  text(ctx, '←→ 로 값 조절', W / 2, 520, { size: 15, align: 'center', color: '#6f8aa2' });
}

// ------------------------------------------------------- room banner / toast

export function drawRoomBanner(ctx, banner) {
  if (!banner || banner.t >= banner.life) return;
  const u = banner.t / banner.life;
  const a = u < 0.18 ? u / 0.18 : u > 0.72 ? 1 - (u - 0.72) / 0.28 : 1;
  const slide = easeOutQuint(clamp(u * 4, 0, 1));
  ctx.save();
  ctx.globalAlpha = a;
  const y = 232;
  const x = W / 2 - 300 + (1 - slide) * 60;
  ctx.save();
  ctx.globalAlpha = a * 0.9;
  const g = ctx.createLinearGradient(x, 0, x + 600, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(4,10,18,0.9)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y - 46, 600, 106);
  ctx.restore();
  ctx.strokeStyle = rgba(banner.color || '#57e2d6', a * 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 90, y + 20); ctx.lineTo(x + 510, y + 20);
  ctx.stroke();
  text(ctx, banner.title, W / 2, y, {
    size: banner.big ? 50 : 38, align: 'center', color: banner.color || '#f5c542', font: 'd', alpha: a,
  });
  if (banner.subtitle) {
    text(ctx, banner.subtitle, W / 2, y + 46, {
      size: 18, align: 'center', color: '#a9c2d8', font: 'n', alpha: a,
    });
  }
  ctx.restore();
}

/** Full-screen boss introduction card. */
export function drawBossIntro(ctx, boss, t, dur) {
  const u = clamp(t / dur, 0, 1);
  const a = u < 0.12 ? u / 0.12 : u > 0.78 ? 1 - (u - 0.78) / 0.22 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  // Letterbox
  const bh = 90 * easeOutCubic(clamp(u * 5, 0, 1));
  ctx.fillStyle = 'rgba(2,4,9,0.92)';
  ctx.fillRect(0, 0, W, bh);
  ctx.fillRect(0, H - bh, W, bh);
  ctx.strokeStyle = rgba(boss.tint, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, bh); ctx.lineTo(W, bh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H - bh); ctx.lineTo(W, H - bh); ctx.stroke();

  const slide = easeOutQuint(clamp(u * 3, 0, 1));
  text(ctx, boss.subtitle, W / 2 + (1 - slide) * 40, H - 44, {
    size: 20, align: 'center', color: '#a9c2d8', font: 'n', alpha: a,
  });
  text(ctx, boss.title, W / 2 - (1 - slide) * 40, 56, {
    size: 54, align: 'center', color: boss.tint, font: 'd', alpha: a,
  });
  ctx.restore();
}
