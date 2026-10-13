import type { TestMarble } from './marbleTestTypes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  it.each(['last', 'first', 'rank', 'order'])('preserves fixed-step physics and selected rank under changed presentation in %s', (modeKey) => {
    const fixture = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/marble-before-cascade-finish.json'), 'utf8'));
    const before = loadGame('marble-race', MARBLE_SIM_FILES, { 'game.js': fixture.gameSource });
    const after = loadGame('marble-race', MARBLE_SIM_FILES);
    const states = [before, after].map(engine => engine.Game.start({ entries, modeKey, rank: 3, courseKey: 'pinball', seed: 15838 }));
    for (let f = 0; f < 57600 && states[0].phase !== 'done'; f++) {
      before.Game.fastForward(before.Physics.DT); after.Game.fastForward(after.Physics.DT);
      for (const field of ['phase', 'wantRank']) expect(states[1][field]).toBe(states[0][field]);
      expect(states[1].world.t).toBe(states[0].world.t);
      expect(states[1].marbles.map((m: TestMarble) => [m.x, m.y, m.done, m.rank])).toEqual(states[0].marbles.map((m: TestMarble) => [m.x, m.y, m.done, m.rank]));
    }
    expect(states[0].phase).toBe('done'); expect(states[1].phase).toBe('done');
    expect(states[1].order.map((m: TestMarble) => m.id)).toEqual(states[0].order.map((m: TestMarble) => m.id));
    expect(states[1].picked?.id).toBe(states[0].picked?.id);
    expect(after.Game.resultText()).toBe(before.Game.resultText());
  });
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
  it.each([30, 60, 120])('bounds automatic bursts, cooldown, budget and minimum speed at %iHz', (hz) => {
    const { g, s } = start(); arrived(s, 4); s.world.advance = () => 0;
    const near = () => { s.marbles[4].y = s.course.entryY - 130; s.marbles[5].y = s.course.entryY - 90; };
    const tick = (seconds: number) => { for (let i = 0; i < Math.round(seconds * hz); i++) { g.Game.step(1 / hz); expect(s.slow).toBeGreaterThanOrEqual(.30 - 1e-9); } };
    near(); tick(1.6);
    expect(s.autoSlowT).toBe(0); expect(s.autoSlowBudget).toBeCloseTo(1.6); expect(s.slowCooldown).toBeCloseTo(2.5);
    tick(3); expect(s.slow).toBeGreaterThan(.999); expect(s.autoSlowBudget).toBeCloseTo(1.6);
    s.marbles[5].y -= 1000; tick(1 / hz); near(); tick(1.6);
    expect(s.autoSlowT).toBe(0); expect(s.autoSlowBudget).toBe(0);
    s.marbles[5].y -= 1000; tick(3); near(); tick(3);
    expect(s.autoSlowT).toBe(0); expect(s.slow).toBeGreaterThan(.999);
  });
  it.each([['first', 5], ['last', 3], ['order', 3], ['rank', 3]] as const)('uses the actual %s cutoff candidate for dynamic speed', (mode, id) => {
    const { g, s } = start(mode); s.world.advance = () => 0;
    if (mode === 'last' || mode === 'order') arrived(s, 3);
    s.marbles.forEach((m: TestMarble, i: number) => { m.x = 500; m.y = s.course.entryY - 240 + i * 30; });
    g.Game.step(1 / 60); expect(s.decisive.id).toBe(id);
    if (mode === 'first') {
      s.order.push(s.marbles[5]); s.marbles[5].done = true;
      for (let f = 0; f < 60; f++) g.Game.step(1 / 60);
      expect(s.autoSlowT).toBe(0); expect(s.decisive).toBeNull(); expect(s.slow).toBeGreaterThan(.999);
    }
  });
  it('dynamic automatic speed strengthens near entry using the unresolved contenders only', () => {
    function speedAt(distance: number) {
      const { g, s } = start('rank'); s.wantRank = 3; s.world.advance = () => 0;
      s.marbles.forEach((m: TestMarble) => { m.y = s.course.entryY - 1200; m.x = 500; });
      // Leading marble is already below entry and outside the third-place boundary.
      s.marbles[5].y = s.course.entryY + 250;
      for (const i of [2, 3, 4]) s.marbles[i].y = s.course.entryY - distance - (4 - i) * 10;
      for (let i = 0; i < 60; i++) g.Game.step(1 / 60);
      return s.slow;
    }
    expect(speedAt(700)).toBeGreaterThan(.9);
    expect(speedAt(30)).toBeLessThan(.35);
    expect(speedAt(0)).toBeGreaterThanOrEqual(.30);
  });
  it('interrupted bursts retain budget and cooldown, then pipe entry clears the effect', () => {
    const { g, s } = start(); arrived(s, 4); s.world.advance = () => 0;
    s.marbles[4].y = s.course.entryY - 130; s.marbles[5].y = s.course.entryY - 90;
    for (let i = 0; i < 30; i++) g.Game.step(1 / 60);
    expect(s.autoSlowBudget).toBeCloseTo(2.7);
    s.marbles[5].y -= 1000; g.Game.step(1 / 60);
    expect(s.autoSlowT).toBe(0); expect(s.decisive).toBeNull(); expect(s.slowCooldown).toBeCloseTo(2.5);
    s.marbles[5].y += 1000;
    for (let i = 0; i < 60; i++) g.Game.step(1 / 60);
    expect(s.autoSlowT).toBe(0); expect(s.slow).toBeGreaterThan(.999);
    for (let i = 0; i < 100; i++) g.Game.step(1 / 60);
    expect(s.autoSlowT).toBeGreaterThan(0);
    s.marbles[4].y = s.course.entryY + 130; s.marbles[5].y = s.course.entryY + 230;
    for (let i = 0; i < 60; i++) g.Game.step(1 / 60);
    expect(s.autoSlowT).toBe(0); expect(s.decisive).toBeNull(); expect(s.slow).toBeGreaterThan(.999);
  });
  it('reduced motion consumes no automatic budget, while manual .34 control remains available', () => {
    const { g, s } = start(); arrived(s, 4); s.world.advance = () => 0; s.reducedMotion = true;
    s.marbles[4].y = s.course.entryY - 130; s.marbles[5].y = s.course.entryY - 90;
    for (let i = 0; i < 180; i++) g.Game.step(1 / 60);
    expect(s.slow).toBe(1); expect(s.autoSlowBudget).toBe(3.2); expect(s.decisive).toBeNull();
    g.Game.toggleSlow(); for (let i = 0; i < 120; i++) g.Game.step(1 / 60);
    expect(s.slow).toBeCloseTo(.34);
    g.Game.toggleSlow(); for (let i = 0; i < 120; i++) g.Game.step(1 / 60);
    expect(s.slow).toBeCloseTo(1);
  });
  it('completion clears automatic timers and returns to normal speed', () => {
    const { g, s } = start(); s.autoSlowT = 1; s.decisive = s.marbles[0]; s.slow = .30;
    g.Game.fastForward(240);
    expect(s.phase).toBe('done'); expect(s.autoSlowT).toBe(0); expect(s.decisive).toBeNull(); expect(s.slow).toBe(1);
  });
  it.each([30, 60, 120])('natural cascade %iHz order equals same-seed fixed-step order', (hz) => {
    const natural = loadGame('marble-race', MARBLE_SIM_FILES), fixed = loadGame('marble-race', MARBLE_SIM_FILES);
    const opt = { entries, modeKey: 'order', courseKey: 'cascade', seed: 15838 };
    const a = natural.Game.start(opt), b = fixed.Game.start(opt); fixed.Game.fastForward(240);
    for (let f = 0; a.phase !== 'done' && f < hz * 240; f++) natural.Game.step(1 / hz);
    expect(a.phase).toBe('done'); expect(a.order.map((m: TestMarble) => m.id)).toEqual(b.order.map((m: TestMarble) => m.id));
  });
  it.each(['last', 'first', 'rank', 'order'])('follows the unfinished leader and nearby next arrivals in %s', (mode) => {
    const { g, s } = start(mode);
    s.marbles.forEach((m: TestMarble, i: number) => { m.y = 500 + i * 1000; m.x = 500; });
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([5]);
    g.Game.selectOwner(0);
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([5]);
    expect(g.Game.cameraAim().y).toBeGreaterThan(5500);
    s.marbles[4].y = 5400; s.marbles[3].y = 5300;
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([5, 4, 3]);
    const aim = g.Game.cameraAim();
    for (const m of g.Game.attention()) {
      expect(Math.abs(m.y - aim.y)).toBeLessThan(g.Camera.VH / (2 * aim.z));
      expect(Math.abs(m.x - aim.x)).toBeLessThan(g.Camera.VW / (2 * aim.z));
    }
    s.marbles[5].done = true; s.order.push(s.marbles[5]);
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([4, 3]);
    s.marbles[4].y = 5300;
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([3, 4]);
    s.marbles[4].x = 900;
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([3]);
    s.marbles.forEach((m: TestMarble) => { m.done = true; });
    expect(g.Game.attention()).toEqual([]);
    expect(g.Game.cameraAim().y).toBe(s.course.finishY - 260);
  });
  it('rank slow motion still follows the unresolved rank boundary, independently of visual focus', () => {
    const { g, s } = start('rank'); s.wantRank = 3;
    s.world.advance = () => 0;
    s.marbles.forEach((m: TestMarble, i: number) => { m.y = s.course.entryY - 1100 + i * 20; m.x = 500; });
    s.marbles[5].y = s.course.entryY + 220;
    for (const i of [2, 3, 4]) s.marbles[i].y = s.course.entryY - 180 + i * 20;
    expect(g.Game.attention().map((m: TestMarble) => m.id)).toEqual([5]);
    g.Game.step(1 / 60); expect(s.slow).toBeLessThan(1);
    s.order = [s.marbles[0], s.marbles[1], s.marbles[2]];
    g.Game.step(1 / 60); expect(s.autoSlowT).toBe(0);
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
