// KO 시 악세서리 드랍·장착 (2026-09-12 「장르 문법」): 맞아서 KO 되면 들고 있던 악세서리가 그 자리에 떨어지고, 직업이 들 수 있는 사람이 주워 든다.
// 낙사는 같이 떨어져 없어진다. 25초 안에 안 주우면 사라진다. 밀리는 드럼통도 여기서.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_PICKUP, type Input } from '../src/input.ts';
import { ACC_DESPAWN_TICKS, BARREL_PUSH_SPEED, createItem } from '../src/items.ts';
import { ACCESSORIES } from '../src/accessories.ts';
import { encodeSnapshot, applySnapshot } from '../src/snapshot.ts';
import { botInput, newBotMemory } from '../src/bot.ts';
import type { StyleId } from '../src/styles.ts';
import type { AccessoryId } from '../src/accessories.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });
function setup(aStyle: StyleId = 'fighter', aAcc: AccessoryId = 'none', bStyle: StyleId = 'speedster', bAcc: AccessoryId = 'pistols') {
  const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 5 });
  const a = w.addPlayer(0, 'A', 0, aAcc, false, aStyle);
  const b = w.addPlayer(1, 'B', 1, bAcc, false, bStyle);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  w.items = [];
  a.pos.x = 0; a.pos.z = 0; a.pos.y = 0; a.yaw = 0; a.vel.x = a.vel.z = 0;
  b.pos.x = 0; b.pos.z = 1.2; b.pos.y = 0; b.yaw = Math.PI; b.vel.x = b.vel.z = 0;
  return { w, a, b };
}
const steps = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };
/** B 를 A 가 때려 죽인다 — hp 를 1 로 두고 잽 한 방 */
function koByHit(w: World, a: ReturnType<World['addPlayer']>, b: ReturnType<World['addPlayer']>) {
  b.hp = 1; b.state = 'idle';
  const ev = [];
  for (let i = 0; i < 40; i++) { if (w.players[b.id]!.state === 'dead') break; ev.push(...w.step([inp(0, 0, i % 8 === 0 ? 1 : 0), inp()])); }
  return ev;
}

describe('KO 시 악세서리 드랍', () => {
  it('맞아서 KO 되면 들고 있던 악세서리가 그 자리에 떨어지고 본인은 맨손이 된다', () => {
    const { w, a, b } = setup('fighter', 'none', 'speedster', 'pistols'); // 더블탭은 스피드스타 전용
    const ev = koByHit(w, a, b);
    expect(b.state).toBe('dead');
    expect(b.acc).toBe('none');
    const drop = w.items.find((i) => i.kind === 'acc');
    expect(drop).toBeDefined();
    expect(drop!.acc).toBe('pistols');
    expect(Math.hypot(drop!.x - b.pos.x, drop!.z - b.pos.z)).toBeLessThan(1.0);
    expect(ev.some((e) => e.t === 'accDrop' && e.id === b.id && e.acc === 'pistols')).toBe(true);
  });

  it('낙사하면 악세서리도 같이 없어진다', () => {
    const w = new World({ mapId: 'skydock', modeId: 'ffa_dm', seconds: 180, seed: 5 });
    const a = w.addPlayer(0, 'A', 0, 'spear', false, 'martial');
    w.addPlayer(1, 'B', 1, 'none', false);
    for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
    w.items = [];
    a.pos.x = 40; a.pos.z = 0; a.pos.y = -9; // 낙사선 아래
    steps(w, inp(), inp(), 3);
    expect(a.state).toBe('dead');
    expect(w.items.filter((i) => i.kind === 'acc').length).toBe(0);
  });

  it('맨손인 사람이 F 로 주우면 장착된다 — 탄창이 차고 아이템은 없어진다', () => {
    const { w, a } = setup('speedster', 'none');
    const it = createItem(w.nextItemId++, 'acc', 0, 0, 0.8); it.acc = 'pistols'; w.items.push(it);
    const ev = steps(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.acc).toBe('pistols');
    expect(a.ammo).toBe(ACCESSORIES.pistols.ammo);
    expect(a.holding).toBe(-1);
    expect(w.items.find((i) => i.id === it.id)).toBeUndefined();
    expect(ev.some((e) => e.t === 'equip' && e.id === a.id && e.acc === 'pistols')).toBe(true);
  });

  it('직업이 못 드는 악세서리는 줍지 않는다 (그래플러 ↔ 더블탭)', () => {
    const { w, a } = setup('grappler', 'none');
    const it = createItem(w.nextItemId++, 'acc', 0, 0, 0.8); it.acc = 'pistols'; w.items.push(it);
    steps(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.acc).toBe('none');
    expect(w.items.find((i) => i.id === it.id)).toBeDefined();
  });

  it('이미 든 것이 있으면 바꿔 든다 — 전 것이 그 자리에 떨어진다', () => {
    // 직업 전용이 된 뒤로 **같은 무기끼리만** 바뀐다 (파이터끼리 부스터를 주고받는 상황).
    // 남의 전용은 tryPickup 이 아예 거르므로 여기 오지 않는다.
    const { w, a } = setup('fighter', 'rocket');
    const it = createItem(w.nextItemId++, 'acc', 0, 0, 0.8); it.acc = 'rocket'; w.items.push(it);
    steps(w, inp(0, 0, BTN_PICKUP), inp(), 1);
    expect(a.acc).toBe('rocket');
    expect(w.items.find((i) => i.id === it.id)).toBeUndefined(); // 주운 것은 없어지고
    const old = w.items.find((i) => i.kind === 'acc');
    expect(old?.acc).toBe('rocket'); // 들고 있던 것이 그 자리에 떨어져 있다
    expect(old?.id).not.toBe(it.id);
  });

  it('25초 안에 안 주우면 사라진다', () => {
    const { w } = setup();
    const it = createItem(w.nextItemId++, 'acc', 5, 0, 5); it.acc = 'spear'; it.fuse = ACC_DESPAWN_TICKS; w.items.push(it);
    steps(w, inp(), inp(), ACC_DESPAWN_TICKS - 1);
    expect(w.items.find((i) => i.id === it.id)).toBeDefined();
    steps(w, inp(), inp(), 2);
    expect(w.items.find((i) => i.id === it.id)).toBeUndefined();
  });

  it('스냅샷이 플레이어의 바뀐 악세서리와 떨어진 악세서리를 싣는다', () => {
    const { w, a, b } = setup('fighter', 'none', 'speedster', 'pistols');
    koByHit(w, a, b);
    const snap = encodeSnapshot(w);
    const w2 = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 5 });
    w2.addPlayer(0, 'A', 0, 'none', false, 'fighter');
    w2.addPlayer(1, 'B', 1, 'pistols', false, 'speedster'); // 명단은 시작 때 것 — 스냅샷이 덮어야 한다
    applySnapshot(w2, snap);
    expect(w2.players[1]!.acc).toBe('none');
    expect(w2.items.find((i) => i.kind === 'acc')?.acc).toBe('pistols');
  });

  it('맨손 봇은 근처의 쓸 수 있는 악세서리를 주우러 간다', () => {
    const { w, a } = setup('fighter', 'none');
    const it = createItem(w.nextItemId++, 'acc', 3, 0, 0); it.acc = 'rocket'; w.items.push(it);
    const mem = newBotMemory(w.rng);
    for (let i = 0; i < 240 && a.acc === 'none'; i++) w.step([botInput(w, a, mem), inp()]);
    expect(a.acc).toBe('rocket');
  });
});

describe('밀리는 드럼통', () => {
  it('걸어서 밀면 앞으로 미끄러지다 선다', () => {
    const { w, a } = setup();
    w.players[1]!.pos.x = 8; w.players[1]!.pos.z = 8; // B 가 앞을 막지 않게
    const bl = createItem(w.nextItemId++, 'barrel', 0, 0, 1.3); w.items.push(bl);
    const z0 = bl.z;
    steps(w, inp(0, 1), inp(), 30);
    expect(bl.z - z0).toBeGreaterThan(0.6);
    expect(Math.hypot(bl.vx, bl.vz)).toBeLessThanOrEqual(BARREL_PUSH_SPEED);
    // 손을 떼면 선다 (마찰)
    a.pos.z = -5;
    steps(w, inp(), inp(), 90);
    expect(bl.vx).toBe(0); expect(bl.vz).toBe(0);
    expect(w.items.find((i) => i.id === bl.id)).toBeDefined();
  });
  it('옆에서 스치는 것은 밀지 않는다 (입력 방향 앞에 있을 때만)', () => {
    const { w, a } = setup();
    w.players[1]!.pos.x = 8; w.players[1]!.pos.z = 8;
    const bl = createItem(w.nextItemId++, 'barrel', 1.0, 0, 0); w.items.push(bl);
    a.pos.x = 0; a.pos.z = -0.2;
    steps(w, inp(0, 1), inp(), 10); // 북쪽으로 걷는다 — 드럼통은 동쪽
    expect(Math.abs(bl.x - 1.0)).toBeLessThan(0.15);
  });
});
