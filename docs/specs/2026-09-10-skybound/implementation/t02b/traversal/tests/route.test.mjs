import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createPlatform } from '../src/platform.mjs';
import { updateRoute, routeSnapshot } from '../src/route.mjs';
import { createSimulation } from '../../../t02a/src/simulation.mjs';

test('ordered contacts reject second-first shortcut, preserve unrelated progress, and reset explicitly', () => {
  const initial = Object.freeze({ collected: 3 });
  let p = updateRoute(initial, { second: true });
  assert.equal(routeSnapshot(p).complete, false); assert.equal(routeSnapshot(p).first, false);
  p = updateRoute(p, { first: true }); assert.equal(routeSnapshot(p).stage, 'second');
  p = updateRoute(p); assert.equal(routeSnapshot(p).complete, false);
  p = updateRoute(p, { second: true }); assert.equal(routeSnapshot(p).stage, 'complete');
  assert.equal(updateRoute(p), p); assert.equal(p.collected, 3);
  assert.deepEqual(initial, { collected: 3 }); assert.equal(routeSnapshot({}).complete, false);
  assert.equal(routeSnapshot(updateRoute({}, { first: true, second: true })).complete, false);
});

test('composed top queries keep both supports, grass below, and original checkpoint', () => {
  const ground = { heightAt: () => 10 }, col = () => new THREE.Color(.5, .5, .5);
  const first = createPlatform(THREE, col, ground, { x: 8, z: 0, topY: 15 });
  const second = createPlatform(THREE, col, first.terrain, { x: 14, z: 0, topY: 13 });
  assert.equal(second.terrain.supportHeightAt(8, 0, 15), 15);
  assert.equal(second.terrain.supportHeightAt(14, 0, 13), 13);
  assert.equal(second.terrain.supportHeightAt(11, 0, 15), 10);
  for (const x of [8, 14]) {
    assert.equal(second.terrain.heightAt(x, 0), 10);
    assert.equal(second.terrain.supportHeightAt(x, 0, 10), 10);
  }
});

test('default stamina wind-first-jump-glide-second completes and respawn retains ordered route', () => {
  const ground = { heightAt: (x, z) => Math.abs(x) <= 20 && Math.abs(z) <= 20 ? 10 : null };
  const col = () => new THREE.Color(.5, .5, .5);
  const first = createPlatform(THREE, col, ground, { x: 8, z: 0, topY: 15 });
  const second = createPlatform(THREE, col, first.terrain, { x: 14, z: 0, topY: 13 });
  const sim = createSimulation({ terrain: second.terrain, checkpoint: { x: 0, z: 0 }, flight: { enabled: true,
    volumes: [{ x: 0, z: 0, radius: 3, minY: 9, maxY: 22, speed: 4 }] } });
  function advance(dt, input = {}) {
    const s = sim.advance(dt, input);
    sim.setProgress(updateRoute(s.progress, { first: s.grounded && first.supports(s.position), second: s.grounded && second.supports(s.position) }));
    return sim.snapshot();
  }
  advance(.2, { jumpPressed: true }); let s = advance(.2, { jumpPressed: true });
  for (let i = 0; i < 600 && s.position.y < 19; i++) s = advance(1/120);
  for (let i = 0; i < 300; i++) s = advance(1/120, { x: 1 });
  for (let i = 0; i < 600 && !s.grounded; i++) s = advance(1/120);
  assert.equal(first.supports(s.position), true); assert.equal(routeSnapshot(s.progress).stage, 'second');
  advance(.15, { jumpPressed: true }); s = advance(1/120, { jumpPressed: true });
  assert.equal(s.gliding, true);
  for (let i = 0; i < 225; i++) s = advance(1/120, { x: 1 });
  for (let i = 0; i < 600 && !s.grounded; i++) s = advance(1/120);
  assert.equal(second.supports(s.position), true); assert.equal(s.gliding, false);
  assert.equal(routeSnapshot(s.progress).complete, true); assert.ok(s.stamina > 0); assert.equal(s.respawns, 0);
  for (let i = 0; i < 3000 && !s.respawns; i++) s = advance(1/120, { x: 1 });
  assert.equal(s.respawns, 1); assert.equal(routeSnapshot(s.progress).complete, true);
  assert.deepEqual(s.checkpoint, { x: 0, y: 10, z: 0 });
});
