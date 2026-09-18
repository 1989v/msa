import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedDestination, destinationBearing } from '../src/navigation.mjs';
const p = { x: 0, y: 0, z: 0 };
test('bearings follow camera yaw, including wraparound and a target behind', () => {
  assert.equal(destinationBearing(p, { ...p, z: -10 }, 0).arrow, '↑');
  assert.equal(destinationBearing(p, { ...p, x: 10 }, 0).arrow, '→');
  assert.equal(destinationBearing(p, { ...p, z: -10 }, Math.PI / 2).arrow, '→');
  assert.equal(destinationBearing(p, { ...p, z: 10 }, Math.PI * 2).arrow, '↓');
});
test('vertical separation never treats an airborne altar as a reached destination', () => {
  const b = destinationBearing(p, { x: 3, y: 12, z: 4 }, 0);
  assert.equal(b.distance, 5); assert.equal(b.elevation, '위쪽');
  assert.equal(destinationBearing(p, { ...p, y: -8 }, 0).elevation, '아래쪽');
  assert.throws(() => destinationBearing(p, { ...p, x: NaN }, 0));
});
test('suggestions continue through both maps before returning to camp', () => {
  const progress = {};
  for (const [expected, flag] of [['stone', 'stoneRuinActive'], ['watch', 'watchRuinActive'], ['wind', 'windRuinActive'], ['gate', 'journeyComplete']]) {
    assert.equal(suggestedDestination(progress), expected); progress[flag] = true;
  }
  assert.equal(suggestedDestination(progress), 'west-harbor');
  progress.harborAligned=true;assert.equal(suggestedDestination(progress), 'high-archive');
  progress.archiveComplete=true;assert.equal(suggestedDestination(progress), 'camp');
});
