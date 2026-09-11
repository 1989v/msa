// 스냅샷: 서버 → 클라. 플레이어 전부의 시뮬 상태를 배열로 편다 (예측 되감기에 필요한 필드 전부).
import { STATE_IDS, type Player, type PState } from './player.ts';
import { MOVE_IDS, type MoveId } from './moves.ts';
import { ITEM_KINDS, type Item } from './items.ts';
import type { World, Projectile } from './world.ts';

export type PlayerSnap = number[];
export type ProjSnap = number[];
export type ItemSnap = number[];

export interface Snapshot {
  tick: number;
  phase: 'countdown' | 'play' | 'ended';
  phaseT: number;
  timeLeft: number;
  score: [number, number];
  p: PlayerSnap[];
  pr: ProjSnap[];
  it: ItemSnap[];
  /** 월드 단위 상태 [nextProjId, nextItemId, ...crateTimers] — 방장 승계 때 새 방장이 이어서 돌리려면 필요하다 */
  w?: number[];
}

/** 릴레이 4KB 상한을 지키려고 소수 셋째 자리까지만 보낸다 (1mm). 예측 오차 무시 문턱(1cm)보다 작다. */
const r3 = (v: number): number => (Number.isInteger(v) ? v : Math.round(v * 1000) / 1000 || 0); // `|| 0` 은 -0 을 0 으로

const stateIndex = new Map<PState, number>(STATE_IDS.map((s, i) => [s, i]));
const moveIndex = new Map<MoveId, number>(MOVE_IDS.map((m, i) => [m, i]));

export function encodePlayer(p: Player): PlayerSnap {
  return [
    p.id, p.pos.x, p.pos.y, p.pos.z, p.yaw,
    stateIndex.get(p.state) ?? 0, p.t, p.move ? (moveIndex.get(p.move) ?? -1) : -1, p.comboIdx, p.comboQueued ? 1 : 0, p.hitMask, p.juggled ? 1 : 0, p.shotFired ? 1 : 0,
    p.hp, p.guard, p.grounded ? 1 : 0, p.airDashes, p.landTicks, p.invuln, p.hitstunLeft,
    p.grabbing, p.grabbedBy, p.grabTarget, p.mash, p.throwX, p.throwZ, p.wallBonus ? 1 : 0, p.holding,
    p.cooldown, p.ammo, p.reload,
    p.lives, p.alive ? 1 : 0, p.kos, p.deaths, p.dmgDealt, p.lastHitBy, p.lastHitTick, p.consecBy, p.consecCount, p.prevBtn,
    p.vel.x, p.vel.y, p.vel.z,
    p.chain, p.switchHeavy ? 1 : 0, p.counterT,
  ];
}

export function decodePlayer(p: Player, s: PlayerSnap): void {
  let i = 1;
  p.pos.x = s[i++]; p.pos.y = s[i++]; p.pos.z = s[i++]; p.yaw = s[i++];
  p.state = STATE_IDS[s[i++]] ?? 'idle'; p.t = s[i++];
  const mi = s[i++]; p.move = mi >= 0 ? MOVE_IDS[mi] : null;
  p.comboIdx = s[i++]; p.comboQueued = s[i++] === 1; p.hitMask = s[i++]; p.juggled = s[i++] === 1; p.shotFired = s[i++] === 1;
  p.hp = s[i++]; p.guard = s[i++]; p.grounded = s[i++] === 1; p.airDashes = s[i++]; p.landTicks = s[i++]; p.invuln = s[i++]; p.hitstunLeft = s[i++];
  p.grabbing = s[i++]; p.grabbedBy = s[i++]; p.grabTarget = s[i++]; p.mash = s[i++]; p.throwX = s[i++]; p.throwZ = s[i++]; p.wallBonus = s[i++] === 1; p.holding = s[i++];
  p.cooldown = s[i++]; p.ammo = s[i++]; p.reload = s[i++];
  p.lives = s[i++]; p.alive = s[i++] === 1; p.kos = s[i++]; p.deaths = s[i++]; p.dmgDealt = s[i++]; p.lastHitBy = s[i++]; p.lastHitTick = s[i++]; p.consecBy = s[i++]; p.consecCount = s[i++]; p.prevBtn = s[i++];
  p.vel.x = s[i++]; p.vel.y = s[i++]; p.vel.z = s[i++];
  p.chain = s[i++] ?? 0; p.switchHeavy = s[i++] === 1; p.counterT = s[i++] ?? 0;
}

export function encodeSnapshot(w: World): Snapshot {
  return {
    tick: w.tick, phase: w.phase, phaseT: w.phaseT, timeLeft: w.timeLeft, score: [w.score[0], w.score[1]],
    p: w.players.filter((p): p is Player => !!p).map((p) => encodePlayer(p).map(r3)),
    pr: w.projectiles.map((pr) => [pr.id, pr.owner, moveIndex.get(pr.move) ?? 0, r3(pr.x), r3(pr.y), r3(pr.z), r3(pr.vx), r3(pr.vz), pr.life, pr.radius, pr.hitMask, pr.pierce ? 1 : 0]),
    it: w.items.map((it) => [it.id, ITEM_KINDS.indexOf(it.kind), r3(it.x), r3(it.y), r3(it.z), r3(it.vx), r3(it.vy), r3(it.vz), it.hp, it.heldBy, it.fuse, it.airborne ? 1 : 0, it.thrownBy, it.spot, it.lastHitBy, it.lastHitTick]),
    w: [w.nextProjId, w.nextItemId, ...w.crateTimers],
  };
}

export function applySnapshot(w: World, s: Snapshot): void {
  w.tick = s.tick; w.phase = s.phase; w.phaseT = s.phaseT; w.timeLeft = s.timeLeft; w.score = [s.score[0], s.score[1]];
  if (s.w && s.w.length >= 2) { w.nextProjId = s.w[0]; w.nextItemId = s.w[1]; w.crateTimers = s.w.slice(2); }
  for (const ps of s.p) {
    const p = w.players[ps[0]];
    if (p) decodePlayer(p, ps);
  }
  w.projectiles = s.pr.map((a): Projectile => ({
    id: a[0], owner: a[1], move: MOVE_IDS[a[2]] ?? 'gunShot', x: a[3], y: a[4], z: a[5], vx: a[6], vz: a[7], life: a[8], radius: a[9], hitMask: a[10], pierce: a[11] === 1,
  }));
  w.items = (s.it ?? []).map((a): Item => ({
    id: a[0], kind: ITEM_KINDS[a[1]] ?? 'crate', x: a[2], y: a[3], z: a[4], vx: a[5], vy: a[6], vz: a[7], hp: a[8], heldBy: a[9], fuse: a[10], airborne: a[11] === 1, thrownBy: a[12], spot: a[13], lastHitBy: a[14], lastHitTick: a[15],
  }));
}

/** 예측 오차 판단용: 두 스냅샷 행의 위치 차이 */
export const snapDistance = (a: PlayerSnap, b: PlayerSnap) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);
