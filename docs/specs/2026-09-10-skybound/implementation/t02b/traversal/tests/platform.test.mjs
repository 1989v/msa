import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createPlatform } from '../src/platform.mjs';
import { createSimulation } from '../../../t02a/src/simulation.mjs';

const ground = { heightAt: (x, z) => Math.abs(x) <= 20 && Math.abs(z) <= 20 ? 10 : null };
const create = options => createPlatform(THREE, () => new THREE.Color(.5, .5, .5), ground, options);
function steps(sim, count, input = {}) { let s; for (let i = 0; i < count; i++) s = sim.advance(1/120, input); return s; }

test('top collision uses rendered triangles while base/checkpoint and overhead traversal stay on grass', () => {
  const pad = create({ x: 8, z: 0, topY: 15.123 });
  const top = pad.root.getObjectByName('one-way landing top').geometry;
  assert.equal(pad.topY, top.attributes.position.getY(0));
  assert.equal(pad.terrain.heightAt(8, 0), 10);
  assert.equal(pad.terrain.supportHeightAt(8, 0, 10), 10);
  assert.equal(pad.terrain.supportHeightAt(8, 0, 16), pad.topY);
  const sim = createSimulation({ terrain: pad.terrain, checkpoint: { x: 0, z: 0 } });
  const s = steps(sim, 300, { x: 1 });
  assert.ok(Math.abs(s.position.x - 8) < 1e-8); assert.equal(s.position.y, 10); assert.equal(s.grounded, true);
  assert.equal(sim.setCheckpoint({ x: 8, z: 0 }).y, 10);
});

test('rising passes through, descent catches actual top, support holds, lateral exit falls', () => {
  const pad = create({ x: 0, z: 0, topY: 11 });
  const sim = createSimulation({ terrain: pad.terrain, checkpoint: { x: 0, z: 0 } });
  sim.advance(1/120, { jumpPressed: true });
  const rising = steps(sim, 24);
  assert.ok(rising.position.y > 11); assert.equal(rising.grounded, false); assert.ok(rising.velocity.y > 0);
  const landed = steps(sim, 70);
  assert.equal(landed.position.y, pad.topY); assert.equal(landed.grounded, true);
  assert.equal(steps(sim, 30).position.y, pad.topY);
  const exit = steps(sim, 90, { x: 1 });
  assert.ok(exit.position.x > 2); assert.ok(exit.position.y < pad.topY); assert.equal(exit.grounded, false);
});

test('one shared-stamina wind launch reaches pad, folds on landing, and progress survives water respawn', () => {
  const pad = create({ x: 8, z: 0, topY: 15 });
  const sim = createSimulation({ terrain: pad.terrain, checkpoint: { x: 0, z: 0 },
    flight: { enabled: true, volumes: [{ x: 0, z: 0, radius: 3, minY: 9, maxY: 22, speed: 4 }] } });
  sim.advance(.2, { jumpPressed: true }); sim.advance(.2, { jumpPressed: true });
  let s = sim.snapshot();
  for (let i = 0; i < 600 && s.position.y < 19; i++) s = steps(sim, 1);
  assert.ok(s.position.y >= 19); assert.equal(s.gliding, true);
  s = steps(sim, 300, { x: 1 });
  for (let i = 0; i < 600 && !s.grounded; i++) s = steps(sim, 1);
  assert.equal(s.grounded, true); assert.equal(s.position.y, pad.topY);
  assert.equal(s.gliding, false); assert.ok(s.stamina > 0); assert.equal(s.respawns, 0);
  sim.setProgress({ firstAerialLanding: true });
  for (let i = 0; i < 3000 && s.respawns === 0; i++) s = steps(sim, 1, { x: 1 });
  assert.equal(s.respawns, 1); assert.equal(s.progress.firstAerialLanding, true);
  assert.deepEqual(s.checkpoint, { x: 0, y: 10, z: 0 });
});
