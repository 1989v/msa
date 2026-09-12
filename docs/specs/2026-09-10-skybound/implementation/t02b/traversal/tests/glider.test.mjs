import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createGlider } from '../src/glider.mjs';
test('original sail is lightweight, above the head, symmetric and hidden until flight', () => {
  const names = new Set();
  const sail = createGlider(THREE, name => { names.add(name); return new THREE.Color(.5, .5, .5); });
  assert.deepEqual([...names].sort(), ['brass', 'ochre', 'slate']);
  assert.equal(sail.root.visible, false); assert.ok(sail.stats.triangles > 2 && sail.stats.triangles < 250);
  const { min, max } = sail.stats.bounds;
  assert.ok(min[1] > 1.8 && max[1] < 2.6); assert.ok(max[0] - min[0] > 2.5);
  assert.ok(Math.abs(min[0] + max[0]) < 1e-6);
  sail.root.traverse(object => {
    if (!object.isMesh) return;
    assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
    const indices = object.geometry.index.array;
    assert.ok([...indices].every(index => index < object.geometry.attributes.position.count));
  });
});
