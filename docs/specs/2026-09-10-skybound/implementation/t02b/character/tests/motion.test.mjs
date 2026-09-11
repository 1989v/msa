import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createCharacter } from '../src/model.mjs';
import { createLocomotionClips } from '../src/motion.mjs';

function sample(character, clip, time) {
  const mixer = new THREE.AnimationMixer(character.root);
  mixer.clipAction(clip).play();
  mixer.setTime(time);
  character.root.updateMatrixWorld(true);
  character.skeleton.update();
  const feet = ['L', 'R'].map(side => {
    const part = character.stats.parts.find(part => part.name === `boot-sole-${side}`);
    const points = Array.from({ length: part.count }, (_, i) => character.mesh.getVertexPosition(part.start + i, new THREE.Vector3()));
    return new THREE.Box3().setFromPoints(points);
  });
  const joints = Object.fromEntries(character.skeleton.bones.map(bone => [bone.name, bone.getWorldPosition(new THREE.Vector3())]));
  const rootPosition = character.root.position.clone();
  mixer.stopAllAction();
  mixer.uncacheRoot(character.root);
  return { feet, joints, rootPosition };
}

test('walk/run are finite periodic normalized clips without horizontal root motion', () => {
  const clips = createLocomotionClips(THREE);
  assert.deepEqual(clips.map(clip => clip.name), ['walk', 'run']);
  assert.ok(clips[1].duration < clips[0].duration);
  for (const clip of clips) for (const track of clip.tracks) {
    assert.ok([...track.values].every(Number.isFinite));
    assert.equal(track.times[0], 0);
    assert.ok(Math.abs(track.times.at(-1) - clip.duration) < 1e-6);
    const width = track.getValueSize();
    for (let i = 0; i < width; i++) assert.ok(Math.abs(track.values[i] - track.values.at(-width + i)) < 1e-6, `${clip.name} ${track.name} loop seam`);
    if (track.name.endsWith('.quaternion')) {
      for (let i = 0; i < track.values.length; i += 4) assert.ok(Math.abs(Math.hypot(...track.values.slice(i, i + 4)) - 1) < 1e-6);
    } else {
      assert.equal(track.name, 'hips.position');
      for (let i = 0; i < track.values.length; i += 3) { assert.equal(track.values[i], 0); assert.equal(track.values[i + 2], 0); }
    }
  }
});

test('both LODs keep actual sole vertices grounded and alternate foot clearance across interpolated samples', () => {
  for (const lod of [0, 1]) for (const clip of createLocomotionClips(THREE)) {
    const character = createCharacter(THREE, { lod });
    let highestSwing = 0;
    for (let i = 0; i < 96; i++) {
      const { feet, rootPosition } = sample(character, clip, clip.duration * (i + .37) / 96);
      const low = Math.min(...feet.map(foot => foot.min.y));
      highestSwing = Math.max(highestSwing, ...feet.map(foot => foot.min.y));
      assert.ok(low >= -.004, `${clip.name} LOD${lod} frame${i}: penetration ${low}`);
      assert.ok(low < .025, `${clip.name}: missing support contact ${low}`);
      assert.ok(rootPosition.length() < 1e-8);
    }
    assert.ok(highestSwing > (clip.name === 'run' ? .12 : .055));
    const a = sample(character, clip, clip.duration * .25);
    const b = sample(character, clip, clip.duration * .75);
    assert.ok(a.feet[1].min.y > a.feet[0].min.y + .05);
    assert.ok(b.feet[0].min.y > b.feet[1].min.y + .05);
  }
});

test('opposite arm and leg lead; stopping restores the authored A-pose and grounded feet', () => {
  const character = createCharacter(THREE);
  for (const clip of createLocomotionClips(THREE)) {
    const { joints } = sample(character, clip, 0);
    assert.ok(joints.foot_L.z > joints.foot_R.z + .2);
    assert.ok(joints.hand_R.z > joints.hand_L.z + .15);
    const mixer = new THREE.AnimationMixer(character.root);
    const arm = character.skeleton.getBoneByName('upperArm_L');
    const original = arm.quaternion.clone();
    mixer.clipAction(clip).play(); mixer.setTime(clip.duration * .25);
    assert.ok(arm.quaternion.angleTo(original) > .2);
    mixer.stopAllAction();
    assert.ok(arm.quaternion.angleTo(original) < 1e-6);
    assert.ok(Math.abs(character.skeleton.getBoneByName('hips').position.y - .87) < 1e-6);
  }
});

test('deformed ankle overlap does not open beyond bind-pose surface clearance in either gait', () => {
  // Compare actual skin vertices against boot triangles, not bone pivots or sole height.
  // The wrap starts 25mm below the cuff in bind pose; that overlap must survive flexion.
  for (const lod of [0, 1]) for (const clip of createLocomotionClips(THREE)) {
    const character = createCharacter(THREE, { lod });
    const geometry = character.mesh.geometry;
    const seams = ['L', 'R'].map(side => {
      const wrap = character.stats.parts.find(part => part.name === `shin-wrap-${side}`);
      const boot = character.stats.parts.find(part => part.name === `boot-upper-${side}`);
      const ring = Array.from({ length: wrap.count }, (_, i) => wrap.start + i)
        .filter(i => Math.abs(geometry.attributes.position.getY(i) - .18) < 1e-6);
      const triangleStart = character.stats.parts.slice(0, character.stats.parts.indexOf(boot)).reduce((sum, part) => sum + part.triangles, 0);
      const indices = Array.from(geometry.index.array.slice(triangleStart * 3, (triangleStart + boot.triangles) * 3));
      const restTriangles=[];
      for(let i=0;i<indices.length;i+=3)restTriangles.push(new THREE.Triangle(...indices.slice(i,i+3).map(index=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,index))));
      const clearance = new Map(ring.map(index => {
        const point = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index);
        const closest = new THREE.Vector3();
        return [index, Math.min(...restTriangles.map(triangle => triangle.closestPointToPoint(point, closest).distanceTo(point)))];
      }));
      return { side, ring, indices, clearance };
    });
    const mixer = new THREE.AnimationMixer(character.root);
    mixer.clipAction(clip).play();
    for (let frame = 0; frame < 64; frame++) {
      mixer.setTime(clip.duration * (frame + .37) / 64);
      character.root.updateMatrixWorld(true); character.skeleton.update();
      for (const { side, ring, indices, clearance } of seams) {
        const points = new Map([...new Set(indices)].map(i => [i, character.mesh.getVertexPosition(i, new THREE.Vector3())]));
        const triangles = [];
        for (let i = 0; i < indices.length; i += 3) triangles.push(new THREE.Triangle(points.get(indices[i]), points.get(indices[i + 1]), points.get(indices[i + 2])));
        for (const index of ring) {
          const point = character.mesh.getVertexPosition(index, new THREE.Vector3());
          const closest = new THREE.Vector3();
          const distance = Math.min(...triangles.map(triangle => triangle.closestPointToPoint(point, closest).distanceTo(point)));
          assert.ok(distance < clearance.get(index) + .002, `${clip.name} LOD${lod} ${side} frame${frame}: ankle gap ${distance}m, bind clearance ${clearance.get(index)}m`);
        }
      }
    }
    mixer.stopAllAction();
  }
});
