import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimationBridge } from '../src/animation.mjs';
const durations = { idle: 3, walk: 1.12, run: .68, jump: .7, fall: 1.2, land: .9 };
const snap = (mode, respawns = 0) => ({ mode, respawns, grounded: !['rising', 'falling'].includes(mode), velocity: { x: 0, z: ['walking', 'running'].includes(mode) ? -3 : 0 } });
test('movement modes select existing clips and rising holds its one-shot end', () => {
  const bridge = createAnimationBridge(durations);
  for (const [mode, name] of Object.entries({ idle: 'idle', walking: 'walk', running: 'run', rising: 'jump', falling: 'fall' })) assert.equal(bridge.update(snap(mode), .1).name, name);
  bridge.update(snap('rising'), 0);
  assert.equal(bridge.update(snap('rising'), 2).time, .7);
});
test('fall-to-ground plays land once, then idle; movement interrupts immediately', () => {
  const bridge = createAnimationBridge(durations);
  bridge.update(snap('falling'), 0);
  assert.equal(bridge.update(snap('idle'), .1).name, 'land');
  assert.equal(bridge.update(snap('idle'), .5).name, 'land');
  assert.equal(bridge.update(snap('idle'), .5).name, 'idle');
  assert.equal(bridge.update(snap('idle'), .1).name, 'idle');
  bridge.update(snap('falling'), .1); bridge.update(snap('idle'), .1);
  assert.equal(bridge.update(snap('walking'), .1).name, 'walk');
  bridge.update(snap('falling'), .1);
  assert.equal(bridge.update(snap('running'), .1).name, 'run');
});
test('respawn suppresses landing, resets clip time, and does not mutate snapshots', () => {
  const bridge = createAnimationBridge(durations);
  bridge.update(snap('falling'), .1);
  const snapshot = snap('idle', 1), before = structuredClone(snapshot);
  const result = bridge.update(snapshot, .2);
  assert.equal(result.name, 'idle'); assert.equal(result.time, 0); assert.equal(result.respawned, true);
  assert.deepEqual(snapshot, before);
});
test('gliding deliberately reuses fall, then resumes landing/walk or resets after respawn', () => {
  const bridge = createAnimationBridge(durations);
  const flying = { ...snap('falling'), mode: 'gliding', gliding: true };
  assert.equal(bridge.update(flying, .1).name, 'fall');
  assert.equal(bridge.update(flying, .1).once, false);
  assert.equal(bridge.update(snap('falling'), .1).name, 'fall');
  bridge.update(flying, .1); assert.equal(bridge.update(snap('idle'), .1).name, 'land');
  assert.equal(bridge.update(snap('walking'), .1).name, 'walk');
  bridge.update(flying, .1); const restored = bridge.update(snap('idle', 1), .1);
  assert.equal(restored.name, 'idle'); assert.equal(restored.time, 0);
});
