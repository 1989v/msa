// Enemy roster. Every attack has a readable wind-up (telegraph) drawn on the floor
// or in the air before the hitbox exists — the player should always be able to answer
// "what is about to happen and where" before it happens.

import {
  TAU, clamp, lerp, damp, dist, angleDiff, angleApproach, rng, easeOutCubic,
  easeOutQuint, easeInCubic, inCone, distToSegment, separate,
} from './core.js';
import {
  addShake, burst, shockwave, emit, rgba, decal, damageNumber, screenFlash,
} from './fx.js';
import { Entity, TEAM, Projectile, Hazard, applyDamage, nearestTarget } from './entities.js';
import { drawShadow, glowDot, limb, starPath, shapeStyle, organicBlob, blobPath, telegraphColor } from './art.js';
import { sfx } from './audio.js';

// --------------------------------------------------------------- telegraphs

/**
 * Floor-drawn warning. `kind` picks the shape; `t/dur` drives the fill sweep
 * from a thin outline to a fully saturated area right before the strike.
 */
export function drawTelegraph(ctx, tel) {
  if (!tel) return;
  const u = clamp(tel.t / tel.dur, 0, 1);
  const col = tel.color || '#ff9a3c';
  const flash = u > 0.86 ? (Math.floor(u * 40) % 2 === 0 ? 1 : 0.45) : 1;

  ctx.save();
  ctx.translate(tel.x, tel.y);
  // Readable from frame one — the danger area must be obvious before the fill
  // sweep starts, not only just before impact.
  ctx.globalAlpha = (0.36 + u * 0.38) * flash;

  if (tel.kind === 'cone') {
    ctx.rotate(tel.angle);
    ctx.fillStyle = rgba(col, 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tel.range, -tel.half, tel.half);
    ctx.closePath();
    ctx.fill();
    // Filling wedge showing time-to-impact.
    ctx.fillStyle = rgba(col, 0.85);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tel.range * u, -tel.half, tel.half);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.85 * flash;
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tel.range, -tel.half, tel.half);
    ctx.closePath();
    ctx.stroke();
  } else if (tel.kind === 'line') {
    ctx.rotate(tel.angle);
    const w = tel.width;
    ctx.fillStyle = rgba(col, 0.35);
    ctx.fillRect(0, -w / 2, tel.range, w);
    ctx.fillStyle = rgba(col, 0.85);
    ctx.fillRect(0, -w / 2, tel.range * u, w);
    ctx.globalAlpha = 0.9 * flash;
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = 2.4;
    ctx.strokeRect(0, -w / 2, tel.range, w);
  } else if (tel.kind === 'circle') {
    ctx.scale(1, 0.66);
    ctx.fillStyle = rgba(col, 0.3);
    ctx.beginPath(); ctx.arc(0, 0, tel.r, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(col, 0.8);
    ctx.beginPath(); ctx.arc(0, 0, tel.r * u, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.95 * flash;
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, tel.r, 0, TAU); ctx.stroke();
  } else if (tel.kind === 'ring') {
    ctx.globalAlpha = (0.4 + u * 0.5) * flash;
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = 3 + u * 4;
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -tel.t * 60;
    ctx.beginPath();
    ctx.arc(0, 0, lerp(tel.r * 1.5, tel.r, u), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------- base

export class Enemy extends Entity {
  constructor(x, y, cfg) {
    super(x, y, cfg.r || 20);
    this.type = cfg.type;
    this.name = cfg.name;
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.touchDamage = cfg.touch || 0;
    this.tint = cfg.tint || '#4fd1ff';
    this.blood = cfg.blood || '#2fd6c0';
    this.mass = cfg.mass || 1;
    this.xpValue = cfg.xp || 1;
    this.elite = !!cfg.elite;
    this.aiState = 'spawn';
    this.aiT = 0;
    this.tel = null;
    this.attackCd = rng.range(0.3, 1.1);
    this.spawnT = 0;
    this.spawnDur = cfg.spawnDur ?? 0.55;
    this.untargetable = true;
    this.slowT = 0;
    this.slowAmt = 0;
    this.contactHit = 0;
    this.wob = rng.angle();
    this.facing = rng.angle();
  }

  get moveSpeed() {
    let s = this.speed * this.statusSpeedMult();
    if (this.slowT > 0) s *= 1 - this.slowAmt;
    return s;
  }

  update(dt, world) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.slowT = Math.max(0, this.slowT - dt);
    this.contactHit = Math.max(0, this.contactHit - dt);
    this.updateStatuses(dt, world);

    if (this.aiState === 'spawn') {
      this.spawnT += dt;
      if (this.spawnT >= this.spawnDur) {
        this.aiState = 'chase';
        this.untargetable = false;
        this.aiT = 0;
      }
      this.integrateKnockback(dt);
      world.room.clampCircle(this);
      return;
    }

    if (this.tel) {
      this.tel.t += dt;
      this.tel.x = this.tel.follow ? this.x : this.tel.x;
      this.tel.y = this.tel.follow ? this.y : this.tel.y;
    }

    const frozen = this.hasStatus('frozen');
    if (!frozen) {
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.aiT += dt;
      this.think(dt, world);
    }

    this.integrateKnockback(dt);
    this.separateFrom(world, dt);
    world.room.clampCircle(this);
    this.tickContact(world, dt);
  }

  tickContact(world, dt) {
    if (this.touchDamage <= 0 || this.contactHit > 0) return;
    const p = world.player;
    if (!p || p.dead) return;
    if (dist(this.x, this.y, p.x, p.y) > this.r + p.r * 0.85) return;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    p.takeDamage(world, this.touchDamage, { dirX: Math.cos(a), dirY: Math.sin(a) });
    this.contactHit = 0.7;
  }

  separateFrom(world, dt) {
    if (this.noSeparate) return;
    for (const o of world.enemies) {
      if (o === this || o.dead || o.noSeparate) continue;
      const s = separate(this.x, this.y, this.r, o.x, o.y, o.r);
      if (!s) continue;
      const w = o.mass / (this.mass + o.mass);
      this.x += s.x * w * 0.5;
      this.y += s.y * w * 0.5;
    }
  }

  moveToward(dt, tx, ty, speedMult = 1, turnRate = 8) {
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.facing = angleApproach(this.facing, a, dt * turnRate);
    const s = this.moveSpeed * speedMult;
    this.vx = damp(this.vx, Math.cos(a) * s, 9, dt);
    this.vy = damp(this.vy, Math.sin(a) * s, 9, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  strafeAround(dt, tx, ty, want, dirSign = 1, speedMult = 1) {
    const d = dist(this.x, this.y, tx, ty);
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.facing = angleApproach(this.facing, a, dt * 7);
    const radial = clamp((d - want) / 90, -1, 1);
    const tang = dirSign * 0.75;
    const mx = Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * tang;
    const my = Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * tang;
    const len = Math.hypot(mx, my) || 1;
    const s = this.moveSpeed * speedMult;
    this.vx = damp(this.vx, (mx / len) * s, 7, dt);
    this.vy = damp(this.vy, (my / len) * s, 7, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  brake(dt, rate = 8) {
    this.vx = damp(this.vx, 0, rate, dt);
    this.vy = damp(this.vy, 0, rate, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  startTelegraph(kind, opts) {
    this.tel = Object.assign({ kind, t: 0, dur: 0.6, x: this.x, y: this.y, color: '#ff9a3c' }, opts);
    sfx('telegraph');
  }

  think(dt, world) { /* overridden */ }

  drawBase(ctx, world) {
    if (this.aiState === 'spawn') {
      const u = this.spawnT / this.spawnDur;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = rgba(this.tint, 0.9);
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 7]);
      ctx.lineDashOffset = -this.age * 50;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 6, this.r * (1.9 - u), this.r * (1.2 - u * 0.6), 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = u * 0.85;
      ctx.translate(this.x, this.y);
      ctx.scale(u, u);
      ctx.translate(-this.x, -this.y);
      this.drawBody(ctx, world);
      ctx.restore();
      return;
    }

    drawShadow(ctx, this.x, this.y + this.r * 0.55, this.r * 0.85, this.r * 0.36, 0.4);
    ctx.save();
    if (this.hitFlash > 0) ctx.filter = `brightness(${1 + this.hitFlash * 3.2}) saturate(${1 - this.hitFlash * 0.6})`;
    this.drawBody(ctx, world);
    ctx.restore();
    this.drawStatusAura(ctx);
    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    // Bosses own the large banner bar at the top of the screen instead.
    if (this.isBoss || this.hp >= this.maxHp || this.dead) return;
    const w = Math.max(34, this.r * 2.1);
    const h = 5;
    const x = this.x - w / 2;
    const y = this.y - this.r - (this.barOffset || 16);
    ctx.save();
    ctx.fillStyle = 'rgba(6,12,20,0.82)';
    ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    ctx.fillStyle = 'rgba(90,20,34,0.9)';
    ctx.fillRect(x, y, w, h);
    const p = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = this.elite ? '#ffb347' : '#ff5470';
    ctx.fillRect(x, y, w * p, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w * p, 1.6);
    if (this.elite) {
      ctx.strokeStyle = '#ffd34a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------- 산호 묘지 / necropolis

class Crawler extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'crawler', name: '산호게', r: 21, hp: 62 * t.hp, speed: 118 * t.spd,
      touch: 0, tint: '#ff8fb0', blood: '#ff6f95', mass: 1.1,
    });
    this.lungeDmg = 16 * t.dmg;
    this.clawPhase = 0;
  }

  think(dt, world) {
    const p = world.player;
    const d = dist(this.x, this.y, p.x, p.y);
    this.clawPhase += dt * (this.aiState === 'chase' ? 8 : 3);

    if (this.aiState === 'chase') {
      this.moveToward(dt, p.x, p.y, 1, 7);
      if (d < 190 && this.attackCd <= 0) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.lungeAngle = Math.atan2(p.y - this.y, p.x - this.x);
        this.startTelegraph('line', {
          dur: 0.52, angle: this.lungeAngle, range: 230, width: 46,
          color: '#ff6a7a', follow: true,
        });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 10);
      // Slight tracking during wind-up keeps it threatening but still dodgeable.
      this.lungeAngle = angleApproach(this.lungeAngle, Math.atan2(p.y - this.y, p.x - this.x), dt * 1.6);
      this.tel.angle = this.lungeAngle;
      this.facing = this.lungeAngle;
      if (this.aiT >= 0.52) {
        this.aiState = 'lunge';
        this.aiT = 0;
        this.tel = null;
        this.hitOnce = false;
        this.vx = Math.cos(this.lungeAngle) * 620;
        this.vy = Math.sin(this.lungeAngle) * 620;
        sfx('swing', clamp((this.x - world.camera.x) / 640, -1, 1));
        burst(this.x, this.y, 8, {
          speed: [60, 200], life: [0.2, 0.4], r0: [2, 4], r1: 0,
          color: '#ff8fb0', kind: 'spark', spread: 1.4, dir: this.lungeAngle + Math.PI, drag: 5,
        });
      }
    } else if (this.aiState === 'lunge') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const dr = Math.exp(-5.5 * dt);
      this.vx *= dr; this.vy *= dr;
      if (!this.hitOnce && dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
        this.hitOnce = true;
        p.takeDamage(world, this.lungeDmg, {
          dirX: Math.cos(this.lungeAngle), dirY: Math.sin(this.lungeAngle),
        });
      }
      if (this.aiT >= 0.42) {
        this.aiState = 'chase';
        this.attackCd = rng.range(1.5, 2.4);
      }
    }
  }

  drawBody(ctx) {
    const wob = Math.sin(this.age * 3 + this.wob) * 0.08;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing);
    // Legs
    ctx.strokeStyle = '#8e3a55';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const base = -6 + i * 8;
        const k = Math.sin(this.clawPhase + i * 1.3) * 5 * s;
        ctx.beginPath();
        ctx.moveTo(base, s * 8);
        ctx.lineTo(base - 4, s * (17 + k * 0.3));
        ctx.lineTo(base + 3, s * (24 + k * 0.5));
        ctx.stroke();
      }
    }
    // Claws
    const open = this.aiState === 'wind' ? 0.5 + Math.sin(this.age * 30) * 0.2 : 0.2;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(15, s * 13);
      ctx.rotate(s * (0.4 - open));
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 7, 0, 0, TAU);
      shapeStyle(ctx, 0, 0, 10, '#d4587a', { outlineW: 2.4 });
      ctx.fillStyle = '#f3a0b8';
      ctx.beginPath();
      ctx.moveTo(6, -2); ctx.lineTo(15, s * -3 - 1); ctx.lineTo(6, 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5c1f31'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    // Shell
    ctx.save();
    ctx.rotate(wob);
    organicBlob(ctx, 0, 0, 19, this.seed, this.age * 0.4, 9, 0.14);
    shapeStyle(ctx, 0, -4, 20, '#c74f70', { lightDir: -Math.PI / 2.2, rim: 0.7, outlineW: 3 });
    // Coral growths
    ctx.strokeStyle = '#ffd6e2';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + this.seed;
      const r0 = 8, r1 = 15 + Math.sin(this.age * 2 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 3);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - 6);
      ctx.stroke();
    }
    ctx.restore();
    // Eyes
    const eg = this.aiState === 'wind' ? 1 : 0.7;
    for (const s of [-1, 1]) {
      glowDot(ctx, 9, s * 6, 7, '#ffe27a', eg);
      ctx.fillStyle = '#2a0a14';
      ctx.beginPath(); ctx.arc(10, s * 6, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

class Drifter extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'drifter', name: '포자충', r: 19, hp: 46 * t.hp, speed: 74 * t.spd,
      tint: '#9ee87a', blood: '#7fd45a', mass: 0.7,
    });
    this.shotDmg = 11 * t.dmg;
    this.dirSign = rng.sign();
    this.float = rng.angle();
  }

  think(dt, world) {
    const p = world.player;
    this.float += dt * 2;
    if (this.aiState === 'chase') {
      this.strafeAround(dt, p.x, p.y, 230, this.dirSign, 1);
      if (this.attackCd <= 0 && dist(this.x, this.y, p.x, p.y) < 400) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.startTelegraph('ring', { dur: 0.6, r: 46, color: '#a8ff7a', follow: true });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 5);
      this.facing = angleApproach(this.facing, Math.atan2(p.y - this.y, p.x - this.x), dt * 5);
      if (this.aiT >= 0.6) {
        this.tel = null;
        this.aiState = 'chase';
        this.attackCd = rng.range(2.0, 3.0);
        const base = Math.atan2(p.y - this.y, p.x - this.x);
        for (let i = -1; i <= 1; i++) {
          world.projectiles.push(new Projectile({
            x: this.x, y: this.y, r: 9, team: TEAM.ENEMY, damage: this.shotDmg,
            speed: 235, angle: base + i * 0.3, life: 3.4, kind: 'spore',
            color: '#9ee87a', color2: '#ddffb0', spin: 3, wobble: 0.5, knockback: 60,
          }));
        }
        sfx('enemyShoot', clamp((this.x - world.camera.x) / 640, -1, 1));
        burst(this.x, this.y, 8, {
          speed: [50, 160], life: [0.2, 0.5], r0: [2, 4], r1: 0,
          color: '#9ee87a', kind: 'dot', spread: TAU, drag: 4, glow: true,
        });
      }
    }
  }

  drawBody(ctx) {
    const bobY = Math.sin(this.float) * 5;
    ctx.save();
    ctx.translate(this.x, this.y + bobY);
    // Tendrils
    ctx.strokeStyle = '#4e7a3a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.25 + (i / 4) * Math.PI * 0.5;
      const sw = Math.sin(this.float * 1.6 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 8);
      ctx.quadraticCurveTo(Math.cos(a) * 14 + sw, 22, Math.cos(a) * 10 + sw * 1.4, 32);
      ctx.stroke();
    }
    // Bell — dome with a scalloped skirt.
    ctx.beginPath();
    ctx.moveTo(-19, -2);
    ctx.arc(0, -2, 19, Math.PI, 0);
    ctx.quadraticCurveTo(15, 11, 7, 6);
    ctx.quadraticCurveTo(0, 13, -7, 6);
    ctx.quadraticCurveTo(-15, 11, -19, -2);
    ctx.closePath();
    shapeStyle(ctx, 0, -8, 19, '#7fc45c', { lightDir: -Math.PI / 2, rim: 0.85, outlineW: 3, glow: 'rgba(160,240,120,0.4)' });
    // Spore sacs
    const charge = this.aiState === 'wind' ? 1 : 0.4;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.7;
      glowDot(ctx, Math.cos(a) * 9, Math.sin(a) * 6 - 2, 9 * charge + 4, '#d8ff9a', charge);
      ctx.fillStyle = '#e6ffbe';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 9, Math.sin(a) * 6 - 2, 3.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Adept extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'adept', name: '뼈산호 술사', r: 20, hp: 58 * t.hp, speed: 86 * t.spd,
      tint: '#e0d7c4', blood: '#c9bfa8', mass: 0.9,
    });
    this.blastDmg = 22 * t.dmg;
    this.dirSign = rng.sign();
  }

  think(dt, world) {
    const p = world.player;
    if (this.aiState === 'chase') {
      this.strafeAround(dt, p.x, p.y, 290, this.dirSign, 1);
      if (this.attackCd <= 0) {
        this.aiState = 'wind';
        this.aiT = 0;
        // Predicts a little ahead of the player's current velocity.
        const lead = 0.34;
        this.startTelegraph('circle', {
          dur: 0.85, r: 78, color: '#ffe08a',
          x: p.x + p.vx * lead, y: p.y + p.vy * lead,
        });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 6);
      this.facing = Math.atan2(this.tel.y - this.y, this.tel.x - this.x);
      if (this.aiT >= 0.85) {
        const tx = this.tel.x, ty = this.tel.y, tr = this.tel.r;
        this.tel = null;
        this.aiState = 'chase';
        this.attackCd = rng.range(2.4, 3.4);
        shockwave(tx, ty, {
          r0: 12, r1: tr, life: 0.4, color: 'rgba(255,224,138,0.95)', width: 7,
          fill: 'rgba(255,200,90,0.22)', squash: 0.66,
        });
        burst(tx, ty, 18, {
          speed: [120, 340], life: [0.25, 0.6], r0: [2, 5], r1: 0,
          color: '#ffe08a', color2: '#fff6d0', kind: 'shard', spread: TAU, drag: 4, glow: true,
        });
        addShake(0.22);
        sfx('explode', 0.7);
        if (dist(tx, ty, p.x, p.y) < tr + p.r * 0.6) {
          const a = Math.atan2(p.y - ty, p.x - tx);
          p.takeDamage(world, this.blastDmg, { dirX: Math.cos(a), dirY: Math.sin(a) });
        }
        // Bone spikes left behind for a moment.
        for (let i = 0; i < 5; i++) {
          const a = rng.angle(), rr = rng.range(0, tr * 0.8);
          decal(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, rng.range(6, 12), '#d8cdb4', 5);
        }
      }
    }
  }

  drawBody(ctx) {
    const hover = Math.sin(this.age * 2.2 + this.wob) * 4;
    ctx.save();
    ctx.translate(this.x, this.y + hover);
    // Robe
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.quadraticCurveTo(-20, 16, -11, 26);
    ctx.lineTo(11, 26);
    ctx.quadraticCurveTo(20, 16, 14, -4);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -6, 0, 26);
    g.addColorStop(0, '#4a5568');
    g.addColorStop(1, '#1e2634');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#0a1018'; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke();

    // Skull
    ctx.beginPath();
    ctx.arc(0, -12, 11, 0, TAU);
    shapeStyle(ctx, 0, -14, 11, '#ded4bd', { outlineW: 2.6 });
    ctx.fillStyle = '#141a22';
    ctx.beginPath(); ctx.ellipse(-4, -13, 3, 3.6, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -13, 3, 3.6, -0.2, 0, TAU); ctx.fill();
    const eg = this.aiState === 'wind' ? 1 : 0.5;
    glowDot(ctx, -4, -13, 7, '#ffe08a', eg);
    glowDot(ctx, 4, -13, 7, '#ffe08a', eg);
    // Coral antlers
    ctx.strokeStyle = '#f0a8bc'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 7, -20);
      ctx.lineTo(s * 12, -29);
      ctx.moveTo(s * 10, -25);
      ctx.lineTo(s * 17, -26);
      ctx.stroke();
    }
    // Casting orb
    if (this.aiState === 'wind') {
      const u = this.aiT / 0.85;
      glowDot(ctx, 14, 2, 12 + u * 12, '#ffe08a', 0.9);
      ctx.fillStyle = '#fff4cc';
      ctx.beginPath(); ctx.arc(14, 2, 3 + u * 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------- 침몰 성채 / bastion

class Sentry extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'sentry', name: '성채 파수병', r: 24, hp: 130 * t.hp, speed: 82 * t.spd,
      tint: '#8fa8c4', blood: '#5d7590', mass: 2.0,
    });
    this.sweepDmg = 24 * t.dmg;
    this.shieldAngle = 0;
  }

  // Frontal shield: 65% reduction inside a 100° frontal arc.
  get damageTaken() {
    const p = this._lastAttackerAngle;
    if (p === undefined) return 1;
    return Math.abs(angleDiff(this.facing, p)) < 0.87 ? 0.35 : 1;
  }

  think(dt, world) {
    const p = world.player;
    this._lastAttackerAngle = Math.atan2(p.y - this.y, p.x - this.x);
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.aiState === 'chase') {
      this.moveToward(dt, p.x, p.y, 1, 3.6);
      if (d < 150 && this.attackCd <= 0) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.sweepAngle = Math.atan2(p.y - this.y, p.x - this.x);
        this.startTelegraph('cone', {
          dur: 0.72, angle: this.sweepAngle, range: 160, half: 1.05,
          color: '#ffb44a', follow: true,
        });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 7);
      this.sweepAngle = angleApproach(this.sweepAngle, Math.atan2(p.y - this.y, p.x - this.x), dt * 2.2);
      this.tel.angle = this.sweepAngle;
      this.facing = this.sweepAngle;
      if (this.aiT >= 0.72) {
        this.tel = null;
        this.aiState = 'swing';
        this.aiT = 0;
        this.hitOnce = false;
        sfx('swing', clamp((this.x - world.camera.x) / 640, -1, 1), 1.3);
      }
    } else if (this.aiState === 'swing') {
      this.brake(dt, 4);
      const u = clamp(this.aiT / 0.22, 0, 1);
      if (!this.hitOnce && this.aiT > 0.05) {
        if (inCone(this.x, this.y, this.sweepAngle, 1.05, 160 + p.r, p.x, p.y)) {
          this.hitOnce = true;
          p.takeDamage(world, this.sweepDmg, {
            dirX: Math.cos(this.sweepAngle), dirY: Math.sin(this.sweepAngle),
          });
        }
      }
      if (this.aiT === 0 || (this.aiT > 0.02 && this.aiT - dt <= 0.02)) {
        shockwave(this.x + Math.cos(this.sweepAngle) * 60, this.y + Math.sin(this.sweepAngle) * 60, {
          r0: 10, r1: 90, life: 0.3, color: 'rgba(255,180,74,0.8)', width: 5,
        });
      }
      if (this.aiT >= 0.55) {
        this.aiState = 'chase';
        this.attackCd = rng.range(1.8, 2.6);
      }
    }
  }

  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing + Math.PI / 2);
    // Legs
    ctx.fillStyle = '#2b3646';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 9, 16, 6, 9, 0, 0, TAU);
      ctx.fill();
    }
    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 20, 0, 0, TAU);
    shapeStyle(ctx, 0, -6, 20, '#5b6f88', { outlineW: 3.2 });
    // Rust plates
    ctx.fillStyle = 'rgba(140,80,40,0.35)';
    ctx.beginPath(); ctx.ellipse(-6, 6, 8, 6, 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -6, 6, 5, -0.3, 0, TAU); ctx.fill();
    // Head
    ctx.beginPath();
    ctx.ellipse(0, -16, 9, 8, 0, 0, TAU);
    shapeStyle(ctx, 0, -18, 9, '#42566d', { outlineW: 2.6 });
    const eg = this.aiState === 'wind' ? 1.1 : 0.6;
    glowDot(ctx, 0, -17, 12, '#ff8a4a', eg);
    ctx.fillStyle = '#ffcf9a';
    ctx.fillRect(-5, -19, 10, 3);

    // Shield (left) — visually communicates the damage-resistant arc.
    ctx.save();
    ctx.translate(-19, -3);
    ctx.rotate(-0.15);
    ctx.beginPath();
    ctx.moveTo(-6, -16); ctx.lineTo(7, -13); ctx.lineTo(7, 13); ctx.lineTo(-6, 16);
    ctx.closePath();
    ctx.fillStyle = '#6d829c'; ctx.fill();
    ctx.strokeStyle = '#0c1420'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = '#c9a04a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 13); ctx.stroke();
    ctx.restore();

    // Halberd (right)
    const swing = this.aiState === 'swing' ? lerp(-1.3, 1.1, clamp(this.aiT / 0.22, 0, 1))
      : this.aiState === 'wind' ? -1.3 : -0.3;
    ctx.save();
    ctx.translate(18, 0);
    ctx.rotate(swing);
    ctx.strokeStyle = '#4a3524'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -26); ctx.stroke();
    ctx.fillStyle = '#c3d2e0';
    ctx.beginPath();
    ctx.moveTo(0, -24); ctx.lineTo(13, -32); ctx.lineTo(4, -40); ctx.lineTo(0, -34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0c1420'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}

class Harpooner extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'harpooner', name: '작살병', r: 19, hp: 62 * t.hp, speed: 104 * t.spd,
      tint: '#7fb2ff', blood: '#5d7590', mass: 0.9,
    });
    this.shotDmg = 20 * t.dmg;
    this.dirSign = rng.sign();
  }

  think(dt, world) {
    const p = world.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.aiState === 'chase') {
      if (d < 170) this.strafeAround(dt, p.x, p.y, 260, this.dirSign, 1.2);
      else this.strafeAround(dt, p.x, p.y, 250, this.dirSign, 1);
      if (this.attackCd <= 0 && d < 460) {
        this.aiState = 'aim';
        this.aiT = 0;
        this.aimAngle = Math.atan2(p.y - this.y, p.x - this.x);
        this.startTelegraph('line', {
          dur: 0.68, angle: this.aimAngle, range: 520, width: 18,
          color: '#7fd0ff', follow: true,
        });
      }
    } else if (this.aiState === 'aim') {
      this.brake(dt, 8);
      this.aimAngle = angleApproach(this.aimAngle, Math.atan2(p.y - this.y, p.x - this.x), dt * 2.0);
      this.tel.angle = this.aimAngle;
      this.facing = this.aimAngle;
      if (this.aiT >= 0.68) {
        this.tel = null;
        this.aiState = 'chase';
        this.attackCd = rng.range(1.9, 2.8);
        world.projectiles.push(new Projectile({
          x: this.x + Math.cos(this.aimAngle) * 16,
          y: this.y + Math.sin(this.aimAngle) * 16,
          r: 8, team: TEAM.ENEMY, damage: this.shotDmg, speed: 760,
          angle: this.aimAngle, life: 1.2, kind: 'harpoon',
          color: '#cfe6ff', color2: '#ffffff', knockback: 180, trail: 0.4,
        }));
        sfx('enemyShoot', clamp((this.x - world.camera.x) / 640, -1, 1));
        addShake(0.06);
      }
    }
  }

  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing + Math.PI / 2);
    // Cloak
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.quadraticCurveTo(-15, 14, -7, 24);
    ctx.lineTo(7, 24);
    ctx.quadraticCurveTo(15, 14, 11, -2);
    ctx.closePath();
    ctx.fillStyle = '#28405c'; ctx.fill();
    ctx.strokeStyle = '#0b1420'; ctx.lineWidth = 2.6; ctx.stroke();
    // Body
    ctx.beginPath();
    ctx.ellipse(0, -1, 12, 14, 0, 0, TAU);
    shapeStyle(ctx, 0, -6, 14, '#4d6f9a', { outlineW: 2.8 });
    // Head
    ctx.beginPath(); ctx.arc(0, -14, 8, 0, TAU);
    shapeStyle(ctx, 0, -16, 8, '#3c5878', { outlineW: 2.4 });
    glowDot(ctx, 0, -15, 10, '#8fd8ff', this.aiState === 'aim' ? 1.1 : 0.6);
    ctx.fillStyle = '#cdefff';
    ctx.fillRect(-4.5, -16.5, 9, 2.8);
    // Harpoon launcher
    const recoil = this.aiState === 'aim' ? -4 + (this.aiT / 0.68) * 4 : 0;
    ctx.save();
    ctx.translate(11, -4 + recoil);
    ctx.fillStyle = '#5a6b7d';
    ctx.fillRect(-4, -20, 8, 22);
    ctx.strokeStyle = '#0b1420'; ctx.lineWidth = 2; ctx.strokeRect(-4, -20, 8, 22);
    ctx.fillStyle = '#cfe6ff';
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(4, -20); ctx.lineTo(-4, -20);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0b1420'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}

class Turret extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'turret', name: '부유 포탑', r: 22, hp: 88 * t.hp, speed: 46 * t.spd,
      tint: '#c9a04a', blood: '#8a6a2a', mass: 1.6,
    });
    this.shotDmg = 12 * t.dmg;
    this.spin = 0;
    this.volley = 0;
  }

  think(dt, world) {
    const p = world.player;
    this.spin += dt * (this.aiState === 'wind' ? 7 : 1.4);
    if (this.aiState === 'chase') {
      this.strafeAround(dt, p.x, p.y, 300, 1, 0.7);
      if (this.attackCd <= 0 && dist(this.x, this.y, p.x, p.y) < 480) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.volley = 0;
        this.startTelegraph('ring', { dur: 0.75, r: 60, color: '#ffcf6a', follow: true });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 5);
      if (this.aiT >= 0.75) { this.aiState = 'fire'; this.aiT = 0; this.tel = null; }
    } else if (this.aiState === 'fire') {
      this.brake(dt, 3);
      const want = Math.floor(this.aiT / 0.18);
      while (this.volley < want && this.volley < 3) {
        const n = 9;
        const off = this.volley * 0.22 + this.spin * 0.1;
        for (let i = 0; i < n; i++) {
          world.projectiles.push(new Projectile({
            x: this.x, y: this.y, r: 7, team: TEAM.ENEMY, damage: this.shotDmg,
            speed: 265, angle: off + (i / n) * TAU, life: 3.2, kind: 'orb',
            color: '#ffcf6a', color2: '#fff3cf', knockback: 70,
          }));
        }
        sfx('enemyShoot', clamp((this.x - world.camera.x) / 640, -1, 1));
        this.volley++;
      }
      if (this.aiT >= 0.62) {
        this.aiState = 'chase';
        this.attackCd = rng.range(2.6, 3.6);
      }
    }
  }

  drawBody(ctx) {
    const hover = Math.sin(this.age * 2 + this.wob) * 5;
    ctx.save();
    ctx.translate(this.x, this.y + hover);
    // Outer ring
    ctx.save();
    ctx.rotate(this.spin);
    ctx.strokeStyle = '#8d7233';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#c9a04a';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * 21, Math.sin(a) * 21);
      ctx.rotate(a);
      ctx.fillStyle = this.aiState === 'fire' ? '#fff0b8' : '#e0c06a';
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(-3, 4); ctx.lineTo(-3, -4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0f1420'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // Core
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU);
    shapeStyle(ctx, 0, -4, 13, '#3a4356', { outlineW: 3 });
    const chg = this.aiState === 'wind' ? clamp(this.aiT / 0.75, 0, 1) : this.aiState === 'fire' ? 1 : 0.35;
    glowDot(ctx, 0, 0, 16 + chg * 14, '#ffcf6a', 0.5 + chg * 0.6);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath(); ctx.arc(0, 0, 4 + chg * 3.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

class Hound extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'hound', name: '심해 사냥개', r: 20, hp: 96 * t.hp, speed: 172 * t.spd,
      tint: '#ff7a5c', blood: '#d4453c', mass: 1.0, elite: true,
    });
    this.biteDmg = 18 * t.dmg;
    this.dashes = 0;
  }

  think(dt, world) {
    const p = world.player;
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.aiState === 'chase') {
      this.moveToward(dt, p.x, p.y, 1, 9);
      if (d < 250 && this.attackCd <= 0) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.dashes = 0;
        this.prepDash(p);
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 12);
      this.lungeAngle = angleApproach(this.lungeAngle, Math.atan2(p.y - this.y, p.x - this.x), dt * 3);
      this.tel.angle = this.lungeAngle;
      this.facing = this.lungeAngle;
      if (this.aiT >= this.windDur) {
        this.tel = null;
        this.aiState = 'lunge';
        this.aiT = 0;
        this.hitOnce = false;
        this.vx = Math.cos(this.lungeAngle) * 760;
        this.vy = Math.sin(this.lungeAngle) * 760;
        sfx('swing', clamp((this.x - world.camera.x) / 640, -1, 1), 1.2);
      }
    } else if (this.aiState === 'lunge') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const dr = Math.exp(-6 * dt);
      this.vx *= dr; this.vy *= dr;
      if (!this.hitOnce && dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
        this.hitOnce = true;
        p.takeDamage(world, this.biteDmg, {
          dirX: Math.cos(this.lungeAngle), dirY: Math.sin(this.lungeAngle),
        });
      }
      if (this.aiT >= 0.36) {
        this.dashes++;
        // Elites chain up to three lunges before resetting.
        if (this.dashes < 3) { this.aiState = 'wind'; this.aiT = 0; this.prepDash(p); }
        else { this.aiState = 'chase'; this.attackCd = rng.range(2.2, 3.0); }
      }
    }
  }

  prepDash(p) {
    this.windDur = this.dashes === 0 ? 0.48 : 0.3;
    this.lungeAngle = Math.atan2(p.y - this.y, p.x - this.x);
    this.startTelegraph('line', {
      dur: this.windDur, angle: this.lungeAngle, range: 280, width: 42,
      color: '#ff6a4a', follow: true,
    });
  }

  drawBody(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing);
    const run = Math.sin(this.age * 16) * (this.aiState === 'lunge' ? 6 : 3);
    // Tail
    limb(ctx, -18, 0, -34, run * 1.6, run * 2, 7, 2, '#7a2f28');
    // Legs
    ctx.strokeStyle = '#5e241f'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-8, s * 8); ctx.lineTo(-12, s * 16 + run * 0.4);
      ctx.moveTo(9, s * 8); ctx.lineTo(13, s * 16 - run * 0.4);
      ctx.stroke();
    }
    // Body
    ctx.beginPath();
    ctx.ellipse(-2, 0, 19, 12, 0, 0, TAU);
    shapeStyle(ctx, -2, -4, 18, '#a83e33', { outlineW: 3 });
    // Dorsal fins
    ctx.fillStyle = '#ff9a6a';
    ctx.beginPath();
    ctx.moveTo(-10, -10); ctx.lineTo(-4, -22); ctx.lineTo(2, -9);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a1a14'; ctx.lineWidth = 2; ctx.stroke();
    // Head + jaws
    const open = this.aiState === 'wind' ? 0.5 : this.aiState === 'lunge' ? 0.75 : 0.12;
    ctx.save();
    ctx.translate(17, 0);
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU);
    shapeStyle(ctx, 0, -3, 10, '#c04b3c', { outlineW: 2.6 });
    ctx.fillStyle = '#2a0c08';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * open);
      ctx.beginPath();
      ctx.moveTo(4, 0); ctx.lineTo(17, s * 5); ctx.lineTo(4, s * 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffeede';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(6 + i * 4, s * 1.5); ctx.lineTo(8 + i * 4, s * 5); ctx.lineTo(10 + i * 4, s * 1.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#2a0c08';
      ctx.restore();
    }
    glowDot(ctx, 2, -5, 9, '#ffd24a', this.aiState === 'chase' ? 0.7 : 1.2);
    ctx.restore();
    ctx.restore();
  }
}

// --------------------------------------------------------- 심연 옥좌 / throne

class Priest extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'priest', name: '공허 사제', r: 21, hp: 92 * t.hp, speed: 70 * t.spd,
      tint: '#c58cff', blood: '#8a4fd4', mass: 0.9,
    });
    this.shotDmg = 13 * t.dmg;
    this.spiral = 0;
    this.blinkT = rng.range(2, 4);
  }

  think(dt, world) {
    const p = world.player;
    const d = dist(this.x, this.y, p.x, p.y);
    this.blinkT -= dt;

    if (this.aiState === 'chase') {
      this.strafeAround(dt, p.x, p.y, 270, 1, 0.9);
      if (this.blinkT <= 0 && d < 220) { this.startBlink(world, p); return; }
      if (this.attackCd <= 0) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.spiral = rng.angle();
        this.shots = 0;
        this.startTelegraph('ring', { dur: 0.7, r: 54, color: '#c58cff', follow: true });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 6);
      if (this.aiT >= 0.7) { this.tel = null; this.aiState = 'fire'; this.aiT = 0; }
    } else if (this.aiState === 'fire') {
      this.brake(dt, 4);
      const want = Math.floor(this.aiT / 0.09);
      while (this.shots < want && this.shots < 12) {
        this.spiral += 0.55;
        for (let k = 0; k < 2; k++) {
          world.projectiles.push(new Projectile({
            x: this.x, y: this.y, r: 7, team: TEAM.ENEMY, damage: this.shotDmg,
            speed: 245, angle: this.spiral + k * Math.PI, life: 3.4, kind: 'orb',
            color: '#c58cff', color2: '#f0e0ff', knockback: 60,
          }));
        }
        this.shots++;
        if (this.shots % 4 === 0) sfx('enemyShoot', clamp((this.x - world.camera.x) / 640, -1, 1));
      }
      if (this.shots >= 12) {
        this.aiState = 'chase';
        this.attackCd = rng.range(2.6, 3.6);
      }
    } else if (this.aiState === 'blink') {
      this.aiT += 0;
      if (this.aiT >= 0.34) {
        this.x = this.blinkX;
        this.y = this.blinkY;
        this.aiState = 'chase';
        this.untargetable = false;
        this.blinkT = rng.range(3.5, 5.5);
        this.attackCd = Math.min(this.attackCd, 0.4);
        burst(this.x, this.y, 16, {
          speed: [60, 220], life: [0.3, 0.6], r0: [2, 5], r1: 0,
          color: '#c58cff', kind: 'spark', spread: TAU, drag: 4, glow: true,
        });
        shockwave(this.x, this.y, { r0: 6, r1: 70, life: 0.35, color: 'rgba(197,140,255,0.9)', width: 4 });
      }
    }
  }

  startBlink(world, p) {
    this.aiState = 'blink';
    this.aiT = 0;
    this.untargetable = true;
    const a = Math.atan2(this.y - p.y, this.x - p.x) + rng.range(-1.4, 1.4);
    this.blinkX = p.x + Math.cos(a) * 280;
    this.blinkY = p.y + Math.sin(a) * 280;
    world.room.clampPoint({ x: this.blinkX, y: this.blinkY, set: (o) => o }, 60);
    const cl = world.room.clampedPoint(this.blinkX, this.blinkY, 60);
    this.blinkX = cl.x; this.blinkY = cl.y;
    burst(this.x, this.y, 14, {
      speed: [40, 160], life: [0.3, 0.6], r0: [2, 5], r1: 0,
      color: '#c58cff', kind: 'dot', spread: TAU, drag: 4, glow: true,
    });
    sfx('dash');
  }

  drawBody(ctx) {
    const hover = Math.sin(this.age * 2 + this.wob) * 5;
    const fade = this.aiState === 'blink' ? Math.abs(Math.cos(this.aiT * 9)) * 0.6 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(this.x, this.y + hover);
    // Robe
    ctx.beginPath();
    ctx.moveTo(-15, -6);
    ctx.quadraticCurveTo(-22, 14, -12, 28);
    ctx.quadraticCurveTo(0, 34, 12, 28);
    ctx.quadraticCurveTo(22, 14, 15, -6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -8, 0, 30);
    g.addColorStop(0, '#4a2d6b');
    g.addColorStop(1, '#1a0f2a');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#0a0616'; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke();
    // Hood
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.quadraticCurveTo(0, -30, 11, -6);
    ctx.closePath();
    ctx.fillStyle = '#3a2456'; ctx.fill();
    ctx.strokeStyle = '#0a0616'; ctx.lineWidth = 2.4; ctx.stroke();
    // Void where a face should be
    ctx.fillStyle = '#08030f';
    ctx.beginPath(); ctx.ellipse(0, -10, 7, 8, 0, 0, TAU); ctx.fill();
    const eg = this.aiState === 'fire' || this.aiState === 'wind' ? 1.2 : 0.7;
    for (const s of [-1, 1]) glowDot(ctx, s * 3, -11, 7, '#e0b0ff', eg);
    // Floating sigils
    ctx.strokeStyle = '#c58cff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = this.age * 1.6 + (i / 3) * TAU;
      const rr = 26 + Math.sin(this.age * 3 + i) * 3;
      ctx.save();
      ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr * 0.5 - 6);
      ctx.rotate(a * 2);
      starPath(ctx, 0, 0, 3, 5, 2.2, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

class Tendril extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'tendril', name: '심연 촉수', r: 22, hp: 74 * t.hp, speed: 0,
      tint: '#7a4fb0', blood: '#5a2f8a', mass: 3, spawnDur: 0.7,
    });
    this.slamDmg = 26 * t.dmg;
    this.noSeparate = true;
    this.emerge = 0;
    this.phase = 'submerged';
    this.subT = rng.range(0.4, 1.4);
  }

  think(dt, world) {
    const p = world.player;
    if (this.phase === 'submerged') {
      this.untargetable = true;
      this.emerge = damp(this.emerge, 0, 8, dt);
      this.subT -= dt;
      // Burrow toward the player while hidden.
      this.x = damp(this.x, p.x, 1.6, dt);
      this.y = damp(this.y, p.y, 1.6, dt);
      if (rng.next() < 0.5) {
        emit({
          x: this.x + rng.range(-18, 18), y: this.y + rng.range(-10, 10),
          vx: rng.range(-20, 20), vy: rng.range(-30, -6),
          life: 0.5, t: 0, r0: 3, r1: 0, color: '#5a2f8a', kind: 'smoke', drag: 2,
        });
      }
      if (this.subT <= 0) {
        this.phase = 'rise';
        this.aiT = 0;
        this.startTelegraph('circle', { dur: 0.8, r: 92, color: '#c58cff', x: this.x, y: this.y });
      }
    } else if (this.phase === 'rise') {
      this.untargetable = false;
      this.emerge = damp(this.emerge, 1, 7, dt);
      if (this.aiT >= 0.8) {
        this.phase = 'slam';
        this.aiT = 0;
        this.tel = null;
        this.slamDone = false;
      }
    } else if (this.phase === 'slam') {
      if (!this.slamDone && this.aiT > 0.08) {
        this.slamDone = true;
        shockwave(this.x, this.y, {
          r0: 14, r1: 100, life: 0.42, color: 'rgba(197,140,255,0.95)', width: 8,
          fill: 'rgba(122,79,176,0.24)', squash: 0.66,
        });
        burst(this.x, this.y, 20, {
          speed: [120, 340], life: [0.25, 0.6], r0: [2, 6], r1: 0,
          color: '#c58cff', color2: '#4a2d6b', kind: 'shard', spread: TAU, drag: 4,
        });
        addShake(0.3);
        sfx('slam');
        if (dist(this.x, this.y, p.x, p.y) < 100 + p.r * 0.5) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          p.takeDamage(world, this.slamDmg, { dirX: Math.cos(a), dirY: Math.sin(a) });
        }
      }
      if (this.aiT >= 1.5) {
        this.phase = 'submerged';
        this.subT = rng.range(1.4, 2.4);
      }
    }
  }

  drawBody(ctx) {
    const e = this.emerge;
    if (e < 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(150,100,200,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 24 + Math.sin(this.age * 4) * 4, 13, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    const h = 76 * e;
    const sway = Math.sin(this.age * 3 + this.wob) * 10 * e;
    const slam = this.phase === 'slam' ? Math.max(0, 1 - this.aiT * 4) * 40 : 0;
    limb(ctx, 0, 6, sway, -h + slam, sway * 0.6, 30 * e, 14 * e, '#6d3f9e');
    // Suckers
    ctx.fillStyle = '#c58cff';
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const yy = lerp(4, -h + slam, t);
      const xx = lerp(0, sway, t * t);
      ctx.beginPath();
      ctx.arc(xx + Math.sin(i * 2) * 4, yy, 3.4 * e * (1 - t * 0.4), 0, TAU);
      ctx.fill();
    }
    // Maw
    if (e > 0.5) {
      ctx.save();
      ctx.translate(sway, -h + slam);
      ctx.beginPath(); ctx.arc(0, 0, 12 * e, 0, TAU);
      shapeStyle(ctx, 0, -3, 12 * e, '#8a4fd4', { outlineW: 2.6 });
      ctx.fillStyle = '#1a0a2a';
      ctx.beginPath(); ctx.arc(0, 0, 6 * e, 0, TAU); ctx.fill();
      glowDot(ctx, 0, 0, 14 * e, '#e0b0ff', this.phase === 'rise' ? 1.1 : 0.6);
      ctx.restore();
    }
    ctx.restore();
  }
}

class CrownShard extends Enemy {
  constructor(x, y, t) {
    super(x, y, {
      type: 'shard', name: '왕관 파편', r: 20, hp: 118 * t.hp, speed: 132 * t.spd,
      tint: '#ffd34a', blood: '#c9a04a', mass: 1.2, elite: true,
    });
    this.bladeDmg = 15 * t.dmg;
    this.orbit = rng.angle();
    this.bladeHits = new Map();
  }

  think(dt, world) {
    const p = world.player;
    this.orbit += dt * (this.aiState === 'spin' ? 7.5 : 2.6);
    const d = dist(this.x, this.y, p.x, p.y);

    if (this.aiState === 'chase') {
      this.moveToward(dt, p.x, p.y, 0.9, 5);
      if (d < 230 && this.attackCd <= 0) {
        this.aiState = 'wind';
        this.aiT = 0;
        this.startTelegraph('ring', { dur: 0.6, r: 108, color: '#ffd34a', follow: true });
      }
    } else if (this.aiState === 'wind') {
      this.brake(dt, 7);
      if (this.aiT >= 0.6) { this.aiState = 'spin'; this.aiT = 0; this.tel = null; sfx('swing'); }
    } else if (this.aiState === 'spin') {
      this.moveToward(dt, p.x, p.y, 1.35, 4);
      // Three orbiting blades, each with its own hit cooldown.
      for (let i = 0; i < 3; i++) {
        const a = this.orbit + (i / 3) * TAU;
        const bx = this.x + Math.cos(a) * 62;
        const by = this.y + Math.sin(a) * 62;
        const key = i;
        const cd = this.bladeHits.get(key) || 0;
        if (cd > 0) { this.bladeHits.set(key, cd - dt); continue; }
        if (dist(bx, by, p.x, p.y) < 18 + p.r) {
          const ang = Math.atan2(p.y - this.y, p.x - this.x);
          p.takeDamage(world, this.bladeDmg, { dirX: Math.cos(ang), dirY: Math.sin(ang) });
          this.bladeHits.set(key, 0.9);
        }
      }
      if (this.aiT >= 2.6) {
        this.aiState = 'chase';
        this.attackCd = rng.range(1.6, 2.4);
      }
    }
  }

  drawBody(ctx) {
    const hover = Math.sin(this.age * 2.4 + this.wob) * 5;
    // Orbiting blades
    if (this.aiState === 'spin' || this.aiState === 'wind') {
      const active = this.aiState === 'spin';
      for (let i = 0; i < 3; i++) {
        const a = this.orbit + (i / 3) * TAU;
        const bx = this.x + Math.cos(a) * 62;
        const by = this.y + Math.sin(a) * 62;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 2);
        ctx.globalAlpha = active ? 1 : 0.5;
        glowDot(ctx, 0, 0, 22, '#ffd34a', active ? 0.8 : 0.4);
        ctx.fillStyle = '#ffe89a';
        ctx.beginPath();
        ctx.moveTo(0, -16); ctx.lineTo(7, 0); ctx.lineTo(0, 16); ctx.lineTo(-7, 0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6b4c0c'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(this.x, this.y + hover);
    ctx.rotate(Math.sin(this.age * 1.6) * 0.12);
    // Crown fragment body
    ctx.beginPath();
    ctx.moveTo(-18, 12);
    ctx.lineTo(-14, -10);
    ctx.lineTo(-7, 2);
    ctx.lineTo(0, -18);
    ctx.lineTo(7, 2);
    ctx.lineTo(14, -10);
    ctx.lineTo(18, 12);
    ctx.closePath();
    shapeStyle(ctx, 0, -4, 20, '#e0b43a', { lightDir: -Math.PI / 2, rim: 0.9, outlineW: 3, glow: 'rgba(255,211,74,0.35)' });
    ctx.fillStyle = '#2a1f08';
    ctx.fillRect(-18, 12, 36, 6);
    ctx.strokeStyle = '#6b4c0c'; ctx.lineWidth = 2; ctx.strokeRect(-18, 12, 36, 6);
    // Gems
    for (let i = -1; i <= 1; i++) {
      glowDot(ctx, i * 9, 4, 8, '#ff6a9a', 0.8);
      ctx.fillStyle = '#ff9ac0';
      ctx.beginPath(); ctx.arc(i * 9, 4, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- registry

const REGISTRY = {
  crawler: Crawler, drifter: Drifter, adept: Adept,
  sentry: Sentry, harpooner: Harpooner, turret: Turret, hound: Hound,
  priest: Priest, tendril: Tendril, shard: CrownShard,
};

export const ENEMY_POOLS = {
  necropolis: [
    { type: 'crawler', w: 46, cost: 1 },
    { type: 'drifter', w: 34, cost: 1 },
    { type: 'adept',   w: 20, cost: 1.4 },
  ],
  bastion: [
    { type: 'harpooner', w: 30, cost: 1.2 },
    { type: 'sentry',    w: 26, cost: 1.8 },
    { type: 'turret',    w: 22, cost: 1.5 },
    { type: 'crawler',   w: 14, cost: 1 },
    { type: 'hound',     w: 8,  cost: 2.4 },
  ],
  throne: [
    { type: 'priest',  w: 28, cost: 1.8 },
    { type: 'tendril', w: 24, cost: 1.5 },
    { type: 'sentry',  w: 18, cost: 1.8 },
    { type: 'turret',  w: 14, cost: 1.5 },
    { type: 'hound',   w: 10, cost: 2.4 },
    { type: 'shard',   w: 6,  cost: 3.0 },
  ],
};

export function makeEnemy(type, x, y, tier) {
  const C = REGISTRY[type];
  if (!C) return null;
  return new C(x, y, tier);
}

/** Difficulty scalar per biome + room depth; keeps late rooms tense without spikes. */
export function tierFor(biomeIndex, roomIndex, loop = 0) {
  const depth = biomeIndex * 6 + roomIndex;
  return {
    hp: 1 + depth * 0.085 + loop * 0.5,
    dmg: 1 + depth * 0.05 + loop * 0.3,
    spd: 1 + depth * 0.012 + loop * 0.1,
  };
}
