// Arenas, biome progression, and the door/reward-preview loop.
//
// Arenas are deliberately open (no in-play collision geometry): every threat is
// telegraphed on the floor, so pillars would only create blind spots and pathing
// artefacts. Decoration lives outside the play boundary instead.

import { TAU, clamp, lerp, rng, Rng, dist, easeOutCubic, easeOutQuint, noise1 } from './core.js';
import { BIOME_THEME, floorTile, makeCanvas, withCtx, drawGlyph, glowDot, starPath, GODS, PAL } from './art.js';
import { rgba, shade, burst, emit, shockwave } from './fx.js';
import { ENEMY_POOLS, makeEnemy, tierFor } from './enemies.js';
import { makeBoss } from './bosses.js';
import { sfx } from './audio.js';

export const BIOMES = [
  { key: 'necropolis', rooms: 5 },
  { key: 'bastion', rooms: 6 },
  { key: 'throne', rooms: 6 },
];

export const REWARD_TYPES = {
  boon:   { key: 'boon',   name: '축복',      glyph: 'crown', color: '#f5c542', desc: '신의 축복을 하나 고른다' },
  gold:   { key: 'gold',   name: '금화',      glyph: 'coin',  color: '#f5c542', desc: '상점에서 쓸 금화' },
  shard:  { key: 'shard',  name: '심연 결정', glyph: 'shard', color: '#8ce8ff', desc: '죽어도 남는 영구 재화' },
  heal:   { key: 'heal',   name: '조류 샘',   glyph: 'heart', color: '#ff5470', desc: '체력을 회복한다' },
  maxhp:  { key: 'maxhp',  name: '심장 조각', glyph: 'heart', color: '#ff8fb0', desc: '최대 체력이 영구히 오른다' },
  shop:   { key: 'shop',   name: '난파선 상인', glyph: 'anvil', color: '#c9a04a', desc: '금화로 물건을 산다' },
  boss:   { key: 'boss',   name: '수호자',    glyph: 'skull',  color: '#ff5a4d', desc: '이 지역의 주인' },
};

// ------------------------------------------------------------------- room

export class Room {
  constructor(opts) {
    Object.assign(this, {
      w: 1180, h: 820, cx: 0, cy: 0, radius: 150,
      biome: 'necropolis', type: 'combat', index: 0, biomeIndex: 0,
    }, opts);
    this.theme = BIOME_THEME[this.biome];
    this.doors = [];
    this.props = [];
    this.decor = [];
    this.cleared = false;
    this.floorCanvas = null;
    this.age = 0;
    this.enterFade = 0;
    this.generateDecor();
  }

  get left() { return this.cx - this.w / 2; }
  get right() { return this.cx + this.w / 2; }
  get top() { return this.cy - this.h / 2; }
  get bottom() { return this.cy + this.h / 2; }

  generateDecor() {
    const r = new Rng((this.biomeIndex * 977 + this.index * 131 + 17) >>> 0);
    // Outside-the-arena silhouettes: coral, ruined columns, crown spires.
    const n = this.type === 'boss' ? 52 : 38;
    for (let i = 0; i < n; i++) {
      const side = r.int(0, 3);
      let x, y;
      const pad = r.range(40, 300);
      if (side === 0) { x = r.range(this.left - 120, this.right + 120); y = this.top - pad; }
      else if (side === 1) { x = r.range(this.left - 120, this.right + 120); y = this.bottom + pad; }
      else if (side === 2) { x = this.left - pad; y = r.range(this.top - 120, this.bottom + 120); }
      else { x = this.right + pad; y = r.range(this.top - 120, this.bottom + 120); }
      this.decor.push({
        x, y, s: r.range(0.6, 1.7), seed: r.range(0, 100),
        kind: this.biome === 'necropolis' ? (r.bool(0.6) ? 'coral' : 'bone')
          : this.biome === 'bastion' ? (r.bool(0.5) ? 'column' : 'crate')
          : (r.bool(0.5) ? 'spire' : 'coral'),
        depth: r.range(0.5, 1),
      });
    }
    // In-arena flat decals (no collision).
    for (let i = 0; i < 14; i++) {
      this.props.push({
        x: r.range(this.left + 70, this.right - 70),
        y: r.range(this.top + 70, this.bottom - 70),
        s: r.range(0.5, 1.2), rot: r.angle(), seed: r.range(0, 100),
        kind: r.bool(0.5) ? 'crack' : 'moss',
      });
    }
  }

  // --------------------------------------------------------- collision

  contains(x, y, margin = 0) {
    const hw = this.w / 2 - margin, hh = this.h / 2 - margin;
    const dx = Math.abs(x - this.cx), dy = Math.abs(y - this.cy);
    if (dx > hw || dy > hh) return false;
    const rr = Math.min(this.radius, hw, hh);
    const ix = dx - (hw - rr), iy = dy - (hh - rr);
    if (ix <= 0 || iy <= 0) return true;
    return ix * ix + iy * iy <= rr * rr;
  }

  clampedPoint(x, y, margin = 0) {
    const hw = this.w / 2 - margin, hh = this.h / 2 - margin;
    const rr = Math.max(0, Math.min(this.radius, hw, hh));
    let dx = x - this.cx, dy = y - this.cy;
    const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
    let ax = Math.min(Math.abs(dx), hw), ay = Math.min(Math.abs(dy), hh);
    // Round the corners off.
    const ix = ax - (hw - rr), iy = ay - (hh - rr);
    if (ix > 0 && iy > 0) {
      const l = Math.hypot(ix, iy);
      if (l > rr) {
        ax = (hw - rr) + ix / l * rr;
        ay = (hh - rr) + iy / l * rr;
      }
    }
    return { x: this.cx + sx * ax, y: this.cy + sy * ay };
  }

  clampCircle(e) {
    const p = this.clampedPoint(e.x, e.y, e.r * 0.72);
    if (p.x !== e.x) { e.x = p.x; e.vx *= -0.15; e.knockVx *= -0.3; }
    if (p.y !== e.y) { e.y = p.y; e.vy *= -0.15; e.knockVy *= -0.3; }
  }

  clampPoint(o, margin = 0) {
    const p = this.clampedPoint(o.x, o.y, margin);
    o.x = p.x; o.y = p.y;
  }

  randomPointAway(fromX, fromY, minDist, margin = 90) {
    for (let i = 0; i < 30; i++) {
      const x = rng.range(this.left + margin, this.right - margin);
      const y = rng.range(this.top + margin, this.bottom - margin);
      if (dist(x, y, fromX, fromY) >= minDist && this.contains(x, y, margin)) return { x, y };
    }
    return this.clampedPoint(this.cx + rng.range(-200, 200), this.cy + rng.range(-160, 160), margin);
  }

  // ------------------------------------------------------------ render

  arenaPath(ctx, inset = 0) {
    const hw = this.w / 2 - inset, hh = this.h / 2 - inset;
    const rr = Math.max(0, Math.min(this.radius - inset, hw, hh));
    const x = this.cx - hw, y = this.cy - hh, w = hw * 2, h = hh * 2;
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

  /** Bake the arena floor once — per-frame pattern fills are the biggest cost otherwise. */
  bakeFloor() {
    const pad = 40;
    const w = this.w + pad * 2, h = this.h + pad * 2;
    const tile = floorTile(this.biome);
    const th = this.theme;
    this.floorOrigin = { x: this.cx - w / 2, y: this.cy - h / 2 };
    this.floorCanvas = withCtx(w, h, (g) => {
      g.save();
      g.translate(-this.floorOrigin.x, -this.floorOrigin.y);
      this.arenaPath(g, 0);
      g.clip();
      g.fillStyle = g.createPattern(tile, 'repeat');
      g.fillRect(this.floorOrigin.x, this.floorOrigin.y, w, h);

      // Central emblem
      g.save();
      g.globalAlpha = 0.13;
      g.translate(this.cx, this.cy);
      g.strokeStyle = th.accent2;
      g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, 168, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 132, 0, TAU); g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 132, Math.sin(a) * 132);
        g.lineTo(Math.cos(a) * 168, Math.sin(a) * 168);
        g.stroke();
      }
      g.globalAlpha = 0.1;
      drawGlyph(g, this.type === 'boss' ? 'skull' : 'crown', 0, 0, 108, th.accent, 6);
      g.restore();

      // Flat props
      for (const p of this.props) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(p.s, p.s);
        if (p.kind === 'crack') {
          g.strokeStyle = rgba(th.grout, 0.75);
          g.lineWidth = 3;
          g.beginPath();
          let px = 0, py = 0, a = p.seed;
          g.moveTo(0, 0);
          for (let s = 0; s < 6; s++) {
            a += Math.sin(p.seed + s) * 0.9;
            px += Math.cos(a) * 20; py += Math.sin(a) * 20;
            g.lineTo(px, py);
          }
          g.stroke();
        } else {
          g.globalAlpha = 0.22;
          g.fillStyle = th.accent2;
          for (let i = 0; i < 5; i++) {
            g.beginPath();
            g.ellipse(Math.cos(i * 2.1) * 16, Math.sin(i * 1.7) * 12, 12, 8, i, 0, TAU);
            g.fill();
          }
        }
        g.restore();
      }

      // Edge shading — makes the arena read as a raised platform.
      g.globalCompositeOperation = 'source-atop';
      const grd = g.createRadialGradient(this.cx, this.cy, Math.min(this.w, this.h) * 0.25,
        this.cx, this.cy, Math.max(this.w, this.h) * 0.62);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = grd;
      g.fillRect(this.floorOrigin.x, this.floorOrigin.y, w, h);
      g.restore();
    });
  }

  drawFloor(ctx) {
    if (!this.floorCanvas) this.bakeFloor();
    // Depth skirt under the platform. Concentric fading strokes stand in for a
    // blur; ctx.filter would cost a full-surface readback every frame.
    ctx.save();
    ctx.fillStyle = '#01040a';
    for (let i = 5; i >= 1; i--) {
      ctx.globalAlpha = 0.12;
      this.arenaPath(ctx, -i * 7);
      ctx.fill();
    }
    ctx.restore();
    ctx.drawImage(this.floorCanvas, this.floorOrigin.x, this.floorOrigin.y);
  }

  drawEdge(ctx, t) {
    const th = this.theme;
    ctx.save();
    // Rim wall
    this.arenaPath(ctx, 0);
    ctx.strokeStyle = shade(th.grout, -0.3);
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.strokeStyle = shade(th.floor2, 0.16);
    ctx.lineWidth = 7;
    ctx.stroke();
    // Glow line
    ctx.strokeStyle = rgba(th.light, 0.42 + Math.sin(t * 1.6) * 0.08);
    ctx.lineWidth = 2.6;
    ctx.shadowColor = th.light;
    ctx.shadowBlur = 16;
    this.arenaPath(ctx, 5);
    ctx.stroke();
    ctx.restore();
  }

  drawDecor(ctx, t) {
    const th = this.theme;
    for (const d of this.decor) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.s, d.s);
      ctx.globalAlpha = 0.35 + d.depth * 0.35;
      if (d.kind === 'coral') {
        ctx.strokeStyle = shade(th.accent, -0.45);
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        const sway = Math.sin(t * 0.8 + d.seed) * 5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 9, 26);
          ctx.quadraticCurveTo(i * 16 + sway, -6, i * 22 + sway * 1.6, -34 - Math.abs(i) * 8);
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(th.accent, 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 26);
        ctx.quadraticCurveTo(sway, -10, sway * 1.6, -44);
        ctx.stroke();
      } else if (d.kind === 'bone') {
        ctx.fillStyle = '#8f93a0';
        ctx.beginPath();
        ctx.ellipse(0, 12, 22, 9, 0.2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#5a5f6d';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 8, 8);
          ctx.lineTo(i * 12, -22 - Math.abs(i) * 4);
          ctx.stroke();
        }
      } else if (d.kind === 'column') {
        ctx.fillStyle = '#2c3648';
        ctx.fillRect(-16, -70, 32, 92);
        ctx.strokeStyle = '#151c28';
        ctx.lineWidth = 3;
        ctx.strokeRect(-16, -70, 32, 92);
        ctx.fillStyle = '#3b4a60';
        ctx.fillRect(-22, -80, 44, 14);
        ctx.strokeRect(-22, -80, 44, 14);
        ctx.strokeStyle = rgba(th.accent, 0.35);
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-8 + i * 8, -64); ctx.lineTo(-8 + i * 8, 18);
          ctx.stroke();
        }
      } else if (d.kind === 'crate') {
        ctx.fillStyle = '#3a2c1e';
        ctx.fillRect(-18, -22, 36, 36);
        ctx.strokeStyle = '#1a130c';
        ctx.lineWidth = 3;
        ctx.strokeRect(-18, -22, 36, 36);
        ctx.strokeStyle = '#5a4530';
        ctx.beginPath();
        ctx.moveTo(-18, -22); ctx.lineTo(18, 14);
        ctx.moveTo(18, -22); ctx.lineTo(-18, 14);
        ctx.stroke();
      } else {
        // spire
        const glow = 0.4 + Math.sin(t * 1.4 + d.seed) * 0.2;
        ctx.fillStyle = '#241738';
        ctx.beginPath();
        ctx.moveTo(-16, 24); ctx.lineTo(-8, -56); ctx.lineTo(0, -76);
        ctx.lineTo(8, -56); ctx.lineTo(16, 24);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#0e0819';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = rgba('#f5c542', glow);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-4, 16); ctx.lineTo(0, -62);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ doors

export class Door {
  constructor(x, y, angle, reward, room) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.reward = reward;
    this.room = room;
    this.open = false;
    this.openT = 0;
    this.hover = 0;
    this.age = rng.range(0, 10);
    this.used = false;
  }

  get info() { return REWARD_TYPES[this.reward.type]; }

  update(dt, player) {
    this.age += dt;
    if (this.open) this.openT = Math.min(1, this.openT + dt * 2.6);
    const d = player ? dist(this.x, this.y, player.x, player.y) : 999;
    this.near = this.open && d < 96;
    this.hover = lerp(this.hover, this.near ? 1 : 0, 1 - Math.exp(-14 * dt));
    if (this.open && rng.next() < 0.35) {
      const info = this.info;
      emit({
        x: this.x + rng.range(-24, 24), y: this.y + rng.range(-6, 10),
        vx: rng.range(-14, 14), vy: rng.range(-52, -18),
        life: rng.range(0.5, 1.1), t: 0, r0: rng.range(1.5, 3.5), r1: 0,
        color: info.color, kind: 'dot', drag: 1.4, glow: true,
      });
    }
  }

  draw(ctx) {
    const info = this.info;
    const o = easeOutCubic(this.openT);
    ctx.save();
    ctx.translate(this.x, this.y);

    // Frame
    ctx.save();
    ctx.scale(1, 0.92);
    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.moveTo(-42, 26);
    ctx.lineTo(-42, -22);
    ctx.arc(0, -22, 42, Math.PI, 0);
    ctx.lineTo(42, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.open ? rgba(info.color, 0.85) : 'rgba(90,110,130,0.6)';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Interior
    if (this.open) {
      const g = ctx.createLinearGradient(0, -60, 0, 26);
      g.addColorStop(0, rgba(info.color, 0.55 * o));
      g.addColorStop(1, rgba(info.color, 0.05 * o));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-36, 24);
      ctx.lineTo(-36, -22);
      ctx.arc(0, -22, 36, Math.PI, 0);
      ctx.lineTo(36, 24);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(10,18,30,0.9)';
      ctx.beginPath();
      ctx.moveTo(-36, 24);
      ctx.lineTo(-36, -22);
      ctx.arc(0, -22, 36, Math.PI, 0);
      ctx.lineTo(36, 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (!this.open) { ctx.restore(); return; }

    // Reward sigil floating above the arch
    const bob = Math.sin(this.age * 2) * 4;
    const scale = 1 + this.hover * 0.22;
    ctx.save();
    ctx.translate(0, -78 + bob);
    ctx.scale(scale, scale);
    glowDot(ctx, 0, 0, 46, info.color, 0.55 + this.hover * 0.3);
    ctx.save();
    ctx.rotate(Math.sin(this.age * 1.2) * 0.1);
    starPath(ctx, 0, 0, 6, 30, 20, this.age * 0.4);
    ctx.fillStyle = rgba(info.color, 0.2);
    ctx.fill();
    ctx.strokeStyle = rgba(info.color, 0.7);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const glyph = this.reward.god ? GODS[this.reward.god].glyph : info.glyph;
    const gcol = this.reward.god ? GODS[this.reward.god].color : info.color;
    drawGlyph(ctx, glyph, 0, 0, 34, gcol, 3);
    ctx.restore();

    // Label
    if (this.hover > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.hover;
      ctx.textAlign = 'center';
      const label = this.reward.god ? GODS[this.reward.god].name + '의 축복' : info.name;
      const sub = this.reward.label || info.desc;
      ctx.font = '22px Galmuri11Bold, Galmuri11, monospace';
      const wpx = Math.max(ctx.measureText(label).width, ctx.measureText(sub).width) + 40;
      ctx.fillStyle = 'rgba(6,12,22,0.9)';
      ctx.strokeStyle = rgba(info.color, 0.8);
      ctx.lineWidth = 2;
      const bx = -wpx / 2, by = -152, bw = wpx, bh = 62;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 10) : ctx.rect(bx, by, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = gcolSafe(this.reward, info);
      ctx.fillText(label, 0, by + 24);
      ctx.font = '14px Galmuri11, monospace';
      ctx.fillStyle = '#a9c2d8';
      ctx.fillText(sub, 0, by + 46);
      ctx.restore();
    }
    ctx.restore();
  }
}

function gcolSafe(reward, info) {
  return reward.god ? GODS[reward.god].color : info.color;
}

// ------------------------------------------------------------ run planning

/** Build the full room plan for a run up front so door previews can be honest. */
export function planRun(seed) {
  const r = new Rng(seed);
  const plan = [];
  for (let b = 0; b < BIOMES.length; b++) {
    const biome = BIOMES[b];
    const rooms = [];
    // Guarantee at least two boon rooms and one shop per biome.
    const rewards = [];
    rewards.push({ type: 'boon' }, { type: 'boon' });
    rewards.push({ type: 'shop' });
    rewards.push({ type: r.bool(0.5) ? 'gold' : 'shard' });
    while (rewards.length < biome.rooms) {
      rewards.push(r.weighted([
        { type: 'boon', w: 34 },
        { type: 'gold', w: 22 },
        { type: 'shard', w: 18 },
        { type: 'heal', w: 16 },
        { type: 'maxhp', w: 10 },
      ]));
    }
    const shuffled = r.shuffle(rewards).slice(0, biome.rooms);
    for (let i = 0; i < biome.rooms; i++) {
      rooms.push({
        biome: biome.key, biomeIndex: b, index: i,
        type: shuffled[i].type === 'shop' ? 'shop' : 'combat',
        reward: shuffled[i],
        elite: i >= 2 && r.bool(0.28),
      });
    }
    rooms.push({
      biome: biome.key, biomeIndex: b, index: biome.rooms,
      type: 'boss', reward: { type: 'boon' }, elite: false,
    });
    plan.push({ biome: biome.key, biomeIndex: b, rooms });
  }
  return plan;
}

/** The doors offered after clearing `roomInfo`; the next room's reward is previewed. */
export function doorRewardsFor(plan, biomeIndex, roomIndex, rand, build) {
  const biome = plan[biomeIndex];
  const nextIndex = roomIndex + 1;
  if (nextIndex >= biome.rooms.length) {
    // Move on to the next biome.
    if (biomeIndex + 1 >= plan.length) return [];
    return [{ type: 'boss', label: '다음 지역으로', jump: true }];
  }
  const next = biome.rooms[nextIndex];
  if (next.type === 'boss') {
    return [{ type: 'boss', label: `${BIOME_THEME[biome.biome].name}의 수호자`, roomIndex: nextIndex }];
  }

  // Offer two or three distinct rewards; one always matches the planned room so
  // the preview never lies, the others are alternates rolled here.
  const options = [];
  const primary = { ...next.reward, roomIndex: nextIndex };
  if (primary.type === 'boon') primary.god = rand.pick(Object.keys(GODS).filter((g) => g !== 'crown'));
  options.push(primary);

  const alts = ['boon', 'gold', 'shard', 'heal', 'maxhp'].filter((t) => t !== primary.type);
  const count = rand.bool(0.65) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const t = rand.pick(alts);
    alts.splice(alts.indexOf(t), 1);
    const o = { type: t, roomIndex: nextIndex, alt: true };
    if (t === 'boon') o.god = rand.pick(Object.keys(GODS).filter((g) => g !== 'crown'));
    options.push(o);
  }
  return rand.shuffle(options);
}

// -------------------------------------------------------------- room build

export function buildRoom(info, biomeIndex) {
  const sizes = {
    combat: [[1180, 820], [1320, 760], [1080, 900]],
    shop: [[900, 640]],
    boss: [[1460, 980]],
  };
  const opt = rng.pick(sizes[info.type] || sizes.combat);
  return new Room({
    w: opt[0], h: opt[1], cx: 0, cy: 0,
    radius: info.type === 'boss' ? 260 : rng.range(120, 200),
    biome: info.biome, type: info.type, index: info.index, biomeIndex,
  });
}

/** Spawn budget grows with depth; waves keep pressure without flooding the arena. */
export function planWaves(info, biomeIndex, roomIndex) {
  const pool = ENEMY_POOLS[info.biome];
  const depth = biomeIndex * 6 + roomIndex;
  const budget = 3.2 + depth * 0.72 + (info.elite ? 2.5 : 0);
  const waveCount = depth < 3 ? 1 : depth < 8 ? 2 : rng.bool(0.5) ? 2 : 3;
  const waves = [];
  let left = budget;
  for (let w = 0; w < waveCount; w++) {
    const share = w === waveCount - 1 ? left : left * rng.range(0.4, 0.6);
    left -= share;
    let spend = share;
    const types = [];
    let guard = 0;
    while (spend > 0.6 && types.length < 8 && guard++ < 30) {
      const pick = rng.weighted(pool);
      if (pick.cost > spend + 0.5) continue;
      types.push(pick.type);
      spend -= pick.cost;
    }
    if (types.length === 0) types.push(pool[0].type);
    waves.push(types);
  }
  return waves;
}

export function spawnWave(world, types, tier) {
  const room = world.room;
  const p = world.player;
  for (const t of types) {
    const pt = room.randomPointAway(p.x, p.y, 300, 110);
    const e = makeEnemy(t, pt.x, pt.y, tier);
    if (e) {
      world.enemies.push(e);
      shockwave(pt.x, pt.y, { r0: 6, r1: 70, life: 0.5, color: rgba(e.tint, 0.7), width: 3 });
    }
  }
}

export function spawnBoss(world, biomeKey, tier) {
  const room = world.room;
  const b = makeBoss(biomeKey, room.cx, room.cy - room.h * 0.24, tier);
  if (b) {
    world.enemies.push(b);
    world.boss = b;
  }
  return b;
}

/** Place doors along the top edge of the arena, evenly spread. */
export function placeDoors(room, rewards) {
  const doors = [];
  const n = rewards.length;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : 0.5 + (i - (n - 1) / 2) * (0.62 / Math.max(1, n - 1));
    const x = lerp(room.left + 150, room.right - 150, t);
    const y = room.top + 34;
    doors.push(new Door(x, y, -Math.PI / 2, rewards[i], room));
  }
  return doors;
}

// ------------------------------------------------------------------- shop

export const SHOP_STOCK = [
  { id: 'heal_s', name: '조류 정수', desc: '체력 40 회복', cost: 60, glyph: 'heart', color: '#ff5470',
    apply: (world) => world.player.heal(40) },
  { id: 'heal_l', name: '심연 성수', desc: '체력 완전 회복', cost: 140, glyph: 'heart', color: '#ff8fb0',
    apply: (world) => world.player.heal(9999) },
  { id: 'maxhp', name: '심장 조각', desc: '최대 체력 +20', cost: 130, glyph: 'heart', color: '#ff5470',
    apply: (world) => world.player.addMaxHp(20) },
  { id: 'boon', name: '봉인된 축복', desc: '축복 하나를 고른다', cost: 160, glyph: 'crown', color: '#f5c542',
    apply: (world) => { world.pendingBoon = true; } },
  { id: 'shard', name: '결정 다발', desc: '심연 결정 +5', cost: 110, glyph: 'shard', color: '#8ce8ff',
    apply: (world) => { world.run.shards += 5; } },
  { id: 'ammo', name: '주문 증폭기', desc: '주문 탄약 +1', cost: 120, glyph: 'crystal', color: '#7ba8ff',
    apply: (world) => { world.player.castAmmoMax++; world.player.castAmmo++; } },
];

export class Pedestal {
  constructor(x, y, item) {
    this.x = x; this.y = y;
    this.item = item;
    this.bought = false;
    this.age = rng.range(0, 6);
    this.hover = 0;
  }

  update(dt, player) {
    this.age += dt;
    const d = player ? dist(this.x, this.y, player.x, player.y) : 999;
    this.near = !this.bought && d < 86;
    this.hover = lerp(this.hover, this.near ? 1 : 0, 1 - Math.exp(-13 * dt));
    if (!this.bought && rng.next() < 0.2) {
      emit({
        x: this.x + rng.range(-14, 14), y: this.y - 20,
        vx: rng.range(-10, 10), vy: rng.range(-40, -14),
        life: rng.range(0.4, 0.9), t: 0, r0: rng.range(1.5, 3), r1: 0,
        color: this.item.color, kind: 'dot', drag: 1.6, glow: true,
      });
    }
  }

  draw(ctx, gold) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // Plinth
    ctx.fillStyle = '#1d2839';
    ctx.beginPath();
    ctx.ellipse(0, 22, 30, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2b3a4f';
    ctx.fillRect(-20, -6, 40, 28);
    ctx.strokeStyle = '#0d1420';
    ctx.lineWidth = 3;
    ctx.strokeRect(-20, -6, 40, 28);
    ctx.fillStyle = '#3a4d66';
    ctx.beginPath(); ctx.ellipse(0, -6, 22, 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0d1420'; ctx.stroke();

    if (this.bought) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#6a7d90';
      ctx.font = '16px Galmuri11, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('판매됨', 0, -22);
      ctx.restore();
      return;
    }

    const bob = Math.sin(this.age * 2.2) * 5;
    const s = 1 + this.hover * 0.16;
    ctx.save();
    ctx.translate(0, -48 + bob);
    ctx.scale(s, s);
    glowDot(ctx, 0, 0, 40, this.item.color, 0.5 + this.hover * 0.3);
    drawGlyph(ctx, this.item.glyph, 0, 0, 34, this.item.color, 3);
    ctx.restore();

    // Price tag
    const afford = gold >= this.item.cost;
    ctx.textAlign = 'center';
    ctx.font = '18px Galmuri11Bold, Galmuri11, monospace';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(4,8,14,0.9)';
    ctx.lineJoin = 'round';
    const txt = `${this.item.cost} G`;
    ctx.strokeText(txt, 0, -84);
    ctx.fillStyle = afford ? '#ffd870' : '#ff7a8a';
    ctx.fillText(txt, 0, -84);

    // Name and effect live in the bottom interaction prompt instead of a floating
    // card — the top of the screen already carries the door markers.
    ctx.font = '17px Galmuri11Bold, Galmuri11, monospace';
    ctx.strokeText(this.item.name, 0, -108);
    ctx.fillStyle = this.hover > 0.5 ? '#ffffff' : rgba(this.item.color, 0.9);
    ctx.fillText(this.item.name, 0, -108);

    if (this.hover > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.hover * 0.9;
      ctx.strokeStyle = rgba(this.item.color, 0.85);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -this.age * 30;
      ctx.beginPath();
      ctx.ellipse(0, 14, 52, 24, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
