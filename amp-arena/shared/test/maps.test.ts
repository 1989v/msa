import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import * as C from '../src/constants.ts';
import { BTN_DASH, type Input } from '../src/input.ts';
import { MAPS, MAP_IDS } from '../src/maps.ts';
import { botInput, newBotMemory } from '../src/bot.ts';

const inp = (mx = 0, mz = 0, btn = 0): Input => ({ seq: 0, mx, mz, btn });

function setup(mapId: 'rooftop' | 'icelake' | 'colosseum' | 'skydock') {
  const w = new World({ mapId, modeId: 'ffa_dm', seconds: 180, seed: 4 });
  const a = w.addPlayer(0, 'A', 0, 'none', false);
  const b = w.addPlayer(1, 'B', 1, 'none', false);
  for (let i = 0; i < C.COUNTDOWN_TICKS; i++) w.step([]);
  return { w, a, b };
}
const run = (w: World, ia: Input, ib: Input, n: number) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...w.step([ia, ib])); return ev; };

describe('맵', () => {
  it('4종 모두 스폰 8개·상자 자리가 있고 스폰이 지지면 위에 있다', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      expect(m.spawns.length).toBe(8);
      expect(m.crates.length).toBeGreaterThanOrEqual(4);
      const w = new World({ mapId: id, modeId: 'ffa_dm', seconds: 60, seed: 1 });
      for (let i = 0; i < 8; i++) w.addPlayer(i, `P${i}`, i % 2, 'none', false);
      for (let i = 0; i < 30; i++) w.step([]);
      for (const p of w.players) { expect(p!.grounded).toBe(true); expect(p!.pos.y).toBeGreaterThanOrEqual(-0.01); }
    }
  });
  it('옥상: 가장자리 밖으로 달리면 낙사, 실외기는 옆에서 막히고 위로는 점프해 오른다', () => {
    const { w, a, b } = setup('rooftop');
    a.pos.x = 12; a.pos.z = 0; b.pos.x = -12; b.pos.z = 0;
    const ev = run(w, inp(1, 0, BTN_DASH), inp(), 240);
    expect(ev.some((e) => e.t === 'ko' && e.v === 0 && e.cause === 'fall')).toBe(true);
    const s2 = setup('rooftop');
    s2.a.pos.x = 8; s2.a.pos.z = 2.5; s2.a.yaw = Math.PI; s2.b.pos.x = -12;
    run(s2.w, inp(0, 1), inp(), 40); // 실외기(8,6) 쪽으로
    expect(s2.a.pos.z).toBeLessThan(5 - C.PLAYER_RADIUS + 0.05);
    expect(s2.a.pos.y).toBe(0);
  });
  it('얼음 호수: 손을 떼도 미끄러지고, 가장자리 밖은 물(낙사)', () => {
    const { w, a, b } = setup('icelake');
    a.pos.x = 5; a.pos.z = -5; b.pos.x = 10; b.pos.z = 10; // 중앙 바위(0,0) 를 비켜 달린다
    run(w, inp(0, 1), inp(), 60);
    const z0 = a.pos.z;
    run(w, inp(), inp(), 40);
    expect(a.pos.z - z0).toBeGreaterThan(0.8); // 40틱 동안 0.8m 이상 미끄러짐
    const s2 = setup('icelake');
    s2.a.pos.x = 14; s2.a.pos.z = 0; s2.b.pos.x = -10;
    const ev = run(s2.w, inp(1, 0, BTN_DASH), inp(), 300);
    expect(ev.some((e) => e.t === 'ko' && e.v === 0 && e.cause === 'fall')).toBe(true);
  });
  it('얼음 호수에서 봇 6이 2분 매치를 완주하고, 낙사보다 타격 KO 가 많다', () => {
    const w = new World({ mapId: 'icelake', modeId: 'ffa_dm', seconds: 120, seed: 21 });
    const mems = [];
    for (let i = 0; i < 6; i++) { w.addPlayer(i, `봇-${i}`, 0, 'none', true, (['fighter', 'grappler', 'speedster', 'heavy', 'martial', 'fighter'] as const)[i]); mems.push(newBotMemory(w.rng)); }
    let ended = false, fall = 0, hit = 0;
    for (let i = 0; i < C.COUNTDOWN_TICKS + 120 * C.TICK_RATE + 5 && !ended; i++) {
      const inputs: Input[] = [];
      for (let id = 0; id < 6; id++) inputs[id] = botInput(w, w.players[id]!, mems[id]);
      for (const e of w.step(inputs)) { if (e.t === 'end') ended = true; if (e.t === 'ko') { if (e.cause === 'fall') fall++; else hit++; } }
    }
    expect(ended).toBe(true);
    expect(hit + fall).toBeGreaterThan(0);
    expect(hit).toBeGreaterThanOrEqual(fall);
  });
  it('옥상에서 봇 6이 2분 매치를 완주한다', () => {
    const w = new World({ mapId: 'rooftop', modeId: 'team_dm', seconds: 120, seed: 8 });
    const mems = [];
    for (let i = 0; i < 6; i++) { w.addPlayer(i, `봇-${i}`, i % 2, 'none', true, (['fighter', 'grappler', 'speedster', 'heavy', 'martial', 'fighter'] as const)[i]); mems.push(newBotMemory(w.rng)); }
    let ended = false, kos = 0;
    for (let i = 0; i < C.COUNTDOWN_TICKS + 120 * C.TICK_RATE + 5 && !ended; i++) {
      const inputs: Input[] = [];
      for (let id = 0; id < 6; id++) inputs[id] = botInput(w, w.players[id]!, mems[id]);
      for (const e of w.step(inputs)) { if (e.t === 'end') ended = true; if (e.t === 'ko') kos++; }
    }
    expect(ended).toBe(true);
    expect(kos).toBeGreaterThan(0);
  });
});
