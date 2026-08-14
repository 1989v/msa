// 플레이어 조작: 기본기 체인 · 캔슬 · 대시 · 점프 · 잡기 · 커맨드 기술.

import { clamp, sign, GROUND_TOP, GROUND_BOT, DEPTH_HIT } from './core.js';
import { Fighter } from './entities.js';
import { MOVES } from './moves.js';
import { held, pressed, consume, buffered, detectCommand, dashTap } from './input.js';
import { sfx } from './audio.js';
import * as FXM from './fx.js';

const TIER = {
  lp1: 0, lp2: 0, lp3: 0, hp: 0, dashAtk: 0, jumpAtk: 0, wpSwing: 0, grabHit: 0, grabThrow: 0, burst: 0, wpThrow: 0,
  spShotL: 1, spShotH: 1, spRise: 1, spSpin: 1, spPalm: 1,
  superFlurry: 2, superHidden: 2,
};

export class Player extends Fighter {
  constructor(x, y, world) {
    super('hero', x, y, world);
    this.isPlayer = true;
    this.lives = 3;
    this.score = 0;
    this.hitConnected = false;
    this.dashT = 0;
    this.airAttacked = false;
    this.scrolls = 0;
    this.hiddenUnlocked = false;
    this.respawnT = 0;
  }

  get tier() { return this.move ? (TIER[this.moveId] ?? 0) : -1; }

  canStart(tier) {
    if (!this.move) return this.state !== 'down' && this.state !== 'getup' && this.hitstun <= 0 && this.blockstun <= 0;
    if (!this.hitConnected) return false;
    const cur = this.tier;
    if (tier <= cur) return false;
    const m = this.move;
    if (cur === 0) return this.mf >= m.cancelFrom && this.mf <= m.cancelTo;
    return this.mf >= m.startup && this.mf <= m.dur - 4;   // 필살기 → 초필 캔슬
  }

  start(id) {
    const ok = this.startMove(id);
    if (ok) {
      this.hitConnected = false;
      this.moveId = id;
      const m = MOVES[id];
      if (m.superFx && (TIER[id] ?? 0) >= 1) {
        FXM.flash(TIER[id] === 2 ? 0.85 : 0.4, TIER[id] === 2 ? '#ffe6a0' : '#9fd0ff');
        if (TIER[id] === 2) { FXM.hitstop(18); FXM.shake(4, 16); }
      }
    }
    return ok;
  }

  update() {
    if (this.respawnT > 0) { this.respawnT--; return; }
    if (!this.dead) this.control();
    super.update();
    if (this.weapon && this.weapon.uses <= 0) { this.weapon = null; this.setClip('idle'); }
  }

  control() {
    const w = this.world;
    // 다운/기상 중에는 조작 불가
    if (this.state === 'down' || this.state === 'getup') return;

    // 잡혔을 때: 버튼 연타로 탈출
    if (this.grabbedBy) {
      if (pressed('lp') || pressed('hp') || pressed('grab')) this.grabEscape -= 26;
      return;
    }

    // 잡은 상태
    if (this.grabbing && !this.move) {
      this.grabT++;
      const t = this.grabbing;
      this.dir = t.x >= this.x ? 1 : -1;
      if (consume('lp', 8) && this.grabHits < 3) {
        this.grabHits++;
        this.start('grabHit');
        this.grabHitPending = true;
        return;
      }
      if (consume('hp', 8) || consume('grab', 8) || (held.left || held.right) && this.grabT > 8) {
        const target = this.grabbing;
        const away = held.left ? -1 : held.right ? 1 : this.dir;
        this.dir = away;
        this.breakGrab();
        this.throwTarget = target;
        this.start('grabThrow');
        return;
      }
      if (this.grabT > 200) this.breakGrab();
      return;
    }

    // ── 커맨드 기술 ──
    const cmd = detectCommand(this.hiddenUnlocked, this.dir);
    if (cmd) {
      let id = null;
      if (cmd.id === 'spShot') id = cmd.btn === 'hp' ? 'spShotH' : 'spShotL';
      else if (cmd.id === 'superFlurry') id = this.meter >= 100 ? 'superFlurry' : null;
      else if (cmd.id === 'superHidden') id = this.meter >= 300 ? 'superHidden' : null;
      else id = cmd.id;
      if (id && this.canStart(TIER[id] ?? 1) && (!MOVES[id].cost || this.meter >= MOVES[id].cost)) {
        if (this.z > 0) { /* 공중에서는 불가 */ } else { this.start(id); return; }
      }
    }

    // ── 긴급 탈출기 (약+강 동시) ──
    if (buffered('lp', 4) && buffered('hp', 4) && this.canStart(0) && this.z <= 0 && this.hp > 16) {
      consume('lp', 4); consume('hp', 4);
      this.hp -= 14;
      this.start('burst');
      return;
    }

    // ── 공중 공격 ──
    if (this.z > 4) {
      if (!this.airAttacked && (consume('lp', 6) || consume('hp', 6))) {
        this.airAttacked = true;
        this.start('jumpAtk');
      }
      // 공중 미세 조작
      if (held.left) this.vx -= 0.12;
      if (held.right) this.vx += 0.12;
      this.vx = clamp(this.vx, -3, 3);
      if (!this.move) this.setClip(this.vz > 0 ? 'jumpRise' : 'jumpFall');
      return;
    }
    this.airAttacked = false;

    // ── 잡기 / 비밀 통로 ──
    if (buffered('grab', 6) && this.canStart(0)) {
      if (held.down && w.trySecret?.(this)) { consume('grab', 6); return; }
      if (this.weapon) { consume('grab', 6); this.start('wpThrow'); this.throwWeaponPending = true; return; }
      if (this.tryGrab(w.enemies())) { consume('grab', 6); return; }
    }

    // ── 기본기 ──
    const lp = buffered('lp', 6), hp = buffered('hp', 6);
    if (lp || hp) {
      if (this.dashT > 0 && this.canStart(0)) { consume(lp ? 'lp' : 'hp', 6); this.start('dashAtk'); this.dashT = 0; return; }
      if (hp && this.canStart(0)) {
        consume('hp', 6);
        this.start(this.weapon ? 'wpSwing' : 'hp');
        return;
      }
      if (lp) {
        if (!this.move && this.canStart(0)) { consume('lp', 6); this.start('lp1'); return; }
        if (this.move && this.tier === 0 && this.hitConnected && MOVES[this.moveId]?.chain
            && this.mf >= this.move.cancelFrom && this.mf <= this.move.cancelTo) {
          consume('lp', 6);
          this.start(MOVES[this.moveId].chain);
          return;
        }
      }
    }

    // ── 점프 ──
    if (consume('jump', 6) && this.canStart(0) && this.z <= 0) {
      this.vz = 6.9;
      this.z = 0.6;
      this.state = 'jump';
      this.setClip('jumpRise');
      sfx('jump');
      if (held.left) this.vx = -2.2; else if (held.right) this.vx = 2.2;
      FXM.dust(this.x, this.y, 5, this.world.dustCol);
      return;
    }

    if (this.move) return;

    // ── 가드 ──
    if (held.guard) {
      this.state = 'block';
      this.setClip('block');
      return;
    }
    if (this.state === 'block') this.state = 'idle';

    // ── 이동 ──
    let mx = 0, my = 0;
    if (held.left) mx -= 1;
    if (held.right) mx += 1;
    if (held.up) my -= 1;
    if (held.down) my += 1;

    if (mx !== 0 && dashTap(mx)) { this.dashT = 34; sfx('step'); }
    if (this.dashT > 0) {
      this.dashT--;
      if (mx === 0) this.dashT = 0;
    }
    const running = this.dashT > 0 && mx === this.dir;
    const spd = this.def.speed * (running ? 2.15 : 1);

    if (mx !== 0) { this.dir = mx; this.x += mx * spd; }
    if (my !== 0) this.y = clamp(this.y + my * this.def.depthSpeed, GROUND_TOP, GROUND_BOT);

    if (mx !== 0 || my !== 0) {
      this.state = running ? 'run' : 'walk';
      this.setClip(running ? 'run' : (this.weapon ? 'walk' : 'walk'));
      if ((this.stateT & 7) === 0) sfx('step');
    } else {
      this.state = 'idle';
      this.setClip(this.weapon ? 'weaponIdle' : 'idle');
    }
  }

  onHitLanded() { this.hitConnected = true; }

  respawn(x, y) {
    this.hp = this.maxHp;
    this.dead = false; this.removed = false;
    this.x = x; this.y = y; this.z = 40; this.vz = 0;
    this.state = 'jump'; this.setClip('jumpFall');
    this.move = null; this.hitstun = 0; this.landed = false;
    this.invuln = 120; this.fadeOut = 1;
    this.meter = Math.max(this.meter, 100);
  }
}
