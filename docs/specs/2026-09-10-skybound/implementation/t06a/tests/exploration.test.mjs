import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverLocations, mapPoint } from '../src/exploration.mjs';
import { createProgressSave } from '../../t07a/src/save.mjs';
const position = { x: 0, y: 0, z: 0 };
const locations = [{ id: 'camp', position }, { id: 'wind', position: { ...position, y: 12 } }, { id: 'ridge', position: { ...position, z: -30 } }];

test('discovery requires proximity and elevation, persists, and does not repeatedly change progress', () => {
  const first = discoverLocations({ stoneRuinActive: true }, position, locations);
  assert.deepEqual(first.discoveries, ['camp']);
  assert.equal(first.stoneRuinActive, true);
  assert.equal(discoverLocations(first, position, locations), first);
  const next = discoverLocations(first, locations[1].position, locations);
  assert.deepEqual(next.discoveries, ['camp', 'wind']);
  let raw = null;
  const save = createProgressSave(() => ({ getItem: () => raw, setItem: (k, v) => { raw = v; } }));
  assert.equal(save.save(next).ok, true);
  assert.deepEqual(save.load().progress.discoveries, ['camp', 'wind']);
  for (const discoveries of [['unknown'], ['camp', 'camp'], 'camp', Array(8).fill('camp')]) {
    assert.equal(save.save({ discoveries }).ok, false);
    raw = JSON.stringify({ version: 1, worldVersion: 1, progress: { watchRuinActive: false, firstAerialLanding: false, secondAerialLanding: false, discoveries } });
    assert.equal(save.load().ok, false);
  }
});

test('map keeps north up with equal world scale on both axes', () => {
  assert.deepEqual(mapPoint({ x: -35, z: -50 }), { x: 0, y: 0 });
  assert.deepEqual(mapPoint({ x: 35, z: 50 }), { x: 420, y: 600 });
  assert.equal(mapPoint({ x: 1, z: 0 }).x - mapPoint(position).x, 6);
  assert.equal(mapPoint({ x: 0, z: -1 }).y - mapPoint(position).y, -6);
});
