import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_GUARD, BTN_SPECIAL, BTN_JUMP, type Input } from '../src/input.ts';
import { MOVES } from '../src/moves.ts';
import type { AccessoryId } from '../src/accessories.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

function setup(accA: AccessoryId, accB: AccessoryId = 'none', dist = 1.2) {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 5 });
  const a = w.addPlayer(0, 'A', 0, accA, false);
  const b = w.addPlayer(1, 'B', 1, accB, false);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  a.pos.x = 0; a.pos.z = 0; a.yaw = 0; b.pos.x = 0; b.pos.z = dist; b.yaw = Math.PI;
  return { w, a, b };
}
function run(w: World, ia: Input, ib: Input, n: number) { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; }
/** 격틱 연타로 n틱 */
function mash(w: World, n: number, ib: Input = inp()) { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), ib])); return ev; }

describe('악세서리', () => {
  it('브레이커: 2단 베기, 2타는 띄움, 잡기 불가', () => {
    const { w, a, b } = setup('greatsword', 'none', 1.4);
    const seen: string[] = [];
    for (let i = 0; i < 70; i++) { w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), inp()]); if (a.move && seen[seen.length - 1] !== a.move) seen.push(a.move); }
    expect(seen.slice(0, 2)).toEqual(['gs1', 'gs2']);
    expect(b.hp).toBeLessThanOrEqual(b.maxHp - 12 - 16);
    // 밀착해도 잡기가 아니라 베기
    const s2 = setup('greatsword', 'none', 0.8);
    s2.w.step([inp(0, 0, BTN_ATTACK), inp()]);
    expect(s2.a.state).toBe('attack');
  });
  it('브레이커 기술: 내려찍기는 반지름 2.5m 안을 전부 띄운다', () => {
    const { w, a, b } = setup('greatsword', 'none', 2.0);
    const c = w.addPlayer(2, 'C', 1, 'none', false); c.pos.x = -1.8; c.pos.z = 0.5; c.yaw = 0;
    run(w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    expect(a.state).toBe('special');
    for (let i = 0; i < 40; i++) w.step([inp(), inp(), inp()]);
    expect(b.hp).toBe(b.maxHp - 20);
    expect(c.hp).toBe(c.maxHp - 20);
  });
  it('스파이크: 리치 2.2m 에서 찌르기가 닿고 1.0m 옆은 빗나간다', () => {
    const { w, b } = setup('spear', 'none', 2.1);
    run(w, inp(0, 0, BTN_ATTACK), inp(), MOVES.sp1.startup + 2);
    expect(b.hp).toBe(b.maxHp - 6);
    const s2 = setup('spear', 'none', 1.5);
    s2.b.pos.x = 1.0;
    run(s2.w, inp(0, 0, BTN_ATTACK), inp(), MOVES.sp1.startup + 2);
    expect(s2.b.hp).toBe(s2.b.maxHp);
  });
  it('스파이크 기술: 돌진 찌르기는 약 6m 전진하며 관통한다', () => {
    const { w, a, b } = setup('spear', 'none', 3);
    const c = w.addPlayer(2, 'C', 1, 'none', false); c.pos.x = 0; c.pos.z = 5; c.yaw = Math.PI;
    run(w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    for (let i = 0; i < 60; i++) w.step([inp(), inp(), inp()]);
    expect(a.pos.z).toBeGreaterThan(4.5);
    expect(b.hp).toBe(b.maxHp - 14);
    expect(c.hp).toBe(c.maxHp - 14);
  });
  it('더블탭: 탄환은 투사체로 8m 밖 상대를 맞히고 탄창이 준다', () => {
    const { w, a, b } = setup('pistols', 'none', 8);
    const ev = run(w, inp(0, 0, BTN_ATTACK), inp(), 40);
    expect(ev.some((e) => e.t === 'shot')).toBe(true);
    expect(b.hp).toBe(b.maxHp - 4);
    expect(a.ammo).toBe(11);
  });
  it('더블탭: 탄창이 비면 재장전 1.5초 뒤 12발로 돌아온다', () => {
    const { w, a } = setup('pistols', 'none', 8);
    a.ammo = 1;
    run(w, inp(0, 0, BTN_ATTACK), inp(), 6);
    expect(a.ammo).toBe(0);
    expect(a.reload).toBeGreaterThan(0);
    run(w, inp(), inp(), 95);
    expect(a.ammo).toBe(12);
  });
  it('더블탭 기술: 백롤 난사는 뒤로 물러나며 여러 발을 쏜다', () => {
    const { w, a } = setup('pistols', 'none', 6);
    const ev = run(w, inp(0, 0, BTN_SPECIAL), inp(), 30);
    expect(a.pos.z).toBeLessThan(-1.5);
    expect(w.projectiles.length + ev.filter((e) => e.t === 'shot').length).toBeGreaterThan(0);
  });
  it('월: 가드 크러시 면역 — 게이지가 0 아래로 가도 기절하지 않는다', () => {
    const { w, b } = setup('none', 'shield', 1.2);
    for (let i = 0; i < 400; i++) w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), inp(0, 0, BTN_GUARD)]);
    expect(b.state).toBe('guard');
    expect(b.hp).toBe(b.maxHp);
  });
  it('월 기술: 실드 차지는 전진하며 부딪힌 상대를 띄운다', () => {
    const { w, a, b } = setup('shield', 'none', 3);
    run(w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    for (let i = 0; i < 70; i++) w.step([inp(), inp()]);
    expect(a.pos.z).toBeGreaterThan(3.5);
    expect(b.hp).toBe(b.maxHp - 12);
  });
  it('부스터: 로켓 펀치 투사체 16 데미지, 공중 대시 1회', () => {
    const { w, a, b } = setup('rocket', 'none', 6);
    run(w, inp(0, 0, BTN_SPECIAL), inp(), 60);
    expect(b.hp).toBe(b.maxHp - 16);
    expect(['launched', 'down', 'getup']).toContain(b.state);
    // 공중 대시
    run(w, inp(0, 0, BTN_JUMP), inp(), 1);
    run(w, inp(), inp(), 5);
    const z0 = a.pos.z;
    run(w, inp(0, 0, BTN_SPECIAL), inp(), 1);
    expect(a.airDashes).toBe(0);
    run(w, inp(), inp(), 10);
    expect(a.pos.z - z0).toBeGreaterThan(1.2);
  });
  it('부스터 기본 공격은 리치가 길어 2.2m 에서도 닿는다', () => {
    const { w, b } = setup('rocket', 'none', 2.2);
    run(w, inp(0, 0, BTN_ATTACK), inp(), MOVES.rk1.startup + 2);
    expect(b.hp).toBe(b.maxHp - 6);
    const s2 = setup('none', 'none', 2.2);
    run(s2.w, inp(0, 0, BTN_ATTACK), inp(), MOVES.jab.startup + 2);
    expect(s2.b.hp).toBe(s2.b.maxHp);
  });
});
