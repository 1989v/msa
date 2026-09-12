// 지연 보상 (2026-09-12): 방장은 최근 위치를 기억해 두고, 공격자가 「봤던 시점」의 상대 위치로 타격을 판정한다.
// 지연 0(연습)이면 전과 똑같이 현재 위치로 판정한다.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, type Input } from '../src/input.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

/** A(0,0, +z 를 봄)가 잽을 누르는 순간 B 는 앞 1.2m 에 있다가 틱마다 옆으로 0.3m 씩 순간이동해 잽이 나갈 때(6틱 뒤)는 범위 밖이다 */
function scenario(latencyTicks: number) {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 1 });
  const a = w.addPlayer(0, 'A', 0, 'none', false);
  const b = w.addPlayer(1, 'B', 1, 'none', false);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  w.items = [];
  a.pos.x = 0; a.pos.z = 0; a.pos.y = 0; a.yaw = 0; a.vel.x = a.vel.z = 0;
  b.pos.x = 0; b.pos.z = 1.2; b.pos.y = 0; b.vel.x = b.vel.z = 0;
  for (let i = 0; i < 4; i++) w.step([inp(), inp()]); // 기록이 쌓인다 (B 는 앞에 서 있다)
  w.latency[a.id] = latencyTicks;
  let hit = false;
  for (let i = 0; i < 30 && !hit; i++) {
    b.pos.x += 0.3; // 옆으로 빠진다 — 잽이 나가는 6틱 뒤에는 x ≈ 2.1
    for (const e of w.step([inp(0, 0, i === 0 ? BTN_ATTACK : 0), inp()])) if (e.t === 'hit' && e.v === b.id) hit = true;
  }
  return { hit, bx: b.pos.x, hp: b.hp };
}

describe('지연 보상', () => {
  it('지연 0 이면 빠져나간 상대는 맞지 않는다 (현재 위치 판정)', () => {
    const r = scenario(0);
    expect(r.hit).toBe(false);
    expect(r.hp).toBe(100);
  });
  it('지연 12틱이면 공격자가 봤던 위치(앞 1.2m)로 판정해 맞는다', () => {
    const r = scenario(12);
    expect(r.hit).toBe(true);
    expect(r.hp).toBeLessThan(100);
  });
  it('되감기는 기록 길이(HISTORY_TICKS − 1)를 넘지 않고, 기록이 없으면 현재 위치를 쓴다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 1 });
    const a = w.addPlayer(0, 'A', 0, 'none', false);
    for (let i = 0; i < 3; i++) w.step([inp()]);
    a.pos.x = 5;
    expect(w.posAgo(a, 0)).toBe(a.pos);
    const old = w.posAgo(a, 999); // 기록보다 오래 전 → 가장 오래된 기록
    expect(old.x).not.toBe(5);
    a.pos.x = 0; a.pos.z = 0;
    for (let i = 0; i < C.HISTORY_TICKS + 2; i++) { a.pos.x += 0.1; w.step([inp()]); }
    const back = w.posAgo(a, C.LAG_COMP_MAX_TICKS);
    expect(a.pos.x - back.x).toBeCloseTo(0.1 * C.LAG_COMP_MAX_TICKS, 5); // 틱마다 0.1 씩 갔으니 딱 그만큼 전
  });
});
