import type { TestMarble } from './marbleTestTypes';
import { describe, expect, it } from 'vitest';
import { loadGame, MARBLE_SIM_FILES } from './loadGame';
const entries = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, count: 1 }));
function start(modeKey = 'last', roster = entries) {
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  const s = g.Game.start({ entries: roster, modeKey, rank: 3, courseKey: 'pinball', seed: 7919 });
  s.phase = 'racing'; s.marbles.forEach((m: TestMarble) => { m.held = false; });
  return { g, s };
}
function arrived(s: ReturnType<typeof loadGame>, n: number) {
  s.marbles.slice(0, n).forEach((m: TestMarble, i: number) => { m.done = true; m.rank = i + 1; s.order.push(m); });
}
describe('physical completion and competition attention', () => {
  it('one unfinished marble above finish is appended by a normal fixed step', () => {
    const { g, s } = start(); arrived(s, 5); g.Game.step(1 / 60);
    expect(s.phase).toBe('done'); expect(s.order.map((m: TestMarble) => m.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.marbles[5]).toMatchObject({ done: true, rank: 6 });
  });
  it('two physical marbles of one owner remain unfinished', () => {
    const { g, s } = start('last', [{ name: 'A', count: 1 }, { name: 'B', count: 2 }]);
    arrived(s, 1); g.Game.step(1 / 60);
    expect(s.phase).toBe('racing'); expect(s.order).toHaveLength(1);
  });
  it.each([2, 3])('slows a close final %i group at entry, shared camera/name attention', (n) => {
    const { g, s } = start(); arrived(s, 6 - n);
    s.marbles.slice(6 - n).forEach((m: TestMarble, i: number) => { m.y = s.course.entryY - 150 + i * 60; m.x = 460 + i * 50; });
    g.Game.step(1 / 60); expect(s.slow).toBeLessThan(1);
    expect(g.Game.attention().map((m: TestMarble) => m.id).sort()).toEqual(s.marbles.slice(6 - n).map((m: TestMarble) => m.id));
    expect(g.Game.cameraAim().y).toBeGreaterThan(s.course.entryY - 300);
  });
  it('separation and resolved pipe queue do not trigger slow motion', () => {
    const { g, s } = start(); arrived(s, 4);
    s.marbles[4].y = s.course.entryY - 80; s.marbles[5].y = s.course.entryY - 900;
    g.Game.step(1 / 60); expect(s.slow).toBe(1);
    s.marbles[5].y = s.course.entryY + 130; s.marbles[4].y = s.course.entryY + 230;
    g.Game.step(1 / 60); expect(s.slow).toBe(1);
  });
  it('bounds an unresolved episode and recovers instead of repeatedly slowing', () => {
    const { g, s } = start(); arrived(s, 4);
    s.world.advance = () => 0; // Hold the scene to test presentation timeout only.
    s.marbles[4].y = s.course.entryY - 130; s.marbles[5].y = s.course.entryY - 90;
    for (let i = 0; i < 300; i++) g.Game.step(1 / 60);
    expect(s.autoSlowT).toBe(0); expect(s.slow).toBeGreaterThan(0.99);
  });
  it('last watches trailers, first leaders and rank its boundary', () => {
    for (const [mode, ids] of [['last', [0, 1, 2]], ['order', [0, 1, 2]], ['first', [3, 4, 5]], ['rank', [2, 3, 4]]] as const) {
      const { g, s } = start(mode); s.marbles.forEach((m: TestMarble, i: number) => { m.y = 500 + i * 200; });
      expect(g.Game.attention().map((m: TestMarble) => m.id).sort()).toEqual([...ids]);
      g.Game.selectOwner(0); expect(s.selectedOwner).toBe(0);
    }
  });
  it('selection guide uses actual viewport x/y and any visible member of an owner', () => {
    const { g, s } = start('last', [{ name: 'A', count: 2 }, { name: 'B', count: 1 }]);
    g.Game.selectOwner(0); s.cam.x = 500; s.cam.y = 1500; s.cam.z = 1.8;
    s.marbles[0].x = 900; s.marbles[0].y = 1500;
    s.marbles[1].x = 900; s.marbles[1].y = 1500;
    expect(g.Game.selectionGuide()).toContain('→ 화면 오른쪽');
    s.marbles[1].x = 500; expect(g.Game.selectionGuide()).toContain('화면 안');
    s.marbles[1].y = 1080; expect(g.Game.selectionGuide()).toContain('미니맵');
    s.marbles[0].x = 500; s.marbles[0].y = 1080;
    expect(g.Game.selectionGuide()).toContain('↑ 화면 위');
    s.marbles[0].y = 1920; s.marbles[1].y = 1920;
    expect(g.Game.selectionGuide()).toContain('↓ 화면 아래');
    s.marbles[0].x = 100; s.marbles[1].x = 100; s.marbles[0].y = 1500; s.marbles[1].y = 1500;
    expect(g.Game.selectionGuide()).toContain('← 화면 왼쪽');
  });
});
