// 플레이어 상태 머신 + 개인 물리. 서버와 클라(예측)가 같은 함수를 돈다.
import * as C from './constants.ts';
import { type Vec3, v3, yawFromDir, dirX, dirZ, clamp, wrapAngle } from './math.ts';
import { type Input, BTN_ATTACK, BTN_JUMP, BTN_GUARD, BTN_SPECIAL, BTN_DASH, BTN_PICKUP, pressed, held } from './input.ts';
import { MOVES, type MoveId, totalTicks, chainTick, PROJECTILE_MOVES } from './moves.ts';
import { ACCESSORIES, type AccessoryId } from './accessories.ts';
import type { MapDef } from './maps.ts';

export type PState =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'
  | 'attack' | 'dashAttack' | 'jumpAttack' | 'special'
  | 'guard' | 'stun' | 'grabTry' | 'grabbing' | 'held' | 'throw' | 'thrown'
  | 'hitstun' | 'launched' | 'down' | 'getup' | 'roll' | 'dead';

export const STATE_IDS: PState[] = [
  'idle', 'walk', 'run', 'jump', 'fall', 'land', 'attack', 'dashAttack', 'jumpAttack', 'special',
  'guard', 'stun', 'grabTry', 'grabbing', 'held', 'throw', 'thrown', 'hitstun', 'launched', 'down', 'getup', 'roll', 'dead',
];

export interface Stats { hp: number; atk: number; def: number; jmp: number; spd: number; tec: number }
export const defaultStats = (): Stats => ({ hp: C.STAT_DEFAULT, atk: C.STAT_DEFAULT, def: C.STAT_DEFAULT, jmp: C.STAT_DEFAULT, spd: C.STAT_DEFAULT, tec: C.STAT_DEFAULT });

export interface Player {
  id: number;            // 슬롯 번호 0~7
  name: string;
  team: number;          // 0 레드/무팀, 1 블루
  acc: AccessoryId;
  bot: boolean;
  stats: Stats;

  pos: Vec3;
  vel: Vec3;
  yaw: number;
  state: PState;
  t: number;             // 현재 상태에서 지난 틱
  move: MoveId | null;   // 공격·기술 중인 동작
  comboIdx: number;
  comboQueued: boolean;
  hitMask: number;       // 이번 동작으로 이미 때린 플레이어 비트
  juggled: boolean;      // 공중 추가타를 이미 맞았다
  shotFired: boolean;    // 투사체 동작에서 발사했다

  hp: number;
  maxHp: number;
  guard: number;
  grounded: boolean;
  airDashes: number;
  landTicks: number;
  invuln: number;
  hitstunLeft: number;

  grabbing: number;      // 잡고 있는 상대 id, 없으면 -1
  grabbedBy: number;
  grabTarget: number;    // 잡기 시도 대상
  mash: number;
  throwX: number;
  throwZ: number;
  wallBonus: boolean;    // 던져진 뒤 벽에 부딪히면 추가 데미지 1회

  cooldown: number;
  ammo: number;
  reload: number;

  lives: number;
  alive: boolean;        // 탈락하지 않았다
  kos: number;
  deaths: number;
  dmgDealt: number;
  lastHitBy: number;
  lastHitTick: number;
  consecBy: number;
  consecCount: number;
  prevBtn: number;
  lastInput: Input;
}

export function createPlayer(id: number, name: string, team: number, acc: AccessoryId, bot: boolean, lives: number, stats = defaultStats()): Player {
  const maxHp = C.hpFromStat(stats.hp);
  const a = ACCESSORIES[acc];
  return {
    id, name, team, acc, bot, stats,
    pos: v3(), vel: v3(), yaw: 0, state: 'idle', t: 0, move: null, comboIdx: 0, comboQueued: false, hitMask: 0, juggled: false, shotFired: false,
    hp: maxHp, maxHp, guard: C.GUARD_MAX, grounded: true, airDashes: 0, landTicks: C.LAND_TICKS, invuln: 0, hitstunLeft: 0,
    grabbing: -1, grabbedBy: -1, grabTarget: -1, mash: 0, throwX: 0, throwZ: 1, wallBonus: false,
    cooldown: 0, ammo: a.ammo, reload: 0,
    lives, alive: true, kos: 0, deaths: 0, dmgDealt: 0, lastHitBy: -1, lastHitTick: -100000, consecBy: -1, consecCount: 0,
    prevBtn: 0, lastInput: { seq: 0, mx: 0, mz: 0, btn: 0 },
  };
}

/** 최소한의 월드 인터페이스 — player.ts 가 world.ts 를 import 하지 않도록 */
export interface SimContext {
  tick: number;
  phase: 'countdown' | 'play' | 'ended';
  map: MapDef;
  players: (Player | undefined)[];
  teams: boolean;
  onWallHit(p: Player): void;
  onFall(p: Player): void;
  onProjectile(p: Player, move: MoveId): void;
}

const ACTIONABLE = new Set<PState>(['idle', 'walk', 'run', 'land']);
const GRABBABLE = new Set<PState>(['idle', 'walk', 'run', 'guard', 'hitstun', 'land', 'stun']);
const NO_HIT = new Set<PState>(['down', 'getup', 'roll', 'dead']);

export const isActionable = (p: Player) => ACTIONABLE.has(p.state);
export const isGrabbable = (p: Player) => GRABBABLE.has(p.state) && p.grabbedBy < 0;
export const canBeHit = (p: Player) => p.alive && p.state !== 'dead' && !NO_HIT.has(p.state) && p.invuln <= 0;
export const isSolid = (p: Player) => p.state !== 'dead' && p.state !== 'held' && p.alive;
export const facingX = (p: Player) => dirX(p.yaw);
export const facingZ = (p: Player) => dirZ(p.yaw);

export function setState(p: Player, s: PState): void {
  p.state = s;
  p.t = 0;
}

function startMove(ctx: SimContext, p: Player, move: MoveId, state: PState, mx: number, mz: number, moving: boolean): void {
  p.move = move;
  p.hitMask = 0;
  p.comboQueued = false;
  p.shotFired = false;
  setState(p, state);
  if (moving) p.yaw = yawFromDir(mx, mz);
  aimAssist(ctx, p, MOVES[move].reach);
}

/** 가까운 적이 정면 ±50° 안에 있으면 그쪽으로 살짝 돌아선다 (3D 난전 보조). */
function aimAssist(ctx: SimContext, p: Player, reach: number): void {
  const maxD = Math.max(reach, 1.0) * 1.6 + C.PLAYER_RADIUS;
  let best: Player | null = null, bestD = maxD;
  const fx = facingX(p), fz = facingZ(p);
  for (const q of ctx.players) {
    if (!q || q === p || !canBeHit(q) || (ctx.teams && q.team === p.team)) continue;
    const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 1e-6) continue;
    const cos = (dx * fx + dz * fz) / d;
    if (cos < Math.cos((50 * Math.PI) / 180)) continue;
    best = q; bestD = d;
  }
  if (best) p.yaw = yawFromDir(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
}

function findGrabTarget(ctx: SimContext, p: Player): Player | null {
  const fx = facingX(p), fz = facingZ(p);
  // 중심 거리 1.0m 이내 = 몸이 거의 닿은 상태 (반지름 0.4 씩)
  let best: Player | null = null, bestD = C.GRAB_RANGE;
  for (const q of ctx.players) {
    if (!q || q === p || !q.alive || !isGrabbable(q) || q.invuln > 0 || (ctx.teams && q.team === p.team)) continue;
    if (Math.abs(q.pos.y - p.pos.y) > 0.6) continue;
    const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 1e-6) continue;
    if ((dx * fx + dz * fz) / d < C.GRAB_CONE_COS) continue;
    best = q; bestD = d;
  }
  return best;
}

function groundMove(p: Player, mx: number, mz: number, moving: boolean, speed: number): void {
  if (moving) {
    p.vel.x = mx * speed;
    p.vel.z = mz * speed;
    p.yaw = yawFromDir(mx, mz);
  } else {
    p.vel.x *= C.GROUND_FRICTION;
    p.vel.z *= C.GROUND_FRICTION;
    if (Math.abs(p.vel.x) < 0.02) p.vel.x = 0;
    if (Math.abs(p.vel.z) < 0.02) p.vel.z = 0;
  }
}

function stopXZ(p: Player): void {
  p.vel.x = 0;
  p.vel.z = 0;
}

/** 한 플레이어의 한 틱: 입력 → 상태 → 물리. */
export function stepPlayer(ctx: SimContext, p: Player, input: Input): void {
  p.lastInput = input;
  const btn = ctx.phase === 'play' ? input.btn : 0;
  const prev = p.prevBtn;
  p.prevBtn = btn;
  const moving = ctx.phase === 'play' && Math.hypot(input.mx, input.mz) > 0.05;
  const mx = moving ? input.mx : 0, mz = moving ? input.mz : 0;
  const atk = pressed(btn, prev, BTN_ATTACK);
  const jump = pressed(btn, prev, BTN_JUMP);
  const special = pressed(btn, prev, BTN_SPECIAL);
  const guardHeld = held(btn, BTN_GUARD);
  const dash = held(btn, BTN_DASH);
  const acc = ACCESSORIES[p.acc];
  const spd = C.speedMult(p.stats.spd) * acc.speedMult;

  // 타이머
  if (p.invuln > 0) p.invuln--;
  if (p.cooldown > 0) p.cooldown--;
  if (p.reload > 0) { p.reload--; if (p.reload === 0) p.ammo = acc.ammo; }
  if (p.state !== 'guard' && p.state !== 'stun' && p.guard < C.GUARD_MAX) p.guard = Math.min(C.GUARD_MAX, p.guard + C.GUARD_REGEN_PER_TICK);
  p.t++;

  if (p.state === 'dead') {
    integrate(ctx, p);
    return;
  }
  // 공격 후 무적 해제: 공격을 시작하면 리스폰 무적이 풀린다
  if ((atk || special) && p.invuln > 0 && p.invuln <= C.RESPAWN_INVULN_TICKS) p.invuln = 0;

  switch (p.state) {
    case 'idle': case 'walk': case 'run': case 'land': {
      if (p.state === 'land' && p.t < p.landTicks) { stopXZ(p); break; }
      if (guardHeld && p.grounded) { setState(p, 'guard'); stopXZ(p); break; }
      if (atk) {
        if (acc.ranged) {
          if (p.ammo > 0 || acc.ammo === 0) { startMove(ctx, p, acc.combo[0], 'attack', mx, mz, moving); p.comboIdx = 0; }
          else if (p.reload === 0) p.reload = acc.reloadTicks;
          break;
        }
        const g = acc.canGrab ? findGrabTarget(ctx, p) : null;
        if (g) { p.grabTarget = g.id; startMove(ctx, p, 'grab', 'grabTry', mx, mz, false); p.yaw = yawFromDir(g.pos.x - p.pos.x, g.pos.z - p.pos.z); break; }
        if (p.state === 'run' && p.acc !== 'pistols') { startMove(ctx, p, 'tackle', 'dashAttack', mx, mz, moving); break; }
        p.comboIdx = 0;
        startMove(ctx, p, acc.combo[0], 'attack', mx, mz, moving);
        break;
      }
      if (special && p.cooldown <= 0) {
        p.cooldown = Math.round(acc.specialCooldownSec * C.TICK_RATE * C.cooldownMult(p.stats.tec));
        startMove(ctx, p, acc.special, 'special', mx, mz, moving);
        if (acc.special === 'gsSlam') { p.vel.y = 6.5; p.grounded = false; }
        break;
      }
      if (jump && p.grounded) {
        p.vel.y = C.jumpSpeed(p.stats.jmp);
        p.grounded = false;
        p.airDashes = acc.airDashes;
        if (moving) { p.vel.x = mx * (dash ? C.RUN_SPEED : C.WALK_SPEED) * spd; p.vel.z = mz * (dash ? C.RUN_SPEED : C.WALK_SPEED) * spd; p.yaw = yawFromDir(mx, mz); }
        setState(p, 'jump');
        break;
      }
      const speed = (dash && moving ? C.RUN_SPEED : C.WALK_SPEED) * spd;
      groundMove(p, mx, mz, moving, speed);
      const next: PState = !moving ? 'idle' : dash ? 'run' : 'walk';
      if (p.state !== next) setState(p, next);
      break;
    }
    case 'jump': case 'fall': {
      airControl(p, mx, mz, moving, spd);
      if (atk) {
        startMove(ctx, p, 'divekick', 'jumpAttack', mx, mz, moving);
        p.vel.x = facingX(p) * 6; p.vel.z = facingZ(p) * 6;
        if (p.vel.y > -3) p.vel.y = -3;
        break;
      }
      if (special && p.airDashes > 0 && acc.airDashes > 0) {
        p.airDashes--;
        if (moving) p.yaw = yawFromDir(mx, mz);
        p.vel.x = facingX(p) * 11; p.vel.z = facingZ(p) * 11; p.vel.y = Math.max(p.vel.y, 1);
        break;
      }
      if (p.state === 'jump' && p.vel.y < 0) setState(p, 'fall');
      break;
    }
    case 'attack': case 'special': case 'dashAttack': case 'jumpAttack': {
      const m = MOVES[p.move ?? 'jab'];
      const inMove = p.t <= m.startup + m.active;
      if (m.moveSpeed !== 0 && inMove) {
        p.vel.x = facingX(p) * m.moveSpeed; p.vel.z = facingZ(p) * m.moveSpeed;
      } else if (p.grounded && p.state !== 'jumpAttack') {
        stopXZ(p);
      }
      // 투사체 발사 시점
      const ps = PROJECTILE_MOVES[p.move ?? 'jab'];
      if (ps) {
        if (ps.fanCount === 1 && p.t === m.startup && !p.shotFired) {
          p.shotFired = true;
          if (acc.ammo > 0) { p.ammo = Math.max(0, p.ammo - 1); if (p.ammo === 0) p.reload = acc.reloadTicks; }
          ctx.onProjectile(p, p.move!);
        } else if (ps.fanCount > 1 && p.t === m.startup + 2) {
          ctx.onProjectile(p, p.move!);
        }
      }
      if (p.state === 'attack') {
        if (atk && p.t >= m.startup) p.comboQueued = true;
        const chain = acc.combo;
        if (p.comboQueued && p.comboIdx < chain.length - 1 && p.t >= chainTick(m) && p.grounded) {
          if (acc.ranged && p.ammo === 0) { setState(p, 'idle'); break; }
          p.comboIdx++;
          startMove(ctx, p, chain[p.comboIdx], 'attack', mx, mz, moving);
          break;
        }
      }
      if (m.activeUntilLand) {
        // 착지는 integrate() 가 처리한다
      } else if (p.t >= totalTicks(m)) {
        setState(p, 'idle');
        p.move = null;
      }
      break;
    }
    case 'guard': {
      stopXZ(p);
      if (moving) p.yaw = yawFromDir(mx, mz);
      if (!guardHeld) setState(p, 'idle');
      break;
    }
    case 'stun': {
      stopXZ(p);
      if (p.t >= C.STUN_TICKS) setState(p, 'idle');
      break;
    }
    case 'grabTry': {
      stopXZ(p);
      const m = MOVES.grab;
      if (p.t === m.startup) {
        const q = ctx.players[p.grabTarget];
        const q2 = q && q.alive && isGrabbable(q) && q.invuln <= 0 ? q : null;
        if (q2 && Math.hypot(q2.pos.x - p.pos.x, q2.pos.z - p.pos.z) <= C.GRAB_RANGE + 0.3) {
          p.grabbing = q2.id;
          setState(p, 'grabbing');
          q2.grabbedBy = p.id;
          q2.mash = 0;
          q2.vel.x = q2.vel.y = q2.vel.z = 0;
          setState(q2, 'held');
          q2.yaw = wrapAngle(p.yaw + Math.PI);
          break;
        }
      }
      if (p.t >= totalTicks(m)) { setState(p, 'idle'); p.move = null; p.grabTarget = -1; }
      break;
    }
    case 'grabbing': {
      stopXZ(p);
      const q = ctx.players[p.grabbing];
      if (!q || q.state !== 'held' || q.grabbedBy !== p.id) { p.grabbing = -1; setState(p, 'idle'); break; }
      if (q.mash >= C.MASH_TO_ESCAPE) {
        // 탈출: 둘 다 짧은 경직
        p.grabbing = -1; q.grabbedBy = -1;
        p.hitstunLeft = 12; setState(p, 'hitstun');
        q.hitstunLeft = 12; setState(q, 'hitstun');
        q.vel.x = facingX(p) * 2; q.vel.z = facingZ(p) * 2;
        break;
      }
      if (atk || p.t >= C.HELD_MAX_TICKS) {
        if (moving) { p.throwX = mx; p.throwZ = mz; p.yaw = yawFromDir(mx, mz); }
        else { p.throwX = facingX(p); p.throwZ = facingZ(p); }
        setState(p, 'throw');
      }
      break;
    }
    case 'throw': {
      stopXZ(p);
      const q = ctx.players[p.grabbing];
      if (p.t === C.THROW_RELEASE_TICK && q && q.state === 'held') {
        q.grabbedBy = -1; p.grabbing = -1;
        q.pos.x = p.pos.x + p.throwX * 0.9; q.pos.z = p.pos.z + p.throwZ * 0.9; q.pos.y = p.pos.y;
        q.vel.x = p.throwX * C.THROW_VEL_H; q.vel.z = p.throwZ * C.THROW_VEL_H; q.vel.y = C.THROW_VEL_V;
        q.grounded = false; q.wallBonus = true; q.juggled = true;
        applyDamage(ctx, q, p, C.THROW_DAMAGE);
        setState(q, 'thrown');
      }
      if (p.t >= C.THROW_RELEASE_TICK + C.THROW_RECOVERY) { setState(p, 'idle'); p.move = null; }
      break;
    }
    case 'held': {
      if (atk) p.mash++;
      const g = ctx.players[p.grabbedBy];
      if (!g || g.grabbing !== p.id || (g.state !== 'grabbing' && g.state !== 'throw' && g.state !== 'grabTry')) { p.grabbedBy = -1; setState(p, 'idle'); }
      stopXZ(p);
      break;
    }
    case 'hitstun': {
      p.vel.x *= 0.85; p.vel.z *= 0.85;
      if (p.t >= p.hitstunLeft) setState(p, 'idle');
      break;
    }
    case 'launched': case 'thrown': {
      break; // 물리만
    }
    case 'down': {
      stopXZ(p);
      if (p.t >= C.DOWN_TICKS) setState(p, 'getup');
      break;
    }
    case 'getup': {
      stopXZ(p);
      if (moving && p.t <= 6) { p.yaw = yawFromDir(mx, mz); setState(p, 'roll'); break; }
      if (p.t >= C.GETUP_TICKS) setState(p, 'idle');
      break;
    }
    case 'roll': {
      p.vel.x = facingX(p) * C.ROLL_SPEED; p.vel.z = facingZ(p) * C.ROLL_SPEED;
      if (p.t >= C.ROLL_TICKS) { stopXZ(p); setState(p, 'idle'); }
      break;
    }
  }
  integrate(ctx, p);
}

function airControl(p: Player, mx: number, mz: number, moving: boolean, spd: number): void {
  if (!moving) return;
  const k = C.AIR_CONTROL * 0.15;
  p.vel.x += (mx * C.WALK_SPEED * spd - p.vel.x) * k;
  p.vel.z += (mz * C.WALK_SPEED * spd - p.vel.z) * k;
}

/** 중력·이동·맵 충돌·착지 전이. 잡힌 상태는 잡은 쪽이 위치를 정하므로 건너뛴다. */
export function integrate(ctx: SimContext, p: Player): void {
  if (p.state === 'held') return;
  const map = ctx.map;
  const prevY = p.pos.y;
  if (!p.grounded) {
    p.vel.y -= C.GRAVITY * C.DT;
    if (p.vel.y < -C.MAX_FALL_SPEED) p.vel.y = -C.MAX_FALL_SPEED;
  }
  p.pos.x += p.vel.x * C.DT;
  p.pos.y += p.vel.y * C.DT;
  p.pos.z += p.vel.z * C.DT;

  const wallHit = resolveHorizontal(map, p);
  const support = supportHeight(map, p, prevY);
  const wasGrounded = p.grounded;
  if (p.vel.y <= 0 && p.pos.y <= support + 1e-4) {
    p.pos.y = support;
    p.vel.y = 0;
    p.grounded = true;
  } else {
    p.grounded = false;
  }
  if (p.grounded && !wasGrounded) onLand(p);
  if (p.grounded && (p.state === 'jump' || p.state === 'fall')) onLand(p);
  if (!p.grounded && (p.state === 'idle' || p.state === 'walk' || p.state === 'run' || p.state === 'land')) setState(p, 'fall');
  if (wallHit && p.state === 'thrown' && p.wallBonus) { p.wallBonus = false; ctx.onWallHit(p); }
  if (p.pos.y < map.fallY) ctx.onFall(p);
}

function onLand(p: Player): void {
  switch (p.state) {
    case 'jump': case 'fall':
      p.landTicks = C.LAND_TICKS; setState(p, 'land'); break;
    case 'jumpAttack':
      p.landTicks = MOVES.divekick.recovery; setState(p, 'land'); p.move = null; break;
    case 'launched': case 'thrown':
      p.vel.x = 0; p.vel.z = 0; p.wallBonus = false; setState(p, 'down'); break;
    case 'dead':
      p.vel.x = 0; p.vel.z = 0; break;
  }
}

/** 발밑에서 가장 높은 지지면. 지금 높이보다 STEP_UP 이상 높은 면은 무시한다. */
export function supportHeight(map: MapDef, p: Player, prevY: number): number {
  let best = -Infinity;
  const r = C.PLAYER_RADIUS * 0.5;
  const limit = prevY + C.STEP_UP;
  if (map.groundRadius > 0 && Math.hypot(p.pos.x, p.pos.z) <= map.groundRadius + r && 0 <= limit) best = 0;
  for (const b of map.boxes) {
    if (p.pos.x < b.minX - r || p.pos.x > b.maxX + r || p.pos.z < b.minZ - r || p.pos.z > b.maxZ + r) continue;
    if (b.maxY <= limit && b.maxY > best) best = b.maxY;
  }
  for (const c of map.cylinders) {
    if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) <= c.r + r && c.h <= limit && c.h > best) best = c.h;
  }
  return best;
}

/** 옆면 충돌: 원형 벽·기둥·발판 옆면. 밀어낸 뒤 true 를 돌려준다. */
export function resolveHorizontal(map: MapDef, p: Player): boolean {
  let hit = false;
  const R = C.PLAYER_RADIUS;
  if (map.wallRadius > 0 && p.pos.y < map.wallHeight) {
    const d = Math.hypot(p.pos.x, p.pos.z);
    const max = map.wallRadius - R;
    if (d > max) {
      const k = max / d;
      p.pos.x *= k; p.pos.z *= k;
      const nx = p.pos.x / max, nz = p.pos.z / max;
      const vn = p.vel.x * nx + p.vel.z * nz;
      if (vn > 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; hit = true; }
    }
  }
  for (const c of map.cylinders) {
    if (p.pos.y >= c.h) continue;
    const dx = p.pos.x - c.x, dz = p.pos.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + R;
    if (d < min) {
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      p.pos.x = c.x + nx * min; p.pos.z = c.z + nz * min;
      const vn = p.vel.x * nx + p.vel.z * nz;
      if (vn < 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; hit = true; }
    }
  }
  for (const b of map.boxes) {
    // 발이 윗면보다 STEP_UP 이상 아래에 있고 머리가 아랫면보다 위일 때만 옆면이 막는다
    if (p.pos.y >= b.maxY - C.STEP_UP || p.pos.y + C.PLAYER_HEIGHT <= b.minY) continue;
    const px = clamp(p.pos.x, b.minX, b.maxX), pz = clamp(p.pos.z, b.minZ, b.maxZ);
    const dx = p.pos.x - px, dz = p.pos.z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= R) continue;
    if (d > 1e-6) {
      const nx = dx / d, nz = dz / d;
      p.pos.x = px + nx * R; p.pos.z = pz + nz * R;
      const vn = p.vel.x * nx + p.vel.z * nz;
      if (vn < 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; hit = true; }
    } else {
      // 중심이 상자 안: 가장 가까운 면으로 밀어낸다
      const l = p.pos.x - b.minX, rr = b.maxX - p.pos.x, f = p.pos.z - b.minZ, bk = b.maxZ - p.pos.z;
      const m = Math.min(l, rr, f, bk);
      if (m === l) { p.pos.x = b.minX - R; p.vel.x = Math.min(0, p.vel.x); }
      else if (m === rr) { p.pos.x = b.maxX + R; p.vel.x = Math.max(0, p.vel.x); }
      else if (m === f) { p.pos.z = b.minZ - R; p.vel.z = Math.min(0, p.vel.z); }
      else { p.pos.z = b.maxZ + R; p.vel.z = Math.max(0, p.vel.z); }
      hit = true;
    }
  }
  return hit;
}

/** 데미지 적용 (근력·방어 배율, 소수점 버림). 사망 처리는 호출자가 hp 를 보고 한다. */
export function applyDamage(ctx: SimContext, v: Player, a: Player | null, base: number): number {
  const mult = (a ? C.atkMult(a.stats.atk) : 1) * C.defMult(v.stats.def);
  // 1.0×1.0 이 0.9999… 가 되어 내림이 한 칸 틀리는 것을 막는다
  const dmg = Math.max(1, Math.floor(base * mult + 1e-6));
  v.hp = Math.max(0, v.hp - dmg);
  if (a) {
    v.lastHitBy = a.id;
    v.lastHitTick = ctx.tick;
    a.dmgDealt += dmg;
  }
  return dmg;
}

/** 리스폰: 위치·체력·상태 초기화 */
export function respawn(p: Player, x: number, y: number, z: number, yaw: number): void {
  p.pos.x = x; p.pos.y = y; p.pos.z = z;
  p.vel.x = p.vel.y = p.vel.z = 0;
  p.yaw = yaw;
  p.hp = p.maxHp;
  p.guard = C.GUARD_MAX;
  p.grounded = true;
  p.invuln = C.RESPAWN_INVULN_TICKS;
  p.move = null; p.comboIdx = 0; p.comboQueued = false; p.hitMask = 0; p.juggled = false;
  p.grabbing = -1; p.grabbedBy = -1; p.grabTarget = -1; p.mash = 0;
  p.cooldown = 0; p.ammo = ACCESSORIES[p.acc].ammo; p.reload = 0;
  p.consecBy = -1; p.consecCount = 0;
  setState(p, 'idle');
}
