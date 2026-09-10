import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportFixture, loadFixture, sampleVertices } from './probe.mjs';

function near(actual, expected, message) {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-5,
    `${message}[${index}]: ${value} != ${expected[index]}`));
}

const source = await exportFixture();
const loaded = await loadFixture(source.buffer);
const mesh = loaded.scene.getObjectByName('DiagnosticStrip');

test('GLB 2 container and saved artifact match reproducible binary export', async () => {
  const view = new DataView(source.buffer);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), source.buffer.byteLength);
  assert.deepEqual(await readFile(new URL('./diagnostic-rig.glb', import.meta.url)), Buffer.from(source.buffer));
});

test('roundtrip retains topology, two joints, inverse binds and mixed weights', () => {
  assert.ok(mesh?.isSkinnedMesh);
  assert.deepEqual(mesh.skeleton.bones.map((bone) => bone.name), ['ProbeRoot', 'ProbeHinge']);
  assert.equal(mesh.skeleton.bones[1].parent, mesh.skeleton.bones[0]);
  near(mesh.skeleton.bones[1].position.toArray(), [0, 1, 0], 'hinge offset');
  for (const attribute of ['position', 'skinIndex', 'skinWeight']) {
    near([...mesh.geometry.attributes[attribute].array], [...source.mesh.geometry.attributes[attribute].array], attribute);
  }
  near([...mesh.geometry.index.array], [...source.mesh.geometry.index.array], 'indices');
  mesh.skeleton.boneInverses.forEach((inverse, i) =>
    near(inverse.elements, source.mesh.skeleton.boneInverses[i].elements, `inverse bind ${i}`));
});

test('roundtrip retains animation duration, keyframes and quaternion track', () => {
  assert.equal(loaded.animations.length, 1);
  const clip = loaded.animations[0];
  assert.equal(clip.name, 'HingeBend');
  assert.equal(clip.duration, 1);
  assert.equal(clip.tracks.length, 1);
  assert.equal(clip.tracks[0].name, 'ProbeHinge.quaternion');
  near([...clip.tracks[0].times], [0, 1], 'times');
  near([...clip.tracks[0].values], [...source.clip.tracks[0].values], 'quaternions');
});

test('loaded animation deforms actual vertices with analytically expected weighted skinning', () => {
  const rest = sampleVertices(loaded.scene, mesh, loaded.animations[0], 0);
  const moved = sampleVertices(loaded.scene, mesh, loaded.animations[0], 0.5);
  const original = sampleVertices(source.scene, source.mesh, source.clip, 0.5);
  const cosine = Math.SQRT1_2;
  rest.forEach((point, i) => {
    near(point, [...source.mesh.geometry.attributes.position.array].slice(i * 3, i * 3 + 3), `rest ${i}`);
    near(moved[i], original[i], `source vs roundtrip ${i}`);
    const [x, y, z] = point;
    const weight = source.mesh.geometry.attributes.skinWeight.getY(i);
    near(moved[i], [
      x * (1 - weight) + (cosine * x - cosine * (y - 1)) * weight,
      y * (1 - weight) + (1 + cosine * x + cosine * (y - 1)) * weight,
      z,
    ], `analytic deformation ${i}`);
  });
  near(moved[0], rest[0], 'root-bound vertex remains stationary');
  assert.ok(Math.abs(moved[4][0] - rest[4][0]) > 0.5, 'hinge-bound vertex must actually move');
  assert.ok(Math.abs(moved[2][1] - rest[2][1]) > 0.05, 'mixed-weight vertex must actually move');
});
