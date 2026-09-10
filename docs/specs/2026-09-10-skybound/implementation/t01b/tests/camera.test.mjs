import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA,viewport,framing,resizedDistance,resetPosition} from '../src/camera.mjs';
test('DPR budgets and invalid/zero viewport dimensions stay finite',()=>{
  assert.equal(viewport(390,844,3,true).pixelRatio,1.5);
  assert.equal(viewport(1440,900,3,false).pixelRatio,2);
  assert.deepEqual(viewport(0,NaN,NaN),{width:1,height:1,aspect:1,pixelRatio:1});
});
test('three baseline aspects keep a common horizontal subject size in portrait',()=>{
  const landscape=framing(1440/900);
  assert.equal(framing(844/390),landscape);
  assert.ok(Math.abs(framing(390/844)*(390/844)-landscape)<1e-9);
  for(const a of [1440/900,390/844,844/390,.01,NaN])assert.ok(framing(a)<=CAMERA.maxDistance);
});
test('resize preserves relative zoom and bounds repeated orientation changes',()=>{
  const portrait=resizedDistance(100,1.6,390/844);
  assert.ok(Math.abs(resizedDistance(portrait,390/844,1.6)-100)<1e-9);
  assert.equal(resizedDistance(1,1,2),CAMERA.minDistance);
  assert.equal(resizedDistance(1000,1,.1),CAMERA.maxDistance);
});
test('reset is deterministic and the orbit stays above main-island ground and sea',()=>{
  assert.deepEqual(resetPosition(1.6),[43,33,67]);
  assert.ok(CAMERA.target[1]+CAMERA.minDistance*Math.cos(CAMERA.maxPolarAngle)>27);
  assert.ok(CAMERA.minAzimuthAngle>-Math.PI/2&&CAMERA.maxAzimuthAngle<Math.PI/2);
  for(const a of [1.6,390/844,844/390]){
    const p=resetPosition(a);assert.ok(p.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...p.map((v,i)=>v-CAMERA.target[i]))-framing(a))<1e-9);
  }
});
