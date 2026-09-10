import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_PICKUP, type Input } from '../src/input.ts';
import { CRATE_HP, BOMB_FUSE_TICKS, BOMB_DAMAGE, HEART_HEAL, CRATE_THROW_DAMAGE, CRATE_RESPAWN_TICKS, createItem } from '../src/items.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

function setup(seed = 11) {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed });
  const a = w.addPlayer(0, 'A', 0, 'none', false);
  const b = w.addPlayer(1, 'B', 1, 'none', false);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  a.pos.x = 0; a.pos.z = 0; a.yaw = 0; b.pos.x = 12; b.pos.z = 12; b.yaw = Math.PI;
  return { w, a, b };
}
const run = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };

describe('아이템', () => {
  it('맵의 상자 자리마다 상자가 생긴다', () => {
    const { w } = setup();
    expect(w.items.filter((i) => i.kind === 'crate').length).toBe(6);
  });
  it('상자는 잽 2방에 부서지고, 부서진 자리는 30초 뒤 다시 생긴다', () => {
    const { w, a } = setup();
    const crate = w.items.find((i) => i.kind === 'crate')!;
    a.pos.x = crate.x; a.pos.z = crate.z - 1.0; a.yaw = 0;
    let broke = false;
    for (let i = 0; i < 60 && !broke; i++) for (const e of w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), inp()])) if (e.t === 'crateBreak') broke = true;
    expect(broke).toBe(true);
    expect(w.items.find((i) => i.id === crate.id)).toBeUndefined();
    a.pos.x = 5; a.pos.z = -5; // 자리에서 비켜 준다
    for (let i = 0; i < CRATE_RESPAWN_TICKS + 2; i++) w.step([inp(), inp()]);
    expect(w.items.filter((i) => i.kind === 'crate' && i.spot === crate.spot).length).toBe(1);
  });
  it('상자 드랍은 시드에 따라 하트·폭탄·없음 중 하나', () => {
    let hearts = 0, bombs = 0, none = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { w, a } = setup(seed);
      const crate = w.items.find((i) => i.kind === 'crate')!;
      a.pos.x = crate.x; a.pos.z = crate.z - 1.0; a.yaw = 0;
      let drop: string | null = null;
      for (let i = 0; i < 60 && drop === null; i++) for (const e of w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), inp()])) if (e.t === 'crateBreak') drop = e.drop;
      if (drop === 'heart') hearts++; else if (drop === 'bomb') bombs++; else none++;
    }
    expect(hearts).toBeGreaterThan(3);
    expect(bombs).toBeGreaterThan(1);
    expect(none).toBeGreaterThan(8);
  });
  it('하트를 밟으면 30 회복 (최대치 넘지 않음)', () => {
    const { w, a } = setup();
    w.items.push(createItem(900, 'heart', 0, 0, 1.0));
    a.hp = 50;
    run(w, inp(0, 1), inp(), 20);
    expect(a.hp).toBe(80);
    w.items.push(createItem(901, 'heart', a.pos.x, 0, a.pos.z + 0.8));
    run(w, inp(0, 1), inp(), 20);
    expect(a.hp).toBe(a.maxHp);
  });
  it('F 로 상자를 들고 Z 로 던지면 맞은 상대는 8 데미지에 다운', () => {
    const { w, a, b } = setup();
    const crate = createItem(902, 'crate', 0, 0, 1.0);
    w.items.push(crate);
    b.pos.x = 0; b.pos.z = 4.5; b.yaw = Math.PI;
    run(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.holding).toBe(crate.id);
    expect(crate.heldBy).toBe(a.id);
    run(w, inp(), inp(), 5);
    run(w, inp(0, 0, BTN_ATTACK), inp(), 1);
    expect(a.holding).toBe(-1);
    expect(crate.airborne).toBe(true);
    let hit = false;
    for (let i = 0; i < 90; i++) for (const e of w.step([inp(), inp()])) if (e.t === 'hit' && e.v === b.id) hit = true;
    expect(hit).toBe(true);
    expect(b.hp).toBe(b.maxHp - CRATE_THROW_DAMAGE);
    expect(['launched', 'down', 'getup']).toContain(b.state);
  });
  it('폭탄은 줍고 3초 뒤 터져 반지름 2.5m 안에 20 데미지', () => {
    const { w, a, b } = setup();
    const bomb = createItem(903, 'bomb', 0, 0, 1.0);
    w.items.push(bomb);
    b.pos.x = 1.5; b.pos.z = 1.5; b.yaw = Math.PI;
    run(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.holding).toBe(bomb.id);
    expect(bomb.fuse).toBeGreaterThanOrEqual(BOMB_FUSE_TICKS - 1);
    let exploded = false;
    for (let i = 0; i < BOMB_FUSE_TICKS + 5 && !exploded; i++) for (const e of w.step([inp(), inp()])) if (e.t === 'explode') exploded = true;
    expect(exploded).toBe(true);
    expect(b.hp).toBe(b.maxHp - BOMB_DAMAGE);
    expect(a.hp).toBe(a.maxHp - BOMB_DAMAGE); // 들고 있던 본인도
    expect(a.holding).toBe(-1);
  });
  it('던진 폭탄은 착지해서 남은 시간에 터진다', () => {
    const { w, a, b } = setup();
    const bomb = createItem(904, 'bomb', 0, 0, 1.0);
    w.items.push(bomb);
    b.pos.x = 0; b.pos.z = 6; b.yaw = Math.PI;
    run(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    run(w, inp(), inp(), 5);
    run(w, inp(0, 0, BTN_ATTACK), inp(), 1);
    let exploded = false;
    for (let i = 0; i < BOMB_FUSE_TICKS + 10 && !exploded; i++) for (const e of w.step([inp(), inp()])) if (e.t === 'explode') exploded = true;
    expect(exploded).toBe(true);
    expect(bomb.z).toBeGreaterThan(3);
    expect(a.hp).toBe(a.maxHp);
  });
  it('피격되면 든 것을 떨어뜨린다', () => {
    const { w, a, b } = setup();
    const crate = createItem(905, 'crate', 0, 0, 1.0);
    w.items.push(crate);
    run(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.holding).toBe(crate.id);
    b.pos.x = 0; b.pos.z = -1.2; b.yaw = 0;
    run(w, inp(), inp(0, 0, BTN_ATTACK), 8);
    expect(a.state).toBe('hitstun');
    expect(a.holding).toBe(-1);
    expect(crate.heldBy).toBe(-1);
  });
  it('HEART_HEAL·CRATE_HP 상수는 기획서 값', () => {
    expect(HEART_HEAL).toBe(30);
    expect(CRATE_HP).toBe(10);
  });
});
