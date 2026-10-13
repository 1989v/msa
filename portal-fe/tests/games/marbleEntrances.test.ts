import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { loadGame, MARBLE_SIM_FILES } from './loadGame';
import type { TestMarble } from './marbleTestTypes';
type Circle = { kind: 'circle'; x: number; y: number; r: number };
type Segment = { kind: 'segment'; x1: number; y1: number; x2: number; y2: number; r: number };
type Shape = Circle | Segment;
type Bar = { x: number; y: number; r: number; len: number; a0: number; max?: number };
type Course = { key: string; name: string; entrance: Record<string, number>; walls: Omit<Segment, 'kind'>[]; pegs: Omit<Circle, 'kind'>[]; rotors: Bar[]; seesaws: Bar[] };
const fields = ['walls', 'pegs', 'rotors', 'seesaws'] as const;
function selectedCourses(g: ReturnType<typeof loadGame>) {
  const selected = (g.Courses.all as Course[]).filter(c => !process.env.MARBLE_ENTRANCE_COURSE || c.key === process.env.MARBLE_ENTRANCE_COURSE);
  expect(selected).toHaveLength(process.env.MARBLE_ENTRANCE_COURSE ? 1 : 6);
  return selected;
}
function ptSeg(x: number, y: number, s: Segment) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - s.x1 - t * dx, y - s.y1 - t * dy);
}
function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
function distance(a: Shape, b: Shape) {
  if (a.kind === 'circle') return b.kind === 'circle' ? Math.hypot(a.x - b.x, a.y - b.y) : ptSeg(a.x, a.y, b);
  if (b.kind === 'circle') return ptSeg(b.x, b.y, a);
  if (cross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) * cross(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2) < 0 && cross(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1) * cross(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2) < 0) return 0;
  return Math.min(ptSeg(a.x1, a.y1, b), ptSeg(a.x2, a.y2, b), ptSeg(b.x1, b.y1, a), ptSeg(b.x2, b.y2, a));
}
function joined(a: Shape, b: Shape) {
  return a.kind === 'segment' && b.kind === 'segment' && [[a.x1, a.y1], [a.x2, a.y2]].some(([x, y]) => [[b.x1, b.y1], [b.x2, b.y2]].some(([bx, by]) => Math.hypot(x - bx, y - by) < .001));
}
function variants(c: Course, entry: boolean) {
  const out: { field: string; shapes: Shape[] }[] = [];
  for (const field of fields) for (const item of entry ? c[field].slice(0, c.entrance[field]) : c[field].slice(c.entrance[field])) {
    if (field === 'walls') out.push({ field, shapes: [{ kind: 'segment', ...item } as Segment] });
    else if (field === 'pegs') out.push({ field, shapes: [{ kind: 'circle', ...item } as Circle] });
    else {
      const bar = item as Bar;
      if (field === 'rotors') out.push({ field, shapes: [{ kind: 'circle', x: bar.x, y: bar.y, r: bar.len + bar.r }] });
      else out.push({ field, shapes: Array.from({ length: 65 }, (_, i) => {
        const angle = -(bar.max ?? .42) + i / 64 * 2 * (bar.max ?? .42), dx = Math.cos(angle) * bar.len, dy = Math.sin(angle) * bar.len;
        return { kind: 'segment', x1: bar.x - dx, y1: bar.y - dy, x2: bar.x + dx, y2: bar.y + dy, r: bar.r };
      }) });
    }
  }
  return out;
}
it('six distinct mirrored mouths have clear spawn positions and >=58px free channels, while dynamic entry envelopes stay safe', () => {
  const g = loadGame('marble-race', MARBLE_SIM_FILES), geometry: unknown[] = [], signatures = new Set<string>();
  for (const c of g.Courses.all as Course[]) {
    const entry = variants(c, true), downstream = variants(c, false);
    const raw = Object.fromEntries(fields.map(field => [field, c[field].slice(0, c.entrance[field])]));
    signatures.add(JSON.stringify(raw));
    for (const field of fields) for (const item of raw[field]) {
      const mirror = { ...item } as unknown as Record<string, number>;
      if (field === 'walls') { mirror.x1 = 2 * g.Courses.MID - mirror.x1; mirror.x2 = 2 * g.Courses.MID - mirror.x2; }
      else mirror.x = 2 * g.Courses.MID - mirror.x;
      if (field === 'rotors' || field === 'seesaws') mirror.a0 = -mirror.a0;
      if (field === 'rotors') mirror.w = -mirror.w;
      expect(raw[field].some(candidate => JSON.stringify(candidate) === JSON.stringify(mirror)), `${c.key}/${field} mirrored entry`).toBe(true);
    }
    // Joined outline segments are one solid boundary, not a free channel between two obstacles.
    const components = entry.map((_, i) => i);
    for (let pass = 0; pass < entry.length; pass++) for (let i = 0; i < entry.length; i++) for (let j = i + 1; j < entry.length; j++) {
      if (entry[i].field === 'walls' && entry[j].field === 'walls' && joined(entry[i].shapes[0], entry[j].shapes[0])) {
        const id = Math.min(components[i], components[j]), old = Math.max(components[i], components[j]);
        for (let k = 0; k < components.length; k++) if (components[k] === old) components[k] = id;
      }
    }
    for (let i = 0; i < entry.length; i++) for (const other of [...entry.slice(i + 1), ...downstream]) for (const a of entry[i].shapes) for (const b of other.shapes) {
      const j = entry.indexOf(other);
      if (entry[i].field === 'walls' && other.field === 'walls' && j >= 0 && components[i] === components[j]) continue;
      expect(distance(a, b) - a.r - b.r, `${c.key}/${entry[i].field}/${other.field}`).toBeGreaterThanOrEqual(58);
    }
    const spawns: unknown[] = [];
    for (const count of [2, 6, 12, 20]) {
      const s = g.Game.start({ entries: Array.from({ length: Math.min(count, 12) }, (_, i) => ({ name: `P${i}`, count: count === 20 && i < 8 ? 2 : 1 })), courseKey: c.key, modeKey: 'order', seed: 7919 });
      for (const m of s.marbles as TestMarble[]) for (const body of entry) for (const shape of body.shapes) expect(distance({ kind: 'circle', x: m.x, y: m.y, r: 22 }, shape) - 22 - shape.r, `${c.key}/${count} spawn`).toBeGreaterThan(0);
      spawns.push({ count: s.n, marbles: s.marbles.map((m: TestMarble) => ({ x: m.x, y: m.y, r: 22 })) });
    }
    geometry.push({ key: c.key, name: c.name, entrance: c.entrance, shapes: raw, spawns });
  }
  expect(signatures.size).toBe(6);
  writeFileSync(resolve('../docs/specs/2026-10-12-draw-pinball/verifications/entrance-geometry.json'), JSON.stringify(geometry, null, 2) + '\n');
});
function run(g: ReturnType<typeof loadGame>, key: string, count: number, seed: number, hz?: number) {
  const s = g.Game.start({ entries: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, count: 1 })), courseKey: key, modeKey: 'order', seed });
  const xs = s.marbles.map((m: TestMarble) => m.x);
  if (!hz) g.Game.fastForward(240);
  else for (let f = 0; s.phase !== 'done' && s.world.t < 240 && f < hz * 750; f++) g.Game.step(1 / hz);
  expect(s.phase, `${key}/${count}/${seed}/${hz ?? 'ff'}`).toBe('done'); expect(s.world.t).toBeLessThanOrEqual(240);
  expect(s.order).toHaveLength(count); expect(new Set(s.order.map((m: TestMarble) => m.id)).size).toBe(count);
  for (const m of s.marbles) expect([m.x, m.y, m.vx, m.vy, m.rank].every(Number.isFinite)).toBe(true);
  s.order.forEach((m: TestMarble, i: number) => expect(m).toMatchObject({ rank: i + 1, done: true }));
  return { xs, ranks: s.marbles.map((m: TestMarble) => m.rank), order: s.order.map((m: TestMarble) => m.id), seconds: s.world.t };
}
function ranks(values: number[]) {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v), out = Array<number>(values.length).fill(0);
  for (let i = 0; i < sorted.length;) { let j = i; while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    for (let k = i; k <= j; k++) out[sorted[k].i] = (i + j) / 2 + 1; i = j + 1; }
  return out;
}
function rho(x: number[], y: number[]) {
  const a = ranks(x), b = ranks(y), mean = (x.length + 1) / 2; let cov = 0, av = 0, bv = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - mean) * (b[i] - mean); av += (a[i] - mean) ** 2; bv += (b[i] - mean) ** 2; }
  return cov / Math.sqrt(av * bv);
}
it('all six entrance profiles: 2/6/12 people x10 seeds complete/replay; finite 30-seed start-x sample', () => {
  const g = loadGame('marble-race', MARBLE_SIM_FILES), report: unknown[] = [];
  for (const c of selectedCourses(g)) {
    let min = Infinity, max = 0; const xs: number[] = [], rs: number[] = [];
    for (const count of [2, 6, 12]) for (let i = 1; i <= 10; i++) {
      const r = run(g, c.key, count, i * 7919); expect(run(g, c.key, count, i * 7919).order).toEqual(r.order);
      min = Math.min(min, r.seconds); max = Math.max(max, r.seconds); if (count === 6) { xs.push(...r.xs); rs.push(...r.ranks); }
    }
    for (let i = 11; i <= 30; i++) { const r = run(g, c.key, 6, i * 7919); xs.push(...r.xs); rs.push(...r.ranks); }
    report.push({ course: c.key, replayPairs: 30, minSeconds: min, maxSeconds: max, biasSeeds: 30, biasSamples: xs.length, rho: rho(xs, rs) });
  }
  const file = process.env.MARBLE_ENTRANCE_COURSE ? `entrance-${process.env.MARBLE_ENTRANCE_COURSE}-matrix.json` : 'entrance-matrix.json';
  writeFileSync(resolve('../docs/specs/2026-10-12-draw-pinball/verifications', file), JSON.stringify(report, null, 2) + '\n'); console.log('ENTRANCE_MATRIX', JSON.stringify(report));
}, 300_000);
it('all six entrance profiles: representative 30/60/120Hz orders match common fixed-step fast-forward', () => {
  const g = loadGame('marble-race', MARBLE_SIM_FILES);
  for (const c of selectedCourses(g)) { const order = run(g, c.key, 6, 15838).order; for (const hz of [30, 60, 120]) expect(run(g, c.key, 6, 15838, hz).order).toEqual(order); }
}, 60_000);
it('cascade entrance start-x correlation stays within the established .20 investigation threshold at 60 seeds', () => {
  const g = loadGame('marble-race', MARBLE_SIM_FILES), xs: number[] = [], rs: number[] = [];
  for (let i = 1; i <= 60; i++) { const r = run(g, 'cascade', 6, i * 7919); xs.push(...r.xs); rs.push(...r.ranks); }
  const value = rho(xs, rs);
  const report = { course: 'cascade', seeds: 60, samples: xs.length, rho: value };
  writeFileSync(resolve('../docs/specs/2026-10-12-draw-pinball/verifications/entrance-cascade-investigation.json'), JSON.stringify(report, null, 2) + '\n'); console.log('CASCADE_ENTRY_BIAS', report);
  expect(Number.isFinite(value)).toBe(true); expect(Math.abs(value)).toBeLessThanOrEqual(.20);
}, 60_000);
