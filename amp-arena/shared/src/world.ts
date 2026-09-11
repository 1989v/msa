// 월드: 플레이어 전부 + 판정 + 투사체 + 아이템 + 매치 흐름. 서버가 권위로 돌리고, 클라는 자기 캐릭터만 예측한다.
import * as C from './constants.ts';
import { makeRng, yawFromDir, dirX, dirZ } from './math.ts';
import { type Input, EMPTY_INPUT } from './input.ts';
import { MOVES, type MoveId, type MoveDef, isActiveAt, PROJECTILE_MOVES, CRATE_HIT, BOMB_HIT } from './moves.ts';
import { MAPS, type MapDef, type MapId, type Spawn, type Box, type Pad } from './maps.ts';
import { MODES, type ModeDef, type ModeId } from './modes.ts';
import { type Player, type SimContext, stepPlayer, createPlayer, canBeHit, isSolid, applyDamage, setState, respawn, facingX, facingZ, supportHeight } from './player.ts';
import { ACCESSORIES, type AccessoryId } from './accessories.ts';
import type { StyleId } from './styles.ts';
import { allowedAccessory } from './styles.ts';
import {
  type Item, type ItemKind, createItem, CRATE_RESPAWN_TICKS, CRATE_BREAK_RADIUS, BOMB_FUSE_TICKS, BOMB_RADIUS, HEART_HEAL,
  PICKUP_RANGE, THROW_ITEM_VEL_H, THROW_ITEM_VEL_V, DROP_HEART, DROP_BOMB,
} from './items.ts';

export interface Projectile {
  id: number; owner: number; move: MoveId;
  x: number; y: number; z: number; vx: number; vz: number;
  life: number; radius: number; hitMask: number; pierce: boolean;
}

export type HitKind = 'hit' | 'guard' | 'guardBreak' | 'throw' | 'wall';
export type WorldEvent =
  | { t: 'hit'; a: number; v: number; dmg: number; x: number; y: number; z: number; kind: HitKind; launch: boolean }
  | { t: 'ko'; a: number; v: number; cause: 'hit' | 'fall' | 'throw' }
  | { t: 'grab'; a: number; v: number }
  | { t: 'respawn'; id: number }
  | { t: 'phase'; phase: 'countdown' | 'play' | 'ended' }
  | { t: 'shot'; id: number; x: number; y: number; z: number; move: MoveId }
  | { t: 'pickup'; id: number; item: number; kind: ItemKind }
  | { t: 'explode'; x: number; y: number; z: number }
  | { t: 'crateBreak'; x: number; y: number; z: number; drop: 'heart' | 'bomb' | null }
  | { t: 'heal'; id: number; amount: number }
  | { t: 'pad'; id: number; x: number; y: number; z: number }
  | { t: 'end'; ranking: RankEntry[] };

export interface RankEntry { id: number; name: string; team: number; kos: number; deaths: number; dmg: number; alive: boolean; hp: number; rank: number; win: boolean }

export interface WorldConfig { mapId: MapId; modeId: ModeId; seconds: number; seed: number }

export class World implements SimContext {
  tick = 0;
  phase: 'countdown' | 'play' | 'ended' = 'countdown';
  phaseT = 0;
  timeLeft: number;
  map: MapDef;
  mode: ModeDef;
  teams: boolean;
  players: (Player | undefined)[] = new Array(C.MAX_PLAYERS).fill(undefined);
  projectiles: Projectile[] = [];
  items: Item[] = [];
  nextProjId = 1;
  nextItemId = 1;
  crateTimers: number[] = [];
  events: WorldEvent[] = [];
  rng: () => number;
  score: [number, number] = [0, 0];
  ranking: RankEntry[] = [];
  readonly cfg: WorldConfig;

  constructor(cfg: WorldConfig) {
    this.cfg = cfg;
    this.map = MAPS[cfg.mapId];
    this.mode = MODES[cfg.modeId];
    this.teams = this.mode.teams;
    this.timeLeft = Math.max(30, cfg.seconds) * C.TICK_RATE;
    this.rng = makeRng(cfg.seed);
    this.map.crates.forEach((c, i) => {
      this.items.push(createItem(this.nextItemId++, 'crate', c.x, c.y, c.z, i));
      this.crateTimers[i] = 0;
    });
  }

  addPlayer(id: number, name: string, team: number, acc: AccessoryId, bot: boolean, style: StyleId = 'fighter'): Player {
    const p = createPlayer(id, name, this.teams ? team : 0, allowedAccessory(style, acc), bot, this.mode.lives, style);
    const s = this.spawnFor(p);
    p.pos.x = s.x; p.pos.y = s.y; p.pos.z = s.z;
    p.yaw = yawFromDir(-s.x, -s.z);
    this.players[id] = p;
    return p;
  }

  removePlayer(id: number): void {
    const p = this.players[id];
    if (!p) return;
    this.releaseGrabs(p);
    if (p.holding >= 0) this.dropHeld(p);
    this.players[id] = undefined;
  }

  get alivePlayers(): Player[] {
    return this.players.filter((p): p is Player => !!p && p.alive);
  }

  spawnFor(p: Player): Spawn {
    const all = this.map.spawns;
    const pool = this.teams ? all.filter((s) => s.team === p.team) : all;
    const list = pool.length ? pool : all;
    let best = list[p.id % list.length], bestD = -1;
    for (const s of list) {
      let dmin = Infinity;
      for (const q of this.players) {
        if (!q || q === p || q.state === 'dead') continue;
        dmin = Math.min(dmin, Math.hypot(q.pos.x - s.x, q.pos.z - s.z));
      }
      if (dmin > bestD) { bestD = dmin; best = s; }
    }
    return best;
  }

  /** 한 틱. inputs[id] 가 없으면 그 플레이어의 마지막 입력을 다시 쓴다. */
  step(inputs: (Input | undefined)[]): WorldEvent[] {
    this.events = [];
    this.tick++;
    this.phaseT++;
    if (this.phase === 'countdown' && this.phaseT >= C.COUNTDOWN_TICKS) this.setPhase('play');
    else if (this.phase === 'play') this.timeLeft--;
    for (const p of this.players) {
      if (!p) continue;
      const input = inputs[p.id] ?? p.lastInput ?? EMPTY_INPUT;
      stepPlayer(this, p, input);
    }
    this.syncHeld();
    this.separatePlayers();
    if (this.phase === 'play') {
      this.resolveHits();
      this.stepProjectiles();
      this.stepItems();
    }
    this.handleDeaths();
    if (this.phase === 'play') this.checkEnd();
    return this.events;
  }

  /** 클라 예측: 내 캐릭터만 한 틱 돌린다 (판정 없음). */
  stepLocal(id: number, input: Input): void {
    const p = this.players[id];
    if (!p) return;
    stepPlayer(this, p, input);
    if (p.state === 'held') this.syncHeld();
  }

  private setPhase(ph: 'countdown' | 'play' | 'ended'): void {
    this.phase = ph;
    this.phaseT = 0;
    this.events.push({ t: 'phase', phase: ph });
  }

  // ---- SimContext ----
  onWallHit(p: Player): void {
    const a = this.players[p.lastHitBy] ?? null;
    const dmg = applyDamage(this, p, a, C.THROW_WALL_BONUS);
    this.events.push({ t: 'hit', a: a ? a.id : -1, v: p.id, dmg, x: p.pos.x, y: p.pos.y + C.BODY_HEIGHT, z: p.pos.z, kind: 'wall', launch: false });
    if (p.hp <= 0) this.kill(p, 'throw', a);
  }

  onFall(p: Player): void {
    if (p.state === 'dead') {
      p.vel.x = p.vel.y = p.vel.z = 0; p.grounded = true;
      return;
    }
    this.kill(p, 'fall', null);
  }

  onProjectile(p: Player, move: MoveId): void {
    const spec = PROJECTILE_MOVES[move];
    if (!spec) return;
    const n = spec.fanCount;
    const ox = p.pos.x + facingX(p) * 0.6, oz = p.pos.z + facingZ(p) * 0.6, oy = p.pos.y + C.HIT_HEIGHT;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? ((i - (n - 1) / 2) * spec.fanDeg) / (n - 1) : 0;
      const yaw = p.yaw + (off * Math.PI) / 180;
      this.projectiles.push({
        id: this.nextProjId++, owner: p.id, move,
        x: ox, y: oy, z: oz, vx: dirX(yaw) * spec.speed, vz: dirZ(yaw) * spec.speed,
        life: Math.ceil((spec.range / spec.speed) * C.TICK_RATE), radius: spec.radius, hitMask: 0, pierce: false,
      });
    }
    this.events.push({ t: 'shot', id: p.id, x: ox, y: oy, z: oz, move });
  }

  /** 바닥에 놓인 상자는 1m 상자로 막힌다 (들려 있거나 날아가는 중이면 아니다) */
  solidCrates(): Box[] {
    const out: Box[] = [];
    for (const it of this.items) {
      if (it.kind !== 'crate' || it.heldBy >= 0 || it.airborne) continue;
      out.push({ minX: it.x - 0.5, maxX: it.x + 0.5, minY: it.y, maxY: it.y + 1, minZ: it.z - 0.5, maxZ: it.z + 0.5 });
    }
    return out;
  }

  onPad(p: Player, pad: Pad): void {
    this.events.push({ t: 'pad', id: p.id, x: pad.x, y: pad.y, z: pad.z });
  }

  tryPickup(p: Player): boolean {
    let best: Item | null = null, bestD = PICKUP_RANGE;
    for (const it of this.items) {
      if (it.kind === 'heart' || it.heldBy >= 0 || it.airborne) continue;
      if (Math.abs(it.y - p.pos.y) > 1.5) continue;
      const d = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) return false;
    best.heldBy = p.id;
    best.vx = best.vy = best.vz = 0;
    if (best.kind === 'bomb' && best.fuse < 0) best.fuse = BOMB_FUSE_TICKS;
    p.holding = best.id;
    this.events.push({ t: 'pickup', id: p.id, item: best.id, kind: best.kind });
    return true;
  }

  dropHeld(p: Player): void {
    const it = this.items.find((i) => i.id === p.holding);
    p.holding = -1;
    if (!it) return;
    it.heldBy = -1;
    it.x = p.pos.x + facingX(p) * 0.7; it.z = p.pos.z + facingZ(p) * 0.7; it.y = p.pos.y + 0.6;
    it.vx = 0; it.vz = 0; it.vy = 0;
    it.airborne = true;
    it.thrownBy = -1;
  }

  throwHeld(p: Player): void {
    const it = this.items.find((i) => i.id === p.holding);
    p.holding = -1;
    if (!it) return;
    it.heldBy = -1;
    it.x = p.pos.x + facingX(p) * 0.8; it.z = p.pos.z + facingZ(p) * 0.8; it.y = p.pos.y + 1.6;
    it.vx = facingX(p) * THROW_ITEM_VEL_H + p.vel.x * 0.5; it.vz = facingZ(p) * THROW_ITEM_VEL_H + p.vel.z * 0.5; it.vy = THROW_ITEM_VEL_V;
    it.airborne = true;
    it.thrownBy = p.id;
  }

  // ---- 판정 ----
  private resolveHits(): void {
    for (const a of this.players) {
      if (!a || !a.move) continue;
      if (a.state !== 'attack' && a.state !== 'special' && a.state !== 'dashAttack' && a.state !== 'jumpAttack') continue;
      const m = MOVES[a.move];
      if (PROJECTILE_MOVES[a.move] || m.damage <= 0) continue;
      const active = m.activeUntilLand ? a.t >= m.startup : isActiveAt(m, a.t);
      if (!active) continue;
      // 다단 히트: 일정 틱마다 같은 상대를 다시 때릴 수 있다 (회전 발차기)
      if (m.multiHit > 0 && a.t > m.startup && (a.t - m.startup) % m.multiHit === 0) a.hitMask = 0;
      const fx = facingX(a), fz = facingZ(a);
      const cx = a.pos.x + fx * m.reach, cz = a.pos.z + fz * m.reach;
      const cy = a.pos.y + (a.state === 'jumpAttack' ? 0.3 : C.HIT_HEIGHT);
      const rr = (m.radius + C.BODY_RADIUS) ** 2;
      const arcCos = m.arcDeg >= 360 ? -2 : Math.cos((m.arcDeg / 2) * (Math.PI / 180));
      for (const v of this.players) {
        if (!v || v === a || !canBeHit(v) || (a.hitMask & (1 << v.id)) !== 0) continue;
        if ((v.state === 'launched' || v.state === 'thrown') && v.juggled) continue;
        const dx = v.pos.x - cx, dy = v.pos.y + C.BODY_HEIGHT - cy, dz = v.pos.z - cz;
        if (dx * dx + dy * dy + dz * dz > rr) continue;
        if (arcCos > -2) {
          const ddx = v.pos.x - a.pos.x, ddz = v.pos.z - a.pos.z;
          const d = Math.hypot(ddx, ddz);
          if (d > 1e-6 && (ddx * fx + ddz * fz) / d < arcCos) continue;
        }
        a.hitMask |= 1 << v.id;
        this.hitPlayer(a, v, m, a.pos.x, a.pos.z);
      }
      for (const it of this.items) {
        if (it.kind !== 'crate' || it.heldBy >= 0) continue;
        // 상자는 몸에서 판정 중심까지 이어지는 선분에 걸리면 맞는다 — 붙어 서서 때려도 들어간다 (2차 소감: 판정이 좁다)
        if (Math.abs(it.y + 0.5 - cy) > 1.2) continue;
        const sx = a.pos.x, sz = a.pos.z, ex = cx, ez = cz;
        const lx = ex - sx, lz = ez - sz, ll = lx * lx + lz * lz;
        const tt = ll > 1e-6 ? Math.max(0, Math.min(1, ((it.x - sx) * lx + (it.z - sz) * lz) / ll)) : 0;
        const qx = sx + lx * tt, qz = sz + lz * tt;
        if (Math.hypot(it.x - qx, it.z - qz) > m.radius + 0.75) continue;
        this.hitCrate(it, a, m.damage);
      }
    }
  }

  private stepProjectiles(): void {
    const keep: Projectile[] = [];
    for (const pr of this.projectiles) {
      pr.x += pr.vx * C.DT; pr.z += pr.vz * C.DT; pr.life--;
      let dead = pr.life <= 0;
      const owner = this.players[pr.owner] ?? null;
      const m = MOVES[pr.move];
      if (!dead) {
        for (const v of this.players) {
          if (!v || v.id === pr.owner || !canBeHit(v) || (pr.hitMask & (1 << v.id)) !== 0) continue;
          const dx = v.pos.x - pr.x, dy = v.pos.y + C.BODY_HEIGHT - pr.y, dz = v.pos.z - pr.z;
          if (dx * dx + dy * dy + dz * dz > (pr.radius + C.BODY_RADIUS) ** 2) continue;
          pr.hitMask |= 1 << v.id;
          this.hitPlayer(owner, v, m, pr.x - pr.vx * 0.1, pr.z - pr.vz * 0.1);
          if (!pr.pierce) { dead = true; break; }
        }
      }
      if (!dead) {
        for (const it of this.items) {
          if (it.kind !== 'crate' || it.heldBy >= 0) continue;
          if (Math.hypot(it.x - pr.x, it.z - pr.z) < pr.radius + 0.6 && Math.abs(it.y + 0.5 - pr.y) < 0.9) { this.hitCrate(it, owner, m.damage); dead = true; break; }
        }
      }
      if (!dead) {
        const map = this.map;
        if (map.wallRadius > 0 && Math.hypot(pr.x, pr.z) > map.wallRadius) dead = true;
        for (const c of map.cylinders) if (Math.hypot(pr.x - c.x, pr.z - c.z) < c.r + pr.radius && pr.y < c.h) dead = true;
        for (const b of map.boxes) if (pr.x > b.minX && pr.x < b.maxX && pr.z > b.minZ && pr.z < b.maxZ && pr.y > b.minY && pr.y < b.maxY) dead = true;
      }
      if (!dead) keep.push(pr);
    }
    this.projectiles = keep;
  }

  // ---- 아이템 ----
  private groundAt(x: number, y: number, z: number, prevY: number): number {
    return supportHeight(this.map, { pos: { x, y, z } } as Player, prevY);
  }

  private stepItems(): void {
    const keep: Item[] = [];
    for (const it of this.items) {
      let remove = false;
      if (it.heldBy >= 0) {
        const h = this.players[it.heldBy];
        if (!h || h.holding !== it.id || h.state === 'dead') { it.heldBy = -1; it.airborne = true; it.thrownBy = -1; if (h) { it.x = h.pos.x; it.z = h.pos.z; it.y = h.pos.y + 0.5; } }
        else { it.x = h.pos.x; it.z = h.pos.z; it.y = h.pos.y + 1.9; }
      } else if (it.airborne) {
        const prevY = it.y;
        it.vy -= C.GRAVITY * C.DT;
        it.x += it.vx * C.DT; it.y += it.vy * C.DT; it.z += it.vz * C.DT;
        // 날아가다 플레이어에 맞으면
        if (it.thrownBy >= 0) {
          for (const v of this.players) {
            if (!v || v.id === it.thrownBy || !canBeHit(v)) continue;
            const th = this.players[it.thrownBy];
            if (Math.hypot(v.pos.x - it.x, v.pos.z - it.z) < 0.75 && it.y > v.pos.y - 0.2 && it.y < v.pos.y + 1.9) {
              if (it.kind === 'crate') { this.breakCrate(it, th ?? null, true); remove = true; }
              else { it.vx = 0; it.vz = 0; it.vy = Math.min(it.vy, 0); }
              break;
            }
          }
        }
        if (!remove) {
          const wallR = this.map.wallRadius;
          if (wallR > 0 && Math.hypot(it.x, it.z) > wallR - 0.4) { const k = (wallR - 0.4) / Math.hypot(it.x, it.z); it.x *= k; it.z *= k; it.vx = 0; it.vz = 0; }
          const g = this.groundAt(it.x, it.y, it.z, prevY);
          if (it.vy <= 0 && it.y <= g + 1e-4) {
            it.y = g; it.vy = 0; it.airborne = false;
            if (it.kind === 'crate' && it.thrownBy >= 0) { this.breakCrate(it, this.players[it.thrownBy] ?? null, true); remove = true; }
            it.vx = 0; it.vz = 0; it.thrownBy = -1;
          }
          if (it.y < this.map.fallY) remove = true;
        }
      }
      if (!remove && it.kind === 'bomb' && it.fuse >= 0) {
        it.fuse--;
        if (it.fuse <= 0) { this.explode(it); remove = true; }
      }
      if (!remove && it.kind === 'heart' && !it.airborne) {
        for (const v of this.players) {
          if (!v || v.state === 'dead' || !v.alive) continue;
          if (Math.hypot(v.pos.x - it.x, v.pos.z - it.z) < 0.9 && Math.abs(v.pos.y - it.y) < 1.2) {
            const before = v.hp;
            v.hp = Math.min(v.maxHp, v.hp + HEART_HEAL);
            this.events.push({ t: 'heal', id: v.id, amount: v.hp - before });
            remove = true;
            break;
          }
        }
      }
      if (!remove) keep.push(it);
    }
    this.items = keep;
    // 상자 재생성 (자리에 사람이 없을 때)
    for (let i = 0; i < this.crateTimers.length; i++) {
      if (this.crateTimers[i] <= 0) continue;
      this.crateTimers[i]--;
      if (this.crateTimers[i] > 0) continue;
      const c = this.map.crates[i];
      const blocked = this.players.some((p) => p && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 1.5);
      if (blocked) { this.crateTimers[i] = 60; continue; }
      this.items.push(createItem(this.nextItemId++, 'crate', c.x, c.y, c.z, i));
    }
  }

  private hitCrate(it: Item, a: Player | null, dmg: number): void {
    if (a && it.lastHitBy === a.id && this.tick - it.lastHitTick < 10) return;
    it.lastHitBy = a ? a.id : -1;
    it.lastHitTick = this.tick;
    it.hp -= Math.max(1, dmg);
    if (it.hp <= 0) {
      this.breakCrate(it, a, false);
      this.items = this.items.filter((x) => x !== it);
    }
  }

  /** 상자 파괴: 던져진 것이면 주변 피해, 드랍 굴림, 자리 재생성 예약 */
  private breakCrate(it: Item, by: Player | null, thrown: boolean): void {
    if (thrown) {
      for (const v of this.players) {
        if (!v || !canBeHit(v) || (by && v.id === by.id)) continue;
        if (Math.hypot(v.pos.x - it.x, v.pos.z - it.z) < CRATE_BREAK_RADIUS && Math.abs(v.pos.y + C.BODY_HEIGHT - it.y) < 1.6) this.hitPlayer(by, v, CRATE_HIT, it.x, it.z);
      }
    }
    const r = this.rng();
    const drop: 'heart' | 'bomb' | null = r < DROP_HEART ? 'heart' : r < DROP_HEART + DROP_BOMB ? 'bomb' : null;
    if (drop) {
      const d = createItem(this.nextItemId++, drop, it.x, it.y, it.z);
      d.airborne = true; d.vy = 2; d.y = it.y + 0.5;
      this.items.push(d);
    }
    if (it.spot >= 0) this.crateTimers[it.spot] = CRATE_RESPAWN_TICKS;
    this.events.push({ t: 'crateBreak', x: it.x, y: it.y + 0.5, z: it.z, drop });
  }

  private explode(it: Item): void {
    const by = this.players[it.thrownBy >= 0 ? it.thrownBy : it.lastHitBy] ?? null;
    for (const v of this.players) {
      if (!v || !canBeHit(v)) continue;
      if (Math.hypot(v.pos.x - it.x, v.pos.z - it.z) < BOMB_RADIUS && Math.abs(v.pos.y - it.y) < 2.5) {
        if (v.holding === it.id) v.holding = -1;
        this.hitPlayer(by && by.id !== v.id ? by : null, v, BOMB_HIT, it.x, it.z);
      }
    }
    for (const c of this.items) {
      if (c.kind === 'crate' && c !== it && c.heldBy < 0 && Math.hypot(c.x - it.x, c.z - it.z) < BOMB_RADIUS) c.hp = -1;
    }
    for (const c of this.items.filter((x) => x.kind === 'crate' && x.hp <= 0)) { this.breakCrate(c, by, false); }
    this.items = this.items.filter((x) => !(x.kind === 'crate' && x.hp <= 0));
    this.events.push({ t: 'explode', x: it.x, y: it.y + 0.5, z: it.z });
  }

  /** 타격 적용: 가드 → 데미지 → 반응(경직/띄움) → 사망 */
  private hitPlayer(a: Player | null, v: Player, m: MoveDef, ox: number, oz: number): void {
    let dx = v.pos.x - ox, dz = v.pos.z - oz;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) { dx = a ? facingX(a) : 0; dz = a ? facingZ(a) : 1; } else { dx /= d; dz /= d; }
    const hx = (v.pos.x + ox) / 2, hz = (v.pos.z + oz) / 2, hy = v.pos.y + C.BODY_HEIGHT;
    const acc = ACCESSORIES[v.acc];
    if (v.state === 'guard' && !m.guardBreak) {
      const toA = -dx * facingX(v) + -dz * facingZ(v);
      if (toA >= Math.cos((acc.guardAngleDeg / 2) * (Math.PI / 180))) {
        v.guard -= m.damage * C.GUARD_COST_MULT;
        v.vel.x = dx * m.push * 0.6; v.vel.z = dz * m.push * 0.6;
        if (v.guard <= 0) {
          if (acc.guardCrushImmune) { v.guard = 1; }
          else {
            v.guard = 0;
            setState(v, 'stun');
            this.events.push({ t: 'hit', a: a ? a.id : -1, v: v.id, dmg: 0, x: hx, y: hy, z: hz, kind: 'guardBreak', launch: false });
            return;
          }
        }
        this.events.push({ t: 'hit', a: a ? a.id : -1, v: v.id, dmg: 0, x: hx, y: hy, z: hz, kind: 'guard', launch: false });
        return;
      }
    }
    // 슈퍼아머: 발동~지속 중인 강공격은 경타에 끊기지 않는다 (데미지는 받는다)
    const vm = v.move ? MOVES[v.move] : null;
    const armored = !!vm && vm.superArmor && (v.state === 'attack' || v.state === 'special') && v.t < vm.startup + vm.active && m.effect === 'hitstun' && v.grounded;
    if (!armored) {
      this.releaseGrabs(v);
      if (v.holding >= 0) this.dropHeld(v);
    }
    const wasAir = v.state === 'launched' || v.state === 'thrown' || !v.grounded;
    const dmg = applyDamage(this, v, a, m.damage);
    if (a && v.consecBy === a.id) v.consecCount++; else { v.consecBy = a ? a.id : -1; v.consecCount = 1; }
    const kb = v.consecCount >= C.CONSEC_HIT_KNOCKBACK_FROM ? 1.5 : 1;
    const launch = m.effect === 'launch' || wasAir;
    this.events.push({ t: 'hit', a: a ? a.id : -1, v: v.id, dmg, x: hx, y: hy, z: hz, kind: 'hit', launch });
    if (v.hp <= 0) { this.kill(v, 'hit', a); return; }
    if (armored) return;
    v.yaw = yawFromDir(-dx, -dz);
    if (launch) {
      v.vel.x = dx * m.launchH * kb; v.vel.z = dz * m.launchH * kb; v.vel.y = m.launchV;
      v.grounded = false;
      v.juggled = wasAir;
      v.move = null;
      setState(v, 'launched');
    } else {
      v.hitstunLeft = m.hitstun;
      v.vel.x = dx * m.push * kb; v.vel.z = dz * m.push * kb;
      v.move = null;
      setState(v, 'hitstun');
    }
  }

  private releaseGrabs(v: Player): void {
    if (v.grabbedBy >= 0) {
      const g = this.players[v.grabbedBy];
      if (g && g.grabbing === v.id) { g.grabbing = -1; if (g.state === 'grabbing' || g.state === 'throw') setState(g, 'idle'); }
      v.grabbedBy = -1;
      if (v.state === 'held') setState(v, 'idle');
    }
    if (v.grabbing >= 0) {
      const h = this.players[v.grabbing];
      if (h && h.grabbedBy === v.id) { h.grabbedBy = -1; if (h.state === 'held') setState(h, 'idle'); }
      v.grabbing = -1;
    }
  }

  kill(v: Player, cause: 'hit' | 'fall' | 'throw', a: Player | null): void {
    if (v.state === 'dead') return;
    v.hp = 0;
    v.deaths++;
    let credit = a;
    if (!credit && v.lastHitBy >= 0 && this.tick - v.lastHitTick <= C.KO_CREDIT_TICKS) credit = this.players[v.lastHitBy] ?? null;
    if (credit && credit.id === v.id) credit = null;
    if (credit && this.teams && credit.team === v.team) {
      credit.kos--; // 아군 KO: 팀 점수 없이 KO 만 깎인다 (팀전에서도 아군이 맞는다, 2차 소감)
    } else if (credit) {
      credit.kos++;
      if (this.teams) this.score[credit.team]++;
    } else if (cause === 'fall') {
      v.kos--;
    }
    this.releaseGrabs(v);
    if (v.holding >= 0) this.dropHeld(v);
    v.move = null;
    setState(v, 'dead');
    if (this.mode.lives > 0) {
      v.lives--;
      if (v.lives <= 0) v.alive = false;
    }
    this.events.push({ t: 'ko', a: credit ? credit.id : -1, v: v.id, cause });
  }

  private handleDeaths(): void {
    for (const p of this.players) {
      if (!p || p.state !== 'dead') continue;
      if (this.mode.respawn && p.alive && this.phase === 'play' && p.t >= C.DEAD_TICKS + C.RESPAWN_WAIT_TICKS) {
        const s = this.spawnFor(p);
        respawn(p, s.x, s.y, s.z, yawFromDir(-s.x, -s.z));
        this.events.push({ t: 'respawn', id: p.id });
      }
    }
  }

  private syncHeld(): void {
    for (const p of this.players) {
      if (!p || p.state !== 'held') continue;
      const g = this.players[p.grabbedBy];
      if (!g) continue;
      p.pos.x = g.pos.x + facingX(g) * C.GRAB_HOLD_OFFSET;
      p.pos.z = g.pos.z + facingZ(g) * C.GRAB_HOLD_OFFSET;
      p.pos.y = g.pos.y;
      p.yaw = g.yaw + Math.PI;
      p.grounded = g.grounded;
    }
  }

  private separatePlayers(): void {
    const ps = this.players;
    const minD = C.PLAYER_RADIUS * 2;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (!a || !isSolid(a)) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (!b || !isSolid(b)) continue;
        if (Math.abs(a.pos.y - b.pos.y) > 1.2) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d >= minD) continue;
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        const push = (minD - d) / 2;
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;
      }
    }
  }

  private checkEnd(): void {
    let end = this.timeLeft <= 0;
    if (!end && this.mode.lives > 0) {
      const alive = this.alivePlayers;
      const total = this.players.filter((p) => !!p).length;
      if (total > 1) {
        if (this.teams) end = new Set(alive.map((p) => p.team)).size <= 1;
        else end = alive.length <= 1;
      }
    }
    if (end) {
      this.ranking = this.computeRanking();
      this.setPhase('ended');
      this.events.push({ t: 'end', ranking: this.ranking });
    }
  }

  computeRanking(): RankEntry[] {
    const list = this.players.filter((p): p is Player => !!p);
    const survival = this.mode.lives > 0;
    const survivalKey = (p: Player) => (p.alive && p.state !== 'dead' ? 1 + p.hp / p.maxHp : -1);
    list.sort((a, b) => {
      if (this.teams && this.score[a.team] !== this.score[b.team]) return this.score[b.team] - this.score[a.team];
      if (survival) {
        const ka = survivalKey(a), kb = survivalKey(b);
        if (ka !== kb) return kb - ka;
      }
      if (a.kos !== b.kos) return b.kos - a.kos;
      if (a.deaths !== b.deaths) return a.deaths - b.deaths;
      return b.dmgDealt - a.dmgDealt;
    });
    let winTeam = -1;
    if (this.teams) winTeam = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    return list.map((p, i) => ({
      id: p.id, name: p.name, team: p.team, kos: p.kos, deaths: p.deaths, dmg: p.dmgDealt, alive: p.alive && p.state !== 'dead', hp: p.hp,
      rank: i + 1, win: this.teams ? p.team === winTeam : i === 0,
    }));
  }
}
