import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { completeJourney } from '../src/ending.mjs';
import { createFinaleView } from '../../t02b/traversal/src/finale-view.mjs';
import { createSimulation } from '../../t02a/src/simulation.mjs';
import { createProgressSave } from '../../t07a/src/save.mjs';
import { createWorld } from '../../t01b/src/world.mjs';
import { createTerrain } from '../../t02a/src/terrain.mjs';
const progress = { stoneRuinActive: true, watchRuinActive: true, windRuinActive: true, firstAerialLanding: true, secondAerialLanding: true };

test('ending requires all ruins and landing; repeats and paused frames are inert', () => {
  for (const conditions of [{ grounded: false, onIsland: true }, { grounded: true, onIsland: false }, { grounded: true, onIsland: true, paused: true }]) assert.equal(completeJourney(progress, conditions), progress);
  const missing = { ...progress, watchRuinActive: false };
  assert.equal(completeJourney(missing, { grounded: true, onIsland: true }), missing);
  const done = completeJourney(progress, { grounded: true, onIsland: true });
  assert.equal(done.journeyComplete, true);
  assert.equal(completeJourney(done, { grounded: true, onIsland: true }), done);
  let raw;
  const save = createProgressSave(() => ({ getItem: () => raw, setItem: (key, value) => { raw = value; } }));
  assert.equal(save.save(done).ok, true);
  assert.equal(save.load().progress.journeyComplete, true);
  assert.equal(save.save({ ...done, stoneRuinActive: false }).ok, false);
});

test('actual meadow gate unlocks without teleport, then flight reaches the final island', () => {
  const world = createWorld(THREE); world.root.updateMatrixWorld(true);
  const surfaces = [world.root.getObjectByName('continuous meadow'), world.root.children.find(o => o.name.startsWith('walkable-looking'))];
  const terrain = createTerrain(surfaces.map(mesh => {
    const positions = [];
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) positions.push(...new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld).toArray());
    return { positions, indices: mesh.geometry.index.array };
  }));
  const finale = createFinaleView(THREE, world.col, terrain);
  const sim = createSimulation({ terrain: finale.island.terrain, checkpoint: { x: 0, z: 24 }, flight: { enabled: true, volumes: [finale.volume] } });
  sim.advance(1 / 120, { jumpPressed: true });
  sim.advance(1 / 120, { jumpPressed: true });
  assert.equal(sim.snapshot().windSpeed, 0);
  const before = sim.snapshot().position;
  sim.setProgress(progress);
  assert.deepEqual(sim.snapshot().position, before);
  sim.advance(1 / 120, {});
  assert.equal(sim.snapshot().windSpeed, 6);
  for (let i = 0; i < 600 && sim.snapshot().position.y < finale.volume.maxY - 1; i++) sim.advance(1 / 120, {});
  for (let i = 0; i < 300 && sim.snapshot().position.x < 8; i++) sim.advance(1 / 120, { x: 1 });
  for (let i = 0; i < 600 && !sim.snapshot().grounded; i++) sim.advance(1 / 120, {});
  assert.equal(finale.island.supports(sim.snapshot().position), true);
  const done = completeJourney(sim.snapshot().progress, { grounded: sim.snapshot().grounded, onIsland: true });
  sim.setProgress(done);
  assert.equal(sim.respawn().progress.journeyComplete, true);
});
