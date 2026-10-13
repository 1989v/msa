import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { loadGame, MARBLE_SIM_FILES } from './loadGame';
import type { TestMarble } from './marbleTestTypes';
const courses = ['zigzag', 'bumper-forest', 'seesaw'];
function run(g: ReturnType<typeof loadGame>, courseKey: string, count: number, seed: number, hz?: number) {
  const s = g.Game.start({ entries: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, count: 1 })), modeKey: 'order', courseKey, seed });
  const xs = s.marbles.map((m: TestMarble) => m.x);
  if (!hz) g.Game.fastForward(240);
  else for (let f = 0; s.phase !== 'done' && s.world.t < 240 && f < hz * 750; f++) g.Game.step(1 / hz);
  expect(s.phase, `${courseKey}/${count}/${seed}/${hz ?? 'ff'}`).toBe('done');
  expect(s.world.t).toBeLessThanOrEqual(240);
  expect(s.order).toHaveLength(count);
  expect(new Set(s.order.map((m: TestMarble) => m.id)).size).toBe(count);
  s.order.forEach((m: TestMarble, i: number) => expect(m).toMatchObject({ done: true, rank: i + 1 }));
  return { xs, ranks: s.marbles.map((m: TestMarble) => m.rank), order: s.order.map((m: TestMarble) => m.id), seconds: s.world.t };
}
function ranks(values: number[]) {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = Array<number>(values.length).fill(0);
  for (let i = 0; i < sorted.length;) {
    let j = i; while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    for (let k = i; k <= j; k++) out[sorted[k].i] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}
function rho(x: number[], y: number[]) {
  const a = ranks(x), b = ranks(y), mean = (x.length + 1) / 2;
  let cov = 0, av = 0, bv = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - mean) * (b[i] - mean); av += (a[i] - mean) ** 2; bv += (b[i] - mean) ** 2; }
  return cov / Math.sqrt(av * bv);
}
it('keeps the original three serialized courses unchanged', () => {
  const baseline = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/marble-original-courses.sha256.json'), 'utf8')) as Record<string, string>;
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  expect(g.Courses.all.map((c: { key: string }) => c.key)).toEqual(['pinball', 'cascade', 'carousel', ...courses]);
  for (const [key, hash] of Object.entries(baseline)) {
    const geometry = { ...g.Courses.byKey(key) }; delete geometry.tag;
    expect(createHash('sha256').update(JSON.stringify(geometry)).digest('hex')).toBe(hash);
  }
});
it('new courses: 2/6/12 people × 10 seeds complete/replay and 60 six-person seeds have |start-x rho| <= .20', () => {
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  const report = courses.map((course) => {
    let min = Infinity, max = 0;
    for (const count of [2, 6, 12]) for (let i = 1; i <= 10; i++) {
      const result = run(g, course, count, i * 7919);
      expect(run(g, course, count, i * 7919).order).toEqual(result.order);
      min = Math.min(min, result.seconds); max = Math.max(max, result.seconds);
    }
    const xs: number[] = [], rs: number[] = [];
    for (let i = 1; i <= 60; i++) { const result = run(g, course, 6, i * 7919); xs.push(...result.xs); rs.push(...result.ranks); }
    return { course, replayPairs: 30, minSeconds: min, maxSeconds: max, biasSeeds: 60, biasSamples: 360, rho: rho(xs, rs) };
  });
  writeFileSync(resolve('../docs/specs/2026-10-12-draw-pinball/verifications/course-expansion-matrix.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('COURSE_EXPANSION', JSON.stringify(report));
  for (const row of report) expect(Math.abs(row.rho), `${row.course} start-x bias investigation`).toBeLessThanOrEqual(.20);
}, 240_000);
it('new courses: representative 30/60/120Hz schedules match fixed-step fast-forward', () => {
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  for (const course of courses) {
    const baseline = run(g, course, 6, 15838).order;
    for (const hz of [30, 60, 120]) expect(run(g, course, 6, 15838, hz).order).toEqual(baseline);
  }
}, 60_000);
