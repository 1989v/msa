import test from 'node:test';
import assert from 'node:assert/strict';
import { createFootsteps } from '../../t02b/traversal/src/footsteps.mjs';

const snapshot = x => ({ position: { x, z: 0 }, velocity: { x: 6, z: 0 }, grounded: true, dodge: { active: false } });
test('cadence follows distance across frame rates and stays silent against a wall', () => {
  function walk(hz) {
    const cues = [], steps = createFootsteps(cue => cues.push(cue));
    for (let i = 0; i <= hz * 3; i++) steps.update(snapshot(i * 6 / hz), 1 / hz);
    for (let i = 0; i < hz; i++) steps.update(snapshot(18), 1 / hz);
    return cues;
  }
  assert.deepEqual(walk(30), walk(120));
  assert.ok(walk(60).length >= 9 && walk(60).length <= 10);
});
test('air, dodge, attack, respawn and pause discard pending cadence', () => {
  const cues = [], steps = createFootsteps(cue => cues.push(cue));
  const cases = [
    [s => ({ ...s, grounded: false }), {}],
    [s => ({ ...s, dodge: { active: true } }), {}],
    [s => s, { blocked: true }],
    [s => s, { respawned: true }],
  ];
  for (const [transform, options] of cases) {
    steps.update(snapshot(0), .25); steps.update(snapshot(1.5), .25);
    steps.update(transform(snapshot(3)), .25, options);
    steps.update(snapshot(4.5), .25);
    steps.reset();
  }
  steps.update(snapshot(0), .25); steps.update(snapshot(1.5), .25);
  steps.reset(); steps.update(snapshot(80), .25);
  steps.update(snapshot(180), .25); steps.update(snapshot(180), 0);
  assert.deepEqual(cues, []);
});
