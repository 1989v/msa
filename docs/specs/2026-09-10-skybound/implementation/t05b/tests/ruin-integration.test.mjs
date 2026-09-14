import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createSimulation } from '../../t02a/src/simulation.mjs';
import { activateWatchRuin } from '../src/ruin.mjs';
import { createWatchRuinView } from '../../t02b/traversal/src/watch-ruin-view.mjs';
import { updateRoute } from '../../t02b/traversal/src/route.mjs';

test('activated device progress survives route updates and safe respawn; new session resets', () => {
  const terrain = { heightAt: () => 0 };
  const device = createWatchRuinView(THREE, () => new THREE.Color(), terrain);
  const simulation = createSimulation({ terrain, checkpoint: device.position });
  const progress = activateWatchRuin(simulation.snapshot().progress, {
    defeated: true, grounded: true, position: simulation.snapshot().position, device: device.position,
  });
  simulation.setProgress(updateRoute(progress, { first: true }));
  const recovered = simulation.respawn().progress;
  assert.equal(recovered.watchRuinActive, true);
  assert.equal(recovered.firstAerialLanding, true);
  device.update({ active: recovered.watchRuinActive, defeated: true });
  assert.equal(device.root.children[1].position.y, 1.25);
  assert.equal(createSimulation({ terrain }).snapshot().progress.watchRuinActive, undefined);
});
