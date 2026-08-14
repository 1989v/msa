// Shared simulation objects: the entity base class, the status-effect layer,
// projectiles, ground hazards, pickups, and the single damage pipeline every
// source of damage in the game funnels through.

import { TAU, clamp, lerp, damp, rng, dist, angleDiff, easeOutCubic } from './core.js';
import {
  addHitstop, addShake, burst, shockwave, damageNumber, impactFx, bloodFx,
  deathFx, decal, rgba, floatText, screenFlash, emit,
} from './fx.js';
import { STATUS } from './boons.js';
import { sfx } from './audio.js';
import { drawShadow, glowDot, limb, starPath, PAL } from './art.js';

export const TEAM = { PLAYER: 0, ENEMY: 1 };

let nextId = 1;

export class Entity {
  constructor(x, y, r) {
    this.id = nextId++;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = r;
    this.z = 0;
    this.dead = false;
    this.remove = false;
    this.team = TEAM.ENEMY;
    this.hp = 1; this.maxHp = 1;
    this.hitFlash = 0;
    this.facing = 0;
    this.mass = 1;
    this.squash = 1;
    this.knockVx = 0; this.knockVy = 0;
    this.statuses = Object.create(null);
    this.invuln = 0;
    this.age = 0;
    this.seed = rng.range(0, 1000);
  }

  get alive() { return !this.dead; }

  applyKnockback(ax, ay, force) {
    const f = force / Math.max(0.35, this.mass);
    this.knockVx += ax * f;
    this.knockVy += ay * f;
  }

  integrateKnockback(dt) {
    this.x += this.knockVx * dt;
    this.y += this.knockVy * dt;
    const d = Math.exp(-9 * dt);
    this.knockVx *= d;
    this.knockVy *= d;
    if (Math.abs(this.knockVx) < 1) this.knockVx = 0;
    if (Math.abs(this.knockVy) < 1) this.knockVy = 0;
  }

  // ------------------------------------------------------------- statuses
  addStatus(type, stacks = 1, source = null) {
    const def = STATUS[type];
    if (!def) return;
    let s = this.statuses[type];
    if (!s) {
      s = this.statuses[type] = { stacks: 0, t: 0, tick: 0, src: source };
      if (type === 'frozen') this.onFreeze?.();
    }
    s.stacks = Math.min(def.maxStacks, s.stacks + stacks);
    s.t = def.duration;
    s.src = source || s.src;
    if (type === 'chill' && s.stacks >= def.maxStacks && !this.bossImmuneFreeze) {
      // Max chill converts into a hard freeze and consumes the stacks.
      this.statuses.chill = undefined;
      delete this.statuses.chill;
      this.addStatus('frozen', 1, source);
      sfx('freeze');
    }
  }

  hasStatus(type) { return !!this.statuses[type] && this.statuses[type].stacks > 0; }
  statusStacks(type) { return this.statuses[type] ? this.statuses[type].stacks : 0; }

  updateStatuses(dt, world) {
    for (const key in this.statuses) {
      const s = this.statuses[key];
      if (!s) continue;
      s.t -= dt;
      if (key === 'burn') {
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick = 0.45;
          const mods = world.player ? world.player.mods : null;
          const base = 3.2 * s.stacks;
          const mult = mods ? (mods.burnMult || 1) * mods.statusDmgMult : 1;
          applyDamage(world, this, base * mult, {
            source: s.src, kind: 'status', statusColor: STATUS.burn.color, silent: true, noKnock: true,
          });
          burst(this.x + rng.range(-8, 8), this.y - this.r * 0.4, 2, {
            speed: [10, 50], life: [0.25, 0.5], r0: [1.5, 3.4], r1: 0,
            color: '#ff9a4a', color2: '#ff3b1e', dir: -Math.PI / 2, spread: 1.1, drag: 2, glow: true,
          });
        }
      }
      if (key === 'reso' && s.stacks >= STATUS.reso.maxStacks) {
        const mods = world.player ? world.player.mods : null;
        const power = mods ? mods.resoBurst : 0;
        if (power > 0) {
          resonanceBurst(world, this, power * (mods.statusDmgMult || 1), s.src);
          delete this.statuses.reso;
          continue;
        }
      }
      if (s.t <= 0) {
        if (key === 'frozen') this.onUnfreeze?.();
        delete this.statuses[key];
      }
    }
  }

  /** Multiplicative speed factor from chill / freeze. */
  statusSpeedMult() {
    if (this.hasStatus('frozen')) return 0;
    const c = this.statusStacks('chill');
    return c > 0 ? Math.max(0.35, 1 - c * 0.11) : 1;
  }

  drawStatusAura(ctx) {
    const s = this.statuses;
    if (s.frozen) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.age * 8) * 0.08;
      ctx.strokeStyle = '#cfeaff';
      ctx.fillStyle = 'rgba(150,205,255,0.24)';
      ctx.lineWidth = 2.4;
      starPath(ctx, this.x, this.y - this.r * 0.3, 6, this.r * 1.5, this.r * 0.85, this.age * 0.4);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (s.soaked) {
      ctx.save();
      ctx.globalAlpha = 0.12 + s.soaked.stacks * 0.055;
      ctx.fillStyle = STATUS.soaked.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y - this.r * 0.25, this.r * 1.16, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (s.chill) {
      ctx.save();
      ctx.globalAlpha = 0.18 + s.chill.stacks * 0.05;
      ctx.strokeStyle = STATUS.chill.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y - this.r * 0.25, this.r * 1.24, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (s.reso) {
      const n = s.reso.stacks;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = STATUS.reso.color;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < n; i++) {
        const rr = this.r * 1.2 + i * 5 + Math.sin(this.age * 6 - i) * 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.r * 0.25, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (s.mark) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = STATUS.mark.color;
      ctx.lineWidth = 2.4;
      const rr = this.r * 1.45;
      const rot = this.age * 1.6;
      for (let i = 0; i < 4; i++) {
        const a = rot + (i / 4) * TAU;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.r * 0.25, rr, a, a + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- damage

/**
 * The single entry point for every point of damage in the game.
 * Handles crit, vulnerability, feedback, statuses, chaining and death.
 */
export function applyDamage(world, target, amount, opts = {}) {
  if (!target || target.dead || amount <= 0) return 0;
  if (target.invuln > 0 && !opts.ignoreInvuln) return 0;

  const {
    source = null, kind = 'melee', dirX = 0, dirY = 0, knockback = 0,
    crit = null, mods = null, statusColor = null, silent = false,
    noKnock = false, canChain = false, canCrit = true,
  } = opts;

  const m = mods || (source && source.mods) || null;
  let dmg = amount;
  let isCrit = false;

  if (m) {
    if (canCrit) {
      const chance = clamp(m.critChance + (source && source.critWindow > 0 ? m.dashCritBonus : 0), 0, 0.95);
      isCrit = crit !== null ? crit : rng.next() < chance;
      if (isCrit) dmg *= m.critMult;
    }
    if (m.goldDmgScale && world.run) dmg *= 1 + (world.run.gold / 100) * m.goldDmgScale;
  }

  // Vulnerabilities.
  if (target.hasStatus('soaked')) dmg *= 1 + target.statusStacks('soaked') * 0.08;
  if (target.hasStatus('frozen') && m) dmg *= 1 + m.frozenBonus;
  if (target.hasStatus('mark')) dmg *= 1.2;
  if (target.damageTaken) dmg *= target.damageTaken;

  dmg = Math.max(1, dmg);
  target.hp -= dmg;
  target.hitFlash = Math.max(target.hitFlash, kind === 'status' ? 0.06 : 0.14);
  target.lastHitBy = source;

  if (!silent) {
    const power = clamp(dmg / 40, 0.25, 1.6);
    damageNumber(target.x + rng.range(-6, 6), target.y - target.r - 8, dmg, {
      crit: isCrit, color: statusColor || (isCrit ? '#ffd34a' : '#ffffff'),
    });
    if (target.team === TEAM.ENEMY) {
      impactFx(
        target.x + dirX * target.r * 0.6, target.y - target.r * 0.3 + dirY * target.r * 0.6,
        Math.atan2(dirY, dirX), { crit: isCrit, power, color: '#eaf6ff', color2: target.tint || '#4fd1ff' }
      );
      bloodFx(target.x, target.y, Math.atan2(dirY, dirX), target.blood || '#2fd6c0');
    }
    // Hitstop scales with impact so chip damage stays fluid and big hits land hard.
    addHitstop(isCrit ? 0.085 : clamp(0.022 + dmg * 0.0011, 0.02, 0.07));
    addShake(isCrit ? 0.24 : clamp(0.05 + dmg * 0.0022, 0.04, 0.2));
    sfx(isCrit ? 'crit' : 'hit', clamp((target.x - world.camera.x) / 640, -1, 1), power);
  } else if (statusColor) {
    damageNumber(target.x + rng.range(-10, 10), target.y - target.r - 4, dmg, {
      color: statusColor, tiny: true,
    });
  }

  if (!noKnock && knockback > 0) {
    const k = knockback * (m ? m.knockback : 1);
    target.applyKnockback(dirX, dirY, k);
  }

  // Status riders from the attacking slot.
  if (opts.status) target.addStatus(opts.status.type, opts.status.stacks, source);

  // Echo chaining — only from the primary hit, never recursive.
  if (canChain && m && m.chainCount > 0) {
    chainLightning(world, target, dmg * m.chainRatio, m.chainCount, source, m);
  }

  if (target.hp <= 0) killEntity(world, target, source, m, { dirX, dirY, isCrit });

  return dmg;
}

function chainLightning(world, from, dmg, count, source, mods) {
  const hit = new Set([from.id]);
  let cur = from;
  for (let i = 0; i < count; i++) {
    let best = null, bestD = 300;
    for (const e of world.enemies) {
      if (e.dead || hit.has(e.id)) continue;
      const d = dist(cur.x, cur.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    hit.add(best.id);
    drawChainArc(world, cur, best);
    applyDamage(world, best, dmg, {
      source, kind: 'chain', mods,
      dirX: (best.x - cur.x) / (bestD || 1), dirY: (best.y - cur.y) / (bestD || 1),
      statusColor: '#3fe59d', silent: false, canCrit: false, knockback: 40,
      status: mods.onAttack && mods.onAttack.type === 'reso' ? { type: 'reso', stacks: 1 } : null,
    });
    cur = best;
  }
}

function drawChainArc(world, a, b) {
  world.arcs.push({ x0: a.x, y0: a.y - a.r * 0.4, x1: b.x, y1: b.y - b.r * 0.4, t: 0, life: 0.22 });
}

export function resonanceBurst(world, target, power, source) {
  shockwave(target.x, target.y, {
    r0: 10, r1: 170, life: 0.44, color: rgba('#3fe59d', 0.9), width: 6,
    fill: rgba('#3fe59d', 0.14),
  });
  burst(target.x, target.y, 22, {
    speed: [140, 400], life: [0.25, 0.6], r0: [2, 5], r1: 0,
    color: '#3fe59d', color2: '#c3ffe4', kind: 'spark', spread: TAU, drag: 4, glow: true,
  });
  addShake(0.26);
  addHitstop(0.06);
  sfx('explode', 0.8);
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = dist(target.x, target.y, e.x, e.y);
    if (d > 170) continue;
    applyDamage(world, e, power, {
      source, kind: 'status', mods: source ? source.mods : null,
      dirX: (e.x - target.x) / (d || 1), dirY: (e.y - target.y) / (d || 1),
      knockback: 180, statusColor: '#3fe59d', canCrit: false,
    });
  }
}

export function killEntity(world, target, source, mods, info = {}) {
  if (target.dead) return;
  target.dead = true;
  target.hp = 0;
  const big = target.isBoss ? 2.4 : target.elite ? 1.5 : 1;

  deathFx(target.x, target.y, target.tint || '#4fd1ff', big);
  sfx('die', clamp((target.x - world.camera.x) / 640, -1, 1));
  addShake(target.isBoss ? 0.9 : target.elite ? 0.35 : 0.16);
  addHitstop(target.isBoss ? 0.5 : target.elite ? 0.14 : 0.06);

  if (target.team === TEAM.ENEMY) {
    world.run.kills++;

    // Shatter payoff for the ice build.
    if (mods && mods.shatter > 0 && target.hasStatus('frozen')) {
      shockwave(target.x, target.y, { r0: 8, r1: 150, life: 0.4, color: rgba('#cfeaff', 0.9), width: 5 });
      burst(target.x, target.y, 20, {
        speed: [180, 460], life: [0.3, 0.7], r0: [2, 5], r1: 0,
        color: '#dcefff', color2: '#7fb8ff', kind: 'shard', spread: TAU, drag: 3, glow: true,
      });
      for (const e of world.enemies) {
        if (e.dead || e === target) continue;
        const d = dist(target.x, target.y, e.x, e.y);
        if (d > 150) continue;
        applyDamage(world, e, mods.shatter * (mods.statusDmgMult || 1), {
          source, kind: 'status', mods, statusColor: '#cfeaff', canCrit: false,
          dirX: (e.x - target.x) / (d || 1), dirY: (e.y - target.y) / (d || 1), knockback: 120,
        });
      }
    }

    if (mods && source && source.heal) {
      if (mods.healOnKill > 0) source.heal(mods.healOnKill);
      if (mods.healOnSoakedKill > 0 && target.hasStatus('soaked')) source.heal(mods.healOnSoakedKill);
    }

    spawnDrops(world, target, mods);
  }

  target.onDeath?.(world);
}

function spawnDrops(world, target, mods) {
  const gm = mods ? mods.goldMult : 1;
  const sm = mods ? mods.shardMult : 1;
  const n = target.isBoss ? 14 : target.elite ? 6 : rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    world.pickups.push(new Pickup(
      target.x + rng.range(-24, 24), target.y + rng.range(-16, 16),
      'gold', Math.max(1, Math.round((target.isBoss ? 9 : target.elite ? 5 : 2) * gm))
    ));
  }
  const shardChance = target.isBoss ? 1 : target.elite ? 0.6 : 0.16;
  if (rng.next() < shardChance) {
    const amt = Math.max(1, Math.round((target.isBoss ? 6 : target.elite ? 2 : 1) * sm));
    world.pickups.push(new Pickup(target.x + rng.range(-14, 14), target.y, 'shard', amt));
  }
  if (!target.isBoss && rng.next() < 0.07) {
    world.pickups.push(new Pickup(target.x, target.y, 'health', 8));
  }
}

// ------------------------------------------------------------- projectiles

export class Projectile extends Entity {
  constructor(opts) {
    super(opts.x, opts.y, opts.r || 8);
    Object.assign(this, {
      team: TEAM.ENEMY,
      damage: 10,
      speed: 320,
      angle: 0,
      life: 3,
      pierce: 0,
      homing: 0,
      homingTarget: null,
      color: '#ff6a6a',
      color2: null,
      trail: 0.6,
      kind: 'orb',
      knockback: 80,
      gravity: 0,
      explode: 0,
      explodeR: 0,
      status: null,
      mods: null,
      source: null,
      spin: 0,
      wobble: 0,
      hitSet: null,
      canChain: false,
      trailTimer: 0,
    }, opts);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.hitSet = new Set();
    this.maxLife = this.life;
  }

  update(dt, world) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.expire(world); return; }

    if (this.homing > 0) {
      if (!this.homingTarget || this.homingTarget.dead) {
        this.homingTarget = nearestTarget(world, this.x, this.y, this.team, 460);
      }
      const t = this.homingTarget;
      if (t) {
        const want = Math.atan2(t.y - this.y, t.x - this.x);
        this.angle += clamp(angleDiff(this.angle, want), -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
      }
    }
    if (this.wobble) {
      const w = Math.sin(this.age * 14) * this.wobble;
      const nx = -Math.sin(this.angle), ny = Math.cos(this.angle);
      this.x += nx * w * dt * 60;
      this.y += ny * w * dt * 60;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spinAngle = (this.spinAngle || 0) + this.spin * dt;

    if (this.trail > 0) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.018;
        emit({
          x: this.x, y: this.y, vx: this.vx * -0.06, vy: this.vy * -0.06,
          life: 0.28 * this.trail, t: 0, r0: this.r * 0.72, r1: 0,
          color: this.color2 || this.color, kind: 'dot', drag: 3, glow: true, alpha: 0.75,
        });
      }
    }

    // Arena bounds.
    if (!world.room.contains(this.x, this.y, -this.r * 0.5)) {
      this.expire(world, true);
      return;
    }

    // Collision.
    if (this.team === TEAM.PLAYER) {
      for (const e of world.enemies) {
        if (e.dead || this.hitSet.has(e.id)) continue;
        if (dist(this.x, this.y, e.x, e.y) > this.r + e.r) continue;
        this.onHitTarget(world, e);
        if (this.dead) return;
      }
    } else {
      const p = world.player;
      if (p && !p.dead && dist(this.x, this.y, p.x, p.y) <= this.r + p.r * 0.78) {
        this.onHitTarget(world, p);
        if (this.dead) return;
      }
      // Player-parry style interaction: the dash blast wipes enemy shots.
      if (this.destructible && world.destroyProjectiles) {
        for (const z of world.destroyProjectiles) {
          if (dist(this.x, this.y, z.x, z.y) < z.r + this.r) { this.expire(world); return; }
        }
      }
    }
  }

  onHitTarget(world, target) {
    this.hitSet.add(target.id);
    const d = Math.hypot(this.vx, this.vy) || 1;
    applyDamage(world, target, this.damage, {
      source: this.source, mods: this.mods, kind: 'projectile',
      dirX: this.vx / d, dirY: this.vy / d, knockback: this.knockback,
      status: this.status, canChain: this.canChain,
      canCrit: this.team === TEAM.PLAYER,
    });
    if (this.explode > 0) this.detonate(world);
    else if (this.pierce > 0) this.pierce--;
    else this.expire(world);
  }

  detonate(world) {
    const r = this.explodeR || 100;
    shockwave(this.x, this.y, {
      r0: 8, r1: r, life: 0.36, color: rgba(this.color, 0.9), width: 6,
      fill: rgba(this.color, 0.18),
    });
    burst(this.x, this.y, 18, {
      speed: [140, 380], life: [0.24, 0.6], r0: [2, 5.5], r1: 0,
      color: this.color, color2: this.color2 || '#fff2c0', kind: 'spark', spread: TAU, drag: 4, glow: true,
    });
    addShake(0.22);
    sfx('explode', 0.7);
    const list = this.team === TEAM.PLAYER ? world.enemies : [world.player];
    for (const e of list) {
      if (!e || e.dead) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > r + e.r) continue;
      applyDamage(world, e, this.explode, {
        source: this.source, mods: this.mods, kind: 'explosion',
        dirX: (e.x - this.x) / (d || 1), dirY: (e.y - this.y) / (d || 1),
        knockback: 200, status: this.status, canCrit: this.team === TEAM.PLAYER,
      });
    }
    this.expire(world);
  }

  expire(world, quiet = false) {
    if (this.dead) return;
    this.dead = true;
    this.remove = true;
    if (!quiet) {
      burst(this.x, this.y, 6, {
        speed: [40, 150], life: [0.15, 0.35], r0: [1.5, 3.5], r1: 0,
        color: this.color, kind: 'dot', spread: TAU, drag: 6, glow: true,
      });
    }
  }

  draw(ctx) {
    const c = this.color, c2 = this.color2 || '#ffffff';
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.kind === 'orb') {
      glowDot(ctx, 0, 0, this.r * 2.6, c, 0.65);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(-this.r * 0.24, -this.r * 0.28, this.r * 0.45, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(4,8,15,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.stroke();
    } else if (this.kind === 'bolt') {
      ctx.rotate(this.angle);
      glowDot(ctx, 0, 0, this.r * 2.8, c, 0.55);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(this.r * 2.1, 0);
      ctx.lineTo(-this.r * 0.9, this.r * 0.85);
      ctx.lineTo(-this.r * 0.2, 0);
      ctx.lineTo(-this.r * 0.9, -this.r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(4,8,15,0.8)';
      ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(this.r * 1.5, 0);
      ctx.lineTo(-this.r * 0.3, this.r * 0.34);
      ctx.lineTo(-this.r * 0.3, -this.r * 0.34);
      ctx.closePath(); ctx.fill();
    } else if (this.kind === 'shard') {
      ctx.rotate(this.spinAngle || this.angle);
      glowDot(ctx, 0, 0, this.r * 2.4, c, 0.5);
      starPath(ctx, 0, 0, 4, this.r * 1.6, this.r * 0.55, 0);
      ctx.fillStyle = c; ctx.fill();
      ctx.strokeStyle = 'rgba(4,8,15,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    } else if (this.kind === 'spore') {
      ctx.rotate(this.spinAngle || 0);
      glowDot(ctx, 0, 0, this.r * 2.2, c, 0.45);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = c2; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * this.r * 0.7, Math.sin(a) * this.r * 0.7);
        ctx.lineTo(Math.cos(a) * this.r * 1.6, Math.sin(a) * this.r * 1.6);
        ctx.stroke();
      }
    } else if (this.kind === 'harpoon') {
      ctx.rotate(this.angle);
      ctx.strokeStyle = '#6d7f92'; ctx.lineWidth = this.r * 0.5;
      ctx.beginPath(); ctx.moveTo(-this.r * 3, 0); ctx.lineTo(this.r * 1.2, 0); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(this.r * 2.4, 0);
      ctx.lineTo(this.r * 0.2, this.r * 0.9);
      ctx.lineTo(this.r * 0.2, -this.r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(4,8,15,0.8)'; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.restore();
  }
}

export function nearestTarget(world, x, y, fromTeam, maxDist = Infinity) {
  if (fromTeam === TEAM.PLAYER) {
    let best = null, bd = maxDist;
    for (const e of world.enemies) {
      if (e.dead || e.untargetable) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  const p = world.player;
  return p && !p.dead && dist(x, y, p.x, p.y) <= maxDist ? p : null;
}

// ---------------------------------------------------------------- hazards

/** Persistent ground area: fire trails, poison pools, boss floor damage. */
export class Hazard {
  constructor(opts) {
    Object.assign(this, {
      x: 0, y: 0, r: 60, life: 3, t: 0, dps: 20, team: TEAM.ENEMY,
      color: '#ff6a2c', color2: '#ffcf7a', tickRate: 0.35, tick: 0,
      status: null, mods: null, source: null, kind: 'pool', dead: false,
      fadeIn: 0.18, grow: 0,
    }, opts);
    this.maxLife = this.life;
    this.seed = rng.range(0, 100);
  }

  update(dt, world) {
    this.t += dt;
    this.life -= dt;
    if (this.grow) this.r += this.grow * dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = this.tickRate;
      const targets = this.team === TEAM.PLAYER ? world.enemies : [world.player];
      for (const e of targets) {
        if (!e || e.dead) continue;
        if (dist(this.x, this.y, e.x, e.y) > this.r + e.r * 0.5) continue;
        applyDamage(world, e, this.dps * this.tickRate, {
          source: this.source, mods: this.mods, kind: 'status',
          statusColor: this.color, silent: true, noKnock: true,
          status: this.status, canCrit: false,
        });
      }
    }
    if (rng.next() < 0.5) {
      const a = rng.angle(), rr = Math.sqrt(rng.next()) * this.r;
      emit({
        x: this.x + Math.cos(a) * rr, y: this.y + Math.sin(a) * rr,
        vx: rng.range(-10, 10), vy: rng.range(-46, -14),
        life: rng.range(0.3, 0.7), t: 0, r0: rng.range(2, 5), r1: 0,
        color: this.color, color2: this.color2, kind: 'dot', drag: 1.6, glow: true,
      });
    }
  }

  draw(ctx) {
    const fade = Math.min(1, this.t / this.fadeIn) * Math.min(1, this.life / 0.5);
    ctx.save();
    ctx.globalAlpha = 0.34 * fade;
    const g = ctx.createRadialGradient(this.x, this.y, this.r * 0.15, this.x, this.y, this.r);
    g.addColorStop(0, rgba(this.color2, 0.85));
    g.addColorStop(0.6, rgba(this.color, 0.5));
    g.addColorStop(1, rgba(this.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.r, this.r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.6 * fade;
    ctx.strokeStyle = rgba(this.color2, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.r * (0.94 + Math.sin(this.t * 4 + this.seed) * 0.04), this.r * 0.6, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- pickups

const PICKUP_STYLE = {
  gold:   { color: '#f5c542', color2: '#fff0b0', glyph: 'coin',  label: '금화' },
  shard:  { color: '#8ce8ff', color2: '#e6fbff', glyph: 'shard', label: '심연 결정' },
  health: { color: '#ff5470', color2: '#ffc0cc', glyph: 'heart', label: '체력' },
};

export class Pickup extends Entity {
  constructor(x, y, kind, value) {
    super(x, y, 11);
    this.kind = kind;
    this.value = value;
    this.style = PICKUP_STYLE[kind];
    this.vx = rng.range(-90, 90);
    this.vy = rng.range(-90, 90);
    this.z = 14;
    this.vz = rng.range(60, 160);
    this.magnet = false;
    this.life = 26;
    this.bob = rng.angle();
  }

  update(dt, world) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) { this.remove = true; return; }
    const p = world.player;
    const d = p ? dist(this.x, this.y, p.x, p.y) : 9999;
    if (p && !p.dead && d < 150) this.magnet = true;
    if (this.magnet && p && !p.dead) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const pull = lerp(760, 260, clamp(d / 150, 0, 1));
      this.vx = damp(this.vx, Math.cos(a) * pull, 9, dt);
      this.vy = damp(this.vy, Math.sin(a) * pull, 9, dt);
    } else {
      const dr = Math.exp(-4 * dt);
      this.vx *= dr; this.vy *= dr;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.z > 0 || this.vz !== 0) {
      this.vz -= 900 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = Math.abs(this.vz) > 40 ? -this.vz * 0.4 : 0; }
    }
    world.room.clampPoint(this, 8);
    if (p && !p.dead && d < p.r + this.r + 4 && this.z < 26) this.collect(world, p);
  }

  collect(world, player) {
    this.remove = true;
    if (this.kind === 'gold') {
      world.run.gold += this.value;
      sfx('coin');
      floatText(this.x, this.y - 12, `+${this.value}`, { color: '#ffd870', size: 16, life: 0.7, rise: 26 });
    } else if (this.kind === 'shard') {
      world.run.shards += this.value;
      sfx('pickup');
      floatText(this.x, this.y - 12, `결정 +${this.value}`, { color: '#a8f0ff', size: 16, life: 0.9, rise: 34 });
    } else if (this.kind === 'health') {
      player.heal(this.value);
      sfx('heal');
    }
    burst(this.x, this.y - this.z, 8, {
      speed: [50, 180], life: [0.2, 0.45], r0: [1.5, 3.5], r1: 0,
      color: this.style.color, kind: 'spark', spread: TAU, drag: 6, glow: true,
    });
  }

  draw(ctx) {
    const y = this.y - this.z - Math.sin(this.age * 4 + this.bob) * 3;
    const blink = this.life < 5 && Math.floor(this.life * 6) % 2 === 0;
    if (blink) return;
    drawShadow(ctx, this.x, this.y + 4, this.r * 0.7, this.r * 0.3, 0.3);
    glowDot(ctx, this.x, y, this.r * 2.4, this.style.color, 0.55);
    ctx.save();
    ctx.translate(this.x, y);
    const s = 1 + Math.sin(this.age * 6 + this.bob) * 0.06;
    ctx.scale(s, s);
    if (this.kind === 'gold') {
      ctx.fillStyle = this.style.color;
      ctx.beginPath(); ctx.ellipse(0, 0, this.r * 0.8, this.r * 0.86, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = this.style.color2;
      ctx.beginPath(); ctx.ellipse(-2, -2, this.r * 0.3, this.r * 0.34, 0, 0, TAU); ctx.fill();
    } else if (this.kind === 'shard') {
      starPath(ctx, 0, 0, 4, this.r * 1.35, this.r * 0.45, this.age * 1.2);
      ctx.fillStyle = this.style.color; ctx.fill();
      ctx.strokeStyle = '#2a6d85'; ctx.lineWidth = 2; ctx.stroke();
    } else {
      ctx.fillStyle = this.style.color;
      ctx.beginPath();
      ctx.moveTo(0, this.r * 0.85);
      ctx.bezierCurveTo(-this.r * 1.5, -this.r * 0.2, -this.r * 0.9, -this.r * 1.2, 0, -this.r * 0.4);
      ctx.bezierCurveTo(this.r * 0.9, -this.r * 1.2, this.r * 1.5, -this.r * 0.2, 0, this.r * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8c1f31'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------ chain arc fx

export function drawChainArcs(ctx, arcs, dt) {
  for (let i = arcs.length - 1; i >= 0; i--) {
    const a = arcs[i];
    a.t += dt;
    if (a.t >= a.life) { arcs.splice(i, 1); continue; }
    const u = 1 - a.t / a.life;
    ctx.save();
    ctx.globalAlpha = u;
    ctx.strokeStyle = '#3fe59d';
    ctx.shadowColor = '#3fe59d';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3.4 * u + 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const seg = 6;
    ctx.moveTo(a.x0, a.y0);
    for (let s = 1; s < seg; s++) {
      const t = s / seg;
      const jx = lerp(a.x0, a.x1, t) + rng.range(-11, 11);
      const jy = lerp(a.y0, a.y1, t) + rng.range(-11, 11);
      ctx.lineTo(jx, jy);
    }
    ctx.lineTo(a.x1, a.y1);
    ctx.stroke();
    ctx.restore();
  }
}
