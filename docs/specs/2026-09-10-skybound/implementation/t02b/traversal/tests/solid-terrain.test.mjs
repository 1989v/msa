import test from 'node:test';
import assert from 'node:assert/strict';
import { createSolidTerrain } from '../src/solid-terrain.mjs';
import { createSimulation } from '../../../t02a/src/simulation.mjs';

function setup(depth = 1) {
  let boxes = [{ min: { x: 2, y: 0, z: -depth }, max: { x: 3, y: 1, z: depth } }];
  const terrain = createSolidTerrain({ heightAt: () => 0 }, () => boxes);
  return { terrain, remove: () => { boxes = []; }, sim: createSimulation({ terrain, checkpoint: { x: 0, z: 0 } }) };
}
const advance = (sim, frames, input) => { for (let i = 0; i < frames; i++) sim.advance(.25, input); return sim.snapshot(); };
test('walking and dodging cannot tunnel into solids; movement away and along walls remains possible', () => {
  const { sim } = setup(4);
  const stopped = advance(sim, 4, { x: 1 });
  assert.ok(stopped.position.x <= 1.7 && stopped.position.x > 1.6);
  sim.advance(.25, { x: 1, dodgePressed: true });
  assert.ok(sim.snapshot().position.x <= 1.7);
  advance(sim, 2, {});
  const sliding = advance(sim, 6, { x: 1, z: 1 });
  assert.ok(sliding.position.x <= 1.7); assert.ok(sliding.position.z > 3);
  const away = sim.advance(.25, { x: -1 }); assert.ok(away.position.x < sliding.position.x);
});
test('jump lands on the object top and removing that support lets the player fall to ground', () => {
  const { sim, terrain, remove } = setup();
  advance(sim, 4, { x: 1 });
  assert.equal(terrain.supportHeightAt(2.5, 0, .5), 0);
  sim.advance(.25, { x: 1, jumpPressed: true }); sim.advance(.25, { x: 1 });
  let state = advance(sim, 2, {});
  assert.ok(state.position.x > 2 && state.position.x < 3); assert.equal(state.position.y, 1); assert.equal(state.grounded, true);
  remove(); state = advance(sim, 4, {});
  assert.equal(state.position.y, 0); assert.equal(state.grounded, true);
  assert.equal(terrain.heightAt(2.5, 0), 0);
});
