// 드럼통 (2026-09-12 「건물 내부·오브젝트」): 잽 3방 또는 던지기로 터진다. 반경 3m 25 피해(때린 사람도), 옆 드럼통은 연쇄, 45초 뒤 재생성.
// 방: 콜로세움 동·서 문루, 스카이독 컨테이너 — 벽은 막히고 문으로 나간다.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_PICKUP, type Input } from '../src/input.ts';
import { BARREL_HP, BARREL_DAMAGE, BARREL_RESPAWN_TICKS, createItem } from '../src/items.ts';
import { MAPS, MAP_IDS, roomBoxes, type MapId } from '../src/maps.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });
function setup(seed = 3, mapId: MapId = 'colosseum') {
  const w = new World({ mapId, modeId: 'ffa_dm', seconds: 180, seed });
  const a = w.addPlayer(0, 'A', 0, 'none', false);
  const b = w.addPlayer(1, 'B', 1, 'none', false);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  w.items = []; // 맵의 상자·드럼통은 치우고 시험마다 필요한 것만 놓는다
  a.pos.x = 0; a.pos.z = 0; a.pos.y = 0; a.yaw = 0; a.vel.x = a.vel.z = 0;
  b.pos.x = -6; b.pos.z = -6; b.pos.y = 0; b.yaw = Math.PI; b.vel.x = b.vel.z = 0;
  return { w, a, b };
}
const steps = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };
const barrelAt = (w: World, x: number, z: number) => { const it = createItem(w.nextItemId++, 'barrel', x, 0, z); w.items.push(it); return it; };
/** 앞의 드럼통을 잽으로 두들겨 터질 때까지 (최대 n 틱). 폭발 이벤트 수를 돌려준다 */
function punchUntilExplode(w: World, n = 200): number {
  let explodes = 0;
  for (let i = 0; i < n && !explodes; i++) for (const e of w.step([inp(0, 0, i % 6 === 0 ? BTN_ATTACK : 0), inp()])) if (e.t === 'explode') explodes++;
  return explodes;
}

describe('드럼통', () => {
  it('맵마다 드럼통 자리가 있고 시작할 때 그 수만큼 생긴다', () => {
    for (const id of MAP_IDS) {
      const w = new World({ mapId: id, modeId: 'ffa_dm', seconds: 60, seed: 1 });
      expect(MAPS[id].barrels.length, id).toBeGreaterThan(0);
      expect(w.items.filter((i) => i.kind === 'barrel').length, id).toBe(MAPS[id].barrels.length);
      expect(w.items.filter((i) => i.kind === 'barrel').every((i) => i.hp === BARREL_HP)).toBe(true);
    }
  });

  it('잽으로 두들기면 터진다 — 반경 안(때린 나 1.2m)은 25 피해, 4m 밖은 무피해', () => {
    const { w, a, b } = setup();
    const bl = barrelAt(w, 0, 1.2);
    b.pos.x = 0; b.pos.z = 5.2; // 드럼통에서 4m
    expect(punchUntilExplode(w)).toBe(1);
    expect(bl.hp).toBeLessThanOrEqual(0);
    expect(w.items.find((i) => i.id === bl.id)).toBeUndefined();
    expect(a.hp).toBe(a.maxHp - BARREL_DAMAGE);
    expect(b.hp).toBe(b.maxHp);
  });

  it('반경 안(2m)의 상대는 25 피해를 입고 띄워지며 때린 사람이 피해 주체다', () => {
    const { w, a, b } = setup();
    barrelAt(w, 0, 1.2);
    b.pos.x = 0; b.pos.z = 3.2; // 드럼통에서 2m
    expect(punchUntilExplode(w)).toBe(1);
    expect(b.hp).toBe(b.maxHp - BARREL_DAMAGE);
    expect(b.lastHitBy).toBe(a.id);
    expect(['launched', 'thrown', 'hitstun', 'down', 'getup']).toContain(b.state);
  });

  it('주워서 던지면 착지할 때 터진다', () => {
    const { w, a } = setup();
    const bl = barrelAt(w, 0, 0.8);
    w.step([inp(0, 0, BTN_PICKUP), inp()]);
    w.step([inp(), inp()]);
    expect(a.holding).toBe(bl.id);
    expect(bl.heldBy).toBe(a.id);
    w.step([inp(0, 0, BTN_ATTACK), inp()]);
    expect(a.holding).toBe(-1);
    expect(bl.airborne).toBe(true);
    let explode = false;
    for (let i = 0; i < 240 && !explode; i++) for (const e of w.step([inp(), inp()])) if (e.t === 'explode') explode = true;
    expect(explode).toBe(true);
    expect(w.items.find((i) => i.id === bl.id)).toBeUndefined();
  });

  it('폭발 반경 안의 드럼통은 연쇄로 터지고, 밖의 것은 남는다', () => {
    const { w } = setup();
    barrelAt(w, 0, 1.2);
    const near = barrelAt(w, 0, 3.4);  // 첫 것에서 2.2m
    const far = barrelAt(w, 0, 7.0);   // 첫 것에서 5.8m, 둘째에서 3.6m
    expect(punchUntilExplode(w)).toBe(2);
    expect(w.items.find((i) => i.id === near.id)).toBeUndefined();
    expect(w.items.find((i) => i.id === far.id)).toBeDefined();
  });

  it('터진 자리는 45초 뒤 다시 생긴다 (사람이 비켜 있을 때)', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'ffa_dm', seconds: 180, seed: 5 });
    const a = w.addPlayer(0, 'A', 0, 'none', false);
    w.addPlayer(1, 'B', 1, 'none', false);
    for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
    const bl = w.items.find((i) => i.kind === 'barrel')!;
    a.pos.x = bl.x; a.pos.z = bl.z - 1.2; a.pos.y = 0; a.yaw = 0; a.vel.x = a.vel.z = 0;
    expect(punchUntilExplode(w)).toBe(1);
    expect(w.barrelTimers[bl.spot]).toBeGreaterThanOrEqual(BARREL_RESPAWN_TICKS - 1); // 같은 틱의 stepItems 가 하나 뺀다
    a.pos.x = 0; a.pos.z = 0; a.state = 'idle';
    for (let i = 0; i < BARREL_RESPAWN_TICKS + 2; i++) w.step([inp(), inp()]);
    expect(w.items.filter((i) => i.kind === 'barrel' && i.spot === bl.spot).length).toBe(1);
  });

  it('바닥의 드럼통은 걸어서 통과하지 못한다', () => {
    const { w, a } = setup();
    barrelAt(w, 0, 2.5);
    steps(w, inp(0, 1), inp(), 90);
    expect(a.pos.z).toBeLessThan(2.5 - 0.45 - C.PLAYER_RADIUS + 0.05);
    expect(a.pos.z).toBeGreaterThan(1.0);
  });
});

describe('방 (콜로세움 문루 · 스카이독 컨테이너)', () => {
  it('콜로세움 동쪽 문루: 벽에 막히고 서쪽 문으로 나가며 안에서 점프하면 천장에 막힌다', () => {
    const room = MAPS.colosseum.rooms[0];
    expect(MAPS.colosseum.rooms.length).toBe(2);
    expect(roomBoxes(room, 0).filter((b) => b.part === 'wall').length).toBe(5);
    const { w, a } = setup(3, 'colosseum');
    a.pos.x = 15; a.pos.z = 6;
    steps(w, inp(1, 0), inp(), 90);
    expect(a.pos.x).toBeLessThan(room.maxX - 0.3 - C.PLAYER_RADIUS + 0.05);
    a.pos.x = 15; a.pos.z = 6; a.vel.x = a.vel.z = 0;
    steps(w, inp(-1, 0), inp(), 120);
    expect(a.pos.x).toBeLessThan(room.minX - 0.3);
    a.pos.x = 15; a.pos.z = 6; a.pos.y = 0; a.vel.x = a.vel.z = 0;
    let peak = 0;
    for (let i = 0; i < 60; i++) { w.step([inp(0, 0, i === 0 ? 2 : 0), inp()]); peak = Math.max(peak, a.pos.y); }
    expect(peak).toBeLessThanOrEqual(room.height - C.PLAYER_HEIGHT + 1e-6);
    expect(peak).toBeGreaterThan(0.2);
  });

  it('스카이독 컨테이너: 남쪽 벽에 막히고 북쪽 문으로 나간다', () => {
    const room = MAPS.skydock.rooms[0];
    const { w, a } = setup(3, 'skydock');
    a.pos.x = 0; a.pos.z = -5.5;
    steps(w, inp(0, -1), inp(), 90);
    expect(a.pos.z).toBeGreaterThan(room.minZ + 0.3 + C.PLAYER_RADIUS - 0.05);
    a.pos.z = -5.5; a.vel.x = a.vel.z = 0;
    steps(w, inp(0, 1), inp(), 120);
    expect(a.pos.z).toBeGreaterThan(room.maxZ + 0.3);
  });

  it('방 안 드럼통 자리는 방 안쪽에 있다 (벽 두께 0.3 + 반지름 0.45 여유)', () => {
    const inside = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, s: { x: number; z: number }) =>
      s.x > r.minX + 0.75 && s.x < r.maxX - 0.75 && s.z > r.minZ + 0.75 && s.z < r.maxZ - 0.75;
    expect(MAPS.colosseum.barrels.filter((s) => MAPS.colosseum.rooms.some((r) => inside(r, s))).length).toBe(2);
    expect(MAPS.skydock.barrels.filter((s) => MAPS.skydock.rooms.some((r) => inside(r, s))).length).toBe(1);
    expect(MAPS.rooftop.barrels.filter((s) => MAPS.rooftop.rooms.some((r) => inside(r, s))).length).toBe(1);
  });
});
