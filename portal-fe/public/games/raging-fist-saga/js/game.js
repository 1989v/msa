// 게임 디렉터: 월드 상태, 웨이브 진행, 카메라, 판정 해결, 숨김 요소.

import {
  clamp, rand, randInt, pick, rgba, VW, VH, GROUND_TOP, GROUND_BOT, DEPTH_HIT,
} from './core.js';
import { loadTheme, drawBackground, drawForeground } from './stages.js';
import { STAGES, ROOMS } from './levels.js';
import { Fighter, Enemy, Projectile, Prop, Pickup, PICKUPS, WEAPONS } from './entities.js';
import { Player } from './player.js';
import { bakeChars, sprites } from './sprites.js';
import { sfx, playBgm, stopBgm } from './audio.js';
import * as FXM from './fx.js';
import { MOVES } from './moves.js';

const PROJ_STYLE = {
  ki: { col: '#3fa0ff', col2: '#e8f6ff' },
  fire: { col: '#ff6a1c', col2: '#ffe6a0' },
  ice: { col: '#7fd8ff', col2: '#eaffff' },
  bottle: { col: '#7aa86a', col2: '#cfe8b0' },
  weapon: { col: '#c0c8d4', col2: '#ffffff' },
};


// 플랫폼 랭킹 제출 (통합 어댑터 — 게임 로직과 무관, 없으면 no-op)
function reportRun(S, won) {
  if (!window.PlatformAdapter) return;
  const stageNames = ['안개 항만', '적열 제련소', '설풍 사원', '심연의 옥좌'];
  PlatformAdapter.runEnd({
    score: S.score + (won ? 50000 : 0) + S.stageIdx * 10000,
    detail: (won ? '완주 · ' : '') + (stageNames[S.stageIdx] || '') + ' · ' + S.score.toLocaleString() + '점',
  });
}
export class Game {
  constructor() {
    this.state = 'title';
    this.fighters = []; this.props = []; this.pickups = []; this.projs = [];
    this.cam = 0; this.camLock = 0; this.camLocked = false;
    this.bounds = { x0: 0, x1: VW };
    this.combo = 0; this.comboT = 0; this.bestCombo = 0;
    this.score = 0; this.timeScale = 1; this.tick = 0;
    this.tokenHolders = new Map(); this.maxTokens = 2;
    this.ambient = []; this.vents = [];
    this.msg = null; this.msgT = 0;
    this.boss = null; this.goT = 0; this.deathT = 0;
    this.stageIdx = 0; this.sectionIdx = 0;
    this.continueT = 0; this.credits = 3;
    this.hidden = { scrolls: 0, unlocked: false, rooms: {}, rageBonus: false };
    this.stats = { hits: 0, kills: 0, secrets: 0, maxCombo: 0 };
    this.player = null;
    this.room = null;
    this.baking = false; this.bakeProgress = 1;
    this.introT = 0; this.clearT = 0; this.slowmo = 0;
    this.dustCol = '#a0a0b0';
    this.prompt = null;
  }

  // ─────────── 진행 ───────────

  async newGame() {
    this.score = 0; this.credits = 3;
    this.stats = { hits: 0, kills: 0, secrets: 0, maxCombo: 0 };
    this.hidden = { scrolls: 0, unlocked: !!localStorage.getItem('rfs_hidden'), rooms: {}, rageBonus: false };
    this.stageIdx = 0;
    await this.loadStage(0);
  }

  async loadStage(idx) {
    this.stageIdx = idx;
    const st = STAGES[idx];
    this.baking = true; this.bakeProgress = 0;
    this.state = 'loading';
    this.theme = loadTheme(st.theme);
    this.dustCol = this.theme.dust;
    await bakeChars(['hero', ...st.bake], (p) => { this.bakeProgress = p; });
    this.baking = false;
    const keepLives = this.player ? this.player.lives : 3;
    const keepScrolls = this.hidden.scrolls;
    this.player = new Player(80, 214, this);
    this.player.lives = keepLives;
    this.player.hiddenUnlocked = this.hidden.unlocked;
    this.player.scrolls = keepScrolls;
    this.startSection(0);
    this.state = 'intro';
    this.introT = 0;
    playBgm(st.bgm);
  }

  get stage() { return STAGES[this.stageIdx]; }
  get sec() { return this.room ? this.room.def : this.stage.sections[this.sectionIdx]; }

  startSection(i) {
    this.sectionIdx = i;
    const s = this.stage.sections[i];
    this.fighters = [this.player];
    this.props = []; this.pickups = []; this.projs = [];
    this.tokenHolders.clear();
    this.boss = null;
    this.waveIdx = 0; this.waveState = 'walk'; this.spawnQueue = []; this.spawnT = 0;
    this.cam = 0; this.camLocked = false;
    this.player.x = 70; this.player.y = 216; this.player.z = 0;
    this.player.state = 'idle'; this.player.move = null;
    this.buildSection(s);
    this.vents = s.hazard === 'flame' ? [500, 900, 1300].map((x, i) => ({ x, t: i * 50, y: 0 })) : [];
    this.initAmbient();
  }

  buildSection(s) {
    for (const p of (s.props || [])) this.props.push(new Prop(p.kind, p.x, p.y, p.drop, this));
    // 스테이지에 배치된 아이템은 소멸하지 않는다 (드롭 아이템만 시간 제한)
    for (const it of (s.items || [])) {
      this.pickups.push(Object.assign(new Pickup(it.kind, it.x, it.y, this), { z: 0, vz: 0, life: Infinity }));
    }
  }

  initAmbient() {
    this.ambient.length = 0;
    const kind = this.theme.ambient;
    const n = kind === 'rain' ? 90 : kind === 'snow' ? 80 : kind === 'ember' ? 46 : 40;
    for (let i = 0; i < n; i++) {
      this.ambient.push({
        x: rand(0, VW + 60), y: rand(-40, VH), s: rand(0.4, 1),
        vx: kind === 'rain' ? -1.4 : kind === 'snow' ? rand(-0.4, 0.2) : rand(-0.14, 0.14),
        vy: kind === 'rain' ? rand(5, 8) : kind === 'snow' ? rand(0.4, 1.1) : rand(-0.9, -0.3),
        p: rand(0, 6.28),
      });
    }
  }

  // ─────────── 월드 API ───────────

  enemies() { return this.fighters.filter((f) => f !== this.player && !f.removed && !f.dead); }

  takeToken(e) {
    for (const [k] of this.tokenHolders) if (k.removed || k.dead) this.tokenHolders.delete(k);
    if (this.tokenHolders.size >= this.maxTokens) return false;
    this.tokenHolders.set(e, 70);
    return true;
  }
  releaseToken(e, frames) { this.tokenHolders.set(e, frames); }

  fireProjectile(owner, spec) {
    const f = owner.frame();
    const hx = owner.x + owner.dir * (f ? f.hand[0] : 22);
    const hz = f ? -f.hand[1] : 44;
    const mk = (dy, spread) => {
      const st = PROJ_STYLE[spec.kind] || PROJ_STYLE.ki;
      const p = new Projectile({
        world: this, owner, kind: spec.kind, x: hx, y: owner.y + dy, z: hz + owner.z - 34,
        vx: owner.dir * spec.speed, vz: spec.arc ? 3.2 : 0, dir: owner.dir,
        dmg: spec.dmg, hitstun: spec.hitstun, kb: spec.kb, life: spec.life, r: spec.r,
        arc: !!spec.arc, down: !!spec.down, pierce: !!spec.big,
        col: st.col, col2: st.col2,
      });
      this.projs.push(p);
    };
    if (spec.kind === 'weapon') {
      const w = owner.weapon;
      if (!w) return;
      const st = PROJ_STYLE.weapon;
      this.projs.push(new Projectile({
        world: this, owner, kind: 'bottle', x: hx, y: owner.y, z: hz + owner.z - 34,
        vx: owner.dir * 4.2, vz: 1.2, dir: owner.dir, dmg: 24, hitstun: 24, kb: 5,
        life: 120, r: 9, arc: true, down: true, col: st.col, col2: st.col2,
      }));
      owner.weapon = null;
      return;
    }
    if (spec.spread) {
      for (let i = 0; i < spec.spread; i++) mk(spec.fan ? (i - 1) * 12 : (i - 1) * 6, i);
    } else mk(0, 0);
  }

  spawnPickup(kind, x, y) {
    this.pickups.push(new Pickup(kind, x, y, this));
  }

  explode(x, y, r, dmg, from) {
    for (const f of this.fighters) {
      if (f === this.player || f.dead || f.removed) continue;
      if (Math.abs(f.x - x) < r && Math.abs(f.y - y) < 26) {
        f.takeHit({ dmg, hitstun: 24, blockstun: 12, hitstop: 10, kb: 6, lift: 3, down: true, spark: 'burst' },
          { x, dir: f.x > x ? 1 : -1, isPlayer: true, move: null });
      }
    }
  }

  onPlayerHit(target, dmg) {
    this.combo++; this.comboT = 100;
    this.stats.hits++;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    this.score += Math.round(dmg * 10 * (1 + this.combo * 0.08));
    this.player.onHitLanded();
    // 숨김 요소: 40히트 이상 콤보 → 기 게이지 전개
    if (this.combo === 40 && !this.hidden.rageBonus) {
      this.hidden.rageBonus = true;
      this.player.meter = this.player.maxMeter;
      this.showMsg('격노 각성! 기 게이지 최대', 'secret');
      FXM.flash(0.6, '#ffd0ff'); sfx('unlock');
      this.stats.secrets++;
    }
  }

  onPlayerDamaged() { this.combo = 0; this.comboT = 0; }

  onDeath(f) {
    if (f === this.player) return;
    this.score += f.score || 100;
    this.stats.kills++;
    this.tokenHolders.delete(f);
    if (f === this.boss) {
      this.bossDeadT = 1;
      FXM.flash(0.9, '#ffffff');
      this.slowmo = 130;
      sfx('ko');
    }
  }

  showMsg(text, kind = 'info') { this.msg = { text, kind }; this.msgT = 150; }

  trySecret(p) {
    const s = this.sec.secret;
    if (this.room || !s) return false;
    if (Math.abs(p.x - s.x) > 36 || Math.abs(p.y - s.y) > 22) return false;
    if (this.hidden.rooms[s.room]) return false;
    this.enterRoom(s.room);
    return true;
  }

  enterRoom(id) {
    const def = ROOMS[id];
    this.roomReturn = {
      sectionIdx: this.sectionIdx, waveIdx: this.waveIdx, waveState: this.waveState,
      cam: this.cam, camLocked: this.camLocked, px: this.player.x, py: this.player.y,
      fighters: this.fighters, props: this.props, pickups: this.pickups, projs: this.projs,
      theme: this.theme, vents: this.vents,
    };
    this.hidden.rooms[id] = true;
    this.stats.secrets++;
    this.room = { id, def };
    this.theme = loadTheme(def.theme);
    this.fighters = [this.player]; this.props = []; this.pickups = []; this.projs = [];
    this.buildSection(def);
    this.vents = [];
    this.cam = 0; this.camLocked = false;
    // 이전 구간 기준 바운드가 남아 있으면 플레이어가 출구 밖으로 클램프되어 즉시 되돌아온다
    this.bounds = { x0: 4, x1: def.len - 6 };
    this.roomGrace = 30;
    this.player.x = 40; this.player.y = 220; this.player.z = 0;
    this.player.move = null; this.player.state = 'idle';
    this.initAmbient();
    FXM.flash(0.8, '#ffffff');
    sfx('unlock');
    this.showMsg(`비밀 통로 발견 — ${def.name}`, 'secret');
  }

  exitRoom() {
    const r = this.roomReturn;
    this.room = null;
    this.theme = r.theme;
    this.fighters = r.fighters; this.props = r.props; this.pickups = r.pickups; this.projs = r.projs;
    this.sectionIdx = r.sectionIdx; this.waveIdx = r.waveIdx; this.waveState = r.waveState;
    this.cam = r.cam; this.camLocked = r.camLocked; this.vents = r.vents;
    this.bounds = { x0: this.cam + 4, x1: this.sec.len - 6 };
    this.player.x = r.px + 30; this.player.y = r.py;
    this.player.move = null; this.player.state = 'idle';
    this.initAmbient();
    FXM.flash(0.6, '#ffffff');
  }

  // ─────────── 루프 ───────────

  update() {
    this.tick++;
    if (this.msgT > 0) this.msgT--;
    if (this.slowmo > 0) this.slowmo--;
    this.timeScale = this.slowmo > 0 ? 0.28 : 1;

    if (this.state === 'intro') {
      this.introT++;
      if (this.introT > 150) { this.state = 'play'; }
      this.updateAmbient();
      return;
    }
    if (this.state === 'clear') { this.clearT++; this.updateAmbient(); return; }
    if (this.state === 'over') {
      this.continueT -= 1 / 60;
      this.updateAmbient();
      if (this.continueT <= 0) { this.state = 'gameover'; reportRun(this, false); }
      return;
    }
    if (this.state !== 'play') { this.updateAmbient(); return; }

    if (FXM.FX.hitstop > 0) { FXM.updateFx(); return; }

    for (const [k, v] of this.tokenHolders) {
      if (k.removed || k.dead) this.tokenHolders.delete(k);
      else if (v <= 0) this.tokenHolders.delete(k);
      else this.tokenHolders.set(k, v - 1);
    }

    this.updateBounds();
    for (const f of this.fighters) f.update();
    for (const p of this.props) p.update();
    for (const p of this.pickups) p.update();
    for (const p of this.projs) { p.update(); p.hitCheck(p.owner === this.player ? this.enemies() : [this.player]); }
    this.resolveHits();
    this.separate();
    this.pickupCheck();
    this.updateVents();
    this.updateCam();
    this.waveTick();
    this.updateAmbient();
    FXM.updateFx();

    if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;

    this.fighters = this.fighters.filter((f) => !f.removed);
    this.props = this.props.filter((p) => !p.removed);
    this.pickups = this.pickups.filter((p) => !p.removed);
    this.projs = this.projs.filter((p) => !p.removed);

    // 비밀 통로 안내
    this.prompt = null;
    const s = this.sec.secret;
    if (s && !this.room && !this.hidden.rooms[s.room]
      && Math.abs(this.player.x - s.x) < 40 && Math.abs(this.player.y - s.y) < 26) {
      this.prompt = { x: s.x, y: s.y, text: '↓ + U' };
    }
    if (this.roomGrace > 0) this.roomGrace--;
    else if (this.room && this.player.x > this.sec.len - 46) this.exitRoom();

    this.deathCheck();
  }

  updateBounds() {
    const len = this.sec.len;
    if (this.camLocked) this.bounds = { x0: this.cam + 6, x1: this.cam + VW - 6 };
    else this.bounds = { x0: this.cam + 4, x1: len - 6 };
  }

  updateCam() {
    const len = this.sec.len;
    const maxCam = Math.max(0, len - VW);
    if (this.camLocked) {
      this.cam += (this.camLock - this.cam) * 0.14;
    } else {
      const t = clamp(this.player.x - VW * 0.4, 0, maxCam);
      this.cam += (t - this.cam) * 0.1;
    }
    this.cam = clamp(this.cam, 0, maxCam);
  }

  waveTick() {
    if (this.room) return;
    const s = this.sec;
    const waves = s.waves || [];
    if (this.waveState === 'walk') {
      const w = waves[this.waveIdx];
      if (!w) { this.waveState = 'cleared'; this.goT = 1; return; }
      if (this.player.x >= w.at) {
        this.waveState = 'fight';
        this.camLocked = true;
        this.camLock = clamp(w.at - VW * 0.45, 0, Math.max(0, s.len - VW));
        this.spawnQueue = [...w.list, ...(w.adds || [])];
        this.spawnT = 20;
        this.curWave = w;
        if (w.boss) {
          playBgm('boss');
          sfx('boss');
          this.showMsg(`보스 — ${w.list[0] === 'bossHidden' ? '심연의 진' : ''}`, 'boss');
        }
      }
    } else if (this.waveState === 'fight') {
      const alive = this.enemies().length;
      const w = this.curWave;
      if (this.spawnQueue.length && alive < w.max && --this.spawnT <= 0) {
        this.spawnEnemy(this.spawnQueue.shift(), !!w.boss && this.spawnQueue.length === (w.adds || []).length);
        this.spawnT = 46;
      }
      // 스폰 직후 갱신된 수를 다시 센다 — 마지막 한 마리가 나온 프레임에 클리어되는 걸 막는다
      if (!this.spawnQueue.length && this.enemies().length === 0) {
        this.waveIdx++;
        this.camLocked = false;
        this.boss = null;
        if (this.waveIdx >= waves.length) {
          this.waveState = 'cleared';
          this.goT = 1;
          if (s.boss) this.finishStage();
        } else {
          this.waveState = 'walk';
          sfx('go');
        }
      }
    } else if (this.waveState === 'cleared') {
      this.goT++;
      if (this.player.x > s.len - 66) {
        if (this.sectionIdx + 1 < this.stage.sections.length) {
          this.startSection(this.sectionIdx + 1);
          sfx('select');
        }
      }
    }
  }

  spawnEnemy(id, isBoss) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side > 0 ? this.cam + VW + 26 : this.cam - 26;
    const y = randInt(GROUND_TOP + 8, GROUND_BOT - 4);
    const diff = 1 + this.stageIdx * 0.12;
    const e = new Enemy(id, clamp(x, 10, this.sec.len - 10), y, this, {
      entering: true, spawnSide: side, difficulty: diff,
    });
    e.spawnSide = side;
    e.dir = side > 0 ? -1 : 1;
    if (isBoss || e.isBoss) { this.boss = e; e.entering = false; e.x = side > 0 ? this.cam + VW - 50 : this.cam + 50; }
    this.fighters.push(e);
  }

  finishStage() {
    this.state = 'clear';
    this.clearT = 0;
    stopBgm();
    playBgm('victory');
    this.score += 5000 + this.player.lives * 2000;
  }

  nextStage() {
    const goHidden = this.stageIdx === 2 && this.hidden.scrolls >= 3;
    if (goHidden) { this.loadStage(3); return; }
    if (this.stageIdx >= 2) { this.state = 'ending'; reportRun(this, true); stopBgm(); playBgm('victory'); return; }
    if (this.stageIdx === 3) { this.state = 'ending'; reportRun(this, true); return; }
    this.loadStage(this.stageIdx + 1);
  }

  deathCheck() {
    const p = this.player;
    if (!p.dead) { this.deathT = 0; return; }
    this.deathT++;
    if (this.deathT === 1) { sfx('dead'); this.combo = 0; }
    if (this.deathT > 130) {
      p.lives--;
      if (p.lives >= 0) {
        p.respawn(clamp(this.cam + VW * 0.3, this.bounds.x0 + 20, this.bounds.x1 - 20), 220);
        this.deathT = 0;
      } else if (this.credits > 0) {
        this.state = 'over';
        this.continueT = 10;
      } else {
        this.state = 'gameover';
        reportRun(this, false);
      }
    }
  }

  useContinue() {
    this.credits--;
    this.player.lives = 2;
    this.player.respawn(clamp(this.cam + VW * 0.3, 20, this.sec.len - 20), 220);
    this.player.meter = 100;
    this.deathT = 0;
    this.state = 'play';
    playBgm(this.stage.bgm);
  }

  // ─────────── 판정 ───────────

  resolveHits() {
    for (const a of this.fighters) {
      if (a.removed || !a.move) continue;
      // 던지기: 판정 전에 대상을 앞에 배치한다
      if (a.throwTarget && a.mf >= a.move.startup) {
        const t = a.throwTarget;
        a.throwTarget = null;
        if (t && !t.removed) { t.x = a.x + a.dir * 22; t.y = a.y; t.z = 4; t.invuln = 0; }
      }
      const hits = a.activeHits();
      if (!hits) continue;
      const targets = a === this.player
        ? [...this.fighters.filter((f) => f !== a), ...this.props]
        : [this.player];
      for (const h of hits) {
        const key = h.at;
        const cx = a.x + a.dir * h.box[0];
        const hw = h.box[2] / 2;
        const z0 = a.z + h.box[1] - h.box[3] / 2;
        const z1 = a.z + h.box[1] + h.box[3] / 2;
        for (const t of targets) {
          if (t.removed || (t.dead && !t.isProp)) continue;
          const id = `${key}:${t.eid ?? (t.eid = ++EID)}`;
          if (a.hitDone.has(id)) continue;
          if (Math.abs(t.y - a.y) > (h.depth || DEPTH_HIT) + (t.isProp ? 6 : 0)) continue;
          if (Math.abs(t.x - cx) > hw + t.w) continue;
          const tz0 = t.z, tz1 = t.z + (t.hitH || t.height);
          if (z1 < tz0 || z0 > tz1) continue;
          a.hitDone.add(id);
          const res = t.takeHit(h, a);
          if (res && a === this.player) {
            this.player.onHitLanded();
            if (a.weapon && a.moveId === 'wpSwing' && !t.isProp) {
              a.weapon.uses--;
              if (a.weapon.uses <= 0) { a.weapon = null; this.showMsg('무기가 부서졌다', 'info'); }
            }
          }
        }
      }
    }
  }

  separate() {
    const list = this.fighters.filter((f) => !f.removed && f.state !== 'down' && !f.grabbedBy);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (Math.abs(a.y - b.y) > 7) continue;
        if (Math.abs(a.z - b.z) > 30) continue;
        const dx = b.x - a.x;
        const min = a.w + b.w - 3;
        if (Math.abs(dx) < min) {
          const push = (min - Math.abs(dx)) * 0.24 * (dx >= 0 ? 1 : -1);
          if (a !== this.player) a.x -= push;
          if (b !== this.player) b.x += push;
          if (a === this.player) a.x -= push * 0.35;
          if (b === this.player) b.x += push * 0.35;
        }
      }
    }
  }

  pickupCheck() {
    const p = this.player;
    if (p.dead) return;
    for (const it of this.pickups) {
      if (it.removed || it.z > 12) continue;
      if (Math.abs(it.x - p.x) > 18 || Math.abs(it.y - p.y) > 14) continue;
      it.removed = true;
      const d = it.p;
      if (d.weapon) {
        p.weapon = { kind: d.weapon, uses: WEAPONS[d.weapon].uses };
        this.showMsg(`${d.label} 획득 — 강공격이 무기 공격으로`, 'item');
        sfx('metal');
      } else if (d.scroll) {
        this.hidden.scrolls++; p.scrolls = this.hidden.scrolls;
        if (!this.hidden.unlocked) {
          this.hidden.unlocked = true; p.hiddenUnlocked = true;
          try { localStorage.setItem('rfs_hidden', '1'); } catch (e) { /* noop */ }
          this.showMsg('히든 초필살기 해금 — 천붕패황권 (↓↙← ↓↙← + K)', 'secret');
        } else {
          this.showMsg(`봉인 두루마리 ${this.hidden.scrolls}/3`, 'secret');
        }
        FXM.flash(0.7, '#ffe8c0');
        sfx('unlock');
        this.score += 2000;
      } else {
        if (d.heal) { p.hp = clamp(p.hp + d.heal, 0, p.maxHp); FXM.popup(p.x, p.y - 70, `+${d.heal}`, 'heal'); }
        if (d.meter) { p.meter = clamp(p.meter + d.meter, 0, p.maxMeter); FXM.popup(p.x, p.y - 70, '기 회복', 'meter'); }
        if (d.life) { p.lives++; FXM.popup(p.x, p.y - 70, '1UP', 'heal'); }
        if (d.score) { this.score += d.score; FXM.popup(p.x, p.y - 84, `+${d.score}`, 'score'); }
        sfx(d.score >= 1000 ? 'coin' : 'pickup');
      }
    }
  }

  updateVents() {
    for (const v of this.vents) {
      v.t = (v.t + 1) % 170;
      const active = v.t > 60 && v.t < 110;
      v.active = active;
      if (active && v.t % 4 === 0) FXM.embers(v.x, GROUND_BOT - 6, 2, '#ffb44a');
      if (!active) continue;
      for (const f of this.fighters) {
        if (f.removed || f.dead || f.invuln > 0 || f.z > 34) continue;
        if (Math.abs(f.x - v.x) > 16) continue;
        if (f.ventCd > 0) { f.ventCd--; continue; }
        f.ventCd = 40;
        f.takeHit({ dmg: 12, hitstun: 20, blockstun: 10, hitstop: 6, kb: 2, lift: 2.4, down: true, spark: 'burst' },
          { x: v.x, dir: f.x > v.x ? 1 : -1, isPlayer: false, move: null });
      }
    }
    for (const f of this.fighters) if (f.ventCd > 0) f.ventCd--;
  }

  updateAmbient() {
    const kind = this.theme?.ambient;
    if (!kind) return;
    for (const a of this.ambient) {
      a.x += a.vx * (kind === 'snow' ? 1 : 1) + (kind === 'snow' ? Math.sin(this.tick * 0.02 + a.p) * 0.3 : 0);
      a.y += a.vy;
      if (a.y > VH + 10 || a.y < -50 || a.x < -30 || a.x > VW + 40) {
        a.x = rand(-20, VW + 30);
        a.y = kind === 'ember' || kind === 'void' ? VH + rand(0, 30) : rand(-40, -5);
      }
    }
  }

  // ─────────── 렌더 ───────────

  render(ctx) {
    const cam = this.cam;
    const variant = this.room ? this.room.def.variant : this.sec.variant;
    drawBackground(ctx, this.theme, cam, variant);
    this.drawAmbient(ctx, false);

    // 비밀 통로 표식
    const s = this.sec.secret;
    if (s && !this.room && !this.hidden.rooms[s.room]) {
      const x = s.x - cam;
      ctx.fillStyle = 'rgba(20,18,28,0.5)';
      ctx.beginPath(); ctx.ellipse(x, s.y, 15, 5, 0, 0, 6.284); ctx.fill();
      ctx.strokeStyle = rgba('#d8c88a', 0.35 + Math.sin(this.tick * 0.08) * 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, s.y, 13, 4, 0, 0, 6.284); ctx.stroke();
      ctx.fillStyle = rgba('#ffe8a0', 0.5 + Math.sin(this.tick * 0.14) * 0.3);
      ctx.fillRect(x - 1, s.y - 1, 2, 2);
    }
    if (this.room) {
      const ex = this.sec.len - 30 - cam;
      ctx.fillStyle = 'rgba(255,235,160,0.16)';
      ctx.fillRect(ex - 14, GROUND_TOP - 40, 28, 100);
      ctx.fillStyle = rgba('#ffe8a0', 0.6 + Math.sin(this.tick * 0.1) * 0.3);
      ctx.fillRect(ex - 12, 150, 24, 2);
    }

    // 화염 분출구
    for (const v of this.vents) {
      const x = v.x - cam;
      ctx.fillStyle = '#3a2018';
      ctx.fillRect(x - 12, GROUND_BOT - 4, 24, 5);
      ctx.fillStyle = '#e0a03a';
      ctx.fillRect(x - 10, GROUND_BOT - 3, 20, 2);
      if (v.t > 44 && v.t <= 60) {
        ctx.fillStyle = rgba('#ff8a2c', 0.3 + Math.sin(this.tick * 0.6) * 0.2);
        ctx.fillRect(x - 10, GROUND_BOT - 6, 20, 4);
      }
      if (v.active) {
        const h = 40 + Math.sin(this.tick * 0.5) * 12;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, GROUND_BOT - h, 0, GROUND_BOT);
        g.addColorStop(0, 'rgba(255,240,180,0)');
        g.addColorStop(0.4, 'rgba(255,160,50,0.75)');
        g.addColorStop(1, 'rgba(255,220,140,0.95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 11, GROUND_BOT);
        ctx.quadraticCurveTo(x - 6, GROUND_BOT - h * 0.6, x, GROUND_BOT - h);
        ctx.quadraticCurveTo(x + 6, GROUND_BOT - h * 0.6, x + 11, GROUND_BOT);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // 깊이 정렬
    const list = [...this.fighters, ...this.props, ...this.pickups].filter((e) => !e.removed);
    list.sort((a, b) => (a.y - b.y) || ((a.isProp ? 0 : 1) - (b.isProp ? 0 : 1)));
    for (const e of list) {
      if (e.x - cam < -80 || e.x - cam > VW + 80) continue;
      e.render(ctx, cam);
    }
    for (const p of this.projs) p.render(ctx, cam);

    FXM.drawParticles(ctx, cam);
    drawForeground(ctx, this.theme, cam);
    this.drawAmbient(ctx, true);

    // 색 보정 + 비네트
    ctx.fillStyle = this.theme.tint;
    ctx.fillRect(0, 0, VW, VH);
    if (!this.vignette) this.vignette = makeVignette();
    ctx.drawImage(this.vignette, 0, 0);

    // 진행 방향 화살표
    if (this.waveState === 'cleared' && !this.room && (this.goT >> 4) % 2 === 0) {
      this.drawGoArrow(ctx);
    }
  }

  drawGoArrow(ctx) {
    const x = VW - 44, y = 92;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,220,90,0.9)';
    ctx.beginPath();
    ctx.moveTo(x, y - 9); ctx.lineTo(x + 18, y); ctx.lineTo(x, y + 9);
    ctx.lineTo(x, y + 4); ctx.lineTo(x - 16, y + 4); ctx.lineTo(x - 16, y - 4); ctx.lineTo(x, y - 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawAmbient(ctx, front) {
    const kind = this.theme?.ambient;
    if (!kind) return;
    for (const a of this.ambient) {
      const isFront = a.s > 0.72;
      if (isFront !== front) continue;
      const al = 0.2 + a.s * 0.5;
      if (kind === 'rain') {
        ctx.strokeStyle = rgba('#b8d0f0', al * 0.7);
        ctx.lineWidth = a.s > 0.8 ? 1.4 : 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx * 1.6, a.y - a.vy * 1.6); ctx.stroke();
      } else if (kind === 'snow') {
        ctx.fillStyle = rgba('#ffffff', al);
        const r = a.s * 1.6;
        ctx.fillRect(a.x, a.y, r, r);
      } else if (kind === 'ember') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('#ff9a3c', al * 0.9);
        ctx.fillRect(a.x, a.y, a.s * 1.6, a.s * 1.6);
        ctx.restore();
      } else {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('#c88aff', al * 0.8);
        ctx.fillRect(a.x, a.y, a.s * 1.8, a.s * 1.8);
        ctx.restore();
      }
    }
  }
}

let EID = 0;

let vignetteCache = null;
function makeVignette() {
  if (vignetteCache) return vignetteCache;
  const cv = document.createElement('canvas');
  cv.width = VW; cv.height = VH;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(VW / 2, VH * 0.5, VH * 0.32, VW / 2, VH * 0.5, VH * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.65, 'rgba(6,4,12,0.18)');
  g.addColorStop(1, 'rgba(6,4,12,0.5)');
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  const top = c.createLinearGradient(0, 0, 0, 34);
  top.addColorStop(0, 'rgba(6,4,12,0.34)'); top.addColorStop(1, 'rgba(6,4,12,0)');
  c.fillStyle = top; c.fillRect(0, 0, VW, 34);
  vignetteCache = cv;
  return cv;
}
