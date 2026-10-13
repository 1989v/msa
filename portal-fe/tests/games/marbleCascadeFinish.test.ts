import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { gameSource, loadGame, MARBLE_SIM_FILES } from './loadGame';
import type { TestMarble } from './marbleTestTypes';
const fixture = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/marble-before-cascade-finish.json'), 'utf8'));
const g = loadGame('marble-race', MARBLE_SIM_FILES);
const old = loadGame('marble-race', MARBLE_SIM_FILES, {
  'courses.js': gameSource('marble-race', 'courses.js').replace('        b.rotorRow(3, 1.8);\n        b.finishGate(\'cascade\');', '        b.finishGate(\'cascade\');'),
});
it('preserves five whole courses and cascade prefix, adds only the existing row then translates the exact old finish', () => {
  for (const key of Object.keys(fixture.hashes)) {
    const c = old.Courses.byKey(key);
    expect(createHash('sha256').update(JSON.stringify(c)).digest('hex')).toBe(fixture.hashes[key]);
    if (key !== 'cascade') expect(g.Courses.byKey(key)).toEqual(c);
  }
  const before = fixture.cascade, after = g.Courses.byKey('cascade');
  const start = before.marks.find((m: { name: string }) => m.name === '마지막 관문').y;
  const row = new g.Parts.Builder(); row.y = start; row.rotorRow(3, 1.8);
  const shift = row.y - start;
  const translated = (body: Record<string, unknown>) => Object.fromEntries(Object.entries(body).map(([key, value]) => [key, ['y', 'y1', 'y2'].includes(key) ? (value as number) + shift : value]));
  for (const field of ['pegs', 'walls', 'rotors', 'seesaws', 'marks']) {
    const prefix = before[field].filter((v: { y?: number; y1?: number }) => (v.y ?? v.y1 ?? 0) < start);
    const finish = before[field].slice(prefix.length).map(translated);
    expect(after[field], field).toEqual([...prefix, ...row[field], ...finish]);
  }
  for (const key of ['entryY', 'finishY', 'length']) expect(after[key]).toBe(before[key] + shift);
  for (const key of ['entrance', 'gravity', 'restitution', 'friction', 'drag']) expect(after[key]).toEqual(before[key]);
});
function run(engine: ReturnType<typeof loadGame>, count: number, seed: number, hz?: number) {
  const s = engine.Game.start({ entries: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, count: 1 })), courseKey: 'cascade', modeKey: 'order', seed });
  const xs = s.marbles.map((m: TestMarble) => m.x);
  if (!hz) engine.Game.fastForward(240);
  else for (let f = 0; s.phase !== 'done' && s.world.t < 240 && f < hz * 750; f++) engine.Game.step(1 / hz);
  expect(s.phase).toBe('done'); expect(s.world.t).toBeLessThanOrEqual(240);
  expect(s.order).toHaveLength(count); expect(new Set(s.order.map((m: TestMarble) => m.id)).size).toBe(count);
  for (const m of s.marbles) expect([m.x, m.y, m.vx, m.vy, m.rank].every(Number.isFinite)).toBe(true);
  s.order.forEach((m: TestMarble, i: number) => expect(m).toMatchObject({ rank: i + 1, done: true }));
  return { xs, ranks: s.marbles.map((m: TestMarble) => m.rank), order: s.order.map((m: TestMarble) => m.id), seconds: s.world.t };
}
it('added final rotor row makes physical spin contacts during a normal cascade race', () => {
  const s = g.Game.start({ entries: Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, count: 1 })), courseKey: 'cascade', modeKey: 'order', seed: 15838 });
  const begin = fixture.cascade.marks.find((m: { name: string }) => m.name === '마지막 관문').y;
  const row = s.course.rotors.filter((r: { y: number }) => r.y >= begin);
  expect(row).toHaveLength(3);
  let contacts = 0;
  for (let f = 0; s.phase !== 'done' && f < 18000; f++) {
    g.Game.step(1 / 60);
    contacts += s.hits.filter((h: { y: number; kind: string }) => h.kind === 'spin' && row.some((r: { y: number; len: number }) => Math.abs(h.y - r.y) <= r.len + 10)).length;
  }
  expect(s.phase).toBe('done'); expect(contacts).toBeGreaterThan(0);
});
function rank(values: number[]) {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v), out = Array<number>(values.length).fill(0);
  for (let i = 0; i < sorted.length;) { let j = i; while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    for (let k = i; k <= j; k++) out[sorted[k].i] = (i + j) / 2 + 1; i = j + 1; }
  return out;
}
function rho(xs: number[], rs: number[]) {
  const a = rank(xs), b = rank(rs), mean = (a.length + 1) / 2; let cov = 0, av = 0, bv = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - mean) * (b[i] - mean); av += (a[i] - mean) ** 2; bv += (b[i] - mean) ** 2; }
  return cov / Math.sqrt(av * bv);
}
it('cascade: bounded 2/6/12 x10 replay, 60-seed .20 threshold, schedules and old/new final approach dwell', () => {
  const results = [], xs: number[] = [], rs: number[] = [];
  for (const count of [2, 6, 12]) for (let i = 1; i <= 10; i++) {
    const r = run(g, count, i * 7919); expect(run(g, count, i * 7919)).toEqual(r);
    results.push({ count, seed: i * 7919, seconds: r.seconds });
    if (count === 6) { xs.push(...r.xs); rs.push(...r.ranks); }
  }
  for (let i = 11; i <= 60; i++) { const r = run(g, 6, i * 7919); xs.push(...r.xs); rs.push(...r.ranks); }
  const bias = rho(xs, rs); expect(Number.isFinite(bias)).toBe(true); expect(Math.abs(bias)).toBeLessThanOrEqual(.20);
  const reference = run(g, 6, 15838).order;
  for (const hz of [30, 60, 120]) expect(run(g, 6, 15838, hz).order).toEqual(reference);
  // Observe actual fixed-step positions/time, rather than reporting added map length.
  function dwell(engine: ReturnType<typeof loadGame>, seed: number) {
    const s = engine.Game.start({ entries: Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, count: 1 })), courseKey: 'cascade', modeKey: 'order', seed });
    const begin = fixture.cascade.marks.find((m: { name: string }) => m.name === '마지막 관문').y;
    const startTimes = new Map<number, number>(), times: number[] = [], localTimes = new Map<number, number>();
    const advance = s.world.advance.bind(s.world);
    s.world.advance = (dt: number, callback: (w: unknown) => void) => advance(dt, (w: unknown) => {
      const previouslyDone = new Set(s.marbles.filter((m: TestMarble) => m.done).map((m: TestMarble) => m.id));
      for (const m of s.marbles as TestMarble[]) if (!m.done && m.y >= begin) {
        if (!startTimes.has(m.id)) startTimes.set(m.id, s.world.t);
        if (m.y < s.course.entryY) localTimes.set(m.id, (localTimes.get(m.id) ?? 0) + engine.Physics.DT);
      }
      callback(w);
      for (const m of s.marbles as TestMarble[]) if (m.done && !previouslyDone.has(m.id) && startTimes.has(m.id)) times.push(s.world.t - startTimes.get(m.id)!);
    });
    for (let f = 0; s.phase !== 'done' && s.world.t < 240 && f < 18000; f++) engine.Game.step(1 / 60);
    expect(s.phase).toBe('done'); expect(times.length).toBeGreaterThan(0); expect(localTimes.size).toBeGreaterThan(0);
    return { seed, seconds: s.world.t, approachDwell: times.reduce((a, b) => a + b, 0) / times.length, upstreamDwell: [...localTimes.values()].reduce((a, b) => a + b, 0) / localTimes.size };
  }
  const pairs = Array.from({ length: 10 }, (_, i) => ({ before: dwell(old, (i + 1) * 7919), after: dwell(g, (i + 1) * 7919) }));
  const avg = (side: 'before' | 'after', field: 'approachDwell' | 'upstreamDwell') => pairs.reduce((sum, pair) => sum + pair[side][field], 0) / pairs.length;
  const comparison = { beforeApproach: avg('before', 'approachDwell'), afterApproach: avg('after', 'approachDwell'), beforeUpstream: avg('before', 'upstreamDwell'), afterUpstream: avg('after', 'upstreamDwell') };
  expect(comparison.afterUpstream).toBeGreaterThan(comparison.beforeUpstream);
  const report = { results, replayPairs: 30, simulations: 134, biasSeeds: 60, biasSamples: xs.length, rho: bias, schedules: [30, 60, 120, 'ff'], comparison, dwellPairs: pairs };
  writeFileSync(resolve('../docs/specs/2026-10-12-draw-pinball/verifications/focus-cascade-finish.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('CASCADE_FINISH', JSON.stringify({ ...report, results: undefined, dwellPairs: undefined }));
}, 180_000);
