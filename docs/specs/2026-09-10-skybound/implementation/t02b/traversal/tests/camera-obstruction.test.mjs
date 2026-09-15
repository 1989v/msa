import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createCameraObstruction } from '../src/camera-obstruction.mjs';

test('camera stops before a solid wall and restores requested distance when it clears', () => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, .5), new THREE.MeshBasicMaterial());
  wall.position.set(0, 1, 3);
  const camera = createCameraObstruction(THREE, () => [wall]);
  const target = new THREE.Vector3(0, 1, 0), desired = new THREE.Vector3(0, 1, 7.2), result = new THREE.Vector3();
  camera.resolve(target, desired, result);
  assert.ok(Math.abs(result.z - 2.55) < 1e-6);
  assert.equal(desired.z, 7.2);
  wall.position.x = 5;
  camera.resolve(target, desired, result); assert.equal(result.z, 7.2);
  wall.position.x = 0; wall.visible = false;
  camera.resolve(target, desired, result); assert.equal(result.z, 7.2);
});
test('side rays protect the camera edge and geometry beyond requested zoom is ignored', () => {
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(.1, 2, .5), new THREE.MeshBasicMaterial());
  pillar.position.set(.12, 1, 3);
  const camera = createCameraObstruction(THREE, () => [pillar]);
  const target = new THREE.Vector3(0, 1, 0), desired = new THREE.Vector3(0, 1, 7.2), result = new THREE.Vector3();
  camera.resolve(target, desired, result); assert.ok(result.z < 3);
  pillar.position.z = 9; camera.resolve(target, desired, result); assert.equal(result.z, 7.2);
  camera.resolve(target, target, result); assert.deepEqual(result.toArray(), target.toArray());
});
