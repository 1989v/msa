import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createCharacter } from '../../character/src/model.mjs';
import { createAerialClips } from '../../character/src/aerial.mjs';
import { createGlider } from '../src/glider.mjs';
import { createFlightPose } from '../src/flight-pose.mjs';
test('both actual palm surfaces track shared bar targets across phases, yaw and LOD without pose leakage', () => {
  for (const lod of [0, 1]) {
    const character = createCharacter(THREE, { lod }), sail = createGlider(THREE, () => new THREE.Color(.5, .5, .5));
    const pose = createFlightPose(THREE, character.root, sail.targets);
    const mixer = new THREE.AnimationMixer(character.root);
    mixer.clipAction(createAerialClips(THREE).find(clip => clip.name === 'fall')).play();
    for (const yaw of [0, .7, Math.PI]) for (const time of [0, .2, .5, .9, 1.1]) {
      pose.restore(); mixer.setTime(time);
      character.root.position.set(4, 12, -3); character.root.rotation.y = yaw;
      sail.root.position.copy(character.root.position); sail.root.rotation.y = yaw;
      const before = character.skeleton.bones.map(bone => bone.quaternion.clone());
      const errors = pose.apply(); assert.ok(errors.left < 1e-6 && errors.right < 1e-6);
      character.skeleton.update();
      for (const [side, suffix] of [['left', 'L'], ['right', 'R']]) {
        const part = character.stats.parts.find(part => part.name === `palm-${suffix}`);
        const center = new THREE.Vector3();
        for (let i = part.start; i < part.start + part.count; i++) center.add(character.mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(character.mesh.matrixWorld));
        center.divideScalar(part.count);
        assert.ok(center.distanceTo(sail.targets[side].getWorldPosition(new THREE.Vector3())) < .005, `${side} LOD${lod}: deformed palm contact`);
      }
      pose.restore(); character.skeleton.bones.forEach((bone, i) => assert.deepEqual(bone.quaternion.toArray(), before[i].toArray()));
    }
    mixer.stopAllAction();
    character.skeleton.bones.forEach(bone => assert.ok(bone.quaternion.angleTo(new THREE.Quaternion()) < 1e-6));
  }
});
