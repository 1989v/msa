// 봇: 사람과 같은 입력 파이프라인을 탄다. 서버(온라인)와 클라(연습 모드)가 같이 쓴다.
import { type Input, BTN_ATTACK, BTN_JUMP, BTN_GUARD, BTN_SPECIAL, BTN_DASH } from './input.ts';
import { type Player, isActionable } from './player.ts';
import type { World } from './world.ts';
import { MOVES } from './moves.ts';
import { ACCESSORIES } from './accessories.ts';
import { supportHeight } from './player.ts';

export interface BotMemory {
  targetId: number;
  retargetAt: number;
  guardUntil: number;
  strafeDir: number;
  strafeUntil: number;
  attackHold: number; // 버튼 눌림 토글용
  aggression: number; // 0.3~0.8
}

export const newBotMemory = (rng: () => number): BotMemory => ({
  targetId: -1, retargetAt: 0, guardUntil: 0, strafeDir: rng() < 0.5 ? -1 : 1, strafeUntil: 0, attackHold: 0, aggression: 0.35 + rng() * 0.45,
});

function pickTarget(w: World, p: Player): Player | null {
  let best: Player | null = null, bestD = Infinity;
  for (const q of w.players) {
    if (!q || q === p || !q.alive || q.state === 'dead' || (w.teams && q.team === p.team)) continue;
    const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z) + (q.invuln > 0 ? 6 : 0);
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

const ATTACKING = new Set(['attack', 'dashAttack', 'jumpAttack', 'special', 'grabTry']);

export function botInput(w: World, p: Player, mem: BotMemory): Input {
  const rng = w.rng;
  const tick = w.tick;
  const out: Input = { seq: tick, mx: 0, mz: 0, btn: 0 };
  if (w.phase !== 'play' || p.state === 'dead') return out;

  if (p.state === 'held') {
    // 연타 탈출: 격틱으로 누른다
    if (tick % 2 === 0) out.btn |= BTN_ATTACK;
    return out;
  }
  if (tick >= mem.retargetAt || mem.targetId < 0 || !w.players[mem.targetId]?.alive) {
    const t = pickTarget(w, p);
    mem.targetId = t ? t.id : -1;
    mem.retargetAt = tick + 120 + Math.floor(rng() * 120);
  }
  const target = mem.targetId >= 0 ? w.players[mem.targetId] : undefined;
  if (!target) return out;

  const dx = target.pos.x - p.pos.x, dz = target.pos.z - p.pos.z;
  const d = Math.hypot(dx, dz);
  const nx = d > 1e-6 ? dx / d : 0, nz = d > 1e-6 ? dz / d : 1;
  const acc = ACCESSORIES[p.acc];
  const reach = acc.ranged ? 9 : MOVES[acc.combo[0]].reach + 0.3;

  if (tick >= mem.strafeUntil) { mem.strafeDir = rng() < 0.5 ? -1 : 1; mem.strafeUntil = tick + 40 + Math.floor(rng() * 80); }

  // 상대가 누워 있으면 살짝 물러난다
  if (target.state === 'down' || target.state === 'getup') {
    if (d < 2.2) { out.mx = -nx; out.mz = -nz; }
    return out;
  }

  if (d > reach) {
    // 접근 (옆걸음 섞어서)
    const sx = -nz * mem.strafeDir * 0.35, sz = nx * mem.strafeDir * 0.35;
    out.mx = nx + sx; out.mz = nz + sz;
    const l = Math.hypot(out.mx, out.mz); out.mx /= l; out.mz /= l;
    if (d > 5 && !acc.ranged) out.btn |= BTN_DASH;
    if (target.pos.y > p.pos.y + 0.6 && p.grounded && rng() < 0.08) out.btn |= BTN_JUMP;
    if (rng() < 0.004 && p.grounded) out.btn |= BTN_JUMP;
    // 낭떠러지 회피: 다음 위치에 지지면이 없으면 멈춘다
    if (w.map.groundRadius === 0) {
      const probe = { ...p, pos: { x: p.pos.x + out.mx * 0.9, y: p.pos.y, z: p.pos.z + out.mz * 0.9 } } as Player;
      if (supportHeight(w.map, probe, p.pos.y) < p.pos.y - 3) { out.mx = 0; out.mz = 0; out.btn &= ~BTN_DASH; }
    }
    // 원거리는 사거리 안이면 쏜다
    if (acc.ranged && d < 12 && isActionable(p) && rng() < 0.3) { out.btn |= BTN_ATTACK; out.mx = nx; out.mz = nz; }
    return out;
  }

  // 근접 범위
  out.mx = 0; out.mz = 0;
  if (tick < mem.guardUntil) { out.btn |= BTN_GUARD; return out; }
  if (ATTACKING.has(target.state) && isActionable(p) && rng() < 0.3 * (1 - mem.aggression)) {
    mem.guardUntil = tick + 18 + Math.floor(rng() * 20);
    out.btn |= BTN_GUARD;
    return out;
  }
  if (p.state === 'attack' || p.state === 'special') {
    // 콤보 이어가기: 격틱으로 눌러 엣지를 만든다
    if (rng() < 0.75 && tick % 3 === 0) out.btn |= BTN_ATTACK;
    return out;
  }
  if (isActionable(p)) {
    if (p.cooldown <= 0 && rng() < 0.12 * mem.aggression) { out.btn |= BTN_SPECIAL; out.mx = nx; out.mz = nz; return out; }
    if (rng() < 0.35 + mem.aggression * 0.4) { out.btn |= BTN_ATTACK; out.mx = nx; out.mz = nz; return out; }
    // 아니면 옆으로 돈다
    out.mx = -nz * mem.strafeDir; out.mz = nx * mem.strafeDir;
  }
  return out;
}
