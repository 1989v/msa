import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createWorld } from '../../t01b/src/world.mjs';
import { createTerrain } from '../../t02a/src/terrain.mjs';
import { createSurveyView } from '../../t02b/traversal/src/survey-view.mjs';
import { createSolidTerrain } from '../../t02b/traversal/src/solid-terrain.mjs';
import { DISCOVERY_IDS, discoverLocations } from '../src/exploration.mjs';
import { discoveryNote } from '../src/journal.mjs';
import { createProgressSave } from '../../t07a/src/save.mjs';

test('survey stones stand on real terrain, block movement, and discover without unlocking ruins', () => {
  const world = createWorld(THREE);
  const surfaces = [world.root.getObjectByName('continuous meadow'), world.root.children.find(o => o.name.startsWith('walkable-looking'))];
  const terrain = createTerrain(surfaces.map(mesh => {
    const positions = [];
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) positions.push(...new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld).toArray());
    return { positions, indices: mesh.geometry.index.array };
  }));
  const survey = createSurveyView(THREE, world.col, terrain);
  const solid = createSolidTerrain(terrain, () => survey.solidBounds);
  let progress = {};
  for (const location of survey.locations) {
    const { x, y, z } = location.position;
    assert.ok(Math.abs(y - terrain.heightAt(x, z)) < .5, location.id);
    assert.equal(solid.canMove({ x: x - 2, y, z }, { x: x + 2, y, z }), false);
    progress = discoverLocations(progress, { x: x - 2, y: terrain.heightAt(x - 2, z), z }, survey.locations);
    assert.ok(progress.discoveries.includes(location.id));
    assert.ok(discoveryNote(location.id).length > 20);
  }
  assert.deepEqual(Object.keys(progress), ['discoveries']);
  survey.update(progress.discoveries);
  assert.equal(survey.locations.length, 3);
});

test('legacy seven discoveries and all ten discoveries round-trip through version 1 saves', () => {
  let raw;
  const store = createProgressSave(() => ({ getItem: () => raw, setItem: (_, value) => { raw = value; } }));
  for (const discoveries of [DISCOVERY_IDS.slice(0, 7), [...DISCOVERY_IDS]]) {
    assert.equal(store.save({ discoveries }).ok, true);
    assert.deepEqual(store.load().progress.discoveries, discoveries);
  }
});
