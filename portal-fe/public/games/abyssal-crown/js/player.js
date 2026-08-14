// 레비아, 가라앉은 왕국의 마지막 창기사.
//
// Keyboard-only combat: attacks fire along the facing direction with a soft
// aim-assist snap, so there is never a cursor to track. Dash grants i-frames and
// cancels attack recovery, which is the core defensive expression of the game.

import {
  TAU, clamp, lerp, damp, dist, angleDiff, angleApproach, rng, easeOutCubic,
  easeOutQuint, inCone,
} from './core.js';
import {
  addShake, addHitstop, burst, shockwave, screenFlash, damageNumber, emit,
  rgba, floatText, addChroma, decal,
} from './fx.js';
import { Entity, TEAM, Projectile, Hazard, applyDamage, nearestTarget } from './entities.js';
import { drawShadow, glowDot, limb, starPath, PAL, shapeStyle, blobPath } from './art.js';
import { sfx } from './audio.js';
import { moveVector, isDown, justPressed, buffered, consumeBuffer } from './input.js';

const COMBO = [
  { windup: 0.055, active: 0.085, recover: 0.115, dmg: 15, range: 104, arc: 1.55, knock: 190, sweep: 1 },
  { windup: 0.050, active: 0.085, recover: 0.115, dmg: 15, range: 104, arc: 1.55, knock: 190, sweep: -1 },
  { windup: 0.090, active: 0.110, recover: 0.240, dmg: 27, range: 124, arc: 2.5, knock: 340, sweep: 1, heavy: true },
];

const SPECIAL = { windup: 0.16, active: 0.22, recover: 0.26, dmg: 32, radius: 128, cd: 1.0 };
const CAST = { dmg: 26, speed: 620, reload: 2.4, windup: 0.09, recover: 0.16 };
const DASH = { dist: 205, dur: 0.165, iframes: 0.26, cd: 0.46 };

export class Player extends Entity {
  constructor(x, y, build) {
    super(x, y, 17);
    this.team = TEAM.PLAYER;
    this.build = build;
    this.mods = build.mods;
    this.baseMaxHp = 100;
    this.maxHp = this.baseMaxHp + this.mods.maxHpBonus;
    this.hp = this.maxHp;
    this.speed = 252;
    this.mass = 1.35;

    this.state = 'free';
    this.stateT = 0;
    this.comboIndex = 0;
    this.comboWindow = 0;
    this.swingHits = null;
    this.swingAngle = 0;
    this.swingProgress = 0;
    this.attackQueued = false;

    this.spCd = 0;
    this.spinAngle = 0;

    this.castAmmoMax = 3 + this.mods.castAmmo;
    this.castAmmo = this.castAmmoMax;
    this.castReload = 0;

    this.dashCharges = 1 + this.mods.dashCharges;
    this.dashStock = this.dashCharges;
    this.dashCdT = 0;
    this.dashAngle = 0;
    this.dashTrail = [];
    this.dashChainT = 0;

    this.critWindow = 0;
    this.defiance = this.mods.deathDefiance;
    this.defianceMax = this.mods.deathDefiance;
    this.hurtCooldown = 0;
    this.deathTimer = 0;

    this.walkPhase = 0;
    this.cloak = [0, 0, 0, 0, 0, 0];
    this.lean = 0;
    this.bob = 0;
    this.flashHeal = 0;
    this.lastMoveDir = -Math.PI / 2;
    this.facing = -Math.PI / 2;
    this.visorPulse = 0;
  }

  /** Boons can change max HP mid-run; keep the current pool proportional. */
  refreshMods() {
    const before = this.maxHp;
    this.mods = this.build.mods;
    this.maxHp = this.baseMaxHp + this.mods.maxHpBonus;
    if (this.maxHp > before) this.hp += this.maxHp - before;
    this.hp = clamp(this.hp, 1, this.maxHp);
    this.castAmmoMax = 3 + this.mods.castAmmo;
    this.castAmmo = Math.min(this.castAmmo + Math.max(0, this.castAmmoMax - this.castAmmo), this.castAmmoMax);
    this.dashCharges = 1 + this.mods.dashCharges;
    this.dashStock = Math.min(this.dashCharges, Math.max(this.dashStock, 1));
    this.defianceMax = this.mods.deathDefiance;
    this.defiance = Math.min(this.defiance + 1, this.defianceMax);
  }

  heal(n) {
    if (this.dead) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    const gained = this.hp - before;
    if (gained > 0.5) {
      damageNumber(this.x, this.y - this.r - 14, gained, { heal: true });
      this.flashHeal = 0.5;
      burst(this.x, this.y, 8, {
        speed: [30, 120], life: [0.4, 0.8], r0: [2, 4], r1: 0,
        color: '#7bf5a8', kind: 'dot', spread: TAU, drag: 3, glow: true,
      });
    }
  }

  addMaxHp(n) {
    this.baseMaxHp += n;
    this.maxHp += n;
    this.hp += n;
  }

  get invulnerable() {
    return this.invuln > 0 || this.state === 'dash';
  }

  // ------------------------------------------------------------- update

  update(dt, world) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.flashHeal = Math.max(0, this.flashHeal - dt * 2);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.critWindow = Math.max(0, this.critWindow - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.spCd = Math.max(0, this.spCd - dt);
    this.visorPulse = (this.visorPulse + dt * 3) % TAU;

    if (this.dead) {
      this.deathTimer += dt;
      this.integrateKnockback(dt);
      return;
    }

    this.tickDash(dt);
    this.tickCast(dt);
    this.updateStatuses(dt, world);

    const mv = world.controlLocked ? { x: 0, y: 0, len: 0 } : moveVector();

    if (mv.len > 0.05) this.lastMoveDir = Math.atan2(mv.y, mv.x);

    switch (this.state) {
      case 'free':   this.updateFree(dt, world, mv); break;
      case 'attack': this.updateAttack(dt, world, mv); break;
      case 'special': this.updateSpecial(dt, world, mv); break;
      case 'cast':   this.updateCast(dt, world, mv); break;
      case 'dash':   this.updateDash(dt, world); break;
    }

    this.integrateKnockback(dt);
    world.room.clampCircle(this);
    this.updateVisuals(dt, mv);
  }

  updateVisuals(dt, mv) {
    const moving = mv.len > 0.05 && this.state !== 'dash';
    this.walkPhase += dt * (moving ? 11 : 4);
    this.bob = moving ? Math.sin(this.walkPhase) * 2.4 : Math.sin(this.age * 2.4) * 1.1;
    const targetLean = moving ? clamp(angleDiff(this.facing, this.lastMoveDir), -0.5, 0.5) : 0;
    this.lean = damp(this.lean, targetLean, 10, dt);
    // Cloak segments trail one frame behind the previous one.
    const head = -this.vx * 0.012 - (this.state === 'dash' ? Math.cos(this.dashAngle) * 4 : 0);
    const headY = -this.vy * 0.012 - (this.state === 'dash' ? Math.sin(this.dashAngle) * 4 : 0);
    this.cloak[0] = damp(this.cloak[0], head, 16, dt);
    this.cloak[1] = damp(this.cloak[1], headY, 16, dt);
    for (let i = 2; i < 6; i += 2) {
      this.cloak[i] = damp(this.cloak[i], this.cloak[i - 2], 14, dt);
      this.cloak[i + 1] = damp(this.cloak[i + 1], this.cloak[i - 1], 14, dt);
    }
    this.squash = damp(this.squash, 1, 12, dt);
  }

  moveWith(dt, mv, speedMult = 1) {
    const spd = this.speed * this.mods.moveMult * speedMult * this.statusSpeedMult();
    const tx = mv.x * spd, ty = mv.y * spd;
    const accel = mv.len > 0.05 ? 22 : 16;
    this.vx = damp(this.vx, tx, accel, dt);
    this.vy = damp(this.vy, ty, accel, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (mv.len > 0.05) {
      this.facing = angleApproach(this.facing, this.lastMoveDir, dt * 18);
    }
  }

  updateFree(dt, world, mv) {
    this.moveWith(dt, mv);
    if (world.controlLocked) return;
    if (this.tryDash(world)) return;
    if (buffered('attack')) { consumeBuffer('attack'); this.startAttack(world); return; }
    if (buffered('special') && this.spCd <= 0) { consumeBuffer('special'); this.startSpecial(world); return; }
    if (buffered('cast') && this.castAmmo > 0) { consumeBuffer('cast'); this.startCast(world); return; }
  }

  // ------------------------------------------------------------ aim assist

  /**
   * Snap toward a nearby enemy. Full snap when standing still, partial while
   * moving so player-intent always wins over the assist.
   */
  assistAim(world, range = 300, coneHalf = 1.15) {
    let best = null, bestScore = Infinity;
    for (const e of world.enemies) {
      if (e.dead || e.untargetable) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > range) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      const off = Math.abs(angleDiff(this.facing, a));
      if (off > coneHalf) continue;
      const score = off * 220 + d;
      if (score < bestScore) { bestScore = score; best = { e, a, off }; }
    }
    if (!best) return;
    const moving = Math.hypot(this.vx, this.vy) > 40;
    this.facing = angleLerpSafe(this.facing, best.a, moving ? 0.65 : 1);
    this.aimTarget = best.e;
  }

  // -------------------------------------------------------------- attack

  startAttack(world) {
    const step = COMBO[this.comboIndex];
    this.assistAim(world, 300, 1.2);
    this.state = 'attack';
    this.stateT = 0;
    this.swingHits = new Set();
    this.swingStep = step;
    this.swingAngle = this.facing;
    this.swingProgress = 0;
    this.attackQueued = false;
    this.squash = step.heavy ? 1.14 : 1.07;
    sfx('swing', clamp((this.x - world.camera.x) / 640, -1, 1), step.heavy ? 1.3 : 1);
  }

  updateAttack(dt, world, mv) {
    const s = this.swingStep;
    const spd = this.mods.atkSpeed;
    this.stateT += dt * spd;
    const total = s.windup + s.active + s.recover;

    // Movement is heavily damped during a swing, restored during recovery.
    const phase = this.stateT < s.windup ? 'windup' : this.stateT < s.windup + s.active ? 'active' : 'recover';
    const moveMult = phase === 'recover' ? 0.55 : 0.18;
    this.moveWith(dt, mv, moveMult);

    if (phase === 'active') {
      const u = (this.stateT - s.windup) / s.active;
      this.swingProgress = u;
      this.doSwingHits(world, s, u);
    } else if (phase === 'windup') {
      this.swingProgress = -(1 - this.stateT / s.windup);
    } else {
      this.swingProgress = 1;
      if (!world.controlLocked) {
        if (this.tryDash(world)) return;
        if (buffered('special') && this.spCd <= 0) { consumeBuffer('special'); this.startSpecial(world); return; }
        if (buffered('cast') && this.castAmmo > 0) { consumeBuffer('cast'); this.startCast(world); return; }
        if (buffered('attack')) this.attackQueued = true;
      }
    }

    if (this.stateT >= total) {
      this.comboIndex = (this.comboIndex + 1) % COMBO.length;
      this.comboWindow = 0.42;
      if (this.attackQueued) {
        consumeBuffer('attack');
        this.startAttack(world);
      } else {
        this.state = 'free';
        this.stateT = 0;
      }
    }
  }

  doSwingHits(world, s, u) {
    const m = this.mods;
    const half = s.arc / 2;
    // The hitbox sweeps across the arc over the active window.
    const cur = this.swingAngle + s.sweep * lerp(-half, half, u);
    const reach = s.range;
    for (const e of world.enemies) {
      if (e.dead || this.swingHits.has(e.id)) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > reach + e.r) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      if (Math.abs(angleDiff(cur, a)) > half * 0.62 + Math.atan2(e.r, Math.max(d, 1))) continue;
      this.swingHits.add(e.id);
      const dmg = s.dmg * m.dmgMult * m.atkMult;
      applyDamage(world, e, dmg, {
        source: this, mods: m, kind: 'melee',
        dirX: Math.cos(a), dirY: Math.sin(a), knockback: s.knock,
        status: m.onAttack, canChain: true,
      });
      if (s.heavy) addShake(0.18);
    }
  }

  // ------------------------------------------------------------- special

  startSpecial(world) {
    this.assistAim(world, 260, 1.5);
    this.state = 'special';
    this.stateT = 0;
    this.swingHits = new Set();
    this.spinAngle = this.facing;
    this.squash = 0.9;
    sfx('special');
  }

  updateSpecial(dt, world, mv) {
    const s = SPECIAL;
    this.stateT += dt * this.mods.atkSpeed;
    const phase = this.stateT < s.windup ? 'windup' : this.stateT < s.windup + s.active ? 'active' : 'recover';
    this.moveWith(dt, mv, phase === 'recover' ? 0.5 : 0.12);

    const radius = s.radius * this.mods.specialRadius;

    if (phase === 'windup') {
      this.spinAngle += dt * 9;
      if (rng.next() < 0.6) {
        const a = rng.angle();
        emit({
          x: this.x + Math.cos(a) * radius, y: this.y + Math.sin(a) * radius,
          vx: -Math.cos(a) * 180, vy: -Math.sin(a) * 180,
          life: 0.32, t: 0, r0: 3, r1: 0, color: '#7fe9ff', kind: 'spark', drag: 2, glow: true,
        });
      }
    } else if (phase === 'active') {
      this.spinAngle += dt * 34;
      const u = (this.stateT - s.windup) / s.active;
      if (!this.spBurst) {
        this.spBurst = true;
        this.fireSpecialBurst(world, radius);
      }
      const cur = radius * easeOutQuint(clamp(u * 1.4, 0, 1));
      for (const e of world.enemies) {
        if (e.dead || this.swingHits.has(e.id)) continue;
        const d = dist(this.x, this.y, e.x, e.y);
        if (d > cur + e.r) continue;
        this.swingHits.add(e.id);
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        const m = this.mods;
        applyDamage(world, e, s.dmg * m.dmgMult * m.spMult, {
          source: this, mods: m, kind: 'special',
          dirX: Math.cos(a), dirY: Math.sin(a),
          knockback: m.specialPull > 0 ? 0 : 260,
          status: m.onSpecial,
        });
        if (m.specialPull > 0) e.applyKnockback(-Math.cos(a), -Math.sin(a), m.specialPull);
        if (m.specialFreeze > 0) e.addStatus('frozen', 1, this);
        if (m.specialExplode > 0) {
          applyDamage(world, e, m.specialExplode * m.dmgMult, {
            source: this, mods: m, kind: 'explosion', statusColor: '#ff8a3c',
            dirX: Math.cos(a), dirY: Math.sin(a), canCrit: false, silent: true,
          });
        }
      }
    } else {
      this.spinAngle += dt * 7;
      if (!world.controlLocked && this.tryDash(world)) return;
      if (!world.controlLocked && buffered('attack')) { consumeBuffer('attack'); this.startAttack(world); return; }
    }

    if (this.stateT >= s.windup + s.active + s.recover) {
      this.state = 'free';
      this.stateT = 0;
      this.spBurst = false;
      this.spCd = s.cd * this.mods.dashCdMult;
      this.comboIndex = 0;
    }
  }

  fireSpecialBurst(world, radius) {
    const m = this.mods;
    const col = m.specialFreeze > 0 ? '#cfeaff' : m.specialExplode > 0 ? '#ff8a3c' : '#7fe9ff';
    shockwave(this.x, this.y, {
      r0: 18, r1: radius * 1.05, life: 0.42, color: rgba(col, 0.95), width: 8,
      fill: rgba(col, 0.16),
    });
    shockwave(this.x, this.y, { r0: 10, r1: radius * 0.7, life: 0.3, color: 'rgba(255,255,255,0.8)', width: 4 });
    burst(this.x, this.y, 26, {
      speed: [280, 560], life: [0.22, 0.5], r0: [2, 5], r1: 0,
      color: col, color2: '#ffffff', kind: 'spark', spread: TAU, drag: 5, glow: true,
    });
    addShake(0.4);
    addHitstop(0.055);
    addChroma(0.5);
  }

  // ---------------------------------------------------------------- cast

  tickCast(dt) {
    if (this.castAmmo < this.castAmmoMax) {
      this.castReload -= dt;
      if (this.castReload <= 0) {
        this.castAmmo++;
        this.castReload = CAST.reload;
        if (this.castAmmo === this.castAmmoMax) this.castReload = 0;
      }
    }
  }

  startCast(world) {
    this.assistAim(world, 460, 1.0);
    this.state = 'cast';
    this.stateT = 0;
    this.castFired = false;
    this.squash = 0.94;
  }

  updateCast(dt, world, mv) {
    this.stateT += dt * this.mods.atkSpeed;
    this.moveWith(dt, mv, this.stateT < CAST.windup ? 0.3 : 0.7);
    if (!this.castFired && this.stateT >= CAST.windup) {
      this.castFired = true;
      this.fireCast(world);
    }
    if (this.stateT >= CAST.windup + CAST.recover) {
      this.state = 'free';
      this.stateT = 0;
      if (!world.controlLocked && buffered('attack')) { consumeBuffer('attack'); this.startAttack(world); }
    }
  }

  fireCast(world) {
    const m = this.mods;
    if (this.castAmmo <= 0) return;
    this.castAmmo--;
    if (this.castReload <= 0) this.castReload = CAST.reload;

    const shots = 1 + m.castSplit;
    const spread = shots > 1 ? 0.22 : 0;
    const col = m.onCast ? ({
      soaked: '#4fc3ff', burn: '#ff8a3c', chill: '#c9a4ff', reso: '#4fe9a8',
    })[m.onCast.type] : '#8ce8ff';

    for (let i = 0; i < shots; i++) {
      const off = shots > 1 ? (i - (shots - 1) / 2) * spread : 0;
      world.projectiles.push(new Projectile({
        x: this.x + Math.cos(this.facing) * 20,
        y: this.y + Math.sin(this.facing) * 20 - 6,
        r: 9, team: TEAM.PLAYER,
        damage: CAST.dmg * m.dmgMult * m.castMult,
        speed: CAST.speed, angle: this.facing + off, life: 1.5,
        pierce: m.castPierce, homing: m.castHoming, kind: 'bolt',
        color: col, color2: '#ffffff', knockback: 150,
        explode: m.castExplode * m.dmgMult, explodeR: m.castExplodeR || 100,
        status: m.onCast, mods: m, source: this, canChain: false,
      }));
    }
    burst(this.x + Math.cos(this.facing) * 22, this.y + Math.sin(this.facing) * 22 - 6, 8, {
      speed: [80, 240], life: [0.15, 0.35], r0: [1.5, 3.5], r1: 0,
      color: col, kind: 'spark', spread: 1.2, dir: this.facing, drag: 6, glow: true,
    });
    addShake(0.07);
    sfx('cast');
  }

  // ---------------------------------------------------------------- dash

  tickDash(dt) {
    if (this.dashStock < this.dashCharges) {
      this.dashCdT -= dt;
      if (this.dashCdT <= 0) {
        this.dashStock++;
        this.dashCdT = this.dashStock < this.dashCharges ? DASH.cd * this.mods.dashCdMult : 0;
      }
    }
    this.dashChainT = Math.max(0, this.dashChainT - dt);
    for (let i = this.dashTrail.length - 1; i >= 0; i--) {
      this.dashTrail[i].t += dt;
      if (this.dashTrail[i].t > 0.34) this.dashTrail.splice(i, 1);
    }
  }

  tryDash(world) {
    if (world.controlLocked) return false;
    if (!buffered('dash') || this.dashStock <= 0) return false;
    consumeBuffer('dash');
    this.startDash(world);
    return true;
  }

  startDash(world) {
    const mv = moveVector();
    this.dashAngle = mv.len > 0.05 ? Math.atan2(mv.y, mv.x) : this.facing;
    this.facing = this.dashAngle;
    this.state = 'dash';
    this.stateT = 0;
    this.dashStock--;
    if (this.dashCdT <= 0) this.dashCdT = DASH.cd * this.mods.dashCdMult;
    this.invuln = Math.max(this.invuln, DASH.iframes * this.mods.dashIFrameMult);
    this.dashStartX = this.x;
    this.dashStartY = this.y;
    this.dashContactHits = new Set();
    this.squash = 0.82;
    sfx('dash');
    burst(this.x, this.y, 12, {
      speed: [60, 200], life: [0.2, 0.45], r0: [2, 5], r1: 0,
      color: '#9fe6ff', kind: 'dot', spread: 1.6, dir: this.dashAngle + Math.PI, drag: 5, glow: true,
    });

    const m = this.mods;
    if (m.dashSlow > 0) {
      const r = m.dashSlowR || 140;
      shockwave(this.x, this.y, { r0: 8, r1: r, life: 0.4, color: rgba('#c9a4ff', 0.8), width: 4 });
      for (const e of world.enemies) {
        if (e.dead || dist(this.x, this.y, e.x, e.y) > r) continue;
        e.addStatus('chill', m.onDash ? m.onDash.stacks : 2, this);
        e.slowT = 1.6; e.slowAmt = m.dashSlow;
      }
    }
  }

  updateDash(dt, world) {
    this.stateT += dt;
    const u = clamp(this.stateT / DASH.dur, 0, 1);
    const m = this.mods;
    const speed = (DASH.dist / DASH.dur) * (1 - easeOutCubic(u) * 0.45);
    this.vx = Math.cos(this.dashAngle) * speed;
    this.vy = Math.sin(this.dashAngle) * speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.stateT % 0.03 < dt) {
      this.dashTrail.push({ x: this.x, y: this.y, a: this.facing, t: 0 });
    }

    if (m.dashTrail > 0 && this.stateT % 0.05 < dt) {
      world.hazards.push(new Hazard({
        x: this.x, y: this.y, r: 34, life: m.dashTrailDur || 2.5,
        dps: m.dashTrail * m.dmgMult, team: TEAM.PLAYER,
        color: '#ff6a2c', color2: '#ffcf7a', mods: m, source: this,
        status: { type: 'burn', stacks: 1 },
      }));
    }

    if (m.dashContact > 0) {
      for (const e of world.enemies) {
        if (e.dead || this.dashContactHits.has(e.id)) continue;
        if (dist(this.x, this.y, e.x, e.y) > this.r + e.r + 6) continue;
        this.dashContactHits.add(e.id);
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        applyDamage(world, e, m.dashContact * m.dmgMult, {
          source: this, mods: m, kind: 'dash', dirX: Math.cos(a), dirY: Math.sin(a),
          knockback: 160, status: m.onDash, canCrit: false,
        });
      }
    }

    if (u >= 1) {
      this.state = 'free';
      this.stateT = 0;
      this.squash = 1.18;
      if (m.dashCritWindow > 0) this.critWindow = m.dashCritWindow;
      if (m.dashBlast > 0) this.dashBlast(world);
      // A dash immediately after landing chains into an attack if buffered.
      if (buffered('attack')) { consumeBuffer('attack'); this.startAttack(world); }
      else if (buffered('special') && this.spCd <= 0) { consumeBuffer('special'); this.startSpecial(world); }
    }
  }

  dashBlast(world) {
    const m = this.mods;
    const r = m.dashBlastR || 110;
    shockwave(this.x, this.y, {
      r0: 10, r1: r, life: 0.4, color: rgba('#5fd6ff', 0.9), width: 6, fill: rgba('#3fb0ff', 0.16),
    });
    burst(this.x, this.y, 20, {
      speed: [180, 430], life: [0.24, 0.55], r0: [2, 5], r1: 0,
      color: '#7fd8ff', color2: '#ffffff', kind: 'spark', spread: TAU, drag: 4.5, glow: true,
    });
    addShake(0.24);
    sfx('explode', 0.6);
    for (const e of world.enemies) {
      if (e.dead) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > r + e.r) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      applyDamage(world, e, m.dashBlast * m.dmgMult * m.dashMult, {
        source: this, mods: m, kind: 'dash', dirX: Math.cos(a), dirY: Math.sin(a),
        knockback: 240, status: m.onDash,
      });
    }
  }

  // -------------------------------------------------------------- damage

  takeDamage(world, amount, opts = {}) {
    if (this.dead || this.invulnerable || this.hurtCooldown > 0) return 0;
    const dmg = Math.max(1, Math.round(amount));

    if (this.hp - dmg <= 0 && this.defiance > 0) {
      this.defiance--;
      this.hp = Math.max(this.hp, 40);
      this.invuln = 1.5;
      this.hurtCooldown = 0.6;
      screenFlash('#ffd34a', 0.5, 0.5);
      addShake(0.7);
      addHitstop(0.22);
      shockwave(this.x, this.y, { r0: 10, r1: 260, life: 0.7, color: 'rgba(245,197,66,0.9)', width: 8 });
      floatText(this.x, this.y - 60, '불복!', { color: '#ffd34a', size: 33, life: 1.6 });
      sfx('shield');
      return 0;
    }

    this.hp -= dmg;
    this.hitFlash = 0.3;
    this.invuln = 0.55;
    this.hurtCooldown = 0.18;
    damageNumber(this.x, this.y - this.r - 12, dmg, { color: '#ff8a9a' });
    screenFlash('#ff2d4a', clamp(0.12 + dmg / 260, 0.12, 0.3), 0.26);
    addShake(clamp(0.3 + dmg / 90, 0.3, 0.8));
    addHitstop(0.09);
    addChroma(0.8);
    sfx('hurt');
    if (opts.dirX || opts.dirY) this.applyKnockback(opts.dirX || 0, opts.dirY || 0, 190);
    burst(this.x, this.y, 12, {
      speed: [80, 260], life: [0.25, 0.6], r0: [2, 5], r1: 0,
      color: '#ff5470', color2: '#ffd0d8', kind: 'spark', spread: TAU, drag: 4, glow: true,
    });

    if (this.mods.thorns > 0) {
      shockwave(this.x, this.y, { r0: 10, r1: 190, life: 0.36, color: 'rgba(245,197,66,0.8)', width: 5 });
      for (const e of world.enemies) {
        if (e.dead || dist(this.x, this.y, e.x, e.y) > 190) continue;
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        applyDamage(world, e, this.mods.thorns * this.mods.dmgMult, {
          source: this, mods: this.mods, kind: 'thorns', statusColor: '#ffd34a',
          dirX: Math.cos(a), dirY: Math.sin(a), knockback: 200, canCrit: false,
        });
      }
    }

    if (this.hp <= 0) this.die(world);
    return dmg;
  }

  die(world) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.state = 'dead';
    this.deathTimer = 0;
    screenFlash('#ff2d4a', 0.7, 0.9);
    addShake(1);
    addHitstop(0.35);
    burst(this.x, this.y, 30, {
      speed: [80, 340], life: [0.5, 1.3], r0: [2, 6], r1: 0,
      color: '#57e2d6', color2: '#0a1522', kind: 'shard', spread: TAU, drag: 2.4, grav: 200,
    });
    shockwave(this.x, this.y, { r0: 12, r1: 320, life: 0.9, color: 'rgba(255,90,110,0.8)', width: 8 });
    sfx('defeat');
    decal(this.x, this.y, 34, '#2a5c6e', 30);
  }

  // ---------------------------------------------------------------- draw

  draw(ctx, world) {
    if (this.dead && this.deathTimer > 0.5) return;

    // Dash afterimages, oldest first.
    for (const t of this.dashTrail) {
      const a = (1 - t.t / 0.34) * 0.4;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.a + Math.PI / 2);
      ctx.fillStyle = '#7fe9ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 19, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Standing light — keeps the silhouette legible on every biome floor.
    glowDot(ctx, this.x, this.y + 8, 46, '#3fb8d8', 0.32);
    drawShadow(ctx, this.x, this.y + 12, 17, 7.5, 0.5);

    ctx.save();
    ctx.translate(this.x, this.y + this.bob - this.z);
    ctx.rotate(this.facing + Math.PI / 2);
    const sq = this.squash;
    ctx.scale(1.14 / sq, 1.14 * sq);

    const invulnFlash = this.invuln > 0 && Math.floor(this.age * 24) % 2 === 0;
    if (invulnFlash) ctx.globalAlpha = 0.55;

    this.drawCloak(ctx);
    this.drawBody(ctx);
    this.drawWeapon(ctx);

    ctx.globalAlpha = 1;
    ctx.restore();

    this.drawSwingFx(ctx);
    this.drawStatusAura(ctx);

    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * 1.6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff6a7a';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 4, this.r * 1.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (this.flashHeal > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashHeal * 0.5;
      ctx.strokeStyle = '#7bf5a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 4, this.r * (1.5 + (0.5 - this.flashHeal) * 2), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (this.critWindow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.age * 14) * 0.12;
      ctx.strokeStyle = '#3fe59d';
      ctx.lineWidth = 2.2;
      starPath(ctx, this.x, this.y - 2, 3, this.r * 1.9, this.r * 1.2, this.age * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawCloak(ctx) {
    const c = this.cloak;
    const sway = Math.sin(this.walkPhase * 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.quadraticCurveTo(-17 + c[0], 16 + c[1], -9 + c[2] + sway, 30 + c[3]);
    ctx.quadraticCurveTo(0 + c[4], 38 + c[5], 9 + c[2] - sway, 30 + c[3]);
    ctx.quadraticCurveTo(17 + c[0], 16 + c[1], 11, 2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 36);
    g.addColorStop(0, '#2f6b84');
    g.addColorStop(0.55, '#1d4459');
    g.addColorStop(1, '#102a39');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#061019';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Trim
    ctx.strokeStyle = 'rgba(120,240,230,0.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-9 + c[2] + sway, 30 + c[3]);
    ctx.quadraticCurveTo(0 + c[4], 38 + c[5], 9 + c[2] - sway, 30 + c[3]);
    ctx.stroke();
  }

  drawBody(ctx) {
    // Torso
    ctx.beginPath();
    ctx.ellipse(0, 2, 12.5, 14.5, 0, 0, TAU);
    shapeStyle(ctx, 0, 2, 14, '#3e849e', { lightDir: -Math.PI / 2, rim: 0.9, outlineW: 3 });

    // Chest plate
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -1);
    ctx.lineTo(5, 11);
    ctx.lineTo(-5, 11);
    ctx.lineTo(-8, -1);
    ctx.closePath();
    ctx.fillStyle = '#5aa9c0';
    ctx.fill();
    ctx.strokeStyle = '#0a1a24';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,240,230,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(0, 9);
    ctx.stroke();

    // Shoulders
    const armSwing = Math.sin(this.walkPhase) * 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 12.5, -1 + s * armSwing * 0.5, 6.4, 7.4, s * 0.25, 0, TAU);
      shapeStyle(ctx, s * 12.5, -1, 7, '#336e83', { outlineW: 2.4 });
    }

    // Head + helmet
    ctx.beginPath();
    ctx.ellipse(0, -11, 9, 9.6, 0, 0, TAU);
    shapeStyle(ctx, 0, -12, 10, '#4791a9', { lightDir: -Math.PI / 2, rim: 1.0, outlineW: 2.8 });

    // Crown crest — three prongs echoing the trident
    ctx.beginPath();
    ctx.moveTo(-7, -15);
    ctx.lineTo(-5.5, -22);
    ctx.lineTo(-3, -16.5);
    ctx.lineTo(0, -25);
    ctx.lineTo(3, -16.5);
    ctx.lineTo(5.5, -22);
    ctx.lineTo(7, -15);
    ctx.closePath();
    ctx.fillStyle = '#f0c04a';
    ctx.fill();
    ctx.strokeStyle = '#6b4c0c';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Visor
    const pulse = 0.75 + Math.sin(this.visorPulse) * 0.2;
    ctx.save();
    ctx.shadowColor = '#6ff6ff';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = `rgba(140,250,255,${pulse})`;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-6, -14.5, 12, 4.2, 2) : ctx.rect(-6, -14.5, 12, 4.2);
    ctx.fill();
    ctx.restore();
  }

  drawWeapon(ctx) {
    // Trident held at the right side; the swing state rotates it across the arc.
    let ang = 0.35;
    let ext = 0;
    if (this.state === 'attack') {
      const s = this.swingStep;
      const p = this.swingProgress;
      if (p < 0) ang = 0.35 + (1 + p) * 1.5 * -s.sweep;
      else ang = lerp(1.5, -1.5, p) * -s.sweep * 0.9;
      ext = p > 0 ? Math.sin(p * Math.PI) * 6 : 0;
    } else if (this.state === 'special') {
      ang = this.spinAngle * 2;
    } else if (this.state === 'cast') {
      ang = -0.15;
      ext = 4;
    }

    ctx.save();
    ctx.translate(9, 3);
    ctx.rotate(ang);
    ctx.translate(0, -ext);

    // Shaft
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -26);
    ctx.stroke();
    ctx.strokeStyle = '#6a4c2e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-0.7, 10);
    ctx.lineTo(-0.7, -24);
    ctx.stroke();

    // Prongs
    ctx.strokeStyle = '#bfe4f0';
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -26); ctx.lineTo(-6, -37);
    ctx.moveTo(0, -28); ctx.lineTo(0, -41);
    ctx.moveTo(6, -26); ctx.lineTo(6, -37);
    ctx.moveTo(-6, -26); ctx.lineTo(6, -26);
    ctx.stroke();
    ctx.strokeStyle = '#5fd8e8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, -30); ctx.lineTo(6, -30);
    ctx.stroke();
    ctx.restore();
  }

  drawSwingFx(ctx) {
    if (this.state === 'attack' && this.swingProgress > 0) {
      const s = this.swingStep;
      const u = this.swingProgress;
      const half = s.arc / 2;
      const a0 = this.swingAngle + s.sweep * -half;
      const a1 = this.swingAngle + s.sweep * lerp(-half, half, u);
      const fade = 1 - u * 0.45;
      ctx.save();
      ctx.translate(this.x, this.y);
      // Additive so the slash reads as light on a dark floor rather than a grey wedge.
      ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createRadialGradient(0, 0, s.range * 0.3, 0, 0, s.range * 1.05);
      grd.addColorStop(0, 'rgba(40,120,170,0)');
      grd.addColorStop(0.62, `rgba(70,190,235,${0.26 * fade})`);
      grd.addColorStop(0.93, `rgba(170,245,255,${0.5 * fade})`);
      grd.addColorStop(1, `rgba(255,255,255,${0.72 * fade})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (s.sweep > 0) ctx.arc(0, 0, s.range, a0, a1);
      else ctx.arc(0, 0, s.range, a1, a0);
      ctx.closePath();
      ctx.fill();

      // Leading edge: a bright crescent that sells the direction of the swing.
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * fade})`;
      ctx.lineWidth = s.heavy ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s.range * 0.95, a1 - s.sweep * 0.38, a1);
      ctx.stroke();
      ctx.strokeStyle = `rgba(130,235,255,${0.55 * fade})`;
      ctx.lineWidth = s.heavy ? 13 : 9;
      ctx.beginPath();
      ctx.arc(0, 0, s.range * 0.95, a1 - s.sweep * 0.3, a1);
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'special') {
      const s = SPECIAL;
      const radius = s.radius * this.mods.specialRadius;
      if (this.stateT < s.windup) {
        // Telegraph the player's own AoE so the timing is readable.
        const u = this.stateT / s.windup;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = 0.3 + u * 0.4;
        ctx.strokeStyle = '#7fe9ff';
        ctx.lineWidth = 2 + u * 3;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -this.age * 40;
        ctx.beginPath();
        ctx.arc(0, 0, radius * (0.6 + u * 0.4), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (this.stateT < s.windup + s.active) {
        const u = (this.stateT - s.windup) / s.active;
        const r = radius * easeOutQuint(clamp(u * 1.4, 0, 1));
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spinAngle);
        ctx.globalAlpha = (1 - u) * 0.9;
        const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r);
        g.addColorStop(0, 'rgba(130,240,255,0)');
        g.addColorStop(0.8, 'rgba(160,245,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0.75)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.94, (i / 3) * TAU, (i / 3) * TAU + 0.8);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}

function angleLerpSafe(a, b, t) {
  return a + angleDiff(a, b) * clamp(t, 0, 1);
}
