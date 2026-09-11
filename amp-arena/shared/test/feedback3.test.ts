// 2026-09-12 3차 플레이 소감: 약공·강공 사슬, 반격기, 연타 사이 대응, 봇 무작위 장비, 옥상 상자·기계실, 폭탄 반지름.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_ATTACK, BTN_HEAVY, BTN_GUARD, BTN_ALL, sanitizeInput, type Input } from '../src/input.ts';
import { MOVES } from '../src/moves.ts';
import { STYLES, STYLE_IDS, randomLoadout } from '../src/styles.ts';
import { ACCESSORIES, ACCESSORY_IDS } from '../src/accessories.ts';
import { MAPS, MAP_IDS, roomBoxes } from '../src/maps.ts';
import { makeRng } from '../src/math.ts';
import { createItem, BOMB_RADIUS } from '../src/items.ts';
import { encodePlayer } from '../src/snapshot.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

function arena(styleA: 'fighter' | 'grappler' | 'heavy' = 'fighter', mapId: 'colosseum' | 'rooftop' = 'colosseum', modeId: 'ffa_dm' | 'team_dm' = 'ffa_dm') {
  const w = new World({ mapId, modeId, seconds: 180, seed: 11 });
  const a = w.addPlayer(0, 'A', 0, 'none', false, styleA);
  const b = w.addPlayer(1, 'B', 1, 'none', false, 'fighter');
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  w.items = [];
  return { w, a, b };
}
const steps = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };
/** 격틱으로 키를 눌러 사슬 이름을 모은다 */
function chainOf(w: World, a: { move: string | null }, btn: number, n: number, ib: Input = inp()) {
  const seen: string[] = [];
  for (let i = 0; i < n; i++) { w.step([inp(0, 0, i % 2 === 0 ? btn : 0), ib]); if (a.move && seen[seen.length - 1] !== a.move) seen.push(a.move); }
  return seen;
}

describe('3차 소감 — 약공·강공', () => {
  it('강공 비트가 따로 있고 입력 검증을 통과한다', () => {
    expect(BTN_HEAVY & BTN_ATTACK).toBe(0);
    expect(sanitizeInput({ seq: 1, mx: 0, mz: 0, btn: BTN_HEAVY })!.btn).toBe(BTN_HEAVY);
    expect(BTN_ALL & BTN_HEAVY).toBe(BTN_HEAVY);
  });

  it('모든 직업·악세서리의 약공·강공 사슬은 실제 동작이고 발동·후딜이 있다', () => {
    const all = [...STYLE_IDS.map((s) => STYLES[s]), ...ACCESSORY_IDS.map((a) => ACCESSORIES[a])];
    for (const d of all) {
      expect(d.combo.length).toBeGreaterThanOrEqual(1);
      expect(d.heavy.length).toBeGreaterThanOrEqual(1);
      for (const id of [...d.combo, ...d.heavy]) { const m = MOVES[id]; expect(m, id).toBeDefined(); expect(m.startup).toBeGreaterThan(0); expect(m.recovery).toBeGreaterThan(0); }
    }
    expect(MOVES.counter.startup).toBe(4);
  });

  it('약공 연타는 약공 사슬, 강공 연타는 강공 사슬, 약공 중 강공은 강공 피니시로 이어진다', () => {
    const { w, a } = arena('fighter');
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0;
    expect(chainOf(w, a, BTN_ATTACK, 120).slice(0, 3)).toEqual(['jab', 'straight', 'kick1']); // 사슬이 끝나면 다시 잽부터
    const s2 = arena('fighter');
    expect(chainOf(s2.w, s2.a, BTN_HEAVY, 140).slice(0, 2)).toEqual(['roundhouse', 'haymaker']);
    // 잽 뒤 강공 → 헤이메이커(강공 사슬의 마지막)
    const s3 = arena('fighter');
    s3.w.step([inp(0, 0, BTN_ATTACK), inp()]);
    steps(s3.w, inp(), inp(), MOVES.jab.startup + 1);
    s3.w.step([inp(0, 0, BTN_HEAVY), inp()]);
    const seen: string[] = ['jab'];
    for (let i = 0; i < 60; i++) { s3.w.step([inp(), inp()]); if (s3.a.move && seen[seen.length - 1] !== s3.a.move) seen.push(s3.a.move); }
    expect(seen).toEqual(['jab', 'haymaker']);
    expect(s3.a.chain).toBe(1);
  });

  it('직업별 사슬: 그래플러 약공 3단 · 헤비 강공은 슈퍼아머 강타', () => {
    const { w, a } = arena('grappler');
    expect(chainOf(w, a, BTN_ATTACK, 140).slice(0, 3)).toEqual(['hook', 'hook2', 'headbutt']);
    const h = arena('heavy');
    expect(chainOf(h.w, h.a, BTN_HEAVY, 160).slice(0, 2)).toEqual(['heavy1', 'heavy2']);
  });

  it('맞는 쪽이 대응할 수 있다: 첫 타를 맞은 뒤 가드를 들면 둘째 타는 막힌다', () => {
    const { w, a, b } = arena('fighter');
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0; b.pos.x = 0; b.pos.z = 1.2; b.yaw = Math.PI;
    expect(MOVES.jab.hitstun).toBeLessThan(MOVES.jab.recovery + MOVES.straight.startup); // 경직이 다음 타보다 먼저 풀린다
    const ev: ReturnType<typeof steps> = [];
    for (let i = 0; i < 60; i++) ev.push(...w.step([inp(0, 0, i % 2 === 0 ? BTN_ATTACK : 0), inp(0, 0, i > MOVES.jab.startup + 2 ? BTN_GUARD : 0)]));
    const hits = ev.filter((e) => e.t === 'hit' && e.v === 1);
    expect(hits[0]!.t === 'hit' && hits[0]!.kind).toBe('hit');
    expect(hits.some((e) => e.t === 'hit' && e.kind === 'guard')).toBe(true);
  });

  it('반격기: 가드로 막은 직후 공격 키를 누르면 counter 가 나가고 상대가 띄워진다', () => {
    const { w, a, b } = arena('fighter');
    a.pos.x = 0; a.pos.z = 0; a.yaw = 0; b.pos.x = 0; b.pos.z = 1.2; b.yaw = Math.PI;
    w.step([inp(0, 0, BTN_ATTACK), inp(0, 0, BTN_GUARD)]);
    const ev = steps(w, inp(), inp(0, 0, BTN_GUARD), MOVES.jab.startup + 1);
    expect(ev.some((e) => e.t === 'hit' && e.kind === 'guard')).toBe(true);
    expect(b.counterT).toBeGreaterThan(0);
    w.step([inp(), inp(0, 0, BTN_GUARD | BTN_ATTACK)]);
    expect(b.move).toBe('counter');
    const ev2 = steps(w, inp(), inp(), MOVES.counter.startup + 2);
    expect(ev2.some((e) => e.t === 'hit' && e.a === 1 && e.v === 0 && e.launch)).toBe(true);
    expect(a.hp).toBeLessThan(a.maxHp);
  });

  it('스냅샷이 사슬·반격 창을 싣는다', () => {
    const { a } = arena('fighter');
    a.chain = 1; a.switchHeavy = true; a.counterT = 7;
    const row = encodePlayer(a);
    expect(row.slice(-3)).toEqual([1, 1, 7]);
  });
});

describe('3차 소감 — 봇 장비·맵·폭탄', () => {
  it('봇 무작위 장비는 항상 직업이 들 수 있는 악세서리다', () => {
    const rng = makeRng(77);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const l = randomLoadout(rng);
      expect(STYLES[l.style].accessories).toContain(l.acc);
      seen.add(`${l.style}:${l.acc}`);
    }
    expect(seen.size).toBeGreaterThan(8); // 골고루 나온다
  });

  it('상자 자리는 어느 맵에서도 발판·기둥·벽과 겹치지 않는다', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      for (const c of m.crates) {
        for (const b of m.boxes) {
          const overlapXZ = c.x + 0.5 > b.minX && c.x - 0.5 < b.maxX && c.z + 0.5 > b.minZ && c.z - 0.5 < b.maxZ;
          const overlapY = c.y + 1 > b.minY + 1e-6 && c.y < b.maxY - 1e-6;
          expect(overlapXZ && overlapY, `${id} crate (${c.x},${c.z}) vs box ${JSON.stringify(b)}`).toBe(false);
        }
        for (const cy of m.cylinders) expect(Math.hypot(c.x - cy.x, c.z - cy.z) > cy.r + 0.5, `${id} crate vs cylinder`).toBe(true);
      }
    }
  });

  it('옥상 기계실: 벽은 막히고 문으로 나가며 안에서 점프하면 천장에 막힌다', () => {
    const room = MAPS.rooftop.rooms[0];
    expect(roomBoxes(room, 0).filter((b) => b.part === 'wall').length).toBe(5); // 문이 있는 벽은 둘로
    const { w, a } = arena('fighter', 'rooftop');
    // 안에서 서쪽 벽으로
    a.pos.x = -8; a.pos.z = 5; a.pos.y = 0; a.yaw = 0;
    steps(w, inp(-1, 0), inp(), 90);
    expect(a.pos.x).toBeGreaterThan(room.minX + 0.3 + C.PLAYER_RADIUS - 0.05);
    // 동쪽 문(중심 z=5)으로 나간다
    a.pos.x = -8; a.pos.z = 5;
    steps(w, inp(1, 0), inp(), 90);
    expect(a.pos.x).toBeGreaterThan(room.maxX + 0.3);
    // 안에서 점프 — 머리가 지붕(2.3m) 아래에서 멈춘다
    a.pos.x = -10; a.pos.z = 5; a.pos.y = 0; a.vel.x = a.vel.z = 0;
    let peak = 0;
    for (let i = 0; i < 60; i++) { w.step([inp(0, 0, i === 0 ? 2 : 0), inp()]); peak = Math.max(peak, a.pos.y); }
    expect(peak).toBeLessThanOrEqual(room.height - C.PLAYER_HEIGHT + 1e-6);
    expect(peak).toBeGreaterThan(0.2);
  });

  it('폭탄 반지름 3.2: 3.0m 는 맞고 3.5m 는 안 맞는다', () => {
    expect(BOMB_RADIUS).toBe(3.2);
    const { w, a, b } = arena('fighter');
    a.pos.x = 3.0; a.pos.z = 0; b.pos.x = -3.5; b.pos.z = 0;
    const bomb = createItem(50, 'bomb', 0, 0, 0);
    bomb.fuse = 1;
    w.items.push(bomb);
    steps(w, inp(), inp(), 3);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
  });
});
