// 공중 공격 (2026-09-13 소감: 「점프하면서도 공격할 수 있게」): 약공은 점프 궤적을 유지하고, 강공은 급강하로 내리꽂는다.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_HEAVY, BTN_JUMP, type Input } from '../src/input.ts';
import { MOVES, totalTicks } from '../src/moves.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });
function setup() {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 4 });
  const a = w.addPlayer(0, 'A', 0, 'none', false);
  const b = w.addPlayer(1, 'B', 1, 'none', false);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  w.items = [];
  a.pos.x = 0; a.pos.z = 0; a.pos.y = 0; a.yaw = 0; a.vel.x = a.vel.z = 0;
  b.pos.x = 0; b.pos.z = 8; b.pos.y = 0; b.vel.x = b.vel.z = 0; // 멀리 — 방해되지 않게
  return { w, a, b };
}
/** 점프해서 상승 중(공중)까지 진행한다 */
function jump(w: World, a: ReturnType<World['addPlayer']>) {
  w.step([inp(0, 0, BTN_JUMP), inp()]);
  for (let i = 0; i < 6; i++) w.step([inp(), inp()]);
  expect(a.grounded).toBe(false);
}

describe('공중 공격', () => {
  it('공중 약공은 점프 궤적을 유지한다 — 아래로 끌어내리지 않는다', () => {
    const { w, a } = setup();
    jump(w, a);
    const vyBefore = a.vel.y, yBefore = a.pos.y;
    w.step([inp(0, 0, BTN_ATTACK), inp()]);
    expect(a.state).toBe('jumpAttack');
    expect(a.move).toBe('airAttack');
    // 중력 한 틱분만 줄어야 한다 (급강하처럼 −3 으로 꺾이지 않는다)
    expect(a.vel.y).toBeCloseTo(vyBefore - C.GRAVITY * C.DT, 5);
    expect(a.vel.y).toBeGreaterThan(-1);
    // 계속 올라간다
    for (let i = 0; i < 3; i++) w.step([inp(), inp()]);
    expect(a.pos.y).toBeGreaterThan(yBefore);
  });

  it('공중 강공은 급강하 — 앞아래로 꽂히고 착지까지 판정이 남는다', () => {
    const { w, a } = setup();
    jump(w, a);
    w.step([inp(0, 0, BTN_HEAVY), inp()]);
    expect(a.state).toBe('jumpAttack');
    expect(a.move).toBe('divekick');
    expect(a.vel.y).toBeLessThanOrEqual(-3);
    expect(Math.hypot(a.vel.x, a.vel.z)).toBeGreaterThan(5);
    expect(MOVES.divekick.activeUntilLand).toBe(true);
  });

  it('공중 약공이 끝나면 낙하로 돌아간다 — 공중에서 다시 점프할 수 없다', () => {
    const { w, a } = setup();
    jump(w, a);
    w.step([inp(0, 0, BTN_ATTACK), inp()]);
    for (let i = 0; i < totalTicks(MOVES.airAttack) + 1; i++) w.step([inp(), inp()]);
    expect(a.grounded).toBe(false);
    expect(a.state).toBe('fall');
    const yTop = a.pos.y;
    w.step([inp(0, 0, BTN_JUMP), inp()]); // 공중 점프 시도
    expect(a.state).toBe('fall');
    expect(a.pos.y).toBeLessThan(yTop); // 떨어지는 중
  });

  it('공중 약공으로 지상의 상대를 때린다', () => {
    const { w, a, b } = setup();
    b.pos.z = 1.2; b.hp = b.maxHp;
    jump(w, a);
    const ev = [];
    for (let i = 0; i < 12; i++) ev.push(...w.step([inp(0, 0, i === 0 ? BTN_ATTACK : 0), inp()]));
    expect(b.hp).toBe(b.maxHp - MOVES.airAttack.damage);
    expect(ev.some((e) => e.t === 'hit' && e.v === b.id && e.a === a.id)).toBe(true);
  });

  it('착지 경직은 쓴 무브의 후딜을 따른다 (급강하가 더 길다)', () => {
    const light = setup();
    jump(light.w, light.a);
    light.w.step([inp(0, 0, BTN_ATTACK), inp()]);
    for (let i = 0; i < 200 && !light.a.grounded; i++) light.w.step([inp(), inp()]);
    // 약공은 공중에서 끝나 fall 로 돌아가므로 착지 경직은 보통 착지값
    expect(light.a.landTicks).toBe(C.LAND_TICKS);

    const heavy = setup();
    jump(heavy.w, heavy.a);
    heavy.w.step([inp(0, 0, BTN_HEAVY), inp()]);
    for (let i = 0; i < 200 && !heavy.a.grounded; i++) heavy.w.step([inp(), inp()]);
    expect(heavy.a.landTicks).toBe(MOVES.divekick.recovery);
    expect(MOVES.divekick.recovery).toBeGreaterThan(C.LAND_TICKS);
  });
});
