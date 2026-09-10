import { describe, it, expect } from 'vitest';
import { World } from '../src/world.ts';
import { botInput, newBotMemory } from '../src/bot.ts';
import { ACCESSORY_IDS } from '../src/accessories.ts';
import * as C from '../src/constants.ts';
import type { Input } from '../src/input.ts';

describe('봇 매치 스모크', () => {
  it('8봇 데스매치 90초를 오류 없이 돌리고 KO 가 난다', () => {
    const w = new World({ mapId: 'colosseum', modeId: 'team_dm', seconds: 90, seed: 42 });
    const mems = [];
    for (let i = 0; i < 8; i++) { w.addPlayer(i, `봇-${i}`, i % 2, ACCESSORY_IDS[i % ACCESSORY_IDS.length], true); mems.push(newBotMemory(w.rng)); }
    let kos = 0, hits = 0, ended = false;
    const total = C.COUNTDOWN_TICKS + 90 * C.TICK_RATE + 5;
    for (let i = 0; i < total && !ended; i++) {
      const inputs: Input[] = [];
      for (let id = 0; id < 8; id++) inputs[id] = botInput(w, w.players[id]!, mems[id]);
      for (const e of w.step(inputs)) { if (e.t === 'ko') kos++; if (e.t === 'hit') hits++; if (e.t === 'end') ended = true; }
      for (const p of w.players) {
        expect(Number.isFinite(p!.pos.x) && Number.isFinite(p!.pos.y) && Number.isFinite(p!.pos.z)).toBe(true);
        expect(p!.hp).toBeGreaterThanOrEqual(0);
      }
    }
    expect(ended).toBe(true);
    expect(hits).toBeGreaterThan(50);
    expect(kos).toBeGreaterThan(2);
    expect(w.ranking.length).toBe(8);
    expect(w.score[0] + w.score[1]).toBeGreaterThan(0);
  });
  it('스카이독 서바이벌도 완주한다 (낙사 포함)', () => {
    const w = new World({ mapId: 'skydock', modeId: 'ffa_survival', seconds: 120, seed: 3 });
    const mems = [];
    for (let i = 0; i < 6; i++) { w.addPlayer(i, `봇-${i}`, 0, 'none', true); mems.push(newBotMemory(w.rng)); }
    let ended = false;
    for (let i = 0; i < C.COUNTDOWN_TICKS + 120 * C.TICK_RATE + 5 && !ended; i++) {
      const inputs: Input[] = [];
      for (let id = 0; id < 6; id++) inputs[id] = botInput(w, w.players[id]!, mems[id]);
      for (const e of w.step(inputs)) if (e.t === 'end') ended = true;
    }
    expect(ended).toBe(true);
    expect(w.ranking[0].rank).toBe(1);
  });
});
