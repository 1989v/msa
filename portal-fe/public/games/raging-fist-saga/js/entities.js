// 파이터 · 적 AI · 투사체 · 파괴 오브젝트 · 아이템.
// 의사 3D: x=진행축, y=깊이(화면 y 기준선), z=높이.

import {
  clamp, rand, randInt, pick, sign, rgba, shade,
  GROUND_TOP, GROUND_BOT, DEPTH_HIT, VW,
} from './core.js';
import { CLIPS } from './anim.js';
import { CHARS } from './chars.js';
import { MOVES } from './moves.js';
import { sprites, drawSprite } from './sprites.js';
import { sfx } from './audio.js';
import * as FXM from './fx.js';

export const GRAVITY = 0.44;

const LOOP_RATE = { idle: 5, walk: 3, walkBack: 4, run: 2, weaponIdle: 5, win: 4, taunt: 3, grabHold: 6, grabbed: 4, block: 8 };

function clipFrameOfMove(move, mf) {
  const clip = CLIPS[move.anim];
  const n = clip.n;
  const pk = Math.min(move.peak, n - 1);
  if (mf < move.startup) return move.startup > 0 ? Math.floor((mf / move.startup) * pk) : pk;
  if (mf < move.startup + move.active) {
    if (move.activeRange) {
      const [a, b] = move.activeRange;
      return a + (Math.floor((mf - move.startup) / 2) % (b - a + 1));
    }
    return pk;
  }
  const r = (mf - move.startup - move.active) / Math.max(1, move.recover);
  return Math.min(n - 1, pk + 1 + Math.floor(r * (n - pk - 1)));
}

export class Fighter {
  constructor(charId, x, y, world) {
    const def = CHARS[charId];
    this.charId = charId;
    this.def = def;
    this.world = world;
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.dir = 1;
    this.maxHp = def.hp; this.hp = def.hp;
    this.meter = 0; this.maxMeter = 300;
    this.state = 'idle';
    this.move = null; this.mf = 0;
    this.hitstun = 0; this.blockstun = 0; this.invuln = 0; this.hitFlash = 0;
    this.hitDone = new Set();
    this.stateT = 0;
    this.clip = 'idle'; this.cf = 0; this.ct = 0;
    this.w = 12 * def.metrics.scale;
    this.d = 7;
    this.height = 86 * def.metrics.scale;
    this.dead = false; this.removed = false;
    this.weapon = null;
    this.grabbing = null; this.grabbedBy = null; this.grabT = 0; this.grabHits = 0;
    this.armorHits = 0;
    this.glow = 0;
    this.isBoss = !!def.boss;
    this.attackToken = false;
    this.comboRef = null;
  }

  get alive() { return !this.dead; }
  get busy() { return !!this.move || this.hitstun > 0 || this.state === 'down' || this.state === 'getup' || this.state === 'grabbed'; }

  setClip(name) {
    if (this.clip !== name) { this.clip = name; this.cf = 0; this.ct = 0; }
  }

  face(target) { if (target) this.dir = target.x >= this.x ? 1 : -1; }

  startMove(id) {
    const m = MOVES[id];
    if (!m) return false;
    if (m.cost && this.meter < m.cost) return false;
    if (m.cost) this.meter -= m.cost;
    this.move = m; this.moveId = id; this.mf = 0;
    this.hitDone.clear();
    this.state = 'attack';
    this.setClip(m.anim);
    if (m.invuln) this.invuln = Math.max(this.invuln, m.invuln[1]);
    if (m.superFx) { this.glow = 22; }
    if (m.sfx) sfx(m.sfx);
    return true;
  }

  cancelInto(id) {
    const m = MOVES[id];
    if (!m) return false;
    if (m.cost && this.meter < m.cost) return false;
    return this.startMove(id);
  }

  addMeter(v) {
    if (this.isPlayer) this.meter = clamp(this.meter + v, 0, this.maxMeter);
  }

  hurtBox() {
    return { x0: this.x - this.w, x1: this.x + this.w, z0: this.z, z1: this.z + this.height, y: this.y };
  }

  activeHits() {
    if (!this.move) return null;
    const out = [];
    for (const h of this.move.hits) {
      if (this.mf >= h.at && this.mf < h.at + h.dur) out.push(h);
    }
    return out.length ? out : null;
  }

  takeHit(h, from) {
    if (this.invuln > 0 || this.dead) return false;

    // 잡은 상대를 때리는 중이면 잡기가 풀리지 않는다
    if (this.grabbedBy && this.grabbedBy === from) {
      this.hp -= h.dmg;
      this.hitFlash = 4;
      const gx = (this.x + from.x) / 2, gy = this.y - this.height * 0.6;
      FXM.spark(gx, gy, h.spark || 'mid');
      FXM.hitstop(h.hitstop);
      FXM.shake(1.6, 6);
      sfx('hit');
      if (from.isPlayer) {
        FXM.popup(gx, gy - 14, String(h.dmg), 'dmg');
        from.addMeter(from.move ? from.move.meter : 4);
        this.world.onPlayerHit?.(this, h.dmg);
      }
      if (this.hp <= 0) { this.breakGrab(); this.knockdown(h, from, true); return 'ko'; }
      return 'hit';
    }

    const blocking = this.state === 'block' && !h.unblockable && ((from.x - this.x) * this.dir > 0);
    const dmg = blocking ? Math.max(1, Math.round(h.dmg * 0.18)) : h.dmg;
    this.hp -= dmg;
    this.hitFlash = 4;

    const cx = (this.x + from.x + from.dir * 14) / 2;
    const cz = clamp(this.z + this.height * 0.6, 20, 120);
    const sy = this.y - cz;

    if (blocking) {
      this.blockstun = h.blockstun;
      this.vx += from.dir * (h.kb * 0.3 + 0.6);
      FXM.spark(cx, sy, 'block');
      sfx('block');
      FXM.shake(1.6, 5);
      FXM.hitstop(3);
      if (from.isPlayer) { from.addMeter(2); }
      this.addMeter(4);
      return 'block';
    }

    // 슈퍼아머: 경타는 흘리고 카운터만 쌓는다
    const armored = this.def.armor && !h.down && ++this.armorHits < 4;
    FXM.spark(cx, sy, h.spark || 'light');
    FXM.hitstop(h.hitstop);
    FXM.shake(1 + h.hitstop * 0.42, 5 + h.hitstop);
    sfx(h.hitstop >= 9 ? 'hitHeavy' : 'hit');
    if (from.isPlayer) {
      FXM.popup(cx, sy - 14, String(dmg), dmg >= 20 ? 'big' : 'dmg');
      from.addMeter(from.move ? from.move.meter : 4);
      this.world.onPlayerHit?.(this, dmg);
    } else if (this.isPlayer) {
      this.addMeter(Math.round(dmg * 0.8));
      this.world.onPlayerDamaged?.(dmg);
    }

    if (this.hp <= 0) { this.knockdown(h, from, true); return 'ko'; }
    if (armored) { this.vx += from.dir * h.kb * 0.18; return 'armor'; }
    this.armorHits = 0;

    if (h.down || this.z > 2) {
      this.knockdown(h, from, false);
    } else {
      this.breakGrab();
      this.state = 'hurt';
      this.move = null;
      this.hitstun = h.hitstun;
      this.stateT = 0;
      this.setClip(h.hitstop >= 8 ? 'hurtHeavy' : 'hurt');
      this.vx = from.dir * h.kb;
      this.dir = from.dir > 0 ? -1 : 1;
    }
    if (h.wall) this.wallSlam = 26;
    return 'hit';
  }

  knockdown(h, from, lethal) {
    this.breakGrab();
    this.move = null;
    this.state = 'down';
    this.stateT = 0;
    this.hitstun = 0;
    this.setClip('down');
    this.vx = from ? from.dir * (h.kb + 2.4) : 0;
    this.vz = Math.max(this.vz, (h.lift || 0) + 3.2);
    this.dir = from ? (from.dir > 0 ? -1 : 1) : this.dir;
    this.lethal = lethal;
    if (lethal) { this.dead = true; this.world.onDeath?.(this); }
  }

  breakGrab() {
    if (this.grabbing) { this.grabbing.grabbedBy = null; this.grabbing.state = 'idle'; this.grabbing = null; }
    if (this.grabbedBy) { this.grabbedBy.grabbing = null; this.grabbedBy.state = 'idle'; this.grabbedBy = null; }
  }

  tryGrab(targets) {
    for (const t of targets) {
      if (t === this || t.dead || t.state === 'down' || t.grabbedBy || t.isBoss) continue;
      const dx = (t.x - this.x) * this.dir;
      if (dx > 4 && dx < 34 + this.w && Math.abs(t.y - this.y) < DEPTH_HIT) {
        this.grabbing = t; t.grabbedBy = this;
        t.state = 'grabbed'; t.setClip('grabbed'); t.move = null; t.hitstun = 0;
        this.state = 'grab'; this.setClip('grabHold'); this.grabT = 0; this.grabHits = 0;
        t.grabEscape = this.isPlayer ? 150 : 110;
        sfx('punch2');
        return true;
      }
    }
    return false;
  }

  applyImpulses() {
    if (!this.move) return;
    for (const im of this.move.impulse) {
      if (im.f === this.mf) {
        if (im.vx) this.vx = this.dir * im.vx;
        if (im.vz) this.vz = im.vz;
      }
    }
  }

  physics(bounds) {
    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    if (this.z > 0) {
      this.vz -= GRAVITY;
      if (this.z <= 0) { this.z = 0; }
    }
    if (this.z <= 0) {
      this.z = 0;
      if (this.vz < 0) {
        this.vz = 0;
        if (this.state === 'jump') { this.state = 'idle'; sfx('land'); FXM.dust(this.x, this.y, 4, this.world.dustCol); }
        if (this.state === 'down' && this.stateT > 2) { /* 착지 처리는 update에서 */ }
      }
    }
    const damp = this.state === 'down' ? 0.9 : (this.move ? 0.86 : 0.72);
    this.vx *= damp;
    if (Math.abs(this.vx) < 0.04) this.vx = 0;
    this.vy = 0;
    this.x = clamp(this.x, bounds.x0 + 8, bounds.x1 - 8);
    this.y = clamp(this.y, GROUND_TOP, GROUND_BOT);
  }

  updateAnim() {
    if (this.move) {
      this.cf = clipFrameOfMove(this.move, this.mf);
      return;
    }
    const clip = CLIPS[this.clip];
    if (!clip) return;
    if (clip.loop) {
      this.ct++;
      const rate = LOOP_RATE[this.clip] || 4;
      if (this.ct >= rate) { this.ct = 0; this.cf = (this.cf + 1) % clip.n; }
    } else {
      this.ct++;
      if (this.ct >= 3 && this.cf < clip.n - 1) { this.ct = 0; this.cf++; }
    }
  }

  update() {
    if (this.removed) return;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.invuln > 0) this.invuln--;
    if (this.glow > 0) this.glow--;
    if (this.wallSlam > 0) this.wallSlam--;
    this.stateT++;

    if (this.grabbedBy) {
      const g = this.grabbedBy;
      this.x = g.x + g.dir * (this.w + g.w + 4);
      this.y = g.y;
      this.dir = -g.dir;
      this.setClip('grabbed');
      if (this.grabEscape !== undefined && --this.grabEscape <= 0) this.breakGrab();
      this.updateAnim();
      return;
    }

    if (this.move) {
      this.applyImpulses();
      this.mf++;
      if (this.move.proj && this.mf === this.move.proj.at) this.world.fireProjectile(this, this.move.proj);
      if (this.mf >= this.move.dur) {
        this.move = null;
        this.state = this.grabbing ? 'grab' : 'idle';
        this.setClip(this.grabbing ? 'grabHold' : (this.weapon ? 'weaponIdle' : 'idle'));
      }
    } else if (this.hitstun > 0) {
      this.hitstun--;
      if (this.hitstun === 0) { this.state = 'idle'; this.setClip(this.weapon ? 'weaponIdle' : 'idle'); }
    } else if (this.blockstun > 0) {
      this.blockstun--;
    }

    if (this.state === 'down') {
      if (this.z <= 0 && this.stateT > 3) {
        if (!this.landed) {
          this.landed = true;
          FXM.dust(this.x, this.y, 8, this.world.dustCol);
          FXM.shake(2.4, 8);
          sfx('land');
          this.setClip('downed');
          this.downT = this.dead ? 999 : (this.isBoss ? 26 : 34);
        } else if (--this.downT <= 0 && !this.dead) {
          this.state = 'getup'; this.setClip('getup'); this.stateT = 0; this.invuln = 26; this.landed = false;
        }
      }
      if (this.dead && this.landed) {
        this.setClip('defeat');
        if (this.stateT > 60) this.fadeOut = (this.fadeOut ?? 1) - 0.02;
        if ((this.fadeOut ?? 1) <= 0) this.removed = true;
      }
    } else if (this.state === 'getup') {
      const c = CLIPS.getup;
      if (this.cf >= c.n - 1) { this.state = 'idle'; this.setClip(this.weapon ? 'weaponIdle' : 'idle'); this.landed = false; }
    }

    this.physics(this.world.bounds);
    this.updateAnim();
  }

  frame() {
    const s = sprites(this.charId);
    if (!s) return null;
    const arr = s[this.clip] || s.idle;
    return arr ? arr[Math.min(this.cf, arr.length - 1)] : null;
  }

  render(ctx, cam) {
    const f = this.frame();
    if (!f) return;
    const sx = this.x - cam, sy = this.y - this.z;
    // 그림자
    const sc = clamp(1 - this.z / 160, 0.35, 1);
    ctx.fillStyle = `rgba(8,6,14,${0.36 * sc})`;
    ctx.beginPath();
    ctx.ellipse(sx, this.y + 1, this.w * 1.5 * sc, 3.6 * sc, 0, 0, 6.284);
    ctx.fill();

    if (this.glow > 0) {
      const a = (this.glow / 22) * 0.5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      ctx.drawImage(f.c, (sx + (this.dir > 0 ? f.ox : -f.ox - f.w)) | 0, (sy + f.oy) | 0);
      ctx.restore();
    }

    const alpha = this.invuln > 0 && !this.move && this.state !== 'down' && (this.stateT >> 1) % 2 === 0 ? 0.55 : (this.fadeOut ?? 1);
    drawSprite(ctx, f, sx, sy, this.dir, alpha);

    if (this.weapon) this.drawWeapon(ctx, f, sx, sy);

    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * (this.hitFlash / 4);
      ctx.translate(sx | 0, sy | 0);
      if (this.dir < 0) ctx.scale(-1, 1);
      ctx.drawImage(f.c, f.ox | 0, f.oy | 0);
      ctx.restore();
    }
  }

  drawWeapon(ctx, f, sx, sy) {
    // 전완 방향(0=아래, 90=앞)을 캔버스 회전각(+x 기준)으로 바꾼다
    const hx = sx + this.dir * f.hand[0];
    const hy = sy + f.hand[1];
    ctx.save();
    ctx.translate(hx, hy);
    if (this.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(((90 - f.handA) * Math.PI) / 180);
    WEAPONS[this.weapon.kind].draw(ctx);
    ctx.restore();
  }
}

// ═══════════ 무기 ═══════════
export const WEAPONS = {
  pipe: {
    name: '쇠파이프', uses: 8, dmgMul: 1,
    draw(ctx) {
      ctx.fillStyle = '#8f97a4'; ctx.fillRect(-6, -2, 42, 4);
      ctx.fillStyle = '#c2c9d4'; ctx.fillRect(-6, -2, 42, 1.4);
      ctx.fillStyle = '#5c626e'; ctx.fillRect(-6, 1, 42, 1.4);
      ctx.fillStyle = '#3a3f48'; ctx.fillRect(-7, -3, 7, 6);
    },
    icon(ctx, x, y) { ctx.fillStyle = '#8f97a4'; ctx.fillRect(x, y, 22, 4); ctx.fillStyle = '#c2c9d4'; ctx.fillRect(x, y, 22, 1.5); },
  },
  wrench: {
    name: '대형 렌치', uses: 6, dmgMul: 1.25,
    draw(ctx) {
      ctx.fillStyle = '#a08a5c'; ctx.fillRect(-6, -2.5, 34, 5);
      ctx.fillStyle = '#c8b078'; ctx.fillRect(-6, -2.5, 34, 1.6);
      ctx.fillStyle = '#8a7448';
      ctx.fillRect(26, -8, 8, 16); ctx.fillRect(32, -8, 8, 5); ctx.fillRect(32, 3, 8, 5);
      ctx.fillStyle = '#c8b078'; ctx.fillRect(26, -8, 8, 1.6);
    },
    icon(ctx, x, y) { ctx.fillStyle = '#a08a5c'; ctx.fillRect(x, y, 18, 4); ctx.fillRect(x + 16, y - 3, 5, 10); },
  },
  katana: {
    name: '설검(雪劍)', uses: 10, dmgMul: 1.45,
    draw(ctx) {
      ctx.fillStyle = '#2a2f3c'; ctx.fillRect(-8, -2, 12, 4);
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(4, -4, 3, 8);
      ctx.fillStyle = '#dfe8f4';
      ctx.beginPath(); ctx.moveTo(7, -2.6); ctx.lineTo(50, -3.4); ctx.lineTo(54, 0); ctx.lineTo(50, 2.2); ctx.lineTo(7, 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(8, -2.4, 42, 1.2);
      ctx.fillStyle = '#9fb4cc'; ctx.fillRect(8, 1.2, 42, 1.2);
    },
    icon(ctx, x, y) { ctx.fillStyle = '#dfe8f4'; ctx.fillRect(x + 4, y, 22, 3); ctx.fillStyle = '#2a2f3c'; ctx.fillRect(x, y - 1, 5, 5); },
  },
};

// ═══════════ 적 AI ═══════════

const AI_PROFILE = {
  thug: { range: 40, atk: ['e_jab', 'e_jab', 'e_heavy'], cd: [40, 80], block: 0.12, grab: 0.1, aggro: 0.7 },
  punk: { range: 42, atk: ['e_jab', 'e_dash'], cd: [32, 66], block: 0.16, grab: 0.06, aggro: 0.85 },
  knifer: { range: 46, atk: ['e_stab', 'e_stab', 'e_dash'], cd: [24, 52], block: 0.2, grab: 0, aggro: 1.0 },
  brute: { range: 44, atk: ['e_heavy', 'e_heavy', 'e_jab'], cd: [56, 100], block: 0.05, grab: 0.3, aggro: 0.5 },
  thrower: { range: 150, atk: ['e_bottle'], cd: [70, 120], block: 0.1, grab: 0, aggro: 0.3, keepAway: 120 },
  ninja: { range: 44, atk: ['e_stab', 'e_dash', 'e_jab'], cd: [28, 58], block: 0.26, grab: 0.08, aggro: 0.95 },
  bossHarbor: { range: 52, atk: ['bh_swing', 'bh_swing', 'bh_charge', 'bh_slam'], cd: [40, 76], block: 0.2, grab: 0.14, aggro: 0.8 },
  bossFoundry: { range: 54, atk: ['bf_smash', 'bf_stomp', 'bf_charge', 'bf_fire'], cd: [44, 82], block: 0.1, grab: 0.1, aggro: 0.7 },
  bossShrine: { range: 50, atk: ['bs_slash', 'bs_slash', 'bs_whirl', 'bs_iai', 'bs_ice'], cd: [26, 60], block: 0.3, grab: 0.05, aggro: 1.0 },
  bossHidden: { range: 48, atk: ['lp1', 'hp', 'spShotH', 'spRise', 'spSpin', 'spPalm'], cd: [22, 50], block: 0.34, grab: 0.1, aggro: 1.1 },
};

export class Enemy extends Fighter {
  constructor(charId, x, y, world, opts = {}) {
    super(charId, x, y, world);
    this.ai = AI_PROFILE[charId] || AI_PROFILE.thug;
    this.cool = randInt(20, 60);
    this.think = 0;
    this.target = null;
    this.entering = opts.entering || false;
    this.spawnSide = opts.spawnSide || 1;
    this.homeOffset = rand(-1, 1) > 0 ? rand(46, 104) : -rand(46, 104);
    this.depthOffset = rand(-18, 18);
    this.score = CHARS[charId].score || 100;
    this.difficulty = opts.difficulty || 1;
    if (opts.weapon) this.weapon = { kind: opts.weapon, uses: 99 };
  }

  update() {
    if (!this.dead && !this.removed) this.brain();
    super.update();
  }

  brain() {
    const p = this.world.player;
    if (!p || p.dead) { this.setIdle(); return; }
    if (this.busy || this.state === 'grab') {
      if (this.state === 'grab') this.grabLogic(p);
      return;
    }
    this.target = p;
    if (this.cool > 0) this.cool--;

    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    this.dir = dx >= 0 ? 1 : -1;

    if (this.entering) {
      const goal = this.world.cam + (this.spawnSide > 0 ? VW - 60 : 60);
      this.walkTo(goal, this.y, 1);
      if ((this.spawnSide > 0 && this.x < goal) || (this.spawnSide < 0 && this.x > goal)) this.entering = false;
      return;
    }

    // 가드 판단: 플레이어가 근접해서 공격 시작하면 일정 확률로 막는다
    if (p.move && p.move.startup > 0 && p.mf <= p.move.startup && adx < 60 && ady < DEPTH_HIT + 6 && Math.random() < this.ai.block * 0.25) {
      this.state = 'block'; this.setClip('block'); this.blockstun = 16; this.stateT = 0;
      return;
    }
    if (this.state === 'block') {
      if (this.blockstun > 0) return;
      this.state = 'idle';
    }

    const inRange = adx < this.ai.range + this.w && ady < DEPTH_HIT - 1;
    if (this.ai.keepAway) {
      if (adx < this.ai.keepAway * 0.7) { this.walkTo(this.x - this.dir * 60, p.y + this.depthOffset, 1); return; }
      if (this.cool <= 0 && ady < DEPTH_HIT + 4 && this.requestToken()) {
        this.attack(); return;
      }
      this.walkTo(this.x, p.y + this.depthOffset * 0.4, 0.6);
      return;
    }

    if (inRange && this.cool <= 0) {
      if (Math.random() < this.ai.grab && !this.isBoss && this.tryGrab([p])) return;
      if (this.requestToken()) { this.attack(); return; }
    }
    if (adx < 26 && ady < 8 && this.cool > 0) {
      // 너무 붙었으면 살짝 물러난다
      this.walkTo(this.x - this.dir * 40, p.y + this.depthOffset, 0.8);
      return;
    }
    const wantX = p.x - (this.cool > 0 ? this.homeOffset : this.dir * (this.ai.range * 0.7));
    this.walkTo(wantX, p.y + (this.cool > 0 ? this.depthOffset : 0), this.ai.aggro);
  }

  requestToken() {
    if (this.attackToken) return true;
    if (this.world.takeToken(this)) { this.attackToken = true; return true; }
    return false;
  }

  attack() {
    const id = this.weapon && Math.random() < 0.5 ? 'wpSwing' : pick(this.ai.atk);
    this.startMove(id);
    this.cool = Math.round(randInt(this.ai.cd[0], this.ai.cd[1]) / this.difficulty);
    this.world.releaseToken(this, (this.move ? this.move.dur : 20) + 14);
  }

  grabLogic(p) {
    this.grabT++;
    if (this.grabT > 26 && this.grabbing) {
      if (this.grabHits < 2 && Math.random() < 0.6) { this.grabHits++; this.grabT = 0; this.startMove('e_grabHit'); this.applyGrabHit(); }
      else { const t = this.grabbing; this.breakGrab(); this.startMove('e_throw'); this.throwTarget = t; }
    }
  }

  applyGrabHit() {
    const t = this.grabbing;
    if (!t) return;
    t.hp -= 7; t.hitFlash = 4;
    FXM.spark(t.x, t.y - t.height * 0.55, 'mid');
    FXM.hitstop(5); sfx('punch2');
    if (t.isPlayer) { t.addMeter(6); this.world.onPlayerDamaged?.(7); }
    if (t.hp <= 0) { this.breakGrab(); t.knockdown({ kb: 4, lift: 2 }, this, true); }
  }

  setIdle() { if (!this.move && this.state !== 'down') { this.state = 'idle'; this.setClip('idle'); } }

  walkTo(tx, ty, speedMul = 1) {
    const def = this.def;
    const dx = tx - this.x, dy = ty - this.y;
    let moved = false;
    if (Math.abs(dx) > 6) { this.x += sign(dx) * def.speed * speedMul; moved = true; }
    if (Math.abs(dy) > 3) { this.y += sign(dy) * def.depthSpeed * speedMul; moved = true; }
    this.y = clamp(this.y, GROUND_TOP, GROUND_BOT);
    if (moved) {
      const back = (this.target && sign(dx) !== this.dir);
      this.setClip(this.weapon ? 'walk' : (back ? 'walkBack' : 'walk'));
    } else this.setClip(this.weapon ? 'weaponIdle' : 'idle');
    if (moved) this.state = 'walk'; else this.state = 'idle';
  }
}

// ═══════════ 투사체 ═══════════

export class Projectile {
  constructor(o) { Object.assign(this, o); this.t = 0; this.removed = false; this.hitDone = new Set(); }

  update() {
    this.t++;
    this.x += this.vx;
    if (this.arc) { this.z += this.vz; this.vz -= 0.22; if (this.z <= 0) { this.burst(); return; } }
    if (this.kind === 'ki' || this.kind === 'fire') FXM.trail(this.x - this.vx * 0.5, this.y - this.z - 30, this.col, this.r * 0.6);
    if (this.t > this.life) this.removed = true;
    if (this.x < this.world.bounds.x0 - 40 || this.x > this.world.bounds.x1 + 40) this.removed = true;
  }

  burst() {
    this.removed = true;
    FXM.spark(this.x, this.y - 26, this.kind === 'bottle' ? 'light' : 'ki');
    if (this.kind === 'bottle') { FXM.debris(this.x, this.y - 10, 6, '#7aa86a'); sfx('break'); }
  }

  hitCheck(targets) {
    for (const t of targets) {
      if (t === this.owner || t.dead || t.removed || this.hitDone.has(t)) continue;
      if (t.invuln > 0) continue;
      if (Math.abs(t.y - this.y) > DEPTH_HIT + 3) continue;
      const zc = this.z + 34;
      if (zc < t.z || zc > t.z + t.height) continue;
      if (Math.abs(t.x - this.x) > t.w + this.r) continue;
      this.hitDone.add(t);
      t.takeHit({
        dmg: this.dmg, hitstun: this.hitstun, blockstun: 12, hitstop: this.down ? 10 : 6,
        kb: this.kb, lift: this.down ? 2.4 : 0, down: !!this.down, spark: this.kind === 'ki' ? 'ki' : 'mid',
      }, { x: this.x, dir: this.dir, isPlayer: this.owner.isPlayer, move: null });
      if (!this.pierce) { this.burst(); return; }
    }
  }

  render(ctx, cam) {
    const x = this.x - cam, y = this.y - this.z - 34;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = this.r * (1 + Math.sin(this.t * 0.4) * 0.08);
    if (this.kind === 'bottle') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 0.4 * this.dir);
      ctx.fillStyle = '#6a9a58'; ctx.fillRect(-3, -6, 6, 12);
      ctx.fillStyle = '#9fd08a'; ctx.fillRect(-3, -6, 2, 12);
      ctx.fillStyle = '#4a6a3a'; ctx.fillRect(-1.5, -9, 3, 4);
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, rgba(this.col2, 0.95));
      g.addColorStop(0.4, rgba(this.col, 0.7));
      g.addColorStop(1, rgba(this.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 6.284); ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.9);
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 6.284); ctx.fill();
      // 꼬리
      ctx.fillStyle = rgba(this.col, 0.35);
      ctx.beginPath();
      ctx.ellipse(x - this.vx * 2.4, y, r * 1.6, r * 0.7, 0, 0, 6.284); ctx.fill();
    }
    ctx.restore();
  }
}

// ═══════════ 파괴 오브젝트 / 아이템 ═══════════

export const PROP_KINDS = {
  crate: {
    hp: 20, w: 13, h: 26, dust: '#a8843c',
    draw(ctx, x, y, hurt) {
      const c = hurt ? '#d8b070' : '#a8813c';
      ctx.fillStyle = c; ctx.fillRect(x - 13, y - 26, 26, 26);
      ctx.fillStyle = shade(c, 1.25); ctx.fillRect(x - 13, y - 26, 26, 3);
      ctx.fillStyle = shade(c, 0.65); ctx.fillRect(x - 13, y - 5, 26, 5);
      ctx.fillStyle = shade(c, 0.8);
      ctx.fillRect(x - 13, y - 16, 26, 3);
      ctx.beginPath(); ctx.moveTo(x - 11, y - 24); ctx.lineTo(x + 11, y - 4); ctx.lineTo(x + 8, y - 4); ctx.lineTo(x - 13, y - 22); ctx.fill();
    },
  },
  barrel: {
    hp: 26, w: 11, h: 30, dust: '#c04a2a', explode: true,
    draw(ctx, x, y, hurt) {
      const c = hurt ? '#ff8a5a' : '#b8452a';
      ctx.fillStyle = c; ctx.fillRect(x - 11, y - 30, 22, 30);
      ctx.fillStyle = shade(c, 1.3); ctx.fillRect(x - 11, y - 30, 5, 30);
      ctx.fillStyle = shade(c, 0.6); ctx.fillRect(x + 6, y - 30, 5, 30);
      ctx.fillStyle = '#e0c85a'; ctx.fillRect(x - 11, y - 24, 22, 3); ctx.fillRect(x - 11, y - 10, 22, 3);
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(x - 5, y - 21, 10, 8);
      ctx.fillStyle = '#e0c85a'; ctx.fillRect(x - 4, y - 20, 8, 2);
    },
  },
  lantern: {
    hp: 18, w: 11, h: 34, dust: '#d8d0c0',
    draw(ctx, x, y, hurt) {
      const c = hurt ? '#fff0d0' : '#9aa0a8';
      ctx.fillStyle = c; ctx.fillRect(x - 9, y - 8, 18, 8);
      ctx.fillStyle = shade(c, 0.85); ctx.fillRect(x - 5, y - 24, 10, 16);
      ctx.fillStyle = shade(c, 0.9); ctx.fillRect(x - 10, y - 34, 20, 11);
      ctx.fillStyle = '#ffca6a'; ctx.fillRect(x - 6, y - 31, 12, 6);
      ctx.fillStyle = '#e8eef6';
      ctx.beginPath(); ctx.moveTo(x - 13, y - 34); ctx.lineTo(x + 13, y - 34); ctx.lineTo(x + 8, y - 41); ctx.lineTo(x - 8, y - 41); ctx.fill();
    },
  },
  drum: {
    hp: 34, w: 12, h: 32, dust: '#5c6470',
    draw(ctx, x, y, hurt) {
      const c = hurt ? '#c8d4e0' : '#5c6470';
      ctx.fillStyle = c; ctx.fillRect(x - 12, y - 32, 24, 32);
      ctx.fillStyle = shade(c, 1.3); ctx.fillRect(x - 12, y - 32, 6, 32);
      ctx.fillStyle = shade(c, 0.65); ctx.fillRect(x + 6, y - 32, 6, 32);
      ctx.fillStyle = '#2a303a'; ctx.fillRect(x - 12, y - 26, 24, 2); ctx.fillRect(x - 12, y - 8, 24, 2);
      ctx.fillStyle = '#d8b03a'; ctx.fillRect(x - 7, y - 22, 14, 9);
      ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 5, y - 20, 10, 5);
    },
  },
};

export class Prop {
  constructor(kind, x, y, drop, world) {
    const k = PROP_KINDS[kind];
    this.kind = kind; this.k = k;
    this.x = x; this.y = y; this.z = 0;
    this.hp = k.hp; this.maxHp = k.hp;
    this.w = k.w; this.height = k.h; this.d = 6;
    // 낮은 상자도 얼굴 높이 펀치에 맞아야 한다 (판정 전용 높이)
    this.hitH = Math.max(k.h, 66);
    this.drop = drop; this.world = world;
    this.hitFlash = 0; this.removed = false; this.dead = false;
    this.isProp = true; this.shakeT = 0;
  }
  update() { if (this.hitFlash > 0) this.hitFlash--; if (this.shakeT > 0) this.shakeT--; }
  takeHit(h, from) {
    if (this.removed) return false;
    this.hp -= h.dmg; this.hitFlash = 5; this.shakeT = 8;
    FXM.spark(this.x + (from ? from.dir * 6 : 0), this.y - this.height * 0.6, 'light');
    FXM.hitstop(3);
    sfx('hit');
    if (this.hp <= 0) this.destroy(from);
    return 'hit';
  }
  destroy(from) {
    this.removed = true;
    FXM.debris(this.x, this.y - this.height * 0.5, 14, this.k.dust);
    FXM.dust(this.x, this.y, 6, this.k.dust);
    sfx('break');
    FXM.shake(3, 10);
    if (this.k.explode) {
      FXM.spark(this.x, this.y - 16, 'burst');
      FXM.flash(0.4, '#ff9a4a');
      FXM.shake(6, 16);
      this.world.explode(this.x, this.y, 46, 22, from);
    }
    if (this.drop) this.world.spawnPickup(this.drop, this.x, this.y);
  }
  render(ctx, cam) {
    const sx = this.x - cam + (this.shakeT > 0 ? rand(-1.5, 1.5) : 0);
    ctx.fillStyle = 'rgba(8,6,14,0.32)';
    ctx.beginPath(); ctx.ellipse(sx, this.y + 1, this.w * 1.25, 3.2, 0, 0, 6.284); ctx.fill();
    this.k.draw(ctx, sx, this.y, this.hitFlash > 0);
  }
}

export const PICKUPS = {
  meat: { label: '고기', heal: 55, col: '#c4703a', score: 100 },
  drink: { label: '음료', heal: 25, col: '#4aa8d8', score: 60 },
  ki: { label: '기환약', meter: 150, col: '#a24ae0', score: 120 },
  gold: { label: '금괴', score: 1200, col: '#e8c04a' },
  life: { label: '1UP', life: 1, col: '#e04a6a', score: 0 },
  scroll: { label: '봉인 두루마리', scroll: true, col: '#e8dcc0', score: 2000 },
  pipe: { label: '쇠파이프', weapon: 'pipe', col: '#9aa2b0' },
  wrench: { label: '대형 렌치', weapon: 'wrench', col: '#b09a68' },
  katana: { label: '설검', weapon: 'katana', col: '#dfe8f4' },
};

export class Pickup {
  constructor(kind, x, y, world) {
    this.kind = kind; this.p = PICKUPS[kind];
    this.x = x; this.y = y; this.z = 20; this.vz = 2.4;
    this.world = world; this.t = 0; this.removed = false; this.life = 900;
    this.w = 10; this.height = 14;
  }
  update() {
    this.t++;
    if (this.z > 0) { this.z += this.vz; this.vz -= 0.4; if (this.z < 0) { this.z = 0; this.vz = 0; } }
    if (this.t > this.life) this.removed = true;
  }
  render(ctx, cam) {
    const x = this.x - cam, y = this.y - this.z;
    const bob = Math.sin(this.t * 0.12) * 1.6;
    ctx.fillStyle = 'rgba(8,6,14,0.3)';
    ctx.beginPath(); ctx.ellipse(x, this.y + 1, 8, 2.6, 0, 0, 6.284); ctx.fill();
    if (this.t > this.life - 180 && (this.t >> 2) % 2 === 0) return;
    ctx.save(); ctx.translate(x, y - 8 + bob);
    const p = this.p;
    if (p.weapon) {
      WEAPONS[p.weapon].icon(ctx, -11, -2);
    } else if (this.kind === 'meat') {
      ctx.fillStyle = '#8c4a2a'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0.2, 0, 6.284); ctx.fill();
      ctx.fillStyle = '#c4703a'; ctx.beginPath(); ctx.ellipse(-1, -1.5, 7, 4, 0.2, 0, 6.284); ctx.fill();
      ctx.fillStyle = '#efe4d0'; ctx.fillRect(6, -1, 8, 3);
    } else if (this.kind === 'drink') {
      ctx.fillStyle = '#2f6f8a'; ctx.fillRect(-4, -7, 8, 14);
      ctx.fillStyle = '#6fd0f0'; ctx.fillRect(-4, -7, 3, 14);
      ctx.fillStyle = '#d8e8f0'; ctx.fillRect(-4, -9, 8, 3);
    } else if (this.kind === 'ki') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      g.addColorStop(0, 'rgba(230,190,255,0.95)'); g.addColorStop(1, 'rgba(162,74,224,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.284); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#e8d0ff'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 6.284); ctx.fill();
    } else if (this.kind === 'gold') {
      ctx.fillStyle = '#c8a12a'; ctx.fillRect(-9, -3, 18, 7);
      ctx.fillStyle = '#f0d868'; ctx.fillRect(-9, -3, 18, 2.5);
      ctx.fillStyle = '#8a6a18'; ctx.fillRect(-9, 2, 18, 2);
    } else if (this.kind === 'life') {
      ctx.fillStyle = '#e04a6a';
      ctx.beginPath(); ctx.arc(-3.4, -2, 4, 0, 6.284); ctx.arc(3.4, -2, 4, 0, 6.284);
      ctx.moveTo(-7.2, -0.4); ctx.lineTo(0, 8); ctx.lineTo(7.2, -0.4); ctx.fill();
      ctx.fillStyle = '#ff9ab0'; ctx.beginPath(); ctx.arc(-3.4, -3, 1.6, 0, 6.284); ctx.fill();
    } else if (this.kind === 'scroll') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, 'rgba(255,240,200,0.7)'); g.addColorStop(1, 'rgba(232,220,192,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.284); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-10, -4, 20, 8);
      ctx.fillStyle = '#c8b898'; ctx.fillRect(-10, 1, 20, 3);
      ctx.fillStyle = '#a03a34'; ctx.fillRect(-11, -5, 3, 10); ctx.fillRect(8, -5, 3, 10);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-4, -2, 8, 1); ctx.fillRect(-4, 0, 6, 1);
    }
    ctx.restore();
  }
}
