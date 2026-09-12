import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createUpdraft, insideUpdraft } from '../src/updraft.mjs';
import { stepGliding } from '../../../t03a/src/gliding.mjs';

const source = () => ({ x: 0, z: 30, radius: 3, minY: 8, maxY: 21, speed: 4 });
const terrain = { heightAt: (x, z) => 9 + x * .1 + (z - 30) * .05 };
const create = value => createUpdraft(THREE, () => new THREE.Color(.5, .5, .5), value, terrain);

test('shared cylinder has exact visual bounds and terrain-following ground mark', () => {
  const input = source(), wind = create(input);
  input.radius = 90;
  assert.equal(wind.volume.radius, 3); assert.ok(Object.isFrozen(wind.volume));
  const ring = wind.root.getObjectByName('wind cylinder boundary').geometry;
  ring.computeBoundingBox();
  assert.deepEqual(ring.boundingBox.min.toArray(), [-3, 8, 27]);
  assert.deepEqual(ring.boundingBox.max.toArray(), [3, 21, 33]);
  const ground = wind.root.getObjectByName('wind ground mark').geometry.attributes.position;
  for (let i = 0; i < ground.count; i++) assert.ok(Math.abs(ground.getY(i) - terrain.heightAt(ground.getX(i), ground.getZ(i)) - .035) < 1e-6);
});

test('inclusive radius/bottom and exclusive top agree with actual flight rule', () => {
  const wind = create(source());
  for (const [point, expected] of [
    [{ x: 3, y: 8, z: 30 }, true], [{ x: 3.001, y: 9, z: 30 }, false],
    [{ x: 0, y: 21, z: 30 }, false], [{ x: 0, y: 7.999, z: 30 }, false],
    [{ x: 0, y: 9, z: 35 }, false], [{ x: 0, y: 20.999, z: 30 }, true],
  ]) {
    assert.equal(insideUpdraft(wind.volume, point), expected);
    const flight = stepGliding({ deployed: true, stamina: 50, velocityY: 0 }, { dt: .01, grounded: false, position: point }, [wind.volume]);
    assert.equal(flight.windSpeed, expected ? 4 : 0);
  }
});

test('absolute-time particles reproduce reset and remain inside shared volume without replacing buffers', () => {
  const wind = create(source()), arrows = wind.root.getObjectByName('rising wind arrows');
  const buffer = arrows.instanceMatrix.array, initial = [...buffer];
  const matrix = new THREE.Matrix4(), vertex = new THREE.Vector3();
  for (const time of [.05, .5, 7, 101]) {
    wind.update(time);
    for (let i = 0; i < arrows.count; i++) {
      arrows.getMatrixAt(i, matrix);
      const positions = arrows.geometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        vertex.fromBufferAttribute(positions, j).applyMatrix4(matrix);
        assert.equal(insideUpdraft(wind.volume, vertex), true);
      }
    }
  }
  wind.update(.5); const half = [...buffer];
  wind.update(.5); assert.deepEqual([...buffer], half);
  wind.update(0); assert.deepEqual([...buffer], initial);
  assert.equal(arrows.instanceMatrix.array, buffer);
  assert.equal(arrows.geometry.index.count / 3 * arrows.count, wind.stats.triangles);
  assert.throws(() => wind.update(NaN)); assert.deepEqual([...buffer], initial);
});
