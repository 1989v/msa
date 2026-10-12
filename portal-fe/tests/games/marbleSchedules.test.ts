import type { TestMarble } from './marbleTestTypes';
import { describe, expect, it } from 'vitest';
import { loadGame, MARBLE_SIM_FILES } from './loadGame';
const names = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, count: 1 }));
function simulate(seed: number, courseKey: string, modeKey: string, schedule: number | 'slow' | 'selection' | 'ff') {
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  const s = g.Game.start({ entries: names, courseKey, modeKey, rank: 3, seed });
  if (schedule === 'ff') g.Game.fastForward(240);
  else {
    if (schedule === 'slow') g.Game.toggleSlow();
    const hz = typeof schedule === 'number' ? schedule : 60;
    for (let frames = 0; s.phase !== 'done' && s.world.t < 240 && frames < hz * 750; frames++) {
      if (schedule === 'selection' && frames % 30 === 0) g.Game.selectOwner(frames % 6);
      g.Game.step(1 / hz);
    }
  }
  expect(s.phase, `${seed}/${courseKey}/${modeKey}/${schedule}`).toBe('done');
  expect(s.order).toHaveLength(s.n);
  expect(new Set(s.order.map((m: TestMarble) => m.id)).size).toBe(s.n);
  s.order.forEach((m: TestMarble, i: number) => expect(m).toMatchObject({ done: true, rank: i + 1 }));
  return s.order.map((m: TestMarble) => m.id);
}
describe('actual Game.step schedules and full fixed-step order', () => {
  it('3 seeds × 3 courses × 4 modes × 30/60/120Hz/manual slow/selection match fastForward', () => {
    for (const seed of [7919, 15838, 23757]) for (const course of ['pinball', 'cascade', 'carousel']) for (const mode of ['last', 'first', 'rank', 'order']) {
      const order = simulate(seed, course, mode, 'ff');
      for (const schedule of [30, 60, 120, 'slow', 'selection'] as const) expect(simulate(seed, course, mode, schedule)).toEqual(order);
    }
  }, 240_000);
});
