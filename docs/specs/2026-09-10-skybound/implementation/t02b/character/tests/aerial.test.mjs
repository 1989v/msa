import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createCharacter } from '../src/model.mjs';
import { createAerialClips, AERIAL_PLAYBACK } from '../src/aerial.mjs';

test('aerial clips have finite normalized tracks, a periodic fall and explicit one-shot policy', () => {
  const clips = createAerialClips(THREE);
  assert.deepEqual(clips.map(clip => clip.name), ['jump', 'fall', 'land']);
  assert.deepEqual(AERIAL_PLAYBACK, { jump: 'once', fall: 'repeat', land: 'once' });
  for (const clip of clips) for (const track of clip.tracks) {
    assert.ok([...track.values, ...track.times].every(Number.isFinite));
    const width = track.getValueSize();
    if (track.name.endsWith('.quaternion')) {
      for (let i = 0; i < track.values.length; i += 4) assert.ok(Math.abs(Math.hypot(...track.values.slice(i, i + 4)) - 1) < 1e-6);
      if (clip.name === 'land') assert.ok(new THREE.Quaternion(...track.values.slice(-4)).angleTo(new THREE.Quaternion()) < 1e-6);
    } else {
      assert.equal(track.name, 'hips.position');
      for (let i = 0; i < track.values.length; i += 3) { assert.equal(track.values[i], 0); assert.equal(track.values[i + 2], 0); }
      if (clip.name === 'land') assert.ok(Math.abs(track.values.at(-2) - .87) < 1e-6);
    }
    if (clip.name === 'fall') for (let i = 0; i < width; i++) assert.ok(Math.abs(track.values[i] - track.values.at(-width + i)) < 1e-6);
  }
});

test('landing absorbs at the knees with both soles grounded and returns all skin vertices to bind pose', () => {
  for (const lod of [0, 1]) {
    const character = createCharacter(THREE, { lod });
    const clip = createAerialClips(THREE).find(clip => clip.name === 'land');
    const mixer = new THREE.AnimationMixer(character.root);
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play();
    let lowestHips = 1;
    for (let i = 0; i <= 96; i++) {
      mixer.setTime(clip.duration * i / 96); character.root.updateMatrixWorld(true); character.skeleton.update();
      lowestHips = Math.min(lowestHips, character.skeleton.getBoneByName('hips').position.y);
      for (const side of ['L', 'R']) {
        const part = character.stats.parts.find(part => part.name === `boot-sole-${side}`);
        let minY = Infinity;
        for (let j = part.start; j < part.start + part.count; j++) minY = Math.min(minY, character.mesh.getVertexPosition(j, new THREE.Vector3()).y);
        assert.ok(minY >= -.004 && minY < .015, `LOD${lod} ${side} time${i}: sole ${minY}`);
      }
    }
    assert.ok(lowestHips < .79);
    for (let i = 0; i < character.mesh.geometry.attributes.position.count; i++) {
      const rest = new THREE.Vector3().fromBufferAttribute(character.mesh.geometry.attributes.position, i);
      assert.ok(character.mesh.getVertexPosition(i, new THREE.Vector3()).distanceTo(rest) < 1e-6);
    }
    assert.equal(action.paused, true);
    assert.ok(character.root.position.length() < 1e-8);
  }
});

test('jump holds a distinct tucked end pose, fall loops, and stop restores the rig', () => {
  const character = createCharacter(THREE);
  const mixer = new THREE.AnimationMixer(character.root);
  const clips = createAerialClips(THREE);
  const jump = clips[0];
  const action = mixer.clipAction(jump).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true; action.play();
  mixer.setTime(jump.duration * 2);
  assert.equal(action.paused, true);
  assert.ok(character.skeleton.getBoneByName('shin_L').quaternion.angleTo(new THREE.Quaternion()) > .4);
  mixer.stopAllAction();
  character.skeleton.bones.forEach(bone => assert.ok(bone.quaternion.angleTo(new THREE.Quaternion()) < 1e-6));
  const fall = mixer.clipAction(clips[1]).play();
  mixer.setTime(clips[1].duration * 2.25);
  assert.equal(fall.paused, false);
  assert.ok(character.root.position.length() < 1e-8);
});
