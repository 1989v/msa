// Three bosses, one per biome. Each runs a weighted pattern scheduler with a
// no-immediate-repeat rule, and gains new patterns at phase thresholds. Phase
// transitions are always announced: invulnerable pause, roar, screen flash.

import {
  TAU, clamp, lerp, damp, dist, angleDiff, angleApproach, rng,
  easeOutCubic, easeOutQuint, easeInCubic, inCone, distToSegment,
} from './core.js';
import { addShake, addHitstop, burst, shockwave, emit, rgba, screenFlash, decal, floatText } from './fx.js';
import { Enemy, drawTelegraph, makeEnemy, tierFor } from './enemies.js';
import { Entity, TEAM, Projectile, Hazard, applyDamage } from './entities.js';
import { drawShadow, glowDot, limb, starPath, shapeStyle, organicBlob } from './art.js';
import { sfx, playMusic } from './audio.js';

// ---------------------------------------------------------------- beams

/** Sweeping laser used by 오르카스 and 네레이드. Damage is a segment-distance test. */
export class Beam {
  constructor(opts) {
    Object.assign(this, {
      x: 0, y: 0, angle: 0, len: 1400, width: 26, t: 0,
      warn: 0.7, life: 1.6, rot: 0, damage: 20, color: '#ff5a6a',
      owner: null, tickCd: 0, dead: false, follow: null, growIn: 0.12,
    }, opts);
  }

  update(dt, world) {
    this.t += dt;
    if (this.follow) { this.x = this.follow.x; this.y = this.follow.y; }
    if (this.t > this.warn) this.angle += this.rot * dt;
    if (this.t >= this.warn + this.life) { this.dead = true; return; }
    if (this.t < this.warn) return;

    this.tickCd -= dt;
    if (this.tickCd > 0) return;
    const p = world.player;
    if (!p || p.dead) return;
    const ex = this.x + Math.cos(this.angle) * this.len;
    const ey = this.y + Math.sin(this.angle) * this.len;
    if (distToSegment(p.x, p.y, this.x, this.y, ex, ey) < this.width / 2 + p.r * 0.6) {
      const a = this.angle + Math.PI / 2 * Math.sign(angleDiff(this.angle, Math.atan2(p.y - this.y, p.x - this.x)) || 1);
      p.takeDamage(world, this.damage, { dirX: Math.cos(a), dirY: Math.sin(a) });
      this.tickCd = 0.6;
    }
    if (rng.next() < 0.7) {
      const t = rng.next();
      emit({
        x: lerp(this.x, ex, t), y: lerp(this.y, ey, t),
        vx: rng.range(-40, 40), vy: rng.range(-40, 40),
        life: 0.3, t: 0, r0: rng.range(2, 5), r1: 0,
        color: this.color, kind: 'dot', drag: 3, glow: true,
      });
    }
  }

  draw(ctx) {
    const ex = this.x + Math.cos(this.angle) * this.len;
    const ey = this.y + Math.sin(this.angle) * this.len;
    ctx.save();
    if (this.t < this.warn) {
      const u = this.t / this.warn;
      ctx.globalAlpha = 0.3 + u * 0.45;
      ctx.strokeStyle = rgba(this.color, 0.9);
      ctx.lineWidth = 2 + u * 3;
      ctx.setLineDash([16, 12]);
      ctx.lineDashOffset = -this.t * 90;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = (0.1 + u * 0.2);
      ctx.strokeStyle = rgba(this.color, 0.5);
      ctx.lineWidth = this.width * u;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();
    } else {
      const at = this.t - this.warn;
      const grow = clamp(at / this.growIn, 0, 1);
      const fade = clamp((this.life - at) / 0.2, 0, 1);
      const w = this.width * grow * fade;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(this.color, 0.35);
      ctx.lineWidth = w * 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = rgba(this.color, 0.85);
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = w * 0.35;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------- base

export class Boss extends Enemy {
  constructor(x, y, cfg) {
    super(x, y, cfg);
    this.isBoss = true;
    this.bossId = cfg.bossId;
    this.title = cfg.title;
    this.subtitle = cfg.subtitle;
    this.bossImmuneFreeze = true;
    this.phase = 0;
    this.phaseThresholds = cfg.phaseThresholds || [];
    this.action = null;
    this.actionT = 0;
    this.lastPattern = null;
    this.idleT = 0;
    this.introT = 0;
    this.introDur = 2.0;
    this.aiState = 'intro';
    this.untargetable = true;
    this.transition = 0;
    this.spawnDur = 0;
    this.barOffset = 0;
    this.damageTaken = 1;
  }

  update(dt, world) {
    if (this.aiState === 'intro') {
      this.age += dt;
      this.introT += dt;
      world.controlLocked = this.introT < this.introDur * 0.72;
      if (this.introT >= this.introDur) {
        this.aiState = 'fight';
        this.untargetable = false;
        world.controlLocked = false;
        this.idleT = 0.4;
      }
      return;
    }
    if (this.transition > 0) {
      this.age += dt;
      this.transition -= dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
      this.invuln = 0.1;
      this.brake(dt, 5);
      if (this.transition <= 0) { this.invuln = 0; this.idleT = 0.3; }
      return;
    }
    super.update(dt, world);
    this.checkPhase(world);
  }

  checkPhase(world) {
    const next = this.phaseThresholds[this.phase];
    if (next === undefined) return;
    if (this.hp / this.maxHp > next) return;
    this.phase++;
    this.transition = 1.5;
    this.action = null;
    this.tel = null;
    this.onPhase?.(world, this.phase);
    screenFlash('#ffffff', 0.55, 0.5);
    addShake(1);
    addHitstop(0.3);
    shockwave(this.x, this.y, { r0: 20, r1: 620, life: 1.0, color: rgba(this.tint, 0.9), width: 12 });
    burst(this.x, this.y, 40, {
      speed: [180, 620], life: [0.5, 1.2], r0: [3, 8], r1: 0,
      color: this.tint, color2: '#ffffff', kind: 'shard', spread: TAU, drag: 2.4, glow: true,
    });
    floatText(this.x, this.y - this.r - 60, `${this.title} — ${this.phase + 1}단계`, {
      color: '#ffd34a', size: 28, life: 2.2, rise: 40,
    });
    sfx('phaseShift');
    sfx('bossRoar');
  }

  /** Weighted pattern pick that never repeats the previous one back-to-back. */
  choosePattern(list) {
    const usable = list.filter((p) => p.name !== this.lastPattern);
    const pool = usable.length ? usable : list;
    const pick = rng.weighted(pool);
    this.lastPattern = pick.name;
    return pick.name;
  }

  startAction(name, dur) {
    this.action = name;
    this.actionT = 0;
    this.actionDur = dur;
    this.step = 0;
  }

  endAction(cooldown = 0.7) {
    this.action = null;
    this.tel = null;
    this.idleT = cooldown;
  }
}

// ------------------------------------------ 티데우스 — 산호의 왕 (necropolis)

export class Tideus extends Boss {
  constructor(x, y, t) {
    super(x, y, {
      type: 'boss_tideus', bossId: 'tideus', name: '티데우스',
      title: '티데우스', subtitle: '산호의 왕',
      r: 62, hp: 1500 * t.hp, speed: 92 * t.spd,
      tint: '#ff8fb0', blood: '#ff6f95', mass: 8,
      phaseThresholds: [0.55],
    });
    this.t = t;
    this.clawL = 0; this.clawR = 0;
    this.slamDmg = 30 * t.dmg;
    this.spikeDmg = 24 * t.dmg;
    this.chargeDmg = 32 * t.dmg;
    this.sweepDmg = 28 * t.dmg;
  }

  patternList() {
    const base = [
      { name: 'slam', w: 30 },
      { name: 'spikes', w: 28 },
      { name: 'charge', w: 24 },
    ];
    if (this.phase >= 1) {
      base.push({ name: 'sweep', w: 26 });
      base.push({ name: 'summon', w: 16 });
    }
    return base;
  }

  onPhase(world) {
    // Shed a ring of coral spikes as the transition payoff.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      world.projectiles.push(new Projectile({
        x: this.x + Math.cos(a) * 40, y: this.y + Math.sin(a) * 40,
        r: 10, team: TEAM.ENEMY, damage: this.spikeDmg * 0.6, speed: 290,
        angle: a, life: 2.6, kind: 'shard', color: '#ff8fb0', color2: '#ffd6e2', spin: 5,
      }));
    }
    this.speed *= 1.28;
  }

  think(dt, world) {
    const p = world.player;
    const speedUp = this.phase >= 1 ? 1.25 : 1;

    if (!this.action) {
      this.idleT -= dt;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d > 200) this.moveToward(dt, p.x, p.y, 0.9 * speedUp, 3);
      else this.brake(dt, 5);
      if (this.idleT <= 0) {
        const name = this.choosePattern(this.patternList());
        this.startAction(name, 0);
        if (name === 'slam') this.beginSlam(world, p);
        else if (name === 'spikes') this.beginSpikes(world, p);
        else if (name === 'charge') this.beginCharge(world, p);
        else if (name === 'sweep') this.beginSweep(world, p);
        else if (name === 'summon') this.beginSummon(world);
      }
      return;
    }

    this.actionT += dt;
    switch (this.action) {
      case 'slam': this.updSlam(dt, world, p); break;
      case 'spikes': this.updSpikes(dt, world, p); break;
      case 'charge': this.updCharge(dt, world, p); break;
      case 'sweep': this.updSweep(dt, world, p); break;
      case 'summon': this.updSummon(dt, world, p); break;
    }
  }

  // --- 집게 내려찍기: three expanding rings
  beginSlam(world, p) {
    this.startTelegraph('circle', { dur: 0.95, r: 150, color: '#ff6a7a', x: p.x, y: p.y });
    this.slamX = p.x; this.slamY = p.y;
    this.rings = 0;
  }
  updSlam(dt, world, p) {
    if (this.actionT < 0.95) {
      this.clawR = lerp(0, -1.2, this.actionT / 0.95);
      this.moveToward(dt, this.slamX, this.slamY, 0.55, 3);
      // Keep the marker glued to where the claw will land.
      this.tel.x = this.slamX; this.tel.y = this.slamY;
      return;
    }
    if (this.rings === 0) {
      this.tel = null;
      this.clawR = 0.5;
      addShake(0.8);
      sfx('slam');
      shockwave(this.slamX, this.slamY, {
        r0: 20, r1: 150, life: 0.4, color: 'rgba(255,140,170,0.95)', width: 10,
        fill: 'rgba(255,110,150,0.24)', squash: 0.66,
      });
      burst(this.slamX, this.slamY, 26, {
        speed: [160, 460], life: [0.3, 0.7], r0: [3, 7], r1: 0,
        color: '#ff8fb0', color2: '#ffd6e2', kind: 'shard', spread: TAU, drag: 3, grav: 260,
      });
      decal(this.slamX, this.slamY, 60, '#8e3a55', 12);
      if (dist(this.slamX, this.slamY, p.x, p.y) < 150 + p.r * 0.4) {
        const a = Math.atan2(p.y - this.slamY, p.x - this.slamX);
        p.takeDamage(world, this.slamDmg, { dirX: Math.cos(a), dirY: Math.sin(a) });
      }
      this.rings = 1;
    }
    // Follow-up expanding rings the player must dash through.
    const ringCount = this.phase >= 1 ? 3 : 2;
    const want = Math.floor((this.actionT - 0.95) / 0.42) + 1;
    while (this.rings < want && this.rings <= ringCount) {
      const r = 150 + this.rings * 130;
      world.rings.push({
        x: this.slamX, y: this.slamY, r0: r - 120, r: r, t: 0, life: 0.55,
        damage: this.slamDmg * 0.6, color: '#ff8fb0', hit: false, width: 34,
      });
      sfx('explode', 0.6);
      addShake(0.3);
      this.rings++;
    }
    this.clawR = damp(this.clawR, 0, 6, dt);
    if (this.actionT > 0.95 + ringCount * 0.42 + 0.4) this.endAction(this.phase >= 1 ? 0.55 : 0.9);
  }

  // --- 산호 가시 벽: spike lines radiating from the boss
  beginSpikes(world, p) {
    this.spikeBase = Math.atan2(p.y - this.y, p.x - this.x);
    this.spikeLines = this.phase >= 1 ? 5 : 3;
    this.spikeDone = 0;
    this.tels = [];
    for (let i = 0; i < this.spikeLines; i++) {
      const a = this.spikeBase + (i - (this.spikeLines - 1) / 2) * 0.55;
      this.tels.push({ kind: 'line', t: 0, dur: 0.9, x: this.x, y: this.y, angle: a, range: 620, width: 54, color: '#ff9ec0' });
    }
    sfx('telegraph');
  }
  updSpikes(dt, world, p) {
    this.brake(dt, 6);
    for (const t of this.tels) { t.t += dt; t.x = this.x; t.y = this.y; }
    if (this.actionT >= 0.9 && this.spikeDone === 0) {
      this.spikeDone = 1;
      this.tels = [];
      for (let i = 0; i < this.spikeLines; i++) {
        const a = this.spikeBase + (i - (this.spikeLines - 1) / 2) * 0.55;
        for (let k = 1; k <= 8; k++) {
          const sx = this.x + Math.cos(a) * (70 + k * 68);
          const sy = this.y + Math.sin(a) * (70 + k * 68);
          world.spikes.push({
            x: sx, y: sy, t: -k * 0.045, life: 1.0, r: 34,
            damage: this.spikeDmg, hit: false, color: '#ff9ec0',
          });
        }
      }
      sfx('slam');
      addShake(0.5);
    }
    if (this.actionT > 1.9) this.endAction(0.8);
  }

  // --- 돌진
  beginCharge(world, p) {
    this.chargeAngle = Math.atan2(p.y - this.y, p.x - this.x);
    this.startTelegraph('line', { dur: 0.85, angle: this.chargeAngle, range: 700, width: 110, color: '#ff6a7a', follow: true });
    this.chargeHit = false;
  }
  updCharge(dt, world, p) {
    if (this.actionT < 0.85) {
      this.brake(dt, 8);
      this.chargeAngle = angleApproach(this.chargeAngle, Math.atan2(p.y - this.y, p.x - this.x), dt * 1.1);
      this.tel.angle = this.chargeAngle;
      this.facing = this.chargeAngle;
      return;
    }
    if (this.tel) {
      this.tel = null;
      this.vx = Math.cos(this.chargeAngle) * 900;
      this.vy = Math.sin(this.chargeAngle) * 900;
      sfx('bossRoar');
      addShake(0.5);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const dr = Math.exp(-2.2 * dt);
    this.vx *= dr; this.vy *= dr;
    if (rng.next() < 0.8) {
      burst(this.x, this.y, 2, {
        speed: [40, 160], life: [0.2, 0.5], r0: [3, 7], r1: 0,
        color: '#ff8fb0', kind: 'dot', spread: 2, dir: this.chargeAngle + Math.PI, drag: 3,
      });
    }
    if (!this.chargeHit && dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
      this.chargeHit = true;
      p.takeDamage(world, this.chargeDmg, { dirX: Math.cos(this.chargeAngle), dirY: Math.sin(this.chargeAngle) });
    }
    // Slam into the arena wall for a stagger window.
    const hitWall = !world.room.contains(this.x + Math.cos(this.chargeAngle) * this.r, this.y + Math.sin(this.chargeAngle) * this.r, 0);
    if (this.actionT > 1.6 || (hitWall && this.actionT > 0.95)) {
      if (hitWall) {
        addShake(0.9);
        sfx('slam');
        shockwave(this.x, this.y, { r0: 20, r1: 220, life: 0.5, color: 'rgba(255,140,170,0.9)', width: 9 });
        this.stagger = 1.2;
      }
      this.endAction(hitWall ? 1.4 : 0.8);
    }
  }

  // --- 회전 스윕 (phase 2)
  beginSweep(world, p) {
    this.sweepAngle = Math.atan2(p.y - this.y, p.x - this.x) - 2.0;
    this.startTelegraph('cone', { dur: 0.7, angle: this.sweepAngle, half: 0.6, range: 230, color: '#ffb44a', follow: true });
    this.sweepHits = new Set();
  }
  updSweep(dt, world, p) {
    if (this.actionT < 0.7) { this.brake(dt, 7); return; }
    if (this.tel) { this.tel = null; sfx('swing', 0, 1.6); }
    const u = clamp((this.actionT - 0.7) / 0.85, 0, 1);
    const a = this.sweepAngle + u * 4.0;
    this.facing = a;
    this.clawL = Math.sin(u * Math.PI) * -1.4;
    const tipX = this.x + Math.cos(a) * 150;
    const tipY = this.y + Math.sin(a) * 150;
    shockwave(tipX, tipY, { r0: 4, r1: 26, life: 0.22, color: 'rgba(255,180,120,0.6)', width: 3 });
    if (!this.sweepHits.has('p') && inCone(this.x, this.y, a, 0.5, 230 + p.r, p.x, p.y)) {
      this.sweepHits.add('p');
      p.takeDamage(world, this.sweepDmg, { dirX: Math.cos(a), dirY: Math.sin(a) });
    }
    if (u >= 1) { this.clawL = 0; this.endAction(0.8); }
  }

  // --- 소환 (phase 2)
  beginSummon(world) {
    this.startTelegraph('ring', { dur: 0.9, r: 150, color: '#ff8fb0', follow: true });
    this.summoned = false;
  }
  updSummon(dt, world, p) {
    this.brake(dt, 6);
    if (this.actionT >= 0.9 && !this.summoned) {
      this.summoned = true;
      this.tel = null;
      const tier = tierFor(0, 5);
      for (let i = 0; i < 2; i++) {
        const a = rng.angle();
        const e = makeEnemy(rng.bool(0.6) ? 'crawler' : 'drifter',
          this.x + Math.cos(a) * 130, this.y + Math.sin(a) * 130, tier);
        if (e) world.enemies.push(e);
      }
      shockwave(this.x, this.y, { r0: 20, r1: 190, life: 0.5, color: 'rgba(255,143,176,0.9)', width: 7 });
      sfx('bossRoar');
      addShake(0.4);
    }
    if (this.actionT > 1.5) this.endAction(0.7);
  }

  drawBody(ctx, world) {
    const introScale = this.aiState === 'intro' ? easeOutCubic(clamp(this.introT / 0.8, 0, 1)) : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(introScale * 1.2, introScale * 1.2);
    ctx.rotate(this.facing);

    // Legs
    ctx.strokeStyle = '#6e2a40';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const base = -20 + i * 18;
        const k = Math.sin(this.age * 4 + i * 1.2) * 8 * s;
        ctx.beginPath();
        ctx.moveTo(base, s * 22);
        ctx.lineTo(base - 12, s * (44 + k * 0.3));
        ctx.lineTo(base + 8, s * (62 + k * 0.5));
        ctx.stroke();
      }
    }

    // Shell
    organicBlob(ctx, 0, 0, 48, this.seed, this.age * 0.3, 11, 0.1);
    shapeStyle(ctx, 0, -14, 50, '#b8425f', { lightDir: -Math.PI / 2.2, rim: 0.7, outlineW: 4.5 });

    // Coral crown on the shell
    ctx.strokeStyle = 'rgba(255,190,210,0.85)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + this.seed;
      const r0 = 30, r1 = 46 + Math.sin(this.age * 2 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.quadraticCurveTo(Math.cos(a) * r1 * 0.8 + 6, Math.sin(a) * r1 * 0.8, Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    if (this.phase >= 1) {
      // Cracked shell + molten glow once enraged.
      ctx.strokeStyle = '#ffea9a';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = this.seed + i * 1.9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
        ctx.lineTo(Math.cos(a + 0.4) * 34, Math.sin(a + 0.4) * 34);
        ctx.stroke();
      }
      glowDot(ctx, 0, 0, 60, '#ff5a7a', 0.35);
    }

    // Eyes on stalks
    for (const s of [-1, 1]) {
      ctx.strokeStyle = '#8e3a55'; ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(26, s * 12); ctx.lineTo(44, s * 16);
      ctx.stroke();
      glowDot(ctx, 46, s * 17, 16, this.phase >= 1 ? '#ff5a4a' : '#ffe27a', 1);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(46, s * 17, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a0a14';
      ctx.beginPath(); ctx.arc(47.5, s * 17, 3, 0, TAU); ctx.fill();
    }

    // Claws last: they lead the attacks, so they must read in front of the shell.
    const claws = [{ s: -1, a: this.clawL }, { s: 1, a: this.clawR }];
    for (const c of claws) {
      ctx.save();
      ctx.translate(52, c.s * 44);
      ctx.rotate(c.a * c.s + c.s * 0.32);
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 22, 0, 0, TAU);
      shapeStyle(ctx, 0, -8, 30, '#d4587a', { outlineW: 3.8 });
      const gape = 6 + Math.abs(c.a) * 12;
      ctx.fillStyle = '#f3a0b8';
      ctx.beginPath();
      ctx.moveTo(20, -6); ctx.lineTo(56, c.s * -10 - gape); ctx.lineTo(22, 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a1526'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, 8); ctx.lineTo(50, c.s * 18 + gape); ctx.lineTo(18, 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

// -------------------------------------------- 오르카스 — 심연 감시자 (bastion)

export class Orcas extends Boss {
  constructor(x, y, t) {
    super(x, y, {
      type: 'boss_orcas', bossId: 'orcas', name: '오르카스',
      title: '오르카스', subtitle: '심연의 감시자',
      r: 50, hp: 2050 * t.hp, speed: 96 * t.spd,
      tint: '#7fb2ff', blood: '#3d6fa8', mass: 8,
      phaseThresholds: [0.5],
    });
    this.t = t;
    this.eyeOpen = 0;
    this.beamDmg = 26 * t.dmg;
    this.orbDmg = 16 * t.dmg;
    this.ramDmg = 30 * t.dmg;
    this.ringSpin = 0;
  }

  patternList() {
    const base = [
      { name: 'sweep', w: 30 },
      { name: 'orbs', w: 28 },
      { name: 'ram', w: 22 },
    ];
    if (this.phase >= 1) {
      base.push({ name: 'cross', w: 30 });
      base.push({ name: 'grid', w: 20 });
    }
    return base;
  }

  onPhase(world) {
    this.speed *= 1.3;
    for (let i = 0; i < 3; i++) {
      world.beams.push(new Beam({
        x: this.x, y: this.y, angle: (i / 3) * TAU, len: 1500, width: 30,
        warn: 0.9, life: 1.2, rot: 1.1, damage: this.beamDmg, color: '#7fb2ff', follow: this,
      }));
    }
  }

  think(dt, world) {
    const p = world.player;
    this.ringSpin += dt * (this.action ? 3 : 1.2);
    this.eyeOpen = damp(this.eyeOpen, this.action ? 1 : 0.55, 5, dt);

    if (!this.action) {
      this.idleT -= dt;
      this.strafeAround(dt, p.x, p.y, 300, this.dirSign || (this.dirSign = rng.sign()), 0.9);
      if (this.idleT <= 0) {
        const name = this.choosePattern(this.patternList());
        this.startAction(name, 0);
        if (name === 'sweep') this.beginSweep(world, p);
        else if (name === 'orbs') this.beginOrbs(world, p);
        else if (name === 'ram') this.beginRam(world, p);
        else if (name === 'cross') this.beginCross(world, p);
        else if (name === 'grid') this.beginGrid(world, p);
      }
      return;
    }
    this.actionT += dt;
    switch (this.action) {
      case 'sweep': this.updSweep(dt, world, p); break;
      case 'orbs': this.updOrbs(dt, world, p); break;
      case 'ram': this.updRam(dt, world, p); break;
      case 'cross': this.updCross(dt, world, p); break;
      case 'grid': this.updGrid(dt, world, p); break;
    }
  }

  // --- 레이저 스윕
  beginSweep(world, p) {
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const dir = rng.sign();
    world.beams.push(new Beam({
      x: this.x, y: this.y, angle: a - dir * 1.0, len: 1500, width: 32,
      warn: 0.85, life: 1.7, rot: dir * 1.25, damage: this.beamDmg,
      color: '#7fb2ff', follow: this,
    }));
    sfx('laser');
  }
  updSweep(dt, world, p) {
    this.brake(dt, 4);
    this.facing = angleApproach(this.facing, Math.atan2(p.y - this.y, p.x - this.x), dt * 2);
    if (this.actionT > 2.7) this.endAction(0.85);
  }

  // --- 유도 구체
  beginOrbs(world, p) {
    this.startTelegraph('ring', { dur: 0.7, r: 70, color: '#8fd8ff', follow: true });
    this.orbsFired = 0;
  }
  updOrbs(dt, world, p) {
    this.strafeAround(dt, p.x, p.y, 320, 1, 0.5);
    const n = this.phase >= 1 ? 5 : 3;
    if (this.actionT >= 0.7) {
      this.tel = null;
      const want = Math.floor((this.actionT - 0.7) / 0.16);
      while (this.orbsFired < want && this.orbsFired < n) {
        const a = Math.atan2(p.y - this.y, p.x - this.x) + (this.orbsFired - (n - 1) / 2) * 0.42;
        world.projectiles.push(new Projectile({
          x: this.x + Math.cos(a) * 40, y: this.y + Math.sin(a) * 40,
          r: 11, team: TEAM.ENEMY, damage: this.orbDmg, speed: 235,
          angle: a, life: 4.2, kind: 'orb', color: '#8fd8ff', color2: '#e6f7ff',
          homing: 1.5, knockback: 110, trail: 1,
        }));
        sfx('enemyShoot');
        this.orbsFired++;
      }
    }
    if (this.orbsFired >= n && this.actionT > 0.7 + n * 0.16 + 0.3) this.endAction(0.7);
  }

  // --- 돌진
  beginRam(world, p) {
    this.ramAngle = Math.atan2(p.y - this.y, p.x - this.x);
    this.startTelegraph('line', { dur: 0.8, angle: this.ramAngle, range: 760, width: 100, color: '#6aa8ff', follow: true });
    this.ramHit = false;
  }
  updRam(dt, world, p) {
    if (this.actionT < 0.8) {
      this.brake(dt, 8);
      this.ramAngle = angleApproach(this.ramAngle, Math.atan2(p.y - this.y, p.x - this.x), dt * 1.3);
      this.tel.angle = this.ramAngle;
      this.facing = this.ramAngle;
      return;
    }
    if (this.tel) {
      this.tel = null;
      this.vx = Math.cos(this.ramAngle) * 980;
      this.vy = Math.sin(this.ramAngle) * 980;
      sfx('bossRoar');
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const dr = Math.exp(-2.4 * dt);
    this.vx *= dr; this.vy *= dr;
    if (!this.ramHit && dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
      this.ramHit = true;
      p.takeDamage(world, this.ramDmg, { dirX: Math.cos(this.ramAngle), dirY: Math.sin(this.ramAngle) });
    }
    // Drop mines along the charge path in phase 2.
    if (this.phase >= 1 && this.actionT % 0.12 < dt) {
      world.hazards.push(new Hazard({
        x: this.x, y: this.y, r: 46, life: 2.6, dps: 22 * this.t.dmg,
        color: '#6aa8ff', color2: '#cfe6ff', team: TEAM.ENEMY,
      }));
    }
    if (this.actionT > 1.7) this.endAction(0.9);
  }

  // --- 십자 레이저 (phase 2)
  beginCross(world, p) {
    const base = Math.atan2(p.y - this.y, p.x - this.x) + rng.range(-0.4, 0.4);
    const dir = rng.sign();
    for (let i = 0; i < 4; i++) {
      world.beams.push(new Beam({
        x: this.x, y: this.y, angle: base + (i / 4) * TAU, len: 1500, width: 26,
        warn: 1.0, life: 2.2, rot: dir * 0.62, damage: this.beamDmg,
        color: '#a08fff', follow: this,
      }));
    }
    sfx('laser');
  }
  updCross(dt, world, p) {
    this.brake(dt, 3);
    if (this.actionT > 3.3) this.endAction(1.0);
  }

  // --- 격자 폭격 (phase 2)
  beginGrid(world, p) {
    this.gridCells = [];
    const room = world.room;
    const cols = 5, rows = 3;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (rng.next() < 0.42) continue;
        this.gridCells.push({
          x: room.cx + (i - (cols - 1) / 2) * (room.w / cols) * 0.86,
          y: room.cy + (j - (rows - 1) / 2) * (room.h / rows) * 0.82,
          delay: rng.range(0, 0.6), fired: false,
        });
      }
    }
    this.tels = this.gridCells.map((c) => ({
      kind: 'circle', t: 0, dur: 0.95 + c.delay, x: c.x, y: c.y, r: 96, color: '#8fd8ff',
    }));
  }
  updGrid(dt, world, p) {
    this.brake(dt, 4);
    for (const t of this.tels) t.t += dt;
    for (let i = 0; i < this.gridCells.length; i++) {
      const c = this.gridCells[i];
      if (c.fired || this.actionT < 0.95 + c.delay) continue;
      c.fired = true;
      shockwave(c.x, c.y, {
        r0: 14, r1: 100, life: 0.4, color: 'rgba(143,216,255,0.95)', width: 8,
        fill: 'rgba(90,160,255,0.22)', squash: 0.66,
      });
      burst(c.x, c.y, 16, {
        speed: [140, 380], life: [0.25, 0.6], r0: [2, 6], r1: 0,
        color: '#8fd8ff', color2: '#ffffff', kind: 'spark', spread: TAU, drag: 4, glow: true,
      });
      addShake(0.2);
      sfx('explode', 0.6);
      if (dist(c.x, c.y, p.x, p.y) < 100 + p.r * 0.5) {
        const a = Math.atan2(p.y - c.y, p.x - c.x);
        p.takeDamage(world, this.beamDmg * 0.8, { dirX: Math.cos(a), dirY: Math.sin(a) });
      }
    }
    if (this.actionT > 2.1) { this.tels = []; this.endAction(0.9); }
  }

  drawBody(ctx, world) {
    const introScale = this.aiState === 'intro' ? easeOutCubic(clamp(this.introT / 0.8, 0, 1)) : 1;
    const hover = Math.sin(this.age * 1.6) * 7;
    ctx.save();
    ctx.translate(this.x, this.y + hover);
    ctx.scale(introScale, introScale);

    // Outer guardian rings
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.rotate(this.ringSpin * (k ? -0.6 : 1));
      const rr = 66 + k * 14;
      ctx.strokeStyle = k ? '#4a5f7d' : '#6d829c';
      ctx.lineWidth = k ? 5 : 7;
      ctx.setLineDash([26, 16]);
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        ctx.save();
        ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
        ctx.rotate(a);
        ctx.fillStyle = this.phase >= 1 ? '#a08fff' : '#8fd8ff';
        starPath(ctx, 0, 0, 4, 11, 4, 0);
        ctx.fill();
        ctx.strokeStyle = '#0c1420'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.rotate(this.facing);

    // Fins
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * 0.5 + Math.sin(this.age * 2) * 0.06 * s);
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-48, s * 30, -66, s * 12);
      ctx.quadraticCurveTo(-46, s * 8, -10, 0);
      ctx.closePath();
      ctx.fillStyle = '#40597a'; ctx.fill();
      ctx.strokeStyle = '#0b131f'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }

    // Shell body
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 40, 0, 0, TAU);
    shapeStyle(ctx, -8, -14, 48, '#54759b', { lightDir: -Math.PI / 2.2, rim: 0.9, outlineW: 4.5 });
    // Plating
    ctx.strokeStyle = '#2e4462'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 15, 0, 8, 34, 0, 0, TAU);
      ctx.stroke();
    }
    // Rust
    ctx.fillStyle = 'rgba(150,90,40,0.3)';
    ctx.beginPath(); ctx.ellipse(-16, 14, 14, 9, 0.4, 0, TAU); ctx.fill();

    // Giant central eye
    const open = this.eyeOpen;
    ctx.save();
    ctx.translate(14, 0);
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 27 * open + 3, 0, 0, TAU);
    ctx.fillStyle = '#e8f4ff'; ctx.fill();
    ctx.strokeStyle = '#0b131f'; ctx.lineWidth = 4; ctx.stroke();
    const irisColor = this.phase >= 1 ? '#a08fff' : '#4fa8ff';
    glowDot(ctx, 6, 0, 30, irisColor, 0.9 * open);
    ctx.fillStyle = irisColor;
    ctx.beginPath(); ctx.ellipse(6, 0, 13, 13 * open + 1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#06101c';
    ctx.beginPath(); ctx.ellipse(7, 0, 6, 12 * open + 1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(0, -8 * open, 4.5, 0, TAU); ctx.fill();
    ctx.restore();

    // Secondary eyes appear in phase 2
    if (this.phase >= 1) {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(-6, s * 28);
        glowDot(ctx, 0, 0, 16, '#a08fff', 0.9);
        ctx.fillStyle = '#e8f4ff';
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, s * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#a08fff';
        ctx.beginPath(); ctx.arc(2, 0, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#06101c';
        ctx.beginPath(); ctx.arc(2.5, 0, 2.4, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

// --------------------------------------- 네레이드 — 심연의 왕관 (throne, 최종)

export class Nereid extends Boss {
  constructor(x, y, t) {
    super(x, y, {
      type: 'boss_nereid', bossId: 'nereid', name: '네레이드',
      title: '네레이드', subtitle: '심연의 왕관',
      r: 46, hp: 2700 * t.hp, speed: 118 * t.spd,
      tint: '#f5c542', blood: '#c58cff', mass: 7,
      phaseThresholds: [0.66, 0.33],
    });
    this.t = t;
    this.introDur = 2.4;
    this.shotDmg = 15 * t.dmg;
    this.slamDmg = 30 * t.dmg;
    this.beamDmg = 26 * t.dmg;
    this.crownSpin = 0;
    this.hover = 0;
    this.crowns = [];
  }

  patternList() {
    const base = [
      { name: 'radial', w: 28 },
      { name: 'tendrils', w: 26 },
    ];
    if (this.phase >= 1) {
      base.push({ name: 'blink', w: 28 });
      base.push({ name: 'crown', w: 22 });
    }
    if (this.phase >= 2) {
      base.push({ name: 'nova', w: 26 });
      base.push({ name: 'beams', w: 24 });
    }
    return base;
  }

  onPhase(world, phase) {
    this.speed *= 1.2;
    if (phase === 1) {
      for (let i = 0; i < 3; i++) this.crowns.push({ a: (i / 3) * TAU, r: 96, hp: 1 });
    }
    if (phase === 2) {
      // Final phase: the arena floor itself becomes hostile at the edges.
      world.arenaHazard = true;
      screenFlash('#f5c542', 0.6, 0.9);
      while (this.crowns.length < 6) this.crowns.push({ a: rng.angle(), r: 96 + rng.range(-14, 14), hp: 1 });
    }
  }

  think(dt, world) {
    const p = world.player;
    this.crownSpin += dt * (1.4 + this.phase * 0.5);
    this.hover += dt;

    // Orbiting crown shards damage on contact once phase 2 begins.
    for (const c of this.crowns) {
      const a = this.crownSpin * (c.dirSign || 1) + c.a;
      c.x = this.x + Math.cos(a) * c.r;
      c.y = this.y + Math.sin(a) * c.r;
      c.cd = Math.max(0, (c.cd || 0) - dt);
      if (c.cd <= 0 && dist(c.x, c.y, p.x, p.y) < 20 + p.r) {
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        p.takeDamage(world, this.shotDmg, { dirX: Math.cos(ang), dirY: Math.sin(ang) });
        c.cd = 1.0;
      }
    }

    if (!this.action) {
      this.idleT -= dt;
      this.strafeAround(dt, p.x, p.y, 280, this.dirSign || (this.dirSign = rng.sign()), 0.85);
      if (this.idleT <= 0) {
        const name = this.choosePattern(this.patternList());
        this.startAction(name, 0);
        if (name === 'radial') this.beginRadial(world, p);
        else if (name === 'tendrils') this.beginTendrils(world, p);
        else if (name === 'blink') this.beginBlink(world, p);
        else if (name === 'crown') this.beginCrown(world, p);
        else if (name === 'nova') this.beginNova(world, p);
        else if (name === 'beams') this.beginBeams(world, p);
      }
      return;
    }
    this.actionT += dt;
    switch (this.action) {
      case 'radial': this.updRadial(dt, world, p); break;
      case 'tendrils': this.updTendrils(dt, world, p); break;
      case 'blink': this.updBlink(dt, world, p); break;
      case 'crown': this.updCrown(dt, world, p); break;
      case 'nova': this.updNova(dt, world, p); break;
      case 'beams': this.updBeams(dt, world, p); break;
    }
  }

  // --- 방사형 탄막
  beginRadial(world, p) {
    this.startTelegraph('ring', { dur: 0.65, r: 84, color: '#f5c542', follow: true });
    this.waves = 0;
    this.radBase = rng.angle();
  }
  updRadial(dt, world, p) {
    this.brake(dt, 5);
    const total = this.phase >= 2 ? 5 : this.phase >= 1 ? 4 : 3;
    if (this.actionT >= 0.65) {
      this.tel = null;
      const want = Math.floor((this.actionT - 0.65) / 0.28);
      while (this.waves < want && this.waves < total) {
        const n = 12 + this.phase * 2;
        // Alternating offset creates a weaving safe lane rather than a wall.
        const off = this.radBase + this.waves * (Math.PI / n);
        for (let i = 0; i < n; i++) {
          world.projectiles.push(new Projectile({
            x: this.x, y: this.y, r: 8, team: TEAM.ENEMY, damage: this.shotDmg,
            speed: 260 + this.waves * 12, angle: off + (i / n) * TAU, life: 4,
            kind: 'orb', color: '#f5c542', color2: '#fff2c0', knockback: 80,
          }));
        }
        sfx('enemyShoot');
        this.waves++;
      }
    }
    if (this.waves >= total && this.actionT > 0.65 + total * 0.28 + 0.25) this.endAction(0.7);
  }

  // --- 촉수 슬램
  beginTendrils(world, p) {
    const n = this.phase >= 1 ? 4 : 3;
    this.tendrilSpots = [];
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(p.y - this.y, p.x - this.x) + (i - (n - 1) / 2) * 0.7;
      const d = 180 + i * 40;
      const sp = world.room.clampedPoint(p.x + Math.cos(a) * rng.range(-90, 90), p.y + Math.sin(a) * rng.range(-90, 90), 70);
      this.tendrilSpots.push({ x: sp.x, y: sp.y, delay: i * 0.18, fired: false });
    }
    this.tels = this.tendrilSpots.map((s) => ({
      kind: 'circle', t: 0, dur: 0.85 + s.delay, x: s.x, y: s.y, r: 88, color: '#c58cff',
    }));
  }
  updTendrils(dt, world, p) {
    this.brake(dt, 5);
    for (const t of this.tels) t.t += dt;
    for (const s of this.tendrilSpots) {
      if (s.fired || this.actionT < 0.85 + s.delay) continue;
      s.fired = true;
      world.tendrilFx.push({ x: s.x, y: s.y, t: 0, life: 0.7 });
      shockwave(s.x, s.y, {
        r0: 14, r1: 92, life: 0.4, color: 'rgba(197,140,255,0.95)', width: 8,
        fill: 'rgba(122,79,176,0.24)', squash: 0.66,
      });
      burst(s.x, s.y, 18, {
        speed: [140, 380], life: [0.25, 0.6], r0: [2, 6], r1: 0,
        color: '#c58cff', color2: '#f0e0ff', kind: 'shard', spread: TAU, drag: 4,
      });
      addShake(0.3);
      sfx('slam');
      if (dist(s.x, s.y, p.x, p.y) < 92 + p.r * 0.5) {
        const a = Math.atan2(p.y - s.y, p.x - s.x);
        p.takeDamage(world, this.slamDmg, { dirX: Math.cos(a), dirY: Math.sin(a) });
      }
    }
    if (this.actionT > 2.2) { this.tels = []; this.endAction(0.7); }
  }

  // --- 순간이동 추격 (phase 2)
  beginBlink(world, p) {
    this.blinkCount = 0;
    this.untargetable = true;
    this.blinkPhase = 'out';
    burst(this.x, this.y, 20, {
      speed: [60, 240], life: [0.3, 0.7], r0: [3, 7], r1: 0,
      color: '#f5c542', kind: 'spark', spread: TAU, drag: 4, glow: true,
    });
    sfx('dash');
  }
  updBlink(dt, world, p) {
    const total = 3;
    const step = 0.62;
    const idx = Math.floor(this.actionT / step);
    if (idx > this.blinkCount && this.blinkCount < total) {
      this.blinkCount = idx;
      const a = rng.angle();
      const sp = world.room.clampedPoint(p.x + Math.cos(a) * 190, p.y + Math.sin(a) * 190, 80);
      this.x = sp.x; this.y = sp.y;
      this.untargetable = false;
      shockwave(this.x, this.y, { r0: 8, r1: 120, life: 0.4, color: 'rgba(245,197,66,0.9)', width: 6 });
      burst(this.x, this.y, 18, {
        speed: [80, 300], life: [0.25, 0.6], r0: [2, 6], r1: 0,
        color: '#f5c542', color2: '#fff2c0', kind: 'spark', spread: TAU, drag: 4, glow: true,
      });
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = -2; i <= 2; i++) {
        world.projectiles.push(new Projectile({
          x: this.x, y: this.y, r: 8, team: TEAM.ENEMY, damage: this.shotDmg,
          speed: 340, angle: base + i * 0.16, life: 3, kind: 'bolt',
          color: '#f5c542', color2: '#fff2c0', knockback: 90,
        }));
      }
      sfx('enemyShoot');
    }
    this.brake(dt, 6);
    if (this.actionT > total * step + 0.4) { this.untargetable = false; this.endAction(0.75); }
  }

  // --- 왕관 소환 (phase 2)
  beginCrown(world, p) {
    this.startTelegraph('ring', { dur: 0.9, r: 120, color: '#ffd34a', follow: true });
    this.crownSummoned = false;
  }
  updCrown(dt, world, p) {
    this.brake(dt, 5);
    if (this.actionT >= 0.9 && !this.crownSummoned) {
      this.crownSummoned = true;
      this.tel = null;
      // Capped: an unbounded orbit turns the arena into an unreadable ring of gold.
      for (let i = 0; i < 2 && this.crowns.length < 6; i++) {
        this.crowns.push({ a: rng.angle(), r: 96 + rng.range(-16, 16), dirSign: rng.sign() });
      }
      const tier = tierFor(2, 3);
      const e = makeEnemy('shard', this.x + rng.range(-120, 120), this.y + rng.range(-120, 120), tier);
      if (e) world.enemies.push(e);
      shockwave(this.x, this.y, { r0: 20, r1: 240, life: 0.6, color: 'rgba(255,211,74,0.9)', width: 8 });
      sfx('bossRoar');
      addShake(0.5);
    }
    if (this.actionT > 1.6) this.endAction(0.7);
  }

  // --- 심연 노바 (phase 3)
  beginNova(world, p) {
    this.startTelegraph('circle', { dur: 1.2, r: 260, color: '#ff5a6a', follow: true });
    this.novaDone = false;
  }
  updNova(dt, world, p) {
    this.brake(dt, 4);
    if (this.actionT >= 1.2 && !this.novaDone) {
      this.novaDone = true;
      this.tel = null;
      shockwave(this.x, this.y, {
        r0: 30, r1: 280, life: 0.5, color: 'rgba(255,90,106,0.95)', width: 14,
        fill: 'rgba(255,90,106,0.22)',
      });
      burst(this.x, this.y, 36, {
        speed: [220, 640], life: [0.3, 0.8], r0: [3, 8], r1: 0,
        color: '#ff5a6a', color2: '#ffd34a', kind: 'spark', spread: TAU, drag: 3, glow: true,
      });
      addShake(0.9);
      screenFlash('#ff5a6a', 0.35, 0.4);
      sfx('explode', 1.4);
      if (dist(this.x, this.y, p.x, p.y) < 280 + p.r * 0.4) {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        p.takeDamage(world, this.slamDmg * 1.15, { dirX: Math.cos(a), dirY: Math.sin(a) });
      }
      // Outward ring the player must escape.
      world.rings.push({
        x: this.x, y: this.y, r0: 40, r: 620, t: 0, life: 1.1,
        damage: this.shotDmg * 1.4, color: '#ff5a6a', hit: false, width: 46,
      });
    }
    if (this.actionT > 2.1) this.endAction(0.9);
  }

  // --- 왕관 광선 (phase 3)
  beginBeams(world, p) {
    const base = Math.atan2(p.y - this.y, p.x - this.x);
    const dir = rng.sign();
    for (let i = 0; i < 6; i++) {
      world.beams.push(new Beam({
        x: this.x, y: this.y, angle: base + (i / 6) * TAU, len: 1500, width: 22,
        warn: 1.0, life: 2.0, rot: dir * 0.5, damage: this.beamDmg,
        color: '#f5c542', follow: this,
      }));
    }
    sfx('laser');
  }
  updBeams(dt, world, p) {
    this.strafeAround(dt, p.x, p.y, 300, this.dirSign, 0.4);
    if (this.actionT > 3.1) this.endAction(1.0);
  }

  drawBody(ctx, world) {
    const introScale = this.aiState === 'intro' ? easeOutCubic(clamp(this.introT / 1.0, 0, 1)) : 1;
    const hover = Math.sin(this.hover * 1.8) * 9;
    const blinkFade = this.untargetable && this.action === 'blink' ? 0.35 : 1;

    // Orbiting crowns
    for (const c of this.crowns) {
      if (c.x === undefined) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(this.crownSpin * 2);
      ctx.scale(0.62, 0.62);
      glowDot(ctx, 0, 0, 24, '#ffd34a', 0.6);
      ctx.fillStyle = '#ffe89a';
      ctx.beginPath();
      ctx.moveTo(-13, 8); ctx.lineTo(-10, -7); ctx.lineTo(-5, 1);
      ctx.lineTo(0, -12); ctx.lineTo(5, 1); ctx.lineTo(10, -7); ctx.lineTo(13, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6b4c0c'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = blinkFade;
    ctx.translate(this.x, this.y + hover);
    ctx.scale(introScale, introScale);

    // Trailing tendrils
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.2 + (i / 5) * Math.PI * 0.6;
      const sw = Math.sin(this.hover * 2.2 + i * 0.9) * 16;
      limb(ctx,
        Math.cos(a) * 16, 10,
        Math.cos(a) * 30 + sw, 74 + Math.sin(i) * 10,
        sw * 0.7, 15, 4, '#4a2d6b');
    }

    ctx.rotate(Math.sin(this.hover) * 0.06);

    // Gown
    ctx.beginPath();
    ctx.moveTo(-26, -6);
    ctx.quadraticCurveTo(-40, 26, -22, 50);
    ctx.quadraticCurveTo(0, 62, 22, 50);
    ctx.quadraticCurveTo(40, 26, 26, -6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -10, 0, 54);
    g.addColorStop(0, '#5a3a86');
    g.addColorStop(0.6, '#301e4d');
    g.addColorStop(1, '#150c26');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#0a0616'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    // Gold filigree
    ctx.strokeStyle = 'rgba(245,197,66,0.55)';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12, 0);
      ctx.quadraticCurveTo(i * 18, 26, i * 10, 48);
      ctx.stroke();
    }

    // Torso
    ctx.beginPath();
    ctx.ellipse(0, -14, 20, 22, 0, 0, TAU);
    shapeStyle(ctx, 0, -24, 22, '#7a4fb0', { lightDir: -Math.PI / 2, rim: 0.85, outlineW: 3.6 });

    // Arms
    for (const s of [-1, 1]) {
      const raise = this.action ? -0.7 : 0;
      limb(ctx, s * 16, -16, s * (34 + Math.sin(this.hover * 2) * 3), 4 + raise * 26, s * 10, 11, 6, '#6d3f9e');
    }

    // Head
    ctx.beginPath();
    ctx.ellipse(0, -40, 16, 17, 0, 0, TAU);
    shapeStyle(ctx, 0, -47, 17, '#c8a8e8', { outlineW: 3 });
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath(); ctx.ellipse(-6, -40, 4, 5.2, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -40, 4, 5.2, -0.2, 0, TAU); ctx.fill();
    const eg = this.action ? 1.3 : 0.8;
    glowDot(ctx, -6, -40, 12, this.phase >= 2 ? '#ff5a6a' : '#f5c542', eg);
    glowDot(ctx, 6, -40, 12, this.phase >= 2 ? '#ff5a6a' : '#f5c542', eg);

    // The Abyssal Crown itself — sits above the brow, never over the eyes.
    ctx.save();
    ctx.translate(0, -66);
    glowDot(ctx, 0, 0, 40, '#ffd34a', 0.5 + this.phase * 0.18);
    ctx.beginPath();
    ctx.moveTo(-20, 8); ctx.lineTo(-16, -10); ctx.lineTo(-8, 1);
    ctx.lineTo(0, -18); ctx.lineTo(8, 1); ctx.lineTo(16, -10); ctx.lineTo(20, 8);
    ctx.closePath();
    ctx.fillStyle = '#f5c542'; ctx.fill();
    ctx.strokeStyle = '#6b4c0c'; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#3a2a08';
    ctx.fillRect(-20, 8, 40, 6);
    ctx.strokeRect(-20, 8, 40, 6);
    for (let i = -1; i <= 1; i++) {
      glowDot(ctx, i * 10, 0, 9, '#ff5a9a', 0.85);
      ctx.fillStyle = '#ff9ac0';
      ctx.beginPath(); ctx.arc(i * 10, 0, 3.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
}

export const BOSS_BY_BIOME = {
  necropolis: Tideus,
  bastion: Orcas,
  throne: Nereid,
};

export function makeBoss(biomeKey, x, y, tier) {
  const C = BOSS_BY_BIOME[biomeKey];
  return C ? new C(x, y, tier) : null;
}
