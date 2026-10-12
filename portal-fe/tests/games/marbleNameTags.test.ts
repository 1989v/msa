import { expect, it } from 'vitest';
import { loadGame } from './loadGame';
it('all three attention names remain separate at a crowded start and final entry', () => {
  const g = loadGame('marble-race', ['art.js']);
  const marbles = Array.from({ length: 3 }, (_, i) => ({ id: i, x: 480 + i * 22, y: 5200 + i * 18, r: 22, name: `참가자 ${i}` }));
  const before = JSON.stringify(marbles);
  const tags = g.Art.nameTagLayout({ measureText: () => ({ width: 180 }) }, marbles, 1.65) as { x: number; y: number; width: number }[];
  expect(tags).toHaveLength(3);
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
    const horizontal = Math.abs(tags[i].x - tags[j].x) >= (tags[i].width + tags[j].width) / 2;
    const vertical = Math.abs(tags[i].y - tags[j].y) >= 38 / 1.65;
    expect(horizontal || vertical).toBe(true);
  }
  expect(JSON.stringify(marbles)).toBe(before);
});
