import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createCharacter } from '../../character/src/model.mjs';
import { createLocomotionClips } from '../../character/src/motion.mjs';
import { createAttackClip } from '../../character/src/attack.mjs';
import { createAnimationBridge, createAttackState } from '../src/animation.mjs';
import { createClipPlayer } from '../src/clip-player.mjs';

test('attack rejects held/airborne/paused/repeat, freezes and resets its single-shot clock', () => {
  const attack=createAttackState(.86), allowed={grounded:true,paused:false,held:false};
  for(const blocked of [{grounded:false},{paused:true},{held:true}]) assert.equal(attack.trigger({...allowed,...blocked}),false);
  assert.equal(attack.trigger(allowed),true); assert.equal(attack.trigger(allowed),false);
  attack.advance(.3); assert.equal(attack.advance(.4,{paused:true}).time,.3);
  assert.equal(attack.advance(.56).active,false); assert.equal(attack.trigger(allowed),true);
  assert.equal(attack.reset().active,false); assert.equal(attack.snapshot().time,0);
});

test('runtime run loops exactly with finite normalized joints and lateral pelvis counter-motion', () => {
  const run=createLocomotionClips(THREE).find(c=>c.name==='run');
  for(const track of run.tracks) {
    const n=track.getValueSize(), values=track.values;
    assert.ok([...values].every(Number.isFinite));
    assert.deepEqual([...values.slice(0,n)],[...values.slice(-n)]);
    if(n===4) for(let i=0;i<values.length;i+=4) assert.ok(Math.abs(Math.hypot(...values.slice(i,i+4))-1)<1e-6);
  }
  const hips=run.tracks.find(t=>t.name==='hips.position').values;
  const x=[...hips].filter((_,i)=>i%3===0); assert.ok(Math.max(...x)>.007 && Math.min(...x)<-.007);
});

test('authored attack visibly moves right hand and returns tracked bind rotations at endpoint', () => {
  const {root}=createCharacter(THREE), hand=root.getObjectByName('hand_R');
  root.updateMatrixWorld(true); const before=hand.getWorldPosition(new THREE.Vector3());
  const clip=createAttackClip(THREE,root), mixer=new THREE.AnimationMixer(root);
  const initial=new Map(clip.tracks.map(t=>[t.name,root.getObjectByName(t.name.split('.')[0]).quaternion.clone()]));
  for(const track of clip.tracks) for(let i=0;i<track.values.length;i+=4) assert.ok(Math.abs(Math.hypot(...track.values.slice(i,i+4))-1)<1e-6);
  const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1); action.clampWhenFinished=true;action.play();
  mixer.setTime(.29);root.updateMatrixWorld(true);
  assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.2);
  mixer.setTime(clip.duration);root.updateMatrixWorld(true);
  for(const [name,q] of initial) assert.ok(root.getObjectByName(name.split('.')[0]).quaternion.angleTo(q)<1e-5);
});

test('walk-run preserves phase and clip switch begins at previous pose then blends to target', () => {
  const {root,clips:base}=createCharacter(THREE), gait=createLocomotionClips(THREE);
  const clips=Object.fromEntries([...base,...gait].map(c=>[c.name,c]));
  clips.attack=createAttackClip(THREE,root);
  const bridge=createAnimationBridge({idle:3,walk:1.12,run:.72,land:.9,jump:.7,fall:1.2});
  const snapshot=mode=>({mode,grounded:true,respawns:0,velocity:{x:0,z:-3}});
  bridge.update(snapshot('walking'),0);const walking=bridge.update(snapshot('walking'),.28);
  const running=bridge.update(snapshot('running'),0);assert.ok(Math.abs(running.time/.72-walking.time/1.12)<1e-9);
  const player=createClipPlayer(THREE,root,clips);player.apply({...walking,once:false},0);
  const chest=root.getObjectByName('chest'), old=chest.quaternion.clone();
  player.apply({...running,once:false},0);assert.ok(chest.quaternion.angleTo(old)<1e-5);
  player.apply({...running,time:running.time+.18,once:false},.18);
  assert.ok(chest.quaternion.angleTo(old)>.001);
  for(let i=0;i<6;i++) {
    const motion=bridge.update(snapshot(i%2?'running':'walking'),.03);
    const before=chest.quaternion.clone();player.apply(motion,.03);
    assert.ok(chest.quaternion.angleTo(before)<.15);
  }
  for(let repeat=0;repeat<2;repeat++) {
    player.apply({name:'attack',time:0,once:true},0);
    player.apply({name:'attack',time:.29,once:true},.29);
    const strike=root.getObjectByName('upperArm_R').quaternion.clone();
    assert.ok(strike.angleTo(new THREE.Quaternion())>.5);
    player.apply({name:'attack',time:clips.attack.duration,once:true},clips.attack.duration-.29);
    player.apply({name:'idle',time:0,once:false},0);
    player.apply({name:'idle',time:.2,once:false},.2);
    assert.ok(root.getObjectByName('upperArm_R').quaternion.angleTo(new THREE.Quaternion())<1e-5);
  }
  player.reset();player.apply({name:'idle',time:0,once:false},0);
  assert.ok(root.getObjectByName('hips').position.distanceTo(new THREE.Vector3(0,.87,0))<1e-5);
});
