// 2026-09-11 2차 플레이 소감: 속도·공격 템포, 직업별 악세서리, 상자 충돌·판정, 폭탄 줍기, 점프대, 팀전 아군 피격.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_PICKUP, type Input } from '../src/input.ts';
import { MOVES, chainTick } from '../src/moves.ts';
import { STYLES, STYLE_IDS, allowedAccessory } from '../src/styles.ts';
import { MAPS } from '../src/maps.ts';
import { createItem } from '../src/items.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

function arena(modeId: 'ffa_dm' | 'team_dm' = 'ffa_dm', mapId: 'colosseum' | 'skydock' = 'colosseum') {
  const w = new World({ mapId, modeId, seconds: 180, seed: 3 });
  const a = w.addPlayer(0, 'A', 0, 'none', false, 'fighter');
  const b = w.addPlayer(1, 'B', modeId === 'team_dm' ? 0 : 1, 'none', false, 'fighter');
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  w.items = []; // 맵 상자는 치우고 테스트가 직접 놓는다
  return { w, a, b };
}
const steps = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };

describe('2차 소감', () => {
  it('걷기·달리기가 느려졌고 공격 템포가 느려졌다 (잽 발동 6 · 후딜 13 · 경직 14)', () => {
    expect(C.WALK_SPEED).toBe(4.0);
    expect(C.RUN_SPEED).toBe(6.2);
    expect(MOVES.jab.startup).toBe(6);
    expect(MOVES.jab.recovery).toBe(13);
    expect(MOVES.jab.hitstun).toBe(14); // 3차 소감: 경직은 원래 값 — 연타 사이에 가드가 들어간다
    expect(chainTick(MOVES.jab)).toBe(6 + 3 + 13);
    expect(MOVES.grab.startup).toBe(4); // 잡기는 그대로
  });

  it('직업이 들 수 없는 악세서리는 맨손으로 들어온다', () => {
    expect(allowedAccessory('grappler', 'pistols')).toBe('none');
    expect(allowedAccessory('speedster', 'pistols')).toBe('pistols');
    for (const id of STYLE_IDS) expect(STYLES[id].accessories[0]).toBe('none');
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 60, seed: 1 });
    expect(w.addPlayer(0, 'H', 0, 'pistols', false, 'heavy').acc).toBe('none');
    expect(w.addPlayer(1, 'S', 0, 'spear', false, 'speedster').acc).toBe('spear');
  });

  it('상자는 통과할 수 없고 위에 올라설 수 있다', () => {
    const { w, a } = arena();
    w.items.push(createItem(99, 'crate', 0, 0, 3));
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0;
    steps(w, inp(0, 1), inp(), 90); // 앞(+z)으로 걷는다
    expect(a.pos.z).toBeLessThan(3 - 0.5 - C.PLAYER_RADIUS + 0.05); // 상자 앞면에서 멈춘다
    expect(a.pos.z).toBeGreaterThan(1.5);
    // 위에 올려 두면 상자 윗면(1m)에 선다
    a.pos.x = 0; a.pos.z = 3; a.pos.y = 1.4; a.vel.y = 0; a.grounded = false;
    steps(w, inp(), inp(), 30);
    expect(a.pos.y).toBeCloseTo(1, 2);
    expect(a.grounded).toBe(true);
  });

  it('상자에 붙어 서서 때려도 상자가 맞는다', () => {
    const { w, a } = arena();
    const crate = createItem(99, 'crate', 0, 0, 1.0); // 몸(반지름 0.4) 바로 앞
    w.items.push(crate);
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0;
    steps(w, inp(0, 0, BTN_ATTACK), inp(), 1);
    steps(w, inp(), inp(), MOVES.jab.startup + 2);
    expect(crate.hp).toBeLessThan(10);
    // 비스듬히(45°) 서 있어도 맞는다
    const { w: w2, a: a2 } = arena();
    const crate2 = createItem(98, 'crate', 0, 0, 1.2);
    w2.items.push(crate2);
    a2.pos.x = -0.6; a2.pos.z = 0; a2.yaw = Math.atan2(0.6, 1.2);
    steps(w2, inp(0, 0, BTN_ATTACK), inp(), 1);
    steps(w2, inp(), inp(), MOVES.jab.startup + 2);
    expect(crate2.hp).toBeLessThan(10);
  });

  it('상자를 부수고 나온 폭탄은 F 로 주울 수 있다', () => {
    const { w, a } = arena();
    const crate = createItem(99, 'crate', 0, 0, 1.0);
    crate.hp = 1;
    w.items.push(crate);
    w.rng = () => 0.35; // 하트(0.3) 뒤 폭탄 구간
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0;
    steps(w, inp(0, 0, BTN_ATTACK), inp(), 1);
    const ev = steps(w, inp(), inp(), MOVES.jab.startup + 2);
    expect(ev.some((e) => e.t === 'crateBreak' && e.drop === 'bomb')).toBe(true);
    const bomb = w.items.find((i) => i.kind === 'bomb')!;
    expect(bomb).toBeDefined();
    steps(w, inp(), inp(), 60); // 튀어 오른 폭탄이 내려앉는다
    expect(bomb.airborne).toBe(false);
    steps(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.holding).toBe(bomb.id);
    expect(bomb.heldBy).toBe(0);
    expect(bomb.fuse).toBeGreaterThan(0);
  });

  it('점프대를 밟으면 튕겨 오른다', () => {
    const { w, a } = arena('ffa_dm', 'skydock');
    const pad = MAPS.skydock.pads[0];
    a.pos.x = pad.x - 1.5; a.pos.z = pad.z; a.pos.y = 0; a.yaw = Math.PI / 2;
    let peak = 0;
    let padEvents = 0;
    for (let i = 0; i < 90; i++) {
      for (const e of w.step([inp(1, 0), inp()])) if (e.t === 'pad') padEvents++;
      peak = Math.max(peak, a.pos.y);
    }
    expect(padEvents).toBeGreaterThanOrEqual(1);
    expect(peak).toBeGreaterThan(2.5); // 동·서 발판(+2m)에 닿는 높이
  });

  it('팀전에서도 아군이 맞고, 아군 KO 는 팀 점수 없이 KO 가 깎인다', () => {
    const { w, a, b } = arena('team_dm');
    expect(a.team).toBe(b.team);
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0; b.pos.x = 0; b.pos.z = 1.2; b.yaw = Math.PI;
    steps(w, inp(0, 0, BTN_ATTACK), inp(), 1);
    steps(w, inp(), inp(), MOVES.jab.startup + 2);
    expect(b.hp).toBeLessThan(b.maxHp);
    b.hp = 1;
    w.kill(b, 'hit', a);
    expect(a.kos).toBe(-1);
    expect(w.score[a.team]).toBe(0);
  });
});
