import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createWorld } from '../../../t01b/src/world.mjs';
import { createTerrain } from '../../../t02a/src/terrain.mjs';
import { createManipulation } from '../../../t04a/src/manipulation.mjs';
import { sampleGroundSupport } from '../src/ground-support.mjs';
import { createManipulationView } from '../src/manipulation-view.mjs';
const object = { id: 'prism', kind: 'prism', size: { x: 2, y: 1, z: .5 }, position: { x: 2, y: .5, z: 0 }, yaw: 0 };

test('nine rotated samples reject holes/steep spread and rest on highest sample', () => {
  let samples = 0;
  const slope = { heightAt(x) { samples++; return x * .1; } };
  const support = sampleGroundSupport(slope, object);
  assert.equal(samples, 9); assert.equal(support.reason, null); assert.equal(support.pose.position.y, .8);
  assert.equal(sampleGroundSupport({ heightAt: x => x * .101 }, object).reason, 'terrain');
  const narrow = { heightAt: (x, z) => Math.abs(z) <= .3 ? 0 : null };
  assert.equal(sampleGroundSupport(narrow, object).reason, null);
  assert.equal(sampleGroundSupport(narrow, object, { ...object, yaw: 90 }).reason, 'terrain');
  assert.equal(sampleGroundSupport({ heightAt: (x, z) => x === 2 && z === 0 ? null : 0 }, object).reason, 'terrain');
});

test('controller resolves rotation height atomically, keeps invalid rotation preview and rechecks drop support', () => {
  let missing = false, narrow = false;
  const terrain = { heightAt: (x, z) => missing || narrow && Math.abs(z) > .3 ? null : z * .1 };
  const c = createManipulation({ objects: [object], resolvePlacement: (o, at) => sampleGroundSupport(terrain, o, at) });
  const frame = { eye: { x: 0, y: 1, z: 0 }, player: { min: { x: -.2, y: 0, z: -.2 }, max: { x: .2, y: 1.7, z: .2 } } };
  c.dispatch({ type: 'select', id: object.id }, frame); c.dispatch({ type: 'grab' }, frame);
  const committed = c.committedSnapshot();
  assert.equal(c.dispatch({ type: 'rotate', yaw: 90 }, frame).ok, true);
  assert.equal(c.snapshot().held.position.y, .6);
  assert.equal(c.committedSnapshot(), committed);
  c.dispatch({ type: 'rotate', yaw: 0 }, frame); const held = c.snapshot().held;
  narrow = true;
  assert.equal(c.dispatch({ type: 'rotate', yaw: 90 }, frame).reason, 'terrain');
  assert.equal(c.snapshot().held, held); assert.equal(c.snapshot().preview.pose.yaw, 90);
  assert.equal(c.dispatch({ type: 'drop' }, frame).reason, 'terrain'); assert.equal(c.committedSnapshot(), committed);
  narrow = false; c.dispatch({ type: 'move', position: held.position }, frame);
  missing = true;
  const before = c.snapshot(); assert.equal(c.dispatch({ type: 'drop' }, frame).reason, 'terrain'); assert.equal(c.snapshot(), before);
  assert.equal(c.dispatch({ type: 'move', position: { x: 3, y: .5, z: 0 } }, frame).reason, 'terrain');
  assert.equal(c.snapshot().held.position.x, 2);
});

test('real meadow/path triangles support original prism with the same sampled initial bottom', () => {
  const world = createWorld(THREE); world.root.updateMatrixWorld(true);
  const surfaces = [world.root.getObjectByName('continuous meadow'), world.root.children.find(o => o.name.startsWith('walkable-looking'))];
  const vertex = new THREE.Vector3();
  const terrain = createTerrain(surfaces.map(mesh => {
    const positions = [];
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) positions.push(...vertex.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld).toArray());
    return { positions, indices: mesh.geometry.index.array };
  }));
  const view = createManipulationView(THREE, world.col, terrain, surfaces);
  const actual = view.snapshot().objects[0];
  const support = sampleGroundSupport(terrain, actual);
  assert.equal(support.reason, null); assert.equal(actual.position.y, support.pose.position.y);
});
