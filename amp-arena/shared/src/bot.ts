// 봇: 사람과 같은 입력 파이프라인을 탄다. 서버(온라인)와 클라(연습 모드)가 같이 쓴다.
import { type Input, BTN_ATTACK, BTN_HEAVY, BTN_JUMP, BTN_GUARD, BTN_SPECIAL, BTN_DASH, BTN_PICKUP } from './input.ts';
import { type Player, isActionable } from './player.ts';
import type { World } from './world.ts';
import { MOVES } from './moves.ts';
import { ACCESSORIES } from './accessories.ts';
import { STYLES, allowedAccessory } from './styles.ts';
import * as C from './constants.ts';
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

/**
 * 그 방향 dist 미터 앞에 딛을 곳이 있나. 원형 벽 안쪽은 애초에 떨어질 데가 없다.
 * 점프대도 「딛을 곳 없음」으로 친다 — 벽 없는 맵에서 밟으면 12~13 으로 튕겨 올라가고,
 * 공중 조작이 틱당 5% 라 그 속도를 되돌리지 못해 그대로 장외로 날아간다(남은 자멸의 대부분이 이것이었다).
 */
function footing(w: World, p: Player, mx: number, mz: number, dist: number): boolean {
  if (w.map.wallRadius > 0 && p.pos.y < w.map.wallHeight) return true;
  const x = p.pos.x + mx * dist, z = p.pos.z + mz * dist;
  for (const pad of w.map.pads) {
    if (Math.abs(pad.y - p.pos.y) < 1.5 && Math.hypot(x - pad.x, z - pad.z) < pad.r + 0.6) return false;
  }
  const probe = { pos: { x, y: p.pos.y, z } } as Player;
  return supportHeight(w.map, probe, p.pos.y) > p.pos.y - 3;
}

/**
 * 낭떠러지 회피: 가려던 쪽에 바닥이 없으면 옆으로 튼다(±34°·±69°·±115°), 다 없으면 멈춘다.
 * 멈추는 것만으로는 모자라 방향을 트는 이유 — 멈춰 서 있으면 밀려서 떨어지고, 목표가 건너편이면 계속 벽에 붙어 있게 된다.
 * 앞을 보는 거리는 속도에 비례한다(달리기 6.2 m/s 는 0.9m 앞을 봐 봐야 0.15초라 이미 늦다).
 */
function avoidEdge(w: World, p: Player, out: Input): void {
  const len = Math.hypot(out.mx, out.mz);
  if (len < 1e-6) return;
  if (w.map.wallRadius > 0 && p.pos.y < w.map.wallHeight) return;
  const mx = out.mx / len, mz = out.mz / len;
  // 공중이면 「그 쪽으로 가면 착지할 데가 있나」를 본다 — 지상 발밑 검사는 발이 떠 있으면 뜻이 없다
  if (!p.grounded) {
    if (landingSpot(w, p, mx, mz, false)) return;
    for (let i = 1; i <= 12; i++) {
      const a = ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 6; // ±30°, ±60°, … ±180°
      const c = Math.cos(a), s = Math.sin(a);
      const rx = mx * c - mz * s, rz = mx * s + mz * c;
      if (landingSpot(w, p, rx, rz, false)) { out.mx = rx; out.mz = rz; return; }
    }
    return;
  }
  const dist = 0.8 + Math.hypot(p.vel.x, p.vel.z) * 0.35;
  if (footing(w, p, mx, mz, dist)) return;
  for (const a of [0.6, -0.6, 1.2, -1.2, 2.0, -2.0]) {
    const c = Math.cos(a), s = Math.sin(a);
    const rx = mx * c - mz * s, rz = mx * s + mz * c;
    if (footing(w, p, rx, rz, dist)) { out.mx = rx; out.mz = rz; out.btn &= ~BTN_DASH; return; }
  }
  out.mx = 0; out.mz = 0; out.btn &= ~BTN_DASH;
}

/**
 * 뛰면 어디에 떨어지나. 광선 위에 발판이 하나라도 있으면 뛰던 앞 판이 무의미했던 이유 —
 * 3.6m 앞에 발판이 보여도 점프가 거기까지 안 닿으면 그냥 사이 빈 곳으로 떨어진다.
 * 그래서 **탄도로 착지 예상 지점을 구해** 그 자리에 딛을 곳이 있는지만 본다.
 * (스카이독 자멸 140건 중 138건이 「봇이 점프 버튼을 눌러서」였다.)
 */
function landingSpot(w: World, p: Player, mx: number, mz: number, jumping: boolean): boolean {
  if (w.map.wallRadius > 0 && p.pos.y < w.map.wallHeight) return true;
  const v0 = jumping ? C.jumpSpeed(p.stats.jmp) : p.vel.y;
  // 지금 높이로 돌아오는 데 걸리는 시간 (내려갈 곳이 더 낮으면 조금 더 날아가지만 짧게 잡는 편이 안전하다)
  const t = v0 > 0 ? (2 * v0) / C.GRAVITY : 0.25;
  const sp = Math.hypot(p.vel.x, p.vel.z);
  const apex = v0 > 0 ? (v0 * v0) / (2 * C.GRAVITY) : 0;
  const reach = Math.max(sp * t, 0.4);
  // 예상 지점 한 곳만 보면 모자란다 — 공중 조작으로 더 밀려 가고, 착지면이 낮으면 더 오래 난다.
  // 0.5~1.6배 구간이 **전부** 딛을 수 있어야 뛴다. 즉 봇은 틈을 건너뛰지 않는다(사람은 건넌다).
  for (const k of jumping ? [0.5, 0.9, 1.25, 1.6] : [1]) {
    const probe = { pos: { x: p.pos.x + mx * reach * k, y: p.pos.y, z: p.pos.z + mz * reach * k } } as Player;
    if (supportHeight(w.map, probe, p.pos.y + apex) <= p.pos.y - 3) return false;
  }
  return true;
}

/** 돌진·구르기 기술은 낭떠러지에서 자살 버튼이다 — 이동 거리만큼 앞(또는 뒤)에 바닥이 있어야 쓴다 */
function specialIsSafe(w: World, p: Player, moveId: string, nx: number, nz: number): boolean {
  const m = MOVES[moveId as keyof typeof MOVES];
  if (!m) return true;
  // 기술은 시작하면 수십 틱 동안 방향을 못 바꾼다. 그래서 **안 움직이는 기술도** 절벽 앞에서는 쓰지 않는다 —
  // 그 사이에 밀리거나 튕기면 회피 로직이 아예 못 돈다 (직업당 3종을 넣은 뒤 자멸의 1/4 이 state 'special' 이었다).
  if (!footing(w, p, nx, nz, 1.6)) return false;
  if (m.moveSpeed === 0 || m.moveUntil === 'none') return true;
  const ticks = m.moveUntil === 'active' ? m.startup + m.active : m.startup;
  const travel = Math.abs(m.moveSpeed) * (ticks / 60) + 0.5;
  const sign = m.moveSpeed > 0 ? 1 : -1;
  return footing(w, p, nx * sign, nz * sign, travel);
}

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
  const combo = acc.id === 'none' ? STYLES[p.style].combo : acc.combo;
  const reach = acc.ranged ? 9 : MOVES[combo[0]].reach + 0.3;

  if (tick >= mem.strafeUntil) { mem.strafeDir = rng() < 0.5 ? -1 : 1; mem.strafeUntil = tick + 40 + Math.floor(rng() * 80); }

  // 체력이 낮으면 근처 하트를 먼저 줍는다
  if (p.hp < p.maxHp * 0.55 && isActionable(p)) {
    let heart = null as { x: number; z: number } | null, hd = 7;
    for (const it of w.items) {
      if (it.kind !== 'heart') continue;
      const hdist = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
      if (hdist < hd) { hd = hdist; heart = it; }
    }
    if (heart) {
      const hx = heart.x - p.pos.x, hz = heart.z - p.pos.z, hl = Math.hypot(hx, hz) || 1;
      out.mx = hx / hl; out.mz = hz / hl;
      if (hd > 4) out.btn |= BTN_DASH;
      avoidEdge(w, p, out);
      return out;
    }
  }
  // 맨손이면 근처에 떨어진 쓸 수 있는 악세서리를 주우러 간다 (KO 드랍)
  if (p.acc === 'none' && isActionable(p) && p.holding < 0) {
    let item = null as { x: number; z: number } | null, id = 8;
    for (const it of w.items) {
      if (it.kind !== 'acc' || it.heldBy >= 0 || it.airborne || it.hp <= 0 || allowedAccessory(p.style, it.acc) !== it.acc) continue;
      const dist = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
      if (dist < id) { id = dist; item = it; }
    }
    if (item) {
      const ix = item.x - p.pos.x, iz = item.z - p.pos.z, il = Math.hypot(ix, iz) || 1;
      if (id > 0.9) { out.mx = ix / il; out.mz = iz / il; if (id > 4) out.btn |= BTN_DASH; avoidEdge(w, p, out); }
      if (id < 1.2 && tick % 2 === 0) out.btn |= BTN_PICKUP; // 격틱으로 눌러 엣지를 만든다
      return out;
    }
  }
  // 상대가 누워 있으면 살짝 물러난다
  if (target.state === 'down' || target.state === 'getup') {
    if (d < 2.2) { out.mx = -nx; out.mz = -nz; avoidEdge(w, p, out); }
    return out;
  }

  if (d > reach) {
    // 접근 (옆걸음 섞어서)
    const sx = -nz * mem.strafeDir * 0.35, sz = nx * mem.strafeDir * 0.35;
    out.mx = nx + sx; out.mz = nz + sz;
    const l = Math.hypot(out.mx, out.mz); out.mx /= l; out.mz /= l;
    if (d > 5 && !acc.ranged) out.btn |= BTN_DASH;
    if (p.grounded && (target.pos.y > p.pos.y + 0.6 ? rng() < 0.08 : rng() < 0.004) && landingSpot(w, p, out.mx, out.mz, true)) out.btn |= BTN_JUMP;
    avoidEdge(w, p, out);
    // 원거리는 사거리 안이면 쏜다
    if (acc.ranged && d < 12 && isActionable(p) && rng() < 0.22) { out.btn |= BTN_ATTACK; out.mx = nx; out.mz = nz; } // 0.3 은 더블탭 봇이 KO 비 1.71 (밸런스 2차)
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
  if (p.state === 'guard' && p.counterT > 0 && rng() < 0.5) { out.btn |= BTN_ATTACK; return out; } // 막았으면 반격
  if (p.state === 'attack' || p.state === 'special') {
    // 사슬 이어가기: 같은 키를 격틱으로 눌러 엣지를 만든다. 약공 사슬 끝에 가끔 강공 피니시
    if (rng() < 0.75 && tick % 3 === 0) out.btn |= p.chain === 1 ? BTN_HEAVY : (p.comboIdx >= 1 && rng() < 0.3 ? BTN_HEAVY : BTN_ATTACK);
    return out;
  }
  if (isActionable(p)) {
    const special = acc.id === 'none' ? STYLES[p.style].special : acc.special;
    if (p.cooldown <= 0 && rng() < 0.12 * mem.aggression && specialIsSafe(w, p, special, nx, nz)) { out.btn |= BTN_SPECIAL; out.mx = nx; out.mz = nz; return out; }
    if (rng() < 0.35 + mem.aggression * 0.4) { out.btn |= rng() < 0.3 ? BTN_HEAVY : BTN_ATTACK; out.mx = nx; out.mz = nz; return out; }
    // 아니면 옆으로 돈다
    out.mx = -nz * mem.strafeDir; out.mz = nx * mem.strafeDir;
    avoidEdge(w, p, out);
  }
  return out;
}
