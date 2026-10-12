import type { TestMarble } from './marbleTestTypes';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { loadGame, MARBLE_SIM_FILES } from './loadGame';
function rank(values: number[]) {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = Array(values.length).fill(0);
  for (let i = 0; i < sorted.length;) {
    let j = i; while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    for (let k = i; k <= j; k++) out[sorted[k].i] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}
function rho(x: number[], y: number[]) {
  const a = rank(x), b = rank(y), mean = (x.length + 1) / 2;
  let cov = 0, av = 0, bv = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - mean) * (b[i] - mean); av += (a[i] - mean) ** 2; bv += (b[i] - mean) ** 2; }
  return cov / Math.sqrt(av * bv);
}
function run(g: ReturnType<typeof loadGame>, courseKey: string, count: number, seed: number) {
  const s = g.Game.start({ entries: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, count: 1 })), modeKey: 'last', courseKey, seed });
  const xs = s.marbles.map((m: TestMarble) => m.x);
  g.Game.fastForward(240);
  expect(s.phase, `${courseKey}/${count}/${seed}`).toBe('done'); expect(s.world.t).toBeLessThanOrEqual(240);
  expect(s.order).toHaveLength(count); expect(new Set(s.order.map((m: TestMarble) => m.id)).size).toBe(count);
  s.order.forEach((m: TestMarble, i: number) => expect(m).toMatchObject({ done: true, rank: i + 1 }));
  return { xs, ranks: s.marbles.map((m: TestMarble) => m.rank), order: s.order.map((m: TestMarble) => m.id), seconds: s.world.t };
}
it('3 courses × 2/6/12 people × 20 seeds complete/replay; 120-seed baseline/change start-x Spearman', () => {
  const current = loadGame('marble-race', MARBLE_SIM_FILES);
  const overrides = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/marble-entry-baseline.json'), 'utf8')) as Record<string, string>;
  const baseline = loadGame('marble-race', MARBLE_SIM_FILES, overrides);
  const report: Record<string, unknown>[] = [];
  for (const course of ['pinball', 'cascade', 'carousel']) {
    let max = 0, min = Infinity;
    for (const count of [2, 6, 12]) for (let i = 1; i <= 20; i++) {
      const result = run(current, course, count, i * 7919);
      expect(run(current, course, count, i * 7919).order).toEqual(result.order);
      min = Math.min(min, result.seconds); max = Math.max(max, result.seconds);
    }
    const correlations: Record<string, number> = {};
    for (const [label, g] of [['baseline', baseline], ['changed', current]] as const) {
      const xs: number[] = [], ranks: number[] = [];
      for (let i = 1; i <= 120; i++) { const result = run(g, course, 6, i * 7919); xs.push(...result.xs); ranks.push(...result.ranks); }
      correlations[label] = rho(xs, ranks);
    }
    report.push({ course, completedReplayPairs: 60, minSeconds: min, maxSeconds: max, samplesPerCorrelation: 720, ...correlations });
  }
  const output = resolve('../docs/specs/2026-10-12-draw-pinball/verifications/course-matrix.json');
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log('COURSE_MATRIX', JSON.stringify(report));
  for (const r of report) expect(Math.abs(r.changed as number), `${r.course} bias investigation threshold`).toBeLessThanOrEqual(0.20);
}, 360_000);
