import test from 'node:test';
import assert from 'node:assert/strict';
import { activateWatchRuin } from '../src/ruin.mjs';

const valid = () => ({ defeated: true, grounded: true, position: { x: 0, y: 0, z: 0 }, device: { x: 0, y: 0, z: 0 } });

test('activation accepts inclusive distance boundaries and preserves unrelated progress without mutation', () => {
  const discovery = Object.freeze(['ridge']);
  const progress = Object.freeze({ stoneRuinActive: true, discovery });
  const result = activateWatchRuin(progress, { ...valid(), device: { x: 2, y: 1.2, z: 0 } });
  assert.deepEqual(result, { stoneRuinActive: true, discovery, watchRuinActive: true });
  assert.equal(result.discovery, discovery);
  assert.notEqual(result, progress);
  assert.equal(progress.watchRuinActive, undefined);
});

test('defeat, grounding, unlocked input, and running simulation are all required', () => {
  const progress = Object.freeze({ watchRuinActive: false });
  for (const override of [{ defeated: false }, { grounded: false }, { blocked: true }, { paused: true }]) {
    assert.equal(activateWatchRuin(progress, { ...valid(), ...override, lineOfSight: () => assert.fail('gated interaction checks sight') }), progress);
  }
});

test('out-of-range, occluded, and nonfinite positions fail closed', () => {
  const progress = {};
  const cases = [
    { device: { x: 2, y: 0, z: 0.01 } },
    { device: { x: 0, y: -1.201, z: 0 } },
    { lineOfSight: () => false },
    ...['position', 'device'].flatMap(key => ['x', 'y', 'z'].flatMap(axis => [NaN, Infinity, undefined].map(value => ({ [key]: { x: 0, y: 0, z: 0, [axis]: value } })))),
    { position: null }, { device: null },
  ];
  for (const override of cases) assert.equal(activateWatchRuin(progress, { ...valid(), ...override }), progress);
  const input = valid();
  activateWatchRuin(progress, { ...input, lineOfSight: (from, to) => {
    assert.equal(from, input.position);
    assert.equal(to, input.device);
    return true;
  } });
});

test('repeated activation returns the same progress without querying sight again', () => {
  const progress = activateWatchRuin({ stoneRuinActive: true }, valid());
  assert.equal(activateWatchRuin(progress, { ...valid(), lineOfSight: () => assert.fail('already active') }), progress);
});
